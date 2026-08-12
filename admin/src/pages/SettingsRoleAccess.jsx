// src/pages/SettingsRoleAccess.jsx
import React, { useEffect, useMemo, useState } from "react";
import SettingsHeader from "../components/SettingsHeader";
import { BASE_URL } from "../utils/config";
import {
  ALL_FEATURE_TAGS,
  FEATURE_GROUPS,
  FEATURE_TAGS,
  mergeRoleAccessWithDefaults,
  migrateRoleAccessForClient,
} from "../utils/roleAccess";
import { ALL_ROLES, ROLES, normalizeRole } from "../utils/roles";

export default function SettingsRoleAccess() {
  const [roleAccessMap, setRoleAccessMap] = useState(() =>
    mergeRoleAccessWithDefaults({})
  );
  const [settingsVersion, setSettingsVersion] = useState(null);
  const [selectedRole, setSelectedRole] = useState(ROLES.SUPER_ADMIN);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === "object") {
          setRoleAccessMap(
            migrateRoleAccessForClient(
              data.role_access || {},
              data.role_access_version
            )
          );
          setSettingsVersion(data.__v ?? null);
        }
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  const groupedFeatures = useMemo(() => {
    return FEATURE_GROUPS.map((group) => ({
      group,
      items: FEATURE_TAGS.filter((feature) => feature.group === group),
    })).filter((group) => group.items.length > 0);
  }, []);

  const roleOptions = useMemo(
    () => ALL_ROLES.filter((role) => role !== ROLES.MANAGEMENT),
    []
  );

  useEffect(() => {
    if (selectedRole === ROLES.MANAGEMENT) {
      setSelectedRole(ROLES.SUPER_ADMIN);
    }
  }, [selectedRole]);

  const roleKey = normalizeRole(selectedRole);
  const isSuperAdmin = roleKey === normalizeRole(ROLES.SUPER_ADMIN);
  const selectedAccess = roleAccessMap[roleKey] || [];

  const toggleTag = (tag) => {
    if (isSuperAdmin) return;
    setRoleAccessMap((prev) => {
      const next = { ...prev };
      const current = new Set(next[roleKey] || []);
      if (current.has(tag)) current.delete(tag);
      else current.add(tag);
      next[roleKey] = Array.from(current);
      return mergeRoleAccessWithDefaults(next);
    });
  };

  const resetDefaults = () => {
    setRoleAccessMap(mergeRoleAccessWithDefaults({}));
    setToastMessage("Role access reset to defaults.");
    setTimeout(() => setToastMessage(""), 2500);
  };

  const saveRoleAccess = async () => {
    setSaving(true);
    try {
      const nextMap = mergeRoleAccessWithDefaults(roleAccessMap);
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_access: nextMap, __v: settingsVersion }),
      });
      if (!res.ok) throw new Error("Failed to update role access.");
      const data = await res.json();
      const stored = mergeRoleAccessWithDefaults(data.role_access || nextMap);
      setRoleAccessMap(stored);
      setSettingsVersion(data.__v ?? settingsVersion);
      localStorage.setItem("roleAccess", JSON.stringify(stored));
      setToastMessage("Role access updated.");
      setTimeout(() => setToastMessage(""), 2500);
    } catch {
      setToastMessage("Failed to save role access.");
      setTimeout(() => setToastMessage(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "Users", to: "/userdashboard" },
          { label: "Role Management" },
        ]}
        title="Role Access Control"
        subtitle="Grant or revoke feature access per role."
        rightSlot={<div className="text-xs text-gray-500">{saving ? "Saving…" : ""}</div>}
      />

      {toastMessage && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      

      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
            Roles
          </div>
          <div className="mt-3 space-y-1">
            {roleOptions.map((role) => {
              const isActive = role === selectedRole;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>{role}</span>
                  {normalizeRole(role) === normalizeRole(ROLES.SUPER_ADMIN) && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                      Full
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedRole}</p>
                <p className="text-xs text-gray-500">
                  {selectedAccess.length} of {ALL_FEATURE_TAGS.length} features enabled
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetDefaults}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Reset defaults
                </button>
                <button
                  type="button"
                  onClick={saveRoleAccess}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                  disabled={saving}
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>

          {groupedFeatures.map((group) => (
            <div
              key={group.group}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                {group.group}
              </div>
              <div className="space-y-2">
                {group.items.map((feature) => {
                  const enabled = selectedAccess.includes(feature.tag);
                  return (
                    <button
                      key={feature.tag}
                      type="button"
                      onClick={() => toggleTag(feature.tag)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        enabled
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      } ${isSuperAdmin ? "cursor-not-allowed opacity-80" : ""}`}
                      disabled={isSuperAdmin}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{feature.label}</p>
                        <p className="text-xs text-gray-500">{feature.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-semibold ${
                            enabled ? "text-emerald-700" : "text-gray-400"
                          }`}
                        >
                          {enabled ? "Enabled" : "Disabled"}
                        </span>
                        <span
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            enabled ? "bg-emerald-600" : "bg-gray-300"
                          }`}
                          aria-pressed={enabled}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              enabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
