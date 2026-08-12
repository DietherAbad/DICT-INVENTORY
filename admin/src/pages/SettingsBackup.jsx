import React, { useEffect, useMemo, useState } from "react";
import SettingsHeader from "../components/SettingsHeader";
import ModalShell from "../components/ModalShell";
import { BASE_URL } from "../utils/config";

const formatBytes = (value) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const num = size / 1024 ** idx;
  return `${num.toFixed(num >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export default function SettingsBackup() {
  const [backups, setBackups] = useState([]);
  const [retentionDays, setRetentionDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, mode: "", target: null });

  const confirmLabel = useMemo(() => {
    if (!confirm.open) return "";
    if (confirm.mode === "upload") return confirm.target?.name || "uploaded backup";
    return confirm.target || "selected backup";
  }, [confirm]);

  const loadBackups = async ({ silent } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/backup`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load backups.");
      }
      const list = Array.isArray(data?.data) ? data.data : [];
      setBackups(list);
      setRetentionDays(
        Number.isFinite(Number(data?.retentionDays))
          ? Number(data.retentionDays)
          : null
      );
    } catch (err) {
      setError(err?.message || "Failed to load backups.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${BASE_URL}/backup/create`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to create backup.");
      }
      const name = data?.backup?.name;
      setMessage(name ? `Backup created: ${name}` : "Backup created.");
      await loadBackups({ silent: true });
    } catch (err) {
      setError(err?.message || "Failed to create backup.");
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (name) => {
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${BASE_URL}/backup/download/${encodeURIComponent(name)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to download backup.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || "Failed to download backup.");
    }
  };

  const openConfirm = (mode, target) => {
    setConfirm({ open: true, mode, target });
  };

  const closeConfirm = () => {
    setConfirm({ open: false, mode: "", target: null });
  };

  const handleRestore = async () => {
    if (!confirm.target) return;
    setRestoring(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      if (confirm.mode === "upload") {
        form.append("file", confirm.target);
      } else {
        form.append("filename", confirm.target);
      }
      const res = await fetch(`${BASE_URL}/backup/restore`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to restore backup.");
      }
      setMessage(data?.message || `Restore completed from ${confirmLabel}.`);
      setSelectedFile(null);
      await loadBackups({ silent: true });
    } catch (err) {
      setError(err?.message || "Failed to restore backup.");
    } finally {
      setRestoring(false);
      closeConfirm();
    }
  };

  const retentionLabel =
    retentionDays && retentionDays > 0
      ? `${retentionDays} days`
      : "Set via BACKUP_RETENTION_DAYS";

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-gray-50">
      <section className="w-full py-16 px-4 sm:px-6 lg:px-8">
        <SettingsHeader
          crumbs={[
            { label: "Settings", to: "/settingsdashboard" },
            { label: "Backup & Restore" },
          ]}
          title="Database Backup & Restore"
          subtitle="Create snapshots and restore from trusted backups."
          rightSlot={
            <button
              type="button"
              onClick={() => loadBackups({ silent: true })}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50"
            >
              {refreshing ? "Refreshing..." : "Refresh list"}
            </button>
          }
        />

        {(message || error) && (
          <div
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Backup Now
                </p>
                <h2 className="mt-2 text-lg font-bold text-gray-900">
                  Create a fresh snapshot
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  This captures the entire database and stores it on the server.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                Retention: {retentionLabel}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {creating ? "Creating backup..." : "Create backup"}
              </button>
              <p className="text-xs text-gray-500">
                Tip: download a copy to your local machine after creation.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
                Restore
              </p>
              <h2 className="mt-2 text-lg font-bold text-amber-900">
                Restore from uploaded backup
              </h2>
              <p className="mt-1 text-sm text-amber-700">
                Upload a `.gz` archive created by `mongodump --archive --gzip`.
                Restoring replaces current data.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <input
                type="file"
                accept=".gz"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900 shadow-sm"
              />
              <button
                type="button"
                onClick={() => openConfirm("upload", selectedFile)}
                disabled={!selectedFile || restoring}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {restoring ? "Restoring..." : "Upload & restore"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Backup history</h2>
              <p className="mt-1 text-sm text-gray-600">
                Stored backups on the server. Click download to keep a local copy.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {backups.length} saved
            </span>
          </div>

          {loading ? (
            <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              Loading backups...
            </div>
          ) : backups.length ? (
            <div className="mt-6 divide-y divide-gray-100">
              {backups.map((backup, index) => (
                <div
                  key={backup.name}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{backup.name}</p>
                      {index === 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Created: {formatDate(backup.createdAt)}</span>
                      <span>Size: {formatBytes(backup.size)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(backup.name)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfirm("existing", backup.name)}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              No backups yet. Create your first backup above.
            </div>
          )}
        </div>
      </section>

      <ModalShell
        open={confirm.open}
        title="Confirm restore"
        subtitle="Backup & Restore"
        variant="warning"
        onClose={closeConfirm}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3 text-sm text-gray-700">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            This will overwrite the current database with{" "}
            <span className="font-semibold text-amber-900">{confirmLabel}</span>.
            Active sessions may be reset after the restore completes.
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeConfirm}
              className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              disabled={restoring}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
              disabled={restoring}
            >
              {restoring ? "Restoring..." : "Restore now"}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
