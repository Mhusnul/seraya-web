import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../shared/supabase'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { useWebsiteSettings, websiteImageUrl, websiteWhatsAppUrl } from '../shared/websiteSettings'

type PublicProduct = { id: string; name: string; slug: string }
type FormValues = {
  fullName: string
  companyName: string
  email: string
  phone: string
  inquiryType: 'product' | 'general' | 'partnership' | 'other'
  message: string
}
const initialValues: FormValues = { fullName: '', companyName: '', email: '', phone: '', inquiryType: 'product', message: '' }
const input = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100'

export function InquiryForm() {
  const settings = useWebsiteSettings()
  const whatsappUrl = websiteWhatsAppUrl(settings)
  const productSlug = new URLSearchParams(window.location.search).get('product')
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [productsState, setProductsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [productId, setProductId] = useState('')
  const [values, setValues] = useState<FormValues>({ ...initialValues, inquiryType: productSlug ? 'product' : 'general' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    async function loadProducts() {
      try {
        const { data, error: loadError } = await supabase.rpc('public_products', { product_slug: null })
        if (loadError || !Array.isArray(data)) throw new Error('product load failed')
        const available = data.filter((item): item is PublicProduct => Boolean(item)
          && typeof item === 'object'
          && typeof (item as Record<string, unknown>).id === 'string'
          && typeof (item as Record<string, unknown>).name === 'string'
          && typeof (item as Record<string, unknown>).slug === 'string')
          .map(({ id, name, slug }) => ({ id, name, slug }))
        if (!active) return
        setProducts(available)
        if (productSlug) setProductId(available.find((product) => product.slug === productSlug)?.id ?? '')
        setProductsState('ready')
      } catch {
        if (active) setProductsState('error')
      }
    }
    void loadProducts()
    return () => { active = false }
  }, [productSlug])

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (values.fullName.trim().length < 2 || values.message.trim().length < 10) {
      setError('Nama minimal 2 karakter dan pesan minimal 10 karakter.')
      return
    }
    setSubmitting(true)
    try {
      const { error: submitError } = await supabase.rpc('submit_inquiry', {
        p_full_name: values.fullName.trim(),
        p_company_name: values.companyName.trim(),
        p_email: values.email.trim().toLowerCase(),
        p_phone: values.phone.trim(),
        p_inquiry_type: values.inquiryType,
        p_message: values.message.trim(),
        p_product_id: productId || null,
      })
      if (submitError) throw new Error('submission failed')
      setSubmitted(true)
      setValues(initialValues)
      setProductId('')
    } catch {
      setError('Inquiry belum berhasil dikirim. Periksa kembali data dan koneksi Anda, lalu coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e]">
    <title>Minta Penawaran | {settings.company_display_name}</title>
    <meta name="description" content="Kirim pertanyaan atau permintaan penawaran proteksi kargo kepada tim Seraya Semesta." />
    {websiteImageUrl(settings.default_og_image_path) && <meta property="og:image" content={websiteImageUrl(settings.default_og_image_path) ?? undefined} />}
    <Header />
    <main className="mx-auto min-h-[60vh] max-w-6xl px-4 pb-16 pt-32 sm:px-8">
      <a href="/" className="text-sm font-semibold text-sky-700">Beranda</a><span className="mx-2 text-slate-400">/</span><span className="text-sm text-slate-500">Minta Penawaran</span>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Hubungi tim kami</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0b192c]">Ceritakan kebutuhan kargo Anda.</h1>
          <p className="mt-4 leading-7 text-slate-600">Isi detail kebutuhan Anda. Tim Seraya Semesta akan meninjau pesan dan menindaklanjutinya.</p>
          <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <p className="font-semibold text-[#0b192c]">Butuh respons cepat?</p>
            {whatsappUrl && <a className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:underline" href={whatsappUrl} target="_blank" rel="noreferrer">Hubungi kami melalui WhatsApp <span aria-hidden="true">→</span></a>}
            <a className="mt-2 block text-sm font-semibold text-sky-700 hover:underline" href={`mailto:${settings.general_email}`}>{settings.general_email}</a>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {submitted ? <div role="status" className="py-8 text-center">
            <span aria-hidden="true" className="material-symbols-outlined text-5xl text-emerald-600">check_circle</span>
            <h2 className="mt-4 text-2xl font-bold text-[#0b192c]">Terima kasih, pesan Anda sudah terkirim.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Tim kami akan meninjau inquiry Anda dan menghubungi melalui detail kontak yang diberikan.</p>
            <button className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setSubmitted(false); setValues(initialValues) }}>Kirim inquiry lain</button>
          </div> : <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Nama lengkap <span className="text-red-600">*</span>
                <input required autoComplete="name" minLength={2} maxLength={150} className={input} value={values.fullName} onChange={(event) => update('fullName', event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">Perusahaan
                <input autoComplete="organization" maxLength={200} className={input} value={values.companyName} onChange={(event) => update('companyName', event.target.value)} />
              </label>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Email <span className="text-red-600">*</span>
                <input required type="email" autoComplete="email" maxLength={254} className={input} value={values.email} onChange={(event) => update('email', event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">Nomor telepon
                <input type="tel" autoComplete="tel" maxLength={40} className={input} value={values.phone} onChange={(event) => update('phone', event.target.value)} />
              </label>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">Jenis inquiry
                <select className={input} value={values.inquiryType} onChange={(event) => update('inquiryType', event.target.value as FormValues['inquiryType'])}>
                  <option value="product">Produk / penawaran</option><option value="general">Pertanyaan umum</option><option value="partnership">Kemitraan</option><option value="other">Lainnya</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">Produk terkait
                <select className={input} value={productId} onChange={(event) => setProductId(event.target.value)} disabled={productsState !== 'ready' || products.length === 0}>
                  <option value="">{productsState === 'loading' ? 'Memuat produk...' : productsState === 'error' ? 'Produk tidak tersedia' : 'Belum memilih produk'}</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                {productsState === 'error' && <span className="mt-1 block text-xs font-normal text-amber-700">Daftar produk tidak dapat dimuat; inquiry tetap dapat dikirim tanpa memilih produk.</span>}
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Pesan <span className="text-red-600">*</span>
              <textarea required minLength={10} maxLength={5000} className={`${input} min-h-36`} value={values.message} onChange={(event) => update('message', event.target.value)} placeholder="Ceritakan kebutuhan, jenis muatan, atau pertanyaan Anda..." />
              <span className="mt-1 block text-right text-xs font-normal text-slate-500">{values.message.length}/5000</span>
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#e65100] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#c2410c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {submitting ? 'Mengirim...' : 'Kirim inquiry'} <span aria-hidden="true" className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
            <p className="text-xs leading-5 text-slate-500">Dengan mengirim formulir ini, Anda mengizinkan tim kami menggunakan detail kontak untuk menanggapi inquiry Anda.</p>
          </form>}
        </section>
      </div>
    </main>
    <Footer />
  </div>
}
