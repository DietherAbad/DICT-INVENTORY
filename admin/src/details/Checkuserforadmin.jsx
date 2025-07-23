import React, { useState, useEffect, useContext } from "react";
import { Link, useParams } from "react-router-dom";
import { BASE_URL } from "../utils/config";
import usericon from "../assets/profile-icon.png"; // Import the user icon

export default function Checkuserforadmin() {
  const { id } = useParams(); // Extract `id` from URL parameters
  const [userData, setUserData] = useState(null); // Store user data fetched from API
  const [updatedData, setUpdatedData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [error, setError] = useState(null);

  // Fetch user data by ID on component mount
  useEffect(() => {
    fetch(`${BASE_URL}/users/${id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }
        return response.json();
      })
      .then((data) => {
        setUserData(data);
        setUpdatedData({
          username: data.username,
          email: data.email,
          position: data.position || "",
          designation: data.designation || "",
          project: data.project || "",
          role: data.role || "",
        });
      })
      .catch((error) => {
        console.error("Error fetching user data:", error);
        setError("Failed to fetch user data. Please try again.");
      });
  }, [id]);

  // Handle input changes for editing fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUpdatedData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle save for updated data
  const handleSave = () => {
    const updates = { ...updatedData };

    if (resetPassword) {
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      updates.password = newPassword;
    }

    fetch(`${BASE_URL}/users/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update user");
        }
        return response.json();
      })
      .then((data) => {
        console.log("Update successful:", data);
        setIsEditing(false);
        setResetPassword(false);
        setShowSuccessPopup(true);
      })
      .catch((error) => {
        console.error("Error updating user:", error);
        setError("Failed to update user. Please try again.");
      });
  };

  if (!userData) {
    return <div className="text-center mt-10">Loading user data...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center">
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-lg p-10">
        <Link to="/" className="text-blue-600 hover:underline mb-6 inline-block">
          &larr; Back
        </Link>
        <div className="text-center mb-8">
          <img
            src={usericon}
            alt="User Icon"
            className="h-32 w-32 rounded-full mx-auto border-4 border-gray-300 mb-4"
          />
          <h1 className="text-4xl font-bold text-gray-800">{userData.username}</h1>
          <p className="text-lg text-gray-600">{userData.role}</p>
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Editable Fields */}
          {Object.keys(updatedData).map((field) => (
            <div key={field}>
              <label className="block text-lg font-semibold text-gray-700 capitalize">
                {field}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name={field}
                  value={updatedData[field]}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <p className="text-lg">{userData[field]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Reset Password */}
        <div className="mt-8">
          {!resetPassword ? (
            <button
              onClick={() => setResetPassword(true)}
              className="bg-yellow-500 text-white px-6 py-3 text-lg font-semibold rounded-lg hover:bg-yellow-600 transition duration-200"
            >
              Reset Password
            </button>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-700">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="mt-8 flex justify-end gap-4">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-6 py-3 text-lg font-semibold rounded-lg hover:bg-blue-700 transition duration-200"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setResetPassword(false);
                  setError(null);
                }}
                className="bg-gray-400 text-white px-6 py-3 text-lg font-semibold rounded-lg hover:bg-gray-500 transition duration-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-6 py-3 text-lg font-semibold rounded-lg hover:bg-blue-700 transition duration-200"
            >
              Edit
            </button>
          )}
        </div>

        {showSuccessPopup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Success!</h2>
              <p className="text-gray-600">User data updated successfully!</p>
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
