import { createContext, useContext, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { session, write, message } from '@/api/client'
import type { User } from '@/api/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ErrorNotice, Loading, SaveButton } from '@/components/common'
const UserContext = createContext<User | null>(null)
export function useUser() { const user = useContext(UserContext); if (!user) throw new Error('User context missing'); return user }
export function AuthGate({ children }: { children: React.ReactNode }) {
  const result = useQuery({ queryKey: ['session'], queryFn: session, retry: false })
  if (result.isPending) return <Loading />
  if (result.error) return <div className="auth-page"><ErrorNotice error={message(result.error)} /><Button onClick={() => result.refetch()}>Try again</Button></div>
  if (!result.data.user) return <Login />
  return <UserContext.Provider value={result.data.user}>{result.data.must_change_password ? <PasswordForm required /> : children}</UserContext.Provider>
}
function Login() {
  const query = useQueryClient(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  return <div className="auth-page"><div className="brand standalone"><b>S</b>Signaki<span>Photo review</span></div><form className="auth-card" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); const values = Object.fromEntries(new FormData(e.currentTarget));
    try { await write('session/', values); await query.invalidateQueries({ queryKey: ['session'] }) } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }}><p className="eyebrow">YOUR PRIVATE GALLERY</p><h1>A closer look.</h1><p className="muted">Sign in to review your photographs and share feedback.</p>{error && <ErrorNotice error={error} />}<label>Username<Input name="username" autoComplete="username" required /></label><label>Password<Input name="password" type="password" autoComplete="current-password" required /></label><SaveButton busy={busy}>Sign in</SaveButton><p className="caption">Need access? Contact your photographer.</p></form></div>
}
export function PasswordForm({ required = false }: { required?: boolean }) {
  const query = useQueryClient(); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false)
  return <div className="form-page"><p className="eyebrow">ACCOUNT</p><h1>{required ? 'Choose a new password' : 'Change password'}</h1><p className="muted">Use at least 12 characters. Your current password is required.</p><form className="form-stack" onSubmit={async e => {
    e.preventDefault(); setError(''); setBusy(true); const form = e.currentTarget;
    try { await write('password/', Object.fromEntries(new FormData(form))); form.reset(); setSaved(true); await query.invalidateQueries({ queryKey: ['session'] }) } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }}>{error && <ErrorNotice error={error} />}{saved && <p role="status">Password updated.</p>}<label>Current password<Input name="old_password" type="password" autoComplete="current-password" required /></label><label>New password<Input name="new_password1" type="password" autoComplete="new-password" minLength={12} required /></label><label>Confirm password<Input name="new_password2" type="password" autoComplete="new-password" minLength={12} required /></label><SaveButton busy={busy} /></form></div>
}
