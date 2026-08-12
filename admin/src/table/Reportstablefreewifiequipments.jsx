import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";
import Breadcrumbs from "../components/Breadcrumbs";

function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-50 text-left"
    >
      {title}
    </th>
  );
}

function TableRow({ data }) {
  let statusClass = "bg-green-100 text-green-700";
  if (data.status === "Issued") {
    statusClass = "bg-red-400 text-black-700";
  }

  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-left">{data.property_no}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left">{data.itemName}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left">{data.classification}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left">{data.serial_no}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left">{data.qty}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left">{data.unitofmeasure}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left">{data.unit_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left">{data.total_cost}</td>
      <td className="px-6 py-4 whitespace-nowrap text-left">
        <span className={"px-2 py-1 text-sm font-medium rounded-full capitalize " + statusClass}>
          {data.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-left">
        {data.issued_to}
      </td>
    </tr>
  );
}

function Reportstablefreewifiequipments() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/inventoryFreewifi/inventory`)
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
    navigate('/freewifidashboard');
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
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Free WiFi", to: "/freewifidashboard" },
          { label: "Reports" },
        ]}
      />
      <div className="flex flex-col gap-3 mb-4">
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-slate-900">
          Reports Table for FreeWiFi Equipments
        </p>
        <div className="filter-card">
          <div className="filter-card-content">
            <div className="request-filterbar">
              <button onClick={handleBack} className="table-button inline-flex items-center gap-2">
                <img src={arrowIcon} alt="Back" className="w-4 h-4" />
                Back
              </button>
              <div className="search-shell w-44 md:w-60 ml-auto">
                <span className="search-icon">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="search-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="table-shell table-compact table-flush relative">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left">
            <thead>
              <tr className="h-16 w-full text-sm leading-none text-gray-800 ">
                <TableHeader title="Property No." />
                <TableHeader title="Item Description" />
                <TableHeader title="Classification" />
                <TableHeader title="Serial No*" />
                <TableHeader title="Quantity" />
                <TableHeader title="Unit of measure" />
                <TableHeader title="Unit cost" />
                <TableHeader title="Total cost" />
                <TableHeader title="Status" />
                <TableHeader title="Issued to" />
              </tr>
            </thead>
            <tbody>
              {currentItems.map((data, index) => (
                <TableRow key={index} data={data} />
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length > itemsPerPage && (
          <div className="flex justify-end border-t border-slate-200/70 bg-white px-3 py-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-150"
              onClick={() => paginate(currentPage + 1)}
            >
              Next Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reportstablefreewifiequipments;
