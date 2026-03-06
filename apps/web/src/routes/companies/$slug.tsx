import { createFileRoute, Link } from "@tanstack/react-router";
import { getCompanyBySlug, getAllCompanies } from "~/data";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import type { LlmModelKey } from "@llm-tracker/shared";

export const Route = createFileRoute("/companies/$slug")({
  component: CompanyPage,
  head: ({ params }) => {
    const company = getCompanyBySlug(params.slug);
    const title = company
      ? `${company.name} - LLM Tracker Comparison`
      : "Company Not Found";
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
        ...(company?.score
          ? [
              {
                name: "twitter:label1",
                content: "Score",
              },
              {
                name: "twitter:data1",
                content: `${company.score.total}/${company.score.maxTotal}`,
              },
            ]
          : []),
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

function CompanyPage() {
  const { slug } = Route.useParams();
  const company = getCompanyBySlug(slug);

  if (!company) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Company Not Found</h1>
        <p className="mt-2 text-gray-600">
          No company found with slug &quot;{slug}&quot;.
        </p>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to comparison
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
            <p className="mt-1 text-lg text-gray-600">{company.description}</p>
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block break-all text-sm text-blue-600 hover:underline"
            >
              {company.website}
            </a>
          </div>
          {company.score && (
            <div className="flex-shrink-0 rounded-lg bg-green-50 px-6 py-4 text-center">
              <div className="text-3xl font-bold text-green-700">
                {company.score.total}
              </div>
              <div className="text-sm text-green-600">
                / {company.score.maxTotal}
              </div>
            </div>
          )}
        </div>
        {company.score?.summary && (
          <div className="mt-4 rounded-md bg-gray-100 p-4 text-sm text-gray-700">
            {company.score.summary}
          </div>
        )}
      </div>

      {/* Plans */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Plans</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {company.plans.map((plan) => (
            <div
              key={plan.slug}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {plan.name}
                </h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {plan.price.amount !== null
                      ? `$${plan.price.amount.toLocaleString()}`
                      : "Custom"}
                  </div>
                  <div className="text-xs text-gray-500">
                    /{plan.price.period}
                    {plan.price.note && (
                      <span className="block text-gray-400">
                        {plan.price.note}
                      </span>
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
                    {plan.personaSupport === "unlimited"
                      ? "Unlimited"
                      : plan.personaSupport}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">LLM Models</span>
                  <span className="font-medium">
                    {plan.includedLlmModels ?? "-"}
                  </span>
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
                    {plan.contentOptimization === false
                      ? "No"
                      : plan.contentOptimization}
                  </span>
                </div>
              </div>

              {/* LLM Support */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">
                  LLM Support
                </h4>
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
                  <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">
                    Integrations
                  </h4>
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

      {/* Reviews */}
      {company.reviews.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Reviews</h2>
          <div className="flex flex-wrap gap-4">
            {company.reviews.map((review) => (
              <a
                key={review.platform}
                href={review.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-blue-300"
              >
                <span className="font-medium text-gray-900">
                  {review.platform}
                </span>
                {review.score != null && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-sm font-semibold text-yellow-800">
                    {review.score}/{review.maxScore}
                  </span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Tweets */}
      {company.tweets.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            What People Are Saying
          </h2>
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
                  <span className="font-medium text-gray-900">
                    {tweet.authorName}
                  </span>
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
    </div>
  );
}
