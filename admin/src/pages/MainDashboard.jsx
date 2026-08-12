// src/pages/MainDashboard.jsx
import React, { useState, useContext, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/DICT.png";
import profileIcon from "../assets/profile-icon.png";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";
import { BASE_URL } from "../utils/config";
import ModalShell from "../components/ModalShell";

function getRoleFromUserAnyShape(u) {
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
}

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

const BotIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="5"
      y="6"
      width="14"
      height="12"
      rx="4"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M9 6V4.5C9 3.7 9.7 3 10.5 3h3c.8 0 1.5.7 1.5 1.5V6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="10" cy="12" r="1.3" fill="currentColor" />
    <circle cx="14" cy="12" r="1.3" fill="currentColor" />
    <path
      d="M9.5 15h5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const ManualBubble = () => (
  <Link
    to="/manual"
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 group"
    aria-label="Open user manual in a new tab"
  >
    <div className="relative flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/95 px-3 py-2 shadow-[0_18px_45px_rgba(15,23,42,0.2)] backdrop-blur">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white shadow-sm">
        ?
      </div>
      <div className="hidden sm:flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          Manual
        </span>
        <span className="text-sm font-semibold text-slate-900">Help center</span>
      </div>
      <div className="absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md motion-safe:animate-bounce">
        <BotIcon className="h-5 w-5" />
      </div>
      <div className="pointer-events-none absolute -top-16 right-4 opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
        <div className="relative rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-lg">
          Open the manual
          <span className="absolute -bottom-1 right-6 h-2 w-2 rotate-45 bg-slate-900" />
        </div>
      </div>
    </div>
  </Link>
);

export default function MainDashboard() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [requestCount, setRequestCount] = useState(null);
  const [requestCountLoading, setRequestCountLoading] = useState(false);
  const { user: ctxUser, dispatch } = useContext(AuthContext);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // Fallback to web storage if context not yet populated
  const storedRaw = !ctxUser
    ? localStorage.getItem("user") || sessionStorage.getItem("user")
    : null;
  const storedUser = useMemo(() => {
    if (!storedRaw) return null;
    try {
      return JSON.parse(storedRaw);
    } catch {
      return null;
    }
  }, [storedRaw]);

  const currentUser = ctxUser || storedUser;

  const role = useMemo(() => {
    const fromCtx = getRoleFromUserAnyShape(ctxUser);
    if (fromCtx) return fromCtx;
    const fromStored = getRoleFromUserAnyShape(storedUser);
    return fromStored || "";
  }, [ctxUser, storedUser]);

  const roleAccess = useMemo(() => getStoredRoleAccess(), [ctxUser, storedUser]);
  const canSeeStocks = useMemo(
    () => hasAccessTag(role, "dashboard.office", roleAccess),
    [role, roleAccess]
  );
  const canSeeSettings = useMemo(
    () =>
      hasAccessTag(role, "settings.core", roleAccess) ||
      hasAccessTag(role, "settings.signatories", roleAccess),
    [role, roleAccess]
  );
  const canSeeUsers = useMemo(
    () => hasAccessTag(role, "users.dashboard", roleAccess),
    [role, roleAccess]
  );
  const canSeeRequests = useMemo(
    () => hasAccessTag(role, "stocks.request_queue", roleAccess),
    [role, roleAccess]
  );

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  const handleLogout = () => {
    dispatch({ type: "LOGOUT" });
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    setShowLogoutPopup(true);
    setDropdownOpen(false);
    setTimeout(() => navigate("/login"), 1500);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Strengthen blur/opacity once user scrolls a bit
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const displayName =
    currentUser?.data?.username ||
    currentUser?.username ||
    currentUser?.email ||
    "User";

  const modules = useMemo(() => {
    const list = [];

    if (canSeeStocks) {
      list.push({
        key: "stocks",
        to: "/officedashboard",
        title: "Inventory",
        desc: "Browse inventory, track assets, and review issued items in one place.",
        cta: "Open inventory →",
        accent: "bg-blue-950",
        accentHover: "group-hover:bg-blue-900",
        accentSoft: "bg-gradient-to-br from-blue-200 via-white to-slate-50",
        accentSoftHover: "group-hover:from-blue-300",
        accentText: "text-blue-950",
        accentTextHover: "group-hover:text-blue-900",
        accentCtaHover: "group-hover:bg-blue-950",
        icon: (
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 7h16l-2 9H6L4 7z" />
            <path d="M7 7V5h10v2" />
            <path d="M9 20h6" />
          </svg>
        ),
      });
    }

    if (canSeeSettings) {
      list.push({
        key: "settings",
        to: "/settingsdashboard",
        title: "Settings",
        desc: "Maintain units of measure, classifications, and global configuration.",
        cta: "Open settings hub →",
        accent: "bg-blue-950",
        accentHover: "group-hover:bg-blue-900",
        accentSoft: "bg-gradient-to-br from-blue-200 via-white to-slate-50",
        accentSoftHover: "group-hover:from-blue-300",
        accentText: "text-blue-950",
        accentTextHover: "group-hover:text-blue-900",
        accentCtaHover: "group-hover:bg-blue-950",
        icon: (
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 7h10" />
            <path d="M4 17h16" />
            <circle cx="17" cy="7" r="2.5" />
            <circle cx="9" cy="17" r="2.5" />
          </svg>
        ),
      });
    }

    if (canSeeUsers) {
      list.push({
        key: "users",
        to: "/userdashboard",
        title: "Users",
        desc: "Manage accounts, roles, and access for Region 2 personnel.",
        cta: "Open users management →",
        accent: "bg-blue-950",
        accentHover: "group-hover:bg-blue-900",
        accentSoft: "bg-gradient-to-br from-blue-200 via-white to-slate-50",
        accentSoftHover: "group-hover:from-blue-300",
        accentText: "text-blue-950",
        accentTextHover: "group-hover:text-blue-900",
        accentCtaHover: "group-hover:bg-blue-950",
        icon: (
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="9" cy="9" r="3" />
            <path d="M3.5 19c.7-3 2.8-4.5 5.5-4.5" />
            <circle cx="16.5" cy="10.5" r="2.5" />
            <path d="M12.5 19c.4-2 1.8-3.1 4-3.6" />
          </svg>
        ),
      });
    }

    return list;
  }, [canSeeStocks, canSeeSettings, canSeeUsers]);

  const quickActions = useMemo(() => {
    const base = modules.map((m) => ({
      key: m.key,
      to: m.to,
      title: m.title,
    }));
    if (canSeeRequests) {
      base.push({ key: "requests", to: "/request", title: "Requests" });
    }
    return base;
  }, [modules, canSeeRequests]);

  const visibleModulesText = useMemo(
    () => modules.map((m) => m.title).join(" • "),
    [modules]
  );

  // Layout requirement:
  // - If 3 visible: keep the original 3-box horizontal design on lg (grid-cols-3)
  // - If 2 visible: show 2 boxes horizontally (grid-cols-2 on lg)
  // - If 1 visible: keep it centered (no stretched full width)
  const layout = useMemo(() => {
    const n = modules.length;
    if (n <= 1) {
      return {
        wrapper: "flex justify-center",
        cardExtra: "w-full max-w-sm sm:max-w-md",
      };
    }
    if (n === 2) {
      return {
        wrapper: "grid w-full max-w-5xl mx-auto grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8",
        cardExtra: "w-full",
      };
    }
    return {
      wrapper: "grid w-full max-w-6xl mx-auto grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8",
      cardExtra: "w-full",
    };
  }, [modules.length]);

  useEffect(() => {
    let active = true;

    if (!canSeeRequests) {
      setRequestCount(null);
      return undefined;
    }

    const fetchRequestCount = async () => {
      setRequestCountLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/dashboard/office`);
        if (!res.ok) throw new Error("Failed to load request count");
        const data = await res.json();
        const notifications = Array.isArray(data?.notifications)
          ? data.notifications
          : [];
        const actionable = notifications.filter((n) => n?.actionable).length;
        if (active) setRequestCount(actionable);
      } catch (err) {
        if (active) setRequestCount(0);
      } finally {
        if (active) setRequestCountLoading(false);
      }
    };

    fetchRequestCount();
    return () => {
      active = false;
    };
  }, [canSeeRequests]);

  const ModuleCard = ({
    to,
    title,
    desc,
    cta,
    icon,
    accent,
    accentHover,
    accentSoft,
    accentSoftHover,
    accentText,
    accentTextHover,
    accentCtaHover,
    className = "",
  }) => (
    <Link
      to={to}
      className={[
        "group relative flex h-full flex-col overflow-hidden rounded-[30px]",
        "border border-slate-200 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)]",
        "transition hover:-translate-y-1 hover:shadow-[0_32px_70px_rgba(15,23,42,0.18)]",
        "focus:outline-none focus:ring-2 focus:ring-blue-300/50",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "relative h-44 w-full transition-all duration-300",
          accentSoft,
          accentSoftHover || "",
        ].join(" ")}
      >
        <div
          className={[
            "absolute -top-10 -right-8 h-32 w-32 rounded-full opacity-20",
            "transition-all duration-300 group-hover:opacity-30 group-hover:scale-105",
            accent,
            accentHover || "",
          ].join(" ")}
        />
        <div
          className={[
            "absolute -bottom-10 -left-10 h-36 w-36 rounded-full opacity-15",
            "transition-all duration-300 group-hover:opacity-25 group-hover:scale-105",
            accent,
            accentHover || "",
          ].join(" ")}
        />
        <div className="absolute left-5 bottom-4 flex items-center gap-3">
          <div
            className={[
              "flex h-12 w-12 items-center justify-center rounded-2xl",
              "bg-white/90 shadow-sm ring-1 ring-slate-200/70 transition-colors duration-300",
              accentText,
              accentTextHover || "",
            ].join(" ")}
          >
            {icon}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Module
            </span>
            <span
              className={[
                "text-sm font-semibold transition-colors duration-300",
                accentText,
                accentTextHover || "",
              ].join(" ")}
            >
              {title}
            </span>
          </div>
        </div>
      </div>

      <div className="flex h-full flex-col px-5 pb-6 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          Module
        </p>
        <h2 className="mt-2 text-lg sm:text-xl font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-[13px] sm:text-sm text-slate-500">{desc}</p>
        <span
          className={[
            "mt-auto inline-flex w-fit items-center gap-2 rounded-full",
            "bg-slate-900 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em]",
            "text-white shadow-sm transition-colors duration-300",
            accentCtaHover || "group-hover:bg-slate-950",
          ].join(" ")}
        >
          {cta}
        </span>
      </div>
    </Link>
  );


  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-indigo-50 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-100 blur-3xl opacity-60" />
      {/* Header */}
      <header
        className={[
          "fixed top-0 left-0 right-0 z-40 border-b",
          "backdrop-blur-lg",
          scrolled
            ? "bg-white/80 border-gray-200 shadow-md"
            : "bg-white/60 border-gray-100 shadow-sm",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-0",
            scrolled ? "bg-white bg-opacity-10" : "bg-white bg-opacity-5",
          ].join(" ")}
        />
        <div className="relative w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={logo} alt="DICT Logo" className="h-8 w-auto sm:h-9" />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-gray-800 text-sm sm:text-base">
                DICT Region 2 Inventory
              </span>
              <span className="hidden sm:inline-block text-[11px] text-gray-500">
                Asset &amp; Supplies Management System
              </span>
            </div>
          </div>

          {/* User / Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-gray-800 font-medium text-sm">{displayName}</span>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Logged in</span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleDropdown}
                className="flex items-center justify-center"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
              >
                <img
                  src={profileIcon}
                  alt="Profile"
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full cursor-pointer border border-gray-300 hover:ring-2 hover:ring-indigo-400 transition"
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-gray-100 shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400">Signed in as</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                    {role ? (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400 truncate">
                        Role: {role}
                      </p>
                    ) : null}
                  </div>

                  <Link
                    to="/checkuser"
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Manage My Account
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Section */}
      <section className="w-full pt-24 pb-14 sm:pt-28 sm:pb-20 px-4 sm:px-6 lg:px-8 relative">
        {/* Hero */}
        <div className="flex flex-col items-center gap-5">
          <h1 className="text-center text-2xl sm:text-4xl lg:text-6xl font-normal tracking-[0.08em] text-slate-900 uppercase">
            DICT R2 <span className="font-semibold">Inventory Hub</span>
          </h1>
          <p className="max-w-3xl text-center text-sm sm:text-base text-slate-600">
            Central hub for stocks, users, and configuration across DICT Region 2.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_10px_25px_-20px_rgba(15,23,42,0.35)]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Welcome, {displayName}
            </div>
            {role ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-700 shadow-[0_10px_25px_-20px_rgba(15,23,42,0.3)]">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                {role}
              </div>
            ) : null}
            {canSeeRequests && (
              <Link
                to="/request"
                className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-3.5 py-2 text-[11px] font-semibold text-blue-700 shadow-[0_12px_30px_-22px_rgba(59,130,246,0.55)] hover:from-blue-100 hover:to-indigo-100 transition"
              >
                Requests
                <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-blue-700 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(29,78,216,0.7)]">
                  {requestCountLoading ? "..." : requestCount ?? 0}
                </span>
              </Link>
            )}
          </div>

          <div className="mt-5 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16" />
                  <path d="M7 7v10" />
                  <path d="M17 7v10" />
                  <path d="M5 17h14" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Environment
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-900">Production</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12h3l2 4 4-8 2 4h3" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-900">All systems operational</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="7" />
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Scope
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-900">
                  Regional &amp; Provincial Offices
                </p>
              </div>
            </div>
        </div>
        </div>

        {/* Dashboard Modules */}
        <div className="mt-10 sm:mt-16">
          <div className={layout.wrapper}>
            {modules.map((m) => (
              <ModuleCard
                key={m.key}
                to={m.to}
                title={m.title}
                desc={m.desc}
                cta={m.cta}
                icon={m.icon}
                accent={m.accent}
                accentSoft={m.accentSoft}
                accentText={m.accentText}
                className={layout.cardExtra}
              />
            ))}
          </div>
        </div>

        {/* Hint Section */}
        <div className="mt-12 w-full text-center text-sm text-gray-500">
          {modules.length ? (
            <>
              Available modules for your role:{" "}
              <span className="font-semibold text-gray-700">{visibleModulesText}</span>.
            </>
          ) : (
            <>No modules available for your role. Please contact an administrator.</>
          )}
        </div>
      </section>

      <ManualBubble />

      {/* Logout Popup */}
      <ModalShell
        open={showLogoutPopup}
        title="Logout successful"
        subtitle="Session"
        variant="neutral"
        onClose={() => setShowLogoutPopup(false)}
        maxWidthClass="max-w-xs"
        showClose={false}
      >
        <p className="text-sm text-gray-600 text-center">
          Redirecting you to the login page...
        </p>
      </ModalShell>
    </div>
  );
}
