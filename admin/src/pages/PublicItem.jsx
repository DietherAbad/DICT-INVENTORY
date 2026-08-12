import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import DICT from "../assets/DICT.png";

const statusStyles = (raw) => {
  const v = String(raw || "").toLowerCase();
  if (v.includes("issued")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (v.includes("in stock") || v.includes("instock"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v.includes("transfer"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (v.includes("disposed"))
    return "bg-gray-100 text-gray-700 border-gray-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
};

export default function PublicItem() {
  const { token } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${BASE_URL}/public/items/${token}`);
        if (!res.ok) {
          const msg =
            res.status === 404
              ? "Item not found."
              : "Unable to load item details.";
          throw new Error(msg);
        }
        const data = await res.json();
        if (!cancelled) setItem(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load item.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-indigo-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center">
                <img src={DICT} alt="DICT" className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  DICT Region 02 Inventory
                </p>
                <p className="text-xs text-slate-500">
                  Public item view
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Admin Login
            </Link>
          </div>

          <div className="px-6 py-6">
            {loading && (
              <div className="animate-pulse space-y-4">
                <div className="h-5 w-2/3 rounded bg-slate-100" />
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
              </div>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {!loading && !error && item && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {item.type || "Inventory Item"}
                    </p>
                    <h1 className="text-2xl font-semibold text-slate-900">
                      {item.itemName || "Unnamed item"}
                    </h1>
                    <p className="text-sm text-slate-600">
                      {item.classification || "Unclassified"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(
                      item.status
                    )}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {item.status || "Unknown"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Property No.
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.property_no || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Serial No.
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.serial_no || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Unit
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.unitofmeasure || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Office / Project
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {item.project || item.stored_to || "—"}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Last updated:{" "}
                  {item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString()
                    : "—"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
