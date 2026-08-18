import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { gatepassApi, statusBadgeClass } from "../utils/gatepass";

function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-100 text-center"
    >
      {title}
    </th>
  );
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

function GatePassTable() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await gatepassApi.list();
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : data?.data || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const username = user?.data?.username;
  const filtered = rows
    .filter((g) => {
      if (onlyMine && g.requester !== username) return false;
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      return (
        (g.purpose || "").toLowerCase().includes(q) ||
        (g.requester || "").toLowerCase().includes(q) ||
        (g.gatepass_no || "").toLowerCase().includes(q) ||
        (g.requeststatus || "").toLowerCase().includes(q) ||
        (g.fund_cluster || "").toLowerCase().includes(q)
      );
    })
    .slice()
    .reverse();

  const pageRows = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) return <div className="p-10">Loading gatepass records…</div>;
  if (error) {
    return (
      <div className="w-full sm:px-6 pt-10">
        <p className="text-red-600 font-semibold">Could not load Gatepass</p>
        <p className="text-sm text-gray-600 mt-2">{error.message}</p>
        <p className="text-sm text-gray-500 mt-2">
          Ensure the API exposes <code>/api/v1/gatepass</code> on the inventory
          backend.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full sm:px-6 pt-10">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500 leading-tight shadow-sm">
          Gatepass
        </p>
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <label className="inline-flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              className="form-checkbox mr-2"
              checked={onlyMine}
              onChange={() => {
                setOnlyMine((v) => !v);
                setCurrentPage(1);
              }}
            />
            My requests
          </label>
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
          <button
            type="button"
            onClick={() => navigate("/gatepass/new")}
            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            New Gatepass
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 text-sm text-gray-800">
              <TableHeader title="GP No." />
              <TableHeader title="Requester" />
              <TableHeader title="Purpose" />
              <TableHeader title="Items" />
              <TableHeader title="Status" />
              <TableHeader title="Requested" />
              <TableHeader title="Manage" />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No gatepass records yet. Create one to take equipment outside.
                </td>
              </tr>
            )}
            {pageRows.map((g) => (
              <tr key={g._id} className="hover:bg-gray-100">
                <td className="px-6 py-4 text-sm text-center border-b">
                  {g.gatepass_no || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-center border-b">
                  {g.requester}
                </td>
                <td className="px-6 py-4 text-sm text-center border-b max-w-xs truncate">
                  {g.purpose}
                </td>
                <td className="px-6 py-4 text-sm text-center border-b">
                  {(g.items && g.items.length) || 0}
                </td>
                <td className="px-6 py-4 text-sm text-center border-b">
                  <span
                    className={
                      "px-2 py-1 text-sm font-medium rounded-full " +
                      statusBadgeClass(g.requeststatus)
                    }
                  >
                    {g.requeststatus}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-center border-b">
                  {formatDate(g.date_requested)}
                </td>
                <td className="px-6 py-4 text-sm text-center border-b">
                  <Link
                    to={`/gatepass/${g._id}`}
                    className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-2 rounded shadow-md"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length > itemsPerPage && (
          <div className="flex justify-between mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              disabled={
                currentPage >= Math.ceil(filtered.length / itemsPerPage)
              }
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GatePassTable;
