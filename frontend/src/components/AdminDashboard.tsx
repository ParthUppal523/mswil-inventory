import { useState, useEffect } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems, Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react';
import { Bars3Icon, BellIcon, XMarkIcon, MagnifyingGlassIcon, EllipsisVerticalIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const user = { name: 'Admin User', email: 'admin@mswil.com' };
const navigation = [
  { name: 'Dashboard' },
  { name: 'Inventory' },
  { name: 'Customers' },
  { name: 'Purchase Orders' },
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
  const [inventory, setInventory] = useState<any[]>([]);
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // --- NEW: EXPANDABLE ROW STATE ---
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [newItem, setNewItem] = useState({
    item_code: '',
    item_name: '',
    serial_number: '',
    price: '',
    quantity: '',
    description: ''
  });
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- EXPANDABLE ROW OUTSIDE-CLICK LISTENER ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If the user clicks anywhere that is NOT a table row, contract the description
      if (!target.closest('tr')) {
        setExpandedRow(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("mswil_token");
      if (!token) return;

      try {
        const invRes = await fetch("http://localhost:8000/inventory", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (invRes.ok) {
          const invData = await invRes.json();
          // ENHANCEMENT: Sort items ascending by Item Code on initial load
          setInventory(invData.sort((a: any, b: any) => a.item_code - b.item_code));
        }

        const poRes = await fetch("http://localhost:8000/purchase-orders", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (poRes.ok) {
          const poData = await poRes.json();
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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setIsSubmitting(true);

    const token = localStorage.getItem("mswil_token");

    try {
      const response = await fetch("http://localhost:8000/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          item_code: newItem.item_code,
          item_name: newItem.item_name,
          serial_number: newItem.serial_number || null,
          price: parseFloat(newItem.price),
          quantity: parseInt(newItem.quantity, 10),
          description: newItem.description || null
        })
      });

      if (response.ok) {
        const addedData = await response.json();
        // ENHANCEMENT: Maintain strict sorting order when a new item is added
        setInventory((prev) => [...prev, addedData].sort((a, b) => a.item_code - b.item_code));
        
        setIsAddModalOpen(false);
        setNewItem({ item_code: '', item_name: '', serial_number: '', price: '', quantity: '', description: '' });
      } else {
        const errorData = await response.json();
        setAddError(errorData.detail || "Failed to add inventory item.");
      }
    } catch (error) {
      setAddError("Network error. Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [editItem, setEditItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const openEditModal = (item: any) => {
    setEditItem({ ...item }); 
    setEditError('');
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (item: any) => {
    setItemToDelete(item);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setIsEditing(true);
    const token = localStorage.getItem("mswil_token");

    try {
      const response = await fetch(`http://localhost:8000/inventory/${editItem.item_code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          item_name: editItem.item_name,
          serial_number: editItem.serial_number || null,
          price: parseFloat(editItem.price),
          quantity: parseInt(editItem.quantity, 10),
          description: editItem.description || null
        })
      });

      if (response.ok) {
        const updatedData = await response.json();
        // ENHANCEMENT: Maintain strict sorting order when an item is edited
        setInventory((prev) => 
          prev.map((item) => (item.item_code === updatedData.item_code ? updatedData : item))
              .sort((a, b) => a.item_code - b.item_code)
        );
        setIsEditModalOpen(false);
      } else {
        const errorData = await response.json();
        setEditError(errorData.detail || "Failed to update item.");
      }
    } catch (error) {
      setEditError("Network error. Could not connect to the server.");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteItem = async () => {
    setDeleteError('');
    setIsDeleting(true);
    const token = localStorage.getItem("mswil_token");

    try {
      const response = await fetch(`http://localhost:8000/inventory/${itemToDelete.item_code}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setInventory((prev) => prev.filter((item) => item.item_code !== itemToDelete.item_code));
        setIsDeleteModalOpen(false);
      } else {
        const errorData = await response.json();
        setDeleteError(errorData.detail || "Failed to delete item.");
      }
    } catch (error) {
      setDeleteError("Network error. Could not connect to the server.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      
      <div className="bg-indigo-600 pb-32">
        <Disclosure as="nav" className="border-b border-indigo-500/25 bg-indigo-600">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <div className="shrink-0 bg-white p-0.5 rounded-md">
                  <img alt="MSWIL Logo" src="/logo.png" className="size-8 rounded-md object-contain" />
                </div>
                <div className="hidden md:block">
                  <div className="ml-10 flex items-baseline space-x-4">
                    {navigation.map((item) => {
                      const isCurrent = activeTab === item.name;
                      return (
                        <button
                          key={item.name}
                          onClick={() => setActiveTab(item.name)}
                          className={classNames(
                            isCurrent ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white',
                            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          )}
                        >
                          {item.name}
                        </button>
                      );
                    })}
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
              {navigation.map((item) => {
                const isCurrent = activeTab === item.name;
                return (
                  <DisclosureButton
                    key={item.name}
                    as="button"
                    onClick={() => setActiveTab(item.name)}
                    className={classNames(
                      isCurrent ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white',
                      'block w-full text-left rounded-md px-3 py-2 text-base font-medium',
                    )}
                  >
                    {item.name}
                  </DisclosureButton>
                );
              })}
            </div>
          </DisclosurePanel>
        </Disclosure>

        <header className="py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-white">{activeTab}</h1>
            <div className="relative w-full sm:w-80">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-indigo-300" />
              <input
                type="text"
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                className="w-full bg-indigo-500/50 border border-transparent text-white placeholder-indigo-200 rounded-md py-2 pl-10 pr-3 focus:outline-none focus:bg-white focus:text-gray-900 focus:placeholder-gray-500 transition-colors sm:text-sm"
              />
            </div>
          </div>
        </header>

      </div>

      <main className="-mt-32">
        <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          
          {loading ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-200">
              <span className="text-gray-500 font-medium text-lg animate-pulse">Loading live data...</span>
            </div>
          ) : (
            <>
              {/* --- DASHBOARD TAB --- */}
              {activeTab === 'Dashboard' && (
                <div className="grid grid-cols-1 gap-6 items-start lg:grid-cols-3 lg:gap-8">
                  
                  {/* Left Card: Live Inventory */}
                  <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                      <h3 className="text-lg font-semibold text-gray-900">Live Inventory</h3>
                      <button 
                        onClick={() => { setActiveTab('Inventory'); setIsAddModalOpen(true); }}
                        className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                      >
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {inventory.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No inventory items found.</td></tr>
                          ) : (
                            inventory.slice(0, 5).map((item) => (
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
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Card: Recent POs */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                      <h3 className="text-lg font-semibold text-gray-900">Recent POs</h3>
                      <button onClick={() => setActiveTab('Purchase Orders')} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View all</button>
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

              {/* --- INVENTORY TAB --- */}
              {activeTab === 'Inventory' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                    <h3 className="text-lg font-semibold text-gray-900">Inventory Data</h3>
                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Code</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Serial Number</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price (₹)</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Description</th>
                          <th className="relative px-6 py-4"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {inventory.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No inventory items found.</td></tr>
                        ) : (
                          inventory.map((item) => {
                            const isExpanded = expandedRow === item.item_code;
                            
                            return (
                              <tr 
                                key={item.item_code} 
                                className={classNames(
                                  "hover:bg-gray-50 transition-colors cursor-pointer",
                                  isExpanded ? "bg-indigo-50/40" : ""
                                )}
                                onClick={(e) => {
                                  // Prevent expansion toggle when clicking the Ellipsis Menu button
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  setExpandedRow(isExpanded ? null : item.item_code);
                                }}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">#{item.item_code}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 uppercase tracking-wider">{item.serial_number || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{item.item_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">₹{item.price ? item.price.toFixed(2) : '0.00'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{item.quantity}</td>
                                
                                {/* Dynamic Description Cell */}
                                <td className={classNames(
                                  "px-6 py-4 text-sm text-gray-500 transition-all duration-200",
                                  isExpanded ? "whitespace-normal wrap-break-words min-w-250px" : "truncate max-w-xs"
                                )}>
                                  {item.description || '--'}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <Menu as="div" className="relative inline-block text-left">
                                    <MenuButton className="p-1 rounded-full text-gray-400 hover:text-gray-600 focus:outline-none">
                                      <EllipsisVerticalIcon className="h-5 w-5" />
                                    </MenuButton>

                                    <MenuItems transition anchor="bottom end" className="z-50 mt-2 w-36 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none data-closed:scale-95 data-closed:opacity-0 transition">
                                      <MenuItem>
                                          <button 
                                              onClick={() => openEditModal(item)}
                                              className="w-full text-left block px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
                                                  Edit Details
                                          </button>
                                      </MenuItem>
                                      <MenuItem>
                                          <button 
                                              onClick={() => openDeleteModal(item)}
                                              className="w-full text-left block px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                                                  Delete Item
                                          </button>
                                      </MenuItem>
                                    </MenuItems>
                                  </Menu>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* --- ADD ITEM MODAL OVERLAY WITH FORM --- */}
      <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              
              <form onSubmit={handleAddItem}>
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <DialogTitle as="h3" className="text-lg font-bold leading-6 text-gray-900 mb-6">
                    Add New Inventory Item
                  </DialogTitle>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Item Code *</label>
                      <input required type="text" value={newItem.item_code} onChange={(e) => setNewItem({...newItem, item_code: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 101" />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Serial Number</label>
                      <input type="text" value={newItem.serial_number} onChange={(e) => setNewItem({...newItem, serial_number: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. SN-9001" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Item Name *</label>
                      <input required type="text" value={newItem.item_name} onChange={(e) => setNewItem({...newItem, item_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Steel Wire 5mm" />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Price (₹) *</label>
                      <input required type="number" step="0.01" min="0" value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity *</label>
                      <input required type="number" min="0" value={newItem.quantity} onChange={(e) => setNewItem({...newItem, quantity: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                      <textarea rows={2} value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Brief item details..." />
                    </div>
                  </div>

                  {addError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-200">{addError}</div>}
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button type="submit" disabled={isSubmitting} className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Saving...' : 'Save Item'}
                  </button>
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setAddError(''); }} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">
                    Cancel
                  </button>
                </div>
              </form>

            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* --- EDIT ITEM MODAL OVERLAY --- */}
      <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              {editItem && (
                <form onSubmit={handleEditItem}>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div className="flex justify-between items-center mb-6">
                      <DialogTitle as="h3" className="text-lg font-bold leading-6 text-gray-900">
                        Edit Item #{editItem.item_code}
                      </DialogTitle>
                      <StatusBadge status={editItem.quantity > 0 ? "In Stock" : "Out of Stock"} />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-500 mb-1">Item Code</label>
                        <input type="text" disabled value={editItem.item_code} className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-gray-500 cursor-not-allowed" />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Serial Number</label>
                        <input type="text" value={editItem.serial_number || ''} onChange={(e) => setEditItem({...editItem, serial_number: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Item Name *</label>
                        <input required type="text" value={editItem.item_name} onChange={(e) => setEditItem({...editItem, item_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Price (₹) *</label>
                        <input required type="number" step="0.01" min="0" value={editItem.price} onChange={(e) => setEditItem({...editItem, price: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity *</label>
                        <input required type="number" min="0" value={editItem.quantity} onChange={(e) => setEditItem({...editItem, quantity: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                        <textarea rows={2} value={editItem.description || ''} onChange={(e) => setEditItem({...editItem, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    {editError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-200">{editError}</div>}
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button type="submit" disabled={isEditing} className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50">
                      {isEditing ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* --- DELETE ITEM CONFIRMATION MODAL --- */}
      <Dialog open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              {itemToDelete && (
                <>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <DialogTitle as="h3" className="text-lg font-bold leading-6 text-gray-900 mb-2">
                      Confirm Deletion
                    </DialogTitle>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Are you sure you want to permanently delete <strong className="text-gray-900">{itemToDelete.item_name}</strong> (Code: #{itemToDelete.item_code})?</p>
                      <p className="mt-2 text-red-600 font-medium">This action cannot be undone. <br />Current Stock: {itemToDelete.quantity} Units. <br />Current Value: ₹{(itemToDelete.price * itemToDelete.quantity).toFixed(2)}</p>
                    </div>
                    {deleteError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-200">{deleteError}</div>}
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button type="button" onClick={handleDeleteItem} disabled={isDeleting} className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50">
                      {isDeleting ? 'Deleting...' : 'Yes, Delete Item'}
                    </button>
                    <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </DialogPanel>
          </div>
        </div>
      </Dialog>
      
    </div>
  );
}