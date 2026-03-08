import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { CompanyMark } from "~/components/company-mark";
import { LlmIcon } from "~/components/llm-icon";
import { ReviewSiteMark, ReviewSiteScoreBadge } from "~/components/review-site-badge";
import { LLM_MODEL_LABELS, REVIEW_SITE_LABELS } from "@llm-tracker/shared";
import type { LlmModelKey } from "@llm-tracker/shared";
import {
  type DesignProps,
  type ColumnId,
  ALL_COLUMN_IDS,
  COLUMN_LABELS,
  LLM_KEYS,
  formatPrice,
  formatLocation,
  getReviewSiteScore,
  getReviewSiteMaxScore,
  planKey,
} from "./design-props";

// ---------------------------------------------------------------------------
// Reusable small components (moved from index.tsx)
// ---------------------------------------------------------------------------

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [ref, onClose]);
}

function DualRangeSlider({
  min,
  max,
  step = 1,
  valueLow,
  valueHigh,
  onLowChange,
  onHighChange,
  formatLabel,
}: {
  min: number;
  max: number;
  step?: number;
  valueLow: number;
  valueHigh: number;
  onLowChange: (v: number) => void;
  onHighChange: (v: number) => void;
  formatLabel?: (v: number) => string;
}) {
  const fmt = formatLabel ?? ((v: number) => String(v));
  const range = max - min || 1;
  const leftPct = ((valueLow - min) / range) * 100;
  const rightPct = ((valueHigh - min) / range) * 100;

  return (
    <div className="w-full">
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-gray-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blue-500"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueLow}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v <= valueHigh) onLowChange(v);
          }}
          className="range-thumb pointer-events-none absolute top-0 h-6 w-full cursor-pointer appearance-none bg-transparent"
          style={{ zIndex: valueLow >= valueHigh ? 3 : 2 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueHigh}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= valueLow) onHighChange(v);
          }}
          className="range-thumb pointer-events-none absolute top-0 h-6 w-full cursor-pointer appearance-none bg-transparent"
          style={{ zIndex: 2 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{fmt(valueLow)}</span>
        <span>{fmt(valueHigh)}</span>
      </div>
    </div>
  );
}

function RangeFilterPopover({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  rangeMin,
  rangeMax,
  step = 1,
  formatLabel,
}: {
  label: string;
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (v: number | undefined) => void;
  onMaxChange: (v: number | undefined) => void;
  rangeMin: number;
  rangeMax: number;
  step?: number;
  formatLabel?: (v: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
  });

  const hasValue = minValue != null || maxValue != null;
  const fmt = formatLabel ?? ((v: number) => String(v));
  const summary = hasValue
    ? minValue != null && maxValue != null
      ? `${fmt(minValue)}–${fmt(maxValue)}`
      : minValue != null
        ? `${fmt(minValue)}+`
        : maxValue != null
          ? `≤${fmt(maxValue)}`
          : null
    : null;

  const effectiveLow = minValue ?? rangeMin;
  const effectiveHigh = maxValue ?? rangeMax;

  const handleLowChange = useCallback(
    (v: number) => {
      onMinChange(v <= rangeMin ? undefined : v);
    },
    [onMinChange, rangeMin],
  );
  const handleHighChange = useCallback(
    (v: number) => {
      onMaxChange(v >= rangeMax ? undefined : v);
    },
    [onMaxChange, rangeMax],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
          hasValue
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        {label}
        {summary && <span className="font-medium">: {summary}</span>}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <DualRangeSlider
            min={rangeMin}
            max={rangeMax}
            step={step}
            valueLow={effectiveLow}
            valueHigh={effectiveHigh}
            onLowChange={handleLowChange}
            onHighChange={handleHighChange}
            formatLabel={formatLabel}
          />
          {hasValue && (
            <button
              type="button"
              onClick={() => {
                onMinChange(undefined);
                onMaxChange(undefined);
              }}
              className="mt-3 cursor-pointer text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LlmMultiSelect({
  selected,
  onChange,
}: {
  selected: LlmModelKey[];
  onChange: (v: LlmModelKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
  });

  function toggle(key: LlmModelKey) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  const hasValue = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
          hasValue
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        LLMs
        {hasValue && (
          <span className="rounded-full bg-blue-200 px-1.5 text-xs font-medium text-blue-800">
            {selected.length}
          </span>
        )}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {LLM_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={() => {
                  toggle(key);
                }}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600"
              />
              <LlmIcon model={key} size={16} />
              {LLM_MODEL_LABELS[key]}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange([]);
              }}
              className="w-full cursor-pointer border-t border-gray-100 px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-blue-800">
      {label}
      <button
        type="button"
        onClick={onDismiss}
        className="ml-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-blue-600 hover:bg-blue-200 hover:text-blue-900"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </span>
  );
}

function MoreFiltersDropdown({
  filters,
  onUpdate,
}: {
  filters: DesignProps["filters"];
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
  });

  const {
    g2Min,
    g2Max,
    trustpilotMin,
    trustpilotMax,
    trustradiusMin,
    trustradiusMax,
    capterraMin,
    capterraMax,
    costMin,
    costMax,
    responsesMin,
    responsesMax,
    scheduleFilter,
    locationType,
  } = filters;

  const secondaryFilterCount = [
    g2Min,
    g2Max,
    trustpilotMin,
    trustpilotMax,
    trustradiusMin,
    trustradiusMax,
    capterraMin,
    capterraMax,
    costMin,
    costMax,
    responsesMin,
    responsesMax,
    scheduleFilter !== "all" ? scheduleFilter : undefined,
    locationType !== "all" ? locationType : undefined,
  ].filter((v) => v != null && v !== "").length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
          secondaryFilterCount > 0
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        More Filters
        {secondaryFilterCount > 0 && (
          <span className="rounded-full bg-blue-200 px-1.5 text-xs font-medium text-blue-800">
            {secondaryFilterCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <div className="grid gap-5">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Review Sites
              </div>
              <div className="grid gap-4">
                {(
                  [
                    ["G2", g2Min, g2Max, "g2Min", "g2Max", 0, 5, 0.1],
                    [
                      "Trustpilot",
                      trustpilotMin,
                      trustpilotMax,
                      "trustpilotMin",
                      "trustpilotMax",
                      0,
                      5,
                      0.1,
                    ],
                    [
                      "TrustRadius",
                      trustradiusMin,
                      trustradiusMax,
                      "trustradiusMin",
                      "trustradiusMax",
                      0,
                      10,
                      0.1,
                    ],
                    ["Capterra", capterraMin, capterraMax, "capterraMin", "capterraMax", 0, 5, 0.1],
                  ] as [
                    string,
                    number | undefined,
                    number | undefined,
                    string,
                    string,
                    number,
                    number,
                    number,
                  ][]
                ).map(([label, min, max, minKey, maxKey, rMin, rMax, step]) => (
                  <div key={label}>
                    <div className="mb-1 text-xs text-gray-600">{label}</div>
                    <DualRangeSlider
                      min={rMin}
                      max={rMax}
                      step={step}
                      valueLow={min ?? rMin}
                      valueHigh={max ?? rMax}
                      onLowChange={(v) => {
                        onUpdate({ [minKey]: v <= rMin ? undefined : v });
                      }}
                      onHighChange={(v) => {
                        onUpdate({ [maxKey]: v >= rMax ? undefined : v });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Cost &amp; Volume
              </div>
              <div className="grid gap-4">
                <div>
                  <div className="mb-1 text-xs text-gray-600">$/1K Resp.</div>
                  <DualRangeSlider
                    min={0}
                    max={200}
                    step={1}
                    valueLow={costMin ?? 0}
                    valueHigh={costMax ?? 200}
                    onLowChange={(v) => {
                      onUpdate({ costMin: v <= 0 ? undefined : v });
                    }}
                    onHighChange={(v) => {
                      onUpdate({ costMax: v >= 200 ? undefined : v });
                    }}
                    formatLabel={(v) => `$${v}`}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-gray-600">AI Resp./mo</div>
                  <DualRangeSlider
                    min={0}
                    max={2000000}
                    step={1000}
                    valueLow={responsesMin ?? 0}
                    valueHigh={responsesMax ?? 2000000}
                    onLowChange={(v) => {
                      onUpdate({ responsesMin: v <= 0 ? undefined : v });
                    }}
                    onHighChange={(v) => {
                      onUpdate({ responsesMax: v >= 2000000 ? undefined : v });
                    }}
                    formatLabel={(v) =>
                      v >= 1000000
                        ? `${(v / 1000000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : String(v)
                    }
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Other
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-gray-600">Schedule</span>
                  <select
                    value={scheduleFilter}
                    onChange={(e) => {
                      onUpdate({ schedule: e.target.value === "all" ? undefined : e.target.value });
                    }}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-gray-600">Locations</span>
                  <select
                    value={locationType}
                    onChange={(e) => {
                      onUpdate({
                        locationType: e.target.value === "all" ? undefined : e.target.value,
                      });
                    }}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All</option>
                    <option value="global">Global</option>
                    <option value="regional">Regional</option>
                  </select>
                </div>
              </div>
            </div>
            {secondaryFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    g2Min: undefined,
                    g2Max: undefined,
                    trustpilotMin: undefined,
                    trustpilotMax: undefined,
                    trustradiusMin: undefined,
                    trustradiusMax: undefined,
                    capterraMin: undefined,
                    capterraMax: undefined,
                    costMin: undefined,
                    costMax: undefined,
                    responsesMin: undefined,
                    responsesMax: undefined,
                    schedule: undefined,
                    locationType: undefined,
                  });
                }}
                className="cursor-pointer text-xs text-red-500 hover:text-red-700"
              >
                Clear all secondary filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnVisibilityPicker({
  visibleColumns,
  onChange,
}: {
  visibleColumns: ColumnId[];
  onChange: (v: ColumnId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
  });

  const allVisible = visibleColumns.length === ALL_COLUMN_IDS.length;

  function toggleColumn(id: ColumnId) {
    if (visibleColumns.includes(id)) {
      const next = visibleColumns.filter((c) => c !== id);
      if (next.length === 0) return;
      onChange(next);
    } else {
      const next = ALL_COLUMN_IDS.filter(
        (c) => visibleColumns.includes(c) || c === id,
      ) as unknown as ColumnId[];
      onChange(next);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
      >
        <svg
          className="h-4 w-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        Columns
        {!allVisible && (
          <span className="rounded-full bg-blue-100 px-1.5 text-xs text-blue-700">
            {visibleColumns.length}/{ALL_COLUMN_IDS.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onChange(allVisible ? ["name"] : [...ALL_COLUMN_IDS]);
              }}
              className="cursor-pointer text-xs text-blue-600 hover:text-blue-800"
            >
              {allVisible ? "Hide all" : "Show all"}
            </button>
          </div>
          {ALL_COLUMN_IDS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(id)}
                onChange={() => {
                  toggleColumn(id);
                }}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600"
              />
              {COLUMN_LABELS[id]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build secondary filter chips
// ---------------------------------------------------------------------------

function buildSecondaryChips(
  filters: DesignProps["filters"],
  updateSearch: DesignProps["updateSearch"],
) {
  const chips: { label: string; onDismiss: () => void }[] = [];

  function rangeLabel(name: string, min: number | undefined, max: number | undefined): string {
    if (min != null && max != null) return `${name}: ${min}–${max}`;
    if (min != null) return `${name}: ${min}+`;
    return max === undefined ? name : `${name}: ≤${max}`;
  }

  const {
    g2Min,
    g2Max,
    trustpilotMin,
    trustpilotMax,
    trustradiusMin,
    trustradiusMax,
    capterraMin,
    capterraMax,
    costMin,
    costMax,
    responsesMin,
    responsesMax,
    scheduleFilter,
    locationType,
  } = filters;

  if (g2Min != null || g2Max != null)
    chips.push({
      label: rangeLabel("G2", g2Min, g2Max),
      onDismiss: () => {
        updateSearch({ g2Min: undefined, g2Max: undefined });
      },
    });
  if (trustpilotMin != null || trustpilotMax != null)
    chips.push({
      label: rangeLabel("Trustpilot", trustpilotMin, trustpilotMax),
      onDismiss: () => {
        updateSearch({ trustpilotMin: undefined, trustpilotMax: undefined });
      },
    });
  if (trustradiusMin != null || trustradiusMax != null)
    chips.push({
      label: rangeLabel("TrustRadius", trustradiusMin, trustradiusMax),
      onDismiss: () => {
        updateSearch({ trustradiusMin: undefined, trustradiusMax: undefined });
      },
    });
  if (capterraMin != null || capterraMax != null)
    chips.push({
      label: rangeLabel("Capterra", capterraMin, capterraMax),
      onDismiss: () => {
        updateSearch({ capterraMin: undefined, capterraMax: undefined });
      },
    });
  if (costMin != null || costMax != null)
    chips.push({
      label: rangeLabel("$/1K Resp.", costMin, costMax),
      onDismiss: () => {
        updateSearch({ costMin: undefined, costMax: undefined });
      },
    });
  if (responsesMin != null || responsesMax != null)
    chips.push({
      label: rangeLabel("AI Resp./mo", responsesMin, responsesMax),
      onDismiss: () => {
        updateSearch({ responsesMin: undefined, responsesMax: undefined });
      },
    });
  if (scheduleFilter !== "all")
    chips.push({
      label: `Schedule: ${scheduleFilter}`,
      onDismiss: () => {
        updateSearch({ schedule: undefined });
      },
    });
  if (locationType !== "all")
    chips.push({
      label: `Location: ${locationType}`,
      onDismiss: () => {
        updateSearch({ locationType: undefined });
      },
    });

  return chips;
}

// ---------------------------------------------------------------------------
// Table Design Component
// ---------------------------------------------------------------------------

export function TableDesign(props: DesignProps) {
  const {
    plans,
    allPlans,
    companies,
    selectedPlans,
    onTogglePlan,
    onCompare,
    onEditPlan,
    onAddCompany,
    sortBy,
    sortDir,
    onToggleSort,
    visibleColumns,
    onColumnsChange,
    filters,
    updateSearch,
    activeFilterCount,
  } = props;

  const secondaryChips = buildSecondaryChips(filters, updateSearch);

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const isColumnVisible = (id: ColumnId) => visibleColumns.includes(id);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">AI Search Visibility Tool Comparison</h1>
          <button
            type="button"
            onClick={onAddCompany}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            title="Add a new company"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Company
          </button>
        </div>
        <p className="mt-2 text-gray-600">
          Compare {companies.length} LLM tracking tools across {allPlans.length} plans. Select plans
          to compare side-by-side.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search companies or plans..."
            value={filters.q}
            onChange={(e) => {
              updateSearch({ q: e.target.value || undefined });
            }}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <RangeFilterPopover
          label="Price"
          minValue={filters.priceMin}
          maxValue={filters.priceMax}
          onMinChange={(v) => {
            updateSearch({ priceMin: v });
          }}
          onMaxChange={(v) => {
            updateSearch({ priceMax: v });
          }}
          rangeMin={0}
          rangeMax={2000}
          step={10}
          formatLabel={(v) => `$${v.toLocaleString()}`}
        />

        <LlmMultiSelect
          selected={filters.llmFilter}
          onChange={(v) => {
            updateSearch({ llms: v.length > 0 ? v : undefined });
          }}
        />

        <MoreFiltersDropdown filters={filters} onUpdate={updateSearch} />

        {secondaryChips.map((chip) => (
          <FilterChip key={chip.label} label={chip.label} onDismiss={chip.onDismiss} />
        ))}

        {activeFilterCount > 0 && (
          <button
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
            className="cursor-pointer text-xs text-red-500 hover:text-red-700"
          >
            Clear all filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedPlans.size >= 2 && (
            <button
              onClick={onCompare}
              className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Compare {selectedPlans.size} Plans
            </button>
          )}
          {selectedPlans.size > 0 && (
            <button
              onClick={() => {
                // Clear all selections — calling with each to deselect
                for (const k of selectedPlans) onTogglePlan(k);
              }}
              className="cursor-pointer text-xs text-gray-500 hover:text-gray-700"
            >
              Clear selection
            </button>
          )}
          <ColumnVisibilityPicker visibleColumns={visibleColumns} onChange={onColumnsChange} />
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[80vh] overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {(() => {
              const reviewCols = (["g2", "trustpilot", "trustradius", "capterra"] as const).filter(
                isColumnVisible,
              ).length;
              const pricingCols = (["price", "costEfficiency", "responses"] as const).filter(
                isColumnVisible,
              ).length;
              const leadingCols =
                1 + (isColumnVisible("name") ? 1 : 0) + (isColumnVisible("plan") ? 1 : 0);
              const trailingCols = (["schedule", "llmSupport", "locations"] as const).filter(
                isColumnVisible,
              ).length;
              const hasGroupRow = reviewCols > 0 || pricingCols > 0;
              const row2Top = hasGroupRow ? "top-[25px]" : "top-0";

              return (
                <>
                  {hasGroupRow && (
                    <tr>
                      {leadingCols > 0 && (
                        <th colSpan={leadingCols} className="sticky top-0 z-20 bg-gray-50" />
                      )}
                      {reviewCols > 0 && (
                        <th
                          colSpan={reviewCols}
                          className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-400"
                        >
                          Platform Reviews
                        </th>
                      )}
                      {pricingCols > 0 && (
                        <th
                          colSpan={pricingCols}
                          className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-400"
                        >
                          Pricing
                        </th>
                      )}
                      {trailingCols > 0 && (
                        <th colSpan={trailingCols} className="sticky top-0 z-20 bg-gray-50" />
                      )}
                    </tr>
                  )}
                  <tr>
                    <th className={`sticky left-0 ${row2Top} z-30 w-10 bg-gray-50 px-3 py-3`}>
                      <span className="sr-only">Select</span>
                    </th>
                    {isColumnVisible("name") && (
                      <th
                        className={`sticky left-10 ${row2Top} z-30 cursor-pointer bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("name");
                        }}
                      >
                        Company{sortIndicator("name")}
                      </th>
                    )}
                    {isColumnVisible("plan") && (
                      <th
                        className={`sticky ${row2Top} z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500`}
                      >
                        Plan
                      </th>
                    )}
                    {isColumnVisible("g2") && (
                      <th
                        className={`sticky ${row2Top} z-20 cursor-pointer bg-gray-50 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("g2");
                        }}
                        title={REVIEW_SITE_LABELS.g2}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ReviewSiteMark platform="g2" mode="favicon" size="sm" />
                          <span>{sortIndicator("g2")}</span>
                        </span>
                      </th>
                    )}
                    {isColumnVisible("trustpilot") && (
                      <th
                        className={`sticky ${row2Top} z-20 cursor-pointer bg-gray-50 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("trustpilot");
                        }}
                        title={REVIEW_SITE_LABELS.trustpilot}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ReviewSiteMark platform="trustpilot" mode="favicon" size="sm" />
                          <span>{sortIndicator("trustpilot")}</span>
                        </span>
                      </th>
                    )}
                    {isColumnVisible("trustradius") && (
                      <th
                        className={`sticky ${row2Top} z-20 cursor-pointer bg-gray-50 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("trustradius");
                        }}
                        title={REVIEW_SITE_LABELS.trustradius}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ReviewSiteMark platform="trustradius" mode="favicon" size="sm" />
                          <span>{sortIndicator("trustradius")}</span>
                        </span>
                      </th>
                    )}
                    {isColumnVisible("capterra") && (
                      <th
                        className={`sticky ${row2Top} z-20 cursor-pointer bg-gray-50 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("capterra");
                        }}
                        title={REVIEW_SITE_LABELS.capterra}
                      >
                        <span className="inline-flex items-center gap-1">
                          <ReviewSiteMark platform="capterra" mode="favicon" size="sm" />
                          <span>{sortIndicator("capterra")}</span>
                        </span>
                      </th>
                    )}
                    {isColumnVisible("price") && (
                      <th
                        className={`sticky ${row2Top} z-20 cursor-pointer bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("price");
                        }}
                      >
                        Price/mo{sortIndicator("price")}
                      </th>
                    )}
                    {isColumnVisible("costEfficiency") && (
                      <th
                        className={`sticky ${row2Top} z-20 cursor-pointer bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("costEfficiency");
                        }}
                      >
                        $/1K Resp.{sortIndicator("costEfficiency")}
                      </th>
                    )}
                    {isColumnVisible("responses") && (
                      <th
                        className={`sticky ${row2Top} z-20 cursor-pointer bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700`}
                        onClick={() => {
                          onToggleSort("responses");
                        }}
                      >
                        AI Resp./mo{sortIndicator("responses")}
                      </th>
                    )}
                    {isColumnVisible("schedule") && (
                      <th
                        className={`sticky ${row2Top} z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500`}
                      >
                        Schedule
                      </th>
                    )}
                    {isColumnVisible("llmSupport") && (
                      <th
                        className={`sticky ${row2Top} z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500`}
                      >
                        LLM Support
                      </th>
                    )}
                    {isColumnVisible("locations") && (
                      <th
                        className={`sticky ${row2Top} z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500`}
                      >
                        Locations
                      </th>
                    )}
                  </tr>
                </>
              );
            })()}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {plans.map((plan) => {
              const key = planKey(plan);
              const isSelected = selectedPlans.has(key);
              return (
                <tr
                  key={key}
                  className={`group ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors`}
                >
                  <td
                    className={`sticky left-0 z-10 px-3 py-3 ${isSelected ? "bg-blue-50" : "bg-white"}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        onTogglePlan(key);
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  {isColumnVisible("name") && (
                    <td
                      className={`sticky left-10 z-10 px-4 py-3 ${isSelected ? "bg-blue-50" : "bg-white"}`}
                    >
                      <div className="flex items-center gap-3">
                        <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                        <Link
                          to="/companies/$slug"
                          params={{ slug: plan.companySlug }}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {plan.companyName}
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            onEditPlan(plan);
                          }}
                          className="cursor-pointer rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
                          title="Suggest an edit"
                        >
                          <svg
                            className="h-3.5 w-3.5"
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
                    </td>
                  )}
                  {isColumnVisible("plan") && (
                    <td className="px-4 py-3 text-sm text-gray-700">{plan.name}</td>
                  )}
                  {isColumnVisible("g2") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="g2"
                        score={getReviewSiteScore(plan, "g2")}
                        maxScore={getReviewSiteMaxScore(plan, "g2", 5)}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("trustpilot") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="trustpilot"
                        score={getReviewSiteScore(plan, "trustpilot")}
                        maxScore={getReviewSiteMaxScore(plan, "trustpilot", 5)}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("trustradius") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="trustradius"
                        score={getReviewSiteScore(plan, "trustradius")}
                        maxScore={getReviewSiteMaxScore(plan, "trustradius", 10)}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("capterra") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="capterra"
                        score={getReviewSiteScore(plan, "capterra")}
                        maxScore={getReviewSiteMaxScore(plan, "capterra", 5)}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("price") && (
                    <td className="px-4 py-3 text-sm font-medium">
                      {formatPrice(plan)}
                      {plan.price.note && (
                        <div className="text-xs text-gray-400">{plan.price.note}</div>
                      )}
                    </td>
                  )}
                  {isColumnVisible("costEfficiency") && (
                    <td className="px-4 py-3 text-sm">
                      {plan.pricePer1000Responses != null
                        ? `$${plan.pricePer1000Responses.toFixed(2)}`
                        : "-"}
                    </td>
                  )}
                  {isColumnVisible("responses") && (
                    <td className="px-4 py-3 text-sm">
                      {plan.aiResponsesMonthly != null
                        ? plan.aiResponsesMonthly.toLocaleString()
                        : "-"}
                    </td>
                  )}
                  {isColumnVisible("schedule") && (
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${plan.schedule === "daily" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}
                      >
                        {plan.schedule}
                      </span>
                    </td>
                  )}
                  {isColumnVisible("llmSupport") && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                          <LlmIcon key={k} model={k} size={18} />
                        ))}
                      </div>
                    </td>
                  )}
                  {isColumnVisible("locations") && (
                    <td className="px-4 py-3 text-sm">{formatLocation(plan.locationSupport)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {plans.length === 0 && (
        <div className="mt-8 text-center text-gray-500">
          No plans match your filters. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
}
