const normalizedText = (value) => String(value || "").trim().toLowerCase();

/**
 * SE transfers use an ICS, just like SE issuances. The document type alone
 * therefore cannot tell us which transaction the history entry represents.
 */
export const isTransferHistoryEntry = (entry) => {
  const docType = normalizedText(entry?.doc_type).toUpperCase();
  if (docType === "PTR") return true;
  if (docType !== "ICS") return false;

  const snapshot = entry?.doc_snapshot || {};
  const status = normalizedText(snapshot?.status);
  const transferState = normalizedText(snapshot?.transfertype);
  const transferType = normalizedText(
    snapshot?.transfer_type || snapshot?.transferType || snapshot?.transfer_mode
  );
  const transferTarget =
    snapshot?.transfered_to ||
    snapshot?.transferred_to ||
    snapshot?.transfer_target ||
    snapshot?.transfered_to_id ||
    snapshot?.transferred_to_id;
  const historyText = normalizedText(`${entry?.reason || ""} ${entry?.remarks || ""}`);

  return (
    status.includes("transfer") ||
    transferState.includes("transfer") ||
    Boolean(transferType && transferTarget) ||
    /\btransfer(?:red)?\b/.test(historyText)
  );
};
