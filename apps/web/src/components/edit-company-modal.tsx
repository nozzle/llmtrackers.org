import { useState, useMemo, useEffect, useId, useCallback } from "react";
import type { Company } from "@llm-tracker/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditCompanyModalProps {
  company: Company;
  onClose: () => void;
}

interface CompanyChanges {
  name?: string;
  description?: string;
  website?: string;
  pricingUrl?: string | null;
  featuresUrl?: string | null;
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

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  description: string;
  website: string;
  pricingUrl: string;
  featuresUrl: string;
}

function companyToFormState(company: Company): FormState {
  return {
    name: company.name,
    description: company.description,
    website: company.website,
    pricingUrl: company.pricingUrl ?? "",
    featuresUrl: company.featuresUrl ?? "",
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
  original: Company,
  form: FormState
): { changes: CompanyChanges; diff: DiffEntry[] } {
  const changes: CompanyChanges = {};
  const diff: DiffEntry[] = [];

  if (form.name.trim() !== original.name) {
    changes.name = form.name.trim();
    diff.push({
      label: "Name",
      oldValue: original.name,
      newValue: form.name.trim(),
    });
  }

  if (form.description.trim() !== original.description) {
    changes.description = form.description.trim();
    diff.push({
      label: "Description",
      oldValue: original.description,
      newValue: form.description.trim(),
    });
  }

  if (form.website.trim() !== original.website) {
    changes.website = form.website.trim();
    diff.push({
      label: "Website",
      oldValue: original.website,
      newValue: form.website.trim(),
    });
  }

  const newPricingUrl = form.pricingUrl.trim() || null;
  const origPricingUrl = original.pricingUrl ?? null;
  if (newPricingUrl !== origPricingUrl) {
    changes.pricingUrl = newPricingUrl;
    diff.push({
      label: "Pricing URL",
      oldValue: formatDisplayValue(origPricingUrl),
      newValue: formatDisplayValue(newPricingUrl),
    });
  }

  const newFeaturesUrl = form.featuresUrl.trim() || null;
  const origFeaturesUrl = original.featuresUrl ?? null;
  if (newFeaturesUrl !== origFeaturesUrl) {
    changes.featuresUrl = newFeaturesUrl;
    diff.push({
      label: "Features URL",
      oldValue: formatDisplayValue(origFeaturesUrl),
      newValue: formatDisplayValue(newFeaturesUrl),
    });
  }

  return { changes, diff };
}

// ---------------------------------------------------------------------------
// EditCompanyModal
// ---------------------------------------------------------------------------

export function EditCompanyModal({
  company,
  onClose,
}: Readonly<EditCompanyModalProps>) {
  const [form, setForm] = useState<FormState>(() =>
    companyToFormState(company)
  );
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
    import.meta.env.VITE_FORM_WORKER_URL || "/api/suggest-company-edit";

  const { changes, diff } = useMemo(
    () => computeChangesAndDiff(company, form),
    [company, form]
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const payload: {
        companySlug: string;
        changes: CompanyChanges;
        contributor?: { name?: string; email?: string; company?: string };
        turnstileToken?: string;
      } = {
        companySlug: company.slug,
        changes,
      };

      const contrib: { name?: string; email?: string; company?: string } = {};
      if (contributor.name.trim()) contrib.name = contributor.name.trim();
      if (contributor.email.trim()) contrib.email = contributor.email.trim();
      if (contributor.company.trim())
        contrib.company = contributor.company.trim();
      if (Object.keys(contrib).length > 0) payload.contributor = contrib;

      if (turnstileToken) payload.turnstileToken = turnstileToken;

      const endpoint =
        workerUrl.replace(/\/$/, "") + "/api/suggest-company-edit";
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

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
              Your suggested company edit has been submitted as a GitHub pull
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
              Edit Company Info
            </h2>
            <p className="text-sm text-gray-500">{company.name}</p>
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
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Company Details
                </legend>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Company Name
                    </span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Description
                    </span>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        updateForm("description", e.target.value)
                      }
                      rows={3}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Website
                    </span>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => updateForm("website", e.target.value)}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Links
                </legend>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Pricing URL
                    </span>
                    <input
                      type="url"
                      value={form.pricingUrl}
                      onChange={(e) =>
                        updateForm("pricingUrl", e.target.value)
                      }
                      placeholder="Leave empty to remove"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">
                      Features URL
                    </span>
                    <input
                      type="url"
                      value={form.featuresUrl}
                      onChange={(e) =>
                        updateForm("featuresUrl", e.target.value)
                      }
                      placeholder="Leave empty to remove"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
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
