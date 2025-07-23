import React, { useState, useEffect, useContext } from "react";
import DICT from '../assets/DICT.png';
import { useParams, useNavigate } from 'react-router-dom';
import { BASE_URL } from '../utils/config';
import Select from 'react-select';
import { AuthContext } from "../context/AuthContext";

const ViewHistoryModal = ({ history, onClose }) => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
        <div className="relative top-1/4 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                    View History
                </h3>
                <div className="mt-2 px-7 py-3">
                    <p className="text-sm text-gray-500">
                        Below are the changes made to this item.
                    </p>
                </div>
                <div className="space-y-4">
                    {history.length > 0 ? (
                        history.map((item, index) => (
                            <div key={index} className="bg-gray-100 p-4 rounded-lg shadow-sm">
                                <div className="flex flex-col space-y-2">
                                    <h4 className="font-semibold text-gray-800">{item.name}</h4>
                                    <p className="text-sm text-gray-600">Date: {new Date(item.date).toLocaleString()}</p>
                                    <p className="text-sm text-gray-600">Status: {item.status}</p>
                                    <p className="text-sm text-gray-600">Remarks: {item.remarks}</p>
                                    <p className="text-sm text-gray-600">Disposed Quantity: {item.disposed_qty}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500">No history available for this item.</p>
                    )}
                </div>
                <div className="items-center px-4 py-3">
                    <button
                        className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const Modal = ({ onConfirm, onCancel, designation, handleDesignationChange, quantity, handleQuantityChange, userOptions, setDistributedTo, distributedTo, action, remarks, handleRemarksChange }) => {
    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (action === 'request') {
            setDistributedTo({ value: user.data.username, label: user.data.username });
        }
    }, [action, setDistributedTo, user.data.username]);

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
            <div className="bg-white p-5 border shadow-lg rounded-md w-full max-w-md">
                <div className="text-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Are you sure you want to {action} this item?
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">
                        Please confirm your action. This cannot be undone.
                    </p>
                    <div className="mt-4">
                        <input 
                            type="text" 
                            id='quantity' 
                            value={quantity} 
                            onChange={handleQuantityChange} 
                            className="border border-gray-300 rounded-md w-full py-2 px-3 mb-4" 
                            placeholder="Enter quantity" 
                        />
                        {action !== 'dispose' && (
                            <select 
                                id="designation" 
                                onChange={handleDesignationChange} 
                                className="border border-gray-300 rounded-md w-full py-2 px-3 mb-4"
                                value={designation}
                            >
                                <option value="">Select Designation</option>
                                <option value="Regional Office - Tuguegarao">Regional Office - Tuguegarao</option>
                                <option value="Isabela Office - Cauayan">Isabela Office - Cauayan</option>
                                <option value="Isabela Office - Santiago">Isabela Office - Santiago</option>
                                <option value="Nueva Vizcaya Office">Nueva Vizcaya Office</option>
                                <option value="Batanes Office">Batanes Office</option>
                            </select>
                        )}
                        <textarea
                            id="remarks"
                            value={remarks}
                            onChange={handleRemarksChange}
                            className="border border-gray-300 rounded-md w-full py-2 px-3 mb-4"
                            placeholder="Enter remarks"
                        />
                        {action === 'distribute' ? (
                            <Select
                                options={userOptions}
                                onChange={setDistributedTo}
                                placeholder="Distributed to"
                                isClearable
                                value={distributedTo}
                                className="mb-4"
                            />
                        ) : (
                            <input 
                                type="text" 
                                id='distributedTo' 
                                value={distributedTo ? distributedTo.label : ''} 
                                className="border border-gray-300 rounded-md w-full py-2 px-3 mb-4" 
                                disabled
                            />
                        )}
                    </div>
                    <div className="mt-4">
                        <button 
                            className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full mb-2 shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                            onClick={onConfirm}
                        >
                            Proceed
                        </button>
                        <button 
                            className="px-4 py-2 bg-gray-200 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
        <div className="bg-white p-5 border shadow-lg rounded-md w-full max-w-md">
            <div className="text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Success
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                    The operation was completed successfully.
                </p>
                <button 
                    className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full mt-4 shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    </div>
);

const ErrorModal = ({ onClose }) => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
        <div className="bg-white p-5 border shadow-lg rounded-md w-full max-w-md">
            <div className="text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Error
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                    There was an error processing your request. Please try again.
                </p>
                <button 
                    className="px-4 py-2 bg-gray-800 text-white text-base font-medium rounded-md w-full mt-4 shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    </div>
);

export default function Checkitemsupply() {
    const [inventory, setInventoryData] = useState({});
    const { id } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [designation, setDesignation] = useState('');
    const [quantity, setQuantity] = useState('');
    const [distributedTo, setDistributedTo] = useState(null);
    const [users, setUsers] = useState([]);
    const [remarks, setRemarks] = useState('');
    const [action, setAction] = useState('');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const { user } = useContext(AuthContext);

    useEffect(() => {
        fetch(`${BASE_URL}/inventoryofficesupply/inventory/${id}`)
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

        fetch(`${BASE_URL}/users`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch users');
                }
                return response.json();
            })
            .then(data => {
                setUsers(data);
            })
            .catch(error => {
                console.error('Error fetching users:', error);
            });
    }, [id]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const monthNames = [
            "January", "February", "March",
            "April", "May", "June", "July",
            "August", "September", "October",
            "November", "December"
        ];
        const day = date.getDate();
        const monthIndex = date.getMonth();
        const year = date.getFullYear();
        return `${monthNames[monthIndex]} ${day}, ${year}`;
    }

    const getCurrentDate = () => {
        const date = new Date();
        return date.toISOString();
    }

    const togglePopup = (actionType) => {
        setAction(actionType);
        setShowPopup(!showPopup);
    }

    const handleDesignationChange = (event) => {
        setDesignation(event.target.value);
    }

    const handleQuantityChange = (event) => {
        setQuantity(event.target.value);
    }

    const handleRemarksChange = (event) => {
        setRemarks(event.target.value);
    }

    const handleConfirmDispose = () => {
        const maxQuantity = inventory.balance_qty;
        const inputQuantity = parseInt(quantity, 10); 
        const currentDate = getCurrentDate();

        if (isNaN(inputQuantity) || inputQuantity <= 0 || inputQuantity > maxQuantity) {
            setShowErrorPopup(true);
            return;
        }

        const updatedStockQty = inventory.stock_qty - inputQuantity;
        const updatedStockTotalCost = inventory.stock_total_cost - (inventory.stock_unit_cost * inputQuantity);
        const updatedDistributionQty = inventory.distribution_qty + inputQuantity;
        const updatedDistributionTotalCost = updatedDistributionQty * inventory.stock_unit_cost;
        const updatedBalanceQty = inventory.balance_qty - inputQuantity;
        const updatedBalanceTotalCost = inventory.stock_total_cost - (inventory.stock_unit_cost * inputQuantity);
        const updatedStatus = updatedBalanceQty === 0 ? 'Out of stock' : inventory.status;

        const updatedInventory = {
            ...inventory,
            stock_qty: updatedStockQty,
            stock_total_cost: updatedStockTotalCost,
            distribution_qty: updatedDistributionQty,
            distribution_unit_cost: inventory.stock_unit_cost,
            distribution_total_cost: updatedDistributionTotalCost,
            balance_qty: updatedBalanceQty,
            balance_total_cost: updatedBalanceTotalCost,
            status: updatedStatus,
            disposed_qty: inventory.disposed_qty + inputQuantity,  
            history: [
                ...inventory.history,
                {
                    name: user.data.username,
                    date: currentDate,
                    station: 'Regional Office',
                    status: 'Dispose',
                    requeststatus: 'Pending',
                    remarks: remarks,
                    disposed_qty: inputQuantity 
                }
            ]
        };

        setInventoryData(updatedInventory);

        fetch(`${BASE_URL}/inventoryofficesupply/inventory/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedInventory)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update inventory data');
            }
            setShowSuccessPopup(true);
        })
        .catch(error => {
            console.error('Error updating inventory data:', error);
            setShowErrorPopup(true);
        });

        setShowPopup(false);
    }

    const handleConfirmDistribution = () => {
        const maxQuantity = inventory.balance_qty;
        const inputQuantity = parseInt(quantity, 10);
        const currentDate = getCurrentDate();

        if (isNaN(inputQuantity) || inputQuantity <= 0 || inputQuantity > maxQuantity) {
            setShowErrorPopup(true);
            return;
        }

        const updatedStockQty = inventory.stock_qty - inputQuantity;
        const updatedStockTotalCost = inventory.stock_total_cost - (inventory.stock_unit_cost * inputQuantity);
        const updatedDistributionQty = inventory.distribution_qty + inputQuantity;
        const updatedDistributionTotalCost = updatedDistributionQty * inventory.stock_unit_cost;
        const updatedBalanceQty = inventory.balance_qty - inputQuantity;
        const updatedBalanceTotalCost = inventory.stock_total_cost - (inventory.stock_unit_cost * inputQuantity);
        const updatedStatus = updatedBalanceQty === 0 ? 'Out of stock' : inventory.status;

        const updatedInventory = {
            ...inventory,
            stock_qty: updatedStockQty,
            stock_total_cost: updatedStockTotalCost,
            distribution_qty: updatedDistributionQty,
            distribution_unit_cost: inventory.stock_unit_cost,
            distribution_total_cost: updatedDistributionTotalCost,
            balance_qty: updatedBalanceQty,
            balance_total_cost: updatedBalanceTotalCost,
            status: updatedStatus,
        };

        setInventoryData(updatedInventory);

        fetch(`${BASE_URL}/inventoryofficesupply/inventory/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedInventory)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update inventory data');
            }

            fetch(`${BASE_URL}/distribute/distributions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    returnId: inventory._id,
                    classification: inventory.classification,
                    itemName: inventory.itemName,
                    unitofmeasure: inventory.unitofmeasure,
                    quantity: inputQuantity,
                    cost: inventory.stock_unit_cost * inputQuantity,
                    office: designation,
                    distributedto: distributedTo ? distributedTo.value : '',
                    status: 'Pending',
                    requeststatus: action === 'distribute' ? 'For Approval' : 'For checking',
                    date_requested: currentDate
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to post distribution data');
                }
                setShowSuccessPopup(true);
            })
            .catch(error => {
                console.error('Error posting distribution data:', error);
                setShowErrorPopup(true);
            });
        })
        .catch(error => {
            console.error('Error updating inventory data:', error);
            setShowErrorPopup(true);
        });

        setShowPopup(false);
    }

    const userOptions = users.map(user => ({ value: user.username, label: user.username }));

    return (
        <div className="2xl:container 2xl:mx-auto lg:py-16 lg:px-20 md:py-12 md:px-6 py-9 px-4">
            <div className="flex justify-between items-center">
                <button 
                    onClick={() => navigate('/stocktableofficesupply')} 
                    className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Back
                </button>
            </div>
            <div className="flex justify-center items-center lg:flex-row flex-col gap-8 mt-6">
                <div className="w-full sm:w-96 md:w-8/12 lg:w-6/12">
                    <p className="font-normal text-base leading-4 text-gray-600">PROPERTY OF DICT REGION 2</p>
                    <h2 className="font-semibold lg:text-4xl text-3xl lg:leading-9 leading-7 text-gray-800 mt-4 flex justify-between items-center">
                        <span>{inventory.classification}</span>
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="text-blue-500 text-sm font-medium ml-auto"
                        >
                            View Disposal History
                        </button>
                    </h2>
                    <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Stock No.</p>
                                <p className="font-medium text-base leading-4">{inventory.stock_no}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Stock Quantity</p>
                                <p className="font-medium text-base leading-4">{inventory.balance_qty}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Total Distributed</p>
                                <p className="font-medium text-base leading-4">{inventory.distribution_qty}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Date Acquired</p>
                                <p className="font-medium text-base leading-4">{inventory.date ? formatDate(inventory.date) : ''}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Unit Cost</p>
                                <p className="font-medium text-base leading-4">{inventory.purchase_unit_cost ? inventory.purchase_unit_cost.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : ''}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">{inventory.remarks}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Status</p>
                                <p className="font-medium text-base leading-4">{inventory.status}</p>
                            </div>
                        </div>
                    </div>
                    {inventory.status !== "Out of stock" && (
                        <div className="flex flex-col mt-6">
                            <button onClick={() => togglePopup('distribute')} className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-gray-800 w-full py-5 mb-2">
                                Distribute
                            </button>
                            <button onClick={() => togglePopup('dispose')} className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-gray-800 w-full py-5 mb-2">
                                Dispose
                            </button>
                            <button onClick={() => togglePopup('request')} className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-gray-800 w-full py-5">
                                Request
                            </button>
                        </div>
                    )}
                </div>
                <div className="w-full lg:w-6/12 flex justify-center items-center">
                    <img src={DICT} className="w-1/2 h-auto object-contain p-4" alt="DICT Logo"/>
                </div>
            </div>
            {showPopup && (
                <Modal 
                    onConfirm={handleConfirmDistribution}
                    onCancel={() => setShowPopup(false)}
                    designation={designation}
                    handleDesignationChange={handleDesignationChange}
                    quantity={quantity}
                    handleQuantityChange={handleQuantityChange}
                    userOptions={userOptions}
                    setDistributedTo={setDistributedTo}
                    distributedTo={distributedTo}
                    action={action}
                    remarks={remarks}
                    handleRemarksChange={handleRemarksChange}
                />
            )}
            {showHistoryModal && (
                <ViewHistoryModal 
                    history={inventory.history} 
                    onClose={() => setShowHistoryModal(false)} 
                />
            )}
            {showSuccessPopup && (
                <SuccessModal 
                    onClose={() => setShowSuccessPopup(false)}
                />
            )}
            {showErrorPopup && (
                <ErrorModal 
                    onClose={() => setShowErrorPopup(false)}
                />
            )}
        </div>
    );
}
