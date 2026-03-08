import type { Company } from "@llm-tracker/shared";

interface OpenAiChatCompletionResponse {
  choices: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export interface PrefillReviewDraft {
  review: {
    name: string;
    slug: string;
    url: string;
    date: string;
    summary: string;
    detailedSummary: string;
    author: {
      name: string;
      socialProfiles: Array<{ label: string; url: string }>;
    };
  };
  companyRatings: Array<{
    companySlug: string;
    score: number | null;
    maxScore: number | null;
    summary: string;
    directLink: string | null;
    pros: string[];
    cons: string[];
    noteworthy: string[];
  }>;
  warnings: string[];
}

const SYSTEM_PROMPT = `You extract structured review data from an article about LLM tracking, GEO, AI visibility, or answer engine optimization tools.

Return ONLY valid JSON with this exact shape:
{
  "name": string,
  "date": string | "",
  "summary": string,
  "detailedSummary": string,
  "author": {
    "name": string,
    "socialProfiles": [{ "label": string, "url": string }]
  },
  "tools": [
    {
      "companyName": string,
      "score": number | null,
      "maxScore": number | null,
      "summary": string,
      "directLink": string | null,
      "pros": string[],
      "cons": string[],
      "noteworthy": string[]
    }
  ]
}

Rules:
- Use empty string for unknown text fields rather than inventing values.
- The summary should be concise, good for cards/tables.
- The detailedSummary should be 1-2 short paragraphs.
- score and maxScore should be null when the article does not give a numeric score.
- Include only tools clearly discussed in the article.
- Keep pros, cons, and noteworthy to at most 3 short items each.`;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const COMPANY_ALIASES: Record<string, string> = {
  "otterly": "otterly-ai",
  "otterly ai": "otterly-ai",
  "scrunch": "scrunch-ai",
  "peec": "peec-ai",
  "rankscale ai": "rankscale",
  "athena hq": "athenahq",
  "athenahq": "athenahq",
  "waikay by inlinks": "waikay",
  "profound ai": "profound",
};

function normalizeCompanyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function deriveSlugFromUrl(url: string, title: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    const lastSegment = segments.at(-1)?.replace(/\.[a-z0-9]+$/i, "") ?? "";
    const slugFromUrl = slugify(lastSegment);

    if (slugFromUrl && !["blog", "article", "posts", "post", "reviews"].includes(slugFromUrl)) {
      return slugFromUrl;
    }
  } catch {
    // fall through to title
  }

  return slugify(title);
}

function clampHighlights(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function matchCompanySlug(name: string, companies: Company[]): string | null {
  const normalized = normalizeCompanyName(name);

  const aliased = COMPANY_ALIASES[normalized];
  if (aliased && companies.some((company) => company.slug === aliased)) {
    return aliased;
  }

  const exactSlug = companies.find((company) => company.slug === slugify(name));
  if (exactSlug) return exactSlug.slug;

  const exactName = companies.find((company) => normalizeCompanyName(company.name) === normalized);
  if (exactName) return exactName.slug;

  const aliasMatch = companies.find(
    (company) => normalizeCompanyName(company.name).includes(normalized) || normalized.includes(normalizeCompanyName(company.name)),
  );
  return aliasMatch?.slug ?? null;
}

export async function extractReviewPrefillWithLlm(
  apiKey: string,
  pageUrl: string,
  pageText: string,
  companies: Company[],
): Promise<PrefillReviewDraft> {
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
        {
          role: "user",
          content: `Extract review article data from this URL and content. URL: ${pageUrl}\n\n${pageText}`,
        },
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
  const parsedJson = JSON.parse(rawResponse) as Record<string, unknown>;

  const rawTools = Array.isArray(parsedJson.tools) ? parsedJson.tools : [];
  const warnings: string[] = [];
  const skippedTools: string[] = [];

  const companyRatings = rawTools
    .map((tool) => {
      if (!tool || typeof tool !== "object") return null;

      const t = tool as Record<string, unknown>;
      const companyName = typeof t.companyName === "string" ? t.companyName.trim() : "";
      if (!companyName) return null;

      const matchedSlug = matchCompanySlug(companyName, companies);
      if (!matchedSlug) {
        skippedTools.push(companyName);
        return null;
      }

      const score = typeof t.score === "number" ? t.score : null;
      const maxScore = typeof t.maxScore === "number" ? t.maxScore : null;

      return {
        companySlug: matchedSlug,
        score,
        maxScore,
        summary: typeof t.summary === "string" ? t.summary.trim() : "",
        directLink: typeof t.directLink === "string" && t.directLink.trim() ? t.directLink.trim() : null,
        pros: clampHighlights(t.pros),
        cons: clampHighlights(t.cons),
        noteworthy: clampHighlights(t.noteworthy),
      };
    })
    .filter((tool): tool is NonNullable<typeof tool> => tool !== null)
    .filter((tool) => tool.summary.length > 0);

  if (skippedTools.length > 0) {
    warnings.push(`Skipped ${skippedTools.length} unmatched tool${skippedTools.length === 1 ? "" : "s"}: ${skippedTools.join(", ")}`);
  }

  if (companyRatings.length === 0) {
    warnings.push("No tracked companies were matched from this article. Review details were imported, but tool coverage must be added manually.");
  }

  const authorRecord =
    parsedJson.author && typeof parsedJson.author === "object"
      ? (parsedJson.author as Record<string, unknown>)
      : null;

  const socialProfiles = Array.isArray(authorRecord?.socialProfiles)
    ? authorRecord.socialProfiles
        .filter(
          (profile): profile is { label: string; url: string } =>
            typeof profile === "object" &&
            profile !== null &&
            typeof (profile as Record<string, unknown>).label === "string" &&
            typeof (profile as Record<string, unknown>).url === "string",
        )
        .map((profile) => ({
          label: profile.label.trim(),
          url: profile.url.trim(),
        }))
        .filter((profile) => profile.label.length > 0 && profile.url.length > 0)
    : [];

  const review = {
    name: typeof parsedJson.name === "string" ? parsedJson.name.trim() : "",
    slug: deriveSlugFromUrl(pageUrl, typeof parsedJson.name === "string" ? parsedJson.name : ""),
    url: pageUrl,
    date: isValidDate(parsedJson.date) ? parsedJson.date : "",
    summary: typeof parsedJson.summary === "string" ? parsedJson.summary.trim() : "",
    detailedSummary:
      typeof parsedJson.detailedSummary === "string" ? parsedJson.detailedSummary.trim() : "",
    author: {
      name: typeof authorRecord?.name === "string" ? authorRecord.name.trim() : "",
      socialProfiles,
    },
  };

  return { review, companyRatings, warnings };
}
