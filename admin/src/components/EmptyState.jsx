import React, { useId } from "react";

function EmptyState({ title, subtitle, hint, className = "" }) {
  const patternId = useId().replace(/:/g, "");
  return (
    <div
      className={`relative w-full max-w-xl mx-auto overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 px-6 py-10 text-center shadow-[0_22px_55px_rgba(15,23,42,0.08)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-sky-100/70 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 -right-12 h-40 w-40 rounded-full bg-emerald-100/70 blur-3xl"
        aria-hidden="true"
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
        viewBox="0 0 180 120"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={`dot-grid-${patternId}`}
            x="0"
            y="0"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1.5" cy="1.5" r="1.2" fill="#e2e8f0" />
          </pattern>
        </defs>
        <rect width="180" height="120" fill={`url(#dot-grid-${patternId})`} />
      </svg>
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-slate-200 bg-white shadow-md">
        <div className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full border border-sky-200 bg-sky-100 text-[10px] font-semibold text-sky-700">
          0
        </div>
        <svg className="h-11 w-11" viewBox="0 0 72 72" fill="none" aria-hidden="true">
          <rect
            x="10"
            y="14"
            width="36"
            height="26"
            rx="7"
            fill="#f1f5f9"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <path d="M10 24h36" stroke="#e2e8f0" strokeWidth="2" />
          <path
            d="M18 31h14"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M18 36h10"
            stroke="#cbd5e1"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="52"
            cy="44"
            r="10"
            fill="#e0f2fe"
            stroke="#7dd3fc"
            strokeWidth="2"
          />
          <path
            d="M58 50l6 6"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="mt-4 text-base sm:text-lg font-semibold text-slate-800">
        {title}
      </div>
      {subtitle ? (
        <div className="mt-1 text-xs sm:text-sm text-slate-500 max-w-[420px] mx-auto">
          {subtitle}
        </div>
      ) : null}
      {hint ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
