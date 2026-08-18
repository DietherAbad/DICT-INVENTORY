import InventoryOfficeEquipment from "../models/InventoryOfficeEquipment.js";
import InventoryOfficeFurnitureandFixture from "../models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeICTEquipment from "../models/InventoryOfficeICTEquipment.js";

const sanitizeItem = (item, type) => ({
  type,
  itemName: item?.itemName || "",
  classification: item?.classification || "",
  serial_no: item?.serial_no || "",
  property_no: item?.property_no || "",
  unitofmeasure: item?.unitofmeasure || "",
  status: item?.status || "",
  project: item?.project || "",
  stored_to: item?.stored_to || "",
  date_acquired: item?.date_acquired || null,
  date_issued: item?.date_issued || null,
  updatedAt: item?.updatedAt || null,
});

export const getPublicItemByToken = async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Token is required." });
    }

    const [equipment, furniture, ict] = await Promise.all([
      InventoryOfficeEquipment.findOne({ public_qr_token: token }).lean(),
      InventoryOfficeFurnitureandFixture.findOne({ public_qr_token: token }).lean(),
      InventoryOfficeICTEquipment.findOne({ public_qr_token: token }).lean(),
    ]);

    if (equipment) {
      return res.status(200).json(sanitizeItem(equipment, "Office Equipment"));
    }
    if (furniture) {
      return res.status(200).json(
        sanitizeItem(furniture, "Furniture & Fixtures")
      );
    }
    if (ict) {
      return res.status(200).json(sanitizeItem(ict, "ICT Equipment"));
    }

    return res.status(404).json({ message: "Item not found." });
  } catch (error) {
    console.error("getPublicItemByToken error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
