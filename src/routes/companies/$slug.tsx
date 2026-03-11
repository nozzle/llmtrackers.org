import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getCompanyBySlug, getReviewsForCompanySlug } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import { EditPlanModal } from "~/components/edit-plan-modal";
import { EditCompanyModal } from "~/components/edit-company-modal";
import { AddPlanModal } from "~/components/add-plan-modal";
import {
  ReviewSiteLabel,
  ReviewSiteMark,
  ReviewSiteScoreBadge,
} from "~/components/review-site-badge";
import { MediaOverlay } from "~/components/media-overlay";
import { getReviewSiteBranding } from "~/review-site-branding";
import { LLM_MODEL_LABELS, REVIEW_SITE_PLATFORMS } from "@llm-tracker/shared";
import type { LlmModelKey, Plan, ReviewSitePlatform } from "@llm-tracker/shared";

export const Route = createFileRoute("/companies/$slug")({
  component: CompanyPage,
  head: ({ params }) => {
    const company = getCompanyBySlug(params.slug);
    const title = company ? `${company.name} - LLM Trackers` : "Company Not Found";
    const description = company?.description ?? "";
    const planSummary = company
      ? `${company.plans.length} plan${company.plans.length > 1 ? "s" : ""} starting at $${Math.min(...company.plans.map((p) => p.price.amount ?? Infinity))}/mo`
      : "";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(planSummary
          ? [
              {
                name: "twitter:label2",
                content: "Pricing",
              },
              {
                name: "twitter:data2",
                content: planSummary,
              },
            ]
          : []),
      ],
    };
  },
});

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

function formatBucketLabel(platform: ReviewSitePlatform, label: string): string {
  if (platform === "trustradius") return `${label}/5`;
  return label;
}

function CompanyPage() {
  const { slug } = Route.useParams();
  const company = getCompanyBySlug(slug);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editingCompany, setEditingCompany] = useState(false);
  const [addingPlan, setAddingPlan] = useState(false);
  const [mediaOverlay, setMediaOverlay] = useState<{
    type: "screenshot" | "video";
    index: number;
  } | null>(null);

  if (!company) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Company Not Found</h1>
        <p className="mt-2 text-gray-600">No company found with slug &quot;{slug}&quot;.</p>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to comparison
        </Link>
      </div>
    );
  }

  const relatedReviews = getReviewsForCompanySlug(slug);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <CompanyMark slug={company.slug} name={company.name} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCompany(true);
                  }}
                  className="cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Suggest company info edit"
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
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                    />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-lg text-gray-600">{company.description}</p>
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 break-all text-sm text-blue-600 hover:underline"
              >
                <CompanyMark slug={company.slug} name={company.name} size="sm" mode="favicon" />
                {company.website}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Plans */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Plans</h2>
          <button
            type="button"
            onClick={() => {
              setAddingPlan(true);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Plan
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {company.plans.map((plan) => (
            <div
              key={plan.slug}
              className="group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <button
                type="button"
                onClick={() => {
                  setEditingPlan(plan);
                }}
                className="absolute right-2 top-2 cursor-pointer rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
                title="Suggest an edit"
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
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                  />
                </svg>
              </button>
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {plan.price.amount !== null
                      ? `$${plan.price.amount.toLocaleString()}`
                      : "Custom"}
                  </div>
                  <div className="text-xs text-gray-500">
                    /{plan.price.period}
                    {plan.price.note && (
                      <span className="block text-gray-400">{plan.price.note}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">AI Responses/mo</span>
                  <span className="font-medium">
                    {plan.aiResponsesMonthly?.toLocaleString() ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cost per 1K responses</span>
                  <span className="font-medium">
                    {plan.pricePer1000Responses != null
                      ? `$${plan.pricePer1000Responses.toFixed(2)}`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Schedule</span>
                  <span className="font-medium capitalize">{plan.schedule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Locations</span>
                  <span className="font-medium">
                    {plan.locationSupport === "global"
                      ? "Global"
                      : `${plan.locationSupport} regions`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Personas</span>
                  <span className="font-medium">
                    {plan.personaSupport === "unlimited" ? "Unlimited" : plan.personaSupport}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">LLM Models</span>
                  <span className="font-medium">{plan.includedLlmModels ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Content Generation</span>
                  <span className="font-medium">
                    {plan.contentGeneration === false ? "No" : plan.contentGeneration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Content Optimization</span>
                  <span className="font-medium">
                    {plan.contentOptimization === false ? "No" : plan.contentOptimization}
                  </span>
                </div>
              </div>

              {/* LLM Support */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">LLM Support</h4>
                <div className="flex flex-wrap gap-1.5">
                  {LLM_KEYS.map((key) => (
                    <span
                      key={key}
                      className={`rounded px-2 py-0.5 text-xs ${
                        plan.llmSupport[key]
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {LLM_MODEL_LABELS[key]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Integrations */}
              {plan.integrations.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Integrations</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.integrations.map((int) => (
                      <span
                        key={int}
                        className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                      >
                        {int}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {company.screenshots.length > 0 && (
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Product Screenshots</h2>
            <p className="mt-1 text-sm text-gray-600">
              Curated first-party product imagery collected from {company.name}&rsquo;s public site
              and help resources.
            </p>
          </div>

          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
            {company.screenshots.map((screenshot, i) => (
              <button
                key={screenshot.id}
                type="button"
                onClick={() => {
                  setMediaOverlay({ type: "screenshot", index: i });
                }}
                className="group flex-none"
              >
                <div className="h-32 w-48 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <img
                    src={screenshot.assetPath}
                    alt={screenshot.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="mt-1.5 w-48 truncate text-left text-xs font-medium text-gray-700">
                  {screenshot.contextHeading ?? screenshot.alt}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {company.videos.length > 0 ? (
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Videos & Demos</h2>
            <p className="mt-1 text-sm text-gray-600">
              Curated product walkthroughs and demos for {company.name}, playable without leaving
              the page.
            </p>
          </div>

          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
            {company.videos.map((video, i) => (
              <button
                key={video.id}
                type="button"
                onClick={() => {
                  setMediaOverlay({ type: "video", index: i });
                }}
                className="group flex-none"
              >
                <div className="relative h-32 w-48 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
                      <path d="M8 5.14v13.72a1 1 0 001.53.85l10.3-6.86a1 1 0 000-1.7L9.53 4.29A1 1 0 008 5.14z" />
                    </svg>
                  </div>
                </div>
                <p className="mt-1.5 w-48 truncate text-left text-xs font-medium text-gray-700">
                  {video.title}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {REVIEW_SITE_PLATFORMS.some((platform) => company.reviewSites[platform]) && (
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Ratings & Reviews</h2>
              <p className="mt-1 text-sm text-gray-600">
                Official review-platform scores, rating distributions, and recent snippets.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {REVIEW_SITE_PLATFORMS.map((platform) => {
              const site = company.reviewSites[platform];
              if (!site) return null;

              return (
                <section
                  key={platform}
                  className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${getReviewSiteBranding(platform).surface}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        <ReviewSiteLabel platform={platform} size="lg" />
                      </h3>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <ReviewSiteMark platform={platform} mode="favicon" size="sm" />
                        View official page
                      </a>
                    </div>
                    <div className="text-right">
                      <ReviewSiteScoreBadge
                        platform={platform}
                        score={site.score}
                        maxScore={site.maxScore}
                        showLogo
                      />
                      {site.reviewCount != null && (
                        <div className="mt-2 text-sm text-gray-500">
                          {site.reviewCount.toLocaleString()} reviews
                        </div>
                      )}
                    </div>
                  </div>

                  {site.ratingDistribution.length > 0 && (
                    <div className="mt-5 space-y-2">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Rating Distribution
                      </h4>
                      {site.ratingDistribution.map((bucket) => {
                        const maxCount = Math.max(
                          ...site.ratingDistribution.map((entry) => entry.count),
                          1,
                        );

                        return (
                          <div
                            key={`${platform}-${bucket.label}`}
                            className="flex items-center gap-3"
                          >
                            <div className="w-12 text-sm text-gray-600">
                              {formatBucketLabel(platform, bucket.label)}
                            </div>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-full rounded-full ${getReviewSiteBranding(platform).bar}`}
                                style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                              />
                            </div>
                            <div className="w-12 text-right text-sm text-gray-500">
                              {bucket.count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {site.reviews.length > 0 && (
                    <div className="mt-5 space-y-3">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Review Snippets
                      </h4>
                      {site.reviews.map((review, index) => (
                        <div
                          key={`${platform}-${review.author ?? "anon"}-${index}`}
                          className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-gray-900">
                              {review.author ?? "Anonymous"}
                            </span>
                            {review.title && (
                              <span className="text-sm text-gray-600">{review.title}</span>
                            )}
                            {review.rating != null && (
                              <span className="text-xs font-medium text-gray-500">
                                {review.rating}/{site.maxScore}
                              </span>
                            )}
                            {review.date && (
                              <span className="text-xs text-gray-400">{review.date}</span>
                            )}
                          </div>
                          <p className="text-sm leading-6 text-gray-700">{review.excerpt}</p>
                          {review.url && (
                            <a
                              href={review.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex text-sm text-blue-600 hover:underline"
                            >
                              Read source review
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}

      {/* Published Reviews */}
      {relatedReviews.length > 0 && (
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Published Reviews</h2>
            <p className="mt-1 text-sm text-gray-600">
              Editorial reviews and scorecards that include {company.name}.
            </p>
          </div>
          <div className="space-y-3">
            {relatedReviews.map((review) => {
              const rating = review.companyRatings.find(
                (entry) => entry.companySlug === company.slug,
              );
              if (!rating) return null;

              const hasScore = rating.score != null && rating.maxScore != null;
              const pct = hasScore ? ((rating.score ?? 0) / (rating.maxScore ?? 1)) * 100 : 0;

              return (
                <article
                  key={review.slug}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center"
                >
                  {/* Score badge */}
                  <div className="flex shrink-0 items-center gap-3 sm:w-24 sm:flex-col sm:items-center sm:gap-1">
                    {hasScore ? (
                      <>
                        <div className="text-2xl font-bold text-gray-900">{rating.score}</div>
                        <div className="text-xs text-gray-500">/ {rating.maxScore}</div>
                        <div className="ml-2 h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 sm:ml-0 sm:w-full">
                          <div
                            className={`h-full rounded-full ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                        Mentioned
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/reviews/$slug"
                      params={{ slug: review.slug }}
                      className="font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {review.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {review.author.name} &middot; {review.date} &middot;{" "}
                      {review.companyRatings.length === 1
                        ? "Single-product review"
                        : `${review.companyRatings.length} tools rated`}
                    </p>
                    {review.type === "video" && review.media && (
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-700">
                        Video review
                      </p>
                    )}
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">
                      {rating.summary}
                    </p>
                    {rating.noteworthy.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rating.noteworthy.slice(0, 2).map((item) => (
                          <span
                            key={`${review.slug}-${item}`}
                            className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Links */}
                  <div className="flex shrink-0 flex-wrap gap-2 text-sm sm:flex-col sm:items-end">
                    <Link
                      to="/reviews/$slug"
                      params={{ slug: review.slug }}
                      className="text-blue-600 hover:underline"
                    >
                      Full review
                    </Link>
                    {rating.directLink && (
                      <a
                        href={rating.directLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Source rating
                      </a>
                    )}
                    {review.type === "video" && review.media && (
                      <a
                        href={review.media.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Watch video
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Tweets */}
      {company.tweets.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">What People Are Saying</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {company.tweets.map((tweet) => (
              <a
                key={tweet.url}
                href={tweet.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300"
              >
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-gray-900">{tweet.authorName}</span>
                  <span className="text-sm text-gray-500">{tweet.author}</span>
                  <span className="text-xs text-gray-400">{tweet.date}</span>
                </div>
                <p className="text-sm text-gray-700">{tweet.text}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Links */}
      <section className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        {company.pricingUrl && (
          <a
            href={company.pricingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View Pricing Page
          </a>
        )}
        {company.featuresUrl && (
          <a
            href={company.featuresUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View Features Page
          </a>
        )}
        <Link
          to="/suggest"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Suggest Correction
        </Link>
      </section>

      {editingPlan && (
        <EditPlanModal
          companySlug={company.slug}
          companyName={company.name}
          planSlug={editingPlan.slug}
          planName={editingPlan.name}
          plan={editingPlan}
          onClose={() => {
            setEditingPlan(null);
          }}
        />
      )}

      {editingCompany && (
        <EditCompanyModal
          company={company}
          onClose={() => {
            setEditingCompany(false);
          }}
        />
      )}

      {addingPlan && (
        <AddPlanModal
          companySlug={company.slug}
          companyName={company.name}
          onClose={() => {
            setAddingPlan(false);
          }}
        />
      )}

      {mediaOverlay?.type === "screenshot" && (
        <MediaOverlay
          type="screenshot"
          items={company.screenshots}
          index={mediaOverlay.index}
          onClose={() => {
            setMediaOverlay(null);
          }}
          onNavigate={(i) => {
            setMediaOverlay({ type: "screenshot", index: i });
          }}
        />
      )}

      {mediaOverlay?.type === "video" && (
        <MediaOverlay
          type="video"
          items={company.videos}
          index={mediaOverlay.index}
          getEmbedUrl={getVideoEmbedUrl}
          onClose={() => {
            setMediaOverlay(null);
          }}
          onNavigate={(i) => {
            setMediaOverlay({ type: "video", index: i });
          }}
        />
      )}
    </div>
  );
}

function getVideoEmbedUrl(provider: string, videoId: string): string {
  if (provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }

  if (provider === "wistia") {
    return `https://fast.wistia.net/embed/iframe/${videoId}`;
  }

  if (provider === "loom") {
    return `https://www.loom.com/embed/${videoId}`;
  }

  return "";
}
