const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientMongoError = (err) => {
  if (!err) return false;
  const labels = err.errorLabels || err?.result?.errorLabels || [];
  if (Array.isArray(labels) && labels.includes("TransientTransactionError")) return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("writeconflict") ||
    msg.includes("lock timeout") ||
    msg.includes("timed out") ||
    msg.includes("network") ||
    msg.includes("not primary")
  );
};

export const withDbRetry = async (fn, { retries = 2, delayMs = 200 } = {}) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransientMongoError(err)) throw err;
      const backoff = delayMs * Math.pow(2, attempt);
      await sleep(backoff);
      attempt += 1;
    }
  }
  return fn();
};
