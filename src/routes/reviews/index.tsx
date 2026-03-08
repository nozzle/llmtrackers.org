import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllReviews, getAllCompanies, getCompanyBySlug } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import { AddReviewModal } from "~/components/add-review-modal";

export const Route = createFileRoute("/reviews/")({
  component: ReviewsIndexPage,
  head: () => ({
    meta: [
      { title: "Published Reviews - LLM Trackers" },
      {
        name: "description",
        content: "Editorial reviews and scorecards of AI search visibility tools.",
      },
      { property: "og:title", content: "Published Reviews - LLM Trackers" },
      {
        property: "og:description",
        content: "Editorial reviews and scorecards of AI search visibility tools.",
      },
    ],
  }),
});

function ReviewsIndexPage() {
  const reviews = getAllReviews();
  const companies = getAllCompanies();
  const [addingReview, setAddingReview] = useState(false);

  const companyList = companies.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <div>
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Published Reviews</h1>
            <p className="mt-2 text-gray-600">
              Editorial reviews and scorecards of AI search visibility tools.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAddingReview(true);
            }}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
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
            Submit a Review
          </button>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-gray-500">No published reviews yet.</p>
      ) : (
        <div className="grid gap-6">
          {reviews.map((review) => {
            const topRatings = [...review.companyRatings]
              .sort((a, b) => {
                const aHasScore = a.score != null && a.maxScore != null;
                const bHasScore = b.score != null && b.maxScore != null;

                if (aHasScore && bHasScore) return (b.score as number) - (a.score as number);
                if (aHasScore) return -1;
                if (bHasScore) return 1;
                return 0;
              })
              .slice(0, 5);
            const scoredCount = review.companyRatings.filter(
              (rating) => rating.score != null && rating.maxScore != null,
            ).length;
            const isUnscoredRoundup = scoredCount === 0;
            const prosPreview = Array.from(
              new Set(review.companyRatings.flatMap((rating) => rating.pros)),
            ).slice(0, 3);
            const consPreview = Array.from(
              new Set(review.companyRatings.flatMap((rating) => rating.cons)),
            ).slice(0, 3);
            const highlightCount = review.companyRatings.reduce(
              (total, rating) =>
                total + rating.pros.length + rating.cons.length + rating.noteworthy.length,
              0,
            );

            return (
              <article
                key={review.slug}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      to="/reviews/$slug"
                      params={{ slug: review.slug }}
                      className="text-xl font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {review.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                      <span>By {review.author.name}</span>
                      <span>{review.date}</span>
                      <span>{review.companyRatings.length} tools rated</span>
                      {highlightCount > 0 && <span>{highlightCount} highlights</span>}
                      {isUnscoredRoundup && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Unscored roundup
                        </span>
                      )}
                    </div>
                    <div className="relative mt-3 max-w-3xl">
                      <p className="line-clamp-4 text-sm leading-relaxed text-gray-600">
                        {review.detailedSummary}
                      </p>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
                    </div>
                  </div>
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm text-blue-600 hover:underline"
                  >
                    Original article
                  </a>
                </div>

                {(prosPreview.length > 0 || consPreview.length > 0) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {prosPreview.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Pros Mentioned
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {prosPreview.map((item) => (
                            <span
                              key={`${review.slug}-pro-${item}`}
                              className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {consPreview.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Cons Mentioned
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {consPreview.map((item) => (
                            <span
                              key={`${review.slug}-con-${item}`}
                              className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Top 5 rated companies */}
                <div className="mt-4 flex flex-wrap gap-3">
                  {topRatings.map((rating) => {
                    const company = getCompanyBySlug(rating.companySlug);
                    return (
                      <Link
                        key={rating.companySlug}
                        to="/companies/$slug"
                        params={{ slug: rating.companySlug }}
                        className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm hover:border-blue-200 hover:bg-blue-50"
                      >
                        {company && (
                          <CompanyMark slug={company.slug} name={company.name} size="sm" />
                        )}
                        <span className="font-medium text-gray-700">
                          {company?.name ?? rating.companySlug}
                        </span>
                        <span className="text-gray-500">
                          {rating.score != null && rating.maxScore != null
                            ? `${rating.score}/${rating.maxScore}`
                            : "Mentioned"}
                        </span>
                      </Link>
                    );
                  })}
                  {review.companyRatings.length > 5 && (
                    <Link
                      to="/reviews/$slug"
                      params={{ slug: review.slug }}
                      className="flex items-center rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:border-blue-200 hover:bg-blue-50"
                    >
                      +{review.companyRatings.length - 5} more
                    </Link>
                  )}
                </div>

                <div className="mt-4">
                  <Link
                    to="/reviews/$slug"
                    params={{ slug: review.slug }}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    Read full review
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
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {addingReview && (
        <AddReviewModal
          companies={companyList}
          onClose={() => {
            setAddingReview(false);
          }}
        />
      )}
    </div>
  );
}
