import React, { useEffect, useState } from "react";
import SettingsHeader from "../components/SettingsHeader";
import { BASE_URL } from "../utils/config";

export default function SettingsSeThreshold() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("50000");
  const [settingsVersion, setSettingsVersion] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settings.");
      const data = await res.json();
      const value = Number(data?.se_threshold ?? 50000);
      setThresholdInput(Number.isFinite(value) ? String(value) : "50000");
      setSettingsVersion(data?.__v ?? settingsVersion);
    } catch (err) {
      showToast(err?.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    const parsed = Number(thresholdInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast("Threshold must be a positive number.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          se_threshold: parsed,
          __v: settingsVersion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update settings.");
      setSettingsVersion(data?.__v ?? settingsVersion);
      showToast("Semi-expendable threshold updated.");
    } catch (err) {
      showToast(err?.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "Settings", to: "/settingsdashboard" },
          { label: "SE Threshold" },
        ]}
        title="SE Threshold"
        subtitle="Define threshold values for SE tagging."
      />

      {toast && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Semi-Expendable Threshold</h3>
            <p className="mt-1 text-sm text-gray-600">
              Items below this amount are classified as SE.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSettings}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[220px_1fr] items-end">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Threshold (PHP)
            <input
              type="number"
              min="1"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              disabled={loading}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
            />
          </label>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
            Example: 50000 means items at or above ₱50,000 become PPE and get PPE-* IDs.
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
