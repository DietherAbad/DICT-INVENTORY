import React, { useState, useEffect } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { BASE_URL } from "../utils/config";
import arrowIcon from "../assets/arrow.png";

function TableHeader({ title }) {
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 bg-gray-50 text-center"
    >
      {title}
    </th>
  );
}

function TableRow({ data, handleDeleteClick }) {
  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center">{data.description}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.designation}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data.active.toString()}</td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <button onClick={() => handleDeleteClick(data)} className="bg-red-500 px-3 py-2 rounded text-white hover:bg-red-700 transition duration-150 ease-in-out">
          Delete
        </button>
      </td>
    </tr>
  );
}

function MeasureTable() {
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesignation, setSelectedDesignation] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/measure`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        return response.json();
      })
      .then(data => {
        setUsers(data);
      })
      .catch(error => {
        setError(error);
      });
  }, []);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const filteredUsers = Array.isArray(users) ? users.filter(user =>
    user.description &&
    user.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedDesignation === '' || user.designation === selectedDesignation)
  ) : [];

  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = pageNumber => setCurrentPage(pageNumber);

  const handleBack = () => {
    navigate('/');
  }

  const handleSearch = event => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  }

  const handleDesignationChange = event => {
    setSelectedDesignation(event.target.value);
    setCurrentPage(1);
  }

  const handleAddClick = () => {
    setShowAddForm(true);
  }

  const handleCancel = () => {
    setShowAddForm(false);
    setNewDescription('');
    setNewDesignation('');
  }

  const handleSubmit = () => {
    const newUser = {
      description: newDescription,
      designation: newDesignation,
      active: true
    };

    fetch(`${BASE_URL}/measure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newUser),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to add user');
      }
      return response.json();
    })
    .then(data => {
      setNewDescription('');
      setNewDesignation('');
      setShowAddForm(false);
      setShowSuccessPopup(true);
      setUsers([...users, data]);
    })
    .catch(error => {
      console.error('Error adding user:', error);
    });
  }

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeletePopup(true);
  }

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      fetch(`${BASE_URL}/measure/${userToDelete._id}`, {
        method: 'DELETE',
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to delete data');
        }
        setUsers(users.filter(user => user._id !== userToDelete._id));
        setShowDeletePopup(false);
        setUserToDelete(null);
      })
      .catch(error => {
        console.error('Error deleting data:', error);
      });
    }
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="w-full sm:px-6 pt-10">
      <div className="flex items-center mb-4">
        <button onClick={handleBack} className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg transition-transform transform hover:scale-105 mr-2">
          <img src={arrowIcon} alt="Back" className="w-5 h-5 inline-block mr-2" />
          Back
        </button>
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 leading-tight shadow-sm">
          Units & Measure Management
        </p>
        <button onClick={handleAddClick} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-auto mr-2">
          Add
        </button>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearch}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
        />
        <select
          value={selectedDesignation}
          onChange={handleDesignationChange}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200 ml-2"
        >
          <option value="">All Designations</option>
          <option value="Office Equipments">Office Equipments</option>
          <option value="Office Supplies">Office Supplies</option>
          <option value="Furniture & Fixture">Furniture & Fixture</option>
          <option value="ICT Equipments">ICT Equipments</option>
          <option value="Land & Building">Land & Building</option>
          <option value="Motor & Vehicles">Motor & Vehicles</option>
        </select>
      </div>
      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg px-4 py-4 md:px-10 mb-4">
          <h2 className="text-lg font-semibold mb-4">Add New Units & Measure</h2>
          <div className="flex flex-col space-y-4">
            <input
              type="text"
              placeholder="Description"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
            />
            <select
              value={newDesignation}
              onChange={e => setNewDesignation(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
            >
              <option value="">Select Designation</option>
              <option value="Office Equipments">Office Equipments</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Furniture & Fixture">Furniture & Fixture</option>
              <option value="ICT Equipments">ICT Equipments</option>
            </select>
            <div className="flex justify-end">
              <button onClick={handleCancel} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mr-2">
                Cancel
              </button>
              <button onClick={handleSubmit} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Success</h2>
            <p className="mb-4">New unit and measure added successfully.</p>
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="bg-green-500 px-4 py-2 rounded-md text-white hover:bg-green-600 focus:outline-none focus:ring focus:ring-green-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {showDeletePopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Confirm Deletion</h2>
            <p className="mb-4">Are you sure you want to delete this item?</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowDeletePopup(false)}
                className="bg-gray-500 px-4 py-2 rounded-md text-white hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-200 mr-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="bg-red-500 px-4 py-2 rounded-md text-white hover:bg-red-600 focus:outline-none focus:ring focus:ring-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800">
              <TableHeader title="Description" />
              <TableHeader title="Designation" />
              <TableHeader title="Is Active" />
              <TableHeader title="Manage" />
            </tr>
          </thead>
          <tbody>
            {currentUsers.map((data, index) => (
              <TableRow key={index} data={data} handleDeleteClick={handleDeleteClick} />
            ))}
          </tbody>
        </table>
        {filteredUsers.length > itemsPerPage && (
          <div className="flex justify-between mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MeasureTable;
