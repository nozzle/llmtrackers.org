import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getReviewBySlug, getCompanyBySlug, getAllCompanies } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import { EditReviewModal } from "~/components/edit-review-modal";

function HighlightList({
  title,
  items,
  tone,
}: Readonly<{
  title: string;
  items: string[];
  tone: "green" | "red" | "blue";
}>) {
  if (items.length === 0) return null;

  const toneClasses = {
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  } as const;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${title}-${item}`}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/reviews/$slug")({
  component: ReviewPage,
  head: ({ params }) => {
    const review = getReviewBySlug(params.slug);
    const title = review ? `${review.name} - LLM Trackers` : "Review Not Found";
    const description = review
      ? `Review by ${review.author.name} covering ${review.companyRatings.length} tools. Published ${review.date}.`
      : "";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
});

function ReviewPage() {
  const { slug } = Route.useParams();
  const review = getReviewBySlug(slug);
  const companies = getAllCompanies();
  const [editingReview, setEditingReview] = useState(false);

  const companyList = companies.map((c) => ({ slug: c.slug, name: c.name }));

  if (!review) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Review Not Found</h1>
        <p className="mt-2 text-gray-600">No review found with slug &quot;{slug}&quot;.</p>
        <Link to="/reviews" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to reviews
        </Link>
      </div>
    );
  }

  const sortedRatings = [...review.companyRatings].sort((a, b) => {
    const aHasScore = a.score != null && a.maxScore != null;
    const bHasScore = b.score != null && b.maxScore != null;

    if (aHasScore && bHasScore) return (b.score ?? 0) - (a.score ?? 0);
    if (aHasScore) return -1;
    if (bHasScore) return 1;
    return 0;
  });
  const scoredCount = sortedRatings.filter(
    (rating) => rating.score != null && rating.maxScore != null,
  ).length;
  const isUnscoredRoundup = scoredCount === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link to="/reviews" className="text-sm text-blue-600 hover:underline">
          &larr; All reviews
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          {review.name}
          <button
            type="button"
            onClick={() => {
              setEditingReview(true);
            }}
            className="ml-3 inline-flex cursor-pointer items-center align-middle rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Suggest review info edit"
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
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
          </button>
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>
            By <span className="font-medium text-gray-900">{review.author.name}</span>
          </span>
          <span>{review.date}</span>
          {isUnscoredRoundup && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Unscored roundup
            </span>
          )}
          {review.author.socialProfiles.map((profile) => (
            <a
              key={profile.url}
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {profile.label}
            </a>
          ))}
        </div>

        <div className="mt-4">
          <a
            href={review.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            Read the original article
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
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>
        </div>

        <div className="mt-5 max-w-3xl rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Article Summary
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-700">{review.summary}</p>
          <div className="mt-3 space-y-4 text-sm leading-7 text-gray-700">
            {review.detailedSummary.split(/\n\s*\n/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Ratings summary */}
      <section>
        <h2 className="mb-1 text-xl font-semibold text-gray-900">Company Ratings</h2>
        <p className="mb-6 text-sm text-gray-600">
          {scoredCount > 0
            ? `${sortedRatings.length} tools covered, with ${scoredCount} scored and ranked first.`
            : `${sortedRatings.length} tools covered in this review.`}
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRatings.map((rating, index) => {
            const company = getCompanyBySlug(rating.companySlug);
            const hasScore = rating.score != null && rating.maxScore != null;
            const pct = hasScore ? ((rating.score ?? 0) / (rating.maxScore ?? 1)) * 100 : 0;

            return (
              <article
                key={rating.companySlug}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                {/* Top row: rank + company + score */}
                <div className="flex items-start gap-3">
                  <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-500">
                    {hasScore ? index + 1 : "-"}
                  </span>
                  <div className="min-w-0 flex-1">
                    {company ? (
                      <Link
                        to="/companies/$slug"
                        params={{ slug: rating.companySlug }}
                        className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600"
                      >
                        <CompanyMark slug={company.slug} name={company.name} size="sm" />
                        {company.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-900">{rating.companySlug}</span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {hasScore ? (
                      <>
                        <div className="text-lg font-bold text-gray-900">{rating.score}</div>
                        <div className="text-xs text-gray-500">/ {rating.maxScore}</div>
                      </>
                    ) : (
                      <div className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
                        Mentioned
                      </div>
                    )}
                  </div>
                </div>

                {/* Score bar */}
                {hasScore && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {/* Summary */}
                <p className="mt-3 text-sm leading-relaxed text-gray-700">{rating.summary}</p>

                {(rating.pros.length > 0 ||
                  rating.cons.length > 0 ||
                  rating.noteworthy.length > 0) && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    <HighlightList title="Pros" items={rating.pros} tone="green" />
                    <HighlightList title="Cons" items={rating.cons} tone="red" />
                    <HighlightList title="Noteworthy" items={rating.noteworthy} tone="blue" />
                  </div>
                )}

                {/* Links */}
                <div className="mt-3 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-sm">
                  {company && (
                    <Link
                      to="/companies/$slug"
                      params={{ slug: rating.companySlug }}
                      className="text-blue-600 hover:underline"
                    >
                      Company details
                    </Link>
                  )}
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
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {editingReview && (
        <EditReviewModal
          review={review}
          companies={companyList}
          onClose={() => {
            setEditingReview(false);
          }}
        />
      )}
    </div>
  );
}
