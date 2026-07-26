# Public landing site

Static marketing + documentation site for **Per My Last Webhook**. Built from templated
HTML in `site/` and published from `site-dist/`.

```
site/
├── index.html            # landing page
├── styles.css            # shared styles (90s theme)
├── docs/                 # documentation pages (+ docs.css)
├── integrations/         # GENERATED SEO pages (edit scripts/gen-integration-pages.mjs)
├── validator/            # MessageCard migration tool
├── privacy/ terms/       # legal pages (templated from config.json)
├── config.json           # public site values — tracked, no secrets
└── *.png *.svg           # logo, favicon, og-image
```

## Build

Fill in `site/config.json` (copy from `config.example.json`), then:

```bash
npm run site:build
cd site-dist && npx serve .
```

`site:build` regenerates integration pages + sitemap, resolves `{{TOKEN}}` placeholders
into `site-dist/`, and fails if any token is unmatched.

## Deploy

See the root [README.md](../README.md). Deploy refuses to upload if `REPLACE-ME`
placeholders remain in `site-dist/` (use `--dry-run` to preview anyway).

## Replacing the admin UI screenshot

`screenshot-admin.svg` is a placeholder. Replace with a 1366×768 PNG and update
the `<img src=...>` in `index.html`.
