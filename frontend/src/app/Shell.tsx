import { Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Images, Users, MessageSquare, LogOut, Menu, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import { useUser } from '@/modules/session/Session'
import { Button } from '@/components/ui/button'
export function Shell({ children }: { children: React.ReactNode }) {
  const user = useUser(); const query = useQueryClient(); const [open, setOpen] = useState(false)
  return <div className="workspace"><a className="skip-link" href="#main">Skip to content</a><header className="workspace-header"><Link to="/app" className="brand"><b>S</b>Signaki<span>Photo review</span></Link><div className="header-account"><span className="muted">{user.is_staff ? 'Studio workspace' : 'Client workspace'}</span><span className="avatar">{(user.first_name || user.username)[0].toUpperCase()}</span><span>{user.first_name || user.username}</span><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Menu size={20} /></Button></div></header><aside className={`sidebar ${open ? 'is-open' : ''}`}><p className="nav-label">WORKSPACE</p><nav onClick={() => setOpen(false)}><Link to="/app" activeOptions={{ exact: true }}><Images size={18} />Properties</Link>{user.is_staff && <><Link to="/app/customers"><Users size={18} />Customers</Link><Link to="/app/feedback"><MessageSquare size={18} />Feedback</Link></>}</nav><div className="sidebar-bottom"><p>Your photographs.<br />Your feedback. One place.</p><Link to="/app/account"><Settings2 size={16} />Account & password</Link><button onClick={async () => { await api('session/', { method: 'DELETE' }); query.clear(); window.location.assign('/app/') }}><LogOut size={16} />Sign out</button></div></aside><main id="main" className="workspace-main">{children}</main></div>
}
