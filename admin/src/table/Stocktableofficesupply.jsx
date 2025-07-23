import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";
import { AuthContext } from "../context/AuthContext";

/* ---------- tiny reusable <th> ---------- */
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
function TableRow({ data, handleAddToCart }) {
  const qty =
    Number(data.balance_qty ?? data.stock_qty ?? 0); // whichever field exists

  let displayStatus = data.status; // default from backend
  if (data.status === "Instock" && qty < 20) {
    displayStatus = "low on stock";
  }

  let statusClass = "bg-green-100 text-green-700"; // default (Instock)
  if (displayStatus === "Out of stock") {
    statusClass = "bg-red-100 text-red-700";
  } else if (displayStatus === "low on stock") {
    statusClass = "bg-yellow-100 text-yellow-700";
  }

  const formattedDate = data.date
    ? new Date(data.date).toISOString().split("T")[0]
    : "N/A";

  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center border-b">
        {data.stock_no}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.itemName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.classification}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.balance_qty}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.unitofmeasure}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {data.balance_unit_cost}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center border-b">
        {formattedDate}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center border-b">
        <span
          className={
            "px-2 py-1 text-sm font-medium rounded-full capitalize " + statusClass
          }
        >
          {displayStatus}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center border-b">
        <div className="flex justify-center items-center space-x-2">
          <Link
            to={`/checkitemsupply/${data._id}`}
            className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-2 rounded"
          >
            Manage
          </Link>
          <button
            onClick={() => handleAddToCart(data)}
            className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-2 rounded"
          >
            Add to Cart
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ---------- main component ---------- */
function Stocktableofficesupply() {
  const { user } = useContext(AuthContext); // Getting user data from AuthContext
  const [inventory, setInventoryData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailableOnly, setShowAvailableOnly] = useState(true); // default: only Instock
  const [cart, setCart] = useState([]);
  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showCartPopup, setShowCartPopup] = useState(false); // state to control view cart popup
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false); // state to control checkout confirmation
  const [toastMessage, setToastMessage] = useState(""); // state for custom toast message
  const navigate = useNavigate();

  /* ----- fetch on mount ----- */
  useEffect(() => {
    fetch(`${BASE_URL}/inventoryofficesupply/inventory`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch data");
        return response.json();
      })
      .then((data) => {
        setInventoryData(data.reverse()); // newest first
      })
      .catch((err) => setError(err));
  }, []);

  /* ----- helpers ----- */
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  /* availability + search filters */
  const filteredItems = inventory
    .filter((item) => (showAvailableOnly ? item.status === "Instock" : true))
    .filter((item) =>
      [
        item.stock_no,
        item.itemName,
        item.classification,
        item.balance_qty,
        item.unitofmeasure,
        item.balance_unit_cost,
        item.status,
      ]
        .filter(Boolean)
        .some((field) =>
          field.toString().toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (page) => setCurrentPage(page);
  const handleBack = () => navigate("/officedashboard");
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };
  const toggleShowAvailable = () => {
    setShowAvailableOnly((prev) => !prev);
    setCurrentPage(1);
  };

  /* ----- handle Add to Cart ----- */
  const handleAddToCart = (item) => {
    setSelectedItem(item);
    setQuantity(1); // Reset the quantity to 1 each time an item is selected
    setShowRequestPopup(true);
  };

  /* ----- handle Confirm Add to Cart ----- */
  const handleConfirmAddToCart = () => {
    if (quantity > selectedItem.balance_qty) {
      setToastMessage(`Not enough available stock for ${selectedItem.itemName}`);
      setTimeout(() => setToastMessage(""), 3000); // Clear the toast after 3 seconds
      return;
    }

    const newCartItem = {
      returnId: selectedItem._id,
      classification: selectedItem.classification,
      itemName: selectedItem.itemName,
      unitofmeasure: selectedItem.unitofmeasure,
      quantity: quantity,
      cost: selectedItem.balance_unit_cost * quantity,
      distributedto: user.data.username, // Get distributedto from user data
      office: user.data.designation, // Get office from user data
      distributedto_is: user.data._id, // Get distributedto_is from user data
    };

    // Get the cart from localStorage
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push(newCartItem);

    // Save updated cart back to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));

    // Close popup and reset quantity
    setShowRequestPopup(false);
    setToastMessage('Item added to cart!');
    setTimeout(() => setToastMessage(""), 3000); // Clear the toast after 3 seconds
  };

  /* ----- handle Cancel Add to Cart ----- */
  const handleCancelAddToCart = () => {
    setShowRequestPopup(false);
    setQuantity(1);
  };

  /* ----- Open Cart Popup ----- */
  const handleViewCart = () => {
    setShowCartPopup(true);
  };

  /* ----- Close Cart Popup ----- */
  const handleCloseCartPopup = () => {
    setShowCartPopup(false);
  };

  /* ----- Remove Item from Cart ----- */
  const handleRemoveItemFromCart = (returnId) => {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const updatedCart = cart.filter(item => item.returnId !== returnId);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    setCart(updatedCart); // Update the state to reflect the change
  };

  /* ----- Clear Cart ----- */
  const handleClearCart = () => {
    localStorage.removeItem('cart');
    setCart([]); // Clear the cart state
  };

  /* ----- Update Quantity ----- */
  const handleAddQuantity = (returnId) => {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const updatedCart = cart.map(item => 
      item.returnId === returnId 
        ? { ...item, quantity: item.quantity + 1 } 
        : item
    );
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    setCart(updatedCart); // Update the state to reflect the change
  };

  const handleLessQuantity = (returnId) => {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const updatedCart = cart.map(item => 
      item.returnId === returnId && item.quantity > 1 
        ? { ...item, quantity: item.quantity - 1 } 
        : item
    );
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    setCart(updatedCart); // Update the state to reflect the change
  };

  /* ----- Handle Checkout Confirmation ----- */
  const handleCheckoutConfirmation = () => {
    setShowCheckoutPopup(true);
  };

  const handleCancelCheckout = () => {
    setShowCheckoutPopup(false);
  };

  const handleProceedCheckout = () => {
    const currentDate = new Date().toISOString();

    // Prepare the cart items for the distribution post request
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];

    // Check if all requested quantities are available in stock
    for (let item of cartItems) {
      const inventoryItem = inventory.find((inv) => inv._id === item.returnId);

      if (item.quantity > inventoryItem.balance_qty) {
        setToastMessage(`Not enough available stock for ${item.itemName}`);
        setTimeout(() => setToastMessage(""), 3000);
        return;
      }
    }

    // Update inventory stock for each cart item
    cartItems.forEach((item) => {
      const inventoryItem = inventory.find((inv) => inv._id === item.returnId);
      const updatedBalanceQty = inventoryItem.balance_qty - item.quantity;
      const updatedInventory = {
        ...inventoryItem,
        balance_qty: updatedBalanceQty,
      };

      // Update the inventory with new stock values
      fetch(`${BASE_URL}/inventoryofficesupply/inventory/${item.returnId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedInventory),
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to update inventory');
        }
      })
      .catch((error) => {
        console.error(error);
        setToastMessage("Failed to update inventory");
      });
    });

    // Proceed to post distribution data
    fetch(`${BASE_URL}/distribute/distributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cartItems.map(item => ({
          returnId: item.returnId,
          classification: item.classification,
          itemName: item.itemName,
          unitofmeasure: item.unitofmeasure,
          quantity: item.quantity,
          cost: item.cost,
        })),
        distributedto: user.data.username,
        office: user.data.designation,
        distributedto_is: user.data._id,
        status: "Pending",
        requeststatus: "For checking",
        date_requested: currentDate,
      }),
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to create distribution');
      }

      // On success, clear the cart
      localStorage.removeItem('cart');
      setCart([]);
      setShowCheckoutPopup(false);
      setToastMessage('Checkout successful!');
      setTimeout(() => setToastMessage(""), 3000); // Clear the toast after 3 seconds
    })
    .catch((error) => {
      console.error('Error posting distribution data:', error);
      setToastMessage('Error posting distribution data');
      setTimeout(() => setToastMessage(""), 3000);
    });
  };

  /* ----- render ----- */
  if (error) return <div>Error: {error.message}</div>;

  const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
  const hasCartItems = cartItems.length > 0;

  return (
    <div className="w-full sm:px-6 pt-10">
      {/* -------- header / controls -------- */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg transition-transform transform hover:scale-105 mr-2"
          >
            <img src={arrowIcon} alt="Back" className="w-5 h-5 mr-2" />
            Back
          </button>
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-black leading-tight shadow-sm">
            STOCK TABLE FOR OFFICE SUPPLIES
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleShowAvailable}
            className={`mr-2 px-3 py-2 rounded-md shadow-md ${
              showAvailableOnly
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-black"
            }`}
          >
            {showAvailableOnly ? "Show All" : "Show Available"}
          </button>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearch}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
          <button
            onClick={handleViewCart}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
          >
            View Cart ({cartItems.length})
          </button>
        </div>
      </div>

      {/* -------- table -------- */}
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800">
              <TableHeader title="Stock No." />
              <TableHeader title="Item Description" />
              <TableHeader title="Classification" />
              <TableHeader title="Quantity" />
              <TableHeader title="Unit of Measure" />
              <TableHeader title="Unit Cost" />
              <TableHeader title="Date" />
              <TableHeader title="Status" />
              <TableHeader title="Action" />
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item) => (
              <TableRow key={item._id} data={item} handleAddToCart={handleAddToCart} />
            ))}
          </tbody>
        </table>

        {/* -------- pagination -------- */}
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
              disabled={currentPage === Math.ceil(filteredItems.length / itemsPerPage)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* -------- Toast Message -------- */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg">
          <p className="text-sm">{toastMessage}</p>
        </div>
      )}

      {/* -------- Request Add to Cart Popup -------- */}
      {showRequestPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-5 border shadow-lg rounded-md w-full max-w-md">
            <div className="text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Add Item to Cart
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Please confirm the quantity before adding to cart.
              </p>
              <div className="mt-4">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  max={selectedItem.balance_qty} // Limit the quantity based on stock
                  className="border border-gray-300 rounded-md w-full py-2 px-3 mb-4"
                  placeholder="Enter quantity"
                />
                <div className="mt-4">
                  <button
                    onClick={handleConfirmAddToCart}
                    className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full mb-2 shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={handleCancelAddToCart}
                    className="px-4 py-2 bg-gray-200 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------- View Cart Popup -------- */}
      {showCartPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-5 border shadow-lg rounded-md w-full max-w-md">
            <div className="text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                View Cart
              </h3>
              <div className="mt-4 space-y-4">
                {/* Display message if no items are in the cart */}
                {hasCartItems ? (
                  cartItems.map((item, index) => (
                    <div key={index} className="bg-gray-100 p-4 rounded-lg shadow-sm">
                      <div className="flex flex-col space-y-2">
                        <h4 className="font-semibold text-gray-800">{item.itemName}</h4>
                        <p className="text-sm text-gray-600">Quantity: <strong>{item.quantity}</strong></p>
                        <p className="text-sm text-gray-600">Unit Cost: {item.cost}</p>
                        <p className="text-sm text-gray-600">Office: {item.office}</p>
                        <p className="text-sm text-gray-600">Total Cost: {item.cost * item.quantity}</p>
                      </div>
                      <div className="flex justify-between mt-2">
                        <button
                          onClick={() => handleAddQuantity(item.returnId)}
                          className="text-green-500 bg-gray-200 hover:bg-green-100 rounded-md px-3 py-2 shadow-md"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => handleLessQuantity(item.returnId)}
                          className="text-red-500 bg-gray-200 hover:bg-red-100 rounded-md px-3 py-2 shadow-md"
                        >
                          Less
                        </button>
                        <button
                          onClick={() => handleRemoveItemFromCart(item.returnId)}
                          className="text-red-500 bg-gray-200 hover:bg-red-100 rounded-md px-3 py-2 shadow-md"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-lg text-gray-600">No items in the cart</p>
                )}
              </div>
              {hasCartItems && (
                <>
                  <button
                    onClick={handleCheckoutConfirmation}
                    className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full mt-4 shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                  >
                    Checkout
                  </button>
                  <button
                    onClick={handleClearCart}
                    className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full mt-2 shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                  >
                    Clear Cart
                  </button>
                </>
              )}
              <button
                onClick={handleCloseCartPopup}
                className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full mt-2 shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------- Checkout Confirmation Popup -------- */}
      {showCheckoutPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-5 border shadow-lg rounded-md w-full max-w-md">
            <div className="text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Checkout Confirmation
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to proceed with the checkout?
              </p>
              <div className="mt-4">
                <button
                  onClick={handleProceedCheckout}
                  className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full mb-2 shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                >
                  Proceed
                </button>
                <button
                  onClick={handleCancelCheckout}
                  className="px-4 py-2 bg-gray-200 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stocktableofficesupply;
