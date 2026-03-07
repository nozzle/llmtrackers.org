import { useState, useMemo, useEffect, useId, useCallback } from "react";
import { LlmIcon } from "~/components/llm-icon";
import {
  LLM_MODEL_LABELS,
  type Plan,
  type LlmModelKey,
  type LlmSupport,
} from "@llm-tracker/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditPlanModalProps {
  companySlug: string;
  companyName: string;
  planSlug: string;
  planName: string;
  plan: Plan;
  onClose: () => void;
}

/** Mirrors PlanChanges from form-worker edit-handler */
interface PlanChanges {
  price?: {
    amount?: number | null;
    currency?: string;
    period?: "monthly" | "yearly" | "one-time";
    note?: string | null;
  };
  aiResponsesMonthly?: number | null;
  schedule?: "daily" | "weekly" | "monthly";
  locationSupport?: "global" | number;
  personaSupport?: "unlimited" | number;
  contentGeneration?: string | false;
  contentOptimization?: string | false;
  integrations?: string[];
  llmSupport?: Partial<Record<LlmModelKey, boolean>>;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

// ---------------------------------------------------------------------------
// Turnstile (reused pattern from suggest.tsx)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        }
      ) => string;
    };
  }
}

function TurnstileWidget({
  siteKey,
  onTokenChange,
}: Readonly<{
  siteKey: string;
  onTokenChange: (token: string) => void;
}>) {
  const containerId = useId().replace(/:/g, "");

  useEffect(() => {
    if (typeof document === "undefined") return;

    const renderWidget = () => {
      if (!window.turnstile) return;
      window.turnstile.render(`#${containerId}`, {
        sitekey: siteKey,
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]'
    );

    if (existingScript) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [containerId, onTokenChange, siteKey]);

  return <div id={containerId} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LLM_KEYS: LlmModelKey[] = [
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "llama",
  "grok",
  "aiOverviews",
  "aiMode",
];

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value === false) return "No";
  if (value === true) return "Yes";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}

function formatPriceAmount(amount: number | null): string {
  if (amount === null) return "Custom";
  return `$${amount.toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// Form state type (flat, easy to diff against original plan)
// ---------------------------------------------------------------------------

interface FormState {
  priceAmount: string; // "" means null/custom
  priceCurrency: string;
  pricePeriod: "monthly" | "yearly" | "one-time";
  priceNote: string;
  aiResponsesMonthly: string; // "" means null
  schedule: "daily" | "weekly" | "monthly";
  locationSupport: string; // "global" or numeric string
  personaSupport: string; // "unlimited" or numeric string
  contentGeneration: string; // "" means false
  contentOptimization: string; // "" means false
  integrations: string; // comma-separated
  llmSupport: Record<LlmModelKey, boolean>;
}

function planToFormState(plan: Plan): FormState {
  return {
    priceAmount:
      plan.price.amount !== null ? String(plan.price.amount) : "",
    priceCurrency: plan.price.currency,
    pricePeriod: plan.price.period,
    priceNote: plan.price.note ?? "",
    aiResponsesMonthly:
      plan.aiResponsesMonthly != null
        ? String(plan.aiResponsesMonthly)
        : "",
    schedule: plan.schedule,
    locationSupport: String(plan.locationSupport),
    personaSupport: String(plan.personaSupport),
    contentGeneration:
      plan.contentGeneration === false ? "" : plan.contentGeneration,
    contentOptimization:
      plan.contentOptimization === false ? "" : plan.contentOptimization,
    integrations: plan.integrations.join(", "),
    llmSupport: { ...plan.llmSupport },
  };
}

// ---------------------------------------------------------------------------
// Diff computation
// ---------------------------------------------------------------------------

interface DiffEntry {
  label: string;
  oldValue: string;
  newValue: string;
}

function computeChangesAndDiff(
  original: Plan,
  form: FormState
): { changes: PlanChanges; diff: DiffEntry[] } {
  const changes: PlanChanges = {};
  const diff: DiffEntry[] = [];

  // Price amount
  const newAmount =
    form.priceAmount.trim() === ""
      ? null
      : Number(form.priceAmount.trim());
  if (newAmount !== original.price.amount && !Number.isNaN(newAmount ?? 0)) {
    if (!changes.price) changes.price = {};
    changes.price.amount = newAmount;
    diff.push({
      label: "Price",
      oldValue: formatPriceAmount(original.price.amount),
      newValue: formatPriceAmount(newAmount),
    });
  }

  // Price currency
  if (form.priceCurrency.trim() !== original.price.currency) {
    if (!changes.price) changes.price = {};
    changes.price.currency = form.priceCurrency.trim();
    diff.push({
      label: "Currency",
      oldValue: original.price.currency,
      newValue: form.priceCurrency.trim(),
    });
  }

  // Price period
  if (form.pricePeriod !== original.price.period) {
    if (!changes.price) changes.price = {};
    changes.price.period = form.pricePeriod;
    diff.push({
      label: "Billing Period",
      oldValue: original.price.period,
      newValue: form.pricePeriod,
    });
  }

  // Price note
  const newNote = form.priceNote.trim() === "" ? null : form.priceNote.trim();
  const origNote = original.price.note ?? null;
  if (newNote !== origNote) {
    if (!changes.price) changes.price = {};
    changes.price.note = newNote;
    diff.push({
      label: "Price Note",
      oldValue: formatDisplayValue(origNote),
      newValue: formatDisplayValue(newNote),
    });
  }

  // AI Responses Monthly
  const newResponses =
    form.aiResponsesMonthly.trim() === ""
      ? null
      : Number(form.aiResponsesMonthly.trim());
  const origResponses = original.aiResponsesMonthly ?? null;
  if (newResponses !== origResponses && !Number.isNaN(newResponses ?? 0)) {
    changes.aiResponsesMonthly = newResponses;
    diff.push({
      label: "AI Responses/mo",
      oldValue: formatDisplayValue(origResponses),
      newValue: formatDisplayValue(newResponses),
    });
  }

  // Auto-computed: show cost/1K if price or responses changed
  if (changes.price?.amount !== undefined || changes.aiResponsesMonthly !== undefined) {
    const effectivePrice = changes.price?.amount !== undefined ? changes.price.amount : original.price.amount;
    const effectiveResponses = changes.aiResponsesMonthly !== undefined ? changes.aiResponsesMonthly : (original.aiResponsesMonthly ?? null);
    let newCostPer1K: number | null = null;
    if (effectivePrice !== null && effectiveResponses !== null && effectiveResponses > 0) {
      newCostPer1K = Number(((effectivePrice / effectiveResponses) * 1000).toFixed(2));
    }
    diff.push({
      label: "$/1K Responses",
      oldValue: formatDisplayValue(original.pricePer1000Responses ?? null),
      newValue: formatDisplayValue(newCostPer1K),
    });
  }

  // Schedule
  if (form.schedule !== original.schedule) {
    changes.schedule = form.schedule;
    diff.push({
      label: "Schedule",
      oldValue: original.schedule,
      newValue: form.schedule,
    });
  }

  // Location support
  const newLoc: "global" | number =
    form.locationSupport.trim().toLowerCase() === "global"
      ? "global"
      : Number(form.locationSupport.trim());
  if (
    String(newLoc) !== String(original.locationSupport) &&
    (newLoc === "global" || !Number.isNaN(newLoc))
  ) {
    changes.locationSupport = newLoc;
    diff.push({
      label: "Location Support",
      oldValue: formatDisplayValue(original.locationSupport),
      newValue: formatDisplayValue(newLoc),
    });
  }

  // Persona support
  const newPersona: "unlimited" | number =
    form.personaSupport.trim().toLowerCase() === "unlimited"
      ? "unlimited"
      : Number(form.personaSupport.trim());
  if (
    String(newPersona) !== String(original.personaSupport) &&
    (newPersona === "unlimited" || !Number.isNaN(newPersona))
  ) {
    changes.personaSupport = newPersona;
    diff.push({
      label: "Persona Support",
      oldValue: formatDisplayValue(original.personaSupport),
      newValue: formatDisplayValue(newPersona),
    });
  }

  // Content Generation
  const newCG: string | false =
    form.contentGeneration.trim() === "" ? false : form.contentGeneration.trim();
  if (String(newCG) !== String(original.contentGeneration)) {
    changes.contentGeneration = newCG;
    diff.push({
      label: "Content Generation",
      oldValue: formatDisplayValue(original.contentGeneration),
      newValue: formatDisplayValue(newCG),
    });
  }

  // Content Optimization
  const newCO: string | false =
    form.contentOptimization.trim() === ""
      ? false
      : form.contentOptimization.trim();
  if (String(newCO) !== String(original.contentOptimization)) {
    changes.contentOptimization = newCO;
    diff.push({
      label: "Content Optimization",
      oldValue: formatDisplayValue(original.contentOptimization),
      newValue: formatDisplayValue(newCO),
    });
  }

  // Integrations
  const newIntegrations = form.integrations
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origIntegrations = original.integrations;
  if (
    newIntegrations.length !== origIntegrations.length ||
    newIntegrations.some((v, i) => v !== origIntegrations[i])
  ) {
    changes.integrations = newIntegrations;
    diff.push({
      label: "Integrations",
      oldValue: origIntegrations.join(", ") || "—",
      newValue: newIntegrations.join(", ") || "—",
    });
  }

  // LLM Support
  const llmChanges: Partial<Record<LlmModelKey, boolean>> = {};
  for (const key of LLM_KEYS) {
    if (form.llmSupport[key] !== original.llmSupport[key]) {
      llmChanges[key] = form.llmSupport[key];
      diff.push({
        label: LLM_MODEL_LABELS[key],
        oldValue: original.llmSupport[key] ? "Yes" : "No",
        newValue: form.llmSupport[key] ? "Yes" : "No",
      });
    }
  }
  if (Object.keys(llmChanges).length > 0) {
    changes.llmSupport = llmChanges;
  }

  return { changes, diff };
}

// ---------------------------------------------------------------------------
// EditPlanModal
// ---------------------------------------------------------------------------

export function EditPlanModal({
  companySlug,
  companyName,
  planSlug,
  planName,
  plan,
  onClose,
}: Readonly<EditPlanModalProps>) {
  const [form, setForm] = useState<FormState>(() => planToFormState(plan));
  const [contributor, setContributor] = useState({
    name: "",
    email: "",
    company: "",
  });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [prUrl, setPrUrl] = useState("");

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Compute diff
  const { changes, diff } = useMemo(
    () => computeChangesAndDiff(plan, form),
    [plan, form]
  );

  const hasChanges = diff.length > 0;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleTurnstileToken = useCallback(
    (token: string) => setTurnstileToken(token),
    []
  );

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const payload: {
        companySlug: string;
        planSlug: string;
        changes: PlanChanges;
        contributor?: { name?: string; email?: string; company?: string };
        turnstileToken?: string;
      } = {
        companySlug,
        planSlug,
        changes,
      };

      // Only include non-empty contributor fields
      const contrib: { name?: string; email?: string; company?: string } = {};
      if (contributor.name.trim()) contrib.name = contributor.name.trim();
      if (contributor.email.trim()) contrib.email = contributor.email.trim();
      if (contributor.company.trim())
        contrib.company = contributor.company.trim();
      if (Object.keys(contrib).length > 0) payload.contributor = contrib;

      if (turnstileToken) payload.turnstileToken = turnstileToken;

      const response = await fetch("/api/suggest-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const result = (await response.json()) as { prUrl: string };
      setPrUrl(result.prUrl);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  }

  // -- Update helpers --

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleLlm(key: LlmModelKey) {
    setForm((prev) => ({
      ...prev,
      llmSupport: {
        ...prev.llmSupport,
        [key]: !prev.llmSupport[key],
      },
    }));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Success screen
  if (status === "success") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className="mx-4 w-full max-w-md rounded-lg bg-white p-8 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Pull Request Created
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Your suggested edit has been submitted as a GitHub pull request.
              Our team will review it shortly.
            </p>
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                View Pull Request
              </a>
            )}
            <div className="mt-6">
              <button
                onClick={onClose}
                className="cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Suggest Edit
            </h2>
            <p className="text-sm text-gray-500">
              {companyName} &mdash; {planName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body: left form + right diff */}
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 divide-x divide-gray-200">
            {/* Left panel: form fields */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              {/* ---- Pricing ---- */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Pricing
                </legend>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Price ($/mo)
                      </span>
                      <input
                        type="text"
                        value={form.priceAmount}
                        onChange={(e) =>
                          updateForm("priceAmount", e.target.value)
                        }
                        placeholder="Leave empty for Custom"
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Currency
                      </span>
                      <input
                        type="text"
                        value={form.priceCurrency}
                        onChange={(e) =>
                          updateForm("priceCurrency", e.target.value)
                        }
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Billing Period
                      </span>
                      <select
                        value={form.pricePeriod}
                        onChange={(e) =>
                          updateForm(
                            "pricePeriod",
                            e.target.value as FormState["pricePeriod"]
                          )
                        }
                        className="mt-1 block w-full cursor-pointer rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="one-time">One-time</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Price Note
                      </span>
                      <input
                        type="text"
                        value={form.priceNote}
                        onChange={(e) =>
                          updateForm("priceNote", e.target.value)
                        }
                        placeholder="e.g. per seat"
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>
              </fieldset>

              {/* ---- Usage ---- */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Usage
                </legend>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    AI Responses / month
                  </span>
                  <input
                    type="text"
                    value={form.aiResponsesMonthly}
                    onChange={(e) =>
                      updateForm("aiResponsesMonthly", e.target.value)
                    }
                    placeholder="Leave empty for N/A"
                    className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
              </fieldset>

              {/* ---- Schedule & Location ---- */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Schedule & Location
                </legend>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Schedule
                    </span>
                    <select
                      value={form.schedule}
                      onChange={(e) =>
                        updateForm(
                          "schedule",
                          e.target.value as FormState["schedule"]
                        )
                      }
                      className="mt-1 block w-full cursor-pointer rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Location Support
                      </span>
                      <input
                        type="text"
                        value={form.locationSupport}
                        onChange={(e) =>
                          updateForm("locationSupport", e.target.value)
                        }
                        placeholder='"global" or a number'
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Persona Support
                      </span>
                      <input
                        type="text"
                        value={form.personaSupport}
                        onChange={(e) =>
                          updateForm("personaSupport", e.target.value)
                        }
                        placeholder='"unlimited" or a number'
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>
              </fieldset>

              {/* ---- Content ---- */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Content
                </legend>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Content Generation
                    </span>
                    <input
                      type="text"
                      value={form.contentGeneration}
                      onChange={(e) =>
                        updateForm("contentGeneration", e.target.value)
                      }
                      placeholder="Leave empty for No"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Content Optimization
                    </span>
                    <input
                      type="text"
                      value={form.contentOptimization}
                      onChange={(e) =>
                        updateForm("contentOptimization", e.target.value)
                      }
                      placeholder="Leave empty for No"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </fieldset>

              {/* ---- LLM Support ---- */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  LLM Support
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {LLM_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={form.llmSupport[key]}
                        onChange={() => toggleLlm(key)}
                        className="cursor-pointer accent-blue-600"
                      />
                      <LlmIcon model={key} size={16} />
                      <span className="text-gray-700">
                        {LLM_MODEL_LABELS[key]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* ---- Integrations ---- */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Integrations
                </legend>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    Integrations (comma-separated)
                  </span>
                  <input
                    type="text"
                    value={form.integrations}
                    onChange={(e) =>
                      updateForm("integrations", e.target.value)
                    }
                    placeholder="e.g. GSC, GA4, Semrush"
                    className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
              </fieldset>
            </div>

            {/* Right panel: live diff */}
            <div className="w-80 shrink-0 overflow-y-auto bg-gray-50 px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Changes Preview
              </h3>
              {diff.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No changes yet. Edit a field on the left to see a preview.
                </p>
              ) : (
                <div className="space-y-2">
                  {diff.map((entry) => (
                    <div
                      key={entry.label}
                      className="rounded border border-gray-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs font-medium text-gray-500">
                        {entry.label}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm">
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through">
                          {entry.oldValue}
                        </span>
                        <svg
                          className="h-3 w-3 shrink-0 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                          />
                        </svg>
                        <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">
                          {entry.newValue}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            {/* Error */}
            {status === "error" && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage || "Failed to submit. Please try again."}
              </div>
            )}

            {/* Contributor fields */}
            <div className="mb-3 grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-500">
                  Your Name (optional)
                </span>
                <input
                  type="text"
                  value={contributor.name}
                  onChange={(e) =>
                    setContributor((p) => ({ ...p, name: e.target.value }))
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">
                  Email (optional)
                </span>
                <input
                  type="email"
                  value={contributor.email}
                  onChange={(e) =>
                    setContributor((p) => ({ ...p, email: e.target.value }))
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">
                  Company (optional)
                </span>
                <input
                  type="text"
                  value={contributor.company}
                  onChange={(e) =>
                    setContributor((p) => ({ ...p, company: e.target.value }))
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>

            {/* Turnstile */}
            {turnstileSiteKey ? (
              <div className="mb-3">
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onTokenChange={handleTurnstileToken}
                />
              </div>
            ) : null}

            {/* Disclaimer + buttons */}
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                Your edit will be submitted as a public GitHub pull request for
                review.
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !hasChanges ||
                    status === "submitting" ||
                    Boolean(turnstileSiteKey && !turnstileToken)
                  }
                  className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === "submitting"
                    ? "Submitting..."
                    : "Submit Suggestion"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
