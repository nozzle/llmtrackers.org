/**
 * Company edit suggestion handler for LLM Trackers.
 *
 * Accepts partial company field changes (name, description, website, pricingUrl,
 * featuresUrl), fetches the current YAML from GitHub, applies the changes, and
 * creates a PR with a markdown diff table.
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
  CompanySchema,
  type CompanyYamlValue,
} from "@llm-tracker/shared";

// ---- Types ----

export interface CompanyEditPayload {
  companySlug: string;
  changes: CompanyChanges;
  contributor?: {
    name?: string;
    email?: string;
    company?: string;
  };
  turnstileToken?: string;
  /** Honeypot field for spam detection */
  website?: string;
}

/** Partial company fields that can be edited. slug is NOT editable. */
export interface CompanyChanges {
  name?: string;
  description?: string;
  website?: string;
  pricingUrl?: string | null;
  featuresUrl?: string | null;
}

interface GitHubEnv {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

// ---- Validation ----

export function validateCompanyEditPayload(
  data: unknown,
): { ok: true; value: CompanyEditPayload } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const d = data as Record<string, unknown>;

  if (typeof d.companySlug !== "string" || d.companySlug.trim().length === 0) {
    return { ok: false, error: "companySlug is required" };
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

  const changes = validateCompanyChanges(d.changes as Record<string, unknown>);
  if (!changes.ok) return changes;

  if (Object.keys(changes.value).length === 0) {
    return { ok: false, error: "changes must contain at least one field" };
  }

  return {
    ok: true,
    value: {
      companySlug: d.companySlug.trim(),
      changes: changes.value,
      contributor: d.contributor as CompanyEditPayload["contributor"],
      turnstileToken: d.turnstileToken,
      website: d.website as string | undefined,
    },
  };
}

function validateCompanyChanges(
  raw: Record<string, unknown>,
): { ok: true; value: CompanyChanges } | { ok: false; error: string } {
  const changes: CompanyChanges = {};

  if (raw.name !== undefined) {
    if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
      return { ok: false, error: "changes.name must be a non-empty string" };
    }
    changes.name = raw.name.trim();
  }

  if (raw.description !== undefined) {
    if (typeof raw.description !== "string" || raw.description.trim().length === 0) {
      return { ok: false, error: "changes.description must be a non-empty string" };
    }
    changes.description = raw.description.trim();
  }

  if (raw.website !== undefined) {
    if (typeof raw.website !== "string" || raw.website.trim().length === 0) {
      return { ok: false, error: "changes.website must be a non-empty string" };
    }
    try {
      new URL(raw.website.trim());
    } catch {
      return { ok: false, error: "changes.website must be a valid URL" };
    }
    changes.website = raw.website.trim();
  }

  if (raw.pricingUrl !== undefined) {
    if (raw.pricingUrl !== null && typeof raw.pricingUrl !== "string") {
      return { ok: false, error: "changes.pricingUrl must be a string or null" };
    }
    if (typeof raw.pricingUrl === "string" && raw.pricingUrl.trim().length > 0) {
      try {
        new URL(raw.pricingUrl.trim());
      } catch {
        return { ok: false, error: "changes.pricingUrl must be a valid URL" };
      }
      changes.pricingUrl = raw.pricingUrl.trim();
    } else {
      changes.pricingUrl = null;
    }
  }

  if (raw.featuresUrl !== undefined) {
    if (raw.featuresUrl !== null && typeof raw.featuresUrl !== "string") {
      return { ok: false, error: "changes.featuresUrl must be a string or null" };
    }
    if (typeof raw.featuresUrl === "string" && raw.featuresUrl.trim().length > 0) {
      try {
        new URL(raw.featuresUrl.trim());
      } catch {
        return { ok: false, error: "changes.featuresUrl must be a valid URL" };
      }
      changes.featuresUrl = raw.featuresUrl.trim();
    } else {
      changes.featuresUrl = null;
    }
  }

  return { ok: true, value: changes };
}

// ---- Core logic ----

export async function handleCompanyEdit(
  payload: CompanyEditPayload,
  env: GitHubEnv,
): Promise<
  | { success: true; prUrl: string; prNumber: number }
  | { success: false; error: string; status: number }
> {
  const { companySlug, changes, contributor } = payload;

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
  const originalCompany = { ...company };

  // 4. Apply changes
  const updatedCompany: CompanyYamlValue = { ...company };
  if (changes.name !== undefined) updatedCompany.name = changes.name;
  if (changes.description !== undefined) updatedCompany.description = changes.description;
  if (changes.website !== undefined) updatedCompany.website = changes.website;
  if (changes.pricingUrl !== undefined) updatedCompany.pricingUrl = changes.pricingUrl;
  if (changes.featuresUrl !== undefined) updatedCompany.featuresUrl = changes.featuresUrl;

  // 5. Validate the updated company
  const validation = CompanySchema.safeParse(updatedCompany);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid company after applying changes: ${validation.error.issues.map((i) => i.message).join("; ")}`,
      status: 400,
    };
  }

  // 6. Serialize
  const updatedYaml = stringifyCompanyYaml(updatedCompany);

  // 7. Create branch and PR
  const timestamp = Date.now();
  const branchName = `suggest-company-edit/${companySlug}-${timestamp}`;

  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(token, owner, repo);
  await createBranch(token, owner, repo, branchName, baseSha);

  const commitMessage = `suggest: update company info for ${companySlug}`;
  await upsertFile(
    token,
    owner,
    repo,
    filePath,
    updatedYaml,
    commitMessage,
    branchName,
    fileContent.sha,
  );

  const diffTable = buildCompanyDiffTable(originalCompany, updatedCompany, changes);
  const prTitle = `[Suggestion] Update company info: ${updatedCompany.name}`;
  const prBody = buildCompanyPrBody(updatedCompany.name, diffTable, contributor);

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
  return typeof value === "string" ? value : JSON.stringify(value);
}

function buildCompanyDiffTable(
  original: CompanyYamlValue,
  updated: CompanyYamlValue,
  changes: CompanyChanges,
): string {
  const rows: [string, string, string][] = [];

  if (changes.name !== undefined) {
    rows.push(["Name", formatValue(original.name), formatValue(updated.name)]);
  }
  if (changes.description !== undefined) {
    rows.push(["Description", formatValue(original.description), formatValue(updated.description)]);
  }
  if (changes.website !== undefined) {
    rows.push(["Website", formatValue(original.website), formatValue(updated.website)]);
  }
  if (changes.pricingUrl !== undefined) {
    rows.push(["Pricing URL", formatValue(original.pricingUrl), formatValue(updated.pricingUrl)]);
  }
  if (changes.featuresUrl !== undefined) {
    rows.push([
      "Features URL",
      formatValue(original.featuresUrl),
      formatValue(updated.featuresUrl),
    ]);
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

function buildCompanyPrBody(
  companyName: string,
  diffTable: string,
  contributor?: CompanyEditPayload["contributor"],
): string {
  const lines: string[] = [`## Suggested Company Edit: ${companyName}`, "", diffTable, ""];

  if (contributor?.name || contributor?.email || contributor?.company) {
    lines.push("### Contributor");
    if (contributor.name) lines.push(`- **Name:** ${contributor.name}`);
    if (contributor.email) lines.push(`- **Email:** ${contributor.email}`);
    if (contributor.company) lines.push(`- **Company:** ${contributor.company}`);
    lines.push("");
  }

  lines.push("---", "*Submitted via the LLM Trackers website edit mode.*");

  return lines.join("\n");
}
