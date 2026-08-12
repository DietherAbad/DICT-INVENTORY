// src/components/Stocktableofficesupply.jsx
import React, { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { BASE_URL, resolveServerUrl } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";
import ModalShell from "../components/ModalShell";
import EmptyState from "../components/EmptyState";
import {
  ShoppingCartIcon,
  PlusIcon,
  SearchIcon,
  AdjustmentsIcon,
  CheckCircleIcon,
  ExclamationIcon,
  XIcon,
  ClipboardListIcon,
} from "@heroicons/react/solid";

const resolveThumbnailUrl = (item) => {
  const raw = item?.thumbnail?.url;
  return resolveServerUrl(raw);
};

/* ---------- Small reusable <th> ---------- */
function TableHeader({ title, className = "" }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-[10px] md:text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-50 text-left ${className}`}
    >
      {title}
    </th>
  );
}

/* ---------- Project badge (deterministic color per project) ---------- */
function getProjectPalette(name = "") {
  const palettes = [
    ["#eef2ff", "#3730a3", "#c7d2fe"], // indigo
    ["#ecfeff", "#115e59", "#99f6e4"], // teal
    ["#eff6ff", "#1d4ed8", "#bfdbfe"], // blue
    ["#fef3c7", "#92400e", "#fde68a"], // amber
    ["#f5f3ff", "#6d28d9", "#ddd6fe"], // violet
    ["#fdf2f8", "#9d174d", "#fbcfe8"], // pink/rose
    ["#ecfccb", "#3f6212", "#d9f99d"], // lime
    ["#f0fdf4", "#166534", "#bbf7d0"], // green
    ["#f0f9ff", "#0e7490", "#bae6fd"], // sky/cyan
    ["#fff7ed", "#9a3412", "#fed7aa"], // orange
    ["#f8fafc", "#374151", "#e5e7eb"], // gray
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const idx = name ? h % palettes.length : palettes.length - 1;
  const [bg, text, border] = palettes[idx];
  return { bg, text, border };
}

function ProjectBadge({ project, className = "" }) {
  const label = project || "—";
  const { bg, text, border } = getProjectPalette(label.trim());
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] md:text-[11px] font-semibold border ${className}`}
      style={{ backgroundColor: bg, color: text, borderColor: border }}
      title={label}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: text }} />
      {label}
    </span>
  );
}

/* ---------- Status Pill with hard colors ---------- */
function StatusPill({ status, qty, hideQty, reservedQty = 0 }) {
  const raw = (status || "").toLowerCase().trim();

  if (hideQty) {
    let label = status || "Unknown";
    let bg = "#f9fafb";
    let color = "#6b7280";
    let border = "#e5e7eb";

    if (reservedQty > 0) {
      label = "Reserved";
      bg = "#e0e7ff";
      color = "#3730a3";
      border = "#c7d2fe";
    } else if (raw === "out of stock" || raw === "out-of-stock") {
      label = "Out of stock";
      bg = "#fee2e2";
      color = "#b91c1c";
      border = "#fecaca";
    } else if (raw === "low stock" || raw === "low-stock") {
      label = "Low stock";
      bg = "#fef3c7";
      color = "#92400e";
      border = "#fde68a";
    } else if (raw === "instock" || raw === "in stock" || raw === "") {
      label = "In stock";
      bg = "#dcfce7";
      color = "#166534";
      border = "#bbf7d0";
    } else if (raw === "pending") {
      label = "Pending";
      bg = "#dbeafe";
      color = "#1d4ed8";
      border = "#bfdbfe";
    } else if (raw === "reserved") {
      label = "Reserved";
      bg = "#e0e7ff";
      color = "#3730a3";
      border = "#c7d2fe";
    }

    return (
      <span
        className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold"
        style={{ backgroundColor: bg, color, borderColor: border }}
      >
        {label}
      </span>
    );
  }

  if (qty === null || qty === undefined) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold"
        style={{ backgroundColor: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" }}
      >
        Hidden
      </span>
    );
  }
  const quantity = Number(qty ?? 0);

  let label = status || "Unknown";
  let bg = "#f9fafb";
  let color = "#6b7280";
  let border = "#e5e7eb";

  if (quantity <= 0 && reservedQty > 0) {
    label = "Reserved";
    bg = "#e0e7ff";
    color = "#3730a3";
    border = "#c7d2fe";
  } else if (quantity <= 0) {
    label = "Out of stock";
    bg = "#fee2e2";
    color = "#b91c1c";
    border = "#fecaca";
  } else if ((raw === "instock" || raw === "") && quantity < 20) {
    label = "Low stock";
    bg = "#fef3c7";
    color = "#92400e";
    border = "#fde68a";
  } else if (raw === "instock" || raw === "") {
    label = "In stock";
    bg = "#dcfce7";
    color = "#166534";
    border = "#bbf7d0";
  } else if (raw === "pending") {
    label = "Pending";
    bg = "#dbeafe";
    color = "#1d4ed8";
    border = "#bfdbfe";
  } else if (raw === "reserved") {
    label = "Reserved";
    bg = "#e0e7ff";
    color = "#3730a3";
    border = "#c7d2fe";
  } else if (raw) {
    bg = "#f3f4f6";
    color = "#374151";
    border = "#e5e7eb";
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] md:text-[11px] font-semibold border"
      style={{ backgroundColor: bg, color, borderColor: border }}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/* ---------- Toast (Tailwind v2-compatible colors) ---------- */
function Toast({ type = "success", message, onClose }) {
  if (!message) return null;

  const colorMap = {
    success: {
      bg: "bg-green-600",
      ring: "ring-green-300",
      Icon: CheckCircleIcon,
    },
    error: { bg: "bg-red-600", ring: "ring-red-300", Icon: ExclamationIcon },
    info: { bg: "bg-gray-900", ring: "ring-gray-300", Icon: ClipboardListIcon },
  };

  const { bg, ring, Icon } = colorMap[type] || colorMap.info;

  return (
    <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[2000] px-4">
      <div
        className={`flex items-center gap-2 text-white ${bg} ring-1 ${ring} shadow-xl rounded-lg px-4 py-2`}
      >
        <Icon className="h-5 w-5 text-white" />
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 rounded bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 text-xs"
          aria-label="Close toast"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ---------- single <tr> ---------- */
/* reservedQty comes from cart; table shows balance_qty - reservedQty */
function TableRow({
  data,
  onAddToCart,
  reservedQty = 0,
  canManage,
  canRequest,
  hideQuantities,
}) {
  const thumbnailUrl = resolveThumbnailUrl(data);
  const qtyHidden = hideQuantities || (data?.balance_qty == null && data?.stock_qty == null);
  const baseQty = qtyHidden ? null : Number(data.balance_qty ?? data.stock_qty ?? 0);
  const availableQty = qtyHidden
    ? null
    : Math.max(0, baseQty - Number(reservedQty || 0));
  const statusRaw = String(data?.status || "").toLowerCase().trim();
  const canAddToCart =
    canRequest &&
    (qtyHidden
      ? ["instock", "in stock", "low stock", ""].includes(statusRaw)
      : availableQty > 0);

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td className="px-3 py-3 text-xs md:text-sm text-left border-b text-gray-900 align-top !whitespace-normal">
        <div className="flex items-start gap-2 min-w-0">
          <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Stock thumbnail"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-400">
                <ClipboardListIcon className="h-4 w-4" />
              </div>
            )}
          </div>
          <span
            className="min-w-0 flex-1 !whitespace-normal break-words leading-snug"
            style={{ overflowWrap: "anywhere" }}
            title={data.itemName || "—"}
          >
            {data.itemName || "—"}
          </span>
        </div>
      </td>

      <td className="px-3 py-3 text-[10px] md:text-xs text-left border-b text-gray-600 align-top !whitespace-normal">
        <span
          className="block !whitespace-normal break-words leading-snug"
          style={{ overflowWrap: "anywhere" }}
          title={data.classification || "—"}
        >
          {data.classification || "—"}
        </span>
      </td>

      <td className="px-3 py-3 text-left border-b">
        <div className="mx-auto max-w-[140px]">
          <ProjectBadge project={data.project} className="w-full truncate" />
        </div>
      </td>

      <td className="px-3 py-3 whitespace-nowrap text-xs md:text-sm text-left border-b text-gray-800">
        {qtyHidden ? (
          <span className="text-[10px] font-semibold text-gray-500 uppercase">Hidden</span>
        ) : (
          availableQty
        )}
      </td>

      <td className="px-3 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-600">
        {data.unitofmeasure || "—"}
      </td>

      <td className="px-3 py-3 whitespace-nowrap text-[10px] md:text-xs text-left border-b text-gray-800">
        {data.balance_unit_cost != null
          ? Number(data.balance_unit_cost).toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })
          : "—"}
      </td>

      <td className="px-3 py-3 text-left border-b">
        <StatusPill
          status={data.status}
          qty={qtyHidden ? null : availableQty}
          hideQty={qtyHidden}
          reservedQty={reservedQty}
        />
      </td>

      <td className="px-3 py-3 text-[10px] md:text-xs font-medium text-left border-b">
        <div className="flex flex-col items-center gap-2">
          {canManage && (
            <Link
              to={`/checkitemsupply/${data._id}`}
              className="w-full max-w-[120px] px-2 py-1.5 rounded-xl text-[10px] md:text-xs font-semibold text-white shadow-sm transition-all inline-flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800 whitespace-normal leading-tight text-center"
            >
              <ClipboardListIcon className="h-4 w-4 text-white" />
              Manage
            </Link>
          )}
          {canRequest ? (
            <button
              onClick={() => canAddToCart && onAddToCart(data)}
              disabled={!canAddToCart}
              className="w-full max-w-[120px] px-2 py-1.5 rounded-xl text-[10px] md:text-xs font-semibold shadow-sm transition-all inline-flex items-center justify-center gap-1 whitespace-normal leading-tight text-center"
              style={
                canAddToCart
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(14,116,144,1) 0%, rgba(16,185,129,1) 100%)",
                      color: "#ffffff",
                    }
                  : {
                      backgroundColor: "#e5e7eb",
                      color: "#9ca3af",
                      cursor: "not-allowed",
                    }
              }
            >
              <ShoppingCartIcon className="h-4 w-4" />
              Add to cart
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ItemCard({
  data,
  onAddToCart,
  reservedQty = 0,
  canManage,
  canRequest,
  hideQuantities,
}) {
  const thumbnailUrl = resolveThumbnailUrl(data);
  const qtyHidden = hideQuantities || (data?.balance_qty == null && data?.stock_qty == null);
  const baseQty = qtyHidden ? null : Number(data.balance_qty ?? data.stock_qty ?? 0);
  const availableQty = qtyHidden
    ? null
    : Math.max(0, baseQty - Number(reservedQty || 0));
  const statusRaw = String(data?.status || "").toLowerCase().trim();
  const canAddToCart =
    canRequest &&
    (qtyHidden
      ? ["instock", "in stock", "low stock", ""].includes(statusRaw)
      : availableQty > 0);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Stock thumbnail"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-400">
                <ClipboardListIcon className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3
              className="text-sm md:text-base font-semibold text-slate-900 truncate"
              title={data.itemName || "—"}
            >
              {data.itemName || "—"}
            </h3>
            <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Classification
            </div>
            <p
              className="text-[12px] text-slate-600 truncate"
              title={data.classification || "Unclassified"}
            >
              {data.classification || "Unclassified"}
            </p>
          </div>
        </div>
        <StatusPill
          status={data.status}
          qty={qtyHidden ? null : availableQty}
          hideQty={qtyHidden}
          reservedQty={reservedQty}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ProjectBadge project={data.project} className="max-w-[150px] truncate" />
        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
          Unit: {data.unitofmeasure || "Unit"}
        </span>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          Available: {qtyHidden ? "Hidden" : availableQty}
        </span>
      </div>

      <div className="mt-4">
        <div className="text-[10px] text-slate-400">Unit cost</div>
        <div className="text-sm font-semibold text-slate-900">
          {data.balance_unit_cost != null
            ? Number(data.balance_unit_cost).toLocaleString("en-PH", {
                style: "currency",
                currency: "PHP",
              })
            : "—"}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {canManage ? (
          <Link
            to={`/checkitemsupply/${data._id}`}
            className="w-full px-3 py-2 rounded-xl text-[10px] font-semibold text-white shadow-sm transition-all inline-flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800"
          >
            <ClipboardListIcon className="h-4 w-4 text-white" />
            Manage
          </Link>
        ) : null}
        {canRequest ? (
          <button
            onClick={() => canAddToCart && onAddToCart(data)}
            disabled={!canAddToCart}
            className="w-full px-3 py-2 rounded-xl text-[10px] font-semibold shadow-sm transition-all inline-flex items-center justify-center gap-1"
            style={
              canAddToCart
                ? {
                    background:
                      "linear-gradient(135deg, rgba(14,116,144,1) 0%, rgba(16,185,129,1) 100%)",
                    color: "#ffffff",
                  }
                : {
                    backgroundColor: "#e5e7eb",
                    color: "#9ca3af",
                    cursor: "not-allowed",
                  }
            }
          >
            <ShoppingCartIcon className="h-4 w-4" />
            Add to cart
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, idx) => (
        <td key={idx} className="px-3 py-3 border-b">
          <div className="h-3 w-full rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="h-3 w-24 rounded bg-gray-100" />
      <div className="mt-2 h-4 w-40 rounded bg-gray-100" />
      <div className="mt-1 h-3 w-28 rounded bg-gray-100" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-24 rounded-full bg-gray-100" />
        <div className="h-6 w-16 rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 h-8 w-24 rounded bg-gray-100" />
    </div>
  );
}

/* ---------- main component ---------- */
function Stocktableofficesupply() {
  const { user } = useContext(AuthContext);
  const normalizeRole = (r) =>
    typeof r === "string" ? r.trim().toLowerCase() : "";
  const rawRole =
    user?.role ||
    user?.user?.role ||
    user?.data?.role ||
    user?.data?.user?.role ||
    "";
  const role = normalizeRole(rawRole);
  const roleAccess = useMemo(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("roleAccess");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [user]);
  const canAssignRecipient = ["super admin", "inventory admin"].includes(role);
  const canManageSupply = hasAccessTag(rawRole, "details.office_supplies", roleAccess);
  const canRequestDistribution = hasAccessTag(
    rawRole,
    "stocks.distribution.request",
    roleAccess
  );
  const [inventory, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [hideQtySettings, setHideQtySettings] = useState({
    enabled: false,
    allowedRoles: ["super admin", "inventory admin", "afd"],
  });

  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [viewMode, setViewMode] = useState("table");

  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
  const [users, setUsers] = useState([]);
  const [recipientId, setRecipientId] = useState("");
  const [checkoutPurpose, setCheckoutPurpose] = useState("");

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("info");

  // NEW: prevent double checkout + help with slow network / partial updates
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  /* ---------- helpers: currency ---------- */
  const formatPHP = (val) =>
    Number(val || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" });

  /* ---------- cart: keep local state in-sync with localStorage ---------- */
  const readCart = () => {
    try {
      const raw = localStorage.getItem("cart");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const [cartItems, setCartItems] = useState(() => readCart());

  const persistCart = (items) => {
    localStorage.setItem("cart", JSON.stringify(items));
    setCartItems(items);
  };

  /* Available qty (balance - reserved in cart) for a single item */
  const getAvailableQtyForItem = (item) => {
    if (!item) return 0;
    if (item.balance_qty == null && item.stock_qty == null) return null;
    const base = Number(item.balance_qty ?? item.stock_qty ?? 0);
    const reserved = cartItems.reduce((sum, c) => {
      if (c.returnId === item._id) return sum + Number(c.quantity || 0);
      return sum;
    }, 0);
    return Math.max(0, base - reserved);
  };

  /* Remaining qty you can still add in cart for a specific returnId */
  const getRemainingQtyForReturnId = (returnId) => {
    const invItem = inventory.find((i) => i._id === returnId);
    if (!invItem) return 0;
    if (invItem.balance_qty == null && invItem.stock_qty == null) return null;
    const base = Number(invItem.balance_qty ?? invItem.stock_qty ?? 0);
    const reserved = cartItems.reduce((sum, c) => {
      if (c.returnId === returnId) return sum + Number(c.quantity || 0);
      return sum;
    }, 0);
    return Math.max(0, base - reserved);
  };

  /* ---------- load inventory ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(itemsPerPage));
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (showAvailableOnly) params.set("status", "Instock");

        const res = await fetch(
          `${BASE_URL}/inventoryofficesupply/inventory?${params.toString()}`
        );
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();

        if (Array.isArray(data)) {
          setInventoryData(data.reverse());
          setTotalCount(data.length);
        } else {
          setInventoryData(Array.isArray(data?.data) ? data.data : []);
          setTotalCount(Number(data?.total || 0));
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentPage, itemsPerPage, searchQuery, showAvailableOnly]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncMode = (isSmall) => setViewMode(isSmall ? "grid" : "table");
    syncMode(media.matches);
    const handler = (event) => syncMode(event.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handler);
    } else {
      media.addListener(handler);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handler);
      } else {
        media.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const allowedRoles = Array.isArray(data?.hide_supply_quantity_roles)
          ? data.hide_supply_quantity_roles
              .map((r) => normalizeRole(r))
              .filter(Boolean)
          : ["super admin", "inventory admin", "afd"];
        setHideQtySettings({
          enabled: !!data?.hide_supply_quantities,
          allowedRoles,
        });
      } catch {
        // ignore settings load failures
      }
    };
    loadSettings();
  }, [role]);

  useEffect(() => {
    if (!canAssignRecipient) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/users/directory`, {
          credentials: "include",
          silentStatuses: [403],
          suppressErrorToast: true,
        });
        if (!res.ok) {
          if (!cancelled) setUsers([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("User list load failed:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignRecipient]);

  useEffect(() => {
    if (!canAssignRecipient) return;
    if (!recipientId && user?.data?._id) {
      setRecipientId(user.data._id);
    }
  }, [canAssignRecipient, recipientId, user]);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const currentItems = inventory;

  /* ---------- helpers ---------- */
  const showToast = (msg, type = "info") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(""), 2500);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const toggleShowAvailable = () => {
    setShowAvailableOnly((prev) => !prev);
    setCurrentPage(1);
  };

  /* ---------- Add to Cart ---------- */
  const handleAddToCart = (item) => {
    if (!canRequestDistribution) return;
    if (!user?.data) {
      showToast("You must be logged in to add items.", "error");
      return;
    }
    setSelectedItem(item);
    setQuantity(1);
    setShowRequestPopup(true);
  };

  const handleConfirmAddToCart = () => {
    if (!canRequestDistribution) return;
    if (!selectedItem || !user?.data) return;

    const maxQty = getAvailableQtyForItem(selectedItem); // balance - already reserved
    const qtyNum = Number(quantity);

    if (!qtyNum || qtyNum <= 0) {
      showToast("Please enter a valid quantity.", "error");
      return;
    }

    if (maxQty !== null && qtyNum > maxQty) {
      showToast(`Not enough stock for ${selectedItem.itemName}. Available: ${maxQty}.`, "error");
      return;
    }

    const existingCart = [...cartItems];
    const idx = existingCart.findIndex((c) => c.returnId === selectedItem._id);

    if (idx >= 0) {
      const newQty = Number(existingCart[idx].quantity || 0) + qtyNum;
      if (
        (selectedItem.balance_qty != null || selectedItem.stock_qty != null) &&
        newQty > Number(selectedItem.balance_qty ?? selectedItem.stock_qty ?? 0)
      ) {
        showToast(`Total requested exceeds available for ${selectedItem.itemName}.`, "error");
        return;
      }
      existingCart[idx].quantity = newQty;
      existingCart[idx].totalCost = newQty * Number(selectedItem.balance_unit_cost || 0);
    } else {
      const unitCost = Number(selectedItem.balance_unit_cost || 0);
      existingCart.push({
        stock_no: selectedItem.stock_no, // keep stock_no in cart
        returnId: selectedItem._id,
        classification: selectedItem.classification,
        project: selectedItem.project,
        itemName: selectedItem.itemName,
        unitofmeasure: selectedItem.unitofmeasure,
        quantity: qtyNum,
        unitCost,
        totalCost: unitCost * qtyNum,
        distributedto: user.data.username,
        office: user.data.designation,
        distributedto_is: user.data._id,
      });
    }

    persistCart(existingCart);
    setShowRequestPopup(false);
    setSelectedItem(null);
    setQuantity(1);
    showToast("Added to cart.", "success");
  };

  const handleCancelAddToCart = () => {
    setShowRequestPopup(false);
    setSelectedItem(null);
    setQuantity(1);
  };

  /* ---------- Cart operations ---------- */
  const handleViewCart = () => {
    if (!canRequestDistribution) return;
    setCartItems(readCart());
    setShowCartPopup(true);
  };
  const handleCloseCartPopup = () => setShowCartPopup(false);

  const handleRemoveItemFromCart = (returnId) => {
    const updated = cartItems.filter((item) => item.returnId !== returnId);
    persistCart(updated);
    showToast("Item removed from cart.", "info");
    if (updated.length === 0) {
      setShowCartPopup(false);
    }
  };

  const handleClearCart = () => {
    persistCart([]);
    setShowCartPopup(false);
    setRecipientId("");
    setCheckoutPurpose("");
    showToast("Cart cleared.", "info");
  };

  const handleAddQuantity = (returnId) => {
    const remaining = getRemainingQtyForReturnId(returnId);
    if (remaining !== null && remaining <= 0) {
      showToast("Reached available stock for this item.", "error");
      return;
    }

    const updated = cartItems.map((item) => {
      if (item.returnId === returnId) {
        const newQty = Number(item.quantity || 0) + 1;
        return { ...item, quantity: newQty, totalCost: newQty * Number(item.unitCost || 0) };
      }
      return item;
    });

    persistCart(updated);
  };

  const handleLessQuantity = (returnId) => {
    const updated = cartItems.map((item) => {
      if (item.returnId === returnId && Number(item.quantity || 0) > 1) {
        const newQty = Number(item.quantity || 0) - 1;
        return { ...item, quantity: newQty, totalCost: newQty * Number(item.unitCost || 0) };
      }
      return item;
    });

    persistCart(updated);
  };

  /* ---------- Checkout ---------- */
  const handleCheckoutConfirmation = () => {
    if (!canRequestDistribution) return;
    if (!cartItems.length) {
      showToast("Your cart is empty.", "error");
      return;
    }
    setShowCheckoutPopup(true);
  };

  const handleCancelCheckout = () => setShowCheckoutPopup(false);

  const handleProceedCheckout = async () => {
    if (!canRequestDistribution) return;
    if (isProcessingCheckout) return;

    if (!cartItems.length) {
      showToast("Your cart is empty.", "error");
      setShowCheckoutPopup(false);
      return;
    }
    if (!checkoutPurpose.trim()) {
      showToast("Please enter the purpose of this request.", "error");
      return;
    }
    setIsProcessingCheckout(true);

    try {
      // 1) Validate availability against current inventory snapshot
      for (const item of cartItems) {
        let invItem = inventory.find((i) => i._id === item.returnId);
        if (!invItem) {
          const res = await fetch(
            `${BASE_URL}/inventoryofficesupply/inventory/${item.returnId}`,
            { credentials: "include" }
          );
          if (!res.ok) {
            throw new Error(`Item ${item.itemName} no longer exists in inventory.`);
          }
          invItem = await res.json();
        }

        if (invItem.balance_qty != null || invItem.stock_qty != null) {
          const previousBalance = Number(invItem.balance_qty ?? invItem.stock_qty ?? 0);
          if (Number(item.quantity || 0) > previousBalance) {
            throw new Error(
              `Not enough stock for ${item.itemName}. Available: ${previousBalance}.`
            );
          }
        }
      }

      // 2) Create distribution document (inventory is adjusted upon approval)
      const now = new Date().toISOString();
      const recipientUser = canAssignRecipient
        ? users.find((u) => u._id === recipientId) || user?.data || null
        : user?.data || null;
      const recipientName =
        recipientUser?.username || recipientUser?.name || user?.data?.username || "User";
    const recipientDesignation =
      recipientUser?.designation || user?.data?.designation || "Regional Office";
      const recipientUserId = recipientUser?._id || user?.data?._id || "";

      const resDist = await fetch(`${BASE_URL}/distribute/distributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            stock_no: item.stock_no, // required by backend
            returnId: item.returnId,
            classification: item.classification,
            itemName: item.itemName,
            unitofmeasure: item.unitofmeasure,
            quantity: item.quantity,
            cost: item.unitCost,
            project: item.project || "",
          })),
          distributedto: recipientName,
          office: recipientDesignation,
          distributedto_is: recipientUserId,
          purpose: checkoutPurpose.trim(),
          status: "Pending",
          requeststatus: "For checking",
          date_requested: now,
        }),
      });

      if (!resDist.ok) {
        let errorMessage = "Failed to create distribution.";
        try {
          const payload = await resDist.json();
          if (payload?.message) {
            errorMessage = payload.message;
          }
        } catch {
          // ignore non-JSON error payloads
        }
        throw new Error(errorMessage);
      }

      // 3) Clear cart and close popups
      persistCart([]);
      setShowCheckoutPopup(false);
      setShowCartPopup(false);
      setRecipientId("");
      setCheckoutPurpose("");
      showToast("Checkout successful!", "success");
    } catch (err) {
      console.error("Checkout error:", err);

      showToast(
        err?.message ||
          "Error during checkout. Your request was not submitted. Please try again.",
        "error"
      );
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  /* ---------- render ---------- */
  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center text-sm text-red-600">
        {error.message}
      </div>
    );
  }

  const normalizedRole = normalizeRole(role);
  const shouldShowHiddenBanner =
    hideQtySettings.enabled && !hideQtySettings.allowedRoles.includes(normalizedRole);
  const hideQuantities = shouldShowHiddenBanner;

  const activeCartItems = canRequestDistribution ? cartItems : [];
  const hasCartItems = activeCartItems.length > 0;
  const cartLineCount = activeCartItems.length;
  const cartUnitCount = activeCartItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const cartTotal = activeCartItems.reduce(
    (sum, i) => sum + Number(i.totalCost ?? Number(i.quantity || 0) * Number(i.unitCost || 0)),
    0
  );

  // reserved quantity map per inventory _id
  const reservedById = activeCartItems.reduce((acc, item) => {
    const id = item.returnId;
    if (!id) return acc;
    acc[id] = (acc[id] || 0) + Number(item.quantity || 0);
    return acc;
  }, {});

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      {/* HEADER */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        {/* Breadcrumbs */}
        <Breadcrumbs
          className="mb-3"
          items={[
            { label: "Office Dashboard", to: "/officedashboard" },
            { label: "Inventory" },
            { label: "Office Supplies" },
          ]}
        />

        {shouldShowHiddenBanner && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Quantities hidden.
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCartIcon className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl sm:text-4xl font-light text-slate-900">
              Office <span className="font-semibold">Supplies</span>
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Browse inventory, filter by availability, and manage supply requests.
          </p>
        </div>

        {/* Filter bar */}
        <div className="mt-4">
          <div className="table-filters w-full flex-col items-start justify-start sm:flex-row sm:items-center">
              {/* Search (mobile) */}
              <div className="search-shell w-full sm:hidden">
                <span className="search-icon">
                  <SearchIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search by item, code, status..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="search-input"
                />
              </div>

              {/* Availability toggle */}
              <div className="w-full sm:w-auto flex justify-start">
                <button
                  onClick={toggleShowAvailable}
                  className={`table-button inline-flex items-center gap-2 ${
                    showAvailableOnly
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <AdjustmentsIcon className="h-4 w-4" />
                  {showAvailableOnly ? "Show All" : "Show Available Only"}
                </button>
              </div>

              {/* Search (desktop) */}
              <div className="search-shell w-44 md:w-60 hidden sm:block">
                <span className="search-icon">
                  <SearchIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search by item, code, status..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="search-input"
                />
              </div>

              {/* View Cart (desktop) */}
              {canRequestDistribution ? (
                <button
                  onClick={handleViewCart}
                  className="table-button-primary hidden sm:flex items-center gap-2"
                >
                  <ShoppingCartIcon className="h-5 w-5" />
                  <span>View Cart</span>
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: "#ffffff", color: "#f59e0b" }}
                  >
                    {cartLineCount}
                  </span>
                </button>
              ) : null}
            </div>
        </div>

        {/* Floating cart (mobile) */}
        {canRequestDistribution ? (
          <button
            onClick={handleViewCart}
            type="button"
            aria-label="View cart"
            className="sm:hidden fixed bottom-5 right-5 z-[1200] cart-float inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,0.55)]"
          >
            <span className="relative">
              <ShoppingCartIcon className="h-5 w-5" />
              {cartLineCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              ) : null}
            </span>
            <span className="text-xs font-semibold">Cart</span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-bold bg-white text-amber-600">
              {cartLineCount}
            </span>
          </button>
        ) : null}
      </section>

      {/* TABLE CARD */}
      <section className="w-full px-4 sm:px-6 lg:px-8 pb-10">
        {viewMode === "grid" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              ) : currentItems.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    title="No matching supplies"
                    subtitle="We could not find any supplies that match your filters."
                    hint="Try adjusting filters or clearing search."
                    className="max-w-2xl"
                  />
                </div>
              ) : (
                currentItems.map((item) => (
                  <ItemCard
                    key={item._id}
                    data={item}
                    onAddToCart={handleAddToCart}
                    reservedQty={reservedById[item._id] || 0}
                    canManage={canManageSupply}
                    canRequest={canRequestDistribution}
                    hideQuantities={hideQuantities}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="table-shell table-compact table-flush overflow-x-hidden">
            <table
              className="w-full text-left table-fixed"
              style={{ tableLayout: "fixed", width: "100%" }}
            >
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="h-10 text-gray-800">
                    <TableHeader title="Item Description" className="w-[24%] !text-left" />
                    <TableHeader title="Classification" className="w-[14%]" />
                    <TableHeader title="Project" className="w-[12%]" />
                    <TableHeader title="Qty" className="w-[6%]" />
                    <TableHeader title="Unit" className="w-[6%]" />
                    <TableHeader title="Unit Cost" className="w-[10%]" />
                    <TableHeader title="Status" className="w-[14%]" />
                    <TableHeader title="Actions" className="w-[14%]" />
                  </tr>
                </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10">
                      <EmptyState
                        title="No matching supplies"
                        subtitle="We could not find any supplies that match your filters."
                        hint="Try adjusting filters or clearing search."
                        className="max-w-2xl"
                      />
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => (
                    <TableRow
                      key={item._id}
                      data={item}
                      onAddToCart={handleAddToCart}
                      reservedQty={reservedById[item._id] || 0}
                      canManage={canManageSupply}
                      canRequest={canRequestDistribution}
                      hideQuantities={hideQuantities}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {totalCount > itemsPerPage && (
          <div className="flex items-center justify-between mt-4 text-[10px] md:text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-md border shadow-sm"
              style={
                currentPage === 1
                  ? {
                      backgroundColor: "#f9fafb",
                      color: "#d1d5db",
                      cursor: "not-allowed",
                    }
                  : { backgroundColor: "#ffffff", color: "#374151" }
              }
            >
              Previous
            </button>
            <span className="text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-md border shadow-sm"
              style={
                currentPage === totalPages
                  ? {
                      backgroundColor: "#f9fafb",
                      color: "#d1d5db",
                      cursor: "not-allowed",
                    }
                  : { backgroundColor: "#ffffff", color: "#374151" }
              }
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* TOAST */}
      <Toast type={toastType} message={toastMessage} onClose={() => setToastMessage("")} />

      {/* ADD TO CART MODAL */}
      {canRequestDistribution && showRequestPopup && selectedItem && (
        <ModalShell
          open
          title="Add to Cart"
          subtitle="Supply Request"
          variant="neutral"
          onClose={handleCancelAddToCart}
          maxWidthClass="max-w-md"
        >
            <p className="text-xs md:text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{selectedItem.itemName}</span>
            </p>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs md:text-sm text-gray-500">
                Available:{" "}
                <span className="font-semibold text-gray-900">
                  {getAvailableQtyForItem(selectedItem) ?? "Hidden"}
                </span>
              </div>
              <ProjectBadge project={selectedItem.project} />
            </div>

            <div className="mt-4">
              <label className="block mb-1 text-xs font-medium text-gray-700">Quantity</label>
              <div className="flex">
                <input
                  type="number"
                  min={1}
                  max={getAvailableQtyForItem(selectedItem) ?? undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Enter quantity"
                />
                <button
                  onClick={() => setQuantity((q) => Number(q || 0) + 1)}
                  className="px-3 rounded-r-md border border-l-0 border-gray-300 text-gray-700 hover:bg-gray-50"
                  title="Increase"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={handleConfirmAddToCart}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm inline-flex items-center justify-center gap-2 hover:bg-emerald-700"
              >
                <ShoppingCartIcon className="h-5 w-5" />
                Add to cart
              </button>
              <button
                onClick={handleCancelAddToCart}
                className="w-full rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 hover:bg-gray-200"
              >
                <XIcon className="h-5 w-5" />
                Cancel
              </button>
            </div>
        </ModalShell>
      )}

      {/* VIEW CART MODAL (IMPROVED UI) */}
      {canRequestDistribution && showCartPopup && (
        <ModalShell
          open
          title="Your Cart"
          subtitle="Supply Request"
          variant="neutral"
          onClose={handleCloseCartPopup}
          maxWidthClass="max-w-4xl"
        >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <ShoppingCartIcon className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Cart summary
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {cartLineCount} item{cartLineCount === 1 ? "" : "s"} • {cartUnitCount} unit
                    {cartUnitCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {hasCartItems && (
                <button
                  onClick={handleClearCart}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
                >
                  Clear cart
                </button>
              )}
            </div>

            {/* Body */}
            <div className="mt-4 max-h-[70vh] overflow-y-auto bg-gray-50 rounded-2xl border border-gray-200 px-4 py-4">
              {!hasCartItems ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-left">
                  <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <ShoppingCartIcon className="h-6 w-6 text-gray-500" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900">No items in your cart</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Add supplies from the inventory table, then return here to submit your request.
                  </p>
                  <button
                    onClick={handleCloseCartPopup}
                    className="mt-5 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: "#111827", color: "#ffffff" }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cartItems.map((item) => {
                      const lineTotal =
                        Number(
                          item.totalCost ??
                            Number(item.quantity || 0) * Number(item.unitCost || 0)
                        ) || 0;

                      const remaining = getRemainingQtyForReturnId(item.returnId);
                      const canIncrease = remaining === null ? true : remaining > 0;
                      const canDecrease = Number(item.quantity || 0) > 1;

                      return (
                        <div
                          key={item.returnId}
                          className="bg-white border border-gray-200 rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Left: item info */}
                            <div className="min-w-0">
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5">
                                  <ClipboardListIcon className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                      {item.itemName || "—"}
                                    </p>
                                    <ProjectBadge project={item.project} />
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-gray-400">Stock No:</span>
                                      <span className="font-medium text-gray-800">
                                        {item.stock_no || "—"}
                                      </span>
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-gray-400">Class:</span>
                                      <span className="font-medium text-gray-800">
                                        {item.classification || "—"}
                                      </span>
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-gray-400">Unit:</span>
                                      <span className="font-medium text-gray-800">
                                        {item.unitofmeasure || "—"}
                                      </span>
                                    </span>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-gray-400">Unit cost:</span>
                                      <span className="font-medium text-gray-800">
                                        {formatPHP(item.unitCost)}
                                      </span>
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-gray-400">Remaining to add:</span>
                                      <span
                                        className={`font-semibold ${
                                          remaining === null
                                            ? "text-gray-500"
                                            : remaining > 0
                                            ? "text-gray-900"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {remaining === null ? "Hidden" : remaining}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right: totals */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-500">Line total</p>
                              <p className="text-base font-extrabold text-gray-900">
                                {formatPHP(lineTotal)}
                              </p>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
                              <button
                                onClick={() => handleLessQuantity(item.returnId)}
                                disabled={!canDecrease}
                                className="px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Decrease quantity"
                                title="Decrease"
                              >
                                −
                              </button>
                              <div className="px-4 py-2 text-sm font-semibold text-gray-900 border-l border-r border-gray-200">
                                {item.quantity}
                              </div>
                              <button
                                onClick={() => handleAddQuantity(item.returnId)}
                                disabled={!canIncrease}
                                className="px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                aria-label="Increase quantity"
                                title="Increase"
                              >
                                <PlusIcon className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => handleRemoveItemFromCart(item.returnId)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold"
                              >
                                <XIcon className="h-4 w-4 text-gray-600" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
                    {canAssignRecipient ? (
                      <div className="mb-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                          Distribute to
                        </label>
                        <select
                          value={recipientId}
                          onChange={(e) => setRecipientId(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="">Select recipient</option>
                          {users.map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.username || u.email || u._id}
                              {u.role ? ` — ${u.role}` : ""}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-gray-500">
                          Request will be sent for checking and approval.
                        </p>
                      </div>
                    ) : (
                      <div className="mb-3 text-[11px] text-gray-500">
                        Recipient:{" "}
                        <span className="font-semibold text-gray-900">
                          {user?.data?.username || "You"}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total units</span>
                      <span className="font-semibold text-gray-900">{cartUnitCount}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-600">Estimated total cost</span>
                      <span className="font-extrabold text-gray-900">{formatPHP(cartTotal)}</span>
                    </div>
                    <div className="mt-3 text-[11px] text-gray-500">
                      Submitting will create a request for checking and approval.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {hasCartItems && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                  <button
                    onClick={handleCloseCartPopup}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleClearCart}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Clear cart
                    </button>
                    <button
                      onClick={handleCheckoutConfirmation}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-semibold shadow-sm inline-flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-black"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                      Proceed to Checkout
                    </button>
                  </div>
                </div>
              </div>
            )}
        </ModalShell>
      )}

      {/* CHECKOUT CONFIRMATION MODAL */}
      {canRequestDistribution && showCheckoutPopup && (
        <ModalShell
          open
          title="Confirm Checkout"
          subtitle="Supply Request"
          variant="warning"
          onClose={handleCancelCheckout}
          maxWidthClass="max-w-md"
        >
            <p className="mt-1 text-xs md:text-sm text-gray-600">
              Are you sure you want to submit this request for approval?
            </p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Recipient:{" "}
              <span className="font-semibold text-gray-900">
                {canAssignRecipient
                  ? users.find((u) => u._id === recipientId)?.username ||
                    users.find((u) => u._id === recipientId)?.email ||
                    user?.data?.username ||
                    "User"
                  : user?.data?.username || "You"}
              </span>
            </div>
            <div className="mt-4">
              <label
                htmlFor="checkout-purpose"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                id="checkout-purpose"
                rows={3}
                maxLength={1000}
                value={checkoutPurpose}
                onChange={(event) => setCheckoutPurpose(event.target.value)}
                disabled={isProcessingCheckout}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-gray-100"
                placeholder="State why these supplies are being requested…"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                This text will appear in the Purpose section of the printable RIS.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={handleProceedCheckout}
                disabled={isProcessingCheckout || !checkoutPurpose.trim()}
                className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                <CheckCircleIcon className="h-5 w-5" />
                {isProcessingCheckout ? "Processing..." : "Yes, proceed"}
              </button>
              <button
                onClick={handleCancelCheckout}
                disabled={isProcessingCheckout}
                className="w-full rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed hover:bg-gray-200"
              >
                <XIcon className="h-5 w-5" />
                Cancel
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  );
}

export default Stocktableofficesupply;
