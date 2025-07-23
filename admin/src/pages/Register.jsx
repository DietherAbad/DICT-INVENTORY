import React, { useState, useContext } from 'react';
import DICT_GIF from '../assets/DICTGIF.gif'; // Add the path to your GIF here
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../utils/config';
import { useNavigate } from 'react-router-dom';

function Register() {
    const [credentials, setCredentials] = useState({
        username: '',
        email: '',
        project: '',
        designation: '',
        password: '',
        position: ''
    });

    const { dispatch } = useContext(AuthContext);
    const navigate = useNavigate();
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // New state for password visibility

    const handleChange = e => {
        const { id, value, type, checked } = e.target;
        if (id === 'fullName') {
            setCredentials(prevState => ({
                ...prevState,
                username: value
            }));
        } else if (id === 'position') {
            setCredentials(prevState => ({
                ...prevState,
                position: value
            }));
        } else {
            setCredentials(prevState => ({
                ...prevState,
                [id]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const validatePassword = password => {
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasUpperCase = /[A-Z]/.test(password);

        if (!hasSpecialChar || !hasNumber || !hasUpperCase) {
            alert("Password must include a special character, a number, and an uppercase letter.");
            return false;
        }

        return true;
    };

    const handleClick = async e => {
        e.preventDefault();

        const { password } = credentials;

        if (!validatePassword(password)) {
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/auth/register`, {
                method: 'post',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const result = await res.json();

            if (!res.ok) alert(result.message);

            dispatch('REGISTER SUCCESSFUL');
            setShowSuccessPopup(true); // Show success popup
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen">
            <div className="w-full md:w-1/2 bg-white p-10">
                <div className="md:flex items-center border-b pb-6 border-gray-200">
                    <div className="flex items-center md:mt-0 mt-4">
                        <p className="text-base ml-3 font-medium leading-4 text-gray-800">Sign Up</p>
                    </div>
                </div>
                <h1 tabIndex={0} role="heading" aria-label="profile information" className="focus:outline-none text-3xl font-bold text-gray-800 mt-12">
                    Profile info
                </h1>
                <p role="contentinfo" className="focus:outline-none text-sm font-light leading-tight text-gray-600 mt-4">
                    Fill in the data for profile. It will take a couple of minutes. <br />
                </p>
                <h2 role="heading" aria-label="enter Personal data" className="text-xl font-semibold leading-7 text-gray-800 mt-10">
                    Personal data
                </h2>
                <p className="text-sm font-light leading-none text-gray-600 mt-0.5">Your details</p>
                <div className="mt-8 md:flex items-center">
                    <div className="flex flex-col">
                        <label className="mb-3 text-sm leading-none text-gray-800">Display name</label>
                        <input type="text" id="fullName" onChange={handleChange} className="w-64 bg-gray-100 text-sm font-medium leading-none text-gray-800 p-3 border rounded border-gray-200" placeholder="Full Name" />
                    </div>
                    <div className="flex flex-col md:ml-12 md:mt-0 mt-8">
                        <label className="mb-3 text-sm leading-none text-gray-800">Position</label>
                        <input type="text" id="position" onChange={handleChange} className="w-64 bg-gray-100 text-sm font-medium leading-none text-gray-800 p-3 border rounded border-gray-200" placeholder="Position" />
                    </div>
                </div>
                <div className="mt-12 md:flex items-center">
                    <div className="flex flex-col">
                        <label className="mb-3 text-sm leading-none text-gray-800">Email Address</label>
                        <input type="email" id="email" onChange={handleChange} className="w-64 bg-gray-100 text-sm font-medium leading-none text-gray-800 p-3 border rounded border-gray-200" placeholder="Email Address" />
                    </div>
                    <div className="flex flex-col md:ml-12 md:mt-0 mt-8">
                        <label className="mb-3 text-sm leading-none text-gray-800">Project</label>
                        <select id="project" onChange={handleChange} className="w-64 bg-gray-100 text-sm font-medium leading-none text-gray-800 p-3 border rounded border-gray-200">
                            <option value="">Select Project</option>
                            <option value="ELGU">ELGU</option>
                            <option value="ILCDB">ILCDB</option>
                            <option value="IIDB">IIDB</option>
                            <option value="FREEWIFI">FREEWIFI</option>
                            <option value="N/A">N/A</option>
                        </select>
                    </div>
                </div>
                <div className="mt-12 md:flex items-center">
                    <div className="flex flex-col">
                        <label className="mb-3 text-sm leading-none text-gray-800">Designation</label>
                        <select id="designation" onChange={handleChange} className="w-64 bg-gray-100 text-sm font-medium leading-none text-gray-800 p-3 border rounded border-gray-200">
                            <option value="">Select Designation</option>
                            <option value="Regional Office - Tuguegarao">Regional Office - Tuguegarao</option>
                            <option value="Isabela Office - Cauayan">Isabela Office - Cauayan</option>
                            <option value="Isabela Office - Santiago">Isabela Office - Santiago</option>
                            <option value="Nueva Vizcaya Office">Nueva Vizcaya Office</option>
                            <option value="Batanes Office">Batanes Office</option>
                        </select>
                    </div>
                    <div className="flex flex-col md:ml-12 md:mt-0 mt-8">
                        <label className="mb-3 text-sm leading-none text-gray-800">Password</label>
                        <div className="relative w-64">
                            <input type={showPassword ? "text" : "password"} id="password" onChange={handleChange} className="w-full bg-gray-100 text-sm font-medium leading-none text-gray-800 p-3 border rounded border-gray-200" placeholder="Password" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600">
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="mt-8 flex items-center">
                    <button onClick={handleClick} className="flex items-center justify-center py-4 px-7 focus:outline-none bg-white border rounded border-gray-400 hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-gray-700">
                        <span className="text-sm font-medium text-center text-gray-800 capitalize">Sign up</span>
                        <svg className="mt-1 ml-3" width={12} height={8} viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.01 3H0V5H8.01V8L12 4L8.01 0V3Z" fill="#242731" />
                        </svg>
                    </button>
                    <button onClick={() => navigate('/userdashboard')} className="flex items-center justify-center ml-4 py-4 px-7 focus:outline-none bg-white border rounded border-gray-400 hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-gray-700">
                        <span className="text-sm font-medium text-center text-gray-800 capitalize">Cancel</span>
                    </button>
                </div>
            </div>
            <div className="w-full md:w-1/2 flex items-center justify-center bg-white">
                <img src={DICT_GIF} alt="DICT gif" className="max-w-full h-auto" />
            </div>
            {showSuccessPopup && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold mb-4">Registration Successful</h2>
                        <p className="mb-4">You have successfully registered. Please proceed to login.</p>
                        <button
                            onClick={() => {
                                setShowSuccessPopup(false);
                                navigate('/login');
                            }}
                            className="bg-indigo-500 px-4 py-2 rounded-md text-white hover:bg-indigo-600 focus:outline-none focus:ring focus:ring-indigo-200"
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Register;
