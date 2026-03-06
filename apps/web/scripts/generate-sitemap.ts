/**
 * Post-build script: generates sitemap.xml from prerendered HTML pages.
 * Run after `vite build` to produce dist/client/sitemap.xml.
 */

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SITE_URL = "https://llm-tracker.pages.dev";
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
  const rel = relative(DIST_DIR, file).replace(/\/index\.html$/, "").replace(/^index\.html$/, "");
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
    <loc>${SITE_URL}${path}</loc>
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

writeFileSync(join(DIST_DIR, "sitemap.xml"), sitemap);
console.log(`Generated sitemap.xml with ${urls.length} URLs`);
