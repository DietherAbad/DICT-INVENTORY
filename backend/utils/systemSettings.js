import SystemSettings from "../models/SystemSettings.js";

export const getEmailEnabled = async () => {
  try {
    const settings = await SystemSettings.findOne({ key: "global" }).lean();
    return settings ? settings.enable_email !== false : true;
  } catch {
    return true;
  }
};
