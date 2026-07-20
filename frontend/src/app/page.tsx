export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-900">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight text-blue-900">
          MSWIL ERP
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Enterprise Resource Planning & Purchase Order Management System
        </p>
        
        <div className="flex justify-center gap-4 pt-4">
          <button className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">
            Sign In
          </button>
          <button className="px-6 py-2 bg-white text-blue-600 font-semibold rounded-md border border-blue-200 hover:bg-blue-50 transition-colors">
            Register Organization
          </button>
        </div>
      </div>
    </main>
  );
}