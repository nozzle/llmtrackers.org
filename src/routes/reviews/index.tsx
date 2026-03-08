import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllReviews, getCompanyBySlug } from "~/data";
import { CompanyMark } from "~/components/company-mark";

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

  return (
    <div>
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Published Reviews</h1>
        <p className="mt-2 text-gray-600">
          Editorial reviews and scorecards of AI search visibility tools.
        </p>
      </div>

      {reviews.length === 0 ? (
        <p className="text-gray-500">No published reviews yet.</p>
      ) : (
        <div className="grid gap-6">
          {reviews.map((review) => {
            const topRatings = [...review.companyRatings]
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);

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
                          {rating.score}/{rating.maxScore}
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
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    View full review details
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
