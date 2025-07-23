import React, { useState, useEffect } from "react";
import DICT from '../assets/DICT.png'
import { useParams } from 'react-router-dom'
import { BASE_URL } from "../utils/config";

export default function Checkitemgovnetsupply() {

    const [inventory, setInventoryData] = useState([]);
    const { id } = useParams()
    const [error, setError] = useState(null);
    const [showPopup, setShowPopup] = useState(false); // State variable for controlling the popup form

    useEffect(() => {
        fetch(`${BASE_URL}/inventorygovnetsupply/inventory/${id}`)
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

    function formatDate(dateString) {
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
        return `${monthNames[monthIndex]} ${day} - ${year}`;
    }

    const togglePopup = () => {
        setShowPopup(!showPopup);
    }
    return (
        <div className="2xl:container 2xl:mx-auto lg:py-16 lg:px-20 md:py-12 md:px-6 py-9 px-4 ">
            <div className="flex justify-center items-center lg:flex-row flex-col gap-8">
                {/* <!-- Description Div --> */}

                <div className="  w-full sm:w-96 md:w-8/12 lg:w-6/12 items-center">
                    <p className=" focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 font-normal text-base leading-4 text-gray-600">PROPERTY OF DICT REGION 2</p>
                    <h2 className="font-semibold lg:text-4xl text-3xl lg:leading-9 leading-7 text-gray-800 mt-4">{inventory.classification}</h2>

                    

                    <p className=" font-semibold lg:text-2xl text-xl lg:leading-6 leading-5 mt-6 ">{inventory.itemName}</p>

                    <div className="lg:mt-11 mt-10">
                        
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Stock No.</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.stock_no}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Stock Quantity</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.balance_qty}</p>
                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Total Distributed</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.distribution_qty}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Date acquired</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.date ? formatDate(inventory.date) : ''}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Unit Cost</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4"> {inventory.purchase_unit_cost ? inventory.purchase_unit_cost.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : ''}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />

                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <div className="flex">
                            <p className=" font-medium text-base leading-4 text-gray-600">{inventory.remarks}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Status</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.status}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                       

                    </div>

                    <button onClick={togglePopup} className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-gray-800 w-full py-5 lg:mt-12 mt-6">Distribute</button>
                    {/* <button className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-green-800 w-full py-5 lg:mt-3 mt-6">Dispose</button> */}

                </div>

                {/* <!-- Preview Images Div For larger Screen--> */}

                    <div className="w-full lg:w-8/12 bg-gray-100 flex justify-center items-center">
                        <div className="w-full h-full">
                            <img src={DICT} className="w-full h-full object-cover" />
                        </div>
                    </div>

            </div>
            {showPopup && (
    <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-500 bg-opacity-75">
        <div className="bg-white p-8 rounded-lg">
            <img src={DICT} alt="DICT" className="w-40 h-24 mx-auto" />
            <p className="text-center mt-4">Quantity to distribute:</p>
            <div className="mt-4">
                <input type="number" className="border border-gray-300 rounded-md w-full py-2 px-3" placeholder="Enter quantity" />
            </div>
            <div className="flex justify-center mt-4">
                <button className="bg-green-800 text-white px-4 py-2 rounded-l-md mr-2">Confirm</button>
                <button className="bg-red-800 text-white px-4 py-2 rounded-r-md" onClick={() => setShowPopup(false)}>Cancel</button>
            </div>
        </div>
    </div>
)}
        </div>
    );
};

