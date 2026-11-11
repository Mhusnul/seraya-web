import { Icon } from './Icon'

type SectionHeadingProps = {
  eyebrow: string
  title: string
  description?: string
  icon?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
}: SectionHeadingProps) {
  return (
    <div className="mb-10 max-w-2xl">
      <div className="mb-2 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-sky-600">
        {icon && <Icon name={icon} className="text-xl" />}
        <span>{eyebrow}</span>
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-[#0b192c] sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
      )}
    </div>
  )
}
