// src/layout/SidebarSettings.jsx
import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DICT from "../assets/DICT.png";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";

/**
 * Responsive Sidebar for Settings
 * - Mobile/Tablet (< xl): shows a top bar with a burger button and an off-canvas drawer
 * - Desktop (>= xl): shows a permanent left rail
 */
export default function SidebarSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const desktopScrollRef = useRef(null);
  const mobileScrollRef = useRef(null);
  const sidebarScrollKey = "sidebar.settings.scrollTop";

  /* ------------ state ------------ */
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile off-canvas

  const getRoleFromUserAnyShape = (u) => {
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
  };

  const getStoredRoleAccess = () => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("roleAccess");
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const role = useMemo(() => getRoleFromUserAnyShape(user), [user]);
  const roleAccess = useMemo(() => getStoredRoleAccess(), [user]);
  const pathname = location.pathname || "";

  const getUserName = () =>
    user?.data?.username ||
    user?.data?.name ||
    user?.username ||
    user?.name ||
    "Signed in";
  const getUserEmail = () =>
    user?.data?.email || user?.email || user?.data?.user?.email || "user@dict.gov.ph";
  const getInitials = () => {
    const base = getUserName();
    const parts = String(base).trim().split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    const email = getUserEmail();
    return (parts[0]?.[0] || email?.[0] || "U").toUpperCase();
  };

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
  const canSeeSessionTimeout = useMemo(
    () => hasAccessTag(role, "settings.session_timeout", roleAccess),
    [role, roleAccess]
  );
  const canSeeAuditLogs = useMemo(
    () => hasAccessTag(role, "settings.audit_logs", roleAccess),
    [role, roleAccess]
  );
  const canSeeCsvImport = useMemo(
    () => hasAccessTag(role, "settings.csv_import", roleAccess),
    [role, roleAccess]
  );
  const canSeeSupplyVisibility = useMemo(
    () => hasAccessTag(role, "settings.supply_visibility", roleAccess),
    [role, roleAccess]
  );
  const canSeeBackup = useMemo(
    () => hasAccessTag(role, "settings.backup", roleAccess),
    [role, roleAccess]
  );

  /* prevent body scroll while drawer is open */
  useEffect(() => {
    if (drawerOpen) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [drawerOpen]);

  /* ------------ actions ------------ */
  const saveSidebarScroll = () => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 1280px)").matches;
    const activeScrollEl = isDesktop ? desktopScrollRef.current : mobileScrollRef.current;
    const scrollTop = activeScrollEl?.scrollTop ?? 0;
    sessionStorage.setItem(sidebarScrollKey, String(scrollTop));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(sidebarScrollKey);
    if (raw === null) return;
    const scrollTop = Number(raw);
    if (!Number.isFinite(scrollTop)) return;
    requestAnimationFrame(() => {
      const isDesktop = window.matchMedia("(min-width: 1280px)").matches;
      const activeScrollEl = isDesktop ? desktopScrollRef.current : mobileScrollRef.current;
      if (activeScrollEl) activeScrollEl.scrollTop = scrollTop;
    });
  }, [pathname]);

  const go = (path) => {
    saveSidebarScroll();
    setDrawerOpen(false);
    if (pathname !== path) navigate(path, { preventScrollReset: true });
  };

  const homeTarget = pathname === "/settingsdashboard" ? "/" : "/settingsdashboard";
  const homeLabel = pathname === "/settingsdashboard" ? "Main Dashboard" : "Settings Dashboard";
  const navhome = () => go(homeTarget);
  const navtablemeasure = () => go("/measure");
  const navtableclassification = () => go("/classification");
  const navworkflow = () => go("/settings/workflow");
  const navSignatories = () => go("/settings/signatories");
  const navRequestLimits = () => go("/settings/request-limits");
  const navSeThreshold = () => go("/settings/se-threshold");
  const navSessionTimeout = () => go("/settings/session-timeout");
  const navauditlogs = () => go("/audit-logs");
  const navCsvImport = () => go("/settings/csv-import");
  const navSupplyVisibility = () => go("/settings/supply-visibility");
  const navBackup = () => go("/settings/backup");

  /* ------------ small helpers ------------ */
  const isActive = (path) => pathname === path;

  const Item = ({ onClick, icon, label, active }) => (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-300/60 ${
        active
          ? "bg-slate-900/30 text-slate-900 ring-1 ring-slate-900/20"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-lg ${
          active
            ? "bg-slate-900/20 text-slate-900 ring-1 ring-slate-900/20"
            : "bg-white text-slate-500 ring-1 ring-slate-200 group-hover:bg-slate-50"
        }`}
      >
        {icon}
      </span>
      <span className="relative z-10">{label}</span>
    </button>
  );

  const SectionLabel = ({ children }) => (
    <div className="px-4 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
      {children}
    </div>
  );

  const HomeButton = ({ className = "" }) => (
    <button
      onClick={navhome}
      className={`group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 ${className}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 12l9-8 9 8" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M5 10v10h14V10" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        {homeLabel}
      </span>
      <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 18l6-6-6-6" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );

  const IconRuler = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 7h16v10H4z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 7v3M10 7v2M13 7v3M16 7v2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconTag = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 12l9-9h6l3 3v6l-9 9-9-9z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 8h.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  const IconFlow = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M7 7h5a3 3 0 013 3v0a3 3 0 01-3 3H7" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 7v10" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6.5" cy="7" r="2" strokeWidth="1.5" />
      <circle cx="6.5" cy="17" r="2" strokeWidth="1.5" />
      <circle cx="16.5" cy="10" r="2" strokeWidth="1.5" />
    </svg>
  );
  const IconGauge = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 14a8 8 0 0116 0" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 14l4-4" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 18h12" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconShield = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 12h5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconClock = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth="1.5" />
      <path d="M12 8v4l3 2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconAudit = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 12.5l2 2 4-4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconUpload = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 16V6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 10l4-4 4 4" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 18h16" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconEye = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" strokeWidth="1.5" />
    </svg>
  );
  const IconBackup = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M7 18h10a4 4 0 000-8 5 5 0 00-9.5-1.5A4 4 0 007 18z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 10v6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 13l2.5 3 2.5-3" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const UserCard = ({ compact = false }) => (
    <div className={`w-full ${compact ? "mt-4" : ""}`}>
      <div className="flex items-center gap-2 border border-slate-200 bg-white px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-[10px] font-semibold text-white">
          {getInitials()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{getUserName()}</p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {role || "User"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="xl:hidden fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <img src={DICT} alt="DICT" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">DICT</p>
              <p className="text-[11px] text-slate-500">Settings</p>
            </div>
          </div>
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300/60"
          >
            {/* burger */}
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ---------- Mobile Drawer & Backdrop ---------- */}
      <div className={`${drawerOpen ? "pointer-events-auto" : "pointer-events-none"} xl:hidden`}>
        {/* backdrop */}
        <div
          onClick={() => setDrawerOpen(false)}
          className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* panel */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-80 transform bg-gradient-to-b from-white via-slate-50 to-slate-100 shadow-2xl transition-transform flex flex-col ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
                <img src={DICT} alt="DICT" className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">DICT</p>
                <p className="text-[11px] text-slate-500">Settings</p>
              </div>
            </div>
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18M6 6l12 12" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={mobileScrollRef} className="flex min-h-0 flex-1 flex-col pb-4 overflow-y-auto">
            <div className="px-2">
              <HomeButton className="mb-2" />
            </div>

            {(canSeeCore ||
              canSeeWorkflow ||
              canSeeSignatories ||
              canSeeRequestLimits ||
              canSeeSeThreshold ||
              canSeeSessionTimeout) && (
              <SectionLabel>Core Settings</SectionLabel>
            )}
            {canSeeCore && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navtablemeasure}
                  icon={IconRuler}
                  label="Units of Measure"
                  active={isActive("/measure")}
                />
                <Item
                  onClick={navtableclassification}
                  icon={IconTag}
                  label="Classifications"
                  active={isActive("/classification")}
                />
              </div>
            )}

            {canSeeSignatories && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navSignatories}
                  icon={IconFlow}
                  label="Document Signatories"
                  active={isActive("/settings/signatories")}
                />
              </div>
            )}

            {canSeeWorkflow && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navworkflow}
                  icon={IconFlow}
                  label="Workflow Settings"
                  active={isActive("/settings/workflow")}
                />
              </div>
            )}

            {canSeeRequestLimits && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navRequestLimits}
                  icon={IconGauge}
                  label="Request Limits"
                  active={isActive("/settings/request-limits")}
                />
              </div>
            )}
            {canSeeSeThreshold && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navSeThreshold}
                  icon={IconShield}
                  label="SE Threshold"
                  active={isActive("/settings/se-threshold")}
                />
              </div>
            )}
            {canSeeSessionTimeout && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navSessionTimeout}
                  icon={IconClock}
                  label="Session Timeout"
                  active={isActive("/settings/session-timeout")}
                />
              </div>
            )}

            {(canSeeAuditLogs || canSeeCsvImport || canSeeSupplyVisibility || canSeeBackup) && (
              <SectionLabel>Utilities</SectionLabel>
            )}
            {canSeeAuditLogs && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navauditlogs}
                  icon={IconAudit}
                  label="Audit Logs"
                  active={isActive("/audit-logs")}
                />
              </div>
            )}
            {canSeeCsvImport && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navCsvImport}
                  icon={IconUpload}
                  label="CSV Import"
                  active={isActive("/settings/csv-import")}
                />
              </div>
            )}
            {canSeeSupplyVisibility && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navSupplyVisibility}
                  icon={IconEye}
                  label="Supply Quantity Visibility"
                  active={isActive("/settings/supply-visibility")}
                />
              </div>
            )}
            {canSeeBackup && (
              <div className="px-4 pb-2">
                <Item
                  onClick={navBackup}
                  icon={IconBackup}
                  label="Backup & Restore"
                  active={isActive("/settings/backup")}
                />
              </div>
            )}
            <div className="mt-auto">
              <UserCard compact />
            </div>
          </div>
        </aside>
      </div>

      {/* ---------- Desktop permanent rail (hidden on small) ---------- */}
      <aside className="hidden xl:flex h-screen w-80 flex-col border-r border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-700">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 shadow-sm">
              <img src={DICT} alt="DICT" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">DICT</p>
              <p className="text-xs text-slate-500">Settings</p>
            </div>
          </div>
        </div>

        <div className="px-4">
          <HomeButton />
        </div>

        <div ref={desktopScrollRef} className="mt-4 flex-1 overflow-y-auto">
          {(canSeeCore ||
            canSeeWorkflow ||
            canSeeSignatories ||
            canSeeRequestLimits ||
            canSeeSeThreshold ||
            canSeeSessionTimeout) && (
            <SectionLabel>Core Settings</SectionLabel>
          )}
          {canSeeCore && (
            <div className="px-4 pb-2">
              <Item
                onClick={navtablemeasure}
                icon={IconRuler}
                label="Units of Measure"
                active={isActive("/measure")}
              />
              <Item
                onClick={navtableclassification}
                icon={IconTag}
                label="Classifications"
                active={isActive("/classification")}
              />
            </div>
          )}
          {canSeeSignatories && (
            <div className="px-4 pb-2">
              <Item
                onClick={navSignatories}
                icon={IconFlow}
                label="Document Signatories"
                active={isActive("/settings/signatories")}
              />
            </div>
          )}
          {canSeeWorkflow && (
            <div className="px-4 pb-2">
              <Item
                onClick={navworkflow}
                icon={IconFlow}
                label="Workflow Settings"
                active={isActive("/settings/workflow")}
              />
            </div>
          )}
          {canSeeRequestLimits && (
            <div className="px-4 pb-2">
              <Item
                onClick={navRequestLimits}
                icon={IconGauge}
                label="Request Limits"
                active={isActive("/settings/request-limits")}
              />
            </div>
          )}
          {canSeeSeThreshold && (
            <div className="px-4 pb-2">
              <Item
                onClick={navSeThreshold}
                icon={IconShield}
                label="SE Threshold"
                active={isActive("/settings/se-threshold")}
              />
            </div>
          )}
          {canSeeSessionTimeout && (
            <div className="px-4 pb-2">
              <Item
                onClick={navSessionTimeout}
                icon={IconClock}
                label="Session Timeout"
                active={isActive("/settings/session-timeout")}
              />
            </div>
          )}

          {(canSeeAuditLogs || canSeeCsvImport || canSeeSupplyVisibility || canSeeBackup) && (
            <SectionLabel>Utilities</SectionLabel>
          )}
          {canSeeAuditLogs && (
            <div className="px-4 pb-2">
              <Item
                onClick={navauditlogs}
                icon={IconAudit}
                label="Audit Logs"
                active={isActive("/audit-logs")}
              />
            </div>
          )}
          {canSeeCsvImport && (
            <div className="px-4 pb-2">
              <Item
                onClick={navCsvImport}
                icon={IconUpload}
                label="CSV Import"
                active={isActive("/settings/csv-import")}
              />
            </div>
          )}
          {canSeeSupplyVisibility && (
            <div className="px-4 pb-2">
              <Item
                onClick={navSupplyVisibility}
                icon={IconEye}
                label="Supply Quantity Visibility"
                active={isActive("/settings/supply-visibility")}
              />
            </div>
          )}
          {canSeeBackup && (
            <div className="px-4 pb-2">
              <Item
                onClick={navBackup}
                icon={IconBackup}
                label="Backup & Restore"
                active={isActive("/settings/backup")}
              />
            </div>
          )}
        </div>
        <div className="mt-auto">
          <UserCard />
        </div>
      </aside>
    </>
  );
}
