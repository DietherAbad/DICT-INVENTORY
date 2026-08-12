import React, { useMemo, useState, useRef, useEffect } from "react";
import { BASE_URL } from "../utils/config";
import ModalShell from "../components/ModalShell";
import { useNavigate } from "react-router-dom";
import { useFormDraft } from "../utils/draft";
import { useProjects } from "../utils/projects";
import { useDesignations } from "../utils/designations";
import ThumbnailUploadField from "../components/ThumbnailUploadField";
import { useThumbnailUpload } from "../utils/useThumbnailUpload";
import { useSmartItemPrefill } from "../utils/useSmartItemPrefill";
import { useUnsavedChangesWarning } from "../utils/useUnsavedChangesWarning";

export function PurchaseformICTequipment({
  embedded = false,
  onReview,
  registerSubmit,
  onFormDataChange,
  onSubmitResult,
}) {
  /* ------------------------ navigation tabs ------------------------ */
  const [activeStatus, setActiveStatus] = useState(4);
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

  /* ------------------------ dropdown & UI state ------------------------ */
  const [searchText, setSearchText] = useState("");
  const [isClassificationDropdownOpen, setIsClassificationDropdownOpen] =
    useState(false);
  const [isUnitMeasureDropdownOpen, setIsUnitMeasureDropdownOpen] =
    useState(false);
  const [isIssuedToDropdownOpen, setIsIssuedToDropdownOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isStoredToDropdownOpen, setIsStoredToDropdownOpen] = useState(false);

  // stored_to UI: presets + custom toggle
  const [storedSearch, setStoredSearch] = useState("");
  const [useCustomStoredTo, setUseCustomStoredTo] = useState(false);

  const [isButtonClicked, setIsButtonClicked] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showFieldErrorPopup, setShowFieldErrorPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState(
    "Your ICT equipment record has been saved."
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
  const showThumbnailField = false;

  const initialStockRef = useRef({
    classification: "",
    unitofmeasure: "",
    qty: 1,
    unit_cost: 0,
    itemName: "",
    date_acquired: new Date().toISOString().slice(0, 10),
    status: "In Stock",
    total_cost: 0,
    remarks: "",
    archive: false,
    issued_to: "",
    inclusions: "",
    specifications: "",
    stored_to: "DICT Region 2",
    date_issued: "",
    serial_no: "",
    batch_no: "",
    project: "",
  });

  const searchInputRef = useRef(null);

  /* ------------------------ options ------------------------ */
  const [unitMeasureOptions, setUnitMeasureOptions] = useState([]);
  const [classificationOptions, setClassificationOptions] = useState([]);
  const [issuedToOptions, setIssuedToOptions] = useState([]); // [{_id, username, position}]
  const { projects: projectOptions, activeSet: activeProjectSet } = useProjects();
  const { designations: storedToOptions } = useDesignations();
  const normalizeProject = (value) => String(value || "").trim().toLowerCase();

  /* ------------------------ stock form ------------------------ */
  const [stock, setStock] = useState(() => ({
    ...(initialStockRef.current || {}),
  }));
  const [prefillNote, setPrefillNote] = useState("");
  const lastPrefillIdRef = useRef(null);

  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify(stock) !== JSON.stringify(initialStockRef.current || {}) ||
      Boolean(thumbnailFile),
    [stock, thumbnailFile]
  );

  const { confirmDiscard } = useUnsavedChangesWarning(
    hasUnsavedChanges && !isButtonClicked
  );

  const draftPayload = useMemo(() => ({ stock }), [stock]);
  const { clear: clearDraft } = useFormDraft(
    "draft:purchase:office-ict",
    draftPayload,
    (draft) => {
      if (draft?.stock) {
        setStock((prev) => ({ ...prev, ...draft.stock }));
      }
    },
    { debounceMs: 800 }
  );

  useEffect(() => {
    if (!onFormDataChange) return;
    onFormDataChange({ stock });
  }, [onFormDataChange, stock]);

  const { suggestion: smartSuggestion, score: smartScore } = useSmartItemPrefill({
    endpoint: `${BASE_URL}/inventoryofficeICTequipment/inventory`,
    query: stock.itemName,
  });

  /* ------------------------ fetch classification ------------------------ */
  useEffect(() => {
    const fetchClassificationOptions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/classification`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch classification options");
        const data = await res.json();
        const classifications = data
          .filter((item) => item.designation === "ICT Equipments")
          .map((item) => item.description)
          .filter(Boolean);
        setClassificationOptions(classifications);
      } catch (error) {
        console.error("Error fetching classification options:", error);
      }
    };
    fetchClassificationOptions();
  }, []);

  /* ------------------------ fetch unit measures ------------------------ */
  useEffect(() => {
    const fetchUnitMeasures = async () => {
      try {
        const res = await fetch(`${BASE_URL}/measure`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch unit measures");
        const data = await res.json();
        const descriptions = data
          .filter((item) => item.designation === "ICT Equipments")
          .map((item) => item.description)
          .filter(Boolean);
        setUnitMeasureOptions(descriptions);
      } catch (error) {
        console.error("Error fetching unit measures:", error);
      }
    };
    fetchUnitMeasures();
  }, []);

  /* ------------------------ fetch issued-to users (everyone) ------------------------ */
  useEffect(() => {
    const fetchIssuedToOptions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/users`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch issued to options");
        const data = await res.json();

        // Map everyone; include position for display
        setIssuedToOptions(
          data.map((u) => ({
            _id: u._id,
            username: u.username,
            position: u.position || "",
          }))
        );
      } catch (error) {
        console.error("Error fetching issued to options:", error);
      }
    };
    fetchIssuedToOptions();
  }, []);

  /* ------------------------ effects: focus & derived values ------------------------ */

  // Focus search when classification dropdown opens
  useEffect(() => {
    if (isClassificationDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isClassificationDropdownOpen]);

  // Auto total_cost when qty/unit_cost change
  useEffect(() => {
    setStock((prev) => {
      const qty = Number(prev.qty) || 0;
      const unit = Number(prev.unit_cost) || 0;
      return {
        ...prev,
        total_cost: qty * unit,
      };
    });
  }, [stock.qty, stock.unit_cost]);

  /* ------------------------ helpers ------------------------ */

  const handleInputChange = (field, value) => {
    setStock((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const filterOptions = (options) =>
    options.filter((option) =>
      option.toLowerCase().includes(searchText.toLowerCase())
    );

  const closeAllDropdowns = () => {
    setIsClassificationDropdownOpen(false);
    setIsUnitMeasureDropdownOpen(false);
    setIsIssuedToDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    setIsStoredToDropdownOpen(false);
  };

  const toggleClassificationDropdown = () => {
    setIsClassificationDropdownOpen((prev) => !prev);
    setIsUnitMeasureDropdownOpen(false);
    setIsIssuedToDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    setIsStoredToDropdownOpen(false);
    setSearchText("");
  };

  const toggleUnitMeasureDropdown = () => {
    setIsUnitMeasureDropdownOpen((prev) => !prev);
    setIsClassificationDropdownOpen(false);
    setIsIssuedToDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    setIsStoredToDropdownOpen(false);
  };

  const toggleIssuedToDropdown = () => {
    setIsIssuedToDropdownOpen((prev) => !prev);
    setIsClassificationDropdownOpen(false);
    setIsUnitMeasureDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    setIsStoredToDropdownOpen(false);
  };

  const toggleProjectDropdown = () => {
    setIsProjectDropdownOpen((prev) => !prev);
    setIsClassificationDropdownOpen(false);
    setIsUnitMeasureDropdownOpen(false);
    setIsIssuedToDropdownOpen(false);
    setIsStoredToDropdownOpen(false);
  };

  const toggleStoredToDropdown = () => {
    setIsStoredToDropdownOpen((prev) => !prev);
    setIsClassificationDropdownOpen(false);
    setIsUnitMeasureDropdownOpen(false);
    setIsIssuedToDropdownOpen(false);
    setIsProjectDropdownOpen(false);
    setStoredSearch("");
  };

  const handleCancel = () => {
    if (!confirmDiscard()) return;
    navigate("/officedashboard");
  };

  const uploadThumbnail = async (itemId, file) => {
    const formData = new FormData();
    formData.append("thumbnail", file);
    const res = await fetch(
      `${BASE_URL}/inventoryofficeICTequipment/inventory/${itemId}/thumbnail`,
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

  /* ------------------------ submit ------------------------ */

  const handleStockinAndSubmission = async (e) => {
    e?.preventDefault?.();

    if (
      !stock.classification ||
      !stock.unitofmeasure ||
      !stock.itemName ||
      !stock.qty ||
      !stock.unit_cost ||
      !stock.project ||
      !stock.date_acquired
    ) {
      setShowFieldErrorPopup(true);
      return;
    }
    const qty = Number(stock.qty) || 0;
    const unitCost = Number(stock.unit_cost) || 0;
    if (qty <= 0 || unitCost <= 0) {
      setShowFieldErrorPopup(true);
      return;
    }
    if (!activeProjectSet.has(normalizeProject(stock.project))) {
      setShowFieldErrorPopup(true);
      return;
    }

    if (isButtonClicked) return;

    try {
      setIsButtonClicked(true);
      setSuccessMessage("Your ICT equipment record has been saved.");
      setThumbnailError("");

      const unit_cost = unitCost;
      const hasIssuedTo =
        stock.issued_to && String(stock.issued_to).trim() !== "";

      const payload = {
        ...stock,
        qty,
        unit_cost,
        total_cost: qty * unit_cost,
        status: hasIssuedTo ? "For Issue" : "In Stock",
        requeststatus: hasIssuedTo ? "For Approval" : null,
        date_requested: hasIssuedTo ? new Date().toISOString() : null,
        date_issued: "",
      };

      const res = await fetch(
        `${BASE_URL}/inventoryofficeICTequipment/inventory`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

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
        let finalMessage = "Your ICT equipment record has been saved.";
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
        console.error("Invalid response format from server:", result);
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

  /* ------------------------ derived display ------------------------ */
  const selectedIssuedTo =
    issuedToOptions.find((u) => u._id === stock.issued_to) || null;

  const selectedIssuedToLabel = selectedIssuedTo
    ? `${selectedIssuedTo.username}${
        selectedIssuedTo.position ? ` — ${selectedIssuedTo.position}` : ""
      }`
    : "";

  const totalCostNumber = Number(stock.total_cost) || 0;
  const totalCostDisplay = `₱ ${totalCostNumber.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  useEffect(() => {
    if (!registerSubmit) return;
    registerSubmit(handleStockinAndSubmission);
  }, [registerSubmit, handleStockinAndSubmission]);

  const filteredStoredToOptions = storedToOptions.filter((opt) =>
    opt.toLowerCase().includes(storedSearch.toLowerCase())
  );

  const applyIctPrefill = (item, { applyName = false } = {}) => {
    if (!item) return;
    setStock((prev) => {
      const next = { ...prev };
      if (!next.classification) next.classification = item.classification || "";
      if (!next.unitofmeasure) next.unitofmeasure = item.unitofmeasure || "";
      const predictedCost = Number(item.unit_cost ?? item.unitCost ?? 0);
      if (!Number(next.unit_cost)) next.unit_cost = predictedCost;
      if (!next.inclusions) next.inclusions = item.inclusions || "";
      if (!next.specifications) next.specifications = item.specifications || "";
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
    applyIctPrefill(smartSuggestion);
  }, [smartSuggestion, smartScore]);

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
        {/* Mobile */}
        <div className="sm:hidden relative w-11/12 mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <svg
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

        {/* Desktop */}
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

      {/* Main Card */}
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
                          d="M17.5 17.5V9.375M2.5 9.375V17.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14.94 1.875H5.06C4.21 1.875 3.44 2.34375 3.11 3.06484L1.42 6.75781C0.85 8.00039 1.79 9.4082 3.26 9.45312C4.57 9.45312 5.56 8.46953 5.56 7.41289C5.56 8.46758 6.55 9.45312 7.78 9.45312C9.01 9.45312 10 8.53984 10 7.41289C10 8.46758 10.99 9.45312 12.22 9.45312C13.45 9.45312 14.44 8.53984 14.44 7.41289C14.44 8.53984 15.44 9.45312 16.66 9.45312C18.21 9.40742 19.15 7.99961 18.58 6.75781L16.89 3.06484C16.56 2.34375 15.79 1.875 14.94 1.875Z"
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
                        Purchase Office ICT Equipments
                      </p>
                      <p className="text-xs text-slate-500">
                        Capture ICT acquisitions with proper tagging and
                        accountability.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Purchase Details */}
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
                            className="flex items-center justify-between w-full px-5 py-3 text-sm text-gray-700"
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
                              {filterOptions(
                                classificationOptions
                              ).length === 0 && (
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
                            className="flex items-center justify-between w-full px-5 py-3 text-sm text-gray-700"
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
                              {unitMeasureOptions.map((option, index) => (
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
                              {unitMeasureOptions.length === 0 && (
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

                    {/* Purchase date */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Purchase date{" "}
                        <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="date"
                        className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={stock.date_acquired}
                        onChange={(e) =>
                          handleInputChange(
                            "date_acquired",
                            e.target.value
                          )
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
                        step="1"
                        className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={stock.qty}
                        onChange={(e) =>
                          handleInputChange("qty", e.target.value)
                        }
                      />
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
                        value={stock.unit_cost}
                        onChange={(e) =>
                          handleInputChange("unit_cost", e.target.value)
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
                        value={totalCostDisplay}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Computed as Quantity × Unit cost.
                      </p>
                    </div>

                    {/* Issued to */}
                    <div>
                      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                        Issued to
                      </p>
                      <div className="relative mt-2">
                        <div className="relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/80">
                          <button
                            type="button"
                            onClick={toggleIssuedToDropdown}
                            className="flex items-center justify-between w-full px-5 py-3 text-sm text-gray-700"
                          >
                            <span>
                              {selectedIssuedToLabel || "Select user"}
                            </span>
                            <svg
                              className={`h-3 w-3 text-gray-500 transition-transform ${
                                isIssuedToDropdownOpen
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
                            className={`absolute left-0 right-0 top-11 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 max-h-56 overflow-y-auto ${
                              isIssuedToDropdownOpen ? "" : "hidden"
                            }`}
                          >
                            {issuedToOptions.map((user) => (
                              <button
                                key={user._id}
                                type="button"
                                onClick={() => {
                                  handleInputChange("issued_to", user._id);
                                  closeAllDropdowns();
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-600 rounded-lg hover:bg-blue-50 hover:text-blue-700"
                              >
                                <span className="block text-xs font-medium">
                                  {user.username}
                                </span>
                                {user.position && (
                                  <span className="block text-[11px] text-slate-400">
                                    {user.position}
                                  </span>
                                )}
                              </button>
                            ))}
                            {issuedToOptions.length === 0 && (
                              <div className="px-3 py-2 text-[10px] text-gray-400">
                                No eligible users found.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Optional. If set, this record will require{" "}
                        <span className="font-semibold">Issue Approval</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stored to: presets + custom toggle */}
                <div className="mt-4 px-7">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                      Stored to
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomStoredTo((prev) => !prev);
                        setIsStoredToDropdownOpen(false);
                      }}
                      className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                    >
                      {useCustomStoredTo ? "Use presets" : "Custom location"}
                    </button>
                  </div>

                  {/* Preset dropdown (default) */}
                  {!useCustomStoredTo && (
                    <div className="relative mt-2">
                      <div className="relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/80">
                        <button
                          type="button"
                          onClick={toggleStoredToDropdown}
                          className="flex items-center justify-between w-full px-5 py-3 text-sm text-gray-700"
                        >
                          <span>
                            {stock.stored_to || "Select storage location"}
                          </span>
                          <svg
                            className={`h-3 w-3 text-gray-500 transition-transform ${
                              isStoredToDropdownOpen ? "rotate-180" : ""
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
                        {isStoredToDropdownOpen && (
                          <div className="absolute left-0 right-0 top-11 z-20 rounded-xl border border-gray-200 bg-white shadow-xl">
                            <div className="border-b border-gray-100 px-3 py-2">
                              <p className="text-[11px] font-medium text-gray-700">
                                Quick locations
                              </p>
                              <input
                                type="text"
                                className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-200"
                                placeholder="Search presets..."
                                value={storedSearch}
                                onChange={(e) =>
                                  setStoredSearch(e.target.value)
                                }
                              />
                            </div>
                            <div className="max-h-60 overflow-y-auto py-1">
                              {filteredStoredToOptions.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange("stored_to", option);
                                    closeAllDropdowns();
                                  }}
                                  className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                                >
                                  {option}
                                </button>
                              ))}
                              {filteredStoredToOptions.length === 0 && (
                                <div className="px-3 py-2 text-[10px] text-gray-400">
                                  No presets match your search.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Choose from common DICT storage locations. Switch to
                        custom if needed.
                      </p>
                    </div>
                  )}

                  {/* Custom textbox */}
                  {useCustomStoredTo && (
                    <div className="mt-2">
                      <input
                        type="text"
                        className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="Type storage location (e.g., Isabela PO Storage Room)"
                        value={stock.stored_to}
                        onChange={(e) =>
                          handleInputChange("stored_to", e.target.value)
                        }
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Enter any custom storage location. You can switch back
                        to presets anytime.
                      </p>
                    </div>
                  )}
                </div>

                {/* Item Name */}
                <div className="pt-6 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Item name / description{" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <input
                    placeholder="Full description (ex: Laptop, i5, 16GB RAM, 512GB SSD)"
                    className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.itemName}
                    onChange={(e) =>
                      handleInputChange("itemName", e.target.value)
                    }
                  />
                  {smartSuggestion && (
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
                            applyIctPrefill(smartSuggestion, { applyName: true })
                          }
                        >
                          Use suggestion
                        </button>
                      </div>
                      <div className="mt-1 text-[10px] text-indigo-600">
                        Auto-fills classification, unit, cost, project, inclusions, and specs when empty.
                      </div>
                    </div>
                  )}
                  {prefillNote && (
                    <p className="mt-2 text-[11px] text-emerald-600">
                      {prefillNote}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Enter complete specs for traceability.
                  </p>
                </div>

                {showThumbnailField ? (
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
                ) : null}

                {/* Inclusions */}
                <div className="pt-4 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Inclusions{" "}
                    <span className="text-gray-500 text-xs">(optional)</span>
                  </p>
                  <input
                    placeholder="Accessories, bag, mouse, cables, etc."
                    className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.inclusions}
                    onChange={(e) =>
                      handleInputChange("inclusions", e.target.value)
                    }
                  />
                </div>

                {/* Specifications */}
                <div className="pt-4 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Specifications <span className="text-gray-500 text-xs">(optional)</span>
                  </p>
                  <textarea
                    placeholder="Technical specs, model details, dimensions, etc."
                    className="w-full mt-3 min-h-[96px] rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.specifications}
                    onChange={(e) =>
                      handleInputChange("specifications", e.target.value)
                    }
                  />
                </div>

                {/* Serial No */}
                <div className="pt-4 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Item Serial No.
                  </p>
                  <input
                    placeholder="If applicable"
                    className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.serial_no}
                    onChange={(e) =>
                      handleInputChange("serial_no", e.target.value)
                    }
                  />
                </div>

                {/* Batch No. */}
                <div className="pt-4 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Batch No. <span className="text-gray-500 text-xs">(optional)</span>
                  </p>
                  <input
                    placeholder="Batch number (if applicable)"
                    className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.batch_no}
                    onChange={(e) => handleInputChange("batch_no", e.target.value)}
                  />
                </div>

                {/* Remarks */}
                <div className="pt-4 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Remarks
                  </p>
                  <input
                    placeholder="PO #, Supplier, assigned location, etc."
                    className="w-full mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base text-slate-700 placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={stock.remarks}
                    onChange={(e) =>
                      handleInputChange("remarks", e.target.value)
                    }
                  />
                </div>

                {/* Project */}
                <div className="pt-4 px-7">
                  <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
                    Project <span className="text-red-500">*</span>
                  </p>
                  <div className="relative mt-2">
                    <div className="relative w-full rounded-2xl border border-slate-200/80 bg-slate-50/80">
                      <button
                        type="button"
                        onClick={toggleProjectDropdown}
                        className="flex items-center justify-between w-full px-5 py-3 text-sm text-gray-700"
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
                  <p className="mt-2 text-[11px] text-slate-400">
                    Select the project this ICT item is charged to.
                  </p>
                </div>

                {/* Actions */}
                <hr className="h-px bg-gray-100 mt-6 mb-4 mx-7" />
                <div className="flex flex-col lg:flex-row lg:justify-end items-center gap-3 px-7 pb-2">
                  {embedded ? (
                    <button
                      type="button"
                      onClick={() => {
                        const qty = Number(stock.qty) || 0;
                        const unitCost = Number(stock.unit_cost) || 0;
                        if (
                          !stock.classification ||
                          !stock.unitofmeasure ||
                          !stock.itemName ||
                          !stock.project ||
                          !stock.date_acquired ||
                          qty <= 0 ||
                          unitCost <= 0 ||
                          !activeProjectSet.has(normalizeProject(stock.project))
                        ) {
                          setShowFieldErrorPopup(true);
                          return;
                        }
                        if (onReview) {
                          onReview();
                          return;
                        }
                        handleStockinAndSubmission();
                      }}
                      className="inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm transition w-full lg:w-auto bg-slate-900 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isButtonClicked}
                    >
                      {isButtonClicked ? "Preparing..." : "Review Details"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleStockinAndSubmission}
                        disabled={isButtonClicked}
                        aria-busy={isButtonClicked}
                        className={`inline-flex justify-center items-center rounded-md px-6 py-3 text-sm font-semibold text-white shadow-sm transition w-full lg:w-auto ${
                          isButtonClicked
                            ? "bg-indigo-300 cursor-not-allowed"
                            : "bg-indigo-700 hover:bg-indigo-600"
                        }`}
                      >
                        {isButtonClicked ? "Submitting..." : "Submit"}
                      </button>
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

      {/* Success Popup */}
      <ModalShell
        open={showSuccessPopup}
        title="Successfully submitted"
        subtitle="Purchase Entry"
        variant="neutral"
        onClose={() => setShowSuccessPopup(false)}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            ✓
          </div>
          <p className="text-sm text-slate-600">{successMessage}</p>
          <button
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
        title="Submission Failed"
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
            An error occurred while submitting your ICT item. Please try again.
          </p>
          <button
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
          <p className="text-sm text-slate-600">
            Please fill in all required fields before submitting.
          </p>
          <button
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
