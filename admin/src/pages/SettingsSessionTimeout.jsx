// src/pages/SettingsSessionTimeout.jsx
import React, { useEffect, useMemo, useState } from "react";
import SettingsHeader from "../components/SettingsHeader";
import { BASE_URL } from "../utils/config";

const DEFAULT_MINUTES = 30;

const splitMinutes = (total) => {
  const safe = Number.isFinite(total) && total > 0 ? total : DEFAULT_MINUTES;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return { hours, minutes };
};

const clampNumber = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(Math.max(num, min), max);
};

const persistSessionSettings = (payload) => {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("systemSettings");
    const stored = raw ? JSON.parse(raw) : {};
    const merged = { ...stored, ...payload };
    localStorage.setItem("systemSettings", JSON.stringify(merged));
  } catch {
    localStorage.setItem("systemSettings", JSON.stringify(payload));
  }
  window.dispatchEvent(
    new CustomEvent("settings:session-timeout", { detail: payload })
  );
};

export default function SettingsSessionTimeout() {
  const [enabled, setEnabled] = useState(true);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [version, setVersion] = useState(undefined);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const total = Number(data?.session_timeout_minutes ?? DEFAULT_MINUTES);
        const parts = splitMinutes(total);
        setEnabled(Boolean(data?.session_timeout_enabled ?? true));
        setHours(parts.hours);
        setMinutes(parts.minutes);
        setVersion(data?.__v);
      } catch {
        // fallback to defaults
      }
    };
    load();
  }, []);

  const totalMinutes = useMemo(() => {
    const safeHours = clampNumber(hours, 0, 12);
    const safeMinutes = clampNumber(minutes, 0, 59);
    const total = safeHours * 60 + safeMinutes;
    return total > 0 ? total : DEFAULT_MINUTES;
  }, [hours, minutes]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        session_timeout_enabled: enabled,
        session_timeout_minutes: totalMinutes,
        __v: version,
      };
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save session timeout.");
      const data = await res.json();
      const total = Number(data?.session_timeout_minutes ?? totalMinutes);
      const parts = splitMinutes(total);
      setEnabled(Boolean(data?.session_timeout_enabled ?? enabled));
      setHours(parts.hours);
      setMinutes(parts.minutes);
      setVersion(data?.__v);
      setToast("Session timeout updated.");
      persistSessionSettings({
        session_timeout_enabled: Boolean(data?.session_timeout_enabled ?? enabled),
        session_timeout_minutes: total,
      });
    } catch {
      setToast("Failed to save changes.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2500);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "Settings", to: "/settingsdashboard" },
          { label: "Session Timeout" },
        ]}
        title="Session Timeout"
        subtitle="Automatically sign out users after inactivity."
        rightSlot={
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-black disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        }
      />

      {toast && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Inactivity timer
            </p>
            <p className="text-sm text-gray-600">
              Toggle this off to keep sessions open.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${
              enabled ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold text-gray-700">Duration</p>
            <p className="mt-1 text-[11px] text-gray-500">
              Set hours and minutes before auto logout.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={12}
                  disabled={!enabled}
                  value={hours}
                  onChange={(e) => setHours(clampNumber(e.target.value, 0, 12))}
                  className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
                />
                <span className="text-xs text-gray-500">hours</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={59}
                  disabled={!enabled}
                  value={minutes}
                  onChange={(e) => setMinutes(clampNumber(e.target.value, 0, 59))}
                  className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
                />
                <span className="text-xs text-gray-500">minutes</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              Total: <span className="font-semibold">{totalMinutes} minutes</span>
            </p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-4 text-xs text-indigo-700">
            <p className="font-semibold text-indigo-800">Guidelines</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Recommended range: 15-60 minutes for shared devices.</li>
              <li>Shorter timeouts reduce risk on unattended sessions.</li>
              <li>Changes apply immediately after saving.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
