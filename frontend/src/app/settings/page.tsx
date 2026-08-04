"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, UserIcon, PencilSquareIcon, ShieldCheckIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";

export default function Settings() {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "customer" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "edit" | "security">("overview");

  // --- PROFILE STATE ---
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    organization_name: "",
    designation: "",
    gst_number: "",
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  // --- PREFERENCES STATE ---
  const [emailOptIn, setEmailOptIn] = useState(true);

  // --- SECURITY STATE ---
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });

  // --- INITIALIZATION ---
  useEffect(() => {
    const token = localStorage.getItem("mswil_token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      setRole(payload.role);

      fetchProfileData(token);
      fetchPreferencesData(token);
    } catch (error) {
      localStorage.removeItem("mswil_token");
      router.push("/login");
    }
  }, [router]);

  const fetchProfileData = async (token: string) => {
    try {
      const res = await fetch("http://localhost:8000/user/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          username: data.username || "",
          email: data.email || "",
          organization_name: data.organization_name || "",
          designation: data.designation || "",
          gst_number: data.gst_number || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPreferencesData = async (token: string) => {
    try {
      const res = await fetch("http://localhost:8000/user/preferences", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmailOptIn(data.email_notifications);
      }
    } catch (error) {
      console.error("Failed to fetch preferences");
    }
  };

  // --- HANDLERS ---
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage({ type: "", text: "" });
    setIsUpdatingProfile(true);

    const token = localStorage.getItem("mswil_token");
    try {
      const res = await fetch("http://localhost:8000/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          username: profile.username,
          email: profile.email
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProfileMessage({ type: "success", text: "Profile updated successfully." });
      } else {
        setProfileMessage({ type: "error", text: data.detail || "Failed to update profile." });
      }
    } catch (error) {
      setProfileMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setIsUpdatingProfile(false);
      setTimeout(() => setProfileMessage({ type: "", text: "" }), 5000);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage({ type: "", text: "" });

    if (passwords.new_password !== passwords.confirm_password) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setIsUpdatingPassword(true);
    const token = localStorage.getItem("mswil_token");
    try {
      const res = await fetch("http://localhost:8000/user/security/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          current_password: passwords.current_password,
          new_password: passwords.new_password
        })
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordMessage({ type: "success", text: "Password updated successfully." });
        setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      } else {
        setPasswordMessage({ type: "error", text: data.detail || "Failed to update password." });
      }
    } catch (error) {
      setPasswordMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setIsUpdatingPassword(false);
      setTimeout(() => setPasswordMessage({ type: "", text: "" }), 5000);
    }
  };

  const handleEmailToggle = async () => {
    const newValue = !emailOptIn;
    setEmailOptIn(newValue); 
    
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:8000/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email_notifications: newValue })
      });
      if (!res.ok) setEmailOptIn(!newValue); 
    } catch (error) {
      setEmailOptIn(!newValue);
    }
  };

  // --- THEME LOGIC ---
  const theme = {
    bg: role === "admin" ? "bg-indigo-600" : "bg-emerald-600",
    text: role === "admin" ? "text-indigo-600" : "text-emerald-600",
    button: role === "admin" ? "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500" : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500",
    border: role === "admin" ? "focus:border-indigo-500" : "focus:border-emerald-500",
    badge: role === "admin" ? "bg-indigo-100 text-indigo-800" : "bg-emerald-100 text-emerald-800",
    ring: role === "admin" ? "focus:ring-indigo-500" : "focus:ring-emerald-500",
    sidebarActive: role === "admin" ? "bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600" : "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-600",
    sidebarInactive: "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent font-medium"
  };

  if (isLoading || !role) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">Loading secure portal...</div>;
  }

  const userInitial = profile.first_name ? profile.first_name[0].toUpperCase() : (profile.username ? profile.username[0].toUpperCase() : "U");

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* HEADER */}
      <div className={`${theme.bg} pb-32 transition-colors duration-300`}>
        <div className="mx-auto max-w-[96%] px-4 sm:px-6 lg:px-8 pt-6">
          <button 
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium mb-6"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className={`text-2xl font-black ${theme.text}`}>
                {userInitial}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Account Settings</h1>
              <p className="text-white/80 font-medium mt-1">Manage your profile, security, and preferences.</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT WITH DYNAMIC FLEX LAYOUT */}
      <main className="-mt-20 mx-auto max-w-[96%] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          
          {/* THE COLLAPSIBLE SIDEBAR */}
          <aside className="w-full md:w-[72px] md:hover:w-64 shrink-0 group transition-[width] duration-500 ease-in-out bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col z-10">
            <nav className="flex flex-row md:flex-col py-2 md:w-64 overflow-x-auto md:overflow-hidden">
              <button 
                onClick={() => setActiveTab("overview")}
                className={`flex items-center px-6 py-4 text-sm transition-colors text-left ${activeTab === "overview" ? theme.sidebarActive : theme.sidebarInactive}`}
              >
                <UserIcon className="h-6 w-6 shrink-0" />
                <span className="ml-4 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500">
                  Profile Overview
                </span>
              </button>
              <button 
                onClick={() => setActiveTab("edit")}
                className={`flex items-center px-6 py-4 text-sm transition-colors text-left ${activeTab === "edit" ? theme.sidebarActive : theme.sidebarInactive}`}
              >
                <PencilSquareIcon className="h-6 w-6 shrink-0" />
                <span className="ml-4 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500">
                  Update Profile
                </span>
              </button>
              <button 
                onClick={() => setActiveTab("security")}
                className={`flex items-center px-6 py-4 text-sm transition-colors text-left ${activeTab === "security" ? theme.sidebarActive : theme.sidebarInactive}`}
              >
                <ShieldCheckIcon className="h-6 w-6 shrink-0" />
                <span className="ml-4 whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500">
                  Account Security
                </span>
              </button>
            </nav>
          </aside>

          {/* DYNAMIC CONTENT AREA */}
          <div className="flex-1 min-w-0 w-full space-y-8 transition-all duration-500 ease-in-out">
            
            {/* 1. OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900">Profile Overview</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${theme.badge}`}>
                    {role} Account
                  </span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 mb-8">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Full Name</p>
                      <p className="text-sm font-medium text-gray-900">{profile.first_name} {profile.last_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Username</p>
                      <p className="text-sm font-medium text-gray-900">@{profile.username}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
                      <p className="text-sm font-medium text-gray-900">{profile.email}</p>
                    </div>
                  </div>

                  {role === "customer" && (
                    <>
                      <div className="flex items-center gap-2 mb-4 border-t border-gray-100 pt-6">
                        <BuildingOfficeIcon className={`h-5 w-5 ${theme.text}`} />
                        <h4 className="font-bold text-gray-900">Organization Details</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Company</p>
                          <p className="text-sm font-medium text-gray-900">{profile.organization_name || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Designation</p>
                          <p className="text-sm font-medium text-gray-900">{profile.designation || "N/A"}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Registered GSTIN</p>
                          <p className="text-sm font-medium text-gray-900">{profile.gst_number || "No GSTIN provided."}</p>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                    <button 
                      onClick={() => setActiveTab("edit")}
                      className={`px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors text-sm`}
                    >
                      Edit Details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. UPDATE PROFILE TAB */}
            {activeTab === "edit" && (
              <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-lg font-bold text-gray-900">Update Profile Details</h3>
                  <p className="text-xs text-gray-500 mt-1">Changes made here will be reflected across the portal.</p>
                </div>
                <div className="p-6">
                  <form onSubmit={handleProfileSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                        <input type="text" required value={profile.first_name} onChange={(e) => setProfile({...profile, first_name: e.target.value})} className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition-colors ${theme.border} ${theme.ring}`} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                        <input type="text" required value={profile.last_name} onChange={(e) => setProfile({...profile, last_name: e.target.value})} className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition-colors ${theme.border} ${theme.ring}`} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                        <input type="text" required value={profile.username} onChange={(e) => setProfile({...profile, username: e.target.value})} className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition-colors ${theme.border} ${theme.ring}`} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                        <input type="email" required value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition-colors ${theme.border} ${theme.ring}`} />
                      </div>
                    </div>

                    {/* App Preferences inside Edit Tab */}
                    <div className="border-t border-gray-100 pt-6 mb-6">
                      <h4 className="text-sm font-bold text-gray-900 mb-4">Application Preferences</h4>
                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div>
                          <p className="text-sm font-bold text-gray-900">Email Notifications</p>
                          <p className="text-xs text-gray-500">Receive an email when your orders are approved or invoiced.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleEmailToggle}
                          className={`${emailOptIn ? theme.bg : 'bg-gray-300'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                        >
                          <span className={`${emailOptIn ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
                        </button>
                      </div>
                    </div>

                    {profileMessage.text && (
                      <div className={`mb-6 p-3 rounded-lg text-sm font-medium border ${profileMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {profileMessage.text}
                      </div>
                    )}

                    <div className="flex justify-end border-t border-gray-100 pt-6">
                      <button type="submit" disabled={isUpdatingProfile} className={`px-6 py-2.5 text-white font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 ${theme.button}`}>
                        {isUpdatingProfile ? "Saving..." : "Save Profile Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 3. SECURITY TAB */}
            {activeTab === "security" && (
              <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-lg font-bold text-gray-900">Account Security</h3>
                  <p className="text-xs text-gray-500 mt-1">Update your password to keep your account secure.</p>
                </div>
                <div className="p-6">
                  <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-lg">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Current Password</label>
                      <input type="password" required value={passwords.current_password} onChange={(e) => setPasswords({...passwords, current_password: e.target.value})} className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition-colors ${theme.border} ${theme.ring}`} />
                    </div>
                    <hr className="border-gray-100 my-4" />
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                      <input type="password" required minLength={8} value={passwords.new_password} onChange={(e) => setPasswords({...passwords, new_password: e.target.value})} className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition-colors ${theme.border} ${theme.ring}`} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm New Password</label>
                      <input type="password" required minLength={8} value={passwords.confirm_password} onChange={(e) => setPasswords({...passwords, confirm_password: e.target.value})} className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:outline-none transition-colors ${theme.border} ${theme.ring}`} />
                    </div>

                    {passwordMessage.text && (
                      <div className={`p-3 rounded-lg text-sm font-medium border ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {passwordMessage.text}
                      </div>
                    )}

                    <div className="pt-4">
                      <button type="submit" disabled={isUpdatingPassword || !passwords.current_password || !passwords.new_password} className={`py-2.5 px-6 text-white font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 ${theme.button}`}>
                        {isUpdatingPassword ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}