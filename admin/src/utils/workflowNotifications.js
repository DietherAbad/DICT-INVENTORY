import { BASE_URL } from "./config";

const LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Department_of_Information_and_Communications_Technology_%28DICT%29.svg/942px-Department_of_Information_and_Communications_Technology_%28DICT%29.svg.png?20241108070928";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

export const findUserByRoles = (users, roles) => {
  const accepted = new Set((roles || []).map(normalizeRole));
  return (Array.isArray(users) ? users : []).find((candidate) =>
    accepted.has(normalizeRole(candidate?.role || candidate?._role))
  );
};

const emailOf = (record) => record?.email || "";
const nameOf = (record, fallback) =>
  record?.username || record?.name || record?.label || record?.email || fallback;

export async function sendWorkflowActionEmail({
  recipient,
  requestor,
  requestType,
  reference,
  itemSummary,
  status,
  actionLabel,
  instructions,
  message,
  requestId,
  senderName,
}) {
  const to = emailOf(recipient);
  if (!to) return false;

  try {
    const settingsResponse = await fetch(`${BASE_URL}/settings`, {
      credentials: "include",
      silentStatuses: [401, 403],
      suppressErrorToast: true,
    });
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      if (settings?.enable_email === false) return false;
    }
  } catch {
    // Email delivery can still be attempted when settings are temporarily unavailable.
  }

  const requestorEmail = emailOf(requestor);
  const cc =
    requestorEmail && requestorEmail.toLowerCase() !== to.toLowerCase()
      ? [requestorEmail]
      : undefined;
  const portalUrl = requestId
    ? `${window.location.origin}/#/checkform/${requestId}`
    : `${window.location.origin}/#/request`;
  const requestLine = [requestType, reference].filter(Boolean).join(" • ");

  const html = `
    <div style="font-family:Arial,sans-serif; color:#0f172a; background:#f8fafc; padding:24px;">
      <div style="max-width:680px; margin:0 auto;">
        <div style="text-align:center; padding-bottom:16px;">
          <img src="${LOGO_URL}" alt="DICT Logo" style="max-width:120px; height:auto;" />
        </div>
        <div style="background:#fff; border-radius:12px; box-shadow:0 8px 22px rgba(2,6,23,.08); padding:24px;">
          <h2 style="margin:0 0 10px; font-size:20px;">Action required</h2>
          <p style="margin:0 0 10px;">Hello <strong>${escapeHtml(
            nameOf(recipient, "Approver")
          )}</strong>,</p>
          <p style="margin:0 0 8px;">A <strong>${escapeHtml(
            requestLine || "request"
          )}</strong> has been submitted and is waiting for your <strong>${escapeHtml(
            actionLabel || "action"
          )}</strong>.</p>
          ${
            itemSummary
              ? `<p style="margin:0 0 12px; font-size:13px; color:#475569;"><strong>Items:</strong> ${escapeHtml(
                  itemSummary
                )}</p>`
              : ""
          }
          <div style="margin:0 0 14px; padding:12px 14px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px;">
            <div><strong>Current status:</strong> ${escapeHtml(status || "Pending")}</div>
            ${message ? `<div style="margin-top:6px;">${escapeHtml(message)}</div>` : ""}
          </div>
          <div style="margin:0 0 14px; padding:12px 14px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#c2410c;">What you need to do</div>
            <div style="margin-top:5px; color:#7c2d12;">${escapeHtml(
              instructions || "Open the request, review its details and signed document, then complete the required action."
            )}</div>
          </div>
          <div style="font-size:12px; color:#64748b; margin-bottom:16px;">Submitted by: ${escapeHtml(
            senderName || nameOf(requestor, "Requestor")
          )}</div>
          <a href="${escapeHtml(
            portalUrl
          )}" style="display:inline-block; background:#1d4ed8; color:#fff; text-decoration:none; padding:10px 16px; border-radius:6px; font-weight:600;">Review Request</a>
          <p style="margin-top:16px; font-size:12px; color:#64748b;">The requestor is copied on this notification when an email address is available.</p>
        </div>
      </div>
    </div>`;

  const response = await fetch(`${BASE_URL}/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      to,
      cc,
      subject: `Action required — ${requestType || "Inventory Request"}: ${
        reference || "new request"
      } needs your ${actionLabel || "action"}`,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Failed to send workflow notification.");
  }
  return true;
}
