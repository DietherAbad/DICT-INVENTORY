import { isTransferHistoryEntry } from "./historyTransaction";

describe("isTransferHistoryEntry", () => {
  it("keeps an issued ICS classified as an issuance", () => {
    expect(
      isTransferHistoryEntry({
        doc_type: "ICS",
        doc_snapshot: { status: "Issued", issued_to: "user-1" },
      })
    ).toBe(false);
  });

  it("classifies a received SE transfer stored as ICS as a transfer", () => {
    expect(
      isTransferHistoryEntry({
        doc_type: "ICS",
        remarks: "Transfer received and acknowledged.",
        doc_snapshot: {
          status: "Transferred",
          requeststatus: "Received",
          transfered_to: "user-2",
          transfer_type: "DICT User",
        },
      })
    ).toBe(true);
  });

  it("classifies PTR entries as transfers", () => {
    expect(isTransferHistoryEntry({ doc_type: "PTR", doc_snapshot: {} })).toBe(true);
  });

  it("does not classify unrelated documents as transfers", () => {
    expect(
      isTransferHistoryEntry({
        doc_type: "RTI",
        remarks: "Transfer back to inventory",
        doc_snapshot: { status: "In Stock" },
      })
    ).toBe(false);
  });
});
