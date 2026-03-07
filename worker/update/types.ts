import type { PlanDiff } from "./differ";
import type { ReviewSiteDiff } from "./review-sites";

export interface CheckResult {
  slug: string;
  status: "skipped" | "no-changes" | "changes-detected" | "error";
  diffs?: PlanDiff[];
  reviewSiteDiffs?: ReviewSiteDiff[];
  prUrl?: string;
  error?: string;
}

export interface PlanExtractionResult {
  diffs: PlanDiff[];
  preparedYamlText: string;
  rawResponse: string;
}

export interface GitHubContext {
  token: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  baseSha: string;
}
