# ZHUANG.WENDI Portfolio

Photography portfolio site built with Astro, deployed on Vercel.

Based on [leecheong.com](https://github.com/hatokkari/leecheong.com) (custom design, no theme).

## Deploy to Vercel

1. Push this repo to your GitHub account (e.g. `zhuang-wendi-site`).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel will auto-detect Astro. Click **Deploy**.

## CMS Setup (Sveltia CMS)

The `/admin` panel uses Sveltia CMS with GitHub OAuth. To enable it:

1. Deploy your own OAuth proxy: fork [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) and deploy to Cloudflare Workers.
2. Add your domain (e.g. `zhuangwendi.vercel.app`) to the worker's allowed domains.
3. Update `public/admin/config.yml`:
   - `backend.repo`: your GitHub username / repo name
   - `backend.base_url`: your Cloudflare Worker URL
4. Update `src/layouts/BaseLayout.astro` and `astro.config.mjs` with your actual domain.

## Adding Content

After CMS setup, go to `/admin` and log in with GitHub. You can:

- **Photos** — create photo projects with multiple images
- **Books** — create book/publication entries with buy links
- **Site info** — edit your bio, CV, email, and Instagram

Images uploaded via CMS are automatically converted to WebP (max 2400px, quality 85).

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:4321. For local CMS testing, the config uses `local_backend: true` (no GitHub login needed).
