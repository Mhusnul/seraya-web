import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import { supabase } from '../shared/supabase'

const ArticleImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), mediaId: { default: null }, caption: { default: '' } }
  },
})

export function ArticleEditor({ initial, onChange, image }: {
  initial: JSONContent
  onChange: (value: JSONContent) => void
  image: { id: string; path: string; alt: string; caption: string } | null
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false, codeBlock: false, horizontalRule: false, strike: false, underline: false,
        link: { openOnClick: false, defaultProtocol: 'https', protocols: ['https', 'http'] },
      }),
      ArticleImage,
    ],
    content: initial,
    editorProps: { attributes: { class: 'article-editor-content', 'aria-label': 'Isi artikel' } },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  })

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      paragraph: current?.isActive('paragraph') ?? false,
      h2: current?.isActive('heading', { level: 2 }) ?? false,
      h3: current?.isActive('heading', { level: 3 }) ?? false,
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      bullet: current?.isActive('bulletList') ?? false,
      ordered: current?.isActive('orderedList') ?? false,
      quote: current?.isActive('blockquote') ?? false,
      link: current?.isActive('link') ?? false,
    }),
  })

  function addImage() {
    if (!editor || !image) return
    editor.chain().focus().insertContent({ type: 'image', attrs: { src: supabase.storage.from('website-media').getPublicUrl(image.path).data.publicUrl, alt: image.alt, mediaId: image.id, caption: image.caption } }).run()
  }

  function link() {
    if (!editor) return
    const value = window.prompt('URL lengkap (http atau https). Kosongkan untuk menghapus link.', editor.getAttributes('link').href || 'https://')
    if (value === null) return
    if (!value) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    if (!/^https?:\/\/[^\s]+$/i.test(value)) { window.alert('Gunakan URL http atau https yang valid.'); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run()
  }

  const control = (pressed: boolean) => `inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40 ${pressed ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`
  const icon = (name: string) => <span aria-hidden="true" className="material-symbols-outlined !text-[20px]">{name}</span>
  const separator = <span aria-hidden="true" className="mx-1 h-6 w-px self-center bg-slate-300" />
  return <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
    <div role="toolbar" aria-label="Format isi artikel" className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2" onMouseDown={(event) => event.preventDefault()}>
      <button type="button" className={control(active?.paragraph ?? false)} title="Paragraf" aria-label="Paragraf" aria-pressed={active?.paragraph ?? false} disabled={!editor} onClick={() => editor?.chain().focus().setParagraph().run()}>{icon('format_paragraph')}</button>
      <button type="button" className={control(active?.h2 ?? false)} title="Judul H2" aria-label="Judul H2" aria-pressed={active?.h2 ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button type="button" className={control(active?.h3 ?? false)} title="Judul H3" aria-label="Judul H3" aria-pressed={active?.h3 ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
      {separator}
      <button type="button" className={control(active?.bold ?? false)} title="Tebal" aria-label="Tebal" aria-pressed={active?.bold ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()}>{icon('format_bold')}</button>
      <button type="button" className={control(active?.italic ?? false)} title="Miring" aria-label="Miring" aria-pressed={active?.italic ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()}>{icon('format_italic')}</button>
      {separator}
      <button type="button" className={control(active?.bullet ?? false)} title="Daftar bullet" aria-label="Daftar bullet" aria-pressed={active?.bullet ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}>{icon('format_list_bulleted')}</button>
      <button type="button" className={control(active?.ordered ?? false)} title="Daftar bernomor" aria-label="Daftar bernomor" aria-pressed={active?.ordered ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>{icon('format_list_numbered')}</button>
      <button type="button" className={control(active?.quote ?? false)} title="Kutipan" aria-label="Kutipan" aria-pressed={active?.quote ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>{icon('format_quote')}</button>
      {separator}
      <button type="button" className={control(active?.link ?? false)} title="Tambah atau ubah link" aria-label="Tambah atau ubah link" aria-pressed={active?.link ?? false} disabled={!editor} onClick={link}>{icon('link')}</button>
      <button type="button" className={control(false)} title={image ? 'Sisipkan gambar terpilih' : 'Pilih gambar isi terlebih dahulu'} aria-label="Sisipkan gambar terpilih" disabled={!editor || !image} onClick={addImage}>{icon('image')}</button>
    </div>
    <EditorContent editor={editor} />
  </div>
}
