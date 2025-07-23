import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { BASE_URL } from "../utils/config";
import usericon from "../assets/profile-icon.png"; // Import the user icon

export default function Checkuser() {
  const { user } = useContext(AuthContext);
  const [updatedData, setUpdatedData] = useState({
    username: user.data.username,
    email: user.data.email,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [error, setError] = useState(null);
  const { dispatch } = useContext(AuthContext);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUpdatedData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSave = () => {
    const userId = user.data._id; // Ensure you pass the correct user ID
    const updates = {
      username: updatedData.username,
      email: updatedData.email,
    };
  
    fetch(`${BASE_URL}/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`, // Optional if using authentication
      },
      body: JSON.stringify(updates), // Send only the fields you want to update
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
        setShowSuccessPopup(true);
      })
      .catch((error) => {
        console.error("Error updating user:", error);
        setError("Failed to update user. Please try again.");
      });
  };
  

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
          <h1 className="text-4xl font-bold text-gray-800">Diether Abad</h1>
          <p className="text-lg text-gray-600">Super Admin</p>
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Username */}
          <div>
            <label className="block text-lg font-semibold text-gray-700">Name</label>
            {isEditing ? (
              <input
                type="text"
                name="username"
                value={updatedData.username}
                onChange={handleInputChange}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            ) : (
              <p className="text-lg">{user.data.username}</p>
            )}
          </div>
          {/* Position */}
          <div>
            <label className="block text-lg font-semibold text-gray-700">Position</label>
            <p className="text-lg">{user.data.position}</p>
          </div>
          {/* Email */}
          <div>
            <label className="block text-lg font-semibold text-gray-700">Email</label>
            {isEditing ? (
              <input
                type="email"
                name="email"
                value={updatedData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            ) : (
              <p className="text-lg">{user.data.email}</p>
            )}
          </div>
          {/* Designation */}
          <div>
            <label className="block text-lg font-semibold text-gray-700">Designation</label>
            <p className="text-lg">{user.data.designation}</p>
          </div>
          {/* Project */}
          <div>
            <label className="block text-lg font-semibold text-gray-700">Project</label>
            <p className="text-lg">{user.data.project}</p>
          </div>
          {/* Role */}
          <div>
            <label className="block text-lg font-semibold text-gray-700">Role</label>
            <p className="text-lg">{user.data.role}</p>
          </div>
        </div>

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
                onClick={() => setIsEditing(false)}
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
