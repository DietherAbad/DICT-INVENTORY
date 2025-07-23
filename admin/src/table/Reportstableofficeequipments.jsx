import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";
import * as XLSX from "xlsx";

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

function TableRow({ data }) {
  let statusClass = "";
  switch (data.status) {
    case "In stock":
      statusClass = "bg-blue-100 text-blue-700";
      break;
    case "Issued":
      statusClass = "bg-red-100 text-red-700";
      break;
    case "Transferred":
      statusClass = "bg-yellow-100 text-yellow-700";
      break;
    case "Pending":
      statusClass = "bg-gray-300 text-black";
      break;
    default:
      statusClass = "bg-gray-100 text-gray-700";
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
            "px-2 py-1 text-sm font-medium rounded-full capitalize " +
            statusClass
          }
        >
          {data.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b">
        {data.issued_to}
      </td>
    </tr>
  );
}

function Reportstableofficeequipments() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState({
    property_no: "",
    itemName: "",
    classification: "",
    serial_no: "",
    unit_cost: "",
    status: "",
    issued_to: "",
  });
  const [filter, setFilter] = useState("Show All");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInventoryData(filter);
  }, [filter]);

  const fetchInventoryData = (filter) => {
    const url = `${BASE_URL}/inventoryofficeequipment/inventory`;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }
        return response.json();
      })
      .then((data) => {
        let filteredData;
        if (filter === "Show All") {
          filteredData = data;
        } else {
          filteredData = data.filter((item) => item.status === filter);
        }
        // Reverse the data after filtering
        setInventoryData(filteredData.reverse());
      })
      .catch((error) => {
        setError(error);
      });
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Search across all fields in the table
  const filteredItems = inventory.filter((item) =>
    Object.keys(searchQuery).every((key) =>
      item[key]
        ? item[key].toString().toLowerCase().includes(searchQuery[key].toLowerCase())
        : false
    )
  );

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleBack = () => {
    navigate("/officedashboard");
  };

  const handleSearch = (event, column) => {
    setSearchQuery({
      ...searchQuery,
      [column]: event.target.value,
    });
    setCurrentPage(1);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleFilterChange = (filter) => {
    setFilter(filter);
    setCurrentPage(1);
    setIsDropdownOpen(false);
  };

  const exportToExcel = () => {
    const worksheetData = currentItems.map((item) => ({
      "Property No.": item.property_no,
      "Item Description": item.itemName,
      Classification: item.classification,
      "Serial No.": item.serial_no,
      "Unit Cost": item.unit_cost,
      Status: item.status,
      "Issued To": item.issued_to,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "Inventory_Report.xlsx");
  };

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="w-full sm:px-6 pt-10">
      <div className="flex items-center justify-between mb-4">
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
        <div className="flex items-center space-x-4">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring focus:ring-green-200"
          >
            Export to Excel
          </button>
          <div className="relative">
            <button
              onClick={toggleDropdown}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-indigo-200"
            >
              {filter}
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <button
                  onClick={() => handleFilterChange("Show All")}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  Show All
                </button>
                <button
                  onClick={() => handleFilterChange("In Stock")}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  Show In Stock
                </button>
                <button
                  onClick={() => handleFilterChange("Issued")}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  Show Issued
                </button>
                <button
                  onClick={() => handleFilterChange("Transferred")}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  Show Transferred
                </button>
                <button
                  onClick={() => handleFilterChange("Pending")}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                >
                  Show Pending
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
              <TableHeader title="Issued To" />
            </tr>
            <tr className="h-16 w-full text-sm leading-none text-gray-800">
              <td className="px-6 py-2 text-center">
                <input
                  type="text"
                  placeholder="Search Property No."
                  value={searchQuery.property_no}
                  onChange={(event) => handleSearch(event, "property_no")}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm w-40 focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </td>
              <td className="px-6 py-2 text-center">
                <input
                  type="text"
                  placeholder="Search Item"
                  value={searchQuery.itemName}
                  onChange={(event) => handleSearch(event, "itemName")}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm w-40 focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </td>
              <td className="px-6 py-2 text-center">
                <input
                  type="text"
                  placeholder="Search Classification"
                  value={searchQuery.classification}
                  onChange={(event) => handleSearch(event, "classification")}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm w-40 focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </td>
              <td className="px-6 py-2 text-center">
                <input
                  type="text"
                  placeholder="Search Serial No."
                  value={searchQuery.serial_no}
                  onChange={(event) => handleSearch(event, "serial_no")}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm w-40 focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </td>
              <td className="px-6 py-2 text-center">
                <input
                  type="text"
                  placeholder="Search Unit Cost"
                  value={searchQuery.unit_cost}
                  onChange={(event) => handleSearch(event, "unit_cost")}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm w-40 focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </td>
              <td className="px-6 py-2 text-center">
                <input
                  type="text"
                  placeholder="Search Status"
                  value={searchQuery.status}
                  onChange={(event) => handleSearch(event, "status")}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm w-40 focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </td>
              <td className="px-6 py-2 text-center">
                <input
                  type="text"
                  placeholder="Search Issued To"
                  value={searchQuery.issued_to}
                  onChange={(event) => handleSearch(event, "issued_to")}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm w-40 focus:outline-none focus:ring focus:ring-indigo-200"
                />
              </td>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((data, index) => (
              <TableRow key={index} data={data} />
            ))}
          </tbody>
        </table>
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

export default Reportstableofficeequipments;
