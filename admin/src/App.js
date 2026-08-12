// src/App.jsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import MainDashboard from "./pages/MainDashboard";
import OfficeDashboard from "./pages/OfficeDashboard";
import UsersDashboard from "./pages/UsersDashboard";
import StocksDashboard from "./pages/StocksDashboard";
import SettingsDashboard from "./pages/SettingsDashboard";
import SettingsRequestLimits from "./pages/SettingsRequestLimits";
import AuditLogs from "./pages/AuditLogs";
import SettingsWorkflow from "./pages/SettingsWorkflow";
import SettingsRoleAccess from "./pages/SettingsRoleAccess";
import SettingsCsvImport from "./pages/SettingsCsvImport";
import SettingsProjects from "./pages/SettingsProjects";
import SettingsDesignations from "./pages/SettingsDesignations";
import SettingsSupplyVisibility from "./pages/SettingsSupplyVisibility";
import SettingsSessionTimeout from "./pages/SettingsSessionTimeout";
import SettingsSeThreshold from "./pages/SettingsSeThreshold";
import SettingsBackup from "./pages/SettingsBackup";
import SettingsDocumentSignatories from "./pages/SettingsDocumentSignatories";
import UserManual from "./pages/UserManual";
import Stock from "./pages/Stock";
import Purchase from "./pages/Purchase";
import PublicItem from "./pages/PublicItem";
import ModalShell from "./components/ModalShell";

import { Purchaseform } from "./forms/Purchaseform";
import { PurchaseformICTequipment } from "./forms/PurchaseformofficeICTequipment";
import { Purchaseformfurnitureandfixture } from "./forms/Purchaseformofficefurnitureandfixture";
import { Purchaseformofficeequipment } from "./forms/Purchaseformofficeequipment";

import { Stockinform } from "./forms/Stockin";
import { Distribute } from "./forms/Distribute";

import Stocktableofficesupply from "./table/Stocktableofficesupply";
import DistributionTable from "./table/Stocktableofficesupplydistribution";
import Stocktableofficeequipments from "./table/Stocktableofficeequipments";
import Stocktableofficefurnitureandfixtures from "./table/Stocktableofficefurnitureandfixtures";
import Stocktableofficeictequipments from "./table/Stocktableofficeictequipments";
import Stocktable from "./table/Stocktable";

import Reportstableofficeequipments from "./table/Reportstableofficeequipments";
import Reportstableofficesupply from "./table/Reportstableofficesupply";
import Reportstableofficefurnitureandfixtures from "./table/Reportstableofficefurnitureandfixtures";
import Reportstableofficeictequipments from "./table/Reportstableofficeictequipments";

import Template from "./navigation/Template";
import TemplateUsers from "./navigation/TemplateUsers";
import TemplateSettings from "./navigation/TemplateSettings";

import Checkitem from "./details/Checkitem";
import Checkitemsupply from "./details/Checkitemsupply";
import Checkitemfurniture from "./details/Checkitemfurniture";
import Checkitemictequip from "./details/Checkitemictequip";
import Checkuser from "./details/Checkuser";
import Checkuserforadmin from "./details/Checkuserforadmin";

import Userstable from "./table/Userstable";
import Managementtable from "./table/ManagementTable";
import MeasureTable from "./table/MeasureTable";
import ClassificationTable from "./table/ClassificationTable";
import MyInventorytable from "./table/MyInventorytable";
import Request from "./table/Request";
import EmployeeAssetLookup from "./pages/EmployeeAssetLookup";

import { Checkform } from "./details/Checkform";
import { AuthContext } from "./context/AuthContext";
import { BASE_URL } from "./utils/config";
import { ROLES, normalizeRole } from "./utils/roles";
import {
  FEATURE_TAGS,
  hasAccessTag,
  migrateRoleAccessForClient,
} from "./utils/roleAccess";

/* ========================= SESSION HELPERS ========================= */

function getStoredUser() {
  if (typeof window === "undefined") return null;
  const parseUser = (raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  try {
    const localUser = parseUser(localStorage.getItem("user"));
    if (localUser) return localUser;
    const sessionUser = parseUser(sessionStorage.getItem("user"));
    if (sessionUser) return sessionUser;
    return null;
  } catch {
    return null;
  }
}

function getStoredRoleAccess() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("roleAccess");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/* ========================= ROLE RESOLUTION ========================= */

function getUserRoleFromAnyShape(u) {
  if (!u) return null;

  if (typeof u === "object") {
    if (u.role) return u.role;
    if (u.user?.role) return u.user.role;
    if (u.data?.role) return u.data.role;
    if (u.data?.user?.role) return u.data.user.role;

    // fallbacks if your backend uses different field names
    if (u.data?.position) return u.data.position;
    if (u.data?.usertype) return u.data.usertype;
  }

  if (typeof u === "string") {
    try {
      const parsed = JSON.parse(u);
      return getUserRoleFromAnyShape(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

function getUserRoleSafe(ctxUser) {
  const role1 = getUserRoleFromAnyShape(ctxUser);
  if (role1) return role1;

  const stored = getStoredUser();
  const role2 = getUserRoleFromAnyShape(stored);
  return role2 || null;
}

const ACCESS_FALLBACK_ROUTES = [
  { tag: "dashboard.main", path: "/" },
  { tag: "dashboard.office", path: "/officedashboard" },
  { tag: "stocks.browse", path: "/dashboard" },
  { tag: "stocks.office_supplies", path: "/stocktableofficesupply" },
  { tag: "stocks.distribution", path: "/distributiontableofficesupply" },
  { tag: "stocks.request_queue", path: "/request" },
  { tag: "inventory.my", path: "/myinventory" },
  { tag: "inventory.employee_lookup", path: "/employee-asset-lookup" },
  { tag: "users.dashboard", path: "/userdashboard" },
  { tag: "settings.core", path: "/settingsdashboard" },
  { tag: "settings.signatories", path: "/settings/signatories" },
];

const getFeatureLabel = (tag) => {
  if (!tag) return "this page";
  const match = FEATURE_TAGS.find((f) => f.tag === tag);
  return match?.label || tag;
};

const getFallbackRoute = (role, roleAccess, blockedTag) => {
  for (const entry of ACCESS_FALLBACK_ROUTES) {
    if (blockedTag && entry.tag === blockedTag) continue;
    if (hasAccessTag(role, entry.tag, roleAccess)) {
      return { ...entry, label: getFeatureLabel(entry.tag) };
    }
  }
  return null;
};

function AccessDenied({ requiredTag, role, roleAccess }) {
  const navigate = useNavigate();
  const label = useMemo(() => getFeatureLabel(requiredTag), [requiredTag]);
  const fallback = useMemo(
    () => getFallbackRoute(role, roleAccess, requiredTag),
    [role, roleAccess, requiredTag]
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-sm">
            <svg
              className="h-5 w-5"
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
            <p className="text-sm font-semibold text-slate-900">Access restricted</p>
            <p className="mt-1 text-xs text-slate-600">
              Your role does not include access to {label}.
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Ask an admin to enable this feature for your role.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Go back
          </button>
          {fallback && (
            <button
              type="button"
              onClick={() => navigate(fallback.path)}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black"
            >
              Go to {fallback.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FriendlyRedirectPage({
  type = "404",
  title,
  message,
  destinationPath,
  destinationLabel,
  canGoBack = true,
}) {
  const navigate = useNavigate();
  const { user: ctxUser } = useContext(AuthContext);
  const [seconds, setSeconds] = useState(6);
  const storedUser = getStoredUser();
  const rawRole = getUserRoleSafe(ctxUser);
  const roleAccess = getStoredRoleAccess();
  const fallback = getFallbackRoute(rawRole, roleAccess);
  const targetPath =
    destinationPath || fallback?.path || (storedUser || ctxUser ? "/" : "/login");
  const targetLabel =
    destinationLabel || fallback?.label || (storedUser || ctxUser ? "Dashboard" : "Login");

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (seconds !== 0) return;
    navigate(targetPath, { replace: true });
  }, [navigate, seconds, targetPath]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200">
                DICT Inventory
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">
                {title || (type === "404" ? "Page not found" : "Something went wrong")}
              </h1>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-black ring-1 ring-white/15">
              {type}
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm leading-6 text-slate-600">
            {message ||
              "The page is unavailable or the link is no longer valid. We will send you to a safe page."}
          </p>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold text-blue-900">
              Redirecting to {targetLabel} in {seconds} second{seconds === 1 ? "" : "s"}.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-700 transition-all"
                style={{ width: `${Math.max(0, (seconds / 6) * 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {canGoBack && (
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Go back
                </button>
              )}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reload
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate(targetPath, { replace: true })}
              className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
            >
              Go to {targetLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Page error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <FriendlyErrorFallback
        title="Page error"
        message="The page stopped loading correctly. You can reload or return to a safe page."
        error={this.state.error}
      />
    );
  }
}

function FriendlyErrorFallback({ title, message, error }) {
  const goHome = () => {
    const hasUser = Boolean(getStoredUser());
    window.location.assign(hasUser ? "/" : "/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-sm font-black text-rose-700">
            ERR
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-950">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
            {error?.message ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {error.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={goHome}
            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
          >
            Go to safe page
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= PROTECTED ROUTE ========================= */

function ProtectedRoute({ children, allowedRoles, requiredTag, requiredAnyTags }) {
  const { user: ctxUser } = useContext(AuthContext);
  const location = useLocation();

  const storedUser = getStoredUser();
  const isAuthed = Boolean(ctxUser) || Boolean(storedUser);

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const rawRole = getUserRoleSafe(ctxUser);
  const normalized = normalizeRole(rawRole);
  const roleAccess = getStoredRoleAccess();

  // Super Admin can access all protected routes.
  if (normalized === normalizeRole(ROLES.SUPER_ADMIN)) return children;

  // If role missing, block access and require re-login.
  if (!normalized) {
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredTag) {
    if (!hasAccessTag(rawRole, requiredTag, roleAccess)) {
      return (
        <AccessDenied requiredTag={requiredTag} role={rawRole} roleAccess={roleAccess} />
      );
    }
  }

  if (Array.isArray(requiredAnyTags) && requiredAnyTags.length > 0) {
    const allowed = requiredAnyTags.some((tag) =>
      hasAccessTag(rawRole, tag, roleAccess)
    );
    if (!allowed) {
      return (
        <AccessDenied
          requiredTag={requiredAnyTags.join(" or ")}
          role={rawRole}
          roleAccess={roleAccess}
        />
      );
    }
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const allowedNormalized = allowedRoles.map((r) => normalizeRole(r)).filter(Boolean);

    if (!allowedNormalized.includes(normalized)) {
      return (
        <AccessDenied requiredTag={requiredTag} role={rawRole} roleAccess={roleAccess} />
      );
    }
  }

  return children;
}

/* ================================ APP =============================== */

function App() {
  const { user: ctxUser, dispatch } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [pwaUpdateReady, setPwaUpdateReady] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [apiError, setApiError] = useState(null);
  const [retryingRequest, setRetryingRequest] = useState(false);

  const storedUser = getStoredUser();
  const isAuthed = Boolean(ctxUser) || Boolean(storedUser);

  const isPublicPath = (pathname) => {
    if (pathname === "/login") return true;
    if (pathname === "/register") return true;
    if (pathname.startsWith("/checkitem")) return true; // public QR views
    if (pathname.startsWith("/checkitemfurniture")) return true;
    if (pathname.startsWith("/checkitemict")) return true;
    if (pathname.startsWith("/public/item")) return true;
    return false;
  };

  const draftPathLabels = useMemo(
    () => ({
      "/purchaseform": "Purchase Form (Supplies)",
      "/purchaseformICT": "Purchase Form (ICT)",
      "/purchaseformFurniture": "Purchase Form (Furniture)",
      "/purchaseformEquip": "Purchase Form (Equipment)",
      "/stockform": "Stock In Form",
      "/distributeform": "Distribution Form",
    }),
    []
  );

  const isAuthError = useMemo(() => {
    if (!apiError) return false;
    if (apiError.status === 401) return true;
    const msg = String(apiError.message || "").toLowerCase();
    return msg.includes("not authenticated") || msg.includes("unauth");
  }, [apiError]);

  const authErrorHint = useMemo(() => {
    const msg = String(apiError?.message || "").toLowerCase();
    if (msg.includes("force logged out") || msg.includes("force logout")) {
      return "You have been force logged out. Please sign in again to continue.";
    }
    if (msg.includes("inactive")) {
      return "Your account is inactive. Please contact the administrator.";
    }
    return "You’ve been inactive. Please sign in again to continue.";
  }, [apiError]);

  const isPublicRoute = useMemo(
    () => isPublicPath(location.pathname),
    [location.pathname]
  );

  const handleReauth = useCallback(
    (resumePath) => {
      if (resumePath) {
        sessionStorage.setItem("resume_after_login", resumePath);
      }
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      if (dispatch) {
        dispatch({ type: "LOGOUT" });
      }
      setApiError(null);
      navigate("/login", { replace: true, state: { from: location } });
    },
    [dispatch, location, navigate]
  );

  useEffect(() => {
    if (!isAuthed && !isPublicPath(location.pathname)) {
      navigate("/login", { replace: true, state: { from: location } });
    }
  }, [isAuthed, location, navigate]);

  useEffect(() => {
    if (ctxUser) {
      setApiError(null);
    }
  }, [ctxUser]);

  useEffect(() => {
    if (!isAuthed || isPublicPath(location.pathname)) return;
    const fullPath = `${location.pathname}${location.search || ""}`;
    sessionStorage.setItem("last_path", fullPath);
    const draftLabel = draftPathLabels[location.pathname];
    if (draftLabel) {
      sessionStorage.setItem("draft_path", fullPath);
      sessionStorage.setItem("draft_label", draftLabel);
    }
  }, [draftPathLabels, isAuthed, location.pathname, location.search]);

  useEffect(() => {
    if (!isAuthError || isPublicRoute) return;
    const timer = setTimeout(() => {
      handleReauth();
    }, 2500);
    return () => clearTimeout(timer);
  }, [handleReauth, isAuthError, isPublicRoute]);

  useEffect(() => {
    if (apiError && isAuthError && isPublicRoute) {
      setApiError(null);
    }
  }, [apiError, isAuthError, isPublicRoute]);

  useEffect(() => {
    const onUpdate = () => setPwaUpdateReady(true);
    window.addEventListener("pwa:update-ready", onUpdate);
    return () => window.removeEventListener("pwa:update-ready", onUpdate);
  }, []);

  useEffect(() => {
    const handleApiError = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      setApiError(detail);
    };
    window.addEventListener("api:error", handleApiError);
    return () => window.removeEventListener("api:error", handleApiError);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    const loadRoleAccess = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data && typeof data === "object") {
          const roleAccess = migrateRoleAccessForClient(
            data.role_access || {},
            data.role_access_version
          );
          localStorage.setItem("roleAccess", JSON.stringify(roleAccess));
          const rawMinutes = Number(data?.session_timeout_minutes);
          const storedSettings = (() => {
            try {
              const raw = localStorage.getItem("systemSettings");
              return raw ? JSON.parse(raw) : {};
            } catch {
              return {};
            }
          })();
          const sessionSettings = {
            ...storedSettings,
            session_timeout_enabled: Boolean(data?.session_timeout_enabled ?? true),
            session_timeout_minutes:
              Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 30,
            enable_email: data?.enable_email ?? storedSettings.enable_email ?? true,
            enable_signed_download:
              data?.enable_signed_download ?? storedSettings.enable_signed_download ?? true,
            enable_signed_upload:
              data?.enable_signed_upload ?? storedSettings.enable_signed_upload ?? true,
          };
          localStorage.setItem("systemSettings", JSON.stringify(sessionSettings));
          window.dispatchEvent(
            new CustomEvent("settings:session-timeout", { detail: sessionSettings })
          );
          window.dispatchEvent(
            new CustomEvent("settings:email", {
              detail: { enable_email: sessionSettings.enable_email },
            })
          );
        }
      } catch {
        // ignore - fallback to defaults
      }
    };
    loadRoleAccess();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  const apiErrorCopy = useMemo(() => {
    if (!apiError) return { title: "Request failed", message: "" };
    const method = String(apiError.method || "GET").toUpperCase();
    let path = "";
    try {
      path = new URL(apiError.url || "", window.location.origin).pathname;
    } catch {
      path = apiError.url || "";
    }

    const rules = [
      { match: /\/users/i, label: "users" },
      { match: /\/inventoryoffice/i, label: "inventory" },
      { match: /\/inventorygovnet/i, label: "govnet inventory" },
      { match: /\/inventoryfreewifi/i, label: "freewifi inventory" },
      { match: /\/distribute/i, label: "distribution requests" },
      { match: /\/requests/i, label: "requests" },
      { match: /\/reports/i, label: "reports" },
      { match: /\/settings/i, label: "settings" },
      { match: /\/classification/i, label: "classifications" },
      { match: /\/measure/i, label: "units of measure" },
      { match: /\/logs/i, label: "audit logs" },
      { match: /\/email/i, label: "email notifications" },
    ];

    const hit = rules.find((r) => r.match.test(path));
    const target = hit?.label || "data";

    const verbs = {
      GET: "load",
      POST: "create",
      PUT: "update",
      PATCH: "update",
      DELETE: "delete",
    };
    const verb = verbs[method] || "process";
    const title =
      method === "GET"
        ? `Unable to load ${target}`
        : `Unable to ${verb} ${target}`;
    const message = apiError.message || "Please try again.";

    return { title, message };
  }, [apiError]);

  const handleApiRetry = useCallback(async () => {
    const payload = apiError?.retryPayload;
    if (!payload?.url) return;
    setRetryingRequest(true);
    try {
      const res = await fetch(payload.url, {
        method: payload.method || "GET",
        headers: payload.headers || {},
        credentials: payload.credentials || "include",
        body: payload.body || undefined,
      });
      if (res.ok) {
        setApiError(null);
      }
    } catch {
      // api:error will handle messaging
    } finally {
      setRetryingRequest(false);
    }
  }, [apiError]);

  return (
    <>
      {isOffline && (
        <div className="fixed bottom-4 left-4 z-50 w-[300px] rounded-xl border border-amber-200 bg-amber-50 shadow-lg">
          <div className="p-3">
            <p className="text-xs font-semibold text-amber-800">You’re offline</p>
            <p className="mt-1 text-[11px] text-amber-700">
              Some features may be unavailable until you reconnect.
            </p>
            <ul className="mt-2 text-[11px] text-amber-700 list-disc ml-4 space-y-1">
              <li>Submitting requests and approvals</li>
              <li>Email notifications</li>
              <li>Signed file uploads/downloads</li>
            </ul>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {apiError && isAuthError && !isPublicRoute && (
        <ModalShell
          open
          title="Session expired"
          subtitle="Authentication"
          variant="warning"
          onClose={handleReauth}
          maxWidthClass="max-w-md"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {authErrorHint}
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 text-xs text-slate-600">
              {apiError.message || "Your session is no longer valid."}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleReauth}
                className="rounded-xl bg-gray-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-black"
              >
                Sign in again
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {apiError && !isAuthError && (
        <div className="fixed top-4 left-4 z-50 w-[320px] rounded-xl border border-red-200 bg-red-50 shadow-lg">
          <div className="p-3">
            <p className="text-xs font-semibold text-red-800">{apiErrorCopy.title}</p>
            <p className="mt-1 text-[11px] text-red-700">
              {apiErrorCopy.message}
            </p>
            <div className="mt-2 text-[10px] text-red-600">
              {apiError.method} {apiError.status ? `· ${apiError.status}` : ""}{" "}
              {apiError.url ? `· ${apiError.url}` : ""}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {apiError.retryable ? (
                <button
                  type="button"
                  onClick={handleApiRetry}
                  disabled={retryingRequest}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {retryingRequest ? "Retrying..." : "Retry request"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  Reload
                </button>
              )}
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {pwaUpdateReady && (
        <div className="fixed top-4 right-4 z-50 w-[300px] rounded-xl border border-indigo-100 bg-white shadow-xl">
          <div className="p-4">
            <p className="text-sm font-semibold text-gray-900">Update available</p>
            <p className="mt-1 text-xs text-gray-600">
              A new version of the app is ready. Refresh to update now.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("pwa:refresh"))}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Refresh now
              </button>
              <button
                type="button"
                onClick={() => setPwaUpdateReady(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      <AppErrorBoundary>
      <Routes>
      {/* PUBLIC / AUTH */}
      <Route path="/login" element={<Login />} />
      <Route
        path="/register"
        element={
          <ProtectedRoute requiredTag="users.manage">
            <Register />
          </ProtectedRoute>
        }
      />

      {/* ROOT */}
      <Route
        path="/"
        element={
          <ProtectedRoute requiredTag="dashboard.main">
            <MainDashboard />
          </ProtectedRoute>
        }
      />

      {/* =================== DASHBOARDS =================== */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredTag="stocks.browse">
            <StocksDashboard />
          </ProtectedRoute>
        }
      />

      {/* ✅ EMPLOYEES CAN ACCESS OFFICEDASHBOARD + TEMPLATE SIDEBAR */}
      <Route
        path="/officedashboard"
        element={
          <ProtectedRoute requiredTag="dashboard.office">
            <Template>
              <OfficeDashboard />
            </Template>
          </ProtectedRoute>
        }
      />

      <Route path="/public/item/:token" element={<PublicItem />} />

      <Route
        path="/userdashboard"
        element={
          <ProtectedRoute requiredTag="users.dashboard">
            <TemplateUsers>
              <UsersDashboard />
            </TemplateUsers>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settingsdashboard"
        element={
          <ProtectedRoute requiredAnyTags={["settings.core", "settings.signatories"]}>
            <TemplateSettings>
              <SettingsDashboard />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manual"
        element={
          <ProtectedRoute requiredTag="dashboard.main">
            <UserManual />
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute requiredTag="settings.audit_logs">
            <TemplateSettings>
              <AuditLogs />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/workflow"
        element={
          <ProtectedRoute requiredTag="settings.workflow">
            <TemplateSettings>
              <SettingsWorkflow />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/signatories"
        element={
          <ProtectedRoute requiredTag="settings.signatories">
            <TemplateSettings>
              <SettingsDocumentSignatories />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />


      <Route
        path="/settings/request-limits"
        element={
          <ProtectedRoute requiredTag="settings.request_limits">
            <TemplateSettings>
              <SettingsRequestLimits />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/session-timeout"
        element={
          <ProtectedRoute requiredTag="settings.session_timeout">
            <TemplateSettings>
              <SettingsSessionTimeout />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/se-threshold"
        element={
          <ProtectedRoute requiredTag="settings.se_threshold">
            <TemplateSettings>
              <SettingsSeThreshold />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/csv-import"
        element={
          <ProtectedRoute requiredTag="settings.csv_import">
            <TemplateSettings>
              <SettingsCsvImport />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/backup"
        element={
          <ProtectedRoute requiredTag="settings.backup">
            <TemplateSettings>
              <SettingsBackup />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/projects"
        element={<Navigate to="/user/settings/projects" replace />}
      />

      <Route
        path="/settings/designations"
        element={<Navigate to="/user/settings/designations" replace />}
      />

      <Route
        path="/settings/supply-visibility"
        element={
          <ProtectedRoute requiredTag="settings.supply_visibility">
            <TemplateSettings>
              <SettingsSupplyVisibility />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/user/settings/projects"
        element={
          <ProtectedRoute requiredTag="settings.projects">
            <TemplateUsers>
              <SettingsProjects />
            </TemplateUsers>
          </ProtectedRoute>
        }
      />

      <Route
        path="/user/settings/designations"
        element={
          <ProtectedRoute requiredTag="settings.designations">
            <TemplateUsers>
              <SettingsDesignations />
            </TemplateUsers>
          </ProtectedRoute>
        }
      />

      <Route
        path="/user/roles"
        element={
          <ProtectedRoute requiredTag="users.role_management">
            <TemplateUsers>
              <SettingsRoleAccess />
            </TemplateUsers>
          </ProtectedRoute>
        }
      />

      {/* =================== STOCK VIEW / CART (employees included) =================== */}
      <Route
        path="/stock"
        element={
          <ProtectedRoute requiredTag="stocks.browse">
            <Stock />
          </ProtectedRoute>
        }
      />

      {/* =================== STOCK ENTRY / PROCUREMENT (admin only) =================== */}
      <Route
        path="/purchase"
        element={
          <ProtectedRoute requiredTag="stocks.entry">
            <Purchase />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchaseform"
        element={
          <ProtectedRoute requiredTag="stocks.entry">
            <Template>
              <Purchaseform />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchaseformICT"
        element={
          <ProtectedRoute requiredTag="stocks.entry">
            <Template>
              <PurchaseformICTequipment />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchaseformFurniture"
        element={
          <ProtectedRoute requiredTag="stocks.entry">
            <Template>
              <Purchaseformfurnitureandfixture />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchaseformEquip"
        element={
          <ProtectedRoute requiredTag="stocks.entry">
            <Template>
              <Purchaseformofficeequipment />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stockform"
        element={
          <ProtectedRoute requiredTag="stocks.entry">
            <Stockinform />
          </ProtectedRoute>
        }
      />

      {/* =================== USER / MANAGEMENT TABLES =================== */}
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredTag="users.manage">
            <TemplateUsers>
              <Userstable />
            </TemplateUsers>
          </ProtectedRoute>
        }
      />

      <Route
        path="/management"
        element={
          <ProtectedRoute requiredTag="users.manage">
            <TemplateUsers>
              <Managementtable />
            </TemplateUsers>
          </ProtectedRoute>
        }
      />

      <Route
        path="/measure"
        element={
          <ProtectedRoute requiredTag="settings.core">
            <TemplateSettings>
              <MeasureTable />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      <Route
        path="/classification"
        element={
          <ProtectedRoute requiredTag="settings.core">
            <TemplateSettings>
              <ClassificationTable />
            </TemplateSettings>
          </ProtectedRoute>
        }
      />

      {/* =================== MY INVENTORY / REQUESTS =================== */}
      <Route
        path="/myinventory"
        element={
          <ProtectedRoute requiredTag="inventory.my">
            <Template>
              <MyInventorytable />
            </Template>
          </ProtectedRoute>
        }
      />

      <Route
        path="/request"
        element={
          <ProtectedRoute requiredTag="stocks.request_queue">
            <Template>
              <Request />
            </Template>
          </ProtectedRoute>
        }
      />

      <Route
        path="/employee-asset-lookup"
        element={
          <ProtectedRoute requiredTag="inventory.employee_lookup">
            <Template>
              <EmployeeAssetLookup />
            </Template>
          </ProtectedRoute>
        }
      />

      {/* =================== STOCK TABLES (employees included) =================== */}
      <Route
        path="/stocktableofficesupply"
        element={
          <ProtectedRoute requiredTag="stocks.office_supplies">
            <Template>
              <Stocktableofficesupply />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/distributiontableofficesupply"
        element={
          <ProtectedRoute requiredTag="stocks.distribution">
            <Template>
              <DistributionTable />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/disposaltableofficesupply"
        element={
          <ProtectedRoute requiredTag="stocks.distribution">
            <Template>
              <DistributionTable requestType="disposal" />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stocktableofficeequipments"
        element={
          <ProtectedRoute requiredTag="stocks.office_equipment">
            <Template>
              <Stocktableofficeequipments />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stocktablefurnitureandfixture"
        element={
          <ProtectedRoute requiredTag="stocks.office_furniture">
            <Template>
              <Stocktableofficefurnitureandfixtures />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stocktableofficeictequipments"
        element={
          <ProtectedRoute requiredTag="stocks.office_ict">
            <Template>
              <Stocktableofficeictequipments />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stocktable"
        element={
          <ProtectedRoute requiredTag="stocks.browse">
            <Stocktable />
          </ProtectedRoute>
        }
      />

      {/* =================== REPORTS (signatories only) =================== */}
      <Route
        path="/reportstableofficeequip/ppe"
        element={
          <ProtectedRoute requiredTag="reports.office_equipment.ppe">
            <Template>
              <Reportstableofficeequipments assetFilter="PPE" reportLabel="Office Equipment" />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportstableofficeequip/se"
        element={
          <ProtectedRoute requiredTag="reports.office_equipment.se">
            <Template>
              <Reportstableofficeequipments assetFilter="SE" reportLabel="Office Equipment" />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportstableofficesupply"
        element={
          <ProtectedRoute requiredTag="reports.office_supplies">
            <Template>
              <Reportstableofficesupply />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportstableofficfurnitureandfixture/ppe"
        element={
          <ProtectedRoute requiredTag="reports.office_furniture.ppe">
            <Template>
              <Reportstableofficefurnitureandfixtures
                assetFilter="PPE"
                reportLabel="Office Furniture & Fixtures"
              />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportstableofficfurnitureandfixture/se"
        element={
          <ProtectedRoute requiredTag="reports.office_furniture.se">
            <Template>
              <Reportstableofficefurnitureandfixtures
                assetFilter="SE"
                reportLabel="Office Furniture & Fixtures"
              />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportstableofficeictequip/ppe"
        element={
          <ProtectedRoute requiredTag="reports.office_ict.ppe">
            <Template>
              <Reportstableofficeictequipments assetFilter="PPE" reportLabel="ICT Equipment" />
            </Template>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportstableofficeictequip/se"
        element={
          <ProtectedRoute requiredTag="reports.office_ict.se">
            <Template>
              <Reportstableofficeictequipments assetFilter="SE" reportLabel="ICT Equipment" />
            </Template>
          </ProtectedRoute>
        }
      />

      {/* =================== DISTRIBUTION (signatories only) =================== */}
      <Route
        path="/distributeform"
        element={
          <ProtectedRoute requiredTag="stocks.distribution">
            <Distribute />
          </ProtectedRoute>
        }
      />

      {/* =================== CHECK PAGES =================== */}
      <Route
        path="/checkitem/:id"
        element={
          <ProtectedRoute requiredTag="details.office_equipment">
            <Checkitem />
          </ProtectedRoute>
        }
      />

      <Route
        path="/checkitemsupply/:id"
        element={
          <ProtectedRoute requiredTag="details.office_supplies">
            <Checkitemsupply />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkitemfurniture/:id"
        element={
          <ProtectedRoute requiredTag="details.office_furniture">
            <Checkitemfurniture />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkitemict/:id"
        element={
          <ProtectedRoute requiredTag="details.office_ict">
            <Checkitemictequip />
          </ProtectedRoute>
        }
      />

      <Route
        path="/checkuser"
        element={
          <ProtectedRoute requiredTag="details.checkuser">
            <Checkuser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkuserforadmin/:id"
        element={
          <ProtectedRoute requiredTag="details.checkuser">
            <Checkuserforadmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/checkform/:id"
        element={
          <ProtectedRoute requiredTag="details.checkform">
            <Template>
              <Checkform />
            </Template>
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <FriendlyRedirectPage
            type="404"
            title="Page not found"
            message="This link does not match any page in the system. You can wait for the redirect or choose where to go next."
          />
        }
      />
      </Routes>
      </AppErrorBoundary>
    </>
  );
}

export default App;
