import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";
import * as XLSX from "xlsx";

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

/* ---------- table row with dynamic Issued / Stored / Transferred logic ---------- */
function TableRow({ data }) {
  /* badge colours */
  let statusClass = "";
  switch (data.status) {
    case "In Stock":
      statusClass = "bg-blue-100 text-blue-700";
      break;
    case "Issued":
      statusClass = "bg-red-100 text-red-700";
      break;
    case "Transferred":
    case "Trasferred": // fallback for miss-spelling
      statusClass = "bg-yellow-100 text-yellow-700";
      break;
    case "For Transfer":
      statusClass = "bg-purple-100 text-purple-700";
      break;
    case "Pending":
      statusClass = "bg-gray-300 text-black";
      break;
    default:
      statusClass = "bg-gray-100 text-gray-700";
  }

  /* choose which field to show in the last column */
  let issuedToDisplay = "";
  if (data.status === "In Stock") {
    issuedToDisplay = data.stored_to ?? "";
  } else if (data.status === "Issued") {
    issuedToDisplay = data.issued_to ?? "";
  } else if (
    data.status === "Transferred" ||
    data.status === "Trasferred" ||
    data.status === "For Transfer"
  ) {
    issuedToDisplay = data.transfered_to ?? "";
  }

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
        {data.serial_no}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.unit_cost}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center border-b">
        <span
          className={
            "px-2 py-1 text-sm font-medium rounded-full capitalize " + statusClass
          }
        >
          {data.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b">
        {issuedToDisplay || "—"}
      </td>
    </tr>
  );
}

function Reportstableofficeictequipments() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("Show All");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  /* ---------- fetch data whenever filter changes ---------- */
  useEffect(() => {
    fetchInventoryData(filter);
  }, [filter]);

  const fetchInventoryData = (filter) => {
    const url = `${BASE_URL}/inventoryofficeICTequipment/inventory`;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch data");
        return response.json();
      })
      .then((data) => {
        const filtered =
          filter === "Show All" ? data : data.filter((i) => i.status === filter);
        setInventoryData(filtered.reverse()); // newest first
      })
      .catch(setError);
  };

  /* ---------- pagination helpers ---------- */
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  /* ---------- global search across displayed columns ---------- */
  const filteredItems = inventory.filter((item) =>
    [
      item.property_no,
      item.itemName,
      item.classification,
      item.serial_no,
      item.unit_cost,
      item.status,
      item.issued_to,
      item.stored_to,
      item.transfered_to,
    ]
      .filter(Boolean)
      .some((field) =>
        field.toString().toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  /* ---------- handlers ---------- */
  const paginate = (page) => setCurrentPage(page);
  const handleBack = () => navigate("/officedashboard");
  const handleSearch = ({ target }) => {
    setSearchQuery(target.value);
    setCurrentPage(1);
  };
  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);
  const handleFilterChange = (f) => {
    setFilter(f);
    setCurrentPage(1);
    setIsDropdownOpen(false);
  };

  /* ---------- export visible rows to Excel ---------- */
  const exportToExcel = () => {
    const worksheetData = currentItems.map((item) => ({
      "Property No.": item.property_no,
      "Item Description": item.itemName,
      Classification: item.classification,
      "Serial No.": item.serial_no,
      "Unit Cost": item.unit_cost,
      Status: item.status,
      "Issued / Stored / Transferred To":
        item.status === "In Stock"
          ? item.stored_to
          : item.status === "Issued"
          ? item.issued_to
          : item.transfered_to,
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "Inventory_Report.xlsx");
  };

  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="w-full sm:px-6 pt-10">
      {/* ---------- header bar ---------- */}
      <div className="flex items-center mb-4">
        <button
          onClick={handleBack}
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg transition-transform transform hover:scale-105 mr-2"
        >
          <img src={arrowIcon} alt="Back" className="w-5 h-5 inline-block mr-2" />
          Back
        </button>

        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500 leading-tight shadow-sm">
          REPORTS TABLE FOR OFFICE EQUIPMENTS
        </p>

        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearch}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
        />

        <button
          onClick={exportToExcel}
          className="ml-3 px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring focus:ring-green-200"
        >
          Export to Excel
        </button>

        {/* ---------- status filter dropdown ---------- */}
        <div className="ml-3 relative">
          <button
            onClick={toggleDropdown}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-indigo-200"
          >
            {filter}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              {["Show All", "In Stock", "Issued", "Transferred", "For Transfer", "Pending"].map(
                (label) => (
                  <button
                    key={label}
                    onClick={() => handleFilterChange(label)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    {label === "Transferred" ? "Show Transferred" : `Show ${label}`}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- data table ---------- */}
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800">
              <TableHeader title="Property No." />
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Serial No." />
              <TableHeader title="Unit Cost" />
              <TableHeader title="Status" />
              <TableHeader title="Issued / Stored / Transferred To" />
            </tr>
          </thead>
          <tbody>
            {currentItems.map((data, idx) => (
              <TableRow key={idx} data={data} />
            ))}
          </tbody>
        </table>

        {/* ---------- pagination ---------- */}
        {filteredItems.length > itemsPerPage && (
          <div className="flex justify-between mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2 transition-colors duration-150"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2 transition-colors duration-150"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === Math.ceil(filteredItems.length / itemsPerPage)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reportstableofficeictequipments;
