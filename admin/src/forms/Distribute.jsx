import { useEffect, useState } from "react";

export function Distribute() {
  useEffect(() => {});

  function showDropDownMenu_form_layout_wizard3(el) {
    el.target.parentElement.children[1].classList.toggle("hidden");
  }

  function showDropDownMenuOne_form_layout_wizard3(el) {
    el.target.parentElement.children[1].classList.toggle("hidden");
  }

  const [stock, setstock] = useState({
    itemname: '',
    distributeto: '',
    quantity: '',
    purpose: '',
 })

 const handleInputChange = (field, value) => {
  setstock((prevstock) => ({
    ...prevstock,
    [field]: value,
  }));
};

// Array of options for the dropdowns
const classificationOptions = ['Laptop', 'Table', 'Chair'];
const unitMeasureOptions = ['pcs', 'gallon', 'rms', 'box'];


  return (
    <>
      <div className="px-2 py-12 ">
        <div className="flex flex-no-wrap items-start">
          <div className="w-full ">
            <div className="py-4 px-2">
              <div className="bg-white rounded shadow mt-7 py-7">
                <div className="hidden lg:block md:hidden">
                <div className="px-7 header flex bg-white justify-start py-[30px] border-b-[2px] border-slate-100 flex-wrap gap-x-4">
                    
                    <a className="cursor-pointer">
                      <div className="flex items-center instance group">
                        <div className="svg-container">
                          <svg
                            className="text-[#1E293B] group-hover:text-indigo-700"
                            width={20}
                            height={20}
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M17.5 17.5V9.375"
                              stroke="Currentcolor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M2.5 9.375V17.5"
                              stroke="Currentcolor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M14.9401 1.875H5.05964C4.20847 1.875 3.43972 2.34375 3.10925 3.06484L1.41785 6.75781C0.848315 8.00039 1.79402 9.4082 3.26121 9.45312C3.28725 9.45312 3.31329 9.45312 3.33933 9.45312C4.56589 9.45312 5.56003 8.46953 5.56003 7.41289C5.56003 8.46758 6.55456 9.45312 7.78113 9.45312C9.00769 9.45312 9.99988 8.53984 9.99988 7.41289C9.99988 8.46758 10.994 9.45312 12.2206 9.45312C13.4471 9.45312 14.4417 8.53984 14.4417 7.41289C14.4417 8.53984 15.4358 9.45312 16.6624 9.45312C16.6884 9.45312 16.7138 9.45312 16.7385 9.45312C18.2057 9.40742 19.1514 7.99961 18.5819 6.75781L16.8905 3.06484C16.56 2.34375 15.7913 1.875 14.9401 1.875Z"
                              stroke="Currentcolor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M1.25 18.125H18.75"
                              stroke="Currentcolor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M5.3125 11.25H8.4375C8.68614 11.25 8.9246 11.3488 9.10041 11.5246C9.27623 11.7004 9.375 11.9389 9.375 12.1875V15.625H4.375V12.1875C4.375 11.9389 4.47377 11.7004 4.64959 11.5246C4.8254 11.3488 5.06386 11.25 5.3125 11.25Z"
                              stroke="Currentcolor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M11.25 18.125V12.1875C11.25 11.9389 11.3488 11.7004 11.5246 11.5246C11.7004 11.3488 11.9389 11.25 12.1875 11.25H14.6875C14.9361 11.25 15.1746 11.3488 15.3504 11.5246C15.5262 11.7004 15.625 11.9389 15.625 12.1875V18.125"
                              stroke="Currentcolor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div className="pl-3 heading-container">
                          <p className="text-base font-medium leading-none text-slate-800 group-hover:text-indigo-700">
                            Distribute
                          </p>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
               
                {/* end */}
                <div className="mt-10 px-7">
                  <p className="text-xl font-semibold leading-tight text-gray-800">
                    Distribute Details
                  </p>
                  <div className="grid w-full grid-cols-1 lg:grid-cols-2 md:grid-cols-1 gap-7 mt-7 ">
        <div>
          <p className="text-base font-medium leading-none text-gray-800">
            Item name
          </p>
          {/* Dropdown */}
          <div className="relative top-1">
            <div className="relative w-full mt-2 border border-gray-300 rounded outline-none">
              <button
                onClick={showDropDownMenu_form_layout_wizard3}
                className="relative flex items-center justify-between w-full px-5 py-4 "
              >
                <span
                  className="pr-4 text-sm font-medium text-gray-600"
                  id="drop-down-content-setter_form_layout_wizard3"
                >
                  {stock.classification || 'Select'}
                </span>
                <svg
                  id="rotate"
                  className="absolute z-10 cursor-pointer right-5"
                  width={10}
                  height={6}
                  viewBox="0 0 10 6"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0.5 0.75L5 5.25L9.5 0.75"
                    stroke="#4B5563"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div
                className="absolute z-20 right-0 hidden w-full px-1 py-2 bg-white border-t border-gray-200 rounded shadow top-12"
                id="drop-down-div_form_layout_wizard3"
              >
                {classificationOptions.map((option, index) => (
                  <a key={index} href="javascript:void(0)" className="hover">
                    <p
                      className="p-3 text-sm leading-none text-gray-600 cursor-pointer hover:bg-indigo-100 hover:font-medium hover:text-indigo-700 hover:rounded"
                      onClick={() => {
                        handleInputChange('itemname', option);
                        showDropDownMenu_form_layout_wizard3(); // Close dropdown after selection
                      }}
                    >
                      {option}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </div>
          {/* end */}
          <p className="mt-3 text-xs leading-[15px] text-gray-600">
            If not found, create a classification.
          </p>
        </div>
       
                    <div>
                      <p className="text-base font-medium leading-none text-gray-800">
Quantity                      </p>
<input
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.quantity}
            onChange={(e) => handleInputChange('quantity', e.target.value)}
          />                      <p className="mt-3 text-xs leading-3 text-gray-600">
                      </p>
                    </div>
                    <div>
                      <p className="text-base font-medium leading-none text-gray-800">
Distribute to                     </p>
<input
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.unitcost}
            onChange={(e) => handleInputChange('distributeto', e.target.value)}
          />                      <p className="mt-3 text-xs leading-[15px] text-gray-600">
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-gray-300 mt-2 px-7">
                  <p className="text-base font-semibold leading-4 text-gray-800">
                    Purpose
                  </p>
                  <div className="mt-10 border border-gray-300 rounded">
                    
                  <textarea
          className="resize-none w-full h-[170px] px-4 py-4 text-base outline-none text-slate-600"
          placeholder="Start typing here ..."
          value={stock.itemdescription}
          onChange={(e) => handleInputChange('purpose', e.target.value)}
        />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-[15px] text-gray-600 px-7">
                  Enter purpose of distribution.
                </p>
                <hr className="h-[1px] bg-gray-100 my-14" />
                <div className="flex flex-col flex-wrap items-center justify-center w-full px-7 lg:flex-row lg:justify-end md:justify-end gap-x-4 gap-y-4">
                  <button className="bg-white border-indigo-700 rounded hover:bg-gray-50 transform duration-300 ease-in-out text-sm font-medium px-6 py-4 text-indigo-700 border lg:max-w-[95px]  w-full ">
                    Cancel
                  </button>
                  <button className="bg-indigo-700 rounded hover:bg-indigo-600 transform duration-300 ease-in-out text-sm font-medium px-6 py-4 text-white lg:max-w-[144px] w-full ">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
