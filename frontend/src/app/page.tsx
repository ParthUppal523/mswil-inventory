"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleNavigate = () => {
    setIsTransitioning(true);
    
    // Wait for the CSS sliding animation to finish before routing
    setTimeout(() => {
      router.push("/login");
    }, 600);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex">
      
      {/* Animated Emerald Panel */}
      <div
        className={`flex flex-col justify-center items-center relative overflow-hidden transition-all duration-700 ease-in-out bg-emerald-800 ${
          isTransitioning ? "w-full lg:w-1/2" : "w-full"
        }`}
      >
        {/* SVG Pattern Overlay */}
        <div className="absolute inset-0 bg-emerald-900 opacity-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]"></div>

        {/* Content Wrapper */}
        <div 
          className={`relative z-10 text-center text-white transition-opacity duration-500 ${
            isTransitioning ? "opacity-0 lg:opacity-100" : "opacity-100"
          }`}
        >
          <div className="bg-white p-4 rounded-xl inline-block mb-8 shadow-2xl">
            <div className="h-16 flex items-center justify-center">
              <img src="/logo.png" alt="MSWIL Logo" className="h-full w-auto object-contain" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight mb-6">MSWIL Enterprise Portal</h1>
          <p className="text-emerald-100 text-xl max-w-2xl mx-auto mb-10 px-4">
            Streamlined inventory management, instant purchase orders, and seamless corporate fulfillment.
          </p>

          <button
            onClick={handleNavigate}
            className={`px-8 py-4 bg-white text-emerald-800 font-bold rounded-lg shadow-lg hover:bg-gray-100 transition-all ${
              isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
          >
            Access Secure Portal
          </button>
        </div>
      </div>

      {/* Right Side Empty Space (Revealed during transition) */}
      <div 
        className={`hidden lg:block transition-all duration-700 ${
          isTransitioning ? "w-1/2" : "w-0"
        }`}
      ></div>
      
    </main>
  );
}