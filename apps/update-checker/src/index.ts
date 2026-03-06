/**
 * Update checker worker for LLM Tracker Comparison.
 *
 * Runs on a cron schedule (weekly). For each company with a pricingUrl:
 * 1. Fetches the pricing page text
 * 2. Sends it to OpenAI for structured extraction
 * 3. Diffs extracted data against current YAML in the repo
 * 4. If changes detected, creates a PR with a summary
 *
 * Also exposes an HTTP endpoint for manual triggering.
 */

import {
  createAppJwt,
  getInstallationToken,
  getFileContent,
  getDefaultBranchSha,
  createBranch,
  upsertFile,
  createPullRequest,
} from "./github";
import { fetchPageText } from "./scraper";
import { extractWithLlm } from "./extractor";
import { diffCompany, formatDiffMarkdown, type PlanDiff } from "./differ";

// ---- Types ----

interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  OPENAI_API_KEY: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

interface CompanyYaml {
  slug: string;
  name: string;
  pricingUrl?: string | null;
  featuresUrl?: string | null;
  plans: Array<{
    name: string;
    slug: string;
    price: { amount: number | null; currency: string; period: string; note?: string | null };
    aiResponsesMonthly?: number | null;
    includedLlmModels?: number | null;
    schedule?: string;
    locationSupport?: string | number;
    personaSupport?: string | number;
    contentGeneration?: string | false;
    contentOptimization?: string | false;
    integrations?: string[];
    llmSupport?: Record<string, boolean>;
  }>;
  [key: string]: unknown;
}

interface CheckResult {
  slug: string;
  status: "skipped" | "no-changes" | "changes-detected" | "error";
  diffs?: PlanDiff[];
  prUrl?: string;
  error?: string;
}

// ---- Main logic ----

async function runUpdateCheck(env: Env): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Authenticate
  const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;

  // Get default branch info
  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(
    token,
    owner,
    repo
  );

  // List company YAML files by reading the data/companies/ directory
  const dirRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data/companies`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "llm-tracker-update-checker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!dirRes.ok) {
    throw new Error(`Failed to list companies: ${dirRes.status}`);
  }

  const files = (await dirRes.json()) as Array<{ name: string; path: string }>;
  const yamlFiles = files.filter((f) => f.name.endsWith(".yaml"));

  console.log(`Found ${yamlFiles.length} company files to check`);

  // Process each company
  for (const file of yamlFiles) {
    const slug = file.name.replace(".yaml", "");

    try {
      const result = await checkCompany(
        token,
        env.OPENAI_API_KEY,
        owner,
        repo,
        defaultBranch,
        baseSha,
        file.path,
        slug
      );
      results.push(result);
    } catch (err) {
      console.error(`Error checking ${slug}:`, err);
      results.push({
        slug,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Small delay to be respectful of rate limits
    await sleep(1000);
  }

  return results;
}

async function checkCompany(
  token: string,
  openaiKey: string,
  owner: string,
  repo: string,
  defaultBranch: string,
  baseSha: string,
  filePath: string,
  slug: string
): Promise<CheckResult> {
  // 1. Read current YAML from repo
  const fileContent = await getFileContent(token, owner, repo, filePath);
  if (!fileContent) {
    return { slug, status: "error", error: "File not found in repo" };
  }

  const yamlText = atob(fileContent.content);
  const company = parseYamlSimple(yamlText);

  if (!company || !company.pricingUrl) {
    console.log(`${slug}: No pricing URL, skipping`);
    return { slug, status: "skipped" };
  }

  // 2. Fetch the pricing page
  console.log(`${slug}: Fetching ${company.pricingUrl}`);
  let pageText = await fetchPageText(company.pricingUrl);

  // Also fetch features page if available
  if (company.featuresUrl) {
    const featuresText = await fetchPageText(company.featuresUrl);
    if (featuresText) {
      pageText = (pageText ?? "") + "\n\n--- FEATURES PAGE ---\n\n" + featuresText;
    }
  }

  if (!pageText) {
    return { slug, status: "error", error: "Failed to fetch pricing page" };
  }

  // 3. Extract structured data with LLM
  console.log(`${slug}: Extracting with LLM`);
  const extraction = await extractWithLlm(openaiKey, slug, pageText);

  if (extraction.plans.length === 0) {
    console.log(`${slug}: No plans extracted`);
    return { slug, status: "no-changes" };
  }

  // 4. Diff against existing data
  const diffs = diffCompany(company as CompanyYaml, extraction.plans);

  if (diffs.length === 0) {
    console.log(`${slug}: No changes detected`);
    return { slug, status: "no-changes" };
  }

  console.log(`${slug}: ${diffs.length} plan(s) with changes`);

  // 5. Create a PR with the changes
  const branchName = `auto-update/${slug}-${Date.now()}`;
  await createBranch(token, owner, repo, branchName, baseSha);

  // Update the lastChecked field in the YAML
  const today = new Date().toISOString().split("T")[0];
  const updatedYaml = yamlText.replace(
    /lastChecked:.*$/m,
    `lastChecked: "${today}"`
  );

  await upsertFile(
    token,
    owner,
    repo,
    filePath,
    updatedYaml,
    `chore: update lastChecked for ${slug}`,
    branchName,
    fileContent.sha
  );

  const diffMarkdown = formatDiffMarkdown(slug, diffs);
  const pr = await createPullRequest(
    token,
    owner,
    repo,
    `[Auto] Detected pricing/feature changes: ${company.name ?? slug}`,
    diffMarkdown +
      "\n\n<details><summary>Raw LLM extraction</summary>\n\n```json\n" +
      extraction.rawResponse +
      "\n```\n\n</details>",
    branchName,
    defaultBranch
  );

  console.log(`${slug}: Created PR ${pr.html_url}`);
  return {
    slug,
    status: "changes-detected",
    diffs,
    prUrl: pr.html_url,
  };
}

/**
 * Very simple YAML parser that extracts top-level fields.
 * For the update checker we only need slug, name, pricingUrl, featuresUrl,
 * and the plans array structure. Real YAML parsing happens in the shared
 * compile script - here we just need enough to diff against.
 *
 * We parse YAML by reading the base64-decoded file content.
 * Since Cloudflare Workers don't have a YAML parser, we use a minimal
 * approach: extract the fields we need with regex.
 */
function parseYamlSimple(yaml: string): CompanyYaml | null {
  try {
    const slug = extractField(yaml, "slug");
    const name = extractField(yaml, "name");
    const pricingUrl = extractField(yaml, "pricingUrl");
    const featuresUrl = extractField(yaml, "featuresUrl");

    if (!slug || !name) return null;

    // Extract plans - this is simplified; we parse enough for diffing
    const plans = parsePlans(yaml);

    return {
      slug,
      name,
      pricingUrl: pricingUrl === "null" ? null : pricingUrl,
      featuresUrl: featuresUrl === "null" ? null : featuresUrl,
      plans,
    };
  } catch (err) {
    console.error("Failed to parse YAML:", err);
    return null;
  }
}

function extractField(yaml: string, field: string): string | null {
  const match = yaml.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

interface SimplePlan {
  name: string;
  slug: string;
  price: { amount: number | null; currency: string; period: string; note?: string | null };
  aiResponsesMonthly?: number | null;
  includedLlmModels?: number | null;
  schedule?: string;
  locationSupport?: string | number;
  personaSupport?: string | number;
  contentGeneration?: string | false;
  contentOptimization?: string | false;
  integrations?: string[];
  llmSupport?: Record<string, boolean>;
}

/**
 * Parse plans from YAML text. Splits on "  - name:" pattern.
 */
function parsePlans(yaml: string): SimplePlan[] {
  const plansSection = yaml.match(/^plans:\s*\n([\s\S]*?)(?=^\w|\Z)/m);
  if (!plansSection) return [];

  const planBlocks = plansSection[1].split(/\n\s{2}- name:\s*/);
  const plans: SimplePlan[] = [];

  for (const block of planBlocks) {
    if (!block.trim()) continue;

    const nameMatch = block.match(/^(.+)/);
    const name = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, "") : "";

    const slugVal = extractField(block, "\\s+slug") ?? "";
    const scheduleVal = extractField(block, "\\s+schedule");
    const amountMatch = block.match(/amount:\s*([\d.]+|null)/);
    const amount = amountMatch
      ? amountMatch[1] === "null"
        ? null
        : parseFloat(amountMatch[1])
      : null;

    const currencyMatch = block.match(/currency:\s*(\w+)/);
    const periodMatch = block.match(/period:\s*(\w+)/);
    const responsesMatch = block.match(/aiResponsesMonthly:\s*([\d]+|null)/);
    const modelsMatch = block.match(/includedLlmModels:\s*([\d]+|null)/);

    // Parse llmSupport
    const llmSupport: Record<string, boolean> = {};
    const llmKeys = [
      "chatgpt", "gemini", "perplexity", "claude",
      "llama", "grok", "aiOverviews", "aiMode",
    ];
    for (const key of llmKeys) {
      const m = block.match(new RegExp(`${key}:\\s*(true|false)`));
      llmSupport[key] = m ? m[1] === "true" : false;
    }

    // Parse integrations
    const integrationsMatch = block.match(
      /integrations:\s*\n((?:\s+-\s+.+\n)*)/
    );
    const integrations = integrationsMatch
      ? integrationsMatch[1]
          .split("\n")
          .map((l) => l.replace(/^\s+-\s+/, "").trim())
          .filter(Boolean)
      : [];

    plans.push({
      name,
      slug: slugVal,
      price: {
        amount,
        currency: currencyMatch?.[1] ?? "USD",
        period: periodMatch?.[1] ?? "monthly",
      },
      aiResponsesMonthly: responsesMatch
        ? responsesMatch[1] === "null"
          ? null
          : parseInt(responsesMatch[1])
        : null,
      includedLlmModels: modelsMatch
        ? modelsMatch[1] === "null"
          ? null
          : parseInt(modelsMatch[1])
        : null,
      schedule: scheduleVal ?? undefined,
      integrations,
      llmSupport,
    });
  }

  return plans;
}

// ---- Helpers ----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Worker export ----

export default {
  // Cron trigger
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      runUpdateCheck(env).then((results) => {
        const summary = results.map(
          (r) =>
            `${r.slug}: ${r.status}${r.prUrl ? ` (${r.prUrl})` : ""}${r.error ? ` - ${r.error}` : ""}`
        );
        console.log("Update check complete:\n" + summary.join("\n"));
      })
    );
  },

  // HTTP trigger (for manual runs)
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST to trigger manual check" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const results = await runUpdateCheck(env);
      return new Response(JSON.stringify({ results }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
} satisfies ExportedHandler<Env>;
