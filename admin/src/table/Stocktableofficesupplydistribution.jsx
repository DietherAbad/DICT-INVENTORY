// DistributionTable.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";

/* ---------- reusable <th> ---------- */
function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-50 text-center"
    >
      {title}
    </th>
  );
}

/* ---------- single <tr> ---------- */
function TableRow({ row }) {
  /* `row` already contains both the common distribution fields and the
     per-item fields (itemName, classification, quantity). */

  const statusClass =
    row.status === "Out of Stock"
      ? "bg-red-400 text-black-700"
      : row.status === "Declined"
      ? "bg-yellow-300 text-yellow-800"
      : row.status === "Pending"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700";

  const formattedDate = row.date_released
    ? new Date(row.date_released).toISOString().split("T")[0]
    : "N/A";

  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center border-b">
        {row.itemName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {row.classification}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {row.quantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {formattedDate}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {row.distributedto}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {row.office}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center border-b">
        <span
          className={`px-2 py-1 text-sm font-medium rounded-full capitalize ${statusClass}`}
        >
          {row.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b">
        <Link
          to={`/checkform/${row._id}`}
          className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-2 rounded transition-all duration-200"
        >
          Manage
        </Link>
      </td>
    </tr>
  );
}

/* ---------- main component ---------- */
function DistributionTable() {
  const [distributionData, setDistributionData] = useState([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  /* ---- fetch on mount ---- */
  useEffect(() => {
    fetch(`${BASE_URL}/distribute/distributions`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch data");
        return res.json();
      })
      .then((data) => {
        /* sort by latest date_released */
        const sorted = data.sort(
          (a, b) => new Date(b.date_released || 0) - new Date(a.date_released || 0)
        );
        setDistributionData(sorted);
      })
      .catch(console.error);
  }, []);

  /* ---- handlers ---- */
  const handleSearch = (e) => setSearchQuery(e.target.value);
  const handleFilterChange = (e) => setFilterStatus(e.target.value);
  const handleBack = () => navigate("/officedashboard");

  /* ---- flatten to rows ----
     For each distribution record that has an `items` array,
     create one row per item, copying common props.            */
  const explodedRows = distributionData.flatMap((dist) => {
    if (Array.isArray(dist.items) && dist.items.length) {
      return dist.items.map((itm) => ({
        ...dist, // keep _id, date_released, distributedto, office, status, etc.
        itemName: itm.itemName,
        classification: itm.classification,
        quantity: itm.quantity,
      }));
    }
    /* No items array – treat whole object as a single row */
    return {
      ...dist,
      itemName: dist.itemName || "—",
      classification: dist.classification || "—",
      quantity: dist.quantity || dist.qty || 0,
    };
  });

  /* ---- search & filter ---- */
  const filteredRows = explodedRows.filter((row) => {
    const matchesStatus = filterStatus === "All" || row.status === filterStatus;
    const matchesSearch = [
      row.itemName,
      row.classification,
      row.quantity,
      row.date_released,
      row.distributedto,
      row.office,
      row.status,
    ]
      .filter(Boolean)
      .some((field) =>
        field.toString().toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesStatus && matchesSearch;
  });

  /* ---- render ---- */
  return (
    <div className="w-full sm:px-6 pt-10">
      {/* header / controls */}
      <div className="flex items-center mb-6">
        <button
          onClick={handleBack}
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg transition-transform transform hover:scale-105 mr-4"
        >
          <img src={arrowIcon} alt="Back" className="w-5 h-5 inline-block mr-2" />
          Back
        </button>

        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-gray-500 leading-tight shadow-sm">
          Distribution Table
        </p>

        <div className="flex items-center ml-auto space-x-4">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearch}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200 transition-all duration-200"
          />

          <select
            value={filterStatus}
            onChange={handleFilterChange}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-indigo-200 transition-all duration-200"
          >
            <option value="All">Show All</option>
            <option value="Transferred">Transferred</option>
            <option value="Pending">Pending</option>
            <option value="Declined">Declined</option>
          </select>
        </div>
      </div>

      {/* table */}
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 py-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800">
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Quantity" />
              <TableHeader title="Date" />
              <TableHeader title="Distributed to" />
              <TableHeader title="Office" />
              <TableHeader title="Status" />
              <TableHeader title="Manage" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <TableRow key={`${row._id}-${row.itemName}-${row.quantity}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DistributionTable;
