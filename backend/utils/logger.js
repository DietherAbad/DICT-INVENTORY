import { Logtail } from "@logtail/node";

const logtailToken = process.env.LOGTAIL_TOKEN || "";
const logtail = logtailToken ? new Logtail(logtailToken) : null;

const levelMap = {
  info: "log",
  warn: "warn",
  error: "error",
  debug: "debug",
};

export const log = (level, message, meta = {}) => {
  const entry = {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  };

  const consoleMethod = levelMap[level] || "log";
  // Keep logs structured for log aggregation.
  console[consoleMethod](JSON.stringify(entry));

  if (logtail) {
    if (level === "error") logtail.error(message, meta);
    else if (level === "warn") logtail.warn(message, meta);
    else logtail.info(message, meta);
  }
};

export const flushLogs = async () => {
  if (!logtail) return;
  try {
    await logtail.flush();
  } catch {
    // ignore flush errors on shutdown
  }
};
