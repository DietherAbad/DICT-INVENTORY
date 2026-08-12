import React, { useEffect, useMemo, useState } from "react";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";

export default function SettingsDesignations() {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDesignation, setNewDesignation] = useState("");
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const loadDesignations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/designations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load designations.");
      const data = await res.json();
      setDesignations(Array.isArray(data) ? data : []);
    } catch (err) {
      setToast("Failed to load designations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDesignations();
  }, []);

  const activeItems = useMemo(
    () => designations.filter((d) => d.active),
    [designations]
  );
  const inactiveItems = useMemo(
    () => designations.filter((d) => !d.active),
    [designations]
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleCreate = async () => {
    const name = newDesignation.trim();
    if (!name) {
      showToast("Enter a designation.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/designations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add designation.");
      setNewDesignation("");
      await loadDesignations();
      showToast("Designation added.");
    } catch (err) {
      showToast(err?.message || "Failed to add designation.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditingName(item.name || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (item) => {
    const name = editingName.trim();
    if (!name) {
      showToast("Designation name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/designations/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update designation.");
      await loadDesignations();
      showToast("Designation updated.");
      cancelEdit();
    } catch (err) {
      showToast(err?.message || "Failed to update designation.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    if (!item?._id) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/designations/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !item.active }),
      });
      if (!res.ok) throw new Error("Failed to update designation.");
      await loadDesignations();
      showToast(item.active ? "Designation archived." : "Designation activated.");
    } catch (err) {
      showToast(err?.message || "Failed to update designation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "User Management", to: "/userdashboard" },
          { label: "Office/Designation" },
        ]}
        title="Office Designations"
        subtitle="Manage office/designation options used in registration and storage."
        rightSlot={
          <button
            type="button"
            onClick={loadDesignations}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        }
      />

      {toast && (
        <div className="fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={newDesignation}
            onChange={(e) => setNewDesignation(e.target.value)}
            placeholder="Add new office/designation"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add office/designation"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Tip: You can deactivate an office/designation instead of deleting it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Active offices/designations</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              {activeItems.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : activeItems.length === 0 ? (
              <p className="text-xs text-gray-500">No active offices/designations.</p>
            ) : (
              activeItems.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  {editingId === item._id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-800">
                      {item.name}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {editingId === item._id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(item)}
                          disabled={saving}
                          className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-gray-600"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(item)}
                          className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-semibold text-rose-700"
                        >
                          Deactivate
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Inactive offices/designations</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              {inactiveItems.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : inactiveItems.length === 0 ? (
              <p className="text-xs text-gray-500">No inactive offices/designations.</p>
            ) : (
              inactiveItems.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2"
                >
                  {editingId === item._id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-700">
                      {item.name}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {editingId === item._id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(item)}
                          disabled={saving}
                          className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-gray-600"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(item)}
                          className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-700"
                        >
                          Activate
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
