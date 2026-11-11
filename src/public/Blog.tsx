import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { supabase } from '../shared/supabase'
import { ArticleContent } from '../shared/ArticleContent'
import type { ArticleMedia } from '../shared/ArticleContent'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { useWebsiteSettings, websiteImageUrl } from '../shared/websiteSettings'

type ArticleCard = {
  id: string; title: string; slug: string; excerpt: string
  category: string; category_slug: string; published_at: string; is_featured: boolean
  reading_time: number; cover: { path: string; alt: string } | null
}
type Article = ArticleCard & {
  content: JSONContent; author_name: string; seo_title: string; seo_description: string; media: ArticleMedia[]
  related_products: { name: string; slug: string }[]
}
type Listing = { items: ArticleCard[]; featured: ArticleCard | null; count: number; categories: { slug: string; name: string }[] }

export function Blog({ slug }: { slug?: string }) {
  const settings = useWebsiteSettings()
  const [article, setArticle] = useState<Article | undefined>()
  const [listing, setListing] = useState<Listing>({ items: [], featured: null, count: 0, categories: [] })
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        let current: Article | undefined
        if (slug) {
          const result = await supabase.rpc('public_articles', { article_slug: slug })
          if (result.error || !Array.isArray(result.data)) throw new Error('article load failed')
          current = result.data[0] as Article | undefined
        }
        const result = current || !slug
          ? await supabase.rpc('public_article_listing', {
            search_text: slug ? '' : search.trim(), category_filter: current?.category_slug ?? category,
            page_number: slug ? 0 : page, exclude_article: current?.id ?? null, show_featured: !slug,
          })
          : null
        if (result && (result.error || !result.data || !Array.isArray(result.data.items))) throw new Error('article list failed')
        if (active) { setArticle(current); if (result) setListing(result.data as Listing); setState('ready') }
      } catch { if (active) setState('error') }
    }
    void load()
    return () => { active = false }
  }, [revision, slug, search, category, page])
  const img = (path: string) => supabase.storage.from('website-media').getPublicUrl(path).data.publicUrl
  function card(a: ArticleCard) {
    return <a key={a.id} href={`/blog/${a.slug}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {a.cover && <img className="aspect-[16/9] w-full object-cover" src={img(a.cover.path)} alt={a.cover.alt || a.title} />}
      <div className="p-5"><p className="text-xs font-semibold text-sky-700">{a.category} · {a.reading_time} menit baca</p><h2 className="mt-2 text-lg font-bold">{a.title}</h2><p className="mt-2 text-sm text-slate-600">{a.excerpt}</p></div>
    </a>
  }
  return <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e]">
    <title>{article
      ? article.seo_title || settings.default_seo_title || `${article.title} | ${settings.company_display_name}`
      : settings.default_seo_title || `Blog | ${settings.company_display_name}`}</title>
    {article
      ? <meta name="description" content={article.seo_description || settings.default_seo_description || article.excerpt} />
      : settings.default_seo_description && <meta name="description" content={settings.default_seo_description} />}
    {websiteImageUrl(settings.default_og_image_path) && <meta property="og:image" content={websiteImageUrl(settings.default_og_image_path) ?? undefined} />}
    <Header /><main className="mx-auto min-h-[60vh] max-w-6xl px-4 pb-16 pt-32 sm:px-8">
      <a href="/" className="text-sm font-semibold text-sky-700">Beranda</a> <span className="text-slate-400">/</span> <a href="/blog" className="text-sm font-semibold text-sky-700">Blog</a>
      <h1 className="mt-5 text-3xl font-bold text-[#0b192c]">{slug ? article?.title ?? 'Detail artikel' : 'Blog'}</h1>
      {state === 'loading' && <p role="status" className="mt-6">Memuat artikel...</p>}
      {state === 'error' && <div role="alert" className="mt-6 text-red-700">Artikel tidak dapat dimuat. <button className="underline" onClick={() => { setState('loading'); setRevision((n) => n + 1) }}>Coba lagi</button></div>}
      {state === 'ready' && slug && !article && <p className="mt-6 text-slate-600">Artikel tidak ditemukan atau tidak tersedia.</p>}
      {state === 'ready' && article && <article className="mt-6"><p className="text-sm text-slate-500">{article.category} · {new Date(article.published_at).toLocaleDateString('id-ID')} · {article.reading_time} menit baca{article.author_name && ` · ${article.author_name}`}</p>
        <p className="my-5 text-lg text-slate-600">{article.excerpt}</p>{article.cover && <img className="mb-8 max-h-[34rem] w-full rounded-xl object-cover" src={img(article.cover.path)} alt={article.cover.alt || article.title} />}
        <ArticleContent content={article.content} media={article.media} />
        {article.related_products.length > 0 && <section className="mt-10"><h2 className="text-xl font-bold">Produk terkait</h2><ul className="mt-3 space-y-2">{article.related_products.map((p) => <li key={p.slug}><a className="text-sky-700 underline" href={`/produk/${p.slug}`}>{p.name}</a></li>)}</ul></section>}
        {listing.items.length > 0 && <section className="mt-10"><h2 className="text-xl font-bold">Artikel terkait</h2><div className="mt-4 grid gap-4 sm:grid-cols-3">{listing.items.slice(0, 3).map(card)}</div></section>}
      </article>}
      {state === 'ready' && !slug && <><div className="mt-6 flex flex-wrap gap-3"><input aria-label="Cari artikel" placeholder="Cari artikel" className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /><select aria-label="Kategori" className="rounded-lg border border-slate-300 bg-white px-3 py-2" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0) }}><option value="">Semua kategori</option>{listing.categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div>
        {listing.featured && page === 0 && <section className="mt-8"><h2 className="mb-3 text-xl font-bold">Artikel pilihan</h2>{card(listing.featured)}</section>}
        {!listing.count && !listing.featured ? <p className="mt-8 text-slate-600">Belum ada artikel yang sesuai.</p> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listing.items.map(card)}</div>}
        <div className="mt-6 flex gap-2"><button className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Sebelumnya</button><button className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50" disabled={(page + 1) * 9 >= listing.count} onClick={() => setPage((n) => n + 1)}>Berikutnya</button></div>
      </>}
    </main><Footer /></div>
}
