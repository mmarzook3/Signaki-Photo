import type { components } from './generated'
// DRF emits all declared output fields; OpenAPI optional flags also describe input defaults.
type Output<T> = T extends (infer U)[] ? Output<U>[] : T extends object ? { [K in keyof T]-?: Output<Exclude<T[K], undefined>> } : T
type Schema = components['schemas']
export type Status = Schema['StatusEnum']
export type User = Output<Schema['User']>
export type Session = Output<Schema['SessionResponse']>
export type Version = Output<Schema['Version']>
export type Property = Output<Schema['Property']>
export type Group = Output<Schema['Group']>
export type Photo = Output<Schema['Photo']>
export type Comment = Output<Schema['Comment']>
export type Gallery = Output<Schema['GalleryResponse']>
export type PhotoDetail = Output<Schema['PhotoResponse']>
export type FeedbackPage = Output<Schema['FeedbackResponse']>
export interface UploadResult { items: { name: string; ok: boolean; error?: string; id?: string }[] }
