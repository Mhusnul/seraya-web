import { Icon } from './Icon'

const navigation = ['Beranda', 'Tentang', 'Produk', 'Layanan', 'Blog', 'Kontak']

export function Header() {
  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-slate-200/70 bg-[#f7f9fb]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-12">
        <a href="#" className="flex items-center gap-3" aria-label="Seraya Semesta">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b192c] text-sm font-bold text-white">
            SS
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-[#0b192c]">
              Seraya Semesta
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-slate-500 sm:block">
              PT. Seraya Semesta Indonesia
            </span>
          </div>
        </a>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigasi utama">
          {navigation.map((item, index) => (
            <a
              key={item}
              href={index === 0 ? '#' : `#${item.toLowerCase()}`}
              className={`text-sm transition-colors hover:text-[#0b192c] ${
                index === 0 ? 'font-bold text-[#0b192c]' : 'text-slate-500'
              }`}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://wa.me/628111611177"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg bg-[#e65100] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#c2410c] sm:inline-flex"
          >
            Minta Penawaran
          </a>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b192c] text-white lg:hidden"
            aria-label="Buka menu"
          >
            <Icon name="menu" className="text-xl" />
          </button>
          <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#0b192c] text-white lg:flex">
            <Icon name="person" className="text-lg" />
          </div>
        </div>
      </div>
    </header>
  )
}
