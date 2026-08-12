import React, { useMemo, useState, useRef, useEffect } from 'react';
import { BASE_URL } from '../utils/config.js';
import { useNavigate } from "react-router-dom";
import { useFormDraft } from '../utils/draft';
import ThumbnailUploadField from '../components/ThumbnailUploadField';
import { useThumbnailUpload } from '../utils/useThumbnailUpload';

export function PurchaseformLandandBuilding() {
  const [activeStatus, setActiveStatus] = useState(5);
  const [searchText, setSearchText] = useState('');
  const [isClassificationDropdownOpen, setIsClassificationDropdownOpen] = useState(false);
  const [isUnitMeasureDropdownOpen, setIsUnitMeasureDropdownOpen] = useState(false);
  const [isButtonClicked, setIsButtonClicked] = useState(false);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  const {
    file: thumbnailFile,
    preview: thumbnailPreview,
    error: thumbnailError,
    setError: setThumbnailError,
    inputRef: thumbnailInputRef,
    handleChange: handleThumbnailChange,
    clear: clearThumbnail,
  } = useThumbnailUpload();

  const [unitMeasureOptions, setUnitMeasureOptions] = useState([]);
  const [classificationOptions, setClassificationOptions] = useState([]);

  useEffect(() => {
    const fetchClassificationOptions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/classification`);
        if (!res.ok) {
          throw new Error('Failed to fetch classification options');
        }
        const data = await res.json();
        // Extract classifications and set classificationOptions
        const classifications = data.map(item => item.classification === "Land & Building");
        setClassificationOptions(classifications);
      } catch (error) {
        console.error('Error fetching classification options:', error);
      }
    };
    fetchClassificationOptions();
  }, []);

  
  // Fetch unit measures data
  useEffect(() => {
    const fetchClassificationOptions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/classification`);
        if (!res.ok) {
          throw new Error('Failed to fetch classification options');
        }
        const data = await res.json();
        // Ensure we only keep items where the classification is "Land & Building" and map to classification names
        const classifications = data
          .filter(item => item.classification === "Land & Building")
          .map(item => item.classification); // Extracting classification as strings
        setClassificationOptions(classifications);
      } catch (error) {
        console.error('Error fetching classification options:', error);
      }
    };
    fetchClassificationOptions();
  }, []);
  
  // Filter options function with a check to ensure `option` is a string
  const filterOptions = () => {
    return classificationOptions.filter(option =>
      typeof option === 'string' && option.toLowerCase().includes(searchText.toLowerCase())
    );
  };
  
  

  const handleNavigation = (status) => {
    setActiveStatus(status);
    switch (status) {
      case 1:
        navigate('/purchaseform');
        break;
    case 2:
      navigate('/purchaseformEquip');
      break;
        case 3:
            navigate('/purchaseformFurniture');
            break;
        case 4:
            navigate('/purchaseformICT');
            break;
        case 5:
            navigate('/purchaseformLand');
            break;
        case 6:
            navigate('/purchaseformMotor');
            break;
        default:
            break;
    }
};
  useEffect(() => {
    if (isClassificationDropdownOpen) {
      searchInputRef.current.focus();
    }
  }, [isClassificationDropdownOpen]);
  
  function showDropDownMenu_form_layout_wizard3() {
    setIsClassificationDropdownOpen((prev) => !prev);
    setIsUnitMeasureDropdownOpen(false); // Close the other dropdown
  }

  function showDropDownMenuOne_form_layout_wizard3() {
    setIsUnitMeasureDropdownOpen((prev) => !prev);
    setIsClassificationDropdownOpen(false); // Close the other dropdown
  }
  
  // const filterOptions = () => {
  //   return classificationOptions.filter(option =>
  //     option.toLowerCase().includes(searchText.toLowerCase())
  //   );
  // };


  const [stock, setstock] = useState({
    classification: '',
    unitofmeasure: '',
    address: '',
    land_area:0,
    bldg_area:0,
    unit_value:0,
    proof_of_ownership:'',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
    remarks:'',
    archive: false,
 })

 const draftPayload = useMemo(() => ({ stock }), [stock]);
 const { clear: clearDraft } = useFormDraft(
  'draft:purchase:office-land-building',
  draftPayload,
  (draft) => {
    if (draft?.stock) {
      setstock((prev) => ({ ...prev, ...draft.stock }));
    }
  },
  { debounceMs: 800 }
 );


 const handleInputChange = (field, value) => {
  setstock((prevstock) => ({
    ...prevstock,
    [field]: value,
  }));
};

// Array of options for the dropdowns
// const classificationOptions = ['Land', 'Building', 'Land & Building'];
// const unitMeasureOptions = [  'Pcs',
// 'Tin',
//   'Gal',
//   'Btl',
//   'Pack',
//   'Box',
//   'Rms',
//   'Roll',
//   'Pad',
//   'Contnr'];
const handleCancel = () => {
  navigate('/officedashboard')
}

const uploadThumbnail = async (itemId, file) => {
  const formData = new FormData();
  formData.append('thumbnail', file);
  const res = await fetch(
    `${BASE_URL}/inventoryofficeLandandBuilding/inventory/${itemId}/thumbnail`,
    {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }
  );
  if (!res.ok) {
    throw new Error('Failed to upload thumbnail.');
  }
  return res.json();
};

const handleStockinAndSubmission = async (e) => {
  e.preventDefault();
  console.log(stock);
  if (isButtonClicked) return; // If the button is already clicked, do nothing

  try {
    setIsButtonClicked(true); // Set the state to prevent further clicks
    setThumbnailError('');

    const res = await fetch(`${BASE_URL}/inventoryofficeLandandBuilding/inventory`, {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(stock),
    });

    if (!res.ok) {
      const result = await res.json(); // Attempt to parse error message if available
      return alert(result.message || 'Failed to submit data.');
    }

    const result = await res.json();
    
    // Check if the result is a valid JSON
    if (result && typeof result === 'object') {
      let finalMessage = 'Successfully submitted.';
      if (thumbnailFile) {
        try {
          await uploadThumbnail(result._id, thumbnailFile);
        } catch (err) {
          finalMessage = 'Entry saved, but thumbnail upload failed.';
        }
      }
      clearDraft();
      clearThumbnail();
      alert(finalMessage);
      navigate('/officedashboard')
    } else {
      alert('Invalid response format from the server.');
    }

    // navigate('/thank-you');
  } catch (error) {
    console.error('Error processing request:', error);
    alert('An error occurred while processing your request. Please check the console for more details.');
  } finally {
    setIsButtonClicked(false); // Reset the button state in both success and failure cases
  }  
};


  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-slate-50 via-white to-slate-50 px-2 pb-10">
    <div>
            <div className="sm:hidden relative w-11/12 mx-auto bg-white rounded">
                <div className="absolute inset-0 m-auto mr-4 z-0 w-6 h-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-selector" width={24} height={24} viewBox="0 0 24 24" strokeWidth="1.5" stroke="#A0AEC0" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" />
                        <polyline points="8 9 12 5 16 9" />
                        <polyline points="16 15 12 19 8 15" />
                    </svg>
                </div>
                <select aria-label="Selected tab" className="form-select block w-full p-3 border border-gray-300 rounded text-gray-600 appearance-none bg-transparent relative z-10">
                <option className="text-sm text-gray-600">Office Supplies </option>
                <option className="text-sm text-gray-600">Office Equipments </option>
                    <option className="text-sm text-gray-600">Furniture & Fixtures </option>
                    <option className="text-sm text-gray-600">ICT Equipments </option>
                    <option className="text-sm text-gray-600">Land & Building </option>
                    <option className="text-sm text-gray-600">Motor & Vehicles </option>


                </select>
            </div>
            <div className="justify-between flex-wrap hidden sm:block bg-white shadow rounded">
                <div className="xl:w-full xl:mx-0 -b pl-5 pr-5 h-12">
                <ul className="flex items-center h-full">
                <li onClick={() => handleNavigation(1)} className={activeStatus === 1 ? "text-sm text-indigo-700 py-2 px-4 bg-gray-200 rounded mr-8 font-normal" : "text-sm text-gray-600 py-3 mr-10 font-normal hover:text-indigo-700 cursor-pointer"}>
                            {activeStatus == 1 ? "Office Supplies(Active)" : "Office Supplies"}
                        </li>
                        <li onClick={() => handleNavigation(2)} className={activeStatus === 2 ? "text-sm text-indigo-700 py-2 px-4 bg-gray-200 rounded mr-8 font-normal" : "text-sm text-gray-600 py-3 mr-10 font-normal hover:text-indigo-700 cursor-pointer"}>
                            {activeStatus == 2 ? "Office Equipments(Active)" : "Office Equipments"}
                        </li>
                        <li onClick={() => handleNavigation(3)} className={activeStatus === 3 ? "text-sm text-indigo-700 py-2 px-4 bg-gray-200 rounded mr-8 font-normal" : "text-sm text-gray-600 py-3 mr-10 font-normal hover:text-indigo-700 cursor-pointer"}>
                            {activeStatus == 3 ? "Furniture & Fixtures(Active)" : "Furniture & Fixtures"}
                        </li>
                        <li onClick={() => handleNavigation(4)} className={activeStatus === 4 ? "text-sm text-indigo-700 py-2 px-4 bg-gray-200 rounded mr-8 font-normal" : "text-sm text-gray-600 py-3 mr-10 font-normal hover:text-indigo-700 cursor-pointer"}>
                            {activeStatus == 4 ? "ICT Equipments(Active)" : "ICT Equipments"}
                        </li>
                        <li onClick={() => handleNavigation(5)} className={activeStatus === 5 ? "text-sm text-indigo-700 py-2 px-4 bg-gray-200 rounded mr-8 font-normal" : "text-sm text-gray-600 py-3 mr-10 font-normal hover:text-indigo-700 cursor-pointer"}>
                            {activeStatus == 5 ? "Land & Building(Active)" : "Land & Building"}
                        </li>
                        <li onClick={() => handleNavigation(6)} className={activeStatus === 6 ? "text-sm text-indigo-700 py-2 px-4 bg-gray-200 rounded mr-8 font-normal" : "text-sm text-gray-600 py-3 mr-10 font-normal hover:text-indigo-700 cursor-pointer"}>
                            {activeStatus == 6 ? "Motor & Vehicles(Active)" : "Motor & Vehicles"}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
      <div className="px-2 ">
        <div className="flex flex-no-wrap items-start">
          <div className="w-full ">
            <div className="px-2">
              <div className="bg-white/95 rounded-2xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-200/80 mt-6 py-7 backdrop-blur">
                <div className="hidden lg:block md:hidden">
                <div className="px-7 header flex bg-gradient-to-r from-white via-white to-slate-50 justify-start py-[26px] border-b border-slate-200/70 flex-wrap gap-x-4 rounded-t-2xl">
                    
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
                            ADD LAND AND BUILDINGS
                          </p>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
               
                {/* end */}
                <div className="mt-8 px-7">
                  <p className="text-base font-semibold leading-tight text-slate-900 uppercase tracking-[0.08em]">
                    Purchase Details
                  </p>
                  <div className="grid w-full grid-cols-1 lg:grid-cols-2 md:grid-cols-1 gap-7 mt-7 ">
        <div>
          <p className="text-base font-medium leading-none text-gray-800">
            Classification
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
            className={`absolute z-10 cursor-pointer right-5 ${
              !isClassificationDropdownOpen ? '' : 'rotate-180'
            }`}
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
          className={`absolute z-20 right-0 ${
            isClassificationDropdownOpen ? '' : 'hidden'
          } w-full px-1 py-2 bg-white border-t border-gray-200 rounded shadow top-12`}
          id="drop-down-div_form_layout_wizard3"
        >
          <input
            ref={searchInputRef}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded outline-none mb-2"
            placeholder="Search..."
            onChange={(e) => setSearchText(e.target.value)}
          />
          {filterOptions().map((option, index) => (
            <a key={index} href="javascript:void(0)" className="hover">
              <p
                className="p-3 text-sm leading-none text-gray-600 cursor-pointer hover:bg-indigo-100 hover:font-medium hover:text-indigo-700 hover:rounded"
                onClick={() => {
                  handleInputChange('classification', option);
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
            Land Area                     
             </p>
          <input
            type="number"
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.land_area}
            onChange={(e) => handleInputChange('land_area', e.target.value)}
          />       
          <p className="mt-3 text-xs leading-3 text-gray-600">
                      </p>
                    </div>
            <div>
          <p className="text-base font-medium leading-none text-gray-800">
            Building Area                     
             </p>
          <input
            type="number"
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.bldg_area}
            onChange={(e) => handleInputChange('bldg_area', e.target.value)}
          />       
          <p className="mt-3 text-xs leading-3 text-gray-600">
                      </p>
                    </div>
                    <div>
                      <p className="text-base font-medium leading-none text-gray-800">
                    Unit value                      
                    </p>
            <input
            type="number"
            placeholder="₱ ..."
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.unit_value}
            onChange={(e) => handleInputChange('unit_value', e.target.value)}
          />                      
          <p className="mt-3 text-xs leading-[15px] text-gray-600">
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-gray-300 mt-2 px-7">
                  <p className="text-base font-semibold leading-4 text-gray-800">
                    Address
                  </p>
                  <div className=" border-gray-300 rounded">
      
                    <input
            placeholder="Start typing here ..."
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
          /> 
                  </div>
                </div>
                <p className="mt-3 text-xs leading-[15px] text-gray-600 px-7">
                  Enter full address for better understanding
                </p>
                <ThumbnailUploadField
                  className="pt-6 border-gray-300 mt-2 px-7"
                  file={thumbnailFile}
                  preview={thumbnailPreview}
                  error={thumbnailError}
                  inputRef={thumbnailInputRef}
                  onChange={handleThumbnailChange}
                  onClear={() => {
                    clearThumbnail();
                    setThumbnailError('');
                  }}
                />
                <div className="pt-6 border-gray-300 mt-2 px-7">
                  <p className="text-base font-semibold leading-4 text-gray-800">
                    Proof of ownership
                  </p>
                  <div className=" border-gray-300 rounded">
      
                    <input
            placeholder="Start typing here ..."
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.proof_of_ownership}
            onChange={(e) => handleInputChange('proof_of_ownership', e.target.value)}
          /> 
                  </div>
                </div>
                <p className="mt-3 text-xs leading-[15px] text-gray-600 px-7">
                  Enter full google drive link
                </p>
                <div className="pt-6 border-gray-300 mt-2 px-7">
                  <p className="text-base font-semibold leading-4 text-gray-800">
                    Reference
                  </p>
                  <div className=" border-gray-300 rounded">
      
                    <input
            placeholder="Start typing here ..."
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.reference}
            onChange={(e) => handleInputChange('reference', e.target.value)}
          /> 
                  </div>
                </div>
                <div className="pt-6 border-gray-300 mt-2 px-7">
                  <p className="text-base font-semibold leading-4 text-gray-800">
                    Remarks
                  </p>
                  <div className=" border-gray-300 rounded">
      
                    <input
            placeholder="Start typing here ..."
            className="w-full p-3 mt-4 border border-gray-300 rounded outline-none focus:bg-gray-50"
            value={stock.remarks}
            onChange={(e) => handleInputChange('remarks', e.target.value)}
          /> 
                  </div>
                </div>
                <hr className="h-[1px] bg-gray-100 my-4" />
                <div className="flex flex-col flex-wrap items-center justify-center w-full px-7 lg:flex-row lg:justify-end md:justify-end gap-x-4 gap-y-4">
                <button className={`bg-indigo-700 rounded hover:bg-indigo-600 transform duration-300 ease-in-out text-sm font-medium px-6 py-4 text-white lg:max-w-[144px] w-full ${isButtonClicked ? ' disabled' : ''}`}
                  onClick={handleStockinAndSubmission}
                disabled={isButtonClicked}
        >
          {isButtonClicked ? 'Loading' : 'Submit'}
                  </button>
                  <button onClick={handleCancel}className="bg-white border-indigo-700 rounded hover:bg-gray-50 transform duration-300 ease-in-out text-sm font-medium px-6 py-4 text-indigo-700 border lg:max-w-[95px]  w-full ">
                    Cancel
                  </button>
  
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
