import { useState, useMemo, useEffect, useId, useCallback } from "react";
import { LlmIcon } from "~/components/llm-icon";
import {
  LLM_MODEL_LABELS,
  type LlmModelKey,
} from "@llm-tracker/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddPlanModalProps {
  companySlug: string;
  companyName: string;
  onClose: () => void;
}

interface NewPlanPayload {
  name: string;
  slug: string;
  price: {
    amount: number | null;
    currency: string;
    period: "monthly" | "yearly" | "one-time";
    note?: string | null;
  };
  aiResponsesMonthly: number | null;
  schedule: "daily" | "weekly" | "monthly";
  locationSupport: "global" | number;
  personaSupport: "unlimited" | number;
  contentGeneration: string | false;
  contentOptimization: string | false;
  integrations: string[];
  llmSupport: Record<LlmModelKey, boolean>;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

// ---------------------------------------------------------------------------
// Turnstile
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
  if (value === null || value === undefined || value === "") return "—";
  if (value === false) return "No";
  if (value === true) return "Yes";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  slug: string;
  priceAmount: string;
  priceCurrency: string;
  pricePeriod: "monthly" | "yearly" | "one-time";
  priceNote: string;
  aiResponsesMonthly: string;
  schedule: "daily" | "weekly" | "monthly";
  locationSupport: string;
  personaSupport: string;
  contentGeneration: string;
  contentOptimization: string;
  integrations: string;
  llmSupport: Record<LlmModelKey, boolean>;
}

function defaultFormState(): FormState {
  return {
    name: "",
    slug: "",
    priceAmount: "",
    priceCurrency: "USD",
    pricePeriod: "monthly",
    priceNote: "",
    aiResponsesMonthly: "",
    schedule: "weekly",
    locationSupport: "global",
    personaSupport: "unlimited",
    contentGeneration: "",
    contentOptimization: "",
    integrations: "",
    llmSupport: Object.fromEntries(
      LLM_KEYS.map((k) => [k, false])
    ) as Record<LlmModelKey, boolean>,
  };
}

// ---------------------------------------------------------------------------
// Preview computation
// ---------------------------------------------------------------------------

interface PreviewEntry {
  label: string;
  value: string;
}

function computePreview(form: FormState): PreviewEntry[] {
  const entries: PreviewEntry[] = [];

  if (form.name.trim()) {
    entries.push({ label: "Plan Name", value: form.name.trim() });
  }
  if (form.slug.trim()) {
    entries.push({ label: "Slug", value: form.slug.trim() });
  }

  const priceAmount =
    form.priceAmount.trim() === "" ? null : Number(form.priceAmount.trim());
  entries.push({
    label: "Price",
    value:
      priceAmount !== null && !Number.isNaN(priceAmount)
        ? `$${priceAmount.toLocaleString("en-US")}`
        : "Custom",
  });
  entries.push({ label: "Currency", value: form.priceCurrency || "USD" });
  entries.push({ label: "Billing Period", value: form.pricePeriod });
  if (form.priceNote.trim()) {
    entries.push({ label: "Price Note", value: form.priceNote.trim() });
  }

  entries.push({
    label: "AI Responses/mo",
    value: formatDisplayValue(
      form.aiResponsesMonthly.trim() === ""
        ? null
        : Number(form.aiResponsesMonthly.trim())
    ),
  });

  // Auto-computed cost/1K
  if (priceAmount !== null && !Number.isNaN(priceAmount)) {
    const responses =
      form.aiResponsesMonthly.trim() === ""
        ? null
        : Number(form.aiResponsesMonthly.trim());
    if (responses !== null && !Number.isNaN(responses) && responses > 0) {
      const costPer1K = Number(((priceAmount / responses) * 1000).toFixed(2));
      entries.push({
        label: "$/1K Responses",
        value: `$${costPer1K.toLocaleString("en-US")}`,
      });
    }
  }

  entries.push({ label: "Schedule", value: form.schedule });
  entries.push({
    label: "Location Support",
    value: formatDisplayValue(
      form.locationSupport.trim().toLowerCase() === "global"
        ? "global"
        : Number(form.locationSupport.trim()) || form.locationSupport.trim()
    ),
  });
  entries.push({
    label: "Persona Support",
    value: formatDisplayValue(
      form.personaSupport.trim().toLowerCase() === "unlimited"
        ? "unlimited"
        : Number(form.personaSupport.trim()) || form.personaSupport.trim()
    ),
  });
  entries.push({
    label: "Content Generation",
    value: form.contentGeneration.trim() || "No",
  });
  entries.push({
    label: "Content Optimization",
    value: form.contentOptimization.trim() || "No",
  });

  const integrations = form.integrations
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  entries.push({
    label: "Integrations",
    value: integrations.join(", ") || "—",
  });

  const supportedLlms = LLM_KEYS.filter((k) => form.llmSupport[k]);
  entries.push({
    label: "LLM Support",
    value:
      supportedLlms.map((k) => LLM_MODEL_LABELS[k]).join(", ") || "—",
  });

  return entries;
}

function formToPayload(form: FormState): NewPlanPayload {
  const priceAmount =
    form.priceAmount.trim() === "" ? null : Number(form.priceAmount.trim());

  const locStr = form.locationSupport.trim().toLowerCase();
  const locationSupport: "global" | number =
    locStr === "global" ? "global" : Number(form.locationSupport.trim());

  const perStr = form.personaSupport.trim().toLowerCase();
  const personaSupport: "unlimited" | number =
    perStr === "unlimited" ? "unlimited" : Number(form.personaSupport.trim());

  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    price: {
      amount: priceAmount,
      currency: form.priceCurrency.trim() || "USD",
      period: form.pricePeriod,
      note: form.priceNote.trim() || null,
    },
    aiResponsesMonthly:
      form.aiResponsesMonthly.trim() === ""
        ? null
        : Number(form.aiResponsesMonthly.trim()),
    schedule: form.schedule,
    locationSupport,
    personaSupport,
    contentGeneration:
      form.contentGeneration.trim() === ""
        ? false
        : form.contentGeneration.trim(),
    contentOptimization:
      form.contentOptimization.trim() === ""
        ? false
        : form.contentOptimization.trim(),
    integrations: form.integrations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    llmSupport: { ...form.llmSupport },
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateForm(form: FormState): string | null {
  if (!form.name.trim()) return "Plan name is required";
  if (!form.slug.trim()) return "Plan slug is required";
  if (
    form.priceAmount.trim() !== "" &&
    Number.isNaN(Number(form.priceAmount.trim()))
  ) {
    return "Price amount must be a number or empty for Custom";
  }
  if (
    form.aiResponsesMonthly.trim() !== "" &&
    Number.isNaN(Number(form.aiResponsesMonthly.trim()))
  ) {
    return "AI Responses/mo must be a number or empty";
  }
  const locStr = form.locationSupport.trim().toLowerCase();
  if (locStr !== "global" && Number.isNaN(Number(locStr))) {
    return 'Location support must be "global" or a number';
  }
  const perStr = form.personaSupport.trim().toLowerCase();
  if (perStr !== "unlimited" && Number.isNaN(Number(perStr))) {
    return 'Persona support must be "unlimited" or a number';
  }
  return null;
}

// ---------------------------------------------------------------------------
// AddPlanModal
// ---------------------------------------------------------------------------

export function AddPlanModal({
  companySlug,
  companyName,
  onClose,
}: Readonly<AddPlanModalProps>) {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [autoSlug, setAutoSlug] = useState(true);
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

  const preview = useMemo(() => computePreview(form), [form]);
  const validationError = useMemo(() => validateForm(form), [form]);
  const isValid = !validationError && form.name.trim().length > 0;

  // Auto-generate slug from name
  useEffect(() => {
    if (autoSlug) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [form.name, autoSlug]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const plan = formToPayload(form);

      const payload: {
        companySlug: string;
        plan: NewPlanPayload;
        contributor?: { name?: string; email?: string; company?: string };
        turnstileToken?: string;
      } = {
        companySlug,
        plan,
      };

      const contrib: { name?: string; email?: string; company?: string } = {};
      if (contributor.name.trim()) contrib.name = contributor.name.trim();
      if (contributor.email.trim()) contrib.email = contributor.email.trim();
      if (contributor.company.trim())
        contrib.company = contributor.company.trim();
      if (Object.keys(contrib).length > 0) payload.contributor = contrib;

      if (turnstileToken) payload.turnstileToken = turnstileToken;

      const response = await fetch("/api/suggest-add-plan", {
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
              Your new plan suggestion has been submitted as a GitHub pull
              request. Our team will review it shortly.
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
              Add New Plan
            </h2>
            <p className="text-sm text-gray-500">{companyName}</p>
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

        {/* Body: left form + right preview */}
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 divide-x divide-gray-200">
            {/* Left panel: form fields */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              {/* ---- Plan Identity ---- */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Plan Identity
                </legend>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Plan Name
                    </span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      placeholder='e.g. "Pro" or "Enterprise"'
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Slug
                    </span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => {
                        setAutoSlug(false);
                        updateForm("slug", e.target.value);
                      }}
                      placeholder="auto-generated from name"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="mt-0.5 block text-xs text-gray-400">
                      URL-safe identifier (no company prefix needed)
                    </span>
                  </label>
                </div>
              </fieldset>

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

            {/* Right panel: live preview */}
            <div className="w-80 shrink-0 overflow-y-auto bg-gray-50 px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Plan Preview
              </h3>
              {form.name.trim() === "" ? (
                <p className="text-sm text-gray-400 italic">
                  Enter a plan name to see a preview.
                </p>
              ) : (
                <div className="space-y-2">
                  {preview.map((entry) => (
                    <div
                      key={entry.label}
                      className="rounded border border-gray-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs font-medium text-gray-500">
                        {entry.label}
                      </div>
                      <div className="mt-0.5 text-sm text-gray-900">
                        {entry.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {validationError && form.name.trim() !== "" && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {validationError}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            {status === "error" && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage || "Failed to submit. Please try again."}
              </div>
            )}

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

            {turnstileSiteKey ? (
              <div className="mb-3">
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onTokenChange={handleTurnstileToken}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                Your suggestion will be submitted as a public GitHub pull
                request for review.
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
                    !isValid ||
                    status === "submitting" ||
                    Boolean(turnstileSiteKey && !turnstileToken)
                  }
                  className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === "submitting"
                    ? "Submitting..."
                    : "Submit New Plan"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
