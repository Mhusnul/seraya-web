import type { JSONContent } from '@tiptap/react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'

export type ArticleMedia = { id: string; path: string }

export function ArticleContent({ content, media }: { content: JSONContent; media: ArticleMedia[] }) {
  function render(node: JSONContent, key: number): ReactNode {
    const children = node.content?.map((child, index) => render(child, index))
    switch (node.type) {
      case 'doc': return <div key={key} className="space-y-4">{children}</div>
      case 'paragraph': return <p key={key}>{children}</p>
      case 'heading': return node.attrs?.level === 2 ? <h2 key={key} className="mt-6 text-2xl font-bold">{children}</h2> : <h3 key={key} className="mt-5 text-xl font-bold">{children}</h3>
      case 'bulletList': return <ul key={key} className="list-disc space-y-1 pl-6">{children}</ul>
      case 'orderedList': return <ol key={key} className="list-decimal space-y-1 pl-6">{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'blockquote': return <blockquote key={key} className="border-l-4 border-slate-300 pl-4 italic">{children}</blockquote>
      case 'hardBreak': return <br key={key} />
      case 'image': {
        const found = media.find((m) => m.id === node.attrs?.mediaId)
        if (!found) return null
        const caption = typeof node.attrs?.caption === 'string' ? node.attrs.caption : ''
        const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
        return <figure key={key}><img className="max-h-[36rem] w-full rounded-lg object-contain" src={supabase.storage.from('website-media').getPublicUrl(found.path).data.publicUrl} alt={alt} />{caption && <figcaption className="mt-2 text-sm text-slate-500">{caption}</figcaption>}</figure>
      }
      case 'text': {
        let text: ReactNode = node.text ?? ''
        for (const mark of node.marks ?? []) {
          if (mark.type === 'bold') text = <strong>{text}</strong>
          else if (mark.type === 'italic') text = <em>{text}</em>
          else if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && /^https?:\/\/[^\s]+$/i.test(mark.attrs.href)) text = <a className="text-sky-700 underline" href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{text}</a>
        }
        return <span key={key}>{text}</span>
      }
      default: return null
    }
  }
  return <div className="leading-7 text-slate-700">{render(content, 0)}</div>
}
