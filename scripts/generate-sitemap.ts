/**
 * Post-build script: generates sitemap.xml and robots.txt from prerendered HTML pages.
 * Run after `vite build` to produce dist/client metadata files.
 */

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DEFAULT_SITE_URL = "https://llmtrackers.org";
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/prefer-nullish-coalescing -- env var types are auto-generated and don't reflect runtime nullability */
const CANONICAL_SITE_URL = normalizeSiteUrl(
  (process.env.VITE_SITE_URL as string | undefined) ||
    (process.env.SITE_URL as string | undefined) ||
    DEFAULT_SITE_URL,
);
/* eslint-enable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/prefer-nullish-coalescing */
const DIST_DIR = join(import.meta.dirname, "../dist/client");

function findHtmlFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findHtmlFiles(full, files);
    } else if (entry === "index.html") {
      files.push(full);
    }
  }
  return files;
}

const htmlFiles = findHtmlFiles(DIST_DIR);
const today = new Date().toISOString().split("T")[0];

const urls = htmlFiles.map((file) => {
  const rel = relative(DIST_DIR, file)
    .replace(/\/index\.html$/, "")
    .replace(/^index\.html$/, "");
  const path = rel ? `/${rel}` : "/";

  // Priority: home > company pages > other
  let priority = "0.5";
  let changefreq = "monthly";
  if (path === "/") {
    priority = "1.0";
    changefreq = "weekly";
  } else if (path.startsWith("/companies/")) {
    priority = "0.8";
    changefreq = "weekly";
  }

  return `  <url>
    <loc>${CANONICAL_SITE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${CANONICAL_SITE_URL}/sitemap.xml
`;

writeFileSync(join(DIST_DIR, "sitemap.xml"), sitemap);
writeFileSync(join(DIST_DIR, "robots.txt"), robots);
console.log(`Generated sitemap.xml with ${urls.length} URLs`);

function normalizeSiteUrl(value: string): string {
  const normalized = value.startsWith("http") ? value : `https://${value}`;
  return normalized.replace(/\/+$/, "");
}
