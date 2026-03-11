import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCompanyYaml, stringifyCompanyYaml, type CompanyYamlValue } from "@llm-tracker/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const companiesDir = path.join(repoRoot, "data", "companies");

type Command = "inspect" | "add" | "suggest-from-feed";
type Provider = "youtube" | "wistia" | "loom";

interface YouTubeOEmbedResponse {
  title: string;
  author_name: string;
  author_url?: string;
  thumbnail_url: string;
}

interface WistiaOEmbedResponse {
  title: string;
  thumbnail_url: string;
  duration?: number;
}

interface LoomMetadataResponse {
  title: string;
  thumbnail_url: string;
  author_name?: string;
  author_url?: string;
}

interface YouTubeFeedEntry {
  videoId: string;
  title: string;
  watchUrl: string;
  publishedAt: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string;
  description: string;
  isShort: boolean;
  score: number;
  reasons: string[];
}

interface ResolvedYouTubeFeed {
  feedUrl: string;
  channelId: string | null;
  channelUrl: string | null;
  channelTitle: string | null;
}

type VideoEntry = CompanyYamlValue["videos"][number];

function isYouTubeOEmbedResponse(value: unknown): value is YouTubeOEmbedResponse {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.author_name === "string" &&
    typeof candidate.thumbnail_url === "string" &&
    (candidate.author_url === undefined || typeof candidate.author_url === "string")
  );
}

function isWistiaOEmbedResponse(value: unknown): value is WistiaOEmbedResponse {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.thumbnail_url === "string" &&
    (candidate.duration === undefined || typeof candidate.duration === "number")
  );
}

function isLoomMetadataResponse(value: unknown): value is LoomMetadataResponse {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.thumbnail_url === "string" &&
    (candidate.author_name === undefined || typeof candidate.author_name === "string") &&
    (candidate.author_url === undefined || typeof candidate.author_url === "string")
  );
}

async function main() {
  const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
  const [command, ...rest] = rawArgs as [Command | undefined, ...string[]];

  if (command !== "inspect" && command !== "add" && command !== "suggest-from-feed") {
    printUsage();
    process.exit(1);
  }

  const options = parseOptions(rest);

  if (command === "suggest-from-feed") {
    const source = getFeedSourceArg(rest, options);
    if (!source) {
      throw new Error(
        "Provide --feed <youtube-feed-url>, --channel <youtube-channel-url>, or a YouTube channel URL when using suggest-from-feed.",
      );
    }

    const limit = parsePositiveInteger(options.limit, 8);
    const resolvedFeed = await resolveYouTubeFeedSource(source);
    const entries = await fetchYouTubeFeedEntries(resolvedFeed.feedUrl);
    const ranked = rankFeedEntries(entries)
      .filter((entry) => !entry.isShort)
      .slice(0, limit);

    printFeedSuggestions(ranked, resolvedFeed);
    return;
  }

  const url = getUrlArg(rest, options);

  if (!url) {
    printUsage();
    process.exit(1);
  }

  const provider = detectProvider(url);
  if (!provider) {
    throw new Error(`Unsupported video provider for URL: ${url}`);
  }

  const entry = await buildVideoEntry(url, options, provider);

  if (command === "inspect") {
    console.log("# YAML-ready video entry");
    console.log(`# Repo: ${repoRoot}`);
    console.log(buildYamlBlock(entry));
    return;
  }

  const slug = typeof options.company === "string" ? options.company : undefined;
  if (!slug) {
    throw new Error("Provide --company <slug> when using the add command.");
  }

  const companyPath = path.join(companiesDir, `${slug}.yaml`);
  if (!fs.existsSync(companyPath)) {
    throw new Error(`Company YAML not found: ${companyPath}`);
  }

  const company = readCompany(companyPath);
  const force = options.force === true;
  const nextVideos = upsertVideo(company.videos, entry, force);
  const updatedCompany: CompanyYamlValue = {
    ...company,
    videos: nextVideos,
  };

  fs.writeFileSync(companyPath, stringifyCompanyYaml(updatedCompany));

  console.log(`Added video '${entry.title}' to ${slug}.`);
  console.log(`Updated ${path.relative(repoRoot, companyPath)}`);
}

function printUsage() {
  console.log("Usage:");
  console.log(
    '  pnpm videos:inspect -- --url <video-url> [--kind demo] [--sourceType third-party] [--description "..."]',
  );
  console.log("  pnpm videos:inspect -- <video-url>");
  console.log(
    '  pnpm videos:add -- --company <slug> --url <video-url> [--kind demo] [--sourceType third-party] [--description "..."] [--force]',
  );
  console.log(
    "  pnpm videos:suggest -- --feed <youtube-feed-url> [--limit 8]  # ranks likely longform demo candidates",
  );
  console.log(
    "  pnpm videos:suggest -- --channel <youtube-channel-or-handle-url> [--limit 8]  # resolves the feed automatically",
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

function getUrlArg(args: string[], options: Record<string, string | boolean>): string | undefined {
  if (typeof options.url === "string") return options.url;

  const values = args.filter((value) => !value.startsWith("--"));
  return values.at(-1);
}

function getFeedSourceArg(
  args: string[],
  options: Record<string, string | boolean>,
): string | undefined {
  if (typeof options.feed === "string") return options.feed;
  if (typeof options.channel === "string") return options.channel;

  const values = args.filter((value) => !value.startsWith("--"));
  return values.at(-1);
}

function parsePositiveInteger(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function detectProvider(url: string): Provider | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com") || parsed.hostname === "youtu.be") {
      return "youtube";
    }
    if (parsed.hostname.includes("wistia.com") || parsed.hostname.includes("wistia.net")) {
      return "wistia";
    }
    if (parsed.hostname.includes("loom.com")) {
      return "loom";
    }
    return null;
  } catch {
    return null;
  }
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.split("/").find(Boolean) ?? null;
    }

    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    const embedIndex = parts.findIndex(
      (part) => part === "embed" || part === "shorts" || part === "live",
    );
    if (embedIndex >= 0) {
      return parts[embedIndex + 1] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchYouTubeOEmbed(url: string): Promise<YouTubeOEmbedResponse> {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", "json");

  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube metadata: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isYouTubeOEmbedResponse(payload)) {
    throw new Error("Unexpected YouTube oEmbed response shape.");
  }

  return payload;
}

async function fetchWistiaOEmbed(url: string): Promise<WistiaOEmbedResponse> {
  const endpoint = new URL("https://fast.wistia.net/oembed");
  endpoint.searchParams.set("url", url);

  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Wistia metadata: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isWistiaOEmbedResponse(payload)) {
    throw new Error("Unexpected Wistia oEmbed response shape.");
  }

  return payload;
}

async function fetchLoomMetadata(url: string): Promise<LoomMetadataResponse> {
  const htmlResponse = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!htmlResponse.ok) {
    throw new Error(`Failed to fetch Loom page: HTTP ${htmlResponse.status}`);
  }

  const html = await htmlResponse.text();
  const sharedData = parseLoomSharedData(html);
  const title =
    sharedData?.title ??
    matchFirst(html, /property="og:title" content="([^"]+)"/) ??
    matchFirst(html, /name="twitter:title" content="([^"]+)"/) ??
    matchFirst(html, /<title>([^<]+)<\/title>/);
  const thumbnailUrl =
    sharedData?.thumbnailUrl ??
    matchFirst(html, /property="og:image" content="([^"]+)"/) ??
    matchFirst(html, /name="twitter:image" content="([^"]+)"/);
  const authorName =
    sharedData?.authorName ??
    matchFirst(html, /property="og:site_name" content="([^"]+)"/) ??
    matchFirst(html, /name="author" content="([^"]+)"/);

  const payload: unknown = {
    title: title ? decodeXml(title).trim() : null,
    thumbnail_url: thumbnailUrl,
    author_name: authorName ? decodeXml(authorName).trim() : undefined,
  };

  if (!isLoomMetadataResponse(payload)) {
    throw new Error("Unexpected Loom metadata response shape.");
  }

  return payload;
}

function parseLoomSharedData(
  html: string,
): { title?: string; thumbnailUrl?: string; authorName?: string } | null {
  const jsonBlob =
    matchFirst(html, /"video_title":"([^"]+)"/) ?? matchFirst(html, /"title":"([^"]+)"/);
  const thumbnailBlob =
    matchFirst(html, /"thumbnail_url":"([^"]+)"/) ?? matchFirst(html, /"thumbnailUrl":"([^"]+)"/);
  const authorBlob =
    matchFirst(html, /"display_name":"([^"]+)"/) ?? matchFirst(html, /"creator_name":"([^"]+)"/);

  if (!jsonBlob && !thumbnailBlob && !authorBlob) return null;

  return {
    ...(jsonBlob ? { title: decodeJsonText(jsonBlob) } : {}),
    ...(thumbnailBlob ? { thumbnailUrl: decodeJsonText(thumbnailBlob) } : {}),
    ...(authorBlob ? { authorName: decodeJsonText(authorBlob) } : {}),
  };
}

async function fetchYouTubeFeedEntries(feedUrl: string): Promise<YouTubeFeedEntry[]> {
  const response = await fetch(feedUrl, {
    headers: {
      accept: "application/atom+xml,application/xml,text/xml",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube feed: HTTP ${response.status}`);
  }

  const xml = await response.text();
  return parseYouTubeFeed(xml);
}

async function resolveYouTubeFeedSource(source: string): Promise<ResolvedYouTubeFeed> {
  if (/^UC[A-Za-z0-9_-]{22}$/.test(source)) {
    return {
      feedUrl: buildYouTubeFeedUrl(source),
      channelId: source,
      channelUrl: `https://www.youtube.com/channel/${source}`,
      channelTitle: null,
    };
  }

  const parsed = new URL(source);
  if (parsed.pathname === "/feeds/videos.xml") {
    const channelId = parsed.searchParams.get("channel_id");
    return {
      feedUrl: parsed.toString(),
      channelId,
      channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
      channelTitle: null,
    };
  }

  const directChannelId = parseChannelIdFromUrl(parsed);
  if (directChannelId) {
    return {
      feedUrl: buildYouTubeFeedUrl(directChannelId),
      channelId: directChannelId,
      channelUrl: `https://www.youtube.com/channel/${directChannelId}`,
      channelTitle: null,
    };
  }

  const response = await fetch(source, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve YouTube channel page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const channelId = parseChannelIdFromHtml(html);
  if (!channelId) {
    throw new Error(`Could not resolve a YouTube channel id from ${source}`);
  }

  return {
    feedUrl: buildYouTubeFeedUrl(channelId),
    channelId,
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
    channelTitle: parseChannelTitleFromHtml(html),
  };
}

function buildYouTubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function parseChannelIdFromUrl(url: URL): string | null {
  if (url.hostname !== "www.youtube.com" && url.hostname !== "youtube.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "channel") {
    return parts[1] ?? null;
  }

  return null;
}

function parseChannelIdFromHtml(html: string): string | null {
  return (
    matchFirst(html, /https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/) ??
    matchFirst(html, /itemprop="identifier" content="(UC[A-Za-z0-9_-]{22})"/) ??
    matchFirst(html, /"channelId":"(UC[A-Za-z0-9_-]{22})"/)
  );
}

function parseChannelTitleFromHtml(html: string): string | null {
  const title =
    matchFirst(html, /twitter:title" content="([^"]+)"/) ??
    matchFirst(html, /itemprop="name" content="([^"]+)"/) ??
    matchFirst(html, /<title>([^<]+)<\/title>/);
  return title ? decodeXml(title).trim() : null;
}

function parseYouTubeFeed(xml: string): YouTubeFeedEntry[] {
  const entryMatches = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

  return entryMatches
    .map((match) => parseFeedEntry(match[1]))
    .filter((entry): entry is YouTubeFeedEntry => entry !== null);
}

function parseFeedEntry(xml: string): YouTubeFeedEntry | null {
  const videoId = matchFirst(xml, /<yt:videoId>([^<]+)<\/yt:videoId>/);
  const title = decodeXml(matchFirst(xml, /<title>([\s\S]*?)<\/title>/) ?? "").trim();
  const watchUrl = matchFirst(xml, /<link rel="alternate" href="([^"]+)"\/>/);
  const publishedAt = matchFirst(xml, /<published>([^<]+)<\/published>/);
  const authorName = decodeXml(matchFirst(xml, /<author>\s*<name>([\s\S]*?)<\/name>/) ?? "").trim();
  const authorUrl = matchFirst(xml, /<author>[\s\S]*?<uri>([^<]+)<\/uri>/) ?? "";
  const thumbnailUrl = matchFirst(xml, /<media:thumbnail url="([^"]+)"/) ?? "";
  const description = decodeXml(
    matchFirst(xml, /<media:description>([\s\S]*?)<\/media:description>/) ?? "",
  ).trim();

  if (!videoId || !title || !watchUrl || !publishedAt || !authorName || !thumbnailUrl) {
    return null;
  }

  const isShort = watchUrl.includes("/shorts/");
  const ranking = scoreFeedEntry({ title, description, watchUrl, isShort });

  return {
    videoId,
    title,
    watchUrl,
    publishedAt,
    authorName,
    authorUrl,
    thumbnailUrl,
    description,
    isShort,
    score: ranking.score,
    reasons: ranking.reasons,
  };
}

function scoreFeedEntry(input: {
  title: string;
  description: string;
  watchUrl: string;
  isShort: boolean;
}): { score: number; reasons: string[] } {
  const haystack = `${input.title} ${input.description}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  if (input.isShort) {
    score -= 6;
    reasons.push("short");
  }
  if (
    /(demo|demo desk|walkthrough|how to|tutorial|session|track|optimi[sz]e|visibility|prompts)/.test(
      haystack,
    )
  ) {
    score += 5;
    reasons.push("product-keywords");
  }
  if (
    /(ai search|geo|aeo|citations|mentions|prompt|content optimization|writing assistant|mcp)/.test(
      haystack,
    )
  ) {
    score += 4;
    reasons.push("feature-topic");
  }
  if (
    /(customer stories|case study|cohort|webinar recap|recap|q4 results|industry|podcast)/.test(
      haystack,
    )
  ) {
    score -= 2;
    reasons.push("less-product-focused");
  }
  if (/(minutes|timestamps|what you'll learn|key takeaways|learn more)/.test(haystack)) {
    score += 1;
    reasons.push("longform-signals");
  }
  if (input.watchUrl.includes("/watch?v=")) {
    score += 1;
    reasons.push("watch-url");
  }

  return { score, reasons };
}

function rankFeedEntries(entries: YouTubeFeedEntry[]): YouTubeFeedEntry[] {
  return [...entries].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.publishedAt.localeCompare(left.publishedAt);
  });
}

function printFeedSuggestions(entries: YouTubeFeedEntry[], resolvedFeed: ResolvedYouTubeFeed) {
  console.log(`# Suggested longform video candidates`);
  console.log(`# Feed: ${resolvedFeed.feedUrl}`);
  if (resolvedFeed.channelTitle) {
    console.log(`# Channel: ${resolvedFeed.channelTitle}`);
  }
  if (resolvedFeed.channelUrl) {
    console.log(`# Channel URL: ${resolvedFeed.channelUrl}`);
  }
  console.log("# | score | published | videoId | title");
  console.log("- | - | - | - | -");

  for (const [index, entry] of entries.entries()) {
    console.log(
      `${index + 1} | ${entry.score} | ${entry.publishedAt.slice(0, 10)} | ${entry.videoId} | ${entry.title}`,
    );
    console.log(`  watch: ${entry.watchUrl}`);
    console.log(`  why: ${entry.reasons.join(", ") || "-"}`);
  }
}

async function buildVideoEntry(
  url: string,
  options: Record<string, string | boolean>,
  provider: Provider,
): Promise<VideoEntry> {
  if (provider === "youtube") {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error(`Could not extract YouTube video id from URL: ${url}`);
    }

    const metadata = await fetchYouTubeOEmbed(url);
    const title = typeof options.title === "string" ? options.title : metadata.title;
    const creator = typeof options.creator === "string" ? options.creator : metadata.author_name;
    const creatorUrl =
      typeof options.creatorUrl === "string" ? options.creatorUrl : metadata.author_url;

    return {
      id: typeof options.id === "string" ? options.id : slugify(title),
      provider,
      videoId,
      watchUrl: normalizeYouTubeWatchUrl(videoId),
      title,
      creator,
      ...(creatorUrl ? { creatorUrl } : {}),
      thumbnailUrl: metadata.thumbnail_url,
      ...(typeof options.kind === "string" ? { kind: options.kind } : { kind: "demo" }),
      sourceType: normalizeSourceType(options.sourceType),
      collectedAt:
        typeof options.collectedAt === "string" ? options.collectedAt : new Date().toISOString(),
      ...(typeof options.description === "string" ? { description: options.description } : {}),
    };
  }

  if (provider === "wistia") {
    const videoId = extractWistiaVideoId(url);
    if (!videoId) {
      throw new Error(`Could not extract Wistia video id from URL: ${url}`);
    }

    const metadata = await fetchWistiaOEmbed(normalizeWistiaWatchUrl(videoId));
    const title = typeof options.title === "string" ? options.title : metadata.title;
    const creator = typeof options.creator === "string" ? options.creator : "Wistia Video";
    const creatorUrl = typeof options.creatorUrl === "string" ? options.creatorUrl : undefined;

    return {
      id: typeof options.id === "string" ? options.id : slugify(title),
      provider,
      videoId,
      watchUrl: normalizeWistiaWatchUrl(videoId),
      title,
      creator,
      ...(creatorUrl ? { creatorUrl } : {}),
      thumbnailUrl: metadata.thumbnail_url,
      ...(typeof options.kind === "string" ? { kind: options.kind } : { kind: "demo" }),
      sourceType: normalizeSourceType(options.sourceType),
      collectedAt:
        typeof options.collectedAt === "string" ? options.collectedAt : new Date().toISOString(),
      ...(typeof options.description === "string" ? { description: options.description } : {}),
    };
  }

  const videoId = extractLoomVideoId(url);
  if (!videoId) {
    throw new Error(`Could not extract Loom video id from URL: ${url}`);
  }

  const metadata = await fetchLoomMetadata(normalizeLoomWatchUrl(videoId));
  const title = typeof options.title === "string" ? options.title : metadata.title;
  const creator =
    typeof options.creator === "string" ? options.creator : (metadata.author_name ?? "Loom");
  const creatorUrl =
    typeof options.creatorUrl === "string" ? options.creatorUrl : metadata.author_url;

  return {
    id: typeof options.id === "string" ? options.id : slugify(title),
    provider,
    videoId,
    watchUrl: normalizeLoomWatchUrl(videoId),
    title,
    creator,
    ...(creatorUrl ? { creatorUrl } : {}),
    thumbnailUrl: metadata.thumbnail_url,
    ...(typeof options.kind === "string" ? { kind: options.kind } : { kind: "demo" }),
    sourceType: normalizeSourceType(options.sourceType),
    collectedAt:
      typeof options.collectedAt === "string" ? options.collectedAt : new Date().toISOString(),
    ...(typeof options.description === "string" ? { description: options.description } : {}),
  };
}

function readCompany(companyPath: string): CompanyYamlValue {
  const yamlText = fs.readFileSync(companyPath, "utf8");
  return parseCompanyYaml(yamlText).company;
}

function upsertVideo(existing: VideoEntry[], entry: VideoEntry, force: boolean): VideoEntry[] {
  const index = existing.findIndex((video) => video.id === entry.id);
  if (index >= 0 && !force) {
    throw new Error(`Video id '${entry.id}' already exists. Use --force to replace it.`);
  }

  const next = [...existing];
  if (index >= 0) {
    next[index] = entry;
  } else {
    next.push(entry);
  }

  return next.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function extractWistiaVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const directMediaMatch = /\/medias\/([a-z0-9]+)/i.exec(parsed.pathname);
    if (directMediaMatch?.[1]) return directMediaMatch[1];

    const iframeMatch = /\/iframe\/([a-z0-9]+)/i.exec(parsed.pathname);
    if (iframeMatch?.[1]) return iframeMatch[1];

    return null;
  } catch {
    return null;
  }
}

function normalizeWistiaWatchUrl(videoId: string): string {
  return `https://fast.wistia.net/embed/iframe/${videoId}`;
}

function extractLoomVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const shareIndex = parts.findIndex((part) => part === "share" || part === "embed");
    if (shareIndex >= 0) {
      return parts[shareIndex + 1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeLoomWatchUrl(videoId: string): string {
  return `https://www.loom.com/share/${videoId}`;
}

function normalizeSourceType(value: string | boolean | undefined): "first-party" | "third-party" {
  return value === "first-party" ? "first-party" : "third-party";
}

function buildYamlBlock(entry: VideoEntry): string {
  const lines = [
    "- id: " + entry.id,
    "  provider: " + entry.provider,
    "  videoId: " + entry.videoId,
    "  watchUrl: " + entry.watchUrl,
    "  title: " + quoteIfNeeded(entry.title),
    "  creator: " + quoteIfNeeded(entry.creator),
    ...(entry.creatorUrl ? ["  creatorUrl: " + entry.creatorUrl] : []),
    "  thumbnailUrl: " + entry.thumbnailUrl,
    ...(entry.kind ? ["  kind: " + entry.kind] : []),
    "  sourceType: " + entry.sourceType,
    "  collectedAt: " + entry.collectedAt,
    ...(entry.description ? ["  description: " + quoteIfNeeded(entry.description)] : []),
  ];

  return ["videos:", ...lines].join("\n");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function quoteIfNeeded(value: string): string {
  return /[:#]|^\s|\s$/.test(value) ? JSON.stringify(value) : value;
}

function matchFirst(value: string, pattern: RegExp): string | null {
  const match = pattern.exec(value);
  return match?.[1] ?? null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function decodeJsonText(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
