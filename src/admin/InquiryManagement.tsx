import { useEffect, useState } from 'react'
import { supabase } from '../shared/supabase'

const statuses = ['new', 'contacted', 'qualified', 'closed', 'spam'] as const
type InquiryStatus = typeof statuses[number]
type Inquiry = {
  id: string
  full_name: string
  company_name: string
  email: string
  phone: string
  inquiry_type: string
  message: string
  product_id: string | null
  status: InquiryStatus
  admin_notes: string
  created_at: string
}

const labels: Record<InquiryStatus, string> = {
  new: 'Baru',
  contacted: 'Sudah dihubungi',
  qualified: 'Prospek',
  closed: 'Selesai',
  spam: 'Spam',
}
const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const secondary = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50'
const pageSize = 10

function isInquiry(value: unknown): value is Inquiry {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return ['id', 'full_name', 'company_name', 'email', 'phone', 'inquiry_type', 'message', 'admin_notes', 'created_at']
    .every((key) => typeof row[key] === 'string')
    && (row.product_id === null || typeof row.product_id === 'string')
    && typeof row.status === 'string'
    && statuses.includes(row.status as InquiryStatus)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Tanggal tidak tersedia'
    : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function InquiryManagement() {
  const [rows, setRows] = useState<Inquiry[]>([])
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [resolvedKey, setResolvedKey] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [status, setStatus] = useState<InquiryStatus>('new')
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const loadKey = JSON.stringify([revision, page, search, filterStatus])
  const loading = resolvedKey !== loadKey

  useEffect(() => {
    let active = true
    async function load() {
      try {
        let query = supabase.from('inquiries')
          .select('id, full_name, company_name, email, phone, inquiry_type, message, product_id, status, admin_notes, created_at', { count: 'exact' })
          .order('created_at', { ascending: false }).order('id', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)
        if (filterStatus) query = query.eq('status', filterStatus)
        if (search.trim()) query = query.ilike('full_name', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`)
        const { data, error, count: resultCount } = await query
        if (!active) return
        if (error || !data || resultCount === null || !data.every(isInquiry)) throw new Error('inquiry load failed')
        setRows(data)
        setCount(resultCount)
        setLoadError('')
      } catch {
        if (active) {
          setRows([])
          setCount(0)
          setLoadError('Inquiry tidak dapat dimuat. Periksa akses dan koneksi, lalu coba lagi.')
        }
      } finally {
        if (active) setResolvedKey(loadKey)
      }
    }
    void load()
    return () => { active = false }
  }, [loadKey, page, filterStatus, search])

  function openInquiry(inquiry: Inquiry) {
    setSelected(inquiry)
    setStatus(inquiry.status)
    setAdminNotes(inquiry.admin_notes)
    setSaveError('')
    setNotice('')
  }

  async function saveInquiry() {
    if (!selected) return
    setSaving(true)
    setSaveError('')
    setNotice('')
    try {
      const { error } = await supabase.rpc('update_inquiry', {
        p_inquiry_id: selected.id,
        p_status: status,
        p_admin_notes: adminNotes.trim(),
      })
      if (error) throw new Error('save failed')
      setSelected({ ...selected, status, admin_notes: adminNotes.trim() })
      setNotice('Perubahan inquiry berhasil disimpan.')
      setRevision((value) => value + 1)
    } catch {
      setSaveError('Perubahan tidak dapat disimpan. Periksa akses dan koneksi, lalu coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Tindak lanjut pelanggan</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0b192c]">Inquiry</h1>
        <p className="mt-2 text-sm text-slate-600">Kelola pertanyaan dan permintaan penawaran yang masuk.</p>
      </div>
      <button className={secondary} onClick={() => setRevision((value) => value + 1)}>Perbarui data</button>
    </div>

    <div className="mt-6 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="min-w-52 flex-1 text-sm font-semibold text-slate-700">
        Cari nama
        <input className={`mt-2 ${field}`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Nama pengirim" />
      </label>
      <label className="w-full text-sm font-semibold text-slate-700 sm:w-56">
        Status
        <select className={`mt-2 ${field}`} value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(0) }}>
          <option value="">Semua status</option>
          {statuses.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
        </select>
      </label>
    </div>

    {loadError && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError} <button className="ml-2 font-semibold underline" onClick={() => setRevision((value) => value + 1)}>Coba lagi</button></div>}

    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {loading ? <p role="status" className="p-6 text-sm text-slate-500">Memuat inquiry...</p>
        : loadError ? null
          : rows.length === 0 ? <p className="p-6 text-sm text-slate-500">Belum ada inquiry yang cocok dengan filter ini.</p>
            : <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Nama</th><th className="px-5 py-3">Jenis</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Diterima</th><th className="px-5 py-3"><span className="sr-only">Aksi</span></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((inquiry) => <tr key={inquiry.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4"><p className="font-semibold text-[#0b192c]">{inquiry.full_name}</p><p className="mt-1 text-xs text-slate-500">{inquiry.company_name || inquiry.email}</p></td>
                    <td className="px-5 py-4 capitalize text-slate-600">{inquiry.inquiry_type}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{labels[inquiry.status]}</span></td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600">{formatDate(inquiry.created_at)}</td>
                    <td className="px-5 py-4 text-right"><button className="font-semibold text-sky-700 hover:underline" onClick={() => openInquiry(inquiry)}>Lihat detail</button></td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
      {!loading && !loadError && count > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
        <span>Menampilkan {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} dari {count} inquiry</span>
        <div className="flex gap-2">
          <button className={secondary} disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button>
          <button className={secondary} disabled={(page + 1) * pageSize >= count} onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
        </div>
      </div>}
    </div>

    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="inquiry-detail-title" className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-7">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Detail inquiry</p><h2 id="inquiry-detail-title" className="mt-2 text-2xl font-bold text-[#0b192c]">{selected.full_name}</h2><p className="mt-1 text-sm text-slate-500">{formatDate(selected.created_at)}</p></div>
          <button aria-label="Tutup detail" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelected(null)}><span aria-hidden="true" className="material-symbols-outlined">close</span></button>
        </div>
        <div className="flex-1 space-y-6 p-5 sm:p-7">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Perusahaan</dt><dd className="mt-1 text-sm text-slate-800">{selected.company_name || '—'}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Jenis inquiry</dt><dd className="mt-1 text-sm capitalize text-slate-800">{selected.inquiry_type}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Email</dt><dd className="mt-1 break-all text-sm"><a className="text-sky-700 hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a></dd></div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Telepon</dt><dd className="mt-1 text-sm text-slate-800">{selected.phone || '—'}</dd></div>
          </dl>
          <div><h3 className="text-xs font-semibold uppercase text-slate-500">Pesan</h3><p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selected.message}</p></div>
          <label className="block text-sm font-semibold text-slate-700">Status tindak lanjut
            <select className={`mt-2 ${field}`} value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)}>
              {statuses.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Catatan internal
            <textarea className={`mt-2 min-h-32 ${field}`} maxLength={5000} value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} placeholder="Catatan tindak lanjut untuk tim" />
            <span className="mt-1 block text-right text-xs font-normal text-slate-500">{adminNotes.length}/5000</span>
          </label>
          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-5 sm:p-7">
          <button className={secondary} onClick={() => setSelected(null)}>Tutup</button>
          <button className="rounded-lg bg-[#0b192c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} onClick={() => void saveInquiry()}>{saving ? 'Menyimpan...' : 'Simpan perubahan'}</button>
        </div>
      </section>
    </div>}
  </section>
}
