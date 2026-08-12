// src/table/ClassificationTable.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalShell from "../components/ModalShell";
import EmptyState from "../components/EmptyState";

/* --------------------------------- helpers --------------------------------- */
const classNames = (...c) => c.filter(Boolean).join(" ");

const DESIGNATIONS = [
  "Office Equipments",
  "Office Supplies",
  "Furniture & Fixture",
  "ICT Equipments",
  "Land & Building",
  "Motor & Vehicles",
];

/**
 * Tailwind v2 compatibility:
 * - avoid slash opacity utilities (bg-black/30, bg-white/20, ring-black/5)
 * - avoid backdrop-blur utilities
 * - use bg-opacity-* and normal borders/shadows instead
 */

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

function StatusPill({ active }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        active
          ? "bg-green-100 text-green-700 border-green-200"
          : "bg-gray-100 text-gray-700 border-gray-200"
      )}
      title={active ? "Active" : "Inactive"}
    >
      <span
        className={classNames(
          "inline-block h-2 w-2 rounded-full mr-2",
          active ? "bg-green-600" : "bg-gray-500"
        )}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* --------------------------------- atoms ---------------------------------- */
function TableHeader({ title, sortable, sortKey, currentSort, onSort }) {
  const isActive =
    Boolean(sortable && sortKey && currentSort && currentSort.key === sortKey) ||
    false;
  const dir = isActive ? currentSort.dir : undefined;

  return (
    <th
      scope="col"
      className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-50 select-none"
    >
      {sortable && sortKey ? (
        <button
          type="button"
          onClick={() => onSort && onSort(sortKey)}
          className={classNames(
            "w-full inline-flex items-center justify-start text-left gap-1 focus:outline-none",
            "hover:text-indigo-700"
          )}
          title={`Sort by ${title}`}
        >
          <span>{title}</span>
          <span
            className={classNames(
              "text-[10px]",
              isActive ? "text-indigo-700" : "text-gray-400"
            )}
          >
            {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "⇅"}
          </span>
        </button>
      ) : (
        <span>{title}</span>
      )}
    </th>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  subtitle = "Classifications",
  variant = "neutral",
  maxWidthClass = "max-w-lg",
}) {
  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      variant={variant}
      onClose={onClose}
      maxWidthClass={maxWidthClass}
    >
      {children}
    </ModalShell>
  );
}

function Toast({ show, type = "success", children, onHide }) {
  if (!show) return null;

  const bg =
    type === "success"
      ? "bg-green-600"
      : type === "error"
      ? "bg-red-600"
      : "bg-gray-900";

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div className={classNames("rounded-lg px-4 py-3 text-white shadow-lg", bg)}>
        <div className="flex items-start gap-3">
          <div className="text-sm font-semibold leading-5">{children}</div>
          <button
            onClick={onHide}
            className="ml-auto rounded-md bg-white bg-opacity-20 px-2 py-1 text-xs font-semibold hover:bg-opacity-30"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 4 }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

/* ------------------------------- row menu -------------------------------- */
function RowActions({ open, anchorRef, onClose, onToggleActive, isActive }) {
  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      const el = anchorRef?.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      onClose && onClose();
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  return (
    <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg bg-white shadow-lg border border-gray-200 overflow-hidden">
      <button
        className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
        onClick={() => {
          onClose && onClose();
          onToggleActive && onToggleActive();
        }}
        type="button"
      >
        {isActive ? "Mark as Inactive" : "Mark as Active"}
      </button>
    </div>
  );
}

function TableRow({ data, menuOpen, setMenuOpen, onToggleActive }) {
  const anchorRef = useRef(null);

  return (
    <tr className="hover:bg-gray-50 transition duration-150">
      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-left text-gray-900">
        {data.description || "—"}
      </td>

      <td className="px-5 py-4 whitespace-nowrap text-sm text-left text-gray-700">
        {data.designation || "—"}
      </td>

      <td className="px-5 py-4 whitespace-nowrap text-left">
        <StatusPill active={!!data.active} />
      </td>

      <td className="px-5 py-4 whitespace-nowrap text-left">
        <div className="relative inline-flex" ref={anchorRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="manage-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen ? "true" : "false"}
          >
            Manage
            <span className="ml-2 text-white/70" aria-hidden="true">
              ▾
            </span>
          </button>

          <RowActions
            open={menuOpen}
            anchorRef={anchorRef}
            onClose={() => setMenuOpen(false)}
            onToggleActive={() => onToggleActive(data)}
            isActive={!!data.active}
          />
        </div>
      </td>
    </tr>
  );
}

/* ================================ Main ================================ */
function ClassificationTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("");
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    description: "",
    designation: "",
    active: true,
  });
  const [addErrors, setAddErrors] = useState({});
  const [addErrorOpen, setAddErrorOpen] = useState(false);
  const [addErrorMessage, setAddErrorMessage] = useState("");
  const addDescriptionRef = useRef(null);

  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });

  const [sort, setSort] = useState({ key: "description", dir: "asc" });

  // cleaner UI: one open menu at a time
  const [openMenuId, setOpenMenuId] = useState(null);

  const navigate = useNavigate();

  // ✅ Breadcrumbs: Settings > Classifications
  const breadcrumbs = useMemo(
    () => [
      { label: "Settings", onClick: () => navigate("/settingsdashboard") },
      { label: "Classifications", current: true },
    ],
    [navigate]
  );

  /* ----------------------------- fetch data ----------------------------- */
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(itemsPerPage));
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (selectedDesignation) params.set("designation", selectedDesignation);
        if (sort?.key) params.set("sort", `${sort.key}:${sort.dir || "asc"}`);

        const res = await fetch(`${BASE_URL}/classification?${params.toString()}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch classification data");

        const data = await res.json();
        setRows(Array.isArray(data?.data) ? data.data : []);
        setTotal(Number(data?.total) || 0);
      } catch (e) {
        if (e?.name !== "AbortError") setError(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [currentPage, itemsPerPage, searchQuery, selectedDesignation, sort, refreshKey]);

  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(
      () => setToast((t) => ({ ...t, show: false })),
      2600
    );
  };

  /* ------------------------------ pagination ---------------------------- */
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const currentRows = rows;

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
    setOpenMenuId(null);
  };

  /* -------------------------------- sort fn ----------------------------- */
  const onSort = (key) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setCurrentPage(1);
  };

  /* ------------------------------ handlers ------------------------------ */
  const resetAddForm = () => {
    setAddForm({ description: "", designation: "", active: true });
    setAddErrors({});
  };

  const focusAddDescription = () => {
    window.setTimeout(() => addDescriptionRef.current?.focus(), 0);
  };

  const validateAdd = () => {
    const errs = {};
    if (!addForm.description.trim()) errs.description = "Description is required.";
    if (!addForm.designation) errs.designation = "Designation is required.";
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitAdd = async () => {
    if (!validateAdd()) return;

    try {
      const payload = {
        description: addForm.description.trim(),
        designation: addForm.designation,
        active: !!addForm.active,
      };

      const res = await fetch(`${BASE_URL}/classification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        if (res.status === 409) {
          setAddErrorMessage(
            msg || "This classification already exists for the selected designation."
          );
          setAddErrorOpen(true);
          return;
        }
        throw new Error(msg || "Failed to add classification");
      }

      await res.json();
      setAddOpen(false);
      resetAddForm();
      showToast("Classification added successfully.", "success");

      // predictable: return to page 1 after add
      setCurrentPage(1);
      setOpenMenuId(null);
      setRefreshKey((v) => v + 1);
    } catch (e) {
      showToast(e.message || "Failed to add classification", "error");
    }
  };

  const onToggleActive = async (item) => {
    const nextActive = !item.active;
    try {
      const updated = { ...item, active: nextActive, __v: item.__v };

      const res = await fetch(`${BASE_URL}/classification/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to update item");
      }

      const saved = await res.json().catch(() => ({}));
      const normalizedActive =
        typeof saved?.active === "boolean" ? saved.active : nextActive;
      const savedId = saved?._id || item._id;

      setRows((prev) =>
        prev.map((r) =>
          r._id === savedId ? { ...r, ...saved, active: normalizedActive } : r
        )
      );
      setOpenMenuId(null);
      showToast(`Marked as ${normalizedActive ? "Active" : "Inactive"}.`, "success");
      setRefreshKey((v) => v + 1);
    } catch (e) {
      showToast(e.message || "Failed to update", "error");
    }
  };


  /* -------------------------------- render ------------------------------ */
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error: {error.message || "Something went wrong."}
        </div>
      </div>
    );
  }

  const totalCount = total;
  const activeCount = rows.filter((r) => r.active).length;
  const filteredCount = total;
  const rangeStart = total === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(safePage * itemsPerPage, total);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        <Breadcrumbs className="mb-3" items={breadcrumbs} />

        {/* Header */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-light text-slate-900">
              Classification <span className="font-semibold">Settings</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage classification entries by designation. Search, sort, activate, or deactivate.
            </p>
          </div>

          <div className="table-filters">
            <button
              onClick={() => setAddOpen(true)}
              className="table-button-primary inline-flex items-center gap-2"
              type="button"
              title="Add a new classification"
            >
              <span className="text-lg leading-none" aria-hidden="true">
                +
              </span>
              Add
            </button>

            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="table-button inline-flex items-center gap-2"
              type="button"
              title="Refresh list"
            >
              Refresh
            </button>

            <div className="search-shell w-60 max-w-full">
              <span className="search-icon">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search description/designation…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  setOpenMenuId(null);
                }}
                className="search-input"
              />
            </div>

            <select
              value={selectedDesignation}
              onChange={(e) => {
                setSelectedDesignation(e.target.value);
                setCurrentPage(1);
                setOpenMenuId(null);
              }}
              className="table-select"
              title="Filter by designation"
            >
              <option value="">All Designations</option>
              {DESIGNATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{totalCount}</div>
            <div className="mt-3 h-1 rounded-full bg-gradient-to-r from-slate-900 to-slate-600" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{activeCount}</div>
            <div className="mt-3 h-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Filtered
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{filteredCount}</div>
            <div className="mt-3 h-1 rounded-full bg-gradient-to-r from-sky-600 to-indigo-500" />
          </div>
        </div>

        {/* Table Card */}
        <div className="table-shell table-compact table-flush px-4 sm:px-6 py-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">Classifications</div>
            <div className="ml-auto text-[11px] text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of <span className="font-semibold text-slate-800">{total}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full whitespace-nowrap">
              <thead>
                <tr className="text-sm leading-none text-gray-800">
                  <TableHeader
                    title="Description"
                    sortable
                    sortKey="description"
                    currentSort={sort}
                    onSort={onSort}
                  />
                  <TableHeader
                    title="Designation"
                    sortable
                    sortKey="designation"
                    currentSort={sort}
                    onSort={onSort}
                  />
                  <TableHeader
                    title="Status"
                    sortable
                    sortKey="active"
                    currentSort={sort}
                    onSort={onSort}
                  />
                  <TableHeader title="Manage" />
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10">
                      <EmptyState
                        title="No classifications found"
                        subtitle="We could not find any classifications that match your filters."
                        hint="Try adjusting filters or add a new classification."
                        className="max-w-2xl"
                      />
                    </td>
                  </tr>
                ) : (
                  currentRows.map((data) => (
                    <TableRow
                      key={data._id}
                      data={data}
                      menuOpen={openMenuId === data._id}
                      setMenuOpen={(setter) => {
                        setOpenMenuId((prev) => {
                          const isOpenNow = prev === data._id;
                          const next =
                            typeof setter === "function" ? setter(isOpenNow) : !!setter;
                          return next ? data._id : null;
                        });
                      }}
                      onToggleActive={onToggleActive}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Page <span className="font-semibold text-gray-700">{safePage}</span> of{" "}
                <span className="font-semibold text-gray-700">{totalPages}</span>
              </div>

              <div className="flex gap-2">
                <button
                  className={classNames(
                    "px-4 py-2 rounded-md text-sm font-semibold border shadow-sm",
                    safePage === 1
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                  )}
                  onClick={() => paginate(safePage - 1)}
                  disabled={safePage === 1}
                  type="button"
                >
                  Previous
                </button>

                <button
                  className={classNames(
                    "px-4 py-2 rounded-md text-sm font-semibold border shadow-sm",
                    safePage === totalPages
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                  )}
                  onClick={() => paginate(safePage + 1)}
                  disabled={safePage === totalPages}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------- Add Modal ------------------------------ */}
        <Modal
          open={addOpen}
          title="Add Classification"
          subtitle="Classification Setup"
          onClose={() => {
            setAddOpen(false);
            resetAddForm();
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Description
              </label>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                ref={addDescriptionRef}
                className={classNames(
                  "mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none",
                  addErrors.description ? "border-red-300" : "border-gray-300"
                )}
                placeholder="e.g., Consumables, Office Paper, etc."
              />
              {addErrors.description && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  {addErrors.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Designation
              </label>
              <select
                value={addForm.designation}
                onChange={(e) => setAddForm((f) => ({ ...f, designation: e.target.value }))}
                className={classNames(
                  "mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white focus:outline-none",
                  addErrors.designation ? "border-red-300" : "border-gray-300"
                )}
              >
                <option value="">Select Designation</option>
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {addErrors.designation && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  {addErrors.designation}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="activeToggle"
                type="checkbox"
                checked={addForm.active}
                onChange={(e) => setAddForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 border border-gray-300"
              />
              <label htmlFor="activeToggle" className="text-sm text-gray-700">
                Mark as Active
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setAddOpen(false);
                  resetAddForm();
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={submitAdd}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
                type="button"
                style={{ backgroundColor: "#16a34a", color: "#ffffff" }} // fallback
              >
                Add
              </button>
            </div>
          </div>
        </Modal>

        {/* --------------------------- Add Error Modal --------------------------- */}
        <Modal
          open={addErrorOpen}
          title="Duplicate Classification"
          subtitle="Validation"
          variant="warning"
          onClose={() => setAddErrorOpen(false)}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              {addErrorMessage || "This classification already exists."}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAddErrorOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                type="button"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setAddErrorOpen(false);
                  setAddOpen(true);
                  focusAddDescription();
                }}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                type="button"
              >
                Try again
              </button>
            </div>
          </div>
        </Modal>

        {/* ------------------------------- Toast -------------------------------- */}
        <Toast
          show={toast.show}
          type={toast.type}
          onHide={() => setToast((t) => ({ ...t, show: false }))}
        >
          {toast.msg}
        </Toast>
      </div>
    </div>
  );
}

export default ClassificationTable;
