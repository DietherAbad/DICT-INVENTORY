// src/pages/OfficeDashboard.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { BASE_URL } from "../utils/config";
import DICT from "../assets/DICT.png"; // logo for loading screen
import SettingsHeader from "../components/SettingsHeader";
import { hasAccessTag } from "../utils/roleAccess";

const strictModeFetchCache = new Map();
const getStrictModeFetchPromise = (key, fetcher) => {
  if (process.env.NODE_ENV === "production") return fetcher();
  const now = Date.now();
  const existing = strictModeFetchCache.get(key);
  if (existing && now - existing.startedAt < 5000) return existing.promise;
  const promise = fetcher();
  strictModeFetchCache.set(key, { promise, startedAt: now });
  promise.finally(() => {
    const current = strictModeFetchCache.get(key);
    if (current?.promise === promise) strictModeFetchCache.delete(key);
  });
  return promise;
};

export default function OfficeDashboard() {
  const { user } = useContext(AuthContext);

  /* ---------- state ---------- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardUnavailable, setDashboardUnavailable] = useState(false);

  /* small-card totals */
  const [totals, setTotals] = useState({
    supplies: 0,
    equipment: 0,
    furniture: 0,
    ict: 0,
  });

  /* big-card breakdowns */
  const [detail, setDetail] = useState({
    supplies: { inStock: 0, outOfStock: 0, low: 0, disposed: 0 },
    equipment: {
      inStock: 0,
      issued: 0,
      transferred: 0,
      forTransfer: 0,
      forApproval: 0,
      forIssuance: 0,
      issuedTransfer: 0,
    },
    furniture: {
      inStock: 0,
      issued: 0,
      transferred: 0,
      forTransfer: 0,
      forApproval: 0,
      forIssuance: 0,
      issuedTransfer: 0,
    },
    ict: {
      inStock: 0,
      issued: 0,
      transferred: 0,
      forTransfer: 0,
      forApproval: 0,
      forIssuance: 0,
      issuedTransfer: 0,
    },
  });

  /* notification sentences */
  const [notifications, setNotifications] = useState([]);

  /* ---------- constants ---------- */
  const DEFAULT_LOW_STOCK_THRESHOLD = 10;

  /* ---------- role gates (render-time) ---------- */
  const role = (user?.data?._role || user?.data?.role || "").trim();
  const isSuperAdmin =
    role.toLowerCase() === "super admin" || role.toLowerCase() === "superadmin";
  const isInvAdmin = role === "Inventory Admin";
  const roleAccess = useMemo(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("roleAccess");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const canViewSupplies = hasAccessTag(role, "stocks.office_supplies", roleAccess);
  const canViewEquipment = hasAccessTag(role, "stocks.office_equipment", roleAccess);
  const canViewFurniture = hasAccessTag(role, "stocks.office_furniture", roleAccess);
  const canViewIct = hasAccessTag(role, "stocks.office_ict", roleAccess);
  const canViewSuppliesSummary = hasAccessTag(
    role,
    "dashboard.office.cards.supplies",
    roleAccess
  );
  const canViewEquipmentSummary = hasAccessTag(
    role,
    "dashboard.office.cards.equipment",
    roleAccess
  );
  const canViewFurnitureSummary = hasAccessTag(
    role,
    "dashboard.office.cards.furniture",
    roleAccess
  );
  const canViewIctSummary = hasAccessTag(
    role,
    "dashboard.office.cards.ict",
    roleAccess
  );
  const canViewDistributions =
    hasAccessTag(role, "stocks.distribution", roleAccess) ||
    hasAccessTag(role, "details.checkform", roleAccess);
  const canViewRequests = hasAccessTag(role, "stocks.request_queue", roleAccess);
  const canViewUsersDirectory = hasAccessTag(role, "users.manage", roleAccess);

  const canViewSupplyAlerts =
    (isInvAdmin || isSuperAdmin) && canViewSupplies && canViewSuppliesSummary;

  /* ---------- DATA FETCH ---------- */
  useEffect(() => {
    let cancelled = false;

    const fetchDashboardData = async () => {
        if (!user || !user.data || !user.data.username) {
          return {
            totals,
            detail,
            notifications: [],
            unavailable: false,
            unauthenticated: true,
          };
        }

      try {
        const dashboardUrl = `${BASE_URL}/dashboard/office`;
        const r = await fetch(dashboardUrl, { credentials: "include" });
        if (r.status === 404) {
          return {
            totals,
            detail,
            notifications: [],
            unavailable: true,
            unauthenticated: false,
          };
        }
        if (!r.ok) {
          throw new Error(`API error (${dashboardUrl}): ${r.status} ${r.statusText}`);
        }
        const payload = await r.json();

        return {
          totals: payload?.totals || totals,
          detail: payload?.detail || detail,
          notifications: Array.isArray(payload?.notifications) ? payload.notifications : [],
          unavailable: false,
          unauthenticated: false,
        };
      } catch (err) {
        throw err;
      }
    };

    setLoading(true);
    setError(null);

    const cacheKey = `office-dashboard:${user?.data?._id || user?.data?.username || "anon"}`;

    getStrictModeFetchPromise(cacheKey, fetchDashboardData)
      .then((data) => {
        if (cancelled) return;
        if (data.unauthenticated) {
          setLoading(false);
          return;
        }

        setTotals(data.totals);
        setDetail(data.detail);
        setNotifications(data.notifications);
        setDashboardUnavailable(Boolean(data.unavailable));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDashboardUnavailable(false);
        setError(err.message || "Failed to load dashboard data.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    user,
    canViewDistributions,
    canViewSupplies,
    canViewEquipment,
    canViewFurniture,
    canViewIct,
    canViewRequests,
    canViewUsersDirectory,
  ]);

  /* ---------- gates ---------- */
  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <div className="bg-white border border-red-100 shadow-md rounded-xl px-6 py-5 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-1">Unable to load data</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const showSupplyStockAlert =
    canViewSupplyAlerts && (detail.supplies.low > 0 || detail.supplies.outOfStock > 0);
  const showNotifications = Boolean(user?.data) || canViewRequests || canViewDistributions;
  const visibleTotals =
    totals.supplies + totals.equipment + totals.furniture + totals.ict;
  const showMyOverviewCards = true;
  const showSummaryCards =
    (canViewSupplies && canViewSuppliesSummary) ||
    (canViewEquipment && canViewEquipmentSummary) ||
    (canViewFurniture && canViewFurnitureSummary) ||
    (canViewIct && canViewIctSummary);
  const coverageParts = [
    canViewSupplies ? "Supplies" : null,
    canViewEquipment ? "Equipment" : null,
    canViewFurniture ? "Furniture" : null,
    canViewIct ? "ICT" : null,
  ].filter(Boolean);
  const coverageLabel = coverageParts.length ? coverageParts.join(", ") : "No inventory access";

  /* ---------- render ---------- */
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      {/* section now fills the entire available width, no max-w container */}
      <section className="w-full px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-16 pt-2 sm:pt-6 pb-24 lg:pb-16">
        {/* Hero */}
        <div>
          <SettingsHeader
            crumbs={[{ label: "Inventory Dashboard" }]}
            title="Inventory Dashboard"
            subtitle="Overview of your inventory coverage and requests."
          />

          {dashboardUnavailable && (
            <div className="mt-4 w-full rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-xs sm:text-sm text-amber-800 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M12 9v4m0 4h.01M10.29 3.86l-7.1 12.28A2 2 0 005 19h14a2 2 0 001.81-2.86l-7.1-12.28a2 2 0 00-3.42 0z"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-amber-900">
                    Dashboard data unavailable
                  </p>
                  <p className="text-amber-700">
                    This server does not expose the office dashboard endpoint yet.
                    The summary is showing default values for now.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        {showNotifications ? <NotificationCard notifications={notifications} /> : null}

        {/* Inventory-only supplies emphasis */}
        <SupplyStockAlert
          canView={canViewSupplyAlerts}
          lowCount={detail.supplies.low}
          outCount={detail.supplies.outOfStock}
          defaultThreshold={DEFAULT_LOW_STOCK_THRESHOLD}
          show={showSupplyStockAlert}
        />

        {/* Small summary cards */}
        {showMyOverviewCards ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mt-8 sm:mt-10">
            <SummaryCard
              label="Supplies Summary"
              value={totals.supplies}
              tone="indigo"
              unitLabel="unique items"
              footer={
                canViewSupplyAlerts ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        detail.supplies.low > 0
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-gray-50 text-gray-500 border border-gray-200"
                      }`}
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-current opacity-60" />
                      Low: {detail.supplies.low}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        detail.supplies.outOfStock > 0
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-gray-50 text-gray-500 border border-gray-200"
                      }`}
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-current opacity-60" />
                      Out: {detail.supplies.outOfStock}
                    </span>
                  </span>
                ) : null
              }
            />
            <SummaryCard
              label="Equipment Summary"
              value={totals.equipment}
              tone="blue"
            />
            <SummaryCard
              label="Furniture Summary"
              value={totals.furniture}
              tone="teal"
            />
            <SummaryCard
              label="ICT Summary"
              value={totals.ict}
              tone="purple"
            />
          </div>
        ) : null}

        {/* Big breakdown cards */}
        {showSummaryCards ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6 lg:gap-8 mt-10 lg:mt-14">
            {canViewSupplies && canViewSuppliesSummary ? (
              <BigCard title="Supplies">
                <BreakdownRow label="Items in stock" value={detail.supplies.inStock} />
                <BreakdownRow
                  label="Items low on stock (≤ item threshold)"
                  value={detail.supplies.low}
                  tone={canViewSupplyAlerts ? "warning" : "default"}
                />
                <BreakdownRow
                  label="Items out of stock"
                  value={detail.supplies.outOfStock}
                  tone={canViewSupplyAlerts ? "danger" : "default"}
                />
                <BreakdownRow label="Total disposed quantity" value={detail.supplies.disposed} />
                <BreakdownLink to="/stocktableofficesupply" label="View supplies inventory" />
              </BigCard>
            ) : null}

            {canViewEquipment && canViewEquipmentSummary ? (
              <BigCard title="Equipment">
                <BreakdownRow label="Items in stock" value={detail.equipment.inStock} />
                <BreakdownRow label="Items issued" value={detail.equipment.issued} />
                <BreakdownRow label="Items transferred" value={detail.equipment.transferred} />
                <BreakdownRow label="Items for transfer" value={detail.equipment.forTransfer} />
                <BreakdownRow nested label="• For approval" value={detail.equipment.forApproval} />
                <BreakdownRow nested label="• For issuance" value={detail.equipment.forIssuance} />
                <BreakdownLink to="/stocktableofficeequipments" label="View equipment inventory" />
              </BigCard>
            ) : null}

            {canViewFurniture && canViewFurnitureSummary ? (
              <BigCard title="Furniture & Fixtures">
                <BreakdownRow label="Items in stock" value={detail.furniture.inStock} />
                <BreakdownRow label="Items issued" value={detail.furniture.issued} />
                <BreakdownRow label="Items transferred" value={detail.furniture.transferred} />
                <BreakdownRow label="Items for transfer" value={detail.furniture.forTransfer} />
                <BreakdownRow nested label="• For approval" value={detail.furniture.forApproval} />
                <BreakdownRow nested label="• For issuance" value={detail.furniture.forIssuance} />
                <BreakdownLink to="/stocktablefurnitureandfixture" label="View furniture inventory" />
              </BigCard>
            ) : null}

            {canViewIct && canViewIctSummary ? (
              <BigCard title="ICT Equipment">
                <BreakdownRow label="Items in stock" value={detail.ict.inStock} />
                <BreakdownRow label="Items issued" value={detail.ict.issued} />
                <BreakdownRow label="Items transferred" value={detail.ict.transferred} />
                <BreakdownRow label="Items for transfer" value={detail.ict.forTransfer} />
                <BreakdownRow nested label="• For approval" value={detail.ict.forApproval} />
                <BreakdownRow nested label="• For issuance" value={detail.ict.forIssuance} />
                <BreakdownLink to="/stocktableofficeictequipments" label="View ICT inventory" />
              </BigCard>
            ) : null}
          </div>
        ) : null}

        {/* Hint */}
        <div className="mt-8 lg:mt-10 max-w-5xl mx-auto text-center text-xs sm:text-sm text-gray-500">
          Navigate via the sidebar to see full tables and transaction history. This dashboard gives
          you a quick snapshot of what you own, what is moving, and what needs attention.
        </div>
      </section>

      {/* Mobile-only sticky quick bar (does not affect desktop) */}
      <MobileQuickBar
        canViewSupplies={canViewSupplies}
        canViewEquipment={canViewEquipment}
        canViewFurniture={canViewFurniture}
        canViewIct={canViewIct}
      />
    </div>
  );
}

/* ---------- Loading Screen (perfectly centered) ---------- */
function LoadingScreen() {
  const tips = [
    "Tip: Click a card to jump straight into that inventory.",
    "Tip: Use the sidebar to filter by asset type or status.",
    "Tip: The RIS modal now scales to your screen size.",
    "Tip: Watch the ‘Latest Requests & Transfers’ area for changes.",
  ];

  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(10);

  React.useEffect(() => {
    const t = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    const p = setInterval(() => {
      setProgress((curr) => {
        if (curr >= 92) return curr;
        const step = curr < 40 ? 4 : curr < 70 ? 2 : 1;
        return curr + step;
      });
    }, 140);
    return () => clearInterval(p);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[2000] grid place-items-center bg-gradient-to-br from-white via-slate-50 to-blue-50"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Subtle background accents that do NOT affect centering */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />

      {/* Centered card */}
      <div className="relative mx-4 w-full max-w-sm sm:max-w-lg overflow-hidden rounded-3xl border border-slate-800/40 bg-slate-900/95 shadow-2xl">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -top-16 -right-10 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-indigo-500/20 blur-2xl" />
        </div>

        <div className="relative p-5 sm:p-7 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center">
                <img src={DICT} alt="DICT" className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
              </div>
              <div>
                <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.35em] text-slate-400">
                  Inventory Dashboard
                </p>
                <p className="text-base sm:text-xl font-semibold text-white">
                  Loading Office Inventory
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200">
              Region 2
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
              <span>Preparing metrics &amp; charts</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div
              className="mt-3 h-2 w-full rounded-full bg-slate-800/80 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 sm:px-4 sm:py-3">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Initializing
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Syncing inventory feed
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 sm:px-4 sm:py-3">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Quick Tip
              </div>
              <p className="mt-2 text-[11px] sm:text-xs text-slate-300">{tips[tipIndex]}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- sub components ---------- */

const SUMMARY_TONES = {
  indigo: {
    line: "from-indigo-600 via-indigo-500 to-indigo-200",
    glow: "bg-indigo-100/70",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  blue: {
    line: "from-blue-600 via-sky-500 to-sky-200",
    glow: "bg-blue-100/70",
    pill: "bg-blue-50 text-blue-700 border-blue-200",
  },
  teal: {
    line: "from-teal-600 via-emerald-500 to-emerald-200",
    glow: "bg-teal-100/70",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  purple: {
    line: "from-purple-600 via-indigo-500 to-indigo-200",
    glow: "bg-purple-100/70",
    pill: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

function SummaryCard({ label, value, tone = "indigo", unitLabel = "items", footer = null }) {
  const toneStyles = SUMMARY_TONES[tone] || SUMMARY_TONES.indigo;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${toneStyles.line}`}
      />
      <div className={`absolute -right-12 -top-10 h-24 w-24 rounded-full ${toneStyles.glow} blur-2xl`} />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.22em] ${toneStyles.pill}`}
          >
            Summary
          </span>
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Overview
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl sm:text-3xl font-semibold text-slate-900">{value}</span>
          <span className="text-[9px] sm:text-[11px] uppercase tracking-[0.22em] text-slate-400">
            {unitLabel}
          </span>
        </div>
        <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-700">{label}</p>
        {footer ? <div className="pt-2">{footer}</div> : null}
      </div>
    </div>
  );
}

function BigCard({ title, children }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-4 sm:p-6 shadow-md">
      <div className="absolute -left-8 top-0 h-16 w-16 rounded-full bg-slate-100/60 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">{title}</h2>
        <span className="text-[8px] sm:text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-[0.2em]">
          Summary
        </span>
      </div>
      <ul className="mt-3 space-y-2 text-slate-600">{children}</ul>
    </div>
  );
}

function BreakdownRow({ label, value, nested = false, tone = "default" }) {
  const toneClasses =
    tone === "danger"
      ? "text-rose-700"
      : tone === "warning"
      ? "text-amber-700"
      : "text-gray-700";

  const valueClasses =
    tone === "danger"
      ? "text-rose-900"
      : tone === "warning"
      ? "text-amber-900"
      : "text-gray-900";

  return (
    <li
      className={`flex justify-between items-baseline ${
        nested ? "pl-4 text-xs" : "text-xs sm:text-sm"
      } ${toneClasses}`}
    >
      <span className="truncate pr-2">{label}</span>
      <span className={`font-semibold ${valueClasses}`}>{value}</span>
    </li>
  );
}

function BreakdownLink({ to, label }) {
  return (
    <li className="pt-1">
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
      >
        {label}
        <span aria-hidden="true">→</span>
      </Link>
    </li>
  );
}

function NotificationCard({ notifications }) {
  const [expanded, setExpanded] = useState(false);

  if (!notifications || notifications.length === 0) return null;

  const visible = expanded ? notifications.slice(0, 6) : notifications.slice(0, 2);
  const actionableCount = notifications.filter((n) => n?.actionable).length;
  const urgentCount = notifications.filter((n) => n?.priority === "high").length;

  return (
    <div className="mt-8 sm:mt-10 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.4)] p-5 sm:p-8 w-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200/80">
            Smart Assistant
          </p>
          <h2 className="mt-2 text-lg sm:text-2xl font-semibold text-white">
            Latest Requests &amp; Transfers
          </h2>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-white/10 ring-1 ring-white/15 flex items-center justify-center">
          <svg
            className="h-5 w-5 text-blue-200"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/70">
        {urgentCount > 0
          ? `${urgentCount} urgent item${urgentCount === 1 ? "" : "s"} need attention.`
          : "No urgent items right now."}{" "}
        {actionableCount > 0
          ? `${actionableCount} item${actionableCount === 1 ? "" : "s"} ready for action.`
          : "All clear on approvals."}
      </p>

      {visible.map((n, idx) => (
        <div
          key={idx}
          className={`rounded-2xl px-3 sm:px-4 py-3 border mb-2 last:mb-0 ${
            n.priority === "high"
              ? "bg-white/10 border-rose-200/40"
              : n.priority === "medium"
              ? "bg-white/5 border-amber-200/30"
              : "bg-white/5 border-white/10"
          }`}
        >
          {n.title ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[0.28em] text-blue-200/70">
                  {n.badge || "Update"}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-white truncate">
                  {n.title}
                </div>
                {n.summary && (
                  <div className="mt-1 text-[11px] sm:text-xs text-white/70">
                    {n.summary}
                  </div>
                )}
                {Array.isArray(n.meta) && n.meta.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    {n.meta.map((m, i) => (
                      <span
                        key={`${m.label}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-white/90"
                      >
                        <span className="font-semibold">{m.label}:</span>
                        <span className="truncate max-w-[120px]">{m.value}</span>
                      </span>
                    ))}
                  </div>
                )}
                {n.nextAction && (
                  <div className="mt-2 text-[11px] text-white/80">
                    Next: <span className="font-semibold">{n.nextAction}</span>
                  </div>
                )}
              </div>
              <Link
                to={n.link}
                className="ml-2 inline-flex items-center justify-center px-3 py-1.5 text-[10px] sm:text-xs bg-white text-indigo-600 font-semibold rounded-full hover:bg-indigo-50 transition"
              >
                {n.cta || "View"}
              </Link>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="flex-1 text-xs sm:text-sm leading-snug sm:leading-normal">
                {n.msg}
              </span>
              <Link
                to={n.link}
                className="ml-3 inline-flex items-center justify-center px-3 py-1.5 text-[10px] sm:text-xs bg-white text-indigo-600 font-semibold rounded-full hover:bg-indigo-50 transition"
              >
                {n.cta}
              </Link>
            </div>
          )}
        </div>
      ))}

      {notifications.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 sm:mt-3 text-[10px] sm:text-xs underline hover:text-gray-100"
        >
          {expanded
            ? "Show fewer updates"
            : `Show ${Math.min(notifications.length - 2, 4)} more updates`}
        </button>
      )}
    </div>
  );
}

/* ---------- Inventory-only supplies emphasis banner ---------- */
function SupplyStockAlert({ canView, lowCount, outCount, defaultThreshold, show }) {
  if (!canView || !show) return null;

  return (
    <div className="mt-8 sm:mt-10 w-full">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-rose-50 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86l-7.1 12.28A2 2 0 005 19h14a2 2 0 001.81-2.86l-7.1-12.28a2 2 0 00-3.42 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <p className="text-sm sm:text-base font-semibold text-gray-900">
                Supplies need attention
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                Low stock is based on each item's threshold (default {defaultThreshold}).
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold border ${
                    lowCount > 0
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-current opacity-60" />
                  Low stock: {lowCount}
                </span>

                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold border ${
                    outCount > 0
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-current opacity-60" />
                  Out of stock: {outCount}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/stocktableofficesupply"
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold bg-gray-900 text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Review supplies inventory
              <span className="ml-1" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Mobile-only sticky quick bar ---------- */
function MobileQuickBar({ canViewSupplies, canViewEquipment, canViewFurniture, canViewIct }) {
  const quickLinks = [
    canViewSupplies ? { to: "/stocktableofficesupply", label: "Supplies" } : null,
    canViewEquipment ? { to: "/stocktableofficeequipments", label: "Equipment" } : null,
    canViewFurniture ? { to: "/stocktablefurnitureandfixture", label: "Furniture" } : null,
    canViewIct ? { to: "/stocktableofficeictequipments", label: "ICT" } : null,
  ].filter(Boolean);

  if (quickLinks.length === 0) return null;

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-[1100] border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="w-full px-3 py-2">
        <div className="grid grid-cols-4 gap-2">
          {quickLinks.map((link) => (
            <QuickLink key={link.to} to={link.to} label={link.label} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-3 py-2 text-[11px] font-semibold hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-300"
    >
      {label}
    </Link>
  );
}
