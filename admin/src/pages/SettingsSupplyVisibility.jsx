import React, { useEffect, useMemo, useState } from "react";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";
import { ALL_ROLES, normalizeRole } from "../utils/roles";

export default function SettingsSupplyVisibility() {
  const [settings, setSettings] = useState({
    hide_supply_quantities: false,
    hide_supply_quantity_roles: ["super admin", "inventory admin", "afd"],
    __v: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const roles = useMemo(() => ALL_ROLES, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setSettings((prev) => ({
          ...prev,
          hide_supply_quantities:
            data.hide_supply_quantities ?? prev.hide_supply_quantities,
          hide_supply_quantity_roles:
            data.hide_supply_quantity_roles ?? prev.hide_supply_quantity_roles,
          __v: data.__v ?? prev.__v,
        }));
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const saveSettings = async (next) => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Failed to update visibility settings.");
      const data = await res.json();
      setSettings((prev) => ({
        ...prev,
        hide_supply_quantities:
          data.hide_supply_quantities ?? prev.hide_supply_quantities,
        hide_supply_quantity_roles:
          data.hide_supply_quantity_roles ?? prev.hide_supply_quantity_roles,
        __v: data.__v ?? prev.__v,
      }));
      showToast("Visibility settings updated.");
    } catch {
      showToast("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = () => {
    const next = {
      ...settings,
      hide_supply_quantities: !settings.hide_supply_quantities,
    };
    setSettings(next);
    saveSettings(next);
  };

  const toggleRole = (roleLabel) => {
    const roleKey = normalizeRole(roleLabel);
    if (!roleKey) return;
    const current = Array.isArray(settings.hide_supply_quantity_roles)
      ? settings.hide_supply_quantity_roles
      : [];
    const has = current.includes(roleKey);
    const nextRoles = has ? current.filter((r) => r !== roleKey) : [...current, roleKey];
    const next = { ...settings, hide_supply_quantity_roles: nextRoles };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "Settings", to: "/settingsdashboard" },
          { label: "Supply Quantity Visibility" },
        ]}
        title="Supply Quantity Visibility"
        subtitle="Hide supply quantities and control who can view values."
        rightSlot={
          <button
            type="button"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-black disabled:opacity-60"
          >
            {saving ? "Saving..." : "Auto-save"}
          </button>
        }
      />

      {toast && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Hide supply quantities</p>
            <p className="text-xs text-gray-500">
              When enabled, quantity values are masked for disallowed roles.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleVisibility}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              settings.hide_supply_quantities ? "bg-emerald-600" : "bg-gray-300"
            }`}
            aria-pressed={settings.hide_supply_quantities}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                settings.hide_supply_quantities ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            Allowed Roles
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {roles.map((roleLabel) => {
              const roleKey = normalizeRole(roleLabel);
              const isChecked = Array.isArray(settings.hide_supply_quantity_roles)
                ? settings.hide_supply_quantity_roles.includes(roleKey)
                : false;
              return (
                <label
                  key={roleKey}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm text-gray-700"
                >
                  <span>{roleLabel}</span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleRole(roleLabel)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
