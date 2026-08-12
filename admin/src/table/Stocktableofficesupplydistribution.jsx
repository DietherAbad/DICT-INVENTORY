// src/components/DistributionTable.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";
import DICT from "../assets/DICT.png";
import * as XLSX from "xlsx";
import ModalShell from "../components/ModalShell";
import EmptyState from "../components/EmptyState";

const classNames = (...c) => c.filter(Boolean).join(" ");

/* ---------- Small reusable <th> ---------- */
function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-[10px] md:text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-50 text-left"
    >
      {title}
    </th>
  );
}

/* ---------- Status Pill (aligned with Stocktableofficesupply standard) ---------- */
function getStatusLabel(status) {
  const raw = (status || "").toLowerCase().trim();
  if (
    raw === "pending" ||
    raw === "for checking" ||
    raw === "for approval" ||
    raw === "for disposal"
  ) {
    return "Pending";
  }
  if (raw === "approved" || raw === "for release") return "Approved";
  if (raw === "transferred" || raw === "received") return "Transferred";
  if (raw === "disposed") return "Disposed";
  if (raw === "declined") return "Declined";
  if (raw === "out of stock") return "Out of stock";
  return status || "Unknown";
}

function StatusPill({ status }) {
  const raw = (status || "").toLowerCase().trim();

  let label = getStatusLabel(status);
  let bg = "#f3f4f6";
  let color = "#374151";
  let border = "#e5e7eb";

  if (
    raw === "pending" ||
    raw === "for checking" ||
    raw === "for approval" ||
    raw === "for disposal"
  ) {
    label = "Pending";
    bg = "#dbeafe";
    color = "#1d4ed8";
    border = "#bfdbfe";
  } else if (raw === "approved" || raw === "for release") {
    label = "Approved";
    bg = "#dcfce7";
    color = "#166534";
    border = "#bbf7d0";
  } else if (raw === "transferred" || raw === "received") {
    label = "Transferred";
    bg = "#e0f2fe";
    color = "#0369a1";
    border = "#bae6fd";
  } else if (raw === "disposed") {
    label = "Disposed";
    bg = "#fee2e2";
    color = "#b91c1c";
    border = "#fecaca";
  } else if (raw === "declined") {
    label = "Declined";
    bg = "#fee2e2";
    color = "#b91c1c";
    border = "#fecaca";
  } else if (raw === "out of stock") {
    label = "Out of stock";
    bg = "#fee2e2";
    color = "#b91c1c";
    border = "#fecaca";
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] md:text-[11px] font-semibold border"
      style={{ backgroundColor: bg, color, borderColor: border }}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/* ---------- Row component ---------- */
function TableRow({ row }) {
  const formattedRequested = row.date_requested
    ? new Date(row.date_requested).toISOString().split("T")[0]
    : "—";
  const releasedBase = row.date_released || row.date_received;
  const formattedReleased = releasedBase
    ? new Date(releasedBase).toISOString().split("T")[0]
    : "—";
  const reference =
    row.RIS_no || row.ris_no || row.reference || (row._id ? `…${String(row._id).slice(-6)}` : "—");

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {reference}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm font-medium text-left border-b text-gray-900">
        <div className="text-sm font-semibold text-gray-900">{row.itemName || "—"}</div>
        <div className="text-[10px] text-gray-500">{row.classification || "—"}</div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-left border-b text-gray-800">
        {row.quantity ?? "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-500">
        <div className="text-gray-700">Req: {formattedRequested}</div>
        <div className="text-gray-400">Rel: {formattedReleased}</div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {row.distributedto || "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {row.office || "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-left border-b">
        <StatusPill status={row.status || row.requeststatus} />
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs font-medium text-left border-b">
        <Link
          to={`/checkform/${row._id}`}
          className="manage-button"
        >
          Manage
        </Link>
      </td>
    </tr>
  );
}

function ItemCard({ row }) {
  const formattedRequested = row.date_requested
    ? new Date(row.date_requested).toISOString().split("T")[0]
    : "—";
  const releasedBase = row.date_released || row.date_received;
  const formattedReleased = releasedBase
    ? new Date(releasedBase).toISOString().split("T")[0]
    : "—";
  const reference =
    row.RIS_no || row.ris_no || row.reference || (row._id ? `…${String(row._id).slice(-6)}` : "—");

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            Ref {reference}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mt-1">
            {row.itemName || "—"}
          </h3>
          <p className="text-[11px] text-gray-500">{row.classification || "—"}</p>
        </div>
        <StatusPill status={row.status || row.requeststatus} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
          Qty: {row.quantity ?? "—"} {row.unitofmeasure || ""}
        </span>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600">
          Req: {formattedRequested}
        </span>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
          Rel: {formattedReleased}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
          To: {row.distributedto || "—"}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
          Office: {row.office || "—"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/checkform/${row._id}`}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-2 w-24 rounded bg-gray-100" />
          <div className="h-3 w-3/4 rounded bg-gray-100" />
          <div className="h-2 w-1/2 rounded bg-gray-100" />
        </div>
        <div className="h-6 w-20 rounded-full bg-gray-100" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="h-6 w-24 rounded-full bg-gray-100" />
        <div className="h-6 w-24 rounded-full bg-gray-100" />
        <div className="h-6 w-24 rounded-full bg-gray-100" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="h-6 w-32 rounded-full bg-gray-100" />
        <div className="h-6 w-24 rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 h-8 w-24 rounded-lg bg-gray-100" />
    </div>
  );
}

const formatDateDMY = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, idx) => (
        <td key={idx} className="px-4 py-3 border-b">
          <div className="h-3 w-full rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

/* ---------- Main component ---------- */
function DistributionTable({ requestType = "distribution" }) {
  const [rawDistributions, setRawDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showRsmiModal, setShowRsmiModal] = useState(false);
  const [rsmiStart, setRsmiStart] = useState("");
  const [rsmiEnd, setRsmiEnd] = useState("");
  const [rsmiError, setRsmiError] = useState("");
  const itemsPerPage = 20;

  const normalizedRequestType = String(requestType || "").toLowerCase().trim();
  const isDisposalView = normalizedRequestType === "disposal";
  const pageLabel = isDisposalView ? "Supply Disposal" : "Supply Distribution";
  const pageTitle = isDisposalView ? "Disposal Report" : "Distribution Table";
  const reportTitle = isDisposalView ? "Supply Disposal Report" : "Supply Distribution Report";
  const sheetLabel = isDisposalView ? "Disposals" : "Distributions";
  const exportPrefix = isDisposalView ? "Supply_Disposals" : "Supply_Distributions";

  /* ---------- Fetch distributions ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(itemsPerPage));
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (statusFilter !== "All") params.set("status", statusFilter);
        if (normalizedRequestType === "distribution") {
          params.set("request_type", "distribution");
        } else if (normalizedRequestType === "disposal") {
          params.set("request_type", "disposal");
        }

        const res = await fetch(
          `${BASE_URL}/distribute/distributions?${params.toString()}`
        );
        if (!res.ok) throw new Error("Failed to fetch distributions.");

        const data = await res.json();
        const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

        // Latest first using date_released or date_requested
        const sorted = arr.sort((a, b) => {
          const dateA = new Date(a.date_released || a.date_requested || 0);
          const dateB = new Date(b.date_released || b.date_requested || 0);
          return dateB - dateA;
        });

        setRawDistributions(sorted);
        setTotalCount(Array.isArray(data) ? arr.length : Number(data?.total || 0));
      } catch (err) {
        console.error(err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentPage, itemsPerPage, searchQuery, statusFilter, normalizedRequestType]);

  /* ---------- Flatten distributions to rows ---------- */
  const filteredDistributions = useMemo(() => {
    if (normalizedRequestType === "distribution") {
      return rawDistributions.filter(
        (dist) => String(dist?.request_type || "").toLowerCase().trim() !== "disposal"
      );
    }
    if (normalizedRequestType === "disposal") {
      return rawDistributions.filter(
        (dist) => String(dist?.request_type || "").toLowerCase().trim() === "disposal"
      );
    }
    return rawDistributions;
  }, [rawDistributions, normalizedRequestType]);

  const explodedRows = useMemo(() => {
    return filteredDistributions.flatMap((dist) => {
      if (Array.isArray(dist.items) && dist.items.length > 0) {
        return dist.items.map((itm, idx) => ({
          ...dist,
          itemName: itm.itemName,
          classification: itm.classification,
          quantity: itm.quantity,
          unitofmeasure: itm.unitofmeasure,
          stock_no: itm.stock_no,
          cost: itm.cost,
          __itemIndex: idx,
        }));
      }

      return {
        ...dist,
        itemName: dist.itemName || "—",
        classification: dist.classification || "—",
        quantity: dist.quantity || dist.qty || 0,
        unitofmeasure: dist.unitofmeasure,
        stock_no: dist.stock_no,
        cost: dist.cost,
        __itemIndex: 0,
      };
    });
  }, [filteredDistributions]);

  /* ---------- Filter + Search ---------- */
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return explodedRows.filter((row) => {
      const statusVal = getStatusLabel(row.status || row.requeststatus).toLowerCase();

      if (statusFilter !== "All") {
        if (statusVal !== statusFilter.toLowerCase()) return false;
      }

      if (!q) return true;

      const text = [
        row.RIS_no,
        row.ris_no,
        row.reference,
        row.itemName,
        row.classification,
        row.quantity,
        row.distributedto,
        row.office,
        row.status,
        row.requeststatus,
        row.date_released,
        row.date_requested,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [explodedRows, searchQuery, statusFilter]);

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const currentItems = filteredRows;

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  /* ---------- Handlers ---------- */
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const getDistributionDate = (row) =>
    row.date_released || row.date_received || row.date_requested || null;

  const statusOptions = isDisposalView
    ? ["All", "Pending", "Approved", "Disposed", "Declined"]
    : ["All", "Pending", "Approved", "Transferred", "Declined"];
  const statusChipTone = (opt) => {
    if (opt === "Pending") return "request-chip-amber";
    if (opt === "Approved") return "request-chip-emerald";
    if (opt === "Transferred") return "request-chip-sky";
    if (opt === "Disposed") return "request-chip-rose";
    if (opt === "Declined") return "request-chip-rose";
    return "request-chip-slate";
  };

  const buildExportRows = (rows) =>
    rows.map((row) => ({
      Reference:
        row.RIS_no ||
        row.ris_no ||
        row.reference ||
        (row._id ? `…${String(row._id).slice(-6)}` : "—"),
      "Item Name": row.itemName || "—",
      Classification: row.classification || "—",
      Quantity: row.quantity ?? "—",
      Requested: formatDateDMY(row.date_requested),
      Released: formatDateDMY(row.date_released || row.date_received),
      Recipient: row.distributedto || "—",
      Office: row.office || "—",
      Status: getStatusLabel(row.status || row.requeststatus),
    }));

  const handleExportExcel = () => {
    const rows = buildExportRows(filteredRows);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    ws["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetLabel);
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${exportPrefix}_${stamp}.xlsx`);
  };

  const handleExportPdf = () => {
    const rows = buildExportRows(filteredRows);
    const stamp = new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const logoSrc = DICT;
    const tableRows =
      rows.length > 0
        ? rows
            .map(
              (r) => `
            <tr>
              <td>${r.Reference}</td>
              <td>${r["Item Name"]}</td>
              <td>${r.Classification}</td>
              <td>${r.Quantity}</td>
              <td>${r.Requested}</td>
              <td>${r.Released}</td>
              <td>${r.Recipient}</td>
              <td>${r.Office}</td>
              <td>${r.Status}</td>
            </tr>`
            )
            .join("")
        : `<tr><td colspan="9">No records found.</td></tr>`;

    const w = window.open("", "", "width=1000,height=800");
    if (!w) {
      alert("Pop-up blocked. Please allow pop-ups then try again.");
      return;
    }
    w.document.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: "Inter", Arial, sans-serif; padding: 24px; color: #0f172a; }
            .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
            .logo { height: 36px; width: 36px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px; }
            h1 { font-size: 18px; margin: 0; }
            .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 11px; text-align: left; }
            th { background: #f8fafc; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; }
            .meta { display: flex; justify-content: space-between; font-size: 11px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoSrc}" class="logo" alt="DICT" />
            <div>
              <h1>${reportTitle}</h1>
              <div class="sub">DICT Region 02 • Generated ${stamp}</div>
            </div>
          </div>
          <div class="meta">
            <div>Total records: ${rows.length}</div>
            <div>Status filter: ${statusFilter}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Item</th>
                <th>Classification</th>
                <th>Qty</th>
                <th>Requested</th>
                <th>Released</th>
                <th>Recipient</th>
                <th>Office</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.onload = () => {
      w.print();
    };
  };

  const buildRsmiRows = (rows, startDate, endDate) => {
    return rows
      .filter((row) => {
        if (!startDate || !endDate) return false;
        const raw = getDistributionDate(row);
        if (!raw) return false;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return false;
        return d >= startDate && d <= endDate;
      })
      .map((row, idx) => {
        const quantity = Number(row.quantity) || 0;
        const unitCost = Number(row.cost) || 0;
        return {
          serialNo: idx + 1,
          risNo: row.RIS_no || row.ris_no || "—",
          responsibilityCenter: "—",
          stockNo: row.stock_no ?? "—",
          item: row.itemName || "—",
          unit: row.unitofmeasure || "—",
          quantityIssued: quantity || "—",
          unitCost: unitCost || "—",
          amount: quantity && unitCost ? (quantity * unitCost).toFixed(2) : "—",
        };
      });
  };

  const handleOpenRsmiModal = () => {
    setRsmiError("");
    setShowRsmiModal(true);
  };

  const handleCloseRsmiModal = () => {
    setShowRsmiModal(false);
    setRsmiError("");
  };

  const handleGenerateRsmi = () => {
    if (!rsmiStart || !rsmiEnd) {
      setRsmiError("Select a start and end date.");
      return;
    }

    const startDate = new Date(`${rsmiStart}T00:00:00`);
    const endDate = new Date(`${rsmiEnd}T23:59:59`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setRsmiError("Invalid date range.");
      return;
    }

    if (startDate > endDate) {
      setRsmiError("Start date must be before end date.");
      return;
    }

    const rows = buildRsmiRows(filteredRows, startDate, endDate);
    const stamp = new Date().toLocaleDateString("en-CA");
    const logoSrc = DICT;
    const minRows = 12;
    const tableRows =
      rows.length > 0
        ? rows
            .map(
              (r) => `
            <tr>
              <td>${r.serialNo}</td>
              <td>${r.risNo}</td>
              <td>${r.responsibilityCenter}</td>
              <td>${r.stockNo}</td>
              <td>${r.item}</td>
              <td>${r.unit}</td>
              <td>${r.quantityIssued}</td>
              <td>${r.unitCost}</td>
              <td>${r.amount}</td>
            </tr>`
            )
            .join("") +
          (rows.length < minRows
            ? Array.from({ length: minRows - rows.length })
                .map(
                  () => `
            <tr>
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>`
                )
                .join("")
            : "")
        : `<tr><td colspan="9">No distributions found for this date range.</td></tr>`;

    const w = window.open("", "", "width=1100,height=800");
    if (!w) {
      alert("Pop-up blocked. Please allow pop-ups then try again.");
      return;
    }
    w.document.write(`
      <html>
        <head>
          <title>Report of Supplies and Materials Issued</title>
          <style>
            html, body { margin: 0; padding: 0; }
            body {
              font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
              color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.4;
            }
            @page { size: A4; margin: 10mm; }

            .paper { background:#ffffff; border:none; border-radius:0; padding:10mm; width:100%; }
            .bar { display:flex; align-items:center; justify-content:space-between;
                   padding:8px 0; border-bottom:1px solid #e2e8f0; background: #ffffff; }
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

            .header { text-align:center; margin:6px 0 10px 0; }
            .logo { height:34px; object-fit:contain; margin:2px auto 4px auto; display:block; }
            .header-lines .a { font-weight:700; font-style:italic; font-size:10px; }
            .header-lines .b { font-weight:800; font-size:11px; }
            .header-lines .c { font-weight:700; font-style:italic; font-size:10px; letter-spacing:0.02em; }
            .header-lines .d { font-style:italic; font-size:9px; color:#475569; }
            .rsmi-title { margin-top:6px; font-size:13px; font-weight:900; letter-spacing:0.16em; color:#0f172a; }

            .meta-table td { border:1px solid #e2e8f0; padding:6px 6px; vertical-align:middle; font-size:10px; }
            .meta-table .k { background:#f8fafc; font-weight:700; color:#0f172a; width:25%; }
            .meta-table .v { font-style:italic; }
            .divider { border-top:1px solid #e2e8f0; margin-top:8px; }

            table { border-collapse: collapse; width:100%; }
            .items thead th { border:1px solid #e2e8f0; padding:6px 6px; background:#f1f5f9;
                              font-weight:700; text-transform:uppercase; letter-spacing:0.06em; font-size:9px;
                              color:#0f172a; text-align:center; }
            .items tbody td { border:1px solid #e2e8f0; padding:6px 6px; font-size:9px; text-align:center; }

            .sigs { margin-top:14px; }
            .sigs thead th { border:1px solid #e2e8f0; background:#f8fafc; padding:6px 6px; font-weight:700; font-size:10px; color:#0f172a; }
            .sigs tbody td { border:1px solid #e2e8f0; padding:10px 6px; vertical-align:bottom; text-align:center; min-height:96px; }
            .sig-line { width:92%; border-top:1px solid #0f172a; margin:28px auto 4px auto; }
            .sig-role { font-size:9px; color:#475569; font-style:italic; }
            .foot { margin-top:10px; font-size:9px; color:#475569; font-style:italic; border-top:1px solid #e2e8f0; padding-top:8px; }
          </style>
        </head>
        <body>
          <div class="paper">
            <div class="bar">
              <div class="brand">
                <div class="brand-logo">
                  <img src="${logoSrc}" alt="DICT" style="height:16px;width:auto;" />
                </div>
                <div>
                  <div class="brand-title">REPORT OF SUPPLIES AND MATERIALS ISSUED</div>
                  <div class="brand-sub">Appendix 64 • System-generated • Print copy</div>
                </div>
              </div>
              <div class="bar-right">
                <div class="chip"><span class="chip-dot"></span><span>RSMI</span></div>
                <div class="tiny-note">Range ${rsmiStart} to ${rsmiEnd}</div>
              </div>
            </div>

            <div class="header">
              <img class="logo" src="${logoSrc}" alt="DICT Logo" />
              <div class="header-lines">
                <div class="a">REPUBLIC OF THE PHILIPPINES</div>
                <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
                <div class="c">DICT REGION 02</div>
                <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
              </div>
              <div class="rsmi-title">REPORT OF SUPPLIES AND MATERIALS ISSUED</div>
            </div>

            <table class="meta-table" style="margin-top:8px;">
              <tbody>
                <tr>
                  <td class="k">Entity Name:</td>
                  <td class="v" colspan="3"><b><i>_______________________________</i></b></td>
                  <td class="k">Fund Cluster:</td>
                  <td class="v"><b><i>_______________________________</i></b></td>
                </tr>
                <tr>
                  <td class="k">Serial No.:</td>
                  <td class="v" colspan="3"><i>______________________</i></td>
                  <td class="k">Date:</td>
                  <td class="v"><b><i>${stamp}</i></b></td>
                </tr>
              </tbody>
            </table>

            <div class="divider"></div>

            <table class="items" style="margin-top:10px;">
              <thead>
                <tr>
                  <th>Serial No.</th>
                  <th>RIS No.</th>
                  <th>Responsibility Center Code</th>
                  <th>Stock No.</th>
                  <th>Item</th>
                  <th>Unit</th>
                  <th>Quantity Issued</th>
                  <th>Unit Cost</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <table class="sigs">
              <thead>
                <tr>
                  <th>Posted by</th>
                  <th>Certified correct by</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div class="sig-line"></div>
                    <div class="sig-role">Signature over Printed Name of Supply and/or Property Custodian</div>
                  </td>
                  <td>
                    <div class="sig-line"></div>
                    <div class="sig-role">Signature over Printed Name of Designated Accounting Staff</div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="foot">Generated ${stamp} • Range ${rsmiStart} to ${rsmiEnd}</div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.onload = () => {
      w.print();
    };
    setShowRsmiModal(false);
  };

  /* ---------- Render ---------- */
  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error.message || "Failed to load distribution records."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-8 pb-10">
        {/* Breadcrumbs */}
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Office Dashboard", to: "/officedashboard" },
            { label: "Inventory" },
            { label: pageLabel },
          ]}
        />

        {/* HEADER / CONTROLS */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-light text-slate-900">
              {pageTitle.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="font-semibold">
                {pageTitle.split(" ").slice(-1)}
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Monitor supply {isDisposalView ? "disposals" : "distributions"} and export reports.
            </p>
          </div>

          <div className="filter-card mb-4">
            <div className="filter-card-content">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="table-button-accent inline-flex items-center gap-2 border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="table-button-accent inline-flex items-center gap-2 border border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  Print PDF
                </button>
                {!isDisposalView && (
                  <button
                    type="button"
                    onClick={handleOpenRsmiModal}
                    className="table-button-primary inline-flex items-center gap-2"
                  >
                    Generate RSMI
                  </button>
                )}
              </div>

              <div className="mt-3 table-filters flex-col sm:flex-row sm:items-center xl:hidden">
                <div className="search-shell w-full sm:w-60 md:w-72">
                  <span className="search-icon">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search by item, recipient, office, status..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="search-input"
                  />
                </div>

                <div className="w-full sm:flex-1">
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                    <span className="h-2 w-2 rounded-full bg-slate-500" />
                    Status filter
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="table-select w-full"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === "All" ? "All" : opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-[11px] text-slate-500 sm:text-xs">
                  Showing <span className="font-semibold text-slate-900">{filteredRows.length}</span> of{" "}
                  <span className="font-semibold text-slate-900">{totalCount}</span>
                </div>
              </div>

              <div className="mt-3 hidden xl:block">
                <div className="request-filterbar">
                  <div className="search-shell request-search">
                    <span className="search-icon">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search by item, recipient, office, status..."
                      value={searchQuery}
                      onChange={handleSearch}
                      className="search-input"
                    />
                  </div>

                  <span className="request-divider" aria-hidden="true" />

                  <div className="request-chip-group">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt);
                          setCurrentPage(1);
                        }}
                        className={classNames(
                          "request-chip",
                          statusChipTone(opt),
                          statusFilter === opt && "request-chip-active"
                        )}
                      >
                        {opt === "All" ? "All" : opt}
                      </button>
                    ))}
                  </div>

                  <div className="ml-auto text-[11px] text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{filteredRows.length}</span> of{" "}
                    <span className="font-semibold text-slate-900">{totalCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE CARD */}
        <div className="table-shell table-compact table-flush px-3 md:px-5 pt-3 md:pt-5 pb-4">
          <div className="overflow-x-auto">
            <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : currentItems.length === 0 ? (
                <EmptyState
                  title="No matching distribution records"
                  subtitle="We could not find any distribution records that match your filters."
                  hint="Try adjusting filters or clearing search."
                  className="max-w-2xl"
                />
              ) : (
                currentItems.map((row, idx) => (
                  <ItemCard key={`${row._id || "dist"}-${row.__itemIndex}-${idx}`} row={row} />
                ))
              )}
            </div>

            {loading ? (
              <table className="w-full whitespace-nowrap hidden lg:table text-left">
                <thead>
                  <tr className="h-10 text-gray-800">
                    <TableHeader title="Ref" />
                    <TableHeader title="Item" />
                    <TableHeader title="Qty" />
                    <TableHeader title="Requested / Released" />
                    <TableHeader title="Distributed To" />
                    <TableHeader title="Office" />
                    <TableHeader title="Status" />
                    <TableHeader title="Manage" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full whitespace-nowrap hidden lg:table text-left">
                <thead>
                  <tr className="h-10 text-gray-800">
                    <TableHeader title="Ref" />
                    <TableHeader title="Item" />
                    <TableHeader title="Qty" />
                    <TableHeader title="Requested / Released" />
                    <TableHeader title="Distributed To" />
                    <TableHeader title="Office" />
                    <TableHeader title="Status" />
                    <TableHeader title="Manage" />
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10">
                        <EmptyState
                          title="No matching distribution records"
                          subtitle="We could not find any distribution records that match your filters."
                          hint="Try adjusting filters or clearing search."
                          className="max-w-2xl"
                        />
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((row, idx) => (
                      <TableRow key={`${row._id || "dist"}-${row.__itemIndex}-${idx}`} row={row} />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {totalCount > itemsPerPage && !loading && (
            <div className="flex items-center justify-between border-t border-slate-200/70 bg-white px-3 py-4 text-[10px] md:px-4 md:text-xs">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-md border shadow-sm"
                style={
                  currentPage === 1
                    ? { backgroundColor: "#f9fafb", color: "#d1d5db", cursor: "not-allowed" }
                    : { backgroundColor: "#ffffff", color: "#374151" }
                }
              >
                Previous
              </button>

              <span className="text-gray-500">
                Page {safePage} of {totalPages}
              </span>

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-md border shadow-sm"
                style={
                  currentPage === totalPages
                    ? { backgroundColor: "#f9fafb", color: "#d1d5db", cursor: "not-allowed" }
                    : { backgroundColor: "#ffffff", color: "#374151" }
                }
              >
                Next
              </button>
            </div>
          )}
        </div>
      </section>

      {!isDisposalView && showRsmiModal && (
        <ModalShell
          open
          title="Generate RSMI"
          subtitle="Supply Distribution"
          variant="warning"
          onClose={handleCloseRsmiModal}
          maxWidthClass="max-w-md"
        >
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-600">
                Start date
                <input
                  type="date"
                  value={rsmiStart}
                  onChange={(e) => setRsmiStart(e.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                End date
                <input
                  type="date"
                  value={rsmiEnd}
                  onChange={(e) => setRsmiEnd(e.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              {rsmiError && (
                <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {rsmiError}
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseRsmiModal}
                className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateRsmi}
                className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
              >
                Generate PDF
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  );
}

export default DistributionTable;
