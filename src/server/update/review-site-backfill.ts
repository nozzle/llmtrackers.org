import {
  parseCompanyYaml,
  prepareUpdatedCompanyReviewSitesYaml,
  type Company,
  type ReviewSites,
} from "@llm-tracker/shared";
import { collectReviewSites, diffReviewSites, type ReviewSiteDiff } from "./review-sites";
import type { AppEnv } from "../types";

export interface ReviewSiteBackfillResult {
  company: Company;
  extractedReviewSites: Partial<ReviewSites>;
  diffs: ReviewSiteDiff[];
  updatedYamlText: string;
}

export async function backfillCompanyReviewSites(
  yamlText: string,
  extractedReviewSites?: Partial<ReviewSites>,
  env?: AppEnv,
): Promise<ReviewSiteBackfillResult> {
  const { company } = parseCompanyYaml(yamlText);
  const nextReviewSites =
    extractedReviewSites ?? (await collectReviewSites(company.reviewSites, env));
  const diffs = diffReviewSites(company.reviewSites, nextReviewSites);

  if (diffs.length === 0) {
    return {
      company,
      extractedReviewSites: nextReviewSites,
      diffs,
      updatedYamlText: yamlText,
    };
  }

  const prepared = prepareUpdatedCompanyReviewSitesYaml(yamlText, nextReviewSites);

  return {
    company,
    extractedReviewSites: nextReviewSites,
    diffs,
    updatedYamlText: prepared.yamlText,
  };
}
