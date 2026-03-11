import { useState, useMemo, useEffect, useId, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditReviewModalProps {
  review: {
    slug: string;
    name: string;
    url: string;
    date: string;
    summary: string;
    detailedSummary: string;
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
      pros: string[];
      cons: string[];
      noteworthy: string[];
    }[];
  };
  companies: { slug: string; name: string }[];
  onClose: () => void;
}

interface ReviewChanges {
  name?: string;
  url?: string;
  date?: string;
  summary?: string;
  detailedSummary?: string;
  author?: {
    name?: string;
    socialProfiles?: { label: string; url: string }[];
  };
  companyRatings?: {
    companySlug: string;
    score?: number | null;
    maxScore?: number | null;
    summary: string;
    directLink?: string | null;
    pros: string[];
    cons: string[];
    noteworthy: string[];
  }[];
}

interface PrMutationSuccess {
  prUrl: string;
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
        },
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function createHighlightSlots(items: string[] = []): string[] {
  return [items[0] ?? "", items[1] ?? "", items[2] ?? ""];
}

function compactHighlights(items: string[]): string[] {
  return items
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 3);
}

function HighlightInputs({
  label,
  values,
  placeholder,
  onChange,
}: Readonly<{
  label: string;
  values: string[];
  placeholder: string;
  onChange: (index: number, value: string) => void;
}>) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1 space-y-2">
        {values.map((value, index) => (
          <input
            key={`${label}-${index + 1}`}
            type="text"
            value={value}
            onChange={(e) => {
              onChange(index, e.target.value);
            }}
            placeholder={`${placeholder} ${index + 1}`}
            className="block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface SocialProfileFormState {
  id: string;
  label: string;
  url: string;
}

interface CompanyRatingFormState {
  id: string;
  companySlug: string;
  score: string;
  maxScore: string;
  summary: string;
  directLink: string;
  pros: string[];
  cons: string[];
  noteworthy: string[];
}

interface FormState {
  name: string;
  url: string;
  date: string;
  summary: string;
  detailedSummary: string;
  authorName: string;
  socialProfiles: SocialProfileFormState[];
  companyRatings: CompanyRatingFormState[];
}

// ---------------------------------------------------------------------------
// Counter-based id generators
// ---------------------------------------------------------------------------

let nextSocialProfileId = 1;
function generateSocialProfileId(): string {
  return `sp-${nextSocialProfileId++}`;
}

let nextCompanyRatingId = 1;
function generateCompanyRatingId(): string {
  return `cr-${nextCompanyRatingId++}`;
}

// ---------------------------------------------------------------------------
// reviewToFormState
// ---------------------------------------------------------------------------

function reviewToFormState(review: EditReviewModalProps["review"]): FormState {
  return {
    name: review.name,
    url: review.url,
    date: review.date,
    summary: review.summary,
    detailedSummary: review.detailedSummary,
    authorName: review.author.name,
    socialProfiles: review.author.socialProfiles.map((sp) => ({
      id: generateSocialProfileId(),
      label: sp.label,
      url: sp.url,
    })),
    companyRatings: review.companyRatings.map((cr) => ({
      id: generateCompanyRatingId(),
      companySlug: cr.companySlug,
      score: cr.score == null ? "" : String(cr.score),
      maxScore: cr.maxScore == null ? "" : String(cr.maxScore),
      summary: cr.summary,
      directLink: cr.directLink ?? "",
      pros: createHighlightSlots(cr.pros),
      cons: createHighlightSlots(cr.cons),
      noteworthy: createHighlightSlots(cr.noteworthy),
    })),
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
  original: EditReviewModalProps["review"],
  form: FormState,
): { changes: ReviewChanges; diff: DiffEntry[] } {
  const changes: ReviewChanges = {};
  const diff: DiffEntry[] = [];

  // name
  if (form.name.trim() !== original.name) {
    changes.name = form.name.trim();
    diff.push({
      label: "Name",
      oldValue: original.name,
      newValue: form.name.trim(),
    });
  }

  // url
  if (form.url.trim() !== original.url) {
    changes.url = form.url.trim();
    diff.push({
      label: "URL",
      oldValue: original.url,
      newValue: form.url.trim(),
    });
  }

  // date
  if (form.date.trim() !== original.date) {
    changes.date = form.date.trim();
    diff.push({
      label: "Date",
      oldValue: original.date,
      newValue: form.date.trim(),
    });
  }

  if (form.summary.trim() !== original.summary) {
    changes.summary = form.summary.trim();
    diff.push({
      label: "Summary",
      oldValue: original.summary,
      newValue: form.summary.trim(),
    });
  }

  if (form.detailedSummary.trim() !== original.detailedSummary) {
    changes.detailedSummary = form.detailedSummary.trim();
    diff.push({
      label: "Detailed Summary",
      oldValue: original.detailedSummary,
      newValue: form.detailedSummary.trim(),
    });
  }

  // author.name
  const authorChanged = form.authorName.trim() !== original.author.name;
  if (authorChanged) {
    diff.push({
      label: "Author Name",
      oldValue: original.author.name,
      newValue: form.authorName.trim(),
    });
  }

  // author.socialProfiles
  const originalSocialSerialized = JSON.stringify(
    original.author.socialProfiles.map((sp) => ({ label: sp.label, url: sp.url })),
  );
  const formSocialProfiles = form.socialProfiles.map((sp) => ({
    label: sp.label.trim(),
    url: sp.url.trim(),
  }));
  const formSocialSerialized = JSON.stringify(formSocialProfiles);
  const socialChanged = formSocialSerialized !== originalSocialSerialized;

  if (socialChanged) {
    diff.push({
      label: "Social Profiles",
      oldValue: `${original.author.socialProfiles.length} profile${original.author.socialProfiles.length !== 1 ? "s" : ""}`,
      newValue: `${formSocialProfiles.length} profile${formSocialProfiles.length !== 1 ? "s" : ""} (changed)`,
    });
  }

  // Build author changes object if anything in author changed
  if (authorChanged || socialChanged) {
    const authorChanges: NonNullable<ReviewChanges["author"]> = {};
    if (authorChanged) {
      authorChanges.name = form.authorName.trim();
    }
    if (socialChanged) {
      authorChanges.socialProfiles = formSocialProfiles;
    }
    changes.author = authorChanges;
  }

  // companyRatings
  const originalRatingsSerialized = JSON.stringify(
    original.companyRatings.map((cr) => ({
      companySlug: cr.companySlug,
      score: cr.score,
      maxScore: cr.maxScore,
      summary: cr.summary,
      directLink: cr.directLink ?? null,
      pros: cr.pros,
      cons: cr.cons,
      noteworthy: cr.noteworthy,
    })),
  );
  const formRatings = form.companyRatings.map((cr) => ({
    companySlug: cr.companySlug.trim(),
    score: cr.score.trim() === "" ? null : Number(cr.score),
    maxScore: cr.maxScore.trim() === "" ? null : Number(cr.maxScore),
    summary: cr.summary.trim(),
    directLink: cr.directLink.trim() || null,
    pros: compactHighlights(cr.pros),
    cons: compactHighlights(cr.cons),
    noteworthy: compactHighlights(cr.noteworthy),
  }));
  const formRatingsSerialized = JSON.stringify(formRatings);

  if (formRatingsSerialized !== originalRatingsSerialized) {
    changes.companyRatings = formRatings;
    diff.push({
      label: "Company Ratings",
      oldValue: `${original.companyRatings.length} rating${original.companyRatings.length !== 1 ? "s" : ""}`,
      newValue: `${formRatings.length} rating${formRatings.length !== 1 ? "s" : ""} (changed)`,
    });
  }

  return { changes, diff };
}

// ---------------------------------------------------------------------------
// RatingFormSection (collapsible rating entry)
// ---------------------------------------------------------------------------

function RatingFormSection({
  rating,
  index,
  canRemove,
  companies,
  onUpdate,
  onRemove,
}: Readonly<{
  rating: CompanyRatingFormState;
  index: number;
  canRemove: boolean;
  companies: { slug: string; name: string }[];
  onUpdate: (updated: CompanyRatingFormState) => void;
  onRemove: () => void;
}>) {
  const [expanded, setExpanded] = useState(true);

  function update<K extends keyof CompanyRatingFormState>(
    key: K,
    value: CompanyRatingFormState[K],
  ) {
    onUpdate({ ...rating, [key]: value });
  }

  function updateHighlight(
    key: "pros" | "cons" | "noteworthy",
    highlightIndex: number,
    value: string,
  ) {
    const next = [...rating[key]];
    next[highlightIndex] = value;
    update(key, next);
  }

  const companyLabel =
    companies.find((c) => c.slug === rating.companySlug)?.name ?? rating.companySlug;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Rating header (collapsible) */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
          }}
          className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900"
        >
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Rating {index + 1}
          {companyLabel ? `: ${companyLabel}` : ""}
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Remove rating"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Company</span>
            <select
              value={rating.companySlug}
              onChange={(e) => {
                update("companySlug", e.target.value);
              }}
              className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a company...</option>
              {companies.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Score (optional)</span>
              <input
                type="text"
                value={rating.score}
                onChange={(e) => {
                  update("score", e.target.value);
                }}
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Max Score (optional)</span>
              <input
                type="text"
                value={rating.maxScore}
                onChange={(e) => {
                  update("maxScore", e.target.value);
                }}
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Summary</span>
            <textarea
              value={rating.summary}
              onChange={(e) => {
                update("summary", e.target.value);
              }}
              rows={2}
              className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Direct Link</span>
            <input
              type="text"
              value={rating.directLink}
              onChange={(e) => {
                update("directLink", e.target.value);
              }}
              placeholder="Leave empty to remove"
              className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <div className="grid gap-3 lg:grid-cols-3">
            <HighlightInputs
              label="Pros"
              values={rating.pros}
              placeholder="Pro"
              onChange={(highlightIndex, value) => {
                updateHighlight("pros", highlightIndex, value);
              }}
            />
            <HighlightInputs
              label="Cons"
              values={rating.cons}
              placeholder="Con"
              onChange={(highlightIndex, value) => {
                updateHighlight("cons", highlightIndex, value);
              }}
            />
            <HighlightInputs
              label="Noteworthy / Unique"
              values={rating.noteworthy}
              placeholder="Noteworthy point"
              onChange={(highlightIndex, value) => {
                updateHighlight("noteworthy", highlightIndex, value);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditReviewModal
// ---------------------------------------------------------------------------

export function EditReviewModal({ review, companies, onClose }: Readonly<EditReviewModalProps>) {
  const [form, setForm] = useState<FormState>(() => reviewToFormState(review));
  const [contributor, setContributor] = useState({
    name: "",
    email: "",
    company: "",
  });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [prUrl, setPrUrl] = useState("");

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

  const { changes, diff } = useMemo(() => computeChangesAndDiff(review, form), [review, form]);

  const hasChanges = diff.length > 0;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  async function handleSubmit(e: SubmitEvent | React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const payload: {
        reviewSlug: string;
        changes: ReviewChanges;
        contributor?: { name?: string; email?: string; company?: string };
        turnstileToken?: string;
      } = {
        reviewSlug: review.slug,
        changes,
      };

      const contrib: { name?: string; email?: string; company?: string } = {};
      if (contributor.name.trim()) contrib.name = contributor.name.trim();
      if (contributor.email.trim()) contrib.email = contributor.email.trim();
      if (contributor.company.trim()) contrib.company = contributor.company.trim();
      if (Object.keys(contrib).length > 0) payload.contributor = contrib;

      if (turnstileToken) payload.turnstileToken = turnstileToken;

      const response = await fetch("/api/suggest-review-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }

      const result: PrMutationSuccess = await response.json();
      setPrUrl(result.prUrl);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Social profile helpers
  function updateSocialProfile(id: string, field: keyof SocialProfileFormState, value: string) {
    setForm((prev) => ({
      ...prev,
      socialProfiles: prev.socialProfiles.map((sp) =>
        sp.id === id ? { ...sp, [field]: value } : sp,
      ),
    }));
  }

  function removeSocialProfile(id: string) {
    setForm((prev) => ({
      ...prev,
      socialProfiles: prev.socialProfiles.filter((sp) => sp.id !== id),
    }));
  }

  function addSocialProfile() {
    setForm((prev) => ({
      ...prev,
      socialProfiles: [
        ...prev.socialProfiles,
        { id: generateSocialProfileId(), label: "", url: "" },
      ],
    }));
  }

  // Company rating helpers
  function updateCompanyRating(updated: CompanyRatingFormState) {
    setForm((prev) => ({
      ...prev,
      companyRatings: prev.companyRatings.map((cr) => (cr.id === updated.id ? updated : cr)),
    }));
  }

  function removeCompanyRating(id: string) {
    setForm((prev) => ({
      ...prev,
      companyRatings: prev.companyRatings.filter((cr) => cr.id !== id),
    }));
  }

  function addCompanyRating() {
    setForm((prev) => ({
      ...prev,
      companyRatings: [
        ...prev.companyRatings,
        {
          id: generateCompanyRatingId(),
          companySlug: "",
          score: "",
          maxScore: "",
          summary: "",
          directLink: "",
          pros: createHighlightSlots(),
          cons: createHighlightSlots(),
          noteworthy: createHighlightSlots(),
        },
      ],
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
          onClick={(e) => {
            e.stopPropagation();
          }}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Pull Request Created</h3>
            <p className="mt-2 text-sm text-gray-600">
              Your suggested review edit has been submitted as a GitHub pull request. Our team will
              review it shortly.
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
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Review Info</h2>
            <p className="text-sm text-gray-500">{review.name}</p>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: left form + right diff */}
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 divide-x divide-gray-200">
            {/* Left panel: form fields */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              {/* Review Details */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Review Details
                </legend>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Review Name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => {
                        updateForm("name", e.target.value);
                      }}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">URL</span>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => {
                        updateForm("url", e.target.value);
                      }}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Date</span>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => {
                        updateForm("date", e.target.value);
                      }}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Short Summary</span>
                    <textarea
                      value={form.summary}
                      onChange={(e) => {
                        updateForm("summary", e.target.value);
                      }}
                      rows={2}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Detailed Summary</span>
                    <textarea
                      value={form.detailedSummary}
                      onChange={(e) => {
                        updateForm("detailedSummary", e.target.value);
                      }}
                      rows={6}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </fieldset>

              {/* Author */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Author
                </legend>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Author Name</span>
                    <input
                      type="text"
                      value={form.authorName}
                      onChange={(e) => {
                        updateForm("authorName", e.target.value);
                      }}
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>

                  <div>
                    <span className="text-xs font-medium text-gray-600">Social Profiles</span>
                    <div className="mt-1 space-y-2">
                      {form.socialProfiles.map((sp) => (
                        <div key={sp.id} className="flex items-start gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={sp.label}
                              onChange={(e) => {
                                updateSocialProfile(sp.id, "label", e.target.value);
                              }}
                              placeholder="Label (e.g. Twitter)"
                              className="block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              value={sp.url}
                              onChange={(e) => {
                                updateSocialProfile(sp.id, "url", e.target.value);
                              }}
                              placeholder="URL"
                              className="block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              removeSocialProfile(sp.id);
                            }}
                            className="mt-0.5 cursor-pointer rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Remove profile"
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
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addSocialProfile}
                        className="mt-1 cursor-pointer rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
                      >
                        + Add Social Profile
                      </button>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Company Ratings */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Company Ratings
                </legend>
                <div className="space-y-3">
                  {form.companyRatings.map((cr, idx) => (
                    <RatingFormSection
                      key={cr.id}
                      rating={cr}
                      index={idx}
                      canRemove={form.companyRatings.length > 1}
                      companies={companies}
                      onUpdate={updateCompanyRating}
                      onRemove={() => {
                        removeCompanyRating(cr.id);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addCompanyRating}
                    className="w-full cursor-pointer rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  >
                    + Add Another Rating
                  </button>
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
                      <div className="text-xs font-medium text-gray-500">{entry.label}</div>
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
                <span className="text-xs font-medium text-gray-500">Your Name (optional)</span>
                <input
                  type="text"
                  value={contributor.name}
                  onChange={(e) => {
                    setContributor((p) => ({ ...p, name: e.target.value }));
                  }}
                  className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Email (optional)</span>
                <input
                  type="email"
                  value={contributor.email}
                  onChange={(e) => {
                    setContributor((p) => ({ ...p, email: e.target.value }));
                  }}
                  className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Company (optional)</span>
                <input
                  type="text"
                  value={contributor.company}
                  onChange={(e) => {
                    setContributor((p) => ({ ...p, company: e.target.value }));
                  }}
                  className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>

            {turnstileSiteKey ? (
              <div className="mb-3">
                <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={handleTurnstileToken} />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-gray-400">
                Your edit will be submitted as a public GitHub pull request for review.
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
                  {status === "submitting" ? "Submitting..." : "Submit Suggestion"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
