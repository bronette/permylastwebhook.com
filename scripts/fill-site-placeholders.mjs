#!/usr/bin/env node
/**
 * Resolve `{{TOKEN}}` placeholders in site/ using site/config.json, and write a
 * publishable copy to site-dist/.
 *
 * The source files are not modified, so the templated tokens stay editable in
 * version control. site-dist/ is what you publish to GitHub Pages / Cloudflare /
 * wherever — gitignore it.
 *
 * The markdown copies under docs/legal/ are intentionally NOT processed here —
 * they live next to the code as a reviewable text source for legal counsel, not
 * as a hostable artefact. The HTML versions under site/privacy/ and site/terms/
 * are what gets published.
 *
 * Exits non-zero if any placeholder is left unmatched or config.json is missing,
 * so it's safe to wire into release CI.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, cpSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = dirname(here);
const siteDir = join(repo, "site");
const outDir = join(repo, "site-dist");
const configPath = join(siteDir, "config.json");

let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch (err) {
  console.error(`Cannot read ${configPath}: ${err.message}`);
  console.error(`Copy site/config.example.json to site/config.json and fill it in.`);
  process.exit(1);
}

// Templatable extensions. Everything else (PNG, SVG with no tokens, etc.) is
// copied byte-for-byte. We include .svg because the SVG hero diagram may carry
// a token in future and we don't want to surprise the next maintainer.
const TEMPLATE_EXTENSIONS = new Set([".html", ".css", ".md", ".svg", ".json", ".txt"]);
const TOKEN_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function applyTemplate(content, sourceLabel, missing) {
  return content.replace(TOKEN_RE, (match, key) => {
    if (!(key in config)) {
      missing.push(`${sourceLabel}: {{${key}}}`);
      return match;
    }
    return String(config[key]);
  });
}

function ext(path) {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}

// Clean output
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const missing = [];
let templated = 0;
let copied = 0;

function processTree(srcRoot, destRoot, label) {
  for (const src of walk(srcRoot)) {
    const rel = relative(srcRoot, src);
    // Skip the config files themselves
    if (rel === "config.json" || rel === "config.example.json") continue;
    if (rel === "README.md") continue;
    const dest = join(destRoot, rel);
    mkdirSync(dirname(dest), { recursive: true });

    if (TEMPLATE_EXTENSIONS.has(ext(src))) {
      const content = readFileSync(src, "utf8");
      const out = applyTemplate(content, `${label}/${rel.replaceAll("\\", "/")}`, missing);
      writeFileSync(dest, out, "utf8");
      templated++;
    } else {
      cpSync(src, dest);
      copied++;
    }
  }
}

processTree(siteDir, outDir, "site");

if (missing.length > 0) {
  // Group by token so the message reports each unique missing key once with the
  // files that reference it.
  const byToken = new Map();
  for (const m of missing) {
    const [file, token] = m.split(": ");
    if (!byToken.has(token)) byToken.set(token, new Set());
    byToken.get(token).add(file);
  }
  console.error(`Unfilled placeholders (${byToken.size} unique):`);
  for (const [token, files] of byToken) {
    console.error(`  ${token}  used in ${[...files].join(", ")}`);
  }
  console.error(`\nAdd the missing keys to site/config.json and re-run.`);
  process.exit(1);
}

console.log(`Wrote ${templated} templated + ${copied} copied files to site-dist/`);
console.log(`Preview: cd site-dist && npx serve .`);
