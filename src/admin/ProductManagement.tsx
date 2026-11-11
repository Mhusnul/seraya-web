import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../shared/supabase'

type Category = { id: string; name: string; slug: string; is_active: boolean; display_order: number }
type Product = {
  id: string; name: string; slug: string; category_id: string; short_description: string
  description: string; status: 'draft' | 'published' | 'archived'; display_order: number
  seo_title: string; seo_description: string; updated_at: string
}
type Media = { id: string; object_path: string; original_file_name: string; alt_text: string }
type Editor = Omit<Product, 'id' | 'updated_at'> & { id: string | null; updated_at: string | null; images: Media[]; benefits: string; applications: string }

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const primary = 'rounded-lg bg-[#0b192c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
const secondary = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50'
const pageSize = 10
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const blank = (): Editor => ({ id: null, updated_at: null, category_id: '', name: '', slug: '', short_description: '', description: '', status: 'draft', display_order: 0, seo_title: '', seo_description: '', images: [], benefits: '', applications: '' })
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export function ProductManagement() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [resolvedKey, setResolvedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [categoryForm, setCategoryForm] = useState<Category | null>(null)
  const [categoryMode, setCategoryMode] = useState(false)
  const [picker, setPicker] = useState(false)
  const [pickedImages, setPickedImages] = useState<Media[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaPage, setMediaPage] = useState(0)
  const [mediaMore, setMediaMore] = useState(false)
  const [preview, setPreview] = useState(false)
  const loadKey = JSON.stringify([revision, page, search, filterCategory, filterStatus])
  const loading = resolvedKey !== loadKey

  useEffect(() => {
    let active = true
    async function load() {
      try {
        let query = supabase.from('products').select('*', { count: 'exact' }).order('display_order').order('id').range(page * pageSize, (page + 1) * pageSize - 1)
        if (search.trim()) query = query.ilike('name', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`)
        if (filterCategory) query = query.eq('category_id', filterCategory)
        if (filterStatus) query = query.eq('status', filterStatus)
        const [p, c] = await Promise.all([query, supabase.from('product_categories').select('*').order('display_order').order('name')])
        if (!active) return
        if (p.error || c.error || !p.data || !c.data || p.count === null) throw new Error('load failed')
        setProducts(p.data as Product[]); setCategories(c.data as Category[]); setCount(p.count); setLoadError('')
      } catch {
        if (active) { setProducts([]); setCount(0); setLoadError('Produk atau kategori tidak dapat dimuat. Periksa koneksi dan coba lagi.') }
      } finally { if (active) setResolvedKey(loadKey) }
    }
    void load()
    return () => { active = false }
  }, [revision, page, search, filterCategory, filterStatus, loadKey])

  useEffect(() => {
    if (!picker) return
    let active = true
    async function loadMedia() {
      try {
        let query = supabase.from('media_assets').select('id, object_path, original_file_name, alt_text').eq('state', 'ready')
          .order('created_at', { ascending: false }).order('id', { ascending: false }).range(mediaPage * 12, mediaPage * 12 + 12)
        if (mediaSearch.trim()) query = query.ilike('original_file_name', `%${mediaSearch.trim().replace(/[\\%_]/g, '\\$&')}%`)
        const { data, error: mediaError } = await query
        if (!active) return
        if (mediaError || !data) throw new Error('media unavailable')
        setMedia(data.slice(0, 12) as Media[]); setMediaMore(data.length > 12)
      } catch {
        if (active) { setMedia([]); setMediaMore(false); setError('Media tidak dapat dimuat. Tutup dan buka kembali pemilih untuk mencoba lagi.') }
      }
    }
    void loadMedia()
    return () => { active = false }
  }, [picker, mediaPage, mediaSearch])

  function reload() { setError(''); setRevision((n) => n + 1) }
  function clearFeedback() { setError(''); setNotice('') }

  async function edit(product: Product) {
    setBusy(true); clearFeedback()
    try {
      const [imgs, benefits, applications] = await Promise.all([
        supabase.from('product_images').select('media_id, display_order').eq('product_id', product.id).order('display_order'),
        supabase.from('product_benefits').select('title').eq('product_id', product.id).order('display_order'),
        supabase.from('product_applications').select('title').eq('product_id', product.id).order('display_order'),
      ])
      if (imgs.error || benefits.error || applications.error || !imgs.data || !benefits.data || !applications.data) throw new Error('load failed')
      const assets: Media[] = []
      if (imgs.data.length) {
        const { data: rows, error: mediaError } = await supabase.from('media_assets').select('id, object_path, original_file_name, alt_text').in('id', imgs.data.map((row) => row.media_id))
        if (mediaError || !rows) throw new Error('media unavailable')
        for (const row of imgs.data) {
          const value = rows.find((m) => m.id === row.media_id)
          if (!value) throw new Error('media unavailable')
          assets.push(value)
        }
      }
      setEditor({ ...product, images: assets, benefits: benefits.data.map((v) => v.title).join('\n'), applications: applications.data.map((v) => v.title).join('\n') })
    } catch { setError('Detail produk tidak dapat dimuat. Coba lagi.') }
    finally { setBusy(false) }
  }

  async function save(status: Product['status']) {
    if (!editor) return
    clearFeedback()
    if (editor.name.trim().length < 2 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(editor.slug) || !editor.category_id) { setError('Nama minimal 2 karakter, slug harus berupa huruf kecil/angka dengan pemisah tanda hubung, dan kategori wajib dipilih.'); return }
    if ([...lines(editor.benefits), ...lines(editor.applications)].some((line) => line.length > 200) || lines(editor.benefits).length > 30 || lines(editor.applications).length > 30) { setError('Manfaat dan aplikasi maksimal 30 baris, masing-masing maksimal 200 karakter.'); return }
    if (status === 'published' && (!editor.short_description.trim() || !editor.description.trim() || !editor.images.length)) {
      setError('Untuk publish, isi deskripsi singkat, deskripsi lengkap, dan pilih gambar utama.'); return
    }
    setBusy(true)
    try {
      const { error: saveError } = await supabase.rpc('save_product', { payload: { ...editor, status, images: editor.images.map((m) => m.id), benefits: lines(editor.benefits), applications: lines(editor.applications) } })
      if (saveError) {
        if (saveError.code === '23505') throw new Error('Slug atau gambar sudah digunakan. Gunakan nilai yang unik.')
        if (saveError.message.includes('product has changed')) throw new Error('Produk telah diubah di sesi lain. Tutup formulir dan buka kembali sebelum menyimpan.')
        if (saveError.message.includes('active category')) throw new Error('Kategori tidak aktif. Pilih kategori aktif.')
        if (saveError.message.includes('media unavailable')) throw new Error('Salah satu gambar tidak tersedia. Pilih gambar lain.')
        throw new Error('Produk tidak dapat disimpan. Periksa isian dan coba lagi.')
      }
      setEditor(null); setPreview(false); setNotice('Produk berhasil disimpan.'); reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Produk tidak dapat disimpan.') }
    finally { setBusy(false) }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoryForm) return
    setBusy(true); clearFeedback()
    try {
      const { error: saveError } = await supabase.rpc('save_product_category', {
        category_id: categoryForm.id || null, category_name: categoryForm.name, category_slug: categoryForm.slug,
        category_active: categoryForm.is_active, category_order: categoryForm.display_order,
      })
      if (saveError) {
        if (saveError.code === '23505') throw new Error('Slug kategori sudah digunakan.')
        if (saveError.message.includes('unpublish')) throw new Error('Tarik semua produk published dari kategori ini sebelum menonaktifkannya.')
        throw new Error('Kategori tidak dapat disimpan. Periksa isian dan coba lagi.')
      }
      setCategoryForm(null); setNotice('Kategori berhasil disimpan.'); reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Kategori tidak dapat disimpan.') }
    finally { setBusy(false) }
  }

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Product Management</p><h1 className="mt-2 text-3xl font-bold text-[#0b192c]">Produk</h1><p className="mt-2 text-sm text-slate-600">Kelola katalog, kategori, dan publikasi produk.</p></div>
      <div className="flex gap-2"><button className={secondary} onClick={() => { setCategoryMode(!categoryMode); setEditor(null); clearFeedback() }}>{categoryMode ? 'Daftar produk' : 'Kelola kategori'}</button><button className={primary} onClick={() => { setCategoryMode(false); setEditor(blank()); clearFeedback() }}>Tambah produk</button></div></div>
    {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {!loading && loadError && <p role="alert" className="mt-4 text-sm text-red-700">{loadError}</p>}
    {editor ? <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex justify-between gap-3"><h2 className="text-lg font-bold">{editor.id ? 'Edit produk' : 'Produk baru'}</h2><button className={secondary} onClick={() => { setEditor(null); setPreview(false); clearFeedback() }}>Tutup</button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Nama produk<input className={`${field} mt-1`} maxLength={150} value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value, slug: editor.id ? editor.slug : slugify(e.target.value) })} /></label>
        <label className="text-sm font-semibold">Slug<input className={`${field} mt-1`} value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value })} /></label>
        <label className="text-sm font-semibold">Kategori<select className={`${field} mt-1`} value={editor.category_id} onChange={(e) => setEditor({ ...editor, category_id: e.target.value })}><option value="">Pilih kategori</option>{categories.filter((c) => c.is_active || c.id === editor.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}{!c.is_active && ' (nonaktif)'}</option>)}</select></label>
        <label className="text-sm font-semibold">Urutan<input className={`${field} mt-1`} type="number" value={editor.display_order} onChange={(e) => setEditor({ ...editor, display_order: Number(e.target.value) })} /></label>
        <label className="text-sm font-semibold md:col-span-2">Deskripsi singkat<textarea className={`${field} mt-1`} maxLength={300} value={editor.short_description} onChange={(e) => setEditor({ ...editor, short_description: e.target.value })} /></label>
        <label className="text-sm font-semibold md:col-span-2">Deskripsi lengkap<textarea className={`${field} mt-1`} rows={5} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></label>
        <label className="text-sm font-semibold">Manfaat <span className="font-normal">(satu per baris)</span><textarea className={`${field} mt-1`} rows={4} value={editor.benefits} onChange={(e) => setEditor({ ...editor, benefits: e.target.value })} /></label>
        <label className="text-sm font-semibold">Aplikasi <span className="font-normal">(satu per baris)</span><textarea className={`${field} mt-1`} rows={4} value={editor.applications} onChange={(e) => setEditor({ ...editor, applications: e.target.value })} /></label>
        <label className="text-sm font-semibold">SEO title<input className={`${field} mt-1`} value={editor.seo_title} onChange={(e) => setEditor({ ...editor, seo_title: e.target.value })} /></label>
        <label className="text-sm font-semibold">SEO description<textarea className={`${field} mt-1`} value={editor.seo_description} onChange={(e) => setEditor({ ...editor, seo_description: e.target.value })} /></label>
      </div>
      <div className="mt-5"><h3 className="font-semibold">Gambar produk</h3><p className="mt-1 text-sm text-slate-500">Gambar pertama adalah gambar utama. Maksimal 10 gambar. Upload gambar melalui Media Library.</p>
        <div className="mt-3 space-y-2">{editor.images.map((m, i) => <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm"><span className="min-w-0 flex-1 truncate">{i === 0 ? 'Utama: ' : ''}{m.original_file_name}</span>
          <button type="button" className={secondary} disabled={i === 0} onClick={() => { const images = [...editor.images]; [images[i - 1], images[i]] = [images[i], images[i - 1]]; setEditor({ ...editor, images }) }}>Naik</button>
          <button type="button" className={secondary} disabled={i === editor.images.length - 1} onClick={() => { const images = [...editor.images]; [images[i + 1], images[i]] = [images[i], images[i + 1]]; setEditor({ ...editor, images }) }}>Turun</button>
          <button type="button" className={secondary} onClick={() => setEditor({ ...editor, images: editor.images.filter((v) => v.id !== m.id) })}>Lepas</button></div>)}</div>
        <button className={`${secondary} mt-3`} onClick={() => { setPickedImages(editor.images); setPicker(true); setMediaPage(0); setMediaSearch(''); setMedia([]) }}>Pilih dari Media Library</button> <a className="text-sm font-semibold text-sky-700" href="/admin/media" target="_blank" rel="noreferrer">Buka Media Library</a>
      </div>
      <div className="mt-6 flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={() => setPreview(!preview)}>Preview</button><button className={secondary} disabled={busy} onClick={() => void save('draft')}>Simpan draft</button><button className={primary} disabled={busy} onClick={() => void save('published')}>Publish</button>{editor.id && <button className={secondary} disabled={busy} onClick={() => { if (window.confirm('Arsipkan produk ini? Produk tidak lagi tampil di katalog publik.')) void save('archived') }}>Arsipkan</button>}</div>
      {preview && <div className="mt-5 rounded-lg border border-slate-200 p-4"><h3 className="text-lg font-bold">{editor.name || 'Preview produk'}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{editor.short_description}</p><p className="mt-2 whitespace-pre-wrap text-sm">{editor.description}</p><p className="mt-3 text-xs text-slate-500">Preview konten belum dipublikasikan.</p></div>}
    </section> : categoryMode ? <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between"><h2 className="font-bold">Kategori</h2><button className={secondary} onClick={() => setCategoryForm({ id: '', name: '', slug: '', is_active: true, display_order: 0 })}>Tambah kategori</button></div>
      <ul className="mt-4 space-y-2">{categories.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{c.name} · {c.slug} · {c.is_active ? 'Aktif' : 'Nonaktif'}</span><button className={secondary} onClick={() => setCategoryForm(c)}>Edit</button></li>)}</ul>
      {categoryForm && <form onSubmit={saveCategory} className="mt-5 grid gap-3 md:grid-cols-2"><label className="text-sm">Nama<input required minLength={2} maxLength={100} className={`${field} mt-1`} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value, slug: categoryForm.id ? categoryForm.slug : slugify(e.target.value) })} /></label><label className="text-sm">Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${field} mt-1`} value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} /></label><label className="text-sm">Urutan<input type="number" className={`${field} mt-1`} value={categoryForm.display_order} onChange={(e) => setCategoryForm({ ...categoryForm, display_order: Number(e.target.value) })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })} />Aktif</label><div className="flex gap-2"><button className={primary} disabled={busy}>Simpan kategori</button><button type="button" className={secondary} onClick={() => setCategoryForm(null)}>Batal</button></div></form>}
    </section> : <>
      <div className="mt-6 flex flex-wrap gap-2"><input aria-label="Cari produk" placeholder="Cari produk" className={`${field} min-w-48 flex-1`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /><select aria-label="Filter kategori" className={secondary} value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(0) }}><option value="">Semua kategori</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Filter status" className={secondary} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0) }}><option value="">Semua status</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><button className={secondary} onClick={reload}>Perbarui</button></div>
      {loading ? <p role="status" className="mt-6 text-sm">Memuat produk...</p> : loadError ? null : products.length === 0 ? <p className="mt-6 text-sm text-slate-500">Tidak ada produk yang sesuai.</p> : <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Produk', 'Kategori', 'Status', 'Urutan', 'Aksi'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{products.map((p) => <tr key={p.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{p.name}</td><td className="px-4 py-3">{categories.find((c) => c.id === p.category_id)?.name ?? '-'}</td><td className="px-4 py-3">{p.status}</td><td className="px-4 py-3">{p.display_order}</td><td className="px-4 py-3"><button className={secondary} disabled={busy} onClick={() => void edit(p)}>Lihat / Edit</button></td></tr>)}</tbody></table></div>}
      <div className="mt-4 flex justify-between text-sm"><span>{count} produk · Halaman {page + 1}</span><div className="flex gap-2"><button className={secondary} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button><button className={secondary} disabled={(page + 1) * pageSize >= count} onClick={() => setPage((p) => p + 1)}>Berikutnya</button></div></div>
    </>}
    {picker && editor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="product-picker-heading" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5"><div className="flex justify-between gap-2"><h2 id="product-picker-heading" className="font-bold">Pilih gambar</h2><div className="flex gap-2"><button className={secondary} onClick={() => { setPicker(false); setError('') }}>Batal</button><button className={secondary} onClick={() => { setEditor({ ...editor, images: pickedImages }); setPicker(false); setError('') }}>Selesai</button></div></div><input aria-label="Cari media" className={`${field} mt-4`} placeholder="Cari nama file" value={mediaSearch} onChange={(e) => { setMediaSearch(e.target.value); setMediaPage(0) }} />
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map((m) => <button key={m.id} aria-pressed={pickedImages.some((i) => i.id === m.id)} className="overflow-hidden rounded-lg border border-slate-200 text-left" onClick={() => { if (pickedImages.some((i) => i.id === m.id)) { setPickedImages(pickedImages.filter((i) => i.id !== m.id)); return } if (pickedImages.length >= 10) { setError('Maksimal 10 gambar.'); return } setError(''); setPickedImages([...pickedImages, m]) }}><img className="aspect-square w-full object-cover" src={supabase.storage.from('website-media').getPublicUrl(m.object_path).data.publicUrl} alt={m.alt_text} /><span className="block truncate p-2 text-sm">{m.original_file_name}{pickedImages.some((i) => i.id === m.id) ? ' ✓' : ''}</span></button>)}</div><div className="mt-4 flex gap-2"><button className={secondary} disabled={mediaPage === 0} onClick={() => setMediaPage((p) => p - 1)}>Sebelumnya</button><button className={secondary} disabled={!mediaMore} onClick={() => setMediaPage((p) => p + 1)}>Berikutnya</button></div></section></div>}
  </>
}
