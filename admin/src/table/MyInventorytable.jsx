// src/pages/MyInventorytable.jsx

import React, { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import { AuthContext } from "../context/AuthContext";
import SettingsHeader from "../components/SettingsHeader";
import EmptyState from "../components/EmptyState";

/* -------------------- Small helpers -------------------- */
const fmtDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const coalesce = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && v !== "") ?? "";

/* -------------------- Status (match Reports style) -------------------- */
function norm(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function getStatusMeta(status) {
  const raw = norm(status);

  let label = status || "Unknown";
  let bg = "#f3f4f6"; // gray-100
  let color = "#374151"; // gray-700
  let border = "#e5e7eb"; // gray-200

  if (raw === "in stock" || raw === "instock") {
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
  } else if (raw === "pending") {
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
  }

  return { label, bg, color, border };
}

function StatusPill({ value }) {
  const { label, bg, color, border } = getStatusMeta(value);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold border shadow-sm"
      style={{ backgroundColor: bg, color, borderColor: border }}
      title={label}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

/* -------------------- Reusable header cell -------------------- */
function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-[11px] sm:text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-100 bg-slate-50/80 text-left align-middle"
    >
      {title}
    </th>
  );
}

function StatCard({ label, value, caption, tone, loading = false }) {
  const toneMap = {
    sky: {
      bg: "bg-sky-50",
      border: "border-sky-100",
      text: "text-sky-700",
      dot: "bg-sky-500",
    },
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
    slate: {
      bg: "bg-slate-50",
      border: "border-slate-100",
      text: "text-slate-700",
      dot: "bg-slate-500",
    },
  };

  const styles = toneMap[tone] || toneMap.slate;

  return (
    <div
      className={`rounded-2xl border ${styles.border} ${styles.bg} px-4 py-3 shadow-sm`}
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${styles.text}`}>
        {loading ? "Loading..." : value}
      </div>
      {caption ? (
        <div className="mt-1 text-[11px] text-gray-600">{caption}</div>
      ) : null}
    </div>
  );
}

/* -------------------- Row -------------------- */
function TableRow({ data, isDistribution, menuOpen, onToggleMenu }) {
  const itemName = coalesce(data.itemName, data.supplyName) || "—";
  const classification = coalesce(data.classification, data.supplyType) || "—";
  const quantity =
    coalesce(data.qty, data.quantity) !== ""
      ? coalesce(data.qty, data.quantity)
      : "—";
  const unit = coalesce(data.unitofmeasure, data.unit) || "—";
  const project = coalesce(data.project, data.office) || "—";

  const rowDate = (() => {
    if (isDistribution) {
      return fmtDate(coalesce(data.date_requested, data.createdAt, data.updatedAt));
    }

    const s = getStatusMeta(data.status).label;
    if (s === "Transferred") {
      return fmtDate(coalesce(data.date_received, data.date_released, data.updatedAt));
    }
    if (s === "For transfer") {
      return fmtDate(coalesce(data.date_requested, data.updatedAt));
    }
    if (s === "Issued") {
      return fmtDate(coalesce(data.date_issued, data.createdAt));
    }
    if (s === "For disposal" || s === "Disposed") {
      return fmtDate(coalesce(data.date_requested, data.updatedAt, data.createdAt));
    }
    return fmtDate(coalesce(data.updatedAt, data.createdAt));
  })();

  const detailRoute = !isDistribution
    ? data._inventoryType === "equipment"
      ? `/checkitem/${data._id}`
      : data._inventoryType === "furniture"
      ? `/checkitemfurniture/${data._id}`
      : data._inventoryType === "ict"
      ? `/checkitemict/${data._id}`
      : null
    : null;
  const ptrRoute = `/checkform/${data._id}`;

  const statusValue = isDistribution
    ? coalesce(data.distributionStatus, data.status)
    : data.status;
  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td
        className="px-4 py-3 text-left align-middle border-b border-gray-50 text-xs sm:text-sm !whitespace-normal break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {itemName}
      </td>
      <td
        className="px-4 py-3 text-left align-middle border-b border-gray-50 text-xs sm:text-sm !whitespace-normal break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {classification}
      </td>
      <td
        className="px-4 py-3 text-left align-middle border-b border-gray-50 text-xs sm:text-sm !whitespace-normal break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {project}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-left align-middle border-b border-gray-50 text-xs sm:text-sm">
        {quantity !== "" ? quantity : "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-left align-middle border-b border-gray-50 text-xs sm:text-sm">
        {unit}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-left align-middle border-b border-gray-50 text-xs sm:text-sm">
        {rowDate}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-left align-middle border-b border-gray-50">
        <StatusPill value={statusValue} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-left align-middle border-b border-gray-50">
        <div className="flex justify-start">
          <div className="relative" data-menu-root>
            <button
              type="button"
              onClick={onToggleMenu}
              className="manage-button"
            >
              Manage
              <svg
                className="h-3 w-3"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
              >
                <path d="M6 8l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full z-50 mb-2 w-36 rounded-md border border-gray-200 bg-white shadow-lg">
                {detailRoute && (
                  <Link
                    to={detailRoute}
                    className="block px-3 py-2 text-[10px] sm:text-xs text-gray-700 hover:bg-gray-50"
                  >
                    View item
                  </Link>
                )}
                <Link
                  to={ptrRoute}
                  className="block px-3 py-2 text-[10px] sm:text-xs text-gray-700 hover:bg-gray-50"
                >
                  {isDistribution
                    ? "View STR"
                    : String(data.asset_type || "").toUpperCase() === "SE"
                    ? "View ICS"
                    : "View PTR"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ItemCard({ data, isDistribution, menuOpen, onToggleMenu }) {
  const itemName = coalesce(data.itemName, data.supplyName) || "—";
  const classification = coalesce(data.classification, data.supplyType) || "—";
  const quantity =
    coalesce(data.qty, data.quantity) !== ""
      ? coalesce(data.qty, data.quantity)
      : "—";
  const unit = coalesce(data.unitofmeasure, data.unit) || "—";
  const project = coalesce(data.project, data.office) || "—";

  const rowDate = (() => {
    if (isDistribution) {
      return fmtDate(coalesce(data.date_requested, data.createdAt, data.updatedAt));
    }

    const s = getStatusMeta(data.status).label;
    if (s === "Transferred") {
      return fmtDate(coalesce(data.date_received, data.date_released, data.updatedAt));
    }
    if (s === "For transfer") {
      return fmtDate(coalesce(data.date_requested, data.updatedAt));
    }
    if (s === "Issued") {
      return fmtDate(coalesce(data.date_issued, data.createdAt));
    }
    if (s === "For disposal" || s === "Disposed") {
      return fmtDate(coalesce(data.date_requested, data.updatedAt, data.createdAt));
    }
    return fmtDate(coalesce(data.updatedAt, data.createdAt));
  })();

  const detailRoute = !isDistribution
    ? data._inventoryType === "equipment"
      ? `/checkitem/${data._id}`
      : data._inventoryType === "furniture"
      ? `/checkitemfurniture/${data._id}`
      : data._inventoryType === "ict"
      ? `/checkitemict/${data._id}`
      : null
    : null;
  const ptrRoute = `/checkform/${data._id}`;
  const statusValue = isDistribution
    ? coalesce(data.distributionStatus, data.status)
    : data.status;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{itemName}</h3>
          <p className="text-[11px] text-gray-500">{classification}</p>
        </div>
        <StatusPill value={statusValue} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-600">
        <span className="rounded-full bg-gray-50 px-2.5 py-1">
          {project}
        </span>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-600">
          Qty: {quantity} {unit}
        </span>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">
          {rowDate}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative" data-menu-root>
          <button
            type="button"
            onClick={onToggleMenu}
            className="manage-button px-3 py-2"
          >
            Manage
            <svg
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
            >
              <path d="M6 8l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 bottom-full z-50 mb-2 w-36 rounded-md border border-gray-200 bg-white shadow-lg">
              {detailRoute && (
                <Link
                  to={detailRoute}
                  className="block px-3 py-2 text-[10px] text-gray-700 hover:bg-gray-50"
                >
                  View item
                </Link>
              )}
              <Link
                to={ptrRoute}
                className="block px-3 py-2 text-[10px] text-gray-700 hover:bg-gray-50"
              >
                {isDistribution
                  ? "View STR"
                  : String(data.asset_type || "").toUpperCase() === "SE"
                  ? "View ICS"
                  : "View PTR"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, idx) => (
        <td key={idx} className="px-4 py-3 text-left align-middle border-b border-gray-50">
          <div className="h-3 w-full rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="h-4 w-40 rounded bg-gray-100" />
      <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-gray-100" />
        <div className="h-6 w-24 rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 h-8 w-24 rounded bg-gray-100" />
    </div>
  );
}

/* Helper to get numeric sort timestamp (for latest-first) */
const getSortTimestamp = (r, isDistribution) => {
  let src;
  if (isDistribution) {
    src = coalesce(r.date_requested, r.createdAt, r.updatedAt);
  } else {
    const s = getStatusMeta(r.status).label;
    if (s === "Transferred") {
      src = coalesce(r.date_received, r.date_released, r.updatedAt);
    } else if (s === "For transfer") {
      src = coalesce(r.date_requested, r.updatedAt);
    } else if (s === "Issued") {
      src = coalesce(r.date_issued, r.createdAt);
    } else if (s === "For disposal" || s === "Disposed") {
      src = coalesce(r.date_requested, r.updatedAt, r.createdAt);
    } else {
      src = coalesce(r.updatedAt, r.createdAt);
    }
  }
  const t = new Date(src).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/* -------------------- Main -------------------- */
function MyInventorytable() {
  const [inventoryRows, setInventoryRows] = useState([]); // properties
  const [supplyRows, setSupplyRows] = useState([]); // distributions exploded
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewInventory, setViewInventory] = useState(true); // true = properties, false = supplies
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("equipment");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openMenuKind, setOpenMenuKind] = useState(null);

  const { user } = useContext(AuthContext);

  const breadcrumbItems = useMemo(
    () => [
      { label: "Office Dashboard", to: "/officedashboard" },
      { label: "My Inventory" },
    ],
    []
  );

  const meSet = useMemo(() => {
    const u = user?.data || {};
    const vals = [
      u._id,
      u.username,
      u.email,
      u.fullname,
      u.name,
      u.displayName,
    ]
      .filter(Boolean)
      .map((v) => String(v));
    return new Set(vals);
  }, [user]);

  const isMe = (v) => {
    if (!v) return false;
    return meSet.has(String(v));
  };

  /* ---------- Load data (show ALL linked to account: issued_to, transfered_to, current_holder) ---------- */
  useEffect(() => {
    if (!user || !user.data) {
      setLoading(false);
      return;
    }

    const ac = new AbortController();

    const fetchJson = async (url) => {
      const r = await fetch(url, {
        signal: ac.signal,
        credentials: "include",
        silentStatuses: [403, 404],
        suppressErrorToast: true,
      });
      if (r.status === 403 || r.status === 404) return [];
      if (!r.ok) throw new Error(`Failed to fetch ${url}`);
      return r.json();
    };

    const load = async () => {
      try {
        setError(null);
        setLoading(true);

        // INVENTORY (properties)
        const invSources = [
          { url: `${BASE_URL}/inventoryofficeequipment/inventory`, type: "equipment" },
          {
            url: `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
            type: "furniture",
          },
          { url: `${BASE_URL}/inventoryofficeICTequipment/inventory`, type: "ict" },
        ];

        // SUPPLIES (distributions)
        const distUrl = `${BASE_URL}/distribute/distributions`;

        const invResponses = await Promise.all([
          ...invSources.map((src) => fetchJson(src.url)),
          fetchJson(distUrl),
        ]);
        const distributions = invResponses[invSources.length];

        const invAll = invSources.flatMap((src, idx) => {
          const list = invResponses[idx] || [];
          return Array.isArray(list)
            ? list.map((item) => ({ ...item, _inventoryType: src.type }))
            : [];
        });

        // LINKED INVENTORY RULE:
        const invLinked = invAll.filter((item) => {
          const candidates = [
            item?.issued_to,
            item?.issued_to_is,
            item?.current_holder,
            item?.transfered_to,
            item?.transfered_to_is,
            item?.transferred_to,
            item?.transferred_to_is,
            item?.stored_to,
            item?.stored_to_is,
          ];
          return candidates.some(isMe);
        });

        // SUPPLIES LINKED RULE:
        const distLinkedExpanded = (distributions || [])
          .filter((dist) => {
            const candidates = [
              dist?.distributedto_is,
              dist?.distributed_to_is,
              dist?.distributedto,
              dist?.distributed_to,
            ];
            return candidates.some(isMe);
          })
          .flatMap((dist) => {
            if (Array.isArray(dist.items) && dist.items.length) {
              return dist.items.map((itm) => ({
                ...dist,
                itemName: coalesce(itm.itemName, dist.itemName),
                classification: coalesce(itm.classification, dist.classification),
                quantity: coalesce(itm.quantity, dist.quantity, dist.qty),
                unitofmeasure: coalesce(
                  itm.unitofmeasure,
                  itm.unit,
                  dist.unitofmeasure,
                  dist.unit
                ),
                returnId: coalesce(itm.returnId, dist.returnId),
              }));
            }
            return {
              ...dist,
              itemName: dist.itemName || "—",
              classification: dist.classification || "—",
              quantity: dist.quantity || dist.qty || 0,
              unitofmeasure: dist.unitofmeasure || dist.unit || "—",
            };
          });

        setInventoryRows(invLinked);
        setSupplyRows(distLinkedExpanded);
        setCurrentPage(1);
      } catch (e) {
        if (e?.name !== "AbortError") {
          console.error(e);
          setError(e.message || "Failed to load data.");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => ac.abort();
  }, [user, meSet]);

  /* ---------- Source to show ---------- */
  const isDistributionView = !viewInventory;
  const rows = viewInventory ? inventoryRows : supplyRows;

  const inventoryCounts = useMemo(() => {
    const base = { equipment: 0, furniture: 0, ict: 0 };
    inventoryRows.forEach((row) => {
      if (row?._inventoryType && base[row._inventoryType] !== undefined) {
        base[row._inventoryType] += 1;
      }
    });
    return base;
  }, [inventoryRows]);

  const totalLinked = inventoryRows.length + supplyRows.length;
  const isInitialLoading = loading && inventoryRows.length === 0 && supplyRows.length === 0;

  /* ---------- Search, sort (latest first) & filter ---------- */
  const needle = searchQuery.trim().toLowerCase();

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aTime = getSortTimestamp(a, isDistributionView);
      const bTime = getSortTimestamp(b, isDistributionView);
      return bTime - aTime;
    });
  }, [rows, isDistributionView]);

  const filtered = useMemo(() => {
    if (!needle) return sortedRows;

    return sortedRows.filter((r) => {
      const fields = [
        (coalesce(r.itemName, r.supplyName) || "").toLowerCase(),
        (coalesce(r.classification, r.supplyType) || "").toLowerCase(),
        (coalesce(r.project, r.office) || "").toLowerCase(),
        (coalesce(r.status, r.distributionStatus) || "").toLowerCase(),
        (coalesce(r.unitofmeasure, r.unit) || "").toLowerCase(),
        String(coalesce(r.qty, r.quantity, "")).toLowerCase(),
        fmtDate(
          coalesce(
            r.date_requested,
            r.date_issued,
            r.date_released,
            r.date_received,
            r.updatedAt,
            r.createdAt
          )
        ).toLowerCase(),
      ];
      return fields.some((f) => f && f.includes(needle));
    });
  }, [sortedRows, needle]);

  const filteredByType = useMemo(() => {
    if (!viewInventory) return filtered;
    if (typeFilter === "all") return filtered;
    return filtered.filter((row) => row._inventoryType === typeFilter);
  }, [filtered, viewInventory, typeFilter]);

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(filteredByType.length / itemsPerPage));
  const last = currentPage * itemsPerPage;
  const first = last - itemsPerPage;
  const pageRows = filteredByType.slice(first, last);

  const paginate = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  };

  /* ---------- Handlers ---------- */
  const onSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  useEffect(() => {
    const handler = (event) => {
      const target = event.target;
      if (!target || !(target instanceof Element)) return;
      const inMenu = target.closest("[data-menu-root]");
      if (!inMenu) {
        setOpenMenuId(null);
        setOpenMenuKind(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  /* ---------- Guards & states ---------- */
  if (!user || !user.data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
        <section className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm text-center">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Please log in
          </h2>
          <p className="text-sm text-gray-600">
            Sign in to view all properties and supplies linked to your account.
          </p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
        <section className="w-full max-w-lg rounded-2xl border border-red-100 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-red-700">Error: {error}</p>
        </section>
      </div>
    );
  }

  const colCount = 8;
  const inventoryCaption = isInitialLoading
    ? "Loading linked asset records..."
    : `${inventoryRows.length} asset record${
        inventoryRows.length === 1 ? "" : "s"
      } linked to your account`;
  const suppliesCaption = isInitialLoading
    ? "Loading linked supply records..."
    : `${supplyRows.length} supply record${
        supplyRows.length === 1 ? "" : "s"
      } linked to your account`;
  const viewBadgeClass = viewInventory
    ? "bg-sky-50 text-sky-700"
    : "bg-amber-50 text-amber-700";
  const viewBadgeDot = viewInventory ? "bg-sky-500" : "bg-amber-500";
  const inventoryTitle = viewInventory
    ? typeFilter === "equipment"
      ? "Equipment"
      : typeFilter === "furniture"
      ? "Furniture"
      : typeFilter === "ict"
      ? "ICT"
      : "Inventory"
    : "Supplies";
  const pageTitle = `My ${inventoryTitle}`;
  const emptyLabel = viewInventory ? "assets" : "supplies";
  const emptyTitle = `No ${emptyLabel} records yet`;
  const emptySubtitle = viewInventory
    ? "When items are issued or transferred to you, they will appear here."
    : "Distributed office supplies assigned to you will appear here.";
  const emptyHint = "Try adjusting filters or clearing search.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <section className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-5">
        <SettingsHeader
          crumbs={breadcrumbItems}
          title={pageTitle}
          subtitle="Shows all records linked to your account (issued to you, transferred to you, or you are the current holder)."
          rightSlot={
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Linked to your account
            </div>
          }
        />

        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/80 p-4 sm:p-5 shadow-sm">
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-sky-100/60 blur-3xl" />

          <div className="flex flex-wrap items-start justify-start gap-3">
            <div className="w-full flex flex-col gap-3">
              <div className="table-filters flex-col sm:flex-row sm:items-center lg:flex-nowrap lg:gap-4 lg:rounded-full lg:border lg:border-slate-200/70 lg:bg-white/95 lg:px-4 lg:py-2 lg:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                {/* Search */}
                <div className="search-shell w-full sm:w-60 md:w-72 lg:flex-[1_1_320px] lg:max-w-none lg:min-w-[220px] lg:border-0 lg:bg-transparent lg:shadow-none lg:rounded-none">
                  <span className="search-icon lg:bg-transparent lg:text-slate-400">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search item, classification, project, status..."
                    value={searchQuery}
                    onChange={onSearch}
                    className="search-input lg:text-sm"
                  />
                </div>

                {/* View toggle */}
                <div className="w-full sm:hidden">
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Filter view
                  </label>
                  <select
                    value={viewInventory ? typeFilter : "supplies"}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "supplies") {
                        setViewInventory(false);
                      } else {
                        setViewInventory(true);
                        setTypeFilter(next);
                      }
                      setCurrentPage(1);
                    }}
                    className="table-select w-full"
                  >
                    <option value="equipment">
                      Equipment
                      {(inventoryCounts.equipment || 0) > 0
                        ? ` (${inventoryCounts.equipment})`
                        : ""}
                    </option>
                    <option value="furniture">
                      Furniture
                      {(inventoryCounts.furniture || 0) > 0
                        ? ` (${inventoryCounts.furniture})`
                        : ""}
                    </option>
                    <option value="ict">
                      ICT
                      {(inventoryCounts.ict || 0) > 0
                        ? ` (${inventoryCounts.ict})`
                        : ""}
                    </option>
                    <option value="supplies">
                      Supplies{(supplyRows.length || 0) > 0 ? ` (${supplyRows.length})` : ""}
                    </option>
                  </select>
                </div>

                <span className="hidden lg:block h-7 w-px bg-slate-200/80" aria-hidden="true" />

                <div className="hidden sm:inline-flex rounded-full bg-slate-100 p-1 text-[10px] sm:text-xs lg:gap-1.5 lg:bg-transparent lg:p-0">
                  {["equipment", "furniture", "ict", "supplies"].map((key) => {
                    const isSupplies = key === "supplies";
                    const active =
                      isSupplies ? !viewInventory : viewInventory && typeFilter === key;
                    const label =
                      key === "equipment"
                        ? "Equipment"
                        : key === "furniture"
                        ? "Furniture"
                        : key === "ict"
                        ? "ICT"
                        : "Supplies";
                    const count = isSupplies
                      ? supplyRows.length
                      : inventoryCounts[key] || 0;
                    const activeClass = active
                      ? isSupplies
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-sky-600 text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-800";

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (isSupplies) {
                            setViewInventory(false);
                          } else {
                            setViewInventory(true);
                            setTypeFilter(key);
                          }
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-full font-semibold transition ${activeClass}`}
                      >
                        {label}
                        {!isInitialLoading && count > 0 ? (
                          <span
                            className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              active
                                ? "bg-white/20 text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

              <div className="hidden lg:flex ml-auto text-[11px] text-slate-500">
                  {isInitialLoading ? (
                    <span className="font-semibold text-slate-800">Loading records...</span>
                  ) : (
                    <>
                      Showing{" "}
                      <span className="mx-1 font-semibold text-slate-800">
                        {pageRows.length}
                      </span>
                      of{" "}
                      <span className="ml-1 font-semibold text-slate-800">
                        {filteredByType.length}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Total linked"
              value={totalLinked}
              caption="Assets + supply distributions"
              tone="slate"
              loading={isInitialLoading}
            />
            <StatCard
              label="Assets"
              value={inventoryRows.length}
              caption={inventoryCaption}
              tone={viewInventory ? "sky" : "slate"}
              loading={isInitialLoading}
            />
            <StatCard
              label="Supplies"
              value={supplyRows.length}
              caption={suppliesCaption}
              tone={!viewInventory ? "amber" : "slate"}
              loading={isInitialLoading}
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="flex-1">
          <div className="w-full rounded-2xl bg-white/90 backdrop-blur border border-slate-100 px-3 sm:px-4 md:px-6 pt-3 md:pt-5 pb-4 flex flex-col min-h-[420px] shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-slate-500">
              <span>
                {isInitialLoading ? (
                  <span className="font-semibold text-gray-700">
                    Loading records linked to your account...
                  </span>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-gray-700">
                      {pageRows.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gray-700">
                      {filteredByType.length}
                    </span>{" "}
                    record{filteredByType.length === 1 ? "" : "s"} linked to your account
                  </>
                )}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[9px] font-medium ${viewBadgeClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${viewBadgeDot}`} />
                {viewInventory
                  ? `${
                      typeFilter === "equipment"
                        ? "Equipment"
                        : typeFilter === "furniture"
                        ? "Furniture"
                        : "ICT"
                    } (PTR)`
                  : "Distributed office supplies (STR)"}
              </span>
            </div>

            <div className="table-shell table-compact table-flush relative flex-1 overflow-visible">
              <div className="grid gap-4 p-4 sm:p-5 lg:hidden">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                ) : pageRows.length === 0 ? (
                  <EmptyState
                    title={emptyTitle}
                    subtitle={emptySubtitle}
                    hint={emptyHint}
                  />
                ) : (
                  pageRows.map((row, idx) => {
                    const baseId = row._id || `${row.itemName || "row"}-${idx}`;
                    const rowId = viewInventory
                      ? baseId
                      : `${baseId}-${row.returnId || row.itemName || idx}`;
                    return (
                      <ItemCard
                        key={rowId}
                        data={row}
                        isDistribution={!viewInventory}
                        menuOpen={openMenuId === rowId && openMenuKind === "card"}
                        onToggleMenu={() => {
                          const isOpen = openMenuId === rowId && openMenuKind === "card";
                          setOpenMenuId(isOpen ? null : rowId);
                          setOpenMenuKind(isOpen ? null : "card");
                        }}
                      />
                    );
                  })
                )}
              </div>

              <div className="overflow-x-auto overflow-y-visible max-h-[60vh] hidden lg:block">
                {loading ? (
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "6%" }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="h-10 text-gray-800">
                        <TableHeader title="Item Description" />
                        <TableHeader title="Classification" />
                        <TableHeader title="Project" />
                        <TableHeader title="Quantity" />
                        <TableHeader title="Unit" />
                        <TableHeader title="Date" />
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
                  <table className="w-full table-fixed text-left">
                    <colgroup>
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "6%" }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="h-10 text-gray-800">
                        <TableHeader title="Item Description" />
                        <TableHeader title="Classification" />
                        <TableHeader title="Project" />
                        <TableHeader title="Quantity" />
                        <TableHeader title="Unit" />
                        <TableHeader title="Date" />
                        <TableHeader title="Status" />
                        <TableHeader title="Manage" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} className="px-4 py-10">
                            <EmptyState
                              title={emptyTitle}
                              subtitle={emptySubtitle}
                              hint={emptyHint}
                            />
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((row, idx) => {
                          const baseId = row._id || `${row.itemName || "row"}-${idx}`;
                          const rowId = viewInventory
                            ? baseId
                            : `${baseId}-${row.returnId || row.itemName || idx}`;
                          return (
                            <TableRow
                              key={rowId}
                              data={row}
                              isDistribution={!viewInventory}
                              menuOpen={openMenuId === rowId && openMenuKind === "row"}
                              onToggleMenu={() => {
                                const isOpen = openMenuId === rowId && openMenuKind === "row";
                                setOpenMenuId(isOpen ? null : rowId);
                                setOpenMenuKind(isOpen ? null : "row");
                              }}
                            />
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Pagination */}
            {filteredByType.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between text-[10px] sm:text-xs">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={
                    "rounded-md border px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 " +
                    (currentPage === 1 ? "cursor-not-allowed opacity-40" : "")
                  }
                >
                  Previous
                </button>
                <span className="text-gray-500">
                  Page{" "}
                  <span className="font-semibold text-gray-700">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-700">
                    {totalPages}
                  </span>
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={
                    "rounded-md border px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 " +
                    (currentPage === totalPages
                      ? "cursor-not-allowed opacity-40"
                      : "")
                  }
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default MyInventorytable;
