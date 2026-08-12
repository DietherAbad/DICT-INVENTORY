import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const SCROLL_LOCK_KEY = "__dictInventoryScrollLock";

export function lockBodyScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const body = document.body;
  if (!body?.style) return () => {};

  const existing = window[SCROLL_LOCK_KEY] || {
    count: 0,
    previousOverflow: body.style.overflow || "",
  };

  if (existing.count === 0) {
    existing.previousOverflow = body.style.overflow || "";
    body.style.overflow = "hidden";
  }

  existing.count += 1;
  window[SCROLL_LOCK_KEY] = existing;

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const current = window[SCROLL_LOCK_KEY];
    if (!current) return;

    current.count = Math.max(0, Number(current.count || 0) - 1);
    if (current.count === 0) {
      body.style.overflow = current.previousOverflow || "";
      delete window[SCROLL_LOCK_KEY];
      return;
    }

    window[SCROLL_LOCK_KEY] = current;
  };
}

const VARIANT_STYLES = {
  danger: {
    bar: "from-rose-500 via-rose-400 to-amber-300",
    chip: "bg-rose-500/10 text-rose-200 border-rose-300/30",
    glow: "bg-rose-500/25",
  },
  warning: {
    bar: "from-amber-400 via-orange-400 to-amber-300",
    chip: "bg-amber-500/10 text-amber-200 border-amber-300/30",
    glow: "bg-amber-400/25",
  },
  neutral: {
    bar: "from-blue-600 via-indigo-500 to-slate-500",
    chip: "bg-white/10 text-white/70 border-white/15",
    glow: "bg-blue-500/20",
  },
};

function ModalShell({
  open = true,
  title = "Confirm Action",
  subtitle = "Dialog",
  variant = "neutral",
  onClose,
  children,
  maxWidthClass = "max-w-lg",
  disableBackdropClose = false,
  showClose = true,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const releaseScrollLock = lockBodyScroll();

    dialogRef.current?.focus?.();

    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      releaseScrollLock();
    };
  }, [open]);

  if (!open) return null;

  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;

  const modal = (
    <div
      className="fixed inset-0 z-[1400] bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain isolate"
      onMouseDown={(e) => {
        if (disableBackdropClose) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="min-h-full w-full flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-shell-title"
          className={`w-full ${maxWidthClass} max-w-[94vw] rounded-3xl bg-white shadow-[0_40px_90px_rgba(2,6,23,0.55)] ring-1 ring-slate-900/10 outline-none flex flex-col min-h-0 max-h-[calc(100dvh-2rem)] sm:max-h-[92vh]`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="relative px-5 sm:px-6 py-4 shrink-0 border-b border-slate-800/60 bg-slate-950">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${variantStyle.bar}`} />
            <div className={`pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full ${variantStyle.glow} blur-3xl`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-center">
                {subtitle ? (
                  <span
                    className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${variantStyle.chip}`}
                  >
                    {subtitle}
                  </span>
                ) : null}
                <h3
                  id="modal-shell-title"
                  className="mt-3 text-base sm:text-lg font-semibold tracking-tight text-white"
                >
                  {title}
                </h3>
              </div>
              {showClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70 hover:border-white/30 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/20"
                  title="Close"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
          <div className="px-5 sm:px-6 py-5 flex-1 min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}

export default ModalShell;
