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
  prepareUpdatedCompanyYaml,
} from "@llm-tracker/shared";
import { fetchPageText } from "./scraper";
import { extractWithLlm } from "./extractor";
import { diffCompany, formatDiffMarkdown, type PlanDiff } from "./differ";
import {
  formatReviewSiteDiffMarkdown,
  type ReviewSiteDiff,
} from "./review-sites";
import { backfillCompanyReviewSites } from "./review-site-backfill";
import { isAuthorizedManualTrigger } from "./auth";
import type { AppEnv, EnqueueSummary, UpdateQueueMessage } from "../types";

interface CheckResult {
  slug: string;
  status: "skipped" | "no-changes" | "changes-detected" | "error";
  diffs?: PlanDiff[];
  reviewSiteDiffs?: ReviewSiteDiff[];
  prUrl?: string;
  error?: string;
}

interface PlanExtractionResult {
  diffs: PlanDiff[];
  preparedYamlText: string;
  rawResponse: string;
}

interface GitHubContext {
  token: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  baseSha: string;
}

export async function enqueueAllCompanyUpdates(
  env: AppEnv,
  triggeredBy: UpdateQueueMessage["triggeredBy"]
): Promise<EnqueueSummary> {
  const github = await createGitHubContext(env);
  const companies = await listCompanyFiles(github);
  const messages = companies.map<UpdateQueueMessage>(({ name, path }) => ({
    slug: name.replace(/\.yaml$/, ""),
    filePath: path,
    triggeredBy,
    requestedAt: new Date().toISOString(),
  }));

  if (messages.length > 0) {
    await env.UPDATE_QUEUE.sendBatch(messages.map((body) => ({ body })));
  }

  return {
    enqueued: messages.length,
    slugs: messages.map((message) => message.slug),
  };
}

export async function enqueueSingleCompanyUpdate(
  env: AppEnv,
  slug: string,
  triggeredBy: UpdateQueueMessage["triggeredBy"]
): Promise<EnqueueSummary> {
  const message: UpdateQueueMessage = {
    slug,
    filePath: `data/companies/${slug}.yaml`,
    triggeredBy,
    requestedAt: new Date().toISOString(),
  };
  await env.UPDATE_QUEUE.send(message);
  return { enqueued: 1, slugs: [slug] };
}

export async function processCompanyUpdate(
  env: AppEnv,
  message: UpdateQueueMessage
): Promise<CheckResult> {
  const github = await createGitHubContext(env);
  return checkCompany(github, env.OPENAI_API_KEY, message.filePath, message.slug);
}

export async function handleUpdateAdminRequest(
  request: Request,
  env: AppEnv
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "POST required" }, 405);
  }

  if (!isAuthorizedManualTrigger(request, env.MANUAL_TRIGGER_TOKEN)) {
    return new Response(JSON.stringify({ error: "Unauthorized manual trigger" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      },
    });
  }

  const path = new URL(request.url).pathname;

  try {
    if (path === "/api/admin/update-checker/enqueue") {
      const summary = await enqueueAllCompanyUpdates(env, "manual");
      return jsonResponse(summary, 202);
    }

    const slugMatch = path.match(/^\/api\/admin\/update-checker\/enqueue\/([a-z0-9-]+)$/);
    if (slugMatch) {
      const summary = await enqueueSingleCompanyUpdate(env, slugMatch[1], "manual");
      return jsonResponse(summary, 202);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}

export async function handleScheduledUpdate(
  env: AppEnv,
  ctx: ExecutionContext
): Promise<void> {
  ctx.waitUntil(
    enqueueAllCompanyUpdates(env, "cron").then((summary) => {
      console.log(`Enqueued ${summary.enqueued} company update jobs`);
    })
  );
}

async function createGitHubContext(env: AppEnv): Promise<GitHubContext> {
  const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;
  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(
    token,
    owner,
    repo
  );

  return { token, owner, repo, defaultBranch, baseSha };
}

async function listCompanyFiles(github: GitHubContext) {
  const dirRes = await fetch(
    `https://api.github.com/repos/${github.owner}/${github.repo}/contents/data/companies`,
    {
      headers: {
        Authorization: `token ${github.token}`,
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
  return files.filter((file) => file.name.endsWith(".yaml"));
}

async function checkCompany(
  github: GitHubContext,
  openaiKey: string | undefined,
  filePath: string,
  slug: string
): Promise<CheckResult> {
  const fileContent = await getFileContent(github.token, github.owner, github.repo, filePath);
  if (!fileContent) {
    return { slug, status: "error", error: "File not found in repo" };
  }

  const yamlText = atob(fileContent.content);
  const { company } = parseCompanyYaml(yamlText);

  if (!company) {
    return { slug, status: "error", error: "Failed to parse company YAML" };
  }

  const planResult = openaiKey
    ? await collectPlanChanges(openaiKey, slug, company, yamlText)
    : null;
  const diffs = planResult?.diffs ?? [];

  const reviewSiteResult = await backfillCompanyReviewSites(yamlText);
  const reviewSiteDiffs = reviewSiteResult.diffs;

  if (diffs.length === 0 && reviewSiteDiffs.length === 0) {
    if (!company.pricingUrl && Object.keys(company.reviewSites).length === 0) {
      console.log(`${slug}: No pricing URL or review-site URLs, skipping`);
      return { slug, status: "skipped" };
    }

    console.log(`${slug}: No changes detected`);
    return { slug, status: "no-changes" };
  }

  const branchName = `auto-update/${slug}`;
  await createBranch(github.token, github.owner, github.repo, branchName, github.baseSha);

  const existingPr = await findOpenPullRequestByHead(
    github.token,
    github.owner,
    github.repo,
    branchName
  );

  const branchFile = await getFileContent(
    github.token,
    github.owner,
    github.repo,
    filePath,
    branchName
  );

  const preparedPlans = planResult?.preparedYamlText ?? yamlText;
  const prepared =
    reviewSiteDiffs.length > 0
      ? await backfillCompanyReviewSites(
          preparedPlans,
          reviewSiteResult.extractedReviewSites
        )
      : { updatedYamlText: preparedPlans };

  await upsertFile(
    github.token,
    github.owner,
    github.repo,
    filePath,
    prepared.updatedYamlText,
    `chore: update ${slug} pricing, feature, and review-site data`,
    branchName,
    branchFile?.sha
  );

  const markdownSections = [];
  if (diffs.length > 0) markdownSections.push(formatDiffMarkdown(slug, diffs));
  if (reviewSiteDiffs.length > 0) {
    markdownSections.push(formatReviewSiteDiffMarkdown(reviewSiteDiffs));
  }
  const diffMarkdown = markdownSections.join("\n\n");

  if (existingPr) {
    console.log(`${slug}: Reusing existing PR ${existingPr.html_url}`);
    return {
      slug,
      status: "changes-detected",
      diffs,
      reviewSiteDiffs,
      prUrl: existingPr.html_url,
    };
  }

  const pr = await createPullRequest(
    github.token,
    github.owner,
    github.repo,
    `[Auto] Detected data changes: ${company.name ?? slug}`,
    diffMarkdown +
      "\n\n<details><summary>Raw LLM extraction</summary>\n\n```json\n" +
      (planResult?.rawResponse ?? "{}") +
      "\n```\n\n</details>",
    branchName,
    github.defaultBranch
  );

  console.log(`${slug}: Created PR ${pr.html_url}`);
  return {
    slug,
    status: "changes-detected",
    diffs,
    reviewSiteDiffs,
    prUrl: pr.html_url,
  };
}

async function collectPlanChanges(
  openaiKey: string,
  slug: string,
  company: ReturnType<typeof parseCompanyYaml>["company"],
  yamlText: string
): Promise<PlanExtractionResult | null> {
  if (!company.pricingUrl) {
    console.log(`${slug}: No pricing URL, skipping plan extraction`);
    return null;
  }

  console.log(`${slug}: Fetching ${company.pricingUrl}`);
  let pageText = await fetchPageText(company.pricingUrl);

  if (company.featuresUrl) {
    const featuresText = await fetchPageText(company.featuresUrl);
    if (featuresText) {
      pageText = (pageText ?? "") + "\n\n--- FEATURES PAGE ---\n\n" + featuresText;
    }
  }

  if (!pageText) {
    console.log(`${slug}: Failed to fetch pricing/features page`);
    return null;
  }

  console.log(`${slug}: Extracting with LLM`);
  const extraction = await extractWithLlm(openaiKey, slug, pageText);
  if (extraction.plans.length === 0) {
    console.log(`${slug}: No plans extracted`);
    return null;
  }

  const diffs = diffCompany(company, extraction.plans);
  const today = new Date().toISOString().split("T")[0];
  const preparedPlans = prepareUpdatedCompanyYaml(yamlText, extraction.plans, today);

  return {
    diffs,
    preparedYamlText: preparedPlans.yamlText,
    rawResponse: extraction.rawResponse,
  };
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
