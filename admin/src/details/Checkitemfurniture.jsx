import React, { useState, useEffect, useRef, useContext } from "react";
import DICT from "../assets/DICT.png";
import { useNavigate, useParams } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import QRCode from "qrcode.react";
import Select from "react-select";
import { AuthContext } from "../context/AuthContext";
import html2canvas from "html2canvas"; // Import html2canvas

export default function Checkitemfurniture() {
  const [inventory, setInventoryData] = useState([]);
  const { id } = useParams();
  const [error, setError] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);
  const [users, setUsers] = useState([]);
  const qrRef = useRef();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate(); // Use navigate hook

  /* --- safe username fallback --- */
  const username = user?.data?.username ?? "";

  /* ---------- responsive QR size ---------- */
  const computeQrSize = () => {
    const w = window.innerWidth;
    if (w < 480) return 160;
    if (w < 640) return 200;
    if (w < 768) return 256;
    if (w < 1024) return 384;
    return 512;
  };
  const [qrSize, setQrSize] = useState(computeQrSize);

  useEffect(() => {
    const handleResize = () => setQrSize(computeQrSize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ⬇️  DOWNLOAD STICKER (hide buttons first, then restore)  ⬇️
  const handleDownload = () => {
    const contentToDownload = document.getElementById("download-wrapper"); // capture BOTH panels

    // Buttons to hide
    const backBtn = document.getElementById("back-button");
    const issueBtn = document.getElementById("issue-button");
    const historyBtn = document.getElementById("history-button");
    const downloadBtn = document.getElementById("download-button");
    const buttons = [backBtn, issueBtn, historyBtn, downloadBtn];
    const prevDisplay = buttons.map((b) => (b ? b.style.display : null));

    // Hide selected buttons
    buttons.forEach((b) => {
      if (b) b.style.display = "none";
    });

    // Capture & download image
    html2canvas(contentToDownload).then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "inventory-details.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Restore buttons
      buttons.forEach((b, i) => {
        if (b) b.style.display = prevDisplay[i];
      });
    });
  };

  /* --------------------------------------------------- */
  /*               ISSUE & TRANSFER HANDLERS             */
  /* --------------------------------------------------- */
  const handleIssueConfirm = (selectedUser) => {
    if (!selectedUser) {
      alert("Please select a name.");
      return;
    }

    const currentDate = new Date().toISOString();

    const updatedData = {
      issued_to: selectedUser.value,
      date_issued: currentDate,
      status: "Issued",
    };

    fetch(`${BASE_URL}/inventoryofficefurnitureandfixture/inventory/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedData),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update data");
        }
        return response.json();
      })
      .then(() => {
        setShowPopup(false);
        setShowSuccessPopup(true);
        setTimeout(() => window.location.reload(), 300); // small delay lets the modal flash
      })
      .catch((error) => {
        console.error("Error updating data:", error);
      });
  };

  const handleTransferConfirm = (selectedUser, reason) => {
    if (!selectedUser) {
      alert("Please select a name.");
      return;
    }

    const currentDate = new Date().toISOString();

    const updatedData = {
      status: "For Transfer",
      requeststatus: "For Approval",
      transfered_to: selectedUser.value,                          // new receiver
      issued_to:
        inventory.status === "Transferred"
          ? inventory.transfered_to                               // copy existing transfer target
          : inventory.issued_to,                                  // otherwise keep current holder
      reason: reason,
      date_requested: currentDate,
    };
    

    fetch(`${BASE_URL}/inventoryofficefurnitureandfixture/inventory/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedData),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update data");
        }
        return response.json();
      })
      .then(() => {
        setShowTransferPopup(false);
        setShowSuccessPopup(true);
        setTimeout(() => window.location.reload(), 300); // small delay lets the modal flash
      })
      .catch((error) => {
        console.error("Error updating data:", error);
      });
  };

  /* --------------------------------------------------- */
  /*                    FETCH DATA                       */
  /* --------------------------------------------------- */
  useEffect(() => {
    fetch(`${BASE_URL}/inventoryofficefurnitureandfixture/inventory/${id}`)
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

    fetch(`${BASE_URL}/users`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        return response.json();
      })
      .then((data) => {
        setUsers(data);
      })
      .catch((error) => {
        console.error("Error fetching users:", error);
      });
  }, [id]);

  /* --------------------------------------------------- */
  /*                 QR CODE DOWNLOAD                    */
  /* --------------------------------------------------- */
  const currentLink = window.location.href;

  const handleQRDownload = () => {
    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) {
      console.error("QR code canvas element not found");
      return;
    }
    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = "qr-code.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  /* --------------------------------------------------- */
  /*            POPUP & MODAL TOGGLERS                   */
  /* --------------------------------------------------- */
  const togglePopup = () => setShowPopup(!showPopup);
  const toggleTransferPopup = () => setShowTransferPopup(!showTransferPopup);
  const toggleSuccessPopup = () => setShowSuccessPopup(!showSuccessPopup);
  const toggleHistoryPopup = () => setShowHistoryPopup(!showHistoryPopup);

  /* --------------------------------------------------- */
  /*                 HELPER FUNCTIONS                    */
  /* --------------------------------------------------- */
  function formatDate(dateString) {
    const date = new Date(dateString);
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    return `${monthNames[monthIndex]} ${day} - ${year}`;
  }

  const userOptions = users.map((u) => ({
    value: u.username,
    label: u.username,
  }));

  /* --------------------------------------------------- */
  /*                     COMPONENTS                      */
  /* --------------------------------------------------- */
  const Modal = ({ action, onConfirm, onCancel }) => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [reason, setReason] = useState("");

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
        <div className="relative top-1/4 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3 text-center">
            <h3 className="text-lg font-medium text-gray-900">
              {action === "approve"
                ? "Are you sure you want to approve this request?"
                : "Are you sure you want to transfer this item?"}
            </h3>
            <p className="mt-2 text-sm text-gray-500 px-7">
              Please confirm your action. This cannot be undone.
            </p>

            <div className="mt-4">
              <Select
                options={userOptions}
                onChange={setSelectedUser}
                value={selectedUser}
                placeholder="Select an employee"
                isClearable
              />
            </div>

            {action === "transfer" && (
              <textarea
                className="w-full mt-4 border rounded-md py-2 px-3"
                rows="4"
                placeholder="Remarks"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              ></textarea>
            )}

            <div className="items-center px-4 py-3">
              <button
                className="w-full py-2 bg-gray-800 text-white rounded-md hover:bg-black"
                onClick={() => onConfirm(selectedUser, reason)}
              >
                Proceed
              </button>
              <button
                className="w-full py-2 mt-2 bg-gray-200 rounded-md hover:bg-gray-300"
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SuccessModal = ({ onClose }) => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-1/4 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg font-medium text-gray-900">Success</h3>
          <p className="mt-2 text-sm text-gray-500 px-7">
            The operation was completed successfully.
          </p>
          <button
            className="w-full py-2 mt-4 bg-gray-800 text-white rounded-md hover:bg-black"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const ViewHistoryModal = ({ history, onClose }) => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div className="relative top-1/4 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg font-medium text-gray-900">View History</h3>
          <p className="mt-2 text-sm text-gray-500 px-7">
            Below are the changes made to this item.
          </p>
          <div className="space-y-4 mt-4">
            {inventory.history?.length ? (
              inventory.history.map((item) => (
                <div key={item._id} className="bg-gray-100 p-4 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-gray-800">{item.name}</h4>
                  <p className="text-sm text-gray-600">From: {new Date(item.from).toLocaleString()}</p>
                  <p className="text-sm text-gray-600">To: {new Date(item.to).toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Remarks: {item.reason}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No history available for this item.</p>
            )}
          </div>
          <button className="w-full py-2 mt-4 bg-gray-800 text-white rounded-md hover:bg-black" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  /* --------------------------------------------------- */
  /*                     RENDER                           */
  /* --------------------------------------------------- */
  return (
    <div className="2xl:container 2xl:mx-auto lg:py-5 lg:px-20 md:py-12 md:px-6 py-9 px-4">
      <div id="download-wrapper" className="flex justify-center items-center lg:flex-row flex-col gap-8">
        {/* ---------- LEFT PANEL (sticker + buttons) ---------- */}
        <div id="content-to-download" className="w-full sm:w-96 md:w-8/12 lg:w-6/12">
          {/* Back Button */}
          {user && (
            <div className="flex items-center mb-4">
              <button
                id="back-button"
                onClick={() => navigate("/stocktablefurnitureandfixture")}
                className="mr-4 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 text-white hover:bg-black"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="14 2 7 9 14 16" />
                </svg>
              </button>
              <p className="text-base text-gray-600">PROPERTY OF DICT REGION 2</p>
            </div>
          )}

          {!user && (
            <div className="mb-4">
              <p className="text-base text-gray-600">PROPERTY OF DICT REGION 2</p>
            </div>
          )}

          {/* Sticker Info */}
          <h2 className="text-3xl lg:text-4xl font-semibold text-gray-800">{inventory.classification}</h2>
          <p className="mt-6 text-xl lg:text-2xl font-semibold">{inventory.itemName}</p>

          {/* Details */}
          <div className="mt-10 lg:mt-11 space-y-2">
            <DetailRow label="Property No." value={inventory.property_no} />
            <DetailRow
              label="Unit cost"
              value={
                inventory.unit_cost
                  ? inventory.unit_cost.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
                  : ""
              }
            />
            <DetailRow label="Quantity" value={`${inventory.qty}`} />
            <DetailRow label="Classification" value={inventory.classification} />
            <DetailRow label="Date acquired" value={inventory.date_acquired ? formatDate(inventory.date_acquired) : ""} />
            <DetailRow label="Serial No." value={inventory.serial_no} />

            {/* Issued / Transferred / For Transfer info */}
            {inventory.status === "Issued" && inventory.issued_to && (
              <>
                <DetailRow label="Issued to" value={inventory.issued_to} />
                {inventory.date_issued && <DetailRow label="Date issued" value={formatDate(inventory.date_issued)} />}
              </>
            )}

            {inventory.status === "Transferred" && inventory.transfered_to && <DetailRow label="Transferred to" value={inventory.transfered_to} />}

            {inventory.status === "For Transfer" && inventory.transfered_to && <DetailRow label="For Transfer To" value={inventory.transfered_to} />}

            <DetailRow label="Stored to" value={inventory.stored_to} />
            <DetailRow label="Status" value={inventory.status} />
            <DetailRow label="Inclusions" value={inventory.inclusions} />

            <div className="flex justify-between">
              <p className="font-medium text-base">{inventory.remarks}</p>
            </div>
            <p className="text-sm text-gray-500 mt-3">If lost please contact 092345345</p>
          </div>

          {/* ACTION BUTTONS — only visible to logged-in users */}
          {user && (
            <>
              <button id="download-button" onClick={handleDownload} className="w-full py-5 mt-6 bg-green-800 text-white font-medium hover:bg-black">
                Download Sticker
              </button>

              {inventory.issued_to === username && inventory.status !== "For Transfer" && inventory.status !== "Transferred" && (
                <button
                  onClick={toggleTransferPopup}
                  className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-blue-800 w-full py-5 lg:mt-3 mt-6"
                >
                  Transfer
                </button>
              )}

              {!inventory.issued_to && inventory.status !== "For Transfer" && (
                <button id="issue-button" onClick={togglePopup} className="w-full py-5 mt-6 bg-red-800 text-white font-medium hover:bg-black">
                  Issue
                </button>
              )}

              <button id="history-button" onClick={toggleHistoryPopup} className="w-full py-5 mt-6 bg-gray-800 text-white font-medium hover:bg-black">
                View History
              </button>
            </>
          )}
        </div>

        {/* ---------- RIGHT PANEL (QR) ---------- */}
        <div className="w-full lg:w-6/12 bg-gray-100 flex justify-center items-center">
          <div className="w-full sm:w-2/3 md:w-1/2 lg:w-3/4" ref={qrRef}>
            <QRCode value={currentLink} size={qrSize} />
          </div>
        </div>
      </div>

      {/* ---------- POPUPS ---------- */}
      {showPopup && (
        <Modal action="issue" onConfirm={handleIssueConfirm} onCancel={() => setShowPopup(false)} />
      )}

      {showTransferPopup && (
        <Modal action="transfer" onConfirm={handleTransferConfirm} onCancel={() => setShowTransferPopup(false)} />
      )}

      {showSuccessPopup && <SuccessModal onClose={toggleSuccessPopup} />}
      {showHistoryPopup && <ViewHistoryModal onClose={toggleHistoryPopup} />}
    </div>
  );
}

/* ---------- Small helper component ---------- */
const DetailRow = ({ label, value }) => (
  <>
    <div className="flex justify-between">
      <p className="text-gray-600 font-medium text-base">{label}</p>
      <p className="font-medium text-base">{value}</p>
    </div>
    <hr className="bg-gray-200 w-full my-2" />
  </>
);
