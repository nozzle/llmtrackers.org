/**
 * Add-review suggestion handler for LLM Trackers.
 *
 * Accepts a full new review payload (with company ratings), creates a new YAML
 * file on a branch, and opens a PR.
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
  stringifyReviewYaml,
  PublishedReviewSchema,
  type ReviewYamlValue,
} from "@llm-tracker/shared";

// ---- Types ----

export interface AddReviewPayload {
  review: NewReviewData;
  contributor?: {
    name?: string;
    email?: string;
    company?: string;
  };
  turnstileToken?: string;
  /** Honeypot field for spam detection */
  website?: string;
}

export interface NewReviewData {
  slug: string;
  name: string;
  url: string;
  date: string;
  type?: "article" | "video";
  summary: string;
  detailedSummary: string;
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
  };
  author: {
    name: string;
    socialProfiles: { label: string; url: string }[];
  };
  companyRatings: {
    companySlug: string;
    score?: number | null;
    maxScore?: number | null;
    summary: string;
    directLink?: string | null;
    pros?: string[];
    cons?: string[];
    noteworthy?: string[];
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

export function validateAddReviewPayload(
  data: unknown,
): { ok: true; value: AddReviewPayload } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const d = data as Record<string, unknown>;

  if (!d.review || typeof d.review !== "object") {
    return { ok: false, error: "review must be an object" };
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

  const reviewResult = validateNewReviewData(d.review as Record<string, unknown>);
  if (!reviewResult.ok) return reviewResult;

  return {
    ok: true,
    value: {
      review: reviewResult.value,
      contributor: d.contributor as AddReviewPayload["contributor"],
      turnstileToken: d.turnstileToken,
      website: d.website as string | undefined,
    },
  };
}

function validateNewReviewData(
  raw: Record<string, unknown>,
): { ok: true; value: NewReviewData } | { ok: false; error: string } {
  if (typeof raw.slug !== "string" || raw.slug.trim().length === 0) {
    return { ok: false, error: "review.slug is required" };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug)) {
    return { ok: false, error: "review.slug must be lowercase alphanumeric with hyphens" };
  }
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return { ok: false, error: "review.name is required" };
  }
  if (typeof raw.url !== "string" || raw.url.trim().length === 0) {
    return { ok: false, error: "review.url is required" };
  }
  try {
    new URL(raw.url);
  } catch {
    return { ok: false, error: "review.url must be a valid URL" };
  }
  if (typeof raw.date !== "string" || raw.date.trim().length === 0) {
    return { ok: false, error: "review.date is required" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    return { ok: false, error: "review.date must be in YYYY-MM-DD format" };
  }
  if (typeof raw.summary !== "string" || raw.summary.trim().length === 0) {
    return { ok: false, error: "review.summary is required" };
  }
  if (typeof raw.detailedSummary !== "string" || raw.detailedSummary.trim().length === 0) {
    return { ok: false, error: "review.detailedSummary is required" };
  }
  if (raw.type !== undefined && raw.type !== "article" && raw.type !== "video") {
    return { ok: false, error: 'review.type must be "article" or "video"' };
  }
  if (
    raw.primaryCompanySlug !== undefined &&
    raw.primaryCompanySlug !== null &&
    (typeof raw.primaryCompanySlug !== "string" || raw.primaryCompanySlug.trim().length === 0)
  ) {
    return { ok: false, error: "review.primaryCompanySlug must be a non-empty string or null" };
  }
  if (raw.media !== undefined) {
    if (!raw.media || typeof raw.media !== "object") {
      return { ok: false, error: "review.media must be an object" };
    }
    const media = raw.media as Record<string, unknown>;
    if (media.provider !== "youtube" && media.provider !== "wistia" && media.provider !== "loom") {
      return { ok: false, error: 'review.media.provider must be "youtube", "wistia", or "loom"' };
    }
    for (const field of ["videoId", "watchUrl", "thumbnailUrl", "title", "creator"] as const) {
      if (typeof media[field] !== "string" || media[field].trim().length === 0) {
        return { ok: false, error: `review.media.${field} is required` };
      }
    }
    for (const field of ["watchUrl", "thumbnailUrl", "creatorUrl"] as const) {
      if (media[field] === undefined) continue;
      if (typeof media[field] !== "string") {
        return { ok: false, error: `review.media.${field} must be a string` };
      }
      try {
        new URL(media[field]);
      } catch {
        return { ok: false, error: `review.media.${field} must be a valid URL` };
      }
    }
    if (
      media.durationSeconds !== undefined &&
      (typeof media.durationSeconds !== "number" || media.durationSeconds <= 0)
    ) {
      return { ok: false, error: "review.media.durationSeconds must be a positive number" };
    }
  }

  // Author
  if (!raw.author || typeof raw.author !== "object") {
    return { ok: false, error: "review.author is required" };
  }
  const author = raw.author as Record<string, unknown>;
  if (typeof author.name !== "string" || author.name.trim().length === 0) {
    return { ok: false, error: "review.author.name is required" };
  }
  if (author.socialProfiles !== undefined) {
    if (!Array.isArray(author.socialProfiles)) {
      return { ok: false, error: "review.author.socialProfiles must be an array" };
    }
    const socialProfiles = author.socialProfiles as unknown[];
    for (let i = 0; i < socialProfiles.length; i++) {
      const sp = socialProfiles[i];
      if (!sp || typeof sp !== "object") {
        return { ok: false, error: `review.author.socialProfiles[${i}] must be an object` };
      }
      const spObj = sp as Record<string, unknown>;
      if (typeof spObj.label !== "string" || spObj.label.trim().length === 0) {
        return { ok: false, error: `review.author.socialProfiles[${i}].label is required` };
      }
      if (typeof spObj.url !== "string" || spObj.url.trim().length === 0) {
        return { ok: false, error: `review.author.socialProfiles[${i}].url is required` };
      }
      try {
        new URL(spObj.url);
      } catch {
        return {
          ok: false,
          error: `review.author.socialProfiles[${i}].url must be a valid URL`,
        };
      }
    }
  }

  // Company ratings
  if (!Array.isArray(raw.companyRatings) || raw.companyRatings.length === 0) {
    return { ok: false, error: "review.companyRatings must be a non-empty array" };
  }
  const companyRatings: NewReviewData["companyRatings"] = [];
  for (let i = 0; i < raw.companyRatings.length; i++) {
    const cr = (raw.companyRatings as unknown[])[i];
    if (!cr || typeof cr !== "object") {
      return { ok: false, error: `review.companyRatings[${i}] must be an object` };
    }
    const ratingResult = validateCompanyRating(cr as Record<string, unknown>, i);
    if (!ratingResult.ok) return ratingResult;
    companyRatings.push(ratingResult.value);
  }

  // Check for duplicate company slugs
  const slugs = new Set<string>();
  for (const cr of companyRatings) {
    if (slugs.has(cr.companySlug)) {
      return { ok: false, error: `Duplicate companySlug: '${cr.companySlug}'` };
    }
    slugs.add(cr.companySlug);
  }

  return {
    ok: true,
    value: {
      slug: raw.slug.trim(),
      name: raw.name.trim(),
      url: raw.url.trim(),
      date: raw.date.trim(),
      type: raw.type === "video" ? "video" : "article",
      summary: raw.summary.trim(),
      detailedSummary: raw.detailedSummary.trim(),
      primaryCompanySlug:
        typeof raw.primaryCompanySlug === "string" ? raw.primaryCompanySlug.trim() : null,
      media:
        raw.media && typeof raw.media === "object"
          ? {
              provider: (raw.media as Record<string, unknown>).provider as
                | "youtube"
                | "wistia"
                | "loom",
              videoId: (raw.media as Record<string, string>).videoId.trim(),
              watchUrl: (raw.media as Record<string, string>).watchUrl.trim(),
              thumbnailUrl: (raw.media as Record<string, string>).thumbnailUrl.trim(),
              title: (raw.media as Record<string, string>).title.trim(),
              creator: (raw.media as Record<string, string>).creator.trim(),
              ...((raw.media as Record<string, unknown>).creatorUrl
                ? { creatorUrl: String((raw.media as Record<string, unknown>).creatorUrl).trim() }
                : {}),
              ...((raw.media as Record<string, unknown>).durationSeconds
                ? {
                    durationSeconds: Number((raw.media as Record<string, unknown>).durationSeconds),
                  }
                : {}),
            }
          : undefined,
      author: {
        name: author.name.trim(),
        socialProfiles: (author.socialProfiles as { label: string; url: string }[]).map((sp) => ({
          label: sp.label.trim(),
          url: sp.url.trim(),
        })),
      },
      companyRatings,
    },
  };
}

function validateCompanyRating(
  raw: Record<string, unknown>,
  index: number,
): { ok: true; value: NewReviewData["companyRatings"][number] } | { ok: false; error: string } {
  const prefix = `review.companyRatings[${index}]`;

  if (typeof raw.companySlug !== "string" || raw.companySlug.trim().length === 0) {
    return { ok: false, error: `${prefix}.companySlug is required` };
  }
  const hasScore = raw.score !== undefined && raw.score !== null;
  const hasMaxScore = raw.maxScore !== undefined && raw.maxScore !== null;
  if (hasScore !== hasMaxScore) {
    return {
      ok: false,
      error: `${prefix}.score and ${prefix}.maxScore must both be provided or both be null`,
    };
  }
  if (hasScore && (typeof raw.score !== "number" || raw.score < 0)) {
    return { ok: false, error: `${prefix}.score must be a non-negative number` };
  }
  if (hasMaxScore && (typeof raw.maxScore !== "number" || raw.maxScore <= 0)) {
    return { ok: false, error: `${prefix}.maxScore must be a positive number` };
  }
  if (hasScore && hasMaxScore && Number(raw.score) > Number(raw.maxScore)) {
    return { ok: false, error: `${prefix}.score cannot exceed maxScore` };
  }
  if (typeof raw.summary !== "string" || raw.summary.trim().length === 0) {
    return { ok: false, error: `${prefix}.summary is required` };
  }

  // directLink is optional
  if (raw.directLink !== undefined && raw.directLink !== null) {
    if (typeof raw.directLink !== "string") {
      return { ok: false, error: `${prefix}.directLink must be a string or null` };
    }
  }

  const prosResult = validateHighlightList(raw.pros, `${prefix}.pros`);
  if (!prosResult.ok) return prosResult;

  const consResult = validateHighlightList(raw.cons, `${prefix}.cons`);
  if (!consResult.ok) return consResult;

  const noteworthyResult = validateHighlightList(raw.noteworthy, `${prefix}.noteworthy`);
  if (!noteworthyResult.ok) return noteworthyResult;

  return {
    ok: true,
    value: {
      companySlug: raw.companySlug.trim(),
      score: hasScore ? Number(raw.score) : null,
      maxScore: hasMaxScore ? Number(raw.maxScore) : null,
      summary: raw.summary.trim(),
      directLink:
        raw.directLink !== undefined && raw.directLink !== null
          ? raw.directLink.trim() || null
          : null,
      pros: prosResult.value,
      cons: consResult.value,
      noteworthy: noteworthyResult.value,
    },
  };
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

export async function handleAddReview(
  payload: AddReviewPayload,
  env: GitHubEnv,
): Promise<
  | { success: true; prUrl: string; prNumber: number }
  | { success: false; error: string; status: number }
> {
  const { review: newData, contributor } = payload;

  // 1. Authenticate
  const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;

  // 2. Check that the YAML file doesn't already exist
  const filePath = `data/reviews/${newData.slug}.yaml`;
  const existing = await getFileContent(token, owner, repo, filePath);
  if (existing) {
    return { success: false, error: `Review '${newData.slug}' already exists`, status: 409 };
  }

  // 3. Build the full review object
  const reviewObj: ReviewYamlValue = {
    slug: newData.slug,
    name: newData.name,
    url: newData.url,
    date: newData.date,
    type: newData.type ?? "article",
    summary: newData.summary,
    detailedSummary: newData.detailedSummary,
    author: {
      name: newData.author.name,
      socialProfiles: newData.author.socialProfiles,
    },
    ...(newData.primaryCompanySlug || newData.companyRatings.length === 1
      ? { primaryCompanySlug: newData.primaryCompanySlug ?? newData.companyRatings[0]?.companySlug }
      : {}),
    ...(newData.media ? { media: newData.media } : {}),
    companyRatings: newData.companyRatings.map((cr) => ({
      companySlug: cr.companySlug,
      ...(cr.score !== null ? { score: cr.score } : {}),
      ...(cr.maxScore !== null ? { maxScore: cr.maxScore } : {}),
      summary: cr.summary,
      ...(cr.directLink ? { directLink: cr.directLink } : {}),
      pros: cr.pros ?? [],
      cons: cr.cons ?? [],
      noteworthy: cr.noteworthy ?? [],
    })),
  };

  // 4. Validate
  const validation = PublishedReviewSchema.safeParse(reviewObj);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid review: ${validation.error.issues.map((i) => i.message).join("; ")}`,
      status: 400,
    };
  }

  // 5. Serialize
  const yaml = stringifyReviewYaml(reviewObj);

  // 6. Create branch and PR
  const timestamp = Date.now();
  const branchName = `suggest-add-review/${newData.slug}-${timestamp}`;

  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(token, owner, repo);
  await createBranch(token, owner, repo, branchName, baseSha);

  const commitMessage = `suggest: add new review "${newData.name}"`;
  await upsertFile(token, owner, repo, filePath, yaml, commitMessage, branchName);

  const summaryTable = buildReviewSummaryTable(reviewObj);
  const prTitle = `[Suggestion] Add new review: ${newData.name}`;
  const prBody = buildAddReviewPrBody(
    newData.name,
    summaryTable,
    reviewObj.companyRatings,
    contributor,
  );

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

function buildReviewSummaryTable(review: ReviewYamlValue): string {
  const rows: [string, string][] = [
    ["Slug", review.slug],
    ["Name", review.name],
    ["URL", review.url],
    ["Date", review.date],
    ["Summary", review.summary],
    ["Detailed Summary", review.detailedSummary],
    ["Author", review.author.name],
    ["Companies Rated", String(review.companyRatings.length)],
  ];

  if (review.author.socialProfiles.length > 0) {
    rows.push([
      "Author Profiles",
      review.author.socialProfiles.map((sp) => `[${sp.label}](${sp.url})`).join(", "),
    ]);
  }

  const lines = [
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([field, value]) => `| ${field} | ${value} |`),
  ];

  return lines.join("\n");
}

function buildRatingTable(rating: ReviewYamlValue["companyRatings"][number]): string {
  const rows: [string, string][] = [
    ["Company Slug", rating.companySlug],
    [
      "Score",
      rating.score != null && rating.maxScore != null
        ? `${rating.score} / ${rating.maxScore}`
        : "Not scored",
    ],
    ["Summary", rating.summary],
  ];
  if (rating.directLink) {
    rows.push(["Direct Link", rating.directLink]);
  }
  if (rating.pros.length > 0) {
    rows.push(["Pros", rating.pros.join(", ")]);
  }
  if (rating.cons.length > 0) {
    rows.push(["Cons", rating.cons.join(", ")]);
  }
  if (rating.noteworthy.length > 0) {
    rows.push(["Noteworthy", rating.noteworthy.join(", ")]);
  }

  const lines = [
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([field, value]) => `| ${field} | ${value} |`),
  ];

  return lines.join("\n");
}

function buildAddReviewPrBody(
  reviewName: string,
  reviewTable: string,
  ratings: ReviewYamlValue["companyRatings"],
  contributor?: AddReviewPayload["contributor"],
): string {
  const lines: string[] = [
    `## Suggested New Review: ${reviewName}`,
    "",
    "### Review Info",
    "",
    reviewTable,
    "",
  ];

  for (const rating of ratings) {
    lines.push(`### Rating: ${rating.companySlug}`, "", buildRatingTable(rating), "");
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
