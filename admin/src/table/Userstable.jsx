// src/table/Userstable.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";
import ModalShell from "../components/ModalShell";
import Select from "react-select";
import * as XLSX from "xlsx";
import { AuthContext } from "../context/AuthContext";
import { ROLES, normalizeRole } from "../utils/roles";

/* -------------------------- helpers -------------------------- */
const classNames = (...c) => c.filter(Boolean).join(" ");
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ROLE_OPTIONS = [
  { value: "Super Admin", label: "Super Admin" },
  { value: "Inventory Admin", label: "Inventory Admin" },
  { value: "Regional Director", label: "Regional Director" },
  {
    value: "Assistant Regional Director",
    label: "Assistant Regional Director",
  },
  { value: "AFD", label: "AFD" },
  { value: "AFD Special Access", label: "AFD Special Access" },
  { value: "Accountant", label: "Accountant" },
  { value: "TOD", label: "TOD" },
  { value: "Cagayan Provincial Officer", label: "Cagayan Provincial Officer" },
  { value: "Isabela Provincial Officer", label: "Isabela Provincial Officer" },
  { value: "Batanes Provincial Officer", label: "Batanes Provincial Officer" },
  {
    value: "Nueva Vizcaya Provincial Officer",
    label: "Nueva Vizcaya Provincial Officer",
  },
  { value: "Quirino Provincial Officer", label: "Quirino Provincial Officer" },
  { value: "employee", label: "Employee" },
];

const roleColor = (role) => {
  if (!role) return "bg-gray-100 text-gray-700 ring-gray-200";
  const map = {
    "Super Admin": "bg-slate-100 text-slate-800 ring-slate-200",
    "Inventory Admin": "bg-blue-50 text-blue-700 ring-blue-200",
    "Regional Director": "bg-amber-50 text-amber-700 ring-amber-200",
    "Assistant Regional Director": "bg-yellow-50 text-yellow-700 ring-yellow-200",
    AFD: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    "AFD Special Access": "bg-teal-50 text-teal-700 ring-teal-200",
    Accountant: "bg-rose-50 text-rose-700 ring-rose-200",
    TOD: "bg-sky-50 text-sky-700 ring-sky-200",
    "Cagayan Provincial Officer": "bg-cyan-50 text-cyan-700 ring-cyan-200",
    "Isabela Provincial Officer": "bg-lime-50 text-lime-700 ring-lime-200",
    "Batanes Provincial Officer": "bg-green-50 text-green-700 ring-green-200",
    "Nueva Vizcaya Provincial Officer": "bg-amber-100 text-amber-800 ring-amber-200",
    "Quirino Provincial Officer": "bg-orange-50 text-orange-700 ring-orange-200",
  };
  return map[role] || "bg-gray-100 text-gray-700 ring-gray-200";
};

const statusTone = (active) =>
  active === false
    ? "bg-rose-50 text-rose-700 ring-rose-200"
    : "bg-emerald-50 text-emerald-700 ring-emerald-200";

/** Roles that can have MULTIPLE occupants */
const MULTI_ROLES = ["Super Admin", "AFD Special Access"];
const isMultiRole = (role) => MULTI_ROLES.includes(role);

const getRoleFromUserAnyShape = (u) =>
  u?.data?.role || u?.role || u?.user?.role || u?.data?.user?.role || "";

const getIdFromUserAnyShape = (u) =>
  u?.data?._id || u?._id || u?.id || u?.data?.user?._id || u?.user?._id || "";

const isSuperAdminRole = (role) => {
  const key = normalizeRole(role);
  return key === normalizeRole(ROLES.SUPER_ADMIN) || key === "superadmin" || key === "admin";
};

/* -------------------------- UI atoms -------------------------- */
function TableHeader({ title, sortable, sortKey, currentSort, onSort }) {
  // only consider active if sortable and sortKey present
  const isActive = Boolean(
    sortable && sortKey && currentSort && currentSort.key === sortKey
  );
  const dir = isActive ? currentSort.dir : undefined;

  return (
    <th
      scope="col"
      className="px-6 py-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-[0.26em] border-b border-slate-200 bg-white select-none"
    >
      <div
        className={classNames(
          "inline-flex items-center gap-1",
          sortable && "cursor-pointer hover:text-emerald-600"
        )}
        onClick={() => {
          if (sortable && sortKey && onSort) onSort(sortKey);
        }}
      >
        <span>{title}</span>
        {sortable && sortKey && (
          <svg
            className={classNames(
              "h-3.5 w-3.5",
              isActive ? "text-emerald-600" : "text-gray-400"
            )}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            {dir === "asc" ? (
              <path d="M10 6l-4 6h8l-4-6z" />
            ) : dir === "desc" ? (
              <path d="M10 14l4-6H6l4 6z" />
            ) : (
              <path
                d="M7 7h6M7 10h6M7 13h6"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
              />
            )}
          </svg>
        )}
      </div>
    </th>
  );
}

const Badge = ({ children, tone }) => (
  <span
    className={classNames(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
      tone || "bg-gray-100 text-gray-700 ring-gray-200"
    )}
  >
    {children}
  </span>
);

function Modal({
  open,
  title,
  children,
  onClose,
  subtitle = "User Management",
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
  const color =
    type === "success"
      ? "bg-emerald-600"
      : type === "error"
      ? "bg-rose-600"
      : "bg-gray-800";
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={classNames("rounded-md px-4 py-3 text-white shadow-lg", color)}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{children}</span>
          <button
            onClick={onHide}
            className="ml-2 rounded bg-white bg-opacity-20 px-2 py-0.5 text-xs hover:bg-opacity-30"
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
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

function UserCard({
  data,
  onView,
  onChangeRole,
  onClearRole,
  onToggleStatus,
  onForceLogout,
  canForceLogout,
  forceLogoutDisabled,
}) {
  const canClear = !!data.role;
  const isActive = data.active !== false;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{data.username || "—"}</div>
          <div className="text-xs text-gray-500">{data.email || "—"}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={roleColor(data.role)}>{data.role || "Unassigned"}</Badge>
          <Badge tone={statusTone(data.active)}>{isActive ? "Active" : "Inactive"}</Badge>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Position</span>
          <span className="font-medium text-slate-800">{data.position || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400">Project</span>
          <span className="font-medium text-slate-800">{data.project || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400">User ID</span>
          <span className="font-medium text-slate-800">{data._id || "—"}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onView(data)}
          className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          View
        </button>
        <button
          type="button"
          onClick={() => onChangeRole(data)}
          className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
        >
          Change Role
        </button>
        <button
          type="button"
          onClick={() => onClearRole(data)}
          disabled={!canClear}
          className={classNames(
            "inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold",
            canClear
              ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          Clear Role
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(data)}
          className={classNames(
            "inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold",
            isActive
              ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          )}
        >
          {isActive ? "Set inactive" : "Set active"}
        </button>
        {canForceLogout ? (
          <button
            type="button"
            onClick={() => onForceLogout(data)}
            disabled={forceLogoutDisabled}
            className={classNames(
              "inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold",
              forceLogoutDisabled
                ? "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                : "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
            )}
            title={forceLogoutDisabled ? "You cannot force logout your own account." : "Force logout user"}
          >
            Force logout
          </button>
        ) : null}
        <Link
          to={`/checkuserforadmin/${data._id}`}
          className="manage-button"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

/* -------------------------- Row -------------------------- */
function TableRow({
  data,
  onView,
  onChangeRole,
  onClearRole,
  onToggleStatus,
  onForceLogout,
  canForceLogout,
  currentUserId,
  actionsOpen,
  setActionsOpenFor,
}) {
  const isMenuOpen = actionsOpen === data._id;
  const canClear = !!data.role;
  const isActive = data.active !== false;
  const canForceLogoutTarget =
    canForceLogout && String(data?._id || "") !== String(currentUserId || "");
  const initials = (data.username || data.email || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <tr className="hover:bg-slate-50/80 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span>{data.username || "—"}</span>
              {data.project ? (
                <Badge tone="bg-sky-50 text-sky-700 ring-sky-200">
                  {data.project}
                </Badge>
              ) : null}
            </div>
            <div className="text-xs text-gray-500">{data._id}</div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        {data.email || "—"}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        {data.position || "—"}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <Badge tone={roleColor(data.role)}>{data.role || "Unassigned"}</Badge>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <Badge tone={statusTone(data.active)}>{isActive ? "Active" : "Inactive"}</Badge>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-left">
        <div className="relative inline-flex">
          <button
            onClick={() => setActionsOpenFor(isMenuOpen ? null : data._id)}
            className="manage-button px-3 py-2 text-xs"
            type="button"
          >
            Actions
            <svg className="ml-2 h-4 w-4 text-white/70" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5.25 7.5l4.5 4.5 4.5-4.5" />
            </svg>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5">
              <button
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setActionsOpenFor(null);
                  onView(data);
                }}
                type="button"
              >
                View
              </button>

              <button
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setActionsOpenFor(null);
                  onChangeRole(data);
                }}
                type="button"
              >
                Change Role
              </button>

              <button
                className={classNames(
                  "block w-full px-4 py-2 text-left text-sm",
                  canClear
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-rose-300 cursor-not-allowed"
                )}
                onClick={() => {
                  if (!canClear) return;
                  setActionsOpenFor(null);
                  onClearRole(data);
                }}
                type="button"
                disabled={!canClear}
                title={!canClear ? "No role to clear" : "Clear role"}
              >
                Clear Role
              </button>

              <button
                className={classNames(
                  "block w-full px-4 py-2 text-left text-sm",
                  isActive ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50"
                )}
                onClick={() => {
                  setActionsOpenFor(null);
                  onToggleStatus(data);
                }}
                type="button"
              >
                {isActive ? "Set inactive" : "Set active"}
              </button>

              {canForceLogout ? (
                <button
                  className={classNames(
                    "block w-full px-4 py-2 text-left text-sm",
                    canForceLogoutTarget
                      ? "text-violet-700 hover:bg-violet-50"
                      : "text-gray-300 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (!canForceLogoutTarget) return;
                    setActionsOpenFor(null);
                    onForceLogout(data);
                  }}
                  type="button"
                  disabled={!canForceLogoutTarget}
                  title={
                    canForceLogoutTarget
                      ? "Force logout user"
                      : "You cannot force logout your own account."
                  }
                >
                  Force logout
                </button>
              ) : null}

              <Link
                to={`/checkuserforadmin/${data._id}`}
                className="block w-full px-4 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50"
                onClick={() => setActionsOpenFor(null)}
              >
                Manage
              </Link>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ============================== Main ============================== */
function Userstable() {
  const { user: authUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState(null);

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleUser, setRoleUser] = useState(null);
  const [roleSelected, setRoleSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const [clearOpen, setClearOpen] = useState(false);
  const [clearUser, setClearUser] = useState(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusUser, setStatusUser] = useState(null);
  const [statusNextActive, setStatusNextActive] = useState(true);
  const [forceLogoutOpen, setForceLogoutOpen] = useState(false);
  const [forceLogoutUser, setForceLogoutUser] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });

  // default sort object so TableHeader always receives a defined currentSort
  const [sort, setSort] = useState({ key: "username", dir: "asc" });
  const currentUserId = useMemo(() => getIdFromUserAnyShape(authUser), [authUser]);
  const canForceLogout = useMemo(
    () => isSuperAdminRole(getRoleFromUserAnyShape(authUser)),
    [authUser]
  );

  

  /* ---------------- fetch ---------------- */
  const buildQueryParams = ({ page = currentPage, limit = itemsPerPage } = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (assignmentFilter !== "all") params.set("assignment", assignmentFilter);
    if (statusFilter !== "all") params.set("active", statusFilter === "active" ? "true" : "false");
    if (sort?.key) params.set("sort", `${sort.key}:${sort.dir || "asc"}`);
    return params;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = buildQueryParams();
      const res = await fetch(`${BASE_URL}/users?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setUsers(list);
      setTotal(Number.isFinite(Number(data?.total)) ? Number(data.total) : list.length);
      setActiveCount(
        Number.isFinite(Number(data?.activeCount))
          ? Number(data.activeCount)
          : list.filter((u) => u.active !== false).length
      );
      setInactiveCount(
        Number.isFinite(Number(data?.inactiveCount))
          ? Number(data.inactiveCount)
          : list.filter((u) => u.active === false).length
      );
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, searchQuery, roleFilter, assignmentFilter, statusFilter, sort, refreshKey]);

  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, msg });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 2800);
  };

  /* --------------- search + sort + filters --------------- */
  const currentUsers = users;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, total);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  const onSort = (key) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setCurrentPage(1);
  };

  /* --------------- actions --------------- */
  const setActionsOpenFor = (id) => setActionsOpen(id);

  const onView = (u) => {
    setViewUser(u);
    setViewOpen(true);
  };

  const onChangeRole = (u) => {
    setRoleUser(u);
    setRoleSelected(u.role ? { value: u.role, label: u.role } : null);
    setRoleOpen(true);
  };

  const onClearRole = (u) => {
    if (!u.role) return;
    setClearUser(u);
    setClearOpen(true);
  };

  const onToggleStatus = (u) => {
    if (!u) return;
    const nextActive = u.active === false;
    setStatusUser(u);
    setStatusNextActive(nextActive);
    setStatusOpen(true);
  };

  const onForceLogout = (u) => {
    if (!u || !canForceLogout) return;
    if (String(u._id || "") === String(currentUserId || "")) {
      showToast("You cannot force logout your own account.", "error");
      return;
    }
    setForceLogoutUser(u);
    setForceLogoutOpen(true);
  };

  const doSaveRole = async () => {
    if (!roleUser || !roleSelected) return;

    const newRole = roleSelected.value;

    try {
      setSaving(true);

      // Server enforces single-occupant roles.
      const payload = { role: newRole, __v: roleUser.__v };
      const res = await fetch(`${BASE_URL}/users/${roleUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to update role");
      }
      await res.json();

      // Refresh list from server to ensure we see demotions + new role
      await fetchUsers();

      setRoleOpen(false);

      if (!isMultiRole(newRole)) {
        showToast(
          `Assigned "${newRole}" to ${roleUser.username}. Any previous holder is now "employee".`
        );
      } else {
        showToast(`Role updated to "${newRole}" for ${roleUser.username}`);
      }
    } catch (e) {
      showToast(e.message || "Failed to update role", "error");
    } finally {
      setSaving(false);
    }
  };

  const doClearRole = async () => {
    if (!clearUser) return;
    try {
      setSaving(true);
      const payload = { role: "", __v: clearUser.__v };
      const res = await fetch(`${BASE_URL}/users/${clearUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to clear role");
      }
      const saved = await res.json();
      setUsers((prev) => prev.map((u) => (u._id === saved._id ? saved : u)));
      setClearOpen(false);
      showToast(`Cleared role for ${saved.username}`);
    } catch (e) {
      showToast(e.message || "Failed to clear role", "error");
    } finally {
      setSaving(false);
    }
  };

  const doToggleStatus = async () => {
    if (!statusUser) return;
    try {
      setSaving(true);
      const payload = { active: statusNextActive, __v: statusUser.__v };
      const res = await fetch(`${BASE_URL}/users/${statusUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to update status");
      }
      await res.json().catch(() => ({}));
      await fetchUsers();
      setStatusOpen(false);
      showToast(
        `${statusUser.username} is now ${statusNextActive ? "active" : "inactive"}.`
      );
    } catch (e) {
      showToast(e.message || "Failed to update status", "error");
    } finally {
      setSaving(false);
    }
  };

  const doForceLogout = async () => {
    if (!forceLogoutUser || !canForceLogout) return;
    try {
      setSaving(true);
      const res = await fetch(`${BASE_URL}/users/${forceLogoutUser._id}/force-logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to force logout user.");
      }
      await fetchUsers();
      setForceLogoutOpen(false);
      setForceLogoutUser(null);
      showToast(
        payload?.message ||
          `Forced logout for ${forceLogoutUser?.username || forceLogoutUser?._id || "user"}.`
      );
    } catch (e) {
      showToast(e.message || "Failed to force logout user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const formatExportRows = (list = []) =>
    list.map((u) => ({
      "User ID": u?._id || "",
      Username: u?.username || "",
      Email: u?.email || "",
      Position: u?.position || "",
      Role: u?.role || "Unassigned",
      Status: u?.active === false ? "Inactive" : "Active",
      Project: u?.project || "",
      Designation: u?.designation || "",
    }));

  const getUsersForExport = async () => {
    const exportLimit = Math.max(total || 0, itemsPerPage, 200);
    const params = buildQueryParams({ page: 1, limit: exportLimit });
    const res = await fetch(`${BASE_URL}/users?${params.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch users for export.");
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const list = await getUsersForExport();
      const rows = formatExportRows(list);
      if (!rows.length) {
        showToast("No users to export.", "error");
        return;
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Users");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `Users_${stamp}.xlsx`);
      showToast("Users exported to Excel.");
    } catch (e) {
      showToast(e?.message || "Failed to export Excel.", "error");
    } finally {
      setExporting(false);
    }
  };

  const exportToPdf = async () => {
    try {
      setExporting(true);
      const list = await getUsersForExport();
      const rows = formatExportRows(list);
      if (!rows.length) {
        showToast("No users to export.", "error");
        return;
      }

      const w = window.open("", "", "width=1200,height=820");
      if (!w) {
        showToast("Popup blocked. Allow popups to export PDF.", "error");
        return;
      }

      const generatedAt = new Date().toLocaleString();
      const bodyRows = rows
        .map(
          (r, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${escapeHtml(r["User ID"])}</td>
              <td>${escapeHtml(r.Username)}</td>
              <td>${escapeHtml(r.Email)}</td>
              <td>${escapeHtml(r.Position)}</td>
              <td>${escapeHtml(r.Role)}</td>
              <td>${escapeHtml(r.Status)}</td>
            </tr>
          `
        )
        .join("");

      w.document.write(`
        <html>
          <head>
            <title>Users Report</title>
            <style>
              @page { size: A4 landscape; margin: 14mm; }
              body { font-family: Arial, sans-serif; color: #0f172a; }
              .head { display: flex; justify-content: space-between; margin-bottom: 10px; }
              .title { font-size: 18px; font-weight: 700; }
              .meta { font-size: 12px; color: #475569; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: left; }
              th { background: #e2e8f0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }
              tr:nth-child(even) td { background: #f8fafc; }
            </style>
          </head>
          <body>
            <div class="head">
              <div class="title">Users Report</div>
              <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>User ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Position</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${bodyRows}</tbody>
            </table>
            <script>
              setTimeout(function () { window.print(); window.close(); }, 80);
            </script>
          </body>
        </html>
      `);
      w.document.close();
      showToast("Users export ready for PDF print.");
    } catch (e) {
      showToast(e?.message || "Failed to export PDF.", "error");
    } finally {
      setExporting(false);
    }
  };

  /* -------------------- render -------------------- */
  if (error) {
    return <div className="p-6 text-rose-600">Error: {error.message}</div>;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-slate-50 w-full sm:px-6 pt-8">
      <SettingsHeader
        crumbs={[
          { label: "Users", to: "/userdashboard" },
          { label: "User Management" },
        ]}
        title="User Management"
        subtitle="Review accounts and access."
      />

      {/* toolbar */}
      <div className="mb-6">
        <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <div className="flex flex-1 items-center gap-3 min-w-[200px]">
              <span className="text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search name, email, role..."
                value={searchQuery}
                onChange={handleSearch}
                className="w-full bg-transparent border-0 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 focus:ring-transparent focus-visible:outline-none appearance-none"
              />
            </div>

            <div className="hidden sm:block h-8 w-px bg-slate-200" />

            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ].map((tab) => {
                const isActive = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.value);
                      setCurrentPage(1);
                    }}
                    className={[
                      "rounded-full px-4 py-2 text-xs font-semibold transition",
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:block h-8 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportToExcel}
                disabled={exporting || loading}
                className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? "Exporting..." : "Excel"}
              </button>
              <button
                type="button"
                onClick={exportToPdf}
                disabled={exporting || loading}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* summary bar */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Users
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{total}</div>
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
            Inactive
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{inactiveCount}</div>
          <div className="mt-3 h-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500" />
        </div>
      </div>

      <div className="table-shell px-4 md:px-6 py-5 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500" />
        <div className="md:hidden grid gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : currentUsers.length === 0 ? (
            <div className="py-6 text-left text-xs text-gray-500">
              No users match your search.
            </div>
          ) : (
            currentUsers.map((data) => (
              <UserCard
                key={data._id}
                data={data}
                onView={(u) => onView(u)}
                onChangeRole={(u) => onChangeRole(u)}
                onClearRole={(u) => onClearRole(u)}
                onToggleStatus={(u) => onToggleStatus(u)}
                onForceLogout={(u) => onForceLogout(u)}
                canForceLogout={canForceLogout}
                forceLogoutDisabled={String(data?._id || "") === String(currentUserId || "")}
              />
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="h-16 w-full text-sm leading-none text-gray-800">
                <TableHeader
                  title="Username"
                  sortable
                  sortKey="username"
                  currentSort={sort}
                  onSort={onSort}
                />
                <TableHeader
                  title="Email"
                  sortable
                  sortKey="email"
                  currentSort={sort}
                  onSort={onSort}
                />
                <TableHeader
                  title="Position"
                  sortable
                  sortKey="position"
                  currentSort={sort}
                  onSort={onSort}
                />
                <TableHeader
                  title="Role"
                  sortable
                  sortKey="role"
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
                <TableHeader title="Action" />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : currentUsers.map((data) => (
                    <TableRow
                      key={data._id}
                      data={data}
                      onView={(u) => onView(u)}
                      onChangeRole={(u) => onChangeRole(u)}
                      onClearRole={(u) => onClearRole(u)}
                      onToggleStatus={(u) => onToggleStatus(u)}
                      onForceLogout={(u) => onForceLogout(u)}
                      canForceLogout={canForceLogout}
                      currentUserId={currentUserId}
                      actionsOpen={actionsOpen}
                      setActionsOpenFor={setActionsOpenFor}
                    />
                  ))}
            </tbody>
          </table>
        </div>

        {!loading && currentUsers.length === 0 && (
          <div className="hidden md:block py-10 text-left text-sm text-gray-500">
            No users match your search.
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-700">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of <span className="font-semibold text-gray-700">{total}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="bg-white ring-1 ring-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                type="button"
              >
                Previous
              </button>
              <button
                className="bg-white ring-1 ring-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage >= totalPages}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      <Modal
        open={viewOpen}
        title="User Details"
        subtitle="User Profile"
        onClose={() => setViewOpen(false)}
        maxWidthClass="max-w-xl"
      >
        {viewUser ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-500">Name</div>
              <div className="col-span-2 text-sm font-medium text-gray-900">
                {viewUser.username || "—"}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-500">User ID</div>
              <div className="col-span-2 text-sm text-gray-900">{viewUser._id || "—"}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-500">Email</div>
              <div className="col-span-2 text-sm text-gray-900">{viewUser.email || "—"}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-500">Position</div>
              <div className="col-span-2 text-sm text-gray-900">
                {viewUser.position || "—"}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-500">Project</div>
              <div className="col-span-2 text-sm text-gray-900">
                {viewUser.project || "—"}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-500">Role</div>
              <div className="col-span-2">
                <Badge tone={roleColor(viewUser.role)}>{viewUser.role || "Unassigned"}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-sm text-gray-500">Status</div>
              <div className="col-span-2">
                <Badge tone={statusTone(viewUser.active)}>
                  {viewUser.active === false ? "Inactive" : "Active"}
                </Badge>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Link
                to={`/checkuserforadmin/${viewUser._id}`}
                className="manage-button px-4 py-2 text-sm"
                onClick={() => setViewOpen(false)}
              >
                Manage
              </Link>
              <button
                onClick={() => setViewOpen(false)}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Change Role Modal */}
      <Modal
        open={roleOpen}
        title={roleUser ? `Change Role — ${roleUser.username}` : "Change Role"}
        subtitle="Access Controls"
        onClose={() => setRoleOpen(false)}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Select new role</label>
            <Select
              value={roleSelected}
              onChange={setRoleSelected}
              options={ROLE_OPTIONS}
              className="mt-1"
              placeholder="Choose a role…"
            />
            {roleUser?.role && (
              <p className="mt-2 text-xs text-gray-500">
                Current role: <span className="font-medium">{roleUser.role}</span>
              </p>
            )}
            {roleSelected?.value && !isMultiRole(roleSelected.value) && (
              <p className="mt-1 text-xs text-amber-600">
                Note: Only one user can be{" "}
                <span className="font-semibold">{roleSelected.value}</span>. Any existing
                holder will automatically become <span className="font-semibold">employee</span>.
              </p>
            )}
            {roleSelected?.value && isMultiRole(roleSelected.value) && (
              <p className="mt-1 text-xs text-emerald-600">
                This role allows multiple occupants. Existing{" "}
                <span className="font-semibold">{roleSelected.value}</span> users will not be removed.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setRoleOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={doSaveRole}
              disabled={!roleSelected || saving}
              className={classNames(
                "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
                !roleSelected || saving
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400"
              )}
              type="button"
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear Role Modal */}
      <Modal
        open={clearOpen}
        title="Clear Role"
        subtitle="Danger Zone"
        variant="danger"
        onClose={() => setClearOpen(false)}
      >
        <p className="text-sm text-gray-700">
          This will remove the role from{" "}
          <span className="font-semibold">{clearUser?.username}</span>. You can reassign it
          later.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setClearOpen(false)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={doClearRole}
            disabled={!clearUser || saving}
            className={classNames(
              "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
              !clearUser || saving
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-rose-600 hover:bg-rose-700 focus:ring-rose-400"
            )}
            type="button"
          >
            {saving ? "Removing…" : "Confirm"}
          </button>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal
        open={statusOpen}
        title={
          statusUser
            ? `${statusNextActive ? "Set Active" : "Set Inactive"} — ${statusUser.username}`
            : "Update Status"
        }
        subtitle="Account Status"
        variant={statusNextActive ? "neutral" : "danger"}
        onClose={() => setStatusOpen(false)}
      >
        <p className="text-sm text-gray-700">
          This will mark{" "}
          <span className="font-semibold">{statusUser?.username}</span> as{" "}
          <span className="font-semibold">{statusNextActive ? "active" : "inactive"}</span>.
          {statusNextActive
            ? " They can sign in again."
            : " Inactive users cannot sign in."}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setStatusOpen(false)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={doToggleStatus}
            disabled={!statusUser || saving}
            className={classNames(
              "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
              !statusUser || saving
                ? "bg-gray-300 cursor-not-allowed"
                : statusNextActive
                ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400"
                : "bg-rose-600 hover:bg-rose-700 focus:ring-rose-400"
            )}
            type="button"
          >
            {saving ? "Updating…" : "Confirm"}
          </button>
        </div>
      </Modal>

      {/* Force Logout Modal */}
      <Modal
        open={forceLogoutOpen}
        title={forceLogoutUser ? `Force Logout — ${forceLogoutUser.username}` : "Force Logout"}
        subtitle="Active Session Control"
        variant="danger"
        onClose={() => {
          setForceLogoutOpen(false);
          setForceLogoutUser(null);
        }}
      >
        <p className="text-sm text-gray-700">
          This will immediately invalidate active sessions for{" "}
          <span className="font-semibold">{forceLogoutUser?.username || "this user"}</span>.
          They will be required to log in again.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              setForceLogoutOpen(false);
              setForceLogoutUser(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={doForceLogout}
            disabled={!forceLogoutUser || saving}
            className={classNames(
              "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
              !forceLogoutUser || saving
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-violet-700 hover:bg-violet-800 focus:ring-violet-400"
            )}
            type="button"
          >
            {saving ? "Logging out…" : "Force logout"}
          </button>
        </div>
      </Modal>

      {/* Toast */}
      <Toast
        show={toast.show}
        type={toast.type}
        onHide={() => setToast((t) => ({ ...t, show: false }))}
      >
        {toast.msg}
      </Toast>
    </div>
  );
}

export default Userstable;
