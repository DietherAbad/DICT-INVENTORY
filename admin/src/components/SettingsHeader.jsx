import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function SettingsHeader({ crumbs = [], title, subtitle, rightSlot }) {
  const location = useLocation();
  const currentPath = location?.pathname || "/";
  const parts = String(title || "").trim().split(/\s+/).filter(Boolean);
  const head = parts.slice(0, -1).join(" ");
  const tail = parts.slice(-1).join(" ");
  const compactLabel = crumbs.map((item) => item.label).join(" / ");

  return (
    <div className="space-y-4">
      {crumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="text-[7px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.3em]"
        >
          <div className="sm:hidden flex items-center text-slate-400 whitespace-nowrap overflow-hidden">
            <span className="truncate max-w-full">{compactLabel}</span>
          </div>

          <ol className="hidden sm:flex flex-nowrap items-center gap-2 text-slate-400 whitespace-nowrap overflow-hidden">
            {crumbs.map((item, idx) => {
              const isLast = idx === crumbs.length - 1;
              const isFirst = idx === 0;
              const label = item.label;
              const resolvedTo = item.to || currentPath;
              const content = item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className={`${isFirst ? "text-blue-600" : "text-slate-400"} font-semibold hover:text-blue-700`}
                >
                  {label}
                </button>
              ) : (
                <Link
                  to={resolvedTo}
                  className={`${isFirst ? "text-blue-600" : isLast ? "text-slate-500" : "text-slate-400"} font-semibold hover:text-blue-700`}
                >
                  {label}
                </Link>
              );

              return (
                <li key={`${label}-${idx}`} className="flex items-center gap-2">
                  {content}
                  {!isLast && <span className="text-slate-300">/</span>}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 sm:text-4xl">
            {head ? `${head} ` : ""}
            <span className="font-semibold">{tail}</span>
          </h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {rightSlot}
      </div>
    </div>
  );
}
