import { describe, expect, it, vi } from "vitest";
import { deriveSlugFromUrl, extractReviewPrefillWithLlm } from "./review-prefill";

describe("deriveSlugFromUrl", () => {
  it("prefers the article URL slug", () => {
    expect(
      deriveSlugFromUrl(
        "https://saastorm.io/blog/top-llm-performance-tracking-software/",
        "Some Different Title",
      ),
    ).toBe("top-llm-performance-tracking-software");
  });

  it("falls back to the title when the URL path is too generic", () => {
    expect(deriveSlugFromUrl("https://example.com/blog/", "Best LLM Tools 2026")).toBe(
      "best-llm-tools-2026",
    );
  });
});

describe("extractReviewPrefillWithLlm", () => {
  it("returns only matched companies and warns for unmatched tools", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Example Review",
                date: "2026-03-01",
                summary: "Short summary",
                detailedSummary: "Longer summary",
                author: {
                  name: "Author Name",
                  socialProfiles: [{ label: "LinkedIn", url: "https://linkedin.com/in/author" }],
                },
                tools: [
                  {
                    companyName: "Peec AI",
                    score: null,
                    maxScore: null,
                    summary: "Matched summary",
                    directLink: null,
                    pros: ["Affordable"],
                    cons: [],
                    noteworthy: ["Focused"],
                  },
                  {
                    companyName: "Unknown Tool",
                    score: null,
                    maxScore: null,
                    summary: "Should be skipped",
                    directLink: null,
                    pros: [],
                    cons: [],
                    noteworthy: [],
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReviewPrefillWithLlm(
      "test-key",
      "https://example.com/blog/example-review",
      "page text",
      [
        {
          slug: "peec-ai",
          name: "Peec AI",
        },
      ] as never,
    );

    expect(result.review.slug).toBe("example-review");
    expect(result.review.type).toBe("article");
    expect(result.companyRatings).toHaveLength(1);
    expect(result.companyRatings[0]?.companySlug).toBe("peec-ai");
    expect(result.warnings[0]).toContain("Unknown Tool");

    vi.unstubAllGlobals();
  });

  it("applies suggested video metadata when importing from YouTube", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "",
                date: "",
                summary: "Video summary",
                detailedSummary: "Detailed video summary",
                author: {
                  name: "",
                  socialProfiles: [],
                },
                tools: [
                  {
                    companyName: "Scrunch AI",
                    score: null,
                    maxScore: null,
                    summary: "Strong fit for AI visibility monitoring.",
                    directLink: null,
                    pros: ["Strong UX"],
                    cons: [],
                    noteworthy: [],
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await extractReviewPrefillWithLlm(
      "test-key",
      "https://www.youtube.com/watch?v=abc123xyz",
      "video title and transcript",
      [
        {
          slug: "scrunch-ai",
          name: "Scrunch AI",
        },
      ] as never,
      {
        reviewType: "video",
        suggestedDate: "2026-01-19",
        suggestedTitle: "Scrunch AI Review",
        suggestedAuthorName: "Generate More",
        suggestedAuthorProfiles: [
          { label: "YouTube", url: "https://www.youtube.com/@GenerateMoredotAI" },
        ],
        suggestedPrimaryCompanySlug: "scrunch-ai",
        media: {
          provider: "youtube",
          videoId: "abc123xyz",
          watchUrl: "https://www.youtube.com/watch?v=abc123xyz",
          thumbnailUrl: "https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg",
          title: "Scrunch AI Review",
          creator: "Generate More",
          creatorUrl: "https://www.youtube.com/@GenerateMoredotAI",
          durationSeconds: 321,
        },
      },
    );

    expect(result.review.type).toBe("video");
    expect(result.review.date).toBe("2026-01-19");
    expect(result.review.name).toBe("Scrunch AI Review");
    expect(result.review.primaryCompanySlug).toBe("scrunch-ai");
    expect(result.review.media?.videoId).toBe("abc123xyz");
    expect(result.review.author.name).toBe("Generate More");
    expect(result.review.author.socialProfiles[0]?.label).toBe("YouTube");

    vi.unstubAllGlobals();
  });
});
