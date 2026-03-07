import { afterEach, describe, expect, it, vi } from "vitest";
import { findOpenPullRequestByHead } from "@llm-tracker/github";

describe("findOpenPullRequestByHead", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the first matching open pull request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ html_url: "https://example.com/pr/1", number: 1 }],
      }),
    );

    const result = await findOpenPullRequestByHead(
      "token",
      "nozzle",
      "llm-tracker-comparison",
      "auto-update/test-company",
    );

    expect(result?.number).toBe(1);
    expect(result?.html_url).toBe("https://example.com/pr/1");
  });

  it("returns null when no matching open pull request exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    const result = await findOpenPullRequestByHead(
      "token",
      "nozzle",
      "llm-tracker-comparison",
      "auto-update/test-company",
    );

    expect(result).toBeNull();
  });
});
