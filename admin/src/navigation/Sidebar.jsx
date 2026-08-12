// src/layout/Sidebar.jsx
import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { BASE_URL } from "../utils/config";
import DICT from "../assets/DICT.png";
import { hasAccessTag } from "../utils/roleAccess";

/**
 * Responsive Sidebar (Office Inventory)
 * Adds role-based visibility for sidebar buttons/sections.
 * NOTE: This only hides buttons; routes must still be protected in App.jsx.
 */

/* ===================== USER SHAPE HELPERS ===================== */
function getRoleFromUserAnyShape(u) {
  if (!u) return "";
  if (typeof u === "object") {
    return (
      u.role ||
      u.user?.role ||
      u.data?.role ||
      u.data?.user?.role ||
      "" // fallback
    );
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

function getDisplayNameAnyShape(u) {
  if (!u) return "";
  const obj = typeof u === "object" ? u : null;

  const candidate =
    obj?.name ||
    obj?.username ||
    obj?.email ||
    obj?.user?.name ||
    obj?.user?.username ||
    obj?.user?.email ||
    obj?.data?.name ||
    obj?.data?.username ||
    obj?.data?.email ||
    obj?.data?.user?.name ||
    obj?.data?.user?.username ||
    obj?.data?.user?.email ||
    "";

  return (candidate || "").toString();
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

/**
 * Responsive Sidebar (Office Inventory)
 * - Mobile/Tablet (< xl): top bar + burger + off-canvas drawer + backdrop
 * - Desktop (>= xl): permanent left rail
 */
export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const desktopScrollRef = useRef(null);
  const mobileScrollRef = useRef(null);
  const sidebarScrollKey = "sidebar.office.scrollTop";

  /* ------------ RBAC (computed once per user) ------------ */
  const role = useMemo(() => getRoleFromUserAnyShape(user), [user]);
  const displayName = useMemo(() => getDisplayNameAnyShape(user), [user]);
  const roleAccess = useMemo(() => getStoredRoleAccess(), [user]);
  const pathname = location.pathname || "";

  const getUserEmail = () =>
    user?.data?.email || user?.email || user?.data?.user?.email || "";
  const getInitials = () => {
    const base = displayName || getUserEmail() || "User";
    const parts = String(base).trim().split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0]?.[0] || base?.[0] || "U").toUpperCase();
  };

  const canAddStock = useMemo(
    () => hasAccessTag(role, "stocks.entry", roleAccess),
    [role, roleAccess]
  );
  const canOpenInventoryRequests = useMemo(
    () => hasAccessTag(role, "stocks.request_queue", roleAccess),
    [role, roleAccess]
  );
  const canOpenMyInventory = useMemo(
    () => hasAccessTag(role, "inventory.my", roleAccess),
    [role, roleAccess]
  );
  const canOpenEmployeeLookup = useMemo(
    () => hasAccessTag(role, "inventory.employee_lookup", roleAccess),
    [role, roleAccess]
  );

  const canViewOfficeEquip = useMemo(
    () => hasAccessTag(role, "stocks.office_equipment", roleAccess),
    [role, roleAccess]
  );
  const canViewOfficeEquipPpeReports = useMemo(
    () => hasAccessTag(role, "reports.office_equipment.ppe", roleAccess),
    [role, roleAccess]
  );
  const canViewOfficeEquipSeReports = useMemo(
    () => hasAccessTag(role, "reports.office_equipment.se", roleAccess),
    [role, roleAccess]
  );
  const canViewOfficeSupplies = useMemo(
    () => hasAccessTag(role, "stocks.office_supplies", roleAccess),
    [role, roleAccess]
  );
  const canViewOfficeSuppliesReports = useMemo(
    () => hasAccessTag(role, "reports.office_supplies", roleAccess),
    [role, roleAccess]
  );
  const canViewOfficeSuppliesDistribution = useMemo(
    () => hasAccessTag(role, "stocks.distribution", roleAccess),
    [role, roleAccess]
  );
  const canViewFurniture = useMemo(
    () => hasAccessTag(role, "stocks.office_furniture", roleAccess),
    [role, roleAccess]
  );
  const canViewFurniturePpeReports = useMemo(
    () => hasAccessTag(role, "reports.office_furniture.ppe", roleAccess),
    [role, roleAccess]
  );
  const canViewFurnitureSeReports = useMemo(
    () => hasAccessTag(role, "reports.office_furniture.se", roleAccess),
    [role, roleAccess]
  );
  const canViewICT = useMemo(
    () => hasAccessTag(role, "stocks.office_ict", roleAccess),
    [role, roleAccess]
  );
  const canViewICTPpeReports = useMemo(
    () => hasAccessTag(role, "reports.office_ict.ppe", roleAccess),
    [role, roleAccess]
  );
  const canViewICTSeReports = useMemo(
    () => hasAccessTag(role, "reports.office_ict.se", roleAccess),
    [role, roleAccess]
  );

  /* ------------ state ------------ */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [open, setOpen] = useState({
    officeEquipments: true,
    officeSupplies: true,
    furnitureFixtures: true,
    ictEquipments: true,
  });
  const [requestCount, setRequestCount] = useState(0);

  /* ------------ body scroll lock on mobile drawer ------------ */
  useEffect(() => {
    if (drawerOpen) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [drawerOpen]);

  useEffect(() => {
    if (!canOpenInventoryRequests) return;
    let active = true;
    const controller = new AbortController();

    const fetchRequestCount = async () => {
      try {
        const res = await fetch(`${BASE_URL}/dashboard/office`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Request count unavailable");
        const data = await res.json();
        const notifications = Array.isArray(data?.notifications)
          ? data.notifications
          : [];
        const count = notifications.filter((n) => n?.actionable).length;
        if (active) setRequestCount(count);
      } catch {
        if (active) setRequestCount(0);
      }
    };

    fetchRequestCount();
    const interval = setInterval(fetchRequestCount, 60000);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [canOpenInventoryRequests, user]);

  /* ------------ navigation helpers ------------ */
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

  const homeTarget = pathname === "/officedashboard" ? "/" : "/officedashboard";
  const homeLabel = pathname === "/officedashboard" ? "Main Dashboard" : "Office Dashboard";
  const navhome = () => go(homeTarget);
  const navform = () => go("/purchaseform");

  const navtableofficesupply = () => go("/stocktableofficesupply");
  const navtableofficesupplydistribution = () => go("/distributiontableofficesupply");
  const navtableofficesupplydisposal = () => go("/disposaltableofficesupply");
  const navtableofficeequipments = () => go("/stocktableofficeequipments");
  const navtablefurniture = () => go("/stocktablefurnitureandfixture");
  const navtableict = () => go("/stocktableofficeictequipments");

  const navtablereportequipPpe = () => go("/reportstableofficeequip/ppe");
  const navtablereportequipSe = () => go("/reportstableofficeequip/se");
  const navtablereportsupply = () => go("/reportstableofficesupply");
  const navtablereportfurPpe = () => go("/reportstableofficfurnitureandfixture/ppe");
  const navtablereportfurSe = () => go("/reportstableofficfurnitureandfixture/se");
  const navtablereportictPpe = () => go("/reportstableofficeictequip/ppe");
  const navtablereportictSe = () => go("/reportstableofficeictequip/se");

  const navmyinventory = () => go("/myinventory");
  const navrequest = () => go("/request");
  const navEmployeeLookup = () => go("/employee-asset-lookup");

  /* ------------ UI helpers ------------ */
  const isActive = (path) => pathname === path;

  const Item = ({ onClick, icon, label, active, badge }) => (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-300/60 ${
        active
          ? "bg-slate-900/30 text-slate-900 ring-1 ring-slate-900/20"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
      type="button"
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
      {badge > 0 ? (
        <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-600 ring-1 ring-rose-200">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );

  const Section = ({ id, title, children }) => (
    <div className="border-b border-slate-200/80 px-4">
      <button
        type="button"
        onClick={() =>
          setOpen((prev) => ({
            ...prev,
            [id]: !prev[id],
          }))
        }
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
          <path d="M18 15L12 9L6 15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`${open[id] ? "block" : "hidden"} pb-3`}>{children}</div>
    </div>
  );

  const HomeButton = ({ className = "" }) => (
    <button
      type="button"
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
          <p className="truncate text-sm font-semibold text-slate-900">
            {displayName || "Logged in user"}
          </p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {role || "User"}
          </p>
        </div>
      </div>
    </div>
  );

  const IconPlus = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 5v14" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 12h14" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const IconInbox = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 5h16v12H4z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 12h4l2 3h4l2-3h4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const IconLookup = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="10" cy="9" r="4" strokeWidth="1.5" />
      <path d="M3.5 19a6.5 6.5 0 0 1 13 0M17 15l4 4m0-4-4 4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const IconStack = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M4 7h16l-8 4-8-4z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 12l8 4 8-4" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 17l8 4 8-4" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );

  const IconReport = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M6 4h9l3 3v13H6z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const IconTruck = (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 7h11v8H3z" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 9h4l3 3v3h-7z" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="7" cy="17" r="2" strokeWidth="1.5" />
      <circle cx="18" cy="17" r="2" strokeWidth="1.5" />
    </svg>
  );

  /* ------------ render blocks (reused for mobile + desktop) ------------ */
  const hasQuickActions =
    canAddStock || canOpenMyInventory || canOpenInventoryRequests || canOpenEmployeeLookup;
  const QuickActions = () => {
    if (!hasQuickActions) return null;
    return (
      <div className="px-4 pb-3 border-b border-slate-200/80 space-y-1">
        {canAddStock && (
          <Item onClick={navform} icon={IconPlus} label="Add Stock" active={isActive("/purchaseform")} />
        )}
        {canOpenMyInventory && (
          <Item onClick={navmyinventory} icon={IconStack} label="My Inventory" active={isActive("/myinventory")} />
        )}
        {canOpenInventoryRequests && (
          <Item
            onClick={navrequest}
            icon={IconInbox}
            label="Inventory Requests"
            active={isActive("/request")}
            badge={requestCount}
          />
        )}
        {canOpenEmployeeLookup && (
          <Item
            onClick={navEmployeeLookup}
            icon={IconLookup}
            label="Employee Asset Lookup"
            active={isActive("/employee-asset-lookup")}
          />
        )}
      </div>
    );
  };

  const OfficeEquipmentsSection = () => {
  if (
    !canViewOfficeEquip &&
    !canViewOfficeEquipPpeReports &&
    !canViewOfficeEquipSeReports
  )
    return null;
    return (
      <Section id="officeEquipments" title="Office Equipments">
        {canViewOfficeEquip && (
          <Item
            onClick={navtableofficeequipments}
            icon={IconStack}
            label="View stocks"
            active={isActive("/stocktableofficeequipments")}
          />
        )}
        {canViewOfficeEquipPpeReports && (
          <Item
            onClick={navtablereportequipPpe}
            icon={IconReport}
            label="PPE Reports"
            active={isActive("/reportstableofficeequip/ppe")}
          />
        )}
        {canViewOfficeEquipSeReports && (
          <Item
            onClick={navtablereportequipSe}
            icon={IconReport}
            label="SE Reports"
            active={isActive("/reportstableofficeequip/se")}
          />
        )}
      </Section>
    );
  };

  const OfficeSuppliesSection = () => {
    if (!canViewOfficeSupplies && !canViewOfficeSuppliesDistribution && !canViewOfficeSuppliesReports) {
      return null;
    }
    return (
      <Section id="officeSupplies" title="Office Supplies">
        {canViewOfficeSupplies && (
          <Item
            onClick={navtableofficesupply}
            icon={IconStack}
            label="View stocks"
            active={isActive("/stocktableofficesupply")}
          />
        )}
        {canViewOfficeSuppliesDistribution && (
          <Item
            onClick={navtableofficesupplydistribution}
            icon={IconTruck}
            label="View distribution"
            active={isActive("/distributiontableofficesupply")}
          />
        )}
        {canViewOfficeSuppliesDistribution && (
          <Item
            onClick={navtableofficesupplydisposal}
            icon={IconTruck}
            label="View disposal"
            active={isActive("/disposaltableofficesupply")}
          />
        )}
        {canViewOfficeSuppliesReports && (
          <Item
            onClick={navtablereportsupply}
            icon={IconReport}
            label="Reports"
            active={isActive("/reportstableofficesupply")}
          />
        )}
      </Section>
    );
  };

  const FurnitureSection = () => {
    if (
      !canViewFurniture &&
      !canViewFurniturePpeReports &&
      !canViewFurnitureSeReports
    )
      return null;
    return (
      <Section id="furnitureFixtures" title="Furniture & Fixtures">
        {canViewFurniture && (
          <Item
            onClick={navtablefurniture}
            icon={IconStack}
            label="View stocks"
            active={isActive("/stocktablefurnitureandfixture")}
          />
        )}
        {canViewFurniturePpeReports && (
          <Item
            onClick={navtablereportfurPpe}
            icon={IconReport}
            label="PPE Reports"
            active={isActive("/reportstableofficfurnitureandfixture/ppe")}
          />
        )}
        {canViewFurnitureSeReports && (
          <Item
            onClick={navtablereportfurSe}
            icon={IconReport}
            label="SE Reports"
            active={isActive("/reportstableofficfurnitureandfixture/se")}
          />
        )}
      </Section>
    );
  };

  const ICTSection = () => {
    if (
      !canViewICT &&
      !canViewICTPpeReports &&
      !canViewICTSeReports
    )
      return null;
    return (
      <Section id="ictEquipments" title="ICT Equipments">
        {canViewICT && (
          <Item
            onClick={navtableict}
            icon={IconStack}
            label="View stocks"
            active={isActive("/stocktableofficeictequipments")}
          />
        )}
        {canViewICTPpeReports && (
          <Item
            onClick={navtablereportictPpe}
            icon={IconReport}
            label="PPE Reports"
            active={isActive("/reportstableofficeictequip/ppe")}
          />
        )}
        {canViewICTSeReports && (
          <Item
            onClick={navtablereportictSe}
            icon={IconReport}
            label="SE Reports"
            active={isActive("/reportstableofficeictequip/se")}
          />
        )}
      </Section>
    );
  };

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
              <p className="text-[11px] text-slate-500">Office Inventory</p>
            </div>
          </div>
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300/60"
            type="button"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ---------- Mobile Drawer & Backdrop ---------- */}
      <div className={`${drawerOpen ? "pointer-events-auto" : "pointer-events-none"} xl:hidden`}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
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
                <p className="text-[11px] text-slate-500">Office Inventory</p>
              </div>
            </div>
            <button
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              type="button"
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

            <QuickActions />

            <OfficeSuppliesSection />
            <OfficeEquipmentsSection />
            <FurnitureSection />
            <ICTSection />
            <div className="mt-auto">
              <UserCard compact />
            </div>
          </div>
        </aside>
      </div>

      {/* ---------- Desktop Permanent Sidebar ---------- */}
      <aside className="hidden xl:flex h-screen w-80 flex-col border-r border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-700">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 shadow-sm">
              <img src={DICT} alt="DICT" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">DICT</p>
              <p className="text-xs text-slate-500">Office Inventory</p>
            </div>
          </div>
        </div>

        <div className="px-4">
          <HomeButton />
        </div>

        <div className="mt-2">
          <QuickActions />
        </div>

        <div ref={desktopScrollRef} className="mt-4 flex-1 overflow-y-auto">
          <OfficeSuppliesSection />
          <OfficeEquipmentsSection />
          <FurnitureSection />
          <ICTSection />
        </div>
        <div className="mt-auto">
          <UserCard />
        </div>
      </aside>
    </>
  );
}
