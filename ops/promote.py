"""Run on the authorised Linux Docker host only, after staging/restore verification."""
import argparse, json, os, platform, re, subprocess, tarfile, time
from pathlib import Path

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--bundle', required=True)
    args = parser.parse_args()
    if platform.system() != 'Linux':
        raise SystemExit('Run only on the authorised Linux Docker host.')
    root = Path(args.project).resolve()
    if not root.is_relative_to('/opt/projects') or root.name != 'photo-scanaki':
        raise SystemExit('Unexpected production project path.')
    if not re.fullmatch(r'[a-f0-9]{12}', args.version):
        raise SystemExit('Expected a 12-character Git revision.')
    run(['docker', 'image', 'inspect', 'photo-scanaki:' + args.version], stdout=subprocess.DEVNULL)
    run(['systemctl', 'start', 'photo-scanaki-backup.service'])
    audit_source = Path(__file__).with_name('data_audit.py').read_bytes()
    def audit():
        return json.loads(subprocess.check_output(['docker', 'exec', '-i', 'photo-scanaki-web-1', 'python', '-'], input=audit_source))
    before = audit()
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    record = root / 'release-records' / stamp
    record.mkdir(parents=True, mode=0o700)
    (record / 'before.json').write_text(json.dumps(before, indent=2))
    env = root / '.env'
    previous = env.read_bytes()
    (record / 'previous.env').write_bytes(previous)
    (record / 'previous.env').chmod(0o600)
    old_version = next(x.partition('=')[2] for x in previous.decode().splitlines() if x.startswith('APP_VERSION='))
    with tarfile.open(args.bundle, 'r:gz') as archive:
        for item in archive.getmembers():
            if not item.isfile() or not (root / item.name).resolve().is_relative_to(root):
                raise SystemExit('Unsafe source archive member.')
        archive.extractall(root, filter='data')
    lines = [x for x in previous.decode().splitlines() if not x.startswith(('APP_VERSION=', 'NEW_UI_ENABLED='))]
    env.write_text('\n'.join(lines) + f'\nAPP_VERSION={args.version}\nNEW_UI_ENABLED=1\n')
    env.chmod(0o600)
    compose = ['docker', 'compose', '--project-directory', str(root), '-f', str(root / 'compose.yaml')]
    try:
        run(compose + ['stop', 'web', 'video-worker'], stdin=subprocess.DEVNULL)
        run(compose + ['run', '--rm', '-T', '--interactive=false', 'web', 'python', 'manage.py', 'migrate', '--noinput'], stdin=subprocess.DEVNULL)
        run(compose + ['up', '-d', '--no-build', 'web', 'video-worker'], stdin=subprocess.DEVNULL)
        for _ in range(30):
            result = subprocess.run(['curl', '--max-time', '3', '-fsS', 'http://127.0.0.1:18120/healthz/'], capture_output=True)
            if result.returncode == 0 and json.loads(result.stdout).get('version') == args.version:
                break
            time.sleep(2)
        else:
            raise RuntimeError('New release failed health verification')
        after = audit()
        (record / 'after.json').write_text(json.dumps(after, indent=2))
        if before != after:
            raise RuntimeError('Persistent record/media audit differs; inspect before continuing')
        (root / 'SOURCE_VERSION').write_text(args.version)
        summary = {'version': args.version, 'previous': old_version, 'audit': 'identical', 'records': str(record)}
        (record / 'release.json').write_text(json.dumps(summary, indent=2))
        print(json.dumps(summary))
    except Exception:
        run(compose + ['stop', 'video-worker'], stdin=subprocess.DEVNULL)
        env.write_bytes(previous)
        env.chmod(0o600)
        run(compose + ['up', '-d', '--no-build', 'web'], stdin=subprocess.DEVNULL)
        raise

if __name__ == '__main__':
    main()
