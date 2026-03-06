/**
 * Fetches and extracts text content from a URL.
 * Strips HTML tags and normalizes whitespace to produce clean text
 * suitable for LLM analysis.
 */

const MAX_CONTENT_LENGTH = 50_000; // chars, to stay within LLM context limits

/**
 * Fetch a page and return its text content (HTML tags stripped).
 * Returns null if the fetch fails.
 */
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LLMTrackerBot/1.0; +https://github.com/nozzle/llm-tracker-comparison)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    return htmlToText(html).slice(0, MAX_CONTENT_LENGTH);
  } catch (err) {
    console.warn(`Error fetching ${url}:`, err);
    return null;
  }
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
