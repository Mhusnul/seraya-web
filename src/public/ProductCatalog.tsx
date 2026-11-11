import { useEffect, useState } from 'react'
import { supabase } from '../shared/supabase'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { useWebsiteSettings, websiteImageUrl, websiteWhatsAppUrl } from '../shared/websiteSettings'

type PublicProduct = {
  id: string; name: string; slug: string; category: string; category_slug: string
  short_description: string; description: string; seo_title: string; seo_description: string
  images: { path: string; alt: string }[]; benefits: string[]; applications: string[]
}

export function ProductCatalog({ slug }: { slug?: string }) {
  const settings = useWebsiteSettings()
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error } = await supabase.rpc('public_products', { product_slug: slug ?? null })
        if (error || !Array.isArray(data)) throw new Error('failed to load products')
        if (active) { setProducts(data as PublicProduct[]); setStatus('ready') }
      } catch {
        if (active) setStatus('error')
      }
    }
    void load()
    return () => { active = false }
  }, [slug, revision])

  const whatsappUrl = products[0] ? websiteWhatsAppUrl(settings, `Halo, saya ingin bertanya tentang produk ${products[0].name}.`) : null
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()) && (!category || p.category_slug === category))
  const categories = [...new Map(products.map((p) => [p.category_slug, p.category])).entries()]
  const image = (path: string) => supabase.storage.from('website-media').getPublicUrl(path).data.publicUrl

  return <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e]">
    <title>{status === 'ready' && slug && products[0]
      ? products[0].seo_title || settings.default_seo_title || `${products[0].name} | ${settings.company_display_name}`
      : settings.default_seo_title || `Produk | ${settings.company_display_name}`}</title>
    {status === 'ready' && slug && products[0]
      ? <meta name="description" content={products[0].seo_description || settings.default_seo_description || products[0].short_description} />
      : settings.default_seo_description && <meta name="description" content={settings.default_seo_description} />}
    {websiteImageUrl(settings.default_og_image_path) && <meta property="og:image" content={websiteImageUrl(settings.default_og_image_path) ?? undefined} />}
    <Header /><main className="mx-auto min-h-[60vh] max-w-6xl px-4 pb-16 pt-32 sm:px-8">
    <a href="/" className="text-sm font-semibold text-sky-700">Beranda</a> <span className="text-slate-400">/</span> <a href="/produk" className="text-sm font-semibold text-sky-700">Produk</a>
    <h1 className="mt-5 text-3xl font-bold text-[#0b192c]">{slug ? products[0]?.name ?? 'Detail produk' : 'Produk'}</h1>
    {status === 'loading' && <p role="status" className="mt-6">Memuat produk...</p>}
    {status === 'error' && <div role="alert" className="mt-6 text-red-700">Produk tidak dapat dimuat. <button className="underline" onClick={() => { setStatus('loading'); setRevision((n) => n + 1) }}>Coba lagi</button></div>}
    {status === 'ready' && slug && !products.length && <p className="mt-6 text-slate-600">Produk tidak ditemukan atau tidak tersedia.</p>}
    {status === 'ready' && slug && products[0] && <article className="mt-6"><div className="grid gap-8 md:grid-cols-2"><div>{products[0].images[0] && <img className="aspect-square w-full rounded-xl object-cover" src={image(products[0].images[0].path)} alt={products[0].images[0].alt || products[0].name} onError={(e) => { e.currentTarget.hidden = true }} />}</div><div><p className="text-sm font-semibold text-sky-700">{products[0].category}</p><p className="mt-4 text-slate-700">{products[0].short_description}</p><p className="mt-4 whitespace-pre-wrap text-slate-700">{products[0].description}</p><div className="mt-6 flex flex-wrap gap-3"><a href={`/inquiry?product=${encodeURIComponent(products[0].slug)}`} className="inline-flex rounded-lg bg-[#e65100] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#c2410c]">Minta penawaran produk ini</a>{whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-[#0b192c] transition hover:bg-slate-50">WhatsApp</a>}</div></div></div>
      {products[0].images.length > 1 && <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{products[0].images.slice(1).map((m) => <img key={m.path} className="aspect-square w-full rounded-lg object-cover" src={image(m.path)} alt={m.alt || products[0].name} onError={(e) => { e.currentTarget.hidden = true }} />)}</div>}
      {products[0].benefits.length > 0 && <section className="mt-8"><h2 className="text-xl font-bold">Manfaat</h2><ul className="mt-3 list-disc space-y-1 pl-5">{products[0].benefits.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
      {products[0].applications.length > 0 && <section className="mt-8"><h2 className="text-xl font-bold">Aplikasi</h2><ul className="mt-3 list-disc space-y-1 pl-5">{products[0].applications.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
    </article>}
    {status === 'ready' && !slug && <><div className="mt-6 flex flex-wrap gap-3"><input aria-label="Cari produk" placeholder="Cari produk" className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Kategori" className="rounded-lg border border-slate-300 bg-white px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Semua kategori</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
      {!filtered.length ? <p className="mt-8 text-slate-600">Belum ada produk yang sesuai.</p> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((p) => <a href={`/produk/${encodeURIComponent(p.slug)}`} key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="aspect-[4/3] bg-slate-100">{p.images[0] && <img className="h-full w-full object-cover" src={image(p.images[0].path)} alt={p.images[0].alt || p.name} onError={(e) => { e.currentTarget.hidden = true }} />}</div><div className="p-5"><p className="text-xs font-semibold text-sky-700">{p.category}</p><h2 className="mt-2 text-lg font-bold">{p.name}</h2><p className="mt-2 text-sm text-slate-600">{p.short_description}</p></div></a>)}</div>}
    </>}
  </main><Footer /></div>
}
