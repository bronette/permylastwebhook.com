# Public landing site

A self-contained static site for the DevOps Connector. No build step.

```
site/
├── index.html            # landing page
├── styles.css            # shared styles (light + dark via prefers-color-scheme)
├── logo.svg              # header brand mark
├── favicon.svg
├── screenshot-admin.svg  # placeholder — replace with a real screenshot
├── privacy/index.html    # rendered from docs/legal/privacy.md
└── terms/index.html      # rendered from docs/legal/terms.md
```

## Filling in placeholders

Both the HTML pages and the markdown sources contain `{{TOKENS}}` you need to
replace before publishing. Fill in `site/config.json` and run:

```powershell
node ./scripts/fill-site-placeholders.mjs
```

The script walks `site/` and `docs/legal/`, replaces every `{{KEY}}` with the
matching value from `config.json`, and writes the result to a sibling
`site-dist/` directory (the source files are not modified). It fails loudly if
any placeholder is left unmatched, so you can't ship a half-templated page.

`site/config.example.json` lists every token the templates use, with example
values.

## Replacing the admin UI screenshot

`screenshot-admin.svg` is a placeholder. Replace it with a 1366×768 PNG (or
keep it as SVG):

1. Sign in to the admin UI at `https://<your-host>/api/ui/`.
2. Create one or two example subscriptions.
3. Take a clean screenshot at 1366×768.
4. Save it as `site/screenshot-admin.png` and change the `<img src=...>` in
   `index.html` accordingly.

## Hosting

Several options, all with no infrastructure beyond the file you push:

- **GitHub Pages** — push to a `gh-pages` branch (or set Pages source to a
  folder on `main`). Free, HTTPS included, custom domain supported via a
  `CNAME` file.
- **Cloudflare Pages** — connect the repo, point at the build output folder.
  Free tier covers low-traffic landing pages.
- **Azure Static Web Apps** — if you'd rather keep everything in Azure
  alongside the Function App. The free tier is enough.
- **Anywhere with a static-file server** — `npx serve site-dist` works for
  local preview.

## Local preview

```powershell
cd site
npx serve .
# or open index.html in a browser
```

The page works directly from disk; no server required. The privacy and terms
links are relative paths (`privacy/`, `terms/`) so they resolve correctly
when served from a real HTTP host.
