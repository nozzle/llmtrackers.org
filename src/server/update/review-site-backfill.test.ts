import { describe, expect, it, vi } from "vitest";
import { backfillCompanyReviewSites } from "./review-site-backfill";

vi.mock("./review-sites", () => ({
  collectReviewSites: vi.fn(),
  diffReviewSites: vi.fn(),
}));

import { collectReviewSites, diffReviewSites } from "./review-sites";

const baseYaml = `slug: test-company
name: Test Company
website: https://example.com/
description: Test description.

plans:
  - name: Starter
    slug: starter
    price:
      amount: 100
      currency: USD
      period: monthly
      note: null
    pricePer1000Responses: 10
    aiResponsesMonthly: 10000
    includedLlmModels: 2
    schedule: daily
    locationSupport: 5
    personaSupport: 1
    contentGeneration: false
    contentOptimization: false
    integrations: []
    llmSupport:
      aiMode: false
      aiOverviews: true
      chatgpt: true
      gemini: false
      perplexity: true
      grok: false
      llama: false
      claude: false

reviewSites:
  trustpilot:
    url: https://www.trustpilot.com/review/example.com
tweets: []
`;

describe("backfillCompanyReviewSites", () => {
  it("returns updated YAML when review-site data changes", async () => {
    vi.mocked(collectReviewSites).mockResolvedValue({
      collected: {
        trustpilot: {
          url: "https://www.trustpilot.com/review/example.com",
          score: 4.3,
          maxScore: 5,
          reviewCount: 12,
          ratingDistribution: [{ label: "5-star", value: 5, count: 9 }],
          reviews: [
            {
              author: "Jane",
              title: "Solid",
              rating: 5,
              date: "2026-03-06",
              excerpt: "Helpful tool",
              url: null,
            },
          ],
        },
      },
      warnings: [],
    });
    vi.mocked(diffReviewSites).mockReturnValue([
      {
        platform: "trustpilot",
        changes: [
          {
            field: "score",
            oldValue: "-",
            newValue: "4.3",
          },
        ],
      },
    ]);

    const result = await backfillCompanyReviewSites(baseYaml);

    expect(result.diffs).toHaveLength(1);
    expect(result.updatedYamlText).toContain("score: 4.3");
    expect(result.updatedYamlText).toContain("reviewCount: 12");
  });

  it("returns original YAML when no review-site diffs exist", async () => {
    vi.mocked(collectReviewSites).mockResolvedValue({ collected: {}, warnings: [] });
    vi.mocked(diffReviewSites).mockReturnValue([]);

    const result = await backfillCompanyReviewSites(baseYaml);

    expect(result.diffs).toEqual([]);
    expect(result.updatedYamlText).toBe(baseYaml);
  });
});
