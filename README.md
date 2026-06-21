# permylastwebhook.com

The marketing + setup site for **Per My Last Webhook** — the DevOps Connector for
Microsoft Teams. Static site (landing page + privacy + terms), modern-retro 90s
theme matching the company logo. Hosted on cPanel (Namecheap) at
https://permylastwebhook.com.

> The connector application itself lives in a separate repo
> (`bronette/permylastwebhook`). This repo is just the public website.

## Layout

```
site/                     source (edit here)
  index.html              landing page
  styles.css              the 90s theme
  privacy/ terms/         legal pages (templated from config.json)
  config.json             site values (company name, domain, emails) — public, tracked
  config.example.json     template
  *.png *.svg             logo / favicon / og-image (from website-assets/)
scripts/
  fill-site-placeholders.mjs   {{TOKEN}} -> site-dist/
  deploy_site.py               SFTP upload site-dist/ -> cPanel public_html
website-assets/           original 1254px company logo (brand source of truth)
```

## Build

```sh
npm run site:build      # resolves {{TOKEN}}s from site/config.json into site-dist/
```

`site-dist/` is the publishable output (gitignored). To preview:
`cd site-dist && npx serve .`

## Deploy (cPanel over SFTP)

Credentials live in a **gitignored `.env`** (parsed from the Namecheap hosting
welcome email): `CPANEL_HOST/USER/PASSWORD/SFTP_PORT/REMOTE_DIR`. One-time:

```sh
python3 -m venv .deploy-venv && .deploy-venv/bin/pip install paramiko
```

Then, after any edit:

```sh
npm run site:build && npm run deploy
```

`deploy` mirrors `site-dist/` to `public_html/` over SFTP (port 21098).

## Notes

- **Never put secrets in `config.json`** — it's tracked. Secrets go in `.env`.
- SSL is Namecheap AutoSSL; DNS points the domain at the cPanel host.
