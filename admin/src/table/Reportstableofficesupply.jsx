import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

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
  let statusClass = "bg-green-100 text-green-700"; // Default color for available items

  if (data.status === "Out of stock") {
    statusClass = "bg-red-100 text-red-700"; // Red color for out of stock items
  }
  // Helper function to return placeholder for empty data
  const getValue = (value) => (value !== null && value !== undefined ? value : "-");

  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center border-b">
        {getValue(data.stock_no)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.itemName)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.classification)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.balance_qty)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.unitofmeasure)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.balance_unit_cost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.balance_total_cost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.purchase_qty)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.purchase_unit_cost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.purchase_total_cost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.distribution_qty)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.distribution_unit_cost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.distribution_total_cost)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {getValue(data.disposed_qty)} {/* Disposed Quantity */}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center border-b">
        <span
          className={`px-2 py-1 text-sm font-medium rounded-full capitalize ${statusClass}`}
        >
          {getValue(data.status)}
        </span>
      </td>
    </tr>
  );
}

function Reportstableofficesupply() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/inventoryofficesupply/inventory`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }
        return response.json();
      })
      .then((data) => {
        setInventoryData(data.reverse()); // Reverse data
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Filtered items based on search query and filter status
  const filteredItems = inventory
    .filter((item) =>
      filterStatus === "All" ? true : item.status === filterStatus
    )
    .filter((item) =>
      [
        item.stock_no,
        item.itemName,
        item.classification,
        item.balance_qty,
        item.unitofmeasure,
        item.balance_unit_cost,
        item.balance_total_cost,
        item.purchase_qty,
        item.purchase_unit_cost,
        item.purchase_total_cost,
        item.distribution_qty,
        item.distribution_unit_cost,
        item.distribution_total_cost,
        item.balance_qty,
        item.balance_unit_cost,
        item.balance_total_cost,
        item.disposed_qty,
        item.status,
      ]
        .filter(Boolean)
        .some((field) =>
          field.toString().toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleBack = () => {
    navigate("/officedashboard");
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1); // Reset pagination on search
  };

  const handleFilterChange = (event) => {
    setFilterStatus(event.target.value);
    setCurrentPage(1); // Reset pagination on filter change
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OfficeSupplies");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "OfficeSupplies.xlsx"
    );
  };

  return (
    <div className="w-full sm:px-6 pt-10">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleBack}
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg transition-transform transform hover:scale-105 mr-4"
        >
          <img
            src={arrowIcon}
            alt="Back"
            className="w-5 h-5 inline-block mr-2"
          />
          Back
        </button>
        <div className="flex items-center ml-auto space-x-4">
          <select
            value={filterStatus}
            onChange={handleFilterChange}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-indigo-200 transition-all duration-200"
          >
            <option value="All">Show All</option>
            <option value="Instock">Instock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
          <button
            onClick={handleExport}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Export to Excel
          </button>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearch}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
        </div>
      </div>
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={filteredItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="itemName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="balance_qty" fill="#82ca9d" />
              <Bar dataKey="distribution_qty" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800 ">
              <TableHeader title="Stock No." />
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Balance Qty" />
              <TableHeader title="Unit of Measure" />
              <TableHeader title="Balance Unit Cost" />
              <TableHeader title="Balance Total Cost" />
              <TableHeader title="Purchase Qty" />
              <TableHeader title="Purchase Unit Cost" />
              <TableHeader title="Purchase Total Cost" />
              <TableHeader title="Distribution Qty" />
              <TableHeader title="Distribution Unit Cost" />
              <TableHeader title="Distribution Total Cost" />
              <TableHeader title="Disposed Qty" />
              <TableHeader title="Status" />
            </tr>
          </thead>
          <tbody>
            {currentItems.map((data, index) => (
              <TableRow key={index} data={data} />
            ))}
          </tbody>
        </table>
        {filteredItems.length > itemsPerPage && (
          <div className="flex justify-center mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mx-2"
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

export default Reportstableofficesupply;
