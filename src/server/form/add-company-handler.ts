/**
 * Add-company suggestion handler for LLM Trackers.
 *
 * Accepts a full new company payload (with plans), creates a new YAML file
 * on a branch, and opens a PR.
 */

import {
  createAppJwt,
  getInstallationToken,
  getFileContent,
  getDefaultBranchSha,
  createBranch,
  upsertFile,
  createPullRequest,
} from "@llm-tracker/github";
import {
  stringifyCompanyYaml,
  CompanySchema,
  LLM_MODEL_LABELS,
  type LlmModelKey,
  type CompanyYamlValue,
  type Plan,
} from "@llm-tracker/shared";

// ---- Types ----

export interface AddCompanyPayload {
  company: NewCompanyData;
  contributor?: {
    name?: string;
    email?: string;
    company?: string;
  };
  turnstileToken?: string;
  /** Honeypot field for spam detection */
  website?: string;
}

export interface NewCompanyData {
  slug: string;
  name: string;
  website: string;
  description: string;
  pricingUrl?: string | null;
  featuresUrl?: string | null;
  plans: NewCompanyPlan[];
}

export interface NewCompanyPlan {
  name: string;
  slug: string;
  price: {
    amount: number | null;
    currency: string;
    period: "monthly" | "yearly" | "one-time";
    note?: string | null;
  };
  aiResponsesMonthly?: number | null;
  schedule: "daily" | "weekly" | "monthly";
  locationSupport: "global" | number;
  personaSupport: "unlimited" | number;
  contentGeneration: string | false;
  contentOptimization: string | false;
  integrations: string[];
  llmSupport: Record<LlmModelKey, boolean>;
}

interface GitHubEnv {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

// ---- Validation ----

const VALID_PERIODS = ["monthly", "yearly", "one-time"];
const VALID_SCHEDULES = ["daily", "weekly", "monthly"];
const VALID_LLM_KEYS: LlmModelKey[] = [
  "aiMode",
  "aiOverviews",
  "chatgpt",
  "gemini",
  "perplexity",
  "grok",
  "llama",
  "claude",
];

export function validateAddCompanyPayload(
  data: unknown,
): { ok: true; value: AddCompanyPayload } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const d = data as Record<string, unknown>;

  if (!d.company || typeof d.company !== "object") {
    return { ok: false, error: "company must be an object" };
  }

  // Honeypot
  if (typeof d.website === "string" && d.website.trim().length > 0) {
    return { ok: false, error: "Spam submission rejected" };
  }

  // Validate contributor if present
  if (d.contributor !== undefined) {
    if (typeof d.contributor !== "object" || d.contributor === null) {
      return { ok: false, error: "contributor must be an object" };
    }
    const c = d.contributor as Record<string, unknown>;
    if (c.name !== undefined && typeof c.name !== "string") {
      return { ok: false, error: "contributor.name must be a string" };
    }
    if (c.email !== undefined && typeof c.email !== "string") {
      return { ok: false, error: "contributor.email must be a string" };
    }
    if (c.company !== undefined && typeof c.company !== "string") {
      return { ok: false, error: "contributor.company must be a string" };
    }
  }

  if (d.turnstileToken !== undefined && typeof d.turnstileToken !== "string") {
    return { ok: false, error: "turnstileToken must be a string" };
  }

  const companyResult = validateNewCompanyData(d.company as Record<string, unknown>);
  if (!companyResult.ok) return companyResult;

  return {
    ok: true,
    value: {
      company: companyResult.value,
      contributor: d.contributor as AddCompanyPayload["contributor"],
      turnstileToken: d.turnstileToken,
      website: d.website as string | undefined,
    },
  };
}

function validateNewCompanyData(
  raw: Record<string, unknown>,
): { ok: true; value: NewCompanyData } | { ok: false; error: string } {
  if (typeof raw.slug !== "string" || raw.slug.trim().length === 0) {
    return { ok: false, error: "company.slug is required" };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug)) {
    return { ok: false, error: "company.slug must be lowercase alphanumeric with hyphens" };
  }
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return { ok: false, error: "company.name is required" };
  }
  if (typeof raw.website !== "string" || raw.website.trim().length === 0) {
    return { ok: false, error: "company.website is required" };
  }
  try {
    new URL(raw.website);
  } catch {
    return { ok: false, error: "company.website must be a valid URL" };
  }
  if (typeof raw.description !== "string" || raw.description.trim().length === 0) {
    return { ok: false, error: "company.description is required" };
  }

  // pricingUrl
  if (raw.pricingUrl !== undefined && raw.pricingUrl !== null) {
    if (typeof raw.pricingUrl !== "string") {
      return { ok: false, error: "company.pricingUrl must be a string or null" };
    }
    if (raw.pricingUrl.trim().length > 0) {
      try {
        new URL(raw.pricingUrl);
      } catch {
        return { ok: false, error: "company.pricingUrl must be a valid URL" };
      }
    }
  }

  // featuresUrl
  if (raw.featuresUrl !== undefined && raw.featuresUrl !== null) {
    if (typeof raw.featuresUrl !== "string") {
      return { ok: false, error: "company.featuresUrl must be a string or null" };
    }
    if (raw.featuresUrl.trim().length > 0) {
      try {
        new URL(raw.featuresUrl);
      } catch {
        return { ok: false, error: "company.featuresUrl must be a valid URL" };
      }
    }
  }

  // Plans
  if (!Array.isArray(raw.plans) || raw.plans.length === 0) {
    return { ok: false, error: "company.plans must be a non-empty array" };
  }

  const plans: NewCompanyPlan[] = [];
  for (let i = 0; i < raw.plans.length; i++) {
    const planRaw: unknown = raw.plans[i];
    if (!planRaw || typeof planRaw !== "object") {
      return { ok: false, error: `company.plans[${i}] must be an object` };
    }
    const planResult = validateNewCompanyPlan(planRaw as Record<string, unknown>, i);
    if (!planResult.ok) return planResult;
    plans.push(planResult.value);
  }

  // Check for duplicate slugs
  const slugs = new Set<string>();
  for (const plan of plans) {
    if (slugs.has(plan.slug)) {
      return { ok: false, error: `Duplicate plan slug: '${plan.slug}'` };
    }
    slugs.add(plan.slug);
  }

  return {
    ok: true,
    value: {
      slug: raw.slug.trim(),
      name: raw.name.trim(),
      website: raw.website.trim(),
      description: raw.description.trim(),
      pricingUrl:
        raw.pricingUrl !== undefined && raw.pricingUrl !== null
          ? raw.pricingUrl.trim() || null
          : null,
      featuresUrl:
        raw.featuresUrl !== undefined && raw.featuresUrl !== null
          ? raw.featuresUrl.trim() || null
          : null,
      plans,
    },
  };
}

function validateNewCompanyPlan(
  raw: Record<string, unknown>,
  index: number,
): { ok: true; value: NewCompanyPlan } | { ok: false; error: string } {
  const prefix = `company.plans[${index}]`;

  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return { ok: false, error: `${prefix}.name is required` };
  }
  if (typeof raw.slug !== "string" || raw.slug.trim().length === 0) {
    return { ok: false, error: `${prefix}.slug is required` };
  }

  // Price
  if (!raw.price || typeof raw.price !== "object") {
    return { ok: false, error: `${prefix}.price is required` };
  }
  const p = raw.price as Record<string, unknown>;
  if (p.amount !== null && typeof p.amount !== "number") {
    return { ok: false, error: `${prefix}.price.amount must be a number or null` };
  }
  if (typeof p.currency !== "string") {
    return { ok: false, error: `${prefix}.price.currency must be a string` };
  }
  if (!VALID_PERIODS.includes(p.period as string)) {
    return { ok: false, error: `${prefix}.price.period must be monthly, yearly, or one-time` };
  }

  if (!VALID_SCHEDULES.includes(raw.schedule as string)) {
    return { ok: false, error: `${prefix}.schedule must be daily, weekly, or monthly` };
  }

  if (raw.locationSupport !== "global" && typeof raw.locationSupport !== "number") {
    return { ok: false, error: `${prefix}.locationSupport must be "global" or a number` };
  }

  if (raw.personaSupport !== "unlimited" && typeof raw.personaSupport !== "number") {
    return { ok: false, error: `${prefix}.personaSupport must be "unlimited" or a number` };
  }

  if (raw.contentGeneration !== false && typeof raw.contentGeneration !== "string") {
    return { ok: false, error: `${prefix}.contentGeneration must be a string or false` };
  }

  if (raw.contentOptimization !== false && typeof raw.contentOptimization !== "string") {
    return { ok: false, error: `${prefix}.contentOptimization must be a string or false` };
  }

  if (!Array.isArray(raw.integrations) || !raw.integrations.every((i) => typeof i === "string")) {
    return { ok: false, error: `${prefix}.integrations must be an array of strings` };
  }

  if (!raw.llmSupport || typeof raw.llmSupport !== "object") {
    return { ok: false, error: `${prefix}.llmSupport is required` };
  }
  const ls = raw.llmSupport as Record<string, unknown>;
  for (const [key, val] of Object.entries(ls)) {
    if (!VALID_LLM_KEYS.includes(key as LlmModelKey)) {
      return { ok: false, error: `${prefix}.llmSupport.${key} is not a valid LLM model key` };
    }
    if (typeof val !== "boolean") {
      return { ok: false, error: `${prefix}.llmSupport.${key} must be a boolean` };
    }
  }

  return {
    ok: true,
    value: {
      name: raw.name.trim(),
      slug: raw.slug.trim(),
      price: {
        amount: p.amount,
        currency: p.currency,
        period: p.period as "monthly" | "yearly" | "one-time",
        note: (p.note as string | null | undefined) ?? null,
      },
      aiResponsesMonthly: (raw.aiResponsesMonthly as number | null | undefined) ?? null,
      schedule: raw.schedule as "daily" | "weekly" | "monthly",
      locationSupport: raw.locationSupport,
      personaSupport: raw.personaSupport,
      contentGeneration: raw.contentGeneration,
      contentOptimization: raw.contentOptimization,
      integrations: raw.integrations,
      llmSupport: ls as Record<LlmModelKey, boolean>,
    },
  };
}

// ---- Core logic ----

const LLM_KEYS: LlmModelKey[] = [
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "llama",
  "grok",
  "aiOverviews",
  "aiMode",
];

function normalizeLlmSupport(
  llmSupport: Partial<Record<LlmModelKey, boolean>>,
): Record<LlmModelKey, boolean> {
  return Object.fromEntries(LLM_KEYS.map((key) => [key, llmSupport[key] ?? false])) as Record<
    LlmModelKey,
    boolean
  >;
}

export async function handleAddCompany(
  payload: AddCompanyPayload,
  env: GitHubEnv,
): Promise<
  | { success: true; prUrl: string; prNumber: number }
  | { success: false; error: string; status: number }
> {
  const { company: newData, contributor } = payload;

  // 1. Authenticate
  const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;

  // 2. Check that the YAML file doesn't already exist
  const filePath = `data/companies/${newData.slug}.yaml`;
  const existing = await getFileContent(token, owner, repo, filePath);
  if (existing) {
    return { success: false, error: `Company '${newData.slug}' already exists`, status: 409 };
  }

  // 3. Build the full company object
  const plans: Plan[] = newData.plans.map((p) => {
    const priceAmount = p.price.amount;
    const aiResponses = p.aiResponsesMonthly;
    const pricePer1000Responses =
      priceAmount !== null && aiResponses !== null && aiResponses !== undefined && aiResponses > 0
        ? Number(((priceAmount / aiResponses) * 1000).toFixed(2))
        : null;

    return {
      name: p.name,
      slug: p.slug,
      price: {
        amount: p.price.amount,
        currency: p.price.currency,
        period: p.price.period,
        note: p.price.note ?? null,
      },
      pricePer1000Responses,
      aiResponsesMonthly: p.aiResponsesMonthly ?? null,
      includedLlmModels: null,
      schedule: p.schedule,
      locationSupport: p.locationSupport,
      personaSupport: p.personaSupport,
      contentGeneration: p.contentGeneration,
      contentOptimization: p.contentOptimization,
      integrations: p.integrations,
      llmSupport: normalizeLlmSupport(p.llmSupport),
    };
  });

  const companyObj: CompanyYamlValue = {
    slug: newData.slug,
    name: newData.name,
    defunct: false,
    website: newData.website,
    description: newData.description,
    plans,
    reviewSites: {},
    tweets: [],
    ...(newData.pricingUrl ? { pricingUrl: newData.pricingUrl } : {}),
    ...(newData.featuresUrl ? { featuresUrl: newData.featuresUrl } : {}),
    screenshotSources: [],
    screenshots: [],
    videos: [],
  };

  // 4. Validate
  const validation = CompanySchema.safeParse(companyObj);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid company: ${validation.error.issues.map((i) => i.message).join("; ")}`,
      status: 400,
    };
  }

  // 5. Serialize
  const yaml = stringifyCompanyYaml(companyObj);

  // 6. Create branch and PR
  const timestamp = Date.now();
  const branchName = `suggest-add-company/${newData.slug}-${timestamp}`;

  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(token, owner, repo);
  await createBranch(token, owner, repo, branchName, baseSha);

  const commitMessage = `suggest: add new company "${newData.name}"`;
  await upsertFile(token, owner, repo, filePath, yaml, commitMessage, branchName);

  const summaryTable = buildCompanySummaryTable(companyObj);
  const prTitle = `[Suggestion] Add new company: ${newData.name}`;
  const prBody = buildAddCompanyPrBody(newData.name, summaryTable, plans, contributor);

  const pr = await createPullRequest(
    token,
    owner,
    repo,
    prTitle,
    prBody,
    branchName,
    defaultBranch,
  );

  return { success: true, prUrl: pr.html_url, prNumber: pr.number };
}

// ---- Helpers ----

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "*none*";
  if (value === false) return "No";
  if (value === true) return "Yes";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return typeof value === "string" ? value : JSON.stringify(value);
}

function buildCompanySummaryTable(company: CompanyYamlValue): string {
  const rows: [string, string][] = [
    ["Slug", company.slug],
    ["Name", company.name],
    ["Website", company.website],
    ["Description", company.description],
    ["Plans", String(company.plans.length)],
  ];

  if (company.pricingUrl) rows.push(["Pricing URL", company.pricingUrl]);
  if (company.featuresUrl) rows.push(["Features URL", company.featuresUrl]);

  const lines = [
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([field, value]) => `| ${field} | ${value} |`),
  ];

  return lines.join("\n");
}

function buildPlanSummaryTable(plan: Plan): string {
  const rows: [string, string][] = [
    [
      "Price",
      plan.price.amount !== null ? `$${plan.price.amount.toLocaleString("en-US")}` : "Custom",
    ],
    ["Billing Period", plan.price.period],
    ["AI Responses/mo", formatValue(plan.aiResponsesMonthly)],
    ["Schedule", plan.schedule],
    ["Location Support", formatValue(plan.locationSupport)],
    ["Persona Support", formatValue(plan.personaSupport)],
    ["Content Generation", formatValue(plan.contentGeneration)],
    ["Content Optimization", formatValue(plan.contentOptimization)],
    ["Integrations", plan.integrations.join(", ") || "*none*"],
  ];

  const supportedLlms = LLM_KEYS.filter((k) => plan.llmSupport[k]);
  rows.push(["LLM Support", supportedLlms.map((k) => LLM_MODEL_LABELS[k]).join(", ") || "*none*"]);

  const lines = [
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([field, value]) => `| ${field} | ${value} |`),
  ];

  return lines.join("\n");
}

function buildAddCompanyPrBody(
  companyName: string,
  companyTable: string,
  plans: Plan[],
  contributor?: AddCompanyPayload["contributor"],
): string {
  const lines: string[] = [
    `## Suggested New Company: ${companyName}`,
    "",
    "### Company Info",
    "",
    companyTable,
    "",
  ];

  for (const plan of plans) {
    lines.push(`### Plan: ${plan.name}`, "", buildPlanSummaryTable(plan), "");
  }

  if (contributor?.name || contributor?.email || contributor?.company) {
    lines.push("### Contributor");
    if (contributor.name) lines.push(`- **Name:** ${contributor.name}`);
    if (contributor.email) lines.push(`- **Email:** ${contributor.email}`);
    if (contributor.company) lines.push(`- **Company:** ${contributor.company}`);
    lines.push("");
  }

  lines.push("---", "*Submitted via the LLM Trackers website.*");

  return lines.join("\n");
}
