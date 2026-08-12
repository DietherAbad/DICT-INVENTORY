// src/pages/UsersDashboard.jsx
import React, { useMemo, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";

export default function UsersDashboard() {
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

  const canManageUsers = useMemo(
    () => hasAccessTag(role, "users.manage", roleAccess),
    [role, roleAccess]
  );
  const canManageRoleAccess = useMemo(
    () => hasAccessTag(role, "users.role_management", roleAccess),
    [role, roleAccess]
  );
  const hasAnyActions = canManageUsers || canManageRoleAccess;

  const canSeeProjects = useMemo(
    () => hasAccessTag(role, "settings.projects", roleAccess),
    [role, roleAccess]
  );
  const canSeeDesignations = useMemo(
    () => hasAccessTag(role, "settings.designations", roleAccess),
    [role, roleAccess]
  );

  const quickLinks = [
    {
      label: "Users Table",
      description: "Review, filter, and update user accounts.",
      to: "/users",
      visible: canManageUsers,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M15.5 8a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z" strokeWidth="1.5" />
          <path d="M4 20c0-3.314 3.134-6 8-6s8 2.686 8 6" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Divisions & Roles",
      description: "Maintain management divisions and roles.",
      to: "/management",
      visible: canManageUsers,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 6h16v4H4zM4 14h10v4H4zM16 14h4v4h-4z" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Role Access Control",
      description: "Tune permissions for each role.",
      to: "/user/roles",
      visible: canManageRoleAccess,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 12h6" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Add Employee",
      description: "Create a new user account.",
      to: "/register",
      visible: canManageUsers,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M16 8a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.5" />
          <path d="M4 20c0-3.314 3.134-6 8-6" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M17 14v6M14 17h6" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Projects",
      description: "Manage user project mapping.",
      to: "/user/settings/projects",
      visible: canSeeProjects,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 7h6l2 2h10v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: "Office/Designation",
      description: "Define office titles and designations.",
      to: "/user/settings/designations",
      visible: canSeeDesignations,
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 3l3 3 4 .5-2 3 1 4-4-1.5-4 1.5 1-4-2-3 4-.5 3-3z" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 19l3 2 3-2" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];
  const visibleQuickLinks = quickLinks.filter((item) => item.visible);

  const [userStats, setUserStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      try {
        const res = await fetch(`${BASE_URL}/users/directory`, {
          credentials: "include",
          silentStatuses: [403],
          suppressErrorToast: true,
        });
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || [];
        const total = list.length;
        const active = list.filter((u) => u?.active !== false).length;
        const inactive = Math.max(total - active, 0);
        if (!cancelled) {
          setUserStats({ total, active, inactive, loading: false });
        }
      } catch {
        if (!cancelled) setUserStats((prev) => ({ ...prev, loading: false }));
      }
    };
    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white via-slate-50 to-blue-50">
      <section className="w-full px-4 pb-16 pt-4 sm:pt-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-slate-200/60 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <SettingsHeader
                crumbs={[
                  { label: "Users", to: "/userdashboard" },
                  { label: "Dashboard" },
                ]}
                title="Users Dashboard"
                subtitle="Quick access to user tools."
              />

              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                Use the left menu to navigate.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_55%)]" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200/80">
                    Accounts
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {userStats.loading ? "—" : userStats.total}
                  </p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_55%)]" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200/80">
                    Active
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {userStats.loading ? "—" : userStats.active}
                  </p>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_55%)]" />
                <div className="relative">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200/80">
                    Inactive
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {userStats.loading ? "—" : userStats.inactive}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Quick Links</h2>
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
              </Link>
            ))}
          </div>
          {!hasAnyActions ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-500 shadow-sm">
              Access is restricted.
            </div>
          ) : null}
        </div>

        <div className="mt-10 text-center text-xs text-slate-500">
          Use the left menu for navigation.
        </div>
      </section>
    </div>
  );
}
