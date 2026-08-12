import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Breadcrumbs({ items = [], className = "" }) {
  const location = useLocation();
  const currentPath = location?.pathname || "/";
  if (!items.length) return null;
  const compactLabel = items.map((it) => it.label).join(" / ");

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-[7px] sm:text-[9px] md:text-[11px] uppercase tracking-[0.08em] sm:tracking-[0.22em] md:tracking-[0.35em] ${className}`}
    >
      <div className="sm:hidden flex items-center text-slate-400 whitespace-nowrap overflow-hidden">
        <span className="truncate max-w-full">{compactLabel}</span>
      </div>

      <ol className="hidden sm:flex flex-nowrap items-center gap-1 text-slate-400 whitespace-nowrap overflow-hidden">
        {items.map((it, idx) => {
          const isLast = idx === items.length - 1;
          const isFirst = idx === 0;
          const resolvedTo = it.to || currentPath;

          return (
            <li key={`${it.label}-${idx}`} className="flex items-center gap-1">
              {it.onClick ? (
                <button
                  type="button"
                  onClick={it.onClick}
                  className={`font-semibold transition ${
                    isFirst ? "text-blue-600 hover:text-blue-700" : "text-slate-400 hover:text-blue-600"
                  }`}
                >
                  {it.label}
                </button>
              ) : (
                <Link
                  to={resolvedTo}
                  className={`font-semibold transition ${
                    isFirst ? "text-blue-600 hover:text-blue-700" : isLast ? "text-slate-500 hover:text-blue-600" : "text-slate-400 hover:text-blue-600"
                  }`}
                >
                  {it.label}
                </Link>
              )}

              {!isLast && (
                <span className="text-slate-300 select-none hidden sm:inline">/</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
