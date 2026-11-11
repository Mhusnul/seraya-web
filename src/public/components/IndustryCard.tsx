import { Icon } from './Icon'

export type Industry = {
  name: string
  description: string
  icon: string
  color: string
  background: string
}

export function IndustryCard({ industry }: { industry: Industry }) {
  return (
    <article className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:-translate-y-1 hover:border-sky-500">
      <div className={`mb-1 flex h-12 w-12 items-center justify-center rounded-full ${industry.background}`}>
        <Icon name={industry.icon} className={`text-2xl ${industry.color}`} />
      </div>
      <h3 className="font-display text-base font-bold text-[#0b192c]">{industry.name}</h3>
      <p className="font-mono text-[10px] uppercase leading-4 text-slate-500">{industry.description}</p>
    </article>
  )
}
