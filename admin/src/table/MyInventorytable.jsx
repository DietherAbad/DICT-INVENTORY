// MyInventorytable.jsx
import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import { AuthContext } from "../context/AuthContext";

/* ---------- SMALL COMPONENT FOR TABLE HEADERS ---------- */
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

/* ---------- ROW COMPONENT (MANAGE OPTIONS DIFFER BY SOURCE) ---------- */
function TableRow({ data, isDistribution }) {
  const [showManageOptions, setShowManageOptions] = useState(false);

  /* --- STATUS BADGE COLOR --- */
  let statusClass = "bg-green-100 text-green-700";
  if (data.status === "Issued") statusClass = "bg-red-400 text-black-700";

  /* --- TOGGLE MANAGE OPTIONS --- */
  const handleManageClick = () => {
    if (
      isDistribution ||
      ["Transferred", "For Transfer", "Issued"].includes(data.status)
    ) {
      setShowManageOptions(!showManageOptions);
    }
  };

  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.itemName || data.supplyName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.classification || data.supplyType}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.qty || data.quantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.unitofmeasure || data.unit}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center border-b">
        <span
          className={
            "px-2 py-1 text-sm font-medium rounded-full capitalize " + statusClass
          }
        >
          {data.status || data.distributionStatus}
        </span>
      </td>

      {/* ---------- MANAGE BUTTON & DROPDOWN ---------- */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b relative">
        <button
          onClick={handleManageClick}
          className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-2 rounded shadow-md transition-colors duration-150"
        >
          Manage
        </button>

        {/* --- OPTIONS WHEN SOURCE IS /distribute/distributions --- */}
        {showManageOptions && isDistribution && (
          <div className="mt-2 bg-white shadow-lg rounded-lg border border-gray-300 w-40 absolute z-10">
            <Link
              to={`/checkitemsupply/${data.returnId}`}
              className="block text-indigo-500 hover:bg-indigo-100 px-4 py-2 text-sm rounded-t-lg"
            >
              View Item
            </Link>
            <Link
              to={`/checkform/${data._id}`}
              className="block text-indigo-500 hover:bg-indigo-100 px-4 py-2 text-sm rounded-b-lg"
            >
              View STR
            </Link>
          </div>
        )}

        {/* --- OPTIONS WHEN SOURCE IS INVENTORY --- */}
        {showManageOptions && !isDistribution && (
          <div className="mt-2 bg-white shadow-lg rounded-lg border border-gray-300 w-40 absolute z-10">
            {["Transferred", "For Transfer"].includes(data.status) && (
              <>
                <Link
                  to={`/checkitem/${data._id}`}
                  className="block text-indigo-500 hover:bg-indigo-100 px-4 py-2 text-sm rounded-t-lg"
                >
                  View Item
                </Link>
                <Link
                  to={`/checkform/${data._id}`}
                  className="block text-indigo-500 hover:bg-indigo-100 px-4 py-2 text-sm rounded-b-lg"
                >
                  View ITR
                </Link>
              </>
            )}
            {data.status === "Issued" && (
              <Link
                to={`/checkitem/${data._id}`}
                className="block text-indigo-500 hover:bg-indigo-100 px-4 py-2 text-sm rounded-lg"
              >
                View Item
              </Link>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/* ---------- MAIN COMPONENT ---------- */
function MyInventorytable() {
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewInventory, setViewInventory] = useState(true); // true ⇒ inventory, false ⇒ distributions
  const { user } = useContext(AuthContext);

  /* --- FETCH DATA DEPENDING ON VIEW (INVENTORY / DISTRIBUTION) --- */
  useEffect(() => {
    if (!user) return;

    const fetchInventories = async () => {
      try {
        const urls = viewInventory
          ? [
              `${BASE_URL}/inventoryofficeequipment/inventory`,
              `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
              `${BASE_URL}/inventoryofficeICTequipment/inventory`,
            ]
          : [`${BASE_URL}/distribute/distributions`];

        const responses = await Promise.all(
          urls.map((url) =>
            fetch(url).then((response) => {
              if (!response.ok)
                throw new Error(
                  `Failed to fetch data from ${url}: ${response.statusText}`
                );
              return response.json();
            })
          )
        );

        let allItems = responses.flat();

        /* ---------- EXPLODE DISTRIBUTIONS INTO ROWS ---------- */
        if (!viewInventory) {
          allItems = allItems.flatMap((dist) => {
            if (Array.isArray(dist.items) && dist.items.length) {
              return dist.items.map((itm) => ({
                ...dist,                 // keep common props (_id, status, office, etc.)
                itemName: itm.itemName,
                classification: itm.classification,
                quantity: itm.quantity,
                unitofmeasure: itm.unitofmeasure ?? itm.unit,
                returnId: itm.returnId || dist.returnId, // for manage link
              }));
            }
            // fall-back: distribution without items array
            return {
              ...dist,
              itemName: dist.itemName || "—",
              classification: dist.classification || "—",
              quantity: dist.quantity || dist.qty || 0,
              unitofmeasure: dist.unitofmeasure || dist.unit || "—",
            };
          });
        }

        /* --- APPLY USER-CENTRIC FILTERS --- */
        let userItems;
        if (viewInventory) {
          userItems = allItems.filter((item) => {
            if (item.status === "Transferred")
              return item.transfered_to === user.data.username;
            if (item.status === "For Transfer")
              return item.issued_to === user.data.username;
            if (item.status === "Issued")
              return item.issued_to === user.data.username;
            return false;
          });
        } else {
          userItems = allItems.filter(
            (item) => item.distributedto === user.data.username
          );
        }

        setInventoryData(userItems);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchInventories();
  }, [user, viewInventory]);

  /* ---- pagination & search -------------------------------------------- */
  const indexOfLastItem  = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const filteredItems = inventory
    .filter((item) =>
      ((item.itemName ?? item.supplyName ?? "") + "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
    .reverse(); // newest first

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  if (error) return <div>Error: {error}</div>;

  /* ---------- RENDER ---------- */
  return (
    <div className="w-full sm:px-6 pt-10">
      {/* --- PAGE TITLE, SEARCH, TOGGLE BUTTON --- */}
      <div className="flex items-center mb-4">
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500 leading-tight shadow-sm">
          MY {viewInventory ? "INVENTORY" : "SUPPLIES"}
        </p>

        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearch}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
        />

        <button
          onClick={() => setViewInventory(!viewInventory)}
          className="ml-4 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-indigo-200"
        >
          {viewInventory ? "View Supplies" : "View Inventory"}
        </button>
      </div>

      {/* --- TABLE WRAPPER --- */}
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 text-sm leading-none text-gray-800">
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Quantity" />
              <TableHeader title="Unit of measure" />
              <TableHeader title="Status" />
              <TableHeader title="Manage" />
            </tr>
          </thead>
          <tbody>
            {currentItems.map((data, idx) => (
              <TableRow
                key={`${data._id}-${idx}`}
                data={data}
                isDistribution={!viewInventory}
              />
            ))}
          </tbody>
        </table>

        {/* --- PAGINATION BUTTONS --- */}
        {filteredItems.length > itemsPerPage && (
          <div className="flex justify-between mt-4">
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

export default MyInventorytable;
