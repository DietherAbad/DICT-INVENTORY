import React, { useEffect, useMemo, useState } from "react";
import { BASE_URL } from "../utils/config";
import SettingsHeader from "../components/SettingsHeader";

export default function SettingsProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newProject, setNewProject] = useState("");
  const [newCluster, setNewCluster] = useState("TOD");
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingCluster, setEditingCluster] = useState("TOD");

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/projects`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects.");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setProjects(
        list.map((p) => ({
          ...p,
          fund_cluster: p?.fund_cluster || "TOD",
        }))
      );
    } catch (err) {
      setToast("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.active),
    [projects]
  );
  const inactiveProjects = useMemo(
    () => projects.filter((p) => !p.active),
    [projects]
  );

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleCreate = async () => {
    const name = newProject.trim();
    if (!name) {
      showToast("Enter a project name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, fund_cluster: newCluster }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add project.");
      setNewProject("");
      setNewCluster("TOD");
      await loadProjects();
      showToast("Project added.");
    } catch (err) {
      showToast(err?.message || "Failed to add project.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (project) => {
    setEditingId(project._id);
    setEditingName(project.name || "");
    setEditingCluster(project.fund_cluster || "TOD");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingCluster("TOD");
  };

  const saveEdit = async (project) => {
    const name = editingName.trim();
    if (!name) {
      showToast("Project name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, fund_cluster: editingCluster }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update project.");
      await loadProjects();
      showToast("Project updated.");
      cancelEdit();
    } catch (err) {
      showToast(err?.message || "Failed to update project.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (project) => {
    if (!project?._id) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !project.active }),
      });
      if (!res.ok) throw new Error("Failed to update project.");
      await loadProjects();
      showToast(project.active ? "Project archived." : "Project activated.");
    } catch (err) {
      showToast(err?.message || "Failed to update project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "User Management", to: "/userdashboard" },
          { label: "Projects" },
        ]}
        title="Project List"
        subtitle="Manage the project dropdowns used across forms."
        rightSlot={
          <button
            type="button"
            onClick={loadProjects}
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
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            placeholder="Add new project name"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={newCluster}
            onChange={(e) => setNewCluster(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
          >
            <option value="TOD">TOD</option>
            <option value="AFD">AFD</option>
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add project"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Tip: You can deactivate a project instead of deleting it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Active projects</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              {activeProjects.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : activeProjects.length === 0 ? (
              <p className="text-xs text-gray-500">No active projects.</p>
            ) : (
              activeProjects.map((project) => (
                <div
                  key={project._id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  {editingId === project._id ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <select
                        value={editingCluster}
                        onChange={(e) => setEditingCluster(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                      >
                        <option value="TOD">TOD</option>
                        <option value="AFD">AFD</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {project.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {(project.fund_cluster || "TOD").toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {editingId === project._id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(project)}
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
                          onClick={() => startEdit(project)}
                          className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(project)}
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
            <h2 className="text-sm font-semibold text-gray-900">Inactive projects</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              {inactiveProjects.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : inactiveProjects.length === 0 ? (
              <p className="text-xs text-gray-500">No inactive projects.</p>
            ) : (
              inactiveProjects.map((project) => (
                <div
                  key={project._id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2"
                >
                  {editingId === project._id ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <select
                        value={editingCluster}
                        onChange={(e) => setEditingCluster(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                      >
                        <option value="TOD">TOD</option>
                        <option value="AFD">AFD</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {project.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {(project.fund_cluster || "TOD").toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {editingId === project._id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(project)}
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
                          onClick={() => startEdit(project)}
                          className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(project)}
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
