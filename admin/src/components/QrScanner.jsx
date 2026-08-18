import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { parseEquipmentQr } from "../utils/gatepass";

/**
 * Camera QR scanner for equipment stickers.
 * onScan({ collection, inventoryId, routeKey, raw })
 */
export default function QrScanner({ onScan, onError }) {
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState(null);
  const scannerRef = useRef(null);
  const lastRaw = useRef("");

  useEffect(() => {
    let cancelled = false;
    const regionId = "gatepass-qr-reader";

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            if (!decoded || decoded === lastRaw.current) return;
            lastRaw.current = decoded;
            const parsed = parseEquipmentQr(decoded);
            if (!parsed) {
              onError?.("QR is not a valid equipment link.");
              return;
            }
            onScan({ ...parsed, raw: decoded });
          },
          () => {}
        );
        if (!cancelled) setScanning(true);
      } catch (err) {
        if (!cancelled) {
          setCamError(err?.message || "Camera unavailable");
          setScanning(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  const handleManual = (e) => {
    e.preventDefault();
    const parsed = parseEquipmentQr(manual);
    if (!parsed) {
      onError?.("Paste a full equipment URL from the QR sticker.");
      return;
    }
    onScan({ ...parsed, raw: manual.trim() });
    setManual("");
  };

  return (
    <div className="w-full border border-gray-200 rounded-lg p-4 bg-white">
      <p className="text-sm font-semibold text-gray-800 mb-2">Scan equipment QR</p>
      <div id="gatepass-qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded" />
      {scanning && (
        <p className="text-xs text-green-700 text-center mt-2">Camera active — point at equipment QR</p>
      )}
      {camError && (
        <p className="text-xs text-amber-700 text-center mt-2">
          Camera: {camError}. You can paste the QR URL below.
        </p>
      )}
      <form onSubmit={handleManual} className="mt-3 flex gap-2">
        <input
          type="text"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or paste /checkitem/... URL"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
        >
          Add
        </button>
      </form>
    </div>
  );
}
