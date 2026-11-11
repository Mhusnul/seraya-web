import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Icon } from './components/Icon'
import { IndustryCard } from './components/IndustryCard'
import type { Industry } from './components/IndustryCard'
import { ProductCard } from './components/ProductCard'
import type { Product } from './components/ProductCard'
import { SectionHeading } from './components/SectionHeading'
import { useWebsiteSettings, websiteImageUrl, websiteWhatsAppUrl } from '../shared/websiteSettings'

const heroImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAvonxHv2UDVAsL5QYq9eHK-F5Z_5EoUOjPcXOh3n8rCFgsDAlMFu8m2lMETO_2nWH8rlZ81fKHKFij3QdmCK-tSwKrOCDsCc5bxCLfGUxpR4OZEgk7yfI_1Nk_LF831CNZeBX93q9urIiS0Wg5Ez73Sap_UpHOfdaaQio_fnix3_MvfNhQXfpLapoE7GI6g79dR84DKJ4fp7FdO2X2U3Ab4twilKJOXH3lgMNY1w'

const products: Product[] = [
  { category: 'Void Filler & Stabilizer', name: 'Dunnage Bag', description: 'Menahan muatan agar tidak bergeser di dalam kontainer dengan distribusi tekanan seragam.', tags: ['Polywoven Multi-layer', 'Tekanan Presisi'], accent: 'border-t-sky-600', categoryClass: 'bg-blue-100 text-blue-800' },
  { category: 'Temperature Insulation', name: 'Thermal Liner', description: 'Melindungi barang dari suhu dan kelembapan ekstrem selama pelayaran rute tropis maupun dingin.', tags: ['Reflektif Aluminium Foil', 'Cold Chain Defense'], accent: 'border-t-orange-600', categoryClass: 'bg-orange-100 text-orange-800' },
  { category: 'Tamper-Evident Security', name: 'Security Seal', description: 'Menjaga integritas kiriman dan mencegah tampering dengan barcode dan penomoran laser unik.', tags: ['ISO 17712 High Security', 'Bolt & Cable Lock'], accent: 'border-t-teal-600', categoryClass: 'bg-teal-100 text-teal-800' },
  { category: 'Load Distribution', name: 'Container Airbag', description: 'Mengisi ruang kosong untuk menjaga stabilitas produk dan mengurangi risiko kerusakan selama transit.', tags: ['High Pressure', 'Fast Inflation'], accent: 'border-t-blue-700', categoryClass: 'bg-blue-100 text-blue-800' },
  { category: 'Moisture Control', name: 'Desiccant Bag', description: 'Mengontrol kondensasi dan kelembapan di dalam kontainer untuk menjaga kualitas produk.', tags: ['Non-Toxic', 'Long Duration'], accent: 'border-t-emerald-600', categoryClass: 'bg-emerald-100 text-emerald-800' },
  { category: 'Cargo Protection', name: 'Edge Protector', description: 'Mendistribusikan tekanan ikatan dan mencegah kerusakan pada sudut serta permukaan muatan.', tags: ['Reinforced Board', 'Heavy Duty'], accent: 'border-t-violet-600', categoryClass: 'bg-violet-100 text-violet-800' },
]

const industries: Industry[] = [
  { name: 'Manufaktur', description: 'Stabilitas Komponen', icon: 'factory', color: 'text-blue-700', background: 'bg-blue-100' },
  { name: 'Pangan (F&B)', description: 'Higienitas Bebas Lembap', icon: 'restaurant', color: 'text-green-700', background: 'bg-green-100' },
  { name: 'Farmasi', description: 'Kontrol Suhu Kritis', icon: 'medication', color: 'text-teal-700', background: 'bg-teal-100' },
  { name: 'Kimia', description: 'Bulk & Anti-Leak', icon: 'science', color: 'text-violet-700', background: 'bg-violet-100' },
  { name: 'Otomotif', description: 'Proteksi Heavy Parts', icon: 'directions_car', color: 'text-orange-700', background: 'bg-orange-100' },
  { name: 'Ekspor Global', description: 'Standar Maritim IMO', icon: 'sailing', color: 'text-sky-700', background: 'bg-sky-100' },
]

function HomePage() {
  const settings = useWebsiteSettings()
  const whatsappUrl = websiteWhatsAppUrl(settings, `Halo ${settings.company_display_name}, saya ingin berkonsultasi tentang proteksi kargo.`)
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e]">
      <title>{settings.default_seo_title || settings.company_display_name}</title>
      {settings.default_seo_description && <meta name="description" content={settings.default_seo_description} />}
      {websiteImageUrl(settings.default_og_image_path) && <meta property="og:image" content={websiteImageUrl(settings.default_og_image_path) ?? undefined} />}
      <Header />
      <main className="pt-20">
        <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf2fb] via-[#f4f7fb] to-[#f7f9fb] py-16 lg:py-24">
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1360px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-12">
            <div className="z-10 lg:col-span-6">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100/70 px-3 py-1 text-[#001c38]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-orange-600" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Cargo Protection</span>
              </div>
              <h1 className="max-w-xl font-display text-4xl font-bold leading-tight tracking-tight text-[#0b192c] sm:text-5xl lg:text-6xl">
                Proteksi kargo yang lebih presisi.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                Solusi dunnage, thermal, seal, dan kemasan curah untuk pengiriman ekspor serta domestik dengan standar ketat industri maritim.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#solusi-produk" className="rounded-lg bg-[#0e1c2f] px-5 py-3 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#1e3e62]">Lihat Produk</a>
                <a href="/inquiry" className="rounded-lg bg-[#e65100] px-5 py-3 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#c2410c]">Minta Penawaran</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                {[
                  ['verified', 'Standar ISO 17712'],
                  ['shield', 'Zero Defect Testing'],
                  ['support_agent', 'Respon Sales Cepat'],
                ].map(([icon, text]) => <div key={text} className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase text-slate-600"><Icon name={icon} className="text-xl text-sky-600" />{text}</div>)}
              </div>
            </div>
            <div className="relative lg:col-span-6">
              <div className="group relative aspect-[16/10] overflow-hidden rounded-xl border-2 border-blue-200/70 bg-slate-200 shadow-2xl">
                <img src={heroImage} alt="Perlindungan kargo dalam kontainer" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b192c]/80 via-transparent to-[#0b192c]/10" />
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-blue-100/50 bg-white/90 p-3 shadow-md backdrop-blur-md">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
                  <div><span className="block font-mono text-[10px] uppercase text-slate-500">Transit Shift</span><strong className="font-display text-lg leading-none text-[#0b192c]">0% Defect</strong></div>
                </div>
                <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-blue-100/50 bg-white/90 px-3 py-2 shadow-md backdrop-blur-md">
                  <Icon name="local_shipping" className="text-xl text-orange-600" />
                  <div><strong className="block font-mono text-[10px] text-[#0b192c]">Export Compliant</strong><span className="font-mono text-[10px] text-slate-500">AAR & IMO Approved</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-blue-100 bg-[#eef3f9] py-6">
          <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:px-12">
            <span className="shrink-0 font-mono text-xs font-bold uppercase tracking-wider text-[#1e3e62]">Dipercaya tim logistik dan industri</span>
            <div className="flex flex-1 flex-wrap gap-3 md:justify-end">
              {['Samudera Nusantara', 'Global Maritime Indo', 'Pacific Freight Lines', 'TransLogistics Asia', 'Mega Industri Agro'].map((name) => <span key={name} className="rounded-lg border border-blue-100 bg-white px-3 py-2 font-display text-sm font-semibold text-[#0b192c] shadow-sm">{name}</span>)}
            </div>
          </div>
        </section>

        <section id="solusi-produk" className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6 lg:px-12 lg:py-24">
          <SectionHeading icon="inventory_2" eyebrow="Solusi Pelindung" title="Enam solusi untuk kargo Anda" description="Perlindungan total beban transit untuk mengurangi risiko kerugian finansial akibat benturan, gesekan, kelembapan, dan fluktuasi temperatur selama ekspedisi laut maupun darat." />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{products.map((product, index) => <ProductCard key={product.name} product={product} index={index} />)}</div>
        </section>

        <section className="border-y border-blue-100 bg-[#eef3f9] py-16 lg:py-20">
          <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-12">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <SectionHeading eyebrow="Portfolio Penanganan" title="Sektor Industri" />
              <p className="max-w-md text-sm leading-6 text-slate-600">Pengalaman menangani berbagai profil kargo dengan karakteristik penanganan beban unik di darat dan laut.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">{industries.map((industry) => <IndustryCard key={industry.name} industry={industry} />)}</div>
          </div>
        </section>

        <section className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6 lg:px-12 lg:py-24">
          <div className="relative flex flex-col gap-8 overflow-hidden rounded-2xl border border-[#1e3e62]/40 bg-gradient-to-r from-[#0b192c] via-[#0e2744] to-[#163860] p-7 text-white shadow-2xl sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-sky-600/20 blur-2xl" />
            <div className="relative z-10 max-w-2xl">
              <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-amber-400"><span className="h-2 w-2 rounded-full bg-amber-400" />Konsultasi Teknis Pengemasan</span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Butuh spesifikasi atau sampel?</h2>
              <p className="mt-4 leading-7 text-blue-100">Konsultasikan kebutuhan proteksi kargo kontainer atau minta sampel produk langsung ke tim teknis kami untuk uji coba langsung di muatan Anda.</p>
            </div>
            <div className="relative z-10 flex shrink-0 flex-col gap-3 sm:flex-row">
              {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25d366] px-5 py-3 font-mono text-xs font-bold text-white transition hover:bg-[#20bd5a]"><Icon name="chat" className="text-xl" />WhatsApp Sales</a>}
              <a href={`mailto:${settings.sales_email}`} className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 font-mono text-xs font-bold text-[#0b192c] transition hover:bg-blue-50">Email Sales</a>
            </div>
          </div>
        </section>
      </main>
      {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 rounded-full bg-[#25d366] px-4 py-3 font-mono text-xs font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#20bd5a] sm:flex"><Icon name="chat" className="text-xl" />Chat WhatsApp</a>}
      <Footer />
    </div>
  )
}

export default HomePage
