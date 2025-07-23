import React, { useState, useEffect } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";

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

function TableRow({ data }) {
  let statusClass = "bg-green-100 text-green-700";

  if (data.status === "Out of Stock") {
    statusClass = "bg-red-400 text-black-700";
  }

  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center">{data.stock_no}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.itemName}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.classification}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.balance_qty}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.unitofmeasure}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.balance_unit_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.balance_total_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.purchase_qty}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.purchase_unit_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.purchase_total_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.distribution_qty}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.distribution_unit_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.distribution_total_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.balance_qty}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.balance_unit_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.balance_total_cost}</td>

      <td className="px-6 py-4 whitespace-nowrap text-center">
        <span className={"px-2 py-1 text-sm font-medium rounded-full capitalize " + statusClass}>
          {data.status}
        </span>
      </td>
    </tr>
  );
}

function Reportstablegovnetsupply() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/inventorygovnetsupply/inventory`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        return response.json();
      })
      .then(data => {
        setInventoryData(data);
      })
      .catch(error => {
        setError(error);
      });
  }, []);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Filtered items based on search query
  const filteredItems = inventory.filter(item =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = pageNumber => setCurrentPage(pageNumber);

  const handleBack = () => {
    navigate('/officedashboard');
  }

  const handleSearch = event => {
    setSearchQuery(event.target.value);
    setCurrentPage(1); // Reset pagination when performing a new search
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="w-full sm:px-6 pt-10">
      <div className="flex items-center mb-4">
        <button onClick={handleBack} className="bg-indigo-100 px-3 py-2 rounded text-indigo-600 hover:text-indigo-800 mr-2">
          <img src={arrowIcon} alt="Back" className="w-4 h-4 inline-block mr-1" />
        </button>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold leading-normal text-gray-800">REPORTS TABLE FOR GOVNET SUPPLIES</p>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearch}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
        />
      </div>
      <div className="bg-white shadow px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800 ">
              <TableHeader title="Stock No." />
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Quantity" />
              <TableHeader title="Unit of measure" />
              <TableHeader title="Unit cost" />
              <TableHeader title="Total cost" />
              <TableHeader title="Purchase qty" />
              <TableHeader title="Purchase unit cost" />
              <TableHeader title="Purchase total cost" />
              <TableHeader title="Distribution qty" />
              <TableHeader title="Distribution unit cost" />
              <TableHeader title="Distribution total cost" />
              <TableHeader title="Balance qty" />
              <TableHeader title="Balance unit cost" />
              <TableHeader title="Balance total cost" />
              <TableHeader title="Status" />
            </tr>
          </thead>
          <tbody>
            {currentItems.map((data, index) => (
              <TableRow key={index} data={data} />
            ))}
          </tbody>
        </table>
        {inventory.length > itemsPerPage && (
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded absolute top-4 right-4"
            onClick={() => paginate(currentPage + 1)}
          >
            Next Page
          </button>
        )}
      </div>
    </div>
  );
}

export default Reportstablegovnetsupply;
