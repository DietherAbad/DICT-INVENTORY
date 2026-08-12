const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parsePagination = (req, defaults = {}) => {
  const pageRaw = req.query?.page;
  const limitRaw = req.query?.limit;

  const page = Math.max(1, parseInt(pageRaw, 10) || defaults.page || 1);
  const limit = Math.max(1, parseInt(limitRaw, 10) || defaults.limit || 20);
  const skip = (page - 1) * limit;

  const hasFieldFilters = Object.keys(req.query || {}).some((key) =>
    key.startsWith("field_")
  );

  const hasPaging =
    pageRaw !== undefined ||
    limitRaw !== undefined ||
    req.query?.search !== undefined ||
    req.query?.status !== undefined ||
    req.query?.requeststatus !== undefined ||
    req.query?.sort !== undefined ||
    hasFieldFilters;

  return { page, limit, skip, hasPaging };
};

export const buildSearchFilter = (search, fields = []) => {
  if (!search) return {};
  const safe = escapeRegex(String(search).trim());
  if (!safe) return {};
  const regex = new RegExp(safe, "i");
  return {
    $or: fields.map((field) => ({ [field]: regex })),
  };
};

export const buildStatusFilter = (status) => {
  if (!status) return {};
  const raw = String(status).trim();
  if (!raw) return {};
  const normalized = escapeRegex(raw).replace(/\s+/g, "[\\s-]*");
  return { status: new RegExp(`^${normalized}$`, "i") };
};

export const buildFieldFilters = (query, fields = [], options = {}) => {
  const prefix = options.prefix || "";
  const filters = {};

  fields.forEach((field) => {
    const key = prefix ? `${prefix}${field}` : field;
    const raw = query?.[key];
    if (raw === undefined || raw === null) return;
    const value = String(raw).trim();
    if (!value) return;

    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value === String(numeric)) {
      filters[field] = numeric;
      return;
    }

    filters[field] = new RegExp(escapeRegex(value), "i");
  });

  return filters;
};
