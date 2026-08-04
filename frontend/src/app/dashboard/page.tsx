"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import CustomerDashboard from "@/components/CustomerDashboard";

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "customer" | null>(null);
  const [userInitial, setUserInitial] = useState<string>("U");

  useEffect(() => {
    const token = localStorage.getItem("mswil_token");

    if (!token) {
      // If there is no token, boot them back to the login screen
      router.push("/login");
      return;
    }

    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      
      setRole(payload.role);

      // Fetch the most up-to-date First Name for the Avatar
      fetch("http://localhost:8000/user/profile", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.first_name) {
          setUserInitial(data.first_name.charAt(0).toUpperCase());
        } else if (payload.sub) {
          // Fallback to username if first name is missing
          setUserInitial(payload.sub.charAt(0).toUpperCase());
        }
      })
      .catch(() => {
        // Fallback in case of network glitch
        if (payload.sub) setUserInitial(payload.sub.charAt(0).toUpperCase());
      });

    } catch (error) {
      console.error("Invalid token format");
      localStorage.removeItem("mswil_token");
      router.push("/login");
    }
  }, [router]);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("mswil_token");
    router.push("/login");
  };

  if (!role) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 font-medium">Loading secure portal...</div>;

  // Render the appropriate dashboard based on the user's role
  if (role === "admin") {
    return <AdminDashboard handleLogout={handleLogout} userInitial={userInitial} />;
  }
  if (role === "customer") {
    return <CustomerDashboard handleLogout={handleLogout} userInitial={userInitial} />;
  }

  return (
    <div className="p-8">
      <h1>Customer Dashboard (Under Construction)</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}