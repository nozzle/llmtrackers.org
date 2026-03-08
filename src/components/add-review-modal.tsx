import { useState, useMemo, useEffect, useId, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddReviewModalProps {
  companies: Array<{ slug: string; name: string }>;
  onClose: () => void;
}

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

interface ReviewFormState {
  name: string;
  slug: string;
  autoSlug: boolean;
  url: string;
  date: string;
  summary: string;
  detailedSummary: string;
  authorName: string;
  socialProfiles: SocialProfileFormState[];
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

let ratingIdCounter = 0;

function createEmptyRating(): CompanyRatingFormState {
  ratingIdCounter += 1;
  return {
    id: `rating-${ratingIdCounter}-${Date.now()}`,
    companySlug: "",
    score: "",
    maxScore: "48",
    summary: "",
    directLink: "",
    pros: createHighlightSlots(),
    cons: createHighlightSlots(),
    noteworthy: createHighlightSlots(),
  };
}

let profileIdCounter = 0;

function createEmptySocialProfile(): SocialProfileFormState {
  profileIdCounter += 1;
  return {
    id: `profile-${profileIdCounter}-${Date.now()}`,
    label: "",
    url: "",
  };
}

function defaultReviewState(): ReviewFormState {
  return {
    name: "",
    slug: "",
    autoSlug: true,
    url: "",
    date: "",
    summary: "",
    detailedSummary: "",
    authorName: "",
    socialProfiles: [],
  };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

interface PreviewEntry {
  label: string;
  value: string;
}

function computeReviewPreview(
  review: ReviewFormState,
  ratings: CompanyRatingFormState[],
): PreviewEntry[] {
  const entries: PreviewEntry[] = [];

  if (review.name.trim()) entries.push({ label: "Review Name", value: review.name.trim() });
  if (review.slug.trim()) entries.push({ label: "Slug", value: review.slug.trim() });
  if (review.url.trim()) entries.push({ label: "URL", value: review.url.trim() });
  if (review.date.trim()) entries.push({ label: "Date", value: review.date.trim() });
  if (review.summary.trim()) entries.push({ label: "Summary", value: review.summary.trim() });
  if (review.detailedSummary.trim()) {
    entries.push({ label: "Detailed Summary", value: review.detailedSummary.trim() });
  }
  if (review.authorName.trim())
    entries.push({ label: "Author", value: review.authorName.trim() });

  entries.push({ label: "Ratings", value: String(ratings.length) });

  for (const rating of ratings) {
    if (rating.companySlug.trim()) {
      const scoreStr =
        rating.score.trim() !== "" && rating.maxScore.trim() !== ""
          ? `${rating.score.trim()}/${rating.maxScore.trim()}`
          : "N/A";
      const highlightCount =
        compactHighlights(rating.pros).length +
        compactHighlights(rating.cons).length +
        compactHighlights(rating.noteworthy).length;

      entries.push({
        label: `Rating: ${rating.companySlug.trim()}`,
        value: highlightCount > 0 ? `${scoreStr} • ${highlightCount} highlights` : scoreStr,
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateReviewForm(
  review: ReviewFormState,
  ratings: CompanyRatingFormState[],
): string | null {
  if (!review.name.trim()) return "Review name is required";
  if (!review.slug.trim()) return "Review slug is required";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(review.slug.trim())) {
    return "Slug must be lowercase alphanumeric with hyphens";
  }
  if (!review.url.trim()) return "Review URL is required";
  try {
    new URL(review.url.trim());
  } catch {
    return "URL must be a valid URL (include https://)";
  }
  if (!review.date.trim()) return "Date is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review.date.trim())) {
    return "Date must be in YYYY-MM-DD format";
  }
  if (!review.summary.trim()) return "Review summary is required";
  if (!review.detailedSummary.trim()) return "Detailed review summary is required";
  if (!review.authorName.trim()) return "Author name is required";

  if (ratings.length === 0) return "At least one company rating is required";

  const slugs = new Set<string>();
  for (let i = 0; i < ratings.length; i++) {
    const rating = ratings[i];
    if (!rating.companySlug.trim()) return `Rating ${i + 1}: company is required`;
    if (slugs.has(rating.companySlug.trim())) {
      return `Duplicate company slug: "${rating.companySlug.trim()}"`;
    }
    slugs.add(rating.companySlug.trim());

    if (rating.score.trim() === "" || Number.isNaN(Number(rating.score.trim()))) {
      return `Rating ${i + 1}: score must be a number`;
    }
    if (rating.maxScore.trim() === "" || Number.isNaN(Number(rating.maxScore.trim()))) {
      return `Rating ${i + 1}: max score must be a number`;
    }
    if (Number(rating.score.trim()) > Number(rating.maxScore.trim())) {
      return `Rating ${i + 1}: score cannot exceed max score`;
    }
    if (!rating.summary.trim()) return `Rating ${i + 1}: summary is required`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

function buildPayload(review: ReviewFormState, ratings: CompanyRatingFormState[]) {
  return {
    slug: review.slug.trim(),
    name: review.name.trim(),
    url: review.url.trim(),
    date: review.date.trim(),
    summary: review.summary.trim(),
    detailedSummary: review.detailedSummary.trim(),
    author: {
      name: review.authorName.trim(),
      socialProfiles: review.socialProfiles
        .filter((p) => p.label.trim() && p.url.trim())
        .map((p) => ({ label: p.label.trim(), url: p.url.trim() })),
    },
    companyRatings: ratings.map((r) => ({
      companySlug: r.companySlug.trim(),
      score: Number(r.score.trim()),
      maxScore: Number(r.maxScore.trim()),
      summary: r.summary.trim(),
      directLink: r.directLink.trim() || null,
      pros: compactHighlights(r.pros),
      cons: compactHighlights(r.cons),
      noteworthy: compactHighlights(r.noteworthy),
    })),
  };
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
// CompanyRatingFormSection (inline rating form)
// ---------------------------------------------------------------------------

function CompanyRatingFormSection({
  rating,
  index,
  companies,
  canRemove,
  onUpdate,
  onRemove,
}: Readonly<{
  rating: CompanyRatingFormState;
  index: number;
  companies: Array<{ slug: string; name: string }>;
  canRemove: boolean;
  onUpdate: (updated: CompanyRatingFormState) => void;
  onRemove: () => void;
}>) {
  const [expanded, setExpanded] = useState(true);

  function update<K extends keyof CompanyRatingFormState>(key: K, value: CompanyRatingFormState[K]) {
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
          {rating.companySlug.trim() ? `: ${rating.companySlug.trim()}` : ""}
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
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          {/* Company + Score */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Company</span>
              <select
                value={rating.companySlug}
                onChange={(e) => {
                  update("companySlug", e.target.value);
                }}
                className="mt-1 block w-full cursor-pointer rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a company...</option>
                {companies.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Score</span>
              <input
                type="text"
                value={rating.score}
                onChange={(e) => {
                  update("score", e.target.value);
                }}
                placeholder="e.g. 36"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Max Score</span>
              <input
                type="text"
                value={rating.maxScore}
                onChange={(e) => {
                  update("maxScore", e.target.value);
                }}
                placeholder="48"
                className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Summary */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Summary</span>
            <textarea
              value={rating.summary}
              onChange={(e) => {
                update("summary", e.target.value);
              }}
              rows={2}
              placeholder="Brief summary of the rating"
              className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          {/* Direct Link */}
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Direct Link (optional)</span>
            <input
              type="text"
              value={rating.directLink}
              onChange={(e) => {
                update("directLink", e.target.value);
              }}
              placeholder="https://..."
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
// SocialProfileSection (inline social profile entry)
// ---------------------------------------------------------------------------

function SocialProfileSection({
  profile,
  onUpdate,
  onRemove,
}: Readonly<{
  profile: SocialProfileFormState;
  onUpdate: (updated: SocialProfileFormState) => void;
  onRemove: () => void;
}>) {
  return (
    <div className="flex items-end gap-2">
      <label className="block flex-1">
        <span className="text-xs font-medium text-gray-600">Label</span>
        <input
          type="text"
          value={profile.label}
          onChange={(e) => {
            onUpdate({ ...profile, label: e.target.value });
          }}
          placeholder='e.g. "LinkedIn"'
          className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>
      <label className="block flex-[2]">
        <span className="text-xs font-medium text-gray-600">URL</span>
        <input
          type="text"
          value={profile.url}
          onChange={(e) => {
            onUpdate({ ...profile, url: e.target.value });
          }}
          placeholder="https://..."
          className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        title="Remove profile"
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddReviewModal
// ---------------------------------------------------------------------------

export function AddReviewModal({ companies, onClose }: Readonly<AddReviewModalProps>) {
  const [form, setForm] = useState<ReviewFormState>(defaultReviewState);
  const [ratings, setRatings] = useState<CompanyRatingFormState[]>([createEmptyRating()]);
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

  const preview = useMemo(() => computeReviewPreview(form, ratings), [form, ratings]);
  const validationError = useMemo(() => validateReviewForm(form, ratings), [form, ratings]);
  const isValid = !validationError;

  // Auto-generate slug from name
  useEffect(() => {
    if (form.autoSlug) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.name) }));
    }
  }, [form.name, form.autoSlug]);

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
    if (!isValid) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const reviewPayload = buildPayload(form, ratings);

      const payload: {
        review: ReturnType<typeof buildPayload>;
        contributor?: { name?: string; email?: string; company?: string };
        turnstileToken?: string;
      } = {
        review: reviewPayload,
      };

      const contrib: { name?: string; email?: string; company?: string } = {};
      if (contributor.name.trim()) contrib.name = contributor.name.trim();
      if (contributor.email.trim()) contrib.email = contributor.email.trim();
      if (contributor.company.trim()) contrib.company = contributor.company.trim();
      if (Object.keys(contrib).length > 0) payload.contributor = contrib;

      if (turnstileToken) payload.turnstileToken = turnstileToken;

      const response = await fetch("/api/suggest-add-review", {
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

  function updateForm<K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateRating(index: number, updated: CompanyRatingFormState) {
    setRatings((prev) => prev.map((r, i) => (i === index ? updated : r)));
  }

  function removeRating(index: number) {
    setRatings((prev) => prev.filter((_, i) => i !== index));
  }

  function addRating() {
    setRatings((prev) => [...prev, createEmptyRating()]);
  }

  function updateSocialProfile(index: number, updated: SocialProfileFormState) {
    setForm((prev) => ({
      ...prev,
      socialProfiles: prev.socialProfiles.map((p, i) => (i === index ? updated : p)),
    }));
  }

  function removeSocialProfile(index: number) {
    setForm((prev) => ({
      ...prev,
      socialProfiles: prev.socialProfiles.filter((_, i) => i !== index),
    }));
  }

  function addSocialProfile() {
    setForm((prev) => ({
      ...prev,
      socialProfiles: [...prev.socialProfiles, createEmptySocialProfile()],
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
              Your new review suggestion has been submitted as a GitHub pull request. Our team will
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
            <h2 className="text-lg font-semibold text-gray-900">Add New Review</h2>
            <p className="text-sm text-gray-500">
              Submit a new review with company ratings for review
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: left form + right preview */}
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 divide-x divide-gray-200">
            {/* Left panel: form */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              {/* Review Details */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Review Details
                </legend>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Review Name</span>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => {
                          updateForm("name", e.target.value);
                        }}
                        placeholder='e.g. "Best LLM Tools 2025"'
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Slug</span>
                      <input
                        type="text"
                        value={form.slug}
                        onChange={(e) => {
                          setForm((prev) => ({
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
                    <span className="text-xs font-medium text-gray-600">URL</span>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => {
                        updateForm("url", e.target.value);
                      }}
                      placeholder="https://example.com/review-article"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
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
                      <span className="text-xs font-medium text-gray-600">Author Name</span>
                      <input
                        type="text"
                        value={form.authorName}
                        onChange={(e) => {
                          updateForm("authorName", e.target.value);
                        }}
                        placeholder="e.g. Jane Doe"
                        className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Short Summary</span>
                    <textarea
                      value={form.summary}
                      onChange={(e) => {
                        updateForm("summary", e.target.value);
                      }}
                      rows={2}
                      placeholder="One-line summary for cards and tables"
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
                      placeholder="Longer article recap, one or two paragraphs"
                      className="mt-1 block w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </fieldset>

              {/* Author Social Profiles */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Author Social Profiles
                </legend>
                <div className="space-y-3">
                  {form.socialProfiles.map((profile, index) => (
                    <SocialProfileSection
                      key={profile.id}
                      profile={profile}
                      onUpdate={(updated) => {
                        updateSocialProfile(index, updated);
                      }}
                      onRemove={() => {
                        removeSocialProfile(index);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addSocialProfile}
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
                    Add Profile
                  </button>
                </div>
              </fieldset>

              {/* Company Ratings */}
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Company Ratings
                </legend>
                <div className="space-y-3">
                  {ratings.map((rating, index) => (
                    <CompanyRatingFormSection
                      key={rating.id}
                      rating={rating}
                      index={index}
                      companies={companies}
                      canRemove={ratings.length > 1}
                      onUpdate={(updated) => {
                        updateRating(index, updated);
                      }}
                      onRemove={() => {
                        removeRating(index);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addRating}
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
                    Add Another Rating
                  </button>
                </div>
              </fieldset>
            </div>

            {/* Right panel: live preview */}
            <div className="w-72 shrink-0 overflow-y-auto bg-gray-50 px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Preview
              </h3>
              {form.name.trim() === "" ? (
                <p className="text-sm text-gray-400 italic">
                  Enter a review name to see a preview.
                </p>
              ) : (
                <div className="space-y-2">
                  {preview.map((entry) => (
                    <div
                      key={entry.label}
                      className="rounded border border-gray-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs font-medium text-gray-500">{entry.label}</div>
                      <div className="mt-0.5 text-sm text-gray-900">{entry.value}</div>
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
                Your submission will be created as a public GitHub pull request for review.
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
                  {status === "submitting" ? "Submitting..." : "Submit New Review"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
