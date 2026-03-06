import { describe, expect, it } from "vitest";
import {
  mergeCompanyWithExtractedPlans,
  parseCompanyYaml,
  prepareUpdatedCompanyYaml,
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
});
