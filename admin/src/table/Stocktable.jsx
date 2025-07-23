import React,{useState} from "react";

function Stocktable() {
    const [show, setShow] = useState(null)
    return (
        <>
            <div className="w-full sm:px-6">
                <div className="px-4 md:px-10 py-4 md:py-7 bg-gray-100 rounded-tl-lg rounded-tr-lg">
                    <div className="sm:flex items-center justify-between">
                        <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold leading-normal text-gray-800">Stock Table</p>
                       
                    </div>
                </div>
                <div className="bg-white shadow px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-y-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead>
                            <tr className="h-16 w-full text-sm leading-none text-gray-800">
                                <th className="font-normal text-left pl-4">Stock ID</th>
                                <th className="font-normal text-left pl-12">Item Description</th>
                                <th className="font-normal text-left pl-12">Classification</th>
                                <th className="font-normal text-left pl-20">Quantity</th>
                                <th className="font-normal text-left pl-20">Unit of measure</th>
                                <th className="font-normal text-left pl-16">Unit cost</th>
                                <th className="font-normal text-left pl-16">Total cost</th>
                                <th className="font-normal text-left pl-16">Status</th>
                                <th className="font-normal text-left pl-16">Action</th>

                            </tr>
                        </thead>
                        <tbody className="w-full">
                            <tr className="h-20 text-sm leading-none text-gray-800 bg-white hover:bg-gray-100 border-b border-t border-gray-100">
                                <td className="pl-4 cursor-pointer">
                                    <div className="flex items-center">
                                        <div className="pl-4">
                                            <p className="font-medium">12323453</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="pl-12">
                                    <p className="text-sm font-medium leading-none text-gray-800">Laptop-Acer1234</p>
                                    <p className="text-xs leading-3 text-gray-600 pt-2">Laptop</p>
                                </td>
                                <td className="pl-12">
                                    <p className="font-medium">Laptop</p>
                                </td>
                                <td className="pl-20">
                                    <p className="font-medium">3</p>
                                </td>
                                <td className="pl-20">
                                    <p className="font-medium">pcs</p>
                                </td>
                                <td className="pl-16">
                                <p className="font-medium">P 50,000.00</p>
                                </td>
                                <td className="pl-16">
                                <p className="font-medium">P 150,000.00</p>
                                </td>
                                <td className="pl-16">
                                <p className="font-medium">In store</p>
                                </td>
                                <td className="pl-16">
                                <button className="inline-flex sm:ml-3 mt-4 sm:mt-0 items-start justify-start px-6 py-3 bg-indigo-700 hover:bg-indigo-600 focus:outline-none rounded">
                                <p className="text-sm font-medium leading-none text-white">Edit</p>
                            </button>
                                </td>
                            </tr>
                            <tr className="h-20 text-sm leading-none text-gray-800 bg-white hover:bg-gray-100 border-b border-t border-gray-100">
                                <td className="pl-4 cursor-pointer">
                                    <div className="flex items-center">
                                        <div className="pl-4">
                                            <p className="font-medium">12323454</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="pl-12">
                                    <p className="text-sm font-medium leading-none text-gray-800">Laptop-Acer1234</p>
                                    <p className="text-xs leading-3 text-gray-600 pt-2">Laptop</p>
                                </td>
                                <td className="pl-12">
                                    <p className="font-medium">Laptop</p>
                                </td>
                                <td className="pl-20">
                                    <p className="font-medium">2</p>
                                </td>
                                <td className="pl-20">
                                    <p className="font-medium">pcs</p>
                                </td>
                                <td className="pl-16">
                                <p className="font-medium">P 50,000.00</p>
                                </td>
                                <td className="pl-16">
                                <p className="font-medium">P 100,000.00</p>
                                </td>
                                <td className="pl-16">
                                <p className="font-medium">In store</p>
                                </td>
                                <td className="pl-16">
                                <button className="inline-flex sm:ml-3 mt-4 sm:mt-0 items-start justify-start px-6 py-3 bg-indigo-700 hover:bg-indigo-600 focus:outline-none rounded">
                                <p className="text-sm font-medium leading-none text-white">Edit</p>
                            </button>
                                </td>
                            </tr>
                            
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

export default Stocktable;
