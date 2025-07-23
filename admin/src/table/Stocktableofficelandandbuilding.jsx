import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";

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
  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center border-b">
        {data.property_no}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.item_no}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.classification}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.address}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b">
        <Link
          to={`/`}
          className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-2 rounded"
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
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/inventoryofficeLandandBuilding/inventory`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }
        return response.json();
      })
      .then((data) => {
        setInventoryData(data);
      })
      .catch((error) => {
        setError(error);
      });
  }, []);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Filtered items based on search query
  const filteredItems = inventory.filter((item) =>
    item.item_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

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
      <div className="flex items-center mb-4">
        <button
          onClick={handleBack}
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg transition-transform transform hover:scale-105 mr-2"
        >
          <img src={arrowIcon} alt="Back" className="w-5 h-5 inline-block mr-2" />
          Back
        </button>
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500 leading-tight shadow-sm">
          STOCK TABLE FOR LAND AND BUILDING PROPERTIES
        </p>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearch}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
        />
      </div>
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
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
        {filteredItems.length > itemsPerPage && (
          <div className="flex justify-center mt-4">
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
              disabled={
                currentPage === Math.ceil(filteredItems.length / itemsPerPage)
              }
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
