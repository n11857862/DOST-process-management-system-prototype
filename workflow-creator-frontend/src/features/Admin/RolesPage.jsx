import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Users, Edit3, Save, AlertTriangle, Loader2, CheckCircle2, Search, Filter, RefreshCw } from 'lucide-react';
import workflowService from '../../lib/workflowService';
const AVAILABLE_ROLES = ['staff', 'manager', 'admin'];

export const RolesPage = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalUsers: 0, limit: 10 });
    
    const [editStates, setEditStates] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = useCallback(async (page = 1) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await workflowService.listAllUsersForAdmin({ page, limit: pagination.limit });
            if (response.success) {
                setUsers(response.data);
                setPagination(response.pagination);
            } else {
                throw new Error(response.message || 'Failed to fetch users');
            }
        } catch (err) {
            setError(err.message || 'An error occurred while fetching users.');
            setUsers([]);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.limit]);

    useEffect(() => {
        fetchUsers(1);
    }, [fetchUsers]);

    const handleRoleChange = (userId, newRole) => {
        setEditStates(prev => ({
            ...prev,
            [userId]: { ...prev[userId], newRole, saveError: null, saveSuccess: false },
        }));
    };

    const handleSaveRole = async (userId) => {
        const userEditState = editStates[userId];
        if (!userEditState || !userEditState.newRole) {
            setEditStates(prev => ({
                ...prev,
                [userId]: { ...prev[userId], saveError: 'No new role selected.', isSaving: false, saveSuccess: false },
            }));
            return;
        }

        setEditStates(prev => ({
            ...prev,
            [userId]: { ...userEditState, isSaving: true, saveError: null, saveSuccess: false },
        }));

        try {
            const response = await workflowService.updateUserRoleForAdmin(userId, userEditState.newRole);
            if (response.success) {
                setEditStates(prev => ({
                    ...prev,
                    [userId]: { ...prev[userId], isSaving: false, saveSuccess: true, saveError: null },
                }));
                fetchUsers(pagination.currentPage); 
                setTimeout(() => {
                    setEditStates(prev => {
                        const newStates = { ...prev };
                        if (newStates[userId]) {
                            newStates[userId].saveSuccess = false;
                        }
                        return newStates;
                    });
                }, 3000);
            } else {
                throw new Error(response.message || 'Failed to update role.');
            }
        } catch (err) {
            setEditStates(prev => ({
                ...prev,
                [userId]: { ...prev[userId], isSaving: false, saveError: err.message || 'Error updating role.', saveSuccess: false },
            }));
        }
    };
    
    const handlePageChange = (newPage) => {
        fetchUsers(newPage);
    };

    const handleRefresh = () => {
        fetchUsers(pagination.currentPage);
    };

    const filteredUsers = searchTerm 
        ? users.filter(user => 
            user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : users;

    const getRoleBadgeStyles = (role) => {
        switch(role) {
            case 'admin':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'manager':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-green-100 text-green-800 border-green-200';
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-full">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                    <div className="flex items-center mb-4 md:mb-0">
                        <div className="bg-indigo-100 p-2 rounded-lg mr-3">
                            <ShieldCheck className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
                            <p className="text-sm text-gray-500 mt-1">Manage user access levels and permissions</p>
                        </div>
                    </div>
                    
                    <div className="flex space-x-3">
                        <button 
                            onClick={handleRefresh}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4 mr-1.5" />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
                        <div className="relative flex-grow">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name, username or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 block w-full pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    <span className="text-gray-400 hover:text-gray-500 cursor-pointer">×</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="flex flex-col justify-center items-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
                    <p className="text-gray-500 font-medium">Loading users...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm mb-6" role="alert">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                        <div>
                            <p className="font-medium text-red-800">Error fetching users</p>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {!isLoading && !error && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Username</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">New Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <tr key={user._id} className="hover:bg-gray-50 transition-colors duration-150">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.name || '—'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email || '—'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeStyles(user.role)}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <select
                                                    value={editStates[user._id]?.newRole || user.role}
                                                    onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md transition duration-150 ease-in-out"
                                                >
                                                    {AVAILABLE_ROLES.map(roleName => (
                                                        <option key={roleName} value={roleName} className="capitalize">
                                                            {roleName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex flex-col">
                                                    <button
                                                        onClick={() => handleSaveRole(user._id)}
                                                        disabled={editStates[user._id]?.isSaving || (!editStates[user._id]?.newRole || editStates[user._id]?.newRole === user.role)}
                                                        className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white ${
                                                            (!editStates[user._id]?.newRole || editStates[user._id]?.newRole === user.role)
                                                            ? 'bg-gray-300 cursor-not-allowed'
                                                            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                                                        } transition-colors duration-150 ease-in-out`}
                                                    >
                                                        {editStates[user._id]?.isSaving ? (
                                                            <>
                                                                <Loader2 className="animate-spin mr-2 h-4 w-4" /> 
                                                                Saving...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Save size={16} className="mr-2" />
                                                                Update Role
                                                            </>
                                                        )}
                                                    </button>
                                                    
                                                    {editStates[user._id]?.saveError && (
                                                        <div className="flex items-center mt-2 text-xs text-red-600">
                                                            <AlertTriangle size={12} className="mr-1" />
                                                            {editStates[user._id].saveError}
                                                        </div>
                                                    )}
                                                    
                                                    {editStates[user._id]?.saveSuccess && (
                                                        <div className="flex items-center mt-2 text-xs text-green-600">
                                                            <CheckCircle2 size={12} className="mr-1" /> 
                                                            Role updated successfully
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-10 text-center text-sm text-gray-500">
                                            {searchTerm ? (
                                                <div className="flex flex-col items-center justify-center">
                                                    <Search className="h-6 w-6 text-gray-400 mb-2" />
                                                    <p>No users found matching "{searchTerm}"</p>
                                                    <button 
                                                        onClick={() => setSearchTerm('')}
                                                        className="mt-2 text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        Clear search
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center">
                                                    <Users className="h-6 w-6 text-gray-400 mb-2" />
                                                    <p>No users available</p>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {pagination.totalPages > 1 && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Showing <span className="font-medium">{((pagination.currentPage - 1) * pagination.limit) + 1}</span> to <span className="font-medium">{Math.min(pagination.currentPage * pagination.limit, pagination.totalUsers)}</span> of{' '}
                                        <span className="font-medium">{pagination.totalUsers}</span> users
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => handlePageChange(1)}
                                            disabled={pagination.currentPage <= 1 || isLoading}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">First</span>
                                            <span aria-hidden="true">&laquo;</span>
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                                            disabled={pagination.currentPage <= 1 || isLoading}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <span aria-hidden="true">&lsaquo;</span>
                                        </button>
                                        
                                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                            Page {pagination.currentPage} of {pagination.totalPages}
                                        </span>
                                        
                                        <button
                                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                                            disabled={pagination.currentPage >= pagination.totalPages || isLoading}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Next</span>
                                            <span aria-hidden="true">&rsaquo;</span>
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(pagination.totalPages)}
                                            disabled={pagination.currentPage >= pagination.totalPages || isLoading}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Last</span>
                                            <span aria-hidden="true">&raquo;</span>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between w-full sm:hidden">
                                <button
                                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                                    disabled={pagination.currentPage <= 1 || isLoading}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-700">
                                    Page {pagination.currentPage} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                                    disabled={pagination.currentPage >= pagination.totalPages || isLoading}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};