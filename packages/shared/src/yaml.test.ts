import { describe, expect, it } from "vitest";
import {
  mergeCompanyWithExtractedPlans,
  mergeCompanyWithReviewSites,
  parseCompanyYaml,
  prepareUpdatedCompanyYaml,
  prepareUpdatedCompanyReviewSitesYaml,
  type ExtractedPlanLike,
} from "./yaml.js";

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
    integrations:
      - GA4
    llmSupport:
      aiMode: false
      aiOverviews: true
      chatgpt: true
      gemini: false
      perplexity: true
      grok: false
      llama: false
      claude: false

  - name: Enterprise
    slug: enterprise
    price:
      amount: null
      currency: USD
      period: monthly
      note: null
    pricePer1000Responses: null
    aiResponsesMonthly: null
    includedLlmModels: null
    schedule: weekly
    locationSupport: global
    personaSupport: unlimited
    contentGeneration: "Custom"
    contentOptimization: "Custom"
    integrations: []
    llmSupport:
      aiMode: true
      aiOverviews: true
      chatgpt: true
      gemini: true
      perplexity: true
      grok: false
      llama: false
      claude: true

reviews: []
tweets: []
pricingUrl: https://example.com/pricing
featuresUrl: https://example.com/features
lastChecked: "2025-01-01"
`;

const starterUpdate: ExtractedPlanLike = {
  name: "Starter",
  price: { amount: 120, currency: "USD", period: "monthly", note: null },
  aiResponsesMonthly: 12000,
  includedLlmModels: 3,
  schedule: "daily",
  locationSupport: 10,
  personaSupport: 2,
  contentGeneration: false,
  contentOptimization: false,
  integrations: ["GA4", "Search Console"],
  llmSupport: {
    aiMode: false,
    aiOverviews: true,
    chatgpt: true,
    gemini: true,
    perplexity: true,
    grok: false,
    llama: false,
    claude: false,
  },
};

const newPlan: ExtractedPlanLike = {
  name: "Growth",
  price: { amount: 300, currency: "USD", period: "monthly", note: "Intro" },
  aiResponsesMonthly: 50000,
  includedLlmModels: 6,
  schedule: "weekly",
  locationSupport: "global",
  personaSupport: "unlimited",
  contentGeneration: "Unlimited",
  contentOptimization: "Unlimited",
  integrations: ["GA4", "BigQuery"],
  llmSupport: {
    aiMode: true,
    aiOverviews: true,
    chatgpt: true,
    gemini: true,
    perplexity: true,
    grok: true,
    llama: false,
    claude: true,
  },
};

describe("yaml helpers", () => {
  it("mergeCompanyWithExtractedPlans preserves existing order and appends new plans", () => {
    const { company } = parseCompanyYaml(baseYaml);
    const merged = mergeCompanyWithExtractedPlans(company, [starterUpdate, newPlan], "2025-03-06");

    expect(merged.plans.map((plan) => plan.name)).toEqual([
      "Starter",
      "Enterprise",
      "Growth",
    ]);
    expect(merged.plans[0]?.price.amount).toBe(120);
    expect(merged.plans[0]?.pricePer1000Responses).toBe(10);
    expect(merged.plans[2]?.slug).toBe("growth");
    expect(merged.lastChecked).toBe("2025-03-06");
  });

  it("prepareUpdatedCompanyYaml produces parseable YAML and preserves missing extracted plans", () => {
    const prepared = prepareUpdatedCompanyYaml(baseYaml, [starterUpdate], "2025-03-06");

    expect(prepared.yamlText).toMatch(/lastChecked: 2025-03-06/);
    expect(prepared.company.plans.map((plan) => plan.name)).toEqual([
      "Starter",
      "Enterprise",
    ]);
    expect(prepared.company.plans[1]?.slug).toBe("enterprise");
  });

  it("mergeCompanyWithReviewSites preserves existing data when incoming review-site data is partial", () => {
    const withReviewSitesYaml = `${baseYaml}\nreviewSites:\n  trustpilot:\n    url: https://www.trustpilot.com/review/example.com\n    score: 4.2\n    maxScore: 5\n    reviewCount: 40\n    ratingDistribution:\n      - label: "1"\n        value: 1\n        count: 2\n    reviews:\n      - author: Jane\n        title: Great\n        rating: 5\n        date: 2026-03-01\n        excerpt: Helpful tool\n        url: https://www.trustpilot.com/reviews/1\n`;
    const { company } = parseCompanyYaml(withReviewSitesYaml);

    const merged = mergeCompanyWithReviewSites(company, {
      trustpilot: {
        url: "https://www.trustpilot.com/review/example.com",
        score: 4.4,
        maxScore: 5,
        reviewCount: null,
        ratingDistribution: [],
        reviews: [],
      },
    });

    expect(merged.reviewSites.trustpilot?.score).toBe(4.4);
    expect(merged.reviewSites.trustpilot?.reviewCount).toBe(40);
    expect(merged.reviewSites.trustpilot?.ratingDistribution).toHaveLength(1);
    expect(merged.reviewSites.trustpilot?.reviews).toHaveLength(1);
  });

  it("prepareUpdatedCompanyReviewSitesYaml produces parseable YAML with reviewSites preserved", () => {
    const prepared = prepareUpdatedCompanyReviewSitesYaml(baseYaml, {
      trustpilot: {
        url: "https://www.trustpilot.com/review/example.com",
        score: 4.2,
        maxScore: 5,
        reviewCount: 42,
        ratingDistribution: [
          { label: "1", value: 1, count: 1 },
          { label: "5", value: 5, count: 41 },
        ],
        reviews: [
          {
            author: "Jane",
            title: "Great",
            rating: 5,
            date: "2026-03-01",
            excerpt: "Helpful tool",
            url: "https://www.trustpilot.com/reviews/1",
          },
        ],
      },
    });

    expect(prepared.yamlText).toMatch(/reviewSites:/);
    expect(prepared.company.reviewSites.trustpilot?.reviewCount).toBe(42);
    expect(prepared.company.reviewSites.trustpilot?.reviews[0]?.excerpt).toBe(
      "Helpful tool"
    );
  });
});
