import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPageText } from "./scraper";

describe("fetchPageText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns normalized text content for successful HTML responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<html><body><h1>Pricing</h1><p>$99/month</p></body></html>",
      })
    );

    const text = await fetchPageText("https://example.com/pricing");

    expect(text).toContain("Pricing");
    expect(text).toContain("$99/month");
  });

  it("returns null when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );

    const text = await fetchPageText("https://example.com/pricing");

    expect(text).toBeNull();
  });
});
