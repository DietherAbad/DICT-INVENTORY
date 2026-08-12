// src/pages/Purchaseform.jsx
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { BASE_URL } from "../utils/config";
import ModalShell from "../components/ModalShell";
import { Link, useNavigate } from "react-router-dom";
import { useFormDraft } from "../utils/draft";
import { useProjects } from "../utils/projects";
import { useSmartItemPrefill } from "../utils/useSmartItemPrefill";
import { Purchaseformofficeequipment } from "./Purchaseformofficeequipment";
import { Purchaseformfurnitureandfixture } from "./Purchaseformofficefurnitureandfixture";
import { PurchaseformICTequipment } from "./PurchaseformofficeICTequipment";
import ThumbnailUploadField from "../components/ThumbnailUploadField";
import { useThumbnailUpload } from "../utils/useThumbnailUpload";
import { useUnsavedChangesWarning } from "../utils/useUnsavedChangesWarning";

function SuppliesForm({
  embedded = false,
  onReview,
  registerSubmit,
  onFormDataChange,
  onSubmitResult,
}) {
  /* ------------------------ state: navigation tabs ------------------------ */
  const [activeStatus, setActiveStatus] = useState(1);
  const navigate = useNavigate();

  const handleNavigation = (status) => {
    if (status === activeStatus) return;
    if (!confirmDiscard()) return;
    setActiveStatus(status);
    switch (status) {
      case 1:
        navigate("/purchaseform");
        break;
      case 2:
        navigate("/purchaseformEquip");
        break;
      case 3:
        navigate("/purchaseformFurniture");
        break;
      case 4:
        navigate("/purchaseformICT");
        break;
      case 5:
        navigate("/purchaseformLand");
        break;
      case 6:
        navigate("/purchaseformMotor");
        break;
      default:
        break;
    }
  };

  /* ------------------------ state: dropdowns & search ------------------------ */
  const [searchText, setSearchText] = useState("");
  const [isClassificationDropdownOpen, setIsClassificationDropdownOpen] =
    useState(false);
  const [isUnitMeasureDropdownOpen, setIsUnitMeasureDropdownOpen] =
    useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const searchInputRef = useRef(null);

  /* ------------------------ state: options ------------------------ */
  const [unitMeasureOptions, setUnitMeasureOptions] = useState([]);
  const [classificationOptions, setClassificationOptions] = useState([]);
  const { projects: projectOptions, activeSet: activeProjectSet } = useProjects();
  const normalizeProject = (value) => String(value || "").trim().toLowerCase();

  /* ------------------------ state: submission & feedback ------------------------ */
  const [isButtonClicked, setIsButtonClicked] = useState(false);
  const [showFieldErrorPopup, setShowFieldErrorPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [fieldErrorMessage, setFieldErrorMessage] = useState(
    "Please fill in all required fields."
  );
  const [successMessage, setSuccessMessage] = useState(
    "The entry has been saved successfully."
  );

  const {
    file: thumbnailFile,
    preview: thumbnailPreview,
    error: thumbnailError,
    setError: setThumbnailError,
    inputRef: thumbnailInputRef,
    handleChange: handleThumbnailChange,
    clear: clearThumbnail,
  } = useThumbnailUpload();

  const initialStockRef = useRef({
    classification: "",
    unitofmeasure: "",
    purchase_qty: 1,
    purchase_unit_cost: 0,
    itemName: "",
    date: new Date().toISOString().slice(0, 10),
    status: "Instock",
    stock_qty: 0,
    lowstock_threshold: 10,
    stock_unit_cost: 0,
    stock_total_cost: 0,
    purchase_total_cost: 0,
    distribution_qty: 0,
    distribution_unit_cost: 0,
    distribution_total_cost: 0,
    balance_qty: 0,
    balance_unit_cost: 0,
    balance_total_cost: 0,
    remarks: "",
    archive: false,
    project: "",
  });

  /* ------------------------ state: stock form ------------------------ */
  const [stock, setStock] = useState(() => ({
    ...(initialStockRef.current || {}),
  }));
  const [prefillNote, setPrefillNote] = useState("");
  const lastPrefillIdRef = useRef(null);

  /* ------------------------ RESTOCK: state ------------------------ */
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockSearch, setRestockSearch] = useState("");
  const [restockItems, setRestockItems] = useState([]);
  const [restockLoading, setRestockLoading] = useState(false);
  const [showArchivedRestock, setShowArchivedRestock] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isRestockMode, setIsRestockMode] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    const stockChanged =
      JSON.stringify(stock) !== JSON.stringify(initialStockRef.current || {});
    return (
      stockChanged ||
      isRestockMode ||
      Boolean(selectedItem) ||
      Boolean(String(restockSearch || "").trim()) ||
      Boolean(thumbnailFile)
    );
  }, [isRestockMode, restockSearch, selectedItem, stock, thumbnailFile]);

  const { confirmDiscard } = useUnsavedChangesWarning(
    hasUnsavedChanges && !isButtonClicked
  );

  const draftPayload = useMemo(
    () => ({ stock, isRestockMode }),
    [stock, isRestockMode]
  );
  const { clear: clearDraft } = useFormDraft(
    "draft:purchase:office-supplies",
    draftPayload,
    (draft) => {
      if (draft?.stock) {
        setStock((prev) => ({ ...prev, ...draft.stock }));
      }
      if (typeof draft?.isRestockMode === "boolean") {
        setIsRestockMode(draft.isRestockMode);
      }
    },
    { debounceMs: 800 }
  );

  useEffect(() => {
    if (!onFormDataChange) return;
    onFormDataChange({
      stock,
      isRestockMode,
      selectedItem,
    });
  }, [onFormDataChange, stock, isRestockMode, selectedItem]);

  const { suggestion: smartSuggestion, score: smartScore } = useSmartItemPrefill({
    endpoint: `${BASE_URL}/inventoryofficesupply/inventory`,
    query: stock.itemName,
    enabled: !isRestockMode,
  });

  /* ------------------------ effects: fetch dropdown data ------------------------ */
  useEffect(() => {
    const fetchClassificationOptions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/classification`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch classification options");
        const data = await res.json();
        const classifications = data
          .filter((item) => item.designation === "Office Supplies")
          .map((item) => item.description)
          .filter(Boolean);
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
        const unitMeasures = data
          .filter((item) => item.designation === "Office Supplies")
          .map((item) => item.description)
          .filter(Boolean);
        setUnitMeasureOptions(unitMeasures);
      } catch (error) {
        console.error("Error fetching unit measures:", error);
      }
    };
    fetchUnitMeasures();
  }, []);

  /* ------------------------ effects: classification dropdown focus ------------------------ */
  useEffect(() => {
    if (isClassificationDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isClassificationDropdownOpen]);

  /* ------------------------ effect: derive computed stock values ------------------------ */
  useEffect(() => {
    setStock((prevStock) => {
      const qty = Number(prevStock.purchase_qty) || 0;
      const unit = Number(prevStock.purchase_unit_cost) || 0;
      const total = qty * unit;

      return {
        ...prevStock,
        stock_unit_cost: unit,
        stock_total_cost: total,
        purchase_total_cost: total,
        balance_qty: qty,
        stock_qty: qty,
        balance_unit_cost: unit,
        balance_total_cost: total,
      };
    });
  }, [stock.purchase_qty, stock.purchase_unit_cost]);

  /* ------------------------ helpers ------------------------ */
  const handleInputChange = (field, value) => {
    setStock((prevStock) => ({
      ...prevStock,
      [field]: value,
    }));
  };

  const applySupplyPrefill = (item, { applyName = false } = {}) => {
    if (!item) return;
    setStock((prev) => {
      const next = { ...prev };
      if (!next.classification) next.classification = item.classification || "";
      if (!next.unitofmeasure) next.unitofmeasure = item.unitofmeasure || "";
      const predictedCost = Number(
        item.balance_unit_cost ?? item.purchase_unit_cost ?? item.stock_unit_cost ?? 0
      );
      if (!Number(next.purchase_unit_cost)) next.purchase_unit_cost = predictedCost;
      if (
        !next.project &&
        item.project &&
        activeProjectSet.has(normalizeProject(item.project))
      ) {
        next.project = item.project;
      }
      if (applyName && item.itemName) next.itemName = item.itemName;
      return next;
    });
    setPrefillNote(`Auto-filled from: ${item.itemName || "similar item"}.`);
    lastPrefillIdRef.current = item._id || item.itemName || null;
  };

  useEffect(() => {
    lastPrefillIdRef.current = null;
    setPrefillNote("");
  }, [stock.itemName]);

  useEffect(() => {
    if (!smartSuggestion) return;
    if (smartScore < 0.92) return;
    if (lastPrefillIdRef.current === (smartSuggestion._id || smartSuggestion.itemName))
      return;
    applySupplyPrefill(smartSuggestion);
  }, [smartSuggestion, smartScore]);

  const validateNewStock = () => {
    if (
      !stock.classification ||
      !stock.unitofmeasure ||
      !stock.itemName ||
      !stock.purchase_qty ||
      !stock.purchase_unit_cost ||
      !stock.date ||
      !stock.project
    ) {
      setFieldErrorMessage("Please fill in all required fields.");
      setShowFieldErrorPopup(true);
      return false;
    }
    const qty = toNumber(stock.purchase_qty, 0);
    const unitCost = toNumber(stock.purchase_unit_cost, 0);
    if (qty <= 0 || unitCost <= 0) {
      setFieldErrorMessage("Please enter a valid quantity and unit cost.");
      setShowFieldErrorPopup(true);
      return false;
    }
    if (!activeProjectSet.has(normalizeProject(stock.project))) {
      setFieldErrorMessage("Selected project is inactive. Please choose an active project.");
      setShowFieldErrorPopup(true);
      return false;
    }
    return true;
  };

  const validateRestock = () => {
    if (!selectedItem) {
      setFieldErrorMessage("Please select an item to restock.");
      setShowFieldErrorPopup(true);
      return false;
    }
    const qty = toNumber(stock.purchase_qty, 0);
    const unitCost = toNumber(stock.purchase_unit_cost, 0);
    if (qty <= 0 || unitCost <= 0 || !stock.date) {
      setFieldErrorMessage("Please enter a valid quantity, unit cost, and purchase date.");
      setShowFieldErrorPopup(true);
      return false;
    }
    return true;
  };

  const toNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const filterOptions = (options) =>
    options.filter((option) =>
      option.toLowerCase().includes(searchText.toLowerCase())
    );

  const closeAllDropdowns = () => {
    setIsClassificationDropdownOpen(false);
    setIsUnitMeasureDropdownOpen(false);
    setIsProjectDropdownOpen(false);
  };

  const toggleClassificationDropdown = () => {
    setIsClassificationDropdownOpen((prev) => !prev);
    setIsUnitMeasureDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    setSearchText("");
  };

  const toggleUnitMeasureDropdown = () => {
    setIsUnitMeasureDropdownOpen((prev) => !prev);
    setIsClassificationDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    setSearchText("");
  };

  const toggleProjectDropdown = () => {
    setIsProjectDropdownOpen((prev) => !prev);
    setIsClassificationDropdownOpen(false);
    setIsUnitMeasureDropdownOpen(false);
  };

  const handleCancel = () => {
    if (!confirmDiscard()) return;
    navigate("/officedashboard");
  };

  useEffect(() => {
    if (isRestockMode) {
      clearThumbnail();
      setThumbnailError("");
    }
  }, [isRestockMode, clearThumbnail, setThumbnailError]);

  const uploadThumbnail = async (itemId, file) => {
    const formData = new FormData();
    formData.append("thumbnail", file);
    const res = await fetch(
      `${BASE_URL}/inventoryofficesupply/inventory/${itemId}/thumbnail`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );
    if (!res.ok) {
      throw new Error("Failed to upload thumbnail.");
    }
    return res.json();
  };

  /* ------------------------ SUBMIT new purchase (original flow) ------------------------ */
  const handleStockinAndSubmission = async (e) => {
    e?.preventDefault?.();
    if (isRestockMode) return; // avoid mixing flows

    if (
      !stock.classification ||
      !stock.unitofmeasure ||
      !stock.itemName ||
      !stock.purchase_qty ||
      !stock.purchase_unit_cost ||
      !stock.date ||
      !stock.project
    ) {
      setFieldErrorMessage(
        "Please fill in all required fields before submitting."
      );
      setShowFieldErrorPopup(true);
      return;
    }
    const qty = toNumber(stock.purchase_qty, 0);
    const unitCost = toNumber(stock.purchase_unit_cost, 0);
    if (qty <= 0 || unitCost <= 0) {
      setFieldErrorMessage("Please enter a valid quantity and unit cost.");
      setShowFieldErrorPopup(true);
      return;
    }
    if (!activeProjectSet.has(normalizeProject(stock.project))) {
      setFieldErrorMessage("Selected project is inactive. Please choose an active project.");
      setShowFieldErrorPopup(true);
      return;
    }

    if (isButtonClicked) return;

    try {
      setIsButtonClicked(true);
      setSuccessMessage("The entry has been saved successfully.");
      setThumbnailError("");

      const initialQty = qty;
      const initialUnitCost = unitCost;
      const initialDate = stock.date;
      const initialHistory =
        initialQty > 0
          ? [
              {
                name: "System",
                history_qty: initialQty,
                unit_cost: initialUnitCost,
                date: initialDate,
                station: "Office Supplies",
                status: "Stock In",
                requeststatus: "",
                reference: "INITIAL STOCK",
                document_type: "STOCK",
                movement_type: "receipt",
                remarks: stock.remarks || "Initial stock",
              },
            ]
          : [];

      const res = await fetch(`${BASE_URL}/inventoryofficesupply/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...stock,
          purchase_qty: initialQty,
          purchase_unit_cost: initialUnitCost,
          lowstock_threshold: toNumber(stock.lowstock_threshold, 10),
          history: initialHistory,
        }),
      });

      if (!res.ok) {
        if (onSubmitResult) {
          onSubmitResult({
            ok: false,
            message: "Failed to save the entry. Please try again.",
          });
        } else {
          setShowErrorPopup(true);
        }
        return;
      }

      const result = await res.json();
      if (result && typeof result === "object") {
        let finalMessage = "The entry has been saved successfully.";
        if (thumbnailFile) {
          try {
            await uploadThumbnail(result._id, thumbnailFile);
          } catch (err) {
            finalMessage = "Entry saved, but thumbnail upload failed.";
          }
        }
        setSuccessMessage(finalMessage);
        clearDraft();
        clearThumbnail();
        if (onSubmitResult) {
          onSubmitResult({
            ok: true,
            message: finalMessage,
          });
        } else {
          setShowSuccessPopup(true);
        }
      } else {
        if (onSubmitResult) {
          onSubmitResult({
            ok: false,
            message: "Failed to save the entry. Please try again.",
          });
        } else {
          setShowErrorPopup(true);
        }
      }
    } catch (error) {
      console.error("Error processing request:", error);
      if (onSubmitResult) {
        onSubmitResult({
          ok: false,
          message: "An error occurred while saving. Please try again.",
        });
      } else {
        setShowErrorPopup(true);
      }
    } finally {
      setIsButtonClicked(false);
    }
  };

  /* ------------------------ RESTOCK: open modal and load items ------------------------ */
  const openRestock = async () => {
    try {
      setRestockOpen(true);
      setRestockLoading(true);
      setSelectedItem(null);
      setRestockSearch("");
      setShowArchivedRestock(false);
      const res = await fetch(`${BASE_URL}/inventoryofficesupply/inventory`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch supplies for restock.");
      const data = await res.json();
      setRestockItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setRestockLoading(false);
    }
  };

  const closeRestock = () => setRestockOpen(false);

  /* ------------------------ RESTOCK: picking an item autofills fields ------------------------ */
  const handlePickForRestock = (item) => {
    setSelectedItem(item);
    // Auto-fill all except Quantity and Purchase Date
    setStock((prev) => ({
      ...prev,
      classification: item.classification || "",
      unitofmeasure: item.unitofmeasure || item.unit || "",
      itemName: item.itemName || item.supplyName || "",
      purchase_unit_cost: toNumber(item.stock_unit_cost, 0),
      purchase_qty: "",
      date: new Date().toISOString().slice(0, 10),
      lowstock_threshold: toNumber(
        item.lowstock_threshold ?? prev.lowstock_threshold,
        10
      ),
      project: item.project || prev.project || "",
      status: "Instock",
    }));
  };

  /* ------------------------ RESTOCK: confirm via main button (after modal) ------------------------ */
  const handleConfirmRestock = async (e) => {
    e?.preventDefault?.();
    if (isButtonClicked) return;

    if (!selectedItem) {
      setFieldErrorMessage("Please select an item to restock.");
      setShowFieldErrorPopup(true);
      return;
    }

    const qty = Number(stock.purchase_qty || 0);
    const unitCost = Number(stock.purchase_unit_cost || 0);
    const dateStr = stock.date;

    if (!qty || qty <= 0 || !dateStr) {
      setFieldErrorMessage(
        "Please fill Quantity and Purchase date for the restock."
      );
      setShowFieldErrorPopup(true);
      return;
    }
    if (!unitCost || unitCost <= 0) {
      setFieldErrorMessage("Please enter a valid Unit cost for the restock.");
      setShowFieldErrorPopup(true);
      return;
    }

    try {
      setIsButtonClicked(true);

      const freshRes = await fetch(
        `${BASE_URL}/inventoryofficesupply/inventory/${selectedItem._id}`,
        { credentials: "include" }
      );
      if (!freshRes.ok) throw new Error("Failed to fetch selected item.");
      const current = await freshRes.json();

      const baseStockQty = toNumber(current.stock_qty, 0);
      const baseStockUnitCost = toNumber(current.stock_unit_cost, 0);
      const resolveTotalCost = (value, qtyValue, unitValue) => {
        if (value === undefined || value === null) return qtyValue * unitValue;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : qtyValue * unitValue;
      };
      const baseStockTotalCost = resolveTotalCost(
        current.stock_total_cost,
        baseStockQty,
        baseStockUnitCost
      );
      const basePurchaseQty = toNumber(current.purchase_qty, 0);
      const basePurchaseUnitCost = toNumber(current.purchase_unit_cost, 0);
      const basePurchaseTotalCost = resolveTotalCost(
        current.purchase_total_cost,
        basePurchaseQty,
        basePurchaseUnitCost
      );
      const baseBalanceQty = toNumber(current.balance_qty, 0);
      const baseBalanceUnitCost = toNumber(current.balance_unit_cost, 0);
      const baseBalanceTotalCost = resolveTotalCost(
        current.balance_total_cost,
        baseBalanceQty,
        baseBalanceUnitCost
      );

      const addCost = qty * unitCost;

      const nextStockQty = baseStockQty + qty;
      const nextStockTotalCost = baseStockTotalCost + addCost;
      const nextStockUnitCost =
        nextStockQty > 0 ? nextStockTotalCost / nextStockQty : unitCost;

      const nextPurchaseQty = basePurchaseQty + qty;
      const nextPurchaseTotalCost = basePurchaseTotalCost + addCost;
      const nextPurchaseUnitCost =
        nextPurchaseQty > 0 ? nextPurchaseTotalCost / nextPurchaseQty : unitCost;

      const nextBalanceQty = baseBalanceQty + qty;
      const nextBalanceTotalCost = baseBalanceTotalCost + addCost;
      const nextBalanceUnitCost =
        nextBalanceQty > 0 ? nextBalanceTotalCost / nextBalanceQty : unitCost;

      const body = {
        classification: current.classification || stock.classification,
        unitofmeasure: current.unitofmeasure || stock.unitofmeasure,
        itemName: current.itemName || stock.itemName,
        project: current.project || stock.project,
        status: "Instock",

        stock_qty: nextStockQty,
        stock_unit_cost: nextStockUnitCost,
        stock_total_cost: nextStockTotalCost,

        purchase_qty: nextPurchaseQty,
        purchase_unit_cost: nextPurchaseUnitCost,
        purchase_total_cost: nextPurchaseTotalCost,

        balance_qty: nextBalanceQty,
        balance_unit_cost: nextBalanceUnitCost,
        balance_total_cost: nextBalanceTotalCost,

        distribution_qty: Number(current.distribution_qty || 0),
        distribution_unit_cost: Number(current.distribution_unit_cost || 0),
        distribution_total_cost: Number(current.distribution_total_cost || 0),
        lowstock_threshold: toNumber(
          stock.lowstock_threshold ?? current.lowstock_threshold,
          10
        ),

        date: dateStr,
        remarks: stock.remarks || current.remarks || "Restocked",
        archive: !!current.archive,

        history: [
          ...(Array.isArray(current.history) ? current.history : []),
          {
            name: "System",
            history_qty: qty,
            unit_cost: unitCost,
            date: dateStr,
            station: "Office Supplies",
            status: "restock",
            requeststatus: "",
            reference: "RESTOCK",
            document_type: "STOCK",
            movement_type: "receipt",
            remarks: stock.remarks || "Restocked",
          },
        ],
        __v: current.__v,
      };

      const putRes = await fetch(
        `${BASE_URL}/inventoryofficesupply/inventory/${selectedItem._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );

      if (!putRes.ok) throw new Error("Failed to restock the item.");

      setIsRestockMode(false);
      setSelectedItem(null);
      clearDraft();
      if (onSubmitResult) {
        onSubmitResult({
          ok: true,
          message: "The restock has been saved successfully.",
        });
      } else {
        setShowSuccessPopup(true);
      }
    } catch (err) {
      console.error("Restock error:", err);
      if (onSubmitResult) {
        onSubmitResult({
          ok: false,
          message: "Failed to save the restock. Please try again.",
        });
      } else {
        setShowErrorPopup(true);
      }
    } finally {
      setIsButtonClicked(false);
    }
  };

  useEffect(() => {
    if (!registerSubmit) return;
    const submitFn = isRestockMode ? handleConfirmRestock : handleStockinAndSubmission;
    registerSubmit(submitFn);
  }, [registerSubmit, isRestockMode, handleConfirmRestock, handleStockinAndSubmission]);

  /* ------------------------ derived display ------------------------ */
  const purchaseTotalNumber = Number(stock.purchase_total_cost) || 0;
  const purchaseTotalDisplay = `₱ ${purchaseTotalNumber.toLocaleString(
    "en-PH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

  /* ------------------------ render ------------------------ */
  return (
    <div
      className={
        embedded
          ? "w-full"
          : "min-h-[calc(100vh-80px)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-2 pb-10"
      }
    >
      {/* Top: mobile select + desktop tabs */}
      {!embedded && (
        <div className="mb-4">
          {/* Mobile select */}
          <div className="sm:hidden relative w-11/12 mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="1.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <select
            aria-label="Selected tab"
            className="block w-full p-3 pr-10 rounded-lg bg-transparent text-gray-700 text-sm focus:outline-none"
            value={activeStatus}
            onChange={(e) => handleNavigation(Number(e.target.value))}
          >
            <option value={1}>Office Supplies</option>
            <option value={2}>Office Equipments</option>
            <option value={3}>Furniture & Fixtures</option>
            <option value={4}>ICT Equipments</option>
          </select>
        </div>

        {/* Desktop tabs */}
        <div className="hidden sm:block bg-white shadow-sm rounded-lg border border-gray-100">
          <div className="px-5 h-12 flex items-center overflow-x-auto">
            <ul className="flex items-center gap-4 text-sm">
              <li
                onClick={() => handleNavigation(1)}
                className={
                  activeStatus === 1
                    ? "px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                    : "px-4 py-2 text-gray-600 hover:text-indigo-700 cursor-pointer"
                }
              >
                {activeStatus === 1
                  ? "Office Supplies (Active)"
                  : "Office Supplies"}
              </li>
              <li
                onClick={() => handleNavigation(2)}
                className={
                  activeStatus === 2
                    ? "px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                    : "px-4 py-2 text-gray-600 hover:text-indigo-700 cursor-pointer"
                }
              >
                {activeStatus === 2
                  ? "Office Equipments (Active)"
                  : "Office Equipments"}
              </li>
              <li
                onClick={() => handleNavigation(3)}
                className={
                  activeStatus === 3
                    ? "px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                    : "px-4 py-2 text-gray-600 hover:text-indigo-700 cursor-pointer"
                }
              >
                {activeStatus === 3
                  ? "Furniture & Fixtures (Active)"
                  : "Furniture & Fixtures"}
              </li>
              <li
                onClick={() => handleNavigation(4)}
                className={
                  activeStatus === 4
                    ? "px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                    : "px-4 py-2 text-gray-600 hover:text-indigo-700 cursor-pointer"
                }
              >
                {activeStatus === 4
                  ? "ICT Equipments (Active)"
                  : "ICT Equipments"}
              </li>
            </ul>
          </div>
        </div>
      </div>
      )}

      {/* Main form card */}
      <div className={embedded ? "" : "px-2"}>
        <div className="flex flex-no-wrap items-start">
          <div className="w-full">
            <div className="px-2">
              <div className="bg-white/95 rounded-2xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-200/80 mt-6 pb-8 backdrop-blur">
                {/* Header */}
                <div className="px-7 pt-6 pb-4 border-b border-slate-200/70 flex flex-col gap-2 bg-gradient-to-r from-white via-white to-slate-50 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <svg
                        width={20}
                        height={20}
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current"
                      >
                        <path
                          d="M17.5 17.5V9.375"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2.5 9.375V17.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14.94 1.875H5.06C4.21 1.875 3.44 2.34375 3.11 3.06484L1.42 6.75781C0.85 8.00039 1.79 9.4082 3.26 9.45312C3.29 9.45312 3.31 9.45312 3.34 9.45312C4.57 9.45312 5.56 8.46953 5.56 7.41289C5.56 8.46758 6.55 9.45312 7.78 9.45312C9.01 9.45312 10 8.53984 10 7.41289C10 8.46758 10.99 9.45312 12.22 9.45312C13.45 9.45312 14.44 8.53984 14.44 7.41289C14.44 8.53984 15.44 9.45312 16.66 9.45312C16.69 9.45312 16.71 9.45312 16.74 9.45312C18.21 9.40742 19.15 7.99961 18.58 6.75781L16.89 3.06484C16.56 2.34375 15.79 1.875 14.94 1.875Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M1.25 18.125H18.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Purchase Office Supplies
                      </p>
                      <p className="text-xs text-slate-500">
                        Encode new office supply stocks for Region 2 Inventory.
                      </p>
                    </div>
                  </div>

                  {/* Restock banner when active */}
                  {isRestockMode && selectedItem && (
                    <div className="mt-3 rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-2 text-xs">
                      Restocking:{" "}
                      <span className="font-semibold">
                        {selectedItem.itemName || "Selected item"}
                      </span>{" "}
                      • Unit:{" "}
                      {selectedItem.unitofmeasure ||
                        selectedItem.unit ||
                        "—"}{" "}
                      • Current Stock: {selectedItem.stock_qty ?? 0}
                    </div>
                  )}
                </div>

                {embedded && (
                  <div className="px-7 pt-5">
                    <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRestockMode(false);
                          setSelectedItem(null);
                        }}
                        className={`px-4 py-1.5 rounded-full transition ${
                          !isRestockMode
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        New stock
                      </button>
                      <button
                        type="button"
                        onClick={openRestock}
                        className={`px-4 py-1.5 rounded-full transition ${
                          isRestockMode
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Restock existing
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      Choose whether you are adding a brand-new supply or replenishing an
                      existing item.
                    </p>
                  </div>
                )}

                {/* Form body */}
                <div className="mt-6 px-7">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Purchase Details
                  </p>

                  <div className="grid w-full grid-cols-1 lg:grid-cols-2 gap-7 mt-6">
                    {/* Classification */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Classification <span className="text-red-500">*</span>
                      </p>
                      <div className="relative mt-2">
                        <div className="relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/80">
                          <button
                            type="button"
                            onClick={toggleClassificationDropdown}
                            className="relative flex items-center justify-between w-full px-5 py-4 text-base text-slate-600"
                          >
                            <span>
                              {stock.classification || "Select classification"}
                            </span>
                            <svg
                              className={`h-3 w-3 text-gray-500 transition-transform ${
                                isClassificationDropdownOpen
                                  ? "rotate-180"
                                  : ""
                              }`}
                              viewBox="0 0 10 6"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M0.5 0.75L5 5.25L9.5 0.75"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div
                            className={`absolute left-0 right-0 top-11 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 ${
                              isClassificationDropdownOpen ? "" : "hidden"
                            }`}
                          >
                            <input
                              ref={searchInputRef}
                              type="text"
                              className="w-full px-4 py-2.5 mb-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              placeholder="Search classification..."
                              value={searchText}
                              onChange={(e) =>
                                setSearchText(e.target.value)
                              }
                            />
                            <div className="max-h-48 overflow-y-auto">
                              {filterOptions(
                                classificationOptions
                              ).map((option, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange(
                                      "classification",
                                      option
                                    );
                                    closeAllDropdowns();
                                  }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-700"
                              >
                                {option}
                              </button>
                            ))}
                              {filterOptions(classificationOptions).length ===
                                0 && (
                                <div className="px-3 py-2 text-[10px] text-gray-400">
                                  No results found.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        If not found, create a classification in Settings.
                      </p>
                    </div>

                    {/* Unit of measure */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Unit of measure{" "}
                        <span className="text-red-500">*</span>
                      </p>
                      <div className="relative mt-2">
                        <div className="relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/80">
                          <button
                            type="button"
                            onClick={toggleUnitMeasureDropdown}
                            className="relative flex items-center justify-between w-full px-5 py-4 text-base text-slate-600"
                          >
                            <span>
                              {stock.unitofmeasure ||
                                "Select unit of measure"}
                            </span>
                            <svg
                              className={`h-3 w-3 text-gray-500 transition-transform ${
                                isUnitMeasureDropdownOpen
                                  ? "rotate-180"
                                  : ""
                              }`}
                              viewBox="0 0 10 6"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M0.5 0.75L5 5.25L9.5 0.75"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div
                            className={`absolute left-0 right-0 top-11 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 ${
                              isUnitMeasureDropdownOpen ? "" : "hidden"
                            }`}
                          >
                            <div className="max-h-48 overflow-y-auto">
                              {filterOptions(
                                unitMeasureOptions
                              ).map((option, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange(
                                      "unitofmeasure",
                                      option
                                    );
                                    closeAllDropdowns();
                                  }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-700"
                              >
                                {option}
                              </button>
                            ))}
                              {filterOptions(unitMeasureOptions).length ===
                                0 && (
                                <div className="px-3 py-2 text-[10px] text-gray-400">
                                  No unit of measure found.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        If not found, create a unit of measure in Settings.
                      </p>
                    </div>

                    {/* Purchase Date */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Purchase date{" "}
                        <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="date"
                        className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={stock.date}
                        onChange={(e) =>
                          handleInputChange("date", e.target.value)
                        }
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Quantity <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="number"
                        min="1"
                        className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={stock.purchase_qty}
                        onChange={(e) =>
                          handleInputChange(
                            "purchase_qty",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    {/* Low stock threshold */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Low stock threshold
                      </p>
                      <input
                        type="number"
                        min="0"
                        className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={stock.lowstock_threshold}
                        onChange={(e) =>
                          handleInputChange("lowstock_threshold", e.target.value)
                        }
                      />
                      <p className="mt-2 text-[11px] text-slate-400">
                        Alert when stock quantity is at or below this value.
                      </p>
                    </div>

                    {/* Unit cost */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Unit cost <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="₱ ..."
                        className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={stock.purchase_unit_cost}
                        onChange={(e) =>
                          handleInputChange(
                            "purchase_unit_cost",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    {/* Total cost (auto) */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Total cost (auto)
                      </p>
                      <input
                        type="text"
                        readOnly
                        className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-100 px-5 py-4 text-base text-slate-600"
                        value={purchaseTotalDisplay}
                      />
                      <p className="mt-2 text-[11px] text-slate-400">
                        Computed as Quantity × Unit cost.
                      </p>
                    </div>

                    {/* Project */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Project <span className="text-red-500">*</span>
                      </p>
                      <div className="relative mt-2">
                        <div className="relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/80">
                          <button
                            type="button"
                            onClick={toggleProjectDropdown}
                            className="relative flex items-center justify-between w-full px-5 py-4 text-base text-slate-600"
                          >
                            <span>{stock.project || "Select project"}</span>
                            <svg
                              className={`h-3 w-3 text-gray-500 transition-transform ${
                                isProjectDropdownOpen ? "rotate-180" : ""
                              }`}
                              viewBox="0 0 10 6"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M0.5 0.75L5 5.25L9.5 0.75"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div
                            className={`absolute left-0 right-0 top-11 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 ${
                              isProjectDropdownOpen ? "" : "hidden"
                            }`}
                          >
                            <div className="max-h-48 overflow-y-auto">
                              {projectOptions.map((option, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange("project", option);
                                    closeAllDropdowns();
                                  }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-700"
                              >
                                {option}
                              </button>
                            ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        If not found, add the project in Settings → Projects.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Item Description */}
                <div className="pt-6 mt-2 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Item name / description{" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <input
                    placeholder="Start typing full product description/model..."
                    className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.itemName}
                    onChange={(e) =>
                      handleInputChange("itemName", e.target.value)
                    }
                  />
                  {smartSuggestion && !isRestockMode && (
                    <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-700">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          Suggested match:{" "}
                          <b>{smartSuggestion.itemName || "Unnamed item"}</b>
                        </span>
                        <button
                          type="button"
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700"
                          onClick={() =>
                            applySupplyPrefill(smartSuggestion, { applyName: true })
                          }
                        >
                          Use suggestion
                        </button>
                      </div>
                      <div className="mt-1 text-[10px] text-indigo-600">
                        Auto-fills classification, unit, and cost when empty.
                      </div>
                    </div>
                  )}
                  {prefillNote && (
                    <p className="mt-2 text-[11px] text-emerald-600">
                      {prefillNote}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">
                    Use a clear, complete description to help tracking and
                    reports.
                  </p>
                </div>

                {!isRestockMode && (
                  <ThumbnailUploadField
                    file={thumbnailFile}
                    preview={thumbnailPreview}
                    error={thumbnailError}
                    inputRef={thumbnailInputRef}
                    onChange={handleThumbnailChange}
                    onClear={() => {
                      clearThumbnail();
                      setThumbnailError("");
                    }}
                  />
                )}

                {/* Remarks */}
                <div className="pt-4 mt-1 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Remarks
                  </p>
                  <input
                    placeholder="Optional notes or references (e.g. PO #, supplier)..."
                    className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.remarks}
                    onChange={(e) =>
                      handleInputChange("remarks", e.target.value)
                    }
                  />
                </div>

                {/* Actions */}
                <hr className="h-px bg-gray-100 mt-6 mb-4 mx-7" />
                <div className="flex flex-col lg:flex-row lg:justify-end md:justify-end items-center gap-3 px-7 pb-2">
                  {embedded ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (isRestockMode ? !validateRestock() : !validateNewStock()) {
                          return;
                        }
                        if (onReview) {
                          onReview();
                          return;
                        }
                        if (isRestockMode) {
                          handleConfirmRestock();
                        } else {
                          handleStockinAndSubmission();
                        }
                      }}
                      className="inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm transition w-full lg:w-auto bg-slate-900 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isButtonClicked}
                    >
                      {isButtonClicked
                        ? "Preparing..."
                        : isRestockMode
                        ? "Review Restock"
                        : "Review Details"}
                    </button>
                  ) : (
                    <>
                      {/* Primary action switches depending on mode */}
                      {!isRestockMode ? (
                        <button
                          type="button"
                          onClick={handleStockinAndSubmission}
                          disabled={isButtonClicked}
                          className={
                            "inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm transition w-full lg:w-auto " +
                            (isButtonClicked
                              ? "bg-indigo-300 cursor-not-allowed"
                              : "bg-indigo-700 hover:bg-indigo-600")
                          }
                        >
                          {isButtonClicked ? "Submitting..." : "Submit"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleConfirmRestock}
                          disabled={isButtonClicked}
                          className={
                            "inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm transition w-full lg:w-auto " +
                            (isButtonClicked
                              ? "bg-green-300 cursor-not-allowed"
                              : "bg-green-600 hover:bg-green-700")
                          }
                        >
                          {isButtonClicked ? "Processing..." : "Confirm Restock"}
                        </button>
                      )}

                      {/* Open restock modal (hidden when already in restock mode) */}
                      {!isRestockMode && (
                        <button
                          type="button"
                          onClick={openRestock}
                          className="inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold border border-green-700 text-green-700 bg-white hover:bg-green-50 transition w-full lg:w-auto"
                        >
                          Restock existing item
                        </button>
                      )}

                      {/* Cancel restock when in restock mode */}
                      {isRestockMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsRestockMode(false);
                            setSelectedItem(null);
                          }}
                          className="inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition w-full lg:w-auto"
                        >
                          Cancel Restock
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCancel}
                        className="inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold border border-indigo-700 text-indigo-700 bg-white hover:bg-gray-50 transition w-full lg:w-auto"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RESTOCK MODAL */}
      <ModalShell
        open={restockOpen}
        title="Restock existing supply"
        subtitle="Supply Restock"
        variant="neutral"
        onClose={closeRestock}
        maxWidthClass="max-w-3xl"
      >
            <div className="space-y-3">
              <div className="relative">
                <input
                  value={restockSearch}
                  onChange={(e) => setRestockSearch(e.target.value)}
                  placeholder="Search existing items by name, classification, unit…"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={showArchivedRestock}
                    onChange={(e) => setShowArchivedRestock(e.target.checked)}
                  />
                  Show archived items
                </label>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {restockLoading ? (
                  <div className="p-4 text-sm text-slate-500">
                    Loading items…
                  </div>
                ) : restockItems.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    No items found.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">
                          Classification
                        </th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-right">Stock Qty</th>
                        <th className="px-3 py-2 text-right">Unit Cost</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {restockItems
                        .filter((it) => (showArchivedRestock ? true : !it.archive))
                        .filter((it) => {
                          const q = restockSearch.trim().toLowerCase();
                          if (!q) return true;
                          const fields = [
                            it.itemName,
                            it.classification,
                            it.unitofmeasure,
                            it.project,
                          ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();
                          return fields.includes(q);
                        })
                        .map((it) => (
                          (() => {
                            const isNegativeBalance = Number(it.balance_qty || 0) < 0;
                            return (
                          <tr
                            key={it._id}
                            className={
                              "border-t border-gray-100 " +
                              (selectedItem?._id === it._id
                                ? "bg-green-50"
                                : isNegativeBalance
                                ? "bg-rose-50"
                                : "bg-white")
                            }
                          >
                            <td className="px-3 py-2">
                              {it.itemName || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {it.classification || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {it.unitofmeasure || it.unit || "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span>{it.stock_qty ?? 0}</span>
                                {isNegativeBalance && (
                                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                    Needs repair
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {Number(it.stock_unit_cost || 0).toLocaleString(
                                "en-PH",
                                {
                                  style: "currency",
                                  currency: "PHP",
                                }
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => {
                                  if (isNegativeBalance) {
                                    setFieldErrorMessage(
                                      "This item has a negative balance and cannot be restocked."
                                    );
                                    setShowFieldErrorPopup(true);
                                    return;
                                  }
                                  handlePickForRestock(it);
                                }}
                                className={
                                  "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold border " +
                                  (selectedItem?._id === it._id
                                    ? "border-green-700 text-green-800 bg-green-50"
                                    : isNegativeBalance
                                    ? "border-rose-300 text-rose-500 bg-rose-50 cursor-not-allowed"
                                    : "border-green-600 text-green-700 bg-white hover:bg-green-50")
                                }
                                disabled={isNegativeBalance}
                              >
                                {selectedItem?._id === it._id
                                  ? "Selected"
                                  : isNegativeBalance
                                  ? "Blocked"
                                  : "Select"}
                              </button>
                            </td>
                          </tr>
                            );
                          })()
                        ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={closeRestock}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!selectedItem) {
                      setFieldErrorMessage(
                        "Please select an item to restock."
                      );
                      setShowFieldErrorPopup(true);
                      return;
                    }
                    // Exit modal and enable confirm flow
                    setRestockOpen(false);
                    setIsRestockMode(true);
                  }}
                  disabled={!selectedItem}
                  className={
                    "rounded-full px-5 py-2 text-sm font-semibold text-white " +
                    (!selectedItem
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-slate-900 hover:bg-slate-800")
                  }
                >
                  Restock now
                </button>
              </div>

              <p className="text-[11px] text-gray-500">
                Tip: Pick an item to auto-fill fields. Then enter{" "}
                <b>Quantity</b> and <b>Purchase date</b>, adjust unit
                cost/remarks if needed, and click <b>Confirm Restock</b>.
              </p>
            </div>
      </ModalShell>

      {/* Success Popup */}
      <ModalShell
        open={showSuccessPopup}
        title="Success"
        subtitle="Purchase Entry"
        variant="neutral"
        onClose={() => setShowSuccessPopup(false)}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            ✓
          </div>
          <p className="text-sm text-slate-600">
            {successMessage}
          </p>
          <button
            type="button"
            onClick={() => {
              setShowSuccessPopup(false);
              navigate("/officedashboard");
            }}
            className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to Dashboard
          </button>
        </div>
      </ModalShell>

      {/* Error Popup */}
      <ModalShell
        open={showErrorPopup}
        title="Action Failed"
        subtitle="Purchase Entry"
        variant="danger"
        onClose={() => setShowErrorPopup(false)}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            !
          </div>
          <p className="text-sm text-slate-600">
            An error occurred while saving. Please try again.
          </p>
          <button
            type="button"
            onClick={() => setShowErrorPopup(false)}
            className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </ModalShell>

      {/* Field Error Popup */}
      <ModalShell
        open={showFieldErrorPopup}
        title="Incomplete Fields"
        subtitle="Purchase Entry"
        variant="warning"
        onClose={() => setShowFieldErrorPopup(false)}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            !
          </div>
          <p className="text-sm text-slate-600">{fieldErrorMessage}</p>
          <button
            type="button"
            onClick={() => setShowFieldErrorPopup(false)}
            className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </ModalShell>
    </div>
  );
}

const PURCHASE_TYPES = [
  {
    key: "supplies",
    title: "Office Supplies",
    description: "Consumables, stationery, and common office supplies.",
  },
  {
    key: "equipment",
    title: "Office Equipment",
    description: "Property and equipment for offices and workstations.",
  },
  {
    key: "ict",
    title: "ICT Equipment",
    description: "Devices, peripherals, and technology assets.",
  },
  {
    key: "furniture",
    title: "Furniture & Fixtures",
    description: "Tables, chairs, shelves, and fixtures.",
  },
];

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `₱ ${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const buildReviewRows = (payload, typeKey) => {
  if (!payload || !payload.stock) return [];
  const { stock, isRestockMode, selectedItem } = payload;

  if (typeKey === "supplies") {
    return [
      ["Mode", isRestockMode ? "Restock existing" : "New stock"],
      ["Restocking item", selectedItem?.itemName || "—"],
      ["Item name", stock.itemName],
      ["Classification", stock.classification],
      ["Unit of measure", stock.unitofmeasure],
      ["Quantity", stock.purchase_qty],
      ["Unit cost", formatCurrency(stock.purchase_unit_cost)],
      ["Total cost", formatCurrency(stock.purchase_total_cost)],
      ["Purchase date", stock.date],
      ["Project", stock.project],
      ["Low stock threshold", stock.lowstock_threshold],
      ["Remarks", stock.remarks],
    ];
  }

  const rows = [
    ["Item name", stock.itemName],
    ["Classification", stock.classification],
    ["Unit of measure", stock.unitofmeasure],
    ["Quantity", stock.qty],
    ["Unit cost", formatCurrency(stock.unit_cost)],
    ["Total cost", formatCurrency(stock.total_cost)],
    ["Date acquired", stock.date_acquired],
    ["Project", stock.project],
    ["Issued to", stock.issued_to],
    ["Stored to", stock.stored_to],
    ["Serial no.", stock.serial_no],
    ["Batch no.", stock.batch_no],
    ["Remarks", stock.remarks],
  ];

  if (stock.inclusions) {
    rows.push(["Inclusions", stock.inclusions]);
  }
  return rows;
};

export function Purchaseform() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [submitReady, setSubmitReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitModal, setSubmitModal] = useState({
    open: false,
    ok: true,
    message: "",
  });
  const submitRef = useRef(null);
  const submitHandledRef = useRef(false);

  const resetToStart = useCallback(() => {
    setStep(1);
    setSelectedType(null);
    setReviewData(null);
    submitRef.current = null;
    setSubmitReady(false);
  }, []);

  const handleSubmitResult = useCallback((result) => {
    submitHandledRef.current = true;
    setSubmitModal({
      open: true,
      ok: result?.ok !== false,
      message:
        result?.message ||
        (result?.ok === false
          ? "Failed to save the entry. Please try again."
          : "The entry has been saved successfully."),
    });
  }, []);

  const registerSubmit = useCallback((fn) => {
    submitRef.current = fn;
    setSubmitReady(Boolean(fn));
  }, []);

  const handleSelect = useCallback((key) => {
    setSelectedType(key);
    setReviewData(null);
    submitRef.current = null;
    setSubmitReady(false);
    setStep(2);
  }, []);

  const handleReview = useCallback(() => {
    setStep(3);
  }, []);

  const handleBack = useCallback(() => {
    setStep((prev) => (prev > 1 ? prev - 1 : prev));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!submitRef.current || isSubmitting) return;
    setIsSubmitting(true);
    submitHandledRef.current = false;
    try {
      const result = await submitRef.current();
      if (!submitHandledRef.current) {
        if (result && result.ok === false) {
          handleSubmitResult({ ok: false, message: result.message });
        } else if (result === false) {
          handleSubmitResult({ ok: false });
        } else if (result && typeof result === "object" && "ok" in result) {
          handleSubmitResult({ ok: Boolean(result.ok), message: result.message });
        } else {
          handleSubmitResult({ ok: true });
        }
      }
    } catch (error) {
      if (!submitHandledRef.current) {
        handleSubmitResult({
          ok: false,
          message: error?.message || "Failed to save the entry. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSubmitResult, isSubmitting]);

  useEffect(() => {
    if (step > 1 && !selectedType) {
      setStep(1);
    }
  }, [step, selectedType]);

  const progressPercent = step === 1 ? 30 : step === 2 ? 65 : 100;

  const activeTypeLabel =
    PURCHASE_TYPES.find((item) => item.key === selectedType)?.title || "Stock";

  const rows = buildReviewRows(reviewData, selectedType);

  return (
    <div className="w-full min-h-[calc(100vh-140px)] bg-gradient-to-b from-slate-50 via-white to-blue-50 px-2 sm:px-4 pb-10">
      <div className="mx-auto w-full max-w-none">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-600">
            Step {step} of 3
          </span>
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              <span className="text-base">←</span>
              Back
            </button>
          )}
        </div>

        <div className="mt-4 text-center">
          <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <Link to="/" className="text-blue-600 hover:text-blue-700">
              Dashboard
            </Link>
            <span className="mx-2 text-slate-300">/</span>
            <span>{step === 1 ? "Stock Entry" : activeTypeLabel}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-light text-slate-900">
            {step === 1 && (
              <>
                Choose <span className="font-semibold">What to Add</span>
              </>
            )}
            {step === 2 && (
              <>
                {activeTypeLabel}{" "}
                <span className="font-semibold">Details</span>
              </>
            )}
            {step === 3 && (
              <>
                Review{" "}
                <span className="font-semibold">Before Submitting</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {step === 1 &&
              "Select a category to start adding stock entries."}
            {step === 2 &&
              "Provide the information required for this inventory entry."}
            {step === 3 &&
              "Confirm the details below, then proceed to save the record."}
          </p>

          <div className="mt-6 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PURCHASE_TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelect(item.key)}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-100/60 blur-2xl" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-500">
                  Category
                </p>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {item.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                  Start entry
                  <span aria-hidden="true">→</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedType && step !== 1 && (
          <div className={`mt-10 ${step === 3 ? "hidden" : ""}`}>
            {selectedType === "supplies" && (
              <SuppliesForm
                embedded
                onReview={handleReview}
                registerSubmit={registerSubmit}
                onSubmitResult={handleSubmitResult}
                onFormDataChange={(payload) =>
                  setReviewData({ ...payload, type: "supplies" })
                }
              />
            )}
            {selectedType === "equipment" && (
              <Purchaseformofficeequipment
                embedded
                onReview={handleReview}
                registerSubmit={registerSubmit}
                onSubmitResult={handleSubmitResult}
                onFormDataChange={(payload) =>
                  setReviewData({ ...payload, type: "equipment" })
                }
              />
            )}
            {selectedType === "furniture" && (
              <Purchaseformfurnitureandfixture
                embedded
                onReview={handleReview}
                registerSubmit={registerSubmit}
                onSubmitResult={handleSubmitResult}
                onFormDataChange={(payload) =>
                  setReviewData({ ...payload, type: "furniture" })
                }
              />
            )}
            {selectedType === "ict" && (
              <PurchaseformICTequipment
                embedded
                onReview={handleReview}
                registerSubmit={registerSubmit}
                onSubmitResult={handleSubmitResult}
                onFormDataChange={(payload) =>
                  setReviewData({ ...payload, type: "ict" })
                }
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <h2 className="text-[18px] font-semibold text-slate-900">
                {activeTypeLabel} Summary
              </h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Review the entry details before submitting.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {rows.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No data captured yet. Go back to complete the form.
                  </p>
                ) : (
                  rows.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                    >
                      <p className="text-[11px] font-medium tracking-[0.08em] text-slate-600">
                        {label}
                      </p>
                      <p className="mt-2 text-[14px] font-semibold text-slate-900">
                        {formatValue(value)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-900/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-[0_30px_70px_rgba(15,23,42,0.45)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-blue-200/80">
                Final Step
              </p>
              <h3 className="mt-4 text-2xl font-semibold">
                Ready to submit?
              </h3>
              <p className="mt-2 text-sm text-blue-100/70">
                The system will save this entry to the inventory once you
                confirm.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!submitReady || isSubmitting}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting..." : "Submit Entry"}
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-blue-100 hover:border-blue-300/40"
                >
                  Back to edit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModalShell
        open={submitModal.open}
        title={submitModal.ok ? "Success" : "Action Failed"}
        subtitle="Purchase Entry"
        variant={submitModal.ok ? "neutral" : "danger"}
        onClose={() => {
          setSubmitModal((prev) => ({ ...prev, open: false }));
          resetToStart();
        }}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4 text-center">
          <div
            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${
              submitModal.ok ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {submitModal.ok ? "✓" : "!"}
          </div>
          <p className="text-sm text-slate-600">{submitModal.message}</p>
          <button
            type="button"
            onClick={() => {
              setSubmitModal((prev) => ({ ...prev, open: false }));
              resetToStart();
            }}
            className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to start
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
