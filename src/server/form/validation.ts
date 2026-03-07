interface FormSubmission {
  companySlug: string;
  field: string;
  currentValue?: string;
  suggestedValue: string;
  sourceUrl?: string;
  notes?: string;
  website?: string;
  turnstileToken?: string;
}

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

export function validateSubmission(data: unknown):
  | {
      ok: true;
      value: FormSubmission;
    }
  | {
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
  if (typeof d.suggestedValue !== "string" || d.suggestedValue.trim().length === 0) {
    return { ok: false, error: "suggestedValue is required" };
  }

  if (d.sourceUrl !== undefined && typeof d.sourceUrl !== "string") {
    return { ok: false, error: "sourceUrl must be a string" };
  }
  if (d.notes !== undefined && typeof d.notes !== "string") {
    return { ok: false, error: "notes must be a string" };
  }
  if (d.website !== undefined && typeof d.website !== "string") {
    return { ok: false, error: "website must be a string" };
  }
  if (d.turnstileToken !== undefined && typeof d.turnstileToken !== "string") {
    return { ok: false, error: "turnstileToken must be a string" };
  }

  if (typeof d.suggestedValue === "string" && d.suggestedValue.trim().length > 2000) {
    return { ok: false, error: "suggestedValue is too long" };
  }
  if (typeof d.currentValue === "string" && d.currentValue.trim().length > 1000) {
    return { ok: false, error: "currentValue is too long" };
  }
  if (typeof d.notes === "string" && d.notes.trim().length > 4000) {
    return { ok: false, error: "notes are too long" };
  }
  if (typeof d.sourceUrl === "string" && !isValidUrl(d.sourceUrl)) {
    return { ok: false, error: "sourceUrl must be a valid URL" };
  }
  if (typeof d.website === "string" && d.website.trim().length > 0) {
    return { ok: false, error: "Spam submission rejected" };
  }

  return {
    ok: true,
    value: {
      companySlug: d.companySlug,
      field: d.field,
      currentValue: typeof d.currentValue === "string" ? d.currentValue : undefined,
      suggestedValue: d.suggestedValue,
      sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl : undefined,
      notes: typeof d.notes === "string" ? d.notes : undefined,
      website: typeof d.website === "string" ? d.website : undefined,
      turnstileToken: typeof d.turnstileToken === "string" ? d.turnstileToken : undefined,
    },
  };
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type { FormSubmission };
