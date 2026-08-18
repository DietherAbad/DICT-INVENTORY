import { parseEquipmentQr, canTakeOutside, itemSource } from "./utils/gatepass";

describe("parseEquipmentQr", () => {
  test("parses office equipment checkitem URL", () => {
    const result = parseEquipmentQr(
      "http://localhost:3000/checkitem/64abc123def456"
    );
    expect(result).toEqual({
      collection: "inventoryofficeequipment",
      inventoryId: "64abc123def456",
      routeKey: "checkitem",
    });
  });

  test("parses ICT path before generic checkitem", () => {
    const result = parseEquipmentQr("/checkitemict/ict99");
    expect(result.collection).toBe("inventoryofficeICTequipment");
    expect(result.inventoryId).toBe("ict99");
  });

  test("returns null for unrelated QR", () => {
    expect(parseEquipmentQr("https://example.com/other")).toBeNull();
  });
});

describe("canTakeOutside / itemSource", () => {
  const user = "jane";

  test("allows in-stock unissued item", () => {
    const item = { status: "In Stock" };
    expect(canTakeOutside(item, user)).toBe(true);
    expect(itemSource(item, user)).toBe("in_stock");
  });

  test("allows issued item for holder", () => {
    const item = { status: "Issued", issued_to: "jane" };
    expect(canTakeOutside(item, user)).toBe(true);
    expect(itemSource(item, user)).toBe("my_inventory");
  });

  test("blocks item already on a gatepass", () => {
    const item = {
      status: "Issued",
      issued_to: "jane",
      active_gatepass_id: "gp1",
    };
    expect(canTakeOutside(item, user)).toBe(false);
  });
});
