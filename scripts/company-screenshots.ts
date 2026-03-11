import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { parseCompanyYaml, stringifyCompanyYaml, type CompanyYamlValue } from "@llm-tracker/shared";
import { extractPageContent } from "../src/server/browser/extract-page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const companiesDir = path.join(repoRoot, "data", "companies");
const publicAssetsDir = path.join(repoRoot, "public", "company-assets");
const tmpDir = path.join(repoRoot, "tmp", "company-screenshots");

const MAX_DISCOVERY_LINKS = 12;
const MAX_CANDIDATES_PER_PAGE = 200;
const MIN_DIMENSION = 320;
const MIN_AREA = 180_000;

type Command = "discover" | "review-discovered" | "ingest-discovered";
type SourceType = CompanyYamlValue["screenshotSources"][number]["type"];
type Screenshot = CompanyYamlValue["screenshots"][number];

interface PageSource {
  url: string;
  type: SourceType;
  label?: string;
}

interface DiscoveredCandidate {
  id: string;
  sourcePageUrl: string;
  sourceType: SourceType;
  sourceImageUrl: string;
  pageTitle: string | null;
  alt: string | null;
  contextHeading: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  score: number;
  tags: string[];
}

interface DiscoveryOutput {
  slug: string;
  discoveredAt: string;
  candidates: DiscoveredCandidate[];
  skippedPages: string[];
}

async function main() {
  const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
  const [command, slug, ...rest] = rawArgs as [
    Command | undefined,
    string | undefined,
    ...string[],
  ];

  if (
    command !== "discover" &&
    command !== "review-discovered" &&
    command !== "ingest-discovered"
  ) {
    printUsage();
    process.exit(1);
  }

  if (!slug) {
    printUsage();
    process.exit(1);
  }

  const options = parseOptions(rest);
  const companyPath = path.join(companiesDir, `${slug}.yaml`);

  if (!fs.existsSync(companyPath)) {
    throw new Error(`Company YAML not found: ${companyPath}`);
  }

  const company = readCompany(companyPath);

  if (command === "discover") {
    const output = await discoverCandidates(company, options.includeSameHostHelp === true);
    writeDiscoveryOutput(slug, output);
    printDiscoverySummary(output);
    return;
  }

  if (command === "review-discovered") {
    const discovery = readDiscoveryOutput(slug);
    printReviewTable(discovery, {
      limit: parsePositiveInteger(options.limit, 25),
      showAll: options.all === true,
    });
    return;
  }

  const selection = parseSelection(options.pick);
  if (selection.length === 0) {
    throw new Error("Provide --pick with one or more candidate ids or indexes.");
  }

  const discovery = readDiscoveryOutput(slug);
  const picked = resolvePickedCandidates(discovery, selection);
  const updated = await ingestCandidates(companyPath, company, picked, options.force === true);

  console.log(
    `Saved ${picked.length} screenshot${picked.length === 1 ? "" : "s"} for ${updated.name}.`,
  );
  for (const screenshot of picked) {
    console.log(`- ${screenshot.id}: ${screenshot.sourceImageUrl}`);
  }
}

function printUsage() {
  console.log("Usage:");
  console.log("  pnpm screenshots:discover -- <company-slug> [--include-same-host-help]");
  console.log("  pnpm screenshots:review -- <company-slug> [--limit 25] [--all]");
  console.log(
    "  pnpm screenshots:ingest -- <company-slug> --pick <id[,id...]|index[,index...]> [--force]",
  );
}

function parseOptions(args: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function parseSelection(value: string | boolean | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readCompany(companyPath: string): CompanyYamlValue {
  const yamlText = fs.readFileSync(companyPath, "utf8");
  return parseCompanyYaml(yamlText).company;
}

async function discoverCandidates(
  company: CompanyYamlValue,
  includeSameHostHelp: boolean,
): Promise<DiscoveryOutput> {
  const pageSources = collectPageSources(company);
  const queue = [...pageSources];
  const seenPages = new Set<string>();
  const skippedPages: string[] = [];
  const candidates: DiscoveredCandidate[] = [];
  let discoveredHelpPages = 0;

  while (queue.length > 0) {
    const source = queue.shift();
    if (!source || seenPages.has(source.url)) continue;
    seenPages.add(source.url);

    try {
      const html = await fetchHtml(source.url);
      const pageCandidates = extractCandidatesFromHtml(html, source);
      candidates.push(...pageCandidates);

      if (includeSameHostHelp && discoveredHelpPages < MAX_DISCOVERY_LINKS) {
        const linkedSources = discoverLinkedPageSources(html, source);
        for (const linkedSource of linkedSources) {
          if (seenPages.has(linkedSource.url)) continue;
          queue.push(linkedSource);
          discoveredHelpPages += 1;
          if (discoveredHelpPages >= MAX_DISCOVERY_LINKS) break;
        }
      }
    } catch (error) {
      skippedPages.push(`${source.url} (${formatError(error)})`);
    }
  }

  const deduped = dedupeCandidates(candidates)
    .sort((left, right) => right.score - left.score)
    .slice(0, 120);

  return {
    slug: company.slug,
    discoveredAt: new Date().toISOString(),
    candidates: deduped,
    skippedPages,
  };
}

function collectPageSources(company: CompanyYamlValue): PageSource[] {
  const sources = new Map<string, PageSource>();

  for (const source of company.screenshotSources) {
    sources.set(source.url, source);
  }

  if (sources.size === 0) {
    const defaults = [company.featuresUrl, company.pricingUrl, company.website]
      .filter((value): value is string => Boolean(value))
      .map((url, index) => ({
        url,
        type: index === 0 ? "marketing" : "other",
      })) satisfies PageSource[];
    for (const source of defaults) {
      sources.set(source.url, source);
    }
  }

  return [...sources.values()];
}

async function fetchHtml(url: string): Promise<string> {
  const extracted = await extractPageContent(url);
  if (extracted?.html) {
    return extracted.html;
  }

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function extractCandidatesFromHtml(html: string, source: PageSource): DiscoveredCandidate[] {
  const pageTitle = matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const baseUrl = new URL(source.url);
  const imageMatches = [...html.matchAll(/<img\b[^>]*>/gi)].slice(0, MAX_CANDIDATES_PER_PAGE);
  const candidates: DiscoveredCandidate[] = [];

  for (const match of imageMatches) {
    const tag = match[0];
    const src = pickImageSource(tag);
    if (!src) continue;

    const sourceImageUrl = toAbsoluteUrl(src, baseUrl);
    if (!sourceImageUrl) continue;
    if (!isLikelyAllowedImage(sourceImageUrl)) continue;

    const alt = decodeHtmlEntities(getAttribute(tag, "alt") ?? "").trim() || null;
    const width = toNullableNumber(getAttribute(tag, "width"));
    const height = toNullableNumber(getAttribute(tag, "height"));
    if (!passesDimensionFilter(width, height, sourceImageUrl)) continue;

    const filename = path.basename(new URL(sourceImageUrl).pathname).toLowerCase();
    const contextWindow = html.slice(
      Math.max(0, match.index - 800),
      Math.min(html.length, match.index + tag.length + 800),
    );
    const contextHeading = extractContextHeading(contextWindow);
    const caption = extractCaption(contextWindow);
    const tags = inferTags([alt, contextHeading, caption, filename].filter(Boolean).join(" "));
    const score = scoreCandidate({
      alt,
      contextHeading,
      caption,
      width,
      height,
      sourceImageUrl,
      filename,
      tags,
    });

    if (score < 1) continue;

    candidates.push({
      id: buildCandidateId(filename, alt, contextHeading, caption, candidates.length + 1),
      sourcePageUrl: source.url,
      sourceType: source.type,
      sourceImageUrl,
      pageTitle: pageTitle ? decodeHtmlEntities(stripTags(pageTitle)) : null,
      alt,
      contextHeading,
      caption,
      width,
      height,
      score,
      tags,
    });
  }
  return candidates.filter((candidate) => candidate.score >= 1);
}

function discoverLinkedPageSources(html: string, source: PageSource): PageSource[] {
  const baseUrl = new URL(source.url);
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)];
  const links = new Map<string, PageSource>();

  for (const match of matches) {
    const href = match[1];
    const absolute = toAbsoluteUrl(href, baseUrl);
    if (!absolute) continue;
    const url = new URL(absolute);
    if (url.host !== baseUrl.host) continue;
    if (!/(help|docs|knowledge|guide|support)/i.test(url.pathname + url.hostname)) continue;
    const type: SourceType = /(docs|guide|knowledge)/i.test(url.pathname + url.hostname)
      ? "docs"
      : "help";
    links.set(url.toString(), { url: url.toString(), type });
  }

  return [...links.values()];
}

function dedupeCandidates(candidates: DiscoveredCandidate[]): DiscoveredCandidate[] {
  const bestByUrl = new Map<string, DiscoveredCandidate>();

  for (const candidate of candidates) {
    const existing = bestByUrl.get(candidate.sourceImageUrl);
    if (!existing || candidate.score > existing.score) {
      bestByUrl.set(candidate.sourceImageUrl, candidate);
    }
  }

  return [...bestByUrl.values()];
}

function writeDiscoveryOutput(slug: string, output: DiscoveryOutput) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
}

function readDiscoveryOutput(slug: string): DiscoveryOutput {
  const filePath = path.join(tmpDir, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Discovery output not found: ${filePath}. Run discover first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as DiscoveryOutput;
}

function printDiscoverySummary(output: DiscoveryOutput) {
  const outputPath = path.relative(repoRoot, path.join(tmpDir, `${output.slug}.json`));
  console.log(`Wrote ${outputPath}`);
  console.log(
    `Found ${output.candidates.length} candidate image${output.candidates.length === 1 ? "" : "s"}.`,
  );
  for (const [index, candidate] of output.candidates.slice(0, 20).entries()) {
    const label =
      candidate.alt ?? candidate.contextHeading ?? path.basename(candidate.sourceImageUrl);
    console.log(
      `${index + 1}. [${candidate.id}] score=${candidate.score} ${label} <${candidate.sourceImageUrl}>`,
    );
  }
  if (output.skippedPages.length > 0) {
    console.log("Skipped pages:");
    for (const page of output.skippedPages) {
      console.log(`- ${page}`);
    }
  }
}

function printReviewTable(output: DiscoveryOutput, options: { limit: number; showAll: boolean }) {
  const rows = options.showAll ? output.candidates : output.candidates.slice(0, options.limit);
  const header = ["#", "Score", "Type", "Tags", "ID", "Label", "Source"].join(" | ");
  const divider = ["-", "-", "-", "-", "-", "-", "-"].join(" | ");

  console.log(
    `Reviewing ${rows.length} of ${output.candidates.length} candidate images for ${output.slug}`,
  );
  console.log(header);
  console.log(divider);

  for (const [index, candidate] of rows.entries()) {
    const label = truncate(
      candidate.contextHeading ??
        candidate.alt ??
        candidate.caption ??
        path.basename(candidate.sourceImageUrl),
      54,
    );
    const source = truncate(candidate.sourcePageUrl, 54);
    console.log(
      [
        String(index + 1),
        String(candidate.score),
        candidate.sourceType,
        candidate.tags.join(",") || "-",
        candidate.id,
        label,
        source,
      ].join(" | "),
    );
  }

  if (output.skippedPages.length > 0) {
    console.log("\nSkipped pages:");
    for (const page of output.skippedPages) {
      console.log(`- ${page}`);
    }
  }

  console.log(
    "\nUse `pnpm screenshots:ingest -- <slug> --pick <indexes-or-ids>` to save selected images.",
  );
}

function resolvePickedCandidates(
  discovery: DiscoveryOutput,
  selection: string[],
): DiscoveredCandidate[] {
  const resolved: DiscoveredCandidate[] = [];

  for (const item of selection) {
    const asIndex = Number(item);
    if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= discovery.candidates.length) {
      const candidate = discovery.candidates[asIndex - 1];
      resolved.push(candidate);
      continue;
    }

    const byId = discovery.candidates.find((candidate) => candidate.id === item);
    if (!byId) {
      throw new Error(`Candidate not found: ${item}`);
    }
    resolved.push(byId);
  }

  return dedupeCandidates(resolved);
}

async function ingestCandidates(
  companyPath: string,
  company: CompanyYamlValue,
  candidates: DiscoveredCandidate[],
  force: boolean,
): Promise<CompanyYamlValue> {
  const screenshotsDir = path.join(publicAssetsDir, company.slug, "screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const existingById = new Map(company.screenshots.map((entry) => [entry.id, entry]));
  const nextScreenshots = [...company.screenshots];

  for (const candidate of candidates) {
    const extension = inferFileExtension(candidate.sourceImageUrl);
    const filename = `${candidate.id}${extension}`;
    const outputPath = path.join(screenshotsDir, filename);

    if (existingById.has(candidate.id) && !force) {
      throw new Error(`Screenshot id already exists: ${candidate.id}. Use --force to replace it.`);
    }

    const response = await fetch(candidate.sourceImageUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${candidate.sourceImageUrl}: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(
        `Expected image content but got '${contentType}' for ${candidate.sourceImageUrl}`,
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, bytes);

    const screenshot = buildScreenshotEntry(company.slug, candidate, filename);
    const existingIndex = nextScreenshots.findIndex((entry) => entry.id === screenshot.id);
    if (existingIndex >= 0) {
      nextScreenshots[existingIndex] = screenshot;
    } else {
      nextScreenshots.push(screenshot);
    }
  }

  const nextCompany: CompanyYamlValue = {
    ...company,
    screenshots: nextScreenshots.sort((left, right) => left.id.localeCompare(right.id)),
  };

  fs.writeFileSync(companyPath, stringifyCompanyYaml(nextCompany));
  return nextCompany;
}

function buildScreenshotEntry(
  slug: string,
  candidate: DiscoveredCandidate,
  filename: string,
): Screenshot {
  return {
    id: candidate.id,
    assetPath: `/company-assets/${slug}/screenshots/${filename}`,
    sourcePageUrl: candidate.sourcePageUrl,
    sourceImageUrl: candidate.sourceImageUrl,
    sourceType: candidate.sourceType,
    collectedAt: new Date().toISOString(),
    alt: candidate.alt ?? candidate.contextHeading ?? humanizeId(candidate.id),
    ...(candidate.tags[0] ? { kind: candidate.tags[0] } : {}),
    ...(candidate.caption ? { caption: candidate.caption } : {}),
    ...(candidate.contextHeading ? { contextHeading: candidate.contextHeading } : {}),
    ...(candidate.pageTitle ? { pageTitle: candidate.pageTitle } : {}),
    ...(candidate.width ? { width: candidate.width } : {}),
    ...(candidate.height ? { height: candidate.height } : {}),
    tags: candidate.tags,
  };
}

function pickImageSource(tag: string): string | null {
  const srcset = getAttribute(tag, "srcset");
  if (srcset) {
    const first = srcset
      .split(",")
      .map((entry) => entry.trim().split(/\s+/)[0])
      .find(Boolean);
    if (first) return first;
  }

  return (
    getAttribute(tag, "src") ?? getAttribute(tag, "data-src") ?? getAttribute(tag, "data-lazy-src")
  );
}

function getAttribute(tag: string, attribute: string): string | null {
  const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, "i");
  const match = pattern.exec(tag);
  return match?.[1] ?? null;
}

function toAbsoluteUrl(value: string, baseUrl: URL): string | null {
  const normalizedValue = decodeHtmlEntities(value);
  if (normalizedValue.startsWith("data:")) return null;

  try {
    if (normalizedValue.startsWith("//")) {
      return `${baseUrl.protocol}${normalizedValue}`;
    }

    return new URL(normalizedValue, baseUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyAllowedImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (!/\.(png|jpe?g|webp|gif|svg)(?:\?|$)/.test(lower)) return false;
  if (
    /(logo|icon|avatar|favicon|badge|star|portrait|headshot|illustration|flag|award|gartner|vendor)/i.test(
      lower,
    )
  )
    return false;
  return true;
}

function passesDimensionFilter(width: number | null, height: number | null, url: string): boolean {
  if (width !== null && height !== null) {
    return width >= MIN_DIMENSION && height >= MIN_DIMENSION && width * height >= MIN_AREA;
  }

  return !/(logo|icon|badge|avatar|favicon)/i.test(url);
}

function extractContextHeading(fragment: string): string | null {
  const headingMatches = [...fragment.matchAll(/<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const last = headingMatches.at(-1);
  if (!last) return null;
  return cleanText(last[2]);
}

function extractCaption(fragment: string): string | null {
  const figcaption = matchFirst(fragment, /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
  if (figcaption) return cleanText(figcaption);

  const paragraph = matchFirst(fragment, /<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!paragraph) return null;

  const cleaned = cleanText(paragraph);
  return cleaned && cleaned.length >= 24 ? cleaned : null;
}

function inferTags(value: string): string[] {
  const normalized = value.toLowerCase();
  const tags: string[] = [];
  if (/(dashboard|overview|analytics|visibility|performance|report)/.test(normalized)) {
    tags.push("dashboard");
  }
  if (/(setting|config|configuration|setup|workflow|automation|rule)/.test(normalized)) {
    tags.push("configuration");
  }
  if (/(chart|graph|trend|metric|analytics)/.test(normalized)) {
    tags.push("analytics");
  }
  if (/(prompt|query|search|brand|mention|citation)/.test(normalized)) {
    tags.push("tracking");
  }
  return [...new Set(tags)];
}

function scoreCandidate(input: {
  alt: string | null;
  contextHeading: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  sourceImageUrl: string;
  filename: string;
  tags: string[];
}): number {
  const haystack = [input.alt, input.contextHeading, input.caption, input.filename]
    .filter(Boolean)
    .join(" ");
  let score = 0;

  if (input.width && input.height && input.width * input.height >= 900_000) score += 2;
  if (input.width && input.height && input.width >= 1200 && input.height >= 700) score += 2;
  if (
    /(dashboard|platform|workspace|analytics|report|settings|configuration|monitor|tracking|visibility)/i.test(
      haystack,
    )
  ) {
    score += 4;
  }
  if (/(product|ui|interface|screen|screenshot)/i.test(haystack)) score += 2;
  if (/(logo|icon|badge|team|customer|avatar|portrait|testimonial)/i.test(haystack)) score -= 5;
  if (input.tags.length > 0) score += input.tags.length;
  if (/(hero|banner)/i.test(input.filename)) score += 1;
  if (
    /\.svg(?:\?|$)/i.test(input.sourceImageUrl) &&
    !/(dashboard|analytics|settings|report)/i.test(haystack)
  ) {
    score -= 3;
  }

  return score;
}

function buildCandidateId(
  filename: string,
  alt: string | null,
  heading: string | null,
  caption: string | null,
  index: number,
): string {
  const seed = alt ?? heading ?? caption ?? filename.replace(/\.[a-z0-9]+$/i, "");
  const base = slugify(seed).slice(0, 48) || `candidate-${index}`;
  return base;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function humanizeId(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function inferFileExtension(url: string): string {
  try {
    const ext = path.extname(new URL(url).pathname);
    return ext && /^[.][a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : ".png";
  } catch {
    return ".png";
  }
}

function toNullableNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string): string | null {
  const text = decodeHtmlEntities(stripTags(value)).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function matchFirst(value: string, pattern: RegExp): string | null {
  const match = pattern.exec(value);
  return match?.[1] ?? null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exit(1);
});
