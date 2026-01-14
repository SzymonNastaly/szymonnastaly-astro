# CLAUDE.md

Personal blog built with Astro 5 + Tailwind CSS v4, using local Markdown files with Content Collections.

## Commands

```bash
npm run dev      # Dev server at localhost:4321
npm run build    # Build to ./dist/
npm run preview  # Preview production build

# Deployment
npm run build && npx wrangler deploy   # Deploy to Cloudflare Workers
```

## Architecture

**Data flow**: Markdown files → Content Collections → Astro pages → Static HTML

### Content Structure

```
src/content/
├── posts/           # Blog posts (one folder per post)
│   └── my-post/
│       ├── index.md # Post content + frontmatter
│       └── *.jpg    # Co-located images
└── pages/           # Static pages (now, home)
    └── now.md
```

### Key Files

- `src/content.config.ts` - Content collection schema (Zod validation)
- `src/lib/utils.ts` - Utility functions (formatDate)
- `src/styles/global.css` - Tailwind theme (colors, fonts) and `prose-warm` typography class
- `src/layouts/Layout.astro` - Base layout with header navigation
- `src/pages/posts/[slug].astro` - Dynamic post routes via `getStaticPaths()`
- `wrangler.jsonc` - Cloudflare Workers deployment config

### Post Frontmatter

```yaml
title: "Post Title"
description: "Brief description for listings"
date: 2024-01-15
modified: 2024-01-20        # optional
featured: ./featured.jpg    # optional, co-located image
featuredAlt: "Alt text"     # optional
draft: false                # optional, hides from listings
```

### Styling

- Tailwind v4 with CSS-based config (`@theme` directive in global.css)
- Warm color palette: ivory background, terracotta accents, charcoal text
- Markdown content uses the `prose-warm` class for typography

### Images

- Uses Astro's `<Image>` component with sharp for build-time optimization
- Images auto-converted to WebP format during build
- Co-locate images with posts in their folder, reference as `./image.jpg`

## Deployment

Hosted on **Cloudflare Workers** with static assets. Config in `wrangler.jsonc`.

- Production URL: https://szymonnastaly-astro.koliber.workers.dev
- Custom domain can be added via Cloudflare Dashboard → Workers → Settings → Domains
