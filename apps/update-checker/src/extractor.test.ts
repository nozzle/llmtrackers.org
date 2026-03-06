import { describe, expect, it, vi } from "vitest";
import { extractWithLlm } from "./extractor";

describe("extractWithLlm", () => {
  it("returns validated plans for a valid LLM payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                companyName: "Test Company",
                plans: [
                  {
                    name: "Starter",
                    price: {
                      amount: 99,
                      currency: "USD",
                      period: "monthly",
                      note: null,
                    },
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
                ],
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await extractWithLlm("test-key", "test-company", "page text");

    expect(result.companyName).toBe("Test Company");
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.name).toBe("Starter");

    vi.unstubAllGlobals();
  });

  it("returns no plans for an invalid LLM payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                companyName: "Test Company",
                plans: [
                  {
                    name: "Starter",
                    price: "bad-value",
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await extractWithLlm("test-key", "test-company", "page text");

    expect(result.companyName).toBe("test-company");
    expect(result.plans).toHaveLength(0);

    vi.unstubAllGlobals();
  });
});
