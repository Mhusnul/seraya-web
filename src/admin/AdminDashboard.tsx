import { lazy, Suspense, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../shared/supabase'
import { MediaManagement } from './MediaManagement'
import { ProductManagement } from './ProductManagement'
import { BlogManagement } from './BlogManagement'
import { InquiryManagement } from './InquiryManagement'

const WebsiteSettingsManagement = lazy(() => import('./WebsiteSettingsManagement').then((module) => ({ default: module.WebsiteSettingsManagement })))

export type AdminProfile = {
  id: string
  display_name: string | null
  role: 'admin' | 'super_admin'
  is_active: boolean
}

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'unavailable' }
  | { status: 'error' }

type Inquiry = {
  id: string
  full_name: string
  company_name: string
  inquiry_type: string
  created_at: string
  status: string
}

type DashboardData = {
  products: LoadState<number>
  articles: LoadState<number>
  newInquiries: LoadState<number>
  totalInquiries: LoadState<number>
  recentInquiries: LoadState<Inquiry[]>
}

const initialData = (): DashboardData => ({
  products: { status: 'loading' },
  articles: { status: 'loading' },
  newInquiries: { status: 'loading' },
  totalInquiries: { status: 'loading' },
  recentInquiries: { status: 'loading' },
})

const navigation = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Produk', icon: 'inventory_2' },
  { label: 'Blog', icon: 'article' },
  { label: 'Inquiry', icon: 'inbox' },
  { label: 'Media', icon: 'photo_library' },
  { label: 'Pengaturan Website', icon: 'settings' },
]

function isInquiry(value: unknown): value is Inquiry {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return ['id', 'full_name', 'company_name', 'inquiry_type', 'created_at', 'status']
    .every((key) => typeof row[key] === 'string')
}

function failure(code?: string): LoadState<never> {
  return code === 'PGRST205' || code === '42P01' ? { status: 'unavailable' } : { status: 'error' }
}

function useDashboardData(canReadInquiries: boolean, revision: number, enabled: boolean) {
  const [snapshot, setSnapshot] = useState(() => ({ revision, canReadInquiries, data: initialData() }))
  const data = snapshot.revision === revision && snapshot.canReadInquiries === canReadInquiries
    ? snapshot.data : initialData()

  useEffect(() => {
    if (!enabled) return
    let active = true
    function updateData(update: (previous: DashboardData) => DashboardData) {
      if (!active) return
      setSnapshot((previous) => ({
        revision,
        canReadInquiries,
        data: update(previous.revision === revision && previous.canReadInquiries === canReadInquiries
          ? previous.data : initialData()),
      }))
    }

    async function loadCount(key: 'products' | 'articles' | 'newInquiries' | 'totalInquiries') {
      try {
        let query = key === 'products'
          ? supabase.from('products').select('id', { count: 'exact', head: true })
          : key === 'articles'
            ? supabase.from('articles').select('id', { count: 'exact', head: true })
              .eq('status', 'published').not('published_at', 'is', null).lte('published_at', new Date().toISOString())
            : supabase.from('inquiries').select('id', { count: 'exact', head: true })
        if (key === 'newInquiries') query = query.eq('status', 'new')
        const { count, error } = await query
        if (!active) return
        updateData((previous) => ({
          ...previous,
          [key]: error ? failure(error.code) : count === null ? { status: 'error' } : { status: 'ready', value: count },
        }))
      } catch {
        updateData((previous) => ({ ...previous, [key]: { status: 'error' } }))
      }
    }

    async function loadRecent() {
      try {
        const { data: rows, error } = await supabase.from('inquiries')
          .select('id, full_name, company_name, inquiry_type, created_at, status')
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5)
        if (!active) return
        const state: LoadState<Inquiry[]> = error
          ? failure(error.code)
          : rows && rows.every(isInquiry)
            ? { status: 'ready', value: rows }
            : { status: 'error' }
        updateData((previous) => ({ ...previous, recentInquiries: state }))
      } catch {
        updateData((previous) => ({ ...previous, recentInquiries: { status: 'error' } }))
      }
    }

    void loadCount('products')
    void loadCount('articles')
    if (canReadInquiries) {
      void loadCount('newInquiries')
      void loadCount('totalInquiries')
      void loadRecent()
    }
    return () => { active = false }
  }, [canReadInquiries, revision, enabled])

  return data
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{name}</span>
}

export function AdminDashboard({ user, profile, onSignOut, page }: {
  user: User
  profile: AdminProfile
  onSignOut: () => Promise<void>
  page: 'dashboard' | 'media' | 'products' | 'blog' | 'inquiry' | 'settings'
}) {
  const [revision, setRevision] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const canReadInquiries = profile.role === 'super_admin'
  const data = useDashboardData(canReadInquiries, revision, page === 'dashboard')
  const displayName = profile.display_name || user.email || 'Admin'

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError('')
    try {
      await onSignOut()
    } catch {
      setSignOutError('Tidak dapat keluar. Periksa koneksi dan coba lagi.')
    } finally {
      setSigningOut(false)
    }
  }

  return <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] lg:flex">
    {menuOpen && <button aria-label="Tutup menu" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMenuOpen(false)} />}
    <aside id="admin-sidebar" className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0b192c] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
        <a href="/admin" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#0b192c]">SS</span>
          <span><strong className="block text-sm">Seraya Semesta</strong><span className="text-xs text-slate-400">Admin Panel</span></span>
        </a>
        <button className="lg:hidden" aria-label="Tutup menu" onClick={() => setMenuOpen(false)}><Icon name="close" /></button>
      </div>
      <nav aria-label="Navigasi admin" className="flex-1 space-y-1 px-3 py-6">
        {navigation.filter((item) => canReadInquiries || !['Inquiry', 'Pengaturan Website'].includes(item.label)).map((item) => ['Dashboard', 'Media', 'Produk', 'Blog', 'Inquiry', 'Pengaturan Website'].includes(item.label)
          ? <a key={item.label} href={item.label === 'Media' ? '/admin/media' : item.label === 'Produk' ? '/admin/products' : item.label === 'Blog' ? '/admin/blog' : item.label === 'Inquiry' ? '/admin/inquiry' : item.label === 'Pengaturan Website' ? '/admin/settings' : '/admin'} aria-current={(item.label === 'Media' && page === 'media') || (item.label === 'Produk' && page === 'products') || (item.label === 'Blog' && page === 'blog') || (item.label === 'Inquiry' && page === 'inquiry') || (item.label === 'Pengaturan Website' && page === 'settings') || (item.label === 'Dashboard' && page === 'dashboard') ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold ${((item.label === 'Media' && page === 'media') || (item.label === 'Produk' && page === 'products') || (item.label === 'Blog' && page === 'blog') || (item.label === 'Inquiry' && page === 'inquiry') || (item.label === 'Pengaturan Website' && page === 'settings') || (item.label === 'Dashboard' && page === 'dashboard')) ? 'bg-white/10' : 'text-slate-300 hover:bg-white/10'}`}>
            <Icon name={item.icon} className="text-xl" />{item.label}
          </a>
          : <div key={item.label} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-400" title="Modul belum tersedia">
            <Icon name={item.icon} className="text-xl" /><span>{item.label}</span><span className="ml-auto text-[10px]">Segera</span>
          </div>)}
      </nav>
      <div className="border-t border-white/10 px-6 py-5 text-xs text-slate-400">PT. Seraya Semesta Indonesia</div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Buka menu" aria-expanded={menuOpen} aria-controls="admin-sidebar" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button>
          <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin Panel</p><p className="font-bold text-[#0b192c]">{page === 'media' ? 'Media Library' : page === 'products' ? 'Produk' : page === 'blog' ? 'Blog' : page === 'inquiry' ? 'Inquiry' : page === 'settings' ? 'Website Settings' : 'Dashboard'}</p></div>
        </div>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">{displayName.charAt(0).toUpperCase()}</span>
            <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">{displayName}</span>
            <Icon name="expand_more" className="text-xl" />
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="break-all text-sm font-semibold">{displayName}</p>
            <p className="mt-1 text-xs text-slate-500">{profile.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
            {signOutError && <p role="alert" className="mt-3 text-xs text-red-700">{signOutError}</p>}
            <button onClick={handleSignOut} disabled={signingOut} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
              {signingOut ? 'Keluar...' : 'Keluar'}
            </button>
          </div>
        </details>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:py-10">
        {page === 'media' ? <MediaManagement userId={user.id} /> : page === 'products' ? <ProductManagement /> : page === 'blog' ? <BlogManagement /> : page === 'inquiry' ? <InquiryManagement /> : page === 'settings' ? <Suspense fallback={<p role="status">Memuat Website Settings...</p>}><WebsiteSettingsManagement /></Suspense> : <>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Overview</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0b192c]">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">Ringkasan pengelolaan website Seraya Semesta.</p>
            <p className="mt-1 text-sm text-slate-500">Selamat datang, {displayName}.</p>
          </div>
          <button onClick={() => setRevision((value) => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Icon name="refresh" className="text-xl" /> Perbarui data
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Total Produk" description="Semua status yang dapat diakses" icon="inventory_2" state={data.products} />
          <Metric title="Artikel Published" description="Artikel yang telah dipublikasikan" icon="article" state={data.articles} />
          {canReadInquiries
            ? <><Metric title="Inquiry Baru" description="Menunggu tindak lanjut" icon="mark_email_unread" state={data.newInquiries} /><Metric title="Total Inquiry" description="Seluruh inquiry yang dapat diakses" icon="inbox" state={data.totalInquiries} /></>
            : <><RestrictedMetric title="Inquiry Baru" icon="mark_email_unread" /><RestrictedMetric title="Total Inquiry" icon="inbox" /></>}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)]">
          <section aria-labelledby="recent-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="recent-heading" className="text-lg font-bold text-[#0b192c]">Inquiry Terbaru</h2>
            <p className="mt-1 text-sm text-slate-500">Maksimal lima inquiry terakhir.</p>
            <div className="mt-6">
              {canReadInquiries ? <RecentInquiries state={data.recentInquiries} /> : <p className="text-sm text-slate-500">Akses inquiry belum ditetapkan untuk role ini.</p>}
            </div>
          </section>
          <section aria-labelledby="quick-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="quick-heading" className="text-lg font-bold text-[#0b192c]">Aksi Cepat</h2>
            <p className="mt-1 text-sm text-slate-500">Akses cepat ke modul yang tersedia.</p>
            <ul className="mt-5 space-y-2">
              <li><a href="/admin/products" className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-slate-100">Kelola Produk</a></li>
              <li><a href="/admin/blog" className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-slate-100">Kelola Artikel</a></li>
              {canReadInquiries && <li><a href="/admin/inquiry" className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-slate-100">Kelola Inquiry</a></li>}
              {canReadInquiries && <li><a href="/admin/settings" className="block rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-slate-100">Pengaturan Website</a></li>}
              {!canReadInquiries && <li className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500"><span>Buka Pengaturan Website</span><span className="text-xs">Segera</span></li>}
            </ul>
          </section>
        </div>
        </>}
      </main>
    </div>
  </div>
}

function Metric({ title, description, icon, state }: { title: string; description: string; icon: string; state: LoadState<number> }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-semibold text-slate-600">{title}</h2><Icon name={icon} className="rounded-lg bg-blue-50 p-2 text-xl text-sky-700" /></div>
    {state.status === 'loading' ? <p role="status" className="mt-4 text-sm text-slate-500">Memuat...</p>
      : state.status === 'ready' ? <p className="mt-3 text-3xl font-bold text-[#0b192c]">{state.value}</p>
        : <p role={state.status === 'error' ? 'alert' : undefined} className="mt-4 text-sm font-semibold text-slate-600">{state.status === 'unavailable' ? 'Modul belum tersedia' : 'Gagal memuat data'}</p>}
    <p className="mt-2 text-xs text-slate-500">{description}</p>
  </section>
}

function RestrictedMetric({ title, icon }: { title: string; icon: string }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between"><h2 className="text-sm font-semibold text-slate-600">{title}</h2><Icon name={icon} className="rounded-lg bg-slate-50 p-2 text-xl text-slate-500" /></div>
    <p className="mt-4 text-sm text-slate-500">Akses belum ditetapkan</p>
  </section>
}

function RecentInquiries({ state }: { state: LoadState<Inquiry[]> }) {
  const statusLabels: Record<string, string> = {
    new: 'Baru',
    contacted: 'Sudah dihubungi',
    qualified: 'Prospek',
    closed: 'Selesai',
    spam: 'Spam',
  }
  if (state.status === 'loading') return <p role="status" className="text-sm text-slate-500">Memuat inquiry...</p>
  if (state.status === 'unavailable') return <p className="text-sm text-slate-500">Modul inquiry belum tersedia.</p>
  if (state.status === 'error') return <p role="alert" className="text-sm text-red-700">Inquiry tidak dapat dimuat. Gunakan tombol perbarui data untuk mencoba lagi.</p>
  if (state.value.length === 0) return <p className="text-sm text-slate-500">Belum ada inquiry.</p>
  return <ul className="divide-y divide-slate-100">
    {state.value.map((inquiry) => <li key={inquiry.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0">
      <div><p className="font-semibold text-[#0b192c]">{inquiry.full_name}</p><p className="mt-1 text-sm text-slate-500">{inquiry.company_name ? `${inquiry.company_name} · ` : ''}{inquiry.inquiry_type}</p></div>
      <div className="text-right"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{statusLabels[inquiry.status] ?? inquiry.status}</span><p className="mt-2 text-xs text-slate-500">{Number.isNaN(Date.parse(inquiry.created_at)) ? 'Tanggal tidak tersedia' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(inquiry.created_at))}</p></div>
    </li>)}
  </ul>
}
