import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { getCompanyBySlug, getReviewsForCompanySlug } from "~/data";
import { EditPlanModal } from "~/components/edit-plan-modal";
import { EditCompanyModal } from "~/components/edit-company-modal";
import { AddPlanModal } from "~/components/add-plan-modal";
import { MediaOverlay } from "~/components/media-overlay";
import { Link } from "@tanstack/react-router";
import type { Plan } from "@llm-tracker/shared";

import {
  type CompanyLayoutKey,
  type CompanyDesignProps,
  COMPANY_LAYOUT_KEYS,
  COMPANY_LAYOUT_LABELS,
} from "~/components/company-designs/company-design-props";
import { CompanyHeader } from "~/components/company-designs/sections";
import { StandardLayout } from "~/components/company-designs/standard";
import { TwoColumnLayout } from "~/components/company-designs/two-column";
import { CompactLayout } from "~/components/company-designs/compact";
import { TabbedLayout } from "~/components/company-designs/tabbed";
import { SidebarNavLayout } from "~/components/company-designs/sidebar-nav";

// ---------------------------------------------------------------------------
// Layout renderer map
// ---------------------------------------------------------------------------

const LAYOUT_COMPONENTS: Record<CompanyLayoutKey, React.ComponentType<CompanyDesignProps>> = {
  standard: StandardLayout,
  "two-column": TwoColumnLayout,
  compact: CompactLayout,
  tabbed: TabbedLayout,
  sidebar: SidebarNavLayout,
};

// ---------------------------------------------------------------------------
// Route definition with search-param schema
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/companies/$slug")({
  component: CompanyPage,
  validateSearch: z.object({
    layout: z
      .enum(
        COMPANY_LAYOUT_KEYS as readonly [CompanyLayoutKey, ...CompanyLayoutKey[]] as [
          CompanyLayoutKey,
          ...CompanyLayoutKey[],
        ],
      )
      .optional()
      .catch(undefined),
  }),
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

// ---------------------------------------------------------------------------
// Layout Toggle Bar
// ---------------------------------------------------------------------------

function LayoutToggle({
  active,
  onChange,
}: {
  active: CompanyLayoutKey;
  onChange: (key: CompanyLayoutKey) => void;
}) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wider text-gray-400">
        Layout
      </span>
      <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
        {COMPANY_LAYOUT_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              onChange(key);
            }}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              active === key
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {COMPANY_LAYOUT_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function CompanyPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

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

  // ---- Layout variant ----
  const activeLayout: CompanyLayoutKey = search.layout ?? "standard";
  const LayoutComponent = LAYOUT_COMPONENTS[activeLayout];

  return (
    <div>
      {/* Header */}
      <CompanyHeader
        company={company}
        onEditCompany={() => {
          setEditingCompany(true);
        }}
      />

      {/* Layout Toggle */}
      <LayoutToggle
        active={activeLayout}
        onChange={(key) => {
          void navigate({
            to: "/companies/$slug",
            params: { slug },
            search: { layout: key === "standard" ? undefined : key },
            replace: true,
          });
        }}
      />

      {/* Active Layout */}
      <LayoutComponent
        company={company}
        relatedReviews={relatedReviews}
        onEditPlan={(plan) => {
          setEditingPlan(plan);
        }}
        onEditCompany={() => {
          setEditingCompany(true);
        }}
        onAddPlan={() => {
          setAddingPlan(true);
        }}
        onOpenMedia={(overlay) => {
          setMediaOverlay(overlay);
        }}
      />

      {/* Modals (shared across all layouts) */}
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
