import { chromium } from "playwright";
import type { ExtractedPageContent } from "./types";
import type { AppEnv } from "../types";

const NAVIGATION_TIMEOUT_MS = 30_000;
const EXTRACT_TIMEOUT_MS = 45_000;
const MAX_TEXT_LENGTH = 60_000;

interface PageExtractionResult {
  finalUrl: string;
  title: string;
  byline: string | null;
  publishedDate: string | null;
  text: string;
  html: string;
  warnings: string[];
}

interface PageLike {
  setDefaultTimeout(timeout: number): void;
  goto(url: string, options: { waitUntil: "domcontentloaded"; timeout: number }): Promise<unknown>;
  waitForLoadState(state: "networkidle", options: { timeout: number }): Promise<unknown>;
  waitForTimeout(timeout: number): Promise<unknown>;
  locator(selector: string): {
    first(): {
      isVisible(options: { timeout: number }): Promise<boolean>;
      click(options: { timeout: number }): Promise<unknown>;
    };
  };
  evaluate<Result, Arg>(pageFunction: (arg: Arg) => Result, arg: Arg): Promise<Result>;
}

async function dismissCommonOverlays(page: PageLike): Promise<void> {
  const candidates = [
    "button:has-text('Accept')",
    "button:has-text('Accept all')",
    "button:has-text('I agree')",
    "button:has-text('Got it')",
    "button:has-text('Continue')",
    "button[aria-label*='accept' i]",
  ];

  for (const selector of candidates) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 500 })) {
        await button.click({ timeout: 1_000 });
        return;
      }
    } catch {
      // ignore best-effort overlay handling
    }
  }
}

async function extractFromPage(page: PageLike, url: string): Promise<PageExtractionResult> {
  page.setDefaultTimeout(10_000);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  await dismissCommonOverlays(page);
  await page.waitForTimeout(800);

  const result = await page.evaluate(
    ({ maxTextLength }) => {
      function getMetaContent(selector: string): string | null {
        const element = document.querySelector<HTMLMetaElement>(selector);
        const value = element?.content.trim();
        return value ?? null;
      }

      function textFromNode(node: Element | null): string {
        if (!node) return "";
        return node.textContent.replace(/\s+/g, " ").trim();
      }

      function bestContentRoot(): Element | null {
        const candidates = [
          document.querySelector("article"),
          document.querySelector("main article"),
          document.querySelector("main"),
          document.querySelector("[role='main']"),
        ].filter((node): node is Element => Boolean(node));

        if (candidates.length > 0) {
          return candidates.sort((a, b) => b.textContent.length - a.textContent.length)[0];
        }

        const bodyChildren = Array.from(document.body.querySelectorAll("div, section"));
        return (
          bodyChildren.sort((a, b) => b.textContent.length - a.textContent.length)[0] ??
          document.body
        );
      }

      function parseJsonLdDate(): string | null {
        const scripts = Array.from(
          document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
        );

        for (const script of scripts) {
          try {
            const jsonText = script.textContent.trim();
            const parsed = JSON.parse(jsonText.length > 0 ? jsonText : "null") as unknown;
            const values = Array.isArray(parsed) ? parsed : [parsed];
            for (const value of values) {
              if (typeof value !== "object" || value === null) continue;
              const candidate = value as Record<string, unknown>;
              const raw =
                "datePublished" in candidate ? candidate.datePublished : candidate.dateModified;
              if (typeof raw === "string" && raw.trim()) {
                return raw.trim();
              }
            }
          } catch {
            // ignore malformed JSON-LD
          }
        }

        return null;
      }

      function normalizeDate(value: string | null): string | null {
        if (!value) return null;
        const match = /\d{4}-\d{2}-\d{2}/.exec(value);
        if (match) return match[0];
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
      }

      const root = bestContentRoot();
      const text = textFromNode(root).slice(0, maxTextLength);
      const metaAuthor = getMetaContent('meta[name="author"]');
      const relAuthor = textFromNode(document.querySelector('[rel="author"]')) || null;
      const itemPropAuthor = textFromNode(document.querySelector('[itemprop="author"]')) || null;
      const byline = metaAuthor ?? relAuthor ?? itemPropAuthor;

      const publishedDateSource =
        getMetaContent('meta[property="article:published_time"]') ??
        getMetaContent('meta[name="pubdate"]') ??
        getMetaContent('meta[name="date"]') ??
        parseJsonLdDate();

      return {
        finalUrl: window.location.href,
        title: document.title.trim(),
        byline,
        publishedDate: normalizeDate(publishedDateSource),
        text,
        html: document.documentElement.outerHTML,
        warnings: text.length < 1500 ? ["Extracted page text was relatively short."] : [],
      };
    },
    { maxTextLength: MAX_TEXT_LENGTH },
  );

  return result;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => { reject(new Error("Browser extraction timed out")); }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function extractWithCloudflareBrowser(
  url: string,
  env: AppEnv,
): Promise<ExtractedPageContent | null> {
  if (!env.BROWSER) return null;

  const { launch: launchCloudflareBrowser } = await import("@cloudflare/playwright");
  const browser = await launchCloudflareBrowser(env.BROWSER);

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 2000 },
    });
    const page = await context.newPage();
    const result = await withTimeout(extractFromPage(page, url), EXTRACT_TIMEOUT_MS);
    await context.close();
    return result;
  } finally {
    await browser.close();
  }
}

async function extractWithLocalBrowser(url: string): Promise<ExtractedPageContent | null> {
  let browser: {
    close(): Promise<unknown>;
    newContext(
      options: unknown,
    ): Promise<{ newPage(): Promise<PageLike>; close(): Promise<unknown> }>;
  } | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 2000 },
    });
    const page = await context.newPage();
    const result = await withTimeout(extractFromPage(page, url), EXTRACT_TIMEOUT_MS);
    await context.close();
    return result;
  } catch (error) {
    console.warn(`Local Playwright extraction failed for ${url}:`, error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function extractPageContent(
  url: string,
  env?: AppEnv,
): Promise<ExtractedPageContent | null> {
  if (env?.BROWSER) {
    try {
      return await extractWithCloudflareBrowser(url, env);
    } catch (error) {
      console.warn(`Cloudflare browser extraction failed for ${url}:`, error);
    }
  }

  return extractWithLocalBrowser(url);
}

export async function extractPageText(url: string, env?: AppEnv): Promise<string | null> {
  const extracted = await extractPageContent(url, env);
  return extracted?.text ?? null;
}

export async function extractPageHtml(url: string, env?: AppEnv): Promise<string | null> {
  const extracted = await extractPageContent(url, env);
  return extracted?.html ?? null;
}
