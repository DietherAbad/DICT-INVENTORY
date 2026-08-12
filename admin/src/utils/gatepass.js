import { BASE_URL } from "./config";

/** Route prefix → inventory API collection path segment */
export const QR_ROUTE_MAP = {
  checkitem: {
    collection: "inventoryofficeequipment",
    listPath: "/inventoryofficeequipment/inventory",
  },
  checkitemict: {
    collection: "inventoryofficeICTequipment",
    listPath: "/inventoryofficeICTequipment/inventory",
  },
  checkitemfurniture: {
    collection: "inventoryofficefurnitureandfixture",
    listPath: "/inventoryofficefurnitureandfixture/inventory",
  },
  checkitemfreewifi: {
    collection: "inventoryfreewifiequipment",
    listPath: "/inventoryfreewifiequipment/inventory",
  },
  checkitemgovnetequip: {
    collection: "inventorygovnetequipment",
    listPath: "/inventorygovnetequipment/inventory",
  },
  checkitemmotor: {
    collection: "inventoryofficemotorandvehicle",
    listPath: "/inventoryofficemotorandvehicle/inventory",
  },
};

export const INVENTORY_LIST_URLS = [
  `${BASE_URL}/inventoryofficeequipment/inventory`,
  `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
  `${BASE_URL}/inventoryofficeICTequipment/inventory`,
  `${BASE_URL}/inventoryofficemotorandvehicle/inventory`,
];

export const COLLECTION_BY_LIST_URL = {
  [`${BASE_URL}/inventoryofficeequipment/inventory`]: "inventoryofficeequipment",
  [`${BASE_URL}/inventoryofficefurnitureandfixture/inventory`]:
    "inventoryofficefurnitureandfixture",
  [`${BASE_URL}/inventoryofficeICTequipment/inventory`]:
    "inventoryofficeICTequipment",
  [`${BASE_URL}/inventoryofficemotorandvehicle/inventory`]:
    "inventoryofficemotorandvehicle",
};

/**
 * Parse equipment QR payload (usually a full page URL) into collection + id.
 * @param {string} raw
 * @returns {{ collection: string, inventoryId: string, routeKey: string } | null}
 */
export function parseEquipmentQr(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  let pathname = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      pathname = new URL(trimmed).pathname;
    }
  } catch {
    return null;
  }

  const match = pathname.match(
    /\/(checkitemict|checkitemfurniture|checkitemfreewifi|checkitemgovnetequip|checkitemmotor|checkitem)\/([A-Za-z0-9_-]+)/i
  );
  if (!match) return null;

  const routeKey = match[1].toLowerCase();
  const meta = QR_ROUTE_MAP[routeKey];
  if (!meta) return null;

  return {
    collection: meta.collection,
    inventoryId: match[2],
    routeKey,
  };
}

export function statusBadgeClass(status) {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-700";
    case "For Approval":
      return "bg-yellow-100 text-yellow-800";
    case "For Release":
      return "bg-orange-100 text-orange-800";
    case "Released":
      return "bg-blue-100 text-blue-800";
    case "Out":
      return "bg-indigo-100 text-indigo-800";
    case "Returned":
      return "bg-green-100 text-green-800";
    case "Declined":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

async function parseJson(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const msg =
      (body && (body.message || body.error)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export const gatepassApi = {
  list: () =>
    fetch(`${BASE_URL}/gatepass`).then(parseJson),

  get: (id) =>
    fetch(`${BASE_URL}/gatepass/${id}`).then(parseJson),

  create: (payload) =>
    fetch(`${BASE_URL}/gatepass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseJson),

  update: (id, payload) =>
    fetch(`${BASE_URL}/gatepass/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseJson),

  addItem: (id, payload) =>
    fetch(`${BASE_URL}/gatepass/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseJson),

  removeItem: (id, inventoryId) =>
    fetch(`${BASE_URL}/gatepass/${id}/items/${inventoryId}`, {
      method: "DELETE",
    }).then(parseJson),

  submit: (id) =>
    fetch(`${BASE_URL}/gatepass/${id}/submit`, { method: "POST" }).then(
      parseJson
    ),

  approve: (id, payload = {}) =>
    fetch(`${BASE_URL}/gatepass/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseJson),

  release: (id, payload = {}) =>
    fetch(`${BASE_URL}/gatepass/${id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseJson),

  guard: (id, payload = {}) =>
    fetch(`${BASE_URL}/gatepass/${id}/guard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseJson),

  returnPass: (id) =>
    fetch(`${BASE_URL}/gatepass/${id}/return`, { method: "POST" }).then(
      parseJson
    ),

  decline: (id, payload = {}) =>
    fetch(`${BASE_URL}/gatepass/${id}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parseJson),
};

export function itemToGatepassPayload(item, collection, source, username) {
  return {
    inventoryId: item._id,
    collection,
    itemName: item.itemName,
    classification: item.classification,
    qty: item.qty ?? 1,
    unitofmeasure: item.unitofmeasure || item.unit || "pc",
    property_no: item.property_no || item.propertyNo || "",
    serial_no: item.serial_no || item.serialNo || "",
    unit_cost: item.unit_cost || item.unitCost || 0,
    source,
    prior_status: item.status,
    prior_issued_to: item.issued_to || null,
    scanned_by: username,
  };
}

export function canTakeOutside(item, username) {
  if (!item || item.active_gatepass_id || item.outside_use) return false;
  const st = (item.status || "").trim();
  if (st === "In Stock" && !item.issued_to) return true;
  if (st === "Issued" && item.issued_to === username) return true;
  if (st === "Transferred" && item.transfered_to === username) return true;
  return false;
}

export function itemSource(item, username) {
  const st = (item.status || "").trim();
  if (st === "In Stock" && !item.issued_to) return "in_stock";
  if (
    (st === "Issued" && item.issued_to === username) ||
    (st === "Transferred" && item.transfered_to === username)
  ) {
    return "my_inventory";
  }
  return null;
}
