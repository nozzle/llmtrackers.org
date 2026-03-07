/**
 * LLM-based extraction of structured pricing/feature data from page text.
 * Uses OpenAI's API with structured output (JSON mode).
 */

import { ExtractionResultSchema, type ExtractedPlanLike } from "@llm-tracker/shared";

/**
 * Extracted plan data from a pricing page. Matches our YAML schema shape.
 */
export type ExtractedPlan = ExtractedPlanLike;

export interface ExtractionResult {
  companyName: string;
  plans: ExtractedPlan[];
  rawResponse: string;
}

interface OpenAiChatCompletionResponse {
  choices: {
    message?: {
      content?: string | null;
    };
  }[];
}

const SYSTEM_PROMPT = `You are a data extraction assistant. You will be given the text content of a pricing/features page for an AI search visibility or LLM tracking tool company.

Extract ALL plans/pricing tiers you can find into structured JSON. For each plan, extract:

- name: The plan name
- price: { amount (number or null if custom/enterprise), currency (default "USD"), period ("monthly"/"yearly"/"one-time"), note (any clarifying text or null) }
- aiResponsesMonthly: Number of AI responses/queries per month (null if not stated)
- includedLlmModels: Number of LLM models included (null if not stated)
- schedule: How often data is updated - "daily", "weekly", or "monthly" (null if not stated)
- locationSupport: "global" or a number of regions/locations (null if not stated)
- personaSupport: "unlimited" or a number (null if not stated)
- contentGeneration: Description of content generation features, or false if not offered (null if unclear)
- contentOptimization: Description of content optimization features, or false if not offered (null if unclear)
- integrations: Array of integration names (empty array if none listed)
- llmSupport: Which LLMs are tracked - { chatgpt, gemini, perplexity, claude, llama, grok, aiOverviews, aiMode } as booleans

If a field is not mentioned on the page, use null. If prices are in a non-USD currency, convert approximately and note the original currency in the price note.

Respond ONLY with valid JSON in this exact format:
{
  "companyName": "...",
  "plans": [...]
}`;

/**
 * Call OpenAI API to extract structured data from page text.
 */
export async function extractWithLlm(
  apiKey: string,
  companySlug: string,
  pageText: string,
): Promise<ExtractionResult> {
  const userPrompt = `Extract pricing and feature data for "${companySlug}" from the following page content:\n\n${pageText}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${body}`);
  }

  const data: OpenAiChatCompletionResponse = await response.json();

  const rawResponse = data.choices[0]?.message?.content ?? "{}";

  try {
    const parsedJson = JSON.parse(rawResponse) as unknown;
    const parsed = ExtractionResultSchema.safeParse(parsedJson);

    if (!parsed.success) {
      console.error("Invalid LLM extraction payload:", parsed.error.issues);
      return {
        companyName: companySlug,
        plans: [],
        rawResponse,
      };
    }

    return {
      companyName: parsed.data.companyName,
      plans: parsed.data.plans,
      rawResponse,
    };
  } catch {
    console.error("Failed to parse LLM response:", rawResponse);
    return {
      companyName: companySlug,
      plans: [],
      rawResponse,
    };
  }
}
