import React, { useState, useEffect } from "react";
import DICT from '../assets/DICT.png'
import { useParams } from 'react-router-dom'
import { BASE_URL } from "../utils/config";
import QRCode from "qrcode.react";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalShell from "../components/ModalShell";

export default function Checkitemgovnetequip() {
    const [inventory, setInventoryData] = useState([]);
    const { id } = useParams()
    const [error, setError] = useState(null);
    const [showPopup, setShowPopup] = useState(false); // State variable for controlling the popup form

    useEffect(() => {
        fetch(`${BASE_URL}/inventorygovnetequipment/inventory/${id}`)
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

    const currentLink = window.location.href;


    const handleQRDownload = () => {
        const canvas = document.getElementById('qr-code');
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'qr-code.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    const togglePopup = () => {
        setShowPopup(!showPopup);
    }

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

    return (
        <div className="2xl:container 2xl:mx-auto lg:py-5 lg:px-20 md:py-12 md:px-6 py-9 px-4 ">
            <Breadcrumbs
                className="mb-4"
                items={[
                    { label: "GovNet", to: "/govnetdashboard" },
                    { label: "GovNet Equipment", to: "/stocktablegovnetequipments" },
                    { label: "Item Details" },
                ]}
            />
            <div className="flex justify-center items-center lg:flex-row flex-col gap-8">
                {/* <!-- Description Div --> */}

                <div className="  w-full sm:w-96 md:w-8/12 lg:w-6/12 items-center">
                    <p className=" focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 font-normal text-base leading-4 text-gray-600">PROPERTY OF DICT REGION 2</p>
                    <h2 className="font-semibold lg:text-4xl text-3xl lg:leading-9 leading-7 text-gray-800 mt-4">{inventory.classification}</h2>

                    <p className="font-semibold lg:text-2xl text-xl lg:leading-6 leading-5 mt-6">
{inventory.itemName}
</p>


                    <div className="lg:mt-11 mt-10">
                    <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Property No.</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.property_no}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Unit cost</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4"> {inventory.unit_cost ? inventory.unit_cost.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }) : ''}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Quantity</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.qty} {inventory.unitofmeasure}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Classification</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.classification}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Date acquired</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.date_acquired ? formatDate(inventory.date_issued) : ''}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Serial No.</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.serial_no}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        {inventory.issued_to && inventory.date_issued && (
                        <>
                            <div className="flex flex-row justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Issued to</p>
                                <div className="flex">
                                    <p className="font-medium text-base leading-4">{inventory.issued_to}</p>
                                </div>
                            </div>
                            <hr className="bg-gray-200 w-full my-2" />
                            <div className="flex flex-row justify-between">
                                <p className="font-medium text-base leading-4 text-gray-600">Date issued</p>
                                <div className="flex">
                                <p className="font-medium text-base leading-4">
    {inventory.date_issued ? formatDate(inventory.date_issued) : ''}
</p>

                                </div>
                            </div>
                            <hr className="bg-gray-200 w-full my-2" />
                        </>
                    )}
                        <div className="flex flex-row justify-between">
                            <p className=" font-medium text-base leading-4 text-gray-600">Stored to</p>
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.stored_to}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
                            <div className="flex">
                            <p className=" font-medium text-base leading-4">{inventory.remarks}</p>

                            </div>
                        </div>
                        <hr className=" bg-gray-200 w-full my-2" />
                        <div className="flex flex-row justify-between">
    <p className="font-small italic text-sm leading-4 text-gray-500 mt-3">If lost please contact 092345345</p>
</div>

                    </div>

                    
                    {/* QR Code */}
                    <button onClick={handleQRDownload}className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-green-800 w-full py-5 lg:mt-3 mt-6">QR Code</button>
                    <button onClick={togglePopup} className="focus:outline-none focus:ring-2 hover:bg-black focus:ring-offset-2 focus:ring-gray-800 font-medium text-base leading-4 text-white bg-red-800 w-full py-5 lg:mt-3 mt-6">Issue</button>
                    </div>
                {/* <!-- Preview Images Div For larger Screen--> */}
                <div className="w-full lg:w-6/12 bg-gray-100 flex justify-center items-center">
                    <div className="w-3/4">
                        {/* Render the QR code instead of the image */}
                        <QRCode value={currentLink} size={512} />
                    </div>
                </div>
            </div>
            {showPopup && (
                <ModalShell
                    open
                    title="Issue Equipment"
                    subtitle="GovNet Equipment"
                    variant="warning"
                    onClose={() => setShowPopup(false)}
                    maxWidthClass="max-w-sm"
                >
                    <div className="space-y-4 text-center">
                        <img src={DICT} alt="DICT" className="w-32 h-20 mx-auto" />
                        <p className="text-sm text-gray-600">Issue to:</p>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                            placeholder="Enter name"
                        />
                        <textarea
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                            rows="4"
                            placeholder="Remarks"
                        />
                        <div className="flex gap-2">
                            <button className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                                Confirm
                            </button>
                            <button
                                className="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                                onClick={() => setShowPopup(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}


        </div>
    );
};

