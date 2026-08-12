// src/pages/Request.jsx
import React, { useState, useEffect, useContext, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import { AuthContext } from "../context/AuthContext";
import DICT from "../assets/DICT.png";
import SettingsHeader from "../components/SettingsHeader";
import EmptyState from "../components/EmptyState";
import { hasAccessTag } from "../utils/roleAccess";

const classNames = (...c) => c.filter(Boolean).join(" ");

/* ---------- Reusable table header cell ---------- */
function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-[10px] sm:text-xs font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-100 bg-gray-50 text-left align-middle"
    >
      {title}
    </th>
  );
}

/* ---------- Single row ---------- */
function TableRow({ data, isPendingOfficeSupply, userMap, actionDate }) {
  const hasItemsArray =
    isPendingOfficeSupply && Array.isArray(data.items) && data.items.length > 0;

  const base = hasItemsArray ? data.items[0] : data;

  // Prefer requeststatus for action visibility, but keep final status below if different.
  const primaryStatusLabel = data.requeststatus || data.status || "Unknown";
  const statusRaw = (primaryStatusLabel || "").toLowerCase().trim();

  // Tailwind OLD SAFE defaults (no slate/violet/amber/emerald/rose)
  let statusBg = "bg-gray-100";
  let statusText = "text-gray-800";
  let statusBorder = "border-gray-200";
  let dotColor = "bg-gray-500";

  // Request-status driven colors (action stages)
  if (statusRaw === "for checking") {
    statusBg = "bg-blue-100";
    statusText = "text-blue-800";
    statusBorder = "border-blue-200";
    dotColor = "bg-blue-600";
  } else if (statusRaw === "for approval") {
    statusBg = "bg-purple-100";
    statusText = "text-purple-800";
    statusBorder = "border-purple-200";
    dotColor = "bg-purple-600";
  } else if (statusRaw === "for release") {
    statusBg = "bg-yellow-100";
    statusText = "text-yellow-800";
    statusBorder = "border-yellow-200";
    dotColor = "bg-yellow-600";
  } else if (statusRaw === "to receive") {
    statusBg = "bg-teal-100";
    statusText = "text-teal-800";
    statusBorder = "border-teal-200";
    dotColor = "bg-teal-600";
  } else if (statusRaw === "approved") {
    statusBg = "bg-indigo-100";
    statusText = "text-indigo-800";
    statusBorder = "border-indigo-200";
    dotColor = "bg-indigo-600";
  } else if (statusRaw === "received") {
    statusBg = "bg-green-100";
    statusText = "text-green-800";
    statusBorder = "border-green-200";
    dotColor = "bg-green-600";
  } else if (statusRaw === "declined") {
    statusBg = "bg-red-100";
    statusText = "text-red-800";
    statusBorder = "border-red-200";
    dotColor = "bg-red-600";
  } else {
    // Fallback for legacy final statuses (For Transfer/Disposed/etc.)
    const legacy = (data.status || "").toLowerCase().trim();

    if (legacy === "for transfer") {
      statusBg = "bg-yellow-100";
      statusText = "text-yellow-800";
      statusBorder = "border-yellow-200";
      dotColor = "bg-yellow-600";
    } else if (legacy === "transferred") {
      statusBg = "bg-indigo-100";
      statusText = "text-indigo-800";
      statusBorder = "border-indigo-200";
      dotColor = "bg-indigo-600";
    } else if (legacy === "for disposal") {
      statusBg = "bg-pink-100";
      statusText = "text-pink-800";
      statusBorder = "border-pink-200";
      dotColor = "bg-pink-600";
    } else if (legacy === "disposed") {
      statusBg = "bg-red-100";
      statusText = "text-red-800";
      statusBorder = "border-red-200";
      dotColor = "bg-red-600";
    } else if (legacy === "pending") {
      statusBg = "bg-blue-100";
      statusText = "text-blue-800";
      statusBorder = "border-blue-200";
      dotColor = "bg-blue-600";
    } else if (legacy === "issued") {
      statusBg = "bg-green-100";
      statusText = "text-green-800";
      statusBorder = "border-green-200";
      dotColor = "bg-green-600";
    }
  }

  const statusClass = [
    "inline-flex items-center justify-center px-2.5 py-1",
    "text-[10px] sm:text-xs font-semibold rounded-full border",
    statusBg,
    statusText,
    statusBorder,
  ].join(" ");

  const looksLikeObjectId = (s) =>
    typeof s === "string" && /^[a-f\d]{24}$/i.test(s);

  // Local resolver for name display
  const resolveUsername = (maybeIdOrName, fallback) => {
    if (!maybeIdOrName) return fallback || "";
    if (typeof maybeIdOrName === "string" && !looksLikeObjectId(maybeIdOrName))
      return maybeIdOrName;
    return userMap[maybeIdOrName] || fallback || maybeIdOrName;
  };

  // Name column:
  let issuedToValue = "";
  if (isPendingOfficeSupply) {
    issuedToValue = data.distributedto_is
      ? resolveUsername(data.distributedto_is, data.distributedto)
      : data.distributedto || "";
  } else if (data.status === "For Transfer") {
    issuedToValue = resolveUsername(data.transfered_to, data.transfered_to);
  } else if (data.status === "For Disposal" || data.status === "Disposed") {
    issuedToValue =
      resolveUsername(data.current_holder, data.current_holder) ||
      resolveUsername(data.issued_to, data.issued_to) ||
      resolveUsername(data.transfered_to, data.transfered_to);
  } else {
    issuedToValue = resolveUsername(data.issued_to, data.issued_to);
  }

  const additionalElement =
    hasItemsArray && data.items.length > 1 ? (
      <sup className="ml-0.5 text-[10px] font-semibold text-emerald-600">
        +{data.items.length - 1}
      </sup>
    ) : null;

  const quantityValue = hasItemsArray
    ? base.quantity
    : isPendingOfficeSupply
    ? data.quantity
    : data.qty;
  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      <td
        className="px-4 py-3 text-xs sm:text-sm text-left align-middle border-b border-gray-50 !whitespace-normal break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        <div className="flex flex-col items-start">
          <span className="font-medium text-gray-800 break-words">
            {base.itemName || "—"}
          </span>
          {additionalElement && (
            <span className="mt-0.5 text-[10px] text-emerald-600">
              {additionalElement}
            </span>
          )}
        </div>
      </td>

      <td
        className="px-4 py-3 text-xs sm:text-sm text-left align-middle border-b border-gray-50 !whitespace-normal break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {base.classification || "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-sm text-left align-middle border-b border-gray-50">
        {typeof quantityValue !== "undefined" ? quantityValue : "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-sm text-left align-middle border-b border-gray-50">
        {base.unitofmeasure || "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-left align-middle border-b border-gray-50">
        <div className="flex flex-col items-start gap-1">
          <span className={statusClass}>
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${dotColor}`}
            />
            {primaryStatusLabel}
          </span>
        </div>
      </td>

      <td
        className="px-4 py-3 text-xs sm:text-sm text-left align-middle border-b border-gray-50 !whitespace-normal break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {issuedToValue || "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-[10px] sm:text-xs text-left align-middle border-b border-gray-50 text-gray-600">
        {actionDate || "—"}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-sm text-left align-middle border-b border-gray-50">
        <Link
          to={`/checkform/${data._id}`}
          className="manage-button"
        >
          Manage
        </Link>
      </td>
    </tr>
  );
}

function ItemCard({ data, isPendingOfficeSupply, userMap, actionDate }) {
  const hasItemsArray =
    isPendingOfficeSupply && Array.isArray(data.items) && data.items.length > 0;
  const base = hasItemsArray ? data.items[0] : data;

  const primaryStatusLabel = data.requeststatus || data.status || "Unknown";
  const statusRaw = (primaryStatusLabel || "").toLowerCase().trim();

  let statusBg = "bg-gray-100";
  let statusText = "text-gray-800";
  let statusBorder = "border-gray-200";
  let dotColor = "bg-gray-500";

  if (statusRaw === "for checking") {
    statusBg = "bg-blue-100";
    statusText = "text-blue-800";
    statusBorder = "border-blue-200";
    dotColor = "bg-blue-600";
  } else if (statusRaw === "for approval") {
    statusBg = "bg-purple-100";
    statusText = "text-purple-800";
    statusBorder = "border-purple-200";
    dotColor = "bg-purple-600";
  } else if (statusRaw === "for release") {
    statusBg = "bg-yellow-100";
    statusText = "text-yellow-800";
    statusBorder = "border-yellow-200";
    dotColor = "bg-yellow-600";
  } else if (statusRaw === "to receive") {
    statusBg = "bg-teal-100";
    statusText = "text-teal-800";
    statusBorder = "border-teal-200";
    dotColor = "bg-teal-600";
  } else if (statusRaw === "approved") {
    statusBg = "bg-indigo-100";
    statusText = "text-indigo-800";
    statusBorder = "border-indigo-200";
    dotColor = "bg-indigo-600";
  } else if (statusRaw === "received") {
    statusBg = "bg-green-100";
    statusText = "text-green-800";
    statusBorder = "border-green-200";
    dotColor = "bg-green-600";
  } else if (statusRaw === "declined") {
    statusBg = "bg-red-100";
    statusText = "text-red-800";
    statusBorder = "border-red-200";
    dotColor = "bg-red-600";
  } else {
    const legacy = (data.status || "").toLowerCase().trim();
    if (legacy === "for transfer") {
      statusBg = "bg-yellow-100";
      statusText = "text-yellow-800";
      statusBorder = "border-yellow-200";
      dotColor = "bg-yellow-600";
    } else if (legacy === "transferred") {
      statusBg = "bg-indigo-100";
      statusText = "text-indigo-800";
      statusBorder = "border-indigo-200";
      dotColor = "bg-indigo-600";
    } else if (legacy === "for disposal") {
      statusBg = "bg-pink-100";
      statusText = "text-pink-800";
      statusBorder = "border-pink-200";
      dotColor = "bg-pink-600";
    } else if (legacy === "disposed") {
      statusBg = "bg-red-100";
      statusText = "text-red-800";
      statusBorder = "border-red-200";
      dotColor = "bg-red-600";
    } else if (legacy === "pending") {
      statusBg = "bg-blue-100";
      statusText = "text-blue-800";
      statusBorder = "border-blue-200";
      dotColor = "bg-blue-600";
    } else if (legacy === "issued") {
      statusBg = "bg-green-100";
      statusText = "text-green-800";
      statusBorder = "border-green-200";
      dotColor = "bg-green-600";
    }
  }

  const statusClass = [
    "inline-flex items-center justify-center px-2.5 py-1",
    "text-[10px] font-semibold rounded-full border",
    statusBg,
    statusText,
    statusBorder,
  ].join(" ");

  const looksLikeObjectId = (s) =>
    typeof s === "string" && /^[a-f\\d]{24}$/i.test(s);

  const resolveUsername = (maybeIdOrName, fallback) => {
    if (!maybeIdOrName) return fallback || "";
    if (typeof maybeIdOrName === "string" && !looksLikeObjectId(maybeIdOrName))
      return maybeIdOrName;
    return userMap[maybeIdOrName] || fallback || maybeIdOrName;
  };

  let issuedToValue = "";
  if (isPendingOfficeSupply) {
    issuedToValue = data.distributedto_is
      ? resolveUsername(data.distributedto_is, data.distributedto)
      : data.distributedto || "";
  } else if (data.status === "For Transfer") {
    issuedToValue = resolveUsername(data.transfered_to, data.transfered_to);
  } else if (data.status === "For Disposal" || data.status === "Disposed") {
    issuedToValue =
      resolveUsername(data.current_holder, data.current_holder) ||
      resolveUsername(data.issued_to, data.issued_to) ||
      resolveUsername(data.transfered_to, data.transfered_to);
  } else {
    issuedToValue = resolveUsername(data.issued_to, data.issued_to);
  }

  const additionalCount =
    hasItemsArray && data.items.length > 1 ? `+${data.items.length - 1}` : "";

  const quantityValue = hasItemsArray
    ? base.quantity
    : isPendingOfficeSupply
    ? data.quantity
    : data.qty;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {base.itemName || "—"}
            {additionalCount ? (
              <span className="ml-2 text-[10px] font-semibold text-emerald-600">
                {additionalCount}
              </span>
            ) : null}
          </h3>
          <p className="text-[11px] text-gray-500">{base.classification || "—"}</p>
        </div>
        <span className={statusClass}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${dotColor}`} />
          {primaryStatusLabel}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-600">
        <span className="rounded-full bg-gray-50 px-2.5 py-1">
          Qty: {typeof quantityValue !== "undefined" ? quantityValue : "—"}{" "}
          {base.unitofmeasure || ""}
        </span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-600">
          {issuedToValue || "—"}
        </span>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">
          {actionDate || "—"}
        </span>
      </div>

      <div className="mt-4">
        <Link
          to={`/checkform/${data._id}`}
          className="manage-button px-3 py-2"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, idx) => (
        <td key={idx} className="px-4 py-3 text-left align-middle border-b border-gray-50">
          <div className="h-3 w-full rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="h-4 w-36 rounded bg-gray-100" />
      <div className="mt-2 h-3 w-24 rounded bg-gray-100" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-gray-100" />
        <div className="h-6 w-24 rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 h-8 w-24 rounded bg-gray-100" />
    </div>
  );
}

const getPropertyCategory = (item) => {
  const raw = String(
    item?.category ||
      item?.inventory_category ||
      item?.inventory_type ||
      item?.type ||
      item?.source ||
      ""
  )
    .toLowerCase()
    .trim();
  if (raw.includes("furniture")) return "furniture";
  if (raw.includes("ict")) return "ict";
  if (raw.includes("equip")) return "equipment";
  if (raw.includes("vehicle") || raw.includes("motor")) return "equipment";
  return "equipment";
};

/* ---------- Main component ---------- */
function Request() {
  const [inventory, setInventoryData] = useState([]);
  const [propertyItems, setPropertyItems] = useState([]);
  const [supplyCount, setSupplyCount] = useState(0);
  const [users, setUsers] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir] = useState("desc");

  const [onlyPendingOfficeSupply, setOnlyPendingOfficeSupply] = useState(false);

  // viewMode for property list only
  const [viewMode, setViewMode] = useState("transfers"); // "transfers" | "disposals" | "issuances"
  const [supplyViewMode, setSupplyViewMode] = useState("all"); // "all" | "distributions" | "disposals"
  const [propertyCategory, setPropertyCategory] = useState("equipment");

  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const breadcrumbItems = useMemo(
    () => [
      { label: "Office Dashboard", to: "/officedashboard" },
      { label: "Pending Requests" },
    ],
    []
  );

  const roleRaw = (user?.data?._role || user?.data?.role || "").toString();
  const role = roleRaw.trim().toLowerCase();

  const isAFD = role === "afd";
  const isInventoryAdmin = role === "inventory admin";
  const isRegionalDirector = role === "regional director";
  const isSuperAdmin =
    role === "super admin" || role === "admin" || role === "superadmin";

  const roleAccess = useMemo(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("roleAccess");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const canViewUsersDirectory = useMemo(
    () => hasAccessTag(roleRaw, "users.read", roleAccess),
    [roleRaw, roleAccess]
  );

  const meId = user?.data?._id || "";
  const meUsername = user?.data?.username || "";

  const looksLikeObjectId = (s) =>
    typeof s === "string" && /^[a-f\d]{24}$/i.test(s);

  // userId -> username map
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u && u._id) {
        map[u._id] = u.username || u.email || u._id;
      }
    });
    return map;
  }, [users]);

  const resolveUsername = (maybeIdOrName, fallback) => {
    if (!maybeIdOrName) return fallback || "";
    if (typeof maybeIdOrName === "string" && !looksLikeObjectId(maybeIdOrName))
      return maybeIdOrName;
    return userMap[maybeIdOrName] || fallback || maybeIdOrName;
  };

  const isOtherAgencyTransfer = (inv) => {
    const otherAgencyTarget =
      inv?.transfer_target ||
      inv?.transfer_to ||
      inv?.transfer_to_agency ||
      inv?.transfered_to_agency ||
      inv?.agency_to ||
      inv?.receiving_agency ||
      "";

    const transferTypeRaw =
      (inv?.transfer_type || inv?.transferType || inv?.transfer_mode || "") +
      "";

    return (
      /\bother\s*agency\b/i.test(transferTypeRaw) ||
      (!!otherAgencyTarget && String(otherAgencyTarget).trim() !== "")
    );
  };

  const isDisposalRecord = (inv) => {
    const s = (inv?.status || "").toLowerCase().trim();
    return (
      s === "for disposal" ||
      s === "disposed" ||
      !!inv?.disposal_reason ||
      !!inv?.disposal_notes
    );
  };
  const isReturnToInventoryRecord = (inv) => {
    const s = (inv?.status || "").toLowerCase().trim();
    return s.includes("return to inventory");
  };
  const isIssueRecord = (inv) => {
    const s = (inv?.status || "").toLowerCase().trim();
    return s.includes("for issue");
  };

  const hasTransferIntent = (inv) =>
    !!(
      inv?.transfered_to_id ||
      inv?.transferedto_id ||
      inv?.transferred_to_id ||
      inv?.transfered_to ||
      inv?.transferedto ||
      inv?.transferred_to ||
      inv?.transfer_type ||
      inv?.transferType ||
      inv?.transfer_mode
    );

  const isTransferStage = (inv) => {
    const rs = (inv?.requeststatus || "").toLowerCase().trim();
    return rs === "for approval" || rs === "for release" || rs === "to receive";
  };

  const normalizeStatus = (value) => String(value || "").toLowerCase().trim();

  const needsAttentionDistribution = (dist) => {
    const rs = normalizeStatus(dist?.requeststatus);
    const st = normalizeStatus(dist?.status);
    const requestType = normalizeStatus(dist?.request_type);
    const isDisposal =
      requestType === "disposal" || st === "for disposal" || st === "disposed";

    if (rs === "received" || rs === "declined") return false;
    if (isDisposal && st === "disposed") return false;

    if (rs) {
      return (
        rs === "for checking" ||
        rs.startsWith("for approval") ||
        rs === "for release" ||
        rs === "approved" ||
        rs === "to receive"
      );
    }

    if (isDisposal) return st === "for disposal";

    return st === "pending" || st === "approved";
  };

  const needsAttentionProperty = (inv) => {
    const rs = normalizeStatus(inv?.requeststatus);
    const st = normalizeStatus(inv?.status);
    const disposal = isDisposalRecord(inv);
    const issue = isIssueRecord(inv);
    const returnToInventory = isReturnToInventoryRecord(inv);
    const transferIntent = hasTransferIntent(inv);
    const transferStage = isTransferStage(inv);
    const otherAgency = isOtherAgencyTransfer(inv);

    if (rs === "declined" || rs === "received") return false;
    if (st === "disposed") return false;

    if (disposal) return rs.startsWith("for approval") || st === "for disposal";
    if (issue) return rs.startsWith("for approval") || st.includes("for issue");
    if (returnToInventory)
      return rs === "to receive" || st.includes("return to inventory");

    if (transferIntent) {
      if (transferStage) return true;
      if (st === "for transfer") return true;
      if (rs === "for release" || rs === "to receive") return true;
    }

    if (otherAgency) return false;

    return (
      rs.startsWith("for approval") ||
      rs === "for release" ||
      rs === "to receive"
    );
  };

  const parseDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getSortDate = (item) => {
    const candidates = [
      item?.date_received,
      item?.date_released,
      item?.date_approved,
      item?.date_checked,
      item?.date_requested,
      item?.date_issued,
      item?.updatedAt,
      item?.createdAt,
      item?.date,
    ];
    for (const val of candidates) {
      const parsed = parseDate(val);
      if (parsed) return parsed;
    }
    return null;
  };

  const formatShortDate = (value) => {
    const d = parseDate(value);
    if (!d) return "";
    return d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const matchesDistributionRecipient = (dist) => {
    const toId = dist?.distributedto_is || "";
    const toName = resolveUsername(dist?.distributedto, dist?.distributedto_is);

    if (toId && meId && toId === meId) return true;
    if (meUsername && toName && toName === meUsername) return true;
    return false;
  };

  const matchesPropertyRecipient = (inv) => {
    const issuedToId = inv?.issued_to_id || "";
    const currentHolderId = inv?.current_holder_id || "";
    const transferToId =
      inv?.transfered_to_id ||
      inv?.transferedto_id ||
      inv?.transferred_to_id ||
      inv?.transfered_to_is ||
      inv?.transferedto_is ||
      inv?.transferred_to_is;
    const transferToRaw =
      inv?.transfered_to ?? inv?.transferedto ?? inv?.transferred_to;
    const transferToName = resolveUsername(
      transferToRaw,
      transferToId
    );
    const issuedToName = resolveUsername(inv?.issued_to, inv?.issued_to_id);
    const currentHolderName = resolveUsername(
      inv?.current_holder,
      inv?.current_holder_id
    );

    if (transferToId && meId && transferToId === meId) return true;
    if (transferToRaw && meId && String(transferToRaw) === String(meId))
      return true;
    if (issuedToId && meId && issuedToId === meId) return true;
    if (currentHolderId && meId && currentHolderId === meId) return true;
    if (meUsername && transferToName && transferToName === meUsername)
      return true;
    if (meUsername && issuedToName && issuedToName === meUsername) return true;
    if (meUsername && currentHolderName && currentHolderName === meUsername)
      return true;

    return false;
  };

  /* ---------- Data fetch & role scoping ---------- */
  useEffect(() => {
    if (!user) {
      setError(new Error("Not authenticated"));
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        setError(null);
        setLoading(true);

        const usersPromise = canViewUsersDirectory
          ? fetch(`${BASE_URL}/users/directory`, {
              credentials: "include",
              silentStatuses: [403],
              suppressErrorToast: true,
            }).then((r) => {
              if (!r.ok) return [];
              return r.json();
            })
          : Promise.resolve([]);

        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(itemsPerPage));
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (onlyPendingOfficeSupply) {
          if (supplyViewMode === "disposals") {
            params.set("request_type", "disposal");
          } else if (supplyViewMode === "distributions") {
            params.set("request_type", "distribution");
          }
        }

        if (!isSuperAdmin) {
          if (onlyPendingOfficeSupply) {
            if (isInventoryAdmin) params.set("requeststatus", "For checking");
            else if (isAFD) params.set("requeststatus", "For approval");
            else {
              params.set("requeststatus", "Approved");
              if (user?.data?._id) params.set("recipientId", user.data._id);
              if (user?.data?.username) params.set("recipientName", user.data.username);
            }
          } else {
            if (isAFD) {
              params.set("requeststatus", "For approval");
              params.set("status", "For Disposal");
            } else if (isRegionalDirector) {
              params.set("requeststatus", "For approval");
            } else if (isInventoryAdmin) {
              // Allow both issue approvals and release actions; filter client-side.
            } else {
              if (user?.data?._id) params.set("recipientId", user.data._id);
              if (user?.data?.username) params.set("recipientName", user.data.username);
            }
          }
        }

        if (!onlyPendingOfficeSupply) {
          if (viewMode === "transfers") {
            params.set("view", "transfers");
          } else if (viewMode === "disposals") {
            params.set("view", "disposals");
          } else if (viewMode === "issuances") {
            params.set("status", "For Issue");
          } else if (viewMode === "returns") {
            params.set("view", "returns");
          }
        }

        // IMPORTANT:
        // - Supplies tab shows DISTRIBUTION DOCS
        // - Inventory tab shows PROPERTY inventory items only
        const supplyCountPromise = !onlyPendingOfficeSupply
          ? (async () => {
              const supplyParams = new URLSearchParams();
              if (searchQuery.trim())
                supplyParams.set("search", searchQuery.trim());
              if (supplyViewMode === "disposals") {
                supplyParams.set("request_type", "disposal");
              } else if (supplyViewMode === "distributions") {
                supplyParams.set("request_type", "distribution");
              }

              if (isSuperAdmin) {
                supplyParams.set("attentionOnly", "true");
              } else {
                if (isInventoryAdmin) {
                  supplyParams.set("requeststatus", "For checking");
                } else if (isAFD) {
                  supplyParams.set("requeststatus", "For approval");
                } else {
                  supplyParams.set("requeststatus", "Approved");
                  if (user?.data?._id) supplyParams.set("recipientId", user.data._id);
                  if (user?.data?.username)
                    supplyParams.set("recipientName", user.data.username);
                }
              }

              const url = `${BASE_URL}/distribute/distributions/count?${supplyParams.toString()}`;
              const response = await fetch(url, { credentials: "include" });
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch supply count: ${response.status} ${response.statusText}`
                );
              }
              const payload = await response.json();
              const rawCount =
                payload?.data ??
                payload?.count ??
                payload?.total ??
                payload;
              const count = Number(rawCount);
              return Number.isFinite(count) ? count : 0;
            })().catch((err) => {
              console.warn("Failed to load supply count:", err);
              return 0;
            })
          : Promise.resolve(null);

        const urls = onlyPendingOfficeSupply
          ? [`${BASE_URL}/distribute/distributions?${params.toString()}`]
          : [`${BASE_URL}/requests/property?${params.toString()}`];

        const dataPromises = urls.map((url) =>
          fetch(url, { credentials: "include" }).then((response) => {
            if (!response.ok) {
              throw new Error(
                `Failed to fetch data from ${url}: ${response.status} ${response.statusText}`
              );
            }
            return response.json();
          })
        );

        const [usersData, ...datasets] = await Promise.all([
          usersPromise,
          ...dataPromises,
        ]);
        const supplyCountValue = await supplyCountPromise;

        setUsers(Array.isArray(usersData) ? usersData : []);

        const allItems = datasets.flatMap((payload) => {
          if (Array.isArray(payload)) return payload;
          if (Array.isArray(payload?.data)) return payload.data;
          return [];
        });

        const totalFromServer = datasets.reduce((sum, payload) => {
          if (Array.isArray(payload)) return sum + payload.length;
          return sum + Number(payload?.total || 0);
        }, 0);

        // Super admin sees action-needed records across roles; others see only what needs their action.
        let scoped = [];

          if (isSuperAdmin) {
            if (onlyPendingOfficeSupply) {
              scoped = allItems.filter(needsAttentionDistribution);
            } else {
            scoped = allItems.filter(needsAttentionProperty);
            }
          } else {
          // ACTION-ONLY SCOPES
          if (onlyPendingOfficeSupply) {
            // DISTRIBUTION (Supplies)
            scoped = allItems.filter((d) => {
              const rs = (d?.requeststatus || "").toLowerCase().trim();

              // Inventory Admin: For checking
              if (isInventoryAdmin) return rs === "for checking";

              // AFD: For Approval
              if (isAFD) return rs === "for approval";

              // Others: recipient marks as received when Approved
              return rs === "approved" && matchesDistributionRecipient(d);
            });
          } else {
            // PROPERTY (Equipment/Furniture/ICT/Vehicles)
            scoped = allItems.filter((inv) => {
              const rs = (inv?.requeststatus || "").toLowerCase().trim();
              const disposal = isDisposalRecord(inv);
              const issue = isIssueRecord(inv);
              const returnToInventory = isReturnToInventoryRecord(inv);
              const otherAgency = isOtherAgencyTransfer(inv);

              // AFD: disposal approvals only
              if (isAFD) return disposal && rs === "for approval";

              // RD: property transfer approvals (non-disposal)
              if (isRegionalDirector) return !disposal && !issue && rs === "for approval";

              // Inventory Admin: release step (non-disposal)
              if (isInventoryAdmin)
                return (
                  !disposal &&
                  ((issue && rs === "for approval") ||
                    (returnToInventory && rs === "to receive") ||
                    (!issue && !returnToInventory && rs === "for release"))
                );

              // Recipient: DICT internal only (not other agency), to receive (or empty per your Checkform)
              if (otherAgency) return false;
              return (
                !disposal &&
                !returnToInventory &&
                (rs === "to receive" || rs === "") &&
                matchesPropertyRecipient(inv)
              );
            });
          }
        }

        setInventoryData(scoped);
        if (onlyPendingOfficeSupply) {
          setSupplyCount(scoped.length);
        } else {
          setPropertyItems(scoped);
          if (typeof supplyCountValue === "number") {
            setSupplyCount(supplyCountValue);
          }
        }
        setTotalCount(totalFromServer);
      } catch (err) {
        console.error("Error fetching inventory data:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [
    user,
    onlyPendingOfficeSupply,
    isSuperAdmin,
    isAFD,
    isInventoryAdmin,
    isRegionalDirector,
    currentPage,
    itemsPerPage,
    searchQuery,
    viewMode,
    canViewUsersDirectory,
    supplyViewMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Row helpers ---------- */
  const getDisplayNameForRow = (row) => {
    if (onlyPendingOfficeSupply) {
      return row.distributedto_is
        ? resolveUsername(row.distributedto_is, row.distributedto)
        : row.distributedto || "";
    }
    if (row.status === "For Transfer") {
      return resolveUsername(row.transfered_to, row.transfered_to);
    }
    if (row.status === "For Disposal" || row.status === "Disposed") {
      return (
        resolveUsername(row.current_holder, row.current_holder) ||
        resolveUsername(row.issued_to, row.issued_to) ||
        resolveUsername(row.transfered_to, row.transfered_to)
      );
    }
    if (String(row.status || "").toLowerCase().includes("return to inventory")) {
      return (
        resolveUsername(row.current_holder, row.current_holder) ||
        resolveUsername(row.issued_to, row.issued_to)
      );
    }
    return resolveUsername(row.issued_to, row.issued_to);
  };

  const getBaseForRow = (row) => {
    if (
      onlyPendingOfficeSupply &&
      Array.isArray(row.items) &&
      row.items.length > 0
    ) {
      return row.items[0];
    }
    return row;
  };

  /* ---------- Filtering + pagination ---------- */
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredItems = inventory.filter((item) => {
    const base = getBaseForRow(item);
    const nameResolved = getDisplayNameForRow(item);

    // View filters are UI-only now (data already scoped by role/action)
    let matchesView = true;

    if (!onlyPendingOfficeSupply) {
      const cat = getPropertyCategory(item);
      if (cat !== propertyCategory) return false;
      const rs = (item.requeststatus || "").toLowerCase().trim();
      const st = (item.status || "").toLowerCase().trim();
      const transferPending =
        (rs === "for approval" || rs === "for release" || rs === "to receive") &&
        hasTransferIntent(item);
      const issue = isIssueRecord(item);

      if (viewMode === "transfers") {
        matchesView = st === "for transfer" || transferPending;
      } else if (viewMode === "disposals") {
        matchesView = st === "for disposal" || st === "disposed";
      } else if (viewMode === "issuances") {
        matchesView = issue;
      } else if (viewMode === "returns") {
        matchesView = isReturnToInventoryRecord(item);
      }
    } else {
      const requestType = String(item.request_type || "").toLowerCase().trim();
      const statusLower = String(item.status || "").toLowerCase().trim();
      const isDisposal = requestType === "disposal" || statusLower === "for disposal";

      if (supplyViewMode === "disposals") {
        matchesView = isDisposal || statusLower === "disposed";
      } else if (supplyViewMode === "distributions") {
        matchesView = !isDisposal && statusLower !== "disposed";
      }
    }

    if (!matchesView) return false;

    if (!normalizedSearch) return true;

    const fields = [
      base.itemName,
      base.classification,
      base.unitofmeasure,
      item.status,
      item.requeststatus,
      item.RIS_no,
      item.ris_no,
      nameResolved,
      typeof base.quantity !== "undefined" ? String(base.quantity) : "",
      typeof item.qty !== "undefined" ? String(item.qty) : "",
    ];

    return fields.some(
      (val) =>
        typeof val === "string" &&
        val.toLowerCase().includes(normalizedSearch)
    );
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const da = getSortDate(a);
    const db = getSortDate(b);
    const av = da ? da.getTime() : 0;
    const bv = db ? db.getTime() : 0;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage)) || 1;
  const currentItems = sortedItems;

  /* ---------- Handlers ---------- */
  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleItemsPerPage = (e) => {
    setItemsPerPage(Number(e.target.value || 20));
    setCurrentPage(1);
  };

  const handleSetViewInventory = (category) => {
    if (onlyPendingOfficeSupply) {
      setOnlyPendingOfficeSupply(false);
      setViewMode("transfers");
    }
    if (category) setPropertyCategory(category);
    setCurrentPage(1);
  };

  const handleSetViewSupplies = () => {
    setOnlyPendingOfficeSupply(true);
    setViewMode("transfers");
    setSupplyViewMode("all");
    setCurrentPage(1);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setCurrentPage(1);
  };

  const handleSupplyViewModeChange = (mode) => {
    setSupplyViewMode(mode);
    setCurrentPage(1);
  };

  const handleBack = () => navigate("/officedashboard");

  const viewingSupplies = onlyPendingOfficeSupply;
  const activeCategory = viewingSupplies ? "supplies" : propertyCategory;

  const categoryCounts = useMemo(() => {
    const counts = { equipment: 0, furniture: 0, ict: 0, supplies: 0 };
    propertyItems.forEach((item) => {
      const cat = getPropertyCategory(item);
      if (counts[cat] !== undefined) counts[cat] += 1;
    });
    counts.supplies = supplyCount;
    return counts;
  }, [propertyItems, supplyCount]);

  const propertyViewCounts = useMemo(() => {
    const counts = {
      transfers: 0,
      disposals: 0,
      returns: 0,
      issuances: 0,
    };

    propertyItems.forEach((item) => {
      if (getPropertyCategory(item) !== propertyCategory) return;

      const rs = normalizeStatus(item?.requeststatus);
      const st = normalizeStatus(item?.status);
      const transferPending =
        (rs === "for approval" || rs === "for release" || rs === "to receive") &&
        hasTransferIntent(item);
      const issue = isIssueRecord(item);

      if (st === "for transfer" || transferPending) counts.transfers += 1;
      if (st === "for disposal" || st === "disposed") counts.disposals += 1;
      if (isReturnToInventoryRecord(item)) counts.returns += 1;
      if (issue) counts.issuances += 1;
    });

    return counts;
  }, [propertyItems, propertyCategory]);
  const actionOnly = !isSuperAdmin;

  /* ---------- Render states ---------- */
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
        <section className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm text-center">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Authentication Required
          </h2>
          <p className="text-sm text-gray-600">
            Please sign in to view requests, transfers, and disposal items.
          </p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center px-4">
        <section className="w-full max-w-lg rounded-2xl border border-red-100 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-red-700">
            {error.message || String(error)}
          </p>
          <button
            onClick={handleBack}
            className="mt-4 inline-flex items-center rounded-md px-4 py-2 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: "#111827", color: "#ffffff" }}
          >
            Back to Dashboard
          </button>
        </section>
      </div>
    );
  }

  const pageTitle = isSuperAdmin
    ? "Requests Needing Attention"
    : "My Pending Actions";

  const pageSubtitle = isSuperAdmin
    ? "Super Admin view shows only items that currently need action across roles."
    : "This table only shows records that currently require your action (based on your role and assignment).";
  const emptyTitle = isSuperAdmin ? "No matching requests" : "No pending actions";
  const emptySubtitle = isSuperAdmin
    ? "No records found for the current filters."
    : "No items currently require your action in this tab/view.";
  const emptyHint = "Try adjusting filters or switching tabs.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <section className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col gap-4">
        <SettingsHeader
          crumbs={breadcrumbItems}
          title={pageTitle}
          subtitle={pageSubtitle}
        />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-[10px] sm:text-xs text-gray-500">
            Signed in as{" "}
            <span className="font-semibold text-gray-700">
              {user?.data?.username}
            </span>{" "}
            · Role:{" "}
            <span className="font-semibold text-blue-700">
              {user?.data?._role || user?.data?.role || "User"}
            </span>
            {(actionOnly || isSuperAdmin) && (
              <>
                {" "}
                ·{" "}
                <span className="font-semibold text-amber-600">
                  {isSuperAdmin ? "Needs attention" : "Action-only"}
                </span>
              </>
            )}
          </p>

        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/80 p-4 sm:p-5 shadow-sm">
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-sky-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-indigo-100/60 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="w-full flex flex-col gap-3">
              <div className="table-filters flex-col sm:flex-row sm:items-center xl:hidden">
                {/* Search */}
                <div className="search-shell w-full sm:w-60 md:w-72">
                  <span className="search-icon">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder={
                      viewingSupplies
                        ? "Search item, name, RIS, request status..."
                        : "Search item, name, status, request status..."
                    }
                    value={searchQuery}
                    onChange={handleSearch}
                    className="search-input"
                  />
                </div>

                <div className="w-full sm:flex-1">
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Filter view
                  </label>
                  <select
                    value={activeCategory}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "supplies") {
                        handleSetViewSupplies();
                      } else {
                        handleSetViewInventory(next);
                      }
                    }}
                    className="table-select w-full"
                  >
                    <option value="equipment">Equipment</option>
                    <option value="furniture">Furniture</option>
                    <option value="ict">ICT</option>
                    <option value="supplies">Supplies</option>
                  </select>
                </div>

                {viewingSupplies ? (
                  <div className="w-full sm:flex-1">
                    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Supplies view
                    </label>
                    <select
                      value={supplyViewMode}
                      onChange={(e) => handleSupplyViewModeChange(e.target.value)}
                      className="table-select w-full"
                    >
                      <option value="all">All</option>
                      <option value="distributions">Distributions</option>
                      <option value="disposals">Disposals</option>
                    </select>
                  </div>
                ) : (
                  <div className="w-full sm:flex-1">
                    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                      View mode
                    </label>
                    <select
                      value={viewMode}
                      onChange={(e) => handleViewModeChange(e.target.value)}
                      className="table-select w-full"
                    >
                      <option value="transfers">Transfers</option>
                      <option value="disposals">Disposal</option>
                      <option value="returns">Returns</option>
                      <option value="issuances">Issuance</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="hidden xl:block w-full">
                <div className="request-filterbar flex-1 min-w-[260px]">
                  <div className="search-shell request-search">
                    <span className="search-icon">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder={
                        viewingSupplies
                          ? "Search item, name, RIS, request status..."
                          : "Search item, name, status, request status..."
                      }
                      value={searchQuery}
                      onChange={handleSearch}
                      className="search-input"
                    />
                  </div>

                  <span className="request-divider" aria-hidden="true" />

                  <div className="request-chip-group">
                    <button
                      type="button"
                      onClick={() => handleSetViewInventory("equipment")}
                      className={classNames(
                        "request-chip request-chip-sky",
                        activeCategory === "equipment" && "request-chip-active"
                      )}
                    >
                      Equipment
                      {categoryCounts.equipment > 0 && (
                        <span className="request-chip-count">
                          {categoryCounts.equipment}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetViewInventory("furniture")}
                      className={classNames(
                        "request-chip request-chip-slate",
                        activeCategory === "furniture" && "request-chip-active"
                      )}
                    >
                      Furniture
                      {categoryCounts.furniture > 0 && (
                        <span className="request-chip-count">
                          {categoryCounts.furniture}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetViewInventory("ict")}
                      className={classNames(
                        "request-chip request-chip-indigo",
                        activeCategory === "ict" && "request-chip-active"
                      )}
                    >
                      ICT
                      {categoryCounts.ict > 0 && (
                        <span className="request-chip-count">
                          {categoryCounts.ict}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleSetViewSupplies}
                      className={classNames(
                        "request-chip request-chip-amber",
                        activeCategory === "supplies" && "request-chip-active"
                      )}
                    >
                      Supplies
                      {categoryCounts.supplies > 0 && (
                        <span className="request-chip-count">
                          {categoryCounts.supplies}
                        </span>
                      )}
                    </button>
                  </div>

                  <span className="request-divider" aria-hidden="true" />

                  {viewingSupplies ? (
                    <div className="request-chip-group">
                      <button
                        type="button"
                        onClick={() => handleSupplyViewModeChange("all")}
                        className={classNames(
                          "request-chip request-chip-slate",
                          supplyViewMode === "all" && "request-chip-active"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupplyViewModeChange("distributions")}
                        className={classNames(
                          "request-chip request-chip-sky",
                          supplyViewMode === "distributions" && "request-chip-active"
                        )}
                      >
                        Distributions
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSupplyViewModeChange("disposals")}
                        className={classNames(
                          "request-chip request-chip-rose",
                          supplyViewMode === "disposals" && "request-chip-active"
                        )}
                      >
                        Disposals
                      </button>
                    </div>
                  ) : (
                    <div className="request-chip-group">
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("transfers")}
                        className={classNames(
                          "request-chip request-chip-indigo",
                          viewMode === "transfers" && "request-chip-active"
                        )}
                      >
                        Transfers
                        {propertyViewCounts.transfers > 0 && (
                          <span className="request-chip-count">
                            {propertyViewCounts.transfers}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("disposals")}
                        className={classNames(
                          "request-chip request-chip-rose",
                          viewMode === "disposals" && "request-chip-active"
                        )}
                      >
                        Disposal
                        {propertyViewCounts.disposals > 0 && (
                          <span className="request-chip-count">
                            {propertyViewCounts.disposals}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("returns")}
                        className={classNames(
                          "request-chip request-chip-emerald",
                          viewMode === "returns" && "request-chip-active"
                        )}
                      >
                        Returns
                        {propertyViewCounts.returns > 0 && (
                          <span className="request-chip-count">
                            {propertyViewCounts.returns}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("issuances")}
                        className={classNames(
                          "request-chip request-chip-indigo",
                          viewMode === "issuances" && "request-chip-active"
                        )}
                      >
                        Issuance
                        {propertyViewCounts.issuances > 0 && (
                          <span className="request-chip-count">
                            {propertyViewCounts.issuances}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full xl:w-auto xl:ml-auto" />
            </div>
          </div>
        </div>

        {/* Main card wrapper */}
        <div className="flex-1">
          <div className="w-full rounded-2xl bg-white/95 shadow-sm border border-gray-100 px-3 sm:px-4 md:px-6 pt-3 md:pt-5 pb-4 flex flex-col min-h-[420px]">
            {/* Top strip */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs">
              <div className="text-gray-500">
                Showing{" "}
                <span className="font-semibold text-gray-700">
                  {currentItems.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-700">
                  {totalCount}
                </span>{" "}
                matching record{totalCount === 1 ? "" : "s"}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-[2px] text-[9px] font-medium text-indigo-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Super Admin · Needs attention only
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-[2px] text-[9px] font-medium text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Action-only · Based on Checkform flow
                  </span>
                )}
              </div>
            </div>

            {/* Table area */}
            <div className="table-shell table-compact table-flush relative flex-1 overflow-visible">
              <div className="grid gap-4 p-4 sm:p-5 lg:hidden">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                ) : currentItems.length === 0 ? (
                  <EmptyState
                    title={emptyTitle}
                    subtitle={emptySubtitle}
                    hint={emptyHint}
                    className="max-w-2xl"
                  />
                ) : (
                  currentItems.map((data) => (
                    <ItemCard
                      key={data._id}
                      data={data}
                      isPendingOfficeSupply={onlyPendingOfficeSupply}
                      userMap={userMap}
                      actionDate={formatShortDate(getSortDate(data))}
                    />
                  ))
                )}
              </div>

              <div className="overflow-x-auto overflow-y-visible max-h-[60vh] hidden lg:block">
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "6%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="h-10 text-gray-800">
                      <TableHeader title="Item Description" />
                      <TableHeader title="Classification" />
                      <TableHeader title="Quantity" />
                      <TableHeader title="Unit" />
                      <TableHeader title="Status" />
                      <TableHeader title="Name" />
                      <TableHeader title="Date" />
                      <TableHeader title="Manage" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonRow key={i} />
                      ))
                    ) : currentItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10">
                          <EmptyState
                            title={emptyTitle}
                            subtitle={emptySubtitle}
                            hint={emptyHint}
                            className="max-w-2xl"
                          />
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((data) => (
                        <TableRow
                          key={data._id}
                          data={data}
                          isPendingOfficeSupply={onlyPendingOfficeSupply}
                          userMap={userMap}
                          actionDate={formatShortDate(getSortDate(data))}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {sortedItems.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between text-[10px] sm:text-xs">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-md border px-3 py-1.5 font-medium shadow-sm"
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
                  Page{" "}
                  <span className="font-semibold text-gray-700">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-700">
                    {totalPages}
                  </span>
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-md border px-3 py-1.5 font-medium shadow-sm"
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
          </div>
        </div>

        {/* Back button */}
        <div className="mt-2">
          <button
            onClick={handleBack}
            className="inline-flex items-center rounded-md px-4 py-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: "#e5e7eb", color: "#111827" }}
          >
            Back to Dashboard
          </button>
        </div>
      </section>
    </div>
  );
}

/* ---------- Loading Screen ---------- */
function LoadingScreen() {
  const tips = [
    "Tip: The Status pill shows requeststatus (action stage) first.",
    "Tip: Non-super users only see items that need their action.",
    "Tip: Switch tabs to check if you have supply vs property actions.",
    "Tip: Use search to filter by item, RIS, or request status.",
  ];

  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const t = setInterval(
      () => setTipIndex((i) => (i + 1) % tips.length),
      2200
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
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
      className="fixed inset-0 z-[2000] grid place-items-center bg-gradient-to-br from-indigo-50 via-white to-blue-50"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />

      <div className="relative mx-4 w-full max-w-sm sm:max-w-md rounded-2xl border border-indigo-100/80 bg-white/80 backdrop-blur-md shadow-xl p-4 sm:p-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <img src={DICT} alt="DICT" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
          </div>
          <div className="text-left">
            <p className="text-[13px] sm:text-sm font-semibold text-gray-900">
              Loading Requests, Transfers &amp; Disposal
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500">Region 2 • Action &amp; Overview</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center">
          <div className="relative">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            <div className="absolute inset-0 m-auto h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-indigo-600" />
          </div>
        </div>

        <div className="mt-6">
          <div
            className="w-full h-2 rounded-full bg-indigo-100 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full bg-indigo-600 transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] sm:text-[11px] text-gray-500">
            <span>Fetching records…</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-indigo-50 text-indigo-700 px-3 py-2 text-[11px] sm:text-xs">
          {tips[tipIndex]}
        </div>
      </div>
    </div>
  );
}

export default Request;
