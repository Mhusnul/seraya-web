import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../shared/supabase'

type MediaType = 'product' | 'article' | 'service' | 'website' | 'general'
type Media = {
  id: string
  object_path: string
  original_file_name: string
  mime_type: string
  file_size: number
  media_type: MediaType
  alt_text: string
  uploaded_by: string
  state: 'pending' | 'ready' | 'deleting'
  created_at: string
}
type Result = { key: string; items: Media[]; count: number; error: string }

const categories: { value: MediaType; label: string }[] = [
  { value: 'product', label: 'Produk' }, { value: 'article', label: 'Artikel' },
  { value: 'service', label: 'Layanan' }, { value: 'website', label: 'Website' },
  { value: 'general', label: 'Umum' },
]
const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800'
const button = 'rounded-lg bg-[#0b192c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
const pageSize = 12

function isMedia(value: unknown): value is Media {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  return typeof m.id === 'string' && typeof m.object_path === 'string'
    && typeof m.original_file_name === 'string' && typeof m.mime_type === 'string'
    && typeof m.file_size === 'number' && categories.some((c) => c.value === m.media_type)
    && typeof m.alt_text === 'string' && typeof m.uploaded_by === 'string'
    && ['pending', 'ready', 'deleting'].includes(String(m.state)) && typeof m.created_at === 'string'
}

function publicUrl(path: string) {
  return supabase.storage.from('website-media').getPublicUrl(path).data.publicUrl
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function validateFile(file: File): Promise<string | null> {
  if (!file.size || file.size > 5 * 1024 * 1024) return 'Ukuran harus antara 1 byte dan 5 MB.'
  if (file.name.length > 255) return 'Nama file maksimal 255 karakter.'
  const allowed: Record<string, RegExp> = {
    'image/jpeg': /\.jpe?g$/i, 'image/png': /\.png$/i, 'image/webp': /\.webp$/i,
  }
  if (!allowed[file.type]?.test(file.name)) return 'Hanya JPG, PNG, atau WebP dengan ekstensi sesuai yang diizinkan.'
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  const webp = bytes.length >= 12 && [82, 73, 70, 70].every((v, i) => bytes[i] === v) && [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v)
  if (!(file.type === 'image/jpeg' ? jpeg : file.type === 'image/png' ? png : webp)) return 'Isi file tidak sesuai format gambar.'
  return null
}

export function MediaManagement({ userId }: { userId: string }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [selected, setSelected] = useState<Media | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploadCategory, setUploadCategory] = useState<MediaType>('general')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const key = JSON.stringify([search.trim(), category, page, revision])
  const current = result?.key === key ? result : null

  useEffect(() => {
    let active = true
    async function load() {
      try {
        let query = supabase.from('media_assets').select('*', { count: 'exact' })
          .order('created_at', { ascending: false }).order('id', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)
        if (search.trim()) query = query.ilike('original_file_name', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`)
        if (category) query = query.eq('media_type', category)
        const { data, count, error: loadError } = await query
        if (!active) return
        if (loadError || !data || count === null || !data.every(isMedia)) {
          setResult({ key, items: [], count: 0, error: 'Media tidak dapat dimuat. Pastikan modul dan bucket sudah dikonfigurasi, lalu coba lagi.' })
        } else setResult({ key, items: data, count, error: '' })
      } catch {
        if (active) setResult({ key, items: [], count: 0, error: 'Media tidak dapat dimuat. Periksa koneksi dan coba lagi.' })
      }
    }
    void load()
    return () => { active = false }
  }, [key, search, category, page])

  function refresh() { setRevision((value) => value + 1) }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    setMessage('')
    if (!files.length || files.length > 10) { setError('Pilih 1 sampai 10 file.'); return }
    setBusy(true)
    try {
      const failures: string[] = []
      let success = 0
      for (const [index, file] of files.entries()) {
        setMessage(`Memproses ${index + 1} dari ${files.length}: ${file.name}`)
        const invalid = await validateFile(file)
        if (invalid) { failures.push(`${file.name}: ${invalid}`); continue }
        const { data, error: prepareError } = await supabase.rpc('media_prepare_upload', {
          filename: file.name, mime: file.type, bytes: file.size, category: uploadCategory, alt: '',
        })
        if (prepareError || !isMedia(data)) { failures.push(`${file.name}: tidak dapat menyiapkan upload.`); continue }
        const { error: uploadError } = await supabase.storage.from('website-media').upload(data.object_path, file, { contentType: file.type, upsert: false })
        if (uploadError) { failures.push(`${file.name}: upload gagal; bersihkan item tertunda dari library.`); continue }
        const { error: completeError } = await supabase.rpc('media_complete_upload', { asset_id: data.id })
        if (completeError) { failures.push(`${file.name}: file terunggah, tetapi metadata belum selesai; gunakan Pulihkan.`); continue }
        success++
      }
      setMessage(`${success} dari ${files.length} file berhasil diunggah.`)
      setError(failures.join(' '))
      setFiles([])
      form.reset()
      refresh()
    } catch {
      setError('Operasi terhenti. Periksa item tertunda di library sebelum mencoba kembali.')
      setMessage('')
      refresh()
    } finally { setBusy(false) }
  }

  async function recover(asset: Media) {
    setBusy(true); setError(''); setMessage('')
    try {
      const { error: rpcError } = await supabase.rpc('media_complete_upload', { asset_id: asset.id })
      if (rpcError) throw rpcError
      setMessage('Upload berhasil dipulihkan.'); setSelected(null); refresh()
    } catch { setError('Upload belum dapat dipulihkan. Jika file tidak terunggah, hapus item tertunda.') }
    finally { setBusy(false) }
  }

  async function remove(asset: Media) {
    if (!window.confirm(`Hapus ${asset.original_file_name}? Tindakan ini tidak dapat dibatalkan.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      const { data: path, error: beginError } = await supabase.rpc('media_begin_delete', { asset_id: asset.id })
      if (beginError?.message.includes('media is in use')) throw new Error('Gambar sedang digunakan produk atau pemeriksaan referensi modul lain belum tersedia.')
      if (beginError || typeof path !== 'string') throw new Error('Penghapusan tidak dapat dimulai. Periksa akses dan coba lagi.')
      const { error: storageError } = await supabase.storage.from('website-media').remove([path])
      if (storageError) throw storageError
      const { error: finishError } = await supabase.rpc('media_finish_delete', { asset_id: asset.id })
      if (finishError) throw finishError
      setMessage('Media berhasil dihapus.'); setSelected(null)
      if (page > 0 && current?.items.length === 1) setPage((value) => value - 1)
      refresh()
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith('Gambar sedang digunakan')
        ? e.message
        : 'Penghapusan belum selesai. Perbarui library dan coba lagi; jangan gunakan file yang berstatus penghapusan.')
      setSelected(null); refresh()
    } finally { setBusy(false) }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>, asset: Media) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const { error: updateError } = await supabase.rpc('media_update_metadata', { asset_id: asset.id, category: asset.media_type, alt: asset.alt_text })
      if (updateError) throw updateError
      setMessage('Metadata berhasil disimpan.'); setSelected(null); refresh()
    } catch { setError('Metadata tidak dapat disimpan. Periksa akses atau koneksi dan coba lagi.') }
    finally { setBusy(false) }
  }

  async function copy(path: string) {
    try { await navigator.clipboard.writeText(publicUrl(path)); setMessage('URL publik disalin.'); setError('') }
    catch { setError('URL tidak dapat disalin. Salin alamat yang ditampilkan secara manual.') }
  }

  return <>
    <div><p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Media Management</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0b192c]">Media Library</h1>
      <p className="mt-2 text-sm text-slate-600">Kelola gambar publik untuk website. Jangan unggah data sensitif.</p></div>
    <form onSubmit={upload} className="mt-7 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
      <label className="block text-sm font-semibold">Pilih gambar <span className="font-normal text-slate-500">(JPG, PNG, WebP; maks. 5 MB; 10 file)</span>
        <input className="mt-2 block max-w-full text-sm" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </label>
      <label className="block text-sm font-semibold">Kategori
        <select className={`${input} mt-2 block`} value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as MediaType)}>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <button className={button} disabled={busy || files.length === 0}>Upload Media</button>
    </form>
    {!selected && message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
    {!selected && error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-7 flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="media-search">Cari nama file</label>
      <input id="media-search" className={`${input} min-w-48 flex-1`} placeholder="Cari nama file" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
      <label className="sr-only" htmlFor="media-category">Filter kategori</label>
      <select id="media-category" className={input} value={category} onChange={(e) => { setCategory(e.target.value); setPage(0) }}>
        <option value="">Semua kategori</option>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <button className={`${input} font-semibold`} onClick={refresh}>Perbarui</button>
    </div>
    {!current ? <p role="status" className="mt-6 text-sm text-slate-500">Memuat media...</p>
      : current.error ? <p role="alert" className="mt-6 text-sm text-red-700">{current.error}</p>
      : current.items.length === 0 ? <p className="mt-6 text-sm text-slate-500">{search || category ? 'Tidak ada media yang sesuai.' : 'Belum ada media.'}</p>
      : <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {current.items.map((asset) => <button key={asset.id} onClick={() => setSelected(asset)} className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm hover:border-sky-500">
          {asset.state === 'ready' ? <img src={publicUrl(asset.object_path)} alt="" className="aspect-square w-full object-cover" loading="lazy" />
            : <div className="flex aspect-square items-center justify-center bg-slate-100 p-3 text-center text-sm text-slate-600">{asset.state === 'pending' ? 'Upload tertunda' : 'Penghapusan tertunda'}</div>}
          <div className="p-3"><p className="truncate text-sm font-semibold">{asset.original_file_name}</p>
            <p className="mt-1 text-xs text-slate-500">{categories.find((c) => c.value === asset.media_type)?.label} · {formatSize(asset.file_size)}</p></div>
        </button>)}
      </div>}
    {current && !current.error && <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
      <span>{current.count} media · Halaman {page + 1}</span><div className="flex gap-2">
        <button className={input} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
        <button className={input} disabled={(page + 1) * pageSize >= current.count} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
      </div></div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="media-detail-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4"><h2 id="media-detail-title" className="break-all text-lg font-bold">{selected.original_file_name}</h2>
          <button onClick={() => setSelected(null)} aria-label="Tutup detail" className="text-xl">×</button></div>
        {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {selected.state === 'ready' && <img src={publicUrl(selected.object_path)} alt={selected.alt_text} className="mt-4 max-h-64 w-full rounded-lg object-contain" />}
        <dl className="mt-4 space-y-1 break-all text-sm text-slate-600">
          <div><dt className="inline font-semibold">Status: </dt><dd className="inline">{selected.state}</dd></div>
          <div><dt className="inline font-semibold">Tipe: </dt><dd className="inline">{selected.mime_type} · {formatSize(selected.file_size)}</dd></div>
          <div><dt className="inline font-semibold">Path: </dt><dd className="inline">{selected.object_path}</dd></div>
          <div><dt className="inline font-semibold">Pengunggah: </dt><dd className="inline">{selected.uploaded_by}</dd></div>
          <div><dt className="inline font-semibold">Tanggal: </dt><dd className="inline">{new Date(selected.created_at).toLocaleString('id-ID')}</dd></div>
          {selected.state === 'ready' && <div><dt className="inline font-semibold">URL publik: </dt><dd className="inline">{publicUrl(selected.object_path)}</dd></div>}
        </dl>
        {selected.state === 'ready' && <form onSubmit={(e) => void saveMetadata(e, selected)} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">Kategori<select className={`${input} mt-1 block w-full`} value={selected.media_type} onChange={(e) => setSelected({ ...selected, media_type: e.target.value as MediaType })}>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label className="block text-sm font-semibold">Alt text<input maxLength={500} className={`${input} mt-1 block w-full`} value={selected.alt_text} onChange={(e) => setSelected({ ...selected, alt_text: e.target.value })} /></label>
          <div className="flex flex-wrap gap-2"><button disabled={busy} className={button}>Simpan metadata</button><button type="button" className={input} onClick={() => void copy(selected.object_path)}>Salin URL</button></div>
        </form>}
        {selected.state === 'pending' && selected.uploaded_by === userId && <button className={`${button} mt-4`} disabled={busy} onClick={() => void recover(selected)}>Pulihkan upload</button>}
        <button className="mt-4 block text-sm font-semibold text-red-700 disabled:opacity-50" disabled={busy} onClick={() => void remove(selected)}>{selected.state === 'deleting' ? 'Lanjutkan penghapusan' : 'Hapus media'}</button>
      </section>
    </div>}
  </>
}
