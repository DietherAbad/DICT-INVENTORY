// components/Checkitemsupply.jsx
import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";
import DICT from "../assets/DICT.png";
import { useParams, useNavigate } from "react-router-dom";
import { BASE_URL, resolveServerUrl } from "../utils/config";
import ModalShell from "../components/ModalShell";
import Select from "react-select";
import { AuthContext } from "../context/AuthContext";
import Breadcrumbs from "../components/Breadcrumbs";
import { hasAccessTag } from "../utils/roleAccess";
import { useDesignations } from "../utils/designations";
import { useProjects } from "../utils/projects";
import { useThumbnailUpload } from "../utils/useThumbnailUpload";
import {
  findUserByRoles,
  sendWorkflowActionEmail,
} from "../utils/workflowNotifications";

/**
 * Checkitemsupply
 * - View single supply record
 * - Distribute / Request / Dispose with validation
 * - Generate printable STOCK CARD (RIS-style header)
 *
 * RBAC CHANGE:
 * - Distribute + Dispose buttons (and their actions) are allowed ONLY for:
 *   Super Admin, Inventory Admin, Regional Director
 * - Request remains available (per your original design).
 */

const ROLES = {
  SUPER_ADMIN: "Super Admin",
  INVENTORY_ADMIN: "Inventory Admin",
  REGIONAL_DIRECTOR: "Regional Director",
};

const DISPOSE_DISTRIBUTE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.INVENTORY_ADMIN,
  ROLES.REGIONAL_DIRECTOR,
];

const THRESHOLD_EDIT_ROLES = [ROLES.SUPER_ADMIN, ROLES.INVENTORY_ADMIN];

const normalizeRole = (r) => (typeof r === "string" ? r.trim().toLowerCase() : "");

function getRoleFromUserAnyShape(u) {
  if (!u) return "";
  if (typeof u === "object") {
    return (
      u.role ||
      u.user?.role ||
      u.data?.role ||
      u.data?.user?.role ||
      ""
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

function getRoleSafeFromContextOrStorage(user) {
  let role = getRoleFromUserAnyShape(user);

  if (!role && typeof window !== "undefined") {
    try {
      const stored =
        localStorage.getItem("user") || sessionStorage.getItem("user");
      if (stored) role = getRoleFromUserAnyShape(stored);
    } catch {
      // ignore
    }
  }

  return role;
}

const getEffectiveSupplyQty = (item) => {
  if (!item) return 0;
  const balance = Number(item.balance_qty);
  if (Number.isFinite(balance)) return balance;
  const stock = Number(item.stock_qty);
  if (Number.isFinite(stock)) return stock;
  return 0;
};

const normalizeDesignation = (value) => String(value || "").trim().toLowerCase();

function hasRole(role, allowedRoles) {
  const r = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(r);
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

export default function Checkitemsupply() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { designations: designationOptions, activeSet: activeDesignationSet } =
    useDesignations();
  const { projects: projectOptions } = useProjects();

  const ENTITY_NAME = "DICT REGIONAL OFFICE 02";

  /* -------------------- RBAC -------------------- */
  const role = useMemo(() => getRoleSafeFromContextOrStorage(user), [user]);
  const roleAccess = useMemo(() => getStoredRoleAccess(), [user]);
  const canGenerateStockCard = useMemo(
    () => hasAccessTag(role, "reports.stock_card", roleAccess),
    [role, roleAccess]
  );
  const canDistributeOrDispose = useMemo(
    () => hasRole(role, DISPOSE_DISTRIBUTE_ROLES),
    [role]
  );
  const canEditThreshold = useMemo(
    () => hasRole(role, THRESHOLD_EDIT_ROLES),
    [role]
  );
  const canEditCoreDetails = useMemo(() => {
    const r = normalizeRole(role);
    return r === "super admin" || r === "superadmin" || r === "inventory admin";
  }, [role]);

  /* -------------------- state -------------------- */
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [users, setUsers] = useState([]);
  const [distributions, setDistributions] = useState([]); // for stock card
  const [classificationOptions, setClassificationOptions] = useState([]);
  const [unitMeasureOptions, setUnitMeasureOptions] = useState([]);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'distribute' | 'dispose' | 'request'
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  const [isEditingCore, setIsEditingCore] = useState(false);
  const [coreForm, setCoreForm] = useState({
    balance_qty: "",
    itemName: "",
    classification: "",
    unitofmeasure: "",
    date: "",
    stock_unit_cost: "",
    project: "",
    remarks: "",
  });
  const [coreSaving, setCoreSaving] = useState(false);
  const [coreError, setCoreError] = useState("");
  const [thumbnailSaving, setThumbnailSaving] = useState(false);
  const [thumbnailNotice, setThumbnailNotice] = useState("");

  const {
    file: thumbnailFile,
    preview: thumbnailPreview,
    error: thumbnailError,
    setError: setThumbnailError,
    inputRef: thumbnailInputRef,
    handleChange: handleThumbnailChange,
    clear: clearThumbnail,
  } = useThumbnailUpload();

  // form fields
  const [quantity, setQuantity] = useState("");
  const [designation, setDesignation] = useState("");
  const [distributedTo, setDistributedTo] = useState(null);
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");

  // Low stock threshold editor
  const [thresholdInput, setThresholdInput] = useState("");
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdNotice, setThresholdNotice] = useState("");
  const [hideQtySettings, setHideQtySettings] = useState({
    enabled: false,
    allowedRoles: ["super admin", "inventory admin", "afd"],
  });
  const [documentSignatories, setDocumentSignatories] = useState({});

  // feedback dialogs
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("The operation was completed successfully.");
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // history modal
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const current = inventory?.lowstock_threshold ?? 10;
    setThresholdInput(String(current));
  }, [inventory?._id, inventory?.lowstock_threshold]);

  // stock card modal
  const [stockCardModalOpen, setStockCardModalOpen] = useState(false);
  const [stockCardFrom, setStockCardFrom] = useState("");
  const [stockCardTo, setStockCardTo] = useState("");

  /* -------------------- derived -------------------- */
  const balanceQty = useMemo(() => {
    if (!inventory) return null;
    return getEffectiveSupplyQty(inventory);
  }, [inventory]);

  const unitCost = useMemo(
    () =>
      Number(inventory.stock_unit_cost ?? inventory.purchase_unit_cost ?? 0),
    [inventory]
  );

  const currentThreshold = useMemo(
    () => Number(inventory?.lowstock_threshold ?? 10),
    [inventory]
  );
  const thresholdDirty = String(currentThreshold) !== String(thresholdInput);
  const thresholdNoticeClass =
    thresholdNotice &&
    /(fail|error|enter|invalid|not loaded)/i.test(thresholdNotice)
      ? "text-rose-600"
      : "text-indigo-700";

  const thumbnailUrl = useMemo(() => {
    const raw = inventory?.thumbnail?.url;
    return resolveServerUrl(raw);
  }, [inventory?.thumbnail?.url]);

  const userOptions = useMemo(
    () =>
      (Array.isArray(users) ? users : []).map((u) => ({
        value: u._id,
        label: u.username || u.email || "User",
        email: u.email,
      })),
    [users]
  );

  const inventoryAdminUser = useMemo(
    () =>
      (Array.isArray(users) ? users : []).find(
        (u) => (u.role || "").toLowerCase() === "inventory admin"
      ) || null,
    [users]
  );

  const resolveUserLabel = useCallback(
    (maybeIdOrName) => {
      if (!maybeIdOrName) return "";
      const match = (Array.isArray(users) ? users : []).find(
        (u) => u?._id === maybeIdOrName
      );
      return match?.username || match?.email || maybeIdOrName;
    },
    [users]
  );

  const historyWithDistributions = useMemo(() => {
    const baseHistory = Array.isArray(inventory.history)
      ? [...inventory.history]
      : [];

    const distEvents = (Array.isArray(distributions) ? distributions : []).flatMap(
      (dist) => {
        if (!Array.isArray(dist.items)) return [];
        return dist.items
          .filter((it) => it.returnId === id)
          .map((it) => {
            const statusLabel =
              String(dist.status || "").toLowerCase().trim() === "disposed"
                ? dist.status
                : dist.requeststatus || dist.status || it.status || "";
            const date =
              dist.date_received ||
              dist.date_released ||
              dist.date_approved ||
              dist.date_checked ||
              dist.date_requested ||
              dist.updatedAt ||
              dist.createdAt ||
              "";
            const name =
              resolveUserLabel(dist.distributedto_is) ||
              dist.distributedto ||
              dist.office ||
              "Requestor";
            const docType =
              String(dist?.request_type || "").toLowerCase().trim() === "disposal"
                ? "SDR"
                : "RIS";
            const signedFile = dist?.signed_file || null;
            return {
              name,
              date,
              status: statusLabel,
              remarks: dist.remarks || it.remarks || "",
              history_qty: Number(it.quantity || 0),
              doc_type: docType,
              signed_file: signedFile,
              source: "distribution",
            };
          });
      }
    );

    const merged = [...baseHistory, ...distEvents];
    merged.sort((a, b) => {
      const da = new Date(a?.date || a?.to || a?.from || 0).getTime();
      const db = new Date(b?.date || b?.to || b?.from || 0).getTime();
      return da - db;
    });
    return merged;
  }, [distributions, id, inventory.history, resolveUserLabel]);

  const completedForms = useMemo(() => {
    const isCompletedStatus = (value) => {
      const s = String(value || "").toLowerCase().trim();
      return (
        s === "received" ||
        s === "transferred" ||
        s === "disposed" ||
        s === "issued"
      );
    };
    return (historyWithDistributions || []).filter(
      (h) => h?.signed_file?.url && isCompletedStatus(h?.status)
    );
  }, [historyWithDistributions]);

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
        setDocumentSignatories(data?.document_signatories || {});
      } catch {
        // ignore settings load failures
      }
    };
    loadSettings();
  }, [role]);

  const handlePrintHistory = () => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Pop-up blocked. Please allow pop-ups then try again.");
      return;
    }

    const rows =
      historyWithDistributions.length > 0
        ? historyWithDistributions
            .map(
              (h) => `
          <tr>
            <td>${h.name || "—"}</td>
            <td>${formatDateTime(h.date || h.to || h.from)}</td>
            <td>${h.status || "—"}</td>
            <td>${h.remarks || h.reason || "—"}</td>
            <td>${"history_qty" in h ? h.history_qty : h.disposed_qty || "—"}</td>
            <td>${Number.isFinite(Number(h.unit_cost)) ? formatCurrency(h.unit_cost) : "—"}</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="6">No history available.</td></tr>`;

    w.document.write(`
      <html>
        <head>
          <title>Supply History - ${inventory.itemName || inventory._id || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h2 { margin: 0 0 4px; }
            p { margin: 0 0 16px; color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; text-align: left; }
            th { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h2>Supply History Report</h2>
          <p>${inventory.itemName || "Supply"} • ${inventory.stock_no || ""}</p>
          <table>
            <thead>
              <tr>
                <th>By</th>
                <th>Date</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Qty</th>
                <th>Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  /* -------------------- effects: fetch inventory + users -------------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [invRes, usersRes] = await Promise.all([
          fetch(`${BASE_URL}/inventoryofficesupply/inventory/${id}`, {
            credentials: "include",
          }),
          fetch(`${BASE_URL}/users/directory`, {
            credentials: "include",
            silentStatuses: [403],
            suppressErrorToast: true,
          }),
        ]);

        if (!invRes.ok)
          throw new Error(`Failed to fetch supply (${invRes.status})`);
        if (!usersRes.ok) setUsers([]);

        const invData = await invRes.json();
        const usersData = usersRes.ok ? await usersRes.json() : [];

        if (!cancelled) {
          setInventory(invData || {});
          setUsers(Array.isArray(usersData) ? usersData : []);
          setLoadError("");
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message || "Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const fetchClassificationOptions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/classification`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch classification options");
        const data = await res.json();
        const classifications = Array.isArray(data)
          ? data
              .filter((item) => item.designation === "Office Supplies")
              .map((item) => item.description)
              .filter(Boolean)
          : [];
        setClassificationOptions(classifications);
      } catch (error) {
        console.error("Error fetching classification options:", error);
      }
    };
    fetchClassificationOptions();
  }, []);

  useEffect(() => {
    const fetchUnitMeasures = async () => {
      try {
        const res = await fetch(`${BASE_URL}/measure`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch unit measures");
        const data = await res.json();
        const unitMeasures = Array.isArray(data)
          ? data
              .filter((item) => item.designation === "Office Supplies")
              .map((item) => item.description)
              .filter(Boolean)
          : [];
        setUnitMeasureOptions(unitMeasures);
      } catch (error) {
        console.error("Error fetching unit measures:", error);
      }
    };
    fetchUnitMeasures();
  }, []);

  /* -------------------- effects: fetch distributions for stock card -------------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/distribute/distributions`, {
          credentials: "include",
          silentStatuses: [403],
          suppressErrorToast: true,
        });
        if (!res.ok) {
          console.error(
            "Failed to fetch distributions for stock card:",
            res.status
          );
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          const filtered = Array.isArray(data)
            ? data.filter(
                (dist) =>
                  Array.isArray(dist.items) &&
                  dist.items.some((it) => it.returnId === id)
              )
            : [];
          setDistributions(filtered);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Error loading distributions for stock card:", e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* -------------------- helpers -------------------- */
  const openAction = useCallback(
    (mode) => {
      // RBAC: only selected roles can distribute/dispose
      if ((mode === "distribute" || mode === "dispose") && !canDistributeOrDispose) {
        const msg =
          "Access denied. Only Super Admin, Inventory Admin, and Regional Director can Distribute or Dispose.";
        setErrorMsg(msg);
        setErrorOpen(true);
        return;
      }

      setModalMode(mode);
      setModalError("");
      setQuantity("");
      setPurpose("");
      setRemarks("");
      setDesignation("");

      // Prefill distributedTo on "request" with current user
      if (mode === "request" && user?.data?._id) {
        setDistributedTo({
          value: user.data._id,
          label: user.data.username,
          email: user.data.email,
        });
      } else {
        setDistributedTo(null);
      }

      setModalOpen(true);
    },
    [user, canDistributeOrDispose]
  );

  const closeAction = () => {
    if (modalBusy) return;
    setModalOpen(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const formatDMY = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const toDateInput = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (value) => {
    const amt = Number(value);
    if (!Number.isFinite(amt)) return "—";
    return amt.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  };

  const normalizeOption = (value) => String(value || "").trim().toLowerCase();

  useEffect(() => {
    if (!inventory || isEditingCore) return;
    setCoreForm({
      balance_qty: inventory.balance_qty ?? "",
      itemName: inventory.itemName ?? "",
      classification: inventory.classification ?? "",
      unitofmeasure: inventory.unitofmeasure ?? "",
      date: toDateInput(inventory.date),
      stock_unit_cost:
        inventory.stock_unit_cost ?? inventory.purchase_unit_cost ?? "",
      project: inventory.project ?? "",
      remarks: inventory.remarks ?? "",
    });
  }, [inventory, isEditingCore]);

  const handleCoreChange = (field) => (e) => {
    setCoreForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCoreSave = async () => {
    if (!canEditCoreDetails) return;
    if (coreSaving) return;
    setCoreSaving(true);
    setCoreError("");
    try {
      const payload = {
        balance_qty:
          coreForm.balance_qty === "" ? null : Number(coreForm.balance_qty),
        itemName: coreForm.itemName || "",
        classification: coreForm.classification || "",
        unitofmeasure: coreForm.unitofmeasure || "",
        date: coreForm.date || null,
        stock_unit_cost:
          coreForm.stock_unit_cost === "" ? null : Number(coreForm.stock_unit_cost),
        project: coreForm.project || "",
        remarks: coreForm.remarks || "",
        __v: inventory.__v,
      };

      const res = await fetch(
        `${BASE_URL}/inventoryofficesupply/inventory/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update item details.");
      }
      setInventory(data || inventory);

      let showSuccess = true;
      if (thumbnailFile) {
        try {
          setThumbnailSaving(true);
          const nextThumb = await uploadThumbnailFile(thumbnailFile);
          setInventory((prev) => ({ ...prev, thumbnail: nextThumb || prev?.thumbnail }));
          clearThumbnail();
          setThumbnailNotice("Thumbnail updated.");
          setSuccessMsg("Supply details and photo updated.");
        } catch (err) {
          showSuccess = false;
          setErrorMsg(
            err?.message || "Supply details updated, but photo upload failed."
          );
          setErrorOpen(true);
        } finally {
          setThumbnailSaving(false);
        }
      } else {
        setSuccessMsg("Supply details updated.");
      }

      setIsEditingCore(false);
      if (showSuccess) {
        setSuccessOpen(true);
      }
    } catch (err) {
      setCoreError(err?.message || "Failed to update item details.");
    } finally {
      setCoreSaving(false);
    }
  };

  const uploadThumbnailFile = async (file) => {
    const formData = new FormData();
    formData.append("thumbnail", file);
    const res = await fetch(
      `${BASE_URL}/inventoryofficesupply/inventory/${id}/thumbnail`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.message || "Failed to upload thumbnail.");
    }
    return payload?.data || payload?.thumbnail || payload;
  };

  const handleThumbnailUpload = async () => {
    if (!canEditCoreDetails || thumbnailSaving) return;
    if (!thumbnailFile) {
      setThumbnailNotice("Select a thumbnail image before uploading.");
      return;
    }
    setThumbnailSaving(true);
    setThumbnailNotice("");
    try {
      const nextThumb = await uploadThumbnailFile(thumbnailFile);
      setInventory((prev) => ({ ...prev, thumbnail: nextThumb || prev?.thumbnail }));
      clearThumbnail();
      setThumbnailNotice("Thumbnail updated.");
      setSuccessMsg("Stock photo updated.");
      setSuccessOpen(true);
    } catch (err) {
      setThumbnailNotice(err?.message || "Failed to upload thumbnail.");
      setErrorMsg(err?.message || "Failed to upload thumbnail.");
      setErrorOpen(true);
    } finally {
      setThumbnailSaving(false);
    }
  };

  const handleThumbnailRemove = async () => {
    if (!canEditCoreDetails || thumbnailSaving) return;
    if (!thumbnailUrl) {
      clearThumbnail();
      setThumbnailNotice("No photo to remove.");
      return;
    }
    setThumbnailSaving(true);
    setThumbnailNotice("");
    try {
      const res = await fetch(
        `${BASE_URL}/inventoryofficesupply/inventory/${id}/thumbnail`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || "Failed to remove thumbnail.");
      }
      setInventory((prev) => ({ ...prev, thumbnail: null }));
      clearThumbnail();
      setThumbnailNotice("Photo removed.");
    } catch (err) {
      setThumbnailNotice(err?.message || "Failed to remove thumbnail.");
    } finally {
      setThumbnailSaving(false);
    }
  };

  const classificationChoices = useMemo(() => {
    const list = Array.isArray(classificationOptions)
      ? [...classificationOptions]
      : [];
    const current = coreForm.classification?.trim();
    if (current && !list.some((opt) => normalizeOption(opt) === normalizeOption(current))) {
      list.unshift(current);
    }
    return list;
  }, [classificationOptions, coreForm.classification]);

  const unitMeasureChoices = useMemo(() => {
    const list = Array.isArray(unitMeasureOptions) ? [...unitMeasureOptions] : [];
    const current = coreForm.unitofmeasure?.trim();
    if (current && !list.some((opt) => normalizeOption(opt) === normalizeOption(current))) {
      list.unshift(current);
    }
    return list;
  }, [unitMeasureOptions, coreForm.unitofmeasure]);

  const projectChoices = useMemo(() => {
    const list = Array.isArray(projectOptions) ? [...projectOptions] : [];
    const current = coreForm.project?.trim();
    if (current && !list.some((opt) => normalizeOption(opt) === normalizeOption(current))) {
      list.unshift(current);
    }
    return list;
  }, [projectOptions, coreForm.project]);

  const handleThresholdSave = async () => {
    if (!canEditThreshold) {
      setThresholdNotice("Only admins can update the low stock threshold.");
      return;
    }
    if (thresholdSaving) return;
    if (!inventory?._id) {
      setThresholdNotice("Item not loaded yet.");
      return;
    }
    const nextVal = Math.floor(Number(thresholdInput));
    if (!Number.isFinite(nextVal) || nextVal <= 0) {
      setThresholdNotice("Enter a valid number (minimum 1).");
      return;
    }

    try {
      setThresholdSaving(true);
      setThresholdNotice("");

      const res = await fetch(
        `${BASE_URL}/inventoryofficesupply/inventory/${inventory?._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lowstock_threshold: nextVal, __v: inventory?.__v }),
        }
      );

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to update low stock threshold.");
      }

      const updated = await res.json();
      setInventory(updated || inventory);
      setThresholdNotice("Low stock threshold updated.");
    } catch (e) {
      setThresholdNotice(e.message || "Failed to update threshold.");
    } finally {
      setThresholdSaving(false);
    }
  };

  const isoNow = () => new Date().toISOString();

  const clampQty = (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) return "";
    if (balanceQty != null && n > balanceQty) return String(balanceQty);
    return String(n);
  };

  const esc = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /* -------------------- core updaters -------------------- */
  const optimisticInventoryAfterChange = (q, type) => {
    // type: "dispose" (subtract from balance, also disposed_qty)
    //    or "distribute/request" (subtract from balance, add to distribution_qty)
    const qNum = Number(q);

    const updatedStockQty = Number(inventory.stock_qty || 0) - qNum;
    const updatedStockTotalCost =
      Number(inventory.stock_total_cost || 0) - unitCost * qNum;

    const updatedDistributionQty =
      Number(inventory.distribution_qty || 0) + (type === "dispose" ? 0 : qNum);
    const updatedDistributionTotalCost = updatedDistributionQty * unitCost;

    const baseBalance = balanceQty != null ? balanceQty : Number(inventory.balance_qty || 0);
    const updatedBalanceQty = baseBalance - qNum;
    const updatedBalanceTotalCost = updatedBalanceQty * unitCost;

    const updatedStatus =
      updatedBalanceQty <= 0 ? "Out of stock" : inventory.status;

    const extra = {};
    if (type === "dispose") {
      extra.disposed_qty = Number(inventory.disposed_qty || 0) + qNum;
    }

    return {
      ...inventory,
      stock_qty: Math.max(0, updatedStockQty),
      stock_total_cost: Math.max(0, updatedStockTotalCost),
      distribution_qty: updatedDistributionQty,
      distribution_unit_cost: unitCost,
      distribution_total_cost: Math.max(0, updatedDistributionTotalCost),
      balance_qty: Math.max(0, updatedBalanceQty),
      balance_total_cost: Math.max(0, updatedBalanceTotalCost),
      status: updatedStatus,
      ...extra,
    };
  };

  /* -------------------- actions: distribute / dispose / request -------------------- */
  const handleProceed = async () => {
    try {
      setModalBusy(true);
      setModalError("");

      // RBAC HARD GUARD (not only UI)
      if ((modalMode === "distribute" || modalMode === "dispose") && !canDistributeOrDispose) {
        throw new Error(
          "Access denied. Only Super Admin, Inventory Admin, and Regional Director can Distribute or Dispose."
        );
      }

      const q = parseInt(quantity, 10);

      // validate shared
      if (
        isNaN(q) ||
        q <= 0 ||
        (balanceQty != null && q > balanceQty)
      ) {
        throw new Error("Please enter a valid quantity (1 to current balance).");
      }

      if (modalMode !== "dispose") {
        if (!purpose.trim()) throw new Error("Please enter the purpose of this RIS.");
        if (!designation) throw new Error("Please select Designation (Office).");
        if (!activeDesignationSet.has(normalizeDesignation(designation))) {
          throw new Error("Selected designation is inactive. Choose another.");
        }
        if (!distributedTo?.value || !distributedTo?.label) {
          throw new Error('Please select "Distributed to" (employee).');
        }
      }

      const now = isoNow();
      let createdDistribution = null;

      if (modalMode === "dispose") {
        const requesterName = user?.data?.username || user?.data?.email || "Requester";
        const requesterId = user?.data?._id || user?.data?.id || "";
        const requesterOffice =
          user?.data?.designation || "Regional Office";

        const disposalPayload = {
          request_type: "disposal",
          items: [
            {
              stock_no: inventory.stock_no,
              returnId: id,
              classification: inventory.classification || "",
              itemName: inventory.itemName || "",
              unitofmeasure: inventory.unitofmeasure || "",
              quantity: q,
              cost: unitCost,
            },
          ],
          itemId: inventory._id || id,
          distributedto: requesterName,
          distributedto_is: requesterId || requesterName,
          office: requesterOffice,
          remarks: remarks || "",
          disposal_reason: remarks || "",
          status: "For Disposal",
          requeststatus: "For Approval",
          date_requested: now,
        };

        const distRes = await fetch(`${BASE_URL}/distribute/distributions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(disposalPayload),
        });
        if (!distRes.ok) {
          let msg = "Failed to submit disposal request";
          try {
            const j = await distRes.json();
            if (j?.message) msg = j.message;
          } catch {}
          throw new Error(msg);
        }
        try {
          const j = await distRes.json();
          createdDistribution = j?.data || j || null;
          if (createdDistribution?._id) {
            setDistributions((prev) => {
              const next = Array.isArray(prev) ? [...prev] : [];
              if (next.some((d) => d?._id === createdDistribution._id)) return next;
              next.unshift(createdDistribution);
              return next;
            });
          }
        } catch {}
      } else {
        // For distribute/request, do NOT deduct inventory here.
        // Stock updates happen on approval/receive in the backend.
        const freshRes = await fetch(
          `${BASE_URL}/inventoryofficesupply/inventory/${id}`
        );
        if (!freshRes.ok) {
          throw new Error("Failed to validate current stock.");
        }
        const freshInv = await freshRes.json();
        if (freshInv?.balance_qty != null) {
          const freshBalance = Number(freshInv?.balance_qty ?? 0);
          if (q > freshBalance) {
            throw new Error(
              `Not enough stock. Available: ${freshBalance}. Please adjust quantity.`
            );
          }
        }

        const distPayload = {
          items: [
            {
              stock_no: inventory.stock_no,
              returnId: id,
              classification: inventory.classification || "",
              itemName: inventory.itemName || "",
              unitofmeasure: inventory.unitofmeasure || "",
              quantity: q,
              cost: unitCost,
            },
          ],
          itemId: inventory._id || id,
          stock_no: inventory.stock_no,
          distributedto: distributedTo.label, // username
          office: designation, // office
          distributedto_is: distributedTo.value, // _id
          purpose: purpose.trim(),
          remarks: remarks || "",
          status: "Pending",
          requeststatus: modalMode === "distribute" ? "For Approval" : "For checking",
          date_requested: now,
        };

        const distRes = await fetch(`${BASE_URL}/distribute/distributions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(distPayload),
        });
        if (!distRes.ok) {
          let msg = "Failed to post distribution data";
          try {
            const j = await distRes.json();
            if (j?.message) msg = j.message;
          } catch {}
          throw new Error(msg);
        }
        try {
          const j = await distRes.json();
          createdDistribution = j?.data || j || null;
          if (createdDistribution?._id) {
            setDistributions((prev) => {
              const next = Array.isArray(prev) ? [...prev] : [];
              if (next.some((d) => d?._id === createdDistribution._id)) return next;
              next.unshift(createdDistribution);
              return next;
            });
          }
        } catch {}
      }

      try {
        const needsChecking = modalMode === "request";
        const isDisposalRequest = modalMode === "dispose";
        const configuredOwnerId = needsChecking
          ? documentSignatories?.ris?.checker_id
          : !isDisposalRequest
          ? documentSignatories?.ris?.approver_id
          : "";
        const actionOwner = needsChecking
          ? users.find((person) => person?._id === configuredOwnerId) ||
            findUserByRoles(users, ["Inventory Admin"])
          : users.find((person) => person?._id === configuredOwnerId) ||
            findUserByRoles(users, ["AFD", "AFD Special Access"]);
        const requestType = isDisposalRequest
          ? "Supply Disposal Request (SDR)"
          : "Supply Transfer Request (RIS)";
        const requestReference =
          createdDistribution?.RIS_no ||
          createdDistribution?.ris_no ||
          createdDistribution?._id ||
          id;
        await sendWorkflowActionEmail({
          recipient: actionOwner,
          requestor: {
            email: user?.data?.email,
            username: user?.data?.username,
          },
          requestType,
          reference: `${isDisposalRequest ? "SDR" : "RIS"} No. ${requestReference}`,
          itemSummary: `${inventory.itemName || "Supply"} (${q} ${
            inventory.unitofmeasure || "unit(s)"
          })`,
          status: needsChecking ? "For checking" : "For Approval",
          actionLabel: needsChecking ? "checking" : "approval",
          instructions: needsChecking
            ? "Open the request, verify the requested quantity and recipient, review the signed RIS, then forward or decline it."
            : isDisposalRequest
            ? "Open the request, verify the quantity and disposal reason, review the signed SDR, then approve or decline it."
            : "Open the request, verify the supply details and recipient, review the signed RIS, then approve or decline it.",
          message: `A new ${isDisposalRequest ? "supply disposal" : "supply transfer"} request has been submitted.`,
          requestId: createdDistribution?._id,
          senderName: user?.data?.username,
        });
      } catch (mailErr) {
        console.error("Failed to send supply workflow notification:", mailErr);
      }

      setModalOpen(false);
      setSuccessOpen(true);
    } catch (e) {
      setModalError(e.message || "Action failed.");
      setErrorMsg(e.message || "Action failed.");
      setErrorOpen(true);
    } finally {
      setModalBusy(false);
    }
  };

  /* -------------------- STOCK CARD generation -------------------- */
  const handleGenerateStockCard = () => {
    if (!stockCardFrom || !stockCardTo) {
      alert("Please select both From and To dates.");
      return;
    }

    const fromDate = new Date(`${stockCardFrom}T00:00:00`);
    const toDate = new Date(`${stockCardTo}T23:59:59`);

    if (
      isNaN(fromDate.getTime()) ||
      isNaN(toDate.getTime()) ||
      fromDate > toDate
    ) {
      alert("Invalid date range.");
      return;
    }

    // Build the stock card from the inventory movement ledger. Distribution
    // documents are used only to enrich references and as a legacy fallback.
    const events = [];
    const relevantDistributions = (Array.isArray(distributions) ? distributions : []).filter(
      (dist) => Array.isArray(dist?.items) && dist.items.some((item) => item.returnId === id)
    );
    const distributionDate = (dist) =>
      dist?.date_received ||
      dist?.date_released ||
      dist?.date_approved ||
      dist?.date_checked ||
      dist?.date_requested ||
      dist?.updatedAt ||
      dist?.createdAt;
    const referenceFromRemarks = (remarks) => {
      const match = String(remarks || "").match(/(?:SDR-)?\d{4}-\d{4}-\d{4}/i);
      return match?.[0] || "";
    };
    const matchedIssueDistributionIds = new Set();
    const closestDistribution = (date, qty, wantsDisposal = false, reserveMatch = false) => {
      const candidates = relevantDistributions.filter((dist) => {
        const disposal = String(dist?.request_type || "").toLowerCase().trim() === "disposal";
        if (disposal !== wantsDisposal) return false;
        const status = String(dist?.status || "").toLowerCase().trim();
        const requestStatus = String(dist?.requeststatus || "").toLowerCase().trim();
        const reachedInventory = disposal
          ? status === "disposed" || requestStatus === "approved" || requestStatus === "received"
          : !!dist?.date_received ||
            status === "transferred" ||
            requestStatus === "received" ||
            requestStatus === "transferred";
        if (!reachedInventory) return false;
        if (reserveMatch && matchedIssueDistributionIds.has(String(dist?._id || ""))) return false;
        return dist.items.some(
          (item) => item.returnId === id && Number(item.quantity || 0) === Number(qty || 0)
        );
      });
      const match = candidates.sort((a, b) => {
        const aDate = new Date(distributionDate(a) || 0).getTime();
        const bDate = new Date(distributionDate(b) || 0).getTime();
        return Math.abs(aDate - date.getTime()) - Math.abs(bDate - date.getTime());
      })[0];
      if (reserveMatch && match?._id) matchedIssueDistributionIds.add(String(match._id));
      return match;
    };

    // 1) AUTHORITATIVE MOVEMENT LEDGER
    (Array.isArray(inventory.history) ? inventory.history : []).forEach((h) => {
      const qty = Number(h?.history_qty ?? h?.disposed_qty ?? 0);
      if (!qty) return;
      const date = h?.date ? new Date(h.date) : null;
      if (!date || Number.isNaN(date.getTime())) return;

      const status = String(h?.status || "").toLowerCase().trim();
      const requestStatus = String(h?.requeststatus || "").toLowerCase().trim();
      const explicitType = String(h?.movement_type || "").toLowerCase().trim();
      const isReceipt =
        explicitType === "receipt" ||
        status.includes("reverted") ||
        status.includes("returned") ||
        status.includes("restock") ||
        status.includes("stock in") ||
        status.includes("replenish") ||
        status === "added" ||
        (status.includes("manual stock adjustment") && requestStatus === "receipt");
      const isIssue =
        explicitType === "issue" ||
        status === "distributed" ||
        status.includes("state restored") ||
        status.includes("dispose") ||
        (status.includes("manual stock adjustment") && requestStatus === "issue");
      if (!isReceipt && !isIssue) return;

      const isDisposal = status.includes("dispose") || String(h?.document_type || "").toUpperCase() === "SDR";
      const isDistributionMovement =
        ["RIS", "SDR"].includes(String(h?.document_type || "").toUpperCase()) ||
        status === "distributed" ||
        status.includes("state restored") ||
        status.includes("reverted") ||
        status.includes("returned") ||
        status.includes("dispose");
      const matchedDistribution = isDistributionMovement
        ? closestDistribution(date, qty, isDisposal, isIssue)
        : null;
      const reference =
        h?.reference ||
        referenceFromRemarks(h?.remarks) ||
        matchedDistribution?.RIS_no ||
        matchedDistribution?.ris_no ||
        (isDisposal ? "DISPOSAL" : isIssue ? "ISSUE" : "RECEIPT");
      const station = h?.station || matchedDistribution?.office || "Office Supplies";

      events.push({
        date,
        reference,
        qtyIssue: isIssue ? qty : 0,
        qtyReceive: isReceipt ? qty : 0,
        source: isReceipt ? station : "",
        destination: isIssue
          ? isDisposal
            ? "Disposed"
            : station
          : "",
        movementType: isIssue ? "issue" : "receipt",
      });
    });

    // 2) LEGACY FALLBACK: completed RIS/SDR records created before movement
    // references were stored in the inventory ledger.
    relevantDistributions.forEach((dist) => {
      const isDisposalRequest =
        String(dist?.request_type || "").toLowerCase().trim() === "disposal";
      const status = String(dist.status || "").toLowerCase().trim();
      const rstatus = String(dist.requeststatus || "").toLowerCase().trim();
      const isFinal = isDisposalRequest
        ? status === "disposed" || rstatus === "approved" || rstatus === "received"
        : status === "transferred" || rstatus === "transferred" || rstatus === "received";
      if (!isFinal) return;
      const dateStr = distributionDate(dist);
      const date = dateStr ? new Date(dateStr) : null;
      if (!date || Number.isNaN(date.getTime())) return;

      if (!Array.isArray(dist.items)) return;

      dist.items.forEach((item) => {
        if (item.returnId === id) {
          const qty = Number(item.quantity || 0);
          if (!qty) return;
          const ref =
            dist.RIS_no ||
            dist.ris_no ||
            dist.reference ||
            (dist._id ? `…${String(dist._id).slice(-6)}` : "");
          const destination = isDisposalRequest
            ? "Disposed"
            : dist.office || dist.distributedto || "";
          const alreadyRecorded = events.some(
            (event) =>
              event.movementType === "issue" &&
              Number(event.qtyIssue || 0) === qty &&
              String(event.reference || "") === String(ref || "")
          );
          if (!alreadyRecorded) {
            events.push({
              date,
              reference: ref,
              qtyIssue: qty,
              qtyReceive: 0,
              source: "",
              destination,
              movementType: "issue",
            });
          }
        }
      });
    });

    // Sort events by date ascending
    events.sort((a, b) => {
      const da = a.date.getTime();
      const db = b.date.getTime();
      if (da !== db) return da - db;
      return String(a.reference || "").localeCompare(String(b.reference || ""));
    });

    // Compute balance at start of period (fromDate) using current balance
    let balanceAtFrom = Number(getEffectiveSupplyQty(inventory) || 0);
    if (!Number.isFinite(balanceAtFrom)) balanceAtFrom = 0;
    events.forEach((e) => {
      if (e.date >= fromDate) {
        balanceAtFrom += Number(e.qtyIssue || 0);
        balanceAtFrom -= Number(e.qtyReceive || 0);
      }
    });

    // Events within date range
    const eventsInRange = events.filter(
      (e) => e.date >= fromDate && e.date <= toDate
    );

    // Running balance display
    let runningBalance = balanceAtFrom;

    const formatDateDMY = (d) => {
      if (!d) return "";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    // Header fields
    const itemName = inventory.itemName || "";
    const description =
      inventory.description || inventory.classification || inventory.remarks || "";
    const unitOfMeasure = inventory.unitofmeasure || "";
    const proj = (inventory.project || "").toLowerCase().trim();
    const fundClusterLabel =
      proj === "free wifi" || proj === "freewifi" ? "Free Wifi" : "Regular";
    const stockNo = inventory.stock_no || "";
    const currentBalanceLabel = getEffectiveSupplyQty(inventory);
    const invAdminName =
      inventoryAdminUser?.username || inventoryAdminUser?.name || "Inventory Admin";
    const invAdminDesignation =
      inventoryAdminUser?.position || inventoryAdminUser?.role || "Inventory Admin";

    const pri = window.open("", "", "width=1000,height=800");
    if (!pri) {
      alert("Pop-up blocked. Please allow pop-ups then try again.");
      return;
    }

    let eventRowsHTML = "";
    if (eventsInRange.length === 0) {
      eventRowsHTML = `
        <tr>
          <td class="tc" colspan="8">No stock movement found in the selected period.</td>
        </tr>
      `;
    }
    eventsInRange.forEach((e) => {
      const qtyIssue = Number(e.qtyIssue || 0);
      const qtyReceive = Number(e.qtyReceive || 0);
      const after = runningBalance + qtyReceive - qtyIssue;
      runningBalance = after;
      eventRowsHTML += `
        <tr>
          <td class="tc">${esc(formatDateDMY(e.date))}</td>
          <td class="tc">${esc(e.reference || "")}</td>
          <td class="tc">${qtyReceive ? esc(String(qtyReceive)) : ""}</td>
          <td class="desc">${esc(e.source || "")}</td>
          <td class="tc">${qtyIssue ? esc(String(qtyIssue)) : ""}</td>
          <td class="desc">${esc(e.destination || "")}</td>
          <td class="tc">${esc(String(after))}</td>
          <td class="tc">
            
          </td>
        </tr>
      `;
    });

    pri.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Stock Card</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff; font-size: 11px; line-height: 1.4;
    }
    @page { size: A4; margin: 10mm; }

    .frame { padding: 0; background: #ffffff; box-shadow: none; }
    .card  { background: #ffffff; border-radius: 0; }
    .paper { background:#ffffff; border:none; border-radius:0; padding:10mm; width:100%; }

    .bar { display:flex; align-items:center; justify-content:space-between;
           padding:10px 0; border-bottom:1px solid #e2e8f0; background: #ffffff; }
    .brand { display:flex; align-items:center; gap:10px; }
    .brand-logo { height:22px; width:22px; display:flex; align-items:center; justify-content:center;
                  background:#ffffff; border:1px solid #e2e8f0; border-radius:4px;
                  padding:2px; }
    .brand-title { font-weight:800; font-size:12px; letter-spacing:0.02em; color:#0f172a; }
    .brand-sub { font-style:italic; color:#475569; font-size:9px; }
    .bar-right { text-align:right; line-height:1.15; }
    .chip { display:inline-flex; align-items:center; gap:6px; background:#eef2ff; color:#4338ca;
            border:1px solid #e0e7ff; border-radius:999px; padding:4px 8px; font-weight:600;
            font-size:9px; letter-spacing:0.04em; text-transform:uppercase; }
    .chip-dot { width:6px; height:6px; border-radius:999px; background:#4f46e5; }
    .tiny-note { color:#64748b; font-size:9px; }

    .header { text-align:center; margin:6px 0 10px 0; }
    .logo { height:34px; object-fit:contain; margin:2px auto 4px auto; display:block; }
    .header-lines .a { font-weight:700; font-style:italic; font-size:10px; }
    .header-lines .b { font-weight:800; font-size:11px; }
    .header-lines .c { font-weight:700; font-style:italic; font-size:10px; letter-spacing:0.02em; }
    .header-lines .d { font-style:italic; font-size:9px; color:#475569; }
    .sc-title { margin-top:6px; font-size:14px; font-weight:900; letter-spacing:0.18em; color:#0f172a; }

    table { border-collapse: collapse; width:100%; }

    .meta-table td {
      border:1px solid #e2e8f0;
      padding:6px 6px;
      vertical-align:middle;
      font-size:10px;
    }
    .meta-table .k {
      background:#f8fafc;
      font-weight:700;
      color:#0f172a;
      width:26%;
      text-transform:uppercase;
      letter-spacing:0.04em;
      font-size:9px;
    }
    .meta-table .v { font-style:italic; }

    .items thead th {
      border:1px solid #e2e8f0;
      padding:6px 6px;
      background:#f1f5f9;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:0.06em;
      font-size:10px;
      color:#0f172a;
      text-align:center;
    }
    .items tbody td {
      border:1px solid #e2e8f0;
      padding:6px 6px;
      font-size:10px;
    }
    .tc { text-align:center; }
    .desc { font-style:italic; }

    .meta-range {
      margin-top:6px;
      font-size:9px;
      color:#475569;
      font-style:italic;
      text-align:right;
    }

    .sigs { margin-top:16px; }
    .sigs td { padding:12px 8px; text-align:center; vertical-align:bottom; }
    .sig-line { width:60%; border-top:1px solid #0f172a; margin:0px auto 4px auto; }
    .sig-name { font-weight:800; font-size:10px; color:#0f172a; }
    .sig-role { font-size:9px; color:#475569; font-style:italic; }

    .foot {
      margin-top:10px;
      font-size:9px;
      color:#475569;
      font-style:italic;
      border-top:1px solid #e2e8f0;
      padding-top:8px;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="card">
      <div class="paper">
        <div class="bar">
          <div class="brand">
            <div class="brand-logo">
              <img src="${esc(DICT)}" alt="DICT" style="height:16px;width:auto;" />
            </div>
            <div>
              <div class="brand-title">STOCK CARD</div>
              <div class="brand-sub">Office supply stock movement • System-generated</div>
            </div>
          </div>
          <div class="bar-right">
            <div class="chip"><span class="chip-dot"></span><span>STOCK CARD</span></div>
            <div class="tiny-note"><b>Item:</b> ${esc(itemName)} • <b>Unit:</b> ${esc(unitOfMeasure)}</div>
          </div>
        </div>

        <div class="header">
          <img class="logo" src="${esc(DICT)}" alt="DICT Logo" />
          <div class="header-lines">
            <div class="a">REPUBLIC OF THE PHILIPPINES</div>
            <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
            <div class="c">${esc(ENTITY_NAME)}</div>
            <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
          </div>
          <div class="sc-title">STOCK CARD</div>
        </div>

        <table class="meta-table" style="margin-top:8px;">
          <tbody>
            <tr>
              <td class="k">Entity Name:</td>
              <td class="v" colspan="3"><b><i>${esc(ENTITY_NAME)}</i></b></td>
            </tr>
            <tr>
              <td class="k">Item:</td>
              <td class="v"><b><i>${esc(itemName)}</i></b></td>
              <td class="k">Description:</td>
              <td class="v"><i>${esc(description)}</i></td>
            </tr>
            <tr>
              <td class="k">Unit of Measure:</td>
              <td class="v"><i>${esc(unitOfMeasure)}</i></td>
              <td class="k">Fund Cluster:</td>
              <td class="v"><i>${esc(fundClusterLabel)}</i></td>
            </tr>
            <tr>
              <td class="k">Stock No.:</td>
              <td class="v"><i>${esc(stockNo)}</i></td>
              <td class="k">Re-order Point:</td>
              <td class="v"><i>________________</i></td>
            </tr>
            <tr>
              <td class="k">Current Balance:</td>
              <td class="v" colspan="3"><b><i>${esc(String(currentBalanceLabel))}</i></b></td>
            </tr>
          </tbody>
        </table>

        <div class="meta-range">
          Period covered: <b>${esc(formatDateDMY(fromDate))}</b> to <b>${esc(formatDateDMY(toDate))}</b>
        </div>

        <table class="items" style="margin-top:10px;">
          <thead>
            <tr>
              <th rowspan="2">Date</th>
              <th rowspan="2">Reference (RIS No.)</th>
              <th colspan="2">Receipt</th>
              <th colspan="2">Issue</th>
              <th rowspan="2">Balance Qty</th>
              <th rowspan="2">No. of days to consume</th>
            </tr>
            <tr>
              <th>Qty</th>
              <th>Source</th>
              <th>Qty Issued</th>
              <th>Destination</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="tc">${esc(formatDateDMY(fromDate))}</td>
              <td class="tc">Balance B/F</td>
              <td class="tc">${esc(String(balanceAtFrom))}</td>
              <td class="desc">Balance at period start</td>
              <td class="tc"></td>
              <td class="desc"></td>
              <td class="tc">${esc(String(balanceAtFrom))}</td>
              <td class="tc"></td>
            </tr>

            ${eventRowsHTML}
          </tbody>
        </table>

        <table class="sigs" style="width:100%; margin-top:18px;">
          <tbody>
            <tr>
              <td>
                <div style="font-size:9px; color:#475569; margin-bottom:4px; font-style:italic;">
                  Certified correct by:
                </div>
                <div class="sig-line"></div>
                <div class="sig-name">${esc(invAdminName)}</div>
                <div class="sig-role">${esc(invAdminDesignation)}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="foot">
          This Stock Card is system-generated by the DICT Region 02 Inventory System
          and is valid only upon affixing the required signature of the Inventory Admin.
        </div>
      </div>
    </div>
  </div>

  <script>
    window.focus();
    setTimeout(function () { window.print(); window.close(); }, 50);
  </script>
</body>
</html>
    `);

    pri.document.close();
    pri.focus();
    setStockCardModalOpen(false);
  };

  /* -------------------- render gates -------------------- */
  if (loading) {
    return (
      <div
        className="fixed inset-0 z-[2000] grid place-items-center bg-gradient-to-br from-white via-slate-50 to-blue-50"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-3xl border border-slate-800/40 bg-slate-900/95 shadow-2xl">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -top-16 -right-10 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-indigo-500/20 blur-2xl" />
          </div>
          <div className="relative p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center">
                <img src={DICT} alt="DICT" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                  Inventory Details
                </p>
                <p className="text-lg font-semibold text-white">
                  Loading Supply Details
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-800/70 bg-slate-950/40 px-4 py-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Preparing records</span>
                <span className="animate-pulse">…</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-800/80 overflow-hidden">
                <div className="h-full w-2/3 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4">
        <div className="max-w-md w-full bg-white border border-red-100 shadow-sm rounded-2xl p-6 text-center">
          <p className="text-red-600 font-semibold mb-1">Unable to load</p>
          <p className="text-sm text-gray-600">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-semibold hover:bg-black"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const normalizedRole = normalizeRole(role);
  const shouldShowHiddenBanner =
    hideQtySettings.enabled && !hideQtySettings.allowedRoles.includes(normalizedRole);

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 py-8">
      <div className="mx-auto w-full max-w-6xl px-4">
        <Breadcrumbs
          className="mb-4"
          items={[
            { label: "Office Inventory", to: "/officedashboard" },
            { label: "Office Supplies", to: "/stocktableofficesupply" },
            { label: "Supply Details" },
          ]}
        />
        {shouldShowHiddenBanner && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Quantities hidden.
          </div>
        )}
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/stocktableofficesupply")}
            className="inline-flex items-center justify-center h-10 px-4 gap-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800"
          >
            ← Back to list
          </button>

          <div className="flex items-center gap-2">
            {canGenerateStockCard && (
              <button
                onClick={() => setStockCardModalOpen(true)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Generate Stock Card
              </button>
            )}
            <img src={DICT} alt="DICT" className="h-8 w-8 object-contain" />
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: details */}
          <div className="bg-white/90 rounded-3xl border border-slate-200/80 shadow-sm p-6 lg:p-7">
            <div className="mb-4 h-1.5 w-12 rounded-full bg-slate-900" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">PROPERTY OF</p>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900">
                  DICT REGION 2
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  View History
                </button>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-lg md:text-xl font-extrabold uppercase tracking-[0.08em] text-gray-900">
                {inventory.itemName || "Supply"}
              </h3>
              <p className="text-sm lowercase text-gray-600">
                {inventory.classification || "Unclassified"}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <Row label="Stock No." value={inventory.stock_no} />
              <Row label="Stock Quantity" value={inventory.balance_qty} />
              <Row label="Total Distributed" value={inventory.distribution_qty} />
              <Row
                label="Date Acquired"
                value={inventory.date ? formatDate(inventory.date) : ""}
              />
              <Row
                label="Unit Cost"
                value={
                  unitCost
                    ? unitCost.toLocaleString("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      })
                    : ""
                }
              />
              {inventory.project ? <Row label="Project" value={inventory.project} /> : null}
              <Row label="Status" value={inventory.status} />
              {inventory.remarks ? <Row label="Remarks" value={inventory.remarks} /> : null}
            </div>

            {canEditCoreDetails && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Edit core details
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCoreError("");
                      setIsEditingCore((prev) => !prev);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {isEditingCore ? "Close" : "Edit"}
                  </button>
                </div>

                {isEditingCore && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-slate-600">
                      Quantity
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={coreForm.balance_qty}
                        onChange={handleCoreChange("balance_qty")}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Item name
                      <input
                        type="text"
                        value={coreForm.itemName}
                        onChange={handleCoreChange("itemName")}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Classification
                      <select
                        value={coreForm.classification}
                        onChange={handleCoreChange("classification")}
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="" disabled>
                          Select classification
                        </option>
                        {classificationChoices.map((option) => (
                          <option key={`classification-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Unit of measure
                      <select
                        value={coreForm.unitofmeasure}
                        onChange={handleCoreChange("unitofmeasure")}
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="" disabled>
                          Select unit of measure
                        </option>
                        {unitMeasureChoices.map((option) => (
                          <option key={`unit-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Date acquired
                      <input
                        type="date"
                        value={coreForm.date}
                        onChange={handleCoreChange("date")}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Unit cost
                      <input
                        type="number"
                        value={coreForm.stock_unit_cost}
                        onChange={handleCoreChange("stock_unit_cost")}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                      Project
                      <select
                        value={coreForm.project}
                        onChange={handleCoreChange("project")}
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="" disabled>
                          Select project
                        </option>
                        {projectChoices.map((option) => (
                          <option key={`project-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                      Remarks
                      <input
                        type="text"
                        value={coreForm.remarks}
                        onChange={handleCoreChange("remarks")}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                            Stock Photo
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Upload a new thumbnail for listings and requests.
                          </p>
                        </div>
                        {thumbnailUrl ? (
                          <a
                            href={thumbnailUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                          >
                            View current
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr]">
                        <div className="relative">
                          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                            {thumbnailPreview || thumbnailUrl ? (
                              <img
                                src={thumbnailPreview || thumbnailUrl}
                                alt={inventory.itemName || "Stock thumbnail"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                                No photo
                              </div>
                            )}
                          </div>
                          {thumbnailPreview ? (
                            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold text-slate-600 shadow">
                              Preview
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold text-slate-700">
                                  Choose file
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {thumbnailFile
                                    ? `Selected: ${thumbnailFile.name} (${Math.round(
                                        thumbnailFile.size / 1024
                                      )}KB)`
                                    : "JPG/PNG/WebP, max 5MB. Auto-compressed."}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => thumbnailInputRef.current?.click()}
                                  className="rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-[11px] font-semibold text-white hover:bg-slate-800"
                                >
                                  Browse
                                </button>
                                {thumbnailFile ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      clearThumbnail();
                                      setThumbnailError("");
                                    }}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                                  >
                                    Clear
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <input
                              ref={thumbnailInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleThumbnailChange}
                              className="sr-only"
                            />
                          </div>

                          {thumbnailError ? (
                            <p className="text-[11px] text-rose-600">{thumbnailError}</p>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleThumbnailUpload}
                              disabled={!thumbnailFile || thumbnailSaving}
                              className="rounded-full bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {thumbnailSaving ? "Uploading..." : "Update photo"}
                            </button>
                            {thumbnailUrl ? (
                              <button
                                type="button"
                                onClick={handleThumbnailRemove}
                                disabled={thumbnailSaving}
                                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Remove photo
                              </button>
                            ) : null}
                          </div>

                          {thumbnailNotice ? (
                            <p className="text-[11px] text-slate-600">{thumbnailNotice}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {coreError && (
                      <div className="sm:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {coreError}
                      </div>
                    )}
                    <div className="sm:col-span-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingCore(false)}
                        className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCoreSave}
                        disabled={coreSaving}
                        className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {coreSaving ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Low stock threshold editor */}
            {canEditThreshold && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Low stock threshold
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Current: <span className="font-semibold">{currentThreshold}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={thresholdInput}
                      onChange={(e) => setThresholdInput(e.target.value)}
                      className="w-24 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      aria-label="Low stock threshold"
                    />
                    <button
                      type="button"
                      onClick={handleThresholdSave}
                      disabled={!thresholdDirty || thresholdSaving}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {thresholdSaving ? "Saving..." : "Update"}
                    </button>
                  </div>
                </div>
                {thresholdNotice && (
                  <p className={`mt-2 text-[11px] ${thresholdNoticeClass}`}>
                    {thresholdNotice}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            {inventory.status !== "Out of stock" && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Distribute (restricted) */}
                {canDistributeOrDispose ? (
                  <button
                    onClick={() => openAction("distribute")}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                    aria-label="Distribute"
                    title="Distribute (Super Admin / Inventory Admin / Regional Director only)"
                  >
                    Distribute
                  </button>
                ) : (
                  <div
                    className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-400 px-4 py-3 text-sm font-semibold border border-slate-200 cursor-not-allowed"
                    title="Restricted to Super Admin, Inventory Admin, and Regional Director"
                  >
                    Distribute
                  </div>
                )}

                {/* Dispose (restricted) */}
                {canDistributeOrDispose ? (
                  <button
                    onClick={() => openAction("dispose")}
                    className="inline-flex items-center justify-center rounded-full bg-rose-600 text-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2"
                    aria-label="Dispose"
                    title="Dispose (Super Admin / Inventory Admin / Regional Director only)"
                  >
                    Dispose
                  </button>
                ) : (
                  <div
                    className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-400 px-4 py-3 text-sm font-semibold border border-slate-200 cursor-not-allowed"
                    title="Restricted to Super Admin, Inventory Admin, and Regional Director"
                  >
                    Dispose
                  </div>
                )}

                {/* Request (allowed) */}
                <button
                  onClick={() => openAction("request")}
                  className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
                  aria-label="Request"
                  title="Request"
                >
                  Request
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: visual / logo */}
          <div className="relative bg-white/90 rounded-3xl border border-slate-200/80 shadow-sm p-6 lg:p-7 flex items-center justify-center">
            <div className="absolute inset-x-6 top-6 h-1.5 w-10 rounded-full bg-slate-900" />
            <div className="text-center">
              <div className="mx-auto h-40 w-40 sm:h-56 sm:w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                {thumbnailPreview || thumbnailUrl ? (
                  <img
                    src={thumbnailPreview || thumbnailUrl}
                    className="h-full w-full object-cover"
                    alt="Stock thumbnail"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-400">
                    No photo yet
                  </div>
                )}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Supply reference: <span className="font-semibold">{inventory._id || id}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION MODAL */}
      {modalOpen && (
        <ActionModal
          mode={modalMode}
          busy={modalBusy}
          errorText={modalError}
          onClose={closeAction}
          onProceed={handleProceed}
          quantity={quantity}
          setQuantity={(v) => setQuantity(clampQty(v))}
          balanceQty={balanceQty}
        designation={designation}
        setDesignation={setDesignation}
        designationOptions={designationOptions}
        distributedTo={distributedTo}
          setDistributedTo={setDistributedTo}
          userOptions={userOptions}
          remarks={remarks}
          setRemarks={setRemarks}
          purpose={purpose}
          setPurpose={setPurpose}
          currentUser={user?.data}
        />
      )}

      {/* HISTORY MODAL */}
      {historyOpen && (
        <CenteredModal
          title="History"
          description="All changes to this supply, including distribution, disposal, and restock."
          subtitle="Supply Ledger"
          onClose={() => setHistoryOpen(false)}
        >
          {completedForms.length > 0 && (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Completed Forms
              </p>
              <div className="mt-2 grid gap-2">
                {completedForms.map((h, idx) => {
                  const displayDate = formatDateTime(h?.date || h?.to || h?.from);
                  return (
                    <div
                      key={h._id || `${h.doc_type || "DOC"}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-semibold text-emerald-800">
                          {h.doc_type || "Document"}
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          {displayDate || "—"}
                        </p>
                        {h?.signed_file?.filename && (
                          <p className="text-[10px] text-emerald-600">
                            {h.signed_file.filename}
                          </p>
                        )}
                      </div>
                      <a
                        href={resolveServerUrl(h.signed_file.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Open signed copy
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-2 max-h-[50vh] overflow-auto pr-1">
            {Array.isArray(historyWithDistributions) &&
            historyWithDistributions.length ? (
              historyWithDistributions.map((h, idx) => (
                <div
                  key={h._id || idx}
                  className="mb-3 last:mb-0 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <p className="font-semibold text-gray-800">{h.name || "—"}</p>
                  <p className="text-xs text-gray-600">
                    Date: {formatDateTime(h.date || h.to || h.from)}
                  </p>
                  <p className="text-xs text-gray-600">Status: {h.status || "—"}</p>
                  <p className="text-xs text-gray-600">
                    Remarks: {h.remarks || h.reason || "—"}
                  </p>
                  {"history_qty" in h && (
                    <p className="text-xs text-gray-600">
                      Qty: {h.history_qty}
                    </p>
                  )}
                  {"disposed_qty" in h && !("history_qty" in h) && (
                    <p className="text-xs text-gray-600">
                      Qty (disposed/restock log): {h.disposed_qty}
                    </p>
                  )}
                  {Number.isFinite(Number(h.unit_cost)) && (
                    <p className="text-xs text-gray-600">
                      Unit cost: {formatCurrency(h.unit_cost)}
                    </p>
                  )}
                  {h?.signed_file?.url && (
                    <a
                      href={resolveServerUrl(h.signed_file.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Open signed {h.doc_type || "document"}
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No history available.</p>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={handlePrintHistory}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Print History
            </button>
            <button
              onClick={() => setHistoryOpen(false)}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-black"
            >
              Close
            </button>
          </div>
        </CenteredModal>
      )}

      {/* STOCK CARD RANGE MODAL */}
      {canGenerateStockCard && stockCardModalOpen && (
        <CenteredModal
          title="Generate Stock Card"
          description="Choose the date range to generate the stock card."
          subtitle="Stock Card"
          variant="warning"
          onClose={() => setStockCardModalOpen(false)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="sc-from" className="block text-xs font-medium text-gray-700 mb-1">
                  From
                </label>
                <input
                  id="sc-from"
                  type="date"
                  value={stockCardFrom}
                  onChange={(e) => setStockCardFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label htmlFor="sc-to" className="block text-xs font-medium text-gray-700 mb-1">
                  To
                </label>
                <input
                  id="sc-to"
                  type="date"
                  value={stockCardTo}
                  onChange={(e) => setStockCardTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleGenerateStockCard}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
              >
                Generate Stock Card
              </button>
              <button
                type="button"
                onClick={() => setStockCardModalOpen(false)}
                className="inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-800 px-4 py-2.5 text-sm font-semibold hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </CenteredModal>
      )}

      {/* SUCCESS / ERROR */}
      {successOpen && (
        <CenteredModal
          title="Success"
          description={successMsg}
          subtitle="Supply Update"
          onClose={() => setSuccessOpen(false)}
        >
          <div className="mt-4">
            <button
              onClick={() => setSuccessOpen(false)}
              className="w-full inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-black"
            >
              Close
            </button>
          </div>
        </CenteredModal>
      )}

      {errorOpen && (
        <CenteredModal
          title="Error"
          description={errorMsg || "There was an error processing your request."}
          subtitle="Supply Update"
          variant="danger"
          onClose={() => setErrorOpen(false)}
        >
          <div className="mt-4">
            <button
              onClick={() => setErrorOpen(false)}
              className="w-full inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-black"
            >
              Close
            </button>
          </div>
        </CenteredModal>
      )}
    </div>
  );
}

/* -------------------- subcomponents -------------------- */

function Row({ label, value }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-sm font-semibold text-gray-900 text-right break-all">
          {value ?? "—"}
        </p>
      </div>
      <hr className="bg-gray-100 w-full my-2" />
    </>
  );
}

function CenteredModal({
  title,
  description,
  onClose,
  children,
  subtitle = "Supply Action",
  variant = "neutral",
  maxWidthClass = "max-w-md",
}) {
  return (
    <ModalShell
      open
      title={title}
      subtitle={subtitle}
      variant={variant}
      onClose={onClose}
      maxWidthClass={maxWidthClass}
    >
      {description ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          {description}
        </div>
      ) : null}
      <div className={description ? "mt-4" : ""}>{children}</div>
    </ModalShell>
  );
}

function ActionModal({
  mode,
  busy,
  errorText,
  onClose,
  onProceed,
  quantity,
  setQuantity,
  balanceQty,
  designation,
  setDesignation,
  designationOptions,
  distributedTo,
  setDistributedTo,
  userOptions,
  remarks,
  setRemarks,
  purpose,
  setPurpose,
  currentUser,
}) {
  const isDispose = mode === "dispose";
  const isRequest = mode === "request";
  const isBalanceHidden = balanceQty == null;
  const isNoBalance = !isBalanceHidden && Number(balanceQty || 0) <= 0;
  const qtyNum = Number(quantity);
  const isQtyInvalid =
    !Number.isFinite(qtyNum) ||
    qtyNum <= 0 ||
    (!isBalanceHidden && qtyNum > Number(balanceQty || 0));
  const disableProceed =
    busy || isNoBalance || isQtyInvalid || (!isDispose && !String(purpose || "").trim());

  const requester = useMemo(() => {
    if (isRequest && currentUser) {
      return `${currentUser.username || "You"}${
        currentUser.email ? ` (${currentUser.email})` : ""
      }`;
    }
    return "";
  }, [isRequest, currentUser]);

  const modeBtnClasses =
    mode === "distribute"
      ? "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-300"
      : mode === "dispose"
      ? "bg-red-600 hover:bg-red-700 focus:ring-red-300"
      : "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300";

  return (
    <CenteredModal
      title={`Confirm ${
        mode === "distribute" ? "Distribution" : isDispose ? "Disposal" : "Request"
      }`}
      description={
        isDispose
          ? "This will create a Supply Disposal Request for AFD approval."
          : mode === "distribute"
          ? "Distributing reserves the quantity for the selected employee and office."
          : "Requesting will create a pending request for approval."
      }
      subtitle="Supply Action"
      variant={isDispose ? "danger" : isRequest ? "warning" : "neutral"}
      onClose={onClose}
    >
      <div className="space-y-3">
        {!!errorText && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
            {errorText}
          </div>
        )}

        <div>
          <label htmlFor="qty" className="block text-xs font-medium text-gray-700 mb-1">
            Quantity{" "}
            <span className="text-gray-400">
              (max {isBalanceHidden ? "Hidden" : balanceQty})
            </span>
          </label>
          <p
            className={`mb-2 text-[11px] font-semibold ${
              isNoBalance ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            Available balance: {isBalanceHidden ? "Hidden" : balanceQty}
          </p>
          <input
            id="qty"
            type="number"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min={1}
            max={balanceQty ?? undefined}
            disabled={busy || isNoBalance}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Enter quantity"
          />
        </div>

        {!isDispose && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                maxLength={1000}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="State why these supplies are being requested or distributed…"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                This appears in the Purpose section of the printable RIS.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Designation (Office)
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">Select Office</option>
                {(designationOptions || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Distributed to (Employee)
              </label>
              {isRequest ? (
                <input
                  type="text"
                  value={requester}
                  disabled
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
                />
              ) : (
                <Select
                  classNamePrefix="react-select"
                  options={userOptions}
                  value={distributedTo}
                  onChange={setDistributedTo}
                  isClearable
                  isDisabled={busy}
                  placeholder="Search and select…"
                  getOptionLabel={(opt) =>
                    `${opt.label}${opt.email ? ` (${opt.email})` : ""}`
                  }
                  getOptionValue={(opt) => opt.value}
                />
              )}
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Remarks (optional)
          </label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder={
              isDispose
                ? "Reason for disposal…"
                : mode === "distribute"
                ? "Additional distribution notes…"
                : "Additional request notes…"
            }
          />
        </div>

        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onProceed}
            disabled={disableProceed}
            className={
              "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 " +
              (disableProceed ? "bg-gray-500 cursor-not-allowed" : modeBtnClasses)
            }
          >
            {busy ? "Processing…" : "Proceed"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-800 px-4 py-2.5 text-sm font-semibold hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </CenteredModal>
  );
}
