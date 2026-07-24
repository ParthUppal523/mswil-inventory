"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [isLoginView, setIsLoginView] = useState(true);

  // --- LOGIN STATE ---
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- REGISTRATION STATE ---
  const [regData, setRegData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    company: "",
    designation: "",
    role: "customer" // Default to Customer
  });
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // --- LOGIN HANDLER ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setLoginError(""); 
    setIsLoggingIn(true);

    if (!loginUser || !loginPass) {
      setLoginError("Please fill in both fields.");
      setIsLoggingIn(false);
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append("username", loginUser);
      formData.append("password", loginPass);

      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("mswil_token", data.access_token);
        router.push("/dashboard");
      } else {
        setLoginError(data.detail || "Invalid credentials.");
      }
    } catch (err) {
      setLoginError("Failed to connect to the server. Please try again later.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // --- REGISTRATION HANDLER ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    setIsRegistering(true);

    try {
      const response = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: regData.firstName,
          last_name: regData.lastName,
          email: regData.email,
          password: regData.password,
          company: regData.company,
          designation: regData.designation,
          role: regData.role
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRegSuccess(`Success! Your assigned Login Username is: ${data.assigned_username}. Please wait for an Admin to approve your account.`);
        // Clear form
        setRegData({ firstName: "", lastName: "", email: "", password: "", company: "", designation: "", role: "customer" });
      } else {
        setRegError(data.detail || "Registration failed.");
      }
    } catch (err) {
      setRegError("Failed to connect to the server.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-gray-50">
      
      {/* LEFT SIDE: Branding Panel (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-800 flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900 opacity-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]"></div>
        <div className="relative z-10 text-center text-white">
          <div className="bg-white p-4 rounded-xl inline-block mb-8 shadow-2xl">
             {/* Replace with your actual logo */}
             <div className="h-16 w-16 bg-emerald-800 rounded-lg flex items-center justify-center font-black text-2xl"> <img src="/logo.png" alt="MSWIL Logo" className="h-full w-full object-contain" /> </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">MSWIL Enterprise Portal</h1>
          <p className="text-emerald-100 text-lg max-w-md mx-auto">
            Streamlined inventory management, instant purchase orders, and seamless corporate fulfillment.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md">
          
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-3xl font-bold text-emerald-800">MSWIL Portal</h1>
          </div>

          {/* View Toggles */}
          <div className="flex p-1 bg-gray-100 rounded-lg mb-8">
            <button 
              onClick={() => { setIsLoginView(true); setRegSuccess(""); setRegError(""); }}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${isLoginView ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsLoginView(false); setLoginError(""); }}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!isLoginView ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Create Account
            </button>
          </div>

          {/* --- LOGIN VIEW --- */}
          {isLoginView ? (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome back</h2>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Login ID / Username</label>
                <input
                  type="text"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-gray-50 focus:bg-white"
                  placeholder="e.g. tata.motors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-gray-50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 mt-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors shadow-md disabled:opacity-70"
              >
                {isLoggingIn ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

          ) : (

          /* --- REGISTRATION VIEW --- */
            <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Request Access</h2>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Account Type</label>
                <select 
                  value={regData.role}
                  onChange={(e) => setRegData({...regData, role: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                >
                  <option value="customer">I am a Client / Customer</option>
                  <option value="admin">I am an MSWIL Employee (Admin)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">First Name</label>
                  <input required type="text" value={regData.firstName} onChange={(e) => setRegData({...regData, firstName: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name</label>
                  <input required type="text" value={regData.lastName} onChange={(e) => setRegData({...regData, lastName: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Work Email</label>
                <input required type="email" value={regData.email} onChange={(e) => setRegData({...regData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization</label>
                  <input required type="text" value={regData.company} onChange={(e) => setRegData({...regData, company: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white" placeholder="Company Name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Designation</label>
                  <input required type="text" value={regData.designation} onChange={(e) => setRegData({...regData, designation: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white" placeholder="Job Title" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Enter Password</label>
                <input required type="password" value={regData.password} onChange={(e) => setRegData({...regData, password: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white" />
              </div>

              {regError && <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">{regError}</div>}
              {regSuccess && <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-lg border border-emerald-200 text-center">{regSuccess}</div>}

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-3 mt-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors shadow-md disabled:opacity-70"
              >
                {isRegistering ? 'Submitting...' : 'Submit Registration'}
              </button>
            </form>
          )}

        </div>
      </div>
    </main>
  );
}