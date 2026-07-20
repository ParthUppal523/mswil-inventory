import { useState, useEffect } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Bars3Icon, BellIcon, XMarkIcon, MagnifyingGlassIcon, EllipsisVerticalIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const user = { name: 'Admin User', email: 'admin@mswil.com' };
const navigation = [
  { name: 'Dashboard', href: '#', current: true },
  { name: 'Inventory', href: '#', current: false },
  { name: 'Customers', href: '#', current: false },
  { name: 'Purchase Orders', href: '#', current: false },
];
const userNavigation = [
  { name: 'Your profile', href: '#' },
  { name: 'Settings', href: '#' },
  { name: 'Sign out', href: '#', action: 'logout' },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
  if (status === 'Approved' || status === 'In Stock' || status === 'Available') {
    colorClass = 'bg-green-100 text-green-800 border-green-200';
  } else if (status === 'Backordered') {
    colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
  } else if (status === 'Low Stock' || status === 'Out of Stock') {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {status || 'Unknown'}
    </span>
  );
};

export default function AdminDashboard({ handleLogout }: { handleLogout: () => void }) {
  // --- STATE FOR BACKEND DATA ---
  const [inventory, setInventory] = useState<any[]>([]);
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- DATA FETCHING (Connecting to FastAPI Backend) ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("mswil_token");
      if (!token) return;

      try {
        // Fetch Inventory
        const invRes = await fetch("http://localhost:8000/inventory", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (invRes.ok) {
          const invData = await invRes.json();
          setInventory(invData);
        }

        // Fetch Purchase Orders
        const poRes = await fetch("http://localhost:8000/purchase-orders", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (poRes.ok) {
          const poData = await poRes.json();
          // Show only the 5 most recent POs on the main dashboard widget
          setRecentPOs(poData.slice(-5).reverse()); 
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      
      <div className="bg-indigo-600 pb-32">
        
        {/* Top Navigation */}
        <Disclosure as="nav" className="border-b border-indigo-500/25 bg-indigo-600">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <div className="shrink-0 bg-white p-0.5 rounded-md">
                  <img alt="MSWIL Logo" src="/logo.png" className="size-8 rounded-md object-contain" />
                </div>
                <div className="hidden md:block">
                  <div className="ml-10 flex items-baseline space-x-4">
                    {navigation.map((item) => (
                      <a
                        key={item.name}
                        href={item.href}
                        aria-current={item.current ? 'page' : undefined}
                        className={classNames(
                          item.current ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white',
                          'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        )}
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="ml-4 flex items-center md:ml-6">
                  <button type="button" className="relative rounded-full p-1 text-indigo-200 hover:text-white focus:outline-none">
                    <span className="absolute -inset-1.5" />
                    <span className="sr-only">View notifications</span>
                    <BellIcon aria-hidden="true" className="size-6" />
                    <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-indigo-600"></span>
                  </button>

                  <Menu as="div" className="relative ml-3">
                    <MenuButton className="relative flex max-w-xs items-center rounded-full bg-indigo-600 text-sm focus:outline-none">
                      <span className="absolute -inset-1.5" />
                      <span className="sr-only">Open user menu</span>
                      <div className="size-8 rounded-full bg-indigo-800 flex items-center justify-center text-white font-bold border border-indigo-400">
                        A
                      </div>
                    </MenuButton>
                    <MenuItems transition className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:opacity-0">
                      {userNavigation.map((item) => (
                        <MenuItem key={item.name}>
                          <a
                            href={item.href}
                            onClick={item.action === 'logout' ? (e) => { e.preventDefault(); handleLogout(); } : undefined}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                          >
                            {item.name}
                          </a>
                        </MenuItem>
                      ))}
                    </MenuItems>
                  </Menu>
                </div>
              </div>
              <div className="-mr-2 flex md:hidden">
                <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-indigo-200 hover:bg-indigo-500 hover:text-white focus:outline-none">
                  <span className="absolute -inset-0.5" />
                  <span className="sr-only">Open main menu</span>
                  <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
                  <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
                </DisclosureButton>
              </div>
            </div>
          </div>
          
          <DisclosurePanel className="md:hidden">
            <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
              {navigation.map((item) => (
                <DisclosureButton
                  key={item.name}
                  as="a"
                  href={item.href}
                  className={classNames(
                    item.current ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white',
                    'block rounded-md px-3 py-2 text-base font-medium',
                  )}
                >
                  {item.name}
                </DisclosureButton>
              ))}
            </div>
          </DisclosurePanel>
        </Disclosure>

        {/* Page Header & Search */}
        <header className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            <div className="relative w-full sm:w-80">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-indigo-300" />
              <input
                type="text"
                placeholder="Search items, POs, or customers..."
                className="w-full bg-indigo-500/50 border border-transparent text-white placeholder-indigo-200 rounded-md py-2 pl-10 pr-3 focus:outline-none focus:bg-white focus:text-gray-900 focus:placeholder-gray-500 transition-colors sm:text-sm"
              />
            </div>
          </div>
        </header>

      </div>

      {/* MAIN CONTENT */}
      <main className="-mt-32">
        <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          
          {loading ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-200">
              <span className="text-gray-500 font-medium text-lg animate-pulse">Loading live data...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 items-start lg:grid-cols-3 lg:gap-8">
              
              {/* LEFT CARD: Live Inventory */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                  <h3 className="text-lg font-semibold text-gray-900">Live Inventory</h3>
                  <button className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                    + Add Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                          <div className="text-gray-700">Item Code</div>
                          <div className="mt-1 text-[11px] font-medium text-gray-400">Serial Code</div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price (₹)</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="relative px-6 py-4"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {inventory.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No inventory items found.</td></tr>
                      ) : (
                        inventory.map((item) => (
                          <tr key={item.item_code} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">#{item.item_code}</div>
                              <div className="text-xs text-gray-500 uppercase tracking-wider">{item.serial_number || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{item.item_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              ₹{item.price ? item.price.toFixed(2) : '0.00'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{item.quantity} Units</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <StatusBadge status={item.quantity > 0 ? "In Stock" : "Out of Stock"} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Menu as="div" className="relative inline-block text-left">
                                <MenuButton className="p-1 rounded-full text-gray-400 hover:text-gray-600 focus:outline-none">
                                  <EllipsisVerticalIcon className="h-5 w-5" />
                                </MenuButton>
                                <MenuItems transition className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none data-closed:scale-95 data-closed:opacity-0 transition">
                                  <MenuItem><a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Update Stock</a></MenuItem>
                                  <MenuItem><a href="#" className="block px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50">Edit Details</a></MenuItem>
                                  <MenuItem><a href="#" className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete Item</a></MenuItem>
                                </MenuItems>
                              </Menu>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT CARD: Recent POs */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                  <h3 className="text-lg font-semibold text-gray-900">Recent POs</h3>
                  <a href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View all</a>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ul className="divide-y divide-gray-100">
                    {recentPOs.length === 0 ? (
                      <li className="p-6 text-center text-gray-500 text-sm">No recent orders.</li>
                    ) : (
                      recentPOs.map((po) => (
                        <li key={po.id} className="p-6 hover:bg-gray-50 transition cursor-pointer group flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Order #{po.id}</span>
                            <StatusBadge status={po.status} />
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 font-medium">Customer #{po.customer_id}</span>
                            {/* Displaying Total Amount (Using placeholder if backend doesn't supply it yet) */}
                            <span className="font-bold text-gray-900">
                              {po.total_amount ? `₹${po.total_amount.toFixed(2)}` : '₹ --'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-400">Tap to view details</span>
                            <button 
                              onClick={() => window.open(`http://localhost:8000/purchase-orders/${po.id}/download?doc_type=po`, '_blank')}
                              className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 p-1.5 rounded-md transition"
                              title="Download PDF"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}