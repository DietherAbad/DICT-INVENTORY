import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";
import Breadcrumbs from "../components/Breadcrumbs";

function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-100 text-left"
    >
      {title}
    </th>
  );
}

function TableRow({ data }) {
  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-left border-b">
        {data.property_no}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left border-b">
        {data.item_no}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left border-b">
        {data.classification}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-left border-b">
        {data.address}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-left border-b">
        <Link
          to={`/`}
          className="manage-button"
        >
          Manage
        </Link>
      </td>
    </tr>
  );
}

function Stocktableofficelandandtitle() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(itemsPerPage));
        if (searchQuery.trim()) params.set("search", searchQuery.trim());

        const response = await fetch(
          `${BASE_URL}/inventoryofficeLandandBuilding/inventory?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }
        const data = await response.json();

        if (Array.isArray(data)) {
          setInventoryData(data);
          setTotalCount(data.length);
        } else {
          setInventoryData(Array.isArray(data?.data) ? data.data : []);
          setTotalCount(Number(data?.total || 0));
        }
      } catch (err) {
        setError(err);
      }
    };
    load();
  }, [currentPage, itemsPerPage, searchQuery]);

  const currentItems = inventory;

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleBack = () => {
    navigate("/officedashboard");
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1); // Reset pagination when performing a new search
  };

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="w-full sm:px-6 pt-10">
      <Breadcrumbs
        className="mb-3"
        items={[
          { label: "Office Dashboard", to: "/officedashboard" },
          { label: "Inventory" },
          { label: "Land & Building" },
        ]}
      />
      <div className="flex flex-col gap-3 mb-4">
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-slate-900">
          Stock Table for Land and Building Properties
        </p>
        <div className="table-filters">
          <button onClick={handleBack} className="table-button inline-flex items-center gap-2">
            <img src={arrowIcon} alt="Back" className="w-5 h-5" />
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
      <div className="table-shell table-compact table-flush relative">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left">
            <thead>
              <tr className="h-16 w-full text-sm leading-none text-gray-800 ">
                <TableHeader title="Land No." />
                <TableHeader title="Item No." />
                <TableHeader title="Classification" />
                <TableHeader title="Address" />
                <TableHeader title="Action" />
              </tr>
            </thead>
            <tbody>
              {currentItems.map((data, index) => (
                <TableRow key={index} data={data} />
              ))}
            </tbody>
          </table>
        </div>
        {totalCount > itemsPerPage && (
          <div className="flex justify-center gap-2 border-t border-slate-200/70 bg-white px-3 py-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-150"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-150"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Stocktableofficelandandtitle;
