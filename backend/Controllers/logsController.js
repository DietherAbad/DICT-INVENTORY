import Logs from "../models/Logs.js";
import { buildSearchFilter, parsePagination } from "../utils/pagination.js";

// create new logs
export const createLog = async (logData) => {
   try {
      const { userId, action, status, time } = logData;

      if (!userId || !action || !time) {
         throw new Error("userId, action, and time are required for creating a log.");
      }

      const newLog = new Logs({
         userId,
         action,
         status: status || 'unknown', // Use a default value if status is not provided
         time,
      });

      const savedLog = await newLog.save();
      return savedLog;
   } catch (error) {
      console.error("Error saving log:", error);
      throw error;
   }
};

// get all logs
export const getAllLogs = async (req, res) => {
   try {
      const { page, limit, skip } = parsePagination(req, { page: 1, limit: 25 });
      const search = req.query?.search;
      const status = req.query?.status;

      const filter = {
         ...(status ? { status } : {}),
         ...buildSearchFilter(search, ["userId", "action", "status"]),
      };

      const [data, total] = await Promise.all([
         Logs.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
         Logs.countDocuments(filter),
      ]);

      res.status(200).json({ success: true, message: "Successful!", data, total, page, limit });
   } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ success: false, message: "Internal server error!" });
   }
};
