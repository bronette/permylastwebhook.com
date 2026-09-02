#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "site-dist");
const failures = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function targetFor(page, href) {
  const withoutHash = href.split("#", 1)[0].split("?", 1)[0];
  if (!withoutHash) return page;
  if (withoutHash.startsWith("/")) {
    const path = join(root, withoutHash.slice(1));
    return extname(path) ? path : join(path, "index.html");
  }
  const path = normalize(join(dirname(page), withoutHash));
  return extname(path) ? path : join(path, "index.html");
}

if (!existsSync(root)) failures.push("site-dist does not exist; run site:build first");
else for (const page of walk(root).filter((path) => path.endsWith(".html"))) {
  const rel = relative(root, page);
  const html = readFileSync(page, "utf8");
  if (!/<title>[^<]+<\/title>/i.test(html)) failures.push(`${rel}: missing title`);
  if (!/<meta\s+name="description"\s+content="[^"]+"/i.test(html)) failures.push(`${rel}: missing meta description`);
  if (!/<h1(?:\s|>)/i.test(html)) failures.push(`${rel}: missing h1`);
  if (/\{\{[A-Z][A-Z0-9_]*\}\}|REPLACE-ME-[\w-]+/.test(html)) failures.push(`${rel}: unresolved placeholder`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  for (const id of new Set(ids)) if (ids.filter((value) => value === id).length > 1) failures.push(`${rel}: duplicate id #${id}`);

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) continue;
    const target = targetFor(page, href);
    if (!existsSync(target)) failures.push(`${rel}: broken link ${href}`);
    const hash = href.includes("#") ? href.slice(href.indexOf("#") + 1) : "";
    if (hash && existsSync(target) && target.endsWith(".html")) {
      const targetHtml = target === page ? html : readFileSync(target, "utf8");
      if (!new RegExp(`\\sid=["']${hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(targetHtml)) {
        failures.push(`${rel}: missing anchor ${href}`);
      }
    }
  }
}

if (failures.length) {
  console.error(`Site validation failed (${failures.length}):\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}
console.log("✓ site validation passed (HTML metadata, placeholders, links, anchors, IDs)");
