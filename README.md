# React + TypeScript + Vite

## Application structure

The public website and CMS are one React application and share the same
Supabase project:

- `src/App.tsx`: routes `/admin` and `/admin/*` to the CMS; other paths retain
  the public website's current behavior.
- `src/public/`: landing page and its components.
- `src/admin/`: admin authentication and protected admin entry point.
- `src/shared/supabase.ts`: shared Supabase client using the publishable key.
- `supabase/migrations/`: versioned database migrations.

The frontend route boundary is not a security boundary: public data and admin
operations must be separately restricted by Supabase RLS and trusted backend
authorization.

## Admin authentication

The admin login is available at `/admin/login`; `/admin` and other admin paths
require a Supabase session and an active `admin_profiles` row. Supabase Auth
manages identities and sessions; authorization is enforced by database RLS,
not by the frontend route guard. The public homepage remains at `/`.

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the
untracked `.env`. Never expose a service-role key in the frontend.
The host must serve the SPA entry point for `/admin/*` paths. Add the deployed
`/admin/reset-password` URL and any approved development URL to the Supabase
Auth redirect allowlist before using password recovery. An expired or invalid
recovery link requires requesting a new link.

The versioned SQL migration is based on the approved Revision 4 design.
Production records `20261111053710_admin_auth_foundation` as applied through
Supabase MCP; do not run it again there. Its unchanged draft header is part of
the recorded SQL. It does not create an Auth user or bootstrap the first super
admin. Provisioning and bootstrapping require a separately authorized trusted
operator.

## Admin dashboard

The protected `/admin` dashboard shows counts and recent inquiries when the
corresponding modules are available. Navigation and quick actions for unfinished
modules are placeholders.

Inquiry data is available only to active `super_admin` accounts; the database
enforces this through row-level security. Dashboard totals reflect the rows
visible under those policies.

## Inquiry management

The `20261111113820_inquiry_management.sql` migration creates the inquiry
records, public submission RPC, and super-admin update RPC. Public clients can
submit a validated inquiry but cannot read or directly modify inquiry records.
Inquiry records store contact details, inquiry type, message, an optional
published product reference, follow-up status, internal notes, and timestamps.
The public `/inquiry` page submits the form through the RPC, with an optional
product selection prefilled from a product detail page. The `/admin/inquiry`
page is restricted to super admins and supports status filters, name search,
details, internal notes, and follow-up status updates. The dashboard links to
the inquiry page and continues to show inquiry totals and recent submissions.

## Website settings

The Website Settings implementation follows [PRD-15](https://github.com/Mhusnul/seraya-semesta/blob/PRD/Modules/CMS/WebsiteSettings/PRD-15_Website_Settings_V2.md)
from the `PRD` branch of the requirements repository (the PRD is marked draft,
pending client validation). The protected
`/admin/settings` page provides General, Contact, and SEO sections with a
single save action, validation, Media Library selection for the logo and
Open Graph image, and unsaved-change warnings. Access is limited to active
super admins, matching the current admin permission model.

The `20261111115820_website_settings.sql` migration seeds the confirmed company
name, normalized WhatsApp number, sales and general email addresses, and
copyright text. Public pages consume only the approved fields through the
`public_website_settings` RPC; if that read fails, they use the same approved
frontend fallbacks. Contact details and identity are shared with the header,
footer, homepage, and inquiry form. Page-specific product/article SEO takes
priority over default SEO. Media referenced as a logo or Open Graph image
cannot be deleted until its settings reference is removed.

## Media management

The protected `/admin/media` page manages website images. The accompanying
`20261111061026_media_management.sql` migration is applied to Production
through Supabase MCP; do not run it again there. Before applying it to another
environment, create a public `website-media` bucket using the Supabase
Storage dashboard or API with a 5,242,880-byte limit and exactly the
`image/jpeg`, `image/png`, and `image/webp` MIME types. Do not put private
files in this bucket.

Uploads use pending metadata records, and interrupted uploads or deletes
remain visible for recovery. Both active admin roles can manage media. Storage
enforces the configured size and declared MIME type; the browser additionally
checks extension and file signature, but a modified client can bypass that
signature check. Server-side content inspection is not implemented.

Product images reference media assets. Media used by a product cannot be
deleted; unused media can be deleted. Deletion is conservatively disabled if
other tables add media foreign keys before their reference checks are integrated.
The Blog migration extends this protection to article covers and inline images.
The library currently reports progress by file, not byte percentage.

## Product management

The protected `/admin/products` page manages product categories and products.
The migration `20261111062700_product_management.sql` was applied to
Production through Supabase MCP; do not apply it there again. It created four
initial categories and six draft products from PRD-11. Complete and verify
their descriptions and select a main image before publishing. Both active
admin roles may publish. Gallery order starts with the main image.

The `/produk` and `/produk/:slug` pages expose published products only via a
dedicated public RPC; direct table reads and writes remain restricted. The
homepage product section intentionally remains static per the approved choice,
so publishing or archiving a product does not update that section. Technical
specifications and curated related products are deferred until their
requirements and verified data are available. The Supabase security advisor
reports the public and authenticated `SECURITY DEFINER` RPCs because they are
intentionally callable; the write RPCs check active-admin authorization, and
the public RPC selects only published products.

## Blog management

The local Blog implementation provides `/admin/blog`, `/blog`, and
`/blog/:slug`. Its migration `20261111064938_blog_management.sql` was applied
to Production through Supabase MCP; do not apply it there again. The frontend
must also be deployed to the hosting environment for these pages to be live.

Both active admin roles can publish. Publication requires an active category,
nonempty article text and excerpt, and a ready cover image. Only one published
article may be featured. Four initial categories are created, without sample
articles. Published dates are preserved when an article is archived or
returned to draft and then republished; scheduled publishing is not supported.
Article content is stored as structured JSON, rendered without raw HTML, and
inline images reference the Media Library. The public listing is paginated on
the server and excludes draft, archived, future-dated, and inactive-category
articles. Product links are displayed only while the product is published in
an active category.

Article SEO title and description are set client-side; crawlers without
JavaScript may not see them. Inline image alt text and caption are chosen at
insertion time; select an image from the Media Library, enter its details,
then use the image button in the editor toolbar. Editing an existing image
requires reinserting it. The inline preview shows the current unsaved content
and does not publish or save it. The
homepage remains static.
The Supabase security advisor flags the intentionally callable public and
authenticated `SECURITY DEFINER` RPCs: the public functions only return
published content, while write functions check active-admin authorization.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
