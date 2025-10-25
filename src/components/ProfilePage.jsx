import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import { motion } from 'framer-motion';

const ProfilePage = ({ onBack, onThemeToggle, currentTheme, onProfileImageChange, profileImage, accountNumber, balance }) => {
  const { user, updateUserMetadata } = useAuth();
  const [newProfileImage, setNewProfileImage] = useState(profileImage);
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user?.user_metadata?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setNewProfileImage(profileImage);
    setName(user?.user_metadata?.full_name || '');
    setTempName(user?.user_metadata?.full_name || '');
  }, [profileImage, user]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewProfileImage(event.target.result);
        onProfileImageChange(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startEditingName = () => {
    setIsEditingName(true);
    setTempName(name);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setTempName(name);
  };

  const saveName = async () => {
    if (!tempName.trim()) return;
    
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      const { data, error } = await updateUserMetadata({
        full_name: tempName.trim()
      });
      
      if (error) throw error;
      
      setName(tempName.trim());
      setIsEditingName(false);
      setSaveMessage('Name updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error updating name:', error);
      setSaveMessage('Error updating name. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack} 
          className="flex items-center text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Back
        </button>
        <h2 className="text-xl font-bold">Profile</h2>
        <div></div> {/* Spacer for alignment */}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
        <div className="flex flex-col items-center">
          {/* Profile Image */}
          <div className="relative mb-6">
            {newProfileImage ? (
              <img 
                src={newProfileImage} 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white dark:border-gray-700 shadow">
                {name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-indigo-600 rounded-full p-2 cursor-pointer hover:bg-indigo-700 transition-colors shadow">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload}
              />
            </label>
          </div>

          {/* User Info */}
          <div className="w-full">
            {/* Name Section */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                {!isEditingName ? (
                  <button 
                    onClick={startEditingName}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <button 
                      onClick={cancelEditingName}
                      className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={saveName}
                      disabled={isSaving}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
              
              {!isEditingName ? (
                <div className="px-3 py-2 border border-transparent rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                  {name || 'No name set'}
                </div>
              ) : (
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your name"
                />
              )}
              
              {saveMessage && (
                <div className={`mt-1 text-xs ${saveMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                  {saveMessage}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme</label>
              <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">Dark Mode</span>
                <button
                  onClick={onThemeToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    currentTheme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      currentTheme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Account Information */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Email</span>
                  <span className="text-gray-900 dark:text-white">{user?.email}</span>
                </div>
                {accountNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Account Number</span>
                    <span className="text-gray-900 dark:text-white font-mono">{accountNumber}</span>
                  </div>
                )}
                {balance !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Current Balance</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Account Created</span>
                  <span className="text-gray-900 dark:text-white">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;