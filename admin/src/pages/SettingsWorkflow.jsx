// src/pages/SettingsWorkflow.jsx
import React, { useEffect, useState } from "react";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";
import ModalShell from "../components/ModalShell";

export default function SettingsWorkflow() {
  const [settings, setSettings] = useState({
    enable_signed_download: true,
    enable_signed_upload: true,
    enable_email: true,
    cleanup_pending_enabled: true,
    cleanup_pending_days: 14,
    __v: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKey, setConfirmKey] = useState("");
  const [confirmNext, setConfirmNext] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [cleanupDaysInput, setCleanupDaysInput] = useState("14");

  const persistEmailSettings = (payload) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("systemSettings");
      const stored = raw ? JSON.parse(raw) : {};
      const merged = {
        ...stored,
        enable_email: payload.enable_email,
        enable_signed_download: payload.enable_signed_download,
        enable_signed_upload: payload.enable_signed_upload,
      };
      localStorage.setItem("systemSettings", JSON.stringify(merged));
      window.dispatchEvent(
        new CustomEvent("settings:email", {
          detail: { enable_email: payload.enable_email },
        })
      );
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BASE_URL}/settings`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === "object") {
          setSettings((prev) => ({
            ...prev,
            enable_signed_download:
              data.enable_signed_download ?? prev.enable_signed_download,
            enable_signed_upload:
              data.enable_signed_upload ?? prev.enable_signed_upload,
            enable_email: data.enable_email ?? prev.enable_email,
            cleanup_pending_enabled:
              data.cleanup_pending_enabled ?? prev.cleanup_pending_enabled,
            cleanup_pending_days:
              data.cleanup_pending_days ?? prev.cleanup_pending_days,
            __v: data.__v ?? prev.__v,
          }));
          persistEmailSettings({
            enable_email: data.enable_email ?? true,
            enable_signed_download: data.enable_signed_download ?? true,
            enable_signed_upload: data.enable_signed_upload ?? true,
          });
        }
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  useEffect(() => {
    setCleanupDaysInput(String(settings.cleanup_pending_days ?? 14));
  }, [settings.cleanup_pending_days]);

  const updateSettings = async (next) => {
    const prev = settings;
    setSettings(next);
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to update settings.");
      }
      const data = await res.json();
      setSettings((current) => ({
        ...current,
        enable_signed_download:
          data.enable_signed_download ?? current.enable_signed_download,
        enable_signed_upload:
          data.enable_signed_upload ?? current.enable_signed_upload,
        enable_email: data.enable_email ?? current.enable_email,
        cleanup_pending_enabled:
          data.cleanup_pending_enabled ?? current.cleanup_pending_enabled,
        cleanup_pending_days:
          data.cleanup_pending_days ?? current.cleanup_pending_days,
        __v: data.__v ?? current.__v,
      }));
      persistEmailSettings({
        enable_email: data.enable_email ?? next.enable_email,
        enable_signed_download: data.enable_signed_download ?? next.enable_signed_download,
        enable_signed_upload: data.enable_signed_upload ?? next.enable_signed_upload,
      });
      return true;
    } catch (err) {
      setSettings(prev);
      setToastMessage(err?.message || "Failed to update settings.");
      setTimeout(() => setToastMessage(""), 2500);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openConfirm = (key) => {
    if (saving) return;
    setConfirmKey(key);
    setConfirmNext(!settings[key]);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmKey || saving) return;
    const next = { ...settings, [confirmKey]: confirmNext };
    const ok = await updateSettings(next);
    if (ok) {
      setConfirmOpen(false);
      setConfirmKey("");
      setToastMessage(
        `${confirmKey.replace(/_/g, " ")} ${confirmNext ? "enabled" : "disabled"}.`
      );
      setTimeout(() => setToastMessage(""), 2500);
    }
  };

  const handleCancel = () => {
    if (saving) return;
    setConfirmOpen(false);
    setConfirmKey("");
  };

  const handleCleanupDaysSave = async () => {
    if (saving) return;
    const normalized = Math.max(
      1,
      Number.parseInt(cleanupDaysInput || "", 10) || 1
    );
    const next = { ...settings, cleanup_pending_days: normalized };
    const ok = await updateSettings(next);
    if (ok) {
      setToastMessage(`cleanup pending days set to ${normalized}.`);
      setTimeout(() => setToastMessage(""), 2500);
    }
  };

  const SettingCard = ({ title, description, enabled, onToggle, tone, disabled }) => (
    <div className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
            {tone}
          </p>
          <h3 className="mt-2 text-lg font-bold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div
          className={`h-10 w-10 rounded-xl ring-1 ${
            enabled
              ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
              : "bg-gray-100 text-gray-400 ring-gray-200"
          } grid place-items-center`}
          aria-hidden="true"
        >
          {enabled ? "✓" : "–"}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <span className="text-xs font-semibold text-gray-600">
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
              enabled ? "bg-emerald-600" : "bg-gray-300"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            aria-pressed={enabled}
            title={enabled ? "Click to disable" : "Click to enable"}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
              enabled
                ? "bg-gray-900 text-white hover:bg-black"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            title={enabled ? "Disable" : "Enable"}
          >
            <span aria-hidden="true">⏻</span>
            {enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <SettingsHeader
          crumbs={[
            { label: "Settings", to: "/settingsdashboard" },
            { label: "Workflow Settings" },
          ]}
          title="Workflow Settings"
          subtitle="Manage approval workflow controls for signatures and emails."
          rightSlot={saving ? <span className="text-[10px] text-gray-400">Saving…</span> : null}
        />
        {toastMessage && (
          <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            {toastMessage}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <SettingCard
            title="Signed File Upload"
            description="Require approvers to upload signed RIS/PTR before they can approve."
            enabled={settings.enable_signed_upload}
            onToggle={() => openConfirm("enable_signed_upload")}
            tone="Approvals"
            disabled={saving}
          />
          <SettingCard
            title="Email Notifications"
            description="Send email updates during approval workflows and edits."
            enabled={settings.enable_email}
            onToggle={() => openConfirm("enable_email")}
            tone="Comms"
            disabled={saving}
          />
          <SettingCard
            title="Auto-decline stale requests"
            description="Automatically close pending requests after the cleanup window."
            enabled={settings.cleanup_pending_enabled}
            onToggle={() => openConfirm("cleanup_pending_enabled")}
            tone="Governance"
            disabled={saving}
          />
          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                Policy
              </p>
              <h3 className="mt-2 text-lg font-bold text-gray-900">
                Cleanup window (days)
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Pending requests older than this will be marked as declined.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="1"
                value={cleanupDaysInput}
                onChange={(event) => setCleanupDaysInput(event.target.value)}
                disabled={saving}
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCleanupDaysSave}
                disabled={saving}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
              >
                {saving ? "Saving..." : "Update window"}
              </button>
              <span className="text-xs text-gray-500">
                Minimum 1 day. Changes apply on the next cleanup run.
              </span>
            </div>
          </div>
        </div>
      </div>

      <ModalShell
        open={confirmOpen}
        title="Confirm setting change"
        subtitle="Workflow Controls"
        variant={confirmNext ? "warning" : "danger"}
        onClose={handleCancel}
        maxWidthClass="max-w-sm"
      >
        <p className="text-xs text-gray-600">
          {confirmNext ? "Enable" : "Disable"} {confirmKey.replace(/_/g, " ")}?
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            {saving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </ModalShell>
    </>
  );
}
