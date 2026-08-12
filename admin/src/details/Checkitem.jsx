// src/details/Checkitem.jsx
import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import DICT from "../assets/DICT.png";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BASE_URL, resolveServerUrl } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalShell from "../components/ModalShell";
import QRCode from "qrcode.react";
import Select from "react-select";
import { AuthContext } from "../context/AuthContext";
import html2canvas from "html2canvas";
import {
  findUserByRoles,
  sendWorkflowActionEmail,
} from "../utils/workflowNotifications";
import { isTransferHistoryEntry } from "../utils/historyTransaction";
import {
  includeCurrentOption,
  usePropertyEditOptions,
} from "../utils/propertyEditOptions";

/**
 * Checkitem
 * - View a single inventory item
 * - Issue / Transfer to a user / other agency / disposal (with email notifications for DICT user transfers)
 * - Download a “sticker” PNG (details + QR) with DICT logo + "Property of DICT Region 02" + if-lost notice
 *
 * Model fields used:
 *   issued_to      = boss / accountable officer (owner)
 *   current_holder = employee currently holding the item
 *   transfered_to  = pending new holder or target (DICT user or other agency) when status is "For Transfer"
 *
 * Extra helper fields (may or may not be in schema, harmless if ignored by backend):
 *   transfer_type      = "DICT User" | "Other Agency" (etc.)
 *   transfer_target    = free-text recipient (e.g. other agency / office)
 *   disposal_reason    = reason for disposal (text)
 *   disposal_notes     = extra notes for disposal
 */
export default function Checkitem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const employeeLookupReturn =
    location.state?.fromEmployeeAssetLookup &&
    String(location.state?.from || "").startsWith("/employee-asset-lookup")
      ? location.state.from
      : "";
  const backTarget = employeeLookupReturn || "/stocktableofficeequipments";
  const { user } = useContext(AuthContext);
  const isPublicView = !user;

  /* ---------- state ---------- */
  const [inventory, setInventory] = useState({});
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setLoading] = useState(true);

  /* dialogs */
  const [showIssue, setShowIssue] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferPreset, setTransferPreset] = useState("transfer");
  const [showReturnInventory, setShowReturnInventory] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isEditingCore, setIsEditingCore] = useState(false);
  const [coreForm, setCoreForm] = useState({
    property_no: "",
    unit_cost: "",
    classification: "",
    date_acquired: "",
    serial_no: "",
    specifications: "",
    stored_to: "",
    remarks: "",
  });
  const [coreSaving, setCoreSaving] = useState(false);
  const [coreError, setCoreError] = useState("");
  const loadEmailSetting = () => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem("systemSettings");
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      return parsed?.enable_email !== false;
    } catch {
      return true;
    }
  };
  const [systemSettings, setSystemSettings] = useState({
    enable_email: loadEmailSetting(),
    document_signatories: {},
  });

  /* current user helpers */
  const _id = user?.data?._id ?? "";
  const currentUserEmail = user?.data?.email ?? "";
  const currentUsername = user?.data?.username ?? "";
  const currentRole = (user?.data?._role || user?.data?.role || "").toLowerCase().trim();
  const canEditCoreDetails =
    !isPublicView && (currentRole === "super admin" || currentRole === "superadmin");
  const { classificationOptions, storedToOptions } = usePropertyEditOptions(
    ["Office Equipments"],
    canEditCoreDetails
  );
  const canDisposeRole =
    currentRole === "super admin" ||
    currentRole === "superadmin" ||
    currentRole === "inventory admin" ||
    currentRole === "inventoryadmin" ||
    currentRole === "afd";
  const canOverrideTransferHolder =
    currentRole === "super admin" ||
    currentRole === "superadmin" ||
    currentRole === "inventory admin" ||
    currentRole === "inventoryadmin";

  /* ---------- QR size (responsive) ---------- */
  const qrRef = useRef(null);
  const computeQrSize = () => {
    const w = window.innerWidth;
    if (w < 360) return 140;
    if (w < 480) return 180;
    if (w < 640) return 220;
    if (w < 768) return 260;
    if (w < 1024) return 340;
    return 420;
  };
  const [qrSize, setQrSize] = useState(computeQrSize);

  useEffect(() => {
    const onResize = () => setQrSize(computeQrSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---------- fetch data ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        const invUrl = isPublicView
          ? `${BASE_URL}/inventoryofficeequipment/public/${id}`
          : `${BASE_URL}/inventoryofficeequipment/inventory/${id}`;
        const invRes = await fetch(invUrl, {
          credentials: isPublicView ? "omit" : "include",
          silentStatuses: isPublicView ? [401, 403] : [],
          suppressErrorToast: isPublicView,
        });
        const usersRes = isPublicView
          ? null
          : await fetch(`${BASE_URL}/users/directory`, {
              credentials: "include",
              silentStatuses: [403],
              suppressErrorToast: true,
            });

        if (!invRes.ok) throw new Error("Failed to fetch item");
        if (usersRes && !usersRes.ok) setUsers([]);

        const invData = await invRes.json();
        const usersData = usersRes && usersRes.ok ? await usersRes.json() : [];

        if (!cancelled) {
          setInventory(invData || {});
          setUsers(Array.isArray(usersData) ? usersData : []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isPublicView]);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`);
        if (!res.ok) return null;
        const data = await res.json();
        return data && typeof data === "object" ? data : null;
      } catch {
        return null;
      }
    };
    loadSettings().then((data) => {
      if (cancelled || !data) return;
      setSystemSettings((prev) => ({
        ...prev,
        enable_email: data.enable_email ?? prev.enable_email,
        document_signatories:
          data.document_signatories ?? prev.document_signatories,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      const next = event?.detail?.enable_email;
      if (typeof next === "boolean") {
        setSystemSettings((prev) => ({ ...prev, enable_email: next }));
      }
    };
    window.addEventListener("settings:email", handler);
    return () => window.removeEventListener("settings:email", handler);
  }, []);

  const toDateInput = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!inventory || isEditingCore) return;
    setCoreForm({
      property_no: inventory.property_no ?? "",
      unit_cost: inventory.unit_cost ?? "",
      classification: inventory.classification ?? "",
      date_acquired: toDateInput(inventory.date_acquired),
      serial_no: inventory.serial_no ?? "",
      specifications: inventory.specifications ?? "",
      stored_to: inventory.stored_to ?? "",
      remarks: inventory.remarks ?? "",
    });
  }, [inventory, isEditingCore]);

  /* ---------- helpers ---------- */
  const ENTITY_NAME = "DICT REGIONAL OFFICE 02";

  const publicLink =
    inventory?.public_qr_token && typeof window !== "undefined"
      ? `${window.location.origin}/#/public/item/${inventory.public_qr_token}`
      : "";

  const currentLink =
    publicLink ||
    (typeof window !== "undefined" && window.location ? window.location.href : "");
  const shareLink = publicLink || currentLink;

  const findUserById = (uid) => users.find((u) => u._id === uid);

  const issuedToUsername = inventory?.issued_to
    ? findUserById(inventory.issued_to)?.username || inventory.issued_to
    : "";

  const transferToUsername = inventory?.transfered_to
    ? findUserById(inventory.transfered_to)?.username || inventory.transfered_to
    : "";

  const currentHolderUsername = inventory?.current_holder
    ? findUserById(inventory.current_holder)?.username || inventory.current_holder
    : "";

  const matchesLoggedInUser = (...values) =>
    values.some((value) => {
      const normalized = String(value || "").trim();
      return (
        !!normalized &&
        (normalized === _id ||
          normalized === currentUsername ||
          normalized === currentUserEmail)
      );
    });

  const getUserByRole = (roleName) => {
    const target = String(roleName || "").toLowerCase();
    return users.find((u) => String(u?.role || "").toLowerCase() === target);
  };

  const resolvePendingApprover = () => {
    const rsRaw = String(inventory?.requeststatus || "").trim();
    const stRaw = String(inventory?.status || "").trim();
    const rs = rsRaw.toLowerCase();
    const st = stRaw.toLowerCase();

    if (rs === "for approval") {
      if (st.includes("disposal")) {
        const afd = getUserByRole("afd") || getUserByRole("afd special access");
        return afd?.username || afd?.email || "AFD";
      }
      const rd = getUserByRole("regional director");
      return rd?.username || rd?.email || "Regional Director";
    }
    if (rs === "for release" || rs === "for checking") {
      const invAdmin = getUserByRole("inventory admin");
      return invAdmin?.username || invAdmin?.email || "Inventory Admin";
    }
    if (rs === "to receive") {
      if (st.includes("return to inventory")) {
        const invAdmin = getUserByRole("inventory admin");
        return invAdmin?.username || invAdmin?.email || "Inventory Admin";
      }
      return transferToUsername || currentHolderUsername || issuedToUsername || "Recipient";
    }
    if (st.startsWith("for ")) {
      const invAdmin = getUserByRole("inventory admin");
      return invAdmin?.username || invAdmin?.email || "Inventory Admin";
    }
    return "";
  };

  const handleCoreChange = (field) => (e) => {
    setCoreForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCoreSave = async () => {
    if (!canEditCoreDetails) return;
    setCoreSaving(true);
    setCoreError("");
    try {
      const payload = {
        property_no: coreForm.property_no === "" ? null : coreForm.property_no,
        unit_cost: coreForm.unit_cost === "" ? null : Number(coreForm.unit_cost),
        classification: coreForm.classification || "",
        date_acquired: coreForm.date_acquired || null,
        serial_no: coreForm.serial_no || "",
        specifications: coreForm.specifications || "",
        stored_to: coreForm.stored_to || "",
        remarks: coreForm.remarks || "",
        __v: inventory.__v,
      };

      const res = await fetch(
        `${BASE_URL}/inventoryofficeequipment/inventory/${id}`,
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
      setInventory(data);
      setIsEditingCore(false);
    } catch (err) {
      setCoreError(err?.message || "Failed to update item details.");
    } finally {
      setCoreSaving(false);
    }
  };

  const statusNorm = useMemo(
    () => String(inventory?.status ?? "").trim().toLowerCase(),
    [inventory?.status]
  );

  // Treat all "terminal" / not-actionable statuses as locked (no transfer/issue/disposal)
  const isTerminalStatus = useMemo(() => {
    // include common variants seen in systems
    const terminal = new Set([
      "disposed",
      "disposed item",
      "disposal",
      "for disposal", // pending disposal -> no transfer/issue button (can still show history)
      "disposed/condemned",
      "condemned",
      "condemn",
      "lost",
      "missing",
      "stolen",
      "written off",
      "write-off",
      "write off",
      "decommissioned",
      "retired",
    ]);
    return terminal.has(statusNorm);
  }, [statusNorm]);

  const isPendingActionStatus = useMemo(() => {
    // These are non-terminal but should block further action buttons to avoid double-requests
    const pending = new Set([
      "for transfer",
      "for disposal",
      "for issue",
      "for return to inventory",
    ]);
    return pending.has(statusNorm);
  }, [statusNorm]);

  // CURRENT HOLDER:
  // - Primary (new model): current_holder === logged-in user (id/username/email)
  // - Fallback (old model): use issued_to / transfered_to logic
  const hasExplicitCurrentHolder = Boolean(
    inventory?.current_holder || inventory?.current_holder_id
  );
  const hasTransferredRecipient = Boolean(
    inventory?.transfered_to ||
      inventory?.transfered_to_id ||
      inventory?.transferred_to_id
  );
  const isCurrentHolder =
    (statusNorm === "transferred" && hasTransferredRecipient
      ? matchesLoggedInUser(
          inventory?.transfered_to,
          inventory?.transfered_to_id,
          inventory?.transferred_to_id
        )
      : matchesLoggedInUser(inventory?.current_holder, inventory?.current_holder_id) ||
        (!hasExplicitCurrentHolder &&
          matchesLoggedInUser(inventory?.issued_to, inventory?.issued_to_id)));

  const userOptions = users.map((u) => ({
    value: u._id,
    label: u.username || u.email || "User",
    email: u.email,
  }));

  function formatDate(dateString) {
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
    return `${monthNames[d.getMonth()]} ${d.getDate()} - ${d.getFullYear()}`;
  }

  const formatDateTime = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const safeText = (v, fallback = "—") =>
    v !== null && v !== undefined && String(v).trim() !== "" ? String(v) : fallback;

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /* ---------- sticker download (NO buttons visible) ---------- */
  const handleDownload = async () => {
    const wrapper = document.getElementById("download-wrapper");
    if (!wrapper) return;

    // hide any element explicitly marked for export-hide (all buttons, links, etc.)
    const hideEls = Array.from(wrapper.querySelectorAll('[data-export-hide="true"]'));
    const prevDisplay = hideEls.map((el) => el.style.display);

    hideEls.forEach((el) => {
      el.style.display = "none";
    });

    try {
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "inventory-sticker.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      hideEls.forEach((el, i) => {
        el.style.display = prevDisplay[i] || "";
      });
    }
  };

  /* ---------- PRINT: HISTORY (PDF via browser print) ---------- */
  const getHistorySorted = useMemo(() => {
    const hist = Array.isArray(inventory?.history) ? [...inventory.history] : [];
    const rsRaw = String(inventory?.requeststatus || "").trim();
    const stRaw = String(inventory?.status || "").trim();
    const rs = rsRaw.toLowerCase();
    const st = stRaw.toLowerCase();
    const finals = new Set([
      "received",
      "declined",
      "transferred",
      "disposed",
      "issued",
      "instock",
      "in stock",
    ]);
    const pendingLabel =
      (rs && !finals.has(rs) && rsRaw) ||
      (st.startsWith("for ") ? stRaw : "");
    const hasPending = hist.some((h) =>
      String(h?.reason || "").toLowerCase().includes("pending:")
    );

    if (pendingLabel && !hasPending) {
      const nowIso = new Date().toISOString();
      const approverName =
        resolvePendingApprover() ||
        currentHolderUsername ||
        issuedToUsername ||
        "System";
      hist.push({
        name: approverName,
        from:
          inventory?.date_requested ||
          inventory?.date_issued ||
          inventory?.createdAt ||
          nowIso,
        to: inventory?.updatedAt || nowIso,
        reason: `Pending: ${pendingLabel}`,
        remarks: inventory?.remarks || "",
      });
    }

    const asDate = (h) => {
      const raw = h?.to || h?.date || h?.createdAt || h?.from;
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
      return new Date(0);
    };
    // oldest -> newest (timeline)
    return [...hist].sort((a, b) => asDate(a).getTime() - asDate(b).getTime());
  }, [
    inventory?.history,
    inventory?.requeststatus,
    inventory?.status,
    inventory?.date_requested,
    inventory?.date_issued,
    inventory?.createdAt,
    inventory?.updatedAt,
    inventory?.remarks,
    currentHolderUsername,
    issuedToUsername,
  ]);

  const transactionEntries = useMemo(() => {
    const history = Array.isArray(inventory?.history) ? [...inventory.history] : [];
    const entries = history.filter((h) => h?.doc_type && h?.doc_snapshot);

    if (!entries.length) {
      if (statusNorm === "issued") {
        return [{
          doc_type:
            String(inventory?.asset_type || "").toUpperCase() === "PPE" ? "PAR" : "ICS",
          doc_snapshot: inventory,
        }];
      }
      if (statusNorm === "transferred") {
        return [{
          doc_type:
            String(inventory?.asset_type || "").toUpperCase() === "SE" ? "ICS" : "PTR",
          doc_snapshot: inventory,
        }];
      }
      return [];
    }

    const getTime = (h) => {
      const raw =
        h?.to ||
        h?.doc_snapshot?.date_received ||
        h?.doc_snapshot?.date_released ||
        h?.doc_snapshot?.date_approved ||
        h?.from;
      const d = new Date(raw || 0);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const grouped = new Map();
    entries.forEach((entry) => {
      const docType = String(entry?.doc_type || "").toUpperCase();
      const snap = entry?.doc_snapshot || {};
      const txnStamp =
        snap?.date_requested ||
        snap?.date_issued ||
        entry?.from ||
        entry?.to ||
        "";
      const key = `${docType}::${txnStamp}`;
      const prev = grouped.get(key);
      if (!prev || getTime(entry) > getTime(prev)) {
        grouped.set(key, { ...entry, doc_type: docType });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => getTime(a) - getTime(b));
  }, [inventory?.history, inventory, statusNorm]);

  const completedForms = useMemo(() => {
    if (!Array.isArray(transactionEntries)) return [];
    return transactionEntries.filter((entry) => {
      const snap = entry?.doc_snapshot || {};
      const signedEntryFile = entry?.signed_file || snap?.signed_file;
      if (!signedEntryFile?.url) return false;
      const statusLower = String(snap?.status || "").toLowerCase();
      const reqLower = String(snap?.requeststatus || "").toLowerCase();
      const docType = String(entry?.doc_type || "").toUpperCase();
      const isRti = docType === "RTI";
      return (
        reqLower === "received" ||
        statusLower === "issued" ||
        statusLower === "transferred" ||
        statusLower === "disposed" ||
        (isRti && statusLower === "in stock")
      );
    });
  }, [transactionEntries]);

  const buildHistoryPrintHtml = () => {
    const generatedOn = new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const headerTitle = "ITEM HISTORY REPORT";
    const itemName = safeText(inventory?.itemName, "Unnamed item");
    const classification = safeText(inventory?.classification, "—");
    const propertyNo = safeText(inventory?.property_no, "—");
    const serialNo = safeText(inventory?.serial_no, "—");
    const specifications = safeText(inventory?.specifications, "—");
    const status = safeText(inventory?.status, "—");
    const unitCost = inventory?.unit_cost
      ? Number(inventory.unit_cost).toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
        })
      : "—";
    const qty = safeText(inventory?.qty, "—");
    const storedTo = safeText(inventory?.stored_to, "—");
    const dateAcquired = safeText(formatDate(inventory?.date_acquired), "—");
    const dateIssued = safeText(formatDate(inventory?.date_issued), "—");

    const owner = safeText(issuedToUsername || "", "—");
    const holder = safeText(currentHolderUsername || issuedToUsername || "", "—");
    const pendingTo =
      statusNorm === "for transfer"
        ? safeText(transferToUsername || "", "—")
        : safeText(transferToUsername || "", "—");

    const rows = [
      ["Item Name", itemName],
      ["Classification", classification],
      ["Property No.", propertyNo],
      ["Serial No.", serialNo],
      ["Specifications", specifications],
      ["Quantity", qty],
      ["Unit Cost", unitCost],
      ["Stored To", storedTo],
      ["Status", status],
      ["Date Acquired", dateAcquired],
      ["Date Issued", dateIssued],
      ["Issued to (Owner)", owner],
      ["Current Holder", holder],
      ["Transfered / Pending To", pendingTo],
    ];

    const tr = (k, v, alt = false) => `
      <tr>
        <td class="k ${alt ? "alt" : ""}">${escapeHtml(k)}</td>
        <td class="v">${escapeHtml(v ?? "—")}</td>
      </tr>
    `;

    const detailsTable = `
      <table class="meta">
        <tbody>
          ${rows.map(([k, v], idx) => tr(k, v, idx % 2 === 1)).join("")}
        </tbody>
      </table>
    `;

    const timelineItems = (getHistorySorted || []).map((h, idx) => {
      const when =
        formatDateTime(h?.to || h?.date || h?.createdAt || h?.from) || "—";
      const actor = safeText(h?.name, "—");
      const from = safeText(formatDateTime(h?.from), "—");
      const to = safeText(formatDateTime(h?.to), "—");
      const remarks = safeText(h?.remarks, "");
      const reason = safeText(h?.reason, "");
      const combined = safeText(
        (reason || remarks) ? (reason && remarks ? `${reason}\n${remarks}` : (reason || remarks)) : "—",
        "—"
      );

      return `
        <div class="event">
          <div class="dot-wrap">
            <div class="dot"></div>
            ${idx < getHistorySorted.length - 1 ? `<div class="line"></div>` : ""}
          </div>
          <div class="card">
            <div class="top">
              <div class="when">${escapeHtml(when)}</div>
              <div class="badge">#${idx + 1}</div>
            </div>
            <div class="actor">${escapeHtml(actor)}</div>
            <div class="grid">
              <div class="cell">
                <div class="label">From</div>
                <div class="val">${escapeHtml(from)}</div>
              </div>
              <div class="cell">
                <div class="label">To</div>
                <div class="val">${escapeHtml(to)}</div>
              </div>
              <div class="cell full">
                <div class="label">Reason / Remarks</div>
                <div class="val pre">${escapeHtml(combined)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    const timelineHtml =
      timelineItems.length > 0
        ? `<div class="timeline">${timelineItems.join("")}</div>`
        : `<div class="empty">No history available.</div>`;

    // DICT asset will usually resolve to a proper URL; OK for same-origin printing.
    const logoSrc = DICT;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(headerTitle)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff;
      font-size: 11px; line-height: 1.45;
      padding: 14mm;
    }
    @page { size: A4; margin: 12mm; }

    .wrap { max-width: 860px; margin: 0 auto; }
    .topbar {
      display:flex; align-items:center; justify-content:space-between;
      border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;
    }
    .brand { display:flex; align-items:center; gap:10px; }
    .logo {
      width: 44px; height: 44px; border: 1px solid #e2e8f0; border-radius: 10px;
      display:flex; align-items:center; justify-content:center; background: #fff;
      overflow:hidden;
    }
    .logo img { width: 34px; height: 34px; object-fit: contain; }
    .titleBlock { line-height: 1.2; }
    .kicker { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .title { font-size: 16px; font-weight: 900; letter-spacing: .08em; margin-top: 4px; }
    .sub { font-size: 10px; color: #475569; margin-top: 4px; font-style: italic; }
    .rightmeta { text-align:right; color:#475569; font-size: 10px; }
    .chip {
      display:inline-flex; align-items:center; gap:6px;
      background: #eef2ff; color: #3730a3; border: 1px solid #e0e7ff;
      padding: 6px 10px; border-radius: 999px; font-weight: 800; font-size: 9px;
      letter-spacing: .12em; text-transform: uppercase;
    }
    .chip .dot { width:7px; height:7px; border-radius: 999px; background: #4f46e5; }
    .grid2 {
      display:grid; grid-template-columns: 1fr; gap: 12px; margin-top: 10px;
    }
    @media (min-width: 780px) {
      .grid2 { grid-template-columns: 1fr 1.2fr; }
    }

    .panel {
      border: 1px solid #e2e8f0; border-radius: 12px; overflow:hidden; background:#fff;
      box-shadow: 0 10px 30px rgba(2,6,23,.06);
    }
    .panelHead {
      padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
      font-weight: 900; letter-spacing: .08em; text-transform: uppercase; font-size: 10px;
      color:#0f172a;
    }
    table.meta { width:100%; border-collapse: collapse; }
    table.meta td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
    td.k { width: 40%; background:#f8fafc; font-weight: 800; color:#0f172a; }
    td.k.alt { background:#f1f5f9; }
    td.v { color:#0f172a; font-weight: 600; }

    .timeline { padding: 12px; }
    .event { display:grid; grid-template-columns: 18px 1fr; gap: 10px; margin-bottom: 12px; }
    .dot-wrap { position: relative; display:flex; flex-direction:column; align-items:center; }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #1d4ed8; margin-top: 8px; }
    .line { flex: 1; width: 2px; background: #e2e8f0; margin-top: 6px; }

    .card {
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; background:#ffffff;
    }
    .top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .when { font-size: 10px; color:#475569; font-weight: 700; }
    .badge {
      font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
      background:#0f172a; color:#fff; padding: 4px 8px; border-radius: 999px;
    }
    .actor { margin-top: 6px; font-size: 12px; font-weight: 900; color:#0f172a; }

    .grid { margin-top: 8px; display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .cell { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; background:#f8fafc; }
    .cell.full { grid-column: 1 / -1; background:#fff; }
    .label { font-size: 9px; color:#64748b; letter-spacing: .12em; text-transform: uppercase; font-weight: 800; }
    .val { margin-top: 4px; font-size: 10.5px; color:#0f172a; font-weight: 700; }
    .val.pre { white-space: pre-wrap; font-weight: 600; }

    .empty { padding: 16px; color:#64748b; font-style: italic; }

    .foot {
      margin-top: 12px; padding-top: 10px;
      border-top: 1px solid #e2e8f0; color:#64748b; font-size: 9px; font-style: italic;
      display:flex; align-items:flex-start; justify-content:space-between; gap: 10px;
    }
    .foot b { color:#0f172a; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="brand">
        <div class="logo">
          <img src="${escapeHtml(logoSrc)}" alt="DICT" />
        </div>
        <div class="titleBlock">
          <div class="kicker">REPUBLIC OF THE PHILIPPINES</div>
          <div class="title">${escapeHtml(headerTitle)}</div>
          <div class="sub">${escapeHtml(ENTITY_NAME)} • System-generated • For printing / PDF</div>
        </div>
      </div>
      <div class="rightmeta">
        <div class="chip"><span class="dot"></span><span>HISTORY</span></div>
        <div style="margin-top:6px;"><b>Generated on:</b> ${escapeHtml(generatedOn)}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="panel">
        <div class="panelHead">Item Summary</div>
        <div style="padding: 0;">
          ${detailsTable}
        </div>
      </div>

      <div class="panel">
        <div class="panelHead">Timeline</div>
        ${timelineHtml}
      </div>
    </div>

    <div class="foot">
      <div>
        <b>Note:</b> Use your browser’s print dialog and choose <b>Save as PDF</b>.
        This report reflects the item’s stored history entries at time of generation.
      </div>
      <div style="text-align:right;">
        <div><b>Ref:</b> ${escapeHtml(propertyNo)}</div>
        <div><b>Item:</b> ${escapeHtml(itemName)}</div>
      </div>
    </div>
  </div>

  <script>
    window.focus();
    // give images/fonts a moment
    setTimeout(() => { window.print(); }, 250);
  </script>
</body>
</html>`;
  };

  const formatCurrencyPHP = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  };

  const buildHistoryDocHtml = (entry) => {
    const snap = entry?.doc_snapshot || {};
    const docType = String(entry?.doc_type || "PTR").toUpperCase();
    const isIcs = docType === "ICS";
    const isPar = docType === "PAR";
    const isTransfer = isTransferHistoryEntry(entry);
    const isIssuance = (isIcs || isPar) && !isTransfer;
    const isRti = docType === "RTI";
    const title = isTransfer
      ? isIcs
        ? "INVENTORY CUSTODIAN SLIP - TRANSFER"
        : "PROPERTY TRANSFER REQUEST"
      : isIssuance
      ? isPar
        ? "PROPERTY ACKNOWLEDGEMENT RECEIPT"
        : "INVENTORY CUSTODIAN SLIP"
      : isRti
      ? "RETURN TO INVENTORY"
      : "PROPERTY TRANSFER REQUEST";
    const itemName = safeText(snap?.itemName, "—");
    const classification = safeText(snap?.classification, "—");
    const propertyNo = safeText(snap?.property_no, "—");
    const serialNo = safeText(snap?.serial_no, "—");
    const specifications = safeText(snap?.specifications, "—");
    const docNo = safeText(
      isPar ? snap?.par_no : isIcs ? snap?.ics_no : isRti ? "" : snap?.ptr_no,
      "—"
    );
    const batchNo = safeText(snap?.batch_no, "—");
    const qty = safeText(snap?.qty, "—");
    const unit = safeText(snap?.unitofmeasure, "—");
    const unitCost = formatCurrencyPHP(snap?.unit_cost);
    const totalCost = formatCurrencyPHP(snap?.total_cost);
    const project = safeText(snap?.project, "—");
    const dateAcquired = safeText(formatDate(snap?.date_acquired), "—");
    const dateRequested = safeText(formatDate(snap?.date_requested), "—");
    const dateApproved = safeText(formatDate(snap?.date_approved), "—");
    const dateReleased = safeText(formatDate(snap?.date_released), "—");
    const dateReceived = safeText(formatDate(snap?.date_received), "—");
    const issuedTo = safeText(
      findUserById(snap?.issued_to)?.username || snap?.issued_to,
      "—"
    );
    const transferTo = safeText(
      findUserById(snap?.transfered_to)?.username || snap?.transfered_to,
      "—"
    );
    const status = safeText(snap?.status, "—");
    const docDate = safeText(
      formatDateTime(entry?.to || entry?.date || entry?.createdAt || entry?.from),
      "—"
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; background: #ffffff;
      font-size: 11px; line-height: 1.45;
      padding: 12mm;
    }
    @page { size: A4; margin: 12mm; }
    .header { text-align:center; margin-bottom: 10px; }
    .header h1 { font-size: 14px; letter-spacing: .2em; margin: 6px 0 2px; }
    .header p { margin: 0; font-size: 10px; color: #475569; }
    .meta { margin-top: 8px; display:flex; justify-content: space-between; font-size: 10px; color:#475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px; font-size: 10px; }
    th { background: #f8fafc; text-transform: uppercase; letter-spacing: .08em; font-size: 9px; }
    .label { color:#64748b; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: .08em; }
    .value { font-weight: 700; color:#0f172a; }
  </style>
</head>
<body>
  <div class="header">
    <p>REPUBLIC OF THE PHILIPPINES</p>
    <p>DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</p>
    <p>DICT REGIONAL OFFICE 02</p>
    <h1>${escapeHtml(title)}</h1>
  </div>
  <div class="meta">
    <span><span class="label">Document:</span> <span class="value">${escapeHtml(docType)}</span></span>
    <span><span class="label">Recorded:</span> <span class="value">${escapeHtml(docDate)}</span></span>
  </div>
  <table>
    <tbody>
      <tr><td class="label">Item</td><td class="value">${escapeHtml(itemName)}</td></tr>
      <tr><td class="label">${escapeHtml(
        isIssuance || isTransfer ? `${docType} No.` : isRti ? "RTI No." : "PTR No."
      )}</td><td class="value">${escapeHtml(docNo)}</td></tr>
      <tr><td class="label">Classification</td><td class="value">${escapeHtml(classification)}</td></tr>
      <tr><td class="label">Property No.</td><td class="value">${escapeHtml(propertyNo)}</td></tr>
      <tr><td class="label">Serial No.</td><td class="value">${escapeHtml(serialNo)}</td></tr>
      <tr><td class="label">Specifications</td><td class="value">${escapeHtml(specifications)}</td></tr>
      <tr><td class="label">Batch No.</td><td class="value">${escapeHtml(batchNo)}</td></tr>
      <tr><td class="label">Quantity</td><td class="value">${escapeHtml(qty)} ${escapeHtml(unit)}</td></tr>
      <tr><td class="label">Unit Cost</td><td class="value">${escapeHtml(unitCost)}</td></tr>
      <tr><td class="label">Total Cost</td><td class="value">${escapeHtml(totalCost)}</td></tr>
      <tr><td class="label">Project</td><td class="value">${escapeHtml(project)}</td></tr>
      <tr><td class="label">Date Acquired</td><td class="value">${escapeHtml(dateAcquired)}</td></tr>
      <tr><td class="label">Date Requested</td><td class="value">${escapeHtml(dateRequested)}</td></tr>
      <tr><td class="label">Date Approved</td><td class="value">${escapeHtml(dateApproved)}</td></tr>
      <tr><td class="label">Date Released</td><td class="value">${escapeHtml(dateReleased)}</td></tr>
      <tr><td class="label">Date Received</td><td class="value">${escapeHtml(dateReceived)}</td></tr>
      <tr><td class="label">Issued To</td><td class="value">${escapeHtml(issuedTo)}</td></tr>
      <tr><td class="label">Transfer To</td><td class="value">${escapeHtml(transferTo)}</td></tr>
      <tr><td class="label">Status</td><td class="value">${escapeHtml(status)}</td></tr>
    </tbody>
  </table>
  <script>
    window.focus();
    setTimeout(() => { window.print(); window.close(); }, 50);
  </script>
</body>
</html>`;
  };

  const handlePrintHistoryDoc = (entry) => {
    try {
      const html = buildHistoryDocHtml(entry);
      const pri = window.open("", "", "width=1000,height=800");
      if (!pri) return;
      pri.document.open();
      pri.document.write(html);
      pri.document.close();
      pri.focus();
    } catch (e) {
      console.error("Print history document failed:", e);
      alert("Failed to print the document. Please try again.");
    }
  };

  const handlePrintHistory = () => {
    try {
      const pri = window.open("", "", "width=1100,height=800");
      if (!pri) return;

      const html = buildHistoryPrintHtml();
      pri.document.open();
      pri.document.write(html);
      pri.document.close();
      pri.focus();
    } catch (e) {
      console.error("Print history failed:", e);
      alert("Failed to open print preview. Please allow popups and try again.");
    }
  };

  const renderHistorySnapshot = (entry) => {
    if (!entry?.doc_snapshot) {
      return (
        <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
          Snapshot data not recorded for this entry.
        </div>
      );
    }

    const snap = entry.doc_snapshot;
    const issuedToLabel = snap?.issued_to
      ? findUserById(snap.issued_to)?.username || snap.issued_to
      : "—";
    const holderLabel = snap?.current_holder
      ? findUserById(snap.current_holder)?.username || snap.current_holder
      : "—";
    const transferLabel = snap?.transfered_to
      ? findUserById(snap.transfered_to)?.username || snap.transfered_to
      : "—";

    const fields = [
      { label: "ICS No.", value: snap?.ics_no || "—" },
      { label: "PAR No.", value: snap?.par_no || "—" },
      { label: "PTR No.", value: snap?.ptr_no || "—" },
      { label: "Status", value: snap?.status || "—" },
      { label: "Request Status", value: snap?.requeststatus || "—" },
      { label: "Issued To", value: issuedToLabel },
      { label: "Current Holder", value: holderLabel },
      { label: "Transfer To", value: transferLabel },
      { label: "Project", value: snap?.project || "—" },
      { label: "Batch No.", value: snap?.batch_no || "—" },
      { label: "Property No.", value: snap?.property_no || "—" },
      { label: "Serial No.", value: snap?.serial_no || "—" },
      { label: "Specifications", value: snap?.specifications || "—" },
      {
        label: "Quantity",
        value: `${snap?.qty ?? "—"} ${snap?.unitofmeasure || ""}`.trim(),
      },
    ];

    return (
      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {fields.map((f) => (
          <div key={f.label} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wide">
              {f.label}
            </p>
            <p className="mt-1 text-sm text-gray-800">{f.value || "—"}</p>
          </div>
        ))}
      </div>
    );
  };

  /* ---------- actions: ISSUE ---------- */
  const handleIssueConfirm = async (selectedUser) => {
    if (!selectedUser) {
      alert("Please select a name.");
      return;
    }

    try {
      const currentDate = new Date().toISOString();

      const updatedData = {
        issued_to: selectedUser.value,
        current_holder: "",
        date_issued: "",
        date_requested: currentDate,
        status: "For Issue",
        requeststatus: "For Approval",
        transfered_to: "",
        transfer_type: "",
        transfer_target: "",
        __v: inventory?.__v,
      };

      const res = await fetch(`${BASE_URL}/inventoryofficeequipment/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) throw new Error("Failed to update data");
      const updated = await res.json();

      if (systemSettings.enable_email) {
        try {
          const issuanceDocType =
            String(updated?.asset_type || inventory?.asset_type || "").toUpperCase() ===
            "PPE"
              ? "PAR"
              : "ICS";
          const configuredIssuanceApproverId =
            issuanceDocType === "ICS"
              ? systemSettings?.document_signatories?.ics_issuance?.approver_id
              : "";
          await sendWorkflowActionEmail({
            recipient:
              users.find((person) => person?._id === configuredIssuanceApproverId) ||
              findUserByRoles(users, ["Inventory Admin"]),
            requestor: selectedUser,
            requestType:
              issuanceDocType === "PAR"
                ? "Property Acknowledgement Receipt (PAR)"
                : "Inventory Custodian Slip (ICS)",
            reference: inventory.property_no
              ? `Property No. ${inventory.property_no}`
              : `Request ${id}`,
            itemSummary: inventory.itemName,
            status: "For Approval",
            actionLabel: "review and approval",
            instructions:
              `Open the request, verify the property and intended recipient, review the signed ${issuanceDocType}, then approve or decline it.`,
            message: "A new property issue request has been submitted.",
            requestId: updated?._id || id,
            senderName: currentUsername,
          });
        } catch (mailErr) {
          console.error("Failed to notify Inventory Admin:", mailErr);
        }
      }

      setInventory(updated || inventory);
      setShowIssue(false);
      setShowSuccess(true);
    } catch (err) {
      console.error("Issue failed:", err);
      alert(err.message || "Failed to issue item.");
    }
  };

  /* ---------- actions: TRANSFER / OTHER AGENCY / DISPOSAL ---------- */
  const handleTransferConfirm = async (formData) => {
    const { transferKind, selectedUser, customTarget, reason } = formData || {};
    if (!transferKind) {
      alert("Please choose a transfer/disposal option.");
      return;
    }
    if (transferKind === "disposal" && !canDisposeRole) {
      alert("Only Super Admin or Inventory Admin can dispose items.");
      return;
    }

    const currentDate = new Date().toISOString();
    let updatedData = null;

    if (transferKind === "user") {
      if (!selectedUser) {
        alert("Please select a DICT employee.");
        return;
      }

      updatedData = {
        status: "For Transfer",
        requeststatus: "For Approval",
        transfered_to: selectedUser.value,
        transfered_to_id: selectedUser.value,
        transferred_to_id: selectedUser.value,
        transfer_type: "DICT User",
        transfer_target: "",
        reason: reason || "",
        date_requested: currentDate,
        __v: inventory?.__v,
      };
    } else if (transferKind === "otherAgency") {
      if (!customTarget || !customTarget.trim()) {
        alert("Please enter the receiving agency/office.");
        return;
      }

      updatedData = {
        status: "For Transfer",
        requeststatus: "For Approval",
        transfered_to: customTarget.trim(),
        transfered_to_id: null,
        transferred_to_id: null,
        transfer_type: "Other Agency",
        transfer_target: customTarget.trim(),
        reason: reason || "",
        date_requested: currentDate,
        __v: inventory?.__v,
      };
    } else if (transferKind === "disposal") {
      updatedData = {
        status: "For Disposal",
        requeststatus: "For Approval",
        disposal_reason: reason || "",
        disposal_notes: (customTarget || "").trim(),
        date_requested: currentDate,
        __v: inventory?.__v,
      };
    } else {
      alert("Unknown action.");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/inventoryofficeequipment/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) throw new Error("Failed to update data");
      const updated = await res.json();

      if (systemSettings.enable_email) {
        try {
          const isDisposalRequest = transferKind === "disposal";
          const isSeTransferRequest =
            !isDisposalRequest &&
            String(inventory?.asset_type || "").trim().toUpperCase() === "SE";
          const configuredTransferApproverId = isSeTransferRequest
            ? systemSettings?.document_signatories?.ics_transfer?.approver_id
            : systemSettings?.document_signatories?.ptr?.approver_id;
          await sendWorkflowActionEmail({
            recipient:
              users.find((person) => person?._id === configuredTransferApproverId) ||
              findUserByRoles(users, [
                isSeTransferRequest ? "Inventory Admin" : "Regional Director",
              ]),
            requestor: { email: currentUserEmail, username: currentUsername },
            requestType: isDisposalRequest
              ? "Property Disposal Request"
              : isSeTransferRequest
              ? "Inventory Custodian Slip (ICS) Transfer"
              : "Property Transfer Request (PTR)",
            reference: inventory.property_no
              ? `Property No. ${inventory.property_no}`
              : `Request ${id}`,
            itemSummary: inventory.itemName,
            status: "For Approval",
            actionLabel: "review and approval",
            instructions: isDisposalRequest
              ? "Open the request, review the disposal reason and signed PDR, then approve or decline it. An approval forwards it to AFD."
              : isSeTransferRequest
              ? "Open the request, verify the SE transfer details and signed ICS, then approve or decline it."
              : "Open the request, verify the transfer details and signed PTR, then approve or decline it.",
            message: isDisposalRequest
              ? "A new property disposal request has been submitted."
              : "A new property transfer request has been submitted.",
            requestId: updated?._id || id,
            senderName: currentUsername,
          });
        } catch (mailErr) {
          console.error("Failed to notify transfer approver:", mailErr);
        }
      }

      setInventory(updated || inventory);
      setShowTransfer(false);
      setShowSuccess(true);
    } catch (e) {
      console.error("Transfer/Disposal update error:", e);
      alert(e.message || "Failed to submit request. Please try again.");
    }
  };

  const handleReturnToInventoryConfirm = async (reasonText) => {
    try {
      const currentDate = new Date().toISOString();
      const updatedData = {
        status: "For Return to Inventory",
        requeststatus: "For Approval",
        reason: reasonText || "",
        remarks: reasonText || "",
        date_requested: currentDate,
        transfered_to: "",
        transfer_type: "",
        transfer_target: "",
        __v: inventory?.__v,
      };

      const res = await fetch(`${BASE_URL}/inventoryofficeequipment/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) throw new Error("Failed to submit return request.");
      const updated = await res.json();

      if (systemSettings.enable_email) {
        try {
          await sendWorkflowActionEmail({
            recipient: findUserByRoles(users, ["Regional Director"]),
            requestor: { email: currentUserEmail, username: currentUsername },
            requestType: "Return to Inventory Request",
            reference: inventory.property_no
              ? `Property No. ${inventory.property_no}`
              : `Request ${id}`,
            itemSummary: inventory.itemName,
            status: "For Approval",
            actionLabel: "review and approval",
            instructions:
              "Open the request, review the return reason and signed document, then approve or decline it.",
            message: "A new return-to-inventory request has been submitted.",
            requestId: updated?._id || id,
            senderName: currentUsername,
          });
        } catch (mailErr) {
          console.error("Failed to notify Regional Director:", mailErr);
        }
      }

      setInventory(updated || inventory);
      setShowReturnInventory(false);
      setShowSuccess(true);
    } catch (err) {
      console.error("Return to inventory failed:", err);
      alert(err.message || "Failed to submit return request.");
    }
  };


  /* ---------- QR download ---------- */
  const handleQRDownload = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert("Link copied to clipboard.");
    } catch {
      alert("Failed to copy link.");
    }
  };

  // Action visibility rules:
  // - NEVER allow Transfer/Issue when terminal or pending action states, or explicitly disposed variants.
  const isInStockStatus =
    statusNorm === "instock" || statusNorm === "in stock" || statusNorm === "";
  const canShowTransfer =
    !!user &&
    (isCurrentHolder || canOverrideTransferHolder) &&
    (statusNorm === "issued" || statusNorm === "transferred") &&
    !isTerminalStatus &&
    !isPendingActionStatus;
  const canShowDispose =
    !!user && canDisposeRole && isInStockStatus && !isTerminalStatus && !isPendingActionStatus;
  const canShowIssue =
    !!user &&
    (currentRole === "inventory admin" ||
      currentRole === "inventoryadmin" ||
      currentRole === "super admin" ||
      currentRole === "superadmin") &&
    isInStockStatus &&
    !inventory?.issued_to &&
    !isTerminalStatus &&
    !isPendingActionStatus;
  const canShowReturnInventory =
    !!user &&
    (isCurrentHolder || canOverrideTransferHolder) &&
    statusNorm === "issued" &&
    !isTerminalStatus &&
    !isPendingActionStatus;

  /* ---------- render gates ---------- */
  if (isLoading) {
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
                  Loading Equipment Details
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

  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4">
        <div className="max-w-md w-full bg-white border border-red-100 shadow-sm rounded-2xl p-6 text-center">
          <p className="text-red-600 font-semibold mb-1">Unable to load</p>
          <p className="text-sm text-gray-600">{error}</p>
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

  /* ---------- view ---------- */
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50 py-8">
      <div className="mx-auto w-full max-w-6xl px-4">
        {!isPublicView && (
          <Breadcrumbs
            className="mb-4"
            items={[
              { label: "Office Inventory", to: "/officedashboard" },
              employeeLookupReturn
                ? { label: "Employee Asset Lookup", to: employeeLookupReturn }
                : { label: "Office Equipment", to: "/stocktableofficeequipments" },
              { label: "Item Details" },
            ]}
          />
        )}
        {/* header (not included in sticker capture) */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user && (
              <button
                id="back-button"
                onClick={() => navigate(backTarget)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                title={employeeLookupReturn ? "Back to employee asset lookup" : "Back to list"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
            )}
            <div className="leading-tight">
              <p className="text-xs text-gray-500">PROPERTY OF</p>
              <p className="text-sm font-semibold text-gray-800">DICT REGION 2</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPublicView && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                Public view (read-only)
              </span>
            )}
            <img src={DICT} alt="DICT" className="h-8 w-8 object-contain" />
          </div>
        </div>

        {/* sticker canvas (what gets exported) */}
        <div
          id="download-wrapper"
          className="bg-white/90 rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden"
        >
          {/* Sticker Header (included in export) */}
          <div className="px-6 sm:px-8 py-5 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                  <img src={DICT} alt="DICT" className="h-7 w-7 object-contain" />
                </div>
                <div className="leading-tight">
                  <p className="text-[11px] text-gray-500 font-semibold tracking-wide">
                    PROPERTY OF
                  </p>
                  <p className="text-sm sm:text-base font-extrabold text-gray-900">
                    DICT REGION 02
                  </p>
                  <p className="text-[11px] text-gray-500">Region 2 Inventory System</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-gray-500">Sticker / QR</p>
                <p className="text-xs font-semibold text-gray-800">
                  {inventory.property_no ? `Property No. ${inventory.property_no}` : "Inventory Item"}
                </p>
                {inventory.asset_id && (
                  <p className="mt-1 text-sm sm:text-base font-extrabold text-slate-900">
                    {inventory.asset_id}
                  </p>
                )}
                {inventory.asset_type && (
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    {inventory.asset_type}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* LEFT: details */}
            <div className="p-6 lg:p-7 border-b lg:border-b-0 lg:border-r border-gray-100">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
                {inventory.classification || "Equipment"}
              </h2>
              <p className="mt-1 text-lg md:text-xl font-semibold text-gray-700">
                {inventory.itemName || "Unnamed item"}
              </p>

              <div className="mt-6 space-y-3">
                <DetailRow label="Property No." value={inventory.property_no} />
                <DetailRow label="Asset Type" value={inventory.asset_type} />
                <DetailRow label="Asset ID" value={inventory.asset_id} />
                <DetailRow
                  label="Unit cost"
                  value={
                    inventory.unit_cost
                      ? Number(inventory.unit_cost).toLocaleString("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        })
                      : ""
                  }
                />
                <DetailRow label="Quantity" value={`${inventory.qty ?? ""}`} />
                <DetailRow label="Classification" value={inventory.classification} />
                <DetailRow label="Date acquired" value={formatDate(inventory.date_acquired)} />
                <DetailRow label="Serial No." value={inventory.serial_no} />
                <DetailRow label="Specifications" value={inventory.specifications} />

                {issuedToUsername && (
                  <DetailRow label="Issued to" value={issuedToUsername} />
                )}
                {inventory.date_issued && (
                  <DetailRow label="Date issued" value={formatDate(inventory.date_issued)} />
                )}

                {!isPublicView && statusNorm === "transferred" && inventory.transfered_to && (
                  <DetailRow label="Last transferred to" value={transferToUsername} />
                )}

                {!isPublicView && statusNorm === "for transfer" && inventory.transfered_to && (
                  <DetailRow label="Pending transfer to" value={transferToUsername} />
                )}

                {(statusNorm === "for disposal" || statusNorm === "disposed") && (
                  <>
                    <DetailRow label="Disposal reason" value={inventory.disposal_reason} />
                    <DetailRow label="Disposal notes" value={inventory.disposal_notes} />
                  </>
                )}

                <DetailRow label="Stored to" value={inventory.stored_to} />
                <DetailRow label="Inclusions" value={inventory.inclusions} />

                {inventory.remarks && (
                  <div className="pt-1">
                    <p className="text-sm text-gray-600">Remarks</p>
                    <p className="font-medium text-gray-900">{inventory.remarks}</p>
                  </div>
                )}
              </div>

              {canEditCoreDetails && (
                <div
                  className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  data-export-hide="true"
                >
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
                        Property No.
                        <input
                          type="number"
                          value={coreForm.property_no}
                          onChange={handleCoreChange("property_no")}
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Unit cost
                        <input
                          type="number"
                          value={coreForm.unit_cost}
                          onChange={handleCoreChange("unit_cost")}
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Classification
                        <select
                          value={coreForm.classification}
                          onChange={handleCoreChange("classification")}
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">Select classification</option>
                          {includeCurrentOption(classificationOptions, coreForm.classification).map(
                            (option) => (
                              <option key={option} value={option}>{option}</option>
                            )
                          )}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Date acquired
                        <input
                          type="date"
                          value={coreForm.date_acquired}
                          onChange={handleCoreChange("date_acquired")}
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Serial No.
                        <input
                          type="text"
                          value={coreForm.serial_no}
                          onChange={handleCoreChange("serial_no")}
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                        Specifications
                        <textarea
                          value={coreForm.specifications}
                          onChange={handleCoreChange("specifications")}
                          className="mt-1 min-h-[90px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Stored to
                        <select
                          value={coreForm.stored_to}
                          onChange={handleCoreChange("stored_to")}
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">Select storage location</option>
                          {includeCurrentOption(storedToOptions, coreForm.stored_to).map(
                            (option) => (
                              <option key={option} value={option}>{option}</option>
                            )
                          )}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                        Remarks
                        <textarea
                          value={coreForm.remarks}
                          onChange={handleCoreChange("remarks")}
                          className="mt-1 min-h-[90px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
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

              {/* actions (export-hidden) */}
              {user && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm" data-export-hide="true">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      id="download-button"
                      onClick={handleDownload}
                      className="group inline-flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 3v12m0 0l4-4m-4 4l-4-4" />
                          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                        </svg>
                      </span>
                      Download Sticker
                    </button>

                    {canShowTransfer && (
                      <button
                        id="transfer-button"
                        onClick={() => {
                          setTransferPreset("transfer");
                          setShowTransfer(true);
                        }}
                        className="group inline-flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-white">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 3l5 5-5 5" />
                            <path d="M21 8H8" />
                            <path d="M8 21l-5-5 5-5" />
                            <path d="M3 16h13" />
                          </svg>
                        </span>
                        Transfer / Disposal
                      </button>
                    )}

                    {canShowReturnInventory && (
                      <button
                        id="return-inventory-button"
                        onClick={() => setShowReturnInventory(true)}
                        className="group inline-flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-300"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-600 text-white">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12h18" />
                            <path d="M7 8l-4 4 4 4" />
                          </svg>
                        </span>
                        Return to Inventory
                      </button>
                    )}


                    {canShowDispose && (
                      <button
                        id="dispose-button"
                        onClick={() => {
                          setTransferPreset("disposal");
                          setShowTransfer(true);
                        }}
                        className="group inline-flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose-600 text-white">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M6 6l1 14h10l1-14" />
                          </svg>
                        </span>
                        Dispose
                      </button>
                    )}

                    {canShowIssue && (
                      <div className="flex flex-col gap-1">
                        <button
                          id="issue-button"
                          onClick={() => setShowIssue(true)}
                          className="group inline-flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        >
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-white">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14" />
                              <path d="M5 12h14" />
                            </svg>
                          </span>
                          Issue
                        </button>
                        <span className="text-[10px] text-slate-500">Requires approval</span>
                      </div>
                    )}

                    <button
                      id="history-button"
                      onClick={() => setShowHistory(true)}
                      className="group inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12a9 9 0 1 0 9-9" />
                          <path d="M3 3v6h6" />
                          <path d="M12 7v5l3 3" />
                        </svg>
                      </span>
                      View History
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: QR */}
            <div className="p-6 lg:p-7 flex flex-col items-center justify-center">
              <div className="w-full max-w-xs sm:max-w-sm md:max-w-md flex flex-col items-center gap-4">
                <div ref={qrRef} className="rounded-2xl p-4 bg-gray-50 border border-gray-200">
                  <QRCode value={shareLink} size={qrSize} />
                </div>

                {/* QR actions (export-hidden) */}
                {user && (
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3" data-export-hide="true">
                    <button
                      onClick={handleQRDownload}
                      className="inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      Download QR
                    </button>
                    <button
                      onClick={copyLink}
                      className="inline-flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-800 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                      Copy Link
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-500 text-center">
                  Scan to open this item’s details page.
                </p>

                {/* If lost notice (included in export) */}
                <div className="w-full mt-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center">
                  <p className="text-[11px] text-gray-500 font-semibold tracking-wide">
                    IF FOUND / LOST ITEM NOTICE
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    If lost, please contact DICT Region 02.
                  </p>
                  <p className="text-xs font-semibold text-gray-900">0923-453-45XX</p>
                </div>

                {/* Terminal status label (nice UX) */}
                {isTerminalStatus && (
                  <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold text-amber-900">
                      This item is in a non-actionable status:{" "}
                      <span className="font-extrabold">{inventory.status || "—"}</span>
                    </p>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Transfer/Issue actions are disabled.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticker Footer (included in export) */}
          <div className="px-6 sm:px-8 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-[11px] text-gray-500">
                This equipment is government property. Unauthorized transfer/disposal is prohibited.
              </p>
              <p className="text-[11px] text-gray-500">Generated by Region 2 Inventory System</p>
            </div>
          </div>
        </div>

        {/* dialogs */}
        {showIssue && (
          <CenteredModal
            title="Issue Item"
            description="Select the employee who will receive this item. A notification email will be sent."
            subtitle="Item Issue"
            onClose={() => setShowIssue(false)}
          >
            <IssueOrTransferForm
              mode="issue"
              userOptions={userOptions}
              onConfirm={handleIssueConfirm}
              onCancel={() => setShowIssue(false)}
              canDispose={canDisposeRole}
            />
          </CenteredModal>
        )}

        {showTransfer && (
          <CenteredModal
            title={transferPreset === "disposal" ? "Disposal Request" : "Transfer / Disposal Request"}
            description={
              transferPreset === "disposal"
                ? "Confirm disposal details for this item."
                : canDisposeRole
                ? "Choose whether to transfer within DICT, to another agency, or set this item for disposal."
                : "Choose whether to transfer within DICT or to another agency."
            }
            subtitle="Transfer Workflow"
            variant={transferPreset === "disposal" ? "danger" : "warning"}
            onClose={() => setShowTransfer(false)}
          >
            <IssueOrTransferForm
              mode="transfer"
              userOptions={userOptions}
              onConfirm={handleTransferConfirm}
              onCancel={() => setShowTransfer(false)}
              canDispose={canDisposeRole}
              allowedTransferKinds={transferPreset === "disposal" ? ["disposal"] : undefined}
              initialTransferKind={transferPreset === "disposal" ? "disposal" : "user"}
            />
          </CenteredModal>
        )}

        {showReturnInventory && (
          <CenteredModal
            title="Return to Inventory"
            description="Provide a short reason for returning this item to inventory."
            subtitle="Return Workflow"
            variant="warning"
            onClose={() => setShowReturnInventory(false)}
          >
            <ReturnRequestForm
              actionLabel="Return to Inventory"
              onConfirm={handleReturnToInventoryConfirm}
              onCancel={() => setShowReturnInventory(false)}
            />
          </CenteredModal>
        )}


        {showSuccess && (
          <CenteredModal
            title="Success"
            description="The operation was completed successfully."
            subtitle="Inventory Update"
            onClose={() => setShowSuccess(false)}
          >
            <div className="mt-4">
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-black"
              >
                Close
              </button>
            </div>
          </CenteredModal>
        )}

        {showHistory && (
          <CenteredModal
            title="History"
            description="Summary timeline per transaction. You can still print the full audit trail."
            subtitle="Item History"
            onClose={() => setShowHistory(false)}
            maxWidthClass="max-w-2xl"
          >
            {completedForms.length > 0 && (
              <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  Completed Forms
                </p>
                <div className="mt-2 grid gap-2">
                  {completedForms.map((entry, idx) => {
                    const docType = String(entry?.doc_type || "").toUpperCase();
                    const snap = entry?.doc_snapshot || {};
                    const signedEntryFile = entry?.signed_file || snap?.signed_file;
                    const displayDate =
                      formatDateTime(
                        signedEntryFile?.uploaded_at ||
                          snap?.date_received ||
                          snap?.date_issued ||
                          snap?.date_released ||
                          entry?.to
                      ) || "—";
                    return (
                      <div
                        key={entry._id || `${docType}-${idx}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-emerald-800">
                            {docType || "Document"}
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            {displayDate}
                          </p>
                          {signedEntryFile?.filename && (
                            <p className="text-[10px] text-emerald-600">
                              {signedEntryFile.filename}
                            </p>
                          )}
                        </div>
                        <a
                          href={resolveServerUrl(signedEntryFile.url)}
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
            <div className="mt-3 max-h-[50vh] overflow-auto pr-1">
              {Array.isArray(transactionEntries) && transactionEntries.length ? (
                transactionEntries.map((entry, idx) => {
                  const docType = String(entry?.doc_type || "").toUpperCase();
                  const snap = entry?.doc_snapshot || {};
                  const signedEntryFile = entry?.signed_file || snap?.signed_file;
                  const isIcs = docType === "ICS";
                  const isPar = docType === "PAR";
                  const isTransfer = isTransferHistoryEntry(entry);
                  const isIssuance = (isIcs || isPar) && !isTransfer;
                  const isPtr = docType === "PTR";
                  const isRti = docType === "RTI";
                  const title = isTransfer
                    ? "Transferred"
                    : isIssuance
                    ? "Issued"
                    : isRti
                    ? "Returned to Inventory"
                    : docType || "Transaction";
                  const badgeClass = isTransfer
                    ? "bg-sky-100 text-sky-700"
                    : isIssuance
                    ? "bg-emerald-100 text-emerald-700"
                    : isRti
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-700";
                  const dateAdded = formatDateTime(
                    snap?.date_acquired || inventory?.date_acquired || inventory?.createdAt
                  );
                  const dateIssued = formatDateTime(snap?.date_issued || inventory?.date_issued);
                  const dateRequested = formatDateTime(
                    snap?.date_requested || entry?.from || inventory?.date_requested
                  );
                  const dateTransferred = formatDateTime(
                    snap?.date_received ||
                      snap?.date_released ||
                      inventory?.date_received ||
                      inventory?.date_released ||
                      entry?.to
                  );
                  const issuedTo = safeText(
                    findUserById(snap?.issued_to)?.username || snap?.issued_to,
                    "—"
                  );
                  const receivedBy = safeText(
                    findUserById(snap?.transfered_to)?.username ||
                      snap?.transfer_target ||
                      snap?.transfered_to,
                    "—"
                  );
                  const docNo = safeText(
                    isPar ? snap?.par_no : isIcs ? snap?.ics_no : isPtr ? snap?.ptr_no : "",
                    "—"
                  );
                  const timelineItems = isTransfer
                    ? [
                        { label: "Requested", value: dateRequested || "—" },
                        { label: "Transferred", value: dateTransferred || "—" },
                      ]
                    : isIssuance
                    ? [
                        { label: "Added", value: dateAdded || "—" },
                        { label: "Issued", value: dateIssued || "—" },
                      ]
                    : isRti
                    ? [
                        { label: "Requested", value: dateRequested || "—" },
                        { label: "Returned", value: dateTransferred || "—" },
                      ]
                    : [
                        {
                          label: "Recorded",
                          value:
                            formatDateTime(
                              entry?.to || entry?.date || entry?.createdAt || entry?.from
                            ) || "—",
                        },
                      ];
                  const noteText = entry?.reason || entry?.remarks || snap?.remarks || "";
                  const metaItems = [];
                  if (docNo !== "—") {
                    metaItems.push({
                      label: isIssuance || isTransfer ? docType : isRti ? "RTI" : docType || "Doc",
                      value: docNo,
                    });
                  }
                  if (isIssuance && issuedTo !== "—") {
                    metaItems.push({ label: "Issued to", value: issuedTo });
                  }
                  if (isTransfer && receivedBy !== "—") {
                    metaItems.push({ label: "Received by", value: receivedBy });
                  }
                  if (isRti && issuedTo !== "—") {
                    metaItems.push({ label: "Returned by", value: issuedTo });
                  }
                  const printLabel = isIssuance || isTransfer
                    ? `Printable ${docType}`
                    : isRti
                    ? "Printable RTI"
                    : `Print ${docType || "Document"}`;
                  return (
                    <div
                      key={entry._id || `${docType}-${idx}`}
                      className="mb-4 last:mb-0 rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50 px-4 py-4 shadow-sm"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                          {docType || "Transaction"}
                        </p>
                        <p className="text-lg font-extrabold text-gray-900">{title}</p>
                      </div>
                      <span className={`rounded-full px-2 py-[3px] text-[10px] font-bold ${badgeClass}`}>
                        #{idx + 1}
                      </span>
                    </div>

                    {metaItems.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
                        {metaItems.map((item) => (
                          <span
                            key={`${item.label}-${item.value}`}
                            className="rounded-full border border-gray-200 bg-white px-2 py-1"
                          >
                            <span className="font-semibold text-gray-700">{item.label}:</span>{" "}
                            {item.value}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-gray-100 bg-white px-3 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {timelineItems.map((item, i) => (
                          <React.Fragment key={item.label}>
                            <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                {item.label}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {item.value}
                              </p>
                            </div>
                            {i < timelineItems.length - 1 && (
                              <div className="hidden sm:flex items-center text-gray-300">→</div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {noteText && (
                      <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          Notes
                        </p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {noteText}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.doc_type && entry.doc_snapshot && (
                        <button
                          type="button"
                          onClick={() => handlePrintHistoryDoc(entry)}
                          className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          {printLabel}
                        </button>
                      )}
                      {signedEntryFile?.url && (
                        <a
                          href={resolveServerUrl(signedEntryFile.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Download signed file
                        </a>
                      )}
                    </div>
                  </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500">No history available.</p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handlePrintHistory}
                className="w-full inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                Print History (PDF)
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="w-full inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-black"
              >
                Close
              </button>
            </div>
          </CenteredModal>
        )}
      </div>
    </div>
  );
}

/* ---------- Reusable: centered modal shell ---------- */
function CenteredModal({
  title,
  description,
  onClose,
  children,
  maxWidthClass,
  subtitle = "Inventory Action",
  variant = "neutral",
}) {
  return (
    <ModalShell
      open
      title={title}
      subtitle={subtitle}
      variant={variant}
      onClose={onClose}
      maxWidthClass={maxWidthClass || "max-w-md"}
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

/* ---------- Issue/Transfer content ---------- */
function IssueOrTransferForm({
  mode,
  userOptions,
  onConfirm,
  onCancel,
  canDispose,
  allowedTransferKinds,
  initialTransferKind,
}) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // For transfer only:
  const isTransfer = mode === "transfer";
  const availableTransferKinds = useMemo(() => {
    if (!isTransfer) return [];
    const base = Array.isArray(allowedTransferKinds) && allowedTransferKinds.length
      ? allowedTransferKinds
      : ["user", "otherAgency", ...(canDispose ? ["disposal"] : [])];
    return base.filter((k) => k !== "disposal" || canDispose);
  }, [allowedTransferKinds, canDispose, isTransfer]);
  const [transferKind, setTransferKind] = useState(() => {
    if (!isTransfer) return "user";
    if (initialTransferKind && availableTransferKinds.includes(initialTransferKind)) {
      return initialTransferKind;
    }
    return availableTransferKinds[0] || "user";
  }); // "user" | "otherAgency" | "disposal"
  const [customTarget, setCustomTarget] = useState("");
  useEffect(() => {
    if (!isTransfer) return;
    if (!availableTransferKinds.includes(transferKind)) {
      setTransferKind(availableTransferKinds[0] || "user");
    }
  }, [availableTransferKinds, isTransfer, transferKind]);

  const handleProceed = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "issue") {
        await onConfirm(selectedUser);
      } else {
        await onConfirm({
          transferKind,
          selectedUser,
          customTarget,
          reason,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {isTransfer && (
        <div className="mb-4">
          <p className="block text-xs font-medium text-gray-700 mb-2">Action</p>
          <div className="flex flex-wrap gap-2">
            {availableTransferKinds.includes("user") && (
              <button
                type="button"
                onClick={() => setTransferKind("user")}
                className={
                  "px-3 py-1.5 rounded-full text-xs font-semibold border " +
                  (transferKind === "user"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
                }
              >
                Transfer to DICT user
              </button>
            )}
            {availableTransferKinds.includes("otherAgency") && (
              <button
                type="button"
                onClick={() => setTransferKind("otherAgency")}
                className={
                  "px-3 py-1.5 rounded-full text-xs font-semibold border " +
                  (transferKind === "otherAgency"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
                }
              >
                Transfer to other agency
              </button>
            )}
            {availableTransferKinds.includes("disposal") && (
              <button
                type="button"
                onClick={() => setTransferKind("disposal")}
                className={
                  "px-3 py-1.5 rounded-full text-xs font-semibold border " +
                  (transferKind === "disposal"
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
                }
              >
                Set for disposal
              </button>
            )}
          </div>
        </div>
      )}

      {/* Employee select (for Issue and "transfer to user") */}
      {(!isTransfer || transferKind === "user") && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Employee
          </label>
          <Select
            classNamePrefix="react-select"
            options={userOptions}
            value={selectedUser}
            onChange={setSelectedUser}
            isClearable
            isDisabled={busy}
            placeholder="Search and select…"
            getOptionLabel={(opt) => `${opt.label}${opt.email ? ` (${opt.email})` : ""}`}
            getOptionValue={(opt) => opt.value}
          />
          {isTransfer && transferKind === "user" && (
            <p className="mt-1 text-[11px] text-gray-500">
              This will create a <b>For Transfer</b> request to another DICT Region 2
              user, subject for approval.
            </p>
          )}
        </div>
      )}

      {/* Custom target for other agency / disposal */}
      {isTransfer && transferKind === "otherAgency" && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Receiving agency / office
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Ex. LGU Roxas, Isabela – Mayor’s Office"
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            disabled={busy}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            This will still go through <b>For Transfer</b> approval, but target is a
            non-DICT agency.
          </p>
        </div>
      )}

{isTransfer && transferKind === "disposal" && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Disposal details (optional)
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            placeholder="Ex. For e-waste disposal, not repairable"
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            disabled={busy}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Status will be set to <b>For Disposal</b> and routed for approval.
          </p>
        </div>
      )}

      {/* Reason / remarks */}
      {isTransfer && (
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Reason / Remarks {transferKind === "disposal" ? "" : "(optional)"}
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            rows={4}
            placeholder={
              transferKind === "disposal"
                ? "Why are you disposing this item?"
                : "Why are you transferring this item? (optional)"
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={handleProceed}
          disabled={busy}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
            busy ? "bg-gray-500" : "bg-gray-900 hover:bg-black"
          }`}
        >
          {busy ? "Processing…" : "Proceed"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-800 px-4 py-2.5 text-sm font-semibold hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReturnRequestForm({ actionLabel, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleProceed = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Reason / Remarks (optional)
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
          rows={4}
          placeholder="Provide a short reason (e.g., defective, resigning)."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={handleProceed}
          disabled={busy}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
            busy ? "bg-gray-500" : "bg-gray-900 hover:bg-black"
          }`}
        >
          {busy ? "Processing…" : actionLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-800 px-4 py-2.5 text-sm font-semibold hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------- small helper row ---------- */
const DetailRow = ({ label, value }) => (
  <>
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-sm font-semibold text-gray-900 text-right break-all">
        {value || "—"}
      </p>
    </div>
    <hr className="bg-gray-100 w-full my-2" />
  </>
);
