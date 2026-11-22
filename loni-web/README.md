# loni-web

The LONI marketing website (lonimum.com) and the partner-invite verify flow. Next.js 16 (App Router), React 19,
TypeScript (strict), Tailwind CSS v4, framer-motion.

```bash
npm install
npm run dev        # http://localhost:3000 (the repo's .claude/launch.json runs it on 5173)
npm run build && npm start
npm run lint
```

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata, sitemap and JSON-LD. Defaults to `https://lonimum.com`. |
| `NEXT_PUBLIC_API_BASE_URL` | Backend origin for `/verify` (`/api/v1/...`). The old `VITE_API_BASE_URL` still works as a fallback. |

## Routes

| Path | Page | Indexed | Rendering |
| --- | --- | --- | --- |
| `/` | Home | yes | static |
| `/about` | About Us | yes | static |
| `/partners` | For Partners & Family | yes | static |
| `/nurses` | For Nurses | yes | static |
| `/drivers` | For Drivers | yes | static |
| `/privacy`, `/terms`, `/disclaimer` | Legal | yes | static |
| `/verify?email=` | Partner account setup (setup → OTP → success), calls `/auth/setup-partner`, `/auth/verify-partner-setup`, `/auth/resend-otp` | **no** (`noindex` meta + `X-Robots-Tag`, disallowed in robots.txt) | static shell, form renders on the client |

## Layout

- `src/app/` — routes, `layout.tsx` (fonts, site-wide metadata and JSON-LD), `sitemap.ts`, `robots.ts`,
  `manifest.ts`, `not-found.tsx`, `error.tsx`, `opengraph-image.tsx` per page.
- `src/views/` — page bodies (server components that compose sections inside `PageShell`).
- `src/components/` — sections and UI. Animated/interactive pieces are client components (`'use client'`).
- `src/lib/seo/` — **`routes.ts` is the single source of truth** for each page's title, description,
  keywords, `lastModified`, sitemap priority and social headline. Update `lastModified` when a page's content changes.
- `src/config/site.ts` — brand info and CTA links. Store and social links are still placeholders; the
  `MobileApplication` schema and `sameAs` profiles are emitted automatically once they hold real URLs.

## SEO notes

- Every indexable page has a unique title, description, canonical URL, Open Graph and X card, one `<h1>`,
  and its content in the server HTML.
- JSON-LD: `Organization` + `WebSite` site-wide; `WebPage`/`AboutPage` + `BreadcrumbList` per page. Never add
  ratings, prices or store listings that aren't real.
- Images: imported from `src/assets` (content-hashed, long-cached). The home hero and the large LoniBot banner use
  `next/image`; the rest are pre-sized WebP/SVG rendered with `<img>` to keep the pixel-precise layouts.
