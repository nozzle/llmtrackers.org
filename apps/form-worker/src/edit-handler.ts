/**
 * Edit suggestion handler for LLM Tracker Comparison.
 *
 * Accepts a partial plan change payload, fetches the current YAML from GitHub,
 * applies the changes, and creates a PR with a markdown diff table.
 */

import {
  createAppJwt,
  getInstallationToken,
  getFileContent,
  getDefaultBranchSha,
  createBranch,
  upsertFile,
  createPullRequest,
  findOpenPullRequestByHead,
} from "@llm-tracker/github";
import {
  parseCompanyYaml,
  stringifyCompanyYaml,
  PlanSchema,
  type Plan,
  type LlmModelKey,
  LLM_MODEL_LABELS,
} from "@llm-tracker/shared";

// ---- Types ----

export interface EditSuggestionPayload {
  companySlug: string;
  planSlug: string;
  changes: PlanChanges;
  contributor?: {
    name?: string;
    email?: string;
    company?: string;
  };
  turnstileToken?: string;
  /** Honeypot field for spam detection */
  website?: string;
}

/**
 * Partial plan fields that can be edited.
 * name/slug are NOT editable (they identify the plan).
 */
export interface PlanChanges {
  price?: {
    amount?: number | null;
    currency?: string;
    period?: "monthly" | "yearly" | "one-time";
    note?: string | null;
  };
  aiResponsesMonthly?: number | null;
  schedule?: "daily" | "weekly" | "monthly";
  locationSupport?: "global" | number;
  personaSupport?: "unlimited" | number;
  contentGeneration?: string | false;
  contentOptimization?: string | false;
  integrations?: string[];
  llmSupport?: Partial<Record<LlmModelKey, boolean>>;
}

interface GitHubEnv {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

// ---- Validation ----

export function validateEditPayload(
  data: unknown
): { ok: true; value: EditSuggestionPayload } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const d = data as Record<string, unknown>;

  if (typeof d.companySlug !== "string" || d.companySlug.trim().length === 0) {
    return { ok: false, error: "companySlug is required" };
  }
  if (typeof d.planSlug !== "string" || d.planSlug.trim().length === 0) {
    return { ok: false, error: "planSlug is required" };
  }
  if (!d.changes || typeof d.changes !== "object") {
    return { ok: false, error: "changes must be an object" };
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

  const changes = validateChanges(d.changes as Record<string, unknown>);
  if (!changes.ok) return changes;

  if (Object.keys(changes.value).length === 0) {
    return { ok: false, error: "changes must contain at least one field" };
  }

  return {
    ok: true,
    value: {
      companySlug: (d.companySlug as string).trim(),
      planSlug: (d.planSlug as string).trim(),
      changes: changes.value,
      contributor: d.contributor as EditSuggestionPayload["contributor"],
      turnstileToken: d.turnstileToken as string | undefined,
      website: d.website as string | undefined,
    },
  };
}

function validateChanges(
  raw: Record<string, unknown>
): { ok: true; value: PlanChanges } | { ok: false; error: string } {
  const changes: PlanChanges = {};

  if (raw.price !== undefined) {
    if (typeof raw.price !== "object" || raw.price === null) {
      return { ok: false, error: "changes.price must be an object" };
    }
    const p = raw.price as Record<string, unknown>;
    const price: PlanChanges["price"] = {};

    if (p.amount !== undefined) {
      if (p.amount !== null && typeof p.amount !== "number") {
        return { ok: false, error: "changes.price.amount must be a number or null" };
      }
      price.amount = p.amount as number | null;
    }
    if (p.currency !== undefined) {
      if (typeof p.currency !== "string") {
        return { ok: false, error: "changes.price.currency must be a string" };
      }
      price.currency = p.currency;
    }
    if (p.period !== undefined) {
      if (!["monthly", "yearly", "one-time"].includes(p.period as string)) {
        return { ok: false, error: "changes.price.period must be monthly, yearly, or one-time" };
      }
      price.period = p.period as "monthly" | "yearly" | "one-time";
    }
    if (p.note !== undefined) {
      if (p.note !== null && typeof p.note !== "string") {
        return { ok: false, error: "changes.price.note must be a string or null" };
      }
      price.note = p.note as string | null;
    }

    if (Object.keys(price).length > 0) {
      changes.price = price;
    }
  }

  if (raw.aiResponsesMonthly !== undefined) {
    if (raw.aiResponsesMonthly !== null && typeof raw.aiResponsesMonthly !== "number") {
      return { ok: false, error: "changes.aiResponsesMonthly must be a number or null" };
    }
    changes.aiResponsesMonthly = raw.aiResponsesMonthly as number | null;
  }

  if (raw.schedule !== undefined) {
    if (!["daily", "weekly", "monthly"].includes(raw.schedule as string)) {
      return { ok: false, error: "changes.schedule must be daily, weekly, or monthly" };
    }
    changes.schedule = raw.schedule as "daily" | "weekly" | "monthly";
  }

  if (raw.locationSupport !== undefined) {
    if (raw.locationSupport !== "global" && typeof raw.locationSupport !== "number") {
      return { ok: false, error: 'changes.locationSupport must be "global" or a number' };
    }
    changes.locationSupport = raw.locationSupport as "global" | number;
  }

  if (raw.personaSupport !== undefined) {
    if (raw.personaSupport !== "unlimited" && typeof raw.personaSupport !== "number") {
      return { ok: false, error: 'changes.personaSupport must be "unlimited" or a number' };
    }
    changes.personaSupport = raw.personaSupport as "unlimited" | number;
  }

  if (raw.contentGeneration !== undefined) {
    if (raw.contentGeneration !== false && typeof raw.contentGeneration !== "string") {
      return { ok: false, error: "changes.contentGeneration must be a string or false" };
    }
    changes.contentGeneration = raw.contentGeneration as string | false;
  }

  if (raw.contentOptimization !== undefined) {
    if (raw.contentOptimization !== false && typeof raw.contentOptimization !== "string") {
      return { ok: false, error: "changes.contentOptimization must be a string or false" };
    }
    changes.contentOptimization = raw.contentOptimization as string | false;
  }

  if (raw.integrations !== undefined) {
    if (!Array.isArray(raw.integrations) || !raw.integrations.every((i) => typeof i === "string")) {
      return { ok: false, error: "changes.integrations must be an array of strings" };
    }
    changes.integrations = raw.integrations as string[];
  }

  if (raw.llmSupport !== undefined) {
    if (typeof raw.llmSupport !== "object" || raw.llmSupport === null) {
      return { ok: false, error: "changes.llmSupport must be an object" };
    }
    const ls = raw.llmSupport as Record<string, unknown>;
    const validKeys: LlmModelKey[] = [
      "aiMode", "aiOverviews", "chatgpt", "gemini",
      "perplexity", "grok", "llama", "claude",
    ];
    const llmChanges: Partial<Record<LlmModelKey, boolean>> = {};
    for (const [key, val] of Object.entries(ls)) {
      if (!validKeys.includes(key as LlmModelKey)) {
        return { ok: false, error: `changes.llmSupport.${key} is not a valid LLM model key` };
      }
      if (typeof val !== "boolean") {
        return { ok: false, error: `changes.llmSupport.${key} must be a boolean` };
      }
      llmChanges[key as LlmModelKey] = val;
    }
    if (Object.keys(llmChanges).length > 0) {
      changes.llmSupport = llmChanges;
    }
  }

  return { ok: true, value: changes };
}

// ---- Core logic ----

export async function handleEditSuggestion(
  payload: EditSuggestionPayload,
  env: GitHubEnv
): Promise<{ success: true; prUrl: string; prNumber: number } | { success: false; error: string; status: number }> {
  const { companySlug, planSlug, changes, contributor } = payload;
  const { GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_INSTALLATION_ID, GITHUB_REPO_OWNER, GITHUB_REPO_NAME } = env;

  // 1. Authenticate
  const jwt = await createAppJwt(GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, GITHUB_INSTALLATION_ID);
  const owner = GITHUB_REPO_OWNER;
  const repo = GITHUB_REPO_NAME;

  // 2. Fetch the company YAML file
  const filePath = `data/companies/${companySlug}.yaml`;
  const fileContent = await getFileContent(token, owner, repo, filePath);
  if (!fileContent) {
    return { success: false, error: `Company '${companySlug}' not found`, status: 404 };
  }

  const yamlText = atob(fileContent.content);

  // 3. Parse and find the plan
  let parsed: ReturnType<typeof parseCompanyYaml>;
  try {
    parsed = parseCompanyYaml(yamlText);
  } catch {
    return { success: false, error: "Failed to parse company YAML", status: 500 };
  }

  const { company } = parsed;
  const planIndex = company.plans.findIndex((p) => p.slug === planSlug);
  if (planIndex === -1) {
    return { success: false, error: `Plan '${planSlug}' not found in company '${companySlug}'`, status: 404 };
  }

  const originalPlan = company.plans[planIndex];

  // 4. Apply changes (deep merge)
  const updatedPlan = applyChanges(originalPlan, changes);

  // 5. Validate the updated plan
  const validation = PlanSchema.safeParse(updatedPlan);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid plan after applying changes: ${validation.error.issues.map((i) => i.message).join("; ")}`,
      status: 400,
    };
  }

  // 6. Update the company and serialize
  const updatedPlans = [...company.plans];
  updatedPlans[planIndex] = validation.data;
  const updatedCompany = { ...company, plans: updatedPlans };
  const updatedYaml = stringifyCompanyYaml(updatedCompany);

  // 7. Create branch and PR
  const timestamp = Date.now();
  const branchName = `suggest-edit/${companySlug}-${planSlug}-${timestamp}`;

  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(token, owner, repo);
  await createBranch(token, owner, repo, branchName, baseSha);

  const commitMessage = `suggest: update ${companySlug} / ${originalPlan.name}`;
  await upsertFile(token, owner, repo, filePath, updatedYaml, commitMessage, branchName, fileContent.sha);

  const diffTable = buildDiffTable(originalPlan, validation.data, changes);
  const prTitle = `[Suggestion] Update ${company.name} — ${originalPlan.name}`;
  const prBody = buildPrBody(company.name, originalPlan.name, diffTable, contributor);

  const pr = await createPullRequest(token, owner, repo, prTitle, prBody, branchName, defaultBranch);

  return { success: true, prUrl: pr.html_url, prNumber: pr.number };
}

// ---- Helpers ----

function applyChanges(plan: Plan, changes: PlanChanges): Plan {
  const updated = { ...plan };

  if (changes.price) {
    updated.price = { ...plan.price, ...changes.price };
  }

  if (changes.aiResponsesMonthly !== undefined) {
    updated.aiResponsesMonthly = changes.aiResponsesMonthly;
  }

  // Recalculate pricePer1000Responses
  const priceAmount = updated.price.amount;
  const aiResponses = updated.aiResponsesMonthly;
  if (priceAmount !== null && aiResponses !== null && aiResponses !== undefined && aiResponses > 0) {
    updated.pricePer1000Responses = Number(((priceAmount / aiResponses) * 1000).toFixed(2));
  } else {
    updated.pricePer1000Responses = null;
  }

  if (changes.schedule !== undefined) updated.schedule = changes.schedule;
  if (changes.locationSupport !== undefined) updated.locationSupport = changes.locationSupport;
  if (changes.personaSupport !== undefined) updated.personaSupport = changes.personaSupport;
  if (changes.contentGeneration !== undefined) updated.contentGeneration = changes.contentGeneration;
  if (changes.contentOptimization !== undefined) updated.contentOptimization = changes.contentOptimization;
  if (changes.integrations !== undefined) updated.integrations = changes.integrations;

  if (changes.llmSupport) {
    updated.llmSupport = { ...plan.llmSupport, ...changes.llmSupport };
  }

  return updated;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "*none*";
  if (value === false) return "No";
  if (value === true) return "Yes";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}

function buildDiffTable(original: Plan, updated: Plan, changes: PlanChanges): string {
  const rows: Array<[string, string, string]> = [];

  if (changes.price) {
    if (changes.price.amount !== undefined) {
      rows.push(["Price", formatValue(original.price.amount), formatValue(updated.price.amount)]);
    }
    if (changes.price.currency !== undefined) {
      rows.push(["Currency", original.price.currency, updated.price.currency]);
    }
    if (changes.price.period !== undefined) {
      rows.push(["Billing Period", original.price.period, updated.price.period]);
    }
    if (changes.price.note !== undefined) {
      rows.push(["Price Note", formatValue(original.price.note), formatValue(updated.price.note)]);
    }
  }

  if (changes.aiResponsesMonthly !== undefined) {
    rows.push(["AI Responses/mo", formatValue(original.aiResponsesMonthly), formatValue(updated.aiResponsesMonthly)]);
  }

  // If price or responses changed, show computed cost/1K
  if (changes.price?.amount !== undefined || changes.aiResponsesMonthly !== undefined) {
    rows.push(["$/1K Responses", formatValue(original.pricePer1000Responses), formatValue(updated.pricePer1000Responses)]);
  }

  if (changes.schedule !== undefined) {
    rows.push(["Schedule", original.schedule, updated.schedule]);
  }

  if (changes.locationSupport !== undefined) {
    rows.push(["Location Support", formatValue(original.locationSupport), formatValue(updated.locationSupport)]);
  }

  if (changes.personaSupport !== undefined) {
    rows.push(["Persona Support", formatValue(original.personaSupport), formatValue(updated.personaSupport)]);
  }

  if (changes.contentGeneration !== undefined) {
    rows.push(["Content Generation", formatValue(original.contentGeneration), formatValue(updated.contentGeneration)]);
  }

  if (changes.contentOptimization !== undefined) {
    rows.push(["Content Optimization", formatValue(original.contentOptimization), formatValue(updated.contentOptimization)]);
  }

  if (changes.integrations !== undefined) {
    rows.push([
      "Integrations",
      original.integrations.join(", ") || "*none*",
      updated.integrations.join(", ") || "*none*",
    ]);
  }

  if (changes.llmSupport) {
    for (const [key, newVal] of Object.entries(changes.llmSupport)) {
      const label = LLM_MODEL_LABELS[key as LlmModelKey] ?? key;
      const oldVal = original.llmSupport[key as LlmModelKey];
      if (oldVal !== newVal) {
        rows.push([label, formatValue(oldVal), formatValue(newVal)]);
      }
    }
  }

  if (rows.length === 0) {
    return "*No visible changes*";
  }

  const lines = [
    "| Field | Before | After |",
    "| --- | --- | --- |",
    ...rows.map(([field, before, after]) => `| ${field} | ${before} | ${after} |`),
  ];

  return lines.join("\n");
}

function buildPrBody(
  companyName: string,
  planName: string,
  diffTable: string,
  contributor?: EditSuggestionPayload["contributor"]
): string {
  const lines: string[] = [
    `## Suggested Edit: ${companyName} — ${planName}`,
    "",
    diffTable,
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
    "*Submitted via the LLM Tracker Comparison website edit mode.*"
  );

  return lines.join("\n");
}
