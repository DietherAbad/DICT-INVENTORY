import React, { useState, useContext } from 'react';
import DICT_GIF from '../assets/DICTGIF.gif';
import { AuthContext } from '../context/AuthContext';
import { BASE_URL } from '../utils/config';
import { SAMPLE_PASSWORD, SAMPLE_USERS } from '../utils/sampleCredentials';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [credentials, setCredentials] = useState({
        email: '',
        password: ''
    });

    const { dispatch } = useContext(AuthContext);
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showUnsuccessfulPopup, setShowUnsuccessfulPopup] = useState(false);
    const [showContactPopup, setShowContactPopup] = useState(false);
    const [showSamples, setShowSamples] = useState(false);

    const handleChange = e => {
        const { id, value } = e.target;
        setCredentials(prevState => ({
            ...prevState,
            [id]: value
        }));
    };

    const fillSample = (email) => {
        setCredentials({ email, password: SAMPLE_PASSWORD });
        setShowSamples(false);
    };

    const handleClick = async e => {
        e.preventDefault();

        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: 'post',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const result = await res.json();

            if (!res.ok) {
                setShowUnsuccessfulPopup(true);
            } else {
                dispatch({ type: 'LOGIN_SUCCESS', payload: result });
                setShowSuccessPopup(true);
                setTimeout(() => {
                    setShowSuccessPopup(false);
                    navigate('/');
                }, 2000);
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSignUpClick = () => {
        setShowContactPopup(true);
    };

    return (
        <div className="flex md:flex-row min-h-screen">
            <div className="relative w-full md:w-1/2 bg-white flex items-center justify-center p-10">
                <div className="w-full max-w-md">
                    <div className="md:flex items-center border-b pb-6 border-gray-200">
                        <div className="flex items-center md:mt-0 md:mt-4">
                            <p className="text-2xl ml-3 font-medium leading-6 text-gray-800">Log In</p>
                        </div>
                    </div>
                    <h1 tabIndex={0} role="heading" aria-label="login information" className="focus:outline-none text-4xl font-bold text-gray-800 mt-12">
                        Welcome Back
                    </h1>
                    <p role="contentinfo" className="focus:outline-none text-lg font-light leading-tight text-gray-600 mt-4">
                        Please enter your login credentials to proceed. <br />
                    </p>
                    <div className="mt-8 md:flex items-center">
                        <div className="flex flex-col w-full">
                            <label className="mb-3 text-lg leading-none text-gray-800">Email Address</label>
                            <input type="email" id="email" value={credentials.email} onChange={handleChange} className="w-full bg-gray-100 text-lg font-medium leading-none text-gray-800 p-4 border rounded border-gray-200" placeholder="Email Address" />
                        </div>
                    </div>
                    <div className="mt-8 md:flex items-center">
                        <div className="flex flex-col w-full">
                            <label className="mb-3 text-lg leading-none text-gray-800">Password</label>
                            <div className="relative w-full">
                                <input type={showPassword ? "text" : "password"} id="password" value={credentials.password} onChange={handleChange} className="w-full bg-gray-100 text-lg font-medium leading-none text-gray-800 p-4 border rounded border-gray-200" placeholder="Password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600">
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setShowSamples((v) => !v)}
                            className="text-sm text-indigo-600 hover:underline"
                        >
                            {showSamples ? "Hide" : "Show"} sample accounts (per role)
                        </button>
                        {showSamples && (
                            <div className="mt-3 max-h-56 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50 text-sm">
                                <p className="mb-2 text-gray-600">
                                    Password for all: <code className="font-semibold">{SAMPLE_PASSWORD}</code>
                                </p>
                                <ul className="space-y-1">
                                    {SAMPLE_USERS.map((u) => (
                                        <li key={u.email}>
                                            <button
                                                type="button"
                                                onClick={() => fillSample(u.email)}
                                                className="w-full text-left px-2 py-1 rounded hover:bg-indigo-50"
                                            >
                                                <span className="font-medium text-gray-800">{u.role}</span>
                                                <span className="block text-xs text-gray-500">{u.email}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-2 text-xs text-amber-700">
                                    Seed first if login fails: <code>npm run seed:sample-users</code> (API on :4000)
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="mt-8 flex items-center">
                        <button onClick={handleClick} className="flex items-center justify-center py-4 px-7 focus:outline-none bg-white border rounded border-gray-400 hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-gray-700">
                            <span className="text-lg font-medium text-center text-gray-800 capitalize">Log in</span>
                            <svg className="mt-1 ml-3" width={12} height={8} viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8.01 3H0V5H8.01V8L12 4L8.01 0V3Z" fill="#242731" />
                            </svg>
                        </button>
                        <button onClick={handleSignUpClick} className="flex items-center justify-center ml-4 py-4 px-7 focus:outline-none bg-white border rounded border-gray-400 hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-gray-700">
                            <span className="text-lg font-medium text-center text-gray-800 capitalize">Sign Up</span>
                        </button>
                    </div>
                </div>
            </div>
            <div className="hidden w-full md:flex items-center justify-center p-4 py-10 bg-white">
                <img src={DICT_GIF} alt="DICT gif" className="max-w-full h-auto object-contain mx-auto" />
            </div>
            {showSuccessPopup && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold mb-4">Login Successful</h2>
                        <p className="mb-4">You have successfully logged in. Redirecting to dashboard.</p>
                        <button
                            onClick={() => {
                                setShowSuccessPopup(false);
                                navigate('/');
                            }}
                            className="bg-indigo-500 px-4 py-2 rounded-md text-white hover:bg-indigo-600 focus:outline-none focus:ring focus:ring-indigo-200"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            )}
            {showUnsuccessfulPopup && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold mb-4">Login Unsuccessful</h2>
                        <p className="mb-4">User not found. Please try again.</p>
                        <button
                            onClick={() => setShowUnsuccessfulPopup(false)}
                            className="bg-red-500 px-4 py-2 rounded-md text-white hover:bg-red-600 focus:outline-none focus:ring focus:ring-red-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
            {showContactPopup && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold mb-4">Contact Your Administrator</h2>
                        <p className="mb-4">Please contact your administrator to sign up for an account.</p>
                        <button
                            onClick={() => setShowContactPopup(false)}
                            className="bg-indigo-500 px-4 py-2 rounded-md text-white hover:bg-indigo-600 focus:outline-none focus:ring focus:ring-indigo-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Login;
