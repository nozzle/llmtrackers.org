/**
 * Form submission worker for LLM Tracker Comparison.
 *
 * Accepts POST requests from the "Suggest Edit" form on the website,
 * validates the data, and creates a GitHub Issue via the GitHub App API.
 */

import {
  createAppJwt,
  getInstallationToken,
  createGitHubIssue,
} from "./github";

// ---- Types ----

interface Env {
  // Secrets (set via wrangler secret put)
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  ALLOWED_ORIGIN: string;

  // Vars (set in wrangler.toml)
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

interface FormSubmission {
  companySlug: string;
  field: string;
  currentValue?: string;
  suggestedValue: string;
  sourceUrl?: string;
  email?: string;
  notes?: string;
}

// ---- Validation ----

const VALID_FIELDS = [
  "pricing",
  "features",
  "llm-support",
  "integrations",
  "schedule",
  "new-plan",
  "removed-plan",
  "company-info",
  "other",
];

function validateSubmission(data: unknown): {
  ok: true;
  value: FormSubmission;
} | {
  ok: false;
  error: string;
} {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const d = data as Record<string, unknown>;

  if (typeof d.companySlug !== "string" || d.companySlug.trim().length === 0) {
    return { ok: false, error: "companySlug is required" };
  }
  if (typeof d.field !== "string" || !VALID_FIELDS.includes(d.field)) {
    return {
      ok: false,
      error: `field must be one of: ${VALID_FIELDS.join(", ")}`,
    };
  }
  if (
    typeof d.suggestedValue !== "string" ||
    d.suggestedValue.trim().length === 0
  ) {
    return { ok: false, error: "suggestedValue is required" };
  }

  // Optional string fields
  if (d.sourceUrl !== undefined && typeof d.sourceUrl !== "string") {
    return { ok: false, error: "sourceUrl must be a string" };
  }
  if (d.email !== undefined && typeof d.email !== "string") {
    return { ok: false, error: "email must be a string" };
  }
  if (d.notes !== undefined && typeof d.notes !== "string") {
    return { ok: false, error: "notes must be a string" };
  }

  return {
    ok: true,
    value: {
      companySlug: d.companySlug as string,
      field: d.field as string,
      currentValue:
        typeof d.currentValue === "string" ? d.currentValue : undefined,
      suggestedValue: d.suggestedValue as string,
      sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl : undefined,
      email: typeof d.email === "string" ? d.email : undefined,
      notes: typeof d.notes === "string" ? d.notes : undefined,
    },
  };
}

// ---- Issue formatting ----

const FIELD_LABELS: Record<string, string> = {
  pricing: "Pricing",
  features: "Features / Capabilities",
  "llm-support": "LLM Support",
  integrations: "Integrations",
  schedule: "Update Schedule",
  "new-plan": "New Plan (not listed)",
  "removed-plan": "Plan Removed / Discontinued",
  "company-info": "Company Info",
  other: "Other",
};

function formatIssueTitle(form: FormSubmission): string {
  const fieldLabel = FIELD_LABELS[form.field] ?? form.field;
  return `[Suggestion] ${form.companySlug}: ${fieldLabel}`;
}

function formatIssueBody(form: FormSubmission): string {
  const lines: string[] = [
    "## Edit Suggestion",
    "",
    `**Company:** \`${form.companySlug}\``,
    `**Field:** ${FIELD_LABELS[form.field] ?? form.field}`,
    "",
  ];

  if (form.currentValue) {
    lines.push(`**Current value:** ${form.currentValue}`);
  }
  lines.push(`**Suggested value:** ${form.suggestedValue}`);
  lines.push("");

  if (form.sourceUrl) {
    lines.push(`**Source:** ${form.sourceUrl}`);
  }

  if (form.notes) {
    lines.push("", "### Notes", "", form.notes);
  }

  lines.push("", "---", "*Submitted via the LLM Tracker Comparison website.*");

  if (form.email) {
    lines.push(`*Contact: ${form.email}*`);
  }

  return lines.join("\n");
}

function issueLabels(field: string): string[] {
  const labels = ["suggestion"];
  if (field === "pricing") labels.push("pricing");
  if (field === "new-plan" || field === "removed-plan") labels.push("plans");
  if (field === "llm-support") labels.push("llm-support");
  return labels;
}

// ---- CORS ----

function corsHeaders(origin: string, allowedOrigin: string): HeadersInit {
  // In dev, allow any localhost origin; in prod, check against ALLOWED_ORIGIN
  const isAllowed =
    !allowedOrigin ||
    origin === allowedOrigin ||
    origin.startsWith("http://localhost:");

  if (!isAllowed) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ---- Worker ----

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Only accept POST
    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed" },
        405,
        cors
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { error: "Invalid JSON body" },
        400,
        cors
      );
    }

    // Validate
    const validation = validateSubmission(body);
    if (!validation.ok) {
      return jsonResponse(
        { error: validation.error },
        400,
        cors
      );
    }

    const form = validation.value;

    // Create GitHub issue
    try {
      const jwt = await createAppJwt(
        env.GITHUB_APP_ID,
        env.GITHUB_APP_PRIVATE_KEY
      );
      const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);

      const issue = await createGitHubIssue(
        token,
        env.GITHUB_REPO_OWNER,
        env.GITHUB_REPO_NAME,
        formatIssueTitle(form),
        formatIssueBody(form),
        issueLabels(form.field)
      );

      return jsonResponse(
        {
          success: true,
          issueUrl: issue.html_url,
          issueNumber: issue.number,
        },
        201,
        cors
      );
    } catch (err) {
      console.error("GitHub API error:", err);
      return jsonResponse(
        { error: "Failed to create GitHub issue. Please try again later." },
        502,
        cors
      );
    }
  },
} satisfies ExportedHandler<Env>;

function jsonResponse(
  data: unknown,
  status: number,
  extraHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
