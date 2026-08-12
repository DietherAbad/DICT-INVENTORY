import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Breadcrumbs from "../components/Breadcrumbs";
import { BASE_URL, resolveServerUrl } from "../utils/config";

const money = (value) =>
  Number(value || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" });

const dateLabel = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
};

const initials = (name) =>
  String(name || "Employee")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function EmployeeAssetLookup() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("all");
  const [itemFilter, setItemFilter] = useState("");

  useEffect(() => {
    if (selectedId || query.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `${BASE_URL}/requests/employee-assets?q=${encodeURIComponent(query.trim())}`,
          { credentials: "include", signal: controller.signal }
        );
        if (!response.ok) throw new Error("Unable to search employees.");
        const data = await response.json();
        setSuggestions(Array.isArray(data?.users) ? data.users : []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedId]);

  const selectEmployee = useCallback(async (employee) => {
    setSelectedId(employee._id);
    setQuery(employee.username || employee.email || "Loading employee…");
    setSuggestions([]);
    setLoading(true);
    setError("");
    setItemFilter("");
    try {
      const response = await fetch(
        `${BASE_URL}/requests/employee-assets?userId=${encodeURIComponent(employee._id)}`,
        { credentials: "include" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to load employee assets.");
      setResult(data);
      setQuery(data?.employee?.username || data?.employee?.email || "Employee");
    } catch (requestError) {
      setResult(null);
      setError(requestError.message || "Unable to load employee assets.");
    } finally {
      setLoading(false);
    }
  }, []);

  const requestedEmployeeId = searchParams.get("userId") || "";
  useEffect(() => {
    if (!requestedEmployeeId || requestedEmployeeId === selectedId) return;
    selectEmployee({ _id: requestedEmployeeId });
  }, [requestedEmployeeId, selectEmployee, selectedId]);

  const chooseEmployee = (employee) => {
    setSearchParams({ userId: employee._id }, { replace: true });
    selectEmployee(employee);
  };

  const normalizedFilter = itemFilter.trim().toLowerCase();
  const propertyAssets = useMemo(
    () =>
      (result?.propertyAssets || []).filter((item) =>
        [item.itemName, item.category, item.classification, item.property_no, item.serial_no]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedFilter))
      ),
    [result, normalizedFilter]
  );
  const supplies = useMemo(
    () =>
      (result?.supplies || []).filter((item) =>
        [item.itemName, item.classification, item.risNo, item.stockNo]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedFilter))
      ),
    [result, normalizedFilter]
  );

  const employee = result?.employee;
  const summary = result?.summary || {};
  const clearSelection = () => {
    setSearchParams({}, { replace: true });
    setSelectedId("");
    setQuery("");
    setResult(null);
    setError("");
    setItemFilter("");
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const openAssetDetail = (detailPath) => {
    if (!detailPath) return;
    const employeeId = selectedId || requestedEmployeeId;
    const returnPath = employeeId
      ? `/employee-asset-lookup?userId=${encodeURIComponent(employeeId)}`
      : "/employee-asset-lookup";
    navigate(detailPath, {
      state: {
        from: returnPath,
        fromEmployeeAssetLookup: true,
      },
    });
  };

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Breadcrumbs
          items={[
            { label: "Office Dashboard", to: "/officedashboard" },
            { label: "Inventory Requests", to: "/request" },
            { label: "Employee Asset Lookup" },
          ]}
        />

        <div className="overflow-visible rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr,520px] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Inventory intelligence</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Employee Asset Lookup</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Find an employee and review every property and supply record linked to their inventory account.
              </p>
            </div>

            <div className="relative">
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
                Search employee
              </label>
              <div className="flex items-center rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-white/20">
                <svg className="ml-2 h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
                  <path d="m20 20-4-4" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedId("");
                    setResult(null);
                    setError("");
                  }}
                  placeholder="Name, email, office, or position"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                {(query || result) && (
                  <button onClick={clearSelection} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">
                    Clear
                  </button>
                )}
              </div>
              {!selectedId && query.trim().length >= 2 && (
                <div className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl">
                  {searching ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-500">Searching employees…</div>
                  ) : suggestions.length ? (
                    suggestions.map((person) => (
                      <button
                        key={person._id}
                        onClick={() => chooseEmployee(person)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">
                          {initials(person.username)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{person.username || "Unnamed employee"}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {[person.position, person.designation, person.email].filter(Boolean).join(" • ")}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-slate-500">No matching employees found.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{error}</div>}

        {!loading && !result && !error && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 20a8 8 0 0 1 16 0" strokeWidth="1.6" /><circle cx="12" cy="8" r="4" strokeWidth="1.6" />
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">Select an employee to begin</h2>
            <p className="mt-2 text-sm text-slate-500">Search by name, email, position, or office assignment.</p>
          </div>
        )}

        {!loading && result && (
          <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-black text-white shadow-lg">
                    {initials(employee?.username)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-950">{employee?.username || "Employee"}</h2>
                    <p className="mt-1 text-sm text-slate-500">{[employee?.position, employee?.designation].filter(Boolean).join(" • ") || "No position details"}</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">{employee?.email}</p>
                  </div>
                </div>
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${employee?.active === false ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {employee?.active === false ? "Inactive account" : "Active employee"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Linked property", summary.propertyItems || 0, "Equipment, ICT and furniture"],
                ["Supply lines", summary.supplyLines || 0, "Linked RIS and supply records"],
                ["Supply units", summary.supplyUnits || 0, "Total linked quantity"],
                ["Recorded value", money(summary.totalValue), "Property and supply value"],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">{note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  {["all", "property", "supplies"].map((option) => (
                    <button key={option} onClick={() => setView(option)} className={`rounded-xl px-4 py-2 text-xs font-bold capitalize ${view === option ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {option}
                    </button>
                  ))}
                </div>
                <input value={itemFilter} onChange={(event) => setItemFilter(event.target.value)} placeholder="Filter assigned items…" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-72" />
              </div>
            </div>

            {(view === "all" || view === "property") && (
              <div className="space-y-4">
                <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Linked property</p><h3 className="mt-1 text-xl font-bold text-slate-950">Equipment, ICT and furniture</h3></div><span className="text-sm font-bold text-slate-500">{propertyAssets.length}</span></div>
                {propertyAssets.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {propertyAssets.map((item) => (
                      <button key={item._id} onClick={() => openAssetDetail(item.detailPath)} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                        <div className="flex gap-4 p-5">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                            {item.thumbnail?.url ? <img src={resolveServerUrl(item.thumbnail.url)} alt="" className="h-full w-full object-cover" /> : <span className="text-lg font-black text-slate-400">{initials(item.itemName)}</span>}
                          </div>
                          <div className="min-w-0 flex-1"><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">{item.category}</span><h4 className="mt-3 truncate text-base font-bold text-slate-950 group-hover:text-blue-700">{item.itemName || "Unnamed asset"}</h4><p className="mt-1 truncate text-xs text-slate-500">{item.classification || "Unclassified"}</p></div>
                        </div>
                        <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs"><div><p className="text-slate-400">Property No.</p><p className="mt-1 font-bold text-slate-700">{item.property_no || "—"}</p></div><div><p className="text-slate-400">Value</p><p className="mt-1 font-bold text-slate-700">{money(item.total_cost ?? Number(item.unit_cost || 0) * Number(item.qty || 0))}</p></div></div>
                      </button>
                    ))}
                  </div>
                ) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">No assigned property matches this view.</div>}
              </div>
            )}

            {(view === "all" || view === "supplies") && (
              <div className="space-y-4">
                <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Office supplies</p><h3 className="mt-1 text-xl font-bold text-slate-950">Linked supply records</h3></div><span className="text-sm font-bold text-slate-500">{supplies.length}</span></div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{["Supply", "RIS No.", "Quantity", "Status", "Activity", "Value", ""].map((head) => <th key={head} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{supplies.map((item) => <tr key={item._id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-bold text-slate-900">{item.itemName || "Supply"}</p><p className="text-xs text-slate-500">{item.classification || item.office || "—"}</p></td><td className="px-5 py-4 font-mono text-xs text-slate-600">{item.risNo || "—"}</td><td className="px-5 py-4 font-bold text-slate-800">{item.quantity} {item.unitofmeasure || ""}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">{item.workflowStatus || "—"}</span></td><td className="px-5 py-4 text-slate-600">{dateLabel(item.dateReceived)}</td><td className="px-5 py-4 font-bold text-slate-800">{money(item.totalCost)}</td><td className="px-5 py-4 text-right"><button onClick={() => openAssetDetail(item.detailPath)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-900 hover:text-white">View request</button></td></tr>)}</tbody></table></div>
                  {!supplies.length && <div className="py-12 text-center text-sm text-slate-500">No received supplies match this view.</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
