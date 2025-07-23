// Request.jsx
import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import { AuthContext } from "../context/AuthContext";

/* ---------- reusable <th> ---------- */
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

/* ---------- single <tr> ---------- */
function TableRow({ data, isPendingOfficeSupply }) {
  /* ----- determine base row (distribution rows keep items in an array) ----- */
  const hasItemsArray =
    isPendingOfficeSupply && Array.isArray(data.items) && data.items.length > 0;
  const base = hasItemsArray ? data.items[0] : data;

  /* ----- color-coding for status pill ----- */
  let statusClass = "bg-green-100 text-green-700";
  if (data.status === "Issued") statusClass = "bg-red-400 text-black-700";
  else if (data.status === "For Transfer") statusClass = "bg-yellow-100 text-yellow-700";
  else if (data.status === "Transferred") statusClass = "bg-blue-100 text-blue-700";

  /* ----- decide who is shown in “Issued to” column ----- */
  let issuedToValue;
  if (isPendingOfficeSupply) issuedToValue = data.distributedto;
  else if (data.status === "For Transfer") issuedToValue = data.transfered_to;
  else issuedToValue = data.issued_to;

  /* ----- build exponent-style "+N" when multiple items exist ----- */
  const additionalElement =
    hasItemsArray && data.items.length > 1 ? (
      <sup className="text-green-600 font-semibold text-xs ml-0.5">
        +{data.items.length - 1}
      </sup>
    ) : null;

  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {base.itemName}
        {additionalElement}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {base.classification}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {hasItemsArray ? base.quantity : isPendingOfficeSupply ? data.quantity : data.qty}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {base.unitofmeasure}
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
        {issuedToValue}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b">
        <Link
          to={`/checkform/${data._id}`}
          className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-2 rounded shadow-md transition-colors duration-150"
        >
          Manage
        </Link>
      </td>
    </tr>
  );
}

/* ---------- main component ---------- */
function Request() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTransferred, setShowTransferred] = useState(false);
  const [onlyPendingOfficeSupply, setOnlyPendingOfficeSupply] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  /* ----- fetch inventories whenever user or toggle changes ----- */
  useEffect(() => {
    if (!user) return;

    const fetchInventories = async () => {
      try {
        let urls;
        if (onlyPendingOfficeSupply) {
          urls = [`${BASE_URL}/distribute/distributions`];
        } else {
          urls = [
            `${BASE_URL}/inventoryofficeequipment/inventory`,
            `${BASE_URL}/inventoryofficesupply/inventory`,
            `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
            `${BASE_URL}/inventoryofficeICTequipment/inventory`,
            `${BASE_URL}/inventoryofficemotorandvehicle/inventory`,
          ];
        }

        const responses = await Promise.all(urls.map((url) => fetch(url)));
        const data = await Promise.all(
          responses.map((response) => {
            if (!response.ok) {
              throw new Error(
                `Failed to fetch data from ${response.url}: ${response.status} ${response.statusText}`
              );
            }
            return response.json();
          })
        );

        const allItems = data.flat();
        const userItems = allItems.filter(
          (item) =>
            item.status === "For Transfer" ||
            item.status === "Transferred" ||
            (onlyPendingOfficeSupply && item.status === "Pending")
        );

        setInventoryData(userItems);
      } catch (err) {
        console.error("Error fetching inventory data:", err);
        setError(err);
      }
    };

    fetchInventories();
  }, [user, onlyPendingOfficeSupply]);

  /* ----- pagination helpers ----- */
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  /* ----- UI-side filtering ----- */
  const filteredItems = inventory.filter(
    (item) =>
      ((item.itemName &&
        item.itemName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.classification &&
          item.classification.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.qty &&
          item.qty.toString().toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.unitofmeasure &&
          item.unitofmeasure.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.status &&
          item.status.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.issued_to &&
          item.issued_to.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.transfered_to &&
          item.transfered_to.toLowerCase().includes(searchQuery.toLowerCase()))) &&
      (showTransferred
        ? item.status === "Transferred"
        : item.status === "For Transfer" ||
          (onlyPendingOfficeSupply && item.status === "Pending"))
  );

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  /* ----- event handlers ----- */
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };
  const handleStatusChange = () => setShowTransferred(!showTransferred);
  const handlePendingSwitch = () =>
    setOnlyPendingOfficeSupply(!onlyPendingOfficeSupply);
  const handleBack = () => navigate("/officedashboard");

  /* ----- render ----- */
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="w-full sm:px-6 pt-10">
      {/* -------- header / controls -------- */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500 leading-tight shadow-sm">
          Request
        </p>
        <div className="flex items-center space-x-4 ml-auto">
          <label className="inline-flex items-center">
            <span className="mr-2 text-gray-700">Show Transferred</span>
            <input
              type="checkbox"
              checked={showTransferred}
              onChange={handleStatusChange}
              className="form-checkbox"
            />
          </label>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearch}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
          <button
            onClick={handlePendingSwitch}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-indigo-200"
          >
            {onlyPendingOfficeSupply ? "View All Inventories" : "View Pending Supplies"}
          </button>
        </div>
      </div>

      {/* -------- table -------- */}
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800">
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Quantity" />
              <TableHeader title="Unit of measure" />
              <TableHeader title="Status" />
              <TableHeader title="Name" />
              <TableHeader title="Manage" />
            </tr>
          </thead>
          <tbody>
            {currentItems.map((data) => (
              <TableRow
                key={data._id}
                data={data}
                isPendingOfficeSupply={onlyPendingOfficeSupply}
              />
            ))}
          </tbody>
        </table>

        {/* -------- pagination -------- */}
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

export default Request;
