import React, { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const safeFilePart = (value) =>
  String(value || "employee")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "employee";

const fitText = (context, text, maxWidth, startingSize, weight = 700) => {
  let size = startingSize;
  do {
    context.font = `${weight} ${size}px Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 24);
  return size;
};

export default function EmployeeAssetSticker({ employeeId, name, position }) {
  const qrContainerRef = useRef(null);
  const [downloadError, setDownloadError] = useState("");
  const lookupUrl =
    typeof window === "undefined" || !employeeId
      ? ""
      : `${window.location.origin}/#/employee-asset-lookup?userId=${encodeURIComponent(employeeId)}`;

  const downloadSticker = () => {
    setDownloadError("");
    const qrCanvas = qrContainerRef.current?.querySelector("canvas");
    if (!qrCanvas || !lookupUrl) {
      setDownloadError("The sticker QR is still loading. Please try again.");
      return;
    }

    try {
      // 3.5 x 2 inches at 300 DPI, suitable for a standard identification sticker.
      const width = 1050;
      const height = 600;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable in this browser.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#0f172a";
      context.fillRect(0, 0, width, 92);
      context.fillStyle = "#2563eb";
      context.fillRect(0, 92, 18, height - 92);

      context.fillStyle = "#ffffff";
      context.font = "700 28px Arial, sans-serif";
      context.fillText("DICT REGION 2 INVENTORY", 50, 58);

      const employeeName = String(name || "Employee").trim();
      const employeePosition = String(position || "Position not specified").trim();
      const textWidth = 585;
      const nameSize = fitText(context, employeeName, textWidth, 58, 800);
      context.fillStyle = "#0f172a";
      context.font = `800 ${nameSize}px Arial, sans-serif`;
      context.fillText(employeeName, 62, 218);

      const positionSize = fitText(context, employeePosition, textWidth, 34, 500);
      context.fillStyle = "#475569";
      context.font = `500 ${positionSize}px Arial, sans-serif`;
      context.fillText(employeePosition, 62, 280);

      context.fillStyle = "#dbeafe";
      context.fillRect(62, 344, 520, 2);
      context.fillStyle = "#1d4ed8";
      context.font = "700 24px Arial, sans-serif";
      context.fillText("SCAN TO VIEW ASSIGNED ASSETS", 62, 402);
      context.fillStyle = "#64748b";
      context.font = "400 20px Arial, sans-serif";
      context.fillText("Authorized inventory personnel only", 62, 442);

      context.fillStyle = "#f8fafc";
      context.fillRect(650, 118, 350, 410);
      context.strokeStyle = "#e2e8f0";
      context.lineWidth = 3;
      context.strokeRect(650, 118, 350, 410);
      context.drawImage(qrCanvas, 687, 148, 276, 276);
      context.fillStyle = "#334155";
      context.font = "700 19px Arial, sans-serif";
      context.textAlign = "center";
      context.fillText("EMPLOYEE ASSET LOOKUP", 825, 474);
      context.textAlign = "left";

      const link = document.createElement("a");
      link.download = `${safeFilePart(employeeName)}-asset-sticker.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setDownloadError(error?.message || "Unable to create the sticker download.");
    }
  };

  if (!employeeId) return null;

  return (
    <>
      <div ref={qrContainerRef} className="fixed -left-[9999px] top-0" aria-hidden="true">
        <QRCodeCanvas
          value={lookupUrl}
          size={512}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#0f172a"
        />
      </div>
      <button
        type="button"
        onClick={downloadSticker}
        className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 sm:text-sm"
        title="Download an employee asset lookup sticker"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Download asset sticker
      </button>
      {downloadError && (
        <span className="basis-full text-xs font-medium text-rose-600" role="alert">
          {downloadError}
        </span>
      )}
    </>
  );
}
