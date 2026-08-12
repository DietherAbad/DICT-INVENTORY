// src/pages/SettingsDashboard.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";

export default function SettingsDashboard() {
  const { user } = useContext(AuthContext);
  const role = useMemo(() => {
    if (!user) return "";
    return (
      user.role ||
      user.user?.role ||
      user.data?.role ||
      user.data?.user?.role ||
      ""
    );
  }, [user]);
  const roleAccess = useMemo(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("roleAccess");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const canSeeCore = useMemo(
    () => hasAccessTag(role, "settings.core", roleAccess),
    [role, roleAccess]
  );
  const canSeeWorkflow = useMemo(
    () => hasAccessTag(role, "settings.workflow", roleAccess),
    [role, roleAccess]
  );
  const canSeeSignatories = useMemo(
    () => hasAccessTag(role, "settings.signatories", roleAccess),
    [role, roleAccess]
  );
  const canSeeRequestLimits = useMemo(
    () => hasAccessTag(role, "settings.request_limits", roleAccess),
    [role, roleAccess]
  );
  const canSeeSeThreshold = useMemo(
    () => hasAccessTag(role, "settings.se_threshold", roleAccess),
    [role, roleAccess]
  );
  const canSeeCsvImport = useMemo(
    () => hasAccessTag(role, "settings.csv_import", roleAccess),
    [role, roleAccess]
  );
  const canSeeBackup = useMemo(
    () => hasAccessTag(role, "settings.backup", roleAccess),
    [role, roleAccess]
  );
  const canManageUsers = useMemo(
    () => hasAccessTag(role, "users.manage", roleAccess),
    [role, roleAccess]
  );

  const [settings, setSettings] = useState({
    enable_signed_download: true,
    enable_signed_upload: true,
    enable_email: true,
    __v: undefined,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const persistEmailSettings = (payload) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("systemSettings");
      const stored = raw ? JSON.parse(raw) : {};
      const merged = {
        ...stored,
        enable_email: payload.enable_email,
        enable_signed_download: payload.enable_signed_download,
        enable_signed_upload: payload.enable_signed_upload,
      };
      localStorage.setItem("systemSettings", JSON.stringify(merged));
      window.dispatchEvent(
        new CustomEvent("settings:email", {
          detail: { enable_email: payload.enable_email },
        })
      );
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (!canSeeWorkflow) return;
    const load = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === "object") {
          setSettings((prev) => ({
            ...prev,
            enable_signed_download:
              data.enable_signed_download ?? prev.enable_signed_download,
            enable_signed_upload:
              data.enable_signed_upload ?? prev.enable_signed_upload,
            enable_email: data.enable_email ?? prev.enable_email,
            __v: data.__v ?? prev.__v,
          }));
        }
      } catch {
        // keep defaults on failure
      }
    };
    load();
  }, [canSeeWorkflow]);

  const updateSettings = async (next) => {
    const prev = settings;
    setSettings(next);
    setSettingsSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to update settings.");
      }
      const data = await res.json();
      setSettings((current) => ({
        ...current,
        enable_signed_download:
          data.enable_signed_download ?? current.enable_signed_download,
        enable_signed_upload:
          data.enable_signed_upload ?? current.enable_signed_upload,
        enable_email: data.enable_email ?? current.enable_email,
        __v: data.__v ?? current.__v,
      }));
      persistEmailSettings({
        enable_email: data.enable_email ?? next.enable_email,
        enable_signed_download: data.enable_signed_download ?? next.enable_signed_download,
        enable_signed_upload: data.enable_signed_upload ?? next.enable_signed_upload,
      });
      return true;
    } catch {
      setSettings(prev);
      setToastMessage("Failed to update settings.");
      setTimeout(() => setToastMessage(""), 2500);
      return false;
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggle = (key) => {
    const next = { ...settings, [key]: !settings[key] };
    updateSettings(next);
  };

  const toggleItems = [
    {
      key: "enable_signed_download",
      label: "Signed file downloads",
      description: "Allow approvers to download signed RIS/PTR files.",
    },
    {
      key: "enable_signed_upload",
      label: "Signed file uploads",
      description: "Require signed RIS/PTR uploads before approval.",
    },
    {
      key: "enable_email",
      label: "Email notifications",
      description: "Send automated workflow updates by email.",
    },
  ];
  const enabledToggles = toggleItems.filter((item) => settings[item.key]).length;

  const canSeeSessionTimeout = useMemo(
    () => hasAccessTag(role, "settings.session_timeout", roleAccess),
    [role, roleAccess]
  );
  const canSeeSupplyVisibility = useMemo(
    () => hasAccessTag(role, "settings.supply_visibility", roleAccess),
    [role, roleAccess]
  );
  const canSeeAuditLogs = useMemo(
    () => hasAccessTag(role, "settings.audit_logs", roleAccess),
    [role, roleAccess]
  );

  const quickLinks = [
    {
      label: "Units of Measure",
      description: "Standardize quantity labels across inventory.",
      to: "/measure",
      visible: canSeeCore,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 7h16v10H4z" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 7v3M10 7v2M13 7v3M16 7v2" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Classifications",
      description: "Define categories for quick reporting.",
      to: "/classification",
      visible: canSeeCore,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M5 5h14v4H5zM5 11h9v4H5zM5 17h6v2H5z" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Document Signatories",
      description: "Assign approvers and fixed signatories for RIS, PTR, and ICS.",
      to: "/settings/signatories",
      visible: canSeeSignatories,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 3h9l3 3v15H6z" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 11h6M9 15h4M14 3v4h4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Workflow Settings",
      description: "Manage approvals, email, and signed files.",
      to: "/settings/workflow",
      visible: canSeeWorkflow,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M7 7h5a3 3 0 013 3v0a3 3 0 01-3 3H7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 7v10" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="6.5" cy="7" r="2" strokeWidth="1.5" />
          <circle cx="6.5" cy="17" r="2" strokeWidth="1.5" />
          <circle cx="16.5" cy="10" r="2" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      label: "Request Limits",
      description: "Cap pending requests for each role.",
      to: "/settings/request-limits",
      visible: canSeeRequestLimits,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 14a8 8 0 0116 0" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 14l4-4" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6 18h12" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "SE Threshold",
      description: "Define criteria for SE tagging.",
      to: "/settings/se-threshold",
      visible: canSeeSeThreshold,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9.5 12h5" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Session Timeout",
      description: "Control inactivity timeouts.",
      to: "/settings/session-timeout",
      visible: canSeeSessionTimeout,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
          <path d="M12 8v4l3 2" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Audit Logs",
      description: "Review changes across the system.",
      to: "/audit-logs",
      visible: canSeeAuditLogs,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8.5 12.5l2 2 4-4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "CSV Import",
      description: "Bulk upload inventory data.",
      to: "/settings/csv-import",
      visible: canSeeCsvImport,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 16V6" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 10l4-4 4 4" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 18h16" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Supply Visibility",
      description: "Control quantity visibility per role.",
      to: "/settings/supply-visibility",
      visible: canSeeSupplyVisibility,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.5" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      label: "Backup & Restore",
      description: "Protect your data and recover easily.",
      to: "/settings/backup",
      visible: canSeeBackup,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M7 18h10a4 4 0 000-8 5 5 0 00-9.5-1.5A4 4 0 007 18z" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12 10v6" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9.5 13l2.5 3 2.5-3" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "User Access",
      description: "Manage roles and permissions.",
      to: "/users",
      visible: canManageUsers,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M16 7c0 2.209-1.791 4-4 4s-4-1.791-4-4 1.791-4 4-4 4 1.791 4 4z" strokeWidth="1.5" />
          <path d="M4 21c0-3.314 3.134-6 8-6s8 2.686 8 6" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];
  const visibleQuickLinks = quickLinks.filter((item) => item.visible);
  const accessCount = visibleQuickLinks.length;


  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white via-slate-50 to-blue-50">
      {toastMessage && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}
      <section className="w-full px-4 pb-16 pt-4 sm:pt-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-slate-200/60 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <SettingsHeader
                crumbs={[{ label: "Settings" }]}
                title="Settings Overview"
                subtitle="Quick access to key controls."
              />

              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                Use the left menu to navigate.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_55%)]" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200/80">
                    Email
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {settings.enable_email ? "On" : "Off"}
                  </p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_55%)]" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200/80">
                    Signed Upload
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {settings.enable_signed_upload ? "On" : "Off"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Quick Links</h2>
            <span className="text-xs text-slate-500">{accessCount} items</span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleQuickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="absolute right-4 top-4 h-10 w-10 rounded-full bg-blue-50 text-blue-700 opacity-70" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                    {link.icon}
                  </div>
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M7 17L17 7" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M9 7h8v8" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">{link.label}</p>
                <p className="mt-1 text-xs text-slate-500">Open</p>
              </Link>
            ))}
          </div>
        </div>

        {canSeeWorkflow ? (
          <div className="mt-10 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Workflow Controls
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  Toggle workflow switches.
                </p>
              </div>
              {settingsSaving && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Saving...
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {toggleItems.map((item) => (
                <div
                  key={item.key}
                  className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(item.key)}
                    className={`mt-4 inline-flex h-8 w-14 items-center rounded-full transition ${
                      settings[item.key] ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                    aria-pressed={settings[item.key]}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                        settings[item.key] ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-500 shadow-sm">
            Workflow controls are restricted.
          </div>
        )}

        <div className="mt-10 text-center text-xs text-slate-500">
          Use the left menu for navigation.
        </div>
      </section>
    </div>
  );
}
