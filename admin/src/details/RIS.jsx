// src/components/RISModal.jsx
import React, { useMemo } from "react";
import DICT from "../assets/DICT.png";

/**
 * RIS Printable (No Modal)
 *
 * - Renders a single "Print RIS Form" button.
 * - Clicking it opens a print-optimized window with a professionally designed RIS.
 * - The printable mirrors the modern header/footer/branding you liked: logo,
 *   gradient frame, chip, strong/italic typography, generous spacing, neat tables.
 *
 * Props:
 * - inv: record object
 * - recipientName: resolved end-user recipient (string)
 * - approver: approver user object (RD) (optional)
 * - afd: AFD approver (optional)   // (kept for API symmetry if you wire it later)
 * - invAdmin: inventory admin / issuer (optional)
 */
const RISModal = ({ inv, recipientName, approver, afd, invAdmin }) => {
  /* ---------------- helpers ---------------- */
  const ENTITY_NAME = "DICT REGIONAL OFFICE 02";

  const safe = (v, fallback = "") =>
    v !== null && v !== undefined && v !== "" ? v : fallback;

  const formatDate = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}/${m}/${y}`;
  };

  // escape HTML for injecting into print-window string
  const esc = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const dashIfEmpty = (s, dash = "—") => (s ? s : dash);

  const invSafe = inv || {};

  // top meta
  const fundCluster = safe(invSafe.project || "eLGU", "");
  const office = safe(
    invSafe.requested_by_office ||
      invSafe.requestor_office ||
      invSafe.office ||
      invSafe.requested_by_designation ||
      invSafe.requestor_designation ||
      invSafe.designation,
    "—"
  );
  const division = office;
  const risNo = safe(invSafe.ris_no, "—");

  // items
  const items = useMemo(() => {
    if (Array.isArray(invSafe.items) && invSafe.items.length) {
      return invSafe.items.map((it, idx) => ({
        no: idx + 1,
        stockNo: safe(it.stock_no || it.returnId || idx + 1, ""),
        unit: safe(it.unitofmeasure || it.unit || "Pcs", ""),
        qtyReq: safe(it.quantity || it.qty || 1, ""),
        desc: safe(it.itemName || it.description || "", ""),
        qtyIss: safe(it.quantity || it.qty || 1, ""),
      }));
    }
    return [
      {
        no: 1,
        stockNo: safe(invSafe.stock_no || invSafe.property_no || "1", ""),
        unit: safe(invSafe.unitofmeasure || "Pcs", ""),
        qtyReq: safe(invSafe.qty || invSafe.quantity || 1, ""),
        desc: safe(invSafe.itemName || "", ""),
        qtyIss: safe(invSafe.qty || invSafe.quantity || 1, ""),
      },
    ];
  }, [invSafe]);

  // signatories
  const requestedByName =
    invSafe.requested_by ||
    invSafe.requestedby ||
    invSafe.requestor ||
    invSafe.issued_to ||
    "";
  const requestedByDesignation =
    invSafe.requested_by_designation ||
    invSafe.requestor_designation ||
    invSafe.designation ||
    "Requesting Officer";
  const requestedDate = formatDate(invSafe.date_requested || invSafe.date_issued || "") || "__________";

  const approvedByName =
    (approver && (approver.username || approver.name)) || "";
  const approvedByDesignation =
    (approver && (approver.position || approver.role)) || "Approving Officer";
  const dateApprovedValue = formatDate(invSafe.date_approved) || "__________";

  const issuedByName =
    (invAdmin && (invAdmin.username || invAdmin.name)) || "";
  const issuedByDesignation =
    (invAdmin && (invAdmin.position || invAdmin.role)) ||
    "Property/Supply Officer";
  const dateReleasedValue = formatDate(invSafe.date_released) || "__________";

  const receivedByName = recipientName || "";
  const receivedByDesignation =
    invSafe.office || invSafe.received_by_designation || "End-User / Recipient";
  const dateReceivedValue = formatDate(invSafe.date_received) || "__________";

  // Purpose and remarks are separate fields. Remarks may contain the
  // Checkform edit audit log and must never be printed as RIS purpose.
  const purpose = safe(invSafe.purpose || "", "");

  // pre-render rows HTML (so we don't reference undefined helpers inside the template)
  const itemsRowsHTML = items
    .map(
      (row) => `
        <tr>
          <td class="tc">${esc(String(row.stockNo))}</td>
          <td class="tc">${esc(String(row.unit))}</td>
          <td class="tc">${esc(String(row.qtyReq))}</td>
          <td class="desc">${esc(String(row.desc))}</td>
          <td class="tc">${esc(String(row.qtyIss))}</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>`
    )
    .join("");

  const blanksNeeded = Math.max(0, 10 - items.length);
  const blankRowsHTML = Array.from({ length: blanksNeeded })
    .map(
      () => `
        <tr>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        </tr>`
    )
    .join("");

  /* ---------------- print handler ---------------- */
  const handlePrint = () => {
    try {
      const pri = window.open("", "", "width=1000,height=800");
      if (!pri) return;

      pri.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Requisition and Issue Slip</title>
  <style>
    /* ----------- Reset + Base ----------- */
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      color: #0f172a; /* slate-900 */
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
    }
    @page {
      size: A4;
      margin: 10mm;
    }

    /* ----------- Frame / Card ----------- */
    .frame {
      background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(2,6,23,0.96));
      padding: 1.5px;
      border-radius: 16px;
      box-shadow: 0 18px 60px rgba(2,6,23,0.65);
    }
    .card {
      background: #ffffff;
      border-radius: 14px;
      overflow: hidden;
    }

    /* ----------- Header Bar ----------- */
    .bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-bottom: 1px solid #e2e8f0; /* slate-200 */
      background: rgba(248,250,252,0.9); /* slate-50 */
    }
    .brand {
      display: flex; align-items: center; gap: 10px;
    }
    .brand-logo {
      height: 22px; width: 22px; display:flex; align-items:center; justify-content:center;
      background:#ffffff; border: 1px solid #e2e8f0; border-radius: 10px;
      box-shadow: 0 1px 0 rgba(15,23,42,0.06);
      padding: 2px;
    }
    .brand-meta {
      line-height: 1.1;
    }
    .brand-title {
      font-weight: 800; font-size: 12px; letter-spacing: 0.02em; color:#0f172a;
    }
    .brand-sub {
      font-style: italic; color:#475569; font-size: 9px;
    }
    .bar-right {
      text-align: right; line-height: 1.15;
    }
    .chip {
      display:inline-flex; align-items:center; gap:6px;
      background: #eef2ff; /* indigo-50 */
      color:#4338ca; /* indigo-700 */
      border: 1px solid #e0e7ff; /* indigo-100 */
      border-radius: 999px;
      padding: 4px 8px; font-weight:600; font-size:9px; letter-spacing:0.04em;
      text-transform: uppercase;
    }
    .chip-dot {
      width:6px; height:6px; border-radius:999px; background:#4f46e5; /* indigo-600 */
    }
    .tiny-note { color:#64748b; font-size:9px; }

    /* ----------- Body ----------- */
    .body { padding: 14px 16px; background: #f8fafc; } /* slate-50 */
    .paper {
      background:#ffffff; border:1px solid #e2e8f0; border-radius: 12px; padding: 14px;
      width: 100%;
    }

    /* ----------- RIS Header (Logo + Entity) ----------- */
    .header {
      text-align:center; margin-bottom: 10px;
    }
    .logo {
      height: 34px; object-fit: contain; margin: 2px auto 4px auto; display:block;
    }
    .header-lines { color:#0f172a; }
    .header-lines .a { font-weight: 700; font-style: italic; font-size: 10px; }
    .header-lines .b { font-weight: 800; font-size: 11px; }
    .header-lines .c { font-weight: 700; font-style: italic; font-size: 10px; letter-spacing: 0.02em; }
    .header-lines .d { font-style: italic; font-size: 9px; color:#475569; }
    .ris-title {
      margin-top: 6px;
      font-size: 14px; font-weight: 900; letter-spacing: 0.18em; color:#0f172a;
    }

    .meta-row {
      display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; font-size: 10px;
    }
    .meta-cell .label { text-transform: uppercase; color:#64748b; font-size: 8px; letter-spacing:0.12em; }
    .meta-cell .value { font-weight: 800; color:#0f172a; font-size: 11px; }

    .form-code {
      text-align:right; font-size: 9px; color:#475569; font-style: italic; margin-top: 6px;
    }
    .divider { border-top: 1px solid #e2e8f0; margin-top: 8px; }

    /* ----------- Meta Table ----------- */
    table { border-collapse: collapse; width: 100%; }
    .meta-table td {
      border: 1px solid #e2e8f0; padding: 6px 6px; vertical-align: middle;
      font-size: 10px;
    }
    .meta-table .k {
      background: #f8fafc; font-weight: 700; color:#0f172a; width: 26%;
    }
    .meta-table .v { font-style: italic; }

    /* ----------- Items Table ----------- */
    .items thead th {
      border:1px solid #e2e8f0; padding: 6px 6px;
      background: #f1f5f9; /* slate-100 */
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size:10px;
      color:#0f172a; text-align: center;
    }
    .items tbody td {
      border:1px solid #e2e8f0; padding: 6px 6px; font-size: 10px;
    }
    .tc { text-align: center; }
    .desc { font-style: italic; }

    /* ----------- Purpose ----------- */
    .purpose { font-size: 10px; margin-top: 10px; }
    .purpose .label { font-weight: 700; color:#0f172a; }
    .purpose .line {
      display:inline-block; min-width: 70%; border-bottom:1px solid #334155; /* slate-700 */
      padding-bottom: 2px; margin-left: 6px; font-style: italic;
    }

    /* ----------- Signatories ----------- */
    .sigs { margin-top: 14px; }
    .sigs thead th {
      border:1px solid #e2e8f0; background:#f8fafc; padding: 6px 6px; font-weight:700; font-size:10px; color:#0f172a;
    }
    .sigs tbody td {
      border:1px solid #e2e8f0; padding: 10px 6px; vertical-align: bottom;
      text-align:center; min-height: 96px;
    }
    .sig-line { width: 92%; border-top: 1px solid #0f172a; margin: 28px auto 4px auto; }
    .sig-name { font-weight: 800; font-size: 10px; color:#0f172a; }
    .sig-role, .sig-date { font-size: 9px; color:#475569; font-style: italic; }
    .sig-date { margin-top: 2px; }

    /* ----------- Footer Note ----------- */
    .foot {
      margin-top: 10px; font-size: 9px; color:#475569; font-style: italic;
      border-top:1px solid #e2e8f0; padding-top: 8px;
    }
  </style>
</head>
<body>
  <!-- Gradient frame and card -->
  <div class="frame">
    <div class="card">
      <!-- Header bar -->
      <div class="bar">
        <div class="brand">
          <div class="brand-logo">
            <img src="${esc(DICT)}" alt="DICT" style="height:16px;width:auto;" />
          </div>
          <div class="brand-meta">
            <div class="brand-title">REQUISITION AND ISSUE SLIP</div>
            <div class="brand-sub">Official RIS • System-generated • Print copy</div>
          </div>
        </div>
        <div class="bar-right">
          <div class="chip"><span class="chip-dot"></span><span>RIS</span></div>
          <div class="tiny-note"><b>RIS No.:</b> ${esc(risNo)} • <b>Office:</b> ${esc(office)}</div>
        </div>
      </div>

      <!-- Body -->
      <div class="body">
        <div class="paper">
          <!-- RIS Head -->
          <div class="header">
            <img class="logo" src="${esc(DICT)}" alt="DICT Logo" />
            <div class="header-lines">
              <div class="a">REPUBLIC OF THE PHILIPPINES</div>
              <div class="b">DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY</div>
              <div class="c">${esc(ENTITY_NAME)}</div>
              <div class="d">No. 2 Bagay Rd., San Gabriel Village, Tuguegarao City, Cagayan</div>
            </div>
            <div class="ris-title">REQUISITION AND ISSUE SLIP</div>

            <div class="meta-row">
              <div class="meta-cell">
                <div class="label">RIS NO.</div>
                <div class="value">${esc(risNo)}</div>
              </div>
              <div class="meta-cell" style="text-align:right;">
                <div class="label">Office</div>
                <div class="value">${esc(office)}</div>
              </div>
            </div>
          </div>

          <div class="form-code"><b>Form Code:</b> RIS-01 • <b>Rev. 01</b> • Effectivity: ________</div>
          <div class="divider"></div>

          <!-- Meta table -->
          <table class="meta-table" style="margin-top:8px;">
            <tbody>
              <tr>
                <td class="k">Entity Name:</td>
                <td class="v" colspan="3"><b><i>${esc(ENTITY_NAME)}</i></b></td>
                <td class="k">Fund Cluster:</td>
                <td class="v"><b><i>${esc(fundCluster)}</i></b></td>
              </tr>
              <tr>
                <td class="k">Division:</td>
                <td class="v" colspan="3"><i>${esc(division)}</i></td>
                <td class="k">Responsibility Code:</td>
                <td class="v"><i>—</i></td>
              </tr>
              <tr>
                <td class="k">Office:</td>
                <td class="v" colspan="3"><i>${esc(office)}</i></td>
                <td class="k">RIS No.:</td>
                <td class="v"><b><i>${esc(risNo)}</i></b></td>
              </tr>
            </tbody>
          </table>

          <!-- Items -->
          <table class="items" style="margin-top:10px;">
            <thead>
              <tr>
                <th colspan="4">Requisition</th>
                <th colspan="3">Issuance Details</th>
              </tr>
              <tr>
                <th>Stock No.</th>
                <th>Unit of Measurement</th>
                <th>Qty. Requested</th>
                <th>Description</th>
                <th>Qty. Issued</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHTML}
              ${blankRowsHTML}
            </tbody>
          </table>

          <!-- Purpose -->
          <div class="purpose">
            <span class="label">Purpose:</span>
            <span class="line">${esc(purpose) || "&nbsp;"}</span>
          </div>

          <!-- Signatories -->
          <table class="sigs">
            <thead>
              <tr>
                <th>Requested by</th>
                <th>Approved by</th>
                <th>Issued by</th>
                <th>Received by</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="sig-line"></div>
                  <div class="sig-name">${esc(dashIfEmpty(requestedByName, "&nbsp;"))}</div>
                  <div class="sig-role">${esc(requestedByDesignation)}</div>
                  <div class="sig-date">Date: ${esc(requestedDate)}</div>
                </td>
                <td>
                  <div class="sig-line"></div>
                  <div class="sig-name">${esc(dashIfEmpty(approvedByName, "&nbsp;"))}</div>
                  <div class="sig-role">${esc(approvedByDesignation)}</div>
                  <div class="sig-date">Date: ${esc(dateApprovedValue)}</div>
                </td>
                <td>
                  <div class="sig-line"></div>
                  <div class="sig-name">${esc(dashIfEmpty(issuedByName, "&nbsp;"))}</div>
                  <div class="sig-role">${esc(issuedByDesignation)}</div>
                  <div class="sig-date">Date: ${esc(dateReleasedValue)}</div>
                </td>
                <td>
                  <div class="sig-line"></div>
                  <div class="sig-name">${esc(dashIfEmpty(receivedByName, "&nbsp;"))}</div>
                  <div class="sig-role">${esc(receivedByDesignation)}</div>
                  <div class="sig-date">Date: ${esc(dateReceivedValue)}</div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Footnote -->
          <div class="foot">
            This RIS is system-generated by the DICT Region 02 Inventory System and is valid
            only upon affixing the required signatures of the authorized officials above.
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Print immediately then close to match prior UX
    window.focus();
    setTimeout(() => { window.print(); window.close(); }, 50);
  </script>
</body>
</html>
      `);

      pri.document.close();
      pri.focus();
    } catch (e) {
      console.error("Print RIS failed:", e);
    }
  };

  /* ---------------- render ---------------- */
  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold bg-slate-900 text-white border border-slate-900 shadow-sm transition-colors hover:bg-black focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
      >
        Print RIS Form
      </button>
    </div>
  );
};

export default RISModal;
