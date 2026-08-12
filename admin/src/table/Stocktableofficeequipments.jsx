// src/components/Stocktableofficeequipments.jsx
import React, { useState, useEffect, useMemo, useContext } from "react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";
import { AuthContext } from "../context/AuthContext";
import EmptyState from "../components/EmptyState";

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

/* ---------- Status Pill (aligned with global style, now includes Disposal) ---------- */
function getStatusLabel(status) {
  const raw = (status || "").toLowerCase().trim();
  if (raw === "instock" || raw === "in stock") return "In stock";
  if (raw === "issued") return "Issued";
  if (raw === "transferred") return "Transferred";
  if (raw === "for transfer") return "For transfer";
  if (raw === "for issue") return "For issuance";
  if (raw === "for return to inventory") return "For return to inventory";
  if (raw === "pending") return "Pending";
  if (raw === "for disposal") return "For disposal";
  if (raw === "disposed") return "Disposed";
  return status || "Unknown";
}

function StatusPill({ status }) {
  const raw = (status || "").toLowerCase().trim();

  let label = getStatusLabel(status);
  let bg = "#f3f4f6";
  let color = "#374151";
  let border = "#e5e7eb";

  if (raw === "instock" || raw === "in stock") {
    label = "In stock";
    bg = "#dcfce7";
    color = "#166534";
    border = "#bbf7d0";
  } else if (raw === "issued") {
    label = "Issued";
    bg = "#fee2e2";
    color = "#b91c1c";
    border = "#fecaca";
  } else if (raw === "transferred") {
    label = "Transferred";
    bg = "#dbeafe";
    color = "#1d4ed8";
    border = "#bfdbfe";
  } else if (raw === "for transfer") {
    label = "For transfer";
    bg = "#fef3c7";
    color = "#92400e";
    border = "#fde68a";
  } else if (raw === "for issue") {
    label = "For issuance";
    bg = "#e0f2fe";
    color = "#0369a1";
    border = "#bae6fd";
  } else if (raw === "for return to inventory") {
    label = "For return to inventory";
    bg = "#ecfeff";
    color = "#0e7490";
    border = "#cffafe";
  } else if (raw === "pending") {
    label = "Pending";
    bg = "#e5e7eb";
    color = "#111827";
    border = "#d1d5db";
  } else if (raw === "for disposal") {
    label = "For disposal";
    bg = "#ffe4e6"; // rose-100
    color = "#be123c"; // rose-700
    border = "#fecdd3"; // rose-200
  } else if (raw === "disposed") {
    label = "Disposed";
    bg = "#fee2e2"; // red-100
    color = "#b91c1c"; // red-700
    border = "#fecaca"; // red-200
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] md:text-[11px] font-semibold border"
      style={{ backgroundColor: bg, color, borderColor: border }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ProjectBadge({ project }) {
  const label = project || "—";
  return (
    <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[9px] md:text-[11px] font-semibold text-indigo-700">
      {label}
    </span>
  );
}

function ItemCard({ data, canManageExtras }) {
  const status = data.status || "";
  const unitCost =
    data.unit_cost != null
      ? Number(data.unit_cost).toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
        })
      : "—";

  const showTransfer =
    canManageExtras && (status === "Transferred" || status === "For Transfer");
  const showDisposal =
    canManageExtras && (status === "For Disposal" || status === "Disposed");
  const showIssuance = canManageExtras && status === "For Issue";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">
            Asset ID {data.asset_id || data.property_no || "—"}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mt-1">
            {data.itemName || "—"}
          </h3>
          <p className="text-[11px] text-gray-500">{data.classification || "Unclassified"}</p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(data.asset_type || data.asset_id) && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            {data.asset_type || "—"}
            {data.asset_id ? ` • ${data.asset_id}` : ""}
          </span>
        )}
        <ProjectBadge project={data.project} />
        {data.batch_no && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
            Batch: {data.batch_no}
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
          Qty: {data.qty ?? "—"} {data.unitofmeasure || ""}
        </span>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600">
          {unitCost}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/checkitem/${data._id}`}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white"
        >
          View Item
        </Link>
        {showTransfer && (
          <Link
            to={`/checkform/${data._id}`}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-semibold text-indigo-700"
          >
            {String(data.asset_type || "").toUpperCase() === "SE" ? "View ICS" : "View PTR"}
          </Link>
        )}
        {showDisposal && (
          <Link
            to={`/checkform/${data._id}`}
            className="inline-flex items-center justify-center rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700"
          >
            View Disposal
          </Link>
        )}
        {showIssuance && (
          <Link
            to={`/checkform/${data._id}`}
            className="inline-flex items-center justify-center rounded-lg bg-sky-50 px-3 py-2 text-[10px] font-semibold text-sky-700"
          >
            View Issuance
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------- Row component (now also manages disposal) ---------- */
function TableRow({ data, canManageExtras, menuOpen, onToggleMenu }) {
  const menuRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const [menuPlacement, setMenuPlacement] = useState("down");

  const status = data.status || "";
  const menuEnabled =
    status === "Transferred" ||
    status === "For Transfer" ||
    status === "Issued" ||
    status === "For Issue" ||
    status === "In Stock" ||
    status === "Instock" ||
    status === "For Return to Inventory" ||
    status === "For Disposal" ||
    status === "Disposed";

  const unitCost =
    data.unit_cost != null
      ? Number(data.unit_cost).toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
        })
      : "—";

  const rawStatus = status.toLowerCase().trim();

  useEffect(() => {
    if (!menuOpen) return undefined;

    const updatePlacement = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect?.();
      const menuRect = menuRef.current?.getBoundingClientRect?.();
      const menuHeight = menuRect?.height ?? 180;
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;
      const spaceBelow = viewportHeight - (triggerRect?.bottom ?? 0);
      const spaceAbove = triggerRect?.top ?? 0;
      const nextPlacement =
        spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow ? "up" : "down";
      setMenuPlacement(nextPlacement);
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [menuOpen]);

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs font-medium text-left border-b text-gray-800">
        {data.asset_id || data.property_no || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-left border-b text-gray-900">
        {data.itemName || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {data.classification || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {data.batch_no || "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-left border-b text-gray-800">
        {data.qty ?? "—"}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {unitCost}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        <ProjectBadge project={data.project} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-left border-b">
        <StatusPill status={data.status} />
      </td>

      {/* Manage / View / Disposal */}
      <td className="px-4 py-3 whitespace-nowrap text-[10px] md:text-xs font-medium text-left border-b relative">
        <button
          ref={triggerRef}
          onClick={() => {
            if (menuEnabled) onToggleMenu?.();
          }}
          className={`inline-flex items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] md:text-xs font-semibold shadow-sm transition-all ${
            menuEnabled
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          disabled={!menuEnabled}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          Manage
          <span className="text-[9px]">▾</span>
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            className={`absolute right-0 ${
              menuPlacement === "up" ? "bottom-full mb-2" : "top-full mt-2"
            } w-56 rounded-xl border border-gray-200 bg-white shadow-xl z-20 overflow-hidden`}
          >
            {/* Always allow View Item so user can issue / transfer / disposal inside Checkitem */}
            <Link
              to={`/checkitem/${data._id}`}
              className="flex items-center gap-2 px-4 py-2 text-[10px] md:text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              View Item
            </Link>

            {/* Transfer ITR (existing behaviour) */}
            {(status === "Transferred" || status === "For Transfer") && canManageExtras && (
              <Link
                to={`/checkform/${data._id}`}
                className="flex items-center gap-2 px-4 py-2 text-[10px] md:text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border-t border-gray-100"
              >
                {String(data.asset_type || "").toUpperCase() === "SE" ? "View ICS" : "View PTR"}
              </Link>
            )}

            {/* Disposal management: use same checkform route for approvals / history */}
            {(status === "For Disposal" || status === "Disposed") && canManageExtras && (
              <Link
                to={`/checkform/${data._id}`}
                className="flex items-center gap-2 px-4 py-2 text-[10px] md:text-xs font-semibold text-rose-600 hover:bg-rose-50 border-t border-gray-100"
              >
                View Disposal
              </Link>
            )}

            {status === "For Return to Inventory" && canManageExtras && (
              <Link
                to={`/checkform/${data._id}`}
                className="flex items-center gap-2 px-4 py-2 text-[10px] md:text-xs font-semibold text-teal-700 hover:bg-teal-50 border-t border-gray-100"
              >
                View Return
              </Link>
            )}

            {status === "For Issue" && canManageExtras && (
              <Link
                to={`/checkform/${data._id}`}
                className="flex items-center gap-2 px-4 py-2 text-[10px] md:text-xs font-semibold text-sky-700 hover:bg-sky-50 border-t border-gray-100"
              >
                View Issuance
              </Link>
            )}

            {/* For Issued items, there is no ITR yet (disposal can still be managed inside Checkitem) */}
            {status === "Issued" && canManageExtras && (
              <div className="px-4 py-3 text-[10px] md:text-[11px] text-slate-500 leading-relaxed bg-slate-50 border-t border-gray-100">
                No transfer document yet. Use View Item to transfer or dispose.
              </div>
            )}

            {/* For In Stock / Instock without extra menu items, close with bottom-rounded class */}
            {rawStatus === "in stock" || rawStatus === "instock" ? (
              <div className="px-4 py-3 text-[10px] md:text-[11px] text-slate-500 leading-relaxed bg-slate-50 border-t border-gray-100">
                {canManageExtras
                  ? "Use View Item to issue, transfer, or set for disposal."
                  : "View-only access for this item."}
              </div>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 9 }).map((_, idx) => (
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
      <div className="mt-4 h-8 w-24 rounded bg-gray-100" />
    </div>
  );
}

/* ---------- Main component ---------- */
function Stocktableofficeequipments() {
  const { user } = useContext(AuthContext);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [assetTypeFilter, setAssetTypeFilter] = useState("All");
  const [openMenuId, setOpenMenuId] = useState(null);

  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  /* Fetch once */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(itemsPerPage));
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "All") params.set("status", statusFilter);
        if (assetTypeFilter !== "All") params.set("asset_type", assetTypeFilter);

        const res = await fetch(
          `${BASE_URL}/inventoryofficeequipment/inventory?${params.toString()}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch office equipment inventory.");
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          const arr = data;
          setInventory(arr.reverse());
          setTotalCount(arr.length);
        } else {
          setInventory(Array.isArray(data?.data) ? data.data : []);
          setTotalCount(Number(data?.total || 0));
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, itemsPerPage, search, statusFilter, assetTypeFilter]);

  const role = (user?.data?._role || user?.data?.role || "").toLowerCase().trim();
  const isEmployee = role === "employee";
  const identifiers = useMemo(
    () =>
      [user?.data?._id, user?.data?.id, user?.data?.username, user?.data?.email]
        .filter(Boolean)
        .map(String),
    [user]
  );

  const isInStock = (status) => {
    const raw = String(status || "").toLowerCase().trim();
    return raw === "instock" || raw === "in stock";
  };

  const isUserInvolved = (item) => {
    if (!identifiers.length) return false;
    const fields = [
      item?.current_holder,
      item?.current_holder_id,
      item?.current_holder_is,
      item?.issued_to,
      item?.issued_to_id,
      item?.issued_to_is,
      item?.transfered_to,
      item?.transfered_to_id,
      item?.transfered_to_is,
      item?.transferred_to,
      item?.transferred_to_id,
      item?.transferred_to_is,
      item?.stored_to,
      item?.stored_to_id,
      item?.stored_to_is,
    ].filter(Boolean);
    return fields.some((val) => identifiers.includes(String(val)));
  };

  const scopedInventory = useMemo(() => {
    if (!isEmployee) return inventory;
    return inventory.filter((item) => isInStock(item?.status) || isUserInvolved(item));
  }, [inventory, isEmployee, identifiers]);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageItems = scopedInventory;

  const handleStatusSelect = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  /* ---------- Render ---------- */

  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error.message || "Failed to load office equipment inventory."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-8 pb-10">
        {/* Breadcrumbs (same design) */}
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Office Dashboard", to: "/officedashboard" },
            { label: "Inventory" },
            { label: "Office Equipment" },
          ]}
        />

        {/* HEADER / CONTROLS */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-light text-slate-900">
              Office <span className="font-semibold">Equipment</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage equipment inventory, status, and assignments.
            </p>
          </div>

          <div className="filter-card mb-4">
            <div className="filter-card-content">
              <div className="table-filters flex-col sm:flex-row sm:items-center xl:hidden">
                <div className="search-shell w-full sm:w-60 md:w-72">
                  <span className="search-icon">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search item, property no., project, status..."
                    value={search}
                    onChange={handleSearchChange}
                    className="search-input"
                  />
                </div>

                <div className="w-full sm:flex-1">
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Asset type
                  </label>
                  <select
                    value={assetTypeFilter}
                    onChange={(e) => {
                      setAssetTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="table-select w-full"
                  >
                    <option value="All">All</option>
                    <option value="PPE">PPE</option>
                    <option value="SE">SE</option>
                  </select>
                </div>

                <div className="w-full sm:flex-1">
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                    <span className="h-2 w-2 rounded-full bg-slate-500" />
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusSelect(e.target.value)}
                    className="table-select w-full"
                  >
                    <option value="All">Status: All</option>
                    <option value="In Stock">Status: In stock</option>
                    <option value="Issued">Status: Issued</option>
                    <option value="Transferred">Status: Transferred</option>
                    <option value="For Transfer">Status: For transfer</option>
                    <option value="Pending">Status: Pending</option>
                    <option value="For Issue">Status: For issuance</option>
                    <option value="For Disposal">Status: For disposal</option>
                    <option value="Disposed">Status: Disposed</option>
                  </select>
                </div>

                <div className="text-[11px] text-slate-500 sm:text-xs">
                  Showing{" "}
                  <span className="font-semibold text-slate-900">
                    {pageItems.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-900">{totalCount}</span>
                </div>
              </div>

              <div className="hidden xl:block">
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
                      placeholder="Search item, property no., project, status..."
                      value={search}
                      onChange={handleSearchChange}
                      className="search-input"
                    />
                  </div>

                  <span className="request-divider" aria-hidden="true" />

                  <div className="request-chip-group">
                    <button
                      type="button"
                      onClick={() => {
                        setAssetTypeFilter("All");
                        setPage(1);
                      }}
                      className={`request-chip request-chip-slate ${
                        assetTypeFilter === "All" ? "request-chip-active" : ""
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssetTypeFilter("PPE");
                        setPage(1);
                      }}
                      className={`request-chip request-chip-sky ${
                        assetTypeFilter === "PPE" ? "request-chip-active" : ""
                      }`}
                    >
                      PPE
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssetTypeFilter("SE");
                        setPage(1);
                      }}
                      className={`request-chip request-chip-emerald ${
                        assetTypeFilter === "SE" ? "request-chip-active" : ""
                      }`}
                    >
                      SE
                    </button>
                  </div>

                  <span className="request-divider" aria-hidden="true" />

                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusSelect(e.target.value)}
                    className="request-select min-w-[180px] bg-slate-900 text-white border-slate-900/80"
                  >
                    <option value="All">Status: All</option>
                    <option value="In Stock">Status: In stock</option>
                    <option value="Issued">Status: Issued</option>
                    <option value="Transferred">Status: Transferred</option>
                    <option value="For Transfer">Status: For transfer</option>
                    <option value="Pending">Status: Pending</option>
                    <option value="For Issue">Status: For issuance</option>
                    <option value="For Disposal">Status: For disposal</option>
                    <option value="Disposed">Status: Disposed</option>
                  </select>

                  <div className="ml-auto text-[11px] text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {pageItems.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-900">{totalCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* TABLE CARD */}
        <div className="table-shell table-compact table-flush relative">
          <div
            className="overflow-x-auto overflow-y-visible"
            style={openMenuId ? { paddingBottom: "12rem" } : undefined}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : pageItems.length === 0 ? (
                <EmptyState
                  title="No matching office equipment"
                  subtitle="We could not find any equipment that matches your filters."
                  hint="Try adjusting filters or clearing search."
                  className="max-w-2xl"
                />
              ) : (
                pageItems.map((row) => (
                  <ItemCard
                    key={row._id}
                    data={row}
                    canManageExtras={!isEmployee || isUserInvolved(row)}
                  />
                ))
              )}
            </div>

            {loading ? (
              <table className="w-full whitespace-nowrap hidden lg:table text-left">
                <thead>
                  <tr className="h-10 text-gray-800">
                    <TableHeader title="PPE/SE ID" />
                    <TableHeader title="Item Description" />
                    <TableHeader title="Classification" />
                    <TableHeader title="Batch No." />
                    <TableHeader title="Qty" />
                    <TableHeader title="Unit Cost" />
                    <TableHeader title="Project" />
                    <TableHeader title="Status" />
                    <TableHeader title="Actions" />
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
                    <TableHeader title="PPE/SE ID" />
                    <TableHeader title="Item Description" />
                    <TableHeader title="Classification" />
                    <TableHeader title="Batch No." />
                    <TableHeader title="Qty" />
                    <TableHeader title="Unit Cost" />
                    <TableHeader title="Project" />
                    <TableHeader title="Status" />
                    <TableHeader title="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10">
                        <EmptyState
                          title="No matching office equipment"
                          subtitle="We could not find any equipment that matches your filters."
                          hint="Try adjusting filters or clearing search."
                          className="max-w-2xl"
                        />
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((row) => (
                      <TableRow
                        key={row._id}
                        data={row}
                        canManageExtras={!isEmployee || isUserInvolved(row)}
                        menuOpen={openMenuId === row._id}
                        onToggleMenu={() => {
                          setOpenMenuId((prev) => (prev === row._id ? null : row._id));
                        }}
                      />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION */}
          {!loading && totalCount > itemsPerPage && (
            <div className="flex items-center justify-between border-t border-slate-200/70 bg-white px-3 py-4 text-[10px] md:px-4 md:text-xs">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-md border shadow-sm"
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-md border shadow-sm"
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
      </section>
    </div>
  );
}

export default Stocktableofficeequipments;
