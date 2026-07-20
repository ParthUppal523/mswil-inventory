"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "customer" | null>(null);

  // 1. useEffect runs exactly once when the page first loads
  useEffect(() => {
    const token = localStorage.getItem("mswil_token");

    if (!token) {
      // If there is no token, boot them back to the login screen!
      router.push("/login");
      return;
    }

    try {
      // 2. Crack open the JWT payload without a 3rd party library
      // A JWT has 3 parts separated by dots. The payload is the middle part (index 1).
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      // 3. Set the role based on what the Python backend cryptographically sealed inside
      setRole(payload.role);
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

  // Prevent rendering the dashboard until the role is confirmed
  if (!role) return <div className="flex h-screen items-center justify-center">Loading secure portal...</div>;

  // Render the appropriate dashboard based on the user's role
  if (role === "admin") {
    return <AdminDashboard handleLogout={handleLogout} />;
  }

  return (
    <div className="p-8">
      <h1>Customer Dashboard (Under Construction)</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}