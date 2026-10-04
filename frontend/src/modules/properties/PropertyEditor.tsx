import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, write, message } from '@/api/client'
import type { Property, User } from '@/api/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ErrorNotice, SaveButton } from '@/components/common'
export function PropertyEditor({ property, open, onOpenChange }: { property?: Property; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [customer, setCustomer] = useState(String(property?.customer.id || '')); const query = useQueryClient(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api<User[]>('customers/'), enabled: open })
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{property ? 'Property settings' : 'Create property'}</DialogTitle><DialogDescription>Organise the collection and control final delivery.</DialogDescription></DialogHeader><form key={property?.id || 'new'} className="form-stack" onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError('')
    const data = { ...Object.fromEntries(form), archived: form.has('archived'), delivery_shared: form.has('delivery_shared') }
    try { await write(property ? `properties/${property.id}/` : 'properties/', data, property ? 'PATCH' : 'POST'); await query.invalidateQueries({ queryKey: ['properties'] }); await query.invalidateQueries({ queryKey: ['gallery'] }); onOpenChange(false) } catch (err) { setError(message(err)) } finally { setBusy(false) }
  }}>{error && <ErrorNotice error={error} />}<label>Property name<Input name="name" defaultValue={property?.name} maxLength={160} required /></label><label>Address<Input name="address" defaultValue={property?.address} maxLength={240} /></label><label>Customer<select name="customer" value={customer} onChange={e => setCustomer(e.target.value)} required><option value="">Choose a customer</option>{customers.data?.filter(u => u.is_active || u.id === property?.customer.id).map(u => <option value={u.id} key={u.id}>{u.first_name || u.username} ({u.username})</option>)}</select></label><label>Google Drive delivery link<Input name="delivery_url" type="url" defaultValue={property?.delivery_url} placeholder="https://drive.google.com/…" /></label><p className="caption">Drive access is managed separately. Share only when the final photos are ready.</p><label className="check-label"><input type="checkbox" name="delivery_shared" defaultChecked={property?.delivery_shared} />Share delivery link with customer</label><label className="check-label"><input type="checkbox" name="archived" defaultChecked={property?.archived} />Archive property (hide from customer)</label><SaveButton busy={busy || customers.isPending} /></form></DialogContent></Dialog>
}
