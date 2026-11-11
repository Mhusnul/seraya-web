import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '../shared/supabase'
import { AdminDashboard } from './AdminDashboard'
import type { AdminProfile } from './AdminDashboard'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'denied'; user: User }
  | { status: 'error' }
  | { status: 'authorized'; user: User; profile: AdminProfile }

const inputClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100'
const buttonClass = 'w-full rounded-lg bg-[#0b192c] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1e3e62] disabled:cursor-not-allowed disabled:opacity-60'

function isAdminProfile(value: unknown): value is AdminProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Record<string, unknown>
  return typeof profile.id === 'string'
    && (typeof profile.display_name === 'string' || profile.display_name === null)
    && (profile.role === 'admin' || profile.role === 'super_admin')
    && profile.is_active === true
}

export function AdminAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [revision, setRevision] = useState(0)
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  useEffect(() => {
    let active = true
    let sequence = 0
    const resolve = async (session: Session | null) => {
      const request = ++sequence
      try {
        if (!session) {
          if (active) setAuth({ status: 'signed-out' })
          return
        }
        if (active) {
          setAuth((previous) => previous.status === 'authorized' && previous.user.id === session.user.id
            ? previous
            : { status: 'loading' })
        }
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (!active || request !== sequence) return
        if (userError || !userData.user) {
          setAuth({ status: 'error' })
          return
        }
        const { data, error } = await supabase
          .from('admin_profiles')
          .select('id, display_name, role, is_active')
          .eq('id', userData.user.id)
          .maybeSingle()
        if (!active || request !== sequence) return
        if (error) {
          setAuth({ status: 'error' })
        } else if (!isAdminProfile(data) || data.id !== userData.user.id) {
          setAuth({ status: 'denied', user: userData.user })
        } else {
          setAuth({ status: 'authorized', user: userData.user, profile: data })
        }
      } catch {
        if (active && request === sequence) setAuth({ status: 'error' })
      }
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryReady(true)
      if (event === 'SIGNED_OUT') setRecoveryReady(false)
      window.setTimeout(() => {
        if (active) void resolve(session)
      }, 0)
    })

    const onFocus = () => {
      void supabase.auth.getSession()
        .then(({ data, error }) => {
          if (!active) return
          if (error) setAuth({ status: 'error' })
          else void resolve(data.session)
        })
        .catch(() => {
          if (active) setAuth({ status: 'error' })
        })
    }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      sequence++
      subscription.subscription.unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [revision])

  useEffect(() => {
    if (path === '/admin/forgot-password' || path === '/admin/reset-password') return
    if (auth.status === 'signed-out' && path !== '/admin/login') {
      window.location.replace('/admin/login')
    } else if (auth.status === 'authorized' && path === '/admin/login') {
      window.location.replace('/admin')
    }
  }, [auth.status, path])

  if (path === '/admin/forgot-password') return <ForgotPassword />
  if (path === '/admin/reset-password') {
    return <ResetPassword recoveryReady={recoveryReady} />
  }
  if (auth.status === 'loading') return <Shell><p role="status">Memeriksa sesi admin...</p></Shell>
  if (auth.status === 'error') {
    return <Shell>
      <h1 className="text-2xl font-bold">Tidak dapat memeriksa akses</h1>
      <p className="mt-3 text-sm text-slate-600">Periksa koneksi Anda dan coba lagi. Akses admin tidak diberikan sampai verifikasi berhasil.</p>
      <button className={`${buttonClass} mt-6`} onClick={() => setRevision((n) => n + 1)}>Coba lagi</button>
    </Shell>
  }
  if (auth.status === 'denied') return <AccessDenied />
  if (auth.status === 'signed-out') return <Login />
  if (path !== '/admin' && path !== '/admin/login' && path !== '/admin/media' && path !== '/admin/products' && path !== '/admin/blog' && path !== '/admin/inquiry' && path !== '/admin/settings') {
    return <Shell>
      <h1 className="text-2xl font-bold">Halaman admin tidak tersedia</h1>
      <a className="mt-4 inline-block text-sm font-bold text-sky-700" href="/admin">Kembali ke admin</a>
    </Shell>
  }
  if (path === '/admin/inquiry' && auth.profile.role !== 'super_admin') {
    return <Shell>
      <h1 className="text-2xl font-bold">Akses inquiry dibatasi</h1>
      <p className="mt-3 text-sm text-slate-600">Hanya super admin yang dapat membaca dan mengelola data inquiry.</p>
      <a className="mt-4 inline-block text-sm font-bold text-sky-700" href="/admin">Kembali ke dashboard</a>
    </Shell>
  }
  if (path === '/admin/settings' && auth.profile.role !== 'super_admin') {
    return <Shell>
      <h1 className="text-2xl font-bold">Akses pengaturan dibatasi</h1>
      <p className="mt-3 text-sm text-slate-600">Hanya super admin yang dapat mengubah pengaturan website.</p>
      <a className="mt-4 inline-block text-sm font-bold text-sky-700" href="/admin">Kembali ke dashboard</a>
    </Shell>
  }
  return <AdminDashboard page={path === '/admin/media' ? 'media' : path === '/admin/products' ? 'products' : path === '/admin/blog' ? 'blog' : path === '/admin/inquiry' ? 'inquiry' : path === '/admin/settings' ? 'settings' : 'dashboard'} user={auth.user} profile={auth.profile} onSignOut={async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f9fb] px-4 py-12">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <a href="/" className="mb-8 inline-flex items-center gap-3 text-[#0b192c]">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0b192c] text-sm font-bold text-white">SS</span>
        <span className="font-bold">Seraya Semesta</span>
      </a>
      {children}
    </div>
  </main>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (loginError) setError('Email atau password tidak sesuai, atau layanan tidak dapat dihubungi.')
    } catch {
      setError('Tidak dapat terhubung. Periksa koneksi dan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <Shell>
    <h1 className="text-2xl font-bold">Admin Login</h1>
    <p className="mt-2 text-sm text-slate-600">Masuk untuk mengelola website Seraya Semesta.</p>
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">Email
        <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Password
        <input className={inputClass} type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <div className="flex items-center justify-between gap-4 text-sm">
        <button type="button" className="text-slate-600" onClick={() => setVisible(!visible)}>{visible ? 'Sembunyikan' : 'Tampilkan'} password</button>
        <a className="font-medium text-sky-700" href="/admin/forgot-password">Lupa password?</a>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className={buttonClass} disabled={busy}>{busy ? 'Sedang masuk...' : 'Masuk'}</button>
    </form>
  </Shell>
}

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      })
      if (resetError) setError('Permintaan tidak dapat diproses. Silakan coba lagi.')
      else setMessage('Jika email terdaftar, instruksi reset password akan dikirim.')
    } catch {
      setError('Tidak dapat terhubung. Periksa koneksi dan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <Shell>
    <h1 className="text-2xl font-bold">Lupa password?</h1>
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">Email
        <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className={buttonClass} disabled={busy}>{busy ? 'Mengirim...' : 'Kirim Link Reset'}</button>
    </form>
    <a className="mt-5 inline-block text-sm font-medium text-sky-700" href="/admin/login">Kembali ke login</a>
  </Shell>
}

function ResetPassword({ recoveryReady }: { recoveryReady: boolean }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('Konfirmasi password tidak cocok.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) setError('Password tidak dapat diperbarui. Periksa kebijakan password atau minta link reset baru.')
      else setMessage('Password berhasil diperbarui. Anda dapat kembali ke halaman admin.')
    } catch {
      setError('Tidak dapat terhubung. Periksa koneksi dan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <Shell>
    <h1 className="text-2xl font-bold">Reset password</h1>
    {!recoveryReady && !message
      ? <p className="mt-4 text-sm text-slate-600">Link reset tidak valid, kedaluwarsa, atau sedang diproses. Jika tidak terbuka, minta link baru.</p>
      : message
        ? <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>
        : <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">Password baru
            <input className={inputClass} type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Konfirmasi password
            <input className={inputClass} type="password" autoComplete="new-password" required minLength={6} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className={buttonClass} disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan Password Baru'}</button>
        </form>}
    <a className="mt-5 inline-block text-sm font-medium text-sky-700" href={message ? '/admin' : '/admin/forgot-password'}>{message ? 'Kembali ke admin' : 'Minta link reset baru'}</a>
  </Shell>
}

function SignOutButton() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) setError('Tidak dapat keluar. Silakan coba lagi.')
    } catch {
      setError('Tidak dapat keluar. Periksa koneksi dan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mt-6">
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    <button className={buttonClass} onClick={signOut} disabled={busy}>{busy ? 'Keluar...' : 'Keluar'}</button>
  </div>
}

function AccessDenied() {
  return <Shell>
    <h1 className="text-2xl font-bold">Akses admin tidak tersedia</h1>
    <p className="mt-3 text-sm text-slate-600">Akun Anda tidak memiliki profil admin aktif. Hubungi pengelola untuk bantuan.</p>
    <SignOutButton />
  </Shell>
}
