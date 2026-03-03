"use client";

import { memo } from "react";
import type { TemplateCategory, CategoryInfo } from "../types";

// ============================================================
// Props
// ============================================================

interface TemplateFiltersProps {
  categories: CategoryInfo[];
  selectedCategory: TemplateCategory | null;
  onCategoryChange: (category: TemplateCategory | null) => void;
}

// ============================================================
// Component
// ============================================================

function TemplateFiltersComponent({
  categories,
  selectedCategory,
  onCategoryChange,
}: TemplateFiltersProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
      {/* All Templates */}
      <button
        onClick={() => onCategoryChange(null)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
          ${selectedCategory === null
            ? "bg-violet-500 text-white"
            : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
          }
        `}
      >
        <span>📋</span>
        <span>All</span>
        <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/10">
          {categories.reduce((acc, cat) => acc + (cat.count || 0), 0)}
        </span>
      </button>

      {/* Category Buttons */}
      {categories
        .filter(cat => (cat.count || 0) > 0)
        .map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${selectedCategory === category.id
                ? "bg-violet-500 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              }
            `}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
            {category.count !== undefined && category.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/10">
                {category.count}
              </span>
            )}
          </button>
        ))}
    </div>
  );
}

export const TemplateFilters = memo(TemplateFiltersComponent);
