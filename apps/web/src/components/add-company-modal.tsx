import { useState, useMemo, useEffect, useId, useCallback } from "react";
import { LlmIcon } from "~/components/llm-icon";
import {
  LLM_MODEL_LABELS,
  type LlmModelKey,
} from "@llm-tracker/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddCompanyModalProps {
  onClose: () => void;
}

interface PlanFormState {
  id: string; // local key for React
  name: string;
  slug: string;
  autoSlug: boolean;
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

interface CompanyFormState {
  name: string;
  slug: string;
  autoSlug: boolean;
  website: string;
  description: string;
  pricingUrl: string;
  featuresUrl: string;
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let planIdCounter = 0;

function createEmptyPlan(): PlanFormState {
  planIdCounter += 1;
  return {
    id: `plan-${planIdCounter}-${Date.now()}`,
    name: "",
    slug: "",
    autoSlug: true,
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

function defaultCompanyState(): CompanyFormState {
  return {
    name: "",
    slug: "",
    autoSlug: true,
    website: "",
    description: "",
    pricingUrl: "",
    featuresUrl: "",
  };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

interface PreviewEntry {
  label: string;
  value: string;
}

function computeCompanyPreview(
  company: CompanyFormState,
  plans: PlanFormState[]
): PreviewEntry[] {
  const entries: PreviewEntry[] = [];

  if (company.name.trim())
    entries.push({ label: "Company Name", value: company.name.trim() });
  if (company.slug.trim())
    entries.push({ label: "Slug", value: company.slug.trim() });
  if (company.website.trim())
    entries.push({ label: "Website", value: company.website.trim() });
  if (company.description.trim())
    entries.push({
      label: "Description",
      value:
        company.description.trim().length > 80
          ? company.description.trim().slice(0, 80) + "..."
          : company.description.trim(),
    });
  if (company.pricingUrl.trim())
    entries.push({ label: "Pricing URL", value: company.pricingUrl.trim() });
  if (company.featuresUrl.trim())
    entries.push({ label: "Features URL", value: company.featuresUrl.trim() });

  entries.push({ label: "Plans", value: String(plans.length) });

  for (const plan of plans) {
    if (plan.name.trim()) {
      const priceAmount =
        plan.priceAmount.trim() === ""
          ? null
          : Number(plan.priceAmount.trim());
      const priceStr =
        priceAmount !== null && !Number.isNaN(priceAmount)
          ? `$${priceAmount.toLocaleString("en-US")}/${plan.pricePeriod}`
          : "Custom";
      entries.push({
        label: `Plan: ${plan.name.trim()}`,
        value: priceStr,
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateCompanyForm(
  company: CompanyFormState,
  plans: PlanFormState[]
): string | null {
  if (!company.name.trim()) return "Company name is required";
  if (!company.slug.trim()) return "Company slug is required";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(company.slug.trim())) {
    return "Slug must be lowercase alphanumeric with hyphens";
  }
  if (!company.website.trim()) return "Company website is required";
  try {
    new URL(company.website.trim());
  } catch {
    return "Website must be a valid URL (include https://)";
  }
  if (!company.description.trim()) return "Company description is required";

  if (plans.length === 0) return "At least one plan is required";

  const slugs = new Set<string>();
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    if (!plan.name.trim()) return `Plan ${i + 1}: name is required`;
    if (!plan.slug.trim()) return `Plan ${i + 1}: slug is required`;
    if (slugs.has(plan.slug.trim())) {
      return `Duplicate plan slug: "${plan.slug.trim()}"`;
    }
    slugs.add(plan.slug.trim());

    if (
      plan.priceAmount.trim() !== "" &&
      Number.isNaN(Number(plan.priceAmount.trim()))
    ) {
      return `Plan ${i + 1}: price must be a number or empty`;
    }
    if (
      plan.aiResponsesMonthly.trim() !== "" &&
      Number.isNaN(Number(plan.aiResponsesMonthly.trim()))
    ) {
      return `Plan ${i + 1}: AI responses must be a number or empty`;
    }
    const locStr = plan.locationSupport.trim().toLowerCase();
    if (locStr !== "global" && Number.isNaN(Number(locStr))) {
      return `Plan ${i + 1}: location support must be "global" or a number`;
    }
    const perStr = plan.personaSupport.trim().toLowerCase();
    if (perStr !== "unlimited" && Number.isNaN(Number(perStr))) {
      return `Plan ${i + 1}: persona support must be "unlimited" or a number`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

function buildPayload(
  company: CompanyFormState,
  plans: PlanFormState[]
) {
  return {
    slug: company.slug.trim(),
    name: company.name.trim(),
    website: company.website.trim(),
    description: company.description.trim(),
    pricingUrl: company.pricingUrl.trim() || null,
    featuresUrl: company.featuresUrl.trim() || null,
    plans: plans.map((plan) => {
      const priceAmount =
        plan.priceAmount.trim() === ""
          ? null
          : Number(plan.priceAmount.trim());

      const locStr = plan.locationSupport.trim().toLowerCase();
      const locationSupport: "global" | number =
        locStr === "global" ? "global" : Number(plan.locationSupport.trim());

      const perStr = plan.personaSupport.trim().toLowerCase();
      const personaSupport: "unlimited" | number =
        perStr === "unlimited"
          ? "unlimited"
          : Number(plan.personaSupport.trim());

      return {
        name: plan.name.trim(),
        slug: plan.slug.trim(),
        price: {
          amount: priceAmount,
          currency: plan.priceCurrency.trim() || "USD",
          period: plan.pricePeriod,
          note: plan.priceNote.trim() || null,
        },
        aiResponsesMonthly:
          plan.aiResponsesMonthly.trim() === ""
            ? null
            : Number(plan.aiResponsesMonthly.trim()),
        schedule: plan.schedule,
        locationSupport,
        personaSupport,
        contentGeneration:
          plan.contentGeneration.trim() === ""
            ? false
            : plan.contentGeneration.trim(),
        contentOptimization:
          plan.contentOptimization.trim() === ""
            ? false
            : plan.contentOptimization.trim(),
        integrations: plan.integrations
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        llmSupport: { ...plan.llmSupport },
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// PlanFormSection (inline plan form)
// ---------------------------------------------------------------------------

function PlanFormSection({
  plan,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: Readonly<{
  plan: PlanFormState;
  index: number;
  canRemove: boolean;
  onUpdate: (updated: PlanFormState) => void;
  onRemove: () => void;
}>) {
  const [expanded, setExpanded] = useState(true);

  function update<K extends keyof PlanFormState>(
    key: K,
    value: PlanFormState[K]
  ) {
    onUpdate({ ...plan, [key]: value });
  }

  function toggleLlm(key: LlmModelKey) {
    onUpdate({
      ...plan,
      llmSupport: { ...plan.llmSupport, [key]: !plan.llmSupport[key] },
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Plan header (collapsible) */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900"
        >
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
          Plan {index + 1}
          {plan.name.trim() ? `: ${plan.name.trim()}` : ""}
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Remove plan"
          >
            <svg
              className="h-4 w-4"
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
        )}
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Plan Name
              </span>
              <input
                type="text"
                value={plan.name}
                onChange={(e) => {
                  update("name", e.target.value);
                  if (plan.autoSlug) {
                    onUpdate({
                      ...plan,
                      name: e.target.value,
                      slug: slugify(e.target.value),
                    });
                  }
                }}
                placeholder='e.g. "Pro"'
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Slug</span>
              <input
                type="text"
                value={plan.slug}
                onChange={(e) => {
                  onUpdate({
                    ...plan,
                    slug: e.target.value,
                    autoSlug: false,
                  });
                }}
                placeholder="auto-generated"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Price</span>
              <input
                type="text"
                value={plan.priceAmount}
                onChange={(e) => update("priceAmount", e.target.value)}
                placeholder="Custom"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Currency
              </span>
              <input
                type="text"
                value={plan.priceCurrency}
                onChange={(e) => update("priceCurrency", e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Period</span>
              <select
                value={plan.pricePeriod}
                onChange={(e) =>
                  update(
                    "pricePeriod",
                    e.target.value as PlanFormState["pricePeriod"]
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
              <span className="text-xs font-medium text-gray-600">Note</span>
              <input
                type="text"
                value={plan.priceNote}
                onChange={(e) => update("priceNote", e.target.value)}
                placeholder="e.g. per seat"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Usage & Schedule */}
          <div className="grid grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                AI Responses/mo
              </span>
              <input
                type="text"
                value={plan.aiResponsesMonthly}
                onChange={(e) =>
                  update("aiResponsesMonthly", e.target.value)
                }
                placeholder="N/A"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Schedule
              </span>
              <select
                value={plan.schedule}
                onChange={(e) =>
                  update(
                    "schedule",
                    e.target.value as PlanFormState["schedule"]
                  )
                }
                className="mt-1 block w-full cursor-pointer rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Location
              </span>
              <input
                type="text"
                value={plan.locationSupport}
                onChange={(e) =>
                  update("locationSupport", e.target.value)
                }
                placeholder="global"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Persona
              </span>
              <input
                type="text"
                value={plan.personaSupport}
                onChange={(e) =>
                  update("personaSupport", e.target.value)
                }
                placeholder="unlimited"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Content */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Content Generation
              </span>
              <input
                type="text"
                value={plan.contentGeneration}
                onChange={(e) =>
                  update("contentGeneration", e.target.value)
                }
                placeholder="No"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Content Optimization
              </span>
              <input
                type="text"
                value={plan.contentOptimization}
                onChange={(e) =>
                  update("contentOptimization", e.target.value)
                }
                placeholder="No"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Integrations */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600">
              Integrations (comma-separated)
            </span>
            <input
              type="text"
              value={plan.integrations}
              onChange={(e) => update("integrations", e.target.value)}
              placeholder="e.g. GSC, GA4, Semrush"
              className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          {/* LLM Support */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-gray-600">
              LLM Support
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {LLM_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={plan.llmSupport[key]}
                    onChange={() => toggleLlm(key)}
                    className="cursor-pointer accent-blue-600"
                  />
                  <LlmIcon model={key} size={14} />
                  <span className="text-gray-700">
                    {LLM_MODEL_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddCompanyModal
// ---------------------------------------------------------------------------

export function AddCompanyModal({
  onClose,
}: Readonly<AddCompanyModalProps>) {
  const [company, setCompany] = useState<CompanyFormState>(defaultCompanyState);
  const [plans, setPlans] = useState<PlanFormState[]>([createEmptyPlan()]);
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
  const workerUrl =
    import.meta.env.VITE_FORM_WORKER_URL || "/api/suggest-add-company";

  const preview = useMemo(
    () => computeCompanyPreview(company, plans),
    [company, plans]
  );
  const validationError = useMemo(
    () => validateCompanyForm(company, plans),
    [company, plans]
  );
  const isValid = !validationError;

  // Auto-generate company slug from name
  useEffect(() => {
    if (company.autoSlug) {
      setCompany((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [company.name, company.autoSlug]);

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
      const companyPayload = buildPayload(company, plans);

      const payload: {
        company: ReturnType<typeof buildPayload>;
        contributor?: { name?: string; email?: string; company?: string };
        turnstileToken?: string;
      } = {
        company: companyPayload,
      };

      const contrib: { name?: string; email?: string; company?: string } = {};
      if (contributor.name.trim()) contrib.name = contributor.name.trim();
      if (contributor.email.trim()) contrib.email = contributor.email.trim();
      if (contributor.company.trim())
        contrib.company = contributor.company.trim();
      if (Object.keys(contrib).length > 0) payload.contributor = contrib;

      if (turnstileToken) payload.turnstileToken = turnstileToken;

      const endpoint =
        workerUrl.replace(/\/$/, "") + "/api/suggest-add-company";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const result = await response.json();
      setPrUrl(result.prUrl);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  }

  function updateCompany<K extends keyof CompanyFormState>(
    key: K,
    value: CompanyFormState[K]
  ) {
    setCompany((prev) => ({ ...prev, [key]: value }));
  }

  function updatePlan(index: number, updated: PlanFormState) {
    setPlans((prev) => prev.map((p, i) => (i === index ? updated : p)));
  }

  function removePlan(index: number) {
    setPlans((prev) => prev.filter((_, i) => i !== index));
  }

  function addPlan() {
    setPlans((prev) => [...prev, createEmptyPlan()]);
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
              Your new company suggestion has been submitted as a GitHub pull
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
        className="mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Add New Company
            </h2>
            <p className="text-sm text-gray-500">
              Submit a new company with its plans for review
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

        {/* Body: left form + right preview */}
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 divide-x divide-gray-200">
            {/* Left panel: form */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              {/* Company Details */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Company Details
                </legend>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Company Name
                      </span>
                      <input
                        type="text"
                        value={company.name}
                        onChange={(e) =>
                          updateCompany("name", e.target.value)
                        }
                        placeholder="e.g. Acme Inc"
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Slug
                      </span>
                      <input
                        type="text"
                        value={company.slug}
                        onChange={(e) => {
                          setCompany((prev) => ({
                            ...prev,
                            slug: e.target.value,
                            autoSlug: false,
                          }));
                        }}
                        placeholder="auto-generated"
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Website
                    </span>
                    <input
                      type="url"
                      value={company.website}
                      onChange={(e) =>
                        updateCompany("website", e.target.value)
                      }
                      placeholder="https://example.com"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Description
                    </span>
                    <textarea
                      value={company.description}
                      onChange={(e) =>
                        updateCompany("description", e.target.value)
                      }
                      rows={2}
                      placeholder="Brief description of the company"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Pricing URL (optional)
                      </span>
                      <input
                        type="url"
                        value={company.pricingUrl}
                        onChange={(e) =>
                          updateCompany("pricingUrl", e.target.value)
                        }
                        placeholder="https://..."
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">
                        Features URL (optional)
                      </span>
                      <input
                        type="url"
                        value={company.featuresUrl}
                        onChange={(e) =>
                          updateCompany("featuresUrl", e.target.value)
                        }
                        placeholder="https://..."
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>
              </fieldset>

              {/* Plans */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Plans
                </legend>
                <div className="space-y-3">
                  {plans.map((plan, index) => (
                    <PlanFormSection
                      key={plan.id}
                      plan={plan}
                      index={index}
                      canRemove={plans.length > 1}
                      onUpdate={(updated) => updatePlan(index, updated)}
                      onRemove={() => removePlan(index)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addPlan}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    Add Another Plan
                  </button>
                </div>
              </fieldset>
            </div>

            {/* Right panel: live preview */}
            <div className="w-72 shrink-0 overflow-y-auto bg-gray-50 px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Preview
              </h3>
              {company.name.trim() === "" ? (
                <p className="text-sm text-gray-400 italic">
                  Enter a company name to see a preview.
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
              {validationError && company.name.trim() !== "" && (
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
                Your submission will be created as a public GitHub pull request
                for review.
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
                    : "Submit New Company"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
