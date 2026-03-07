/**
 * Add-plan suggestion handler for LLM Trackers.
 *
 * Accepts a full new plan payload for an existing company, fetches the current
 * YAML from GitHub, appends the plan, validates, and creates a PR.
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
  parseCompanyYaml,
  stringifyCompanyYaml,
  PlanSchema,
  LLM_MODEL_LABELS,
  type LlmModelKey,
  type Plan,
} from "@llm-tracker/shared";

// ---- Types ----

export interface AddPlanPayload {
  companySlug: string;
  plan: NewPlanData;
  contributor?: {
    name?: string;
    email?: string;
    company?: string;
  };
  turnstileToken?: string;
  /** Honeypot field for spam detection */
  website?: string;
}

export interface NewPlanData {
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
  "aiMode", "aiOverviews", "chatgpt", "gemini",
  "perplexity", "grok", "llama", "claude",
];

export function validateAddPlanPayload(
  data: unknown
): { ok: true; value: AddPlanPayload } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const d = data as Record<string, unknown>;

  if (typeof d.companySlug !== "string" || d.companySlug.trim().length === 0) {
    return { ok: false, error: "companySlug is required" };
  }
  if (!d.plan || typeof d.plan !== "object") {
    return { ok: false, error: "plan must be an object" };
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

  const planResult = validateNewPlanData(d.plan as Record<string, unknown>);
  if (!planResult.ok) return planResult;

  return {
    ok: true,
    value: {
      companySlug: (d.companySlug as string).trim(),
      plan: planResult.value,
      contributor: d.contributor as AddPlanPayload["contributor"],
      turnstileToken: d.turnstileToken as string | undefined,
      website: d.website as string | undefined,
    },
  };
}

function validateNewPlanData(
  raw: Record<string, unknown>
): { ok: true; value: NewPlanData } | { ok: false; error: string } {
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return { ok: false, error: "plan.name is required" };
  }
  if (typeof raw.slug !== "string" || raw.slug.trim().length === 0) {
    return { ok: false, error: "plan.slug is required" };
  }

  // Price
  if (!raw.price || typeof raw.price !== "object") {
    return { ok: false, error: "plan.price is required" };
  }
  const p = raw.price as Record<string, unknown>;
  if (p.amount !== null && typeof p.amount !== "number") {
    return { ok: false, error: "plan.price.amount must be a number or null" };
  }
  if (typeof p.currency !== "string") {
    return { ok: false, error: "plan.price.currency must be a string" };
  }
  if (!VALID_PERIODS.includes(p.period as string)) {
    return { ok: false, error: "plan.price.period must be monthly, yearly, or one-time" };
  }

  // Schedule
  if (!VALID_SCHEDULES.includes(raw.schedule as string)) {
    return { ok: false, error: "plan.schedule must be daily, weekly, or monthly" };
  }

  // Location support
  if (raw.locationSupport !== "global" && typeof raw.locationSupport !== "number") {
    return { ok: false, error: 'plan.locationSupport must be "global" or a number' };
  }

  // Persona support
  if (raw.personaSupport !== "unlimited" && typeof raw.personaSupport !== "number") {
    return { ok: false, error: 'plan.personaSupport must be "unlimited" or a number' };
  }

  // Content generation
  if (raw.contentGeneration !== false && typeof raw.contentGeneration !== "string") {
    return { ok: false, error: "plan.contentGeneration must be a string or false" };
  }

  // Content optimization
  if (raw.contentOptimization !== false && typeof raw.contentOptimization !== "string") {
    return { ok: false, error: "plan.contentOptimization must be a string or false" };
  }

  // Integrations
  if (!Array.isArray(raw.integrations) || !raw.integrations.every((i) => typeof i === "string")) {
    return { ok: false, error: "plan.integrations must be an array of strings" };
  }

  // LLM Support
  if (!raw.llmSupport || typeof raw.llmSupport !== "object") {
    return { ok: false, error: "plan.llmSupport is required" };
  }
  const ls = raw.llmSupport as Record<string, unknown>;
  for (const [key, val] of Object.entries(ls)) {
    if (!VALID_LLM_KEYS.includes(key as LlmModelKey)) {
      return { ok: false, error: `plan.llmSupport.${key} is not a valid LLM model key` };
    }
    if (typeof val !== "boolean") {
      return { ok: false, error: `plan.llmSupport.${key} must be a boolean` };
    }
  }

  return {
    ok: true,
    value: {
      name: (raw.name as string).trim(),
      slug: (raw.slug as string).trim(),
      price: {
        amount: p.amount as number | null,
        currency: p.currency as string,
        period: p.period as "monthly" | "yearly" | "one-time",
        note: (p.note as string | null | undefined) ?? null,
      },
      aiResponsesMonthly: (raw.aiResponsesMonthly as number | null | undefined) ?? null,
      schedule: raw.schedule as "daily" | "weekly" | "monthly",
      locationSupport: raw.locationSupport as "global" | number,
      personaSupport: raw.personaSupport as "unlimited" | number,
      contentGeneration: raw.contentGeneration as string | false,
      contentOptimization: raw.contentOptimization as string | false,
      integrations: raw.integrations as string[],
      llmSupport: ls as Record<LlmModelKey, boolean>,
    },
  };
}

// ---- Core logic ----

export async function handleAddPlan(
  payload: AddPlanPayload,
  env: GitHubEnv
): Promise<{ success: true; prUrl: string; prNumber: number } | { success: false; error: string; status: number }> {
  const { companySlug, plan: newPlanData, contributor } = payload;

  // 1. Authenticate
  const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;

  // 2. Fetch the company YAML file
  const filePath = `data/companies/${companySlug}.yaml`;
  const fileContent = await getFileContent(token, owner, repo, filePath);
  if (!fileContent) {
    return { success: false, error: `Company '${companySlug}' not found`, status: 404 };
  }

  const yamlText = atob(fileContent.content);

  // 3. Parse
  let parsed: ReturnType<typeof parseCompanyYaml>;
  try {
    parsed = parseCompanyYaml(yamlText);
  } catch {
    return { success: false, error: "Failed to parse company YAML", status: 500 };
  }

  const { company } = parsed;

  // 4. Check for slug conflict
  if (company.plans.some((p) => p.slug === newPlanData.slug)) {
    return { success: false, error: `Plan slug '${newPlanData.slug}' already exists in company '${companySlug}'`, status: 409 };
  }

  // 5. Build the full plan object with computed fields
  const priceAmount = newPlanData.price.amount;
  const aiResponses = newPlanData.aiResponsesMonthly;
  const pricePer1000Responses =
    priceAmount !== null && aiResponses !== null && aiResponses !== undefined && aiResponses > 0
      ? Number(((priceAmount / aiResponses) * 1000).toFixed(2))
      : null;

  const fullPlan: Plan = {
    name: newPlanData.name,
    slug: newPlanData.slug,
    price: {
      amount: newPlanData.price.amount,
      currency: newPlanData.price.currency,
      period: newPlanData.price.period,
      note: newPlanData.price.note ?? null,
    },
    pricePer1000Responses,
    aiResponsesMonthly: newPlanData.aiResponsesMonthly ?? null,
    includedLlmModels: null,
    schedule: newPlanData.schedule,
    locationSupport: newPlanData.locationSupport,
    personaSupport: newPlanData.personaSupport,
    contentGeneration: newPlanData.contentGeneration,
    contentOptimization: newPlanData.contentOptimization,
    integrations: newPlanData.integrations,
    llmSupport: normalizeLlmSupport(newPlanData.llmSupport),
  };

  // 6. Validate
  const validation = PlanSchema.safeParse(fullPlan);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid plan: ${validation.error.issues.map((i) => i.message).join("; ")}`,
      status: 400,
    };
  }

  // 7. Append plan and serialize
  const updatedCompany = { ...company, plans: [...company.plans, validation.data] };
  const updatedYaml = stringifyCompanyYaml(updatedCompany);

  // 8. Create branch and PR
  const timestamp = Date.now();
  const branchName = `suggest-add-plan/${companySlug}-${newPlanData.slug}-${timestamp}`;

  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(token, owner, repo);
  await createBranch(token, owner, repo, branchName, baseSha);

  const commitMessage = `suggest: add plan "${newPlanData.name}" to ${companySlug}`;
  await upsertFile(token, owner, repo, filePath, updatedYaml, commitMessage, branchName, fileContent.sha);

  const summaryTable = buildNewPlanTable(validation.data);
  const prTitle = `[Suggestion] Add plan "${newPlanData.name}" to ${company.name}`;
  const prBody = buildAddPlanPrBody(company.name, newPlanData.name, summaryTable, contributor);

  const pr = await createPullRequest(token, owner, repo, prTitle, prBody, branchName, defaultBranch);

  return { success: true, prUrl: pr.html_url, prNumber: pr.number };
}

// ---- Helpers ----

const LLM_KEYS: LlmModelKey[] = [
  "chatgpt", "gemini", "perplexity", "claude",
  "llama", "grok", "aiOverviews", "aiMode",
];

function normalizeLlmSupport(
  llmSupport: Partial<Record<LlmModelKey, boolean>>
): Record<LlmModelKey, boolean> {
  return Object.fromEntries(
    LLM_KEYS.map((key) => [key, llmSupport[key] ?? false])
  ) as Record<LlmModelKey, boolean>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "*none*";
  if (value === false) return "No";
  if (value === true) return "Yes";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}

function buildNewPlanTable(plan: Plan): string {
  const rows: Array<[string, string]> = [
    ["Name", plan.name],
    ["Slug", plan.slug],
    ["Price", plan.price.amount !== null ? `$${plan.price.amount.toLocaleString("en-US")}` : "Custom"],
    ["Currency", plan.price.currency],
    ["Billing Period", plan.price.period],
  ];

  if (plan.price.note) {
    rows.push(["Price Note", plan.price.note]);
  }

  rows.push(
    ["AI Responses/mo", formatValue(plan.aiResponsesMonthly)],
    ["$/1K Responses", formatValue(plan.pricePer1000Responses)],
    ["Schedule", plan.schedule],
    ["Location Support", formatValue(plan.locationSupport)],
    ["Persona Support", formatValue(plan.personaSupport)],
    ["Content Generation", formatValue(plan.contentGeneration)],
    ["Content Optimization", formatValue(plan.contentOptimization)],
    ["Integrations", plan.integrations.join(", ") || "*none*"],
  );

  // LLM support
  const supportedLlms = LLM_KEYS.filter((k) => plan.llmSupport[k]);
  rows.push(["LLM Support", supportedLlms.map((k) => LLM_MODEL_LABELS[k]).join(", ") || "*none*"]);

  const lines = [
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([field, value]) => `| ${field} | ${value} |`),
  ];

  return lines.join("\n");
}

function buildAddPlanPrBody(
  companyName: string,
  planName: string,
  summaryTable: string,
  contributor?: AddPlanPayload["contributor"]
): string {
  const lines: string[] = [
    `## Suggested New Plan: ${companyName} — ${planName}`,
    "",
    summaryTable,
    "",
  ];

  if (contributor?.name || contributor?.email || contributor?.company) {
    lines.push("### Contributor");
    if (contributor.name) lines.push(`- **Name:** ${contributor.name}`);
    if (contributor.email) lines.push(`- **Email:** ${contributor.email}`);
    if (contributor.company) lines.push(`- **Company:** ${contributor.company}`);
    lines.push("");
  }

  lines.push(
    "---",
    "*Submitted via the LLM Trackers website.*"
  );

  return lines.join("\n");
}
