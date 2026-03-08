import { beforeEach, describe, expect, it, vi } from "vitest";

const extractPageTextMock = vi.fn<(url: string) => Promise<string | null>>();
const extractPageHtmlMock = vi.fn<(url: string) => Promise<string | null>>();

vi.mock("../browser/extract-page", () => ({
  extractPageContent: vi.fn(),
  extractPageText: (url: string) => extractPageTextMock(url),
  extractPageHtml: (url: string) => extractPageHtmlMock(url),
}));

describe("scraper compatibility wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    extractPageTextMock.mockReset();
    extractPageHtmlMock.mockReset();
  });

  it("forwards fetchPageText to browser extraction", async () => {
    extractPageTextMock.mockResolvedValue("Pricing $99/month");
    const { fetchPageText } = await import("./scraper");

    const text = await fetchPageText("https://example.com/pricing");

    expect(text).toBe("Pricing $99/month");
    expect(extractPageTextMock).toHaveBeenCalledWith("https://example.com/pricing");
  });

  it("forwards fetchPageHtml to browser extraction", async () => {
    extractPageHtmlMock.mockResolvedValue("<html><body><h1>Raw</h1></body></html>");
    const { fetchPageHtml } = await import("./scraper");

    const html = await fetchPageHtml("https://example.com/raw");

    expect(html).toContain("<h1>Raw</h1>");
    expect(extractPageHtmlMock).toHaveBeenCalledWith("https://example.com/raw");
  });

  it("returns null when browser extraction returns null", async () => {
    extractPageTextMock.mockResolvedValue(null);
    const { fetchPageText } = await import("./scraper");

    const text = await fetchPageText("https://example.com/missing");

    expect(text).toBeNull();
  });
});
