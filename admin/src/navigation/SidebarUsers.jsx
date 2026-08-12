// src/layout/Sidebar.jsx
import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DICT from "../assets/DICT.png";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";

/**
 * Responsive Sidebar (User Management)
 * Reference design based on SidebarSettings:
 * - Mobile/Tablet (< xl): top bar + burger + off-canvas drawer
 * - Desktop (>= xl): permanent left rail
 */
export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const desktopScrollRef = useRef(null);
  const mobileScrollRef = useRef(null);
  const sidebarScrollKey = "sidebar.users.scrollTop";

  /* ------------ state ------------ */
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile off-canvas
  const [open, setOpen] = useState({
    employeeManagement: true,
    userSettings: true,
  });

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

  const canManageUsers = useMemo(
    () => hasAccessTag(role, "users.manage", roleAccess),
    [role, roleAccess]
  );
  const canManageRoleAccess = useMemo(
    () => hasAccessTag(role, "users.role_management", roleAccess),
    [role, roleAccess]
  );
  const canSeeProjects = useMemo(
    () => hasAccessTag(role, "settings.projects", roleAccess),
    [role, roleAccess]
  );
  const canSeeDesignations = useMemo(
    () => hasAccessTag(role, "settings.designations", roleAccess),
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

  const homeTarget = pathname === "/userdashboard" ? "/" : "/userdashboard";
  const homeLabel = pathname === "/userdashboard" ? "Main Dashboard" : "Users Dashboard";
  const navhome = () => go(homeTarget);
  const navform = () => go("/register");
  const navtableusers = () => go("/users");
  const navtablemanagement = () => go("/management");
  const navRoleAccess = () => go("/user/roles");
  const navProjects = () => go("/user/settings/projects");
  const navDesignations = () => go("/user/settings/designations");

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

  const Section = ({ id, title, children }) => (
    <div className="border-b border-slate-200/80 px-4">
      <button
        onClick={() => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))}
        className="flex w-full items-center justify-between py-4 text-slate-600 transition hover:text-slate-900"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {title}
        </span>
        <svg
          className={`h-5 w-5 transform transition-transform text-slate-400 ${
            open[id] ? "" : "rotate-180"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            d="M18 15L12 9L6 15"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className={`${open[id] ? "block" : "hidden"} pb-3`}>
        {children}
      </div>
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

  const IconUserPlus = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M16 8a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.5" />
      <path d="M4 20c0-3.314 3.134-6 8-6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 14v6M14 17h6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconTeam = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M15.5 8a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z" strokeWidth="1.5" />
      <path d="M4 20c0-3.314 3.134-6 8-6s8 2.686 8 6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 9h4M17 9h4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconOrg = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 6h16v4H4zM4 14h10v4H4zM16 14h4v4h-4z" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
  const IconShield = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12h6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  const IconFolder = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 7h6l2 2h10v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
  const IconBadge = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 3l3 3 4 .5-2 3 1 4-4-1.5-4 1.5 1-4-2-3 4-.5 3-3z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 19l3 2 3-2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  return (
    <>
      {/* ---------- Mobile Top Bar ---------- */}
      <div className="xl:hidden fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <img src={DICT} alt="DICT" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">DICT</p>
              <p className="text-[11px] text-slate-500">User Management</p>
            </div>
          </div>
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300/60"
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M4 6h16M4 12h16M4 18h16"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ---------- Mobile Drawer & Backdrop ---------- */}
      <div
        className={`${
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        } xl:hidden`}
      >
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
                <p className="text-[11px] text-slate-500">User Management</p>
              </div>
            </div>
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div ref={mobileScrollRef} className="flex min-h-0 flex-1 flex-col pb-4 overflow-y-auto">
            <div className="px-2">
              <HomeButton className="mb-2" />
            </div>

            {(canManageUsers || canManageRoleAccess) && (
              <Section id="employeeManagement" title="Employee Management">
                {canManageUsers && (
                  <Item
                    onClick={navform}
                    icon={IconUserPlus}
                    label="Add employee"
                    active={isActive("/register")}
                  />
                )}
                {canManageUsers && (
                  <Item
                    onClick={navtablemanagement}
                    icon={IconOrg}
                    label="Management Division"
                    active={isActive("/management")}
                  />
                )}
                {canManageUsers && (
                  <Item
                    onClick={navtableusers}
                    icon={IconTeam}
                    label="Employees"
                    active={isActive("/users")}
                  />
                )}
                {canManageRoleAccess && (
                  <Item
                    onClick={navRoleAccess}
                    icon={IconShield}
                    label="Role Management"
                    active={isActive("/user/roles")}
                  />
                )}
              </Section>
            )}

            {(canSeeProjects || canSeeDesignations) && (
              <Section id="userSettings" title="User Settings">
                {canSeeProjects && (
                  <Item
                    onClick={navProjects}
                    icon={IconFolder}
                    label="Projects"
                    active={isActive("/user/settings/projects")}
                  />
                )}
                {canSeeDesignations && (
                  <Item
                    onClick={navDesignations}
                    icon={IconBadge}
                    label="Office/Designation"
                    active={isActive("/user/settings/designations")}
                  />
                )}
              </Section>
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
              <p className="text-xs text-slate-500">User Management</p>
            </div>
          </div>
        </div>

        <div className="px-4">
          <HomeButton />
        </div>

        <div ref={desktopScrollRef} className="mt-4 flex-1 overflow-y-auto">
          {(canManageUsers || canManageRoleAccess) && (
            <Section id="employeeManagement" title="Employee Management">
              {canManageUsers && (
                <Item
                  onClick={navform}
                  icon={IconUserPlus}
                  label="Add employee"
                  active={isActive("/register")}
                />
              )}
              {canManageUsers && (
                <Item
                  onClick={navtablemanagement}
                  icon={IconOrg}
                  label="Management Division"
                  active={isActive("/management")}
                />
              )}
              {canManageUsers && (
                <Item
                  onClick={navtableusers}
                  icon={IconTeam}
                  label="Employees"
                  active={isActive("/users")}
                />
              )}
              {canManageRoleAccess && (
                <Item
                  onClick={navRoleAccess}
                  icon={IconShield}
                  label="Role Management"
                  active={isActive("/user/roles")}
                />
              )}
            </Section>
          )}

          {(canSeeProjects || canSeeDesignations) && (
            <Section id="userSettings" title="User Settings">
              {canSeeProjects && (
                <Item
                  onClick={navProjects}
                  icon={IconFolder}
                  label="Projects"
                  active={isActive("/user/settings/projects")}
                />
              )}
              {canSeeDesignations && (
                <Item
                  onClick={navDesignations}
                  icon={IconBadge}
                  label="Office/Designation"
                  active={isActive("/user/settings/designations")}
                />
              )}
            </Section>
          )}
        </div>
        <div className="mt-auto">
          <UserCard />
        </div>
      </aside>
    </>
  );
}
