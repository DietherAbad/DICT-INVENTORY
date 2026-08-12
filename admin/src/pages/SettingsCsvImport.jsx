import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { BASE_URL } from "../utils/config";
import { DEFAULT_PROJECTS } from "../utils/projects";
import { DEFAULT_DESIGNATIONS } from "../utils/designations";
import SettingsHeader from "../components/SettingsHeader";
import ModalShell from "../components/ModalShell";

const TEMPLATE_CONFIG = {
  supplies: {
    label: "Office Supplies",
    required: [
      "stock_no",
      "item_name",
      "classification",
      "unit_of_measure",
      "quantity",
      "unit_cost",
      "project",
      "date",
    ],
    optional: ["remarks", "lowstock_threshold", "status"],
    sample: {
      stock_no: 1001,
      item_name: "Ballpen (Black)",
      classification: "Stationery",
      unit_of_measure: "Pcs",
      quantity: 250,
      unit_cost: 12,
      project: "Regional Office",
      remarks: "Initial stock",
      lowstock_threshold: 20,
      date: "2025-01-15",
      status: "Instock",
    },
  },
  users: {
    label: "Users",
    required: [
      "username",
      "email",
      "password",
      "position",
      "designation",
      "project",
    ],
    optional: ["active"],
    sample: {
      username: "Juan Dela Cruz",
      email: "juan.delacruz@example.gov.ph",
      password: "TempPass1!",
      position: "Administrative Aide VI",
      designation: "Regional Office - Tuguegarao",
      project: "General",
      active: true,
    },
  },
  equipment: {
    label: "Office Equipment",
    required: [
      "item_name",
      "classification",
      "unit_of_measure",
      "quantity",
    ],
    optional: [
      "property_no",
      "serial_no",
      "batch_no",
      "asset_type",
      "specifications",
      "inclusions",
      "remarks",
      "item_no",
      "unit_cost",
      "project",
      "date_acquired",
      "status",
      "requeststatus",
      "date_requested",
      "issued_to",
      "transfered_to_id",
      "stored_to",
      "date_issued",
    ],
    sample: {
      property_no: 50001,
      item_no: 2001,
      item_name: "Printer",
      classification: "Equipment",
      unit_of_measure: "Unit",
      quantity: 1,
      unit_cost: 18000,
      serial_no: "PRN-2024-001",
      batch_no: "EQ-2024-10-A",
      asset_type: "PPE",
      specifications: "Laser printer, duplex, network-ready",
      inclusions: "Power cable, USB cable",
      project: "Admin",
      remarks: "",
      date_acquired: "2024-10-02",
      issued_to: "",
      transfered_to_id: "",
      stored_to: "Asset Room A",
      date_issued: "",
      status: "In Stock",
    },
  },
  furniture: {
    label: "Furniture & Fixtures",
    required: [
      "item_name",
      "classification",
      "unit_of_measure",
      "quantity",
    ],
    optional: [
      "property_no",
      "serial_no",
      "batch_no",
      "asset_type",
      "specifications",
      "inclusions",
      "remarks",
      "item_no",
      "unit_cost",
      "project",
      "date_acquired",
      "status",
      "requeststatus",
      "date_requested",
      "issued_to",
      "transfered_to_id",
      "stored_to",
      "date_issued",
    ],
    sample: {
      property_no: 60010,
      item_no: 3001,
      item_name: "Office Chair",
      classification: "Furniture",
      unit_of_measure: "Unit",
      quantity: 10,
      unit_cost: 2500,
      serial_no: "",
      batch_no: "FF-2024-08-B",
      asset_type: "SE",
      specifications: "Mesh back, adjustable height",
      inclusions: "Arm rests, wheel set",
      project: "HR",
      remarks: "Ergonomic",
      date_acquired: "2024-08-12",
      issued_to: "",
      transfered_to_id: "",
      stored_to: "Storage Room B",
      date_issued: "",
      status: "In Stock",
    },
  },
  ict: {
    label: "ICT Equipment",
    required: [
      "item_name",
      "classification",
      "unit_of_measure",
      "quantity",
    ],
    optional: [
      "property_no",
      "serial_no",
      "batch_no",
      "asset_type",
      "specifications",
      "inclusions",
      "remarks",
      "item_no",
      "unit_cost",
      "project",
      "date_acquired",
      "status",
      "requeststatus",
      "date_requested",
      "issued_to",
      "transfered_to_id",
      "stored_to",
      "date_issued",
    ],
    sample: {
      property_no: 70045,
      item_no: 4001,
      item_name: "Laptop",
      classification: "ICT",
      unit_of_measure: "Unit",
      quantity: 1,
      unit_cost: 45000,
      serial_no: "LTP-ICT-888",
      batch_no: "ICT-2024-05-01",
      asset_type: "PPE",
      specifications: "Core i5, 16GB RAM, 512GB SSD",
      inclusions: "Charger, laptop bag",
      project: "ICT Division",
      remarks: "",
      date_acquired: "2024-05-06",
      issued_to: "",
      transfered_to_id: "",
      stored_to: "ICT Storeroom",
      date_issued: "",
      status: "In Stock",
    },
  },
};

const normalizeCategory = (value) => {
  const key = String(value || "").toLowerCase().trim();
  return TEMPLATE_CONFIG[key] ? key : "supplies";
};

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const parseCsvText = (text) => {
  const rows = [];
  const input = String(text || "");
  if (!input.trim()) return rows;

  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "\"") {
      if (inQuotes && input[i + 1] === "\"") {
        field += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  if (rows.length && rows[0].length) {
    rows[0][0] = String(rows[0][0] || "").replace(/^\uFEFF/, "");
  }
  return rows;
};

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/i;
const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
const ID_VALIDATION_CATEGORIES = new Set(["equipment", "furniture", "ict"]);
const ISSUED_ID_HEADERS = new Set([
  "issued_to",
  "issuedto",
  "issued_to_id",
  "issuedto_id",
  "issuedtoid",
  "issued_id",
  "issuedid",
]);
const TRANSFER_ID_HEADERS = new Set([
  "transfered_to_id",
  "transferred_to_id",
  "transferedto_id",
  "transferredto_id",
  "transfered_id",
  "transferred_id",
]);
const LEGACY_OPTIONAL_HEADERS = {
  equipment: ["issued_to_id"],
  furniture: ["issued_to_id"],
  ict: ["issued_to_id"],
};

const runClientCsvIdValidation = (text, category, config) => {
  const key = normalizeCategory(category);
  const rows = parseCsvText(text);
  const totalRows = Math.max(0, rows.length - 1);
  if (rows.length <= 1) return { errors: [], totalRows };

  const headers = rows[0].map((h) => String(h || ""));
  const normalizedHeaders = headers.map(normalizeHeader);
  const expectedHeaders = [...(config?.required || []), ...(config?.optional || [])];
  const expectedNormalizedSet = new Set([
    ...expectedHeaders.map(normalizeHeader),
    ...((LEGACY_OPTIONAL_HEADERS[key] || []).map(normalizeHeader)),
  ]);
  const seenHeaders = new Set();
  const errors = [];

  normalizedHeaders.forEach((header, idx) => {
    const label = headers[idx] || header;
    if (seenHeaders.has(header)) {
      errors.push({
        row: 1,
        field: label,
        message: `Duplicate column "${label}".`,
      });
      return;
    }
    seenHeaders.add(header);

    if (expectedNormalizedSet.size && !expectedNormalizedSet.has(header)) {
      errors.push({
        row: 1,
        field: label,
        message: `Unknown column "${label}".`,
      });
    }
  });

  (config?.required || []).forEach((header) => {
    if (!seenHeaders.has(normalizeHeader(header))) {
      errors.push({
        row: 1,
        field: header,
        message: `Required column "${header}" is missing.`,
      });
    }
  });

  if (!ID_VALIDATION_CATEGORIES.has(key)) {
    return { errors, totalRows };
  }

  const issuedCols = normalizedHeaders
    .map((norm, idx) =>
      ISSUED_ID_HEADERS.has(norm) ? { idx, label: headers[idx] || norm } : null
    )
    .filter(Boolean);
  const transferCols = normalizedHeaders
    .map((norm, idx) =>
      TRANSFER_ID_HEADERS.has(norm) ? { idx, label: headers[idx] || norm } : null
    )
    .filter(Boolean);

  rows.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;

    issuedCols.forEach((col) => {
      const value = String(row[col.idx] ?? "").trim();
      if (!value) return;
      if (!OBJECT_ID_REGEX.test(value)) {
        errors.push({
          row: rowNumber,
          field: col.label,
          message: `${col.label} must be a valid user ID.`,
        });
      }
    });

    transferCols.forEach((col) => {
      const value = String(row[col.idx] ?? "").trim();
      if (!value) return;
      if (!OBJECT_ID_REGEX.test(value)) {
        errors.push({
          row: rowNumber,
          field: col.label,
          message: `${col.label} must be a valid user ID.`,
        });
      }
    });

    const transferToIdIdx = normalizedHeaders.indexOf("transfered_to_id");
    const transferredToIdIdx = normalizedHeaders.indexOf("transferred_to_id");
    if (transferToIdIdx >= 0 && transferredToIdIdx >= 0) {
      const transferToId = String(row[transferToIdIdx] ?? "").trim();
      const transferredToId = String(row[transferredToIdIdx] ?? "").trim();
      if (transferToId && transferredToId && transferToId !== transferredToId) {
        errors.push({
          row: rowNumber,
          field: "transfered_to_id",
          message:
            "transfered_to_id and transferred_to_id must match when both are provided.",
        });
      }
    }
  });

  return { errors, totalRows };
};

const toCsvCell = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
};

const normalizeLookupValue = (value) => String(value || "").trim().toLowerCase();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const buildLookupSet = (list = []) => {
  const set = new Set();
  list.forEach((item) => {
    const key = normalizeLookupValue(item);
    if (key) set.add(key);
  });
  return set;
};

const coerceBooleanLike = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const yieldToBrowser = () => new Promise((resolve) => window.setTimeout(resolve, 0));

const fetchArrayOrNull = async (path) => {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return null;
  } catch (_err) {
    return null;
  }
};

const loadUserImportReferenceData = async () => {
  const [projects, designations, users] = await Promise.all([
    fetchArrayOrNull("/projects?activeOnly=1"),
    fetchArrayOrNull("/designations?activeOnly=1"),
    fetchArrayOrNull("/users/directory"),
  ]);

  const projectNames = [
    ...(Array.isArray(projects) ? projects.map((item) => item?.name).filter(Boolean) : []),
    ...DEFAULT_PROJECTS,
  ];
  const designationNames = [
    ...(Array.isArray(designations)
      ? designations.map((item) => item?.name).filter(Boolean)
      : []),
    ...DEFAULT_DESIGNATIONS,
  ];
  const existingEmails = Array.isArray(users)
    ? users.map((item) => item?.email).filter(Boolean)
    : [];

  return {
    projectSet: buildLookupSet(projectNames),
    designationSet: buildLookupSet(designationNames),
    existingEmailSet: users ? buildLookupSet(existingEmails) : null,
  };
};

const runClientUserValidation = async ({
  text,
  config,
  projectSet,
  designationSet,
  existingEmailSet,
  onProgress,
}) => {
  const rows = parseCsvText(text);
  const totalRows = Math.max(0, rows.length - 1);
  if (rows.length <= 1) {
    return { errors: [], totalRows, preview: [] };
  }

  const csvHeaders = rows[0].map((value) => String(value || ""));
  const normalizedHeaders = csvHeaders.map(normalizeHeader);
  const expectedHeaders = [...config.required, ...config.optional];
  const expectedNormalizedSet = new Set(expectedHeaders.map(normalizeHeader));
  const canonicalHeaderMap = expectedHeaders.reduce((acc, header) => {
    acc[normalizeHeader(header)] = header;
    return acc;
  }, {});

  const errors = [];
  const preview = [];
  const seenEmails = new Set();
  const existingEmails = new Set();
  const seenHeaders = new Set();

  normalizedHeaders.forEach((header, idx) => {
    const label = csvHeaders[idx] || header;
    if (seenHeaders.has(header)) {
      errors.push({
        row: 1,
        field: label,
        message: `Duplicate column "${label}".`,
      });
      return;
    }
    seenHeaders.add(header);

    if (!expectedNormalizedSet.has(header)) {
      errors.push({
        row: 1,
        field: label,
        message: `Unknown column "${label}".`,
      });
    }
  });

  config.required.forEach((header) => {
    if (!seenHeaders.has(normalizeHeader(header))) {
      errors.push({
        row: 1,
        field: header,
        message: `Required column "${header}" is missing.`,
      });
    }
  });

  for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
    const row = rows[rowIndex + 1] || [];
    const rowNumber = rowIndex + 2;

    onProgress?.({
      label: `Scanning row ${rowIndex + 1} of ${totalRows}`,
      current: rowIndex + 1,
      total: totalRows,
    });

    if (rowIndex > 0 && rowIndex % 25 === 0) {
      await yieldToBrowser();
    }

    const record = {};
    csvHeaders.forEach((header, idx) => {
      const canonical = canonicalHeaderMap[normalizeHeader(header)];
      if (!canonical) return;
      record[canonical] = String(row[idx] ?? "").trim();
    });

    const hasAnyField = Object.values(record).some((value) => String(value).trim() !== "");
    if (!hasAnyField) continue;

    if (preview.length < 5) {
      preview.push({
        ...record,
        password: record.password ? "••••••••" : "",
      });
    }

    const rowErrors = [];

    config.required.forEach((field) => {
      if (!String(record[field] || "").trim()) {
        rowErrors.push({ field, message: "Required field is missing." });
      }
    });

    const email = normalizeEmail(record.email);
    if (email) {
      if (!EMAIL_REGEX.test(email)) {
        rowErrors.push({ field: "email", message: "Must be a valid email address." });
      }
      if (seenEmails.has(email)) {
        rowErrors.push({ field: "email", message: "Duplicate email within CSV." });
      } else {
        seenEmails.add(email);
      }
      if (existingEmailSet?.has(email)) {
        existingEmails.add(email);
      }
    }

    if (record.password && !PASSWORD_POLICY.test(record.password)) {
      rowErrors.push({
        field: "password",
        message:
          "Password must be 8+ characters and include an uppercase letter, a number, and a special character.",
      });
    }

    if (record.project && !projectSet.has(normalizeLookupValue(record.project))) {
      rowErrors.push({
        field: "project",
        message: "Project does not exist or is inactive.",
      });
    }

    if (
      record.designation &&
      !designationSet.has(normalizeLookupValue(record.designation))
    ) {
      rowErrors.push({
        field: "designation",
        message: "Designation does not exist or is inactive.",
      });
    }

    if (record.active) {
      const active = coerceBooleanLike(record.active);
      if (active === null) {
        rowErrors.push({
          field: "active",
          message: "Must be true/false, yes/no, or 1/0.",
        });
      }
    }

    rowErrors.forEach((error) => {
      errors.push({ row: rowNumber, field: error.field, message: error.message });
    });
  }

  onProgress?.({
    label: totalRows ? `Scanned ${totalRows} rows locally` : "No rows found",
    current: totalRows,
    total: totalRows || 1,
  });

  return { errors, totalRows, preview, existingCount: existingEmails.size };
};

const formatPreviewValue = (header, value) => {
  if (header === "password" && value) return "••••••••";
  return value ?? "—";
};

export default function SettingsCsvImport() {
  const [category, setCategory] = useState("supplies");
  const [file, setFile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalState, setModalState] = useState("idle");
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [message, setMessage] = useState("");
  const [validationProgress, setValidationProgress] = useState({
    stage: "idle",
    label: "",
    current: 0,
    total: 0,
  });

  const hasErrors = errors.length > 0;
  const progressPercent =
    validationProgress.total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((validationProgress.current / validationProgress.total) * 100)
          )
        )
      : 0;

  const currentConfig = useMemo(
    () => TEMPLATE_CONFIG[normalizeCategory(category)],
    [category]
  );

  const headers = useMemo(
    () => [...currentConfig.required, ...currentConfig.optional],
    [currentConfig]
  );

  const downloadCsvTemplate = () => {
    const row = headers.map((h) => toCsvCell(currentConfig.sample?.[h]));
    const csv = [headers.join(","), row.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentConfig.label.replace(/\s+/g, "_")}_template.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadExcelTemplate = () => {
    const row = headers.reduce((acc, key) => {
      acc[key] = currentConfig.sample?.[key] ?? "";
      return acc;
    }, {});
    const ws = XLSX.utils.json_to_sheet([row], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${currentConfig.label.replace(/\s+/g, "_")}_template.xlsx`);
  };

  const resetModal = () => {
    setModalOpen(false);
    setModalState("idle");
    setErrors([]);
    setSummary(null);
    setPreviewRows([]);
    setMessage("");
    setValidationProgress({ stage: "idle", label: "", current: 0, total: 0 });
  };

  const downloadErrorReport = () => {
    if (!errors.length) return;
    const header = ["row", "field", "message"];
    const rows = errors.map((err) => [
      toCsvCell(err.row),
      toCsvCell(err.field),
      toCsvCell(err.message),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentConfig.label.replace(/\s+/g, "_")}_errors.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const validateFile = async () => {
    if (!file) {
      setMessage("Please choose a CSV file first.");
      setModalOpen(true);
      setModalState("error");
      return;
    }
    setModalOpen(true);
    setModalState("validating");
    setErrors([]);
    setSummary(null);
    setPreviewRows([]);
    setMessage("");
    setValidationProgress({
      stage: "reading",
      label: "Reading CSV file...",
      current: 0,
      total: 1,
    });

    try {
      const categoryKey = normalizeCategory(category);
      const localText = await file.text();
      let localValidation;

      if (categoryKey === "users") {
        setValidationProgress({
          stage: "references",
          label: "Loading active projects, designations, and existing users...",
          current: 0,
          total: 1,
        });
        const referenceData = await loadUserImportReferenceData();
        localValidation = await runClientUserValidation({
          text: localText,
          config: currentConfig,
          projectSet: referenceData.projectSet,
          designationSet: referenceData.designationSet,
          existingEmailSet: referenceData.existingEmailSet,
          onProgress: ({ label, current, total }) =>
            setValidationProgress({
              stage: "scanning",
              label,
              current,
              total,
            }),
        });
        setPreviewRows(localValidation.preview || []);
      } else {
        setValidationProgress({
          stage: "scanning",
          label: "Scanning file locally...",
          current: 1,
          total: 1,
        });
        localValidation = runClientCsvIdValidation(localText, category, currentConfig);
      }

      if (localValidation.errors.length) {
        setErrors(localValidation.errors);
        const rowsWithErrors = new Set(localValidation.errors.map((err) => err.row)).size;
        setSummary({
          totalRows: localValidation.totalRows,
          validRows: Math.max(0, localValidation.totalRows - rowsWithErrors),
          category: currentConfig.label,
        });
        setModalState("errors");
        return;
      }
    } catch (err) {
      setMessage("Unable to read CSV file.");
      setModalState("error");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    try {
      setValidationProgress({
        stage: "server",
        label:
          normalizeCategory(category) === "users"
            ? "Local scan complete. Verifying users against the server..."
            : "Local scan complete. Verifying against the server...",
        current: 1,
        total: 1,
      });
      const res = await fetch(
        `${BASE_URL}/csv-import/validate?category=${normalizeCategory(category)}`,
        {
          method: "POST",
          body: form,
          credentials: "include",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data?.errors?.length) {
          setErrors(data.errors);
          setSummary({
            totalRows: data.totalRows,
            validRows: data.validRows,
            category: data.category,
          });
          setPreviewRows(data.preview || []);
          setModalState("errors");
          return;
        }
        setMessage(data?.message || "Validation failed.");
        setModalState("error");
        return;
      }
      if (data.errors?.length) {
        setErrors(data.errors);
        setPreviewRows(data.preview || []);
        setSummary({
          totalRows: data.totalRows,
          validRows: data.validRows,
          category: data.category,
        });
        setModalState("errors");
        return;
      }
      setSummary({
        totalRows: data.totalRows,
        validRows: data.validRows,
        category: data.category,
        existingCount: data.existingCount || 0,
        newCount: data.newCount ?? data.validRows,
      });
      setPreviewRows(data.preview || []);
      setModalState("ready");
    } catch (err) {
      setMessage("Unable to validate CSV right now.");
      setModalState("error");
    }
  };

  const importFile = async (updateExisting = false) => {
    if (!file) return;
    setModalState("importing");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(
        `${BASE_URL}/csv-import/import?category=${normalizeCategory(category)}${
          updateExisting ? "&updateExisting=true" : ""
        }`,
        {
          method: "POST",
          body: form,
          credentials: "include",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data?.requiresUpdateConfirmation) {
          setSummary((prev) => ({
            ...(prev || {}),
            category: data.category || prev?.category || currentConfig.label,
            existingCount: data.existingCount || 0,
            newCount: data.newCount ?? prev?.newCount ?? 0,
          }));
          setModalState("confirm-update");
          return;
        }
        setMessage(data?.message || "Import failed.");
        setErrors(data?.errors || []);
        setModalState("error");
        return;
      }
      setSummary({
        category: data.category,
        insertedCount: data.insertedCount,
        updatedCount: data.updatedCount || 0,
      });
      setModalState("success");
      setFile(null);
    } catch (err) {
      setMessage("Unable to import CSV right now.");
      setModalState("error");
    }
  };

  const modalVariant =
    modalState === "errors" || modalState === "error"
      ? "danger"
      : modalState === "confirm-update"
      ? "warning"
      : modalState === "ready" || modalState === "success"
      ? "neutral"
      : "warning";

  return (
    <>
      <div className="space-y-6">
        <SettingsHeader
          crumbs={[
            { label: "Settings", to: "/settingsdashboard" },
            { label: "CSV Import" },
          ]}
          title="CSV Import"
          subtitle="Upload validated templates to bulk create inventory items and user accounts."
          rightSlot={
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
              Data verified before upload
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">1. Choose category</h2>
          <p className="text-xs text-gray-500 mt-1">
            Pick the type of data you want to import. Templates are different per
            category.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(TEMPLATE_CONFIG).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  normalizeCategory(category) === key
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {value.label}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Required columns
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {currentConfig.required.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700"
                >
                  {item}
                </span>
              ))}
            </div>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Optional columns
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {currentConfig.optional.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCsvTemplate}
              className="rounded-lg bg-gray-900 px-4 py-2 text-[11px] font-semibold text-white shadow hover:bg-black"
            >
              Download CSV template
            </button>
            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Download Excel template
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">2. Upload and verify</h2>
          <p className="text-xs text-gray-500 mt-1">
            Upload the filled template. The system will validate and show any errors
            before importing.
          </p>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-600"
            />
            {file && (
              <div className="mt-2 text-[11px] text-gray-500">
                Selected file: <span className="font-semibold">{file.name}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={validateFile}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-[11px] font-semibold text-white shadow hover:bg-indigo-700"
            >
              Validate CSV
            </button>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Clear file
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-700">
            <p className="font-semibold">Tips</p>
            {normalizeCategory(category) === "users" ? (
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Keep column names exactly as shown in the template.</li>
                <li>Password must be 8+ characters with an uppercase letter, a number, and a special character.</li>
                <li>Project and designation must already exist and be active in Settings.</li>
                <li>Imported accounts are always created with the default `employee` role.</li>
                <li>If an email already exists, the importer can update that user after confirmation.</li>
                <li>User import does not send welcome email notifications.</li>
                <li>The optional `active` column accepts true/false, yes/no, or 1/0.</li>
                <li>Export Excel files as CSV before uploading.</li>
              </ul>
            ) : (
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Keep column names exactly as shown in the template.</li>
                <li>If `property_no` is blank, the importer auto-generates the next available number.</li>
                <li>`property_no` and `item_no` can be text or numbers.</li>
                <li>If `project` is blank, the importer saves `Not Applicable`.</li>
                <li>`unit_cost`, `project`, `date_acquired`, `date_issued`, and `stored_to` are optional for equipment, furniture, and ICT imports.</li>
                <li>Dates must be YYYY-MM-DD (or Excel serial values).</li>
                <li>`issued_to` and `transfered_to_id` must be valid user IDs.</li>
                <li>Use `issued_to` in new CSV files. `issued_to_id` is accepted only as a legacy alias.</li>
                <li>Use "inclusions" and "specifications" columns for complete item details.</li>
                <li>
                  If `status` is blank, `issued_to` creates `For Issue` and `transfered_to_id` creates `For Transfer`, both with `requeststatus` set to `For Approval`.
                </li>
                <li>
                  If `status` is `Issued` or `Transferred` and `requeststatus` is blank, the importer auto-fills the same final request status.
                </li>
                <li>Project must already exist and be active in Settings → Projects.</li>
                <li>Export Excel files as CSV before uploading.</li>
              </ul>
            )}
          </div>
        </div>
      </div>

      </div>

      <ModalShell
        open={modalOpen}
        title="CSV Validation"
        subtitle="Bulk Import"
        variant={modalVariant}
        onClose={resetModal}
        maxWidthClass="max-w-2xl"
      >
            <div className="space-y-4">
              {modalState === "validating" && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">
                  <div className="font-semibold">
                    {validationProgress.label || "Checking file, please wait..."}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className={`h-full rounded-full bg-blue-600 transition-all duration-300 ${
                        validationProgress.stage === "server" ||
                        validationProgress.stage === "references"
                          ? "w-full animate-pulse"
                          : ""
                      }`}
                      style={
                        validationProgress.stage === "server" ||
                        validationProgress.stage === "references"
                          ? undefined
                          : { width: `${progressPercent}%` }
                      }
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-blue-700/80">
                    {validationProgress.stage === "scanning" &&
                    validationProgress.total > 0 ? (
                      <>
                        {validationProgress.current} / {validationProgress.total} rows scanned
                        ({progressPercent}%)
                      </>
                    ) : normalizeCategory(category) === "users" ? (
                      <>Running local checks first, then verifying against the server.</>
                    ) : (
                      <>Preparing validation request.</>
                    )}
                  </div>
                </div>
              )}

              {modalState === "errors" && (
                <>
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700">
                    We found issues in the CSV. Fix them then reupload.
                  </div>
                  {summary && (
                    <div className="text-[11px] text-gray-500">
                      {summary.validRows} of {summary.totalRows} rows are valid.
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500">
                    Total errors: {errors.length}
                  </div>
                  <div className="max-h-56 overflow-auto rounded-lg border border-gray-100">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Field</th>
                          <th className="px-3 py-2 text-left">Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errors.map((err, idx) => (
                          <tr key={`${err.row || "row"}-${idx}`} className="border-t">
                            <td className="px-3 py-2">{err.row ?? "—"}</td>
                            <td className="px-3 py-2">{err.field ?? "—"}</td>
                            <td className="px-3 py-2">{err.message || "Invalid value"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewRows.length > 0 && (
                    <div className="rounded-lg border border-gray-100 overflow-auto">
                      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                        Preview (first 5 rows)
                      </div>
                      <table className="w-full text-[11px]">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            {headers.map((head) => (
                              <th key={head} className="px-3 py-2 text-left">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, idx) => (
                            <tr key={`preview-${idx}`} className="border-t">
                              {headers.map((head) => (
                                <td key={`${idx}-${head}`} className="px-3 py-2">
                                  {formatPreviewValue(head, row?.[head])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {modalState === "ready" && (
                <>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-700">
                    {summary?.existingCount > 0 && normalizeCategory(category) === "users"
                      ? "No validation errors found. Existing users were detected and can be updated after confirmation."
                      : "No errors found. Ready to import."}
                  </div>
                  {summary && (
                    <div className="space-y-1 text-[11px] text-gray-500">
                      <div>{summary.validRows} rows verified for {summary.category}.</div>
                      {normalizeCategory(category) === "users" ? (
                        <div>
                          {summary.newCount || 0} new accounts, {summary.existingCount || 0} existing
                          accounts.
                        </div>
                      ) : null}
                    </div>
                  )}
                  {previewRows.length > 0 && (
                    <div className="rounded-lg border border-gray-100 overflow-auto">
                      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                        Preview (first 5 rows)
                      </div>
                      <table className="w-full text-[11px]">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            {headers.map((head) => (
                              <th key={head} className="px-3 py-2 text-left">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, idx) => (
                            <tr key={`preview-${idx}`} className="border-t">
                              {headers.map((head) => (
                                <td key={`${idx}-${head}`} className="px-3 py-2">
                                  {formatPreviewValue(head, row?.[head])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {modalState === "confirm-update" && (
                <>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800">
                    This upload contains existing user accounts. Confirming will update those
                    accounts using the CSV values.
                  </div>
                  <div className="space-y-1 text-[11px] text-gray-600">
                    <div>Category: {summary?.category || "Users"}</div>
                    <div>New accounts to insert: {summary?.newCount || 0}</div>
                    <div>Existing accounts to update: {summary?.existingCount || 0}</div>
                    <div>Passwords in the CSV will also replace existing passwords.</div>
                  </div>
                  {previewRows.length > 0 && (
                    <div className="rounded-lg border border-gray-100 overflow-auto">
                      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                        Preview (first 5 rows)
                      </div>
                      <table className="w-full text-[11px]">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            {headers.map((head) => (
                              <th key={head} className="px-3 py-2 text-left">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, idx) => (
                            <tr key={`preview-${idx}`} className="border-t">
                              {headers.map((head) => (
                                <td key={`${idx}-${head}`} className="px-3 py-2">
                                  {formatPreviewValue(head, row?.[head])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {modalState === "importing" && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-indigo-700">
                  Importing data, please keep this window open...
                </div>
              )}

              {modalState === "success" && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-700">
                  {summary?.category === "Users"
                    ? `Imported ${summary?.insertedCount || 0} new accounts and updated ${
                        summary?.updatedCount || 0
                      } existing accounts.`
                    : `Imported ${summary?.insertedCount || 0} items into ${
                        summary?.category || "inventory"
                      }.`}
                </div>
              )}

              {modalState === "error" && (
                <>
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700">
                    {message || "Something went wrong."}
                  </div>
                  {hasErrors && (
                    <>
                      <div className="text-[11px] text-gray-500">
                        Total errors: {errors.length}
                      </div>
                      <div className="max-h-56 overflow-auto rounded-lg border border-gray-100">
                        <table className="w-full text-[11px]">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Row</th>
                              <th className="px-3 py-2 text-left">Field</th>
                              <th className="px-3 py-2 text-left">Issue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {errors.map((err, idx) => (
                              <tr key={`${err.row || "row"}-${idx}`} className="border-t">
                                <td className="px-3 py-2">{err.row ?? "—"}</td>
                                <td className="px-3 py-2">{err.field ?? "—"}</td>
                                <td className="px-3 py-2">
                                  {err.message || "Invalid value"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  resetModal();
                  setFile(null);
                }}
                className="rounded-xl bg-gray-100 px-3 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-200"
              >
                Reupload
              </button>
              <div className="flex gap-2">
                {(modalState === "errors" || (modalState === "error" && hasErrors)) &&
                  errors.length > 0 && (
                  <button
                    type="button"
                    onClick={downloadErrorReport}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Download error report
                  </button>
                )}
                {modalState === "ready" && (
                  <button
                    type="button"
                    onClick={() =>
                      normalizeCategory(category) === "users" && (summary?.existingCount || 0) > 0
                        ? setModalState("confirm-update")
                        : importFile(false)
                    }
                    className="rounded-xl bg-gray-900 px-4 py-2 text-[11px] font-semibold text-white shadow hover:bg-black"
                  >
                    {normalizeCategory(category) === "users" && (summary?.existingCount || 0) > 0
                      ? "Review updates"
                      : "Proceed to import"}
                  </button>
                )}
                {modalState === "confirm-update" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setModalState("ready")}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => importFile(true)}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-[11px] font-semibold text-white shadow hover:bg-black"
                    >
                      Confirm update and import
                    </button>
                  </>
                )}
                {modalState === "success" && (
                  <button
                    type="button"
                    onClick={resetModal}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-[11px] font-semibold text-white shadow hover:bg-black"
                  >
                    Done
                  </button>
                )}
                {modalState === "validating" || modalState === "importing" ? null : (
                  <button
                    type="button"
                    onClick={resetModal}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
      </ModalShell>
    </>
  );
}
