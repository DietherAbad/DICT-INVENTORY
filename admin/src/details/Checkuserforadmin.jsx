// src/details/Checkuserforadmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalShell from "../components/ModalShell";
import EmployeeAssetSticker from "../components/EmployeeAssetSticker";
import CreatableSelect from "react-select/creatable";
import Select from "react-select";
import { BASE_URL } from "../utils/config";
import usericon from "../assets/profile-icon.png";
import { useProjects } from "../utils/projects";
import { useDesignations } from "../utils/designations";

/* ----------------------------- UI helpers ----------------------------- */
const classNames = (...c) => c.filter(Boolean).join(" ");

function Modal({
  open,
  title,
  children,
  onClose,
  disableBackdropClose = false,
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
      disableBackdropClose={disableBackdropClose}
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
          "max-w-sm rounded-2xl px-4 py-3 text-sm text-white shadow-xl border border-white/10 flex items-start gap-3 transform transition-all duration-200",
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
          className="ml-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/20"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-800/40 bg-slate-900/95 shadow-2xl px-6 sm:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-40 rounded bg-slate-700" />
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-full bg-slate-700" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-72 rounded bg-slate-700" />
              <div className="h-4 w-56 rounded bg-slate-700" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
                <div className="h-4 w-2/3 rounded bg-slate-700" />
                <div className="mt-3 h-4 w-1/2 rounded bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- data config ----------------------------- */
const ROLE_OPTIONS = [
  "Super Admin",
  "Inventory Admin",
  "Regional Director",
  "Assistant Regional Director",
  "AFD",
  "AFD Special Access",
  "Accountant",
  "TOD",
  "Cagayan Provincial Officer",
  "Isabela Provincial Officer",
  "Batanes Provincial Officer",
  "Nueva Vizcaya Provincial Officer",
  "Quirino Provincial Officer",
];

const MULTI_ROLES = ["Super Admin", "AFD Special Access"];
const isMultiRole = (role) => MULTI_ROLES.includes(role);

// Position (searchable + custom) — government-style presets
const POSITION_OPTIONS = [
  "Regional Director IV",
  "Assistant Regional Director",
  "Division Chief",
  "Chief Administrative Officer",
  "Administrative Officer II",
  "Administrative Officer III",
  "Administrative Officer IV",
  "Administrative Assistant I",
  "Administrative Assistant II",
  "Project Development Officer I",
  "Project Development Officer II",
  "Project Development Officer III",
  "Information Systems Analyst I",
  "Information Systems Analyst II",
  "Information Technology Officer I",
  "Information Technology Officer II",
  "Information Technology Officer III",
  "Computer Programmer I",
  "Computer Programmer II",
  "Engineer II",
  "Accountant I",
  "Accountant II",
  "Budget Officer",
  "Cashier",
  "Clerk",
  "Driver",
];

const toOption = (v) => ({ value: v, label: v });
const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderColor: state.isFocused ? "#cbd5f5" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(203, 213, 245, 0.6)" : "none",
    borderRadius: 14,
    minHeight: 42,
    ":hover": { borderColor: "#cbd5f5" },
  }),
  menu: (base) => ({ ...base, borderRadius: 12, overflow: "hidden" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "rgba(79, 70, 229, 0.10)"
      : state.isFocused
      ? "rgba(99, 102, 241, 0.08)"
      : "white",
    color: "#111827",
  }),
};

/* ----------------------------- password helpers ----------------------------- */
const validByRegisterRules = (pw) => {
  if (!pw) return false;
  const hasLen = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
  return hasLen && hasUpper && hasNumber && hasSpecial;
};

const passwordScore = (pw) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return Math.min(score, 5);
};

const passwordBarClass = (score) => {
  switch (score) {
    case 0:
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-yellow-500";
    case 3:
      return "bg-green-500";
    case 4:
    case 5:
      return "bg-green-600";
    default:
      return "bg-gray-300";
  }
};

const LockIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M7 11V8a5 5 0 0110 0v3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <rect
      x="5"
      y="11"
      width="14"
      height="9"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle cx="12" cy="15.5" r="1" fill="currentColor" />
  </svg>
);

/* ----------------------------- main component ----------------------------- */
export default function Checkuserforadmin() {
  const { id } = useParams();

  const [userData, setUserData] = useState(null);

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    position: "",
    designation: "",
    project: "",
    role: "",
    active: true,
  });

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // UX
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [toast, setToast] = useState({ show: false, type: "success", msg: "" });

  // Password modal (admin sets NEW password only; no current password)
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwForm, setPwForm] = useState({ next: "", confirm: "" });
  const [pwShow, setPwShow] = useState({ next: false, confirm: false });

  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, msg });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 2600);
  };

  // fetch user
  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${BASE_URL}/users/${id}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();

        if (cancel) return;
        setUserData(data);
        setForm({
          displayName: data.username ?? "",
          email: data.email ?? "",
          position: data.position ?? "",
          designation: data.designation ?? "",
          project: data.project ?? "",
          role: data.role ?? "",
          active: data.active !== false,
        });
      } catch (e) {
        if (!cancel) setError(e.message || "Failed to fetch user data.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [id]);

  const isDirty = useMemo(() => {
    if (!userData) return false;
    return (
      form.displayName !== (userData.username ?? "") ||
      form.email !== (userData.email ?? "") ||
      form.position !== (userData.position ?? "") ||
      form.designation !== (userData.designation ?? "") ||
      form.project !== (userData.project ?? "") ||
      form.role !== (userData.role ?? "") ||
      form.active !== (userData.active !== false)
    );
  }, [form, userData]);

  const roleOptions = useMemo(() => ROLE_OPTIONS.map(toOption), []);
  const { projects } = useProjects({ activeOnly: false });
  const projectOptions = useMemo(() => unique(projects).map(toOption), [projects]);
  const { designations } = useDesignations({ activeOnly: false });
  const designationOptions = useMemo(
    () => unique(designations).map(toOption),
    [designations]
  );

  const currentRole = userData?.role ?? "";
  const selectedRoleOpt = form.role ? toOption(form.role) : null;
  const selectedProjectOpt = form.project ? toOption(form.project) : null;
  const selectedDesignationOpt = form.designation ? toOption(form.designation) : null;

  const resetEditing = () => {
    if (!userData) return;
    setForm({
      displayName: userData.username ?? "",
      email: userData.email ?? "",
      position: userData.position ?? "",
      designation: userData.designation ?? "",
      project: userData.project ?? "",
      role: userData.role ?? "",
      active: userData.active !== false,
    });
    setIsEditing(false);
    setError(null);
  };

  // role single-occupant enforcement (except MULTI_ROLES)
  const enforceSingleOccupantRole = async (newRole) => {
    if (!newRole) return;
    if (isMultiRole(newRole)) return;
    if (!userData?._id) return;

    const resUsers = await fetch(`${BASE_URL}/users`);
    if (!resUsers.ok) {
      const txt = await resUsers.text().catch(() => "");
      throw new Error(txt || "Failed to fetch users for role update.");
    }

    const allUsers = await resUsers.json();
    const othersWithRole = Array.isArray(allUsers)
      ? allUsers.filter((u) => u.role === newRole && u._id !== userData._id)
      : [];

    for (const u of othersWithRole) {
      const demotePayload = { ...u, role: "employee", __v: u.__v };
      const demoteRes = await fetch(`${BASE_URL}/users/${u._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demotePayload),
      });
      if (!demoteRes.ok) {
        const msg = await demoteRes.text().catch(() => "");
        throw new Error(msg || `Failed to demote previous ${newRole}.`);
      }
    }
  };

  const onSaveProfile = async () => {
    setConfirmOpen(false);
    setSaving(true);
    setError(null);

    try {
      const newRole = form.role;
      if (newRole && newRole !== currentRole) {
        await enforceSingleOccupantRole(newRole);
      }

      const payload = {
        username: (form.displayName || "").trim(),
        email: (form.email || "").trim(),
        position: form.position || "",
        designation: form.designation || "",
        project: form.project || "",
        role: form.role || "",
        active: form.active === true,
        __v: userData?.__v,
      };

      const res = await fetch(`${BASE_URL}/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to update user");
      }

      const updated = await res.json();
      setUserData(updated);
      setForm({
        displayName: updated.username ?? "",
        email: updated.email ?? "",
        position: updated.position ?? "",
        designation: updated.designation ?? "",
        project: updated.project ?? "",
        role: updated.role ?? "",
        active: updated.active !== false,
      });

      setIsEditing(false);

      if (newRole && !isMultiRole(newRole) && newRole !== currentRole) {
        showToast(`User updated. Previous "${newRole}" is now "employee".`, "success");
      } else {
        showToast("User updated successfully.", "success");
      }
    } catch (e) {
      setError(e.message || "Failed to update user.");
      showToast("Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const validateNewPassword = (next, confirm) => {
    if (!next || !confirm) return "Please fill in both password fields.";
    if (next !== confirm) return "New password and confirmation do not match.";
    if (!validByRegisterRules(next)) {
      return "Must be 8+ chars and include an uppercase letter, a number, and a special character.";
    }
    return "";
  };

  const onApplyNewPassword = async () => {
    setPwError("");
    const err = validateNewPassword(pwForm.next, pwForm.confirm);
    if (err) {
      setPwError(err);
      return;
    }

    setPwSaving(true);
    setError(null);

    try {
      // safest: include existing fields so backend doesn't null anything
      const payload = {
        username: (form.displayName || "").trim(),
        email: (form.email || "").trim(),
        position: form.position || "",
        designation: form.designation || "",
        project: form.project || "",
        role: form.role || "",
        active: form.active === true,
        password: pwForm.next,
        adminReset: true,
        __v: userData?.__v,
      };

      const res = await fetch(`${BASE_URL}/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to reset password.");
      }

      await res.json().catch(() => ({}));
      setPwOpen(false);
      setPwForm({ next: "", confirm: "" });
      setPwShow({ next: false, confirm: false });
      showToast("Password updated successfully.", "success");
    } catch (e) {
      setPwError(e.message || "Failed to reset password.");
      showToast("Password update failed.", "error");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <Skeleton />;

  if (!userData) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full bg-white/90 rounded-3xl shadow-sm border border-slate-200/80 p-6 text-center">
          <p className="text-sm text-gray-700 font-semibold mb-1">User not found.</p>
          <p className="text-xs text-gray-500 mb-4">Please return to the previous page.</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  const displayName = userData.username || "—";
  const displayRole = userData.role || userData.position || "User";
  const displayProject = userData.project || "";
  const displayDesignation = userData.designation || "";
  const isActive = userData.active !== false;
  const statusLabel = isActive ? "Active" : "Inactive";

  const pwScore = passwordScore(pwForm.next);
  const pwPct = [15, 30, 50, 75, 100][Math.max(0, Math.min(pwScore - 1, 4))] || 0;
  const pwLabel = ["Too weak", "Weak", "Fair", "Good", "Strong", "Excellent"][Math.min(pwScore, 5)];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl mx-auto bg-white/90 rounded-3xl shadow-sm border border-slate-200/80 px-5 sm:px-8 py-6 sm:py-8">
        <div className="mb-6 h-1.5 w-12 rounded-full bg-slate-900" />
        {/* Back + Breadcrumb */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Breadcrumbs
            items={[
              { label: "Dashboard", to: "/" },
              { label: "User Management", to: "/userdashboard" },
              { label: "User Details" },
            ]}
          />

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-400">
            <span
              className={classNames(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              )}
            >
              <span
                className={classNames(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-500" : "bg-rose-500"
                )}
              />
              {statusLabel}
            </span>
            <span>{displayRole}</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 mb-8">
          <div className="relative">
            <img
              src={usericon}
              alt="User avatar"
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-slate-100 object-cover shadow-sm"
            />
            <span
              className={classNames(
                "absolute bottom-0 right-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white",
                isActive ? "bg-emerald-600" : "bg-rose-600"
              )}
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M6 10.5l2.5 2.5L14 7.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">Loaded</span>
            </span>
          </div>

          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{displayName}</h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {displayRole}
              {displayProject && ` • ${displayProject}`}
            </p>
            {displayDesignation && (
              <p className="text-xs text-gray-500">{displayDesignation}</p>
            )}
          </div>

          <div className="flex-1" />

          <div className="sm:hidden flex items-center gap-2 text-[10px] text-gray-400">
            <span
              className={classNames(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              )}
            >
              <span
                className={classNames(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-500" : "bg-rose-500"
                )}
              />
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                User information
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500">
                Update profile, assignment, and organizational metadata for this account.
              </p>
            </div>

            {isEditing ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[9px] font-semibold text-amber-700">
                Editing
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-semibold text-emerald-700">
                Synced
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            {/* Display Name */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">
                Display Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {userData.username || "—"}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {userData.email || "—"}
                </div>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Role</label>
              {isEditing ? (
                <>
                  <div className="mt-1">
                    <Select
                      value={selectedRoleOpt}
                      onChange={(opt) => setForm((f) => ({ ...f, role: opt?.value || "" }))}
                      options={roleOptions}
                      isClearable
                      placeholder="Select role…"
                      styles={selectStyles}
                    />
                  </div>

                  {!!form.role && !isMultiRole(form.role) && (
                    <p className="mt-2 text-xs text-amber-600">
                      Note: Only one user can be{" "}
                      <span className="font-semibold">{form.role}</span>. Any existing holder
                      will automatically become <span className="font-semibold">employee</span>.
                    </p>
                  )}

                  {!!form.role && isMultiRole(form.role) && (
                    <p className="mt-2 text-xs text-emerald-600">
                      This role allows multiple occupants. Existing{" "}
                      <span className="font-semibold">{form.role}</span> users will not be removed.
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {userData.role || "—"}
                </div>
              )}
            </div>

            {/* Account Status */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Account status</label>
              {isEditing ? (
                <select
                  value={form.active ? "active" : "inactive"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.value === "active" }))
                  }
                  className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <span
                    className={classNames(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    )}
                  >
                    <span
                      className={classNames(
                        "h-1.5 w-1.5 rounded-full",
                        isActive ? "bg-emerald-500" : "bg-rose-500"
                      )}
                    />
                    {statusLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Project / Station */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">
                Project / Station
              </label>
              {isEditing ? (
                <div className="mt-1">
                  <CreatableSelect
                    value={selectedProjectOpt}
                    onChange={(opt) => setForm((f) => ({ ...f, project: opt?.value || "" }))}
                    options={projectOptions}
                    isClearable
                    placeholder="Search or type a project/station…"
                    styles={selectStyles}
                  />
                </div>
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                  {userData.project || "—"}
                </div>
              )}
              {isEditing && (
                <p className="mt-2 text-xs text-gray-500">
                  Search from presets (e.g., Free WiFi, GovNet, eLGU, AFD Cashier) or type a custom station.
                </p>
              )}
            </div>

            {/* Position */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Position</label>
              {isEditing ? (
                <div className="mt-1">
                  <input
                    type="text"
                    value={form.position || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, position: e.target.value }))
                    }
                    placeholder="Enter position"
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                  {userData.position || "—"}
                </div>
              )}
            </div>

            {/* Designation / Office */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">
                Designation / Office
              </label>
              {isEditing ? (
                <div className="mt-1">
                  <CreatableSelect
                    value={selectedDesignationOpt}
                    onChange={(opt) =>
                      setForm((f) => ({ ...f, designation: opt?.value || "" }))
                    }
                    options={designationOptions}
                    isClearable
                    placeholder="Search or type an office…"
                    styles={selectStyles}
                  />
                </div>
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                  {userData.designation || "—"}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Security */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPwOpen(true);
                  setPwError("");
                  setPwForm({ next: "", confirm: "" });
                  setPwShow({ next: false, confirm: false });
                }}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
              >
                <LockIcon className="h-4 w-4" />
                Reset password
              </button>
              <EmployeeAssetSticker
                employeeId={userData._id}
                name={userData.username}
                position={userData.position}
              />
            </div>

            {/* Right: Edit/Save */}
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!isDirty || saving}
                    className={classNames(
                      "inline-flex items-center rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
                      !isDirty || saving
                        ? "bg-slate-300 cursor-not-allowed"
                        : "bg-slate-900 hover:bg-slate-800"
                    )}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={resetEditing}
                    disabled={saving}
                    className={classNames(
                      "inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setError(null);
                  }}
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                >
                  Edit profile
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm dialog (profile save) */}
      <Modal
        open={confirmOpen}
        title="Save changes"
        subtitle="Profile Update"
        onClose={() => !saving && setConfirmOpen(false)}
        disableBackdropClose={saving}
      >
        <p className="text-sm text-gray-700">
          Are you sure you want to save your changes to this user’s profile?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            disabled={saving}
            className={classNames(
              "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
              saving && "opacity-60 cursor-not-allowed"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveProfile}
            disabled={saving}
            className={classNames(
              "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
              saving && "opacity-80 cursor-wait"
            )}
          >
            {saving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </Modal>

      {/* Reset Password Modal (NO current password required) */}
      <Modal
        open={pwOpen}
        title="Reset user password"
        subtitle="Security Action"
        variant="warning"
        onClose={() => !pwSaving && setPwOpen(false)}
        disableBackdropClose={pwSaving}
      >
        {pwError && (
          <div className="mb-4 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
            {pwError}
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
          You are setting a new password for{" "}
          <span className="font-semibold">{form.displayName || userData.username}</span>. No current
          password is required for admin reset.
        </div>

        {/* New Password */}
        <div className="mb-3">
          <label className="block text-[11px] font-medium text-gray-700">New password</label>
          <div className="mt-1 relative">
            <input
              type={pwShow.next ? "text" : "password"}
              value={pwForm.next}
              onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
              className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Must be 8+ chars with A, 1, *"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setPwShow((s) => ({ ...s, next: !s.next }))}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 focus:outline-none"
              title={pwShow.next ? "Hide" : "Show"}
            >
              {pwShow.next ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 3l18 18M10 6.5C10.64 6.18 11.31 6 12 6c4.418 0 8 3.582 9 6-.27.718-.68 1.444-1.21 2.14M7.5 9.5C6.03 10.45 4.83 11.68 4 12c.59 1.54 2.5 3.77 5.02 5.02M12 15a3 3 0 01-3-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </button>
          </div>

          {/* Strength meter */}
          <div className="mt-2">
            <div className="h-2 w-full bg-gray-200 rounded">
              <div
                className={`h-2 rounded ${passwordBarClass(pwScore)}`}
                style={{ width: `${pwPct}%`, transition: "width 200ms" }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-600">
              <span>Password strength: {pwLabel}</span>
              <span>8+ chars • A • 1 • *</span>
            </div>
          </div>
        </div>

        {/* Confirm New Password */}
        <div className="mb-1">
          <label className="block text-[11px] font-medium text-gray-700">
            Confirm new password
          </label>
          <div className="mt-1 relative">
            <input
              type={pwShow.confirm ? "text" : "password"}
              value={pwForm.confirm}
              onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setPwShow((s) => ({ ...s, confirm: !s.confirm }))}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 focus:outline-none"
              title={pwShow.confirm ? "Hide" : "Show"}
            >
              {pwShow.confirm ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 3l18 18M10 6.5C10.64 6.18 11.31 6 12 6c4.418 0 8 3.582 9 6-.27.718-.68 1.444-1.21 2.14M7.5 9.5C6.03 10.45 4.83 11.68 4 12c.59 1.54 2.5 3.77 5.02 5.02M12 15a3 3 0 01-3-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-gray-500">
          Must be 8+ characters and include an uppercase letter, a number, and a special character.
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPwOpen(false)}
            disabled={pwSaving}
            className={classNames(
              "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50",
              pwSaving && "opacity-60 cursor-not-allowed"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApplyNewPassword}
            disabled={pwSaving}
            className={classNames(
              "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
              pwSaving && "opacity-80 cursor-wait"
            )}
          >
            {pwSaving ? "Updating…" : "Update password"}
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
