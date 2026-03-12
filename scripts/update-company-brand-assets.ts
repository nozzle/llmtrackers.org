import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { parseCompanyYaml, stringifyCompanyYaml, type CompanyYamlValue } from "@llm-tracker/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const companiesDir = path.join(repoRoot, "data", "companies");
const assetsDir = path.join(repoRoot, "public", "company-assets");
const brandingFile = path.join(repoRoot, "src", "company-branding.ts");

interface DownloadResult {
  ext: string;
  contentType: string | null;
}

interface Reachability {
  live: boolean;
  url: string;
  html: string | null;
}

async function main() {
  const files = (await fs.readdir(companiesDir)).filter((name) => name.endsWith(".yaml")).sort();

  await fs.mkdir(assetsDir, { recursive: true });

  for (const file of files) {
    const companyPath = path.join(companiesDir, file);
    const company = parseCompanyYaml(await fs.readFile(companyPath, "utf8")).company;

    const reachability = await getReachability(company.website);
    company.defunct = !reachability.live;

    const faviconPath = await ensureFavicon(company, reachability);
    const logoPath = await ensureLogo(company, reachability, faviconPath);

    await fs.writeFile(companyPath, stringifyCompanyYaml(company));

    console.log(
      `${company.slug}: live=${String(reachability.live)} logo=${path.basename(logoPath)} favicon=${path.basename(faviconPath)}`,
    );
  }

  await fs.writeFile(brandingFile, await buildBrandingFile());
}

async function getReachability(url: string): Promise<Reachability> {
  const attempts = [url, normalizeOrigin(url)];

  for (const attempt of attempts) {
    if (!attempt) continue;
    try {
      const response = await fetchWithTimeout(attempt);
      if (response.status >= 500 || response.status === 404) continue;
      const html = response.ok || response.status === 403 ? await response.text() : null;
      return { live: true, url: attempt, html };
    } catch {
      continue;
    }
  }

  return { live: false, url, html: null };
}

async function ensureFavicon(
  company: CompanyYamlValue,
  reachability: Reachability,
): Promise<string> {
  const existing = await findExistingAsset(company.slug, "favicon");
  if (existing) return existing;

  const targetBase = path.join(assetsDir, `${company.slug}-favicon`);

  if (reachability.live) {
    const iconUrl =
      extractFaviconUrl(reachability.html, reachability.url) ??
      fallbackFaviconUrl(company.website, 64);
    try {
      const result = await downloadAsset(iconUrl, targetBase);
      return `${targetBase}.${result.ext}`;
    } catch {
      // fall through to generated placeholder
    }
  }

  const svgPath = `${targetBase}.svg`;
  await fs.writeFile(svgPath, makeMonogramSvg(company.name, 64));
  return svgPath;
}

async function ensureLogo(
  company: CompanyYamlValue,
  reachability: Reachability,
  _faviconPath: string,
): Promise<string> {
  const existing = await findExistingAsset(company.slug, "logo");
  if (existing) return existing;

  const targetBase = path.join(assetsDir, `${company.slug}-logo`);

  if (reachability.live) {
    const logoUrl = extractLogoUrl(reachability.html, reachability.url);
    if (logoUrl) {
      try {
        const result = await downloadAsset(logoUrl, targetBase);
        return `${targetBase}.${result.ext}`;
      } catch {
        // ignore and use fallback below
      }
    }

    try {
      const result = await downloadAsset(fallbackFaviconUrl(company.website, 256), targetBase);
      return `${targetBase}.${result.ext}`;
    } catch {
      // ignore and use generated fallback
    }
  }

  const svgPath = `${targetBase}.svg`;
  await fs.writeFile(svgPath, makeMonogramSvg(company.name, 256));
  return svgPath;
}

async function downloadAsset(url: string, targetBase: string): Promise<DownloadResult> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  const contentType = response.headers.get("content-type");
  const ext = inferExtension(url, contentType);
  const outputPath = `${targetBase}.${ext}`;
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  return { ext, contentType };
}

async function buildBrandingFile(): Promise<string> {
  const companies = (await fs.readdir(companiesDir))
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  const entries: string[] = [];

  for (const file of companies) {
    const slug = file.replace(/\.yaml$/, "");
    const logo = await findExistingAsset(slug, "logo");
    const favicon = await findExistingAsset(slug, "favicon");
    if (!logo && !favicon) continue;

    const lines = [`  ${JSON.stringify(slug)}: {`];
    if (logo) lines.push(`    logo: ${JSON.stringify(toPublicPath(logo))},`);
    if (favicon) lines.push(`    favicon: ${JSON.stringify(toPublicPath(favicon))},`);
    lines.push("  },");
    entries.push(lines.join("\n"));
  }

  return `export interface CompanyBranding {
  logo?: string;
  favicon?: string;
}

export const COMPANY_BRANDING: Record<string, CompanyBranding> = {
${entries.join("\n")}
};

export function getCompanyBranding(slug: string): CompanyBranding {
  return COMPANY_BRANDING[slug] ?? {};
}
`;
}

async function findExistingAsset(slug: string, kind: "logo" | "favicon"): Promise<string | null> {
  const files = await fs.readdir(assetsDir);
  const prefix = `${slug}-${kind}.`;
  const match = files.find((name) => name.startsWith(prefix));
  return match ? path.join(assetsDir, match) : null;
}

function extractFaviconUrl(html: string | null, pageUrl: string): string | null {
  if (!html) return null;
  const linkRegex =
    /<link\b[^>]*rel=["'][^"']*(icon|shortcut icon|apple-touch-icon)[^"']*["'][^>]*>/gi;
  const matches = html.match(linkRegex) ?? [];
  for (const match of matches) {
    const href = getAttr(match, "href");
    if (href) return resolveUrl(href, pageUrl);
  }
  return null;
}

function extractLogoUrl(html: string | null, pageUrl: string): string | null {
  if (!html) return null;
  const imgRegex = /<img\b[^>]*>/gi;
  const candidates: { url: string; score: number }[] = [];

  for (const tag of html.match(imgRegex) ?? []) {
    const src = getAttr(tag, "src");
    if (!src || src.startsWith("data:")) continue;
    const haystack =
      `${src} ${getAttr(tag, "alt") ?? ""} ${getAttr(tag, "class") ?? ""} ${getAttr(tag, "id") ?? ""}`.toLowerCase();
    let score = 0;
    if (/logo|wordmark/.test(haystack)) score += 10;
    if (/navbar|nav|header|brand/.test(haystack)) score += 4;
    if (/icon|favicon|avatar|customer|partner|testimonial/.test(haystack)) score -= 8;
    candidates.push({ url: resolveUrl(src, pageUrl), score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
}

function getAttr(tag: string, name: string): string | null {
  const match = new RegExp(`${name}=["']([^"']+)["']`, "i").exec(tag);
  return match?.[1] ?? null;
}

function resolveUrl(value: string, pageUrl: string): string {
  return new URL(value, pageUrl).toString();
}

function normalizeOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

function fallbackFaviconUrl(website: string, size: number): string {
  const hostname = new URL(website).hostname;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
}

function inferExtension(url: string, contentType: string | null): string {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).replace(/^\./, "").toLowerCase();
  if (ext) return ext === "jpg" ? "jpg" : ext;
  if (contentType?.includes("svg")) return "svg";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("avif")) return "avif";
  if (contentType?.includes("icon")) return "ico";
  if (contentType?.includes("jpeg")) return "jpg";
  return "png";
}

function toPublicPath(filePath: string): string {
  return filePath.replace(path.join(repoRoot, "public"), "").replaceAll(path.sep, "/");
}

function makeMonogramSvg(name: string, size: number): string {
  const label = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  const fontSize = size * 0.38;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeXml(name)}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#111827"/><text x="50%" y="54%" fill="#f9fafb" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text></svg>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);
  try {
    return await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
