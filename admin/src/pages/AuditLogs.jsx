// src/pages/AuditLogs.jsx
import React, { useEffect, useState } from "react";
import { BASE_URL } from "../utils/config";
import Breadcrumbs from "../components/Breadcrumbs";

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(itemsPerPage));
        if (query.trim()) params.set("search", query.trim());

        const res = await fetch(`${BASE_URL}/logs?${params.toString()}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Failed to load audit logs.");
        const payload = await res.json();
        setLogs(Array.isArray(payload?.data) ? payload.data : []);
        setTotal(Number(payload?.total) || 0);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setError(err?.message || "Unable to load audit logs.");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => ac.abort();
  }, [currentPage, itemsPerPage, query]);

  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  const handleSearch = (event) => {
    setQuery(event.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", to: "/settingsdashboard" },
          { label: "Audit Logs" },
        ]}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Audit Logs
          </h1>
          <p className="text-sm text-gray-500">
            Track system activity, status changes, and user actions.
          </p>
        </div>
        <div className="w-full sm:w-80">
          <label className="sr-only" htmlFor="audit-search">
            Search logs
          </label>
          <div className="search-shell">
            <span className="search-icon">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              id="audit-search"
              type="text"
              placeholder="Search logs..."
              value={query}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Logs
          </p>
          <p className="text-xs text-gray-400">
            Showing {logs.length} of {total}
          </p>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Loading logs...</div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No logs match your search.
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">User</th>
                  <th className="px-4 py-3 text-left font-semibold">Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log?._id || `${log?.userId}-${log?.time}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {log?.action || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log?.status || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{log?.userId || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{log?.time || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDateTime(log?.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            <span>
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
