/**
 * Diff extracted LLM data against existing YAML data.
 * Produces a human-readable summary of changes.
 */

import type { ExtractedPlan } from "./extractor";

export interface PlanDiff {
  planName: string;
  changes: FieldChange[];
}

export interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface ExistingPlan {
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

interface ExistingCompany {
  slug: string;
  name: string;
  plans: ExistingPlan[];
  [key: string]: unknown;
}

/**
 * Compare extracted plans against existing company data.
 * Returns an array of plan diffs. Empty array = no changes.
 */
export function diffCompany(
  existing: ExistingCompany,
  extracted: ExtractedPlan[]
): PlanDiff[] {
  const diffs: PlanDiff[] = [];

  for (const extractedPlan of extracted) {
    // Try to match by name (fuzzy: case-insensitive, trim)
    const existingPlan = existing.plans.find(
      (p) => normalize(p.name) === normalize(extractedPlan.name)
    );

    if (!existingPlan) {
      // New plan detected
      diffs.push({
        planName: extractedPlan.name,
        changes: [
          {
            field: "(new plan)",
            oldValue: "not present",
            newValue: `${extractedPlan.name} - $${extractedPlan.price.amount ?? "Custom"}/${extractedPlan.price.period}`,
          },
        ],
      });
      continue;
    }

    const changes: FieldChange[] = [];

    // Price
    if (extractedPlan.price.amount !== null) {
      const oldAmt = existingPlan.price.amount;
      const newAmt = extractedPlan.price.amount;
      if (oldAmt !== null && newAmt !== oldAmt) {
        changes.push({
          field: "price.amount",
          oldValue: `$${oldAmt}`,
          newValue: `$${newAmt}`,
        });
      }
    }

    // AI Responses Monthly
    if (extractedPlan.aiResponsesMonthly !== null) {
      const old = existingPlan.aiResponsesMonthly ?? null;
      const extracted = extractedPlan.aiResponsesMonthly;
      if (old !== null && extracted !== old && Math.abs(extracted - old) / old > 0.05) {
        changes.push({
          field: "aiResponsesMonthly",
          oldValue: String(old),
          newValue: String(extracted),
        });
      }
    }

    // Schedule
    if (extractedPlan.schedule !== null && existingPlan.schedule) {
      if (extractedPlan.schedule !== existingPlan.schedule) {
        changes.push({
          field: "schedule",
          oldValue: existingPlan.schedule,
          newValue: extractedPlan.schedule,
        });
      }
    }

    // LLM Support
    if (extractedPlan.llmSupport && existingPlan.llmSupport) {
      const llmKeys = [
        "chatgpt", "gemini", "perplexity", "claude",
        "llama", "grok", "aiOverviews", "aiMode",
      ] as const;

      for (const key of llmKeys) {
        const oldVal = existingPlan.llmSupport[key] ?? false;
        const newVal = extractedPlan.llmSupport[key] ?? false;
        if (oldVal !== newVal) {
          changes.push({
            field: `llmSupport.${key}`,
            oldValue: String(oldVal),
            newValue: String(newVal),
          });
        }
      }
    }

    // Integrations (just detect additions/removals)
    if (extractedPlan.integrations.length > 0 && existingPlan.integrations) {
      const oldSet = new Set(existingPlan.integrations.map(normalize));
      const newSet = new Set(extractedPlan.integrations.map(normalize));

      const added = extractedPlan.integrations.filter(
        (i) => !oldSet.has(normalize(i))
      );
      const removed = existingPlan.integrations.filter(
        (i) => !newSet.has(normalize(i))
      );

      if (added.length > 0) {
        changes.push({
          field: "integrations (added)",
          oldValue: "-",
          newValue: added.join(", "),
        });
      }
      if (removed.length > 0) {
        changes.push({
          field: "integrations (removed)",
          oldValue: removed.join(", "),
          newValue: "-",
        });
      }
    }

    // Included LLM Models count
    if (
      extractedPlan.includedLlmModels !== null &&
      existingPlan.includedLlmModels != null
    ) {
      if (extractedPlan.includedLlmModels !== existingPlan.includedLlmModels) {
        changes.push({
          field: "includedLlmModels",
          oldValue: String(existingPlan.includedLlmModels),
          newValue: String(extractedPlan.includedLlmModels),
        });
      }
    }

    if (changes.length > 0) {
      diffs.push({ planName: existingPlan.name, changes });
    }
  }

  return diffs;
}

/**
 * Format diffs into a markdown summary for a PR body.
 */
export function formatDiffMarkdown(
  companySlug: string,
  diffs: PlanDiff[]
): string {
  const lines: string[] = [
    `## Detected Changes for \`${companySlug}\``,
    "",
  ];

  for (const diff of diffs) {
    lines.push(`### ${diff.planName}`);
    lines.push("");
    lines.push("| Field | Old | New |");
    lines.push("|-------|-----|-----|");
    for (const change of diff.changes) {
      lines.push(`| ${change.field} | ${change.oldValue} | ${change.newValue} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "*Auto-detected by the LLM Tracker update checker. Please review before merging.*"
  );

  return lines.join("\n");
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}
