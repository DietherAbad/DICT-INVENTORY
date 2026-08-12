// src/details/Checkform.jsx
import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode.react";
import DICT from "../assets/DICT.png";
import { BASE_URL, resolveServerUrl } from "../utils/config";
import { AuthContext } from "../context/AuthContext";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalShell, { lockBodyScroll } from "../components/ModalShell";

const strictModeFetchCache = new Map();
const getStrictModeFetchPromise = (key, fetcher) => {
  if (process.env.NODE_ENV === "production") return fetcher();
  const now = Date.now();
  const existing = strictModeFetchCache.get(key);
  if (existing && now - existing.startedAt < 5000) return existing.promise;
  const promise = fetcher();
  strictModeFetchCache.set(key, { promise, startedAt: now });
  promise.finally(() => {
    const current = strictModeFetchCache.get(key);
    if (current?.promise === promise) strictModeFetchCache.delete(key);
  });
  return promise;
};

const signatoryName = (person, fallback = "") =>
  (person && (person.username || person.name || person.email)) || fallback;
const signatoryRole = (person, fallback = "") =>
  (person && (person.position || person.role)) || fallback;

/* --------------------- Small bits --------------------- */
const Loading = () => (
  <div className="w-full px-4 py-12 sm:py-16">
    <div className="mx-auto w-full max-w-3xl rounded-[32px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
            Loading Checkform
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Preparing request details
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Fetching approvals, inventory status, and signatures.
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
          <span className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        </div>
      </div>

      <div className="mt-6">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 animate-pulse" />
        </div>
        <p className="mt-2 text-xs text-slate-500">Just a moment…</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 animate-pulse">
          <div className="h-3 w-28 rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-full rounded bg-slate-200" />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 animate-pulse">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-2/3 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-5/6 rounded bg-slate-200" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 animate-pulse">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-32 rounded-full bg-slate-200" />
          <div className="h-6 w-20 rounded-full bg-slate-200" />
        </div>
        <div className="mt-3 h-3 w-full rounded bg-slate-200" />
        <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
      </div>
    </div>
  </div>
);

const Toast = ({ show, type = "success", message, onClose }) => {
  if (!show) return null;

  const base =
    "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg";
  const variants = {
    success: "bg-emerald-600 text-white border-emerald-500/40",
    error: "bg-rose-600 text-white border-rose-500/40",
    info: "bg-slate-900 text-white border-slate-800/40",
  };
  const classes = `${base} ${variants[type] || variants.info}`;

  return (
    <div className="fixed top-4 right-4 z-[2000] max-w-[92vw] sm:max-w-md">
      <div role="status" aria-live="polite" className={classes}>
        <div className="flex-1">{message}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/20"
          aria-label="Close notification"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const EyeIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

/**
 * ✅ FIXED: Responsive, scrollable on small screens
 * - Uses overlay scroll container (overflow-y-auto)
 * - Uses dvh (dynamic viewport height) to avoid mobile browser UI issues
 * - Adds min-h-0 on flex containers so inner scrolling actually works
 */
const Modal = ({
  action,
  onConfirm,
  onCancel,
  onReasonChange,
  reason,
  confirmDisabled,
  isProcessing,
  title,
  subtitle,
  body,
  confirmLabel,
  variant,
}) => {
  const isDecline = action === "decline";
  const isCancelRequest = action === "cancel";
  const requiresReason = isDecline || isCancelRequest;
  const resolvedVariant = variant || (isDecline ? "danger" : isCancelRequest ? "warning" : "neutral");
  const headerClass =
    resolvedVariant === "danger"
      ? "bg-gradient-to-r from-red-600 to-rose-600"
      : resolvedVariant === "warning"
      ? "bg-gradient-to-r from-amber-500 to-amber-600"
      : "bg-gradient-to-r from-gray-900 to-slate-800";
  const resolvedTitle =
    title ||
    (isDecline
      ? "Confirm decline of this request?"
      : isCancelRequest
      ? "Cancel this request?"
      : "Confirm approval of this request?");
  const resolvedSubtitle = subtitle || "Confirm Action";
  const resolvedBody =
    body || "Please confirm your action. This may affect inventory records.";
  const resolvedConfirmLabel = confirmLabel || "Proceed";
  const dialogRef = useRef(null);
  const onCancelRef = useRef(onCancel);


  useEffect(() => {
    // lock scroll + focus for accessibility (on mount only)
    const releaseScrollLock = lockBodyScroll();

    dialogRef.current?.focus?.();

    const onKey = (e) => {
      if (e.key === "Escape") onCancelRef.current?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      releaseScrollLock();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[999] bg-slate-950/55 backdrop-blur-md overflow-y-auto overscroll-contain"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="min-h-full w-full flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          className="w-[380px] max-w-[94vw] rounded-2xl bg-white shadow-[0_18px_60px_rgba(2,6,23,0.28)] ring-1 ring-black/5 outline-none flex flex-col min-h-0 max-h-[calc(100dvh-2rem)] sm:max-h-[92vh]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`px-5 sm:px-6 py-4 shrink-0 ${headerClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                  {resolvedSubtitle}
                </p>
                <h3
                  id="confirm-modal-title"
                  className="mt-1 text-base sm:text-lg font-extrabold tracking-tight text-white"
                >
                  {resolvedTitle}
                </h3>
              </div>

              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-xl bg-white/15 px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/25"
                title="Close"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body (scrollable) */}
          <div className="px-5 sm:px-6 py-4 flex-1 min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch]">
            {requiresReason && (
              <div className="space-y-2.5">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Remarks (required)
                </label>
                <textarea
                  placeholder={
                    isCancelRequest
                      ? "Enter cancellation remarks"
                      : "Enter reason for decline"
                  }
                  className={`min-h-[92px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none ${
                    isCancelRequest
                      ? "focus:border-amber-300 focus:ring-4 focus:ring-amber-500/15"
                      : "focus:border-red-300 focus:ring-4 focus:ring-red-500/15"
                  }`}
                  value={reason}
                  onChange={onReasonChange}
                />
                <p className="text-[11px] text-gray-500">
                  This will be stored in the record and may affect inventory logs.
                </p>
              </div>
            )}

            {!requiresReason && (
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm">
                {resolvedBody}
              </div>
            )}

            {/* Footer buttons */}
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-4 ${
                  isDecline
                    ? "bg-red-600 hover:bg-red-700 focus:ring-red-500/20"
                    : isCancelRequest
                    ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20"
                    : resolvedVariant === "warning"
                    ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20"
                    : "bg-gray-900 hover:bg-black focus:ring-gray-900/20"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                onClick={onConfirm}
                disabled={!!confirmDisabled || !!isProcessing}
                title={confirmDisabled ? "Please complete required fields." : ""}
              >
                {isProcessing ? "Processing..." : resolvedConfirmLabel}
              </button>
              <button
                className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-400/20"
                onClick={onCancel}
                disabled={!!isProcessing}
              >
                Cancel
              </button>
            </div>

            <div className="mt-3 text-center text-[10px] text-gray-400">
              Tip: Press <b>Esc</b> to close.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --------------------- Edit Distribution Modal (SUPPLIES ONLY) --------------------- */
const EditDistributionModal = ({
  items,
  userRemarks,
  onQtyChange,
  onQtyBlur,
  onUserRemarksChange,
  onConfirm,
  onCancel,
  total,
  invalidCount,
  changePreviewLines,
  isProcessing,
  supplyOptions,
  supplySearch,
  onSupplySearchChange,
  selectedSupplyId,
  onSelectSupply,
  addQtyInput,
  onAddQtyChange,
  onAddItem,
  onRemoveItem,
  addError,
  supplyLoading,
}) => {
  const hasInvalid = invalidCount > 0;

  const preventBadKeys = (e) => {
    // Prevent exponential/negative/decimal input
    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
  };

  const stepQty = (idx, delta) => {
    const it = items?.[idx];
    const current = Math.floor(Number(it?._qtyInput ?? it?._qtyNum ?? 1));
    const next = Number.isFinite(current) ? Math.max(1, current + delta) : 1;
    onQtyChange(idx, String(next));
    onQtyBlur?.(idx);
  };

  const selectedSupply =
    (supplyOptions || []).find((opt) => opt?._id === selectedSupplyId) || null;

  return (
    <ModalShell
      open
      title="Edit Request (Supplies)"
      subtitle="Distribution Update"
      variant={hasInvalid ? "warning" : "neutral"}
      onClose={onCancel}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              For checking
            </span>
            {hasInvalid && (
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Fix {invalidCount} invalid
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            Adjust quantities (<b>min 1</b>) and update remarks. Saving will append an{" "}
            <b>[AUTO-LOG]</b> audit trail.
          </p>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Table */}
            <div className="lg:col-span-2">
              <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Add item to request</div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Step-by-step
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                      1
                    </span>
                    Find item
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm transition focus-within:border-slate-300 focus-within:bg-white focus-within:ring-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className="flex flex-1 items-center gap-2 px-3 py-2">
                        <svg
                          className="h-4 w-4 text-slate-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search item name or classification"
                          value={supplySearch}
                          onChange={onSupplySearchChange}
                          className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0"
                        />
                      </div>
                      <div className="h-px w-full bg-slate-200 sm:h-auto sm:w-px" />
                      <div className="flex items-center px-3 py-2">
                        <select
                          value={selectedSupplyId}
                          onChange={onSelectSupply}
                          className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none focus:outline-none focus:ring-0"
                        >
                          <option value="">Choose item...</option>
                          {supplyLoading ? (
                            <option value="" disabled>
                              Loading items...
                            </option>
                          ) : (supplyOptions || []).length ? (
                            supplyOptions.map((opt) => (
                              <option key={opt._id} value={opt._id}>
                                {opt.itemName || "Unnamed"} • {opt.classification || "Unclassified"}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>
                              No matches found
                            </option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Search filters the dropdown list instantly.
                  </p>

                  {selectedSupply ? (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                      <div className="font-semibold text-slate-700">
                        {selectedSupply.itemName || "Unnamed"}
                      </div>
                      Unit: {selectedSupply.unitofmeasure || "—"} • Stock No:{" "}
                      {selectedSupply.stock_no || "—"}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                          2
                        </span>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Quantity
                        </label>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        onKeyDown={preventBadKeys}
                        value={addQtyInput}
                        onChange={onAddQtyChange}
                        className="mt-2 w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-0"
                      />
                      <p className="mt-1 text-[10px] text-slate-400">Min 1</p>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Tip: Adding the same item merges quantities.
                    </div>
                  </div>

                  <div className="flex w-full justify-end sm:w-auto">
                    <button
                      type="button"
                      onClick={onAddItem}
                      disabled={!selectedSupplyId || supplyLoading}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Add to request
                    </button>
                  </div>
                </div>

                {addError ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                    {addError}
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                    <tr>
                      <th className="p-2.5 sm:p-3 text-left">
                        <div className="text-[11px] font-semibold uppercase tracking-wide">
                          Item
                        </div>
                      </th>
                      <th className="p-2.5 sm:p-3 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-wide">
                          Unit
                        </div>
                      </th>
                      <th className="p-2.5 sm:p-3 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-wide">
                          Cost
                        </div>
                      </th>
                      <th className="p-2.5 sm:p-3 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-wide">
                          Qty
                        </div>
                        <div className="text-[10px] font-medium text-gray-500">min 1</div>
                      </th>
                      <th className="p-2.5 sm:p-3 text-right">
                        <div className="text-[11px] font-semibold uppercase tracking-wide">
                          Line Total
                        </div>
                      </th>
                      <th className="p-2.5 sm:p-3 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-wide">
                          Remove
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((it, idx) => {
                      const qtyNum = Number(it._qtyNum || 0);
                      const cost = Number(it.cost || 0);
                      const lineTotal = qtyNum * cost;
                      const rid = it.returnId || it.return_id || it.returnID || "";
                      const invalid = !!it._qtyInvalid;
                      const zebra = idx % 2 === 0 ? "bg-white" : "bg-slate-50/40";

                      return (
                        <tr
                          key={`${rid || idx}-${idx}`}
                          className={`border-t transition-colors hover:bg-indigo-50/30 ${
                            invalid ? "bg-rose-50/60" : zebra
                          }`}
                        >
                          <td className="p-2.5 sm:p-3">
                            <div className="font-semibold text-gray-900">{it.itemName}</div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              Stock No: {it.stock_no ?? "—"} • Return ID: {rid || "—"}
                            </div>
                          </td>

                          <td className="p-2.5 sm:p-3 text-center text-gray-700">
                            {it.unitofmeasure || "—"}
                          </td>

                          <td className="p-2.5 sm:p-3 text-center text-gray-700">
                            {cost.toFixed(2)}
                          </td>

                          <td className="p-2.5 sm:p-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <div
                                className={`inline-flex items-stretch overflow-hidden rounded-xl border bg-white shadow-sm ${
                                  invalid ? "border-rose-300" : "border-gray-200"
                                }`}
                              >
                                <button
                                  type="button"
                                  className={`px-2.5 sm:px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-4 ${
                                    invalid
                                      ? "text-rose-700 hover:bg-rose-50 focus:ring-rose-500/15"
                                      : "text-gray-700 hover:bg-gray-50 focus:ring-indigo-500/15"
                                  }`}
                                  onClick={() => stepQty(idx, -1)}
                                  title="Decrease"
                                >
                                  −
                                </button>

                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="1"
                                  step="1"
                                  onKeyDown={preventBadKeys}
                                  className={`w-14 sm:w-16 border-x px-2 py-2 text-center text-sm outline-none focus:ring-4 ${
                                    invalid
                                      ? "border-rose-200 focus:border-rose-400 focus:ring-rose-500/15"
                                      : "border-gray-200 focus:border-indigo-300 focus:ring-indigo-500/15"
                                  }`}
                                  value={it._qtyInput}
                                  onChange={(e) => onQtyChange(idx, e.target.value)}
                                  onBlur={() => onQtyBlur(idx)}
                                  aria-label={`Quantity for ${it.itemName}`}
                                />

                                <button
                                  type="button"
                                  className={`px-2.5 sm:px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-4 ${
                                    invalid
                                      ? "text-rose-700 hover:bg-rose-50 focus:ring-rose-500/15"
                                      : "text-gray-700 hover:bg-gray-50 focus:ring-indigo-500/15"
                                  }`}
                                  onClick={() => stepQty(idx, 1)}
                                  title="Increase"
                                >
                                  +
                                </button>
                              </div>

                              {invalid ? (
                                <span className="text-[10px] font-semibold text-rose-600">
                                  Qty must be ≥ 1
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">&nbsp;</span>
                              )}
                            </div>
                          </td>

                          <td className="p-2.5 sm:p-3 text-right font-semibold text-gray-900">
                            {lineTotal.toFixed(2)}
                          </td>
                          <td className="p-2.5 sm:p-3 text-center">
                            <button
                              type="button"
                              onClick={() => onRemoveItem(idx)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Inline validation banner */}
              {hasInvalid && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Please fix <b>{invalidCount}</b> item(s) with invalid quantity (must be ≥ 1).
                </div>
              )}
            </div>

            {/* Side panel */}
            <div className="space-y-4">
              {/* Summary */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                    Summary
                  </p>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-800 ring-1 ring-indigo-200">
                    Review
                  </span>
                </div>

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-xs text-indigo-900/80">
                    Items: <b>{Array.isArray(items) ? items.length : 0}</b>
                    {hasInvalid ? (
                      <span className="ml-2 text-rose-700">
                        • Invalid: <b>{invalidCount}</b>
                      </span>
                    ) : (
                      <span className="ml-2 text-emerald-700">• All valid</span>
                    )}
                  </div>

                  <div className="text-lg font-extrabold text-indigo-950">
                    {Number(total || 0).toFixed(2)}
                  </div>
                </div>

                <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] text-indigo-900/80 ring-1 ring-indigo-100">
                  Tip: Use <b>±</b> for quick changes • Press <b>Esc</b> to close
                </div>
              </div>

              {/* Remarks */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    Remarks
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-700 ring-1 ring-gray-200">
                    Optional
                  </span>
                </div>

                <textarea
                  className="mt-2 min-h-[96px] w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/15"
                  value={userRemarks}
                  onChange={onUserRemarksChange}
                  placeholder="Add a note (e.g., clarification, correction reason, etc.)"
                />

                <p className="mt-2 text-[11px] text-gray-500">
                  Your remarks will be kept, and an auto change log will be appended when saving.
                </p>
              </div>

              {/* Change log preview */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                  Change log preview
                </p>
                <div className="mt-2 max-h-[150px] overflow-auto rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
                  {changePreviewLines?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {changePreviewLines.map((ln, i) => (
                        <li key={i}>{ln}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-500">No changes yet.</div>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  Saved remarks will include an <b>[AUTO-LOG]</b> section for traceability.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-200 bg-white/90 px-4 sm:px-5 py-3">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-gray-500">
              Saving will update quantities/remarks and append an audit trail.
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
              <button
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-400/20"
                onClick={onCancel}
                disabled={!!isProcessing}
              >
                Cancel
              </button>

              <button
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onConfirm}
                disabled={hasInvalid || !!isProcessing}
                title={
                  hasInvalid
                    ? "Fix invalid quantities first."
                    : isProcessing
                    ? "Saving changes..."
                    : "Save changes"
                }
              >
                {isProcessing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
/* --------------------- Main component --------------------- */
export const Checkform = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [actionBusy, setActionBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });

  const [state, setState] = useState({
    inventory: [],
    users: [],
    approvers: [], // Regional Director (for property, PTR approvals)
    approversAFD: [], // AFD (for distributions / approvals and releases & disposal)
    releasers: [],
    inventoryadmins: [], // Inventory Admin (for checking, issuance)
    usersById: {},
    error: null,
    loading: true,
  });

  const [usedURL, setUsedURL] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [reason, setReason] = useState("");
  const [declineSuccessOpen, setDeclineSuccessOpen] = useState(false);
  const [declineSuccessMessage, setDeclineSuccessMessage] = useState(
    "Successfully declined."
  );
  const loadEmailSetting = () => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem("systemSettings");
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      return parsed?.enable_email !== false;
    } catch {
      return true;
    }
  };
  const [systemSettings, setSystemSettings] = useState({
    enable_signed_download: true,
    enable_signed_upload: true,
    enable_email: loadEmailSetting(),
    document_signatories: {},
  });
  const [signedUploadFile, setSignedUploadFile] = useState(null);
  const [signedUploading, setSignedUploading] = useState(false);
  const [signedUploadError, setSignedUploadError] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [revertBusy, setRevertBusy] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyStatus, setNotifyStatus] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyText, setNotifyText] = useState("");
  const [supplyProjectsById, setSupplyProjectsById] = useState({});

  // Edit Distribution (SUPPLIES ONLY)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editUserRemarks, setEditUserRemarks] = useState("");
  const [editOrigItems, setEditOrigItems] = useState([]);
  const [editOrigRemarks, setEditOrigRemarks] = useState("");
  const [supplyOptions, setSupplyOptions] = useState([]);
  const [supplySearch, setSupplySearch] = useState("");
  const [supplyLoading, setSupplyLoading] = useState(false);
  const [selectedSupplyId, setSelectedSupplyId] = useState("");
  const [addQtyInput, setAddQtyInput] = useState("1");
  const [editAddError, setEditAddError] = useState("");

  /* ---------- helpers ---------- */
  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, msg });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 2600);
  };

  const openDeclineSuccessPopup = (message = "Successfully declined.") => {
    setDeclineSuccessMessage(message);
    setDeclineSuccessOpen(true);
  };

  const handleDeclineSuccessOk = () => {
    setDeclineSuccessOpen(false);
    window.location.reload();
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fdateDMY = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const looksLikeObjectId = (s) =>
    typeof s === "string" && /^[a-f\d]{24}$/i.test(s);

  const resolveUsername = (nameOrId, fallbackId, usersById) => {
    if (nameOrId && !looksLikeObjectId(nameOrId)) return nameOrId;

    if (nameOrId && looksLikeObjectId(nameOrId) && usersById[nameOrId]) {
      return usersById[nameOrId].username || usersById[nameOrId].email || nameOrId;
    }

    if (fallbackId && looksLikeObjectId(fallbackId) && usersById[fallbackId]) {
      return usersById[fallbackId].username || usersById[fallbackId].email || fallbackId;
    }

    if (fallbackId && !looksLikeObjectId(fallbackId)) return fallbackId;
    return nameOrId || "";
  };

  const resolveUserRecord = (nameOrId, fallbackId) => {
    const directKeys = [nameOrId, fallbackId].filter(Boolean).map(String);
    for (const key of directKeys) {
      if (looksLikeObjectId(key) && usersById[key]) return usersById[key];
    }

    const lookupValues = [nameOrId, fallbackId].filter(Boolean).map(String);
    for (const value of lookupValues) {
      const match = Array.isArray(users)
        ? users.find(
            (userItem) =>
              String(userItem?._id || "") === value ||
              String(userItem?.username || "") === value ||
              String(userItem?.email || "") === value
          )
        : null;
      if (match) return match;
    }

    return null;
  };

  const resolveUserRoleLabel = (record, fallback = "") =>
    record?.designation ||
    record?.office ||
    record?.position ||
    record?.role ||
    fallback;

  const sanitizeResolvedName = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    return looksLikeObjectId(normalized) ? "" : normalized;
  };

  const parseQtyInput = (val) => {
    // allow empty while typing; validate elsewhere
    if (val === "" || val === null || val === undefined) return { n: 0, invalid: true };
    const n = Math.floor(Number(val));
    if (!Number.isFinite(n)) return { n: 0, invalid: true };
    if (n < 1) return { n, invalid: true };
    return { n, invalid: false };
  };

  const clampQtyInput = (val) => {
    // used on blur: empty/0/invalid -> "1"
    const n = Math.floor(Number(val));
    if (!Number.isFinite(n) || n < 1) return "1";
    return String(n);
  };

  const computeQtyMap = (itemsArr) => {
    const map = {};
    (itemsArr || []).forEach((it) => {
      const rid = it.returnId || it.return_id || it.returnID;
      if (!rid) return;
      map[rid] = Number(it.quantity || 0);
    });
    return map;
  };

  useEffect(() => {
    if (!showEditModal) return undefined;
    let active = true;
    const controller = new AbortController();
    const searchValue = String(supplySearch || "").trim();

    const loadSupplies = async () => {
      setSupplyLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "20");
        if (searchValue) params.set("search", searchValue);

        const res = await fetch(
          `${BASE_URL}/inventoryofficesupply/inventory?${params.toString()}`,
          { signal: controller.signal, credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load supply items.");
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        if (!active) return;
        setSupplyOptions(list);
        if (!list.some((item) => item?._id === selectedSupplyId)) {
          setSelectedSupplyId(list[0]?._id || "");
        }
      } catch (err) {
        if (!active || err?.name === "AbortError") return;
        setSupplyOptions([]);
      } finally {
        if (active) setSupplyLoading(false);
      }
    };

    const timer = setTimeout(loadSupplies, 250);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [showEditModal, supplySearch]);

  const buildDocSnapshot = (source, overrides = {}) => {
    const base = source ? JSON.parse(JSON.stringify(source)) : {};
    delete base.history;
    return {
      ...base,
      ...overrides,
      doc_generated_at: new Date().toISOString(),
    };
  };

  const buildStateSignature = (snap) => {
    if (!snap) return "";
    const picked = {
      status: snap.status ?? null,
      requeststatus: snap.requeststatus ?? null,
      issued_to: snap.issued_to ?? null,
      current_holder: snap.current_holder ?? null,
      transfered_to: snap.transfered_to ?? null,
      transfer_type: snap.transfer_type ?? snap.transferType ?? snap.transfer_mode ?? null,
      transfer_target: snap.transfer_target ?? snap.transfer_to ?? null,
      transfertype: snap.transfertype ?? null,
      date_requested: snap.date_requested ?? null,
      date_approved: snap.date_approved ?? null,
      date_released: snap.date_released ?? null,
      date_received: snap.date_received ?? null,
      date_checked: snap.date_checked ?? null,
      date_issued: snap.date_issued ?? null,
      disposal_reason: snap.disposal_reason ?? null,
      disposal_notes: snap.disposal_notes ?? null,
    };
    return JSON.stringify(picked);
  };


  /* ---------- settings ---------- */
  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`);
        if (!res.ok) return null;
        const data = await res.json();
        return data && typeof data === "object" ? data : null;
      } catch {
        return null;
      }
    };

    getStrictModeFetchPromise("checkform-settings", loadSettings).then((data) => {
      if (cancelled || !data) return;
      setSystemSettings((prev) => ({
        ...prev,
        enable_signed_download: data.enable_signed_download ?? prev.enable_signed_download,
        enable_signed_upload: data.enable_signed_upload ?? prev.enable_signed_upload,
        enable_email: data.enable_email ?? prev.enable_email,
        document_signatories:
          data.document_signatories ?? prev.document_signatories,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      const next = event?.detail?.enable_email;
      if (typeof next === "boolean") {
        setSystemSettings((prev) => ({ ...prev, enable_email: next }));
      }
    };
    window.addEventListener("settings:email", handler);
    return () => window.removeEventListener("settings:email", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      if (!event?.detail || typeof event.detail !== "object") return;
      setSystemSettings((prev) => ({
        ...prev,
        document_signatories: event.detail,
      }));
    };
    window.addEventListener("settings:signatories", handler);
    return () => window.removeEventListener("settings:signatories", handler);
  }, []);

  /* ---------- data fetch ---------- */
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        if (!user) {
          throw new Error("Not authenticated");
        }

        const urls = [
          `${BASE_URL}/inventoryofficeequipment/inventory`,
          `${BASE_URL}/distribute/distributions`,
          `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
          `${BASE_URL}/inventoryofficeICTequipment/inventory`,
          `${BASE_URL}/inventoryofficemotorandvehicle/inventory`,
          `${BASE_URL}/inventoryofficeLandandBuilding/inventory`,
        ];

        const inventoryResponses = await Promise.all(
          urls.map((url) =>
            fetch(url, {
              credentials: "include",
              silentStatuses: [403, 404],
              suppressErrorToast: true,
            }).catch(() => null)
          )
        );

        let fetchedItems = [];
        let foundURL = "";

        for (let i = 0; i < inventoryResponses.length; i++) {
          const resp = inventoryResponses[i];
          if (!resp || !resp.ok) continue;
          const data = await resp.json();
          if (Array.isArray(data) && data.some((it) => it?._id === id)) {
            fetchedItems = data.filter((it) => it?._id === id);
            foundURL = urls[i];
            break;
          }
        }

        if (fetchedItems.length === 0) {
          throw new Error("Item not found in any inventory.");
        }

        const usersResponse = await fetch(`${BASE_URL}/users/directory`, {
          credentials: "include",
          silentStatuses: [403],
          suppressErrorToast: true,
        });
        const users = usersResponse.ok ? await usersResponse.json() : [];
        const usersById = users.reduce((acc, u) => {
          if (u && u._id) acc[u._id] = u;
          return acc;
        }, {});

        // Signatories
        const regionalDirector = users.find(
          (u) => (u.role || "").toLowerCase() === "regional director"
        );
        const afdUser = users.find((u) => (u.role || "").toLowerCase() === "afd");
        const inventoryadmin = users.find(
          (u) => (u.role || "").toLowerCase() === "inventory admin"
        );
        const releaser = users.find((u) => u.username === fetchedItems[0]?.issued_to);

        return {
          inventory: fetchedItems,
          users,
          approvers: regionalDirector ? [regionalDirector] : [],
          approversAFD: afdUser ? [afdUser] : [],
          releasers: releaser ? [releaser] : [],
          inventoryadmins: inventoryadmin ? [inventoryadmin] : [],
          usersById,
          foundURL,
        };
      } catch (err) {
        throw err;
      }
    };

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const cacheKey = `checkform:${id || "unknown"}`;

    getStrictModeFetchPromise(cacheKey, fetchData)
      .then((data) => {
        if (cancelled || !data) return;
        setState({
          inventory: data.inventory,
          users: data.users,
          approvers: data.approvers,
          approversAFD: data.approversAFD,
          releasers: data.releasers,
          inventoryadmins: data.inventoryadmins,
          usersById: data.usersById,
          error: null,
          loading: false,
        });
        setUsedURL(data.foundURL || "");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error fetching data:", err);
        setState((prev) => ({ ...prev, error: err, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [user, id]);

  /* ---------- convenience pulls ---------- */
  const {
    inventory,
    users,
    approvers,
    approversAFD,
    releasers,
    inventoryadmins,
    usersById,
    error,
    loading,
  } = state;

  const inv = inventory[0] || {};
  const requestStatus = inv?.requeststatus || "";
  const requestStatusLower = String(requestStatus || "").toLowerCase();
  const finalstatus = inv?.status || "";
  const finalStatusLower = String(finalstatus || "").toLowerCase().trim();
  const isCancelledRequest =
    requestStatusLower.trim() === "cancelled" || finalStatusLower === "cancelled";

  // RD / AFD / Admins
  const approver = approvers[0] || null; // RD
  const afd = approversAFD[0] || null; // AFD
  const invAdmin = inventoryadmins[0] || null; // Inventory Admin
  const documentSignatories = systemSettings?.document_signatories || {};
  const configuredUser = (documentKey, slotKey, fallback) => {
    const configuredId = documentSignatories?.[documentKey]?.[slotKey];
    return (configuredId && usersById?.[configuredId]) || fallback || null;
  };
  const risChecker = configuredUser("ris", "checker_id", invAdmin);
  const risApprover = configuredUser("ris", "approver_id", afd);
  const ptrApprover = configuredUser("ptr", "approver_id", approver);
  const ptrReleaser = configuredUser("ptr", "releaser_id", invAdmin);
  const icsIssuanceApprover = configuredUser(
    "ics_issuance",
    "approver_id",
    invAdmin
  );
  const icsTransferApprover = configuredUser(
    "ics_transfer",
    "approver_id",
    invAdmin
  );
  const rdRoleLabel = "Regional Director";
  const afdRoleLabel = "AFD";
  const invAdminRoleLabel = "Inventory Admin";
  const invAdminName =
    (invAdmin && (invAdmin.username || invAdmin.name)) || invAdminRoleLabel;
  const invAdminRole =
    (invAdmin && (invAdmin.position || invAdmin.role)) || invAdminRoleLabel;
  const afdName = (afd && (afd.username || afd.name)) || afdRoleLabel;
  const afdRole = (afd && (afd.position || afd.role)) || afdRoleLabel;
  const approverName =
    (approver && (approver.username || approver.name)) || rdRoleLabel;
  const approverRole =
    (approver && (approver.position || approver.role)) || rdRoleLabel;

  const latestPreviousStateSnapshot = useMemo(() => {
    if (!inv) return false;
    const history = Array.isArray(inv?.history) ? inv.history : [];
    if (!history.length) return null;
    const currentSig = buildStateSignature(inv);
    const latest = history[history.length - 1];
    const latestRevertIndexRaw = latest?.revert_to_history_index;
    const latestRevertIndex = Number(latestRevertIndexRaw);
    const latestIsCurrentRevert =
      latest?.reason === "Reverted to previous state" &&
      latestRevertIndexRaw !== null &&
      latestRevertIndexRaw !== undefined &&
      Number.isInteger(latestRevertIndex) &&
      latestRevertIndex >= 0 &&
      buildStateSignature(latest?.doc_snapshot) === currentSig;
    const startIndex = latestIsCurrentRevert
      ? Math.min(latestRevertIndex - 1, history.length - 1)
      : history.length - 1;
    for (let i = startIndex; i >= 0; i -= 1) {
      const snap = history[i]?.doc_snapshot;
      if (!snap) continue;
      if (buildStateSignature(snap) !== currentSig) return snap;
    }
    return null;
  }, [inv]);
  const hasPreviousStateSnapshot = Boolean(latestPreviousStateSnapshot);

  const isDistribution =
    (usedURL || "").includes("/distribute") ||
    (Array.isArray(inv?.items) && inv.items.length > 0);
  const isSupplyDisposal = isDistribution
    ? String(inv?.request_type || "").toLowerCase().trim() === "disposal" ||
      String(inv?.status || "").toLowerCase().includes("disposal") ||
      String(inv?.requeststatus || "").toLowerCase().includes("disposal") ||
      !!inv?.disposal_reason ||
      !!inv?.disposal_notes
    : false;
  const distributionItemIds = useMemo(() => {
    if (!Array.isArray(inv?.items)) return [];
    return Array.from(
      new Set(
        inv.items
          .map((item) => item?.returnId || item?.return_id || item?.returnID)
          .filter(Boolean)
          .map(String)
      )
    );
  }, [inv?.items]);
  const distributionItemIdsKey = distributionItemIds.join("|");

  useEffect(() => {
    let cancelled = false;

    const loadSupplyProjects = async () => {
      if (!isDistribution || !distributionItemIds.length) {
        setSupplyProjectsById({});
        return;
      }

      const entries = await Promise.all(
        distributionItemIds.map(async (itemId) => {
          try {
            const res = await fetch(
              `${BASE_URL}/inventoryofficesupply/inventory/${itemId}`,
              { credentials: "include" }
            );
            if (!res.ok) return null;
            const data = await res.json();
            const project = data?.project || data?.data?.project || "";
            return project ? [itemId, project] : null;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      setSupplyProjectsById(
        entries.reduce((acc, entry) => {
          if (entry) acc[entry[0]] = entry[1];
          return acc;
        }, {})
      );
    };

    loadSupplyProjects();

    return () => {
      cancelled = true;
    };
  }, [distributionItemIdsKey, isDistribution]);

  const isFirstStepRequest = isDistribution
    ? requestStatusLower === "for checking"
    : requestStatusLower === "for approval";

  // Collection flags for PTR logic
  const isOfficeEquipment = (usedURL || "").includes("/inventoryofficeequipment/");
  const isICTEquipment = (usedURL || "").includes("/inventoryofficeICTequipment/");
  const isFurniture = (usedURL || "").includes(
    "/inventoryofficefurnitureandfixture/"
  );
  const isMotor = (usedURL || "").includes("/inventoryofficemotorandvehicle/");
  const isLand = (usedURL || "").includes("/inventoryofficeLandandBuilding/");

  const isPropertyPTR =
    !isDistribution &&
    (isOfficeEquipment || isICTEquipment || isFurniture || isMotor || isLand);

  const isSeManagedProperty =
    !isDistribution &&
    (isOfficeEquipment || isICTEquipment || isFurniture) &&
    String(inv?.asset_type || "").trim().toUpperCase() === "SE";

  const shouldUpdateCurrentHolder = isPropertyPTR;

  const getIssuanceDocType = (record = inv) =>
    record?.par_no ||
    record?.PAR_no ||
    String(record?.asset_type || "").trim().toUpperCase() === "PPE"
      ? "PAR"
      : "ICS";

  const getDocTypeFromStatus = (
    statusValue,
    { returnToIssuedTransfer = false } = {}
  ) => {
    const status = String(statusValue || "").toLowerCase();
    if (returnToIssuedTransfer) return isSeManagedProperty ? "ICS" : "PTR";
    if (status.includes("issue")) return getIssuanceDocType();
    if (status.includes("transfer")) return isSeManagedProperty ? "ICS" : "PTR";
    if (status.includes("disposal")) return "PDR";
    if (status.includes("return to inventory")) return "RTI";
    return null;
  };

  const isSameTransaction = (snap, currentInv) => {
    if (!snap || !currentInv) return false;
    const invReq = currentInv?.date_requested;
    const snapReq = snap?.date_requested;
    if (invReq || snapReq) return String(invReq || "") === String(snapReq || "");
    const invIssued = currentInv?.date_issued;
    const snapIssued = snap?.date_issued;
    if (invIssued || snapIssued) return String(invIssued || "") === String(snapIssued || "");
    return false;
  };

  const getTxnStartAt = (currentInv) => {
    const value =
      currentInv?.date_requested ||
      currentInv?.date_checked ||
      currentInv?.date_approved ||
      currentInv?.date_released ||
      currentInv?.date_received ||
      currentInv?.date_issued ||
      null;
    return value ? new Date(value) : null;
  };

  const isSignedFileForCurrentTxn = (signed, currentInv) => {
    if (!signed?.url) return false;
    if (!signed?.uploaded_at) return true;
    const signedAt = new Date(signed.uploaded_at);
    if (Number.isNaN(signedAt.getTime())) return false;
    const txnStart = getTxnStartAt(currentInv);
    if (!txnStart || Number.isNaN(txnStart.getTime())) return true;
    return signedAt.getTime() >= txnStart.getTime();
  };

  const getLatestSignedFile = (history, docType, currentInv) => {
    if (!docType || !Array.isArray(history)) return null;
    const matches = history.filter(
      (h) =>
        String(h?.doc_type || "").toUpperCase() === docType &&
        h?.signed_file?.url &&
        isSameTransaction(h?.doc_snapshot, currentInv)
    );
    if (!matches.length) return null;
    matches.sort((a, b) => {
      const ad = new Date(a?.signed_file?.uploaded_at || a?.to || 0).getTime();
      const bd = new Date(b?.signed_file?.uploaded_at || b?.to || 0).getTime();
      return bd - ad;
    });
    return matches[0].signed_file || null;
  };

  const statusLower = String(finalstatus || "").toLowerCase();
  const isPendingDoc =
    statusLower.includes("for issue") ||
    statusLower.includes("for transfer") ||
    statusLower.includes("for disposal") ||
    statusLower.includes("return to inventory");
  const signedUploadUrl = isDistribution
    ? `${BASE_URL}/distribute/distributions/${inv?._id}/signed-file`
    : isOfficeEquipment
    ? `${BASE_URL}/inventoryofficeequipment/inventory/${inv?._id}/signed-file`
    : isICTEquipment
    ? `${BASE_URL}/inventoryofficeICTequipment/inventory/${inv?._id}/signed-file`
    : isFurniture
    ? `${BASE_URL}/inventoryofficefurnitureandfixture/inventory/${inv?._id}/signed-file`
    : isMotor
    ? `${BASE_URL}/inventoryofficemotorandvehicle/inventory/${inv?._id}/signed-file`
    : isLand
    ? `${BASE_URL}/inventoryofficeLandandBuilding/inventory/${inv?._id}/signed-file`
    : "";

  // NEW: Target agency for "Transfer to other agency"
  const otherAgencyTarget =
    inv?.transfer_target ||
    inv?.transfer_to ||
    inv?.transfer_to_agency ||
    inv?.transfered_to_agency ||
    inv?.agency_to ||
    inv?.receiving_agency ||
    "";

  const transferTypeRaw =
    (inv?.transfer_type || inv?.transferType || inv?.transfer_mode || "") + "";
  const transferType = transferTypeRaw.trim();

  const isDisposal =
    finalstatus === "For Disposal" ||
    finalstatus === "Disposed" ||
    statusLower === "for disposal" ||
    !!inv?.disposal_reason ||
    !!inv?.disposal_notes;

  const isOtherAgencyTransfer =
    !isDisposal &&
    (/\bother\s*agency\b/i.test(transferType) ||
      (!!otherAgencyTarget && otherAgencyTarget.trim() !== ""));
  const issuedToRef = String(inv?.issued_to_id ?? inv?.issued_to ?? "");
  const transferToRef = String(
    inv?.transfered_to_id ??
      inv?.transferedto_id ??
      inv?.transferred_to_id ??
      inv?.transfered_to ??
      inv?.transferedto ??
      inv?.transferred_to ??
      ""
  );
  const isReturnToIssuedTransfer =
    !isDistribution &&
    !isDisposal &&
    !isOtherAgencyTransfer &&
    ((issuedToRef && transferToRef && issuedToRef === transferToRef) ||
      /return\s*to\s*issued/i.test(transferType));
  const isIssue =
    !isDistribution &&
    !isDisposal &&
    !isOtherAgencyTransfer &&
    !isReturnToIssuedTransfer &&
    (statusLower.includes("for issue") || statusLower === "issued");
  const issuanceDocType = getIssuanceDocType(inv);
  const isParIssue = isIssue && issuanceDocType === "PAR";
  const issuanceDocumentName = isParIssue
    ? "Property Acknowledgement Receipt (PAR)"
    : "Inventory Custodian Slip (ICS)";
  const isReturnToInventory =
    !isDistribution &&
    !isDisposal &&
    !isOtherAgencyTransfer &&
    statusLower.includes("return to inventory");
  const isSeTransfer =
    isSeManagedProperty &&
    !isDisposal &&
    !isIssue &&
    !isReturnToInventory;

  const currentDocType = isDistribution
    ? null
    : getDocTypeFromStatus(finalstatus, { returnToIssuedTransfer: isReturnToIssuedTransfer });
  const shouldUseHistorySigned = !isDistribution && !inv?.signed_file && !isPendingDoc;
  const signedFile = isDistribution
    ? inv?.signed_file || null
    : (isSignedFileForCurrentTxn(inv?.signed_file, inv) ? inv?.signed_file : null) ||
      (shouldUseHistorySigned ? getLatestSignedFile(inv?.history, currentDocType, inv) : null);
  const hasSignedFile = Boolean(signedFile?.url);
  const canDownloadSigned = hasSignedFile && systemSettings.enable_signed_download;

  const distributedRecipientRecord = resolveUserRecord(
    inv?.distributedto,
    inv?.distributedto_is
  );

  const transferedToRecord = resolveUserRecord(
    inv?.transfered_to ?? inv?.transferedto ?? inv?.transferred_to,
    inv?.transfered_to_id ?? inv?.transferedto_id ?? inv?.transferred_to_id
  );

  const issuedToRecord = resolveUserRecord(inv?.issued_to, inv?.issued_to_id);

  const currentHolderRecord = resolveUserRecord(
    inv?.current_holder,
    inv?.current_holder_id ?? inv?.current_holder_is
  );

  const recipientDistributedNameResolved = sanitizeResolvedName(
    resolveUsername(inv?.distributedto, inv?.distributedto_is, usersById)
  );

  const transferedToResolved = sanitizeResolvedName(
    resolveUsername(
      inv?.transfered_to ?? inv?.transferedto ?? inv?.transferred_to,
      inv?.transfered_to_id ?? inv?.transferedto_id ?? inv?.transferred_to_id,
      usersById
    )
  );

  const issuedToResolved = sanitizeResolvedName(
    resolveUsername(inv?.issued_to, inv?.issued_to_id, usersById)
  );

  const currentHolderResolved = sanitizeResolvedName(
    resolveUsername(
      inv?.current_holder,
      inv?.current_holder_id ?? inv?.current_holder_is,
      usersById
    )
  );

  const issueRecipientName = issuedToResolved || currentHolderResolved || "";
  const issueRecipientRole = resolveUserRoleLabel(
    issuedToRecord,
    "End-User / Recipient"
  );
  const currentHolderRole = resolveUserRoleLabel(
    currentHolderRecord,
    issueRecipientRole || "End-User / Recipient"
  );
  const transferRecipientName = isOtherAgencyTransfer
    ? otherAgencyTarget || transferedToResolved || ""
    : transferedToResolved || "";
  const transferRecipientRole = isOtherAgencyTransfer
    ? "Receiving Agency"
    : resolveUserRoleLabel(transferedToRecord, "End-User / Recipient");
  const isRequestReceived = requestStatusLower === "received";
  const transferRecipientDisplayName =
    transferRecipientName ||
    (isRequestReceived ? currentHolderResolved || issuedToResolved || "" : "");
  const transferRecipientDisplayRole = isOtherAgencyTransfer
    ? "Receiving Agency"
    : transferRecipientName
    ? transferRecipientRole
    : isRequestReceived
    ? currentHolderRole || issueRecipientRole
    : transferRecipientRole;
  const distributionRecipientRole = resolveUserRoleLabel(
    distributedRecipientRecord,
    inv?.office || "End-User / Recipient"
  );
  const previousIssuedToResolved = sanitizeResolvedName(
    resolveUsername(
      latestPreviousStateSnapshot?.issued_to,
      latestPreviousStateSnapshot?.issued_to_id,
      usersById
    )
  );
  const previousCurrentHolderResolved = sanitizeResolvedName(
    resolveUsername(
      latestPreviousStateSnapshot?.current_holder,
      latestPreviousStateSnapshot?.current_holder_id,
      usersById
    )
  );
  const previousTransferedToResolved = sanitizeResolvedName(
    resolveUsername(
      latestPreviousStateSnapshot?.transfered_to ??
        latestPreviousStateSnapshot?.transferedto ??
        latestPreviousStateSnapshot?.transferred_to,
      latestPreviousStateSnapshot?.transfered_to_id ??
        latestPreviousStateSnapshot?.transferedto_id ??
        latestPreviousStateSnapshot?.transferred_to_id,
      usersById
    )
  );
  const issuedToSummaryName = issuedToResolved || "";
  const transferredToSummaryName = isOtherAgencyTransfer
    ? otherAgencyTarget || transferRecipientName || ""
    : transferRecipientName || previousTransferedToResolved || "";
  const isTransferTrail =
    !isDisposal && !isIssue && !isReturnToInventory && !isDistribution;
  const transferorLiveFallback =
    currentHolderResolved && currentHolderResolved !== transferredToSummaryName
      ? currentHolderResolved
      : "";
  const transferorSummaryName = isTransferTrail
    ? previousCurrentHolderResolved ||
      previousIssuedToResolved ||
      issuedToSummaryName ||
      transferorLiveFallback ||
      ""
    : "";
  const accountableOwnerName = isReturnToInventory
    ? isRequestReceived
      ? invAdminName || currentHolderResolved || issuedToResolved || ""
      : currentHolderResolved || issuedToResolved || transferredToSummaryName || ""
    : statusLower === "transferred"
    ? transferredToSummaryName || currentHolderResolved || issuedToResolved || ""
    : currentHolderResolved || issuedToResolved || transferredToSummaryName || "";
  const recipientHeadingLabel = isDisposal
    ? ""
    : isOtherAgencyTransfer
    ? isRequestReceived
      ? "Transferred to"
      : "Pending transfer to"
    : isReturnToInventory
    ? isRequestReceived
      ? "Returned to"
      : "Return to"
    : isIssue
    ? isRequestReceived
      ? "Issued to"
      : "Issue to"
    : isRequestReceived
    ? "Transferred to"
    : "Transfer to";

  const recipientName = isDistribution
    ? recipientDistributedNameResolved
    : isReturnToInventory
    ? invAdminName
    : isIssue
    ? issueRecipientName
    : isOtherAgencyTransfer
    ? otherAgencyTarget || ""
    : transferRecipientDisplayName;

  // Current accountable (FROM) and pending transfer TO for PTR
  const fromAccountable = isPropertyPTR
    ? currentHolderResolved || issuedToResolved || transferedToResolved || "—"
    : "";

  const toAccountable = isPropertyPTR
    ? isDisposal
      ? ""
      : isIssue
      ? issueRecipientName || "________________"
      : isReturnToInventory
      ? invAdminName
      : isOtherAgencyTransfer
      ? otherAgencyTarget || "________________"
      : transferRecipientDisplayName || "________________"
    : "";

  const resolveUserEmail = (value, fallbackId) => {
    if (!value && !fallbackId) return "";
    const tryIds = [value, fallbackId].filter(Boolean).map(String);
    for (const id of tryIds) {
      if (usersById[id]?.email) return usersById[id].email;
    }
    if (typeof value === "string" && value.includes("@")) return value;
    if (typeof value === "string" && Array.isArray(users)) {
      const u =
        users.find((x) => x?._id === value) ||
        users.find((x) => x?.username === value) ||
        users.find((x) => x?.email === value);
      if (u?.email) return u.email;
    }
    return "";
  };

  /* ---------- access control ---------- */
  const meId = user?.data?._id || "";
  const meRole = user?.data?._role || user?.data?.role || "";
  const meUsername = user?.data?.username || "";
  const meEmail = user?.data?.email || "";

  const normalizedRole = (meRole || "").toLowerCase().trim();
  const isSuperAdminRole = normalizedRole === "super admin" || normalizedRole === "superadmin";
  const isRecipientForDistribution =
    (inv?.distributedto_is && meId === inv.distributedto_is) ||
    (recipientDistributedNameResolved &&
      recipientDistributedNameResolved === meUsername);

  const matchesRecipientTarget = (values = []) => {
    const normalizedValues = values
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map((value) => String(value));

    return (
      (!!meId && normalizedValues.includes(String(meId))) ||
      (!!meUsername && normalizedValues.includes(String(meUsername))) ||
      (!!meEmail && normalizedValues.includes(String(meEmail)))
    );
  };

  const issueRecipientMatches = matchesRecipientTarget([
    inv?.issued_to_id,
    inv?.issued_to_is,
    inv?.issued_to,
    issueRecipientName,
  ]);

  const transferRecipientMatches = matchesRecipientTarget([
    inv?.transfered_to_id,
    inv?.transferedto_id,
    inv?.transferred_to_id,
    inv?.transfered_to_is,
    inv?.transferedto_is,
    inv?.transferred_to_is,
    inv?.transfered_to,
    inv?.transferedto,
    inv?.transferred_to,
    transferedToResolved,
  ]);

  const requestorMatches = matchesRecipientTarget([
    inv?.requested_by_id,
    inv?.requestedby_id,
    inv?.requestor_id,
    inv?.requested_by,
    inv?.requestedby,
    inv?.requestor,
    ...(isDistribution
      ? [inv?.distributedto_is, inv?.distributedto, recipientDistributedNameResolved]
      : []),
  ]);

  const propertyOriginatorMatches = matchesRecipientTarget([
    inv?.requested_by_id,
    inv?.requestedby_id,
    inv?.requestor_id,
    inv?.requested_by,
    inv?.requestedby,
    inv?.requestor,
    inv?.current_holder_id,
    inv?.current_holder_is,
    inv?.current_holder,
    currentHolderResolved,
    inv?.issued_to_id,
    inv?.issued_to_is,
    inv?.issued_to,
    issuedToResolved,
  ]);

  const propertyCancelActorMatches =
    requestorMatches ||
    propertyOriginatorMatches ||
    (isIssue && (issueRecipientMatches || isSuperAdminRole || normalizedRole === "inventory admin" || normalizedRole === "inventoryadmin"));

  const canCancelRequest =
    !isCancelledRequest &&
    requestStatusLower.trim() !== "declined" &&
    requestStatusLower.trim() !== "received" &&
    ((isDistribution &&
      requestorMatches &&
      !isSupplyDisposal &&
      requestStatusLower.trim() === "for checking") ||
      (isDistribution &&
        requestorMatches &&
        isSupplyDisposal &&
        requestStatusLower.trim() === "for approval") ||
      (!isDistribution &&
        propertyCancelActorMatches &&
        requestStatusLower.trim() === "for approval"));

  let canAct = false;
  let canApproveNow = false;
  let canDeclineNow = false;

  if (isSuperAdminRole && !isSupplyDisposal) {
    canAct = requestStatus !== "Declined" && requestStatus !== "Received";
    canApproveNow = canAct;
    canDeclineNow = canAct;
  } else if (isDistribution) {
    // SUPPLY / DISTRIBUTION FLOW
    if (isSupplyDisposal) {
      if (
        requestStatus === "For Approval" &&
        ((afd && meId === afd._id) || isSuperAdminRole)
      ) {
        canAct = canApproveNow = canDeclineNow = true;
      }
    } else if (requestStatus === "For checking" && risChecker && meId === risChecker._id) {
      // Inventory Admin checks distributions
      canAct = canApproveNow = canDeclineNow = true;
    } else if (requestStatus === "For Approval" && risApprover && meId === risApprover._id) {
      // AFD approves distributions
      canAct = canApproveNow = canDeclineNow = true;
    } else if (requestStatus === "Approved" && isRecipientForDistribution) {
      // Recipient marks as received
      canAct = canApproveNow = canDeclineNow = true;
    }
  } else {
    // PROPERTY (PTR & DISPOSAL)
    if (isDisposal) {
      // Disposal: Regional Director first, then AFD (Super Admin can override)
      if (requestStatus === "For Approval" && ((approver && meId === approver._id) || isSuperAdminRole)) {
        canAct = canApproveNow = canDeclineNow = true;
      } else if (
        requestStatus === "For Approval - AFD" &&
        ((afd && meId === afd._id) || isSuperAdminRole)
      ) {
        canAct = canApproveNow = canDeclineNow = true;
      }
    } else if (isIssue) {
      if (
        requestStatus === "For Approval" &&
        ((icsIssuanceApprover && meId === icsIssuanceApprover._id) || isSuperAdminRole)
      ) {
        canAct = canApproveNow = canDeclineNow = true;
      } else if (
        (requestStatus === "To receive" || requestStatus === "") &&
        issueRecipientMatches
      ) {
        canAct = canApproveNow = canDeclineNow = true;
      }
    } else if (isReturnToInventory) {
      if (
        requestStatus === "For Approval" &&
        ((approver && meId === approver._id) || isSuperAdminRole)
      ) {
        canAct = canApproveNow = canDeclineNow = true;
      } else if (
        (requestStatus === "To receive" || requestStatus === "") &&
        ((invAdmin && meId === invAdmin._id) || isSuperAdminRole)
      ) {
        canAct = canApproveNow = canDeclineNow = true;
      }
    } else {
      // Property transfers (DICT user / other agency)
      if (
        isSeTransfer &&
        ["For Approval", "For Release"].includes(requestStatus) &&
        ((icsTransferApprover && meId === icsTransferApprover._id) || isSuperAdminRole)
      ) {
        // Inventory Admin is the sole approver for SE transfers.
        canAct = canApproveNow = canDeclineNow = true;
      } else if (
        !isSeTransfer &&
        requestStatus === "For Approval" &&
        ptrApprover &&
        meId === ptrApprover._id
      ) {
        // RD approves PTR
        canAct = canApproveNow = canDeclineNow = true;
      } else if (
        !isSeTransfer &&
        requestStatus === "For Release" &&
        ptrReleaser &&
        meId === ptrReleaser._id
      ) {
        // Inventory Admin handles release
        canAct = canApproveNow = canDeclineNow = true;
      } else if (
        (requestStatus === "To receive" || requestStatus === "") &&
        transferRecipientMatches &&
        !isOtherAgencyTransfer
      ) {
        // Recipient marks PTR as received (DICT internal only, NOT other agency)
        canAct = canApproveNow = canDeclineNow = true;
      }
    }
  }

  const adminApprovalStage =
    isSuperAdminRole &&
    !isSupplyDisposal &&
    ["For checking", "For Approval", "For Approval - AFD", "For Release"].includes(
      String(requestStatus || "")
    );

  const isApprovalStage =
    (isDistribution &&
      (isSupplyDisposal
        ? requestStatus === "For Approval" &&
          ((afd && meId === afd._id) || isSuperAdminRole)
        : (requestStatus === "For checking" && risChecker && meId === risChecker._id) ||
          (requestStatus === "For Approval" && risApprover && meId === risApprover._id))) ||
    (!isDistribution &&
      ((isDisposal &&
        ((requestStatus === "For Approval" && approver && meId === approver._id) ||
          (requestStatus === "For Approval - AFD" && afd && meId === afd._id) ||
          (isSuperAdminRole &&
            ["For Approval", "For Approval - AFD"].includes(String(requestStatus || ""))))) ||
        (isIssue &&
          ((requestStatus === "For Approval" && icsIssuanceApprover && meId === icsIssuanceApprover._id) ||
            (isSuperAdminRole && requestStatus === "For Approval"))) ||
        (isReturnToInventory &&
          ((requestStatus === "For Approval" && approver && meId === approver._id) ||
            (isSuperAdminRole && requestStatus === "For Approval") ||
            (requestStatus === "To receive" && invAdmin && meId === invAdmin._id))) ||
        (!isDisposal &&
          !isIssue &&
          !isReturnToInventory &&
          (isSeTransfer
            ? (["For Approval", "For Release"].includes(requestStatus) &&
                icsTransferApprover &&
                meId === icsTransferApprover._id) ||
              (isSuperAdminRole && ["For Approval", "For Release"].includes(requestStatus))
            : (requestStatus === "For Approval" && ptrApprover && meId === ptrApprover._id) ||
              (requestStatus === "For Release" && ptrReleaser && meId === ptrReleaser._id))))) ||
    adminApprovalStage;

  const isReceiveStage =
    (isDistribution && requestStatus === "Approved" && isRecipientForDistribution) ||
    (isIssue &&
      !isDistribution &&
      !isDisposal &&
      (requestStatus === "To receive" || requestStatus === "") &&
      issueRecipientMatches) ||
    (!isDistribution &&
      !isDisposal &&
      !isIssue &&
      !isReturnToInventory &&
      (requestStatus === "To receive" || requestStatus === "") &&
      transferRecipientMatches &&
      !isOtherAgencyTransfer);
  const isReturnToInventoryReceiveStage =
    !isDistribution &&
    isReturnToInventory &&
    (requestStatus === "To receive" || requestStatus === "") &&
    ((invAdmin && meId === invAdmin._id) || isSuperAdminRole);
  const isSuperAdminReceiveOverride =
    isSuperAdminRole &&
    !isDisposal &&
    !isOtherAgencyTransfer &&
    (requestStatus === "To receive" || requestStatus === "");

  const canUploadSigned =
    systemSettings.enable_signed_upload &&
    ((isSupplyDisposal && isApprovalStage) ||
      (!isSupplyDisposal &&
        (isApprovalStage ||
          isReceiveStage ||
          isReturnToInventoryReceiveStage ||
          isSuperAdminReceiveOverride)));
  const requiresSignedFile = (isSupplyDisposal && isApprovalStage) || canUploadSigned;
  const signedUploadBlocked =
    isSupplyDisposal && isApprovalStage && !systemSettings.enable_signed_upload;
  const approveDisabled = requiresSignedFile && !hasSignedFile;
  const signedActionLabel = requestStatus === "For Release"
    ? "release"
    : isReceiveStage || isReturnToInventoryReceiveStage
    ? "receive"
    : "approve";

  const canNotifyRequestor =
    systemSettings.enable_email &&
    (isApprovalStage || (isSuperAdminRole && requestStatus !== "Received")) &&
    (canAct || isSuperAdminRole);

  const canRevertState =
    isSuperAdminRole &&
    ((isDistribution && !isSupplyDisposal) ||
      (!isDistribution && (isOfficeEquipment || isICTEquipment || isFurniture))) &&
    (hasPreviousStateSnapshot ||
      (isDistribution &&
        !isSupplyDisposal &&
        ["for approval", "approved", "received", "transferred"].includes(
          requestStatusLower.trim()
        ))) &&
    !isFirstStepRequest;

  /* ---------- actions ---------- */
  const handlePrintOverview = () => {
    window.print();
  };
  const handleSignedDownload = () => {
    if (signedFile?.url) window.open(resolveServerUrl(signedFile.url), "_blank");
  };

  const handleRevertState = async () => {
    if (revertBusy || !canRevertState) return;
    setRevertBusy(true);
    try {
      const response = await fetch(`${usedURL}/${id}/revert-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ __v: inv.__v }),
      });
      if (!response.ok) {
        let message = "";
        try {
          const payload = await response.json();
          message = payload?.message || payload?.error || "";
        } catch {
          message = "";
        }
        throw new Error(
          message || `Failed to revert state: ${response.status} ${response.statusText}`
        );
      }
      const payload = await response.json();
      const nextInv = payload?.data || payload;
      setState((prev) => ({ ...prev, inventory: [nextInv] }));
      setShowRevertModal(false);
    } catch (err) {
      console.error("Revert state failed:", err);
      alert(err.message || "Failed to revert state.");
    } finally {
      setRevertBusy(false);
    }
  };

  const handleSignedUpload = async () => {
    if (!signedUploadFile || !signedUploadUrl) return;
    setSignedUploading(true);
    setSignedUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", signedUploadFile);

      const res = await fetch(signedUploadUrl, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to upload signed file.");
      }

      const data = await res.json();
      if (isDistribution && data?.distribution) {
        setState((prev) => ({ ...prev, inventory: [data.distribution] }));
      } else if (data?.data) {
        setState((prev) => {
          const nextInv = { ...(prev.inventory?.[0] || {}) };
          nextInv.signed_file = data.data;
          return { ...prev, inventory: [nextInv] };
        });
      }

      setSignedUploadFile(null);
    } catch (err) {
      setSignedUploadError(err.message || "Failed to upload signed file.");
    } finally {
      setSignedUploading(false);
    }
  };

  // Supply stock adjustments are now enforced server-side during approval/receive steps.

  /* --------------------- EMAIL: Distribution Edit Notice --------------------- */
  const guessRequestorEmail = () => {
    const requestorId =
      inv?.requested_by_id ||
      inv?.requestedby_id ||
      inv?.requestor_id ||
      inv?.requested_by ||
      inv?.requestedby ||
      inv?.requestor ||
      "";

    const requestorEmail = resolveUserEmail(requestorId, requestorId);
    if (requestorEmail) return requestorEmail;

    if (isDistribution) {
      if (inv?.distributedto_is && usersById[inv.distributedto_is]?.email) {
        return usersById[inv.distributedto_is].email;
      }
      if (typeof inv?.distributedto === "string" && inv.distributedto.includes("@")) {
        return inv.distributedto;
      }
      if (typeof inv?.distributedto === "string" && Array.isArray(users)) {
        const u = users.find((x) => x?.username === inv.distributedto);
        if (u?.email) return u.email;
      }
      if (
        typeof recipientDistributedNameResolved === "string" &&
        recipientDistributedNameResolved.includes("@")
      ) {
        return recipientDistributedNameResolved;
      }
    }

    const fallback =
      inv?.current_holder ||
      inv?.current_holder_id ||
      inv?.issued_to ||
      inv?.issued_to_id ||
      "";
    return resolveUserEmail(fallback, fallback);
  };

  const FALLBACK_LOGO_URL =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Department_of_Information_and_Communications_Technology_%28DICT%29.svg/942px-Department_of_Information_and_Communications_Technology_%28DICT%29.svg.png?20241108070928";

  const resolveEmailLogoUrl = () => {
    const raw = DICT || "";
    if (!raw) return FALLBACK_LOGO_URL;
    if (/^https?:/i.test(raw) || raw.startsWith("data:")) return raw;
    if (typeof window !== "undefined" && window.location?.origin) {
      try {
        return new URL(raw, window.location.origin).toString();
      } catch {
        return FALLBACK_LOGO_URL;
      }
    }
    return raw;
  };

  const formatRequestId = (value) => {
    const str = String(value || "");
    if (!str) return "";
    if (str.length <= 12) return str;
    return `${str.slice(0, 6)}…${str.slice(-4)}`;
  };

  const getRequestTypeLabel = () => {
    if (isDistribution) {
      return isSupplyDisposal
        ? "Supply Disposal Request (SDR)"
        : "Supply Transfer Request (RIS)";
    }
    if (isDisposal) return "Property Disposal Request";
    if (isReturnToInventory) return "Return to Inventory Request";
    if (isIssue) return issuanceDocumentName;
    if (isSeTransfer) return "Inventory Custodian Slip (ICS) Transfer";
    if (isPropertyPTR) return "Property Transfer Request";
    return "Inventory Request";
  };

  const getRequestReference = () => {
    const ris = inv?.RIS_no || inv?.ris_no;
    const ptr = inv?.PTR_no || inv?.ptr_no;
    const ics = inv?.ICS_no || inv?.ics_no;
    const par = inv?.PAR_no || inv?.par_no;
    const pdr = inv?.PDR_no || inv?.pdr_no;
    const rti = inv?.RTI_no || inv?.rti_no;
    const idShort = inv?._id ? formatRequestId(inv._id) : "";
    const idRaw = inv?._id || "";

    if (isDistribution) {
      return {
        label: isSupplyDisposal ? "SDR No." : "RIS No.",
        value: ris || idShort || "Request",
        raw: ris || idRaw || "",
      };
    }

    if (isPropertyPTR) {
      if (isDisposal) {
        return {
          label: "PDR No.",
          value: pdr || idShort || "Request",
          raw: pdr || idRaw || "",
        };
      }
      if (isReturnToInventory) {
        return {
          label: "RTI No.",
          value: rti || idShort || "Request",
          raw: rti || idRaw || "",
        };
      }
      if (isIssue) {
        return {
          label: isParIssue ? "PAR No." : "ICS No.",
          value: (isParIssue ? par : ics) || idShort || "Request",
          raw: (isParIssue ? par : ics) || idRaw || "",
        };
      }
      if (isSeTransfer) {
        return {
          label: "ICS No.",
          value: ics || idShort || "Request",
          raw: ics || idRaw || "",
        };
      }
      return {
        label: "PTR No.",
        value: ptr || idShort || "Request",
        raw: ptr || idRaw || "",
      };
    }

    return { label: "Request ID", value: idShort || "Request", raw: idRaw || "" };
  };

  const getRequestItemSummary = () => {
    const items = Array.isArray(inv?.items) && inv.items.length
      ? inv.items
      : inv?.itemName
      ? [{ itemName: inv.itemName, quantity: inv?.qty ?? inv?.quantity ?? 0 }]
      : [];
    const names = items.map((it) => it?.itemName).filter(Boolean);
    if (!names.length) return "";
    const preview = names.slice(0, 3);
    const remaining = names.length - preview.length;
    const qtyTotal = items.reduce(
      (sum, it) => sum + Number(it?.quantity ?? it?.qty ?? 0),
      0
    );
    const moreLabel = remaining > 0 ? ` +${remaining} more` : "";
    const qtyLabel =
      qtyTotal > 0 ? ` (${qtyTotal} unit${qtyTotal === 1 ? "" : "s"})` : "";
    return `${preview.join(", ")}${moreLabel}${qtyLabel}`;
  };

  const getEmailRequestMeta = () => {
    const ref = getRequestReference();
    const typeLabel = getRequestTypeLabel();
    const refDisplay =
      ref?.label && ref?.value ? `${ref.label} ${ref.value}` : ref?.value || "";
    return {
      typeLabel,
      refDisplay,
      refRaw: ref?.raw || "",
      itemSummary: getRequestItemSummary(),
      logoUrl: resolveEmailLogoUrl(),
    };
  };

  const getRequestPortalUrl = () =>
    `${window.location.origin}/#/checkform/${inv?._id}`;

  const buildDistributionEditEmailHtml = ({
    toName,
    refNo,
    changes,
    oldRemarks,
    newRemarks,
    oldTotal,
    newTotal,
    editedBy,
    portalUrl,
  }) => {
    const esc = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const rows =
      changes.length > 0
        ? changes
            .map(
              (c, idx) => `
              <tr>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; ${
                  idx % 2 ? "background:#f1f5f9;" : "background:#f8fafc;"
                }">
                  <div style="font-weight:700; color:#0f172a;">${esc(c.itemName)}</div>
                  <div style="font-size:12px; color:#64748b;">Return ID: ${esc(
                    c.returnId || "—"
                  )}</div>
                </td>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#0f172a;">${esc(
                  c.oldQty
                )}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#0f172a;">${esc(
                  c.newQty
                )}</td>
              </tr>
            `
            )
            .join("")
        : `
          <tr>
            <td colspan="3" style="padding:12px; text-align:center; color:#64748b; background:#f8fafc;">
              No quantity change (remarks updated only).
            </td>
          </tr>
        `;

    const meta = getEmailRequestMeta();
    const refLine = meta.refDisplay || refNo || "";
    const requestLine = refLine ? `${meta.typeLabel} • ${refLine}` : meta.typeLabel;
    const itemsLine = meta.itemSummary
      ? `<div style="margin-top:4px; font-size:12px; color:#64748b;">Items: ${esc(
          meta.itemSummary
        )}</div>`
      : "";

    return `
      <div style="font-family: Arial, sans-serif; color: #1f2937; background-color: #f4f6f8; padding: 24px;">
        <div style="max-width: 680px; margin: 0 auto;">
          <div style="text-align:center; padding-bottom: 20px;">
            <img src="${esc(meta.logoUrl)}" alt="DICT Logo" style="max-width: 140px; height:auto;" />
          </div>

          <div style="background:#ffffff; border-radius:12px; box-shadow: 0 6px 20px rgba(2, 6, 23, 0.06); padding: 28px;">
            <h1 style="font-size: 22px; color: #0f172a; margin: 0 0 16px 0; text-align:center;">
              Supply Distribution Updated
            </h1>

            <div style="font-size: 15px; line-height: 1.6; color:#334155;">
              <p style="margin:0 0 10px 0;">Good day <strong>${esc(
                toName || "Colleague"
              )}</strong>,</p>
              <p style="margin:0 0 14px 0;">
                Your supply distribution request has been <strong>edited</strong> in the DICT Region 2 Inventory System.
              </p>

              <div style="margin: 10px 0 14px 0; font-size:14px; color:#0f172a;">
                <div><strong>Request:</strong> ${esc(requestLine || "Request")}</div>
                ${itemsLine}
                <div style="margin-top:6px;"><strong>Reference:</strong> ${esc(
                  refNo || meta.refDisplay || inv?._id || ""
                )}</div>
                <div><strong>Edited by:</strong> ${esc(editedBy || "System")}</div>
              </div>

              <div style="overflow:hidden; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 14px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:14px;">
                  <thead>
                    <tr>
                      <th style="padding:10px 12px; background:#eef2ff; color:#0f172a; text-align:left;">Item</th>
                      <th style="padding:10px 12px; background:#eef2ff; color:#0f172a; text-align:center;">Old Qty</th>
                      <th style="padding:10px 12px; background:#eef2ff; color:#0f172a; text-align:center;">New Qty</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>

              <div style="overflow:hidden; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 14px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:14px;">
                  <tbody>
                    <tr>
                      <td style="padding:10px 12px; background:#f8fafc; width:40%; font-weight:600; border-bottom:1px solid #e5e7eb;">Remarks (Old)</td>
                      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; color:#0f172a;">${esc(
                        oldRemarks || "—"
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 12px; background:#f1f5f9; width:40%; font-weight:600; border-bottom:1px solid #e5e7eb;">Remarks (New)</td>
                      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; color:#0f172a;">${esc(
                        newRemarks || "—"
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 12px; background:#f8fafc; width:40%; font-weight:600;">Total (Old)</td>
                      <td style="padding:10px 12px; color:#0f172a;"><strong>${esc(
                        Number(oldTotal || 0).toFixed(2)
                      )}</strong></td>
                    </tr>
                    <tr>
                      <td style="padding:10px 12px; background:#f1f5f9; width:40%; font-weight:600;">Total (New)</td>
                      <td style="padding:10px 12px; color:#0f172a;"><strong>${esc(
                        Number(newTotal || 0).toFixed(2)
                      )}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              ${
                portalUrl
                  ? `
                <div style="text-align:center; margin-top: 18px;">
                  <a href="${esc(
                    portalUrl
                  )}" style="display:inline-block; background:#1d4ed8; color:#ffffff; text-decoration:none; padding: 10px 18px; border-radius: 8px; font-weight: 600;">
                    Open Inventory Portal
                  </a>
                </div>
              `
                  : ""
              }

              <p style="margin:16px 0 0 0; font-size:13px; color:#64748b;">
                This message was sent automatically by the DICT Inventory System.
              </p>
            </div>
          </div>

          <div style="text-align:center; color:#64748b; font-size:12px; margin-top: 18px;">
            <div>&copy; ${new Date().getFullYear()} Department of Information and Communications Technology (DICT).</div>
          </div>
        </div>
      </div>
    `;
  };

  const sendEmail = async ({ to, cc, subject, html }) => {
    if (!systemSettings.enable_email) return;
    if (!to) return;
    const res = await fetch(`${BASE_URL}/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ to, cc, subject, html }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Failed to send email.");
    }
  };

  const buildStatusEmailHtml = ({
    toName,
    senderName,
    refNo,
    statusLabel,
    message,
    portalUrl,
    nextStepTitle,
    nextStep,
  }) => {
    const esc = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const meta = getEmailRequestMeta();
    const requestLine = meta.refDisplay
      ? `${meta.typeLabel} • ${meta.refDisplay}`
      : meta.typeLabel;
    const itemsLine = meta.itemSummary
      ? `<div style="margin:0 0 10px 0; font-size:12px; color:#64748b;">
          Items: ${esc(meta.itemSummary)}
        </div>`
      : "";

    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; background:#f8fafc; padding:24px;">
        <div style="max-width: 680px; margin: 0 auto;">
          <div style="text-align:center; padding-bottom: 16px;">
            <img src="${esc(meta.logoUrl)}" alt="DICT Logo" style="max-width: 120px; height:auto;" />
          </div>
          <div style="background:#ffffff; border-radius:12px; box-shadow: 0 8px 22px rgba(2,6,23,0.08); padding: 24px;">
            <h2 style="margin:0 0 10px 0; font-size: 20px;">Request update</h2>
            <p style="margin:0 0 10px 0;">Hello <strong>${esc(
              toName || "Requestor"
            )}</strong>,</p>
            <p style="margin:0 0 6px 0;">
              Your <strong>${esc(requestLine || "Request")}</strong> has been updated to
              <strong> ${esc(statusLabel || "Updated")}</strong>.
            </p>
            ${itemsLine}
            ${
              message
                ? `<div style="margin:0 0 14px 0; padding:12px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px;">
                    ${esc(message).replace(/\n/g, "<br />")}
                  </div>`
                : ""
            }
            ${
              nextStep
                ? `<div style="margin:0 0 14px 0; padding:12px 14px; background:#ecfeff; border:1px solid #a5f3fc; border-radius:8px;">
                    <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#0e7490;">${esc(
                      nextStepTitle || "What happens next"
                    )}</div>
                    <div style="margin-top:5px; color:#164e63;">${esc(nextStep).replace(
                      /\n/g,
                      "<br />"
                    )}</div>
                  </div>`
                : ""
            }
            <div style="font-size: 12px; color:#64748b; margin-bottom: 16px;">
              Updated by: ${esc(senderName || "System")}
            </div>
            ${
              portalUrl
                ? `<a href="${esc(
                    portalUrl
                  )}" style="display:inline-block; background:#1d4ed8; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:600;">
                    Open Request
                  </a>`
                : ""
            }
            <p style="margin-top:16px; font-size:12px; color:#64748b;">This is an automated message from the DICT Inventory System.</p>
          </div>
        </div>
      </div>
    `;
  };

  const getUserEmail = (record) =>
    record?.email || resolveUserEmail(record?._id || record?.username, record?._id);

  const getUserName = (record, fallback = "Approver") =>
    record?.username || record?.name || record?.email || fallback;

  const buildActionRequiredEmailHtml = ({
    toName,
    senderName,
    actionLabel,
    statusLabel,
    message,
    portalUrl,
    actionInstructions,
  }) => {
    const esc = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const meta = getEmailRequestMeta();
    const requestLine = meta.refDisplay
      ? `${meta.typeLabel} • ${meta.refDisplay}`
      : meta.typeLabel;
    const itemsLine = meta.itemSummary
      ? `<div style="margin:0 0 10px 0; font-size:12px; color:#64748b;">
          Items: ${esc(meta.itemSummary)}
        </div>`
      : "";

    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; background:#f8fafc; padding:24px;">
        <div style="max-width: 680px; margin: 0 auto;">
          <div style="text-align:center; padding-bottom: 16px;">
            <img src="${esc(meta.logoUrl)}" alt="DICT Logo" style="max-width: 120px; height:auto;" />
          </div>
          <div style="background:#ffffff; border-radius:12px; box-shadow: 0 8px 22px rgba(2,6,23,0.08); padding: 24px;">
            <h2 style="margin:0 0 10px 0; font-size: 20px;">Action required</h2>
            <p style="margin:0 0 10px 0;">Hello <strong>${esc(
              toName || "Approver"
            )}</strong>,</p>
            <p style="margin:0 0 6px 0;">
              A <strong>${esc(requestLine || "request")}</strong> is now waiting for your
              <strong> ${esc(actionLabel || "approval")}</strong>.
            </p>
            ${itemsLine}
            <div style="margin:0 0 14px 0; padding:12px 14px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px;">
              <div><strong>Current status:</strong> ${esc(statusLabel || "Pending")}</div>
              ${
                message
                  ? `<div style="margin-top:6px;">${esc(message).replace(
                      /\n/g,
                      "<br />"
                    )}</div>`
                  : ""
              }
            </div>
            <div style="margin:0 0 14px 0; padding:12px 14px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#c2410c;">What you need to do</div>
              <div style="margin-top:5px; color:#7c2d12;">${esc(
                actionInstructions ||
                  `Open the request, review its details and signed document, then complete the ${actionLabel || "required"} action.`
              ).replace(/\n/g, "<br />")}</div>
            </div>
            <div style="font-size: 12px; color:#64748b; margin-bottom: 16px;">
              Forwarded by: ${esc(senderName || "System")}
            </div>
            ${
              portalUrl
                ? `<a href="${esc(
                    portalUrl
                  )}" style="display:inline-block; background:#1d4ed8; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:600;">
                    Review Request
                  </a>`
                : ""
            }
            <p style="margin-top:16px; font-size:12px; color:#64748b;">This is an automated message from the DICT Inventory System.</p>
          </div>
        </div>
      </div>
    `;
  };

  const getWorkflowGuidance = (statusLabel) => {
    const status = String(statusLabel || "").toLowerCase().trim();
    if (status === "declined" || status === "cancelled") {
      return {
        title: "Request closed",
        text: "No further workflow action is expected. Review the remarks in the request for details.",
      };
    }
    if (["received", "issued", "transferred", "disposed", "in stock"].includes(status)) {
      return {
        title: "Workflow complete",
        text: "No further approval is required. Open the request to view the completed record and signed document.",
      };
    }
    if (status === "for checking") {
      return {
        title: `Next action owner: ${signatoryName(risChecker, invAdminRoleLabel)}`,
        text: "The configured RIS checker must verify the request details and quantities before forwarding it for approval.",
      };
    }
    if (status === "for approval - afd") {
      return {
        title: `Next action owner: ${afdRoleLabel}`,
        text: `The ${afdRoleLabel} must review the signed document and approve or decline the disposal request.`,
      };
    }
    if (status === "for approval") {
      const owner = isDistribution
        ? signatoryName(risApprover, afdRoleLabel)
        : isIssue
        ? signatoryName(icsIssuanceApprover, invAdminRoleLabel)
        : isSeTransfer
        ? signatoryName(icsTransferApprover, invAdminRoleLabel)
        : signatoryName(ptrApprover, rdRoleLabel);
      return {
        title: `Next action owner: ${owner}`,
        text: `${owner} must review the request and signed document, then approve or decline it.`,
      };
    }
    if (status === "approved" && isDistribution) {
      return {
        title: "Next action owner: Supply recipient",
        text: "The designated recipient must open the request and confirm that the supplies were received.",
      };
    }
    if (status === "for release") {
      return {
        title: `Next action owner: ${signatoryName(ptrReleaser, invAdminRoleLabel)}`,
        text: "The configured PTR releaser must prepare and release the property, then forward it to the recipient.",
      };
    }
    if (status === "to receive") {
      return {
        title: isReturnToInventory
          ? `Next action owner: ${invAdminRoleLabel}`
          : "Next action owner: Recipient",
        text: isReturnToInventory
          ? "The Inventory Admin must confirm return of the property to inventory."
          : "The designated recipient must open the request, verify the property and signed document, and confirm receipt.",
      };
    }
    return {
      title: "Current workflow",
      text: "Open the request to review its current stage, assigned action owner, and signed document.",
    };
  };

  const sendStatusEmailSafe = async ({ statusLabel, message }) => {
    if (!systemSettings.enable_email) return;
    const toEmail = guessRequestorEmail();
    if (!toEmail) return;
    const guidance = getWorkflowGuidance(statusLabel);
    const meta = getEmailRequestMeta();
    const refNo = meta.refDisplay || meta.refRaw || "Request";
    const portalUrl = getRequestPortalUrl();
    const toName = requestedByName || recipientDistributedNameResolved || "Requestor";
    const senderName = meUsername || "Signatory";

    const html = buildStatusEmailHtml({
      toName,
      senderName,
      refNo,
      statusLabel,
      message,
      portalUrl,
      nextStepTitle: guidance.title,
      nextStep: guidance.text,
    });

    try {
      await sendEmail({
        to: toEmail,
        subject: `${meta.typeLabel} Update: ${refNo} - ${statusLabel || "Updated"}`,
        html,
      });
    } catch (mailErr) {
      console.error("Failed to send status email:", mailErr);
    }
  };

  const sendApproverActionEmailSafe = async ({
    recipient,
    actionLabel = "approval",
    statusLabel,
    message,
    actionInstructions,
  }) => {
    if (!systemSettings.enable_email || !recipient) return;
    const toEmail = getUserEmail(recipient);
    if (!toEmail) return;

    const meta = getEmailRequestMeta();
    const refNo = meta.refDisplay || meta.refRaw || "Request";
    const portalUrl = getRequestPortalUrl();
    const senderName = meUsername || "Signatory";
    const html = buildActionRequiredEmailHtml({
      toName: getUserName(recipient),
      senderName,
      actionLabel,
      statusLabel,
      message,
      portalUrl,
      actionInstructions,
    });

    try {
      const requestorEmail = guessRequestorEmail();
      const cc =
        requestorEmail && requestorEmail.toLowerCase() !== toEmail.toLowerCase()
          ? [requestorEmail]
          : undefined;
      await sendEmail({
        to: toEmail,
        cc,
        subject: `Action required — ${meta.typeLabel}: ${refNo} needs your ${actionLabel}`,
        html,
      });
    } catch (mailErr) {
      console.error("Failed to send approver action email:", mailErr);
    }
  };

  const sendNextApproverEmailSafe = async (nextStatus) => {
    if (!systemSettings.enable_email || !nextStatus) return;

    if (isDistribution && !isSupplyDisposal && nextStatus === "For Approval") {
      await sendApproverActionEmailSafe({
        recipient: risApprover,
        actionLabel: "approval",
        statusLabel: nextStatus,
        message: `The request has been checked and is ready for ${getUserName(risApprover)} approval.`,
        actionInstructions:
          "Open the request, verify the requested supplies and signed RIS, then approve or decline the request.",
      });
      return;
    }

    if (isDistribution && !isSupplyDisposal && nextStatus === "Approved") {
      await sendApproverActionEmailSafe({
        recipient: distributedRecipientRecord,
        actionLabel: "receipt confirmation",
        statusLabel: nextStatus,
        message: "The supply transfer has been approved and is waiting for recipient confirmation.",
        actionInstructions:
          "Open the request, verify the listed supplies and quantities, then select Mark as Received only after the supplies are physically received.",
      });
      return;
    }

    if (!isDistribution && isDisposal && nextStatus === "For Approval - AFD") {
      await sendApproverActionEmailSafe({
        recipient: afd,
        actionLabel: "approval",
        statusLabel: nextStatus,
        message: `The disposal request was reviewed by ${rdRoleLabel} and is ready for ${afdRoleLabel} approval.`,
        actionInstructions:
          "Open the request, review the disposal reason and signed PDR, then approve or decline the disposal request.",
      });
      return;
    }

    if (!isDistribution && isIssue && nextStatus === "To receive") {
      await sendApproverActionEmailSafe({
        recipient: issuedToRecord,
        actionLabel: "receipt confirmation",
        statusLabel: nextStatus,
        message: `The ${issuanceDocType} has been approved and the property is ready for acknowledgment.`,
        actionInstructions: `Open the request, verify the property details and signed ${issuanceDocType}, then confirm receipt only after receiving the property.`,
      });
      return;
    }

    if (!isDistribution && isReturnToInventory && nextStatus === "To receive") {
      await sendApproverActionEmailSafe({
        recipient: invAdmin,
        actionLabel: "inventory receipt",
        statusLabel: nextStatus,
        message: "The return-to-inventory request has been approved and is ready for inventory receipt.",
        actionInstructions:
          "Open the request, inspect the returned property and signed document, then confirm its return to inventory.",
      });
      return;
    }

    if (
      !isDistribution &&
      !isDisposal &&
      !isIssue &&
      !isReturnToInventory &&
      nextStatus === "For Release"
    ) {
      await sendApproverActionEmailSafe({
        recipient: ptrReleaser,
        actionLabel: "release",
        statusLabel: nextStatus,
        message: "The transfer request has been approved and is ready for release.",
        actionInstructions:
          "Open the PTR, verify the signed document and property details, release the property, then advance it for recipient confirmation.",
      });
      return;
    }

    if (
      !isDistribution &&
      !isDisposal &&
      !isIssue &&
      !isReturnToInventory &&
      !isOtherAgencyTransfer &&
      nextStatus === "To receive"
    ) {
      await sendApproverActionEmailSafe({
        recipient: transferedToRecord,
        actionLabel: "transfer receipt",
        statusLabel: nextStatus,
        message: isSeTransfer
          ? "The SE transfer has been approved by the Inventory Admin and is waiting for your acknowledgment."
          : "The property has been released and is waiting for your receiving acknowledgment.",
        actionInstructions: isSeTransfer
          ? "Open the ICS, verify the property and signed document, then confirm receipt only after the property is physically received."
          : "Open the PTR, verify the property and signed document, then confirm receipt only after the property is physically received.",
      });
    }
  };

  const escapeHtml = (val) => {
    if (!val) return "";
    return String(val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const defaultNotifyText = () => {
    return getWorkflowGuidance(requestStatus).text;
  };

  const openNotifyModal = () => {
    setNotifyText(defaultNotifyText());
    setNotifyOpen(true);
    setNotifyMessage("");
    setNotifyStatus("");
  };

  const handleNotifyRequestor = async () => {
    if (!systemSettings.enable_email || notifyBusy) return;
    setNotifyBusy(true);
    setNotifyMessage("");

    try {
      const toEmail = guessRequestorEmail();
      if (!toEmail) {
        throw new Error("Requestor email not found.");
      }

      const meta = getEmailRequestMeta();
      const refNo = meta.refDisplay || meta.refRaw || "Request";
      const portalUrl = getRequestPortalUrl();
      const guidance = getWorkflowGuidance(requestStatus);
      const safeMessage = escapeHtml(notifyText || defaultNotifyText()).replace(
        /\n/g,
        "<br />"
      );
      const senderName = meUsername || "Signatory";

      const html = `
        <div style="font-family:Arial,sans-serif; color:#0f172a; line-height:1.6; background:#f8fafc; padding:24px;">
          <div style="max-width: 680px; margin: 0 auto;">
            <div style="text-align:center; padding-bottom: 16px;">
              <img src="${escapeHtml(meta.logoUrl)}" alt="DICT Logo" style="max-width: 120px; height:auto;" />
            </div>
            <div style="background:#ffffff; border-radius:12px; box-shadow: 0 8px 22px rgba(2,6,23,0.08); padding: 24px;">
              <h2 style="margin:0 0 10px 0;">Request status update</h2>
              <p style="margin:0 0 6px 0;">
                Request: <strong>${escapeHtml(meta.typeLabel)}</strong>${refNo ? ` • <strong>${escapeHtml(refNo)}</strong>` : ""}
              </p>
              ${
                meta.itemSummary
                  ? `<p style="margin:0 0 10px 0; font-size:12px; color:#64748b;">Items: ${escapeHtml(
                      meta.itemSummary
                    )}</p>`
                  : ""
              }
              <p style="margin:0 0 12px 0;"><strong>Message from ${escapeHtml(
                senderName
              )}:</strong></p>
              <div style="margin:0 0 14px 0; padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                ${safeMessage || "—"}
              </div>
              <div style="margin:0 0 14px 0; padding:12px 14px; background:#ecfeff; border:1px solid #a5f3fc; border-radius:8px;">
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#0e7490;">${escapeHtml(
                  guidance.title
                )}</div>
                <div style="margin-top:5px; color:#164e63;">${escapeHtml(
                  guidance.text
                )}</div>
              </div>
              <p style="margin:16px 0;">
                <a href="${portalUrl}" style="display:inline-block; background:#1d4ed8; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:600;">
                  Open Request
                </a>
              </p>
              <p style="font-size:12px; color:#64748b;">This message was sent by the DICT Inventory System.</p>
            </div>
          </div>
        </div>
      `;

      await sendEmail({
        to: toEmail,
        subject: `${meta.typeLabel} Update: ${refNo} - ${requestStatus || "In progress"}`,
        html,
      });

      setNotifyStatus("success");
      setNotifyMessage("Requestor notified.");
      setNotifyOpen(false);
    } catch (err) {
      setNotifyStatus("error");
      setNotifyMessage(err?.message || "Failed to notify requestor.");
    } finally {
      setNotifyBusy(false);
      setTimeout(() => {
        setNotifyMessage("");
        setNotifyStatus("");
      }, 3000);
    }
  };

  /* --------------------- Edit request logic (DISTRIBUTION ONLY) --------------------- */

  // ✅ edit is ONLY valid when requeststatus === "For checking"
  // and only for Inventory Admin or Admin.
  const canEditDistribution =
    isDistribution &&
    requestStatus === "For checking" &&
    (isSuperAdminRole || (risChecker && meId === risChecker._id));

  const getChangePreviewLines = (origItems, currentItems, origRemarks, userRemarks) => {
    const oldMap = computeQtyMap(origItems);
    const newMap = computeQtyMap(currentItems);
    const lines = [];

    // Qty changes + additions
    (currentItems || []).forEach((it) => {
      const rid = it.returnId || it.return_id || it.returnID;
      if (!rid) return;
      const hadOld = Object.prototype.hasOwnProperty.call(oldMap, rid);
      const oldQty = hadOld ? Number(oldMap[rid] || 0) : 0;
      const newQty = Number(it._qtyNum || it.quantity || 0);
      if (!hadOld && newQty > 0) {
        lines.push(`Added ${it.itemName} (RID: ${rid}): ${oldQty} → ${newQty}`);
        return;
      }
      if (oldQty !== newQty) {
        lines.push(`${it.itemName} (RID: ${rid}): ${oldQty} → ${newQty}`);
      }
    });

    // Removed items
    (origItems || []).forEach((it) => {
      const rid = it.returnId || it.return_id || it.returnID;
      if (!rid) return;
      if (!Object.prototype.hasOwnProperty.call(newMap, rid)) {
        const oldQty = Number(it.quantity || 0);
        lines.push(`Removed ${it.itemName} (RID: ${rid}): ${oldQty} → 0`);
      }
    });

    // Remarks changes (user remarks only)
    const oldUser = String(origRemarks || "").trim();
    const newUser = String(userRemarks || "").trim();
    if (oldUser !== newUser) {
      lines.push(`Remarks updated.`);
    }

    return lines;
  };

  const buildAutoLogText = ({ editor, nowISO, changesLines, oldRemarks, newRemarks }) => {
    const oldR = String(oldRemarks || "").trim();
    const newR = String(newRemarks || "").trim();

    const header = `[AUTO-LOG] ${nowISO} • Edited by: ${editor || "System"}`;
    const bodyLines = [];

    if (changesLines?.length) {
      bodyLines.push("Changes:");
      changesLines.forEach((ln) => bodyLines.push(`- ${ln}`));
    } else {
      bodyLines.push("Changes: (none)");
    }

    if (oldR !== newR) {
      bodyLines.push("Remarks diff:");
      bodyLines.push(`- Old: ${oldR || "—"}`);
      bodyLines.push(`- New: ${newR || "—"}`);
    }

    return `${header}\n${bodyLines.join("\n")}`;
  };

  const editTotal = Array.isArray(editItems)
    ? editItems.reduce((sum, it) => {
        const qty = Number(it._qtyNum || 0);
        const cost = Number(it.cost || 0);
        return sum + qty * cost;
      }, 0)
    : 0;

  const invalidCount = Array.isArray(editItems)
    ? editItems.reduce((acc, it) => acc + (it._qtyInvalid ? 1 : 0), 0)
    : 0;

  const openEditDistribution = () => {
    if (!isDistribution || !Array.isArray(inv?.items)) return;
    if (requestStatus !== "For checking") return;

    const cloned = inv.items.map((it) => {
      const initialQty = Math.max(1, Math.floor(Number(it.quantity || 1)));
      const qtyInput = String(initialQty);
      const parsed = parseQtyInput(qtyInput);
      return {
        ...it,
        _qtyInput: qtyInput,
        _qtyNum: parsed.n,
        _qtyInvalid: parsed.invalid,
      };
    });

    setEditOrigItems(inv.items || []);
    setEditOrigRemarks(inv?.remarks || "");
    setEditItems(cloned);
    setEditUserRemarks(inv?.remarks || "");
    setSupplySearch("");
    setSelectedSupplyId("");
    setAddQtyInput("1");
    setEditAddError("");
    setShowEditModal(true);
  };

  const handleQtyChange = (idx, rawVal) => {
    setEditItems((prev) => {
      const next = [...prev];
      const v = rawVal === null || rawVal === undefined ? "" : String(rawVal);
      const parsed = parseQtyInput(v);
      next[idx] = { ...next[idx], _qtyInput: v, _qtyNum: parsed.n, _qtyInvalid: parsed.invalid };
      return next;
    });
  };

  const handleQtyBlur = (idx) => {
    setEditItems((prev) => {
      const next = [...prev];
      const it = next[idx];
      const fixed = clampQtyInput(it?._qtyInput);
      const parsed = parseQtyInput(fixed);
      next[idx] = { ...it, _qtyInput: fixed, _qtyNum: parsed.n, _qtyInvalid: parsed.invalid };
      return next;
    });
  };

  const handleSupplySearchChange = (e) => {
    setSupplySearch(e.target.value);
    setEditAddError("");
  };

  const handleSelectSupply = (e) => {
    setSelectedSupplyId(e.target.value);
    setEditAddError("");
  };

  const handleAddQtyChange = (e) => {
    setAddQtyInput(e.target.value);
    setEditAddError("");
  };

  const handleAddItem = () => {
    const qtyParsed = parseQtyInput(addQtyInput);
    if (!selectedSupplyId) {
      setEditAddError("Select an item to add.");
      return;
    }
    if (qtyParsed.invalid) {
      setEditAddError("Enter a valid quantity (min 1).");
      return;
    }

    const selected = (supplyOptions || []).find((opt) => opt?._id === selectedSupplyId);
    if (!selected) {
      setEditAddError("Selected item is not available. Try searching again.");
      return;
    }

    setEditItems((prev) => {
      const next = [...prev];
      const selectedRid = selected._id;
      const existingIdx = next.findIndex((it) => {
        const rid = it.returnId || it.return_id || it.returnID;
        return rid === selectedRid;
      });

      if (existingIdx !== -1) {
        const current = next[existingIdx];
        const currentQty = Number(current._qtyNum || current.quantity || 0);
        const newQty = currentQty + qtyParsed.n;
        next[existingIdx] = {
          ...current,
          quantity: newQty,
          _qtyInput: String(newQty),
          _qtyNum: newQty,
          _qtyInvalid: false,
        };
        return next;
      }

      const cost = Number(
        selected.balance_unit_cost ?? selected.unit_cost ?? selected.unitCost ?? 0
      );
      const itemName =
        selected.itemName || selected.item_name || selected.description || "—";

      next.push({
        stock_no: selected.stock_no || selected.stockNo || "",
        returnId: selected._id,
        classification: selected.classification || "",
        itemName,
        unitofmeasure: selected.unitofmeasure || selected.unit || "",
        quantity: qtyParsed.n,
        cost,
        project: selected.project || "",
        _qtyInput: String(qtyParsed.n),
        _qtyNum: qtyParsed.n,
        _qtyInvalid: false,
      });
      return next;
    });

    setAddQtyInput("1");
    setEditAddError("");
    showToast("Item added to request.", "success");
  };

  const handleRemoveItem = (idx) => {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveDistributionEdit = async () => {
    if (editBusy) return;
    setEditBusy(true);

    try {
      if (!isDistribution || requestStatus !== "For checking") {
        throw new Error("Edit is only allowed while request status is 'For checking'.");
      }

      const bad = (editItems || []).some((it) => parseQtyInput(it?._qtyInput).invalid);
      if (bad) {
        throw new Error("Please fix invalid quantities (must be at least 1).");
      }

      const sanitized = (editItems || []).map((it) => {
        const qty = Math.max(1, Math.floor(Number(it._qtyNum ?? it.quantity ?? 1)));
        const stockNo = it.stock_no ?? it.stockNo ?? "";
        const stockNoNum = Number(stockNo);
        return {
          stock_no: Number.isFinite(stockNoNum) ? stockNoNum : stockNo,
          returnId: it.returnId || it.return_id || it.returnID || "",
          classification: it.classification || "",
          project: it.project || "",
          itemName: it.itemName || it.item_name || it.description || "",
          unitofmeasure: it.unitofmeasure || it.unit || "",
          quantity: qty,
          cost: Number(it.cost ?? it.unit_cost ?? it.unitCost ?? 0),
        };
      });

      if (!sanitized.length) {
        throw new Error("Request must contain at least one item.");
      }

      const previewLines = getChangePreviewLines(
        editOrigItems,
        sanitized.map((x) => ({ ...x, _qtyNum: Number(x.quantity || 0) })),
        editOrigRemarks,
        editUserRemarks
      );

      const nowISO = new Date().toISOString();
      const autoLog = buildAutoLogText({
        editor: meUsername || "System",
        nowISO,
        changesLines: previewLines,
        oldRemarks: editOrigRemarks,
        newRemarks: editUserRemarks,
      });

      const userNote = String(editUserRemarks || "").trim();
      const finalRemarks = userNote ? `${userNote}\n\n${autoLog}` : autoLog;

      const unwrapDistributionPayload = (payload) => {
        if (payload?.data && payload?.data?._id) return payload.data;
        return payload;
      };

      const fetchLatestDistribution = async () => {
        const res = await fetch(`${BASE_URL}/distribute/distributions/${inv._id}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to refresh request. Please reload the page.");
        }
        const payload = await res.json();
        return unwrapDistributionPayload(payload);
      };

      const submitEdits = async (version) => {
        const payload = { items: sanitized, remarks: finalRemarks };
        if (version !== undefined) {
          payload.__v = version;
        }
        const putRes = await fetch(`${BASE_URL}/distribute/distributions/${inv._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });

        if (!putRes.ok) {
          let message = "";
          try {
            const payload = await putRes.json();
            message = payload?.message || payload?.error || "";
          } catch {
            message = "";
          }

          if (
            putRes.status === 409 &&
            (message === "VERSION_CONFLICT" || /version conflict/i.test(message))
          ) {
            const err = new Error("VERSION_CONFLICT");
            err.code = "VERSION_CONFLICT";
            throw err;
          }

          throw new Error(
            message || `Failed to save edits: ${putRes.status} ${putRes.statusText}`
          );
        }

        const responseData = await putRes.json();
        return unwrapDistributionPayload(responseData);
      };

      const latest = await fetchLatestDistribution();
      const latestStatus = String(latest?.requeststatus || "").toLowerCase().trim();
      if (latestStatus !== "for checking") {
        throw new Error("Request status changed. Please refresh and try again.");
      }

      let updatedDistribution;
      try {
        updatedDistribution = await submitEdits(latest?.__v);
      } catch (err) {
        if (err?.code !== "VERSION_CONFLICT") throw err;
        const refreshed = await fetchLatestDistribution();
        const refreshedStatus = String(refreshed?.requeststatus || "")
          .toLowerCase()
          .trim();
        if (refreshedStatus !== "for checking") {
          throw new Error("Request status changed. Please refresh and try again.");
        }
        try {
          updatedDistribution = await submitEdits(refreshed?.__v);
        } catch (retryErr) {
          if (retryErr?.code !== "VERSION_CONFLICT") throw retryErr;
          updatedDistribution = await submitEdits(undefined);
        }
      }

      setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
      setEditOrigItems(sanitized);
      setEditOrigRemarks(editUserRemarks);

      // Email requestor about changes
      let emailFailed = false;
      try {
        const oldMap = computeQtyMap(editOrigItems);
        const newMap = computeQtyMap(sanitized);
        const changes = [];

        sanitized.forEach((it) => {
          const rid = it.returnId || it.return_id || it.returnID;
          const oldQty = Number(oldMap[rid] || 0);
          const newQty = Number(it.quantity || 0);
          if (oldQty === newQty) return;
          changes.push({ returnId: rid, itemName: it.itemName, oldQty, newQty });
        });

        (editOrigItems || []).forEach((it) => {
          const rid = it.returnId || it.return_id || it.returnID;
          if (!rid) return;
          if (Object.prototype.hasOwnProperty.call(newMap, rid)) return;
          const oldQty = Number(it.quantity || 0);
          changes.push({ returnId: rid, itemName: it.itemName, oldQty, newQty: 0 });
        });

        const oldTotal = (editOrigItems || []).reduce((sum, it) => {
          const qty = Number(it.quantity || 0);
          const cost = Number(it.cost || 0);
          return sum + qty * cost;
        }, 0);

        const newTotal = sanitized.reduce((sum, it) => {
          const qty = Number(it.quantity || 0);
          const cost = Number(it.cost || 0);
          return sum + qty * cost;
        }, 0);

        const toEmail = guessRequestorEmail();
        const portalUrl = getRequestPortalUrl();

        const meta = getEmailRequestMeta();
        const html = buildDistributionEditEmailHtml({
          toName: recipientDistributedNameResolved || inv?.distributedto || "",
          refNo: meta.refDisplay || meta.refRaw || inv?._id,
          changes,
          oldRemarks: String(editOrigRemarks || "").trim(),
          newRemarks: String(editUserRemarks || "").trim(),
          oldTotal,
          newTotal,
          editedBy: meUsername || "System",
          portalUrl,
        });

        if (!toEmail) {
          emailFailed = true;
        } else {
          await sendEmail({
            to: toEmail,
            subject: `Supply Distribution Updated: ${
              meta.refDisplay || meta.refRaw || "Request"
            }`,
            html,
          });
        }
      } catch (mailErr) {
        emailFailed = true;
        console.error("Failed to send distribution edit email:", mailErr);
      }

      setShowEditModal(false);
      showToast(
        emailFailed
          ? "Request updated, but email failed to send."
          : "Request updated successfully.",
        emailFailed ? "error" : "success"
      );
    } catch (e) {
      console.error("Edit distribution failed:", e);
      setState((prev) => ({ ...prev, error: e }));
      showToast(e?.message || "Failed to update request.", "error");
    } finally {
      setEditBusy(false);
    }
  };

  /* ---------- approval/decline engine ---------- */
  const handleAction = async (action) => {
    if (actionBusy) return;
    setActionBusy(true);

    try {
      const declineReasonText = String(reason || "").trim();
      const actionRemarksText = declineReasonText;
      const currentStatus = inv?.requeststatus || "";
      let updatedRequestStatus = "";
      let resultingStatus = "";
      let date_checked = null;
      let date_approved = null;
      let date_released = null;
      let date_received = null;
      let date_issued = null;
      let remarks = inv?.remarks || "";
      let history = Array.isArray(inv?.history) ? [...inv.history] : [];
      let transfertype = null;
      let current_holder = inv?.current_holder || null;
      let current_holder_id = inv?.current_holder_id || null;

      if (action === "cancel") {
        if (!canCancelRequest) {
          throw new Error("This request can no longer be cancelled.");
        }
        if (!actionRemarksText) {
          throw new Error("Cancellation remarks are required.");
        }

        const cancelledRemarks = `${inv?.remarks ? `${inv.remarks} ` : ""}[Cancelled] ${actionRemarksText}`;

        if (isDistribution) {
          const response = await fetch(
            `${BASE_URL}/distribute/distributions/${inv._id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "Cancelled",
                requeststatus: "Cancelled",
                remarks: cancelledRemarks,
                __v: inv.__v,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(
              `Failed to cancel request: ${response.status} ${response.statusText}`
            );
          }

          const result = await response.json();
          const updatedDistribution = result?.data || result;
          setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
          await sendStatusEmailSafe({
            statusLabel: "Cancelled",
            message: actionRemarksText || "Your request was cancelled.",
          });
          openDeclineSuccessPopup("Request cancelled successfully.");
          return;
        }

        const normalizedStatus = String(inv?.status || "").toLowerCase();
        const hasHolder = Boolean(inv?.issued_to || inv?.current_holder);
        const fallbackStatus = hasHolder ? "Issued" : "In Stock";
        const cancelledStatus = normalizedStatus.includes("issue")
          ? "In Stock"
          : normalizedStatus.includes("return")
          ? "Issued"
          : normalizedStatus.includes("transfer") ||
            normalizedStatus.includes("disposal")
          ? fallbackStatus
          : inv?.status || fallbackStatus;

        const todayISO = new Date().toISOString();
        const cancellationHistory = Array.isArray(inv?.history) ? [...inv.history] : [];
        cancellationHistory.push({
          name: requestedByName || meUsername || "Requestor",
          from: todayISO,
          to: todayISO,
          reason: `Request was cancelled by requestor: ${actionRemarksText}`,
          remarks: actionRemarksText,
        });

        const response = await fetch(`${usedURL}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requeststatus: "Cancelled",
            status: cancelledStatus,
            remarks: cancelledRemarks,
            history: cancellationHistory,
            __v: inv.__v,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to cancel request: ${response.status} ${response.statusText}`
          );
        }

        const responsePayload = await response.json();
        const updatedInventory = responsePayload?.data || responsePayload;
        setState((prev) => ({ ...prev, inventory: [updatedInventory] }));
        await sendStatusEmailSafe({
          statusLabel: "Cancelled",
          message: actionRemarksText || "Your request was cancelled.",
        });
        openDeclineSuccessPopup("Request cancelled successfully.");
        return;
      }

      /* ========== 1. DISTRIBUTION BRANCH (OFFICE SUPPLIES) ========== */
      if (isDistribution) {
        if (isSupplyDisposal) {
          if (action === "approve") {
            const now = new Date();
            if (currentStatus === "For Approval") {
              const body = {
                requeststatus: "Approved",
                status: "Disposed",
                date_approved: formatDate(now),
                __v: inv.__v,
              };

              const response = await fetch(
                `${BASE_URL}/distribute/distributions/${inv._id}`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }
              );
            if (!response.ok) {
              throw new Error(
                `Failed to approve disposal: ${response.status} ${response.statusText}`
              );
            }
            const responsePayload = await response.json();
            const updatedDistribution = responsePayload?.data || responsePayload;
            setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
            await sendStatusEmailSafe({
              statusLabel: "Disposed",
              message: "Your supply disposal request has been approved and marked as disposed.",
            });
            window.location.reload();
          }
          return;
        }

          if (action === "decline") {
            const response = await fetch(
              `${BASE_URL}/distribute/distributions/${inv._id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: "Declined",
                  requeststatus: "Declined",
                  remarks: declineReasonText || inv.remarks || "",
                  __v: inv.__v,
                }),
              }
            );
            if (!response.ok) {
              throw new Error(
                `Failed to decline disposal: ${response.status} ${response.statusText}`
              );
            }
            const responsePayload = await response.json();
            const updatedDistribution = responsePayload?.data || responsePayload;
            setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
            await sendStatusEmailSafe({
              statusLabel: "Declined",
              message: declineReasonText || "Your supply disposal request was declined.",
            });
            openDeclineSuccessPopup("Successfully declined.");
            return;
          }
        }
        if (action === "approve") {
          const now = new Date();

          // Step 1: For checking -> For Approval (Inventory Admin)
          if (currentStatus === "For checking") {
            const body = {
              requeststatus: "For Approval",
              date_checked: formatDate(now),
              __v: inv.__v,
            };

            const response = await fetch(
              `${BASE_URL}/distribute/distributions/${inv._id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            );
            if (!response.ok) {
              throw new Error(
                `Failed to update distribution: ${response.status} ${response.statusText}`
              );
            }
            const responsePayload = await response.json();
            const updatedDistribution = responsePayload?.data || responsePayload;
            setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
            await sendStatusEmailSafe({
              statusLabel: "For Approval",
              message: "Your request has been checked and forwarded for approval.",
            });
            await sendNextApproverEmailSafe("For Approval");
            window.location.reload();
            return;
          }

          // Step 2: For Approval -> Approved (AFD)
          if (currentStatus === "For Approval") {
            const body = {
              requeststatus: "Approved",
              date_approved: formatDate(now),
              __v: inv.__v,
            };

            const response = await fetch(
              `${BASE_URL}/distribute/distributions/${inv._id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            );
            if (!response.ok) {
              throw new Error(
                `Failed to approve distribution: ${response.status} ${response.statusText}`
              );
            }
            const responsePayload = await response.json();
            const updatedDistribution = responsePayload?.data || responsePayload;
            setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
            await sendStatusEmailSafe({
              statusLabel: "Approved",
              message: `Your request has been approved by ${afdRoleLabel}.`,
            });
            await sendNextApproverEmailSafe("Approved");
            window.location.reload();
            return;
          }

          // Step 3: Approved -> Received / Transferred (recipient)
          const body = {
            requeststatus: "Received",
            status: "Transferred",
            date_received: formatDate(now),
            __v: inv.__v,
          };

          const response = await fetch(
            `${BASE_URL}/distribute/distributions/${inv._id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          );
          if (!response.ok) {
            throw new Error(
              `Failed to mark distribution as received: ${response.status} ${response.statusText}`
            );
          }
          const responsePayload = await response.json();
          const updatedDistribution = responsePayload?.data || responsePayload;
          setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
          await sendStatusEmailSafe({
            statusLabel: "Received",
            message: "Your supply request has been released and received.",
          });
          window.location.reload();
          return;
        }

        if (action === "decline") {
          const response = await fetch(
            `${BASE_URL}/distribute/distributions/${inv._id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "Declined",
                requeststatus: "Declined",
                remarks: declineReasonText || inv.remarks || "",
                __v: inv.__v,
              }),
            }
          );
          if (!response.ok) {
            throw new Error(
              `Failed to decline distribution: ${response.status} ${response.statusText}`
            );
          }
          const responsePayload = await response.json();
          const updatedDistribution = responsePayload?.data || responsePayload;
          setState((prev) => ({ ...prev, inventory: [updatedDistribution] }));
          await sendStatusEmailSafe({
            statusLabel: "Declined",
            message: declineReasonText || "Your supply request was declined.",
          });
          openDeclineSuccessPopup("Successfully declined.");
          return;
        }

        return;
      }

      /* ========== 2. PROPERTY / PTR / DISPOSAL BRANCH (NON-DISTRIBUTION) ========== */
      if (action === "approve") {
        if (isDisposal) {
          if (currentStatus === "For Approval") {
            updatedRequestStatus = "For Approval - AFD";
            date_checked = new Date();
            history.push({
              name: approver?.username || approver?.name || rdRoleLabel,
              from: inv?.date_acquired || inv?.date_issued || inv?.createdAt,
              to: new Date().toISOString(),
              reason: inv?.disposal_reason || inv?.reason || "Recommended for disposal",
              remarks: inv?.disposal_notes || `Forwarded to ${afdRoleLabel} for approval.`,
            });
          } else if (currentStatus === "For Approval - AFD") {
            updatedRequestStatus = "Received";
            resultingStatus = "Disposed";
            date_approved = new Date();

            history.push({
              name: afd?.username || afd?.name || afdRoleLabel,
              from: inv?.date_acquired || inv?.date_issued || inv?.createdAt,
              to: new Date().toISOString(),
              reason: inv?.disposal_reason || inv?.reason || "Approved for disposal",
              remarks: inv?.disposal_notes || `Disposed upon approval by ${afdRoleLabel}.`,
            });
          }
        } else if (isIssue) {
          if (currentStatus === "For Approval") {
            updatedRequestStatus = "To receive";
            date_approved = new Date();
            history.push({
              name:
                signatoryName(icsIssuanceApprover) ||
                meUsername ||
                invAdminRoleLabel,
              from: inv?.date_requested || inv?.date_acquired || inv?.createdAt || new Date().toISOString(),
              to: new Date().toISOString(),
              reason: "Issue approved and released for receiving.",
              remarks: inv?.remarks || "",
              doc_type: issuanceDocType,
              doc_snapshot: buildDocSnapshot(inv, {
                requeststatus: "To receive",
                status: inv?.status || "For Issue",
                date_approved: new Date().toISOString(),
              }),
            });
          } else if (currentStatus === "To receive" || currentStatus === "") {
            updatedRequestStatus = "Received";
            resultingStatus = "Issued";
            date_received = new Date();
            date_issued = new Date();

            if (shouldUpdateCurrentHolder && (inv?.issued_to || inv?.issued_to_id)) {
              current_holder = inv?.issued_to || inv?.issued_to_id;
              current_holder_id =
                inv?.issued_to_id ||
                (looksLikeObjectId(inv?.issued_to) ? inv?.issued_to : null);
            }
          }
        } else if (isReturnToInventory) {
          if (currentStatus === "For Approval") {
            updatedRequestStatus = "To receive";
            date_approved = new Date();
            history.push({
              name: approver?.username || approver?.name || rdRoleLabel,
              from: inv?.date_requested || inv?.date_acquired || inv?.createdAt || new Date().toISOString(),
              to: new Date().toISOString(),
              reason: inv?.reason || "Return to inventory approved for receiving.",
              remarks: inv?.remarks || "",
              doc_type: "RTI",
              doc_snapshot: buildDocSnapshot(inv, {
                requeststatus: "To receive",
                status: inv?.status || "For Return to Inventory",
                date_approved: new Date().toISOString(),
              }),
            });
          } else if (currentStatus === "To receive" || currentStatus === "") {
            updatedRequestStatus = "Received";
            resultingStatus = "In Stock";
            date_received = new Date();
            current_holder = null;
            current_holder_id = null;
          }
        } else {
          if (
            isSeTransfer &&
            ["For Approval", "For Release"].includes(currentStatus)
          ) {
            date_approved = new Date();
            if (isOtherAgencyTransfer) {
              updatedRequestStatus = "Received";
              resultingStatus = "Transferred";
              date_received = new Date();
              transfertype = "transferred";
            } else {
              updatedRequestStatus = "To receive";
            }
            history.push({
              name:
                signatoryName(icsTransferApprover) ||
                meUsername ||
                invAdminRoleLabel,
              from:
                inv?.date_requested ||
                inv?.date_issued ||
                inv?.date_acquired ||
                inv?.createdAt ||
                new Date().toISOString(),
              to: new Date().toISOString(),
              reason: inv?.reason || "SE transfer approved for receiving.",
              remarks: inv?.remarks || "",
              doc_type: "ICS",
              doc_snapshot: buildDocSnapshot(inv, {
                requeststatus: isOtherAgencyTransfer ? "Received" : "To receive",
                status: isOtherAgencyTransfer ? "Transferred" : inv?.status || "For transfer",
                date_approved: new Date().toISOString(),
                ...(isOtherAgencyTransfer
                  ? { date_received: new Date().toISOString(), transfertype: "transferred" }
                  : {}),
              }),
            });
          } else if (currentStatus === "For Approval") {
            updatedRequestStatus = "For Release";
            date_approved = new Date();
          } else if (currentStatus === "For Release") {
            if (isOtherAgencyTransfer) {
              updatedRequestStatus = "Received";
              resultingStatus = "Transferred";
              date_released = new Date();
              transfertype = "transferred";

              history.push({
                name: otherAgencyTarget || "Other Agency",
                from: inv?.date_issued || inv?.date_acquired || inv?.createdAt,
                to: new Date().toISOString(),
                reason:
                  inv?.reason || `Transferred to other agency: ${otherAgencyTarget || ""}`,
                remarks: inv?.disposal_notes || "Transfer to other agency completed.",
                doc_type: isSeTransfer ? "ICS" : "PTR",
                doc_snapshot: buildDocSnapshot(inv, {
                  requeststatus: "Received",
                  status: "Transferred",
                  date_released: new Date().toISOString(),
                  transfertype: "transferred",
                }),
              });
            } else {
              updatedRequestStatus = "To receive";
              date_released = new Date();
            history.push({
              name:
                signatoryName(ptrReleaser) ||
                meUsername ||
                invAdminRoleLabel,
              from: inv?.date_requested || inv?.date_acquired || inv?.createdAt || new Date().toISOString(),
              to: new Date().toISOString(),
              reason: inv?.reason || "Released for receiving.",
              remarks: inv?.remarks || "",
                doc_type: isSeTransfer ? "ICS" : "PTR",
                doc_snapshot: buildDocSnapshot(inv, {
                  requeststatus: "To receive",
                  status: inv?.status || "For transfer",
                  date_released: new Date().toISOString(),
                }),
              });
            }
          } else if (currentStatus === "To receive" || currentStatus === "") {
            updatedRequestStatus = "Received";
            resultingStatus = isReturnToIssuedTransfer ? "Issued" : "Transferred";
            date_received = new Date();
            if (!isReturnToIssuedTransfer) {
              transfertype = "transferred";
            }

            history.push({
              name:
                transferRecipientName ||
                otherAgencyTarget ||
                currentHolderResolved ||
                issuedToResolved ||
                "Recipient",
              from:
                inv?.date_released ||
                inv?.date_requested ||
                inv?.date_issued ||
                inv?.createdAt,
              to: new Date().toISOString(),
              reason: inv?.reason,
              remarks: "Transfer received and acknowledged.",
              doc_type: isSeTransfer ? "ICS" : "PTR",
              doc_snapshot: buildDocSnapshot(inv, {
                requeststatus: "Received",
                status: isReturnToIssuedTransfer ? "Issued" : "Transferred",
                date_received: new Date().toISOString(),
                ...(!isReturnToIssuedTransfer ? { transfertype: "transferred" } : {}),
              }),
            });

            const nextTransferHolder =
              inv?.transfered_to_id ||
              inv?.transferedto_id ||
              inv?.transferred_to_id ||
              inv?.transfered_to ||
              inv?.transferedto ||
              inv?.transferred_to ||
              null;
            if (shouldUpdateCurrentHolder && nextTransferHolder) {
              current_holder = nextTransferHolder;
              current_holder_id =
                inv?.transfered_to_id ||
                inv?.transferedto_id ||
                inv?.transferred_to_id ||
                (looksLikeObjectId(nextTransferHolder) ? nextTransferHolder : null);
            }
          }
        }
      } else if (action === "decline") {
        const filteredHistory = (inv?.history || []).filter((h) => {
          const txt = `${h?.remarks || ""} ${h?.reason || ""}`.toLowerCase();
          return !txt.includes("transfer was declined") && !txt.includes("disposal was declined");
        });
        const todayISO = new Date().toISOString();
        const declineReason = declineReasonText;
        const declineActor = currentHolderResolved || issuedToResolved || transferedToResolved || "";

        updatedRequestStatus = "Declined";
        const normalizedStatus = String(inv?.status || "").toLowerCase();
        const hasHolder = Boolean(inv?.issued_to || inv?.current_holder);
        const fallbackStatus = hasHolder ? "Issued" : "Instock";
        if (normalizedStatus.includes("transfer") || normalizedStatus.includes("disposal")) {
          resultingStatus = fallbackStatus;
        } else if (normalizedStatus.includes("issue")) {
          resultingStatus = "Instock";
        } else if (isReturnToInventory) {
          resultingStatus = "Issued";
        }

        remarks = declineReason
          ? `${inv?.remarks ? `${inv.remarks} ` : ""}[Declined] ${declineReason}`
          : inv?.remarks || "";

        history = filteredHistory;
        history.push({
          name: isDisposal ? declineActor : otherAgencyTarget || transferedToResolved || declineActor,
          from: todayISO,
          to: todayISO,
          reason: isDisposal
            ? `Disposal was declined because: ${declineReason}`
            : isReturnToInventory
            ? `Return to inventory was declined because: ${declineReason}`
            : `Transfer was declined because: ${declineReason}`,
        });
      }

      if (
        !updatedRequestStatus &&
        !resultingStatus &&
        !date_checked &&
        !date_approved &&
        !date_released &&
        !date_received &&
        !date_issued &&
        !remarks &&
        !transfertype &&
        !current_holder &&
        history.length === (inv?.history || []).length
      ) {
        return;
      }

      const shouldClearReturnFields =
        isReturnToInventory && resultingStatus === "In Stock";
      const body = {
        ...(updatedRequestStatus && { requeststatus: updatedRequestStatus }),
        ...(resultingStatus && { status: resultingStatus }),
        ...(date_checked && { date_checked: formatDate(date_checked) }),
        ...(date_approved && { date_approved: formatDate(date_approved) }),
        ...(date_released && { date_released: formatDate(date_released) }),
        ...(date_received && { date_received: formatDate(date_received) }),
        ...(date_issued && { date_issued: formatDate(date_issued) }),
        ...(remarks && { remarks }),
        ...(action === "decline" && isDisposal
          ? { disposal_reason: "", disposal_notes: "" }
          : {}),
        ...(history && history.length > 0 ? { history } : {}),
        ...(transfertype ? { transfertype } : {}),
        ...(current_holder ? { current_holder } : {}),
        ...(current_holder_id !== undefined ? { current_holder_id } : {}),
        ...(shouldClearReturnFields
          ? {
              issued_to: null,
              issued_to_id: null,
              current_holder: null,
              current_holder_id: null,
              transfered_to: null,
              transfered_to_id: null,
              transferred_to_id: null,
              transfer_type: "",
              transfer_target: "",
            }
          : {}),
        __v: inv.__v,
      };

      const response = await fetch(`${usedURL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status} ${response.statusText}`);
      }

      const updatedInventory = await response.json();
      setState((prev) => ({ ...prev, inventory: [updatedInventory] }));
      await sendStatusEmailSafe({
        statusLabel: updatedRequestStatus || resultingStatus || "Updated",
        message:
          action === "decline"
            ? declineReasonText || "Your request was declined."
            : updatedRequestStatus === "For Approval - AFD"
            ? `Your disposal request was reviewed and forwarded to ${afdRoleLabel} for approval.`
            : updatedRequestStatus === "For Release"
            ? "Your request has been approved and is queued for release."
            : updatedRequestStatus === "To receive"
            ? isIssue
              ? "Your issue request has been approved and is ready to receive."
              : isReturnToInventory
              ? "Your return-to-inventory request has been approved and is ready to receive."
              : isSeTransfer
              ? "The SE transfer ICS has been approved and is ready for receiver acknowledgment."
              : "Your request has been released and is ready to receive."
            : updatedRequestStatus === "Received"
            ? isReturnToInventory
              ? "The item has been returned to inventory."
              : "Your request has been completed."
            : "Your request status has been updated.",
      });
      if (action === "approve") {
        await sendNextApproverEmailSafe(updatedRequestStatus || resultingStatus);
      }
      if (action === "decline") {
        openDeclineSuccessPopup("Successfully declined.");
        return;
      }
      window.location.reload();
    } catch (err) {
      console.error("Error updating status:", err);
      setState((prev) => ({ ...prev, error: err }));
    } finally {
      setActionBusy(false);
      setShowModal(false);
      setReason("");
    }
  };

  /* ---------- currency ---------- */
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
      Number(value || 0)
    );

  /* ---------- PRINT HELPERS (RIS + PTR) ---------- */
  const ENTITY_NAME = "DICT REGIONAL OFFICE 02";
  const safe = (v, fallback = "") => (v !== null && v !== undefined && v !== "" ? v : fallback);
  const esc = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
  const fdate = (val) => fdateDMY(val) || "";
  const dashIfEmpty = (v, dash = "—") => (v ? v : dash);
  const supplyProjectNames = Array.from(
    new Set(
      (Array.isArray(inv?.items) ? inv.items : [])
        .map((item) => {
          const rid = String(item?.returnId || item?.return_id || item?.returnID || "");
          return item?.project || supplyProjectsById[rid] || "";
        })
        .filter(Boolean)
    )
  );
  const supplyProjectName = supplyProjectNames.join(" / ");
  const projectName = safe((isDistribution ? supplyProjectName : "") || inv.project || "", "");
  const fundCluster = safe(projectName || "eLGU", "");
  const requestorIdRaw =
    inv?.requested_by_id || inv?.requestor_id || inv?.requested_by || inv?.requestor;
  const requestorUser =
    (requestorIdRaw && usersById[String(requestorIdRaw)]) ||
    (Array.isArray(users)
      ? users.find(
          (u) =>
            u?._id === requestorIdRaw ||
            u?.username === requestorIdRaw ||
            u?.email === requestorIdRaw
        )
      : null);
  const requestorOffice =
    requestorUser?.designation || requestorUser?.office || "";

  const office =
    safe(
      requestorOffice ||
        inv.requested_by_office ||
        inv.requestor_office ||
        inv.office ||
        inv.requested_by_designation ||
        inv.requestor_designation ||
        inv.designation,
      "—"
    ) || "—";
  const division = office;

  const risNo = safe(inv.RIS_no || inv.ris_no, "—");

  const computeItems = (invObj) => {
    if (Array.isArray(invObj?.items) && invObj.items.length) {
      return invObj.items.map((it, idx) => ({
        no: idx + 1,
        stockNo: safe(it.stock_no ?? it.returnId ?? it.return_id ?? idx + 1, ""),
        unit: safe(it.unitofmeasure || it.unit || "Pcs", ""),
        qtyReq: safe(it.quantity || it.qty || 1, ""),
        desc: safe(it.itemName || it.description || "", ""),
        qtyIss: safe(it.quantity || it.qty || 1, ""),
      }));
    }
    return [
      {
        no: 1,
        stockNo: safe(invObj?.stock_no || invObj?.property_no || "1", ""),
        unit: safe(invObj?.unitofmeasure || "Pcs", ""),
        qtyReq: safe(invObj?.qty || invObj?.quantity || 1, ""),
        desc: safe(invObj?.itemName || invObj?.description || "", ""),
        qtyIss: safe(invObj?.qty || invObj?.quantity || 1, ""),
      },
    ];
  };

  const items = computeItems(inv);

  const requestedByName = isDistribution
    ? recipientDistributedNameResolved || ""
    : inv?.requested_by || inv?.requestedby || inv?.requestor || issuedToResolved || "";

  const requestedByDesignation =
    (isDistribution ? office : "") ||
    inv?.requested_by_designation ||
    inv?.requestor_designation ||
    inv?.designation ||
    (isDistribution ? inv?.office || "Requesting Officer" : "Requesting Officer");

  const requestedDate =
    fdate(inv?.date_requested || inv?.date_issued || inv?.createdAt) || "__________";

  // SIGNATORIES (Print) - Generic
  const propertyApproverForDocument = isReturnToInventory ? approver : ptrApprover;
  let approvedByName = signatoryName(propertyApproverForDocument);
  let approvedByDesignation = signatoryRole(
    propertyApproverForDocument,
    rdRoleLabel
  );

  const releaserUser = ptrReleaser || (releasers && releasers[0]) || null;
  let issuedByName = (releaserUser && (releaserUser.username || releaserUser.name)) || "";
  let issuedByDesignation =
    (releaserUser && (releaserUser.position || releaserUser.role)) || invAdminRoleLabel;

  const rdApprovedByName = (approver && (approver.username || approver.name)) || "";
  const rdApprovedByDesignation =
    (approver && (approver.position || approver.role)) || rdRoleLabel;
  const afdApprovedByName = (afd && (afd.username || afd.name)) || "";
  const afdApprovedByDesignation = (afd && (afd.position || afd.role)) || afdRoleLabel;

  if (isDisposal && isPropertyPTR) {
    approvedByName = afdApprovedByName;
    approvedByDesignation = afdApprovedByDesignation;
    issuedByName = "";
    issuedByDesignation = "";
  }
  if (isPropertyPTR && (isIssue || isSeTransfer)) {
    const icsApprover = isSeTransfer ? icsTransferApprover : icsIssuanceApprover;
    issuedByName = signatoryName(icsApprover, issuedByName);
    issuedByDesignation = signatoryRole(icsApprover, invAdminRoleLabel);
  }

  // RIS signatories
  const risApprovedByName = signatoryName(risApprover);
  const risApprovedByDesignation = signatoryRole(risApprover, afdRoleLabel);

  const risIssuedByName = signatoryName(risChecker);
  const risIssuedByDesignation = signatoryRole(risChecker, invAdminRoleLabel);

  const dateApprovedValue = fdate(inv?.date_approved) || "__________";
  const dateCheckedValue = fdate(inv?.date_checked) || "__________";
  const dateReleasedValue = fdate(inv?.date_released) || "__________";

  const receivedByName = isDisposal
    ? ""
    : isDistribution
    ? recipientDistributedNameResolved || ""
    : isReturnToInventory
    ? invAdminName
    : isIssue
    ? issueRecipientName
    : transferRecipientDisplayName || "";
  const receivedByDesignation = isDisposal
    ? ""
    : isDistribution
    ? distributionRecipientRole
    : isReturnToInventory
    ? invAdminRole
    : isIssue
    ? issueRecipientRole
    : transferRecipientDisplayRole ||
      inv?.received_by_designation ||
      "End-User / Recipient";
  const dateReceivedValue = fdate(inv?.date_received) || "__________";
  const icsIssuedDateValue =
    fdate(inv?.date_issued || inv?.date_approved || inv?.date_released) ||
    fdate(inv?.createdAt) ||
    "__________";
  const icsReceivedDateValue =
    fdate(inv?.date_received || inv?.date_approved || inv?.date_issued) ||
    fdate(inv?.createdAt) ||
    "__________";

  // RIS purpose is a dedicated request field. Never fall back to remarks for
  // distributions because Edit Request appends its audit log to remarks.
  const purpose = safe(
    isDistribution
      ? inv?.purpose || ""
      : inv?.purpose || inv?.reason || inv?.disposal_reason || inv?.remarks || "",
    ""
  );

  // RIS rows (for distributions)
  const itemsRowsHTML = items
    .map(
      (row) => `
        <tr>
          <td class="tc">${esc(String(row.stockNo))}</td>
          <td class="tc">${esc(String(row.unit))}</td>
          <td class="tc">${esc(String(row.qtyReq))}</td>
          <td class="desc">${esc(String(row.desc))}</td>
          <td class="tc">${esc(String(row.qtyIss))}</td>
          <td>&nbsp;</td>
        </tr>`
    )
    .join("");

  const blankRowsHTML = Array.from({ length: Math.max(0, 10 - items.length) })
    .map(
      () => `
        <tr>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        </tr>`
    )
    .join("");

  // PTR rows (for property)
  const ptrUnitCost =
    inv?.unit_cost ||
    inv?.unitCost ||
    (inv?.total_cost && (inv?.qty || inv?.quantity)
      ? inv.total_cost / (inv.qty || inv.quantity)
      : 0);

  const ptrQty = inv?.qty || inv?.quantity || 1;
  const ptrTotal = inv?.total_cost || inv?.totalCost || ptrQty * Number(ptrUnitCost || 0);
  const icsNo = safe(inv?.ICS_no || inv?.ics_no, "—");
  const parNo = safe(inv?.PAR_no || inv?.par_no, "—");
  const issuanceNo = isParIssue ? parNo : icsNo;
  const ptrNo = safe(inv?.PTR_no || inv?.ptr_no, "—");
  const batchNo = safe(inv?.batch_no || "", "");
  const specifications = safe(inv?.specifications || "", "");
  const withSpecs = (base) =>
    specifications ? [base, `Specs: ${specifications}`].filter(Boolean).join(" | ") : base;
  const icsQty = inv?.qty || inv?.quantity || 1;
  const icsUnitCost =
    inv?.unit_cost ||
    inv?.unitCost ||
    (inv?.total_cost && icsQty ? inv.total_cost / icsQty : 0);
  const icsTotal = inv?.total_cost || inv?.totalCost || icsQty * Number(icsUnitCost || 0);
  const icsItemNo = inv?.property_no || inv?.stock_no || "";
  const icsDescBase = inv?.itemName || inv?.description || "";
  const icsDesc = withSpecs(icsDescBase);
  const ptrDescBase = inv?.itemName || inv?.description || "";
  const ptrDesc = withSpecs(ptrDescBase);
  const issuedToUser = isSeTransfer
    ? transferedToRecord
    : issuedToRecord || currentHolderRecord || null;
  const issuedToDesignation =
    resolveUserRoleLabel(issuedToUser, "End-User / Recipient");
  const custodianRecipientName = isSeTransfer
    ? transferRecipientDisplayName
    : issueRecipientName;
  const custodianRecipientRole = isSeTransfer
    ? transferRecipientDisplayRole
    : issueRecipientRole || issuedToDesignation;
  const icsUsefulLife = safe(
    inv?.estimated_useful_life || inv?.useful_life || inv?.estimated_useful_life_years,
    "—"
  );

  const ptrItems = [
    {
      dateAcquired:
        fdate(inv?.date_acquired || inv?.date_purchased || inv?.date_issued || inv?.createdAt) ||
        "",
      propertyNo: inv?.property_no || inv?.stock_no || "",
      description: ptrDesc,
      qty: ptrQty,
      unitCost: ptrUnitCost || 0,
      totalCost: ptrTotal || 0,
      condition: isDisposal ? "For Disposal" : inv?.condition || "Serviceable",
      reason:
        purpose ||
        (isDisposal
          ? "For disposal"
          : isOtherAgencyTransfer
          ? `Transfer to other agency: ${otherAgencyTarget || ""}`
          : "For office use."),
    },
  ];

  const ptrRowsHTML = ptrItems
    .map(
      (row) => `
        <tr>
          <td class="tc">${esc(row.dateAcquired)}</td>
          <td class="tc">${esc(row.propertyNo)}</td>
          <td class="desc">${esc(row.description)}</td>
          <td class="tc">${esc(String(row.qty))}</td>
          <td class="tc">${esc(formatCurrency(row.unitCost).replace("₱", "₱ "))}</td>
          <td class="tc">${esc(formatCurrency(row.totalCost).replace("₱", "₱ "))}</td>
          <td class="tc">${esc(row.condition)}</td>
          <td class="desc">${esc(row.reason)}</td>
        </tr>`
    )
    .join("");

  const ptrBlankRowsHTML = Array.from({ length: Math.max(0, 12 - ptrItems.length) })
    .map(
      () => `
        <tr>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        </tr>`
    )
    .join("");

  const sdrReason = safe(
    inv?.disposal_reason || inv?.disposal_notes || inv?.remarks || "For disposal",
    ""
  );
  const sdrRowsHTML = items
    .map(
      (row) => `
        <tr>
          <td class="tc">${esc(String(row.stockNo))}</td>
          <td class="tc">${esc(String(row.unit))}</td>
          <td class="tc">${esc(String(row.qtyReq))}</td>
          <td class="desc">${esc(String(row.desc))}</td>
          <td class="desc">${esc(sdrReason)}</td>
        </tr>`
    )
    .join("");

  const sdrBlankRowsHTML = Array.from({ length: Math.max(0, 12 - items.length) })
    .map(
      () => `
        <tr>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        </tr>`
    )
    .join("");

  const ptrFromLabel = fromAccountable || "________________";
  const ptrToLabelValue = isDisposal ? "For Disposal" : toAccountable || "________________";

  const handlePrintForm = ({ unsigned = false } = {}) => {
    try {
      const pri = window.open("", "", "width=1000,height=800");
      if (!pri) return;
      // An unsigned RIS is ready for manual signing: show the designated
      // officers and recipient, but leave every signature date blank.
      const printableRisIssuedByName = risIssuedByName;
      const printableRisApprovedByName = risApprovedByName;
      const printableReceivedByName = receivedByName;
      const printableReceivedByDesignation = receivedByDesignation;
      const printableDateChecked = unsigned ? "__________" : dateCheckedValue;
      const printableDateApproved = unsigned ? "__________" : dateApprovedValue;
      const printableDateReceived = unsigned ? "__________" : dateReceivedValue;

      // (PRINT HTML unchanged below — kept exactly as you had it)
      // ... your existing print templates continue ...
      // NOTE: I’m keeping your print templates as-is to avoid breaking layouts.

      // BEGIN (unchanged) — your original huge print templates:
      if (isPropertyPTR && (isIssue || isSeTransfer)) {
        pri.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(issuanceDocumentName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.4;
    }
    @page { size: A4; margin: 12mm; }

    .paper { background:#ffffff; border:none; padding:0; }
    .bar { display:flex; align-items:center; justify-content:space-between;
           padding:10px 0; border-bottom:1px solid #e2e8f0; }
    .brand { display:flex; align-items:center; gap:10px; }
    .brand-logo { height:22px; width:22px; display:flex; align-items:center; justify-content:center;
                  background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; padding:2px; }
    .brand-title { font-weight:800; font-size:12px; letter-spacing:0.02em; color:#0f172a; }
    .brand-sub { font-style:italic; color:#475569; font-size:9px; }
    .bar-right { text-align:right; line-height:1.15; }
    .chip { display:inline-flex; align-items:center; gap:6px; background:#eef2ff; color:#4338ca;
            border:1px solid #e0e7ff; border-radius:999px; padding:4px 8px; font-weight:600;
            font-size:9px; letter-spacing:0.04em; text-transform:uppercase; }
    .chip-dot { width:6px; height:6px; border-radius:999px; background:#4f46e5; }
    .tiny-note { color:#64748b; font-size:9px; }

    .header { text-align:center; margin:8px 0 10px 0; }
    .logo { height:34px; object-fit:contain; margin:2px auto 4px auto; display:block; }
    .header-lines .a { font-weight:700; font-style:italic; font-size:10px; }
    .header-lines .b { font-weight:800; font-size:11px; }
    .header-lines .c { font-weight:700; font-style:italic; font-size:10px; letter-spacing:0.02em; }
    .header-lines .d { font-style:italic; font-size:9px; color:#475569; }
    .ics-title { margin-top:6px; font-size:14px; font-weight:900; letter-spacing:0.18em; color:#0f172a; }

    table { border-collapse: collapse; width:100%; }
    .meta td { padding:4px 4px; font-size:10px; }
    .meta .label { text-transform:uppercase; font-size:9px; color:#64748b; letter-spacing:0.08em; }
    .meta .value { font-weight:700; color:#0f172a; }

    .items thead th { border:1px solid #e2e8f0; padding:6px 6px; background:#f1f5f9;
                      font-weight:700; text-transform:uppercase; letter-spacing:0.06em; font-size:10px;
                      color:#0f172a; text-align:center; }
    .items tbody td { border:1px solid #e2e8f0; padding:8px 6px; font-size:10px; }
    .tc { text-align:center; }
    .desc { font-style:italic; }

    .sigs { margin-top:16px; }
    .sigs thead th { border:1px solid #e2e8f0; background:#f8fafc; padding:6px 6px; font-weight:700; font-size:10px; color:#0f172a; }
    .sigs tbody td { border:1px solid #e2e8f0; padding:12px 6px; vertical-align:bottom; text-align:center; min-height:96px; }
    .sig-line { width:88%; border-top:1px solid #0f172a; margin:28px auto 4px auto; }
    .sig-name { font-weight:800; font-size:10px; color:#0f172a; }
    .sig-role, .sig-date { font-size:9px; color:#475569; font-style:italic; }
    .sig-date { margin-top:2px; }
  </style>
</head>
<body>
  <div class="paper">
    <div class="bar">
      <div class="brand">
        <div class="brand-logo">
          <img src="${esc(DICT)}" alt="DICT" style="height:16px;width:auto;" />
        </div>
        <div>
          <div class="brand-title">${esc(issuanceDocumentName.toUpperCase())}</div>
          <div class="brand-sub">Official ${esc(issuanceDocType)} • System-generated • Print copy</div>
        </div>
      </div>
      <div class="bar-right">
        <div class="chip"><span class="chip-dot"></span><span>${esc(issuanceDocType)}</span></div>
        <div class="tiny-note"><b>${isParIssue ? "Appendix 71" : "Appendix 59"}</b></div>
      </div>
    </div>

    <div class="header">
      <img class="logo" src="${esc(DICT)}" alt="DICT Logo" />
      <div class="header-lines">
        <div class="a">REPUBLIC OF THE PHILIPPINES</div>
        <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
        <div class="c">${esc(ENTITY_NAME)}</div>
        <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
      </div>
      <div class="ics-title">${esc(issuanceDocumentName.toUpperCase())}</div>
    </div>

    <table class="meta">
      <tr>
        <td style="width:50%;">
          <div class="label">Entity Name</div>
          <div class="value">${esc(ENTITY_NAME)}</div>
        </td>
        <td style="width:25%;">
          <div class="label">Fund Cluster</div>
          <div class="value">${esc(fundCluster)}</div>
        </td>
        <td style="width:25%;">
          <div class="label">${esc(issuanceDocType)} No.</div>
          <div class="value">${esc(issuanceNo)}</div>
        </td>
      </tr>
      <tr>
        <td style="width:50%;">
          <div class="label">Batch No.</div>
          <div class="value">${esc(batchNo || "—")}</div>
        </td>
        <td style="width:25%;">&nbsp;</td>
        <td style="width:25%;">&nbsp;</td>
      </tr>
      <tr>
        <td colspan="3">
          <div class="label">Specifications</div>
          <div class="value">${esc(specifications || "—")}</div>
        </td>
      </tr>
    </table>

    <table class="items" style="margin-top:10px;">
      <thead>
        ${
          isParIssue
            ? `<tr>
                <th>Quantity</th><th>Unit</th><th>Description</th>
                <th>Property Number</th><th>Date Acquired</th><th>Amount</th>
              </tr>`
            : `<tr>
                <th rowspan="2">Quantity</th><th rowspan="2">Unit</th>
                <th colspan="2">Amount</th><th rowspan="2">Description</th>
                <th rowspan="2">Inventory Item No.</th><th rowspan="2">Estimated Useful Life</th>
              </tr>
              <tr><th>Unit Cost</th><th>Total Cost</th></tr>`
        }
      </thead>
      <tbody>
        ${
          isParIssue
            ? `<tr>
                <td class="tc">${esc(String(icsQty))}</td>
                <td class="tc">${esc(String(inv?.unitofmeasure || "Pcs"))}</td>
                <td class="desc">${esc(icsDesc)}</td>
                <td class="tc">${esc(String(icsItemNo || "—"))}</td>
                <td class="tc">${esc(
                  fdate(inv?.date_acquired || inv?.date_purchased || inv?.createdAt) || "—"
                )}</td>
                <td class="tc">${esc(formatCurrency(icsTotal).replace("₱", "₱ "))}</td>
              </tr>`
            : `<tr>
                <td class="tc">${esc(String(icsQty))}</td>
                <td class="tc">${esc(String(inv?.unitofmeasure || "Pcs"))}</td>
                <td class="tc">${esc(formatCurrency(icsUnitCost).replace("₱", "₱ "))}</td>
                <td class="tc">${esc(formatCurrency(icsTotal).replace("₱", "₱ "))}</td>
                <td class="desc">${esc(icsDesc)}</td>
                <td class="tc">${esc(String(icsItemNo || "—"))}</td>
                <td class="tc">${esc(String(icsUsefulLife || "—"))}</td>
              </tr>`
        }
        ${Array.from({ length: Math.max(0, 10 - 1) })
          .map(
            () => `
        <tr>
          ${Array.from({ length: isParIssue ? 6 : 7 })
            .map(() => '<td class="tc">&nbsp;</td>')
            .join("")}
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <table class="sigs">
      <thead>
        <tr>
          <th>${isSeTransfer ? "Approved by" : isParIssue ? "Received by" : "Received from"}</th>
          <th>${isParIssue ? "Issued by" : "Received by"}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="sig-line"></div>
            <div class="sig-name">${esc(
              dashIfEmpty(
                isParIssue ? custodianRecipientName : issuedByName,
                "&nbsp;"
              )
            )}</div>
            <div class="sig-role">${esc(
              isParIssue
                ? custodianRecipientRole
                : issuedByDesignation || invAdminRoleLabel
            )}</div>
            <div class="sig-date">Date: ${esc(
              isParIssue
                ? icsReceivedDateValue
                : isSeTransfer
                ? dateApprovedValue
                : icsIssuedDateValue
            )}</div>
          </td>
          <td>
            <div class="sig-line"></div>
            <div class="sig-name">${esc(
              dashIfEmpty(
                isParIssue ? issuedByName : custodianRecipientName,
                "&nbsp;"
              )
            )}</div>
            <div class="sig-role">${esc(
              isParIssue
                ? issuedByDesignation || invAdminRoleLabel
                : custodianRecipientRole
            )}</div>
            <div class="sig-date">Date: ${esc(
              isParIssue ? icsIssuedDateValue : icsReceivedDateValue
            )}</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    window.focus();
    setTimeout(() => { window.print(); window.close(); }, 50);
  </script>
</body>
</html>`);
      } else if (isPropertyPTR) {
        pri.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(
    isDisposal
      ? "Property Disposal Request"
      : isReturnToInventory
      ? "Return to Inventory"
      : "Property Transfer Request"
  )}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.4;
    }
    @page { size: A4; margin: 10mm; }

    .frame { padding: 0; background: #ffffff; box-shadow: none; }
    .card  { background: #ffffff; border-radius: 0; }
    .body  { padding: 0; background: #ffffff; }
    .paper { background:#ffffff; border:none; border-radius:0; padding:10mm; width:100%; }

    .bar { display:flex; align-items:center; justify-content:space-between;
           padding:10px 0; border-bottom:1px solid #e2e8f0; background: #ffffff; }
    .brand { display:flex; align-items:center; gap:10px; }
    .brand-logo { height:22px; width:22px; display:flex; align-items:center; justify-content:center;
                  background:#ffffff; border:1px solid #e2e8f0; border-radius:4px;
                  padding:2px; }
    .brand-title { font-weight:800; font-size:12px; letter-spacing:0.02em; color:#0f172a; }
    .brand-sub { font-style:italic; color:#475569; font-size:9px; }
    .bar-right { text-align:right; line-height:1.15; }
    .chip { display:inline-flex; align-items:center; gap:6px; background:#eef2ff; color:#4338ca;
            border:1px solid #e0e7ff; border-radius:999px; padding:4px 8px; font-weight:600;
            font-size:9px; letter-spacing:0.04em; text-transform:uppercase; }
    .chip-dot { width:6px; height:6px; border-radius:999px; background:#4f46e5; }
    .tiny-note { color:#64748b; font-size:9px; }

    .header { text-align:center; margin:6px 0 10px 0; }
    .logo { height:34px; object-fit:contain; margin:2px auto 4px auto; display:block; }
    .header-lines .a { font-weight:700; font-style:italic; font-size:10px; }
    .header-lines .b { font-weight:800; font-size:11px; }
    .header-lines .c { font-weight:700; font-style:italic; font-size:10px; letter-spacing:0.02em; }
    .header-lines .d { font-style:italic; font-size:9px; color:#475569; }
    .ptr-title { margin-top:6px; font-size:14px; font-weight:900; letter-spacing:0.18em; color:#0f172a; }

    .meta-top { margin-top:10px; font-size:10px; }
    .meta-top table { width:100%; border-collapse:collapse; }
    .meta-top td { padding:4px 4px; vertical-align:middle; }
    .meta-top .label { text-transform:uppercase; font-size:9px; color:#64748b; letter-spacing:0.08em; }
    .meta-top .value { font-weight:700; color:#0f172a; }

    .meta-mid { margin-top:8px; font-size:10px; }
    .meta-mid table { width:100%; border-collapse:collapse; }
    .meta-mid td { padding:4px 4px; }

    .meta-mid .label { text-transform:uppercase; font-size:9px; color:#64748b; letter-spacing:0.08em; }
    .meta-mid .value { font-weight:700; color:#0f172a; }

    .meta-mid .right { text-align:right; }

    table { border-collapse: collapse; width:100%; }

    .items thead th { border:1px solid #e2e8f0; padding:6px 6px; background:#f1f5f9;
                      font-weight:700; text-transform:uppercase; letter-spacing:0.06em; font-size:10px;
                      color:#0f172a; text-align:center; }
    .items tbody td { border:1px solid #e2e8f0; padding:6px 6px; font-size:10px; }
    .tc { text-align:center; }
    .desc { font-style:italic; }

    .sigs { margin-top:14px; }
    .sigs thead th { border:1px solid #e2e8f0; background:#f8fafc; padding:6px 6px; font-weight:700; font-size:10px; color:#0f172a; }
    .sigs tbody td { border:1px solid #e2e8f0; padding:10px 6px; vertical-align:bottom; text-align:center; min-height:96px; }
    .sig-line { width:92%; border-top:1px solid #0f172a; margin:28px auto 4px auto; }
    .sig-name { font-weight:800; font-size:10px; color:#0f172a; }
    .sig-role, .sig-date { font-size:9px; color:#475569; font-style:italic; }
    .sig-date { margin-top:2px; }

    .foot { margin-top:10px; font-size:9px; color:#475569; font-style:italic; border-top:1px solid #e2e8f0; padding-top:8px; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="card">
      <div class="paper">
        <div class="bar">
          <div class="brand">
            <div class="brand-logo">
              <img src="${esc(DICT)}" alt="DICT" style="height:16px;width:auto;" />
            </div>
            <div>
              <div class="brand-title">${esc(
                isDisposal
                  ? "PROPERTY DISPOSAL REQUEST"
                  : isReturnToInventory
                  ? "RETURN TO INVENTORY"
                  : "PROPERTY TRANSFER REQUEST"
              )}</div>
              <div class="brand-sub">${
                isDisposal
                  ? "Official PDR • System-generated • Print copy"
                  : isReturnToInventory
                  ? "Official RTI • System-generated • Print copy"
                  : "Official PTR • System-generated • Print copy"
              }</div>
            </div>
          </div>
          <div class="bar-right">
            <div class="chip"><span class="chip-dot"></span><span>${esc(
              isDisposal ? "PDR" : isReturnToInventory ? "RTI" : "PTR"
            )}</span></div>
            <div class="tiny-note"><b>Office:</b> ${esc(office)} • <b>Cluster:</b> ${esc(
          fundCluster
        )}</div>
          </div>
        </div>

        <div class="header">
          <img class="logo" src="${esc(DICT)}" alt="DICT Logo" />
          <div class="header-lines">
            <div class="a">REPUBLIC OF THE PHILIPPINES</div>
            <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
            <div class="c">${esc(ENTITY_NAME)}</div>
            <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
          </div>
          <div class="ptr-title">${
            isDisposal
              ? "PROPERTY DISPOSAL REQUEST (PDR)"
              : isReturnToInventory
              ? "RETURN TO INVENTORY (RTI)"
              : "PROPERTY TRANSFER REQUEST (PTR)"
          }</div>
        </div>

        <div class="meta-top">
          <table>
            <tr>
              <td style="width:60%;">
                <div class="label">Entity Name</div>
                <div class="value">${esc(ENTITY_NAME)}</div>
              </td>
              <td style="width:40%;">
                <div class="label">Fund Cluster</div>
                <div class="value">${esc(fundCluster)}</div>
              </td>
            </tr>
          </table>
        </div>

        <div class="meta-mid">
          <table>
            <tr>
              <td style="width:60%;">
                <div class="label">From Accountable Officer / Agency / Fund Cluster (Current accountable)</div>
                <div class="value">${esc(ptrFromLabel)}</div>
              </td>
              <td style="width:40%;" class="right">
                <div class="label">${esc(
                  isDisposal ? "PDR No." : isReturnToInventory ? "RTI No." : "PTR No."
                )}</div>
                <div class="value">${esc(ptrNo)}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="label">${
                  isDisposal
                    ? "Accountable Officer / Agency / Fund Cluster"
                    : isReturnToInventory
                    ? "Return to Inventory"
                    : recipientHeadingLabel || "Pending transfer to"
                }</div>
                <div class="value">${esc(ptrToLabelValue)}</div>
              </td>
              <td class="right">
                <div class="label">Date</div>
                <div class="value">${esc(fdate(inv?.date_requested || inv?.createdAt) || "")}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="label">Batch No.</div>
                <div class="value">${esc(batchNo || "—")}</div>
              </td>
              <td class="right">
                <div class="label">Specifications</div>
                <div class="value">${esc(specifications || "—")}</div>
              </td>
            </tr>
            <tr>
              <td>
                <div class="label">${esc(isDisposal ? "Disposal Type" : "Transfer Type")}</div>
                <div class="value">${esc(
                  isDisposal
                    ? "Disposal of property"
                    : isOtherAgencyTransfer
                    ? "Transfer to other agency"
                    : "Transfer of property"
                )}</div>
              </td>
              <td class="right">&nbsp;</td>
            </tr>
          </table>
        </div>

        <table class="items" style="margin-top:10px;">
          <thead>
            <tr>
              <th>Date Acquired</th>
              <th>Property No.</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Cost</th>
              <th>Total Cost</th>
              <th>Condition</th>
              <th>${esc(isDisposal ? "Reason for Disposal" : "Reason for Issue / Transfer")}</th>
            </tr>
          </thead>
          <tbody>
            ${ptrRowsHTML}
            ${ptrBlankRowsHTML}
          </tbody>
        </table>

        <table class="sigs">
          <thead>
            <tr>
              <th>${esc(
                isDisposal
                  ? `Reviewed by (${rdRoleLabel})`
                  : isReturnToInventory
                  ? `Approved by (${rdRoleLabel})`
                  : "Approved by"
              )}</th>
              <th>${esc(
                isDisposal
                  ? `Approved for disposal by (${afdRoleLabel})`
                  : isReturnToInventory
                  ? `Received by (${invAdminRoleLabel})`
                  : "Released by"
              )}</th>
              <th>${esc(isDisposal || isReturnToInventory ? " " : "Received by")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="sig-line"></div>
                <div class="sig-name">${esc(
                  dashIfEmpty(isDisposal ? rdApprovedByName : approvedByName, "&nbsp;")
                )}</div>
                <div class="sig-role">${esc(
                  (isDisposal ? rdApprovedByDesignation : approvedByDesignation) ||
                    (isDisposal ? rdRoleLabel : rdRoleLabel)
                )}</div>
                <div class="sig-date">Date: ${esc(
                  isDisposal ? dateCheckedValue : dateApprovedValue
                )}</div>
              </td>
              <td>
                ${
                  isDisposal
                    ? `<div class="sig-line"></div>
                <div class="sig-name">${esc(dashIfEmpty(afdApprovedByName, "&nbsp;"))}</div>
                <div class="sig-role">${esc(afdApprovedByDesignation || afdRoleLabel)}</div>
                <div class="sig-date">Date: ${esc(dateApprovedValue)}</div>`
                    : `<div class="sig-line"></div>
                <div class="sig-name">${esc(dashIfEmpty(issuedByName, "&nbsp;"))}</div>
                <div class="sig-role">${esc(
                  isReturnToInventory
                    ? invAdminRoleLabel
                    : issuedByDesignation || afdRoleLabel
                )}</div>
                <div class="sig-date">Date: ${esc(
                  isReturnToInventory ? dateReceivedValue : fdate(inv?.date_released) || "__________"
                )}</div>`
                }
              </td>
              <td>
                ${
                  isDisposal || isReturnToInventory
                    ? "&nbsp;"
                    : `<div class="sig-line"></div>
                <div class="sig-name">${esc(dashIfEmpty(receivedByName, "&nbsp;"))}</div>
                <div class="sig-role">${esc(receivedByDesignation)}</div>
                <div class="sig-date">Date: ${esc(dateReceivedValue)}</div>`
                }
              </td>
            </tr>
          </tbody>
        </table>

        <div class="foot">
          This ${esc(isDisposal ? "PDR" : isReturnToInventory ? "RTI" : "PTR")} is system-generated by the DICT Region 02 Inventory System and is valid
          only upon affixing the required signatures of the ${
            isDisposal
              ? `${rdRoleLabel} and ${afdRoleLabel}`
              : isReturnToInventory
              ? `${rdRoleLabel} and ${invAdminRoleLabel}`
              : `${rdRoleLabel}, ${invAdminRoleLabel}, and the ${
                  isOtherAgencyTransfer ? "receiving agency" : "recipient"
                }`
          }.
        </div>
      </div>
    </div>
  </div>

  <script>
    window.focus();
    setTimeout(() => { window.print(); window.close(); }, 50);
  </script>
</body>
</html>`);
      } else if (isSupplyDisposal) {
        pri.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Supply Disposal Request</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.4;
    }
    @page { size: A4; margin: 10mm; }
    .paper { background:#ffffff; border:none; border-radius:0; padding:10mm; width:100%; }
    .header { text-align:center; margin:6px 0 10px 0; }
    .logo { height:34px; object-fit:contain; margin:2px auto 4px auto; display:block; }
    .header-lines .a { font-weight:700; font-style:italic; font-size:10px; }
    .header-lines .b { font-weight:800; font-size:11px; }
    .header-lines .c { font-weight:700; font-style:italic; font-size:10px; letter-spacing:0.02em; }
    .header-lines .d { font-style:italic; font-size:9px; color:#475569; }
    .title { margin-top:6px; font-size:14px; font-weight:900; letter-spacing:0.18em; color:#0f172a; }
    table { border-collapse: collapse; width:100%; }
    .meta td { padding:4px 4px; font-size:10px; }
    .label { text-transform:uppercase; font-size:9px; color:#64748b; letter-spacing:0.08em; }
    .value { font-weight:700; color:#0f172a; }
    .items thead th { border:1px solid #e2e8f0; padding:6px 6px; background:#f1f5f9;
                      font-weight:700; text-transform:uppercase; letter-spacing:0.06em; font-size:10px;
                      color:#0f172a; text-align:center; }
    .items tbody td { border:1px solid #e2e8f0; padding:6px 6px; font-size:10px; }
    .tc { text-align:center; }
    .desc { font-style:italic; }
    .sigs { margin-top:14px; }
    .sigs thead th { border:1px solid #e2e8f0; background:#f8fafc; padding:6px 6px; font-weight:700; font-size:10px; color:#0f172a; }
    .sigs tbody td { border:1px solid #e2e8f0; padding:10px 6px; vertical-align:bottom; text-align:center; min-height:96px; }
    .sig-line { width:92%; border-top:1px solid #0f172a; margin:28px auto 4px auto; }
    .sig-name { font-weight:800; font-size:10px; color:#0f172a; }
    .sig-role, .sig-date { font-size:9px; color:#475569; font-style:italic; }
    .sig-date { margin-top:2px; }
  </style>
</head>
<body>
  <div class="paper">
    <div class="header">
      <img class="logo" src="${esc(DICT)}" alt="DICT Logo" />
      <div class="header-lines">
        <div class="a">REPUBLIC OF THE PHILIPPINES</div>
        <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
        <div class="c">${esc(ENTITY_NAME)}</div>
        <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
      </div>
      <div class="title">SUPPLY DISPOSAL REQUEST (SDR)</div>
    </div>

    <table class="meta">
      <tr>
        <td style="width:60%;">
          <div class="label">Requested By</div>
          <div class="value">${esc(inv?.requested_by || requestedByName || "—")}</div>
        </td>
        <td style="width:40%;">
          <div class="label">Date</div>
          <div class="value">${esc(fdate(inv?.date_requested || inv?.createdAt) || "")}</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="label">Office / Unit</div>
          <div class="value">${esc(inv?.office || requestedByDesignation || "—")}</div>
        </td>
        <td>
          <div class="label">SDR No.</div>
          <div class="value">${esc(inv?.RIS_no || inv?._id || "—")}</div>
        </td>
      </tr>
    </table>

    <table class="items" style="margin-top:10px;">
      <thead>
        <tr>
          <th>Stock No.</th>
          <th>Unit</th>
          <th>Qty</th>
          <th>Description</th>
          <th>Reason for Disposal</th>
        </tr>
      </thead>
      <tbody>
        ${sdrRowsHTML}
        ${sdrBlankRowsHTML}
      </tbody>
    </table>

    <table class="sigs">
      <thead>
        <tr>
          <th>Approved by (${esc(afdRoleLabel)})</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="sig-line"></div>
            <div class="sig-name">${esc(afd?.username || afd?.name || "—")}</div>
            <div class="sig-role">${esc(afd?.position || afd?.role || afdRoleLabel)}</div>
            <div class="sig-date">Date: ${esc(dateApprovedValue)}</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    window.focus();
    setTimeout(() => { window.print(); window.close(); }, 50);
  </script>
</body>
</html>`);
      } else {
        pri.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Requisition and Issue Slip</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.4;
    }
    @page { size: A4; margin: 10mm; }

    .frame { padding: 0; background: #ffffff; box-shadow: none; }
    .card  { background: #ffffff; border-radius: 0; }
    .body  { padding: 0; background: #ffffff; }
    .paper { background:#ffffff; border:none; border-radius:0; padding:10mm; width:100%; }

    .bar { display:flex; align-items:center; justify-content:space-between;
           padding:10px 0; border-bottom:1px solid #e2e8f0; background: #ffffff; }
    .brand { display:flex; align-items:center; gap:10px; }
    .brand-logo { height:22px; width:22px; display:flex; align-items:center; justify-content:center;
                  background:#ffffff; border:1px solid #e2e8f0; border-radius:4px;
                  padding:2px; }
    .brand-title { font-weight:800; font-size:12px; letter-spacing:0.02em; color:#0f172a; }
    .brand-sub { font-style:italic; color:#475569; font-size:9px; }
    .bar-right { text-align:right; line-height:1.15; }
    .chip { display:inline-flex; align-items:center; gap:6px; background:#eef2ff; color:#4338ca;
            border:1px solid #e0e7ff; border-radius:999px; padding:4px 8px; font-weight:600;
            font-size:9px; letter-spacing:0.04em; text-transform:uppercase; }
    .chip-dot { width:6px; height:6px; border-radius:999px; background:#4f46e5; }
    .tiny-note { color:#64748b; font-size:9px; }

    .header { text-align:center; margin:6px 0 10px 0; }
    .logo { height:34px; object-fit:contain; margin:2px auto 4px auto; display:block; }
    .header-lines .a { font-weight:700; font-style:italic; font-size:10px; }
    .header-lines .b { font-weight:800; font-size:11px; }
    .header-lines .c { font-weight:700; font-style:italic; font-size:10px; letter-spacing:0.02em; }
    .header-lines .d { font-style:italic; font-size:9px; color:#475569; }
    .ris-title { margin-top:6px; font-size:14px; font-weight:900; letter-spacing:0.18em; color:#0f172a; }

    .meta-row { display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px; font-size:10px; }
    .meta-cell .label { text-transform:uppercase; color:#64748b; font-size:8px; letter-spacing:0.12em; }
    .meta-cell .value { font-weight:800; color:#0f172a; font-size:11px; }

    .form-code { text-align:right; font-size:9px; color:#475569; font-style:italic; margin-top:6px; }
    .divider { border-top:1px solid #e2e8f0; margin-top:8px; }

    table { border-collapse: collapse; width:100%; }
    .meta-table td { border:1px solid #e2e8f0; padding:6px 6px; vertical-align:middle; font-size:10px; }
    .meta-table .k { background:#f8fafc; font-weight:700; color:#0f172a; width:26%; }
    .meta-table .v { font-style:italic; }

    .items thead th { border:1px solid #e2e8f0; padding:6px 6px; background:#f1f5f9;
                      font-weight:700; text-transform:uppercase; letter-spacing:0.06em; font-size:10px;
                      color:#0f172a; text-align:center; }
    .items tbody td { border:1px solid #e2e8f0; padding:6px 6px; font-size:10px; }
    .tc { text-align:center; }
    .desc { font-style:italic; }

    .purpose { font-size:10px; margin-top:10px; }
    .purpose .label { font-weight:700; color:#0f172a; }
    .purpose .line { display:inline-block; min-width:70%; border-bottom:1px solid #334155;
                     padding-bottom:2px; margin-left:6px; font-style:italic; }

    .sigs { margin-top:14px; }
    .sigs thead th { border:1px solid #e2e8f0; background:#f8fafc; padding:6px 6px; font-weight:700; font-size:10px; color:#0f172a; }
    .sigs tbody td { border:1px solid #e2e8f0; padding:10px 6px; vertical-align:bottom; text-align:center; min-height:96px; }
    .sig-line { width:92%; border-top:1px solid #0f172a; margin:28px auto 4px auto; }
    .sig-name { font-weight:800; font-size:10px; color:#0f172a; }
    .sig-role, .sig-date { font-size:9px; color:#475569; font-style:italic; }
    .sig-date { margin-top:2px; }

    .foot { margin-top:10px; font-size:9px; color:#475569; font-style:italic; border-top:1px solid #e2e8f0; padding-top:8px; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="card">
      <div class="paper">
        <div class="bar">
          <div class="brand">
            <div class="brand-logo">
              <img src="${esc(DICT)}" alt="DICT" style="height:16px;width:auto;" />
            </div>
            <div>
              <div class="brand-title">REQUISITION AND ISSUE SLIP</div>
              <div class="brand-sub">Official RIS • System-generated • Print copy</div>
            </div>
          </div>
          <div class="bar-right">
            <div class="chip"><span class="chip-dot"></span><span>RIS</span></div>
            <div class="tiny-note"><b>RIS No.:</b> ${esc(risNo)} • <b>Office:</b> ${esc(office)}</div>
          </div>
        </div>

        <div class="header">
          <img class="logo" src="${esc(DICT)}" alt="DICT Logo" />
          <div class="header-lines">
            <div class="a">REPUBLIC OF THE PHILIPPINES</div>
            <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
            <div class="c">${esc(ENTITY_NAME)}</div>
            <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
          </div>
          <div class="ris-title">REQUISITION AND ISSUE SLIP</div>

          <div class="meta-row">
            <div class="meta-cell">
              <div class="label">RIS NO.</div>
              <div class="value">${esc(risNo)}</div>
            </div>
            <div class="meta-cell" style="text-align:right;">
              <div class="label">Office</div>
              <div class="value">${esc(office)}</div>
            </div>
          </div>
        </div>

        <div class="form-code"><b>Form Code:</b> RIS-01 • <b>Rev. 01</b> • Effectivity: ________</div>
        <div class="divider"></div>

        <table class="meta-table" style="margin-top:8px;">
          <tbody>
            <tr>
              <td class="k">Entity Name:</td>
              <td class="v" colspan="3"><b><i>${esc(ENTITY_NAME)}</i></b></td>
              <td class="k">Fund Cluster:</td>
              <td class="v"><b><i>${esc(fundCluster)}</i></b></td>
            </tr>
            <tr>
              <td class="k">Division:</td>
              <td class="v" colspan="3"><i>${esc(division)}</i></td>
              <td class="k">Responsibility Code:</td>
              <td class="v"><i>—</i></td>
            </tr>
            <tr>
              <td class="k">Office:</td>
              <td class="v" colspan="3"><i>${esc(office)}</i></td>
              <td class="k">RIS No.:</td>
              <td class="v"><b><i>${esc(risNo)}</i></b></td>
            </tr>
          </tbody>
        </table>

        <table class="items" style="margin-top:10px;">
          <thead>
            <tr>
              <th colspan="4">Requisition</th>
              <th colspan="3">Issuance Details</th>
            </tr>
            <tr>
              <th>Stock No.</th>
              <th>Unit of Measurement</th>
              <th>Qty. Requested</th>
              <th>Description</th>
              <th>Qty. Issued</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHTML}
            ${blankRowsHTML}
          </tbody>
        </table>

        <div class="purpose">
          <span class="label">Purpose:</span>
          <span class="line">${esc(purpose) || "&nbsp;"}</span>
        </div>

        <table class="sigs">
          <thead>
            <tr>
              <th>Checked by (${esc(risIssuedByDesignation || invAdminRoleLabel)})</th>
              <th>Approved by (${esc(risApprovedByDesignation || afdRoleLabel)})</th>
              <th>Received by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="sig-line"></div>
                <div class="sig-name">${esc(printableRisIssuedByName)}</div>
                <div class="sig-role">${esc(risIssuedByDesignation || invAdminRoleLabel)}</div>
                <div class="sig-date">Date: ${esc(printableDateChecked)}</div>
              </td>
              <td>
                <div class="sig-line"></div>
                <div class="sig-name">${esc(printableRisApprovedByName)}</div>
                <div class="sig-role">${esc(risApprovedByDesignation || afdRoleLabel)}</div>
                <div class="sig-date">Date: ${esc(printableDateApproved)}</div>
              </td>
              <td>
                <div class="sig-line"></div>
                <div class="sig-name">${esc(printableReceivedByName)}</div>
                <div class="sig-role">${esc(printableReceivedByDesignation)}</div>
                <div class="sig-date">Date: ${esc(printableDateReceived)}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="foot">
          This RIS is system-generated by the DICT Region 02 Inventory System and is valid
          only upon affixing the required signatures of the configured checker, configured approver, and recipient.
        </div>
      </div>
    </div>
  </div>

  <script>
    window.focus();
    setTimeout(() => { window.print(); window.close(); }, 50);
  </script>
</body>
</html>`);
      }
      // END (unchanged) print templates

      pri.document.close();
      pri.focus();
    } catch (e) {
      console.error("Print form failed:", e);
    }
  };

  const normalizedRequestStatus = String(requestStatus || "")
    .toLowerCase()
    .trim();
  const isDeclined = normalizedRequestStatus === "declined";
  const isCancelled = normalizedRequestStatus === "cancelled";

  const receiverName = isReturnToInventory
    ? invAdminName
    : isDistribution
    ? recipientDistributedNameResolved || "—"
    : isIssue
    ? issueRecipientName || "—"
    : transferRecipientDisplayName ||
      "—";
  const receiverRole = isReturnToInventory
    ? invAdminRole
    : isDistribution
    ? distributionRecipientRole
    : isIssue
    ? issueRecipientRole
    : transferRecipientDisplayRole;

  const stageItems = useMemo(() => {
    if (isDistribution && isSupplyDisposal) {
      return [
        {
          key: "approve",
          label: "AFD Approval",
          caption: `Approval by ${afdRoleLabel}`,
          name: afdName,
          role: afdRole,
          date: inv?.date_approved ? fdateDMY(inv.date_approved) : "__________",
        },
      ];
    }

    if (isDistribution) {
      return [
        {
          key: "check",
          label: "Inventory Check",
          caption: `Handled by ${signatoryName(risChecker, invAdminRoleLabel)}`,
          name: signatoryName(risChecker, invAdminRoleLabel),
          role: signatoryRole(risChecker, invAdminRoleLabel),
          date: inv?.date_checked ? fdateDMY(inv.date_checked) : "__________",
        },
        {
          key: "approve",
          label: "AFD Approval",
          caption: `Approval by ${signatoryName(risApprover, afdRoleLabel)}`,
          name: signatoryName(risApprover, afdRoleLabel),
          role: signatoryRole(risApprover, afdRoleLabel),
          date: inv?.date_approved ? fdateDMY(inv.date_approved) : "__________",
        },
        {
          key: "receive",
          label: "Recipient Confirmation",
          caption: "Receiving acknowledgment",
          name: receiverName,
          role: receiverRole,
          date: inv?.date_received ? fdateDMY(inv.date_received) : "__________",
        },
      ];
    }

    if (isDisposal) {
      return [
        {
          key: "review",
          label: "Disposal Review",
          caption: `Reviewed by ${rdRoleLabel}`,
          name: approverName,
          role: approverRole,
          date: inv?.date_checked ? fdateDMY(inv.date_checked) : "__________",
        },
        {
          key: "approve",
          label: "AFD Approval",
          caption: `Approval by ${afdRoleLabel}`,
          name: afdName,
          role: afdRole,
          date: inv?.date_approved ? fdateDMY(inv.date_approved) : "__________",
        },
      ];
    }

    const approvalLabel = isIssue || isSeTransfer ? "Inventory Approval" : "Director Approval";
    const configuredPropertyApprover = isIssue
      ? icsIssuanceApprover
      : isSeTransfer
      ? icsTransferApprover
      : ptrApprover;
    const approvalName = signatoryName(configuredPropertyApprover, approverName);
    const approvalRole = signatoryRole(configuredPropertyApprover, approverRole);

    const items = [
      {
        key: "approve",
        label: approvalLabel,
        caption: "Approval required",
        name: approvalName,
        role: approvalRole,
        date: inv?.date_approved ? fdateDMY(inv.date_approved) : "__________",
      },
    ];

    if (!isIssue && !isReturnToInventory && !isSeTransfer) {
      items.push({
        key: "release",
        label: "Release & Handover",
        caption: `Handled by ${signatoryName(ptrReleaser, invAdminRoleLabel)}`,
        name: signatoryName(ptrReleaser, invAdminRoleLabel),
        role: signatoryRole(ptrReleaser, invAdminRoleLabel),
        date: inv?.date_released ? fdateDMY(inv.date_released) : "__________",
      });
    }

    items.push({
      key: "receive",
      label: isReturnToInventory
        ? "Inventory Receipt"
        : isIssue
        ? "Issue Receipt"
        : isOtherAgencyTransfer
        ? "Agency Acknowledgment"
        : "Transfer Receipt",
      caption: isReturnToInventory
        ? `Received by ${invAdminRoleLabel}`
        : isIssue
        ? "Recipient acknowledgment"
        : isOtherAgencyTransfer
        ? "Receiving agency acknowledgment"
        : "Receiving acknowledgment",
      name: receiverName,
      role: receiverRole,
      date: inv?.date_received ? fdateDMY(inv.date_received) : "__________",
    });

    return items;
  }, [
    afdName,
    afdRole,
    approverName,
    approverRole,
    inv,
    icsIssuanceApprover,
    icsTransferApprover,
    isDistribution,
    isDisposal,
    isIssue,
    isSeTransfer,
    isOtherAgencyTransfer,
    isReturnToInventory,
    isSupplyDisposal,
    ptrApprover,
    ptrReleaser,
    receiverName,
    receiverRole,
    risApprover,
    risChecker,
  ]);

  const currentStageKey = useMemo(() => {
    const rs = normalizedRequestStatus;
    if (!rs) return stageItems[0]?.key;

    if (isDistribution && isSupplyDisposal) {
      if (rs.includes("approval")) return "approve";
      if (rs === "approved") return "receive";
      if (rs === "received") return "receive";
      return "approve";
    }

    if (isDistribution) {
      if (rs === "for checking") return "check";
      if (rs.includes("approval")) return "approve";
      if (rs === "approved") return "receive";
      if (rs === "received") return "receive";
      if (rs === "for release") return "approve";
      return "check";
    }

    if (isDisposal) {
      if (rs === "for approval") return "review";
      if (rs.includes("afd")) return "approve";
      if (rs === "approved") return "approve";
      return "review";
    }

    if (rs === "for approval") return "approve";
    if (rs === "for release") return "release";
    if (rs === "approved")
      return isIssue || isReturnToInventory ? "receive" : "release";
    if (rs === "to receive" || rs === "received") return "receive";
    return stageItems[0]?.key;
  }, [
    isDistribution,
    isSupplyDisposal,
    isDisposal,
    isIssue,
    isReturnToInventory,
    normalizedRequestStatus,
    stageItems,
  ]);

  const currentStageIndex = Math.max(
    0,
    stageItems.findIndex((item) => item.key === currentStageKey)
  );
  const isWorkflowComplete = useMemo(() => {
    if (isDeclined || isCancelled || !stageItems.length) return false;
    const rs = normalizedRequestStatus;
    const itemStatus = String(finalstatus || "").toLowerCase().trim();

    if (isDistribution && isSupplyDisposal) {
      return rs === "approved" || rs === "received" || itemStatus === "disposed";
    }

    if (isDistribution) return rs === "received";
    if (isDisposal) return rs === "received" || itemStatus === "disposed";
    if (isIssue) return rs === "received" || itemStatus === "issued";
    if (isReturnToInventory) return rs === "received";
    return rs === "received" || itemStatus === "transferred";
  }, [
    finalstatus,
    isCancelled,
    isDeclined,
    isDisposal,
    isDistribution,
    isIssue,
    isReturnToInventory,
    isSupplyDisposal,
    normalizedRequestStatus,
    stageItems.length,
  ]);
  const progressPercent =
    stageItems.length > 1
      ? isDeclined
        ? 0
        : isCancelled
        ? 0
        : isWorkflowComplete
        ? 100
        : (currentStageIndex / (stageItems.length - 1)) * 100
      : 100;

  /* ---------- render guards ---------- */
  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
        <section className="w-full px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            Error: {error.message || String(error)}
          </div>
        </section>
      </div>
    );
  }

  /* ---------- layout ---------- */
  const changePreviewLines = showEditModal
    ? getChangePreviewLines(editOrigItems, editItems, editOrigRemarks, editUserRemarks)
    : [];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 print-container">
      <section className="w-full px-4 sm:px-6 lg:px-8 py-10">
        <Breadcrumbs
          className="mb-4 print-hidden"
          items={[
            { label: "Office Dashboard", to: "/officedashboard" },
            { label: "Requests", to: "/request" },
            { label: "Request Details" },
          ]}
        />
        {/* ✅ Make this container the positioning context for the Edit modal */}
        <div className="w-full rounded-3xl bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)] border border-slate-200/80 px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-20 h-48 w-48 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-56 w-56 rounded-full bg-indigo-200/35 blur-3xl" />
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/70 pb-4 relative">
            <div className="flex items-center gap-4">
              <img
                src={DICT}
                alt="DICT Logo"
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/60"
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Request Overview
                </p>
                <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-light tracking-tight text-slate-900">
                  {isDistribution
                    ? isSupplyDisposal
                      ? "Supply Disposal Request"
                      : "Supply Transfer Request"
                    : isPropertyPTR
                    ? isDisposal
                      ? "Property Disposal Request"
                      : isIssue
                      ? issuanceDocumentName
                      : isReturnToInventory
                      ? "Return to Inventory"
                      : isSeTransfer
                      ? "Inventory Custodian Slip (ICS) Transfer"
                      : "Property Transfer Request (PTR)"
                    : "Property Transfer Request"}{" "}
                  <span className="font-semibold text-slate-900">Details</span>
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-slate-500">
                  {isDistribution
                    ? isSupplyDisposal
                      ? "Review, approve, decline, or print the Supply Disposal Request (SDR) for this record."
                      : "Review, approve, decline, print, generate RIS, or edit quantity/remarks (For checking only)."
                    : isDisposal
                    ? "Review, approve, decline, print, or generate a Property Disposal Request (PDR) for this record."
                    : isIssue
                    ? `Review, approve, decline, print, or generate a ${issuanceDocumentName} for this record.`
                    : isReturnToInventory
                    ? "Review, approve, decline, print, or generate a Return to Inventory form for this record."
                    : isSeTransfer
                    ? "Review, approve, decline, print, or generate the Inventory Custodian Slip (ICS) for this SE transfer."
                    : "Review, approve, decline, print, or generate a Property Transfer Request (PTR) for this record."}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-right text-xs sm:text-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[10px] sm:text-xs font-semibold text-white shadow-sm">
                <span className="h-2 w-2 rounded-full bg-sky-300" />
                Status: {requestStatus || "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500">
                Ref:{" "}
                <span className="font-semibold text-gray-800">
                  {inv?.property_no || inv?.returnId || id}
                </span>
              </div>
              {recipientName && !isDisposal && (
                <div className="text-[10px] sm:text-xs text-gray-500">
                  {recipientHeadingLabel || "To"}:{" "}
                  <span className="font-semibold text-gray-800">
                    {recipientName}
                  </span>
                </div>
              )}
              {isDisposal && inv?.disposal_reason && (
                <div className="text-[10px] sm:text-xs text-gray-500">
                  Disposal reason:{" "}
                  <span className="font-semibold text-gray-800">{inv.disposal_reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Property details (non-distribution) */}
          {!isDistribution && (
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Classification
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {inv?.classification || "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      PPE / SE
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {inv?.asset_type || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Asset ID
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {inv?.asset_id || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Quantity
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {inv?.qty ?? inv?.quantity ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Unit
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {inv?.unitofmeasure || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Item Description
                </p>
                <p className="text-sm font-semibold text-gray-900">{inv?.itemName || "—"}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Inclusions
                </p>
                <p className="text-sm text-gray-800">{inv?.inclusions || "None"}</p>
              </div>

              {!isDistribution && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Specifications
                  </p>
                  <p className="text-sm text-gray-800">{inv?.specifications || "None"}</p>
                </div>
              )}

              {(transferType || otherAgencyTarget || isDisposal) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Transfer / Disposal Type
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {isDisposal
                        ? "Disposal"
                        : isOtherAgencyTransfer
                        ? "Transfer to other agency"
                        : transferType || "Standard Transfer"}
                    </p>
                  </div>
                  {!isDisposal && recipientName && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        {recipientHeadingLabel || "To"}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {recipientName || "________________"}
                      </p>
                    </div>
                  )}
                  {isDisposal && inv?.disposal_reason && (
                    <div className="md:col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        Disposal Reason
                      </p>
                      <p className="text-sm text-gray-800">{inv.disposal_reason}</p>
                    </div>
                  )}
                  {isDisposal && inv?.disposal_notes && (
                    <div className="md:col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        Disposal Notes
                      </p>
                      <p className="text-sm text-gray-800">{inv.disposal_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Accountability FROM / TO card for equipment / ICT / furniture */}
          {isPropertyPTR && (
            <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-indigo-50/50 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                {isDisposal ? "Accountability Overview" : "Accountability Trail"}
              </p>
              <div
                className={`grid grid-cols-1 ${
                  isDisposal ? "md:grid-cols-2" : "md:grid-cols-3"
                } gap-4 text-xs sm:text-sm`}
              >
                {!isDisposal && (
                  <div className="rounded-xl bg-white border border-indigo-100/80 px-3 py-2 shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {isTransferTrail ? "Transferor" : "Issued to"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {(isTransferTrail ? transferorSummaryName : issuedToSummaryName) || "—"}
                    </p>
                  </div>
                )}
                {!isDisposal && (
                  <div className="rounded-xl bg-white border border-indigo-100/80 px-3 py-2 shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {isTransferTrail ? "Transferee" : "Transferred to"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {transferredToSummaryName || "—"}
                    </p>
                  </div>
                )}
                <div className="rounded-xl bg-white border border-indigo-100/80 px-3 py-2 shadow-sm">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    {isDisposal ? "Disposal Status" : "Accountable owner"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {isDisposal
                      ? finalstatus || "For Disposal"
                      : accountableOwnerName || "—"}
                  </p>
                </div>
                {isDisposal && (
                  <div className="rounded-xl bg-white border border-indigo-100/80 px-3 py-2 shadow-sm">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Accountable owner
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {accountableOwnerName || "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Distribution items */}
          {Array.isArray(inv?.items) && inv.items.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Items in this request
              </p>
              <div className="space-y-2">
                {inv.items.map((item, index) => (
                  <div
                    key={`${item.returnId || item.return_id || index}-${index}`}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl bg-white px-3 py-2 border border-slate-200/70 shadow-sm"
                  >
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {item.classification}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">{item.itemName}</p>
                    </div>
                    <div className="flex gap-4 text-[11px] text-gray-600">
                      <div>
                        <span className="font-medium text-gray-800">Stock No:</span>{" "}
                        {item.stock_no ?? "—"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Qty:</span>{" "}
                        {item.quantity}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Unit:</span>{" "}
                        {item.unitofmeasure}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Cost:</span>{" "}
                        {formatCurrency(item.cost)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatories + Facts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Signatories */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                      Approval Stages
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">
                      Workflow Timeline
                    </h3>
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {isCancelled
                      ? "Cancelled"
                      : isDeclined
                      ? "Declined"
                      : isWorkflowComplete
                      ? "Complete"
                      : `Step ${currentStageIndex + 1} of ${
                          stageItems.length
                        } • ${stageItems[currentStageIndex]?.label || "—"}`}
                  </div>
                </div>

                <div className="relative mt-5 pl-4">
                  <div className="absolute left-3 top-3 bottom-3 w-px bg-slate-200" />
                  {!isDeclined && !isCancelled && (
                    <div
                      className="absolute left-3 top-3 w-px bg-slate-900 transition-all duration-300"
                      style={{ height: `${progressPercent}%` }}
                    />
                  )}
                  {stageItems.map((stage, idx) => {
                    const isActive =
                      idx === currentStageIndex &&
                      !isDeclined &&
                      !isCancelled &&
                      !isWorkflowComplete;
                    const isComplete =
                      !isDeclined &&
                      !isCancelled &&
                      (idx < currentStageIndex || isWorkflowComplete);
                    const markerBase =
                      "absolute left-0 top-4 h-8 w-8 rounded-full border flex items-center justify-center text-[9px] font-semibold shadow-sm";
                    const markerClass = isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-[0_0_20px_rgba(15,23,42,0.35)]"
                      : isComplete
                      ? "border-emerald-300 bg-emerald-500 text-white"
                      : "border-slate-200 bg-white text-slate-500";

                    return (
                      <div key={stage.key} className="relative pl-10 pb-5 last:pb-0">
                        <div className={`${markerBase} ${markerClass}`}>
                          {isActive ? (
                            <span className="animate-pulse">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                          ) : isComplete ? (
                            "OK"
                          ) : (
                            String(idx + 1).padStart(2, "0")
                          )}
                        </div>

                        <div
                          className={`rounded-2xl border px-4 py-3 transition-all ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                              : isComplete
                              ? "border-emerald-200 bg-emerald-50 text-slate-900"
                              : "border-slate-200/80 bg-white text-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p
                              className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${
                                isActive
                                  ? "text-sky-200"
                                  : isComplete
                                  ? "text-emerald-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {stage.caption}
                            </p>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[9px] font-semibold text-white">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-base font-semibold">{stage.label}</div>
                          <div className="mt-2 text-sm font-semibold">
                            {stage.name || "—"}
                          </div>
                          {stage.role ? (
                            <div
                              className={`text-[11px] ${
                                isActive ? "text-slate-300" : "text-slate-500"
                              }`}
                            >
                              {stage.role}
                            </div>
                          ) : null}
                          <div
                            className={`mt-2 text-[10px] ${
                              isActive ? "text-slate-300" : "text-slate-400"
                            }`}
                          >
                            Date: {stage.date || "__________"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isDeclined && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600">
                    This request was declined. No further approvals are required.
                  </div>
                )}
                {isCancelled && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                    This request was cancelled by the requestor. No further approvals are required.
                  </div>
                )}
              </div>
            </div>

            {/* Facts + Actions */}
          <div className="space-y-4">
            {/* Facts */}
            <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-xs shadow-sm">
              {!isDistribution && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Serial No.</span>
                    <span className="font-medium text-gray-800">{inv?.serial_no || "—"}</span>
                  </div>
                )}
                {!isDistribution && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Batch No.</span>
                    <span className="font-medium text-gray-800">{inv?.batch_no || "—"}</span>
                  </div>
                )}
                {!isDistribution && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Specifications</span>
                    <span className="max-w-[65%] text-right font-medium text-gray-800">
                      {inv?.specifications || "—"}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-500">{isDistribution ? "Total Cost" : "Unit Cost"}</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(
                      isDistribution
                        ? Array.isArray(inv?.items)
                          ? inv.items.reduce(
                              (t, item) =>
                                t + Number(item.quantity || 0) * Number(item.cost || 0),
                              0
                            )
                          : 0
                        : inv?.unit_cost || 0
                    )}
                  </span>
                </div>

                {!isDistribution && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Cost</span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(inv?.total_cost || 0)}
                    </span>
                  </div>
                )}

                {!isDistribution && !isDisposal && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Issued to</span>
                    <span className="font-medium text-gray-800">
                      {issuedToSummaryName || "—"}
                    </span>
                  </div>
                )}

                {isDistribution && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Designation</span>
                    <span className="font-medium text-gray-800">{inv?.office || "—"}</span>
                  </div>
                )}

                {(transferType || otherAgencyTarget || isDisposal) && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      {isDisposal ? "Disposal Type" : "Transfer Type"}
                    </span>
                    <span className="font-medium text-gray-800">
                      {isDisposal
                        ? "For Disposal"
                        : isOtherAgencyTransfer
                        ? "Transfer to other agency"
                        : transferType || "Standard Transfer"}
                    </span>
                  </div>
                )}

                {!isDisposal && recipientName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{recipientHeadingLabel || "To"}</span>
                    <span className="font-medium text-gray-800">
                      {recipientName || "________________"}
                    </span>
                  </div>
                )}

                {isDisposal && inv?.disposal_reason && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Disposal Reason</span>
                    <span className="font-medium text-gray-800">{inv.disposal_reason}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-gray-500">
                    Status{" "}
                    <span className="ml-1 rounded-full bg-slate-200 px-2 py-[1px] text-[9px] font-semibold text-slate-800">
                      REQUEST
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-800">
                      {requestStatus || "—"}
                    </span>
                    {canNotifyRequestor && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={openNotifyModal}
                          disabled={notifyBusy}
                          className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60"
                          title="Notify requestor"
                          aria-label="Notify requestor"
                        >
                          🔔
                        </button>
                        {notifyStatus && (
                          <span
                            className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-white ${
                              notifyStatus === "success" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                            title={
                              notifyStatus === "success" ? "Email sent" : "Email failed"
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {notifyMessage && (
                  <div
                    className={`mt-2 text-[11px] font-semibold ${
                      notifyStatus === "error" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {notifyMessage}
                  </div>
                )}
              </div>

            {/* Remarks */}
            {isDistribution && !isSupplyDisposal && (
              <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Purpose
                </p>
                <p className="mt-1 whitespace-pre-wrap text-gray-700">
                  {inv?.purpose || "—"}
                </p>
              </div>
            )}

            {/* Remarks */}
            <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Remarks
              </p>
              <p className="mt-1 text-gray-700">
                {inv?.remarks || inv?.reason || inv?.disposal_reason || "—"}
              </p>
            </div>

            {(canUploadSigned || hasSignedFile) && (
              <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Signed Document
                    </p>
                    {hasSignedFile && signedFile?.uploaded_at && (
                      <span className="text-[10px] text-gray-400">
                        {fdateDMY(signedFile.uploaded_at)}
                      </span>
                    )}
                  </div>

                  {hasSignedFile ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-gray-700">
                        Latest:{" "}
                        <span className="font-semibold">
                          {signedFile?.filename || "Signed file"}
                        </span>
                        {signedFile?.uploaded_by ? (
                          <span className="text-gray-400">
                            {" "}
                            • uploaded by {signedFile.uploaded_by}
                          </span>
                        ) : null}
                      </div>

                      {systemSettings.enable_signed_download ? (
                        <a
                          href={resolveServerUrl(signedFile.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Open signed copy
                        </a>
                      ) : (
                        <div className="text-[11px] text-gray-400">
                          Downloads are disabled in settings.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">
                      No signed file uploaded yet.
                    </div>
                  )}

                  {/* Disposal second approver */}
                  {isDisposal && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {requestStatus === "For Approval"
                          ? `To be approved by (${afdRoleLabel})`
                          : `Approved for disposal by (${afdRoleLabel})`}
                      </p>
                      {afd ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900">{afd.username}</p>
                          <p className="text-xs text-gray-500">{afd.position || afdRoleLabel}</p>
                        </>
                      ) : (
                        <Loading />
                      )}
                      <p className="text-[10px] text-gray-500">
                        Date:{" "}
                        {inv?.date_approved ? fdateDMY(inv.date_approved) : "__________"}
                      </p>
                    </div>
                  )}

                  {canUploadSigned && systemSettings.enable_signed_upload && (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) =>
                          setSignedUploadFile(e.target.files?.[0] || null)
                        }
                        className="block w-full text-[11px] text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-white hover:file:bg-black"
                      />
                      <button
                        type="button"
                        onClick={handleSignedUpload}
                        disabled={!signedUploadFile || signedUploading}
                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {signedUploading ? "Uploading…" : "Upload signed file"}
                      </button>
                      {signedUploadError && (
                        <div className="text-[11px] text-red-600">
                          {signedUploadError}
                        </div>
                      )}
                      {approveDisabled && (
                        <div className="text-[11px] text-amber-600">
                          Upload the signed document to enable {signedActionLabel}.
                        </div>
                      )}
                    </div>
                  )}
                  {canUploadSigned && !systemSettings.enable_signed_upload && (
                    <div className="text-[11px] text-gray-400">
                      Signed uploads are disabled in settings.
                    </div>
                  )}
                  {signedUploadBlocked && (
                    <div className="text-[11px] text-amber-600">
                      Signed uploads are disabled in settings. Enable them to approve disposal.
                    </div>
                  )}
                </div>
              )}

              {notifyOpen && (
                <ModalShell
                  open
                  title="Notify requestor"
                  subtitle="Message"
                  variant="neutral"
                  onClose={() => setNotifyOpen(false)}
                  maxWidthClass="max-w-md"
                >
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      Send a custom message to the requestor. The request link will be
                      included.
                    </p>
                    <textarea
                      value={notifyText}
                      onChange={(e) => setNotifyText(e.target.value)}
                      rows={5}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Write your message..."
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setNotifyOpen(false)}
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleNotifyRequestor}
                        disabled={notifyBusy}
                        className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                      >
                        {notifyBusy ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </div>
                </ModalShell>
              )}

              {/* Actions */}
              <div className="space-y-2 print-hidden">
                <div className="grid gap-2">
                {inv && (
                  <button
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    onClick={() => {
                      if (canDownloadSigned) handleSignedDownload();
                      else handlePrintForm();
                    }}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <EyeIcon className="h-4 w-4" />
                      {canDownloadSigned
                        ? `Open signed ${
                            isDistribution
                              ? isSupplyDisposal
                                ? "SDR"
                                : "RIS"
                              : isDisposal
                              ? "PDR"
                              : isIssue
                              ? issuanceDocType
                              : isReturnToInventory
                              ? "RTI"
                              : isSeTransfer
                              ? "ICS"
                              : "PTR"
                          }`
                        : isPropertyPTR
                        ? isDisposal
                          ? "Print Disposal PDR"
                        : isIssue
                        ? `Print ${issuanceDocType}`
                        : isReturnToInventory
                        ? "Print Return to Inventory"
                        : isSeTransfer
                        ? "Print ICS"
                        : "Print PTR"
                        : isSupplyDisposal
                        ? "Print SDR"
                        : "Print RIS"}
                    </span>
                  </button>
                )}

                {canDownloadSigned &&
                  isDistribution &&
                  !isSupplyDisposal &&
                  isFirstStepRequest &&
                  canAct && (
                  <button
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    onClick={() => handlePrintForm({ unsigned: true })}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <EyeIcon className="h-4 w-4" />
                      Print unsigned RIS
                    </span>
                  </button>
                )}

                {canRevertState && (
                  <button
                    className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
                    onClick={() => setShowRevertModal(true)}
                    disabled={revertBusy}
                  >
                    {revertBusy ? "Reverting..." : "Revert to previous state"}
                  </button>
                )}

                {canEditDistribution && (
                  <button
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/40 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={openEditDistribution}
                    disabled={editBusy || actionBusy}
                  >
                    {editBusy ? "Saving..." : "Edit Request (Qty & Remarks)"}
                  </button>
                )}

                {canCancelRequest && (
                  <button
                    className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-600/40 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      setModalAction("cancel");
                      setReason("");
                      setShowModal(true);
                    }}
                    disabled={actionBusy}
                  >
                    Cancel Request
                  </button>
                )}

                {requestStatus !== "Declined" &&
                  requestStatus !== "Cancelled" &&
                  requestStatus !== "Received" &&
                  canAct && (
                  <>
                    {canApproveNow && (
                      <button
                        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          setModalAction("approve");
                          setShowModal(true);
                        }}
                        disabled={approveDisabled || actionBusy}
                        title={
                          approveDisabled
                            ? `Upload the signed document before ${signedActionLabel}.`
                            : ""
                        }
                      >
                        {isDistribution && isSupplyDisposal && requestStatus === "For Approval"
                          ? "Approve Disposal"
                          : isDistribution && requestStatus === "For checking"
                          ? "Mark as For Approval"
                          : isDistribution && requestStatus === "For Approval"
                          ? "Approve"
                          : isDistribution && requestStatus === "Approved"
                          ? "Mark as Received"
                          : isDisposal && requestStatus === "For Approval"
                          ? "Approve Disposal"
                          : isIssue && requestStatus === "For Approval"
                          ? "Approve Issue"
                          : requestStatus === "For Approval"
                          ? "Approve"
                          : requestStatus === "For Release"
                          ? isSeTransfer
                            ? "Approve SE Transfer"
                            : isOtherAgencyTransfer
                            ? "Finalize Transfer"
                            : "Release"
                          : "Mark as Received"}
                      </button>
                    )}

                    {canDeclineNow && (
                      <button
                        className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600/40 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          setModalAction("decline");
                          setReason("");
                          setShowModal(true);
                        }}
                        disabled={actionBusy}
                      >
                        Decline
                      </button>
                    )}
                  </>
                )}

                {actionBusy && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-semibold text-indigo-700">
                  Processing action… Please wait.
                </div>
                )}

                {(isWorkflowComplete || isDeclined || isCancelled) && (
                  <button
                    className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/40"
                    onClick={handlePrintOverview}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <EyeIcon className="h-4 w-4" />
                      Print Request Overview
                    </span>
                  </button>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* QR & note (print-only when Issued) */}
          {finalstatus === "Issued" && (
            <div className="print-only mt-8 flex flex-col items-end space-y-3">
              <QRCode value={`${usedURL}/${id}`} size={128} />
              <div className="w-full text-center">
                <p className="text-base font-semibold text-gray-800">
                  {isIssue
                    ? `This ${issuanceDocumentName} is FULLY APPROVED`
                    : "This Property Transfer Request is FULLY APPROVED"}
                </p>
                <p className="text-xs text-gray-600">
                  NOTE: This {isIssue ? issuanceDocType : "PTR"} is valid only if FULLY APPROVED. Scan the QR code to validate.
                </p>
              </div>
            </div>
          )}

        </div>
      </section>

      {showEditModal && (
        <EditDistributionModal
          items={editItems}
          userRemarks={editUserRemarks}
          total={editTotal}
          invalidCount={invalidCount}
          changePreviewLines={changePreviewLines}
          onQtyChange={handleQtyChange}
          onQtyBlur={handleQtyBlur}
          onUserRemarksChange={(e) => setEditUserRemarks(e.target.value)}
          onConfirm={handleSaveDistributionEdit}
          onCancel={() => setShowEditModal(false)}
          isProcessing={editBusy}
          supplyOptions={supplyOptions}
          supplySearch={supplySearch}
          onSupplySearchChange={handleSupplySearchChange}
          selectedSupplyId={selectedSupplyId}
          onSelectSupply={handleSelectSupply}
          addQtyInput={addQtyInput}
          onAddQtyChange={handleAddQtyChange}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          addError={editAddError}
          supplyLoading={supplyLoading}
        />
      )}

      {/* Approve / Decline confirmation modal (still screen-centered) */}
      {showModal && (
        <Modal
          action={modalAction}
          onConfirm={() => handleAction(modalAction)}
          onCancel={() => {
            setShowModal(false);
            setReason("");
          }}
          onReasonChange={(e) => setReason(e.target.value)}
          reason={reason}
          confirmDisabled={
            (modalAction === "decline" || modalAction === "cancel") &&
            String(reason || "").trim().length === 0
          }
          isProcessing={actionBusy}
          title={
            modalAction === "cancel"
              ? "Cancel this request?"
              : undefined
          }
          subtitle={modalAction === "cancel" ? "Request Cancellation" : undefined}
          body={
            modalAction === "cancel"
              ? "This will stop the request before it proceeds to the next approval stage."
              : undefined
          }
          confirmLabel={
            modalAction === "cancel"
              ? "Cancel Request"
              : modalAction === "decline"
              ? "Decline Request"
              : undefined
          }
          variant={modalAction === "cancel" ? "warning" : undefined}
        />
      )}

      {declineSuccessOpen && (
        <ModalShell
          open
          title="Request updated"
          subtitle="Success"
          variant="neutral"
          disableBackdropClose
          showClose={false}
          maxWidthClass="max-w-sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700">{declineSuccessMessage}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDeclineSuccessOk}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              >
                OK
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showRevertModal && (
        <Modal
          action="revert"
          title="Revert to previous state?"
          subtitle="Confirm Revert"
          body="This restores the previous saved record snapshot, including workflow, accountability, and signed-document state."
          confirmLabel="Revert"
          variant="warning"
          onConfirm={handleRevertState}
          onCancel={() => setShowRevertModal(false)}
          confirmDisabled={false}
          isProcessing={revertBusy}
        />
      )}

      <Toast
        show={toast.show}
        type={toast.type}
        message={toast.msg}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
    </div>
  );
};

export default Checkform;

/* --------------------- Print CSS injector --------------------- */
if (typeof document !== "undefined") {
  if (!document.getElementById("checkform-print-styles")) {
    const style = document.createElement("style");
    style.id = "checkform-print-styles";
    style.innerHTML = `
      @media print {
        .print-hidden { display: none !important; }
        .print-only  { display: block !important; }

        body, html { margin: 0; padding: 0; }
        body * { visibility: hidden; }

        .print-container,
        .print-container * {
          visibility: visible;
        }

        .print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: #ffffff;
          padding: 0mm 10mm 10mm 0mm;
          margin-left: -3mm;
        }
      }

      @page {
        size: auto;
        margin: 0mm 10mm 10mm 0mm;
      }

      .print-only { display: none; }
    `;
    document.head.appendChild(style);
  }
}
