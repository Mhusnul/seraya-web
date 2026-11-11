import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { JSONContent } from '@tiptap/react'
import { supabase } from '../shared/supabase'
import { ArticleContent } from '../shared/ArticleContent'
import { ArticleEditor } from './ArticleEditor'

type Category = { id: string; name: string; slug: string; is_active: boolean; display_order: number }
type Asset = { id: string; object_path: string; original_file_name: string; alt_text: string }
type Product = { id: string; name: string }
type Article = { id: string; title: string; slug: string; category_id: string; excerpt: string; content: JSONContent; cover_media_id: string | null; status: 'draft' | 'published' | 'archived'; is_featured: boolean; author_name: string; seo_title: string; seo_description: string; updated_at: string; published_at: string | null }
type Draft = Omit<Article, 'id' | 'updated_at' | 'published_at'> & { id: string | null; updated_at: string | null; related_products: string[] }
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const primary = 'rounded-lg bg-[#0b192c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
const secondary = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50'
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const blank = (): Draft => ({ id: null, updated_at: null, title: '', slug: '', category_id: '', excerpt: '', content: { type: 'doc', content: [{ type: 'paragraph' }] }, cover_media_id: null, status: 'draft', is_featured: false, author_name: '', seo_title: '', seo_description: '', related_products: [] })

function imageIds(content: JSONContent): string[] {
  const ids = new Set<string>()
  function visit(node: JSONContent) {
    if (node.type === 'image' && typeof node.attrs?.mediaId === 'string') ids.add(node.attrs.mediaId)
    node.content?.forEach(visit)
  }
  visit(content)
  return [...ids].sort()
}

function trustedImageSources(content: JSONContent, assets: { id: string; object_path: string }[]): JSONContent {
  if (content.type === 'image') {
    const asset = assets.find((item) => item.id === content.attrs?.mediaId)
    if (!asset) throw new Error('image unavailable')
    return { ...content, attrs: { ...content.attrs, src: supabase.storage.from('website-media').getPublicUrl(asset.object_path).data.publicUrl } }
  }
  return { ...content, content: content.content?.map((node) => trustedImageSources(node, assets)) }
}

async function loadPublishedProducts(): Promise<Product[]> {
  const products: Product[] = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from('products').select('id,name').eq('status', 'published')
      .order('name').order('id').range(start, start + 499)
    if (error || !data) throw new Error('products unavailable')
    products.push(...data)
    if (data.length < 500) return products
  }
}

export function BlogManagement() {
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [media, setMedia] = useState<Asset[]>([])
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaPage, setMediaPage] = useState(0)
  const [moreMedia, setMoreMedia] = useState(false)
  const [picker, setPicker] = useState<'cover' | 'inline' | null>(null)
  const [inlineImage, setInlineImage] = useState<{ id: string; path: string; alt: string; caption: string } | null>(null)
  const [caption, setCaption] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [preview, setPreview] = useState(false)
  const [previewResult, setPreviewResult] = useState<{ key: string; media: { id: string; path: string; alt: string }[]; error: string }>({ key: '', media: [], error: '' })
  const [categoryMode, setCategoryMode] = useState(false)
  const [categoryForm, setCategoryForm] = useState<Category | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)
  const [resolved, setResolved] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const key = JSON.stringify([search, category, status, page, revision])
  const loading = resolved !== key
  const refresh = () => setRevision((n) => n + 1)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        let query = supabase.from('articles').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).order('id', { ascending: false }).range(page * 10, page * 10 + 9)
        if (search.trim()) query = query.ilike('title', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`)
        if (category) query = query.eq('category_id', category)
        if (status) query = query.eq('status', status)
        const [a, c, p] = await Promise.all([query, supabase.from('article_categories').select('*').order('display_order'), loadPublishedProducts()])
        if (a.error || c.error || !a.data || !c.data || a.count === null) throw new Error('load failed')
        if (active) { setArticles(a.data as Article[]); setCategories(c.data as Category[]); setProducts(p); setCount(a.count); setLoadError('') }
      } catch { if (active) setLoadError('Artikel tidak dapat dimuat. Periksa koneksi dan coba lagi.') }
      finally { if (active) setResolved(key) }
    }
    void load()
    return () => { active = false }
  }, [key, search, category, status, page])

  useEffect(() => {
    if (!picker) return
    let active = true
    async function load() {
      try {
        let query = supabase.from('media_assets').select('id,object_path,original_file_name,alt_text').eq('state', 'ready').order('created_at', { ascending: false }).order('id', { ascending: false }).range(mediaPage * 12, mediaPage * 12 + 12)
        if (mediaSearch.trim()) query = query.ilike('original_file_name', `%${mediaSearch.trim().replace(/[\\%_]/g, '\\$&')}%`)
        const { data, error: resultError } = await query
        if (resultError || !data) throw new Error('media error')
        if (active) { setMedia(data.slice(0, 12) as Asset[]); setMoreMedia(data.length > 12) }
      } catch { if (active) { setMedia([]); setMoreMedia(false); setError('Media tidak dapat dimuat. Tutup dan buka kembali pemilih.') } }
    }
    void load()
    return () => { active = false }
  }, [picker, mediaSearch, mediaPage])

  const previewIds = JSON.stringify(draft ? [...new Set([...imageIds(draft.content), ...(draft.cover_media_id ? [draft.cover_media_id] : [])])].sort() : [])
  useEffect(() => {
    if (!preview) return
    let active = true
    async function load() {
      const ids: string[] = JSON.parse(previewIds)
      if (!ids.length) { setPreviewResult({ key: previewIds, media: [], error: '' }); return }
      try {
        const { data, error: resultError } = await supabase.from('media_assets').select('id,object_path,alt_text').eq('state', 'ready').in('id', ids)
        if (resultError || !data || data.length !== ids.length) throw new Error('preview media unavailable')
        if (active) setPreviewResult({ key: previewIds, media: data.map((asset) => ({ id: asset.id, path: asset.object_path, alt: asset.alt_text })), error: '' })
      } catch {
        if (active) setPreviewResult({ key: previewIds, media: [], error: 'Gambar preview tidak dapat dimuat. Periksa media dan coba buka preview kembali.' })
      }
    }
    void load()
    return () => { active = false }
  }, [preview, previewIds])

  async function edit(article: Article) {
    setBusy(true); setError(''); setNotice('')
    try {
      const ids = imageIds(article.content)
      const [related, assets] = await Promise.all([
        supabase.from('article_related_products').select('product_id').eq('article_id', article.id).order('display_order'),
        ids.length ? supabase.from('media_assets').select('id,object_path').eq('state', 'ready').in('id', ids) : Promise.resolve({ data: [], error: null }),
      ])
      if (related.error || !related.data || assets.error || !assets.data || assets.data.length !== ids.length) throw new Error('article resources unavailable')
      setDraft({ ...article, content: trustedImageSources(article.content, assets.data), related_products: related.data.map((item) => item.product_id) })
      setEditorKey((n) => n + 1); setPreview(false); setInlineImage(null)
    } catch { setError('Artikel tidak dapat dibuka. Coba lagi.') }
    finally { setBusy(false) }
  }

  async function save(nextStatus: Article['status']) {
    if (!draft) return
    setError(''); setNotice('')
    if (draft.title.trim().length < 5 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug) || !draft.category_id) { setError('Judul minimal 5 karakter, slug valid, dan kategori wajib diisi.'); return }
    if (nextStatus === 'published' && (!draft.excerpt.trim() || !draft.cover_media_id)) { setError('Untuk publish, ringkasan, isi artikel, dan cover wajib diisi.'); return }
    setBusy(true)
    try {
      const { error: saveError } = await supabase.rpc('save_article', { payload: { ...draft, status: nextStatus } })
      if (saveError) {
        if (saveError.code === '23505' && saveError.message.includes('articles_one_featured_idx')) throw new Error('Sudah ada artikel featured. Nonaktifkan featured artikel lain terlebih dahulu.')
        if (saveError.code === '23505' && saveError.message.includes('articles_slug_key')) throw new Error('Slug artikel sudah digunakan.')
        if (saveError.message.includes('article has changed')) throw new Error('Artikel diubah di sesi lain. Buka kembali sebelum menyimpan.')
        if (saveError.message.includes('require excerpt')) throw new Error('Untuk publish, ringkasan, isi artikel, dan cover wajib diisi.')
        if (saveError.message.includes('media unavailable')) throw new Error('Gambar tidak tersedia. Pilih gambar lain.')
        if (saveError.message.includes('related product')) throw new Error('Produk terkait tidak lagi published. Hapus pilihan produk tersebut.')
        if (saveError.message.includes('active category')) throw new Error('Kategori tidak aktif. Pilih kategori aktif.')
        throw new Error('Artikel tidak dapat disimpan. Periksa isi dan coba lagi.')
      }
      setDraft(null); setPreview(false); setNotice('Artikel berhasil disimpan.'); refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Artikel tidak dapat disimpan.') }
    finally { setBusy(false) }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoryForm) return
    setBusy(true); setError('')
    try {
      const { error: saveError } = await supabase.rpc('save_article_category', { category_id: categoryForm.id || null, category_name: categoryForm.name, category_slug: categoryForm.slug, category_active: categoryForm.is_active, category_order: categoryForm.display_order })
      if (saveError) {
        if (saveError.code === '23505') throw new Error('Slug kategori sudah digunakan.')
        if (saveError.message.includes('unpublish')) throw new Error('Tarik artikel published sebelum menonaktifkan kategori.')
        throw new Error('Kategori tidak dapat disimpan.')
      }
      setCategoryForm(null); setNotice('Kategori berhasil disimpan.'); refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Kategori tidak dapat disimpan.') }
    finally { setBusy(false) }
  }

  const previewLoading = preview && previewResult.key !== previewIds
  const previewMedia = previewLoading ? [] : previewResult.media
  const previewCover = previewMedia.find((asset) => asset.id === draft?.cover_media_id)

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Blog Management</p><h1 className="mt-2 text-3xl font-bold text-[#0b192c]">Artikel</h1><p className="mt-2 text-sm text-slate-600">Kelola konten dan publikasi blog.</p></div><div className="flex gap-2"><button className={secondary} onClick={() => { setCategoryMode(!categoryMode); setDraft(null); setError('') }}>{categoryMode ? 'Daftar artikel' : 'Kelola kategori'}</button><button className={primary} onClick={() => { setDraft(blank()); setEditorKey((n) => n + 1); setCategoryMode(false); setInlineImage(null); setPreview(false); setError('') }}>Tambah artikel</button></div></div>
    {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
    {error && !picker && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {!loading && loadError && <p role="alert" className="mt-4 text-sm text-red-700">{loadError}</p>}
    {draft ? <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between"><h2 className="text-lg font-bold">{draft.id ? 'Edit artikel' : 'Artikel baru'}</h2><button className={secondary} onClick={() => { setDraft(null); setPreview(false); setError('') }}>Tutup</button></div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Judul<input className={`${input} mt-1`} maxLength={180} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value, slug: draft.id ? draft.slug : slugify(e.target.value) })} /></label>
        <label className="text-sm font-semibold">Slug<input className={`${input} mt-1`} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} /></label>
        <label className="text-sm font-semibold">Kategori<select className={`${input} mt-1`} value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}><option value="">Pilih kategori</option>{categories.filter((c) => c.is_active || c.id === draft.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}{!c.is_active && ' (nonaktif)'}</option>)}</select></label>
        <label className="text-sm font-semibold">Penulis (opsional)<input className={`${input} mt-1`} value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} /></label>
        <label className="text-sm font-semibold md:col-span-2">Ringkasan<textarea maxLength={300} className={`${input} mt-1`} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} /></label>
        <label className="text-sm font-semibold">SEO title<input className={`${input} mt-1`} value={draft.seo_title} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} /></label>
        <label className="text-sm font-semibold">SEO description<textarea className={`${input} mt-1`} value={draft.seo_description} onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })} /></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2"><button className={secondary} onClick={() => { setPicker('cover'); setMediaPage(0); setMediaSearch('') }}>Pilih cover</button><span className="text-sm">{draft.cover_media_id ? `Cover dipilih (${draft.cover_media_id})` : 'Belum ada cover'}</span>{draft.cover_media_id && <button className={secondary} onClick={() => setDraft({ ...draft, cover_media_id: null })}>Lepas cover</button>}<a className="text-sm text-sky-700" href="/admin/media" target="_blank" rel="noreferrer">Upload di Media Library</a></div>
      <div className="mt-6">
        <div className="mb-3"><h3 className="font-semibold text-slate-900">Isi artikel</h3><p className="mt-1 text-sm text-slate-500">Tulis artikel dan gunakan toolbar untuk mengatur format.</p></div>
        <ArticleEditor key={editorKey} initial={draft.content} image={inlineImage} onChange={(content) => setDraft((current) => current ? { ...current, content } : current)} />
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2"><button className={secondary} onClick={() => { setPicker('inline'); setMediaPage(0); setMediaSearch('') }}>Pilih gambar isi</button><span className="text-sm text-slate-600">{inlineImage ? 'Gambar siap disisipkan melalui toolbar' : 'Pilih gambar dari Media Library untuk disisipkan.'}</span></div>
          {inlineImage && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Alt gambar<input aria-label="Alt gambar isi" placeholder="Kosongkan jika dekoratif" maxLength={500} className={`${input} mt-1`} value={inlineImage.alt} onChange={(e) => setInlineImage((current) => current ? { ...current, alt: e.target.value } : current)} /></label><label className="text-xs font-semibold text-slate-600">Caption (opsional)<input aria-label="Caption gambar isi" placeholder="Keterangan gambar" maxLength={500} className={`${input} mt-1`} value={caption} onChange={(e) => { setCaption(e.target.value); setInlineImage((current) => current ? { ...current, caption: e.target.value } : current) }} /></label></div>}
        </div>
      </div>
      <fieldset className="mt-5"><legend className="font-semibold">Produk terkait (published, maksimal 10)</legend>{products.map((p) => <label key={p.id} className="mt-2 block text-sm"><input type="checkbox" checked={draft.related_products.includes(p.id)} disabled={!draft.related_products.includes(p.id) && draft.related_products.length >= 10} onChange={(e) => setDraft({ ...draft, related_products: e.target.checked ? [...draft.related_products, p.id] : draft.related_products.filter((id) => id !== p.id) })} /> {p.name}</label>)}
        {draft.related_products.filter((id) => !products.some((p) => p.id === id)).map((id) => <button key={id} className={`${secondary} mt-2`} onClick={() => setDraft({ ...draft, related_products: draft.related_products.filter((p) => p !== id) })}>Lepas produk yang tidak lagi published</button>)}</fieldset>
      <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_featured} onChange={(e) => setDraft({ ...draft, is_featured: e.target.checked })} />Featured saat dipublikasikan (maksimal satu artikel)</label>
      <div className="mt-5 flex flex-wrap gap-2"><button className={secondary} aria-expanded={preview} aria-controls="article-preview" onClick={() => setPreview(!preview)}>{preview ? 'Tutup preview' : 'Preview'}</button><button className={secondary} disabled={busy} onClick={() => void save('draft')}>Simpan draft</button><button className={primary} disabled={busy} onClick={() => void save('published')}>Publish</button>{draft.id && <button className={secondary} disabled={busy} onClick={() => { if (window.confirm('Arsipkan artikel ini?')) void save('archived') }}>Arsipkan</button>}</div>
      {preview && <section id="article-preview" aria-labelledby="preview-heading" className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6"><div><h3 id="preview-heading" className="text-sm font-bold text-slate-900">Preview artikel</h3><p className="mt-1 text-xs text-slate-500">Tampilan sementara. Perubahan belum tentu tersimpan atau dipublikasikan.</p></div><button type="button" className={secondary} onClick={() => setPreview(false)}>Tutup preview</button></div>
        <div className="bg-[#f7f9fb] px-4 py-8 sm:px-8"><article className="mx-auto max-w-4xl text-[#191c1e]">
          <p className="text-sm font-semibold text-sky-700">Beranda <span className="text-slate-400">/</span> Blog</p>
          <h4 className="mt-5 break-words text-3xl font-bold text-[#0b192c]">{draft.title || 'Judul artikel'}</h4>
          <p className="mt-6 text-sm text-slate-500">{categories.find((item) => item.id === draft.category_id)?.name || 'Kategori belum dipilih'}{draft.author_name && ` · ${draft.author_name}`}</p>
          <p className="my-5 break-words text-lg text-slate-600">{draft.excerpt || 'Ringkasan artikel akan tampil di sini.'}</p>
          {previewLoading && <p role="status" className="mb-6 text-sm text-slate-500">Memuat gambar preview...</p>}
          {!previewLoading && previewResult.error && <p role="alert" className="mb-6 text-sm text-red-700">{previewResult.error}</p>}
          {previewCover && <img className="mb-8 max-h-[34rem] w-full rounded-xl object-cover" src={supabase.storage.from('website-media').getPublicUrl(previewCover.path).data.publicUrl} alt={previewCover.alt || draft.title} />}
          <ArticleContent content={draft.content} media={previewMedia} />
        </article></div>
      </section>}
    </section> : categoryMode ? <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between"><h2 className="font-bold">Kategori</h2><button className={secondary} onClick={() => setCategoryForm({ id: '', name: '', slug: '', is_active: true, display_order: 0 })}>Tambah kategori</button></div><ul className="mt-4 space-y-2">{categories.map((c) => <li key={c.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{c.name} · {c.slug} · {c.is_active ? 'Aktif' : 'Nonaktif'}</span><button className={secondary} onClick={() => setCategoryForm(c)}>Edit</button></li>)}</ul>
      {categoryForm && <form onSubmit={saveCategory} className="mt-5 grid gap-3 md:grid-cols-2"><label className="text-sm">Nama<input required minLength={2} maxLength={100} className={`${input} mt-1`} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value, slug: categoryForm.id ? categoryForm.slug : slugify(e.target.value) })} /></label><label className="text-sm">Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${input} mt-1`} value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} /></label><label className="text-sm">Urutan<input type="number" className={`${input} mt-1`} value={categoryForm.display_order} onChange={(e) => setCategoryForm({ ...categoryForm, display_order: Number(e.target.value) })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })} />Aktif</label><div className="flex gap-2"><button className={primary} disabled={busy}>Simpan kategori</button><button type="button" className={secondary} onClick={() => setCategoryForm(null)}>Batal</button></div></form>}</section> : <>
      <div className="mt-6 flex flex-wrap gap-2"><input aria-label="Cari artikel" placeholder="Cari artikel" className={`${input} min-w-48 flex-1`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /><select aria-label="Filter kategori" className={secondary} value={category} onChange={(e) => { setCategory(e.target.value); setPage(0) }}><option value="">Semua kategori</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Filter status" className={secondary} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}><option value="">Semua status</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><button className={secondary} onClick={refresh}>Perbarui</button></div>
      {loading ? <p role="status" className="mt-6 text-sm">Memuat artikel...</p> : loadError ? null : articles.length === 0 ? <p className="mt-6 text-sm text-slate-500">Tidak ada artikel yang sesuai.</p> : <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Judul', 'Kategori', 'Status', 'Featured', 'Aksi'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{articles.map((a) => <tr key={a.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{a.title}</td><td className="px-4 py-3">{categories.find((c) => c.id === a.category_id)?.name ?? '-'}</td><td className="px-4 py-3">{a.status}</td><td className="px-4 py-3">{a.is_featured ? 'Ya' : '-'}</td><td className="px-4 py-3"><button className={secondary} disabled={busy} onClick={() => void edit(a)}>Lihat / Edit</button></td></tr>)}</tbody></table></div>}
      {!loading && !loadError && <div className="mt-4 flex justify-between text-sm"><span>{count} artikel · Halaman {page + 1}</span><div className="flex gap-2"><button className={secondary} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button><button className={secondary} disabled={(page + 1) * 10 >= count} onClick={() => setPage((p) => p + 1)}>Berikutnya</button></div></div>}
    </>}
    {picker && draft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="blog-picker-heading" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5"><div className="flex justify-between"><h2 id="blog-picker-heading" className="font-bold">Pilih {picker === 'cover' ? 'cover' : 'gambar isi'}</h2><button className={secondary} onClick={() => { setPicker(null); setError('') }}>Batal</button></div><input aria-label="Cari media" className={`${input} mt-4`} value={mediaSearch} onChange={(e) => { setMediaSearch(e.target.value); setMediaPage(0) }} placeholder="Cari nama file" />{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map((m) => <button key={m.id} className="overflow-hidden rounded-lg border border-slate-200 text-left" onClick={() => { if (picker === 'cover') setDraft({ ...draft, cover_media_id: m.id }); else setInlineImage({ id: m.id, path: m.object_path, alt: m.alt_text, caption }); setPicker(null); setError('') }}><img className="aspect-square w-full object-cover" src={supabase.storage.from('website-media').getPublicUrl(m.object_path).data.publicUrl} alt={m.alt_text} /><span className="block truncate p-2 text-sm">{m.original_file_name}</span></button>)}</div><div className="mt-4 flex gap-2"><button className={secondary} disabled={mediaPage === 0} onClick={() => setMediaPage((p) => p - 1)}>Sebelumnya</button><button className={secondary} disabled={!moreMedia} onClick={() => setMediaPage((p) => p + 1)}>Berikutnya</button></div></section></div>}
  </>
}
