import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems, Listbox, ListboxButton, ListboxOption, ListboxOptions, Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react';
import { Bars3Icon, BellIcon, XMarkIcon, MagnifyingGlassIcon, DocumentTextIcon, DocumentArrowDownIcon, TrashIcon, PlusIcon, ChevronUpDownIcon, FunnelIcon, ArrowPathIcon, EyeIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const userNavigation = [
  { name: 'Profile Settings', href: '/settings' },
  { name: 'Sign out', href: '#', action: 'logout' },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

// Reusable Status Badge
const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
  if (status === 'Approved') colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  else if (status === 'Invoiced') colorClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
  else if (status === 'Backordered' || status === 'Pending' || status === 'Unread') colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
  else if (status === 'Read') colorClass = 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {status || 'Unknown'}
    </span>
  );
};

// Reusable Pagination Component
const Pagination = ({ currentPage, totalItems, pageSize, onPageChange }: { currentPage: number, totalItems: number, pageSize: number, onPageChange: (page: number) => void }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span> of <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50">
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            
            {[...Array(totalPages)].map((_, idx) => {
              const page = idx + 1;
              const isCurrent = page === currentPage;
              if (totalPages > 7 && (page < currentPage - 1 || page > currentPage + 1) && page !== 1 && page !== totalPages) {
                if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">...</span>;
                return null;
              }
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={classNames(
                    isCurrent ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
                    'relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0'
                  )}
                >
                  {page}
                </button>
              );
            })}

            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50">
              <span className="sr-only">Next</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default function CustomerDashboard({ handleLogout, userInitial }: { handleLogout: () => void, userInitial: string }) {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // --- GLOBAL SEARCH & ADVANCED FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState('default');

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 50;

  // Deep Link Ref to prevent useEffect from wiping search instantly
  const isDeepLink = useRef(false);

  // State for Expandable Rows
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // --- SHOPPING CART STATE ---
  const [shippingAddress, setShippingAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [isBillingSameAsShipping, setIsBillingSameAsShipping] = useState(true);
  
  const [gstNumber, setGstNumber] = useState('');
  const [useSavedGst, setUseSavedGst] = useState(false);
  const savedGstNumber = "07AAAAA1234A1Z5";

  const [cartItems, setCartItems] = useState([{ item_code: '', item_name: '', quantity: 1 }]);
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);
  const [poSubmitError, setPoSubmitError] = useState('');

  // --- NOTIFICATION STATES ---
  const [dropdownNotifications, setDropdownNotifications] = useState<any[]>([]);
  const [tabNotifications, setTabNotifications] = useState<any[]>([]);
  const unreadCount = dropdownNotifications.filter(n => !n.is_read).length;

  // --- USER PREFERENCES ---
  const [emailOptIn, setEmailOptIn] = useState(true);
  
  const handleEmailToggle = async () => {
    const newValue = !emailOptIn;
    setEmailOptIn(newValue);
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:8000/user/preferences", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ email_notifications: newValue })
      });

      if (!response.ok) {
        // If the server fails, revert the toggle back to its original state
        setEmailOptIn(!newValue);
        console.error("Failed to save preference.");
      }
    } catch (error) {
      setEmailOptIn(!newValue);
      console.error("Network error saving preference.");
    }
  };

  // --- ANALYTICS STATES ---
  const [analytics, setAnalytics] = useState<any>(null);
  const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

  const navigation = [
    { name: 'Dashboard' },
    { name: 'Submit PO' },
    { name: 'Order History' },
    { name: 'Notifications' },
  ];

  // Reset Filters when switching tabs
  useEffect(() => {
    if (isDeepLink.current) {
      isDeepLink.current = false;
      return;
    }
    setSearchQuery('');
    setSearchScope('all');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setSortConfig('default');
    setCurrentPage(1);
  }, [activeTab]);

  // Reset page to 1 whenever a filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchScope, statusFilter, startDate, endDate, sortConfig]);

  const clearFilters = () => {
    setSearchQuery('');
    setSearchScope('all');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setSortConfig('default');
    setCurrentPage(1);
  };

  // --- DATA FETCHING ---
  const fetchCustomerData = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const skip = (currentPage - 1) * pageSize;
      const queryParams = `?skip=${skip}&limit=${pageSize}&search=${encodeURIComponent(searchQuery)}&search_scope=${searchScope}&status=${statusFilter}&start_date=${startDate}&end_date=${endDate}&sort_by=${sortConfig}`;

      if (activeTab === 'Dashboard' || activeTab === 'Order History') {
        const poRes = await fetch(`http://localhost:8000/purchase-orders${activeTab === 'Order History' ? queryParams : '?limit=5'}`, { headers: { Authorization: `Bearer ${token}` } });
        if (poRes.ok) {
          const poData = await poRes.json();
          setPurchaseOrders(poData.data || poData);
          if (activeTab === 'Order History') setTotalItems(poData.total || 0);
        }
      }

      if (activeTab === 'Notifications') {
        const notifRes = await fetch(`http://localhost:8000/notifications${queryParams}`, { headers: { Authorization: `Bearer ${token}` }});
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setTabNotifications(notifData.data || notifData);
          setTotalItems(notifData.total || 0);
        }
      }

      // Always fetch full inventory for the cart dropdown
      if (inventoryList.length === 0 || activeTab === 'Submit PO') {
        const invRes = await fetch(`http://localhost:8000/inventory?limit=1000`, { headers: { Authorization: `Bearer ${token}` } });
        if (invRes.ok) {
          const invData = await invRes.json();
          setInventoryList(invData.data || invData);
        }
      }

      if (activeTab === 'Dashboard') {
        const analyticsRes = await fetch("http://localhost:8000/customer/analytics", { headers: { Authorization: `Bearer ${token}` } });
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      }
      
    } catch (error) { console.error("Failed to fetch customer data:", error); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchCustomerData();
  }, [activeTab, currentPage, searchQuery, searchScope, statusFilter, startDate, endDate, sortConfig]);

  useEffect(() => {
    const fetchUserPreferences = async () => {
      const token = localStorage.getItem("mswil_token");
      if (!token) return;

      try {
        const prefRes = await fetch("http://localhost:8000/user/preferences", { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        
        if (prefRes.ok) {
          const prefData = await prefRes.json();
          setEmailOptIn(prefData.email_notifications);
        }
      } catch (error) {
        console.error("Failed to fetch user preferences:", error);
      }
    };

    fetchUserPreferences();
  }, []);

  const fetchDropdownNotifications = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/notifications?limit=50", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDropdownNotifications(data.data || data);
      }
    } catch (error) { console.error("Failed to fetch notifications:", error); }
  };

  useEffect(() => {
    fetchDropdownNotifications();
    const interval = setInterval(fetchDropdownNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- NOTIFICATION HANDLERS ---
  const handleNotificationClick = async (e: React.MouseEvent, notif: any, directRoute: boolean = true) => {
    e.stopPropagation();
    const token = localStorage.getItem("mswil_token");
    
    // Mark as read
    if (!notif.is_read && token) {
      try {
        await fetch(`http://localhost:8000/notifications/${notif.id}/read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        });
        setDropdownNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setTabNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (error) { console.error("Failed to mark notification read:", error); }
    }

    // Deep Link Routing
    if (directRoute) {
      const titleLower = notif.title.toLowerCase();
      const idMatch = notif.message.match(/#(\d+)/) || notif.message.match(/(?:order|po|id)\s*#?\s*(\d+)/i);
      const extractedId = idMatch ? idMatch[1] : '';

      if (titleLower.includes("purchase order") || titleLower.includes("invoice") || titleLower.includes("backorder")) {
        if (activeTab !== "Order History") {
          isDeepLink.current = true;
          setActiveTab("Order History");
        }
    
        setStartDate(''); setEndDate(''); setSortConfig('default'); setCurrentPage(1);

        if (titleLower.includes("approved")) {
          setStatusFilter('approved');
        } else {
          setStatusFilter('all');
        }

        // Apply the ID match
        if (extractedId) {
          setSearchQuery(extractedId);
          setSearchScope('id');
        }
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;
    try {
      await fetch("http://localhost:8000/notifications/read-all", { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      setDropdownNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setTabNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) { console.error("Failed to mark all as read:", error); }
  };

  // --- PDF DOCUMENT VIEWER ---
  const handleViewDocument = async (e: React.MouseEvent, poId: number, docType: 'po' | 'invoice') => {
    e.stopPropagation(); 
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/purchase-orders/${poId}/download?doc_type=${docType}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        // Convert the secure response into a raw binary Blob
        const blob = await response.blob();
        // Create a temporary local URL for the Blob
        const url = window.URL.createObjectURL(blob);
        // Open the URL in a new tab
        window.open(url, '_blank');
        
        // Clean up the temporary URL memory
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        setActiveTab('Order History');
      } else {
        alert("Document not available or you are unauthorized.");
      }
    } catch (error) { console.error("Error downloading document:", error); }
  };

  // --- CART HANDLERS ---
  const handleAddCartRow = () => setCartItems([...cartItems, { item_code: '', item_name: '', quantity: 1 }]);
  const handleRemoveCartRow = (index: number) => { if (cartItems.length > 1) setCartItems(cartItems.filter((_, i) => i !== index)); };
  const handleClearCartRow = (index: number) => {
    const newCart = [...cartItems];
    newCart[index] = { item_code: '', item_name: '', quantity: 1 };
    setCartItems(newCart);
  };

  const handleSmartFill = (index: number, field: string, value: string) => {
    const newCart = [...cartItems];
    newCart[index] = { ...newCart[index], [field]: value };
    let matchedItem = null;
    if (field === 'item_code') matchedItem = inventoryList.find(i => i.item_code.toString() === value);
    else if (field === 'item_name') matchedItem = inventoryList.find(i => i.item_name === value);

    if (matchedItem) {
      newCart[index].item_code = matchedItem.item_code.toString();
      newCart[index].item_name = matchedItem.item_name;
    } else if (field === 'item_code') newCart[index].item_name = '';
    setCartItems(newCart);
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newCart = [...cartItems];
    newCart[index].quantity = parseInt(value, 10) || 0;
    setCartItems(newCart);
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, cartItem) => {
      const inventoryItem = inventoryList.find(i => i.item_code.toString() === cartItem.item_code);
      if (inventoryItem && cartItem.quantity) return total + (inventoryItem.price * cartItem.quantity);
      return total;
    }, 0);
  };

  // --- SUBMIT PO FORM ---
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setPoSubmitError('');
    setIsSubmittingPO(true);

    const validItems = cartItems.filter(item => item.item_code !== '' && item.quantity > 0);
    if (validItems.length === 0) {
      setPoSubmitError('Please select at least one valid item and specify a quantity.');
      setIsSubmittingPO(false);
      return;
    }

    const token = localStorage.getItem("mswil_token");
    const finalBillingAddress = isBillingSameAsShipping 
      ? (shippingAddress || "Standard Delivery") 
      : (billingAddress || "Standard Delivery");

    const payload = {
      shipping_address: shippingAddress || "Standard Delivery",
      billing_address: finalBillingAddress,
      gst_number: gstNumber || null,
      items: validItems.map(item => ({
        item_code: parseInt(item.item_code, 10),
        ordered_quantity: parseInt(item.quantity.toString(), 10)
      }))
    };

    try {
      const response = await fetch("http://localhost:8000/purchase-order", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchCustomerData(); 
        setCartItems([{ item_code: '', item_name: '', quantity: 1 }]);
        setShippingAddress(''); 
        setBillingAddress(''); 
        setGstNumber('');
        setUseSavedGst(false); 
        setIsBillingSameAsShipping(true);
        setActiveTab('Order History');
      } else {
        const errorData = await response.json();
        if (Array.isArray(errorData.detail)) {
          const messages = errorData.detail.map((err: any) => `${err.loc[err.loc.length - 1]}: ${err.msg}`).join(" | ");
          setPoSubmitError(`Schema Error: ${messages}`);
        } else {
          setPoSubmitError(errorData.detail || "Failed to create Purchase Order.");
        }
      }
    } catch (error) { setPoSubmitError("Network error. Could not connect to the server."); } 
    finally { setIsSubmittingPO(false); }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* EMERALD OVERLAPPING HEADER */}
      <div className={classNames("bg-emerald-700 transition-all duration-300", activeTab === 'Dashboard' ? "pb-64" : "pb-32")}>
        <Disclosure as="nav" className="border-b border-emerald-600/50 bg-emerald-700">
          <div className="mx-auto max-w-[96%] px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <div className="bg-white p-2 rounded-lg inline-flex items-center justify-center shadow-md">
                  <div className="h-8 w-8 flex items-center justify-center">
                    <img src="/logo.png" alt="MSWIL Logo" className="h-full w-full object-contain" />
                  </div>
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
                            isCurrent ? 'bg-emerald-800 text-white shadow-inner' : 'text-emerald-100 hover:bg-emerald-600 hover:text-white',
                            'rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
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
                  
                  {/* DYNAMIC NOTIFICATION BELL DROPDOWN */}
                  <Menu as="div" className="relative ml-3">
                    <MenuButton className="relative rounded-full p-1 text-emerald-200 hover:text-white focus:outline-none">
                      <span className="sr-only">View notifications</span>
                      <BellIcon aria-hidden="true" className="size-6" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-emerald-600">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </MenuButton>

                    <MenuItems
                      transition
                      className="absolute right-0 z-50 mt-2 w-80 sm:w-96 origin-top-right rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:opacity-0 overflow-hidden"
                    >
                      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {dropdownNotifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-xs text-gray-500 font-medium">
                            No notifications recorded yet.
                          </div>
                        ) : (
                          dropdownNotifications.map((n) => (
                            <MenuItem key={n.id}>
                              {({ active }) => (
                                <div
                                  onClick={(e) => handleNotificationClick(e, n, true)}
                                  className={classNames(
                                    active ? 'bg-emerald-50/60' : '',
                                    !n.is_read ? 'bg-emerald-50/30' : 'bg-white',
                                    'px-4 py-3 cursor-pointer transition-colors flex items-start gap-3'
                                  )}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    <span
                                      className={classNames(
                                        'inline-block size-2 rounded-full',
                                        !n.is_read ? 'bg-emerald-600' : 'bg-transparent'
                                      )}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <p className={classNames('text-xs font-bold', !n.is_read ? 'text-emerald-950' : 'text-gray-700')}>
                                      {n.title}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                    <span className="text-[10px] text-gray-400 mt-1 block font-medium">
                                      {n.created_at
                                        ? new Intl.DateTimeFormat('en-GB', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          }).format(new Date(n.created_at))
                                        : ''}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </MenuItem>
                          ))
                        )}
                      </div>
                      
                      {/* VIEW ALL NOTIFICATIONS FOOTER */}
                      <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                        <button 
                          onClick={() => setActiveTab('Notifications')}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                        >
                          View all notifications
                        </button>
                      </div>

                    </MenuItems>
                  </Menu>

                  <Menu as="div" className="relative ml-3">
                    <MenuButton className="relative flex max-w-xs items-center rounded-full bg-emerald-600 text-sm focus:outline-none ring-2 ring-white/20">
                      <div className="size-8 rounded-full bg-white flex items-center justify-center text-emerald-600 font-bold border border-emerald-400">
                        {userInitial}
                      </div>
                    </MenuButton>
                    <MenuItems transition className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:opacity-0">
                      {userNavigation.map((item) => (
                        <MenuItem key={item.name}>
                          <a
                            href={item.href}
                            onClick={item.action === 'logout' ? (e) => { e.preventDefault(); handleLogout(); } : undefined}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            {item.name}
                          </a>
                        </MenuItem>
                      ))}
                    </MenuItems>
                  </Menu>
                </div>
              </div>
            </div>
          </div>
        </Disclosure>

        <header className="py-10">
          <div className="mx-auto max-w-[96%] px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-white">{activeTab}</h1>
            
            {/* THE COMPOSITE SEARCH BAR - Only Visible for Order History Tab */}
            {activeTab === 'Order History' && (
              <div className="w-full lg:w-auto">
                <div className="flex rounded-md shadow-sm w-full lg:min-w-[500px]">
                  <select
                    value={searchScope}
                    onChange={(e) => setSearchScope(e.target.value)}
                    className="bg-emerald-800 text-emerald-100 border-r border-emerald-600/50 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:bg-emerald-900 transition-colors font-medium cursor-pointer"
                  >
                    <option value="all">All Fields</option>
                    <option value="id">PO ID</option>
                  </select>
                  
                  <div className="relative flex-grow">
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-emerald-300 hidden sm:block" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search your orders..."
                      className="w-full bg-emerald-600/40 border border-transparent text-white placeholder-emerald-200 py-2 pr-3 focus:outline-none focus:bg-emerald-600 focus:ring-2 focus:ring-emerald-300 transition-colors sm:text-sm rounded-r-md pl-3 sm:pl-10"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>
      </div>

      <main className={classNames("transition-all duration-300", activeTab === 'Dashboard' ? "-mt-64" : "-mt-32")}>
        <div className="mx-auto max-w-[96%] px-4 pb-12 sm:px-6 lg:px-8">
          
          {loading ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-200">
              <span className="text-gray-500 font-medium text-lg animate-pulse">Loading portal...</span>
            </div>
          ) : (
            <>
              {/* --- DASHBOARD TAB --- */}
              {activeTab === 'Dashboard' && (
                <div className="space-y-6">
                  {/* KPI CARDS */}
                  {analytics && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                      {/* Pipeline Orders */}
                      <div 
                        onClick={() => { isDeepLink.current = true; setActiveTab('Order History'); setStatusFilter('approved'); }}
                        className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-emerald-300 hover:ring-1 hover:ring-emerald-300 transition group"
                      >
                        <dt className="truncate text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-emerald-600">Pipeline Orders <span className="mt-2 text-xs text-gray-400 font-medium">  &bull; Pending Invoice</span></dt>
                        <dd className="mt-1 text-3xl font-black tracking-tight text-gray-900">{analytics.kpis.pipeline_count}</dd>
                        <div className="mt-2 text-xs text-emerald-600 font-semibold">Value: ₹{analytics.kpis.pipeline_value.toLocaleString()}</div>
                      </div>

                      {/* Backordered */}
                      <div 
                        onClick={() => { isDeepLink.current = true; setActiveTab('Order History'); setStatusFilter('backordered'); }}
                        className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-orange-300 hover:ring-1 hover:ring-orange-300 transition group"
                      >
                        <dt className="truncate text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-orange-600">Backordered</dt>
                        <dd className="mt-1 text-3xl font-black tracking-tight text-gray-900">{analytics.kpis.backordered_count}</dd>
                        <div className="mt-2 text-xs text-orange-600 font-semibold">Value: ₹{analytics.kpis.backordered_value.toLocaleString()}</div>
                      </div>

                      {/* Total Orders */}
                      <div 
                        onClick={() => { isDeepLink.current = true; setActiveTab('Order History'); setStatusFilter('all'); }}
                        className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-indigo-300 hover:ring-1 hover:ring-indigo-300 transition group"
                      >
                        <dt className="truncate text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-indigo-600">Total Orders Placed</dt>
                        <dd className="mt-1 text-3xl font-black tracking-tight text-gray-900">{analytics.kpis.total_orders}</dd>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Left: Recent POs Table (Span 2) */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full">
                      <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                        <h3 className="text-lg font-semibold text-gray-900">Recent Purchase Orders</h3>
                        <button 
                          onClick={() => setActiveTab('Submit PO')}
                          className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-md font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          + Create New PO
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50/50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PO ID</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {purchaseOrders.length === 0 ? (
                              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Your recent purchase orders will appear here.</td></tr>
                            ) : (
                              purchaseOrders.slice(0, 5).map((po) => {
                                const isPOInvoiced = po.status === 'Invoiced';
                                const displayTotal = isPOInvoiced ? po.total_amount * 1.18 : po.total_amount;
                                
                                return (
                                  <tr 
                                    key={po.id} 
                                    className="hover:bg-gray-50 transition-colors"
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {po.created_at ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(po.created_at)) : '--'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">#{po.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-semibold text-gray-900">
                                        {po.total_amount ? `₹${displayTotal.toFixed(2)}` : '₹ --'}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <StatusBadge status={po.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap flex justify-center gap-3">
                                      {po.status !== 'Backordered' && (
                                        <button 
                                          onClick={(e) => handleViewDocument(e, po.id, 'po')}
                                          className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-sm font-medium"
                                        >
                                          <DocumentTextIcon className="h-4 w-4" /> View PO
                                        </button>
                                      )}
                                      {po.status === 'Backordered' && (
                                        <p className="text-sm text-gray-500 italic">Backordered</p>
                                      )}
                                      {po.status === 'Invoiced' && (
                                        <button 
                                          onClick={(e) => handleViewDocument(e, po.id, 'invoice')}
                                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-sm font-medium"
                                        >
                                          <DocumentArrowDownIcon className="h-4 w-4" /> Invoice
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right: Pie Chart (Span 1) */}
                    {analytics && analytics.charts.top_items.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full min-h-[300px]">
                        <h3 className="text-base font-bold text-gray-900 mb-6">Most Purchased Items</h3>
                        <div className="flex-1 w-full flex flex-col items-center justify-center">
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={analytics.charts.top_items}
                                  innerRadius={50}
                                  outerRadius={75}
                                  paddingAngle={5}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  {analytics.charts.top_items.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-4 flex flex-wrap justify-center gap-3">
                            {analytics.charts.top_items.slice(0,3).map((entry: any, index: number) => (
                              <div key={entry.name} className="flex items-center gap-1.5">
                                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-xs font-semibold text-gray-700 truncate max-w-[100px]" title={entry.name}>{entry.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- SUBMIT PO TAB (SHOPPING CART) --- */}
              {activeTab === 'Submit PO' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  
                  <div className="bg-gray-50 px-8 py-8 border-b border-gray-100 flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <DocumentTextIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Create Purchase Order</h3>
                      <p className="text-sm text-gray-500">Search by Code or Name. Details will auto-fill automatically.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitPO} className="p-8">

                    {/* SECTION 1: Cart Items */}
                    <div className="mb-4 flex justify-between items-end">
                      <h4 className="text-lg font-bold text-gray-900">Order Items</h4>
                      <button 
                        type="button" 
                        onClick={handleAddCartRow}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" /> Add Item Line
                      </button>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-1 mb-8 shadow-sm">
                      {/* Desktop Header Row */}
                      <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                        <div className="col-span-2">Item Code</div>
                        <div className="col-span-5">Product Name</div>
                        <div className="col-span-2">Unit Price</div>
                        <div className="col-span-1">Qty</div>
                        <div className="col-span-2 text-right">Actions</div>
                      </div>

                      {/* Dynamic Cart Rows */}
                      <div className="divide-y divide-gray-100 overflow-visible">
                        {cartItems.map((cartItem, index) => {
                          const selectedInventoryItem = inventoryList.find(i => i.item_code.toString() === cartItem.item_code);
                          const isInvalidCode = cartItem.item_code !== '' && !selectedInventoryItem;

                          return (
                            <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-4 py-5 items-start hover:bg-gray-50 transition-colors">
                              
                              {/* Item Code Input & Validation */}
                              <div className="lg:col-span-2 relative">
                                <label className="lg:hidden block text-xs font-semibold text-gray-500 mb-1">Item Code</label>
                                <input
                                  type="text"
                                  value={cartItem.item_code}
                                  onChange={(e) => handleSmartFill(index, 'item_code', e.target.value)}
                                  placeholder="e.g. 101"
                                  className={classNames(
                                    "w-full px-3 py-2 bg-white border rounded-md focus:outline-none transition-colors text-sm font-medium",
                                    isInvalidCode 
                                      ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-red-600" 
                                      : "border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-900"
                                  )}
                                />
                                {isInvalidCode && (
                                  <p className="text-[11px] text-red-500 font-medium absolute -bottom-4 left-1">Invalid Code</p>
                                )}
                              </div>

                              {/* Headless UI Listbox Dropdown */}
                              <div className="lg:col-span-5">
                                <label className="lg:hidden block text-xs font-semibold text-gray-500 mb-1">Product Name</label>
                                <Listbox value={cartItem.item_name} onChange={(val) => handleSmartFill(index, 'item_name', val)}>
                                  <div className="relative">
                                    <ListboxButton className={classNames(
                                      "relative w-full cursor-default rounded-md py-2 pl-3 pr-10 text-left border focus:outline-none sm:text-sm font-medium transition-colors",
                                      cartItem.item_name !== '' 
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" 
                                        : "bg-white border-gray-300 text-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    )}>
                                      <span className="block truncate">{cartItem.item_name || '-- Choose a Product --'}</span>
                                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                        <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                      </span>
                                    </ListboxButton>
                                    <ListboxOptions transition className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm data-closed:opacity-0 transition">
                                      {inventoryList.map((item) => (
                                        <ListboxOption
                                          key={item.item_code}
                                          className={({ focus }) => `relative cursor-default select-none py-2 pl-3 pr-9 transition-colors ${focus ? 'bg-emerald-600 text-white' : 'text-gray-900'}`}
                                          value={item.item_name}
                                        >
                                          {({ selected }) => (
                                            <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                                              {item.item_name} - (Code: #{item.item_code})
                                            </span>
                                          )}
                                        </ListboxOption>
                                      ))}
                                    </ListboxOptions>
                                  </div>
                                </Listbox>
                              </div>

                              {/* Unit Price */}
                              <div className="lg:col-span-2">
                                <label className="lg:hidden block text-xs font-semibold text-gray-500 mb-1">Unit Price</label>
                                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600 font-medium text-sm">
                                  {selectedInventoryItem ? `₹${selectedInventoryItem.price.toFixed(2)}` : '₹0.00'}
                                </div>
                              </div>

                              {/* Quantity Input */}
                              <div className="lg:col-span-1">
                                <label className="lg:hidden block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
                                <input
                                  required
                                  type="number"
                                  min="1"
                                  value={cartItem.quantity}
                                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors text-sm"
                                />
                              </div>

                              {/* Action Buttons */}
                              <div className="lg:col-span-2 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleClearCartRow(index)}
                                  className="text-gray-400 hover:text-gray-700 p-2 rounded-md hover:bg-gray-200 transition"
                                  title="Clear Row"
                                >
                                  <XMarkIcon className="h-5 w-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCartRow(index)}
                                  disabled={cartItems.length === 1}
                                  className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                  title="Delete Row"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SECTION 2: Address Details */}
                    <div className="pt-6 border-t border-gray-200 mb-8">
                      <h4 className="text-lg font-bold text-gray-900 mb-6">Delivery Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Shipping Address</label>
                          <textarea
                            rows={3}
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                            placeholder="Enter delivery location..."
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Billing Address</label>
                            <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={isBillingSameAsShipping}
                                onChange={(e) => setIsBillingSameAsShipping(e.target.checked)}
                                className="mr-2 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                              />
                              Same as Shipping
                            </label>
                          </div>
                          <textarea
                            rows={3}
                            disabled={isBillingSameAsShipping}
                            value={isBillingSameAsShipping ? shippingAddress : billingAddress}
                            onChange={(e) => setBillingAddress(e.target.value)}
                            className={classNames(
                              "w-full px-4 py-3 border rounded-md focus:outline-none transition-colors",
                              isBillingSameAsShipping 
                                ? "bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed" 
                                : "bg-white border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-900"
                            )}
                            placeholder="Enter billing location..."
                          />
                        </div>

                        {/* GST Number Field */}
                        <div className="md:col-span-2">
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-semibold text-gray-700">GST Number (Optional)</label>
                            {savedGstNumber && (
                              <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={useSavedGst}
                                  onChange={(e) => {
                                    setUseSavedGst(e.target.checked);
                                    if (e.target.checked) setGstNumber(savedGstNumber);
                                    else setGstNumber('');
                                  }}
                                  className="mr-2 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                                />
                                Use saved GST: {savedGstNumber}
                              </label>
                            )}
                          </div>
                          <input
                            type="text"
                            disabled={useSavedGst}
                            value={gstNumber}
                            onChange={(e) => setGstNumber(e.target.value)}
                            className={classNames(
                              "w-full px-4 py-3 border rounded-md focus:outline-none transition-colors",
                              useSavedGst 
                                ? "bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed" 
                                : "bg-white border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-gray-900"
                            )}
                            placeholder="Enter 15-digit GSTIN..."
                          />
                        </div>

                      </div>
                    </div>

                    {/* SECTION 3: Summary & Submit */}
                    <div className="flex flex-col md:flex-row justify-between items-center bg-emerald-50/50 p-6 rounded-lg border border-emerald-100 gap-6">
                      
                      {poSubmitError ? (
                        <div className="text-red-600 text-sm font-medium max-w-lg">
                          {poSubmitError}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm max-w-md">
                          By submitting this order, you agree to MSWIL's standard purchasing terms and conditions.
                        </div>
                      )}

                      <div className="flex items-center gap-6 w-full md:w-auto">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-500 uppercase">Estimated Total</div>
                          <div className="text-2xl font-black text-emerald-700">₹{calculateTotal().toFixed(2)}</div>
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmittingPO || calculateTotal() === 0}
                          className="flex-1 md:flex-none bg-emerald-600 text-white px-8 py-3 rounded-md font-bold hover:bg-emerald-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmittingPO ? 'Processing...' : 'Submit Order'}
                        </button>
                      </div>

                    </div>
                  </form>
                </div>
              )}

              {/* --- ORDER HISTORY TAB (Detailed View) --- */}
              {activeTab === 'Order History' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                  <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">Complete Order History</h3>
                  </div>
                  
                  {/* Secondary Filter Toolbar */}
                  <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-3">
                        <FunnelIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Status:</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 bg-white shadow-sm">
                          <option value="all">All Orders</option>
                          <option value="approved">Approved</option>
                          <option value="invoiced">Invoiced</option>
                          <option value="backordered">Backordered</option>
                        </select>
                      </div>
                      
                      <div className="hidden sm:block h-5 w-px bg-gray-300"></div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">From:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">To:</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(statusFilter !== 'all' || startDate || endDate || searchQuery) && (
                        <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-emerald-700 transition flex items-center gap-1 font-medium mr-2">
                          <ArrowPathIcon className="h-4 w-4" /> Clear Filters
                        </button>
                      )}
                      <span className="text-sm font-medium text-gray-500">Sort By:</span>
                      <select value={sortConfig} onChange={(e) => setSortConfig(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 bg-white shadow-sm">
                        <option value="default">Default (Newest)</option>
                        <option value="val_desc">Total Value (High to Low)</option>
                        <option value="val_asc">Total Value (Low to High)</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PO ID</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shipping Address</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Address</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {purchaseOrders.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                            {searchQuery || startDate || endDate || statusFilter !== 'all' ? "No purchase orders match your criteria." : "No purchase orders recorded yet."}
                          </td></tr>
                        ) : (
                          purchaseOrders.map((po) => {
                            const isExpanded = expandedRow === po.id;
                            const isPOInvoiced = po.status === 'Invoiced';
                            const displayTotal = isPOInvoiced ? po.total_amount * 1.18 : po.total_amount;
                            
                            return (
                              <tr 
                                key={po.id} 
                                onClick={() => setExpandedRow(isExpanded ? null : po.id)}
                                className={classNames("hover:bg-gray-50 transition-colors cursor-pointer", isExpanded ? "bg-emerald-50/30" : "")}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {po.created_at ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(po.created_at)) : '--'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">#{po.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {po.total_amount ? `₹${displayTotal.toFixed(2)}` : '₹ --'}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                    {isPOInvoiced ? 'Incl. of GST (18%)' : 'Excl. of GST'}
                                  </div>
                                </td>
                                <td className={classNames("px-6 py-4 text-sm text-gray-500 transition-all duration-200", isExpanded ? "whitespace-normal min-w-[200px]" : "truncate max-w-[150px]")}>
                                  {po.shipping_address || '--'}
                                </td>
                                <td className={classNames("px-6 py-4 text-sm text-gray-500 transition-all duration-200", isExpanded ? "whitespace-normal min-w-[200px]" : "truncate max-w-[150px]")}>
                                  {po.billing_address || '--'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <StatusBadge status={po.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap flex justify-center gap-3">
                                  {po.status !== 'Backordered' && (
                                    <button 
                                      onClick={(e) => handleViewDocument(e, po.id, 'po')}
                                      className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-sm font-medium"
                                    >
                                      <DocumentTextIcon className="h-4 w-4" /> View PO
                                    </button>
                                  )}
                                  {po.status === 'Backordered' && (
                                    <p className="text-sm text-gray-500 italic">Backordered</p>
                                  )}
                                  {po.status === 'Invoiced' && (
                                    <button 
                                      onClick={(e) => handleViewDocument(e, po.id, 'invoice')}
                                      className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-sm font-medium"
                                    >
                                      <DocumentArrowDownIcon className="h-4 w-4" /> Invoice
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* PO PAGINATION */}
                  <Pagination 
                    currentPage={currentPage} 
                    totalItems={totalItems} 
                    pageSize={pageSize} 
                    onPageChange={setCurrentPage} 
                  />

                </div>
              )}

              {/* --- DEDICATED NOTIFICATIONS TAB --- */}
              {activeTab === 'Notifications' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                  <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <BellIcon className="h-5 w-5 text-emerald-600" /> Notification Center
                    </h3>
                    {/* EMAIL NOTIFICATIONS TOGGLE */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">Email Alerts</span>
                      <button
                        type="button"
                        onClick={handleEmailToggle}
                        className={classNames(
                          emailOptIn ? 'bg-emerald-600' : 'bg-gray-200',
                          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2'
                        )}
                      >
                        <span
                          className={classNames(
                            emailOptIn ? 'translate-x-5' : 'translate-x-0',
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  
                  {/* Filter Toolbar for Notifications */}
                  <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-3">
                        <FunnelIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Status:</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 bg-white shadow-sm">
                          <option value="all">All Alerts</option>
                          <option value="unread">Unread Only</option>
                          <option value="read">Read</option>
                        </select>
                      </div>
                      
                      <div className="hidden sm:block h-5 w-px bg-gray-300"></div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">From:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">To:</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(statusFilter !== 'all' || startDate || endDate) && (
                        <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-emerald-700 transition flex items-center gap-1 font-medium mr-2">
                          <ArrowPathIcon className="h-4 w-4" /> Clear Filters
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Alert Details</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {tabNotifications.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            {startDate || endDate || statusFilter !== 'all' ? "No notifications match your filters." : "No notifications recorded yet."}
                          </td></tr>
                        ) : (
                          tabNotifications.map((notif) => {
                            return (
                              <tr key={notif.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-bold text-gray-900">
                                    {notif.created_at ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(notif.created_at)) : '--'}
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-medium tracking-wide uppercase mt-0.5">
                                    {notif.created_at ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(notif.created_at)) : ''}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={classNames("text-sm", !notif.is_read ? "font-bold text-emerald-900" : "font-medium text-gray-800")}>
                                    {notif.title}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-600 whitespace-pre-wrap max-w-lg leading-relaxed">
                                    {notif.message}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <StatusBadge status={notif.is_read ? 'Read' : 'Unread'} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap flex justify-center gap-2">
                                  <button 
                                    onClick={(e) => handleNotificationClick(e, notif, true)}
                                    className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded font-bold transition shadow-sm border border-emerald-200 inline-flex items-center gap-1"
                                  >
                                    <EyeIcon className="h-4 w-4" /> View Details
                                  </button>
                                  {!notif.is_read && (
                                    <button 
                                      onClick={(e) => handleNotificationClick(e, notif, false)}
                                      className="text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded font-medium transition inline-flex items-center gap-1 border border-gray-200"
                                    >
                                      Mark Read
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* NOTIFICATIONS PAGINATION */}
                  <Pagination 
                    currentPage={currentPage} 
                    totalItems={totalItems} 
                    pageSize={pageSize} 
                    onPageChange={setCurrentPage} 
                  />

                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}