import { Icon } from './Icon'
import { useWebsiteSettings, websiteWhatsAppUrl } from '../../shared/websiteSettings'

export type Product = {
  category: string
  name: string
  description: string
  tags: string[]
  accent: string
  categoryClass: string
}

type ProductCardProps = {
  product: Product
  index: number
}

export function ProductCard({ product, index }: ProductCardProps) {
  const settings = useWebsiteSettings()
  const whatsappUrl = websiteWhatsAppUrl(settings, `Tanya produk ${product.name}`)
  return (
    <article
      className={`group flex flex-col justify-between rounded-xl border border-slate-200 border-t-4 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${product.accent}`}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded px-2 py-1 font-mono text-[10px] font-bold uppercase ${product.categoryClass}`}>
            {product.category}
          </span>
          <span className="font-mono text-xs font-bold text-slate-500">
            {String(index + 1).padStart(2, '0')} / SPEC
          </span>
        </div>
        <h3 className="mt-5 font-display text-xl font-bold text-[#0b192c] transition group-hover:text-sky-600">
          {product.name}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{product.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {product.tags.map((tag) => (
            <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      </div>
      {whatsappUrl && <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 font-mono text-xs font-bold uppercase tracking-wide text-sky-600 transition hover:text-[#e65100]"
        >
          Detail <Icon name="arrow_forward" className="text-base" />
        </a>}
    </article>
  )
}
