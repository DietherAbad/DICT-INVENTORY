import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode.react";
import DICT from "../assets/DICT.png";
import { BASE_URL } from "../utils/config";
import { AuthContext } from "../context/AuthContext";

const Loading = () => <p>Loading...</p>;

const Modal = ({ action, onConfirm, onCancel, onReasonChange, reason }) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
    <div className="relative top-1/4 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <div className="mt-3 text-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Are you sure you want to{" "}
          {action === "approve" ? "approve this request" : "decline this request"}
          ?
        </h3>
        <div className="mt-2 px-7 py-3">
          {action === "decline" && (
            <textarea
              placeholder="Enter reason for decline"
              className="w-full p-2 border rounded-md"
              value={reason}
              onChange={onReasonChange}
            />
          )}
          <p className="text-sm text-gray-500">
            Please confirm your action. This cannot be undone.
          </p>
        </div>
        <div className="items-center px-4 py-3">
          <button
            className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
            onClick={onConfirm}
          >
            Proceed
          </button>
          <button
            className="px-4 py-2 mt-2 bg-gray-200 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const Checkform = () => {
  const [state, setState] = useState({
    inventory: [],
    approvers: [],
    approversAFD: [],
    releasers: [],
    inventoryadmins: [],
    error: null,
    loading: true,
  });
  const [supplyData, setSupplyData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [reason, setReason] = useState("");
  const [usedURL, setUsedURL] = useState("");
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { id } = useParams();

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!user) {
      return;
    }
  
    const fetchData = async () => {
      try {
        const urls = [
          `${BASE_URL}/inventoryofficeequipment/inventory`,
          `${BASE_URL}/distribute/distributions`,
          `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
          `${BASE_URL}/inventoryofficeICTequipment/inventory`,
          `${BASE_URL}/inventoryofficemotorandvehicle/inventory`,
        ];
  
        const inventoryResponses = await Promise.all(urls.map((url) => fetch(url)));
  
        let fetchedItems = [];
        let foundURL = "";
  
        for (let i = 0; i < inventoryResponses.length; i++) {
          const response = inventoryResponses[i];
          const data = await response.json();
  
          if (data.some((item) => item._id === id)) {
            fetchedItems = data.filter((item) => item._id === id);
            foundURL = urls[i];
            break;
          }
        }
  
        if (fetchedItems.length === 0) {
          throw new Error("Item not found in any inventory.");
        }
  
        const usersResponse = await fetch(`${BASE_URL}/users`);
        if (!usersResponse.ok) {
          throw new Error(`Failed to fetch users: ${usersResponse.status} ${usersResponse.statusText}`);
        }
        const users = await usersResponse.json();
  
        const approver = users.find((user) => user.role === "Regional Director");
        const approverAFD = users.find((user) => user.role === "AFD");
        const inventoryadmin = users.find((user) => user.role === "Inventory Admin");
        const releaser = users.find((user) => user.username === fetchedItems[0].issued_to);
  
        setState({
          inventory: fetchedItems,
          approvers: approver ? [approver] : [],
          approversAFD: approverAFD ? [approverAFD] : [],
          releasers: releaser ? [releaser] : [],
          inventoryadmins: inventoryadmin ? [inventoryadmin] : [],
          error: null,
          loading: false,
        });
  
        setUsedURL(foundURL);
  
        // Check for returnId only if inventory is not empty
        if (fetchedItems[0]?.returnId) {
          const supplyResponse = await fetch(
            `${BASE_URL}/inventoryofficesupply/inventory/${fetchedItems[0].returnId}`
          );
  
          if (!supplyResponse.ok) {
            throw new Error(`Failed to fetch inventory supply data: ${supplyResponse.status} ${supplyResponse.statusText}`);
          }
  
          const supplyData = await supplyResponse.json();
          setSupplyData(supplyData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setState((prevState) => ({ ...prevState, error, loading: false }));
      }
    };
  
    fetchData();
  }, [user, id]);
  

  const handleAction = async (action) => {
    setShowModal(false);
    const currentStatus = state.inventory.length > 0 ? state.inventory[0].requeststatus : "";
    let updatedStatus = "";
    let requestStatus = "";
    let issuedTo = state.inventory.length > 0 ? state.inventory[0].issued_to : "";
    let date_approved = null;
    let date_released = null;
    let date_received = null;
    let remarks = state.inventory.length > 0 ? state.inventory[0].remarks : "";
    let history = [...state.inventory[0].history || []];  // Use existing history or initialize an empty array if none exists
    let transfertype = null;
    if (action === "approve") {
      if (distributedTo && currentStatus === "For checking") {
        updatedStatus = "For Approval";
      } else if (distributedTo && currentStatus === "For Approval") {
        updatedStatus = "Approved";
        date_approved = new Date();
        date_released = new Date(); // Update date_released to today's date
      } else if (distributedTo && currentStatus === "Approved") {
        updatedStatus = "Received";
        requestStatus = "Transferred";
        date_received = new Date();
      } else if (currentStatus === "For Approval") {
        updatedStatus = "For Release";
        date_approved = new Date();
      } else if (currentStatus === "For Release") {
        updatedStatus = "To receive";
        date_released = new Date();
      } else if (currentStatus === "To receive" || currentStatus === "") {
        updatedStatus = "Received";
        requestStatus = "Transferred";
        date_received = new Date();
        transfertype = 'transferred';
       // Push the new history entry to the history array
       history.push({
        name: state.inventory[0].issued_to,
        from: state.inventory[0].transfertype === 'transferred' ? state.inventory[0].date_received : state.inventory[0].date_issued,
        to: state.inventory[0].date_requested,
        reason: state.inventory[0].reason,
        remarks: "Auto-updated after transfer status change"
    });
      }
    } else if (action === "decline") {
      if (!inventory[0].items || inventory[0].items.length === 0) {
        // If no items array, proceed with the history and status update logic
    
        const filteredHistory = (state.inventory[0].history || []).filter(h => {
          const txt = `${h.remarks || ""} ${h.reason || ""}`.toLowerCase();
          return !txt.includes("transfer was declined");
        });
        const hasHistory = filteredHistory.length > 0;    
    
        // 1️⃣ New statuses
        updatedStatus = "Received";
        requestStatus = hasHistory ? "Transferred" : "Issued";  // Always "Transferred" or "Issued"
          
        // 2️⃣ Clear remarks on the record itself
        remarks = ""; // We no longer send 'remarks'
          
        // 3️⃣ Determine new transfer target
        const newTransferTo = hasHistory
          ? ""  // second (or later) decline → clear
          : state.inventory[0].issued_to; // first decline → reset to current holder
          
        // 4️⃣ Add a history line
        const todayISO = new Date().toISOString();
        history.push({
          name: state.inventory[0].transfered_to,
          from: todayISO,
          to: todayISO,
          reason: `Transfer was declined because: ${reason}`,
        });
    
        navigate(`/checkitem/${inventory[0]._id}`);
      }
    
      // 5️⃣ Update the supply inventory for each item in the inventory array
      try {
        // 1️⃣   Use Promise.all over *state*.inventory
        const updateResponses = await Promise.all(
          state.inventory[0].items.map(async (item) => {
            /* fetch the *current* supply row for THIS item -------------------- */
            const supplyRes = await fetch(
              `${BASE_URL}/inventoryofficesupply/inventory/${item.returnId}`,
            );
            if (!supplyRes.ok) {
              throw new Error(
                `Can't load supply row ${item.returnId}: ` +
                `${supplyRes.status} ${supplyRes.statusText}`
              );
            }
            const supply = await supplyRes.json();   // ← per-item baseline
      
            /* 2️⃣ build the new quantities against THAT baseline -------------- */
            const body = {
              stock_qty:            supply.stock_qty            + item.quantity,
              status:               "Instock",
              stock_total_cost:     supply.stock_total_cost     + item.cost * item.quantity,
      
              distribution_qty:     supply.distribution_qty     - item.quantity,
              distribution_total_cost:
                                    supply.distribution_total_cost
                                                           - item.cost * item.quantity,
      
              balance_qty:          supply.balance_qty          + item.quantity,
              balance_total_cost:   supply.balance_total_cost   + item.cost * item.quantity,
            };
      
            /* 3️⃣ push the update --------------------------------------------- */
            const updateRes = await fetch(
              `${BASE_URL}/inventoryofficesupply/inventory/${item.returnId}`,
              {
                method : "PUT",
                headers: { "Content-Type": "application/json" },
                body   : JSON.stringify(body),
              }
            );
      
            if (!updateRes.ok) {
              throw new Error(
                `Failed to update supply for ${item.itemName}: ` +
                `${updateRes.status} ${updateRes.statusText}`
              );
            }
      
            return updateRes.json();
          })
        );
    
        console.log("All items updated successfully in inventoryofficesupply:", updateResponses);
      } catch (error) {
        console.error("Error updating supply inventory:", error);
        setState((prevState) => ({ ...prevState, error }));
      }
    
      // 6️⃣ Update the distribute collection with the new status
      try {
        const distributeUpdateResponse = await fetch(`${BASE_URL}/distribute/distributions/${inventory[0]._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "Declined",
            requeststatus: "Declined",
          }),
        });
    
        if (!distributeUpdateResponse.ok) {
          throw new Error(
            `Failed to update distribute status for item ${inventory[0].itemName}: ${distributeUpdateResponse.status} ${distributeUpdateResponse.statusText}`
          );
        }
    
        console.log("Distribute status updated to 'Declined' successfully.");
      } catch (error) {
        console.error("Error updating distribute status:", error);
        setState((prevState) => ({ ...prevState, error }));
      }
    }
    
    try {
      const response = await fetch(`${usedURL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requeststatus: updatedStatus,
          ...(requestStatus && { status: requestStatus }),
          ...(date_approved && { date_approved: formatDate(date_approved) }),
          ...(date_released && { date_released: formatDate(date_released) }),
          ...(date_received && { date_received: formatDate(date_received) }),
          ...(remarks && { remarks }),
        history: history.length > 0 ? history : undefined, // Include the history array if it has items
        transfertype: transfertype,
      }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status} ${response.statusText}`);
      }

      const updatedInventory = await response.json();
      setState((prevState) => ({
        ...prevState,
        inventory: [updatedInventory],
      }));

      // Refresh the page
      window.location.reload(); // Add this line to reload the page
    } catch (error) {
      console.error("Error updating status:", error);
      setState((prevState) => ({ ...prevState, error }));
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value);
  };

  const confirmAction = (action) => {
    setModalAction(action);
    setShowModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const { inventory, approvers, approversAFD, releasers, inventoryadmins, error, loading } = state;
//   const issuedTo = inventory.length > 0 ? inventory[0].issued_to : "";
//   const distributedTo = inventory.length > 0 ? inventory[0].distributedto : "";
// const transferedTo  = inventory.length > 0 ? inventory[0].transfered_to : "";
  const approver = approvers.length > 0 ? approvers[0] : null;
  const approverAFD = approversAFD.length > 0 ? approversAFD[0] : null;
  const releaser = releasers.length > 0 ? releasers[0] : null;
  const inventoryadmin = inventoryadmins.length > 0 ? inventoryadmins[0] : null;
  const status = inventory[0]?.requeststatus;

  const finalstatus = inventory.length > 0 ? inventory[0].status : "";
  /* ----------- choose the name that should appear in the “to:” line ------------ */
/* pick the first non-empty variant ---------------------------- */
const transferedTo =
  inventory[0]?.transfered_to   ??
  inventory[0]?.transferedto    ??
  inventory[0]?.transferred_to  ??
  "";
const issuedTo      = inventory[0]?.issued_to      ?? "";

/* A record is considered a “distribution” if it either
   1. originated from the /distribute endpoint, OR
   2. carries an items[] array (supply list).                                    */
   const distributedTo = inventory[0]?.distributedto  ?? "";
   const isDistribution =
     usedURL.includes("/distribute") ||
     (Array.isArray(inventory[0]?.items) && inventory[0].items.length > 0);
   
   const toName = isDistribution ? distributedTo : transferedTo;
  
  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }
  console.log("distributedto =", inventory[0]?.distributedto);
  console.log("transfered_to =", inventory[0]?.transfered_to);
  
  return (
    <div className="print-container">
      <div className="2xl:container 2xl:mx-auto py-14 px-4 md:px-6 xl:px-20">
        <div className="flex flex-col xl:flex-row justify-center items-center space-y-10 xl:space-y-0 xl:space-x-8">
          <div className="flex justify-center flex-col items-start w-full lg:w-9/12 xl:w-full">
            <div className="flex items-center">
              <img
                src={DICT}
                alt="DICT Logo"
                className="h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 lg:h-48 lg:w-48 mr-4 object-contain"
              />
              <h3 className="text-3xl xl:text-4xl font-semibold leading-7 xl:leading-9 w-full md:text-left text-gray-800">
                {distributedTo ? "SUPPLY TRANSFER REQUEST" : "PROPERTY TRANSFER REQUEST"}
              </h3>
            </div>
            <p className="text-base leading-none mt-4 text-gray-800">
              {distributedTo ? "Supply ID." : "Property ID."}:{" "}
              <span className="font-semibold">
                {inventory.length > 0 ? inventory[0].property_no || inventory[0].returnId : ""}
              </span>
            </p>
            <p className="text-base leading-none mt-4 text-gray-800">
  to:{" "}
   <span className="font-semibold">{toName}</span>

        
  
</p>


            {!distributedTo && (

            <div className="flex justify-center items-center w-full mt-8 flex-col space-y-4">
              <div className="flex md:flex-row justify-start items-start md:items-center border border-gray-200 w-full">
                <div className="flex justify-start md:justify-between items-start md:items-center flex-col md:flex-row w-full p-4 md:px-8">
                  <div className="flex flex-col md:flex-shrink-0 justify-start items-start">
                    <h3 className="text-lg md:text-xl w-full font-semibold leading-6 md:leading-5 text-gray-800">
                      {inventory.length > 0 ? inventory[0].classification : ""}
                    </h3>
                    <div className="flex flex-row justify-start space-x-4 md:space-x-6 items-start mt-4">
                      <p className="text-sm leading-none text-gray-600">
                        Quantity:{" "}
                        <span className="text-gray-800">
                          {inventory.length > 0 ? inventory[0].qty || inventory[0].quantity : ""}
                        </span>
                      </p>
                      <p className="text-sm leading-none text-gray-600">
                        Measure:{" "}
                        <span className="text-gray-800">
                          {inventory.length > 0 ? inventory[0].unitofmeasure : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex mt-4 md:mt-0 md:justify-end items-center w-full">
                    <p className="text-xl lg:text-2xl font-semibold leading-5 lg:leading-6 text-gray-800">
                      {inventory.length > 0 ? inventory[0].itemName : ""}
                    </p>
                  </div>
                </div>
              </div>
                <div className="flex md:flex-row justify-start items-start md:items-center border border-gray-200 w-full">
                  <div className="flex justify-start md:justify-between items-start md:items-center flex-col md:flex-row w-full p-4 md:px-8">
                    <div className="flex flex-col md:flex-shrink-0 justify-start items-start">
                      <h3 className="text-lg md:text-xl w-full font-semibold leading-6 md:leading-5 text-gray-800">
                        Inclusions
                      </h3>
                      <div className="flex flex-row justify-start space-x-4 md:space-x-6 items-start mt-4">
                        <p className="text-sm leading-none text-gray-600">
                          <span className="text-gray-800">
                            {inventory.length > 0 ? inventory[0].inclusions || "None" : "None"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
            
            </div>
          )}
            <div className="flex justify-center items-center w-full mt-8 flex-col space-y-4">
  {inventory.length > 0 && inventory[0].items ? (
    inventory[0].items.map((item, index) => (
      <div key={index} className="flex md:flex-row justify-start items-start md:items-center border border-gray-200 w-full">
        <div className="flex justify-start md:justify-between items-start md:items-center flex-col md:flex-row w-full p-4 md:px-8">
          <div className="flex flex-col md:flex-shrink-0 justify-start items-start">
            <h3 className="text-lg md:text-xl w-full font-semibold leading-6 md:leading-5 text-gray-800">
              {item.classification}
            </h3>
            <div className="flex flex-row justify-start space-x-4 md:space-x-6 items-start mt-4">
              <p className="text-sm leading-none text-gray-600">
                Quantity:{" "}
                <span className="text-gray-800">
                  {item.quantity}
                </span>
              </p>
              <p className="text-sm leading-none text-gray-600">
                Measure:{" "}
                <span className="text-gray-800">
                  {item.unitofmeasure}
                </span>
              </p>
              <p className="text-sm leading-none text-gray-600">
                Cost:{" "}
                <span className="text-gray-800">
                  {formatCurrency(item.cost)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex mt-4 md:mt-0 md:justify-end items-center w-full">
            <p className="text-xl lg:text-2xl font-semibold leading-5 lg:leading-6 text-gray-800">
              {item.itemName}
            </p>
          </div>
        </div>
      </div>
    ))
  ) : (
    ''
  )}

  {!distributedTo && inventory.length > 0 && inventory[0].items && (
    <div className="flex md:flex-row justify-start items-start md:items-center border border-gray-200 w-full">
      <div className="flex justify-start md:justify-between items-start md:items-center flex-col md:flex-row w-full p-4 md:px-8">
        <div className="flex flex-col md:flex-shrink-0 justify-start items-start">
          <h3 className="text-lg md:text-xl w-full font-semibold leading-6 md:leading-5 text-gray-800">
            Inclusions
          </h3>
          <div className="flex flex-row justify-start space-x-4 md:space-x-6 items-start mt-4">
            <p className="text-sm leading-none text-gray-600">
              <span className="text-gray-800">
                {inventory.length > 0 ? inventory[0].inclusions || "None" : "None"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )}
</div>

            <div className="flex flex-col justify-start items-start mt-8 xl:mt-10 space-y-10 w-full">
              {status !== "Declined" && (
                <div className="flex justify-start items-start flex-col md:flex-row w-full md:w-auto space-y-8 md:space-y-0 md:space-x-14 xl:space-x-8 lg:w-full">
                  <div className="flex justify-start items-start flex-col space-y-2 flex-1">
                    <p className="text-sm leading-5 text-gray-600">
                      {distributedTo && status === "Received"
                        ? "Checked by:"
                        : distributedTo && status === "For checking"
                        ? "For Checking by:"
                        : distributedTo && status === "For Approval"
                        ? "Checked by:"
                        : distributedTo && status === "Approved"
                        ? "Checked by:"
                        : status === "For Approval"
                        ? "For Approval by:"
                        : "Approved by:"}
                    </p>
                    {distributedTo && status === "Received" && inventoryadmin ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {inventoryadmin.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{inventoryadmin.position}</p>
                      </>
                    ) : distributedTo && status === "For checking" && inventoryadmin ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {inventoryadmin.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{inventoryadmin.position}</p>
                      </>
                    ) : distributedTo && status === "For Approval" && inventoryadmin ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {inventoryadmin.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{inventoryadmin.position}</p>
                        <p className="text-sm leading-5 text-gray-600">
                          Date: {formatDate(inventory[0].date_requested)}
                        </p>
                      </>
                    ) : distributedTo && status === "Approved" && inventoryadmin ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {inventoryadmin.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{inventoryadmin.position}</p>
                      </>
                    ) : approver ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {approver.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{approver.position}</p>
                      </>
                    ) : (
                      <Loading />
                    )}
                    {status !== "For Approval" && (
                      <p className="text-sm leading-5 text-gray-600">
                        Date: {inventory.length > 0 ? formatDate(inventory[0].date_approved) : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-start items-start flex-col space-y-2 flex-1">
                    <p className="text-sm leading-5 text-gray-600">
                      {distributedTo && status === "Received"
                        ? "Approved by:"
                        : distributedTo && status === "For checking"
                        ? "To be approved by:"
                        : distributedTo && status === "For Approval"
                        ? "To be approved by:"
                        : distributedTo && status === "Approved"
                        ? "Approved by:"
                        : status === "For Release" || status === "For Approval"
                        ? "To be released by:"
                        : "Released by:"}
                    </p>
                    {distributedTo && status === "Received" && approverAFD ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {approverAFD.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{approverAFD.position}</p>
                      </>
                    ) : distributedTo && status === "For checking" && approverAFD ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {approverAFD.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{approverAFD.position}</p>
                      </>
                    ) : distributedTo && status === "For Approval" && approverAFD ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {approverAFD.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{approverAFD.position}</p>
                      </>
                    ) : distributedTo && status === "Approved" && approverAFD ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {approverAFD.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{approverAFD.position}</p>
                      </>
                    ) : inventoryadmin ? (
                      <>
                        <p className="text-base font-semibold leading-4 text-gray-800">
                          {inventoryadmin.username}
                        </p>
                        <p className="text-sm leading-5 text-gray-600">{inventoryadmin.position}</p>
                      </>
                    ) : (
                      <Loading />
                    )}
                    {status !== "For Release" && status !== "For Approval" && (
                      <p className="text-sm leading-5 text-gray-600">
                        Date: {inventory.length > 0 ? formatDate(inventory[0].date_released) : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-start items-start flex-col space-y-2 flex-1">
  <p className="text-sm leading-5 text-gray-600">
    {status === "Received" ? "Received by:" : "To be received by:"}
  </p>
  {status === "Received" && (
    <p className="text-sm leading-5 text-gray-600">
      Date: {inventory.length > 0 ? formatDate(inventory[0].date_received) : ""}
    </p>
  )}
  <p className="text-base font-semibold leading-4 text-gray-800">
    {/* Display transfered_to if it has content, otherwise fall back to distributedTo or issuedTo */}
    {inventory[0].transfered_to ? inventory[0].transfered_to : (distributedTo || issuedTo)}
  </p>
</div>

              <div className="flex flex-col space-y-4 w-full">
                <div className="flex justify-center items-center w-full space-y-4 flex-col border-gray-200 border-b pb-4">
                  <div className="flex justify-between w-full">
                    {!distributedTo && (
                      <>
                        <p className="text-base leading-4 text-gray-800">Serial No.</p>
                        <p className="text-base leading-4 text-gray-600">
                          {inventory.length > 0 ? inventory[0].serial_no : ""}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex justify-between w-full">
                    <p className="text-base leading-4 text-gray-800">
                      {distributedTo ? "Cost" : "Unit Cost"}
                    </p>
                    <p className="text-base leading-4 text-gray-600">
                    {
  inventory.length > 0
    ? formatCurrency(
        inventory[0].unit_cost ??
        (inventory[0].items?.reduce((t, item) => t + item.cost, 0) ?? 0)
      )
    : ""
}

                    </p>
                  </div>
                  {distributedTo && (
                    <div className="flex justify-between w-full">
                      <p className="text-base leading-4 text-gray-800">Designation</p>
                      <p className="text-base leading-4 text-gray-600">
                        {inventory.length > 0 ? inventory[0].office : ""}
                      </p>
                    </div>
                  )}
                  {!distributedTo && (
                    <div className="flex justify-between w-full">
                      <p className="text-base leading-4 text-gray-800">Total cost</p>
                      <p className="text-base leading-4 text-gray-600">
                        {inventory.length > 0 ? formatCurrency(inventory[0].total_cost) : ""}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between w-full">
                    <p className="text-base leading-4 text-gray-800">
                      Status{" "}
                      <span className="bg-gray-200 p-1 text-xs font-medium leading-3 text-gray-800">
                        REQUEST
                      </span>
                    </p>
                    <p className="text-base leading-4 text-gray-600">{status}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center w-full">
                  <p className="text-base font-semibold leading-4 text-gray-800">Remarks</p>
                  <p className="text-base font-semibold leading-4 text-gray-600">
                  {inventory.length > 0
  ? (inventory[0].remarks || inventory[0].reason || "")
  : ""}                  </p>
                </div>
                {status === "Declined" && (
  <div className="flex w-full justify-center items-center pt-1 md:pt-4 xl:pt-8 space-y-6 md:space-y-8 flex-col">
    <button
      className="py-5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 w-full text-base font-medium leading-4 text-white bg-gray-800 hover:bg-black print-hidden"
      onClick={handlePrint}
    >
      Print
    </button>
  </div>
)}

{status !== "Declined" && status !== "Received" && (
  <div className="flex w-full justify-center items-center pt-1 md:pt-4 xl:pt-8 space-y-6 md:space-y-8 flex-col">
    <button
      className="py-5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 w-full text-base font-medium leading-4 text-white bg-gray-800 hover:bg-black"
      onClick={() => confirmAction("approve")}
    >
      {distributedTo && status === "For checking"
        ? "Mark as For Approval"
        : distributedTo && status === "For Approval"
        ? "Approve"
        : distributedTo && status === "Approved"
        ? "Mark as Received"
        : status === "For Approval"
        ? "Approve"
        : status === "For Release"
        ? "Release"
        : "Mark as Received"}
    </button>
    <button
      className="py-5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 w-full text-base font-medium leading-4 text-white bg-red-600 hover:bg-red-700"
      onClick={() => confirmAction("decline")}
    >
      Decline
    </button>
  </div>
)}

                {finalstatus === "Transferred" && (
                  <div className="flex w-full justify-center items-center pt-1 md:pt-4 xl:pt-8 space-y-6 md:space-y-8 flex-col">
                    <button
                      className="py-5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 w-full text-base font-medium leading-4 text-white bg-gray-800 hover:bg-black print-hidden"
                      onClick={handlePrint}
                    >
                      Print
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal
          action={modalAction}
          onConfirm={() => handleAction(modalAction)}
          onCancel={() => setShowModal(false)}
          onReasonChange={(e) => setReason(e.target.value)}
          reason={reason}
        />
      )}

      {finalstatus === "Issued" && (
        <div className="print-only">
          <div className="flex justify-end items-end mt-8 xl:mt-10">
            <QRCode value={`${usedURL}/${id}`} size={128} />
          </div>
          <div className="flex justify-center items-center mt-4">
            <p className="text-base font-semibold leading-4 text-gray-800">
              This Property Transfer Request is FULLY APPROVED
            </p>
          </div>
          <div className="flex justify-center items-center">
            <p className="text-sm leading-5 text-gray-600">
              NOTE: This PTR is valid only if FULLY APPROVED, check QR code for validation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Add CSS for print-only + reduced left margin
const style = document.createElement("style");
style.innerHTML = `
    /*----------------------------------*
     |  PRINT STYLES – trim left space  |
     *----------------------------------*/
    @media print {
        .print-hidden { display: none; }
        .print-only  { display: block; }

        body, html   { margin: 0; padding: 0; }
        body *       { visibility: hidden; }

        /* Make ONLY the printable panel visible */
        .print-container,
        .print-container * {
            visibility: visible;
        }

        /* Eliminate left padding and nudge panel even further left */
        .print-container {
            position: absolute;
            left: 0;
            top:  0;
            width: 100%;
            background: #fff;

            /*           T     R      B     L   */
            padding:   0mm   10mm   10mm   0mm;   /* ⬅ 0 mm left padding  */
            margin-left: -3mm;                    /* ⬅ tiny negative offset */
        }
    }

    /* Remove the page’s own left margin entirely */
    @page {
        size: auto;
        margin: 0mm 10mm 10mm 0mm;   /* ⬅ 0 mm left margin */
    }

    .print-only { display: none; }
`;

document.head.appendChild(style);

export default Checkform;
