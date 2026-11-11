import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import { WebsiteSettingsContext, fallbackWebsiteSettings } from './websiteSettings'
import type { WebsiteSettings } from './websiteSettings'

function isWebsiteSettings(value: unknown): value is WebsiteSettings {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.company_display_name === 'string'
    && (typeof row.logo_path === 'string' || row.logo_path === null)
    && typeof row.logo_alt === 'string'
    && typeof row.whatsapp_number === 'string'
    && typeof row.sales_email === 'string'
    && typeof row.general_email === 'string'
    && typeof row.copyright_text === 'string'
    && typeof row.default_seo_title === 'string'
    && typeof row.default_seo_description === 'string'
    && (typeof row.default_og_image_path === 'string' || row.default_og_image_path === null)
    && typeof row.default_og_image_alt === 'string'
}

export function WebsiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(fallbackWebsiteSettings)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data, error } = await supabase.rpc('public_website_settings')
        if (error || !isWebsiteSettings(data)) throw new Error('public settings unavailable')
        if (active) setSettings({ ...fallbackWebsiteSettings, ...data })
      } catch {
        if (active) setSettings(fallbackWebsiteSettings)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  return <WebsiteSettingsContext.Provider value={settings}>{children}</WebsiteSettingsContext.Provider>
}
