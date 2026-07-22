import { useState, useEffect } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Bars3Icon, BellIcon, XMarkIcon, MagnifyingGlassIcon, DocumentTextIcon, DocumentArrowDownIcon, TrashIcon, PlusIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';

const userNavigation = [
  { name: 'Your profile', href: '#' },
  { name: 'Settings', href: '#' },
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
  else if (status === 'Backordered') colorClass = 'bg-orange-100 text-orange-800 border-orange-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {status || 'Pending'}
    </span>
  );
};

export default function CustomerDashboard({ handleLogout }: { handleLogout: () => void }) {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
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

  const navigation = [
    { name: 'Dashboard' },
    { name: 'Submit PO' },
    { name: 'Order History' },
  ];

  // --- DATA FETCHING ---
  const fetchCustomerData = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const poRes = await fetch("http://localhost:8000/purchase-orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (poRes.ok) {
        const poData = await poRes.json();
        setPurchaseOrders(poData.sort((a: any, b: any) => b.id - a.id));
      }

      const invRes = await fetch("http://localhost:8000/inventory", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (invRes.ok) {
        setInventoryList(await invRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch customer data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, []);

  // --- SECURE PDF DOCUMENT VIEWER ---
  const handleViewDocument = async (e: React.MouseEvent, poId: number, docType: 'po' | 'invoice') => {
    e.stopPropagation(); // Prevents the row from expanding when clicking the button
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/purchase-orders/${poId}/download?doc_type=${docType}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        // Convert the secure response into a raw binary Blob
        const blob = await response.blob();
        // Create a temporary local URL for the Blob
        const url = window.URL.createObjectURL(blob);
        // Open the secure URL in a new tab
        window.open(url, '_blank');
        
        // Clean up the temporary URL memory
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        setActiveTab('Order History');
      } else {
        alert("Document not available or you are unauthorized.");
      }
    } catch (error) {
      console.error("Error downloading document:", error);
    }
  };

  // --- CART HANDLERS ---
  const handleAddCartRow = () => {
    setCartItems([...cartItems, { item_code: '', item_name: '', quantity: 1 }]);
  };

  const handleRemoveCartRow = (index: number) => {
    if (cartItems.length > 1) {
      setCartItems(cartItems.filter((_, i) => i !== index));
    }
  };

  const handleClearCartRow = (index: number) => {
    const newCart = [...cartItems];
    newCart[index] = { item_code: '', item_name: '', quantity: 1 };
    setCartItems(newCart);
  };

  const handleSmartFill = (index: number, field: string, value: string) => {
    const newCart = [...cartItems];
    newCart[index] = { ...newCart[index], [field]: value };

    let matchedItem = null;
    if (field === 'item_code') {
      matchedItem = inventoryList.find(i => i.item_code.toString() === value);
    } else if (field === 'item_name') {
      matchedItem = inventoryList.find(i => i.item_name === value);
    }

    if (matchedItem) {
      newCart[index].item_code = matchedItem.item_code.toString();
      newCart[index].item_name = matchedItem.item_name;
    } else if (field === 'item_code') {
      newCart[index].item_name = '';
    }

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
      if (inventoryItem && cartItem.quantity) {
        return total + (inventoryItem.price * cartItem.quantity);
      }
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
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
    } catch (error) {
      setPoSubmitError("Network error. Could not connect to the server.");
    } finally {
      setIsSubmittingPO(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* EMERALD OVERLAPPING HEADER */}
      <div className="bg-emerald-700 pb-32">
        <Disclosure as="nav" className="border-b border-emerald-600/50 bg-emerald-700">
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
                  <button type="button" className="relative rounded-full p-1 text-emerald-200 hover:text-white focus:outline-none">
                    <BellIcon aria-hidden="true" className="size-6" />
                  </button>

                  <Menu as="div" className="relative ml-3">
                    <MenuButton className="relative flex max-w-xs items-center rounded-full bg-emerald-600 text-sm focus:outline-none ring-2 ring-white/20">
                      <div className="size-8 rounded-full bg-emerald-800 flex items-center justify-center text-white font-bold">
                        C
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
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-white">{activeTab}</h1>
            <div className="relative w-full sm:w-80">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-emerald-300" />
              <input
                type="text"
                placeholder="Search orders..."
                className="w-full bg-emerald-600/50 border border-transparent text-white placeholder-emerald-200 rounded-md py-2 pl-10 pr-3 focus:outline-none focus:bg-white focus:text-gray-900 focus:placeholder-gray-500 transition-colors sm:text-sm"
              />
            </div>
          </div>
        </header>
      </div>

      <main className="-mt-32">
        <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          
          {loading ? (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-200">
              <span className="text-gray-500 font-medium text-lg animate-pulse">Loading portal...</span>
            </div>
          ) : (
            <>
              {/* --- DASHBOARD TAB --- */}
              {activeTab === 'Dashboard' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shipping Address</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Address</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {purchaseOrders.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Your recent purchase orders will appear here.</td></tr>
                        ) : (
                          purchaseOrders.slice(0, 5).map((po) => {
                            const isExpanded = expandedRow === po.id;
                            
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {po.total_amount ? `₹${po.total_amount.toFixed(2)}` : '₹ --'}
                                </td>
                                <td className={classNames("px-6 py-4 text-sm text-gray-500 transition-all duration-200", isExpanded ? "whitespace-normal min-w-50" : "truncate max-w-37.5")}>
                                  {po.shipping_address || '--'}
                                </td>
                                <td className={classNames("px-6 py-4 text-sm text-gray-500 transition-all duration-200", isExpanded ? "whitespace-normal min-w-50" : "truncate max-w-37.5")}>
                                  {po.billing_address || '--'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <StatusBadge status={po.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap flex justify-center gap-3">
                                  <button 
                                    onClick={(e) => handleViewDocument(e, po.id, 'po')}
                                    className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-sm font-medium"
                                  >
                                    <DocumentTextIcon className="h-4 w-4" /> View PO
                                  </button>
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

              {/* --- ORDER HISTORY TAB --- */}
              {activeTab === 'Order History' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                    <h3 className="text-lg font-semibold text-gray-900">Complete Order History</h3>
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
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No order history available.</td></tr>
                        ) : (
                          purchaseOrders.map((po) => {
                            const isExpanded = expandedRow === po.id;
                            
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {po.total_amount ? `₹${po.total_amount.toFixed(2)}` : '₹ --'}
                                </td>
                                <td className={classNames("px-6 py-4 text-sm text-gray-500 transition-all duration-200", isExpanded ? "whitespace-normal min-w-50" : "truncate max-w-37.5")}>
                                  {po.shipping_address || '--'}
                                </td>
                                <td className={classNames("px-6 py-4 text-sm text-gray-500 transition-all duration-200", isExpanded ? "whitespace-normal min-w-50" : "truncate max-w-37.5")}>
                                  {po.billing_address || '--'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <StatusBadge status={po.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap flex justify-center gap-3">
                                  <button 
                                    onClick={(e) => handleViewDocument(e, po.id, 'po')}
                                    className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-sm font-medium"
                                  >
                                    <DocumentTextIcon className="h-4 w-4" /> View PO
                                  </button>
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
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}