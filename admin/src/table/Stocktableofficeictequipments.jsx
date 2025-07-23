import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";

/* ---------- table header helper ---------- */
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

/* ---------- table row with Manage-dropdown ---------- */
function TableRow({ data }) {
  const [showMenu, setShowMenu] = useState(false);

  const statusClasses = {
    "In Stock": "bg-blue-100 text-blue-700",
    Issued: "bg-red-100 text-red-700",
    Transferred: "bg-yellow-100 text-yellow-700",
    "For Transfer": "bg-yellow-100 text-yellow-700",
    Pending: "bg-gray-300 text-black",
  };
  const statusClass = statusClasses[data.status] || "bg-gray-100 text-gray-700";

  const menuEnabled =
    data.status === "Transferred" ||
    data.status === "For Transfer" ||
    data.status === "Issued" ||
    data.status === "In Stock";

  const toggleMenu = () => {
    if (menuEnabled) setShowMenu((o) => !o);
  };

  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center border-b">
        {data.property_no}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.itemName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.classification}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.qty}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.unitofmeasure}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.unit_cost}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.project}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center border-b">
        <span
          className={`px-2 py-1 text-sm font-medium rounded-full capitalize ${statusClass}`}
        >
          {data.status}
        </span>
      </td>

      {/* Manage button + dropdown */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b relative">
        <button
          onClick={toggleMenu}
          className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-2 rounded shadow-md transition-colors duration-150"
        >
          Manage
        </button>

        {showMenu && (
          <div className="absolute z-10 mt-2 right-0 w-40 bg-white shadow-lg border border-gray-200 rounded-lg">
            <Link
              to={`/checkitem/${data._id}`}
              className={`block px-4 py-2 text-sm text-indigo-500 hover:bg-indigo-100 ${
                data.status === "Issued" ? "rounded-lg" : "rounded-t-lg"
              }`}
            >
              View Item
            </Link>

            {(data.status === "Transferred" || data.status === "For Transfer") && (
              <Link
                to={`/checkform/${data._id}`}
                className="block px-4 py-2 text-sm text-indigo-500 hover:bg-indigo-100 rounded-b-lg"
              >
                View ITR
              </Link>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/* ---------- placeholder when there's nothing to show ---------- */
function NoDataRow({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10">
        <div className="flex flex-col items-center space-y-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 10h18M3 14h18m-9-9v14"
            />
          </svg>
          <p className="text-gray-500 font-medium">
            No ICT-equipment records found.
          </p>
        </div>
      </td>
    </tr>
  );
}

/* ---------- main component ---------- */
function Stocktableofficeictequipments() {
  const [inventory, setInventory] = useState([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Show All");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  /* fetch inventory on filter change */
  useEffect(() => {
    fetch(`${BASE_URL}/inventoryofficeictequipment/inventory`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch data");
        return r.json();
      })
      .then((d) => {
        const cleaned = filter === "Show All" ? d : d.filter((i) => i.status === filter);
        setInventory(cleaned.reverse());
      })
      .catch((err) => setError(err));
  }, [filter]);

  /* paging + search */
  const perPage = 20;
  const start = (page - 1) * perPage;
  const filtered = inventory.filter((it) =>
    [it.itemName, it.project, it.unit_cost, it.property_no, it.classification]
      .some((f) => f?.toString().toLowerCase().includes(search.toLowerCase()))
  );
  const shown = filtered.slice(start, start + perPage);

  /* quick error render */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-red-600 font-semibold text-lg">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-700 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  /* render */
  return (
    <div className="w-full sm:px-6 pt-10">
      {/* header */}
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/officedashboard")}
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg hover:scale-105 mr-2 transition-transform"
        >
          <img src={arrowIcon} alt="Back" className="w-5 h-5 mr-2" />
          Back
        </button>

        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-black leading-tight shadow-sm">
          STOCK TABLE FOR ICT EQUIPMENTS
        </p>

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
        />

        {/* filter dropdown */}
        <div className="ml-3 relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-indigo-200"
          >
            {filter}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              {["Show All", "In Stock", "Issued", "Transferred", "For Transfer", "Pending"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setFilter(opt);
                    setPage(1);
                    setOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {opt === "Show All" ? "Show All" : `Show ${opt}`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* table */}
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 text-sm text-gray-800">
              <TableHeader title="Property No." />
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Quantity" />
              <TableHeader title="Unit of measure" />
              <TableHeader title="Unit cost" />
              <TableHeader title="Project" />
              <TableHeader title="Status" />
              <TableHeader title="Action" />
            </tr>
          </thead>
          <tbody>
            {shown.length ? (
              shown.map((row) => <TableRow key={row._id} data={row} />)
            ) : (
              <NoDataRow colSpan={9} />
            )}
          </tbody>
        </table>

        {/* pagination */
        inventory.length > perPage && (
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === Math.ceil(filtered.length / perPage)}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Stocktableofficeictequipments;
