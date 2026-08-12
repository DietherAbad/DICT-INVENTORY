// utils/emailTemplates.js
// Flexible email template module for DICT Inventory System.
// Add more templates to `templates` as needed.

// ---- helpers -------------------------------------------------------------
const currencyPH = (value) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value || 0)
  );

const dateNice = (value) => {
  try {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value || "";
  }
};

const FALLBACK_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Department_of_Information_and_Communications_Technology_%28DICT%29.svg/942px-Department_of_Information_and_Communications_Technology_%28DICT%29.svg.png?20241108070928";

// Shared visual wrapper
const wrap = ({ logoUrl, title, innerHtml, ctaHref, ctaText, accentColor = "#1e3a8a" }) => {
  const safeLogoUrl = FALLBACK_LOGO_URL;
  return `
  <div style="font-family: Arial, sans-serif; color: #1f2937; background-color: #f4f6f8; padding: 24px;">
    <div style="max-width: 680px; margin: 0 auto;">
      <!-- Header -->
      <div style="text-align:center; padding-bottom: 20px;">
        <img src="${safeLogoUrl}" alt="DICT Logo" style="max-width: 140px; height:auto;" />
      </div>

      <!-- Card -->
      <div style="background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(2, 6, 23, 0.08); overflow:hidden;">
        <div style="height:6px; background:${accentColor};"></div>
        <div style="padding: 26px 28px;">
        <h1 style="font-size: 22px; color: #0f172a; margin: 0 0 16px 0; text-align:center;">${title}</h1>

        <div style="font-size: 15px; line-height: 1.6; color:#334155;">
          ${innerHtml}
        </div>

        ${ctaHref ? `
          <div style="text-align:center; margin-top: 24px;">
            <a href="${ctaHref}" style="display:inline-block; background:${accentColor}; color:#ffffff; text-decoration:none; padding: 11px 20px; border-radius: 10px; font-weight: 700;">
              ${ctaText || "Open Portal"}
            </a>
          </div>
        ` : ""}
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center; color:#64748b; font-size:12px; margin-top: 18px;">
        <div>&copy; ${new Date().getFullYear()} Department of Information and Communications Technology (DICT).</div>
        <div>This message was sent automatically by the DICT Inventory System.</div>
      </div>
    </div>
  </div>
`;
};

/* =========================================================
   TEMPLATE: User Welcome (Account Created)
   - Includes the initial password and a reminder to change it
   ========================================================= */
const userWelcome = ({
  logoUrl,
  portalUrl,
  recipientName,
  recipientEmail,
  initialPassword,
}) => {
  const innerHtml = `
    <p style="margin:0 0 10px 0;">Good day <strong>${recipientName || "Colleague"}</strong>,</p>
    <p style="margin:0 0 14px 0;">Your account for the <strong>DICT Region 2 Inventory System</strong> is ready. Use the details below to sign in.</p>

    <div style="margin: 16px 0 12px 0; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
      <div style="background:#1e3a8a; color:#ffffff; padding:10px 14px; font-size:13px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;">
        Login details
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:14px;">
        <tbody>
          <tr>
            <td style="padding:12px 14px; background:#f8fafc; width:40%; font-weight:600; border-bottom:1px solid #e5e7eb;">Email</td>
            <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; color:#0f172a;">${recipientEmail || "—"}</td>
          </tr>
          <tr>
            <td style="padding:12px 14px; background:#f1f5f9; width:40%; font-weight:600;">Initial Password</td>
            <td style="padding:12px 14px; color:#0f172a;"><strong>${initialPassword || "—"}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p style="margin:12px 0 0 0;">
      <strong>Important:</strong> Please <strong>change your password immediately after logging in</strong>.
    </p>
    <p style="margin:6px 0 0 0; color:#475569;">If you didn’t request this account, kindly contact the administrator.</p>
  `;

  return wrap({
    logoUrl,
    title: "Welcome to DICT Region 2 Inventory System",
    innerHtml,
    ctaHref: portalUrl,
    ctaText: "Go to Login",
    accentColor: "#1e3a8a",
  });
};

/* =========================================================
   TEMPLATE: Item Issued Notification
   ========================================================= */
const inventoryIssued = ({ logoUrl, recipientName, item = {}, portalUrl }) => {
  const rows = [
    ["Item Name", item.itemName],
    ["Classification", item.classification],
    ["Project", item.project || "—"],
    ["Stored To", item.stored_to || "—"],
    ["Issued Status", item.status || "Issued"],
    ["Quantity", item.qty],
    ["Unit of Measure", item.unitofmeasure || "—"],
    ["Unit Cost", currencyPH(item.unit_cost)],
    ["Total Cost", currencyPH(item.total_cost ?? Number(item.unit_cost || 0) * Number(item.qty || 0))],
    ["Serial No.", item.serial_no || "—"],
    ["Inclusions", item.inclusions || "—"],
    ["Purchase Date", dateNice(item.date_acquired)],
    ["Date Issued", dateNice(item.date_issued)],
    ["Remarks", item.remarks || "—"],
  ];

  const tableRows = rows
    .map(
      ([k, v], idx) => `
      <tr>
        <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; ${idx % 2 === 1 ? "background:#f1f5f9;" : "background:#f8fafc;"} width: 40%; font-weight:600;">${k}</td>
        <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; color:#0f172a;">${v ?? ""}</td>
      </tr>
    `
    )
    .join("");

  const innerHtml = `
    <p style="margin:0 0 10px 0;">Good day <strong>${recipientName || "Colleague"}</strong>,</p>
    <p style="margin:0 0 16px 0;">The following item has been <strong>issued to you</strong> via the DICT Region 2 Inventory System.</p>

    <div style="overflow:hidden; border: 1px solid #e5e7eb; border-radius: 10px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:14px;">
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <p style="margin:16px 0 0 0;">If something looks incorrect, kindly contact the inventory administrator.</p>
  `;

  return wrap({
    logoUrl,
    title: "Item Issued Notification",
    innerHtml,
    ctaHref: portalUrl,
    ctaText: "Open Inventory Portal",
  });
};

/* =========================================================
   TEMPLATE: Item Transfer Notification
   ========================================================= */
const inventoryTransfer = ({
  logoUrl,
  portalUrl,
  item = {},
  fromUser = {}, // { name, email }
  toUser = {},   // { name, email }
  date_requested,
  reason,
}) => {
  const rowsPrimary = [
    ["Item Name", item.itemName],
    ["Classification", item.classification],
    ["Project", item.project || "—"],
    ["Property No.", item.property_no || "—"],
    ["Serial No.", item.serial_no || "—"],
    ["Quantity", item.qty],
    ["Unit of Measure", item.unitofmeasure || "—"],
    ["Unit Cost", currencyPH(item.unit_cost)],
    ["Total Cost", currencyPH(Number(item.qty) * Number(item.unit_cost || 0))],
    ["Stored To", item.stored_to || "—"],
    ["Current Status", item.status || "For Transfer"],
    ["Date Requested", dateNice(date_requested)],
    ["Reason", reason || "—"],
  ];

  const rowsPeople = [
    ["Transfer From", fromUser?.name ? `${fromUser.name}${fromUser.email ? ` <${fromUser.email}>` : ""}` : "—"],
    ["Transfer To", toUser?.name ? `${toUser.name}${toUser.email ? ` <${toUser.email}>` : ""}` : "—"],
  ];

  const tr = (k, v, altBg = false) => `
    <tr>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; ${altBg ? "background:#f1f5f9;" : "background:#f8fafc;"} width: 40%; font-weight:600;">${k}</td>
      <td style="padding:10px 12px; border-bottom:1px solid #e5e7eb; color:#0f172a;">${v ?? ""}</td>
    </tr>
  `;

  const innerHtml = `
    <p style="margin:0 0 10px 0;">Good day <strong>${toUser?.name || "Colleague"}</strong>,</p>
    <p style="margin:0 0 16px 0;">An <strong>item transfer</strong> has been initiated in the DICT Region 2 Inventory System. Please review the details below.</p>

    <div style="overflow:hidden; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:14px;">
        <tbody>
          ${rowsPrimary.map(([k, v], idx) => tr(k, v, idx % 2 === 1)).join("")}
        </tbody>
      </table>
    </div>

    <div style="overflow:hidden; border: 1px solid #e5e7eb; border-radius: 10px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:14px;">
        <tbody>
          ${rowsPeople.map(([k, v], idx) => tr(k, v, idx % 2 === 1)).join("")}
        </tbody>
      </table>
    </div>

    <p style="margin:16px 0 0 0;">If you have concerns, kindly contact the inventory administrator.</p>
  `;

  return wrap({
    logoUrl,
    title: "Item Transfer Notification",
    innerHtml,
    ctaHref: portalUrl,
    ctaText: "Open Inventory Portal",
  });
};

// Register templates here
const templates = {
  userWelcome,
  inventoryIssued,
  inventoryTransfer,
};

// Render function
export default function renderTemplate(name, data) {
  const fn = templates[name];
  if (!fn) {
    throw new Error(`Unknown email template: ${name}`);
  }
  return fn(data || {});
}

export { templates, userWelcome, inventoryIssued, inventoryTransfer, currencyPH, dateNice, wrap };
