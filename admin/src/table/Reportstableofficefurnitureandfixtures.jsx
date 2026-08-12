// src/components/Reportstableofficefurnitureandfixtures.jsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import { BASE_URL, resolveServerUrl } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";
import * as XLSX from "xlsx";
import EmptyState from "../components/EmptyState";

/* ========================================================================================
 * Utilities
 * ====================================================================================== */

/** Format Philippine Peso (PHP) as a display string. */
function formatCurrencyPHP(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  try {
    return n.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  } catch {
    return `₱${n.toFixed(2)}`;
  }
}

/** Normalize string for case-insensitive contains checks. */
function norm(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

const PROVINCES = [
  "Cagayan",
  "Isabela",
  "Batanes",
  "Nueva Vizcaya",
  "Quirino",
];

function resolveProvinceFromText(value) {
  const s = norm(value);
  if (!s) return "";
  const match = PROVINCES.find((p) => s.includes(norm(p)));
  return match || "";
}

/** Stable comparator helper (string/number safe). */
function compareValues(a, b) {
  const at = typeof a;
  const bt = typeof b;
  const av =
    a == null
      ? ""
      : at === "number"
      ? a
      : at === "string"
      ? a.toLowerCase()
      : String(a).toLowerCase();
  const bv =
    b == null
      ? ""
      : bt === "number"
      ? b
      : bt === "string"
      ? b.toLowerCase()
      : String(b).toLowerCase();

  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

/** Heuristic: does a string look like a MongoDB ObjectId? */
function looksLikeObjectId(s) {
  return typeof s === "string" && /^[a-f\d]{24}$/i.test(s);
}

/** Resolve a user id or name-like into a display name via map (fallback to raw unless ObjectId). */
function resolveIdOrName(candidate, userMap) {
  if (!candidate) return "";
  if (userMap && userMap[candidate]) return userMap[candidate];
  if (looksLikeObjectId(candidate)) return "";
  return String(candidate);
}

function buildHistoryDocHtml(entry, userMap) {
  const snap = entry?.doc_snapshot || {};
  const docType = String(entry?.doc_type || "PTR").toUpperCase();
  const isIcs = docType === "ICS";
  const title = isIcs ? "INVENTORY CUSTODIAN SLIP" : "PROPERTY TRANSFER REQUEST";
  const itemName = safeText(snap?.itemName, "—");
  const classification = safeText(snap?.classification, "—");
  const propertyNo = safeText(snap?.property_no, "—");
  const serialNo = safeText(snap?.serial_no, "—");
  const docNo = safeText(isIcs ? snap?.ics_no : snap?.ptr_no, "—");
  const batchNo = safeText(snap?.batch_no, "—");
  const qty = safeText(snap?.qty, "—");
  const unit = safeText(snap?.unitofmeasure, "—");
  const unitCost = formatCurrencyPHP(snap?.unit_cost);
  const totalCost = formatCurrencyPHP(snap?.total_cost);
  const project = safeText(snap?.project, "—");
  const dateAcquired = safeText(formatDateYMD(snap?.date_acquired), "—");
  const dateRequested = safeText(formatDateYMD(snap?.date_requested), "—");
  const dateApproved = safeText(formatDateYMD(snap?.date_approved), "—");
  const dateReleased = safeText(formatDateYMD(snap?.date_released), "—");
  const dateReceived = safeText(formatDateYMD(snap?.date_received), "—");
  const issuedTo = safeText(resolveIdOrName(snap?.issued_to, userMap), "—");
  const transferTo = safeText(resolveIdOrName(snap?.transfered_to, userMap), "—");
  const status = safeText(snap?.status, "—");
  const docDate = safeText(
    formatDateLine(entry?.to || entry?.date || entry?.createdAt || entry?.from),
    "—"
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff;
      font-size: 11px; line-height: 1.45;
      padding: 12mm;
    }
    @page { size: A4; margin: 12mm; }
    .header { text-align:center; margin-bottom: 10px; }
    .header h1 { font-size: 14px; letter-spacing: .2em; margin: 6px 0 2px; }
    .header p { margin: 0; font-size: 10px; color: #475569; }
    .meta { margin-top: 8px; display:flex; justify-content: space-between; font-size: 10px; color:#475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px; font-size: 10px; }
    th { background: #f8fafc; text-transform: uppercase; letter-spacing: .08em; font-size: 9px; }
    .label { color:#64748b; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: .08em; }
    .value { font-weight: 700; color:#0f172a; }
  </style>
</head>
<body>
  <div class="header">
    <p>REPUBLIC OF THE PHILIPPINES</p>
    <p>DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</p>
    <p>DICT REGIONAL OFFICE 02</p>
    <h1>${escapeHtml(title)}</h1>
  </div>
  <div class="meta">
    <span><span class="label">Document:</span> <span class="value">${escapeHtml(docType)}</span></span>
    <span><span class="label">Recorded:</span> <span class="value">${escapeHtml(docDate)}</span></span>
  </div>
  <table>
    <tbody>
      <tr><td class="label">Item</td><td class="value">${escapeHtml(itemName)}</td></tr>
      <tr><td class="label">${escapeHtml(isIcs ? "ICS No." : "PTR No.")}</td><td class="value">${escapeHtml(docNo)}</td></tr>
      <tr><td class="label">Classification</td><td class="value">${escapeHtml(classification)}</td></tr>
      <tr><td class="label">Property No.</td><td class="value">${escapeHtml(propertyNo)}</td></tr>
      <tr><td class="label">Serial No.</td><td class="value">${escapeHtml(serialNo)}</td></tr>
      <tr><td class="label">Batch No.</td><td class="value">${escapeHtml(batchNo)}</td></tr>
      <tr><td class="label">Quantity</td><td class="value">${escapeHtml(qty)} ${escapeHtml(unit)}</td></tr>
      <tr><td class="label">Unit Cost</td><td class="value">${escapeHtml(unitCost)}</td></tr>
      <tr><td class="label">Total Cost</td><td class="value">${escapeHtml(totalCost)}</td></tr>
      <tr><td class="label">Project</td><td class="value">${escapeHtml(project)}</td></tr>
      <tr><td class="label">Date Acquired</td><td class="value">${escapeHtml(dateAcquired)}</td></tr>
      <tr><td class="label">Date Requested</td><td class="value">${escapeHtml(dateRequested)}</td></tr>
      <tr><td class="label">Date Approved</td><td class="value">${escapeHtml(dateApproved)}</td></tr>
      <tr><td class="label">Date Released</td><td class="value">${escapeHtml(dateReleased)}</td></tr>
      <tr><td class="label">Date Received</td><td class="value">${escapeHtml(dateReceived)}</td></tr>
      <tr><td class="label">Issued To</td><td class="value">${escapeHtml(issuedTo)}</td></tr>
      <tr><td class="label">Transfer To</td><td class="value">${escapeHtml(transferTo)}</td></tr>
      <tr><td class="label">Status</td><td class="value">${escapeHtml(status)}</td></tr>
    </tbody>
  </table>
  <script>
    window.focus();
    setTimeout(() => { window.print(); window.close(); }, 50);
  </script>
</body>
</html>`;
}

function openHistoryDoc(entry, userMap) {
  try {
    const html = buildHistoryDocHtml(entry, userMap);
    const pri = window.open("", "", "width=1000,height=800");
    if (!pri) return;
    pri.document.open();
    pri.document.write(html);
    pri.document.close();
    pri.focus();
  } catch (e) {
    console.error("Print history document failed:", e);
    alert("Failed to open the document. Please try again.");
  }
}

/** Convert something date-like into a Date (or null). */
function toValidDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Format date for small timeline labels (PH locale). */
function formatDateLine(value) {
  const d = toValidDate(value);
  if (!d) return "";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateYMD(value) {
  const d = toValidDate(value);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(input) {
  const s = String(input ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

/** Pick the first valid date from item keys. */
function pickFirstDateFromKeys(item, keys) {
  for (const k of keys) {
    const d = toValidDate(item?.[k]);
    if (d) return d;
  }
  return null;
}

function getPurchaseDate(item) {
  return pickFirstDateFromKeys(item, [
    "date_purchased",
    "date_purchase",
    "purchase_date",
    "date_acquired",
    "date",
    "createdAt",
  ]);
}

/** Find latest matching history date by keyword(s) (uses h.to then h.from). */
function findLatestHistoryDate(history, keywords = []) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const ks = (keywords || []).map((k) => String(k).toLowerCase());
  let best = null;

  for (const h of history) {
    const name = String(h?.name || "").toLowerCase();
    if (!ks.some((k) => name.includes(k))) continue;

    const candidate = toValidDate(h?.to) || toValidDate(h?.from);
    if (!candidate) continue;

    if (!best || candidate.getTime() > best.getTime()) best = candidate;
  }
  return best;
}

/* ========================================================================================
 * Status metadata & display
 * ====================================================================================== */

function getStatusMeta(status) {
  const raw = norm(status);

  let label = status || "Unknown";
  let bg = "#f3f4f6"; // gray-100
  let color = "#374151"; // gray-700
  let border = "#e5e7eb"; // gray-200

  if (raw === "instock" || raw === "in stock") {
    label = "In stock";
    bg = "#dcfce7"; // emerald-100
    color = "#166534"; // emerald-800
    border = "#bbf7d0"; // emerald-200
  } else if (raw === "issued") {
    label = "Issued";
    bg = "#fee2e2"; // rose-100
    color = "#b91c1c"; // red-700
    border = "#fecaca"; // red-200
  } else if (raw === "transferred" || raw === "trasferred") {
    label = "Transferred";
    bg = "#dbeafe"; // blue-100
    color = "#1d4ed8"; // blue-700
    border = "#bfdbfe"; // blue-200
  } else if (raw === "for transfer") {
    label = "For transfer";
    bg = "#fef3c7"; // amber-100
    color = "#92400e"; // amber-800
    border = "#fde68a"; // amber-200
  } else if (raw === "for issue") {
    label = "Pending";
    bg = "#e5e7eb";
    color = "#111827";
    border = "#d1d5db";
  } else if (raw === "for disposal") {
    label = "For disposal";
    bg = "#fef2f2";
    color = "#b91c1c";
    border = "#fecaca";
  } else if (raw === "disposed") {
    label = "Disposed";
    bg = "#e5e7eb";
    color = "#4b5563";
    border = "#d1d5db";
  } else if (raw === "pending") {
    label = "Pending";
    bg = "#e5e7eb";
    color = "#111827";
    border = "#d1d5db";
  }

  return { label, bg, color, border };
}

/* ========================================================================================
 * Issued-To & Current-Holder resolvers for REPORTS (business-rule aware)
 * ====================================================================================== */

function resolveIssuedToDisplay(item, userMap) {
  const { label: statusLabel } = getStatusMeta(item?.status || "");
  const lowerStatus = norm(statusLabel);
  const lowerType = norm(
    item?.transfer_type || item?.transfertype || item?.transferType || item?.transfer_mode
  );

  if (lowerType === "other agency") {
    const agency =
      item?.transfer_target ||
      item?.transfer_to ||
      item?.transfer_to_agency ||
      item?.transfered_to_agency ||
      item?.agency_to ||
      item?.receiving_agency ||
      "";
    return agency || "";
  }

  if (lowerStatus === "for disposal" || lowerStatus === "disposed") {
    return "";
  }

  const chain = [
    item?.issued_to_name,
    resolveIdOrName(item?.issued_to, userMap),
    resolveIdOrName(item?.issued_to_id, userMap),
    resolveIdOrName(item?.current_holder, userMap),
    resolveIdOrName(item?.current_holder_id, userMap),
  ];
  return chain.find((v) => !!v) || "";
}

function resolveCurrentHolderDisplay(item, userMap) {
  const lowerType = norm(
    item?.transfer_type || item?.transfertype || item?.transferType || item?.transfer_mode
  );
  const { label } = getStatusMeta(item?.status || "");
  const direct =
    resolveIdOrName(item?.current_holder, userMap) ||
    resolveIdOrName(item?.current_holder_id, userMap) ||
    item?.current_holder_name ||
    resolveIdOrName(item?.transferred_to, userMap) ||
    resolveIdOrName(item?.transferred_to_id, userMap) ||
    resolveIdOrName(item?.transfered_to, userMap) ||
    resolveIdOrName(item?.transfered_to_id, userMap);

  if (direct) return direct;

  if (lowerType === "other agency") {
    const agency =
      item?.transfer_target ||
      item?.transfer_to ||
      item?.transfer_to_agency ||
      item?.transfered_to_agency ||
      item?.agency_to ||
      item?.receiving_agency ||
      "";
    if (agency) return agency;
  }

  if (label === "In stock") {
    return item?.stored_to || "";
  }
  if (label === "Issued") {
    return (
      resolveIdOrName(item?.issued_to, userMap) ||
      resolveIdOrName(item?.issued_to_id, userMap) ||
      item?.issued_to_name ||
      ""
    );
  }
  if (label === "Transferred" || label === "For transfer") {
    return (
      resolveIdOrName(item?.transfered_to, userMap) ||
      resolveIdOrName(item?.transfered_to_id, userMap) ||
      resolveIdOrName(item?.transferred_to, userMap) ||
      resolveIdOrName(item?.transferred_to_id, userMap) ||
      ""
    );
  }

  return (
    resolveIdOrName(item?.issued_to, userMap) ||
    resolveIdOrName(item?.issued_to_id, userMap) ||
    item?.issued_to_name ||
    item?.stored_to ||
    ""
  );
}

function resolveCurrentLocationDisplay(item, userMap) {
  const storedLocation = String(item?.stored_to || "").trim();
  if (storedLocation) return storedLocation;

  const lowerType = norm(
    item?.transfer_type || item?.transfertype || item?.transferType || item?.transfer_mode
  );
  if (lowerType === "other agency") {
    return (
      item?.transfer_target ||
      item?.transfer_to ||
      item?.transfer_to_agency ||
      item?.transfered_to_agency ||
      item?.agency_to ||
      item?.receiving_agency ||
      ""
    );
  }

  return resolveCurrentHolderDisplay(item, userMap) || resolveIssuedToDisplay(item, userMap) || "";
}

/* ========================================================================================
 * Timeline helpers for Issued To / Current Holder
 * ====================================================================================== */

function getIssuedToTimeline(item) {
  const status = norm(getStatusMeta(item?.status).label);
  const transferType = norm(item?.transfer_type);

  if (status === "for disposal" || status === "disposed") return null;

  if (transferType === "other agency") {
    const dt =
      pickFirstDateFromKeys(item, [
        "date_transferred",
        "date_transfered",
        "date_transfer",
        "date_transfered_to",
        "date_approved",
        "approved_at",
        "updatedAt",
        "updated_at",
        "date_requested",
        "requested_at",
      ]) || findLatestHistoryDate(item?.history, ["transfer", "transferred"]);

    if (!dt) return null;

    if (status === "for transfer") return { label: "Transfer requested", date: dt };
    if (status === "transferred") return { label: "Transferred", date: dt };
    return { label: "Updated", date: dt };
  }

  const issuedDt =
    pickFirstDateFromKeys(item, ["date_issued", "issued_at", "dateIssued", "dateissued"]) ||
    findLatestHistoryDate(item?.history, ["issue", "issued"]);

  if (!issuedDt) return null;
  if (status === "in stock") return null;

  return { label: "Issued", date: issuedDt };
}

function getCurrentHolderTimeline(item) {
  const status = norm(getStatusMeta(item?.status).label);

  if (status === "for disposal" || status === "disposed") return null;

  if (status === "for transfer") {
    const dt =
      pickFirstDateFromKeys(item, ["date_requested", "requested_at", "dateRequest", "daterequested"]) ||
      findLatestHistoryDate(item?.history, ["for transfer", "transfer request", "transfer"]);
    if (!dt) return null;
    return { label: "Transfer requested", date: dt };
  }

  if (status === "transferred") {
    const dt =
      pickFirstDateFromKeys(item, [
        "date_transferred",
        "date_transfered",
        "date_transfer",
        "date_approved",
        "approved_at",
        "updatedAt",
        "updated_at",
      ]) || findLatestHistoryDate(item?.history, ["transfer", "transferred"]);
    if (!dt) return null;
    return { label: "Transferred", date: dt };
  }

  if (status === "issued") {
    const dt =
      pickFirstDateFromKeys(item, ["date_issued", "issued_at", "dateIssued", "dateissued"]) ||
      findLatestHistoryDate(item?.history, ["issue", "issued"]);
    if (!dt) return null;
    return { label: "Issued", date: dt };
  }

  return null;
}

/* ========================================================================================
 * Small components (icons, pills, inputs)
 * ====================================================================================== */

function StatusPill({ status }) {
  const { label, bg, color, border } = getStatusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] md:text-[11px] font-semibold border"
      style={{ backgroundColor: bg, color, borderColor: border }}
      title={label}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function TableHeader({ title, sortKey, sortConfig, onSort }) {
  const isSortable = Boolean(sortKey && onSort);
  const isActive = isSortable && sortConfig?.key === sortKey;
  const direction = isActive ? sortConfig?.direction : null;
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className="sticky top-0 z-10 px-4 py-3 text-[10px] md:text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-50/95 backdrop-blur text-left"
    >
      {isSortable ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="w-full inline-flex items-center justify-center gap-1 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded"
          aria-label={`Sort by ${title}${isActive ? ` (${direction})` : ""}`}
          title={`Sort by ${title}`}
        >
          <span>{title}</span>
          <span className="text-[9px] text-gray-400" aria-hidden="true">
            {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "⇅"}
          </span>
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">{title}</span>
      )}
    </th>
  );
}

/* ---------- Tiny SVG icons (inline) ---------- */
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconClear = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ---------- Reusable search input with icon + clear ---------- */
function SearchInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  ariaLabel,
  icon = <IconSearch />,
  className = "",
  inputClassName = "",
}) {
  return (
    <div className={`search-shell ${className}`}>
      <span className="search-icon">{icon}</span>
      <input
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`search-input pr-9 text-[10px] md:text-xs ${inputClassName}`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange({ target: { value: "" } })}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear"
          title="Clear"
        >
          <IconClear />
        </button>
      ) : null}
    </div>
  );
}

/* ========================================================================================
 * Data row
 * ====================================================================================== */

function TableRow({ data, userMap }) {
  const issuedTo = resolveIssuedToDisplay(data, userMap) || "";
  const currentHolder = resolveCurrentHolderDisplay(data, userMap) || "";

  const issuedTimeline = getIssuedToTimeline(data);
  const holderTimeline = getCurrentHolderTimeline(data);

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs font-medium text-left border-b text-gray-800">
        {data?.property_no || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-left border-b text-gray-900">
        {data?.itemName || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {data?.classification || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {data?.serial_no || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {formatCurrencyPHP(data?.unit_cost)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-left border-b">
        <StatusPill status={data?.status} />
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs font-medium text-left border-b text-gray-800">
        {issuedTo ? (
          <div className="leading-tight">
            <div className="font-semibold text-gray-900">{issuedTo}</div>
            {issuedTimeline?.date ? (
              <div className="mt-0.5 text-[9px] md:text-[10px] font-medium text-gray-500">
                {issuedTimeline.label}: {formatDateLine(issuedTimeline.date)}
              </div>
            ) : null}
          </div>
        ) : (
          "—"
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs font-medium text-left border-b text-gray-800">
        {currentHolder ? (
          <div className="leading-tight">
            <div className="font-semibold text-gray-900">{currentHolder}</div>
            {holderTimeline?.date ? (
              <div className="mt-0.5 text-[9px] md:text-[10px] font-medium text-gray-500">
                {holderTimeline.label}: {formatDateLine(holderTimeline.date)}
              </div>
            ) : null}
          </div>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function ItemCard({ data, userMap }) {
  const issuedTo = resolveIssuedToDisplay(data, userMap) || "—";
  const currentHolder = resolveCurrentHolderDisplay(data, userMap) || "—";
  const issuedTimeline = getIssuedToTimeline(data);
  const holderTimeline = getCurrentHolderTimeline(data);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            Property #{data?.property_no || "—"}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mt-1">
            {data?.itemName || "—"}
          </h3>
          <p className="text-[11px] text-gray-500">{data?.classification || "—"}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            Serial: {data?.serial_no || "—"}
          </p>
        </div>
        <StatusPill status={data?.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-600">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-600">
          {formatCurrencyPHP(data?.unit_cost)}
        </span>
        <span className="rounded-full bg-gray-50 px-2.5 py-1">
          Issued: {issuedTo}
        </span>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">
          Holder: {currentHolder}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-gray-500">
        <div>
          <div className="text-gray-400">Issued</div>
          <div className="font-semibold text-gray-700">
            {issuedTimeline?.date ? formatDateLine(issuedTimeline.date) : "—"}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Holder</div>
          <div className="font-semibold text-gray-700">
            {holderTimeline?.date ? formatDateLine(holderTimeline.date) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ row, userMap, onOpenDoc }) {
  const { item, entry } = row || {};
  const snap = entry?.doc_snapshot || {};
  const when = formatDateLine(entry?.to || entry?.from || entry?.date);
  const status = snap?.status || item?.status || "—";
  const requestStatus = snap?.requeststatus || item?.requeststatus || "—";
  const issuedTo = resolveIdOrName(snap?.issued_to, userMap) || "—";
  const currentHolder = resolveIdOrName(snap?.current_holder, userMap) || "—";
  const transferTo = resolveIdOrName(snap?.transfered_to, userMap) || "—";
  const signedFile = entry?.signed_file || snap?.signed_file;
  const docType = snap && entry?.doc_type ? String(entry.doc_type).toUpperCase() : "";
  const isIcs = docType === "ICS";
  const docNo = isIcs ? snap?.ics_no : docType === "PTR" ? snap?.ptr_no : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            Property #{item?.property_no || "—"}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mt-1">
            {item?.itemName || "—"}
          </h3>
          <p className="text-[11px] text-gray-500">{item?.classification || "—"}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold text-gray-500">{when || "—"}</div>
          <StatusPill status={status} />
        </div>
      </div>

      <div className="mt-3 text-[11px] text-gray-600">
        <div className="font-semibold text-gray-800">{entry?.name || "—"}</div>
        <div className="mt-1 text-gray-500">{entry?.reason || entry?.remarks || "—"}</div>
        {Array.isArray(entry?.changes) && entry.changes.length > 0 && (
          <div className="mt-2 text-[10px] text-gray-500">
            Changes: {entry.changes.join(" | ")}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-gray-500">
        <div>
          <div className="text-gray-400">Issued To</div>
          <div className="font-semibold text-gray-700">{issuedTo}</div>
        </div>
        <div>
          <div className="text-gray-400">Current Holder</div>
          <div className="font-semibold text-gray-700">{currentHolder}</div>
        </div>
        <div>
          <div className="text-gray-400">Transfer To</div>
          <div className="font-semibold text-gray-700">{transferTo}</div>
        </div>
        <div>
          <div className="text-gray-400">Request Status</div>
          <div className="font-semibold text-gray-700">{requestStatus}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
        {docType ? (
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
            {docType}
          </span>
        ) : null}
        {entry?.doc_snapshot ? (
          signedFile?.url ? (
            <a
              href={resolveServerUrl(signedFile.url)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Open signed file
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onOpenDoc?.(entry)}
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Open {docNo || docType || "Document"}
            </button>
          )
        ) : (
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-500">
            No document
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonRow({ columns = 1 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx} className="px-4 py-3 border-b">
          <div className="h-3 w-full rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="h-3 w-24 rounded bg-gray-100" />
      <div className="mt-2 h-4 w-40 rounded bg-gray-100" />
      <div className="mt-1 h-3 w-28 rounded bg-gray-100" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-gray-100" />
        <div className="h-6 w-24 rounded-full bg-gray-100" />
      </div>
      <div className="mt-3 h-12 w-full rounded bg-gray-100" />
    </div>
  );
}

/* ========================================================================================
 * Main component
 * ====================================================================================== */

function Reportstableofficefurnitureandfixtures({
  assetFilter = "all",
  reportLabel = "Furniture & Fixtures",
}) {
  // Data
  const [inventory, setInventoryData] = useState([]);
  const [summaryInventory, setSummaryInventory] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [users, setUsers] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [appliedSearchText, setAppliedSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("Show All");
  const [assetTypeFilter, setAssetTypeFilter] = useState(assetFilter);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const [groupBy, setGroupBy] = useState("none");
  const [reportView, setReportView] = useState("items");

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: "property_no",
    direction: "asc",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Persist key
  const storageSuffix = assetFilter && assetFilter !== "all" ? `.${assetFilter}` : "";
  const STORAGE_KEY = `r02.officeFurnitureReports${storageSuffix}.v2`;
  const STORAGE_COLUMNS_KEY = `r02.officeFurnitureReports${storageSuffix}.columns.v2`;
  const DEFAULT_COLUMNS = [
    "property_no",
    "itemName",
    "classification",
    "asset_type",
    "asset_id",
    "batch_no",
    "purchase_date",
    "serial_no",
    "unit_cost",
    "status",
    "issued_to",
    "current_holder",
    "stored_to",
  ];
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const didHydrate = useRef(false);
  const assetLabel = assetFilter !== "all" ? ` (${assetFilter})` : "";

  useEffect(() => {
    setAssetTypeFilter(assetFilter);
  }, [assetFilter]);

  /* ---------- Build userMap once ---------- */
  const userMap = useMemo(() => {
    const map = {};
    for (const u of users || []) {
      if (u && u._id) {
        map[u._id] =
          u.username ||
          u.fullname ||
          u.name ||
          u.email ||
          u.displayName ||
          u._id;
      }
    }
    return map;
  }, [users]);

  /* ---------- Hydrate from localStorage ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved?.searchText === "string") {
        setSearchText(saved.searchText);
        setAppliedSearchText(saved.searchText);
      }
      if (saved?.statusFilter) setStatusFilter(saved.statusFilter);
      if (saved?.assetTypeFilter) setAssetTypeFilter(saved.assetTypeFilter);
      if (saved?.sortConfig) setSortConfig(saved.sortConfig);
      if (saved?.currentPage) setCurrentPage(saved.currentPage);
      if (saved?.itemsPerPage) setItemsPerPage(saved.itemsPerPage);
      const savedCols = localStorage.getItem(STORAGE_COLUMNS_KEY);
      if (savedCols) {
        const parsed = JSON.parse(savedCols);
        if (Array.isArray(parsed) && parsed.length) setVisibleColumns(parsed);
      }
    } catch {
      // ignore malformed storage
    } finally {
      didHydrate.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Persist to localStorage ---------- */
  useEffect(() => {
    if (!didHydrate.current) return;
    const payload = {
      searchText: appliedSearchText,
      statusFilter,
      assetTypeFilter,
      sortConfig,
      currentPage,
      itemsPerPage,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(STORAGE_COLUMNS_KEY, JSON.stringify(visibleColumns));
    } catch {
      // ignore storage errors
    }
  }, [
    appliedSearchText,
    statusFilter,
    assetTypeFilter,
    sortConfig,
    currentPage,
    itemsPerPage,
    visibleColumns,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportView]);

  useEffect(() => {
    setCurrentPage(1);
  }, [assetTypeFilter]);

  /* ---------- Fetch inventory + users (with abort) ---------- */
  useEffect(() => {
    const ac = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(itemsPerPage));
        if (statusFilter !== "Show All") params.set("status", statusFilter);
        if (assetTypeFilter !== "all") params.set("asset_type", assetTypeFilter);
        if (appliedSearchText.trim()) params.set("search", appliedSearchText.trim());

        const [invRes, usersRes] = await Promise.all([
          fetch(
            `${BASE_URL}/inventoryofficefurnitureandfixture/inventory?${params.toString()}`,
            {
              signal: ac.signal,
              headers: { Accept: "application/json" },
              credentials: "include",
            }
          ),
          fetch(`${BASE_URL}/users/directory`, {
            signal: ac.signal,
            headers: { Accept: "application/json" },
            credentials: "include",
            silentStatuses: [403],
            suppressErrorToast: true,
          }),
        ]);

        if (!invRes.ok) throw new Error("Failed to fetch inventory data.");

        const invJson = await invRes.json();
        const usersJson = usersRes.ok ? await usersRes.json() : [];

        if (Array.isArray(invJson)) {
          setInventoryData([...invJson].reverse());
          setTotalCount(invJson.length);
        } else {
          setInventoryData(Array.isArray(invJson?.data) ? invJson.data : []);
          setTotalCount(Number(invJson?.total || 0));
        }
        setUsers(Array.isArray(usersJson) ? usersJson : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => ac.abort();
  }, [currentPage, itemsPerPage, statusFilter, appliedSearchText, assetTypeFilter]);

  useEffect(() => {
    const ac = new AbortController();

    async function fetchSummaryInventory() {
      if (groupBy === "none") {
        setSummaryInventory([]);
        setSummaryError(null);
        setSummaryLoading(false);
        return;
      }

      try {
        setSummaryLoading(true);
        setSummaryError(null);
        setSummaryInventory([]);

        const params = new URLSearchParams();
        params.set("all", "true");
        if (statusFilter !== "Show All") params.set("status", statusFilter);
        if (assetTypeFilter !== "all") params.set("asset_type", assetTypeFilter);
        if (appliedSearchText.trim()) params.set("search", appliedSearchText.trim());

        const res = await fetch(
          `${BASE_URL}/inventoryofficefurnitureandfixture/inventory?${params.toString()}`,
          {
            signal: ac.signal,
            headers: { Accept: "application/json" },
            credentials: "include",
          }
        );

        if (!res.ok) throw new Error("Failed to fetch grouped summary data.");

        const json = await res.json();
        setSummaryInventory(Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setSummaryInventory([]);
        setSummaryError(err);
      } finally {
        setSummaryLoading(false);
      }
    }

    fetchSummaryInventory();
    return () => ac.abort();
  }, [groupBy, statusFilter, appliedSearchText, assetTypeFilter]);

  const filteredItems = useMemo(() => inventory || [], [inventory]);

  /* ---------- Sorting (stable) ---------- */
  const sortedItems = useMemo(() => {
    const arr = filteredItems.map((v, i) => ({ v, i }));
    const { key, direction } = sortConfig || {};
    if (!key) return filteredItems;

    arr.sort(({ v: a, i: ai }, { v: b, i: bi }) => {
      let aVal;
      let bVal;

      switch (key) {
        case "property_no":
          aVal = a?.property_no || "";
          bVal = b?.property_no || "";
          break;
        case "itemName":
          aVal = a?.itemName || "";
          bVal = b?.itemName || "";
          break;
        case "classification":
          aVal = a?.classification || "";
          bVal = b?.classification || "";
          break;
        case "purchase_date":
          aVal = getPurchaseDate(a)?.getTime() || 0;
          bVal = getPurchaseDate(b)?.getTime() || 0;
          break;
        case "serial_no":
          aVal = a?.serial_no || "";
          bVal = b?.serial_no || "";
          break;
        case "unit_cost":
          aVal = Number(a?.unit_cost ?? 0);
          bVal = Number(b?.unit_cost ?? 0);
          break;
        case "status":
          aVal = getStatusMeta(a?.status).label || "";
          bVal = getStatusMeta(b?.status).label || "";
          break;
        case "issued_to":
          aVal = resolveIssuedToDisplay(a, userMap) || "";
          bVal = resolveIssuedToDisplay(b, userMap) || "";
          break;
        case "current_holder":
          aVal = resolveCurrentHolderDisplay(a, userMap) || "";
          bVal = resolveCurrentHolderDisplay(b, userMap) || "";
          break;
        default:
          aVal = "";
          bVal = "";
      }

      const base = compareValues(aVal, bVal);
      const ord = direction === "asc" ? base : -base;
      return ord !== 0 ? ord : ai - bi;
    });

    return arr.map(({ v }) => v);
  }, [filteredItems, sortConfig, userMap]);

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const currentItems = sortedItems;

  const timelineRows = useMemo(() => {
    const rows = [];
    for (const item of currentItems || []) {
      const history = Array.isArray(item?.history) ? item.history : [];
      if (!history.length) continue;
      history.forEach((entry, idx) => {
        rows.push({
          key: entry?._id || `${item?._id || item?.property_no}-h${idx}`,
          item,
          entry,
        });
      });
    }
    rows.sort((a, b) => {
      const da = toValidDate(a?.entry?.to || a?.entry?.from || 0)?.getTime() || 0;
      const db = toValidDate(b?.entry?.to || b?.entry?.from || 0)?.getTime() || 0;
      return db - da;
    });
    return rows;
  }, [currentItems]);

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  /* ---------- Handlers ---------- */
  const handleApplySearch = () => {
    setAppliedSearchText(searchText.trim());
    setCurrentPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleApplySearch();
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const handleResetFilters = () => {
    setSearchText("");
    setAppliedSearchText("");
    setStatusFilter("Show All");
    setCurrentPage(1);
    setSortConfig({ key: "property_no", direction: "asc" });
  };

  const handlePageSizeClick = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const resolvePerson = (item) =>
    resolveIssuedToDisplay(item, userMap) ||
    resolveCurrentHolderDisplay(item, userMap) ||
    "";

  const resolveProvince = (item) => {
    const candidates = [
      item?.stored_to,
      item?.office,
      item?.project,
      resolveIssuedToDisplay(item, userMap),
      resolveCurrentHolderDisplay(item, userMap),
    ];
    for (const c of candidates) {
      const p = resolveProvinceFromText(c);
      if (p) return p;
    }
    return "Unknown";
  };

  const columnDefs = useMemo(
    () => [
      {
        key: "property_no",
        label: "Property No.",
        sortKey: "property_no",
        searchKey: "property_no",
        render: (item) => item?.property_no || "—",
        exportValue: (item) => item?.property_no || "",
      },
      {
        key: "itemName",
        label: "Item Description",
        sortKey: "itemName",
        searchKey: "itemName",
        render: (item) => item?.itemName || "—",
        exportValue: (item) => item?.itemName || "",
        align: "text-left",
      },
      {
        key: "classification",
        label: "Classification",
        sortKey: "classification",
        searchKey: "classification",
        render: (item) => item?.classification || "—",
        exportValue: (item) => item?.classification || "",
      },
      {
        key: "asset_type",
        label: "PPE/SE",
        sortKey: "asset_type",
        searchKey: "asset_type",
        render: (item) => item?.asset_type || "—",
        exportValue: (item) => item?.asset_type || "",
      },
      {
        key: "asset_id",
        label: "Asset ID",
        sortKey: "asset_id",
        searchKey: "asset_id",
        render: (item) => item?.asset_id || "—",
        exportValue: (item) => item?.asset_id || "",
      },
      {
        key: "batch_no",
        label: "Batch No.",
        sortKey: "batch_no",
        searchKey: "batch_no",
        render: (item) => item?.batch_no || "—",
        exportValue: (item) => item?.batch_no || "",
      },
      {
        key: "purchase_date",
        label: "Purchase Date",
        sortKey: "purchase_date",
        searchKey: "purchase_date",
        render: (item) => formatDateYMD(getPurchaseDate(item)) || "—",
        exportValue: (item) => formatDateYMD(getPurchaseDate(item)),
      },
      {
        key: "serial_no",
        label: "Serial No.",
        searchKey: "serial_no",
        render: (item) => item?.serial_no || "—",
        exportValue: (item) => item?.serial_no || "",
      },
      {
        key: "unit_cost",
        label: "Unit Cost",
        sortKey: "unit_cost",
        searchKey: "unit_cost",
        render: (item) => formatCurrencyPHP(item?.unit_cost),
        exportValue: (item) => Number(item?.unit_cost ?? 0),
      },
      {
        key: "status",
        label: "Status",
        sortKey: "status",
        searchKey: "status",
        render: (item) => <StatusPill status={item?.status} />,
        exportValue: (item) => getStatusMeta(item?.status).label || item?.status || "",
      },
      {
        key: "issued_to",
        label: "Issued To",
        sortKey: "issued_to",
        searchKey: "issued_to",
        render: (item) => {
          const issuedTo = resolveIssuedToDisplay(item, userMap) || "";
          const issuedTimeline = getIssuedToTimeline(item);
          return issuedTo ? (
            <div className="leading-tight">
              <div className="font-semibold text-gray-900">{issuedTo}</div>
              {issuedTimeline?.date ? (
                <div className="mt-0.5 text-[9px] md:text-[10px] font-medium text-gray-500">
                  {issuedTimeline.label}: {formatDateLine(issuedTimeline.date)}
                </div>
              ) : null}
            </div>
          ) : (
            "—"
          );
        },
        exportValue: (item) => resolveIssuedToDisplay(item, userMap) || "",
      },
      {
        key: "current_holder",
        label: "Current Holder",
        sortKey: "current_holder",
        searchKey: "current_holder",
        render: (item) => {
          const currentHolder = resolveCurrentHolderDisplay(item, userMap) || "";
          const holderTimeline = getCurrentHolderTimeline(item);
          return currentHolder ? (
            <div className="leading-tight">
              <div className="font-semibold text-gray-900">{currentHolder}</div>
              {holderTimeline?.date ? (
                <div className="mt-0.5 text-[9px] md:text-[10px] font-medium text-gray-500">
                  {holderTimeline.label}: {formatDateLine(holderTimeline.date)}
                </div>
              ) : null}
            </div>
          ) : (
            "—"
          );
        },
        exportValue: (item) => resolveCurrentHolderDisplay(item, userMap) || "",
      },
      {
        key: "project",
        label: "Project",
        searchKey: "project",
        render: (item) => item?.project || "—",
        exportValue: (item) => item?.project || "",
      },
      {
        key: "stored_to",
        label: "Current Location",
        searchKey: "stored_to",
        render: (item) => resolveCurrentLocationDisplay(item, userMap) || "—",
        exportValue: (item) => resolveCurrentLocationDisplay(item, userMap) || "",
      },
      {
        key: "province",
        label: "Province",
        render: (item) => resolveProvince(item),
        exportValue: (item) => resolveProvince(item),
      },
    ],
    [userMap]
  );

  const visibleColumnDefs = columnDefs.filter((c) => visibleColumns.includes(c.key));

  const groupedSummary = useMemo(() => {
    if (groupBy === "none") return [];
    const map = new Map();
    for (const item of summaryInventory) {
      let key = "";
      if (groupBy === "province") key = resolveProvince(item);
      else if (groupBy === "person") key = resolvePerson(item) || "Unassigned";
      else if (groupBy === "project") key = item?.project || "Unassigned";
      else if (groupBy === "status")
        key = getStatusMeta(item?.status).label || item?.status || "Unknown";
      if (!map.has(key)) map.set(key, { label: key, count: 0, total: 0 });
      const row = map.get(key);
      row.count += 1;
      row.total += Number(item?.unit_cost ?? 0);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [groupBy, summaryInventory, userMap]);

  const fetchExportItems = async () => {
    const params = new URLSearchParams();
    params.set("all", "true");
    if (statusFilter !== "Show All") params.set("status", statusFilter);
    if (assetTypeFilter !== "all") params.set("asset_type", assetTypeFilter);
    if (appliedSearchText.trim()) params.set("search", appliedSearchText.trim());

    const res = await fetch(
      `${BASE_URL}/inventoryofficefurnitureandfixture/inventory?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        credentials: "include",
      }
    );

    if (!res.ok) throw new Error("Failed to fetch all furniture report rows.");

    const json = await res.json();
    return Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  };

  const sortItemsForExport = (items = []) => {
    const arr = items.map((v, i) => ({ v, i }));
    const { key, direction } = sortConfig || {};
    if (!key) return items;

    arr.sort(({ v: a, i: ai }, { v: b, i: bi }) => {
      let aVal;
      let bVal;

      switch (key) {
        case "property_no":
          aVal = a?.property_no || "";
          bVal = b?.property_no || "";
          break;
        case "itemName":
          aVal = a?.itemName || "";
          bVal = b?.itemName || "";
          break;
        case "classification":
          aVal = a?.classification || "";
          bVal = b?.classification || "";
          break;
        case "purchase_date":
          aVal = getPurchaseDate(a)?.getTime() || 0;
          bVal = getPurchaseDate(b)?.getTime() || 0;
          break;
        case "serial_no":
          aVal = a?.serial_no || "";
          bVal = b?.serial_no || "";
          break;
        case "unit_cost":
          aVal = Number(a?.unit_cost ?? 0);
          bVal = Number(b?.unit_cost ?? 0);
          break;
        case "status":
          aVal = getStatusMeta(a?.status).label || "";
          bVal = getStatusMeta(b?.status).label || "";
          break;
        case "issued_to":
          aVal = resolveIssuedToDisplay(a, userMap) || "";
          bVal = resolveIssuedToDisplay(b, userMap) || "";
          break;
        case "current_holder":
          aVal = resolveCurrentHolderDisplay(a, userMap) || "";
          bVal = resolveCurrentHolderDisplay(b, userMap) || "";
          break;
        default:
          aVal = "";
          bVal = "";
      }

      const base = compareValues(aVal, bVal);
      const ord = direction === "asc" ? base : -base;
      return ord !== 0 ? ord : ai - bi;
    });

    return arr.map(({ v }) => v);
  };

  /* ---------- Export to Excel ---------- */
  const exportToExcel = async () => {
    try {
      const exportItems = sortItemsForExport(await fetchExportItems());
      const rows = exportItems.map((item) => {
        return visibleColumnDefs.reduce((acc, col) => {
          acc[col.label] = col.exportValue(item);
          return acc;
        }, {});
      });

      const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
      ws["!cols"] = visibleColumnDefs.map((col) => ({
        wch: col.label.length > 18 ? 32 : 18,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Office Furniture");

      const dt = new Date();
      const stamp = [
        dt.getFullYear(),
        String(dt.getMonth() + 1).padStart(2, "0"),
        String(dt.getDate()).padStart(2, "0"),
        String(dt.getHours()).padStart(2, "0"),
        String(dt.getMinutes()).padStart(2, "0"),
      ].join("");

      XLSX.writeFile(wb, `Office_Furniture_Fixtures_Report_${stamp}.xlsx`);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Failed to export Excel.");
    }
  };

  const exportGroupSummary = () => {
    if (groupBy === "none") return;
    const rows = groupedSummary.map((row) => ({
      Group: row.label,
      Count: row.count,
      "Total Unit Cost (PHP)": row.total,
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    ws["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    const dt = new Date();
    const stamp = [
      dt.getFullYear(),
      String(dt.getMonth() + 1).padStart(2, "0"),
      String(dt.getDate()).padStart(2, "0"),
      String(dt.getHours()).padStart(2, "0"),
      String(dt.getMinutes()).padStart(2, "0"),
    ].join("");
    XLSX.writeFile(wb, `Office_Furniture_Fixtures_Summary_${stamp}.xlsx`);
  };

  /* ---------- Stats (chips) ---------- */
  const filteredCount = sortedItems.length;
  const hasAppliedSearch = Boolean(appliedSearchText.trim());
  const hasPendingSearchChanges = searchText.trim() !== appliedSearchText.trim();
  const inStockCount = inventory.filter((i) => getStatusMeta(i?.status).label === "In stock").length;
  const issuedCount = inventory.filter((i) => getStatusMeta(i?.status).label === "Issued").length;
  const forTransferCount = inventory.filter(
    (i) => getStatusMeta(i?.status).label === "For transfer"
  ).length;

  const Chip = ({
    label,
    count,
    colorClasses,
    onClick,
    active = false,
    disabled = false,
    title,
    icon: Icon,
  }) => {
    const base =
      "group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all focus:outline-none focus:ring-2";
    const state = disabled
      ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
      : active
      ? `${colorClasses.activeBg} ${colorClasses.activeText} ${colorClasses.activeBorder} ring-0`
      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 focus:ring-indigo-300";
    return (
      <button
        type="button"
        className={`${base} ${state}`}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        title={title}
        aria-pressed={active}
      >
        <span
          className={`inline-flex w-5 h-5 items-center justify-center rounded-md border ${
            active ? colorClasses.activeBorder : "border-gray-200"
          } ${active ? colorClasses.activeBgSubtle : "bg-gray-50"}`}
        >
          <Icon active={active} />
        </span>
        <span className="hidden sm:inline">{label}</span>
        <span
          className={`ml-1 inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            active ? colorClasses.countActiveBg : "bg-gray-100"
          } ${active ? colorClasses.activeText : "text-gray-700"}`}
        >
          {count}
        </span>
      </button>
    );
  };

  const IconTotal = ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke={active ? "currentColor" : "#6b7280"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
  const IconStock = ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke={active ? "currentColor" : "#6b7280"}
        strokeWidth="2"
      />
      <path
        d="M7 7h10v10H7z"
        fill={active ? "currentColor" : "transparent"}
        opacity={active ? 0.2 : 0}
      />
    </svg>
  );
  const IconTransfer = ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 7h10M7 12h10M7 17h10"
        stroke={active ? "currentColor" : "#6b7280"}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17 7l-2-2M17 7l-2 2"
        stroke={active ? "currentColor" : "#6b7280"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
  const IconIssued = ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 13l4 4L19 7"
        stroke={active ? "currentColor" : "#6b7280"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const colors = {
    total: {
      activeBg: "bg-indigo-600",
      activeText: "text-white",
      activeBorder: "border-indigo-600",
      activeBgSubtle: "bg-indigo-500/10",
      countActiveBg: "bg-indigo-500/20",
    },
    stock: {
      activeBg: "bg-emerald-600",
      activeText: "text-white",
      activeBorder: "border-emerald-600",
      activeBgSubtle: "bg-emerald-500/10",
      countActiveBg: "bg-emerald-500/20",
    },
    transfer: {
      activeBg: "bg-amber-500",
      activeText: "text-white",
      activeBorder: "border-amber-500",
      activeBgSubtle: "bg-amber-500/10",
      countActiveBg: "bg-amber-500/20",
    },
    issued: {
      activeBg: "bg-rose-600",
      activeText: "text-white",
      activeBorder: "border-rose-600",
      activeBgSubtle: "bg-rose-500/10",
      countActiveBg: "bg-rose-500/20",
    },
  };

  /* ---------- Render ---------- */

  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <div
          role="alert"
          className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700"
        >
          {error.message || "Failed to load furniture & fixtures report."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Office Dashboard", to: "/officedashboard" },
            { label: "Reports" },
            { label: `${reportLabel}${assetLabel}` },
          ]}
        />

        {/* HEADER */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-light text-slate-900">
              Reports <span className="font-semibold">{reportLabel}</span>
              {assetLabel}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Filter, group, and export asset reports.
            </p>
          </div>

          <div className="filter-card mb-4">
            <div className="filter-card-content">
              <div className="flex flex-col gap-3">
                <div className="table-filters flex-col sm:flex-row sm:items-center xl:hidden">
                  <div className="w-full sm:flex-1">
                    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                      <span className="h-2 w-2 rounded-full bg-slate-500" />
                      Report view
                    </label>
                    <select
                      value={reportView}
                      onChange={(e) => setReportView(e.target.value)}
                      className="table-select w-full"
                    >
                      <option value="items">Items</option>
                      <option value="timeline">Timeline</option>
                    </select>
                  </div>

                  <div className="w-full sm:flex-1">
                    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      Asset type
                    </label>
                    <select
                      value={assetTypeFilter}
                      onChange={(e) => {
                        if (assetFilter !== "all") return;
                        setAssetTypeFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      disabled={assetFilter !== "all"}
                      className="table-select w-full"
                    >
                      <option value="all">All</option>
                      <option value="PPE">PPE</option>
                      <option value="SE">SE</option>
                    </select>
                  </div>

                  <div className="w-full sm:flex-1">
                    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Rows
                    </label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handlePageSizeClick(Number(e.target.value))}
                      className="table-select w-full"
                    >
                      <option value={10}>Rows: 10</option>
                      <option value={20}>Rows: 20</option>
                      <option value={50}>Rows: 50</option>
                      <option value={100}>Rows: 100</option>
                    </select>
                  </div>

                  <div className="w-full sm:flex-1">
                    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      Group
                    </label>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="table-select w-full"
                    >
                      <option value="none">Group: None</option>
                      <option value="province">Group: Province</option>
                      <option value="person">Group: Person</option>
                      <option value="project">Group: Project</option>
                      <option value="status">Group: Status</option>
                    </select>
                  </div>

                  <div className="text-[11px] text-slate-500 sm:text-xs">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {currentItems.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-900">{totalCount}</span>
                  </div>
                </div>

                <div className="hidden xl:block">
                  <div className="request-filterbar">
                  <div className="request-chip-group">
                    <button
                      type="button"
                      onClick={() => setReportView("items")}
                      className={`request-chip request-chip-slate ${
                        reportView === "items" ? "request-chip-active" : ""
                      }`}
                    >
                      Items
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportView("timeline")}
                      className={`request-chip request-chip-indigo ${
                        reportView === "timeline" ? "request-chip-active" : ""
                      }`}
                    >
                      Timeline
                    </button>
                  </div>

                  <span className="request-divider" aria-hidden="true" />

                  <div className="request-chip-group">
                    {["all", "PPE", "SE"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (assetFilter !== "all") return;
                          setAssetTypeFilter(opt);
                          setCurrentPage(1);
                        }}
                        disabled={assetFilter !== "all" && assetTypeFilter !== opt}
                        className={`request-chip ${
                          opt === "all"
                            ? "request-chip-slate"
                            : opt === "PPE"
                            ? "request-chip-sky"
                            : "request-chip-emerald"
                        } ${assetTypeFilter === opt ? "request-chip-active" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {opt === "all" ? "All" : opt}
                      </button>
                    ))}
                  </div>

                  <span className="request-divider" aria-hidden="true" />

                  <select
                    value={itemsPerPage}
                    onChange={(e) => handlePageSizeClick(Number(e.target.value))}
                    className="request-select min-w-[130px] bg-slate-900 text-white border-slate-900/80"
                  >
                    <option value={10}>Rows: 10</option>
                    <option value={20}>Rows: 20</option>
                    <option value={50}>Rows: 50</option>
                    <option value={100}>Rows: 100</option>
                  </select>

                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    className="request-select min-w-[140px]"
                  >
                    <option value="none">Group: None</option>
                    <option value="province">Group: Province</option>
                    <option value="person">Group: Person</option>
                    <option value="project">Group: Project</option>
                    <option value="status">Group: Status</option>
                  </select>

                  <div className="ml-auto text-[11px] text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {currentItems.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-900">
                      {totalCount}
                    </span>
                  </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                      <div className="min-w-0 flex-1">
                        <label className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                          Quick search
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <SearchInput
                            value={searchText}
                            onChange={(e) => setSearchText(e?.target?.value ?? "")}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search property no, item, serial, classification, project, status, or location"
                            ariaLabel="Search furniture and fixtures reports"
                            className="w-full"
                            inputClassName="text-xs md:text-sm"
                          />
                          <button
                            type="button"
                            onClick={handleApplySearch}
                            className="table-button-accent whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            style={{ color: "#ffffff" }}
                          >
                            Apply search
                          </button>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="table-button whitespace-nowrap"
                            title="Clear search and filters"
                          >
                            Clear filters
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Searches across property number, item description, serial number,
                          classification, asset type, project, status, and current location. The
                          table updates only when you apply the search.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:max-w-[18rem] xl:justify-end">
                        {hasAppliedSearch ? (
                          <span className="inline-flex max-w-full items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700">
                            <span className="max-w-[12rem] truncate">
                              Search: {appliedSearchText}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">No active search</span>
                        )}

                        {hasPendingSearchChanges ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                            Unapplied changes
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <button
                      onClick={exportToExcel}
                      className="table-button-accent bg-emerald-500 text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      title="Export filtered rows with visible columns"
                    >
                      Export to Excel
                    </button>

                    {groupBy !== "none" && (
                      <button
                        onClick={exportGroupSummary}
                        className="table-button border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        title="Export grouped summary"
                      >
                        Export summary
                      </button>
                    )}

                    <div className="relative">
                      <button
                        onClick={() => setIsColumnsOpen((p) => !p)}
                        className="table-button"
                        aria-haspopup="listbox"
                        aria-expanded={isColumnsOpen}
                      >
                        Columns
                      </button>
                      {isColumnsOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                          {columnDefs.map((col) => {
                            const checked = visibleColumns.includes(col.key);
                            return (
                              <label
                                key={col.key}
                                className="flex items-center gap-2 px-3 py-2 text-[10px] md:text-xs text-gray-700 hover:bg-gray-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setVisibleColumns((prev) => {
                                      if (e.target.checked) return [...prev, col.key];
                                      if (prev.length === 1) return prev;
                                      return prev.filter((k) => k !== col.key);
                                    });
                                  }}
                                />
                                <span>{col.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* BEAUTIFIED SUMMARY CHIPS */}
        <div className="mb-4 -mx-1 flex flex-wrap items-center gap-2">
          <Chip
            label="Total"
            count={totalCount}
            colorClasses={colors.total}
            onClick={() => setStatusFilter("Show All")}
            active={statusFilter === "Show All"}
            disabled={loading}
            title="Show all records"
            icon={IconTotal}
          />
          <Chip
            label="In stock"
            count={inStockCount}
            colorClasses={colors.stock}
            onClick={() => setStatusFilter("In stock")}
            active={statusFilter === "In stock"}
            disabled={loading}
            title="Filter In stock"
            icon={IconStock}
          />
          <Chip
            label="For transfer"
            count={forTransferCount}
            colorClasses={colors.transfer}
            onClick={() => setStatusFilter("For transfer")}
            active={statusFilter === "For transfer"}
            disabled={loading}
            title="Filter For transfer"
            icon={IconTransfer}
          />
          <Chip
            label="Issued"
            count={issuedCount}
            colorClasses={colors.issued}
            onClick={() => setStatusFilter("Issued")}
            active={statusFilter === "Issued"}
            disabled={loading}
            title="Filter Issued"
            icon={IconIssued}
          />
          <div className="ml-auto text-[11px] text-gray-500">
            {reportView === "timeline" ? (
              <>
                Showing{" "}
                <span className="font-semibold text-gray-800">{timelineRows.length}</span>{" "}
                timeline entries on this page
              </>
            ) : (
              <>
                Showing <span className="font-semibold text-gray-800">{filteredCount}</span> of{" "}
                <span className="font-semibold text-gray-800">{totalCount}</span>
              </>
            )}
          </div>
        </div>
      </div>

        {/* GROUP SUMMARY */}
        {groupBy !== "none" && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Summary by {groupBy}
                </p>
	                <p className="text-[11px] text-slate-400">
	                  Counts reflect all records matching the current filters.
	                </p>
	              </div>
	              <div className="text-[11px] text-slate-500">
	                {summaryLoading ? (
	                  "Loading summary..."
	                ) : (
	                  <>
	                    Groups:{" "}
	                    <span className="font-semibold text-slate-800">
	                      {groupedSummary.length}
	                    </span>
	                  </>
	                )}
	              </div>
	            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                      {groupBy}
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                      Items
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                      Total Unit Cost
                    </th>
                  </tr>
	                </thead>
	                <tbody>
	                  {summaryLoading && (
	                    <tr>
	                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-500">
	                        Loading grouped summary...
	                      </td>
	                    </tr>
	                  )}
	                  {!summaryLoading &&
	                    !summaryError &&
	                    groupedSummary.map((row) => (
	                    <tr key={row.label} className="border-t border-slate-100">
	                      <td className="px-4 py-2 text-sm text-slate-800">{row.label}</td>
	                      <td className="px-4 py-2 text-right text-sm font-semibold text-slate-800">
                        {row.count}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-slate-700">
	                        {formatCurrencyPHP(row.total)}
	                      </td>
	                    </tr>
	                  ))}
	                  {!summaryLoading && summaryError && (
	                    <tr>
	                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-red-600">
	                        {summaryError.message || "Failed to load grouped summary."}
	                      </td>
	                    </tr>
	                  )}
	                  {!summaryLoading && !summaryError && groupedSummary.length === 0 && (
	                    <tr>
	                      <td colSpan={3} className="px-4 py-6">
	                        <EmptyState
                          title="No grouped results"
                          subtitle="There are no records for this grouping yet."
                          hint="Try changing the group or filters."
                          className="max-w-md py-6"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABLE CARD */}
        <div className="table-shell table-compact table-flush px-3 md:px-5 pt-3 md:pt-5 pb-4">
          <div className="overflow-x-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            ) : reportView === "timeline" ? (
              timelineRows.length === 0 ? (
                <EmptyState
                  title="No history entries"
                  subtitle="There are no timeline records available for this page."
                  hint="Try adjusting filters or the date range."
                  className="max-w-2xl"
                />
              ) : (
                timelineRows.map((row) => (
                  <TimelineCard
                    key={row.key}
                    row={row}
                    userMap={userMap}
                    onOpenDoc={(entry) => openHistoryDoc(entry, userMap)}
                  />
                ))
              )
            ) : currentItems.length === 0 ? (
              <EmptyState
                title="No matching furniture & fixtures"
                subtitle="We could not find any furniture and fixtures that match your filters."
                hint="Try adjusting filters or clearing search."
                className="max-w-2xl"
              />
            ) : (
              currentItems.map((row) => (
                <ItemCard key={row._id} data={row} userMap={userMap} />
              ))
            )}
          </div>

          {loading ? (
            <table className="w-full whitespace-nowrap hidden lg:table text-left">
              <thead>
                <tr className="h-10 text-gray-800">
                  {visibleColumnDefs.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-2 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 ${
                        col.align === "text-left" ? "text-left" : "text-left"
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} columns={visibleColumnDefs.length || 1} />
                ))}
              </tbody>
            </table>
          ) : (
            <>
              {reportView === "timeline" ? (
                <table className="w-full whitespace-nowrap hidden lg:table text-left">
                  <thead>
                    <tr className="h-10 text-gray-800">
                      <th className="px-4 py-2 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Item
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Action
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600">
                        When
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Issued / Holder / Transfer
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Remarks
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Document
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10">
                          <EmptyState
                            title="No history entries"
                            subtitle="There are no timeline records available for this page."
                            hint="Try adjusting filters or the date range."
                            className="max-w-2xl"
                          />
                        </td>
                      </tr>
                    ) : (
                      timelineRows.map((row) => {
                        const snap = row.entry?.doc_snapshot || {};
                        const issuedTo = resolveIdOrName(snap?.issued_to, userMap) || "—";
                        const holder = resolveIdOrName(snap?.current_holder, userMap) || "—";
                        const transfer = resolveIdOrName(snap?.transfered_to, userMap) || "—";
                        const status = snap?.status || row.item?.status || "—";
                        const reqStatus = snap?.requeststatus || row.item?.requeststatus || "—";
                        const when = formatDateLine(row.entry?.to || row.entry?.from || row.entry?.date);
                        const docType = row.entry?.doc_type ? String(row.entry.doc_type).toUpperCase() : "";
                        const docNo =
                          docType === "ICS" ? snap?.ics_no : docType === "PTR" ? snap?.ptr_no : null;
                        const signedFile = row.entry?.signed_file || row.entry?.doc_snapshot?.signed_file;
                        return (
                          <tr key={row.key} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="px-4 py-3 text-[10px] md:text-xs border-b text-gray-800">
                              <div className="font-semibold">{row.item?.itemName || "—"}</div>
                              <div className="text-[10px] text-gray-500">
                                #{row.item?.property_no || "—"} · {row.item?.classification || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[10px] md:text-xs border-b text-gray-800">
                              <div className="font-semibold">{row.entry?.name || "—"}</div>
                              {row.entry?.doc_type ? (
                                <div className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
                                  {String(row.entry.doc_type).toUpperCase()}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-[10px] md:text-xs border-b text-gray-800">
                              {when || "—"}
                            </td>
                            <td className="px-4 py-3 text-[10px] md:text-xs border-b text-gray-800">
                              <div>Issued: {issuedTo}</div>
                              <div>Holder: {holder}</div>
                              <div>Transfer: {transfer}</div>
                            </td>
                            <td className="px-4 py-3 text-[10px] md:text-xs border-b text-gray-800">
                              <div>{status}</div>
                              <div className="text-[10px] text-gray-500">{reqStatus}</div>
                            </td>
                            <td className="px-4 py-3 text-[10px] md:text-xs border-b text-gray-800">
                              <div>{row.entry?.reason || row.entry?.remarks || "—"}</div>
                              {Array.isArray(row.entry?.changes) && row.entry.changes.length > 0 && (
                                <div className="mt-1 text-[10px] text-gray-500">
                                  Changes: {row.entry.changes.join(" | ")}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[10px] md:text-xs border-b text-left">
                              {signedFile?.url ? (
                                <a
                                  href={resolveServerUrl(signedFile.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  Open signed file
                                </a>
                              ) : row.entry?.doc_snapshot ? (
                                <button
                                  type="button"
                                  onClick={() => openHistoryDoc(row.entry, userMap)}
                                  className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  Open {docNo || docType || "Document"}
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full whitespace-nowrap hidden lg:table text-left">
                  <thead>
                    <tr className="h-10 text-gray-800">
                      {visibleColumnDefs.map((col) =>
                        col.sortKey ? (
                          <TableHeader
                            key={col.key}
                            title={col.label}
                            sortKey={col.sortKey}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                          />
                        ) : (
                          <th
                            key={col.key}
                            className={`px-4 py-2 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-600 ${
                              col.align === "text-left" ? "text-left" : "text-left"
                            }`}
                          >
                            {col.label}
                          </th>
                        )
                      )}
                    </tr>

                  </thead>

                  <tbody>
                    {currentItems.length === 0 ? (
                      <tr>
                        <td colSpan={visibleColumnDefs.length || 1} className="px-4 py-10">
                          <EmptyState
                            title="No matching records"
                            subtitle="We could not find any records that match your filters."
                            hint="Try adjusting filters or clearing search."
                            className="max-w-2xl"
                          />
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((data) => (
                        <tr
                          key={data?._id || `${data?.property_no}-${data?.itemName}`}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          {visibleColumnDefs.map((col) => (
                            <td
                              key={`${data?._id || data?.property_no}-${col.key}`}
                              className={`px-4 py-3 whitespace-nowrap text-[10px] md:text-xs border-b text-gray-800 ${
                                col.align === "text-left" ? "text-left" : "text-left"
                              }`}
                            >
                              {col.render(data)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

            </>
          )}
          </div>

          {!loading && totalCount > itemsPerPage && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 bg-white px-3 py-4 text-[10px] md:px-4 md:text-xs">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                style={
                  currentPage === 1
                    ? { backgroundColor: "#f9fafb", color: "#d1d5db", cursor: "not-allowed" }
                    : { backgroundColor: "#ffffff", color: "#374151" }
                }
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                style={
                  currentPage === totalPages
                    ? { backgroundColor: "#f9fafb", color: "#d1d5db", cursor: "not-allowed" }
                    : { backgroundColor: "#ffffff", color: "#374151" }
                }
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Reportstableofficefurnitureandfixtures;
