import { createContext, useContext } from 'react'
import { supabase } from './supabase'

export type WebsiteSettings = {
  company_display_name: string
  logo_path: string | null
  logo_alt: string
  whatsapp_number: string
  sales_email: string
  general_email: string
  copyright_text: string
  default_seo_title: string
  default_seo_description: string
  default_og_image_path: string | null
  default_og_image_alt: string
}

export const fallbackWebsiteSettings: WebsiteSettings = {
  company_display_name: 'PT. Seraya Semesta Indonesia',
  logo_path: null,
  logo_alt: '',
  whatsapp_number: '628111611177',
  sales_email: 'sales@serayasemesta.com',
  general_email: 'info@serayasemesta.com',
  copyright_text: '© 2026 PT. Seraya Semesta Indonesia',
  default_seo_title: '',
  default_seo_description: '',
  default_og_image_path: null,
  default_og_image_alt: '',
}

export const WebsiteSettingsContext = createContext<WebsiteSettings>(fallbackWebsiteSettings)

export function useWebsiteSettings() {
  return useContext(WebsiteSettingsContext)
}

export function websiteImageUrl(path: string | null) {
  return path ? supabase.storage.from('website-media').getPublicUrl(path).data.publicUrl : null
}

export function websiteWhatsAppUrl(settings: WebsiteSettings, message?: string) {
  const number = settings.whatsapp_number.replace(/\D/g, '')
  if (!number) return null
  const query = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${number}${query}`
}
