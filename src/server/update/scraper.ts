/**
 * Fetches and extracts text content from a URL.
 * Strips HTML tags and normalizes whitespace to produce clean text
 * suitable for LLM analysis.
 */

const MAX_CONTENT_LENGTH = 50_000; // chars, to stay within LLM context limits
const MAX_RESPONSE_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

interface FetchPageOptions {
  maxLength?: number;
}

/**
 * Fetch a page and return its text content (HTML tags stripped).
 * Returns null if the fetch fails.
 */
export async function fetchPageText(url: string): Promise<string | null> {
  const html = await fetchPageHtml(url, { maxLength: MAX_RESPONSE_BYTES });
  return html ? htmlToText(html).slice(0, MAX_CONTENT_LENGTH) : null;
}

/**
 * Fetch a page and return raw HTML.
 * Returns null if the fetch fails or the content is not HTML/text.
 */
export async function fetchPageHtml(
  url: string,
  options: FetchPageOptions = {},
): Promise<string | null> {
  const maxLength = options.maxLength ?? MAX_RESPONSE_BYTES;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LLMTrackerBot/1.0; +https://github.com/nozzle/llm-tracker-comparison)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Failed to fetch ${url}: ${response.status}`);
        if (attempt <= MAX_RETRIES && shouldRetryStatus(response.status)) {
          await sleep(backoffMs(attempt));
          continue;
        }
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!isTextLikeContentType(contentType)) {
        console.warn(`Skipping ${url}: unsupported content type ${contentType}`);
        return null;
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
        console.warn(`Skipping ${url}: content-length ${contentLength} exceeds limit`);
        return null;
      }

      const html = await response.text();
      if (html.length > maxLength) {
        console.warn(`Skipping ${url}: response body exceeds limit`);
        return null;
      }

      return html;
    } catch (err) {
      clearTimeout(timeout);
      console.warn(`Error fetching ${url} (attempt ${attempt}):`, err);
      if (attempt <= MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Naive HTML-to-text conversion. Strips tags, decodes common entities,
 * and collapses whitespace. Good enough for pricing pages.
 */
function htmlToText(html: string): string {
  return (
    html
      // Remove script/style blocks
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      // Convert block elements to newlines
      .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      // Collapse whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isTextLikeContentType(contentType: string): boolean {
  return ["text/html", "text/plain", "application/xhtml+xml"].some((value) =>
    contentType.includes(value),
  );
}

function backoffMs(attempt: number): number {
  return attempt * 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
