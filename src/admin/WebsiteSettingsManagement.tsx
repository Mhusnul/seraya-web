import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../shared/supabase'
import { fallbackWebsiteSettings } from '../shared/websiteSettings'
import type { WebsiteSettings } from '../shared/websiteSettings'

type SettingsForm = Omit<WebsiteSettings, 'logo_path' | 'logo_alt' | 'default_og_image_path' | 'default_og_image_alt'> & {
  logo_media_id: string
  default_og_image_media_id: string
}
type Media = { id: string; object_path: string; original_file_name: string; alt_text: string }
type SettingsRecord = Omit<SettingsForm, 'logo_media_id' | 'default_og_image_media_id'> & {
  logo_media_id: string | null
  default_og_image_media_id: string | null
  updated_at: string
  updated_by: string | null
}
type MediaField = 'logo_media_id' | 'default_og_image_media_id'
type Section = 'general' | 'contact' | 'seo'

const field = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100'
const secondary = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'
const primary = 'rounded-lg bg-[#0b192c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3e62] disabled:cursor-not-allowed disabled:opacity-50'
const sections: { id: Section; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'contact', label: 'Kontak' },
  { id: 'seo', label: 'SEO' },
]

function emptyForm(): SettingsForm {
  return {
    company_display_name: fallbackWebsiteSettings.company_display_name,
    logo_media_id: '',
    whatsapp_number: fallbackWebsiteSettings.whatsapp_number,
    sales_email: fallbackWebsiteSettings.sales_email,
    general_email: fallbackWebsiteSettings.general_email,
    copyright_text: fallbackWebsiteSettings.copyright_text,
    default_seo_title: '',
    default_seo_description: '',
    default_og_image_media_id: '',
  }
}

function sameForm(left: SettingsForm, right: SettingsForm) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'Masukkan nomor dengan kode negara, misalnya 628111611177.'
  if (!/^[1-9]\d{7,14}$/.test(digits)) return 'Gunakan 8–15 digit dengan kode negara; contoh 628111611177.'
  return ''
}

function formatEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function publicUrl(path: string) {
  return supabase.storage.from('website-media').getPublicUrl(path).data.publicUrl
}

function isMedia(value: unknown): value is Media {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && typeof row.object_path === 'string'
    && typeof row.original_file_name === 'string' && typeof row.alt_text === 'string'
}

function isSettings(value: unknown): value is SettingsRecord {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.company_display_name === 'string'
    && typeof row.whatsapp_number === 'string'
    && typeof row.sales_email === 'string'
    && typeof row.general_email === 'string'
    && typeof row.copyright_text === 'string'
    && typeof row.default_seo_title === 'string'
    && typeof row.default_seo_description === 'string'
    && (typeof row.logo_media_id === 'string' || row.logo_media_id === null)
    && (typeof row.default_og_image_media_id === 'string' || row.default_og_image_media_id === null)
    && typeof row.updated_at === 'string'
    && (typeof row.updated_by === 'string' || row.updated_by === null)
}

export function WebsiteSettingsManagement() {
  const [form, setForm] = useState<SettingsForm>(emptyForm)
  const [baseline, setBaseline] = useState<SettingsForm>(emptyForm)
  const [images, setImages] = useState<Record<string, Media>>({})
  const [updatedAt, setUpdatedAt] = useState('')
  const [section, setSection] = useState<Section>('general')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [validation, setValidation] = useState<Record<string, string>>({})
  const [picker, setPicker] = useState<MediaField | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [mediaSearch, setMediaSearch] = useState('')
  const allowUnload = useRef(false)
  const dirty = !sameForm(form, baseline)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error: loadError } = await supabase.from('website_settings')
          .select('company_display_name, logo_media_id, whatsapp_number, sales_email, general_email, copyright_text, default_seo_title, default_seo_description, default_og_image_media_id, updated_by, updated_at')
          .eq('singleton', true).maybeSingle()
        if (loadError || !isSettings(data)) throw new Error('settings load failed')
        const next: SettingsForm = {
          company_display_name: data.company_display_name,
          logo_media_id: data.logo_media_id ?? '',
          whatsapp_number: data.whatsapp_number,
          sales_email: data.sales_email,
          general_email: data.general_email,
          copyright_text: data.copyright_text,
          default_seo_title: data.default_seo_title,
          default_seo_description: data.default_seo_description,
          default_og_image_media_id: data.default_og_image_media_id ?? '',
        }
        let nextImages: Record<string, Media> = {}
        const imageIds = [next.logo_media_id, next.default_og_image_media_id].filter(Boolean)
        if (imageIds.length) {
          const { data: imageRows, error: imageError } = await supabase.from('media_assets')
            .select('id, object_path, original_file_name, alt_text').in('id', imageIds)
          if (imageError || !imageRows || !imageRows.every(isMedia)) throw new Error('media load failed')
          nextImages = Object.fromEntries(imageRows.map((image) => [image.id, image]))
        }
        if (!active) return
        setForm(next)
        setBaseline(next)
        setImages(nextImages)
        setUpdatedAt(data.updated_at)
        setLoadError('')
        setError('')
      } catch {
        if (active) setLoadError('Website Settings tidak dapat dimuat. Periksa akses dan koneksi, lalu coba lagi.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowUnload.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const confirmNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const link = event.target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return
      const target = new URL(link.href, window.location.href)
      if (target.href === window.location.href) return
      if (!window.confirm('Anda memiliki perubahan yang belum disimpan. Tinggalkan halaman ini?')) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      allowUnload.current = true
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', confirmNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', confirmNavigation, true)
      allowUnload.current = false
    }
  }, [dirty])

  useEffect(() => {
    if (!picker) return
    let active = true
    async function loadMedia() {
      setMediaLoading(true)
      setMediaError('')
      try {
        const { data, error: loadError } = await supabase.from('media_assets')
          .select('id, object_path, original_file_name, alt_text')
          .eq('state', 'ready').order('created_at', { ascending: false }).limit(100)
        if (loadError || !data || !data.every(isMedia)) throw new Error('media load failed')
        if (active) setMedia(data)
      } catch {
        if (active) setMediaError('Media tidak dapat dimuat. Tutup pemilih dan coba lagi.')
      } finally {
        if (active) setMediaLoading(false)
      }
    }
    void loadMedia()
    return () => { active = false }
  }, [picker])

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setValidation((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
    setError('')
    setNotice('')
  }

  function chooseMedia(value: Media) {
    if (!picker) return
    update(picker, value.id)
    setImages((previous) => ({ ...previous, [value.id]: value }))
    setPicker(null)
    setMediaSearch('')
  }

  function validate() {
    const next: Record<string, string> = {}
    if (form.company_display_name.trim().length < 2 || form.company_display_name.trim().length > 150) {
      next.company_display_name = 'Nama perusahaan harus berisi 2–150 karakter.'
    }
    const whatsappError = formatPhone(form.whatsapp_number)
    if (whatsappError) next.whatsapp_number = whatsappError
    if (!formatEmail(form.sales_email)) next.sales_email = 'Masukkan alamat email sales yang valid.'
    if (!formatEmail(form.general_email)) next.general_email = 'Masukkan alamat email umum yang valid.'
    if (form.copyright_text.length > 200) next.copyright_text = 'Copyright maksimal 200 karakter.'
    if (form.default_seo_title.length > 120) next.default_seo_title = 'SEO title maksimal 120 karakter.'
    if (form.default_seo_description.length > 320) next.default_seo_description = 'SEO description maksimal 320 karakter.'
    setValidation(next)
    return Object.keys(next).length === 0
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('')
    setError('')
    if (!validate()) {
      setError('Periksa kembali field yang ditandai sebelum menyimpan.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        company_display_name: form.company_display_name.trim(),
        whatsapp_number: form.whatsapp_number.replace(/\D/g, ''),
        sales_email: form.sales_email.trim().toLowerCase(),
        general_email: form.general_email.trim().toLowerCase(),
        copyright_text: form.copyright_text.trim(),
        default_seo_title: form.default_seo_title.trim(),
        default_seo_description: form.default_seo_description.trim(),
        logo_media_id: form.logo_media_id || null,
        default_og_image_media_id: form.default_og_image_media_id || null,
      }
      const { data: savedAt, error: saveError } = await supabase.rpc('save_website_settings', { payload })
      if (saveError || typeof savedAt !== 'string') throw new Error('settings save failed')
      const savedForm: SettingsForm = {
        ...payload,
        logo_media_id: payload.logo_media_id ?? '',
        default_og_image_media_id: payload.default_og_image_media_id ?? '',
      }
      setForm(savedForm)
      setBaseline(savedForm)
      setUpdatedAt(savedAt)
      setNotice('Website Settings berhasil disimpan.')
    } catch {
      setError('Perubahan tidak dapat disimpan. Periksa kembali data, media terpilih, dan koneksi Anda.')
    } finally {
      setSaving(false)
    }
  }

  const filteredMedia = media.filter((item) => item.original_file_name.toLowerCase().includes(mediaSearch.trim().toLowerCase()))
  const mediaField = (key: MediaField, label: string) => {
    const selected = images[form[key]]
    return <div>
      <span className="block text-sm font-semibold text-slate-700">{label} <span className="font-normal text-slate-500">(opsional)</span></span>
      {selected && <div className="mt-3 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <img src={publicUrl(selected.object_path)} alt={selected.alt_text || selected.original_file_name} className="h-16 w-16 rounded-md bg-white object-contain" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{selected.original_file_name}</p><p className="mt-1 text-xs text-slate-500">{selected.alt_text || 'Tanpa teks alternatif'}</p></div>
        <button type="button" className="text-sm font-semibold text-red-700 hover:underline" onClick={() => update(key, '')}>Hapus</button>
      </div>}
      {!selected && form[key] && <p className="mt-2 text-sm text-amber-700">Media terpilih tidak tersedia. Pilih media lain atau hapus referensi ini.</p>}
      <button type="button" className={`${secondary} mt-3`} onClick={() => setPicker(key)}>{selected ? 'Ganti media' : 'Pilih dari Media Library'}</button>
    </div>
  }

  return <section className="mx-auto max-w-5xl">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Konfigurasi global</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0b192c]">Website Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Kelola identitas, informasi kontak, dan default SEO website.</p>
      </div>
      {updatedAt && <p className="text-xs text-slate-500">Terakhir diperbarui {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(updatedAt))}</p>}
    </div>

    {loading ? <p role="status" className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Memuat Website Settings...</p>
      : loadError ? <div role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{loadError}<button type="button" className={`${secondary} ml-3`} onClick={() => { setLoading(true); setRevision((value) => value + 1) }}>Coba lagi</button></div>
        : <form onSubmit={(event) => void save(event)} className="mt-7">
        <div role="tablist" aria-label="Bagian Website Settings" className="flex gap-2 overflow-x-auto border-b border-slate-200">
          {sections.map((item) => <button key={item.id} id={`settings-tab-${item.id}`} type="button" role="tab" aria-selected={section === item.id} aria-controls={`settings-panel-${item.id}`} onClick={() => setSection(item.id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${section === item.id ? 'border-sky-700 text-sky-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item.label}</button>)}
        </div>

        <section id={`settings-panel-${section}`} role="tabpanel" aria-labelledby={`settings-tab-${section}`} className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {section === 'general' && <div className="space-y-6">
            <div>
              <label htmlFor="company-display-name" className="block text-sm font-semibold text-slate-700">Nama display perusahaan</label>
              <input id="company-display-name" required maxLength={150} className={field} value={form.company_display_name} onChange={(event) => update('company_display_name', event.target.value)} />
              {validation.company_display_name && <p className="mt-1 text-xs text-red-700">{validation.company_display_name}</p>}
              <p className="mt-1 text-xs text-slate-500">Digunakan untuk identitas dan footer website.</p>
            </div>
            {mediaField('logo_media_id', 'Logo website')}
            <div>
              <label htmlFor="copyright-text" className="block text-sm font-semibold text-slate-700">Teks copyright</label>
              <input id="copyright-text" maxLength={200} className={field} value={form.copyright_text} onChange={(event) => update('copyright_text', event.target.value)} />
              {validation.copyright_text && <p className="mt-1 text-xs text-red-700">{validation.copyright_text}</p>}
            </div>
          </div>}

          {section === 'contact' && <div className="space-y-6">
            <div>
              <label htmlFor="whatsapp-number" className="block text-sm font-semibold text-slate-700">Nomor WhatsApp</label>
              <input id="whatsapp-number" required inputMode="tel" autoComplete="tel" maxLength={30} className={field} value={form.whatsapp_number} onChange={(event) => update('whatsapp_number', event.target.value)} placeholder="+62 811-1611-177" aria-invalid={Boolean(validation.whatsapp_number)} />
              {validation.whatsapp_number && <p className="mt-1 text-xs text-red-700">{validation.whatsapp_number}</p>}
              <p className="mt-1 text-xs text-slate-500">Simpan dengan kode negara. Link WhatsApp akan dibuat otomatis.</p>
            </div>
            <div>
              <label htmlFor="sales-email" className="block text-sm font-semibold text-slate-700">Email sales</label>
              <input id="sales-email" required type="email" autoComplete="email" maxLength={254} className={field} value={form.sales_email} onChange={(event) => update('sales_email', event.target.value)} aria-invalid={Boolean(validation.sales_email)} />
              {validation.sales_email && <p className="mt-1 text-xs text-red-700">{validation.sales_email}</p>}
            </div>
            <div>
              <label htmlFor="general-email" className="block text-sm font-semibold text-slate-700">Email umum</label>
              <input id="general-email" required type="email" autoComplete="email" maxLength={254} className={field} value={form.general_email} onChange={(event) => update('general_email', event.target.value)} aria-invalid={Boolean(validation.general_email)} />
              {validation.general_email && <p className="mt-1 text-xs text-red-700">{validation.general_email}</p>}
            </div>
          </div>}

          {section === 'seo' && <div className="space-y-6">
            <div>
              <label htmlFor="default-seo-title" className="block text-sm font-semibold text-slate-700">Default site title</label>
              <input id="default-seo-title" maxLength={120} className={field} value={form.default_seo_title} onChange={(event) => update('default_seo_title', event.target.value)} placeholder="Kosongkan untuk menggunakan title halaman." />
              {validation.default_seo_title && <p className="mt-1 text-xs text-red-700">{validation.default_seo_title}</p>}
            </div>
            <div>
              <label htmlFor="default-seo-description" className="block text-sm font-semibold text-slate-700">Default meta description</label>
              <textarea id="default-seo-description" maxLength={320} rows={4} className={field} value={form.default_seo_description} onChange={(event) => update('default_seo_description', event.target.value)} placeholder="Deskripsi fallback untuk halaman yang belum memiliki deskripsi khusus." />
              <p className="mt-1 text-right text-xs text-slate-500">{form.default_seo_description.length}/320</p>
              {validation.default_seo_description && <p className="mt-1 text-xs text-red-700">{validation.default_seo_description}</p>}
            </div>
            {mediaField('default_og_image_media_id', 'Default Open Graph image')}
          </div>}
        </section>

        <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="min-w-0 flex-1">
            {dirty ? <p className="text-sm font-semibold text-amber-800">Ada perubahan yang belum disimpan.</p> : <p className="text-sm text-slate-500">Semua perubahan sudah tersimpan.</p>}
            {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="mt-1 text-sm text-emerald-700">{notice}</p>}
          </div>
          <button type="submit" className={primary} disabled={!dirty || saving}>{saving ? 'Menyimpan...' : 'Simpan pengaturan'}</button>
        </div>
      </form>}

    {picker && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={(event) => { if (event.target === event.currentTarget) setPicker(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="settings-media-title" className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div><h2 id="settings-media-title" className="text-xl font-bold text-[#0b192c]">Pilih media</h2><p className="mt-1 text-sm text-slate-500">Pilih gambar yang siap digunakan dari Media Library.</p></div>
          <button type="button" aria-label="Tutup pemilih media" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setPicker(null)}><span aria-hidden="true" className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-5"><label htmlFor="settings-media-search" className="sr-only">Cari media</label><input id="settings-media-search" className={field} value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} placeholder="Cari nama file" /></div>
        <div className="min-h-48 flex-1 overflow-y-auto px-5 pb-5">
          {mediaLoading ? <p role="status" className="py-12 text-center text-sm text-slate-500">Memuat media...</p>
            : mediaError ? <p role="alert" className="py-12 text-center text-sm text-red-700">{mediaError}</p>
              : filteredMedia.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Tidak ada media yang cocok.</p>
                : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredMedia.map((item) => <button key={item.id} type="button" onClick={() => chooseMedia(item)} className="overflow-hidden rounded-lg border border-slate-200 text-left transition hover:border-sky-600 hover:ring-2 hover:ring-sky-100">
                    <img src={publicUrl(item.object_path)} alt={item.alt_text || item.original_file_name} className="aspect-square w-full bg-slate-100 object-contain" />
                    <span className="block truncate px-3 py-2 text-xs font-semibold text-slate-700">{item.original_file_name}</span>
                  </button>)}
                </div>}
        </div>
        <div className="flex justify-end border-t border-slate-200 p-4"><button type="button" className={secondary} onClick={() => setPicker(null)}>Batal</button></div>
      </section>
    </div>}
  </section>
}
