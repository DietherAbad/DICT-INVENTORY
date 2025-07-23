import React, { useState, useEffect } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { BASE_URL } from "../utils/config";
import Select from 'react-select';
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

function TableRow({ data, role, onAddClick, onRemoveClick }) {
  return (
    <tr className="hover:bg-gray-100 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center">{role}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center">{data ? data.username : 'NA'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data ? data.email : 'NA'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{data ? data.position : 'NA'}</td>
      {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center">{data ? data.role : 'NA'}</td> */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {data ? (
          <button onClick={() => onRemoveClick(data)} className="bg-red-500 px-3 py-2 rounded text-white hover:bg-red-700 transition duration-150 ease-in-out">
            Remove
          </button>
        ) : (
          <button onClick={onAddClick} className="bg-green-500 px-3 py-2 rounded text-white hover:bg-green-700 transition duration-150 ease-in-out">
            Add
          </button>
        )}
      </td>
    </tr>
  );
}

function ManagementTable() {
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRemovePopup, setShowRemovePopup] = useState(false);
  const [userToRemove, setUserToRemove] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/users`)
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

  const paginate = pageNumber => setCurrentPage(pageNumber);

  const handleBack = () => {
    navigate('/userdashboard');
  }

  const handleAddClick = (role) => {
    setShowAddForm(true);
    setSelectedRole(role);
  }

  const handleCancel = () => {
    setShowAddForm(false);
  }

  const handleConfirm = () => {
    if (selectedUser && selectedRole) {
      const updatedUser = users.find(user => user.username === selectedUser.value);
      updatedUser.role = selectedRole;
      fetch(`${BASE_URL}/users/${updatedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedUser)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update user');
        }
        console.log('User updated successfully');
        setShowAddForm(false);
        setUsers(prevUsers => prevUsers.map(user => user._id === updatedUser._id ? updatedUser : user));
      })
      .catch(error => {
        console.error('Error updating user:', error);
      });
    }
  }

  const handleSelectChange = (selectedOption) => {
    setSelectedUser(selectedOption);
  }

  const handleRemoveClick = (user) => {
    setUserToRemove(user);
    setShowRemovePopup(true);
  }

  const handleRemoveConfirm = () => {
    const updatedUser = { ...userToRemove, role: '' };
    fetch(`${BASE_URL}/users/${updatedUser._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedUser)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to update user');
      }
      console.log('User role removed successfully');
      setShowRemovePopup(false);
      setUsers(prevUsers => prevUsers.map(user => user._id === updatedUser._id ? updatedUser : user));
    })
    .catch(error => {
      console.error('Error removing user role:', error);
    });
  }

  const handleRemoveCancel = () => {
    setShowRemovePopup(false);
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const userOptions = users.map(user => ({ value: user.username, label: user.username }));

  return (
    <div className="w-full sm:px-6 pt-10">
      <div className="flex items-center mb-4">
        <button onClick={handleBack} className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center shadow-lg transition-transform transform hover:scale-105 mr-2">
          <img src={arrowIcon} alt="Back" className="w-5 h-5 inline-block mr-2" />
          Back
        </button>
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 leading-tight shadow-sm">
          Management Roles
        </p>
      </div>
      <div className="bg-white shadow-md rounded-lg px-4 md:px-10 pt-4 md:pt-7 pb-5 overflow-x-auto relative">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="h-16 w-full text-sm leading-none text-gray-800 ">
              <TableHeader title="Role" />
              <TableHeader title="Name" />
              <TableHeader title="Email" />
              <TableHeader title="Position" />
              {/* <TableHeader title="Current Role" /> */}
              <TableHeader title="Action" />
            </tr>
          </thead>
          <tbody>
            <TableRow
              data={users.find(user => user.role === "Super Admin")}
              role={'Super Admin'}
              onAddClick={() => handleAddClick('Super Admin')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "Inventory Admin")}
              role={'Inventory Admin'}
              onAddClick={() => handleAddClick('Inventory Admin')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "Regional Director")}
              role={'Regional Director'}
              onAddClick={() => handleAddClick('Regional Director')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "AFD")}
              role={'AFD'}
              onAddClick={() => handleAddClick('AFD')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "TOD")}
              role={'TOD'}
              onAddClick={() => handleAddClick('TOD')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "Cagayan Provincial Officer")}
              role={'Cagayan Provincial Officer'}
              onAddClick={() => handleAddClick('Cagayan Provincial Officer')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "Isabela Provincial Officer")}
              role={'Isabela Provincial Officer'}
              onAddClick={() => handleAddClick('Isabela Provincial Officer')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "Batanes Provincial Officer")}
              role={'Batanes Provincial Officer'}
              onAddClick={() => handleAddClick('Batanes Provincial Officer')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "Nueva Vizcaya Provincial Officer")}
              role={'Nueva Vizcaya Provincial Officer'}
              onAddClick={() => handleAddClick('Nueva Vizcaya Provincial Officer')}
              onRemoveClick={handleRemoveClick}
            />
            <TableRow
              data={users.find(user => user.role === "Quirino Provincial Officer")}
              role={'Quirino Provincial Officer'}
              onAddClick={() => handleAddClick('Quirino Provincial Officer')}
              onRemoveClick={handleRemoveClick}
            />
          </tbody>
        </table>
      </div>
      {showAddForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Add User</h2>
            <div className="mb-4">
              <label htmlFor="selectUser" className="block text-sm font-medium text-gray-700">Select User:</label>
              <Select
                id="selectUser"
                value={selectedUser}
                onChange={handleSelectChange}
                options={userOptions}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={handleCancel} className="bg-gray-300 px-4 py-2 rounded-md text-gray-800 hover:bg-gray-400 focus:outline-none focus:ring focus:ring-gray-200 mr-2">Cancel</button>
              <button onClick={handleConfirm} className="bg-indigo-500 px-4 py-2 rounded-md text-white hover:bg-indigo-600 focus:outline-none focus:ring focus:ring-indigo-200" disabled={!selectedUser}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {showRemovePopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Remove Signatory</h2>
            <p className="mb-4">Do you want to remove this signatory?</p>
            <div className="flex justify-end mt-4">
              <button onClick={handleRemoveCancel} className="bg-gray-300 px-4 py-2 rounded-md text-gray-800 hover:bg-gray-400 focus:outline-none focus:ring focus:ring-gray-200 mr-2">Cancel</button>
              <button onClick={handleRemoveConfirm} className="bg-red-500 px-4 py-2 rounded-md text-white hover:bg-red-600 focus:outline-none focus:ring focus:ring-red-200">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagementTable;
