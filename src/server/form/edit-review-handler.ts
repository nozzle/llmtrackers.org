/**
 * Edit-review suggestion handler for LLM Trackers.
 *
 * Accepts partial review changes, fetches the current YAML from GitHub,
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
} from "@llm-tracker/github";
import {
  parseReviewYaml,
  stringifyReviewYaml,
  PublishedReviewSchema,
  type ReviewYamlValue,
} from "@llm-tracker/shared";

// ---- Types ----

export interface EditReviewPayload {
  reviewSlug: string;
  changes: ReviewChanges;
  contributor?: {
    name?: string;
    email?: string;
    company?: string;
  };
  turnstileToken?: string;
  /** Honeypot field for spam detection */
  website?: string;
}

/** Fields that can be edited on a review. slug is NOT editable. */
export interface ReviewChanges {
  name?: string;
  url?: string;
  date?: string;
  type?: "article" | "video";
  summary?: string;
  detailedSummary?: string;
  primaryCompanySlug?: string | null;
  media?: {
    provider: "youtube" | "wistia" | "loom";
    videoId: string;
    watchUrl: string;
    thumbnailUrl: string;
    title: string;
    creator: string;
    creatorUrl?: string;
    durationSeconds?: number;
  } | null;
  author?: {
    name?: string;
    socialProfiles?: { label: string; url: string }[];
  };
  companyRatings?: {
    companySlug: string;
    score?: number | null;
    maxScore?: number | null;
    summary: string;
    directLink?: string | null;
    pros: string[];
    cons: string[];
    noteworthy: string[];
  }[];
}

interface GitHubEnv {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

// ---- Validation ----

export function validateEditReviewPayload(
  data: unknown,
): { ok: true; value: EditReviewPayload } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const d = data as Record<string, unknown>;

  if (typeof d.reviewSlug !== "string" || d.reviewSlug.trim().length === 0) {
    return { ok: false, error: "reviewSlug is required" };
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

  const changes = validateReviewChanges(d.changes as Record<string, unknown>);
  if (!changes.ok) return changes;

  if (Object.keys(changes.value).length === 0) {
    return { ok: false, error: "changes must contain at least one field" };
  }

  return {
    ok: true,
    value: {
      reviewSlug: d.reviewSlug.trim(),
      changes: changes.value,
      contributor: d.contributor as EditReviewPayload["contributor"],
      turnstileToken: d.turnstileToken,
      website: d.website as string | undefined,
    },
  };
}

function validateReviewChanges(
  raw: Record<string, unknown>,
): { ok: true; value: ReviewChanges } | { ok: false; error: string } {
  const changes: ReviewChanges = {};

  if (raw.name !== undefined) {
    if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
      return { ok: false, error: "changes.name must be a non-empty string" };
    }
    changes.name = raw.name.trim();
  }

  if (raw.url !== undefined) {
    if (typeof raw.url !== "string" || raw.url.trim().length === 0) {
      return { ok: false, error: "changes.url must be a non-empty string" };
    }
    try {
      new URL(raw.url.trim());
    } catch {
      return { ok: false, error: "changes.url must be a valid URL" };
    }
    changes.url = raw.url.trim();
  }

  if (raw.date !== undefined) {
    if (typeof raw.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
      return { ok: false, error: "changes.date must be in YYYY-MM-DD format" };
    }
    changes.date = raw.date.trim();
  }

  if (raw.summary !== undefined) {
    if (typeof raw.summary !== "string" || raw.summary.trim().length === 0) {
      return { ok: false, error: "changes.summary must be a non-empty string" };
    }
    changes.summary = raw.summary.trim();
  }

  if (raw.detailedSummary !== undefined) {
    if (typeof raw.detailedSummary !== "string" || raw.detailedSummary.trim().length === 0) {
      return { ok: false, error: "changes.detailedSummary must be a non-empty string" };
    }
    changes.detailedSummary = raw.detailedSummary.trim();
  }

  if (raw.type !== undefined) {
    if (raw.type !== "article" && raw.type !== "video") {
      return { ok: false, error: 'changes.type must be "article" or "video"' };
    }
    changes.type = raw.type;
  }

  if (raw.primaryCompanySlug !== undefined) {
    if (
      raw.primaryCompanySlug !== null &&
      (typeof raw.primaryCompanySlug !== "string" || raw.primaryCompanySlug.trim().length === 0)
    ) {
      return { ok: false, error: "changes.primaryCompanySlug must be a non-empty string or null" };
    }
    changes.primaryCompanySlug =
      typeof raw.primaryCompanySlug === "string" ? raw.primaryCompanySlug.trim() : null;
  }

  if (raw.media !== undefined) {
    if (raw.media === null) {
      changes.media = null;
    } else if (typeof raw.media !== "object") {
      return { ok: false, error: "changes.media must be an object or null" };
    } else {
      const media = raw.media as Record<string, unknown>;
      if (
        media.provider !== "youtube" &&
        media.provider !== "wistia" &&
        media.provider !== "loom"
      ) {
        return {
          ok: false,
          error: 'changes.media.provider must be "youtube", "wistia", or "loom"',
        };
      }
      for (const field of ["videoId", "watchUrl", "thumbnailUrl", "title", "creator"] as const) {
        if (typeof media[field] !== "string" || media[field].trim().length === 0) {
          return { ok: false, error: `changes.media.${field} is required` };
        }
      }
      for (const field of ["watchUrl", "thumbnailUrl", "creatorUrl"] as const) {
        if (media[field] === undefined) continue;
        if (typeof media[field] !== "string") {
          return { ok: false, error: `changes.media.${field} must be a string` };
        }
        try {
          new URL(media[field]);
        } catch {
          return { ok: false, error: `changes.media.${field} must be a valid URL` };
        }
      }
      if (
        media.durationSeconds !== undefined &&
        (typeof media.durationSeconds !== "number" || media.durationSeconds <= 0)
      ) {
        return { ok: false, error: "changes.media.durationSeconds must be a positive number" };
      }
      changes.media = {
        provider: media.provider,
        videoId: String(media.videoId).trim(),
        watchUrl: String(media.watchUrl).trim(),
        thumbnailUrl: String(media.thumbnailUrl).trim(),
        title: String(media.title).trim(),
        creator: String(media.creator).trim(),
        ...(typeof media.creatorUrl === "string" && media.creatorUrl.trim().length > 0
          ? { creatorUrl: media.creatorUrl.trim() }
          : {}),
        ...(typeof media.durationSeconds === "number"
          ? { durationSeconds: media.durationSeconds }
          : {}),
      };
    }
  }

  if (raw.author !== undefined) {
    if (!raw.author || typeof raw.author !== "object") {
      return { ok: false, error: "changes.author must be an object" };
    }
    const author = raw.author as Record<string, unknown>;
    const authorChanges: ReviewChanges["author"] = {};

    if (author.name !== undefined) {
      if (typeof author.name !== "string" || author.name.trim().length === 0) {
        return { ok: false, error: "changes.author.name must be a non-empty string" };
      }
      authorChanges.name = author.name.trim();
    }

    if (author.socialProfiles !== undefined) {
      if (!Array.isArray(author.socialProfiles)) {
        return { ok: false, error: "changes.author.socialProfiles must be an array" };
      }
      const socialProfiles = author.socialProfiles as unknown[];
      for (let i = 0; i < socialProfiles.length; i++) {
        const sp = socialProfiles[i];
        if (!sp || typeof sp !== "object") {
          return { ok: false, error: `changes.author.socialProfiles[${i}] must be an object` };
        }
        const spObj = sp as Record<string, unknown>;
        if (typeof spObj.label !== "string" || spObj.label.trim().length === 0) {
          return { ok: false, error: `changes.author.socialProfiles[${i}].label is required` };
        }
        if (typeof spObj.url !== "string" || spObj.url.trim().length === 0) {
          return { ok: false, error: `changes.author.socialProfiles[${i}].url is required` };
        }
        try {
          new URL(spObj.url);
        } catch {
          return {
            ok: false,
            error: `changes.author.socialProfiles[${i}].url must be a valid URL`,
          };
        }
      }
      authorChanges.socialProfiles = author.socialProfiles.map(
        (sp: { label: string; url: string }) => ({
          label: sp.label.trim(),
          url: sp.url.trim(),
        }),
      );
    }

    if (Object.keys(authorChanges).length > 0) {
      changes.author = authorChanges;
    }
  }

  if (raw.companyRatings !== undefined) {
    if (!Array.isArray(raw.companyRatings) || raw.companyRatings.length === 0) {
      return { ok: false, error: "changes.companyRatings must be a non-empty array" };
    }
    const ratings: ReviewChanges["companyRatings"] = [];
    for (let i = 0; i < raw.companyRatings.length; i++) {
      const cr = (raw.companyRatings as unknown[])[i];
      if (!cr || typeof cr !== "object") {
        return { ok: false, error: `changes.companyRatings[${i}] must be an object` };
      }
      const r = cr as Record<string, unknown>;
      if (typeof r.companySlug !== "string" || r.companySlug.trim().length === 0) {
        return { ok: false, error: `changes.companyRatings[${i}].companySlug is required` };
      }
      const hasScore = r.score !== undefined && r.score !== null;
      const hasMaxScore = r.maxScore !== undefined && r.maxScore !== null;
      if (hasScore !== hasMaxScore) {
        return {
          ok: false,
          error: `changes.companyRatings[${i}].score and maxScore must both be provided or both be null`,
        };
      }
      if (hasScore && (typeof r.score !== "number" || r.score < 0)) {
        return {
          ok: false,
          error: `changes.companyRatings[${i}].score must be a non-negative number`,
        };
      }
      if (hasMaxScore && (typeof r.maxScore !== "number" || r.maxScore <= 0)) {
        return {
          ok: false,
          error: `changes.companyRatings[${i}].maxScore must be a positive number`,
        };
      }
      if (hasScore && hasMaxScore && Number(r.score) > Number(r.maxScore)) {
        return {
          ok: false,
          error: `changes.companyRatings[${i}].score cannot exceed maxScore`,
        };
      }
      if (typeof r.summary !== "string" || r.summary.trim().length === 0) {
        return { ok: false, error: `changes.companyRatings[${i}].summary is required` };
      }
      if (r.directLink !== undefined && r.directLink !== null && typeof r.directLink !== "string") {
        return {
          ok: false,
          error: `changes.companyRatings[${i}].directLink must be a string or null`,
        };
      }

      const prosResult = validateHighlightList(r.pros, `changes.companyRatings[${i}].pros`);
      if (!prosResult.ok) return prosResult;

      const consResult = validateHighlightList(r.cons, `changes.companyRatings[${i}].cons`);
      if (!consResult.ok) return consResult;

      const noteworthyResult = validateHighlightList(
        r.noteworthy,
        `changes.companyRatings[${i}].noteworthy`,
      );
      if (!noteworthyResult.ok) return noteworthyResult;

      ratings.push({
        companySlug: r.companySlug.trim(),
        score: hasScore ? Number(r.score) : null,
        maxScore: hasMaxScore ? Number(r.maxScore) : null,
        summary: r.summary.trim(),
        directLink:
          r.directLink !== undefined && r.directLink !== null ? r.directLink.trim() || null : null,
        pros: prosResult.value,
        cons: consResult.value,
        noteworthy: noteworthyResult.value,
      });
    }

    // Check for duplicate company slugs
    const slugs = new Set<string>();
    for (const cr of ratings) {
      if (slugs.has(cr.companySlug)) {
        return { ok: false, error: `Duplicate companySlug in changes: '${cr.companySlug}'` };
      }
      slugs.add(cr.companySlug);
    }

    changes.companyRatings = ratings;
  }

  return { ok: true, value: changes };
}

function validateHighlightList(
  raw: unknown,
  fieldPath: string,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(raw)) {
    return { ok: false, error: `${fieldPath} must be an array` };
  }

  if (raw.length > 3) {
    return { ok: false, error: `${fieldPath} must contain at most 3 items` };
  }

  const items: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item: unknown = raw[i];
    if (typeof item !== "string" || item.trim().length === 0) {
      return { ok: false, error: `${fieldPath}[${i}] must be a non-empty string` };
    }
    items.push(item.trim());
  }

  return { ok: true, value: items };
}

// ---- Core logic ----

export async function handleEditReview(
  payload: EditReviewPayload,
  env: GitHubEnv,
): Promise<
  | { success: true; prUrl: string; prNumber: number }
  | { success: false; error: string; status: number }
> {
  const { reviewSlug, changes, contributor } = payload;

  // 1. Authenticate
  const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;

  // 2. Fetch the review YAML file
  const filePath = `data/reviews/${reviewSlug}.yaml`;
  const fileContent = await getFileContent(token, owner, repo, filePath);
  if (!fileContent) {
    return { success: false, error: `Review '${reviewSlug}' not found`, status: 404 };
  }

  const yamlText = atob(fileContent.content);

  // 3. Parse
  let parsed: ReturnType<typeof parseReviewYaml>;
  try {
    parsed = parseReviewYaml(yamlText);
  } catch {
    return { success: false, error: "Failed to parse review YAML", status: 500 };
  }

  const { review } = parsed;
  const originalReview = { ...review };

  // 4. Apply changes
  const updatedReview: ReviewYamlValue = { ...review };
  if (changes.name !== undefined) updatedReview.name = changes.name;
  if (changes.url !== undefined) updatedReview.url = changes.url;
  if (changes.date !== undefined) updatedReview.date = changes.date;
  if (changes.type !== undefined) updatedReview.type = changes.type;
  if (changes.summary !== undefined) updatedReview.summary = changes.summary;
  if (changes.detailedSummary !== undefined)
    updatedReview.detailedSummary = changes.detailedSummary;
  if (changes.primaryCompanySlug !== undefined) {
    if (changes.primaryCompanySlug === null) {
      delete updatedReview.primaryCompanySlug;
    } else {
      updatedReview.primaryCompanySlug = changes.primaryCompanySlug;
    }
  }
  if (changes.media !== undefined) {
    if (changes.media === null) {
      delete updatedReview.media;
    } else {
      updatedReview.media = changes.media;
    }
  }
  if (changes.author !== undefined) {
    updatedReview.author = {
      ...review.author,
      ...(changes.author.name !== undefined ? { name: changes.author.name } : {}),
      ...(changes.author.socialProfiles !== undefined
        ? { socialProfiles: changes.author.socialProfiles }
        : {}),
    };
  }
  if (changes.companyRatings !== undefined) {
    updatedReview.companyRatings = changes.companyRatings;
  }

  // 5. Validate the updated review
  const validation = PublishedReviewSchema.safeParse(updatedReview);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid review after applying changes: ${validation.error.issues.map((i) => i.message).join("; ")}`,
      status: 400,
    };
  }

  // 6. Serialize
  const updatedYaml = stringifyReviewYaml(updatedReview);

  // 7. Create branch and PR
  const timestamp = Date.now();
  const branchName = `suggest-review-edit/${reviewSlug}-${timestamp}`;

  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(token, owner, repo);
  await createBranch(token, owner, repo, branchName, baseSha);

  const commitMessage = `suggest: update review "${review.name}"`;
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

  const diffTable = buildReviewDiffTable(originalReview, updatedReview, changes);
  const prTitle = `[Suggestion] Update review: ${updatedReview.name}`;
  const prBody = buildReviewPrBody(updatedReview.name, diffTable, contributor);

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

function buildReviewDiffTable(
  original: ReviewYamlValue,
  updated: ReviewYamlValue,
  changes: ReviewChanges,
): string {
  const rows: [string, string, string][] = [];

  if (changes.name !== undefined) {
    rows.push(["Name", formatValue(original.name), formatValue(updated.name)]);
  }
  if (changes.url !== undefined) {
    rows.push(["URL", formatValue(original.url), formatValue(updated.url)]);
  }
  if (changes.date !== undefined) {
    rows.push(["Date", formatValue(original.date), formatValue(updated.date)]);
  }
  if (changes.type !== undefined) {
    rows.push(["Review Type", formatValue(original.type), formatValue(updated.type)]);
  }
  if (changes.summary !== undefined) {
    rows.push(["Summary", formatValue(original.summary), formatValue(updated.summary)]);
  }
  if (changes.detailedSummary !== undefined) {
    rows.push([
      "Detailed Summary",
      formatValue(original.detailedSummary),
      formatValue(updated.detailedSummary),
    ]);
  }
  if (changes.primaryCompanySlug !== undefined) {
    rows.push([
      "Primary Company",
      formatValue(original.primaryCompanySlug),
      formatValue(updated.primaryCompanySlug),
    ]);
  }
  if (changes.media !== undefined) {
    rows.push([
      "Video Metadata",
      formatValue(original.media?.title),
      formatValue(updated.media?.title),
    ]);
  }
  if (changes.author?.name !== undefined) {
    rows.push(["Author Name", formatValue(original.author.name), formatValue(updated.author.name)]);
  }
  if (changes.author?.socialProfiles !== undefined) {
    const origProfiles =
      original.author.socialProfiles.map((sp) => sp.label).join(", ") || "*none*";
    const newProfiles = updated.author.socialProfiles.map((sp) => sp.label).join(", ") || "*none*";
    rows.push(["Social Profiles", origProfiles, newProfiles]);
  }
  if (changes.companyRatings !== undefined) {
    rows.push([
      "Company Ratings",
      `${original.companyRatings.length} ratings`,
      `${updated.companyRatings.length} ratings`,
    ]);

    const originalHighlights = original.companyRatings.reduce(
      (total, rating) => total + rating.pros.length + rating.cons.length + rating.noteworthy.length,
      0,
    );
    const updatedHighlights = updated.companyRatings.reduce(
      (total, rating) => total + rating.pros.length + rating.cons.length + rating.noteworthy.length,
      0,
    );

    if (originalHighlights !== updatedHighlights) {
      rows.push([
        "Rating Highlights",
        `${originalHighlights} highlight${originalHighlights === 1 ? "" : "s"}`,
        `${updatedHighlights} highlight${updatedHighlights === 1 ? "" : "s"}`,
      ]);
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

function buildReviewPrBody(
  reviewName: string,
  diffTable: string,
  contributor?: EditReviewPayload["contributor"],
): string {
  const lines: string[] = [`## Suggested Review Edit: ${reviewName}`, "", diffTable, ""];

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
