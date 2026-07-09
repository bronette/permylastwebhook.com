#!/usr/bin/env node
/**
 * Generate site/sitemap.xml + site/robots.txt by walking site/ for .html pages.
 * Auto-includes anything added later (docs, integrations). Run as part of site:build.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..", "site");
const ORIGIN = "https://permylastwebhook.com";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function toUrl(absPath) {
  let rel = relative(siteDir, absPath).replaceAll("\\", "/");
  // index.html at any level maps to its directory URL with a trailing slash.
  if (rel === "index.html") return `${ORIGIN}/`;
  if (rel.endsWith("/index.html")) return `${ORIGIN}/${rel.slice(0, -"index.html".length)}`;
  return `${ORIGIN}/${rel}`;
}

// Rough priority: home > integrations/docs landings > deep pages.
function priority(url) {
  if (url === `${ORIGIN}/`) return "1.0";
  if (/\/(integrations|docs)\/$/.test(url)) return "0.9";
  if (/\/integrations\//.test(url)) return "0.8";
  if (/\/docs\//.test(url)) return "0.7";
  return "0.5";
}

const urls = [...new Set(walk(siteDir).map(toUrl))].sort();
const lastmod = new Date().toISOString().slice(0, 10);

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${lastmod}</lastmod><priority>${priority(u)}</priority></url>`)
    .join("\n") +
  `\n</urlset>\n`;

writeFileSync(join(siteDir, "sitemap.xml"), xml);
writeFileSync(
  join(siteDir, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
);

console.log(`✓ sitemap.xml (${urls.length} URLs) + robots.txt written to site/`);
