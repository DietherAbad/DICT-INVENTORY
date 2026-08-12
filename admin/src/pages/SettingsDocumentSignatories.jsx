import React, { useCallback, useEffect, useMemo, useState } from "react";
import SettingsHeader from "../components/SettingsHeader";
import { BASE_URL } from "../utils/config";

const DOCUMENTS = [
  {
    key: "ris",
    code: "RIS",
    title: "Requisition and Issue Slip",
    description: "Supply request checking, approval, and receiving acknowledgment.",
    slots: [
      { key: "checker_id", label: "Checked by", fallbackRole: "Inventory Admin" },
      { key: "approver_id", label: "Approved by", fallbackRole: "AFD" },
    ],
    automatic: "Received by — the employee receiving the supplies",
  },
  {
    key: "ptr",
    code: "PTR",
    title: "Property Transfer Request",
    description: "PPE transfer approval, release, and receiving acknowledgment.",
    slots: [
      { key: "approver_id", label: "Approved by", fallbackRole: "Regional Director" },
      { key: "releaser_id", label: "Released by", fallbackRole: "Inventory Admin" },
    ],
    automatic: "Received by — the property transfer receiver",
  },
  {
    key: "ics_issuance",
    code: "ICS",
    title: "ICS Issuance",
    description: "Initial issuance of semi-expendable property.",
    slots: [
      { key: "approver_id", label: "Approved / issued by", fallbackRole: "Inventory Admin" },
    ],
    automatic: "Received by — the employee receiving the issued property",
  },
  {
    key: "ics_transfer",
    code: "ICS",
    title: "ICS Transfer",
    description: "Transfer of semi-expendable property between custodians.",
    slots: [
      { key: "approver_id", label: "Approved by", fallbackRole: "Inventory Admin" },
    ],
    automatic: "Received by — the new property custodian",
  },
];

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const buildResolvedForm = (settings, directory) => {
  const saved = settings?.document_signatories || {};
  const findRoleId = (role) =>
    directory.find((person) => normalizeRole(person?.role) === normalizeRole(role))?._id || "";

  return DOCUMENTS.reduce((documents, document) => {
    documents[document.key] = document.slots.reduce((slots, slot) => {
      slots[slot.key] = saved?.[document.key]?.[slot.key] || findRoleId(slot.fallbackRole);
      return slots;
    }, {});
    return documents;
  }, {});
};

export default function SettingsDocumentSignatories() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({});
  const [initialForm, setInitialForm] = useState({});
  const [version, setVersion] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        String(a?.username || a?.email || "").localeCompare(
          String(b?.username || b?.email || "")
        )
      ),
    [users]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const [settingsResponse, usersResponse] = await Promise.all([
        fetch(`${BASE_URL}/settings`, { credentials: "include" }),
        fetch(`${BASE_URL}/users/directory`, { credentials: "include" }),
      ]);
      if (!settingsResponse.ok || !usersResponse.ok) {
        throw new Error("Unable to load signatory settings.");
      }
      const settings = await settingsResponse.json();
      const directoryPayload = await usersResponse.json();
      const directory = Array.isArray(directoryPayload) ? directoryPayload : [];
      const resolved = buildResolvedForm(settings, directory);
      setUsers(directory);
      setForm(resolved);
      setInitialForm(resolved);
      setVersion(settings?.__v);
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Unable to load settings." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const updateSlot = (documentKey, slotKey, value) => {
    setForm((current) => ({
      ...current,
      [documentKey]: { ...current?.[documentKey], [slotKey]: value },
    }));
  };

  const save = async () => {
    const missing = DOCUMENTS.some((document) =>
      document.slots.some((slot) => !form?.[document.key]?.[slot.key])
    );
    if (missing) {
      setMessage({ type: "error", text: "Select an employee for every editable signatory slot." });
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const response = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ document_signatories: form, __v: version }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Unable to save signatories.");
      const saved = payload?.document_signatories || form;
      setForm(saved);
      setInitialForm(saved);
      setVersion(payload?.__v);
      try {
        const raw = localStorage.getItem("systemSettings");
        const stored = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          "systemSettings",
          JSON.stringify({ ...stored, document_signatories: saved })
        );
        window.dispatchEvent(
          new CustomEvent("settings:signatories", { detail: saved })
        );
      } catch {
        // The server remains authoritative when browser storage is unavailable.
      }
      setMessage({ type: "success", text: "Document signatories updated successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Unable to save signatories." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        crumbs={[
          { label: "Settings", to: "/settingsdashboard" },
          { label: "Document Signatories" },
        ]}
        title="Document Signatories"
        subtitle="Assign the employees who approve and sign each inventory document."
        rightSlot={
          <button
            type="button"
            onClick={load}
            disabled={loading || saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            Refresh
          </button>
        }
      />

      {message.text && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {message.text}
        </div>
      )}

      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900">
        Changes apply to new and active workflow actions and to generated forms. Receiving signatories remain automatic so each document follows its actual recipient.
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {DOCUMENTS.map((document) => <div key={document.key} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {DOCUMENTS.map((document) => (
            <section key={document.key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-300">{document.code}</p>
                    <h2 className="mt-2 text-xl font-bold">{document.title}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{document.description}</p>
                  </div>
                  <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/15">{document.slots.length + 1} signatures</span>
                </div>
              </div>
              <div className="space-y-5 p-5">
                {document.slots.map((slot) => (
                  <label key={slot.key} className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{slot.label}</span>
                    <select
                      value={form?.[document.key]?.[slot.key] || ""}
                      onChange={(event) => updateSlot(document.key, slot.key, event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Select employee…</option>
                      {sortedUsers.map((person) => (
                        <option key={person._id} value={person._id}>
                          {person.username || person.email} — {person.position || person.role || "Employee"}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Automatic signatory</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{document.automatic}</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-xl backdrop-blur">
        <p className="text-xs text-slate-500">{dirty ? "You have unsaved signatory changes." : "All signatory assignments are saved."}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setForm(initialForm)} disabled={!dirty || saving} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Discard</button>
          <button type="button" onClick={save} disabled={!dirty || saving || loading} className="rounded-xl bg-slate-950 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black disabled:opacity-40">{saving ? "Saving…" : "Save signatories"}</button>
        </div>
      </div>
    </div>
  );
}
