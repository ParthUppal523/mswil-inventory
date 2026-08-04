"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleNavigate = () => {
    setIsTransitioning(true);
    
    setTimeout(() => {
      router.push("/login");
    }, 750);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex overflow-hidden">
      
      {/* Animated Emerald Panel */}
      <div
        className={`flex flex-col justify-center items-center relative transition-all duration-700 ease-in-out bg-emerald-800 ${
          isTransitioning ? "w-full lg:w-1/2" : "w-full"
        }`}
      >
        {/* SVG Pattern Overlay */}
        <div className="absolute inset-0 bg-emerald-900 opacity-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]"></div>

        {/* Content Wrapper */}
        <div className="relative z-10 text-center text-white flex flex-col items-center">
          
          {/* Dynamic Logo Sizing & Margins */}
          <div 
            className={`bg-white p-4 rounded-xl inline-block shadow-2xl transition-all duration-700 ease-in-out ${
              isTransitioning ? "mb-8" : "mb-10"
            }`}
          >
            <div className={`flex items-center justify-center transition-all duration-700 ease-in-out ${
              isTransitioning ? "h-16" : "h-20 md:h-24"
            }`}>
              <img src="/logo.png" alt="MSWIL Logo" className="h-full w-auto object-contain" />
            </div>
          </div>
          
          {/* Dynamic Font Sizing & Margins */}
          <h1 className={`font-bold tracking-tight transition-all duration-700 ease-in-out ${
            isTransitioning ? "text-4xl mb-4" : "text-5xl md:text-6xl mb-6"
          }`}>
            MSWIL Enterprise Portal
          </h1>
          
          {/* Dynamic Text Sizing & Updated Marketing Copy */}
          <p className={`text-emerald-100 mx-auto px-4 transition-all duration-700 ease-in-out ${
            isTransitioning ? "text-lg max-w-md mb-0" : "text-xl md:text-2xl max-w-2xl mb-12"
          }`}>
            Empowering global mobility through advanced wiring solutions, smart vision systems, and seamless corporate fulfillment.
          </p>

          {/* Fading Button */}
          <div className={`transition-all duration-700 ease-in-out overflow-hidden flex justify-center ${
            isTransitioning ? "max-h-0 opacity-0 mt-0" : "max-h-32 opacity-100 mt-2"
          }`}>
            <button
              onClick={handleNavigate}
              className={`px-8 py-4 bg-white text-emerald-800 font-bold rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-500 ease-in-out ${
                isTransitioning ? "translate-y-4 scale-95" : "translate-y-0 scale-100"
              }`}
            >
              Access Secure Portal
            </button>
          </div>
        </div>
      </div>

      {/* Right Side Empty Space (Revealed during transition) */}
      <div 
        className={`hidden lg:block transition-all duration-700 bg-gray-50 ${
          isTransitioning ? "w-1/2" : "w-0"
        }`}
      ></div>
      
    </main>
  );
}