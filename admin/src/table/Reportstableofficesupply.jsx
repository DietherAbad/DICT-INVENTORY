// src/table/Reportstableofficesupply.jsx

import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";
import DICT from "../assets/DICT.png";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";
import ModalShell from "../components/ModalShell";
import EmptyState from "../components/EmptyState";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* ========================================================================================
 * Utilities
 * ====================================================================================== */

function formatCurrencyPHP(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  try {
    return n.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  } catch {
    return `₱${n.toFixed(2)}`;
  }
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatMonthLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function norm(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

function getRoleFromUserAnyShape(u) {
  if (!u) return "";
  if (typeof u === "object") {
    return u.role || u.user?.role || u.data?.role || u.data?.user?.role || "";
  }
  if (typeof u === "string") {
    try {
      const parsed = JSON.parse(u);
      return getRoleFromUserAnyShape(parsed);
    } catch {
      return "";
    }
  }
  return "";
}

function getStoredRoleAccess() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("roleAccess");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/* ---------- Supply status meta ---------- */

function getSupplyStatusMeta(status, balanceQty, lowStockThreshold) {
  const raw = norm(status);
  const qty = Number(balanceQty ?? 0);
  const threshold = Number.isFinite(Number(lowStockThreshold))
    ? Number(lowStockThreshold)
    : 20;

  let label = status || "Unknown";
  let bg = "#f3f4f6"; // gray-100
  let color = "#374151"; // gray-700
  let border = "#e5e7eb"; // gray-200

  if (raw === "out of stock" || qty <= 0) {
    label = "Out of stock";
    bg = "#fee2e2";
    color = "#b91c1c";
    border = "#fecaca";
  } else if ((raw === "instock" || raw === "in stock" || !raw) && qty < threshold) {
    label = "Low stock";
    bg = "#fef3c7";
    color = "#92400e";
    border = "#fde68a";
  } else if (raw === "instock" || raw === "in stock" || !raw) {
    label = "In stock";
    bg = "#dcfce7";
    color = "#166534";
    border = "#bbf7d0";
  } else if (raw === "pending") {
    label = "Pending";
    bg = "#dbeafe";
    color = "#1d4ed8";
    border = "#bfdbfe";
  }

  return { label, bg, color, border };
}

const getEffectiveSupplyQty = (item) => {
  const balance = Number(item?.balance_qty);
  if (Number.isFinite(balance)) return balance;
  const stock = Number(item?.stock_qty);
  if (Number.isFinite(stock)) return stock;
  return 0;
};

const buildLedgerItemLabel = (item) => {
  if (!item) return "";
  const name = item.itemName || "Unnamed item";
  return item.stock_no ? `${name} - ${item.stock_no}` : name;
};

const itemMatchesOfficeSupplyFilters = (item, q, filterStatus, filters) => {
  if (filterStatus !== "All") {
    const { label } = getSupplyStatusMeta(
      item.status,
      getEffectiveSupplyQty(item),
      item.lowstock_threshold
    );
    if (label !== filterStatus) return false;
  }

  if (q) {
    const fields = [
      item.stock_no,
      item.itemName,
      item.classification,
      item.unitofmeasure,
      item.status,
      getEffectiveSupplyQty(item),
      item.balance_total_cost,
      item.lowstock_threshold,
      item.purchase_qty,
      item.purchase_total_cost,
      item.distribution_qty,
      item.distribution_total_cost,
      item.disposed_qty,
    ]
      .filter((f) => f !== null && f !== undefined && f !== "")
      .map((f) => f.toString().toLowerCase());
    if (!fields.some((f) => f.includes(q))) return false;
  }

  const matchesValue = (value, filterValue) => {
    const fv = (filterValue ?? "").toString().trim();
    if (!fv) return true;
    if (value === null || value === undefined) return false;
    return value.toString().toLowerCase().includes(fv.toLowerCase());
  };

  if (!matchesValue(item.stock_no, filters.stock_no)) return false;
  if (!matchesValue(item.itemName, filters.itemName)) return false;
  if (!matchesValue(item.classification, filters.classification)) return false;
  if (!matchesValue(getEffectiveSupplyQty(item), filters.balance_qty)) return false;
  if (!matchesValue(item.lowstock_threshold, filters.lowstock_threshold)) return false;
  if (!matchesValue(item.unitofmeasure, filters.unitofmeasure)) return false;
  if (!matchesValue(item.balance_unit_cost, filters.balance_unit_cost)) return false;
  if (!matchesValue(item.balance_total_cost, filters.balance_total_cost)) return false;
  if (!matchesValue(item.purchase_qty, filters.purchase_qty)) return false;
  if (!matchesValue(item.purchase_unit_cost, filters.purchase_unit_cost)) return false;
  if (!matchesValue(item.purchase_total_cost, filters.purchase_total_cost)) return false;
  if (!matchesValue(item.distribution_qty, filters.distribution_qty)) return false;
  if (!matchesValue(item.distribution_unit_cost, filters.distribution_unit_cost)) return false;
  if (!matchesValue(item.distribution_total_cost, filters.distribution_total_cost)) return false;
  if (!matchesValue(item.disposed_qty, filters.disposed_qty)) return false;
  if (!matchesValue(item.status, filters.status)) return false;

  return true;
};

/* ---------- Key mapping between inventory and distributions ---------- */

function getSupplyItemKeyFromInventory(item) {
  if (!item) return null;
  if (item._id) return `id:${item._id}`;
  if (item.stock_no !== null && item.stock_no !== undefined) {
    return `stock:${String(item.stock_no).trim()}`;
  }
  if (item.itemName) {
    return `name:${norm(item.itemName)}`;
  }
  return null;
}

function getSupplyItemKeyFromDistributionItem(itm, dist) {
  if (!itm && !dist) return null;

  // BEST: link via returnId -> inventory._id
  if (itm && itm.returnId) return `id:${itm.returnId}`;
  if (dist && dist.itemId) return `id:${dist.itemId}`;

  // Fallback: stock_no
  if (itm && itm.stock_no !== null && itm.stock_no !== undefined) {
    return `stock:${String(itm.stock_no).trim()}`;
  }
  if (dist && dist.stock_no !== null && dist.stock_no !== undefined) {
    return `stock:${String(dist.stock_no).trim()}`;
  }

  // Last resort: by itemName (very loose)
  const name = itm?.itemName || dist?.itemName;
  if (name) return `name:${norm(name)}`;

  return null;
}

function applyDistributionSummary(items, distributionSummary) {
  if (!Array.isArray(items) || !items.length) return [];
  if (!distributionSummary || !Object.keys(distributionSummary).length) return items;

  return items.map((item) => {
    const key = getSupplyItemKeyFromInventory(item);
    if (!key || !distributionSummary[key]) return item;

    const agg = distributionSummary[key];
    const qty = agg.qty || 0;
    if (!qty) return item;

    const fallbackUnitCost = Number(
      item.distribution_unit_cost || item.balance_unit_cost || 0
    );
    const costedQty = Number(agg.costedQty || 0);
    const totalCost =
      Number(agg.totalCost || 0) +
      Math.max(0, qty - costedQty) * fallbackUnitCost;
    const avgUnitCost = qty > 0 ? totalCost / qty : fallbackUnitCost;

    return {
      ...item,
      distribution_qty: qty,
      distribution_unit_cost:
        Number.isFinite(avgUnitCost)
          ? avgUnitCost
          : item.distribution_unit_cost || item.balance_unit_cost || 0,
      distribution_total_cost: Number.isFinite(totalCost)
        ? totalCost
        : item.distribution_total_cost || 0,
    };
  });
}

/* ========================================================================================
 * Small UI components: icons, pills, search, headers
 * ====================================================================================== */

function StatusPill({ status, balanceQty, lowStockThreshold }) {
  const { label, bg, color, border } = getSupplyStatusMeta(
    status,
    balanceQty,
    lowStockThreshold
  );
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

/* Tiny icons */

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

const IconChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M7.5 4.5L12.5 10L7.5 15.5"
      stroke="#9ca3af"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* Search input (used for global + column filters) */

function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  compact = true,
  className = "",
}) {
  const sizeClasses = compact ? "text-[10px] md:text-[11px]" : "text-xs md:text-sm";

  return (
    <div className={`search-shell ${className}`}>
      <span className="search-icon">
        <IconSearch />
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`search-input pr-9 ${sizeClasses}`}
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

function TableRow({ data }) {
  const val = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");
  const effectiveQty = getEffectiveSupplyQty(data);

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs font-semibold text-left border-b text-gray-800">
        {val(data.stock_no)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-900">
        {val(data.itemName)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {val(data.classification)}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {val(effectiveQty)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-700">
        {val(data.lowstock_threshold)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {val(data.unitofmeasure)}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {formatCurrencyPHP(data.balance_unit_cost)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {formatCurrencyPHP(data.balance_total_cost)}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {val(data.purchase_qty)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {formatCurrencyPHP(data.purchase_unit_cost)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {formatCurrencyPHP(data.purchase_total_cost)}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {val(data.distribution_qty)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {formatCurrencyPHP(data.distribution_unit_cost)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {formatCurrencyPHP(data.distribution_total_cost)}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {val(data.disposed_qty)}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-left border-b">
        <StatusPill
          status={data.status}
          balanceQty={getEffectiveSupplyQty(data)}
          lowStockThreshold={data.lowstock_threshold}
        />
      </td>
    </tr>
  );
}

function ItemCard({ data }) {
  const val = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");
  const effectiveQty = getEffectiveSupplyQty(data);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            Stock #{val(data.stock_no)}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mt-1">
            {val(data.itemName)}
          </h3>
          <p className="text-[11px] text-gray-500">{val(data.classification)}</p>
        </div>
        <StatusPill
          status={data.status}
          balanceQty={getEffectiveSupplyQty(data)}
          lowStockThreshold={data.lowstock_threshold}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-600">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-600">
          Balance: {val(effectiveQty)} {val(data.unitofmeasure)}
        </span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
          Low stock: {val(data.lowstock_threshold)}
        </span>
        <span className="rounded-full bg-gray-50 px-2.5 py-1">
          Cost: {formatCurrencyPHP(data.balance_unit_cost)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-gray-600">
        <div>
          <div className="text-gray-400">Purchase Qty</div>
          <div className="font-semibold">{val(data.purchase_qty)}</div>
        </div>
        <div>
          <div className="text-gray-400">Distributed Qty</div>
          <div className="font-semibold">{val(data.distribution_qty)}</div>
        </div>
        <div>
          <div className="text-gray-400">Disposed Qty</div>
          <div className="font-semibold">{val(data.disposed_qty)}</div>
        </div>
        <div>
          <div className="text-gray-400">Balance Total</div>
          <div className="font-semibold">{formatCurrencyPHP(data.balance_total_cost)}</div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 16 }).map((_, idx) => (
        <td key={idx} className="px-2 py-3 border-b">
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

function Reportstableofficesupply() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const role = useMemo(() => getRoleFromUserAnyShape(user), [user]);
  const roleAccess = useMemo(() => getStoredRoleAccess(), [user]);
  const canGenerateMasterLedger = useMemo(
    () => hasAccessTag(role, "reports.master_ledger", roleAccess),
    [role, roleAccess]
  );

  // Breadcrumbs
  const breadcrumbs = useMemo(
    () => [
      { label: "Office Dashboard", onClick: () => navigate("/officedashboard") },
      { label: "Reports & Analytics" },
      { label: "Office Supplies", current: true },
    ],
    [navigate]
  );

  const [inventory, setInventoryData] = useState([]);
  const [fullInventory, setFullInventory] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // distributions -> aggregated per item
  const [distributionSummary, setDistributionSummary] = useState({});
  const [distributions, setDistributions] = useState([]);

  // global search
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 200);

  // status filter (based on computed label)
  const [filterStatus, setFilterStatus] = useState("All");

  // per-column filters
  const [filters, setFilters] = useState({
    stock_no: "",
    itemName: "",
    classification: "",
    balance_qty: "",
    lowstock_threshold: "",
    unitofmeasure: "",
    balance_unit_cost: "",
    balance_total_cost: "",
    purchase_qty: "",
    purchase_unit_cost: "",
    purchase_total_cost: "",
    distribution_qty: "",
    distribution_unit_cost: "",
    distribution_total_cost: "",
    disposed_qty: "",
    status: "",
  });

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState({
    key: "stock_no",
    direction: "asc",
  });

  // users (for master ledger signatory)
  const [users, setUsers] = useState([]);

  // charts
  const [chartType, setChartType] = useState("coverageRisk");
  const [chartTopN, setChartTopN] = useState(12);
  const [analyticsInventory, setAnalyticsInventory] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Master Ledger modal & view state
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerItemId, setLedgerItemId] = useState("");
  const [ledgerItemQuery, setLedgerItemQuery] = useState("");
  const [ledgerStart, setLedgerStart] = useState("");
  const [ledgerEnd, setLedgerEnd] = useState("");
  const [ledgerError, setLedgerError] = useState("");

  const [ledgerViewOpen, setLedgerViewOpen] = useState(false);
  const [ledgerHeader, setLedgerHeader] = useState(null);
  const [ledgerRows, setLedgerRows] = useState([]);

  const buildInventoryQueryParams = useCallback(({
    page,
    limit,
    includeSort = true,
  } = {}) => {
    const params = new URLSearchParams();

    if (page !== undefined) params.set("page", String(page));
    if (limit !== undefined) params.set("limit", String(limit));

    if (includeSort && sortConfig?.key) {
      params.set("sortBy", sortConfig.key);
      params.set("sortDir", sortConfig.direction === "asc" ? "asc" : "desc");
    }
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (filterStatus !== "All") {
      if (
        filterStatus === "In stock" ||
        filterStatus === "Low stock" ||
        filterStatus === "Out of stock"
      ) {
        params.set("stockStatus", filterStatus);
      } else {
        params.set("status", filterStatus);
      }
    }

    Object.entries(filters).forEach(([key, value]) => {
      const v = String(value || "").trim();
      if (v) params.set(`field_${key}`, v);
    });

    return params;
  }, [debouncedSearch, filterStatus, filters, sortConfig]);

  const fetchInventoryBatch = useCallback(async ({ page, limit, includeSort = true }) => {
    const params = buildInventoryQueryParams({ page, limit, includeSort });
    const res = await fetch(
      `${BASE_URL}/inventoryofficesupply/inventory?${params.toString()}`
    );
    if (!res.ok) throw new Error("Failed to fetch office supplies inventory.");

    const data = await res.json();
    if (Array.isArray(data)) {
      return { rows: data, total: data.length };
    }

    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      total: Number(data?.total || 0),
    };
  }, [buildInventoryQueryParams]);

  /* ---------- Load inventory data ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { rows, total } = await fetchInventoryBatch({
          page: currentPage,
          limit: itemsPerPage,
        });
        setInventoryData(rows);
        setTotalCount(total);
      } catch (err) {
        console.error(err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentPage, itemsPerPage, fetchInventoryBatch]);

  // Exports, analytics, and master ledger item choices use the full filtered dataset.
  useEffect(() => {
    const loadFullInventory = async () => {
      try {
        setAnalyticsLoading(true);

        const batchLimit = 500;
        const first = await fetchInventoryBatch({
          page: 1,
          limit: batchLimit,
        });
        const allRows = [...first.rows];
        const total = Number(first.total || first.rows.length || 0);
        const totalPagesForExport = Math.ceil(total / batchLimit);

        for (let page = 2; page <= totalPagesForExport; page += 1) {
          const next = await fetchInventoryBatch({
            page,
            limit: batchLimit,
          });
          allRows.push(...next.rows);
        }

        setFullInventory(allRows);
        setAnalyticsInventory(allRows);
      } catch (err) {
        console.error(err);
        setFullInventory([]);
        setAnalyticsInventory([]);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadFullInventory();
  }, [fetchInventoryBatch]);

  /* ---------- Load users ---------- */
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch(`${BASE_URL}/users/directory`, {
          credentials: "include",
          silentStatuses: [403],
          suppressErrorToast: true,
        });
        if (!res.ok) {
          setUsers([]);
          return;
        }
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      }
    };
    loadUsers();
  }, []);

  /* ---------- Load distributions and aggregate per inventory item ---------- */
  useEffect(() => {
    const loadDistributions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/distribute/distributions`);
        if (!res.ok) {
          console.warn("Failed to fetch distributions for aggregation.");
          return;
        }
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setDistributions(arr);

        const summary = {};

        arr.forEach((dist) => {
          const itemsArray = Array.isArray(dist.items) && dist.items.length ? dist.items : [];

          itemsArray.forEach((itm) => {
            // Determine status from distribution document (same logic as DistributionTable)
            const statusRaw = norm(dist.status || "");
            const requestStatusRaw = norm(dist.requeststatus || "");
            const itemStatusRaw = norm(itm.status || "");

            // Only count actually released/received distributions, ignore pending / declined
            const isCompleted =
              itemStatusRaw === "transferred" ||
              itemStatusRaw === "received" ||
              statusRaw === "transferred" ||
              statusRaw === "received" ||
              requestStatusRaw === "transferred" ||
              requestStatusRaw === "received";

            const isDisposal = norm(dist.request_type) === "disposal";
            if (!isCompleted || isDisposal) return;

            // Quantity is REQUIRED in schema
            const quantity = Number(itm.quantity ?? 0);
            if (!quantity || Number.isNaN(quantity)) return;

            const key = getSupplyItemKeyFromDistributionItem(itm, dist);
            if (!key) return;

            // Distribution item cost is the unit cost captured for that RIS.
            const unitCostCandidate = Number(itm.cost || 0);
            const safeUnitCost =
              !Number.isNaN(unitCostCandidate) && unitCostCandidate > 0
                ? unitCostCandidate
                : null;
            const safeTotalCost =
              safeUnitCost != null ? safeUnitCost * quantity : null;

            const existing =
              summary[key] || {
                qty: 0,
                totalCost: 0,
                costedQty: 0,
              };

            const next = { ...existing };
            next.qty += quantity;
            if (safeTotalCost != null) {
              next.totalCost += safeTotalCost;
              next.costedQty += quantity;
            }
            summary[key] = next;
          });
        });

        setDistributionSummary(summary);
      } catch (err) {
        console.error("Error aggregating distributions:", err);
      }
    };

    loadDistributions();
  }, []);

  /* ---------- Helpers ---------- */

  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const inventoryAdminUser = useMemo(
    () => users.find((u) => (u.role || "").toLowerCase() === "inventory admin"),
    [users]
  );

  const getFundCluster = (item) => {
    if (!item) return "Regular";
    return item.project && item.project.toLowerCase() === "free wifi"
      ? "Free Wifi"
      : "Regular";
  };

  const isRestockStatus = (status) => {
    const s = String(status || "").toLowerCase();
    return (
      s.includes("restock") ||
      s.includes("restocked") ||
      s.includes("stock in") ||
      s.includes("replenish") ||
      s.includes("add")
    );
  };

  const isDisposeStatus = (status) => {
    const s = String(status || "").toLowerCase();
    return s.includes("dispose");
  };

  /* ---------- Augment inventory with aggregated distribution summary ---------- */
  const augmentedInventory = useMemo(() => {
    if (!inventory.length) return inventory;
    return applyDistributionSummary(inventory, distributionSummary);
  }, [inventory, distributionSummary]);

  const fullAugmentedInventory = useMemo(() => {
    if (!fullInventory.length) return fullInventory;
    return applyDistributionSummary(fullInventory, distributionSummary);
  }, [fullInventory, distributionSummary]);

  const analyticsItems = useMemo(() => {
    if (!analyticsInventory.length) return [];
    return applyDistributionSummary(analyticsInventory, distributionSummary);
  }, [analyticsInventory, distributionSummary]);

  /* ---------- Filter + search + column filters ---------- */
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    return augmentedInventory.filter((item) =>
      itemMatchesOfficeSupplyFilters(item, q, filterStatus, filters)
    );
  }, [augmentedInventory, filterStatus, debouncedSearch, filters]);

  const fullFilteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const source = fullAugmentedInventory.length ? fullAugmentedInventory : augmentedInventory;
    return source.filter((item) =>
      itemMatchesOfficeSupplyFilters(item, q, filterStatus, filters)
    );
  }, [
    fullAugmentedInventory,
    augmentedInventory,
    filterStatus,
    debouncedSearch,
    filters,
  ]);

  /* ---------- Sorting ---------- */
  const sortedItems = useMemo(() => filteredItems, [filteredItems]);

  /* ---------- Chart data ---------- */
  const analyticsBaseItems = useMemo(
    () => (analyticsItems.length ? analyticsItems : augmentedInventory),
    [analyticsItems, augmentedInventory]
  );

  const distributionInsights = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoff30 = now - 30 * dayMs;
    const cutoff90 = now - 90 * dayMs;

    const issuedByItem90 = new Map();
    const issuedByOffice90 = new Map();
    let totalIssued30 = 0;
    let totalIssued90 = 0;

    (Array.isArray(distributions) ? distributions : []).forEach((dist) => {
      const rs = String(dist.requeststatus || "").toLowerCase().trim();
      const st = String(dist.status || "").toLowerCase().trim();
      const isDisposal =
        String(dist.request_type || "").toLowerCase().trim() === "disposal";
      const isFinal = isDisposal
        ? st === "disposed" || rs === "approved" || rs === "received"
        : st === "transferred" ||
          st === "received" ||
          rs === "transferred" ||
          rs === "received";
      if (!isFinal) return;
      // Disposal is an inventory outflow, not recurring office demand.
      if (isDisposal) return;

      const distDate =
        dist.date_received ||
        dist.date_released ||
        dist.date_approved ||
        dist.date_checked ||
        dist.date_requested ||
        dist.updatedAt ||
        dist.createdAt;
      const dateObj = distDate ? new Date(distDate) : null;
      if (!dateObj || Number.isNaN(dateObj.getTime())) return;

      const dateMs = dateObj.getTime();
      if (!Array.isArray(dist.items)) return;
      dist.items.forEach((itm) => {
        const qty = Number(itm.quantity || 0);
        if (!qty || Number.isNaN(qty)) return;

        if (dateMs >= cutoff30) totalIssued30 += qty;
        if (dateMs >= cutoff90) {
          totalIssued90 += qty;
          const key = getSupplyItemKeyFromDistributionItem(itm, dist);
          if (key) {
            issuedByItem90.set(key, (issuedByItem90.get(key) || 0) + qty);
          }
          if (!isDisposal) {
            const office = dist.office || dist.distributedto || "Unspecified Office";
            issuedByOffice90.set(office, (issuedByOffice90.get(office) || 0) + qty);
          }
        }
      });
    });

    return {
      totalIssued30,
      totalIssued90,
      issuedByItem90,
      issuedByOffice90,
    };
  }, [distributions]);

  const chartCoverageRisk = useMemo(() => {
    const rows = analyticsBaseItems
      .map((item) => {
        const key = getSupplyItemKeyFromInventory(item);
        const onHand = Number(getEffectiveSupplyQty(item) || 0);
        const threshold = Number(item.lowstock_threshold || 0);
        const issued90 = key ? Number(distributionInsights.issuedByItem90.get(key) || 0) : 0;
        const dailyRate = issued90 > 0 ? issued90 / 90 : 0;
        const demand30 = Math.round(dailyRate * 30);
        const daysCover = dailyRate > 0 ? onHand / dailyRate : null;
        const reorderGap = Math.max(0, threshold - onHand);
        return {
          name: (item.itemName || String(item.stock_no || "Item")).slice(0, 28),
          onHand,
          demand30,
          reorderGap,
          daysCover:
            daysCover === null || !Number.isFinite(daysCover)
              ? null
              : Number(daysCover.toFixed(1)),
        };
      })
      .filter((row) => row.name && (row.onHand > 0 || row.demand30 > 0 || row.reorderGap > 0));

    rows.sort((a, b) => {
      const aCover = a.daysCover == null ? Number.POSITIVE_INFINITY : a.daysCover;
      const bCover = b.daysCover == null ? Number.POSITIVE_INFINITY : b.daysCover;
      if (aCover !== bCover) return aCover - bCover;
      if (a.reorderGap !== b.reorderGap) return b.reorderGap - a.reorderGap;
      return b.demand30 - a.demand30;
    });

    return rows.slice(0, Math.max(5, chartTopN));
  }, [analyticsBaseItems, distributionInsights.issuedByItem90, chartTopN]);

  const chartStatusBreakdown = useMemo(() => {
    const counts = new Map();
    analyticsBaseItems.forEach((item) => {
      const label = getSupplyStatusMeta(
        item.status,
        getEffectiveSupplyQty(item),
        item.lowstock_threshold
      ).label;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [analyticsBaseItems]);

  const chartLowStockByClass = useMemo(() => {
    const counts = new Map();
    analyticsBaseItems.forEach((item) => {
      const meta = getSupplyStatusMeta(
        item.status,
        getEffectiveSupplyQty(item),
        item.lowstock_threshold
      );
      if (meta.label !== "Low stock") return;
      const key = item.classification || "Unclassified";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.max(5, chartTopN));
  }, [analyticsBaseItems, chartTopN]);

  const chartOfficeDemand = useMemo(() => {
    return Array.from(distributionInsights.issuedByOffice90.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, Math.max(5, chartTopN));
  }, [distributionInsights.issuedByOffice90, chartTopN]);

  const chartMonthlyFlow = useMemo(() => {
    const now = new Date();
    const monthBuckets = new Map();

    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthBuckets.set(key, {
        key,
        name: formatMonthLabel(d),
        sortKey: d.getTime(),
        receiptQty: 0,
        issueQty: 0,
      });
    }

    (Array.isArray(distributions) ? distributions : []).forEach((dist) => {
      const rs = String(dist.requeststatus || "").toLowerCase().trim();
      const st = String(dist.status || "").toLowerCase().trim();
      const isDisposal =
        String(dist.request_type || "").toLowerCase().trim() === "disposal";
      const isFinal = isDisposal
        ? st === "disposed" || rs === "approved" || rs === "received"
        : st === "transferred" ||
          st === "received" ||
          rs === "transferred" ||
          rs === "received";
      if (!isFinal) return;

      const distDate =
        dist.date_received ||
        dist.date_released ||
        dist.date_approved ||
        dist.date_checked ||
        dist.date_requested ||
        dist.updatedAt ||
        dist.createdAt;
      const d = distDate ? new Date(distDate) : null;
      if (!d || Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const bucket = monthBuckets.get(key);
      if (!bucket) return;
      if (Array.isArray(dist.items)) {
        dist.items.forEach((itm) => {
          const qty = Number(itm.quantity || 0);
          if (!qty || Number.isNaN(qty)) return;
          bucket.issueQty += qty;
        });
      }
    });

    analyticsBaseItems.forEach((item) => {
      (Array.isArray(item.history) ? item.history : []).forEach((h) => {
        const movement = norm(h?.movement_type);
        const documentType = String(h?.document_type || "").toUpperCase();
        const isManualAdjustment = documentType === "ADJUSTMENT";
        const isStockReceipt =
          movement === "receipt" &&
          (documentType === "STOCK" || isManualAdjustment || isRestockStatus(h.status));
        const isManualIssue = movement === "issue" && isManualAdjustment;
        if (!isStockReceipt && !isManualIssue) return;
        const qty = Number(h.history_qty || 0);
        if (!qty) return;
        const d = h.date ? new Date(h.date) : null;
        if (!d || Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const bucket = monthBuckets.get(key);
        if (!bucket) return;
        if (isManualIssue) bucket.issueQty += qty;
        else bucket.receiptQty += qty;
      });
    });

    return Array.from(monthBuckets.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((row) => ({
        name: row.name,
        receiptQty: row.receiptQty,
        issueQty: row.issueQty,
        netFlow: row.receiptQty - row.issueQty,
      }));
  }, [distributions, analyticsBaseItems]);

  const analyticsKpis = useMemo(() => {
    let totalOnHandQty = 0;
    let totalOnHandValue = 0;
    let belowThresholdCount = 0;
    let reorderQty = 0;
    let noMovementCount = 0;

    analyticsBaseItems.forEach((item) => {
      const key = getSupplyItemKeyFromInventory(item);
      const onHand = Number(getEffectiveSupplyQty(item) || 0);
      const threshold = Number(item.lowstock_threshold || 0);
      const issued90 = key ? Number(distributionInsights.issuedByItem90.get(key) || 0) : 0;

      totalOnHandQty += onHand;
      totalOnHandValue += Number(item.balance_total_cost || 0);
      if (onHand <= threshold) belowThresholdCount += 1;
      reorderQty += Math.max(0, threshold - onHand);
      if (onHand > 0 && issued90 === 0) noMovementCount += 1;
    });

    const dailyIssueRate = distributionInsights.totalIssued90
      ? distributionInsights.totalIssued90 / 90
      : 0;
    const coverageDays =
      dailyIssueRate > 0 ? Number((totalOnHandQty / dailyIssueRate).toFixed(1)) : null;

    return {
      totalOnHandQty,
      totalOnHandValue,
      issuedLast30: distributionInsights.totalIssued30,
      belowThresholdCount,
      reorderQty,
      noMovementCount,
      coverageDays,
    };
  }, [analyticsBaseItems, distributionInsights]);

  const chartOptions = [
    {
      value: "coverageRisk",
      label: "Stock Coverage Risk",
      helper:
        "Compare on-hand quantity versus estimated 30-day demand to spot near-stockout items.",
    },
    {
      value: "monthlyFlow",
      label: "12-Month Inflow vs Outflow",
      helper: "Track monthly receipts (restock) against issues (distribution/disposal).",
    },
    {
      value: "officeDemand",
      label: "Top Requesting Offices (90 Days)",
      helper: "See which offices consumed the most supplies recently.",
    },
    {
      value: "statusBreakdown",
      label: "Status Breakdown",
      helper: "Share of in stock, low stock, and out of stock items.",
    },
    {
      value: "lowStockByClass",
      label: "Low Stock by Classification",
      helper: "Which classifications currently need replenishment the most.",
    },
  ];

  const chartPalette = [
    "#1d4ed8",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#6366f1",
    "#14b8a6",
    "#f97316",
    "#84cc16",
  ];

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const currentItems = sortedItems;
  const fullDataReady =
    !analyticsLoading && (totalCount === 0 || fullInventory.length >= totalCount);

  const ledgerItemOptions = useMemo(() => {
    const q = ledgerItemQuery.trim().toLowerCase();
    const source = fullFilteredItems.length ? fullFilteredItems : sortedItems;
    const unique = [];
    const seen = new Set();

    source.forEach((item) => {
      if (!item?._id || seen.has(item._id)) return;
      const label = buildLedgerItemLabel(item);
      const searchable = [
        label,
        item.itemName,
        item.stock_no,
        item.classification,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!q || searchable.includes(q)) {
        seen.add(item._id);
        unique.push(item);
      }
    });

    return unique.slice(0, 100);
  }, [fullFilteredItems, sortedItems, ledgerItemQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  /* ---------- Handlers ---------- */

  const handleColumnFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterStatus("All");
    setFilters({
      stock_no: "",
      itemName: "",
      classification: "",
      balance_qty: "",
      lowstock_threshold: "",
      unitofmeasure: "",
      balance_unit_cost: "",
      balance_total_cost: "",
      purchase_qty: "",
      purchase_unit_cost: "",
      purchase_total_cost: "",
      distribution_qty: "",
      distribution_unit_cost: "",
      distribution_total_cost: "",
      disposed_qty: "",
      status: "",
    });
    setSortConfig({ key: "stock_no", direction: "asc" });
    setCurrentPage(1);
  };

  const handlePageSizeClick = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (!fullDataReady) {
      alert("Full report data is still loading. Please try again in a moment.");
      return;
    }

    const exportRows = fullFilteredItems;
    const exportData = exportRows.map((item) => ({
      "Stock No.": item.stock_no || "",
      "Item Description": item.itemName || "",
      Classification: item.classification || "",
      "Balance Qty": getEffectiveSupplyQty(item),
      "Low Stock Threshold": item.lowstock_threshold ?? "",
      "Unit of Measure": item.unitofmeasure || "",
      "Balance Unit Cost": item.balance_unit_cost ?? "",
      "Balance Total Cost": item.balance_total_cost ?? "",
      "Purchase Qty": item.purchase_qty ?? "",
      "Purchase Unit Cost": item.purchase_unit_cost ?? "",
      "Purchase Total Cost": item.purchase_total_cost ?? "",
      "Distribution Qty": item.distribution_qty ?? "",
      "Distribution Unit Cost": item.distribution_unit_cost ?? "",
      "Distribution Total Cost": item.distribution_total_cost ?? "",
      "Disposed Qty": item.disposed_qty ?? "",
      Status: getSupplyStatusMeta(
        item.status,
        getEffectiveSupplyQty(item),
        item.lowstock_threshold
      ).label,
    }));

    const headerKeys = exportData.length
      ? Object.keys(exportData[0])
      : [
          "Stock No.",
          "Item Description",
          "Classification",
          "Balance Qty",
          "Low Stock Threshold",
          "Unit of Measure",
          "Balance Unit Cost",
          "Balance Total Cost",
          "Purchase Qty",
          "Purchase Unit Cost",
          "Purchase Total Cost",
          "Distribution Qty",
          "Distribution Unit Cost",
          "Distribution Total Cost",
          "Disposed Qty",
          "Status",
        ];

    const ws = XLSX.utils.json_to_sheet(exportData, { origin: "A8" });

    const generatedText = `Generated: ${new Date().toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
    })}`;

    const headerRows = [
      ["REPUBLIC OF THE PHILIPPINES"],
      ["DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY"],
      ["DICT REGIONAL OFFICE 02"],
      [""],
      ["OFFICE SUPPLIES — REPORTS & ANALYTICS"],
      [""],
      [generatedText],
    ];

    XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });

    const lastColIndex = headerKeys.length ? headerKeys.length - 1 : 0;
    ws["!merges"] = (ws["!merges"] || []).concat([
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIndex } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: lastColIndex } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: lastColIndex } },
    ]);

    ws["!cols"] = headerKeys.map(() => ({ wch: 15 }));
    if (ws["!cols"][1]) ws["!cols"][1].wch = 40;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OfficeSupplies");
    const wbout = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });

    saveAs(
      new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "OfficeSupplies_Report.xlsx"
    );
  };

  const openLedgerModal = () => {
    setLedgerError("");
    setLedgerItemId("");
    setLedgerItemQuery("");
    setLedgerStart("");
    setLedgerEnd("");
    setLedgerModalOpen(true);
  };

  const handleGenerateLedger = () => {
    setLedgerError("");

    if (!fullDataReady) {
      setLedgerError("Full item list is still loading. Please try again in a moment.");
      return;
    }

    const ledgerSource = fullFilteredItems;
    const query = ledgerItemQuery.trim().toLowerCase();
    let resolvedLedgerItemId = ledgerItemId;

    if (!resolvedLedgerItemId && query) {
      const exactMatches = ledgerSource.filter((item) => {
        const label = buildLedgerItemLabel(item).toLowerCase();
        return (
          label === query ||
          String(item.itemName || "").trim().toLowerCase() === query ||
          String(item.stock_no || "").trim().toLowerCase() === query
        );
      });

      if (exactMatches.length === 1) {
        resolvedLedgerItemId = exactMatches[0]._id;
      } else {
        const partialMatches = ledgerSource.filter((item) => {
          const label = buildLedgerItemLabel(item).toLowerCase();
          return (
            label.includes(query) ||
            String(item.itemName || "").toLowerCase().includes(query) ||
            String(item.stock_no || "").toLowerCase().includes(query)
          );
        });

        if (partialMatches.length === 1) {
          resolvedLedgerItemId = partialMatches[0]._id;
        }
      }
    }

    if (!resolvedLedgerItemId) {
      setLedgerError("Please select an item.");
      return;
    }
    if (!ledgerStart || !ledgerEnd) {
      setLedgerError("Please select both start and end dates.");
      return;
    }

    const item = ledgerSource.find((inv) => inv._id === resolvedLedgerItemId);
    if (!item) {
      setLedgerError("Selected item not found in inventory.");
      return;
    }

    const fromDate = new Date(`${ledgerStart}T00:00:00`);
    const toDate = new Date(`${ledgerEnd}T23:59:59`);
    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate > toDate
    ) {
      setLedgerError("Invalid date range.");
      return;
    }

    const selectedItemKey = getSupplyItemKeyFromInventory(item);
    const historyEntries = Array.isArray(item.history) ? item.history : [];
    const allEvents = [];
    const pushEvent = (evt) => {
      if (!evt?.date) return;
      const parsedDate = new Date(evt.date);
      if (Number.isNaN(parsedDate.getTime())) return;
      const qty = Number(evt.qty || 0);
      if (!Number.isFinite(qty) || qty <= 0) return;
      allEvents.push({ ...evt, qty, date: parsedDate });
    };

    const distributionByReference = new Map(
      (Array.isArray(distributions) ? distributions : [])
        .filter((dist) => dist?.RIS_no)
        .map((dist) => [String(dist.RIS_no), dist])
    );
    const recordedIssueReferences = new Set();
    let hasStockReceiptHistory = false;

    const resolveHistoryUnitCost = (historyEntry) => {
      const directRaw = historyEntry?.unit_cost;
      const direct = Number(directRaw);
      if (
        directRaw !== null &&
        directRaw !== undefined &&
        directRaw !== "" &&
        Number.isFinite(direct) &&
        direct >= 0
      ) {
        return direct;
      }
      const ref = String(historyEntry?.reference || "");
      const dist = ref ? distributionByReference.get(ref) : null;
      const matchedItem = Array.isArray(dist?.items)
        ? dist.items.find((distItem) => {
            const distKey = getSupplyItemKeyFromDistributionItem(distItem, dist);
            return (
              (selectedItemKey && distKey === selectedItemKey) ||
              String(distItem?.returnId || "") === String(resolvedLedgerItemId)
            );
          })
        : null;
      const distributionCostRaw = matchedItem?.cost;
      const distributionCost = Number(distributionCostRaw);
      if (
        distributionCostRaw !== null &&
        distributionCostRaw !== undefined &&
        distributionCostRaw !== "" &&
        Number.isFinite(distributionCost) &&
        distributionCost >= 0
      ) {
        return distributionCost;
      }
      return Number(item.balance_unit_cost || item.purchase_unit_cost || item.stock_unit_cost || 0);
    };

    // Canonical supply history includes stock-ins, restocks, manual adjustments,
    // issues, disposals, and distribution reversals.
    historyEntries.forEach((h) => {
      const movement = norm(h?.movement_type);
      const status = norm(h?.status);
      const request = norm(h?.requeststatus);
      const documentType = String(h?.document_type || "").toUpperCase();
      const isReceipt =
        movement === "receipt" ||
        isRestockStatus(status) ||
        status.includes("revert") ||
        request === "receipt";
      const isIssue =
        movement === "issue" ||
        isDisposeStatus(status) ||
        status.includes("distribut") ||
        request === "issue" ||
        request === "transferred";
      if (!isReceipt && !isIssue) return;

      const qty = Number(h?.history_qty ?? h?.disposed_qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) return;
      const type = isReceipt ? "receipt" : "issue";
      const reference = String(h?.reference || "");
      if (type === "issue" && reference) recordedIssueReferences.add(reference);
      if (
        type === "receipt" &&
        (documentType === "STOCK" || isRestockStatus(status))
      ) {
        hasStockReceiptHistory = true;
      }

      pushEvent({
        type,
        movement:
          type === "issue"
            ? documentType === "SDR" || isDisposeStatus(status)
              ? "disposal"
              : movement === "issue" && documentType === "ADJUSTMENT"
              ? "adjustment"
              : "distribution"
            : status.includes("revert")
            ? "reversal"
            : documentType === "ADJUSTMENT"
            ? "adjustment"
            : "receipt",
        date: h.date,
        qty,
        unitCost: resolveHistoryUnitCost(h),
        source: reference || h.station || h.status || "Stock Movement",
      });
    });

    // Initial purchase fallback for older records without receipt history.
    const purchaseDate = item.date || item.purchase_date || null;
    const purchaseQty =
      item.purchase_qty !== undefined && item.purchase_qty !== null
        ? Number(item.purchase_qty || 0)
        : Number(item.stock_qty || 0);
    if (!hasStockReceiptHistory && purchaseDate && purchaseQty > 0) {
      pushEvent({
        type: "receipt",
        date: purchaseDate,
        qty: purchaseQty,
        unitCost: Number(item.purchase_unit_cost || item.stock_unit_cost || 0),
        source: "Initial Purchase",
      });
    }

    // Finalized distributions/disposals from distribution records.
    (Array.isArray(distributions) ? distributions : []).forEach((dist) => {
      const rs = String(dist.requeststatus || "").toLowerCase().trim();
      const st = String(dist.status || "").toLowerCase().trim();
      const isDisposal =
        String(dist.request_type || "").toLowerCase().trim() === "disposal";

      const isFinal = isDisposal
        ? st === "disposed" || rs === "approved" || rs === "received"
        : st === "transferred" ||
          st === "received" ||
          rs === "transferred" ||
          rs === "received";
      if (!isFinal) return;

      const distDate =
        dist.date_received ||
        dist.date_released ||
        dist.date_approved ||
        dist.date_checked ||
        dist.date_requested ||
        dist.updatedAt ||
        dist.createdAt;
      if (!Array.isArray(dist.items)) return;

      dist.items.forEach((itm) => {
        const itemKey = getSupplyItemKeyFromDistributionItem(itm, dist);
        const isTarget =
          (selectedItemKey && itemKey === selectedItemKey) ||
          itm.returnId === resolvedLedgerItemId;
        if (!isTarget) return;

        const qty = Number(itm.quantity || 0);
        if (!qty) return;

        const reference = String(dist?.RIS_no || "");
        if (reference && recordedIssueReferences.has(reference)) return;

        pushEvent({
          type: "issue",
          movement: isDisposal ? "disposal" : "distribution",
          date: distDate,
          qty,
          unitCost: Number(
            itm.cost ?? item.balance_unit_cost ?? item.purchase_unit_cost ?? 0
          ),
          source: isDisposal
            ? "Disposed"
            : dist.office || dist.distributedto || "Distribution",
        });

      });
    });

    // Legacy disposal history without movement_type was already included above.

    const fundCluster = getFundCluster(item);
    const signatoryName =
      (inventoryAdminUser &&
        (inventoryAdminUser.username || inventoryAdminUser.name)) ||
      "Inventory Admin";

    // Compute quantity and inventory value immediately before the selected
    // range by reversing every later recorded movement from today's balance.
    let balanceAtFrom = Number(getEffectiveSupplyQty(item) || 0);
    if (!Number.isFinite(balanceAtFrom)) balanceAtFrom = 0;
    let valueAtFrom = Number(item.balance_total_cost || 0);
    if (!Number.isFinite(valueAtFrom)) valueAtFrom = 0;
    allEvents.forEach((e) => {
      if (e.date >= fromDate) {
        const eventValue = Number(e.qty || 0) * Number(e.unitCost || 0);
        if (e.type === "issue") {
          balanceAtFrom += e.qty;
          valueAtFrom += eventValue;
        }
        if (e.type === "receipt") {
          balanceAtFrom -= e.qty;
          valueAtFrom -= eventValue;
        }
      }
    });
    balanceAtFrom = Math.max(0, balanceAtFrom);
    valueAtFrom = Math.max(0, valueAtFrom);

    const eventsInRange = allEvents
      .filter((e) => e.date >= fromDate && e.date <= toDate)
      .sort((a, b) => {
        const diff = a.date - b.date;
        if (diff !== 0) return diff;
        if (a.type === b.type) return 0;
        return a.type === "receipt" ? -1 : 1;
      });

    let runningBalance = Math.max(0, balanceAtFrom);
    let runningValue = Math.max(0, valueAtFrom);
    const lineItems = eventsInRange.length
      ? eventsInRange.map((e) => {
          const eventUnitCost = Number(
            e.unitCost ?? item.balance_unit_cost ?? item.purchase_unit_cost ?? 0
          );
          const eventValue = Number(e.qty || 0) * Number(eventUnitCost || 0);
          if (e.type === "receipt") {
            runningBalance += e.qty;
            runningValue += eventValue;
          } else if (e.type === "issue") {
            runningBalance -= e.qty;
            runningValue -= eventValue;
          }
          runningBalance = Math.max(0, runningBalance);
          runningValue = Math.max(0, runningValue);
          const weightedAverageCost =
            runningBalance > 0 ? runningValue / runningBalance : 0;
          return {
            fundSource: fundCluster,
            stockNo: item.stock_no || "",
            totalQty: runningBalance,
            unit: item.unitofmeasure || "",
            itemDescription: item.itemName || "",
            purchaseDate: e.type === "receipt" ? e.date : "",
            purchaseQty: e.type === "receipt" ? e.qty : "",
            unitCost: e.type === "receipt" ? eventUnitCost : "",
            totalUnitCost:
              e.type === "receipt"
                ? Number(e.qty || 0) * Number(eventUnitCost || 0)
                : "",
            weightedAverageCost,
            totalWeightedAverageCost: runningValue,
            remarks:
              e.type === "issue"
                ? `${
                    e.movement === "disposal"
                      ? "Disposed"
                      : e.movement === "adjustment"
                      ? "Manual issue"
                      : "Issued"
                  }: ${e.qty} • ${e.source || "Distribution"}`
                : `${
                    e.movement === "reversal"
                      ? "Reversal receipt"
                      : e.movement === "adjustment"
                      ? "Manual receipt"
                      : "Receipt"
                  }: ${e.qty} • ${e.source || "Stock Entry"}`,
          };
        })
      : [
          {
            fundSource: fundCluster,
            stockNo: item.stock_no || "",
            totalQty: Math.max(0, balanceAtFrom),
            unit: item.unitofmeasure || "",
            itemDescription: item.itemName || "",
            purchaseDate: "",
            purchaseQty: "",
            unitCost: "",
            totalUnitCost: "",
            weightedAverageCost:
              balanceAtFrom > 0 ? valueAtFrom / balanceAtFrom : 0,
            totalWeightedAverageCost: valueAtFrom,
            remarks: "No movements in selected range",
          },
        ];

    const header = {
      title: "COMPLETE MASTER LEDGER CARD",
      entityName: "DICT REGIONAL OFFICE 02",
      itemDescription: item.itemName || "",
      unitOfMeasure: item.unitofmeasure || "",
      fundCluster,
      stockNo: item.stock_no || "",
      currentBalance: Number(getEffectiveSupplyQty(item) || 0),
      dateFrom: ledgerStart,
      dateTo: ledgerEnd,
      signatoryName,
    };

    setLedgerHeader(header);
    setLedgerRows(lineItems);
    setLedgerModalOpen(false);
    setLedgerViewOpen(true);
  };

  const handleExportLedgerExcel = () => {
    if (!ledgerHeader || !ledgerRows.length) return;

    const exportData = ledgerRows.map((r) => ({
      "Fund Source": r.fundSource,
      "Stock No.": r.stockNo,
      "Total Qty (Stock on Store)": r.totalQty,
      "Unit of Measure": r.unit,
      "Item Description": r.itemDescription,
      "Purchase Date": r.purchaseDate ? formatDisplayDate(r.purchaseDate) : "",
      "Purchase Qty": r.purchaseQty,
      "Unit Cost": r.unitCost,
      "Total Unit Cost": r.totalUnitCost,
      "Weighted-Average Cost": r.weightedAverageCost,
      "Total Weighted-Average Cost": r.totalWeightedAverageCost,
      Remarks: r.remarks || "",
    }));

    const headerKeys = exportData.length
      ? Object.keys(exportData[0])
      : [
          "Fund Source",
          "Stock No.",
          "Total Qty (Stock on Store)",
          "Unit of Measure",
          "Item Description",
          "Purchase Date",
          "Purchase Qty",
          "Unit Cost",
          "Total Unit Cost",
          "Weighted-Average Cost",
          "Total Weighted-Average Cost",
          "Remarks",
        ];

    const ws = XLSX.utils.json_to_sheet(exportData, { origin: "A9" });

    const dateFromLabel = ledgerHeader.dateFrom
      ? formatDisplayDate(ledgerHeader.dateFrom)
      : "";
    const dateToLabel = ledgerHeader.dateTo
      ? formatDisplayDate(ledgerHeader.dateTo)
      : "";
    const dateFilteredText =
      dateFromLabel && dateToLabel
        ? `${dateFromLabel} to ${dateToLabel}`
        : dateFromLabel || dateToLabel || "";

    const headerRows = [
      ["REPUBLIC OF THE PHILIPPINES"],
      ["DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY"],
      [ledgerHeader.entityName || "DICT REGIONAL OFFICE 02"],
      [""],
      ["COMPLETE MASTER LEDGER CARD"],
      [""],
      [
        `Item: ${ledgerHeader.itemDescription || "—"} | Stock No.: ${
          ledgerHeader.stockNo || "—"
        }`,
      ],
      [
        `Fund Cluster: ${ledgerHeader.fundCluster || "—"} | Date Filtered: ${
          dateFilteredText || "—"
        }`,
      ],
    ];

    XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });

    const lastColIndex = headerKeys.length ? headerKeys.length - 1 : 0;
    ws["!merges"] = (ws["!merges"] || []).concat([
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIndex } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: lastColIndex } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: lastColIndex } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: lastColIndex } },
    ]);

    ws["!cols"] = headerKeys.map(() => ({ wch: 15 }));
    if (ws["!cols"][4]) ws["!cols"][4].wch = 40;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MasterLedger");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    const safeName =
      (ledgerHeader.itemDescription || "Item").replace(/[\\/:*?"<>|]/g, "_") ||
      "Item";

    saveAs(
      new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `Master_Ledger_${safeName}.xlsx`
    );
  };

  const handlePrintLedger = () => {
    if (!ledgerHeader || !ledgerRows.length) return;

    const esc = (str) => {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const formatPHP = (value) => {
      const n = Number(value);
      if (Number.isNaN(n)) return "—";
      return n.toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
      });
    };

    const dateFromLabel = ledgerHeader.dateFrom
      ? formatDisplayDate(ledgerHeader.dateFrom)
      : "";
    const dateToLabel = ledgerHeader.dateTo
      ? formatDisplayDate(ledgerHeader.dateTo)
      : "";
    const dateFilteredText =
      dateFromLabel && dateToLabel
        ? `${dateFromLabel} to ${dateToLabel}`
        : dateFromLabel || dateToLabel || "";

    const rowsHTML = ledgerRows
      .map(
        (row) => `
        <tr>
          <td class="tc">${esc(row.fundSource || "—")}</td>

          <!-- Stock on Store -->
          <td class="tc">${esc(row.stockNo || "—")}</td>
          <td class="tc">${esc(
            row.totalQty !== undefined && row.totalQty !== null
              ? String(row.totalQty)
              : "—"
          )}</td>
          <td class="tc">${esc(row.unit || "—")}</td>
          <td class="desc">${esc(row.itemDescription || "—")}</td>

          <!-- Receipt -->
          <td class="tc">${
            row.purchaseDate
              ? esc(formatDisplayDate(row.purchaseDate))
              : "—"
          }</td>
          <td class="tc">${esc(
            row.purchaseQty !== undefined && row.purchaseQty !== null
              ? String(row.purchaseQty)
              : "—"
          )}</td>
          <td class="tr">${esc(
            row.unitCost !== "" && row.unitCost !== null && row.unitCost !== undefined
              ? formatPHP(row.unitCost)
              : "—"
          )}</td>
          <td class="tr">${esc(
            row.totalUnitCost !== "" &&
              row.totalUnitCost !== null &&
              row.totalUnitCost !== undefined
              ? formatPHP(row.totalUnitCost)
              : "—"
          )}</td>

          <!-- Inventory Balance -->
          <td class="tr">${esc(
            row.weightedAverageCost !== "" &&
              row.weightedAverageCost !== null &&
              row.weightedAverageCost !== undefined
              ? formatPHP(row.weightedAverageCost)
              : "—"
          )}</td>
          <td class="tr">${esc(
            row.totalWeightedAverageCost !== "" &&
              row.totalWeightedAverageCost !== null &&
              row.totalWeightedAverageCost !== undefined
              ? formatPHP(row.totalWeightedAverageCost)
              : "—"
          )}</td>

          <!-- Remarks -->
          <td class="desc">${
            row.remarks && row.remarks.trim().length
              ? esc(row.remarks)
              : "—"
          }</td>
        </tr>`
      )
      .join("");

    const win = window.open("", "", "width=1200,height=800");
    if (!win) {
      alert("Pop-up blocked. Please allow pop-ups then try again.");
      return;
    }

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Complete Master Ledger Card</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.4;
    }
    @page { size: A4 landscape; margin: 10mm; }

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
    .doc-title { margin-top:6px; font-size:14px; font-weight:900; letter-spacing:0.18em; color:#0f172a; }

    .meta-table { width:100%; margin-top:8px; border-collapse:collapse; font-size:10px; }
    .meta-table td { border:1px solid #e2e8f0; padding:6px 6px; vertical-align:middle; }
    .meta-table .k { background:#f8fafc; font-weight:700; color:#0f172a; width:26%; font-size:9px; }
    .meta-table .v { font-style:italic; font-size:10px; }

    table { border-collapse: collapse; width:100%; }

    .items thead th { border:1px solid #e2e8f0; padding:6px 6px; background:#f1f5f9;
                      font-weight:700; text-transform:uppercase; letter-spacing:0.06em; font-size:10px;
                      color:#0f172a; text-align:center; }
    .items tbody td { border:1px solid #e2e8f0; padding:6px 6px; font-size:10px; }
    .tc { text-align:center; }
    .tr { text-align:right; }
    .desc { font-style:italic; }

    .sigs { margin-top:14px; }
    .sigs thead th { border:1px solid #e2e8f0; background:#f8fafc; padding:6px 6px; font-weight:700; font-size:10px; color:#0f172a; text-align:center; }
    .sigs tbody td { border:1px solid #e2e8f0; padding:24px 6px 10px 6px; vertical-align:bottom; text-align:center; min-height:96px; }
    .sig-line { width:92%; border-top:1px solid #0f172a; margin:0 auto 4px auto; }
    .sig-name { font-weight:800; font-size:10px; color:#0f172a; text-transform:uppercase; }
    .sig-role, .sig-date { font-size:9px; color:#475569; font-style:italic; }
    .sig-date { margin-top:2px; }

    .foot { margin-top:10px; font-size:9px; color:#475569; font-style:italic; border-top:1px solid #e2e8f0; padding-top:8px; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="card">
      <div class="paper">
        <!-- Top bar -->
        <div class="bar">
          <div class="brand">
            <div class="brand-logo">
              <img src="${esc(DICT)}" alt="DICT" style="height:16px;width:auto;" />
            </div>
            <div>
              <div class="brand-title">COMPLETE MASTER LEDGER CARD</div>
              <div class="brand-sub">Official Master Ledger • System-generated • Print copy</div>
            </div>
          </div>
          <div class="bar-right">
            <div class="chip"><span class="chip-dot"></span><span>MLC</span></div>
            <div class="tiny-note">
              <b>Stock No.:</b> ${esc(ledgerHeader.stockNo || "—")} •
              <b>Fund Cluster:</b> ${esc(ledgerHeader.fundCluster || "—")}
            </div>
          </div>
        </div>

        <!-- Government header -->
        <div class="header">
          <img class="logo" src="${esc(DICT)}" alt="DICT Logo" />
          <div class="header-lines">
            <div class="a">REPUBLIC OF THE PHILIPPINES</div>
            <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
            <div class="c">${esc(ledgerHeader.entityName || "DICT REGIONAL OFFICE 02")}</div>
            <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
          </div>
          <div class="doc-title">${esc(ledgerHeader.title || "COMPLETE MASTER LEDGER CARD")}</div>
        </div>

        <!-- Meta table -->
        <table class="meta-table">
          <tbody>
            <tr>
              <td class="k">Entity Name:</td>
              <td class="v" colspan="3"><b><i>${esc(
                ledgerHeader.entityName || "DICT REGIONAL OFFICE 02"
              )}</i></b></td>
              <td class="k">Fund Cluster:</td>
              <td class="v"><b><i>${esc(
                ledgerHeader.fundCluster || "Regular"
              )}</i></b></td>
            </tr>
            <tr>
              <td class="k">Item Description:</td>
              <td class="v" colspan="3"><i>${esc(
                ledgerHeader.itemDescription || "—"
              )}</i></td>
              <td class="k">Unit of Measurement:</td>
              <td class="v"><i>${esc(ledgerHeader.unitOfMeasure || "—")}</i></td>
            </tr>
            <tr>
              <td class="k">Stock No.:</td>
              <td class="v"><i>${esc(ledgerHeader.stockNo || "—")}</i></td>
              <td class="k">Current Balance:</td>
              <td class="v"><i>${esc(
                ledgerHeader.currentBalance !== undefined &&
                ledgerHeader.currentBalance !== null
                  ? String(ledgerHeader.currentBalance)
                  : "—"
              )}</i></td>
              <td class="k">Date Filtered:</td>
              <td class="v"><i>${esc(dateFilteredText || "—")}</i></td>
            </tr>
          </tbody>
        </table>

        <!-- Ledger table -->
        <table class="items" style="margin-top:10px;">
          <thead>
            <tr>
              <th rowspan="2">Fund Source</th>
              <th colspan="4">Stock on Store</th>
              <th colspan="4">Receipt (Purchase Delivery)</th>
              <th colspan="2">Inventory Balance</th>
              <th rowspan="2">Remarks</th>
            </tr>
            <tr>
              <th>Stock No.</th>
              <th>Total Qty</th>
              <th>Unit</th>
              <th>Item Description</th>
              <th>Purchase Date</th>
              <th>Purchase Qty</th>
              <th>Unit Cost</th>
              <th>Total Unit Cost</th>
              <th>Weighted-Average Cost</th>
              <th>Total Weighted-Average Cost</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <!-- Signatory -->
        <table class="sigs">
          <thead>
            <tr>
              <th>Prepared / Certified True by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="sig-line"></div>
                <div class="sig-name">${esc(
                  ledgerHeader.signatoryName || "Inventory Admin"
                )}</div>
                <div class="sig-role">Inventory Admin</div>
                <div class="sig-date">Date: __________________</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="foot">
          This Master Ledger is system-generated by the DICT Region 02 Inventory System and is valid
          only upon affixing the required signature of the Inventory Admin.
        </div>
      </div>
    </div>
  </div>

  <script>
    window.focus();
    setTimeout(function() {
      window.print();
      window.close();
    }, 50);
  </script>
</body>
</html>`);

    win.document.close();
    win.focus();
  };

  /* ---------- Stats (chips) ---------- */
  const totalRows = analyticsBaseItems.length;
  const inStockCount = analyticsBaseItems.filter(
    (i) =>
      getSupplyStatusMeta(i.status, getEffectiveSupplyQty(i), i.lowstock_threshold)
        .label === "In stock"
  ).length;
  const lowStockCount = analyticsBaseItems.filter(
    (i) =>
      getSupplyStatusMeta(i.status, getEffectiveSupplyQty(i), i.lowstock_threshold)
        .label === "Low stock"
  ).length;
  const outOfStockCount = analyticsBaseItems.filter(
    (i) =>
      getSupplyStatusMeta(i.status, getEffectiveSupplyQty(i), i.lowstock_threshold)
        .label === "Out of stock"
  ).length;
  const pendingCount = analyticsBaseItems.filter(
    (i) =>
      getSupplyStatusMeta(i.status, getEffectiveSupplyQty(i), i.lowstock_threshold)
        .label === "Pending"
  ).length;

  const Chip = ({
    label,
    count,
    colorClasses,
    onClick,
    active = false,
    disabled = false,
    title,
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
        />
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

  const colors = {
    total: {
      activeBg: "bg-indigo-600",
      activeText: "text-white",
      activeBorder: "border-indigo-600",
      activeBgSubtle: "bg-indigo-500/10",
      countActiveBg: "bg-indigo-500/20",
    },
    inStock: {
      activeBg: "bg-emerald-600",
      activeText: "text-white",
      activeBorder: "border-emerald-600",
      activeBgSubtle: "bg-emerald-500/10",
      countActiveBg: "bg-emerald-500/20",
    },
    lowStock: {
      activeBg: "bg-amber-500",
      activeText: "text-white",
      activeBorder: "border-amber-500",
      activeBgSubtle: "bg-amber-500/10",
      countActiveBg: "bg-amber-500/20",
    },
    outOfStock: {
      activeBg: "bg-rose-600",
      activeText: "text-white",
      activeBorder: "border-rose-600",
      activeBgSubtle: "bg-rose-500/10",
      countActiveBg: "bg-rose-500/20",
    },
    pending: {
      activeBg: "bg-sky-600",
      activeText: "text-white",
      activeBorder: "border-sky-600",
      activeBgSubtle: "bg-sky-500/10",
      countActiveBg: "bg-sky-500/20",
    },
  };

  const activeChartMeta =
    chartOptions.find((opt) => opt.value === chartType) || chartOptions[0];

  /* ---------- Render ---------- */

  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error.message || "Failed to load reports for office supplies."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        <Breadcrumbs className="mb-3" items={breadcrumbs} />

        <div className="flex flex-col gap-6">
          {/* HEADER */}
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-light text-slate-900">
                Reports <span className="font-semibold">Office Supplies</span>
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Track stock movement, balances, and supply status.
              </p>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="filter-card">
            <div className="filter-card-content">
              <div className="flex flex-col gap-3">
                <div className="request-filterbar">
                  <div className="flex-1 min-w-[220px]">
                    <SearchInput
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search item, code, status..."
                      ariaLabel="Search in office supplies"
                      compact={false}
                    />
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

                  <div className="ml-auto text-[11px] text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {currentItems.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-900">
                      {totalCount}
                    </span>{" "}
                    records
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={handleResetFilters}
                    className="table-button"
                    title="Reset filters and sorting"
                  >
                    Reset
                  </button>

                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {canGenerateMasterLedger && (
                      <button
                        onClick={openLedgerModal}
                        disabled={!fullDataReady}
                        className="table-button-primary flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        title={
                          fullDataReady
                            ? "Generate master ledger"
                            : "Loading all matching records"
                        }
                      >
                        <span className="hidden sm:inline">Generate</span>
                        <span>Master Ledger</span>
                      </button>
                    )}

                    <button
                      onClick={handleExport}
                      disabled={!fullDataReady}
                      className="table-button-accent bg-emerald-500 text-white flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      title={
                        fullDataReady
                          ? "Export all matching records"
                          : "Loading all matching records"
                      }
                    >
                      <span>Export Excel</span>
                    </button>
                  </div>
                </div>
              </div>
          </div>
          </div>

          {/* STATUS SNAPSHOT */}
          <div className="filter-card">
            <div className="filter-card-content">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Status Snapshot
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip
                label="Total"
                count={totalRows}
                colorClasses={colors.total}
                onClick={() => setFilterStatus("All")}
                active={filterStatus === "All"}
                disabled={loading}
                title="Show all records"
              />
              <Chip
                label="In stock"
                count={inStockCount}
                colorClasses={colors.inStock}
                onClick={() => setFilterStatus("In stock")}
                active={filterStatus === "In stock"}
                disabled={loading}
                title="Filter In stock"
              />
              <Chip
                label="Low stock"
                count={lowStockCount}
                colorClasses={colors.lowStock}
                onClick={() => setFilterStatus("Low stock")}
                active={filterStatus === "Low stock"}
                disabled={loading}
                title="Filter Low stock"
              />
              <Chip
                label="Out of stock"
                count={outOfStockCount}
                colorClasses={colors.outOfStock}
                onClick={() => setFilterStatus("Out of stock")}
                active={filterStatus === "Out of stock"}
                disabled={loading}
                title="Filter Out of stock"
              />
              <Chip
                label="Pending"
                count={pendingCount}
                colorClasses={colors.pending}
                onClick={() => setFilterStatus("Pending")}
                active={filterStatus === "Pending"}
                disabled={loading}
                title="Filter Pending"
              />
            </div>
          </div>
          </div>

          {/* CHARTS */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Analytics
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {activeChartMeta.label}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {activeChartMeta.helper}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="table-select"
                >
                  {chartOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {(chartType === "coverageRisk" ||
                  chartType === "officeDemand" ||
                  chartType === "lowStockByClass") && (
                  <select
                    value={chartTopN}
                    onChange={(e) => setChartTopN(Number(e.target.value))}
                    className="table-select"
                  >
                    {[8, 12, 15, 20].map((n) => (
                      <option key={n} value={n}>
                        Top {n}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  On-hand Qty
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {Number(analyticsKpis.totalOnHandQty || 0).toLocaleString("en-PH")}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-700">
                  Issued (30 days)
                </div>
                <div className="mt-1 text-lg font-semibold text-emerald-900">
                  {Number(analyticsKpis.issuedLast30 || 0).toLocaleString("en-PH")}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-amber-700">
                  Est. Coverage
                </div>
                <div className="mt-1 text-lg font-semibold text-amber-900">
                  {analyticsKpis.coverageDays == null
                    ? "No demand data"
                    : `${analyticsKpis.coverageDays} days`}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-rose-700">
                  Reorder Needed
                </div>
                <div className="mt-1 text-lg font-semibold text-rose-900">
                  {Number(analyticsKpis.reorderQty || 0).toLocaleString("en-PH")}
                </div>
                <div className="text-[10px] text-rose-700/80">
                  {analyticsKpis.belowThresholdCount} item(s) at/below threshold
                </div>
              </div>
            </div>

            <div className="mt-4">
              {loading || analyticsLoading ? (
                <div className="py-8 text-left text-xs md:text-sm text-gray-500">
                  Loading chart...
                </div>
              ) : chartType === "coverageRisk" ? (
                chartCoverageRisk.length === 0 ? (
                  <div className="py-4 text-left text-[10px] md:text-xs text-gray-400">
                    No data available for chart.
                  </div>
                ) : (
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartCoverageRisk}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 9 }}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="onHand" name="On-hand Qty" fill="#10b981" />
                        <Bar dataKey="demand30" name="Est. 30-day Demand" fill="#2563eb" />
                        <Bar dataKey="reorderGap" name="Reorder Gap" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : chartType === "monthlyFlow" ? (
                chartMonthlyFlow.length === 0 ? (
                  <div className="py-4 text-left text-[10px] md:text-xs text-gray-400">
                    No monthly flow data available.
                  </div>
                ) : (
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartMonthlyFlow}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="receiptQty"
                          name="Receipts"
                          stroke="#16a34a"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="issueQty"
                          name="Issues"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="netFlow"
                          name="Net Flow"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : chartType === "officeDemand" ? (
                chartOfficeDemand.length === 0 ? (
                  <div className="py-4 text-left text-[10px] md:text-xs text-gray-400">
                    No recent office demand found.
                  </div>
                ) : (
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartOfficeDemand} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={170}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="qty" name="Issued Qty (90 days)" fill="#0ea5e9" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : chartType === "statusBreakdown" ? (
                chartStatusBreakdown.length === 0 ? (
                  <div className="py-4 text-left text-[10px] md:text-xs text-gray-400">
                    No data available for chart.
                  </div>
                ) : (
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie
                          data={chartStatusBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={95}
                          paddingAngle={3}
                          label
                        >
                          {chartStatusBreakdown.map((entry, idx) => (
                            <Cell
                              key={`${entry.name}-${idx}`}
                              fill={chartPalette[idx % chartPalette.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : chartType === "lowStockByClass" ? (
                chartLowStockByClass.length === 0 ? (
                  <div className="py-4 text-left text-[10px] md:text-xs text-gray-400">
                    No low-stock items available.
                  </div>
                ) : (
                  <div className="h-64 md:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartLowStockByClass}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="Low Stock Items" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : (
                <div className="py-4 text-left text-[10px] md:text-xs text-gray-400">
                  Select an analytics view.
                </div>
              )}
            </div>
          </div>

          {/* TABLE */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Supply Records
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  Office Supply Ledger
                </div>
                <p className="text-[11px] text-slate-500">
                  Detailed balance, purchases, distribution, and status.
                </p>
              </div>
              <div className="text-[11px] text-slate-500">
                Total <span className="font-semibold text-slate-900">{totalCount}</span>
              </div>
            </div>

            <div className="table-shell table-compact table-flush px-3 md:px-5 pb-4">
              <div className="max-h-[70vh] overflow-auto pr-1">
                <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                  ) : currentItems.length === 0 ? (
                    <EmptyState
                      title="No matching records"
                      subtitle="We could not find any supply records that match your filters."
                      hint="Try adjusting filters or clearing search."
                      className="max-w-2xl"
                    />
                  ) : (
                    currentItems.map((data, idx) => (
                      <ItemCard key={`${data._id || "row"}-${idx}`} data={data} />
                    ))
                  )}
                </div>

                <table className="w-full whitespace-nowrap hidden lg:table text-left">
                  <thead>
                    {/* Header labels */}
                    <tr className="h-10 text-gray-800">
                      <TableHeader
                        title="Stock No."
                        sortKey="stock_no"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Item Description"
                        sortKey="itemName"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Classification"
                        sortKey="classification"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Balance Qty"
                        sortKey="balance_qty"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Low Stock Threshold"
                        sortKey="lowstock_threshold"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Unit"
                        sortKey="unitofmeasure"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Balance Unit Cost"
                        sortKey="balance_unit_cost"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Balance Total Cost"
                        sortKey="balance_total_cost"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Purchase Qty"
                        sortKey="purchase_qty"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Purchase Unit Cost"
                        sortKey="purchase_unit_cost"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Purchase Total Cost"
                        sortKey="purchase_total_cost"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Distribution Qty"
                        sortKey="distribution_qty"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Distribution Unit Cost"
                        sortKey="distribution_unit_cost"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Distribution Total Cost"
                        sortKey="distribution_total_cost"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Disposed Qty"
                        sortKey="disposed_qty"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <TableHeader
                        title="Status"
                        sortKey="status"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </tr>

                    {/* Column filters */}
                    <tr className="h-11 text-[8px] md:text-[9px] text-gray-700 bg-gray-50/40">
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.stock_no}
                          onChange={(e) =>
                            handleColumnFilterChange("stock_no", e.target.value)
                          }
                          placeholder="Stock No."
                          ariaLabel="Filter by Stock No."
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.itemName}
                          onChange={(e) =>
                            handleColumnFilterChange("itemName", e.target.value)
                          }
                          placeholder="Item"
                          ariaLabel="Filter by Item"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.classification}
                          onChange={(e) =>
                            handleColumnFilterChange("classification", e.target.value)
                          }
                          placeholder="Classification"
                          ariaLabel="Filter by Classification"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.balance_qty}
                          onChange={(e) =>
                            handleColumnFilterChange("balance_qty", e.target.value)
                          }
                          placeholder="Bal. Qty"
                          ariaLabel="Filter by Balance Qty"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.lowstock_threshold}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "lowstock_threshold",
                              e.target.value
                            )
                          }
                          placeholder="Threshold"
                          ariaLabel="Filter by Low Stock Threshold"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.unitofmeasure}
                          onChange={(e) =>
                            handleColumnFilterChange("unitofmeasure", e.target.value)
                          }
                          placeholder="Unit"
                          ariaLabel="Filter by Unit"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.balance_unit_cost}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "balance_unit_cost",
                              e.target.value
                            )
                          }
                          placeholder="Bal. Unit Cost"
                          ariaLabel="Filter by Balance Unit Cost"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.balance_total_cost}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "balance_total_cost",
                              e.target.value
                            )
                          }
                          placeholder="Bal. Total Cost"
                          ariaLabel="Filter by Balance Total Cost"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.purchase_qty}
                          onChange={(e) =>
                            handleColumnFilterChange("purchase_qty", e.target.value)
                          }
                          placeholder="Purchase Qty"
                          ariaLabel="Filter by Purchase Qty"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.purchase_unit_cost}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "purchase_unit_cost",
                              e.target.value
                            )
                          }
                          placeholder="Purchase Unit Cost"
                          ariaLabel="Filter by Purchase Unit Cost"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.purchase_total_cost}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "purchase_total_cost",
                              e.target.value
                            )
                          }
                          placeholder="Purchase Total Cost"
                          ariaLabel="Filter by Purchase Total Cost"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.distribution_qty}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "distribution_qty",
                              e.target.value
                            )
                          }
                          placeholder="Distribution Qty"
                          ariaLabel="Filter by Distribution Qty"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.distribution_unit_cost}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "distribution_unit_cost",
                              e.target.value
                            )
                          }
                          placeholder="Dist. Unit Cost"
                          ariaLabel="Filter by Distribution Unit Cost"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.distribution_total_cost}
                          onChange={(e) =>
                            handleColumnFilterChange(
                              "distribution_total_cost",
                              e.target.value
                            )
                          }
                          placeholder="Dist. Total Cost"
                          ariaLabel="Filter by Distribution Total Cost"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.disposed_qty}
                          onChange={(e) =>
                            handleColumnFilterChange("disposed_qty", e.target.value)
                          }
                          placeholder="Disposed Qty"
                          ariaLabel="Filter by Disposed Qty"
                        />
                      </td>
                      <td className="px-2 py-2 text-left border-b">
                        <SearchInput
                          value={filters.status}
                          onChange={(e) =>
                            handleColumnFilterChange("status", e.target.value)
                          }
                          placeholder="Status"
                          ariaLabel="Filter by Status"
                        />
                      </td>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                    ) : currentItems.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="px-4 py-10">
                          <EmptyState
                            title="No matching records"
                            subtitle="We could not find any supply records that match your filters."
                            hint="Try adjusting filters or clearing search."
                            className="max-w-2xl"
                          />
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((data, idx) => (
                        <TableRow key={`${data._id || "row"}-${idx}`} data={data} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && totalCount > itemsPerPage && (
                <div className="flex flex-wrap items-center justify-between mt-4 text-[10px] md:text-xs gap-2">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                    style={
                      currentPage === 1
                        ? {
                            backgroundColor: "#f9fafb",
                            color: "#d1d5db",
                            cursor: "not-allowed",
                          }
                        : {
                            backgroundColor: "#ffffff",
                            color: "#374151",
                          }
                    }
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
                        ? {
                            backgroundColor: "#f9fafb",
                            color: "#d1d5db",
                            cursor: "not-allowed",
                          }
                        : {
                            backgroundColor: "#ffffff",
                            color: "#374151",
                          }
                    }
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MASTER LEDGER: SELECTION MODAL */}
      {canGenerateMasterLedger && ledgerModalOpen && (
        <ModalShell
          open
          title="Generate Master Ledger"
          subtitle="Supply Reports"
          variant="warning"
          onClose={() => setLedgerModalOpen(false)}
          maxWidthClass="max-w-md"
        >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Item
                </label>
                <input
                  type="text"
                  list="office-supply-ledger-items"
                  value={ledgerItemQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLedgerItemQuery(value);
                    const selected = (fullFilteredItems.length
                      ? fullFilteredItems
                      : sortedItems
                    ).find((item) => buildLedgerItemLabel(item) === value);
                    setLedgerItemId(selected?._id || "");
                  }}
                  placeholder="Type item name or stock no."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <datalist id="office-supply-ledger-items">
                  {ledgerItemOptions.map((item) => (
                    <option key={item._id} value={buildLedgerItemLabel(item)} />
                  ))}
                </datalist>
                <p className="mt-1 text-[10px] text-gray-500">
                  Showing matches from all filtered records, not only this page.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    From (Date)
                  </label>
                  <input
                    type="date"
                    value={ledgerStart}
                    onChange={(e) => setLedgerStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    To (Date)
                  </label>
                  <input
                    type="date"
                    value={ledgerEnd}
                    onChange={(e) => setLedgerEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              {ledgerError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {ledgerError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setLedgerModalOpen(false)}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-xs md:text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateLedger}
                  disabled={!fullDataReady}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-xs md:text-sm font-semibold text-white shadow-sm hover:bg-black"
                >
                  Generate
                </button>
              </div>
            </div>
        </ModalShell>
      )}

      {/* MASTER LEDGER: VIEW / PRINT PREVIEW */}
      {ledgerViewOpen && ledgerHeader && (
        <ModalShell
          open
          title="Complete Master Ledger Card"
          subtitle="Master Ledger Preview"
          variant="neutral"
          onClose={() => setLedgerViewOpen(false)}
          maxWidthClass="max-w-5xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-slate-600">
                Preview of the system-generated Master Ledger. Print for PDF or download as
                Excel.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintLedger}
                  className="rounded-xl bg-gray-900 px-3 py-1.5 text-[10px] md:text-xs font-semibold text-white shadow-sm hover:bg-black"
                >
                  Print / PDF
                </button>
                <button
                  onClick={handleExportLedgerExcel}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] md:text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Excel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="col-span-1 md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3">
                <p className="text-[10px] font-semibold text-slate-700 mb-1">
                  Item Information
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-700">
                  <div>
                    <span className="font-semibold">Entity:</span>{" "}
                    {ledgerHeader.entityName || "DICT REGIONAL OFFICE 02"}
                  </div>
                  <div>
                    <span className="font-semibold">Fund Cluster:</span>{" "}
                    {ledgerHeader.fundCluster || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Item:</span>{" "}
                    {ledgerHeader.itemDescription || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Unit:</span>{" "}
                    {ledgerHeader.unitOfMeasure || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Stock No.:</span>{" "}
                    {ledgerHeader.stockNo || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Current Balance:</span>{" "}
                    {ledgerHeader.currentBalance ?? "—"}
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-3">
                <p className="text-[10px] font-semibold text-indigo-800 mb-1">
                  Filter &amp; Prepared By
                </p>
                <div className="text-[10px] text-indigo-900 space-y-1">
                  <div>
                    <span className="font-semibold">Date Filtered:</span>{" "}
                    {ledgerHeader.dateFrom
                      ? `${formatDisplayDate(ledgerHeader.dateFrom)}${
                          ledgerHeader.dateTo
                            ? " to " + formatDisplayDate(ledgerHeader.dateTo)
                            : ""
                        }`
                      : "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Prepared by:</span>{" "}
                    {ledgerHeader.signatoryName || "Inventory Admin"}
                  </div>
                  <div className="text-[9px] text-indigo-700 italic">
                    This is a preview only. Printed PDF follows the official RIS-style
                    format.
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-2xl bg-slate-50/70">
              <div className="flex flex-col items-center justify-center border-b border-slate-200 px-4 py-3 bg-white rounded-t-2xl">
                <p className="text-[9px] font-semibold text-slate-600">
                  Republic of the Philippines
                </p>
                <p className="text-[9px] font-semibold text-slate-700">
                  Department of Information and Communications Technology
                </p>
                <p className="text-[10px] font-semibold text-slate-800">
                  DICT REGIONAL OFFICE 02
                </p>
                <p className="mt-1 text-[11px] font-bold tracking-[0.18em] uppercase text-slate-900">
                  Complete Master Ledger Card
                </p>
              </div>

              <div className="px-3 pb-3 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-[10px] text-slate-700">
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <p>
                      <span className="font-semibold">Entity Name:</span>{" "}
                      {ledgerHeader.entityName || "DICT REGIONAL OFFICE 02"}
                    </p>
                    <p>
                      <span className="font-semibold">Item Description:</span>{" "}
                      {ledgerHeader.itemDescription || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Unit of Measurement:</span>{" "}
                      {ledgerHeader.unitOfMeasure || "—"}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <p>
                      <span className="font-semibold">Fund Cluster:</span>{" "}
                      {ledgerHeader.fundCluster || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Stock No.:</span>{" "}
                      {ledgerHeader.stockNo || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Date Filtered:</span>{" "}
                      {ledgerHeader.dateFrom
                        ? `${formatDisplayDate(ledgerHeader.dateFrom)}${
                            ledgerHeader.dateTo
                              ? " to " + formatDisplayDate(ledgerHeader.dateTo)
                              : ""
                          }`
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Ledger preview table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-800">
                      Ledger Entries
                    </p>
                    <p className="text-[9px] text-slate-500">
                      {ledgerRows.length} line(s)
                    </p>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-[9px] text-left">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Fund Source
                          </th>
                          <th
                            className="border border-slate-200 px-2 py-1 text-left"
                            colSpan={4}
                          >
                            Stock on Store
                          </th>
                          <th
                            className="border border-slate-200 px-2 py-1 text-left"
                            colSpan={4}
                          >
                            Receipt (Purchase Delivery)
                          </th>
                          <th
                            className="border border-slate-200 px-2 py-1 text-left"
                            colSpan={2}
                          >
                            Inventory Balance
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Remarks
                          </th>
                        </tr>
                        <tr>
                          <th className="border border-slate-200 px-2 py-1 text-left"></th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Stock No.
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Total Qty
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Unit
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Item Description
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Purchase Date
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Purchase Qty
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-right">
                            Unit Cost
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-right">
                            Total Unit Cost
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-right">
                            W.A. Cost
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-right">
                            Total W.A. Cost
                          </th>
                          <th className="border border-slate-200 px-2 py-1 text-left">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerRows.map((row, idx) => (
                          <tr
                            key={`ledger-row-preview-${idx}`}
                            className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                          >
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.fundSource || "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.stockNo || "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.totalQty !== undefined && row.totalQty !== null
                                ? row.totalQty
                                : "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.unit || "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.itemDescription || "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.purchaseDate
                                ? formatDisplayDate(row.purchaseDate)
                                : "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.purchaseQty !== undefined && row.purchaseQty !== null
                                ? row.purchaseQty
                                : "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-right">
                              {row.unitCost !== "" &&
                              row.unitCost !== null &&
                              row.unitCost !== undefined
                                ? formatCurrencyPHP(row.unitCost)
                                : "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-right">
                              {row.totalUnitCost !== "" &&
                              row.totalUnitCost !== null &&
                              row.totalUnitCost !== undefined
                                ? formatCurrencyPHP(row.totalUnitCost)
                                : "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-right">
                              {row.weightedAverageCost !== "" &&
                              row.weightedAverageCost !== null &&
                              row.weightedAverageCost !== undefined
                                ? formatCurrencyPHP(row.weightedAverageCost)
                                : "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-right">
                              {row.totalWeightedAverageCost !== "" &&
                              row.totalWeightedAverageCost !== null &&
                              row.totalWeightedAverageCost !== undefined
                                ? formatCurrencyPHP(row.totalWeightedAverageCost)
                                : "—"}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-left">
                              {row.remarks && row.remarks.trim().length
                                ? row.remarks
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signatory preview */}
                <div className="mt-4 flex justify-end">
                  <div className="text-left text-[9px] text-slate-700">
                    <p>Prepared / Certified True by:</p>
                    <div style={{ height: "24px" }} />
                    <p className="font-semibold uppercase border-t border-slate-700 inline-block px-6 pt-1">
                      {ledgerHeader.signatoryName || "Inventory Admin"}
                    </p>
                    <p className="mt-0.5 text-[9px]">Inventory Admin</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

export default Reportstableofficesupply;
