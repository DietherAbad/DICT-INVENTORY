// src/pages/SettingsRequestLimits.jsx
import React, { useEffect, useMemo, useState } from "react";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";
import { ALL_ROLES, normalizeRole } from "../utils/roles";

const DEFAULT_LIMIT = 5;

export default function SettingsRequestLimits() {
  const [limits, setLimits] = useState({
    defaultLimit: DEFAULT_LIMIT,
    byRole: {},
    __v: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const roles = useMemo(() => ALL_ROLES, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`);
        if (!res.ok) return;
        const data = await res.json();
        setLimits({
          defaultLimit:
            Number(data?.distribution_request_limit_default ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
          byRole: data?.distribution_request_limit_by_role || {},
          __v: data?.__v,
        });
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        distribution_request_limit_default: limits.defaultLimit,
        distribution_request_limit_by_role: limits.byRole,
        __v: limits.__v,
      };
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save limits.");
      const data = await res.json();
      setLimits({
        defaultLimit:
          Number(data?.distribution_request_limit_default ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
        byRole: data?.distribution_request_limit_by_role || {},
        __v: data?.__v,
      });
      setToastMessage("Request limits updated.");
      setTimeout(() => setToastMessage(""), 2500);
    } catch {
      setToastMessage("Failed to save changes.");
      setTimeout(() => setToastMessage(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  const updateDefault = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1) {
      setLimits((prev) => ({ ...prev, defaultLimit: DEFAULT_LIMIT }));
      return;
    }
    setLimits((prev) => ({ ...prev, defaultLimit: Math.floor(num) }));
  };

  const setRoleOverride = (roleKey, enabled) => {
    setLimits((prev) => {
      const next = { ...prev.byRole };
      if (enabled) {
        next[roleKey] = prev.byRole?.[roleKey] ?? prev.defaultLimit;
      } else {
        delete next[roleKey];
      }
      return { ...prev, byRole: next };
    });
  };

  const setRoleLimit = (roleKey, value) => {
    setLimits((prev) => ({
      ...prev,
      byRole: {
        ...prev.byRole,
        [roleKey]: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "Settings", to: "/settingsdashboard" },
          { label: "Request Limits" },
        ]}
        title="Pending Request Limits"
        subtitle="Control how many pending supply requests each role can have at once."
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

      {toastMessage && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Default Limit
            </p>
            <p className="text-sm text-gray-600">
              Used when a role has no custom override.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={limits.defaultLimit}
              onChange={(e) => updateDefault(e.target.value)}
              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900"
            />
            <span className="text-xs text-gray-500">pending requests</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => {
          const roleKey = normalizeRole(role);
          const hasOverride = Object.prototype.hasOwnProperty.call(limits.byRole, roleKey);
          const currentValue = limits.byRole?.[roleKey];
          const isUnlimited = currentValue === -1;

          return (
            <div
              key={roleKey}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{role}</h3>
                  <p className="text-xs text-gray-500">
                    {hasOverride
                      ? isUnlimited
                        ? "Unlimited pending requests."
                        : `Custom limit: ${currentValue} pending.`
                      : `Uses default limit (${limits.defaultLimit}).`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleOverride(roleKey, !hasOverride)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    hasOverride
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {hasOverride ? "Override on" : "Use default"}
                </button>
              </div>

              {hasOverride && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRoleLimit(roleKey, isUnlimited ? limits.defaultLimit : -1)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                      isUnlimited
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {isUnlimited ? "Unlimited" : "Set unlimited"}
                  </button>

                  {!isUnlimited && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={Number(currentValue || limits.defaultLimit)}
                        onChange={(e) =>
                          setRoleLimit(roleKey, Math.max(1, Number(e.target.value || 1)))
                        }
                        className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900"
                      />
                      <span className="text-xs text-gray-500">pending</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
