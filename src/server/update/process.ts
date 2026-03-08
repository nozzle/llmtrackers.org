import {
  getFileContent,
  createBranch,
  upsertFile,
  createPullRequest,
  findOpenPullRequestByHead,
} from "@llm-tracker/github";
import { parseCompanyYaml, prepareUpdatedCompanyYaml } from "@llm-tracker/shared";
import { extractPageText } from "../browser/extract-page";
import { extractWithLlm } from "./extractor";
import { diffCompany, formatDiffMarkdown } from "./differ";
import { formatReviewSiteDiffMarkdown } from "./review-sites";
import { backfillCompanyReviewSites } from "./review-site-backfill";
import { createGitHubContext } from "./github";
import type { AppEnv, UpdateQueueMessage } from "../types";
import type { CheckResult, GitHubContext, PlanExtractionResult } from "./types";

export async function processCompanyUpdate(
  env: AppEnv,
  message: UpdateQueueMessage,
  githubContext?: GitHubContext,
): Promise<CheckResult> {
  const github = githubContext ?? (await createGitHubContext(env));
  return checkCompany(env, github, env.OPENAI_API_KEY, message.filePath, message.slug);
}

async function checkCompany(
  env: AppEnv,
  github: GitHubContext,
  openaiKey: string | undefined,
  filePath: string,
  slug: string,
): Promise<CheckResult> {
  const fileContent = await getFileContent(github.token, github.owner, github.repo, filePath);
  if (!fileContent) {
    return { slug, status: "error", error: "File not found in repo" };
  }

  const yamlText = atob(fileContent.content);
  const { company } = parseCompanyYaml(yamlText);

  const planResult = openaiKey
    ? await collectPlanChanges(openaiKey, slug, company, yamlText)
    : null;
  const diffs = planResult?.diffs ?? [];

  const reviewSiteResult = await backfillCompanyReviewSites(yamlText, undefined, env);
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
    branchName,
  );

  const branchFile = await getFileContent(
    github.token,
    github.owner,
    github.repo,
    filePath,
    branchName,
  );

  const preparedPlans = planResult?.preparedYamlText ?? yamlText;
  const prepared =
    reviewSiteDiffs.length > 0
      ? await backfillCompanyReviewSites(preparedPlans, reviewSiteResult.extractedReviewSites, env)
      : { updatedYamlText: preparedPlans };

  const branchText = branchFile ? atob(branchFile.content) : null;
  if (branchText !== prepared.updatedYamlText) {
    await upsertFile(
      github.token,
      github.owner,
      github.repo,
      filePath,
      prepared.updatedYamlText,
      `chore: update ${slug} pricing, feature, and review-site data`,
      branchName,
      branchFile?.sha,
    );
  } else {
    console.log(`${slug}: Branch already contains the latest generated content`);
  }

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
    `[Auto] Detected data changes: ${company.name}`,
    diffMarkdown +
      "\n\n<details><summary>Raw LLM extraction</summary>\n\n```json\n" +
      (planResult?.rawResponse ?? "{}") +
      "\n```\n\n</details>",
    branchName,
    github.defaultBranch,
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
  yamlText: string,
): Promise<PlanExtractionResult | null> {
  if (!company.pricingUrl) {
    console.log(`${slug}: No pricing URL, skipping plan extraction`);
    return null;
  }

  console.log(`${slug}: Fetching ${company.pricingUrl}`);
  let pageText = await extractPageText(company.pricingUrl);

  if (company.featuresUrl) {
    const featuresText = await extractPageText(company.featuresUrl);
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
