import { useState } from 'react'
import { Icon } from './Icon'
import { useWebsiteSettings, websiteImageUrl, websiteWhatsAppUrl } from '../../shared/websiteSettings'

const navigation = ['Beranda', 'Tentang', 'Produk', 'Layanan', 'Blog', 'Kontak']
const navigationHref = (item: string) => item === 'Produk' ? '/produk' : item === 'Blog' ? '/blog' : item === 'Beranda' ? '/' : `/#${item.toLowerCase()}`

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const settings = useWebsiteSettings()
  const logoUrl = websiteImageUrl(settings.logo_path)
  const whatsappUrl = websiteWhatsAppUrl(settings)
  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-slate-200/70 bg-[#f7f9fb]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-12">
        <a href="/" className="flex items-center gap-3" aria-label={settings.company_display_name}>
          {logoUrl
            ? <img src={logoUrl} alt={settings.logo_alt || settings.company_display_name} className="h-10 w-10 rounded-lg object-contain" />
            : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b192c] text-sm font-bold text-white">SS</div>}
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-[#0b192c]">
              {settings.company_display_name}
            </span>
          </div>
        </a>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigasi utama">
          {navigation.map((item, index) => (
            <a
              key={item}
              href={navigationHref(item)}
              className={`text-sm transition-colors hover:text-[#0b192c] ${
                index === 0 ? 'font-bold text-[#0b192c]' : 'text-slate-500'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {whatsappUrl && <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Hubungi kami melalui WhatsApp"
            className="hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0b192c] transition hover:bg-slate-50 sm:inline-flex"
          >
            <Icon name="chat" className="text-xl" />
          </a>}
          <a
            href="/inquiry"
            className="hidden rounded-lg bg-[#e65100] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#c2410c] sm:inline-flex"
          >
            Minta Penawaran
          </a>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b192c] text-white lg:hidden"
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="menu" className="text-xl" />
          </button>
          <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#0b192c] text-white lg:flex">
            <Icon name="person" className="text-lg" />
          </div>
          {menuOpen && <nav id="public-mobile-navigation" aria-label="Navigasi utama mobile" className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            {navigation.map((item) => <a key={item} href={navigationHref(item)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">{item}</a>)}
            {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-slate-100">Hubungi via WhatsApp</a>}
          </nav>}
        </div>
      </div>
    </header>
  )
}
