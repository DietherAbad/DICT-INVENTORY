import Counter from "../models/Counter.js";
import SystemSettings from "../models/SystemSettings.js";

const DEFAULT_SE_THRESHOLD = 50000;

const getSeThreshold = async () => {
  const settings = await SystemSettings.findOne({ key: "global" }).lean();
  const raw = Number(settings?.se_threshold);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SE_THRESHOLD;
};

export const getStoredIssuanceDocType = (item) =>
  item?.par_no || String(item?.asset_type || "").trim().toUpperCase() === "PPE"
    ? "PAR"
    : "ICS";

export const getPropertyTransferDocType = (item) =>
  String(item?.asset_type || "").trim().toUpperCase() === "SE" ? "ICS" : "PTR";

export const resolveIssuanceDocType = async (item) => {
  const storedType = String(item?.asset_type || "").trim().toUpperCase();
  if (storedType === "PPE" || storedType === "SE") {
    return storedType === "PPE" ? "PAR" : "ICS";
  }

  const threshold = await getSeThreshold();
  const cost = Number(item?.unit_cost);
  return Number.isFinite(cost) && cost >= threshold ? "PAR" : "ICS";
};

export const buildIssuanceDocNumber = async (docType, dateLike = null) => {
  const date = dateLike ? new Date(dateLike) : new Date();
  const basis = Number.isFinite(date.getTime()) ? date : new Date();
  const yearMonth = `${basis.getFullYear()}-${String(basis.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
  const normalizedType = String(docType || "ICS").trim().toUpperCase();
  const counter = await Counter.findOneAndUpdate(
    { _id: `${normalizedType}.${yearMonth}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();

  return `${yearMonth}-${String(counter.seq || 0).padStart(4, "0")}`;
};
