import React, { useState, useEffect } from 'react';
import { Settings, User, KeyRound, Save, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import workflowService from '../../lib/workflowService';

export const SettingsPage = () => {
    const { user: currentUser, updateUserContext } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');
    
    const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [newPasswordMessage, setNewPasswordMessage] = useState('');
    const [confirmPasswordMessage, setConfirmPasswordMessage] = useState('');
    
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setName(currentUser.name || '');
            setEmail(currentUser.email || '');
            
            if (isAdmin) {
                console.log('Current user data:', {
                    id: currentUser._id || currentUser.id,
                    name: currentUser.name,
                    email: currentUser.email,
                    role: currentUser.role
                });
            }
        }
    }, [currentUser, isAdmin]);

    useEffect(() => {
        if (newPassword && newPassword.length < 6) {
            setNewPasswordMessage('Password must be at least 6 characters.');
        } else {
            setNewPasswordMessage('');
        }
    }, [newPassword]);

    useEffect(() => {
        if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) {
            setConfirmPasswordMessage('Passwords do not match.');
        } else {
            setConfirmPasswordMessage('');
        }
    }, [newPassword, confirmNewPassword]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setIsSavingProfile(true);
        setProfileError('');
        setProfileSuccess('');

        try {
            console.log('Current user data for profile update:', {
                id: currentUser._id || currentUser.id,
                hasId: Boolean(currentUser._id || currentUser.id),
                name: name,
                email: email,
                currentEmail: currentUser.email
            });

            const profileData = { name };
            const response = await workflowService.updateMyProfile(profileData);
            
            let updateMessage = '';
            
            if (isAdmin && email !== currentUser.email && email.trim()) {
                try {
                    const userId = currentUser._id || currentUser.id;
                    
                    if (!userId) {
                        throw new Error('Cannot update email: User ID is missing');
                    }
                    
                    console.log(`Updating email from ${currentUser.email} to ${email}`);
                    console.log(`User ID: ${userId}`);
                    
                    const emailResponse = await workflowService.updateUserEmail(userId, email);
                    
                    if (emailResponse.success) {
                        updateMessage = response.success 
                            ? 'Profile and email updated successfully!' 
                            : 'Email updated successfully!';
                            
                        if (updateUserContext) {
                            updateUserContext(prevUser => ({
                                ...prevUser,
                                email: email
                            }));
                        }
                    } else {
                        updateMessage = response.success 
                            ? `Profile updated, but email update failed: ${emailResponse.message}` 
                            : `Email update failed: ${emailResponse.message}`;
                    }
                } catch (emailError) {
                    console.error('Email update error:', emailError);
                    updateMessage = response.success 
                        ? `Profile updated, but email update failed: ${emailError.message}` 
                        : `Email update failed: ${emailError.message}`;
                }
            } else if (response.success) {
                updateMessage = 'Profile updated successfully!';
            }
            
            if (response.success || updateMessage) {
                setProfileSuccess(updateMessage || 'Update completed with some issues');
                
                if (response.success && updateUserContext) {
                    updateUserContext(prevUser => ({
                        ...prevUser,
                        name: name
                    }));
                }
                
                setTimeout(() => setProfileSuccess(''), 5000);
            } else {
                throw new Error(response.message || 'Failed to update profile');
            }
        } catch (err) {
            console.error('Profile update error:', err);
            setProfileError(err.response?.data?.message || err.message || 'An error occurred');
            setTimeout(() => setProfileError(''), 5000);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword !== confirmNewPassword) {
            setPasswordError("New passwords don't match.");
            return;
        }
        if (newPassword.length < 6) { 
            setPasswordError("New password must be at least 6 characters.");
            return;
        }

        setIsChangingPassword(true);
        try {
            const response = await workflowService.changeMyPassword({ 
                currentPassword, 
                newPassword,
                confirmNewPassword
            });
            if (response.success) {
                setPasswordSuccess('Password changed successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                setTimeout(() => setPasswordSuccess(''), 3000);
            } else {
                throw new Error(response.message || 'Failed to change password.');
            }
        } catch (err) {
            setPasswordError(err.response?.data?.message || err.message || 'An error occurred while changing password.');
            setNewPassword('');
            setConfirmNewPassword('');
            setTimeout(() => setPasswordError(''), 5000);
        } finally {
            setIsChangingPassword(false);
        }
    };
    
    if (!currentUser) {
        return (
            <div className="p-6 flex justify-center items-center h-full">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-700 font-medium">Loading your settings...</p>
                </div>
            </div>
        );
    }

    const isChangePasswordButtonDisabled = 
        isChangingPassword || 
        !currentPassword || 
        !newPassword || 
        newPassword.length < 6 || 
        newPassword !== confirmNewPassword;

    const isProfileSaveButtonDisabled = 
        isSavingProfile || 
        (name === (currentUser.name || '') && (!isAdmin || email === (currentUser.email || ''))) || 
        !name.trim();

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-full">
            <div className="max-w-2xl mx-auto mb-8">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                        <Settings className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Account Settings</h1>
                </div>
                <p className="mt-2 text-gray-600">Manage your account information and change your password.</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-8">
                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center mb-6">
                        <div className="p-1.5 bg-blue-50 rounded-md">
                            <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <h2 className="ml-3 text-xl font-semibold text-gray-800">Profile Information</h2>
                    </div>
                    <form onSubmit={handleProfileSave} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                                <div className="mt-1 relative">
                                    <input type="text" id="username" value={currentUser.username || ''} disabled 
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed sm:text-sm" />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                        <AlertCircle className="h-4 w-4 text-gray-400" />
                                    </div>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email {isAdmin && <span className="text-blue-600">*</span>}
                                </label>
                                <div className="mt-1 relative">
                                    {isAdmin ? (
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input 
                                                type="email" 
                                                id="email" 
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                placeholder="Enter email address" 
                                                aria-label="Email address"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="h-4 w-4 text-gray-400" />
                                                </div>
                                                <input 
                                                    type="email" 
                                                    id="email" 
                                                    value={currentUser.email || ''} 
                                                    disabled 
                                                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed sm:text-sm" 
                                                />
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                                    <AlertCircle className="h-4 w-4 text-gray-400" />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {!isAdmin && (
                                    <p className="mt-1 text-xs text-gray-500">Contact admin to change email</p>
                                )}
                                {isAdmin && (
                                    <div>
                                        <p className="mt-1 text-xs text-blue-600">
                                            <span className="font-medium">Admin privilege:</span> You can update email addresses
                                        </p>
                                        {currentUser && (currentUser._id || currentUser.id) && (
                                            <p className="mt-0.5 text-xs text-gray-500">User ID: {currentUser._id || currentUser.id}</p>
                                        )}
                                        {!currentUser || (!currentUser._id && !currentUser.id) ? (
                                            <p className="mt-0.5 text-xs text-red-500">Warning: User ID not found. Email updates may not work.</p>
                                        ) : null}
                                        <p className="mt-0.5 text-xs text-gray-600">Note: The backend email update functionality may require additional implementation.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                                <div className="mt-1">
                                    <input type="text" id="role" value={currentUser.role || ''} disabled 
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 capitalize cursor-not-allowed sm:text-sm" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                    Display Name <span className="text-blue-600">*</span>
                                </label>
                                <div className="mt-1">
                                    <input 
                                        type="text" 
                                        id="name" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                                        placeholder="Enter your display name"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="h-14">
                            {profileError && (
                                <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 animate-fadeIn">
                                    <AlertTriangle size={18} className="mr-2 flex-shrink-0" /> 
                                    <span>{profileError}</span>
                                </div>
                            )}
                            {profileSuccess && (
                                <div className="flex items-center text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-100 animate-fadeIn">
                                    <CheckCircle2 size={18} className="mr-2 flex-shrink-0" /> 
                                    <span>{profileSuccess}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button 
                                type="submit"
                                disabled={isProfileSaveButtonDisabled}
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSavingProfile ? 
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : 
                                    <Save size={16} className="-ml-1 mr-2 h-4 w-4" />}
                                Save Profile
                            </button>
                        </div>
                    </form>
                </section>

                <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center mb-6">
                        <div className="p-1.5 bg-orange-50 rounded-md">
                            <KeyRound className="h-5 w-5 text-orange-600" />
                        </div>
                        <h2 className="ml-3 text-xl font-semibold text-gray-800">Change Password</h2>
                    </div>
                    <form onSubmit={handleChangePassword} className="space-y-5">
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">Current Password <span className="text-red-600">*</span></label>
                            <div className="mt-1 relative">
                                <input 
                                    type={showCurrentPassword ? "text" : "password"}
                                    id="currentPassword" 
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                                    autoComplete="current-password"
                                    placeholder="Enter your current password"
                                />
                                <button 
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                >
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password <span className="text-red-600">*</span></label>
                            <div className="mt-1 relative">
                                <input 
                                    type={showNewPassword ? "text" : "password"}
                                    id="newPassword" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className={`block w-full pl-3 pr-10 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                                        newPasswordMessage ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                                    }`}
                                    autoComplete="new-password"
                                    placeholder="Enter your new password"
                                />
                                <button 
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {newPasswordMessage && (
                                <p className="mt-1.5 flex items-center text-xs text-red-600">
                                    <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" /> {newPasswordMessage}
                                </p>
                            )}
                            {!newPasswordMessage && newPassword && (
                                <div className="mt-1.5">
                                    <div className="flex items-center gap-1">
                                        <div className={`h-1 flex-1 rounded-full ${newPassword.length >= 6 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                        <div className={`h-1 flex-1 rounded-full ${newPassword.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                        <div className={`h-1 flex-1 rounded-full ${newPassword.length >= 10 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Password strength: {
                                        newPassword.length >= 10 ? 'Strong' : newPassword.length >= 8 ? 'Medium' : 'Weak'
                                    }</p>
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700">Confirm New Password <span className="text-red-600">*</span></label>
                            <div className="mt-1 relative">
                                <input 
                                    type={showConfirmPassword ? "text" : "password"}
                                    id="confirmNewPassword" 
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    className={`block w-full pl-3 pr-10 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                                        confirmPasswordMessage ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                                    }`}
                                    autoComplete="new-password"
                                    placeholder="Confirm your new password"
                                />
                                <button 
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {confirmPasswordMessage && (
                                <p className="mt-1.5 flex items-center text-xs text-red-600">
                                    <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" /> {confirmPasswordMessage}
                                </p>
                            )}
                        </div>

                        <div className="bg-blue-50 rounded-md p-3 text-sm text-blue-700 border border-blue-100">
                            <h4 className="font-medium mb-1.5">Password Requirements:</h4>
                            <ul className="space-y-1 pl-5 list-disc text-xs">
                                <li>At least 6 characters long</li>
                                <li>Passwords must match</li>
                                <li>Different from your current password</li>
                            </ul>
                        </div>

                        <div className="h-14">
                            {passwordError && (
                                <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 animate-fadeIn">
                                    <AlertTriangle size={18} className="mr-2 flex-shrink-0" /> 
                                    <span>{passwordError}</span>
                                </div>
                            )}
                            {passwordSuccess && (
                                <div className="flex items-center text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-100 animate-fadeIn">
                                    <CheckCircle2 size={18} className="mr-2 flex-shrink-0" /> 
                                    <span>{passwordSuccess}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button 
                                type="submit"
                                disabled={isChangePasswordButtonDisabled}
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isChangingPassword ? 
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : 
                                    <KeyRound size={16} className="-ml-1 mr-2 h-4 w-4" />}
                                Change Password
                            </button>
                        </div>
                    </form>
                </section>
                
                <div className="text-center text-xs text-gray-500 mt-8">
                    <p>Last account update: {new Date(currentUser.updatedAt || Date.now()).toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;