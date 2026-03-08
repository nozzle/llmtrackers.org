import { Link } from "@tanstack/react-router";
import { CompanyMark } from "~/components/company-mark";
import { LlmIcon } from "~/components/llm-icon";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import {
  type DesignProps,
  LLM_KEYS,
  formatPrice,
  formatLocation,
  getReviewSiteScore,
  planKey,
} from "./design-props";

// ---------------------------------------------------------------------------
// Newspaper Design
// Classic broadsheet newspaper aesthetic: serif headlines, justified text,
// multi-column layout, thin rule lines, dateline, "classified ad" style plan
// listings.  Warm ivory background, black ink typography.
// ---------------------------------------------------------------------------

function RuleLine() {
  return <hr className="my-3 border-t border-[#2a2a2a]" />;
}

function ThinRule() {
  return <hr className="my-1.5 border-t border-[#ccc]" />;
}

export function NewspaperDesign(props: DesignProps) {
  const {
    plans,
    allPlans,
    companies,
    selectedPlans,
    onTogglePlan,
    onCompare,
    onEditPlan,
    onAddCompany,
    filters,
    updateSearch,
    activeFilterCount,
  } = props;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="-mx-4 -my-8 min-h-screen bg-[#fdf8ef] px-6 py-8 sm:-mx-6 lg:-mx-8 lg:px-12">
      <div className="mx-auto max-w-[1200px]">
        {/* ---- Masthead ---- */}
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.6em] text-[#666]">{today}</div>
          <RuleLine />
          <h1
            className="my-2 text-6xl font-black uppercase tracking-tight text-[#1a1a1a] sm:text-7xl lg:text-8xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            The LLM Tracker
          </h1>
          <div
            className="text-sm italic text-[#666]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            &ldquo;All the AI Visibility Tools That Are Fit to Track&rdquo;
          </div>
          <RuleLine />
          <div className="flex items-center justify-center gap-6 text-[10px] uppercase tracking-[0.3em] text-[#888]">
            <span>Vol. CXXVI · No. 1</span>
            <span>·</span>
            <span>
              {companies.length} Companies · {allPlans.length} Plans
            </span>
            <span>·</span>
            <span>Price: Free</span>
          </div>
          <ThinRule />
        </div>

        {/* ---- Classified search bar ---- */}
        <div className="my-4 border border-[#2a2a2a] bg-white/60 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="text-xs font-bold uppercase tracking-wider text-[#2a2a2a]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Search Classifieds:
            </span>
            <input
              type="text"
              placeholder="Find tools by name..."
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              className="flex-1 border-b border-[#aaa] bg-transparent px-1 py-1 text-sm text-[#333] outline-none placeholder:text-[#bbb]"
              style={{ fontFamily: "Georgia, serif" }}
            />

            <div className="flex flex-wrap gap-1">
              {LLM_KEYS.map((key) => {
                const active = filters.llmFilter.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? filters.llmFilter.filter((k) => k !== key)
                        : [...filters.llmFilter, key];
                      updateSearch({ llms: next.length > 0 ? next : undefined });
                    }}
                    className={`cursor-pointer border px-1.5 py-0.5 text-[10px] transition-colors ${
                      active
                        ? "border-[#2a2a2a] bg-[#2a2a2a] font-bold text-[#fdf8ef]"
                        : "border-[#ccc] text-[#666] hover:border-[#2a2a2a]"
                    }`}
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {LLM_MODEL_LABELS[key]}
                  </button>
                );
              })}
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  updateSearch({
                    q: undefined,
                    schedule: undefined,
                    llms: undefined,
                    priceMin: undefined,
                    priceMax: undefined,
                    costMin: undefined,
                    costMax: undefined,
                    responsesMin: undefined,
                    responsesMax: undefined,
                    g2Min: undefined,
                    g2Max: undefined,
                    trustpilotMin: undefined,
                    trustpilotMax: undefined,
                    trustradiusMin: undefined,
                    trustradiusMax: undefined,
                    capterraMin: undefined,
                    capterraMax: undefined,
                    locationType: undefined,
                  });
                }}
                className="cursor-pointer text-[10px] italic text-[#a33] hover:text-[#800]"
                style={{ fontFamily: "Georgia, serif" }}
              >
                Clear all
              </button>
            )}

            <button
              type="button"
              onClick={onAddCompany}
              className="cursor-pointer border border-[#2a2a2a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2a2a2a] hover:bg-[#2a2a2a] hover:text-[#fdf8ef]"
            >
              Submit Listing
            </button>

            {selectedPlans.size >= 2 && (
              <button
                type="button"
                onClick={onCompare}
                className="cursor-pointer bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#fdf8ef] hover:bg-[#000]"
              >
                Compare {selectedPlans.size}
              </button>
            )}
          </div>
        </div>

        {/* ---- Section headline ---- */}
        <div className="mb-4 border-b-2 border-[#2a2a2a] pb-1">
          <h2
            className="text-2xl font-bold text-[#1a1a1a]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Classified Listings
          </h2>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#888]">
            {plans.length} of {allPlans.length} listings displayed
          </div>
        </div>

        {/* ---- Newspaper columns ---- */}
        <div
          className="newspaper-columns gap-6"
          style={{ columnCount: 2, columnGap: "2rem", columnRule: "1px solid #ddd" }}
        >
          {plans.map((plan) => {
            const key = planKey(plan);
            const isSelected = selectedPlans.has(key);
            const g2 = getReviewSiteScore(plan, "g2");
            const tp = getReviewSiteScore(plan, "trustpilot");
            const tr = getReviewSiteScore(plan, "trustradius");
            const cap = getReviewSiteScore(plan, "capterra");
            const scores = [
              g2 != null ? `G2 ${g2.toFixed(1)}/5` : null,
              tp != null ? `TP ${tp.toFixed(1)}/5` : null,
              tr != null ? `TR ${tr.toFixed(1)}/10` : null,
              cap != null ? `Cap ${cap.toFixed(1)}/5` : null,
            ].filter(Boolean);

            return (
              <div
                key={key}
                onClick={() => {
                  onTogglePlan(key);
                }}
                className={`mb-4 cursor-pointer break-inside-avoid border-b border-[#ddd] pb-3 transition-colors ${
                  isSelected ? "bg-[#f0ead6]" : "hover:bg-[#f8f4e8]"
                }`}
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {/* Headline */}
                <div className="flex items-start gap-2">
                  <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                  <div className="flex-1">
                    <Link
                      to="/companies/$slug"
                      params={{ slug: plan.companySlug }}
                      className="text-lg font-bold leading-tight text-[#1a1a1a] no-underline hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {plan.companyName}
                    </Link>
                    <span className="ml-2 text-sm italic text-[#888]">{plan.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPlan(plan);
                    }}
                    className="mt-1 cursor-pointer text-[10px] italic text-[#aaa] hover:text-[#333]"
                  >
                    edit
                  </button>
                </div>

                {/* Body: written like a tiny classified ad */}
                <p
                  className="mt-1 text-[13px] leading-relaxed text-[#333]"
                  style={{ textAlign: "justify" }}
                >
                  <span className="font-bold">{formatPrice(plan)}/mo</span>
                  {plan.pricePer1000Responses != null && (
                    <span> (${plan.pricePer1000Responses.toFixed(2)}/1K responses)</span>
                  )}
                  {plan.aiResponsesMonthly != null && (
                    <span>
                      {" "}
                      — Up to{" "}
                      <span className="font-semibold">
                        {plan.aiResponsesMonthly.toLocaleString()}
                      </span>{" "}
                      AI responses per month.
                    </span>
                  )}{" "}
                  Monitors{" "}
                  <span className="font-semibold">{formatLocation(plan.locationSupport)}</span> on a{" "}
                  <span className={plan.schedule === "daily" ? "font-bold" : ""}>
                    {plan.schedule}
                  </span>{" "}
                  schedule.
                </p>

                {/* LLMs */}
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#888]">Tracks:</span>
                  {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                    <LlmIcon key={k} model={k} size={14} />
                  ))}
                </div>

                {/* Scores */}
                {scores.length > 0 && (
                  <div className="mt-1 text-[11px] text-[#666]">Ratings: {scores.join(" · ")}</div>
                )}

                {isSelected && (
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#a33]">
                    ★ Selected for comparison
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="py-20 text-center" style={{ fontFamily: "Georgia, serif" }}>
            <div className="text-xl italic text-[#aaa]">
              No listings match your search criteria.
            </div>
            <div className="mt-2 text-sm text-[#ccc]">
              Please broaden your classified search above.
            </div>
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="mt-8 border-t-2 border-[#2a2a2a] pt-2 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#aaa]">
            — End of Classified Section —
          </div>
        </div>
      </div>
    </div>
  );
}
