// src/details/Checkuser.jsx
import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalShell from "../components/ModalShell";
import EmployeeAssetSticker from "../components/EmployeeAssetSticker";
import { AuthContext } from "../context/AuthContext";
import { BASE_URL } from "../utils/config";
import usericon from "../assets/profile-icon.png";

/* ----------------------------- UI helpers ----------------------------- */
const classNames = (...c) => c.filter(Boolean).join(" ");

function Modal({
  open,
  title,
  children,
  onClose,
  subtitle = "Profile Settings",
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
      ? "bg-green-600"
      : type === "error"
      ? "bg-red-600"
      : "bg-gray-800";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={classNames(
          "rounded-2xl px-4 py-3 text-white shadow-lg flex items-center gap-2 border border-white/10",
          color
        )}
      >
        <span className="font-medium text-sm">{children}</span>
        <button
          onClick={onHide}
          className="ml-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/20"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Page -------------------------------- */
export default function Checkuser() {
  const { user } = useContext(AuthContext);

  // Safely derive base values
  const baseUsername = user?.data?.username || "";
  const baseEmail = user?.data?.email || "";
  const basePosition = user?.data?.position || "";
  const baseRole = user?.data?.role || "";
  const baseProject = user?.data?.project || "";
  const baseDesignation = user?.data?.designation || "";
  const isActive = user?.data?.active !== false;
  const statusLabel = isActive ? "Active" : "Inactive";

  const [updatedData, setUpdatedData] = useState({
    username: baseUsername,
    email: baseEmail, // read-only in UI
  });

  const [isEditing, setIsEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({
    show: false,
    type: "success",
    msg: "",
  });

  // Reset Password modal state
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwForm, setPwForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [pwShow, setPwShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const showToast = (msg, type = "success") => {
    setToast({ show: true, type, msg });
    setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 2600);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Email is read-only; do not allow editing here
    if (name === "email") return;
    setUpdatedData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    setConfirmOpen(false);
    setSaving(true);
    setError(null);

    try {
      if (!user || !user.data?._id || !user.token) {
        throw new Error("User session invalid. Please log in again.");
      }

      const userId = user.data._id;
      const updates = {
        username: updatedData.username.trim(),
        email: baseEmail, // keep as-is (read-only)
        __v: user?.data?.__v,
      };

      const res = await fetch(`${BASE_URL}/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        let msg = "";
        try {
          msg = await res.text();
        } catch {
          // ignore
        }
        throw new Error(msg || "Failed to update user.");
      }

      await res.json();

      setIsEditing(false);
      setShowSuccessPopup(true);
      showToast("Profile updated successfully.");
    } catch (e) {
      setError(e.message || "Failed to update user. Please try again.");
      showToast("Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = updatedData.username !== baseUsername; // email is read-only

  const displayName = baseUsername || "—";
  const displayRole = baseRole || basePosition || "User";
  const displayProject = baseProject;
  const displayDesignation = baseDesignation;

  // ---- Password helpers (match Register’s rules) ----
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
    if (pw.length >= 12) score++; // bonus like in Register
    return Math.min(score, 5);
  };

  const passwordBarClass = (score) => {
    // Tailwind v2-safe colors
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

  const validateNewPassword = (current, next, confirm) => {
    if (!current || !next || !confirm) {
      return "Please fill in all password fields.";
    }
    if (next !== confirm) {
      return "New password and confirmation do not match.";
    }
    if (next === current) {
      return "New password must be different from current password.";
    }
    if (!validByRegisterRules(next)) {
      return "Must be 8+ chars and include an uppercase letter, a number, and a special character.";
    }
    return "";
  };

  /**
   * Try multiple backend conventions so it "just works":
   * 1) PUT /users/:id/password { currentPassword, newPassword }
   * 2) POST /auth/change-password { currentPassword, newPassword }
   * 3) PUT /users/:id { password: newPassword, currentPassword }  (fallback)
   */
  const handlePasswordChange = async () => {
    setPwError("");
    const err = validateNewPassword(pwForm.current, pwForm.next, pwForm.confirm);
    if (err) {
      setPwError(err);
      return;
    }

    if (!user?.token || !user?.data?._id) {
      setPwError("Session expired. Please sign in again.");
      return;
    }

    setPwSaving(true);
    const userId = user.data._id;

    const attempts = [
      // {
      //   url: `${BASE_URL}/users/${userId}/password`,
      //   method: "PUT",
      //   body: { currentPassword: pwForm.current, newPassword: pwForm.next },
      // },
      // {
      //   url: `${BASE_URL}/auth/change-password`,
      //   method: "POST",
      //   body: { currentPassword: pwForm.current, newPassword: pwForm.next },
      // },
      {
        url: `${BASE_URL}/users/${userId}`,
        method: "PUT",
        body: {
          password: pwForm.next,
          currentPassword: pwForm.current,
          __v: user?.data?.__v,
        },
      },
    ];

    try {
      let lastErr = "";
      for (const attempt of attempts) {
        try {
          const res = await fetch(attempt.url, {
            method: attempt.method,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify(attempt.body),
          });

          const maybeJson = await res
            .json()
            .catch(() => ({})); // some APIs return empty

          if (res.ok) {
            // success
            setPwOpen(false);
            setPwForm({ current: "", next: "", confirm: "" });
            showToast("Password updated successfully.");
            return;
          } else {
            // save last error message (if any) and try next pattern
            lastErr =
              maybeJson?.message ||
              (await res.text().catch(() => "")) ||
              `HTTP ${res.status}`;
          }
        } catch (e) {
          lastErr = e?.message || "Network error";
        }
      }
      throw new Error(lastErr || "Failed to change password.");
    } catch (e) {
      setPwError(e.message || "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  };

  if (!user || !user.data) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/90 rounded-3xl shadow-sm border border-slate-200/80 p-6 text-center">
          <p className="text-sm text-gray-700 font-semibold mb-1">
            You are not signed in.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Please log in again to manage your account details.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const score = passwordScore(pwForm.next);
  const scorePct = [15, 30, 50, 75, 100][Math.max(0, Math.min(score - 1, 4))] || 0;
  const scoreLabel = ["Too weak", "Weak", "Fair", "Good", "Strong", "Excellent"][
    Math.min(score, 5)
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl mx-auto bg-white/90 rounded-3xl shadow-sm border border-slate-200/80 px-5 sm:px-8 py-6 sm:py-8">
        <div className="mb-6 h-1.5 w-12 rounded-full bg-slate-900" />
        {/* Back + Breadcrumb */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Breadcrumbs
            items={[
              { label: "Dashboard", to: "/" },
              { label: "My Account" },
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

        {/* Header: Avatar + Basic Info */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 mb-8">
          <div className="relative">
            <img
              src={usericon}
              alt="User avatar"
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-slate-100 object-cover shadow-sm"
            />
            {/* Bigger, high-contrast check with white ring */}
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
              <span className="sr-only">Verified</span>
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

          {/* Compact status pill on small screens */}
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

        {!isActive && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Your account is inactive. Please contact the administrator for reactivation.
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                Profile information
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500">
                Update your basic information used across the Region 2 Inventory System.
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
            {/* Name */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="username"
                  value={updatedData.username}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              ) : (
                <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                  {baseUsername || "—"}
                </div>
              )}
            </div>

            {/* Position (read-only) */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Position</label>
              <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                {basePosition || "—"}
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={baseEmail}
                readOnly
                disabled
                className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-700 cursor-not-allowed"
                title="Email is managed by the administrator and cannot be changed here."
                aria-readonly="true"
              />
            </div>

            {/* Designation (read-only) */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Designation</label>
              <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                {displayDesignation || "—"}
              </div>
            </div>

            {/* Project (read-only) */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Project</label>
              <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                {displayProject || "—"}
              </div>
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Role</label>
              <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
                {baseRole || "—"}
              </div>
            </div>

            {/* Status (read-only) */}
            <div>
              <label className="block text-[11px] font-medium text-gray-700">Status</label>
              <div className="mt-1 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900">
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
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Security actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPwOpen(true);
                  setPwError("");
                  setPwForm({ current: "", next: "", confirm: "" });
                }}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                Reset password
              </button>
              <EmployeeAssetSticker
                employeeId={user.data._id}
                name={baseUsername}
                position={basePosition}
              />
            </div>

            {/* Right: Edit/Save actions */}
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
                    onClick={() => {
                      setIsEditing(false);
                      setUpdatedData({
                        username: baseUsername,
                        email: baseEmail,
                      });
                      setError(null);
                    }}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

      {/* Confirm dialog */}
      <Modal
        open={confirmOpen}
        title="Save changes"
        subtitle="Profile Update"
        onClose={() => !saving && setConfirmOpen(false)}
      >
        <p className="text-sm text-gray-700">
          Are you sure you want to update your profile with the new information?
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
              onClick={handleSave}
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

      {/* Reset Password Modal */}
      <Modal
        open={pwOpen}
        title="Reset your password"
        subtitle="Security Action"
        variant="warning"
        onClose={() => !pwSaving && setPwOpen(false)}
      >
        {pwError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {pwError}
          </div>
        )}

        {/* Current Password */}
        <div className="mb-4">
          <label className="block text-[11px] font-medium text-gray-700">
            Current password
          </label>
          <div className="mt-1 relative">
            <input
              type={pwShow.current ? "text" : "password"}
              value={pwForm.current}
              onChange={(e) =>
                setPwForm((p) => ({ ...p, current: e.target.value }))
              }
              className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() =>
                setPwShow((s) => ({ ...s, current: !s.current }))
              }
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 focus:outline-none"
              title={pwShow.current ? "Hide" : "Show"}
            >
              {pwShow.current ? (
                // Eye Off
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 3l18 18M10 6.5C10.64 6.18 11.31 6 12 6c4.418 0 8 3.582 9 6-.27.718-.68 1.444-1.21 2.14M7.5 9.5C6.03 10.45 4.83 11.68 4 12c.59 1.54 2.5 3.77 5.02 5.02M12 15a3 3 0 01-3-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                // Eye
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

        {/* New Password */}
        <div className="mb-3">
          <label className="block text-[11px] font-medium text-gray-700">
            New password
          </label>
          <div className="mt-1 relative">
            <input
              type={pwShow.next ? "text" : "password"}
              value={pwForm.next}
              onChange={(e) =>
                setPwForm((p) => ({ ...p, next: e.target.value }))
              }
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

          {/* Strength meter (similar spirit to Register) */}
          <div className="mt-2">
            <div className="h-2 w-full bg-gray-200 rounded">
              <div
                className={`h-2 rounded ${passwordBarClass(score)}`}
                style={{ width: `${scorePct}%`, transition: "width 200ms" }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-gray-600">
              <span>Password strength: {scoreLabel}</span>
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
              onChange={(e) =>
                setPwForm((p) => ({ ...p, confirm: e.target.value }))
              }
              className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() =>
                setPwShow((s) => ({ ...s, confirm: !s.confirm }))
              }
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

        {/* Password Tips */}
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
            onClick={handlePasswordChange}
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

      {/* Success modal (profile updated) */}
      <ModalShell
        open={showSuccessPopup}
        title="Profile updated"
        subtitle="Profile Settings"
        variant="neutral"
        onClose={() => setShowSuccessPopup(false)}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6">
              <path
                d="M6 10.5l2.5 2.5L14 7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-600">
            Your account details have been saved successfully.
          </p>
          <button
            type="button"
            onClick={() => setShowSuccessPopup(false)}
            className="w-full rounded-xl bg-gray-900 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-black"
          >
            Close
          </button>
        </div>
      </ModalShell>

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
