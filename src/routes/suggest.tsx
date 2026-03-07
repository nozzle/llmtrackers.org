import { useEffect, useId, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllCompanies } from "~/data";

export const Route = createFileRoute("/suggest")({
  component: SuggestPage,
  head: () => ({
    meta: [
      { title: "Suggest an Edit - LLM Trackers" },
      {
        name: "description",
        content:
          "Found outdated or incorrect data? Submit a correction for any AI search visibility tool in our comparison.",
      },
      { property: "og:title", content: "Suggest an Edit - LLM Trackers" },
      {
        property: "og:description",
        content:
          "Help keep our AI search visibility tool comparison data accurate. Submit corrections and updates.",
      },
    ],
  }),
});

interface FormData {
  companySlug: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  sourceUrl: string;
  notes: string;
  website: string;
  turnstileToken: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        },
      ) => string;
    };
  }
}

type SuggestStatus = "idle" | "submitting" | "success" | "error";

interface SuggestIssueResponse {
  success: true;
  issueUrl: string;
  issueNumber: number;
}

function SuggestPage() {
  const companies = getAllCompanies();
  const [formData, setFormData] = useState<FormData>({
    companySlug: "",
    field: "",
    currentValue: "",
    suggestedValue: "",
    sourceUrl: "",
    notes: "",
    website: "",
    turnstileToken: "",
  });
  const [status, setStatus] = useState<SuggestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

  function updateField(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: SubmitEvent | React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const _result: SuggestIssueResponse = await response.json();

      setStatus("success");
      setFormData({
        companySlug: "",
        field: "",
        currentValue: "",
        suggestedValue: "",
        sourceUrl: "",
        notes: "",
        website: "",
        turnstileToken: "",
      });
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8">
          <h1 className="text-2xl font-bold text-green-800">Thank You!</h1>
          <p className="mt-2 text-green-700">
            Your suggestion has been submitted. A GitHub issue has been created and our team will
            review it shortly.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              to="/"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Back to Comparison
            </Link>
            <button
              onClick={() => {
                setStatus("idle");
              }}
              className="rounded-md border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Suggest an Edit</h1>
        <p className="mt-1 text-gray-600">
          Found outdated or incorrect data? Submit a suggestion and we&apos;ll review it. Your
          submission will create a GitHub issue for transparency.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Please do not include personal contact information. Submissions become public GitHub
          issues.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Alternatively, you can{" "}
          <a
            href="https://github.com/nozzle/llm-tracker-comparison"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            submit a PR directly on GitHub
          </a>
          .
        </p>
      </div>

      {status === "error" && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage || "Failed to submit. Please try again."}
        </div>
      )}

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-6"
      >
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700">
            Company *
          </label>
          <select
            id="company"
            required
            value={formData.companySlug}
            onChange={(e) => {
              updateField("companySlug", e.target.value);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a company...</option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="field" className="block text-sm font-medium text-gray-700">
            What needs to be updated? *
          </label>
          <select
            id="field"
            required
            value={formData.field}
            onChange={(e) => {
              updateField("field", e.target.value);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a field...</option>
            <option value="pricing">Pricing</option>
            <option value="features">Features / Capabilities</option>
            <option value="llm-support">LLM Support</option>
            <option value="integrations">Integrations</option>
            <option value="schedule">Update Schedule</option>
            <option value="new-plan">New Plan (not listed)</option>
            <option value="removed-plan">Plan Removed / Discontinued</option>
            <option value="company-info">Company Info (name, website, etc.)</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="currentValue" className="block text-sm font-medium text-gray-700">
            Current Value (what&apos;s shown now)
          </label>
          <input
            id="currentValue"
            type="text"
            value={formData.currentValue}
            onChange={(e) => {
              updateField("currentValue", e.target.value);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. $399/month"
          />
        </div>

        <div>
          <label htmlFor="suggestedValue" className="block text-sm font-medium text-gray-700">
            Suggested Value *
          </label>
          <input
            id="suggestedValue"
            type="text"
            required
            value={formData.suggestedValue}
            onChange={(e) => {
              updateField("suggestedValue", e.target.value);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. $499/month"
          />
        </div>

        <div>
          <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-700">
            Source URL (where did you find this info?)
          </label>
          <input
            id="sourceUrl"
            type="url"
            value={formData.sourceUrl}
            onChange={(e) => {
              updateField("sourceUrl", e.target.value);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="https://example.com/pricing"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Additional Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => {
              updateField("notes", e.target.value);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Any additional context..."
          />
        </div>

        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          type="text"
          name="website"
          value={formData.website}
          onChange={(e) => {
            updateField("website", e.target.value);
          }}
          className="hidden"
        />

        {turnstileSiteKey ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-sm text-gray-600">Complete the spam check before submitting.</p>
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onTokenChange={(token) => {
                updateField("turnstileToken", token);
              }}
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            status === "submitting" || Boolean(turnstileSiteKey && !formData.turnstileToken)
          }
          className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "submitting" ? "Submitting..." : "Submit Suggestion"}
        </button>
      </form>
    </div>
  );
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
    if (typeof document === "undefined") {
      return;
    }

    const renderWidget = () => {
      if (!window.turnstile) {
        return;
      }

      window.turnstile.render(`#${containerId}`, {
        sitekey: siteKey,
        callback: onTokenChange,
        "expired-callback": () => {
          onTokenChange("");
        },
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]',
    );

    if (existingScript) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [containerId, onTokenChange, siteKey]);

  return <div id={containerId} />;
}
