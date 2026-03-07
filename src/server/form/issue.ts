import type { FormSubmission } from "./validation";

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

export function formatIssueTitle(form: FormSubmission): string {
  const fieldLabel = FIELD_LABELS[form.field] ?? form.field;
  return `[Suggestion] ${form.companySlug}: ${fieldLabel}`;
}

export function formatIssueBody(form: FormSubmission): string {
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

  lines.push("", "---", "*Submitted via the LLM Trackers website.*");
  return lines.join("\n");
}

export function issueLabels(field: string): string[] {
  const labels = ["suggestion"];
  if (field === "pricing") labels.push("pricing");
  if (field === "new-plan" || field === "removed-plan") labels.push("plans");
  if (field === "llm-support") labels.push("llm-support");
  return labels;
}
