"""Create an allow-listed source bundle from tracked files. Never package local data."""
import hashlib
import io
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]

def bundle():
    for args in [['git', 'diff', '--quiet'], ['git', 'diff', '--cached', '--quiet']]:
        if subprocess.run(args, cwd=ROOT).returncode:
            raise RuntimeError('Commit tracked changes before creating a release bundle.')
    names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    paths = [ROOT / name for name in names if name]
    forbidden = {'.env', '.venv', 'node_modules', 'data', 'artifacts', 'output', '.playwright-cli', 'test-results', 'playwright-report'}
    for path in paths:
        if forbidden.intersection(path.relative_to(ROOT).parts):
            raise RuntimeError(f'Unsafe tracked path: {path.name}')
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip()
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode='w:gz') as archive:
        for path in paths:
            archive.add(path, arcname=path.relative_to(ROOT).as_posix())
    return revision, data.getvalue()

if __name__ == '__main__':
    revision, data = bundle()
    output = ROOT / 'artifacts' / f'source-{revision[:12]}.tar.gz'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(data)
    print(f'{output.name}: {len(data)} bytes, sha256={hashlib.sha256(data).hexdigest()}')
