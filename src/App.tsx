import { lazy, Suspense } from 'react'
import { WebsiteSettingsProvider } from './shared/WebsiteSettingsProvider'

const AdminAuth = lazy(() => import('./admin/AdminAuth').then((module) => ({ default: module.AdminAuth })))
const HomePage = lazy(() => import('./public/HomePage'))
const ProductCatalog = lazy(() => import('./public/ProductCatalog').then((module) => ({ default: module.ProductCatalog })))
const Blog = lazy(() => import('./public/Blog').then((module) => ({ default: module.Blog })))
const InquiryForm = lazy(() => import('./public/InquiryForm').then((module) => ({ default: module.InquiryForm })))

export default function App() {
  const productPath = window.location.pathname.match(/^\/produk(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?\/?$/)
  const blogPath = window.location.pathname.match(/^\/blog(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?\/?$/)
  const isAdmin = /^\/admin(?:\/|$)/.test(window.location.pathname)
  const publicPage = productPath ? <ProductCatalog slug={productPath[1]} />
    : blogPath ? <Blog slug={blogPath[1]} />
      : window.location.pathname.replace(/\/+$/, '') === '/inquiry' ? <InquiryForm /> : <HomePage />
  return <Suspense fallback={<p role="status">Memuat halaman...</p>}>
    {isAdmin ? <AdminAuth /> : <WebsiteSettingsProvider>{publicPage}</WebsiteSettingsProvider>}
  </Suspense>
}
