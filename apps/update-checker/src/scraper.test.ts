import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPageText } from "./scraper";

describe("fetchPageText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns normalized text content for successful HTML responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => "<html><body><h1>Pricing</h1><p>$99/month</p></body></html>",
      })
    );

    const text = await fetchPageText("https://example.com/pricing");

    expect(text).toContain("Pricing");
    expect(text).toContain("$99/month");
  });

  it("returns null when fetch fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );

    const pending = fetchPageText("https://example.com/pricing");
    await vi.runAllTimersAsync();
    const text = await pending;

    expect(text).toBeNull();
  });

  it("returns null for unsupported content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        text: async () => "not used",
      })
    );

    const text = await fetchPageText("https://example.com/pricing");

    expect(text).toBeNull();
  });

  it("retries transient failures before succeeding", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () => "<p>Recovered</p>",
        })
    );

    const pending = fetchPageText("https://example.com/pricing");
    await vi.runAllTimersAsync();
    const text = await pending;

    expect(text).toContain("Recovered");
  });
});
