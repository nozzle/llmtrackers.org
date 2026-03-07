import { describe, expect, it } from "vitest";
import { diffCompany } from "./differ";
import type { ExtractedPlan } from "./extractor";

const company = {
  slug: "test-company",
  name: "Test Company",
  plans: [
    {
      name: "Starter",
      slug: "starter",
      price: { amount: 100, currency: "USD", period: "monthly", note: null },
      aiResponsesMonthly: 10000,
      includedLlmModels: 2,
      schedule: "daily",
      locationSupport: 5,
      personaSupport: 1,
      contentGeneration: false,
      contentOptimization: false,
      integrations: ["GA4"],
      llmSupport: {
        chatgpt: true,
        gemini: false,
        perplexity: true,
        claude: false,
        llama: false,
        grok: false,
        aiOverviews: true,
        aiMode: false,
      },
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      price: { amount: null, currency: "USD", period: "monthly", note: null },
      aiResponsesMonthly: null,
      includedLlmModels: null,
      schedule: "weekly",
      locationSupport: "global",
      personaSupport: "unlimited",
      contentGeneration: "Custom",
      contentOptimization: "Custom",
      integrations: [],
      llmSupport: {
        chatgpt: true,
        gemini: true,
        perplexity: true,
        claude: true,
        llama: false,
        grok: false,
        aiOverviews: true,
        aiMode: true,
      },
    },
  ],
} satisfies Parameters<typeof diffCompany>[0];

describe("diffCompany", () => {
  it("detects updated, new, and removed plans", () => {
    const extracted: ExtractedPlan[] = [
      {
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
          chatgpt: true,
          gemini: true,
          perplexity: true,
          claude: false,
          llama: false,
          grok: false,
          aiOverviews: true,
          aiMode: false,
        },
      },
      {
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
          chatgpt: true,
          gemini: true,
          perplexity: true,
          claude: true,
          llama: false,
          grok: true,
          aiOverviews: true,
          aiMode: true,
        },
      },
    ];

    const diffs = diffCompany(company, extracted);

    expect(diffs).toHaveLength(3);
    expect(diffs[0]?.planName).toBe("Starter");
    expect(diffs[0]?.changes.some((change) => change.field === "price.amount")).toBe(true);
    expect(diffs[0]?.changes.some((change) => change.field === "llmSupport.gemini")).toBe(true);
    expect(diffs[1]?.changes[0]?.field).toBe("(new plan)");
    expect(diffs[2]?.changes[0]?.field).toBe("(removed plan)");
  });
});
