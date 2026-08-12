// src/admin/ManagementTable.jsx
import React, { useState, useEffect, useMemo } from "react";
import { BASE_URL } from "../utils/config";
import ModalShell from "../components/ModalShell";
import SettingsHeader from "../components/SettingsHeader";
import Select from "react-select";

/* ---------- tiny helpers ---------- */
const classNames = (...c) => c.filter(Boolean).join(" ");
const normRole = (r) => String(r || "").trim().toLowerCase();

const getInitials = (name) => {
  if (!name) return "??";
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = parts.map((p) => p[0]).join("");
  return initials.toUpperCase() || "??";
};

// ✅ Roles that can have MULTIPLE occupants.
const isMultiRole = (role) =>
  role === "Super Admin" || role === "AFD Special Access";

const SECTION_GROUPS = [
  {
    id: "leadership",
    label: "Leadership",
    kicker: "Leadership",
    description: "Executive roles that guide approvals and policy.",
    roles: ["Regional Director", "Assistant Regional Director", "AFD", "TOD"],
    Icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
        <path d="M4 20a8 8 0 0 1 16 0" />
        <path d="M12 2l1.6 2.9 3.2.6-2.3 2.3.5 3.2L12 9.8 9 11l.5-3.2-2.3-2.3 3.2-.6L12 2z" />
      </svg>
    ),
  },
  {
    id: "provincial-officers",
    label: "Provincial Officers",
    kicker: "Provincial Officers",
    description: "Assigned officers per province for inventory coordination.",
    roles: [
      "Cagayan Provincial Officer",
      "Isabela Provincial Officer",
      "Batanes Provincial Officer",
      "Nueva Vizcaya Provincial Officer",
      "Quirino Provincial Officer",
    ],
    Icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
        <path d="M3 10h18" />
        <path d="M3 14h18" />
        <path d="M6 6h12" />
        <path d="M6 18h12" />
      </svg>
    ),
  },
  {
    id: "inventory-management",
    label: "Inventory Management",
    kicker: "Inventory Management",
    description: "Operational roles for inventory processing and oversight.",
    roles: ["Inventory Admin", "Accountant", "AFD Special Access"],
    Icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
        <path d="M4 7h16v10H4z" />
        <path d="M4 7l8-4 8 4" />
        <path d="M9 12h6" />
      </svg>
    ),
  },
  {
    id: "super-admins",
    label: "Super Admins",
    kicker: "Super Admins",
    description: "Top-level administrators with full system access.",
    roles: ["Super Admin"],
    Icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
        <path d="M12 2l3 6 6 .8-4.4 4.2 1 6L12 16l-5.6 3 1-6L3 8.8 9 8z" />
      </svg>
    ),
  },
];

const OccupantPill = ({ user, onRemove, disabled }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
    <span className="max-w-[140px] truncate">{user.username}</span>
    <button
      onClick={() => onRemove(user)}
      disabled={disabled}
      className={classNames(
        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
        disabled
          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
          : "bg-red-50 text-red-600 hover:bg-red-100"
      )}
      title={`Remove ${user.username}`}
      aria-label={`Remove ${user.username}`}
    >
      ×
    </button>
  </span>
);

const OccupantCard = ({ user, onRemove, disabled }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
          {getInitials(user.username)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">
            {user.username}
          </div>
          <div className="truncate text-xs text-slate-500">
            {user.email || "No email"}
          </div>
        </div>
      </div>
      <button
        onClick={() => onRemove(user)}
        disabled={disabled}
        className={classNames(
          "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:flex-shrink-0",
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : "bg-red-600 text-white hover:bg-red-700 focus:ring-red-400"
        )}
      >
        Remove
      </button>
    </div>
  </div>
);

function RoleRow({ role, occupants, onAssignOpen, onRequestRemove, savingRole }) {
  const isBusy = savingRole === role;
  const hasAny = occupants.length > 0;
  const multi = isMultiRole(role);
  const first = occupants[0];
  const isCardRole = role === "Super Admin" || role === "AFD Special Access";

  if (multi) {
    return (
      <div className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              {role}
            </div>
            <button
              onClick={() => onAssignOpen(role)}
              disabled={isBusy}
              className={classNames(
                "inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
                isBusy
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-400"
              )}
            >
              Add
            </button>
          </div>

          {hasAny ? (
            isCardRole ? (
              <div
                className={classNames(
                  "grid gap-3",
                  role === "Super Admin" ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"
                )}
              >
                {occupants.map((u) => (
                  <OccupantCard
                    key={u._id}
                    user={u}
                    onRemove={(usr) => onRequestRemove(usr, role)}
                    disabled={isBusy}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {occupants.map((u) => (
                  <OccupantPill
                    key={u._id}
                    user={u}
                    onRemove={(usr) => onRequestRemove(usr, role)}
                    disabled={isBusy}
                  />
                ))}
              </div>
            )
          ) : (
            <span className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2 text-xs font-medium text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Vacant
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-[240px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            {role}
          </div>
          {hasAny ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white">
                {getInitials(first.username)}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{first.username}</div>
                <div className="text-xs text-slate-500">
                  {first.email || first.position || "No details"}
                </div>
              </div>
            </div>
          ) : (
            <span className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2 text-xs font-medium text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Vacant
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onAssignOpen(role)}
            disabled={isBusy}
            className={classNames(
              "inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
              isBusy
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-400"
            )}
          >
            {multi ? "Add" : hasAny ? "Change" : "Assign"}
          </button>
          {!multi && (
            <button
              onClick={() => hasAny && onRequestRemove(first, role)}
              disabled={!hasAny || isBusy}
              className={classNames(
                "inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
                !hasAny || isBusy
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700 focus:ring-red-400"
              )}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- nice modal shell ---------- */
function Modal({
  open,
  title,
  children,
  onClose,
  subtitle = "Role Management",
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
      <div className="text-sm text-gray-800">{children}</div>
    </ModalShell>
  );
}

/* ---------- Toast (Tailwind v2-safe colors) ---------- */
function Toast({ show, type = "success", children, onHide }) {
  if (!show) return null;

  const bg =
    type === "success"
      ? "bg-green-600"
      : type === "error"
      ? "bg-red-600"
      : "bg-gray-800";

  const iconPath =
    type === "success"
      ? "M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z"
      : type === "error"
      ? "M10 9.293l4.146-4.147a1 1 0 10-1.414-1.414L8.586 7.879 4.439 3.732A1 1 0 003.025 5.146L7.172 9.293 3.025 13.44a1 1 0 101.414 1.414L8.586 10.707l4.146 4.147a1 1 0 001.414-1.414L10 9.293z"
      : "M9 2a7 7 0 100 14A7 7 0 009 2zm0 3a1 1 0 110 2A1 1 0 019 5zm1 3a1 1 0 00-2 0v4a1 1 0 102 0V8z";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={classNames(
          "max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-xl border border-white border-opacity-10 flex items-start gap-3 transform transition-all duration-200",
          bg
        )}
        role="alert"
        aria-live="assertive"
      >
        <div className="mt-0.5 flex-shrink-0">
          <svg className="h-5 w-5" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
            <path d={iconPath} />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium">{children}</p>
        </div>
        <button
          onClick={onHide}
          className="ml-2 rounded-md bg-black bg-opacity-20 px-2 py-1 text-xs font-semibold hover:bg-opacity-30"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   ===============  MAIN MANAGEMENT TABLE  =================
   ========================================================= */
function ManagementTable() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRole, setAssignRole] = useState("");
  // Always store as array
  const [assignSelectedUsers, setAssignSelectedUsers] = useState([]);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeRole, setRemoveRole] = useState("");

  const [savingRole, setSavingRole] = useState("");
  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTION_GROUPS[0]?.id || "");

  const getScrollContainer = () =>
    document.querySelector('[data-scroll-container="users"]');

  /* ---- reusable fetch for latest users ---- */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BASE_URL}/users`, { credentials: "include" });
      if (res.status === 403) {
        throw new Error("Access denied. You do not have permission to view users.");
      }
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  /* ---- initial fetch ---- */
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && SECTION_GROUPS.some((section) => section.id === hash)) {
      setActiveSection(hash);
    }
  }, []);

  useEffect(() => {
    const sections = SECTION_GROUPS.map((section) =>
      document.getElementById(section.id)
    ).filter(Boolean);

    if (!sections.length) return () => {};

    const scrollContainer = getScrollContainer();
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;
        const best = visible.sort(
          (a, b) => b.intersectionRatio - a.intersectionRatio
        )[0];
        if (best?.target?.id) {
          setActiveSection(best.target.id);
        }
      },
      {
        root: scrollContainer || null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: [0.2, 0.6],
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sections = SECTION_GROUPS.map((section) =>
      document.getElementById(section.id)
    ).filter(Boolean);

    if (!sections.length) return () => {};

    const scrollContainer = getScrollContainer();
    let rafId = null;
    const updateActive = () => {
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
      const containerTop = scrollContainer
        ? scrollContainer.getBoundingClientRect().top
        : 0;
      const scrollPos = scrollTop + 160;
      let current = sections[0];
      for (const section of sections) {
        const sectionTop =
          section.getBoundingClientRect().top -
          containerTop +
          scrollTop;
        if (sectionTop <= scrollPos) {
          current = section;
        }
      }
      if (current?.id) setActiveSection(current.id);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        updateActive();
        rafId = null;
      });
    };

    const scrollTarget = scrollContainer || window;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateActive();

    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handleNavClick = (id) => (event) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      const scrollContainer = getScrollContainer();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
      setActiveSection(id);
      if (scrollContainer) {
        window.requestAnimationFrame(() => {
          scrollContainer.dispatchEvent(new Event("scroll"));
        });
      }
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, msg });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  };

  /* ---- map roles to current occupants (safe casing) ---- */
  const occupantsForRole = (role) => {
    const r = normRole(role);
    const matches = users.filter((u) => normRole(u.role) === r);
    return isMultiRole(role) ? matches : matches.slice(0, 1);
  };

  /* ---- ONLY employees are eligible for assignment ---- */
  const eligibleUsers = useMemo(() => users, [users]);

  /* ---- options for react-select (employees only) ---- */
  const userOptions = useMemo(
    () =>
      eligibleUsers.map((u) => ({
        value: u._id,
        label: `${u.username}${u.email ? ` — ${u.email}` : ""}`,
      })),
    [eligibleUsers]
  );

  /* ---- handlers: open assign / remove ---- */
  const handleAssignOpen = (role) => {
    setAssignRole(role);
    setAssignSelectedUsers([]);
    setAssignOpen(true);
  };

  const handleRemoveOpen = (user, role) => {
    if (!user) return;
    setRemoveTarget(user);
    setRemoveRole(role);
    setRemoveOpen(true);
  };

  /* ---- API helpers ---- */
  const saveUser = async (u) => {
    const res = await fetch(`${BASE_URL}/users/${u._id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...u, __v: u.__v }),
    });
    if (res.status === 403) {
      throw new Error("Access denied. You do not have permission to edit users.");
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || "Failed to update user");
    }
    return res.json();
  };

  /* ---- confirm assign ---- */
  const confirmAssign = async () => {
    if (!assignRole) return;

    const multi = isMultiRole(assignRole);

    const selectedIds = multi
      ? (assignSelectedUsers || []).map((o) => o.value)
      : assignSelectedUsers[0]?.value
      ? [assignSelectedUsers[0].value]
      : [];

    if (!selectedIds.length) {
      showToast("Please select at least one user.", "error");
      return;
    }

    setSavingRole(assignRole);
    try {
      if (multi) {
        const currentOccupants = users.filter(
          (u) => normRole(u.role) === normRole(assignRole)
        );
        const currentIds = new Set(currentOccupants.map((u) => u._id));

        const toAddIds = selectedIds.filter((id) => !currentIds.has(id));

        if (!toAddIds.length) {
          showToast(
            `No changes — all selected users are already "${assignRole}".`,
            "info"
          );
        } else {
          for (const id of toAddIds) {
            const u = users.find((x) => x._id === id);
            if (!u) continue;
            await saveUser({ ...u, role: assignRole });
          }

          showToast(
            `${
              assignRole === "Super Admin" ? "Super Admin list" : `"${assignRole}" role`
            } updated for ${toAddIds.length} ${
              toAddIds.length > 1 ? "users" : "user"
            }.`,
            "success"
          );
        }
      } else {
        const newId = selectedIds[0];
        const selectedUser = users.find((u) => u._id === newId);
        if (!selectedUser) throw new Error("Selected user not found");

        const currentOccupants = users.filter(
          (u) => normRole(u.role) === normRole(assignRole) && u._id !== newId
        );

        // If already assigned to that same user
        const already = users.find(
          (u) => normRole(u.role) === normRole(assignRole) && u._id === newId
        );
        if (already) {
          showToast(
            `${assignRole} is already assigned to ${selectedUser.username}.`,
            "info"
          );
          setAssignOpen(false);
          await fetchUsers();
          return;
        }

        // Unassign ALL current occupants of this single role (fixes duplicates)
        for (const occ of currentOccupants) {
          await saveUser({ ...occ, role: "employee" });
        }

        // Assign to new user
        await saveUser({ ...selectedUser, role: assignRole });

        showToast(`Assigned "${assignRole}" to ${selectedUser.username}.`, "success");
      }

      setAssignOpen(false);
      await fetchUsers();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      showToast(e.message || "Failed to assign role", "error");
    } finally {
      setSavingRole("");
    }
  };

  /* ---- remove role from user ---- */
  const onRemoveUserFromRole = async (user, role) => {
    if (!user) return;
    setSavingRole(role);
    try {
      await saveUser({ ...user, role: "employee" });
      showToast(
        `Removed "${role}" from ${user.username}. They are now "employee".`,
        "success"
      );
      await fetchUsers();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      showToast(e.message || "Failed to remove role", "error");
    } finally {
      setSavingRole("");
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await onRemoveUserFromRole(removeTarget, removeRole);
    setRemoveOpen(false);
  };

  if (error)
    return (
      <div className="px-6 pt-10 text-sm text-red-600">
        Error: {error.message}
      </div>
    );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-slate-50 w-full sm:px-6 pt-8">
      <SettingsHeader
        crumbs={[
          { label: "Users", to: "/userdashboard" },
          { label: "Management" },
        ]}
        title="Management Roles"
        subtitle="Assign leadership, forwarding, and monitoring coverage."
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Coverage Sections
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchUsers}
            className="table-button-primary"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="lg:sticky lg:top-24 h-fit">
          <div className="rounded-3xl border border-slate-200/70 bg-white/95 p-3 shadow-md">
            <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {SECTION_GROUPS.map((section) => {
                const active = activeSection === section.id;
                const Icon = section.Icon;
                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={handleNavClick(section.id)}
                    aria-current={active ? "true" : "false"}
                    className={classNames(
                      "group flex items-center gap-3 rounded-2xl border px-3 py-2 text-[13px] font-semibold leading-tight transition",
                      active
                        ? "border-slate-900/20 bg-slate-900/10 text-slate-900 shadow-sm"
                        : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span
                      className={classNames(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border",
                        active
                          ? "border-slate-900/20 bg-white text-slate-900"
                          : "border-slate-200 bg-white text-slate-400 group-hover:text-slate-600"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1 break-words">{section.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="relative space-y-6">
          {SECTION_GROUPS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 px-6 py-5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-400">
                      {section.kicker}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">
                      {section.label}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {section.description}
                    </p>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">
                    <span className="inline-flex h-2 w-2 rounded-full bg-slate-300" />
                    {section.roles.length} roles
                  </div>
                </div>
                <div className="divide-y divide-slate-200/70 px-6 py-5">
                  {section.roles.map((role) => {
                    const occ = occupantsForRole(role);
                    return (
                      <RoleRow
                        key={role}
                        role={role}
                        occupants={occ}
                        onAssignOpen={handleAssignOpen}
                        onRequestRemove={handleRemoveOpen}
                        savingRole={savingRole}
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          ))}

          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <span>Refreshing roles…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal
        open={assignOpen}
        title={`Assign ${assignRole}`}
        subtitle="Role Assignment"
        onClose={() => setAssignOpen(false)}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="selectUser" className="block text-sm font-medium text-gray-700">
              {isMultiRole(assignRole) ? "Select Users" : "Select User"}
            </label>

            <Select
              inputId="selectUser"
              value={isMultiRole(assignRole) ? assignSelectedUsers : assignSelectedUsers[0] || null}
              onChange={(value) => {
                if (isMultiRole(assignRole)) {
                  setAssignSelectedUsers(value || []);
                } else {
                  setAssignSelectedUsers(value ? [value] : []);
                }
              }}
              options={userOptions}
              className="mt-1"
              placeholder={
                userOptions.length
                  ? isMultiRole(assignRole)
                    ? "Search and select users…"
                    : "Search user…"
                  : "No available users to assign"
              }
              isMulti={isMultiRole(assignRole)}
              closeMenuOnSelect={!isMultiRole(assignRole)}
              isDisabled={userOptions.length === 0}
              noOptionsMessage={() => "No available users."}
            />

            <p className="mt-2 text-xs text-gray-500">
              {isMultiRole(assignRole)
                ? `You can add multiple "${assignRole}" users. Existing assignments will be kept.`
                : `Assigning a new user will automatically unassign ALL current "${assignRole}" holders (if any), and set them back to "employee".`}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setAssignOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmAssign}
              disabled={!assignSelectedUsers || assignSelectedUsers.length === 0 || !!savingRole}
              className={classNames(
                "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
                !assignSelectedUsers || assignSelectedUsers.length === 0 || !!savingRole
                  ? "bg-indigo-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400"
              )}
            >
              {savingRole ? "Saving…" : isMultiRole(assignRole) ? "Add" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove Modal */}
      <Modal
        open={removeOpen}
        title={`Remove ${removeRole}`}
        subtitle="Danger Zone"
        variant="danger"
        onClose={() => setRemoveOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            You are about to remove the <span className="font-semibold">"{removeRole}"</span> role from{" "}
            <span className="font-semibold">{removeTarget ? removeTarget.username : ""}</span>. Their role will be set back
            to <span className="font-semibold">"employee"</span>.
          </p>
          <p className="text-sm text-red-600 font-medium">Are you sure you want to continue?</p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setRemoveOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmRemove}
              disabled={!removeTarget || !!savingRole}
              className={classNames(
                "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
                !removeTarget || !!savingRole
                  ? "bg-red-300 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 focus:ring-red-400"
              )}
            >
              {savingRole ? "Removing…" : "Yes, remove"}
            </button>
          </div>
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

export default ManagementTable;
