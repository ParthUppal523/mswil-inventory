"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter(); // Navigating between pages

  // FORM STATE: Setting up memory for what the user inputs in the form fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // THE SUBMIT FUNCTION
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError(""); 

    if (!username || !password) {
      setError("Please fill in both fields.");
      return;
    }

    try {
      // Package the data as standard URL-encoded Form Data
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      // Make the HTTP POST request to the Python backend
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      // Parse the JSON response
      const data = await response.json();

      if (response.ok) {
        // Save the JWT to the browser's local storage
        localStorage.setItem("mswil_token", data.access_token);
        
        // Silently redirect to the dashboard
        router.push("/dashboard");
      } else {
        // The backend returned a 401 or 403 error (e.g., "Account pending admin approval")
        setError(data.detail || "Invalid credentials.");
      }
    } catch (err) {
      // Catch server crashes or network failures
      setError("Failed to connect to the server. Please try again later.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        
        <h1 className="text-3xl font-bold text-center text-blue-900 mb-8">
          MSWIL Login
        </h1>

        {/* The Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Username Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username or Login ID
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g. tata.motors"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-md"
          >
            Sign In to Portal
          </button>
          
        </form>

      </div>
    </main>
  );
}