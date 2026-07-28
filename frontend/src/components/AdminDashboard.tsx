import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems, Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react';
import { Bars3Icon, BellIcon, XMarkIcon, MagnifyingGlassIcon, EllipsisVerticalIcon, DocumentTextIcon, DocumentArrowDownIcon, CheckCircleIcon, TrashIcon, NoSymbolIcon, FunnelIcon, ArrowPathIcon, ClipboardDocumentListIcon, EyeIcon } from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

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
    colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  } else if (status === 'Invoiced') {
    colorClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
  } else if (status === 'Backordered' || status === 'Pending' || status === 'Unread') {
    colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
  } else if (status === 'Low Stock' || status === 'Out of Stock') {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
  } else if (status === 'Read') {
    colorClass = 'bg-blue-200 text-gray-800 border-gray-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {status || 'Unknown'}
    </span>
  );
};

const ActionBadge = ({ action }: { action: string }) => {
  let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
  if (action === 'CREATE' || action === 'APPROVE') colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  else if (action === 'UPDATE' || action === 'INVOICE') colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
  else if (action === 'DELETE' || action === 'REVOKE') colorClass = 'bg-red-100 text-red-800 border-red-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border ${colorClass}`}>
      {action}
    </span>
  );
};

export default function AdminDashboard({ handleLogout }: { handleLogout: () => void }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [allPOs, setAllPOs] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]); 
  const [activityLogs, setActivityLogs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const isDeepLink = useRef(false);
  
  // --- GLOBAL SEARCH & ADVANCED FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState('default');

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [expandedPoRow, setExpandedPoRow] = useState<number | null>(null);
  const [expandedLogRow, setExpandedLogRow] = useState<number | null>(null);

  const navigation = [
    { name: 'Dashboard' },
    { name: 'Inventory' },
    { name: 'Manage Customers' },
    { name: 'Purchase Orders' },
    { name: 'Notifications' },
    { name: 'Activity History' },
  ];

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

  const [customerToRevoke, setCustomerToRevoke] = useState<any>(null);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [isDeleteCustomerModalOpen, setIsDeleteCustomerModalOpen] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState('');
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  const [analytics, setAnalytics] = useState<any>(null);
  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']; 

  // --- NOTIFICATION STATES & HANDLERS ---
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:8000/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleNotificationClick = async (e: React.MouseEvent, notif: any, directRoute: boolean = true) => {
    e.stopPropagation();
    const token = localStorage.getItem("mswil_token");
    
    // Mark as read in backend if unread
    if (!notif.is_read && token) {
      try {
        await fetch(`http://localhost:8000/notifications/${notif.id}/read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    // Perform Deep Routing
    if (directRoute) {
      isDeepLink.current = true;
      setStatusFilter('all');
      setStartDate('');
      setEndDate('');
      setSortConfig('default');

      // Regex to extract the entity ID from the notification text (e.g., matching "#5")
      const idMatch = notif.message.match(/#(\d+)/);
      const extractedId = idMatch ? idMatch[1] : '';

      if (notif.title.toLowerCase().includes("purchase order") || notif.title.toLowerCase().includes("invoice")) {
        setActiveTab("Purchase Orders");
        if (extractedId) {
          setSearchQuery(extractedId);
          setSearchScope('id');
        }
      } else if (notif.title.toLowerCase().includes("registration") || notif.title.toLowerCase().includes("account")) {
        setActiveTab("Manage Customers");
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
      await fetch("http://localhost:8000/notifications/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

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
  }, [activeTab]);

  const clearFilters = () => {
    setSearchQuery('');
    setSearchScope('all');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setSortConfig('default');
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('tr')) {
        setExpandedRow(null);
        setExpandedPoRow(null);
        setExpandedLogRow(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;

    try {
      const invRes = await fetch("http://localhost:8000/inventory", { headers: { Authorization: `Bearer ${token}` }});
      if (invRes.ok) setInventory((await invRes.json()).sort((a: any, b: any) => a.item_code - b.item_code));

      const poRes = await fetch("http://localhost:8000/purchase-orders", { headers: { Authorization: `Bearer ${token}` }});
      if (poRes.ok) {
        const sortedPOs = (await poRes.json()).sort((a: any, b: any) => b.id - a.id);
        setAllPOs(sortedPOs);
        setRecentPOs(sortedPOs.slice(0, 3)); 
      }
      const analyticsRes = await fetch("http://localhost:8000/admin/analytics", { headers: { Authorization: `Bearer ${token}` } });
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (error) { console.error("Failed to fetch dashboard data:", error); } 
    finally { setLoading(false); }
  };

  // Fetch initial notifications and set up polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCustomers = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/admin/customers", { headers: { Authorization: `Bearer ${token}` }});
      if (res.ok) setCustomersList(await res.json());
    } catch (error) { console.error("Failed to fetch customers:", error); }
  };

  const fetchActivityLogs = async () => {
    const token = localStorage.getItem("mswil_token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/admin/activity-logs", { headers: { Authorization: `Bearer ${token}` }});
      if (res.ok) setActivityLogs(await res.json());
    } catch (error) { console.error("Failed to fetch logs:", error); }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  useEffect(() => {
    if (activeTab === 'Manage Customers') fetchCustomers();
    if (activeTab === 'Activity History') fetchActivityLogs();
  }, [activeTab]);


  // ==========================================
  // SEARCH & FILTER ENGINE
  // ==========================================

  const filteredInventory = inventory.filter((item) => {
    if (statusFilter === 'in_stock' && item.quantity <= 0) return false;
    if (statusFilter === 'out_of_stock' && item.quantity > 0) return false;

    const q = searchQuery.toLowerCase().trim().replace('#', '');
    if (!q) return true;

    if (searchScope === 'code') return item.item_code?.toString() === q;
    if (searchScope === 'name') return item.item_name?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    
    return (item.item_code?.toString() === q || item.serial_number?.toLowerCase().includes(q) || item.item_name?.toLowerCase().includes(q));
  });

  let filteredCustomers = customersList.filter((c) => {
    if (statusFilter === 'approved' && !c.is_approved) return false;
    if (statusFilter === 'pending' && c.is_approved) return false;

    const q = searchQuery.toLowerCase().trim().replace('#', '');
    if (!q) return true;

    if (searchScope === 'id') return c.id?.toString() === q;
    if (searchScope === 'name') return c.name?.toLowerCase().includes(q);
    if (searchScope === 'org') return c.organization?.toLowerCase().includes(q);
    if (searchScope === 'email') return c.email?.toLowerCase().includes(q);

    return (c.id?.toString() === q || c.name?.toLowerCase().includes(q) || c.organization?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  });

  if (sortConfig === 'org_asc') filteredCustomers.sort((a, b) => (a.organization || '').localeCompare(b.organization || ''));
  else if (sortConfig === 'org_desc') filteredCustomers.sort((a, b) => (b.organization || '').localeCompare(a.organization || ''));

  const applyPOFilters = (poList: any[]) => {
    let result = poList.filter((po) => {
      if (statusFilter !== 'all' && po.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;

      const q = searchQuery.toLowerCase().trim().replace('#', '');
      let matchesSearch = true;

      if (q) {
        if (searchScope === 'id') matchesSearch = po.id?.toString() === q;
        else if (searchScope === 'org') matchesSearch = po.organization_name?.toLowerCase().includes(q);
        else if (searchScope === 'name') matchesSearch = po.customer_name?.toLowerCase().includes(q);
        else if (searchScope === 'admin') matchesSearch = po.invoiced_by_name?.toLowerCase().includes(q);
        else matchesSearch = (po.id?.toString() === q || po.organization_name?.toLowerCase().includes(q) || po.customer_name?.toLowerCase().includes(q) || po.status?.toLowerCase().includes(q) || po.invoiced_by_name?.toLowerCase().includes(q));
      }

      let matchesDate = true;
      if (po.created_at && (startDate || endDate)) {
        const poDate = new Date(po.created_at).toISOString().split('T')[0];
        if (startDate) matchesDate = matchesDate && (poDate >= startDate);
        if (endDate) matchesDate = matchesDate && (poDate <= endDate);
      }
      return matchesSearch && matchesDate;
    });

    if (sortConfig === 'org_asc') result.sort((a, b) => (a.organization_name || '').localeCompare(b.organization_name || ''));
    else if (sortConfig === 'org_desc') result.sort((a, b) => (b.organization_name || '').localeCompare(a.organization_name || ''));
    
    return result;
  };

  const filteredPOs = applyPOFilters(allPOs);
  const filteredRecentPOs = applyPOFilters(recentPOs);

  const filteredLogs = activityLogs.filter((log) => {
    if (statusFilter !== 'all' && log.action_type?.toLowerCase() !== statusFilter.toLowerCase()) return false;

    const q = searchQuery.toLowerCase().trim().replace('#', '');
    let matchesSearch = true;

    if (q) {
      if (searchScope === 'admin') matchesSearch = log.admin_name?.toLowerCase().includes(q) || log.admin_email?.toLowerCase().includes(q);
      else if (searchScope === 'entity') matchesSearch = log.entity_type?.toLowerCase().includes(q) || log.entity_id?.toString().toLowerCase().includes(q);
      else matchesSearch = (log.admin_name?.toLowerCase().includes(q) || log.entity_type?.toLowerCase().includes(q) || log.entity_id?.toString().toLowerCase().includes(q));
    }

    let matchesDate = true;
    if (log.timestamp && (startDate || endDate)) {
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      if (startDate) matchesDate = matchesDate && (logDate >= startDate);
      if (endDate) matchesDate = matchesDate && (logDate <= endDate);
    }
    return matchesSearch && matchesDate;
  });

  const filteredNotifications = notifications.filter((notif) => {
    if (statusFilter === 'unread' && notif.is_read) return false;
    if (statusFilter === 'read' && !notif.is_read) return false;

    let matchesDate = true;
    if (notif.created_at && (startDate || endDate)) {
      const notifDate = new Date(notif.created_at).toISOString().split('T')[0];
      if (startDate) matchesDate = matchesDate && (notifDate >= startDate);
      if (endDate) matchesDate = matchesDate && (notifDate <= endDate);
    }
    return matchesDate;
  });

  // --- LOG DEEP LINK NAVIGATION HANDLER ---
  const handleLogDetailsNavigation = (e: React.MouseEvent, log: any) => {
    e.stopPropagation(); 

    isDeepLink.current = true;
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setSortConfig('default');
    setSearchQuery(log.entity_id.toString());

    if (log.entity_type === 'InventoryItem') {
      setActiveTab('Inventory');
      setSearchScope('code');
    } else if (log.entity_type === 'User') {
      setActiveTab('Manage Customers');
      setSearchScope('id');
    } else if (log.entity_type === 'PurchaseOrder') {
      setActiveTab('Purchase Orders');
      setSearchScope('id');
    }
  };


  // --- HANDLERS ---
  const handleApproveUser = async (userId: number) => {
    const token = localStorage.getItem("mswil_token");
    try {
      const res = await fetch(`http://localhost:8000/admin/approve-user/${userId}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }});
      if (res.ok) fetchCustomers();
      else alert((await res.json()).detail || "Failed to approve customer.");
    } catch (error) { alert("Network error."); }
  };

  const confirmRevokeUser = async () => {
    setIsRevoking(true);
    const token = localStorage.getItem("mswil_token");
    try {
      const res = await fetch(`http://localhost:8000/admin/revoke-user/${customerToRevoke.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }});
      if (res.ok) { fetchCustomers(); setIsRevokeModalOpen(false); }
      else alert((await res.json()).detail || "Failed to revoke customer access.");
    } catch (error) { alert("Network error."); } 
    finally { setIsRevoking(false); }
  };

  const confirmDeleteUser = async () => {
    setDeleteCustomerError('');
    setIsDeletingCustomer(true);
    const token = localStorage.getItem("mswil_token");
    try {
      const res = await fetch(`http://localhost:8000/admin/users/${customerToDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }});
      if (res.ok) { setCustomersList(prev => prev.filter(u => u.id !== customerToDelete.id)); setIsDeleteCustomerModalOpen(false); }
      else setDeleteCustomerError((await res.json()).detail || "Failed to delete customer.");
    } catch (error) { setDeleteCustomerError("Network error."); } 
    finally { setIsDeletingCustomer(false); }
  };

  const handleViewDocument = async (e: React.MouseEvent, poId: number, docType: 'po' | 'invoice') => {
    e.stopPropagation();
    const token = localStorage.getItem("mswil_token");
    if (!token) return;
    try {
      const response = await fetch(`http://localhost:8000/purchase-orders/${poId}/download?doc_type=${docType}`, { method: "GET", headers: { Authorization: `Bearer ${token}` }});
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else alert("Document not available or endpoint error.");
    } catch (error) { console.error("Error downloading document:", error); }
  };

  const handleGenerateInvoice = async (e: React.MouseEvent, poId: number) => {
    e.stopPropagation();
    const token = localStorage.getItem("mswil_token");
    if (!token) return;
    try {
      const response = await fetch(`http://localhost:8000/admin/purchase-orders/${poId}/invoice`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }});
      if (response.ok) await fetchDashboardData(); 
      else alert((await response.json()).detail || "Failed to generate invoice.");
    } catch (error) { alert("Network error. Could not connect to the server."); }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setIsSubmitting(true);
    const token = localStorage.getItem("mswil_token");
    try {
      const response = await fetch("http://localhost:8000/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
        setInventory((prev) => [...prev, addedData].sort((a, b) => a.item_code - b.item_code));
        setIsAddModalOpen(false);
        setNewItem({ item_code: '', item_name: '', serial_number: '', price: '', quantity: '', description: '' });
      } else setAddError((await response.json()).detail || "Failed to add inventory item.");
    } catch (error) { setAddError("Network error. Could not connect to the server."); } 
    finally { setIsSubmitting(false); }
  };

  const [editItem, setEditItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const openEditModal = (item: any) => { setEditItem({ ...item }); setEditError(''); setIsEditModalOpen(true); };
  const openDeleteModal = (item: any) => { setItemToDelete(item); setDeleteError(''); setIsDeleteModalOpen(true); };

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
        setInventory((prev) => prev.map((item) => (item.item_code === updatedData.item_code ? updatedData : item)).sort((a, b) => a.item_code - b.item_code));
        setIsEditModalOpen(false);
      } else setEditError((await response.json()).detail || "Failed to update item.");
    } catch (error) { setEditError("Network error. Could not connect to the server."); } 
    finally { setIsEditing(false); }
  };

  const handleDeleteItem = async () => {
    setDeleteError('');
    setIsDeleting(true);
    const token = localStorage.getItem("mswil_token");
    try {
      const response = await fetch(`http://localhost:8000/inventory/${itemToDelete.item_code}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }});
      if (response.ok) {
        setInventory((prev) => prev.filter((item) => item.item_code !== itemToDelete.item_code));
        setIsDeleteModalOpen(false);
      } else setDeleteError((await response.json()).detail || "Failed to delete item.");
    } catch (error) { setDeleteError("Network error."); } 
    finally { setIsDeleting(false); }
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
                  
                  {/* DYNAMIC NOTIFICATION BELL DROPDOWN */}
                  <Menu as="div" className="relative ml-3">
                    <MenuButton className="relative rounded-full p-1 text-indigo-200 hover:text-white focus:outline-none">
                      <span className="sr-only">View notifications</span>
                      <BellIcon aria-hidden="true" className="size-6" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-indigo-600">
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
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-xs text-gray-500 font-medium">
                            No notifications recorded yet.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <MenuItem key={n.id}>
                              {({ active }) => (
                                <div
                                  onClick={(e) => handleNotificationClick(e, n, true)}
                                  className={classNames(
                                    active ? 'bg-indigo-50/60' : '',
                                    !n.is_read ? 'bg-indigo-50/30' : 'bg-white',
                                    'px-4 py-3 cursor-pointer transition-colors flex items-start gap-3'
                                  )}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    <span
                                      className={classNames(
                                        'inline-block size-2 rounded-full',
                                        !n.is_read ? 'bg-indigo-600' : 'bg-transparent'
                                      )}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <p className={classNames('text-xs font-bold', !n.is_read ? 'text-indigo-950' : 'text-gray-700')}>
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
                      
                      {/* VIEW ALL FOOTER */}
                      <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                        <button 
                          onClick={() => setActiveTab('Notifications')}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          View all notifications
                        </button>
                      </div>

                    </MenuItems>
                  </Menu>

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
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">{activeTab}</h1>
            
            {/* THE COMPOSITE SEARCH BAR */}
            <div className="w-full lg:w-auto">
              {activeTab !== 'Notifications' && (
                <div className="flex rounded-md shadow-sm w-full lg:min-w-[500px]">
                  {activeTab !== 'Dashboard' && (
                    <select
                      value={searchScope}
                      onChange={(e) => setSearchScope(e.target.value)}
                      className="bg-indigo-700/80 text-indigo-100 border-r border-indigo-500/50 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:bg-indigo-800 transition-colors font-medium cursor-pointer"
                    >
                      <option value="all">All Fields</option>
                      {activeTab === 'Inventory' && (
                        <>
                          <option value="code">Item Code</option>
                          <option value="name">Name / Desc</option>
                        </>
                      )}
                      {activeTab === 'Manage Customers' && (
                        <>
                          <option value="id">User ID</option>
                          <option value="name">Name</option>
                          <option value="org">Organization</option>
                          <option value="email">Email</option>
                        </>
                      )}
                      {activeTab === 'Purchase Orders' && (
                        <>
                          <option value="id">PO ID</option>
                          <option value="org">Organization</option>
                          <option value="name">Customer Name</option>
                          <option value="admin">Invoiced By</option>
                        </>
                      )}
                      {activeTab === 'Activity History' && (
                        <>
                          <option value="admin">Admin Name/Email</option>
                          <option value="entity">Target ID/Type</option>
                        </>
                      )}
                    </select>
                  )}
                  
                  <div className="relative flex-grow">
                    <MagnifyingGlassIcon className={`absolute left-3 top-2.5 h-5 w-5 text-indigo-300 ${activeTab !== 'Dashboard' ? 'hidden sm:block' : ''}`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${activeTab.toLowerCase()}...`}
                      className={`w-full bg-indigo-500/40 border border-transparent text-white placeholder-indigo-200 py-2 pr-3 focus:outline-none focus:bg-indigo-500 focus:ring-2 focus:ring-indigo-300 transition-colors sm:text-sm ${activeTab !== 'Dashboard' ? 'rounded-r-md pl-3 sm:pl-10' : 'rounded-md pl-10'}`}
                    />
                  </div>
                </div>
              )}
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
                <div className="space-y-6">
                  
                  <div className="grid grid-cols-1 gap-6 items-start lg:grid-cols-3 lg:gap-8">
                    {/* Left Card: Live Inventory */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                        <h3 className="text-lg font-semibold text-gray-900">Live Inventory</h3>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setActiveTab('Inventory')} 
                            className="text-sm bg-indigo-100 text-indigo-600 px-4 py-2 rounded-md font-medium hover:bg-indigo-200 hover:text-indigo-800 transition-colors shadow-sm"
                          >
                            Manage
                          </button>
                          <button 
                            onClick={() => { setActiveTab('Inventory'); setIsAddModalOpen(true); }}
                            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            + Add Item
                          </button>
                        </div>
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
                            {filteredInventory.length === 0 ? (
                              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                {searchQuery ? `No items match "${searchQuery}"` : 'No inventory items found.'}
                              </td></tr>
                            ) : (
                              filteredInventory.slice(0, 5).map((item) => (
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
                          {filteredRecentPOs.length === 0 ? (
                            <li className="p-6 text-center text-gray-500 text-sm">
                              {searchQuery ? `No orders match "${searchQuery}"` : 'No recent orders.'}
                            </li>
                          ) : (
                            filteredRecentPOs.slice(0, 3).map((po) => {
                              const isPOInvoiced = po.status === 'Invoiced';
                              const displayTotal = isPOInvoiced ? po.total_amount * 1.18 : po.total_amount;

                              return (
                                <li key={po.id} className="p-6 hover:bg-gray-50 transition flex flex-col gap-2">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-gray-900">Order #{po.id}</span>
                                      <span className="text-xs text-gray-400">
                                        • {po.created_at ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(po.created_at)) : '--'}
                                      </span>
                                    </div>
                                    <StatusBadge status={po.status} />
                                  </div>

                                  <div className="flex justify-between items-start text-sm mt-1">
                                    <div>
                                      <div className="font-bold text-gray-800">{po.organization_name || 'Individual Customer'}</div>
                                      <div className="text-xs text-gray-500">{po.customer_name || `Customer #${po.customer_id}`}</div>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-black text-gray-900 text-base">
                                        {po.total_amount ? `₹${displayTotal.toFixed(2)}` : '₹ --'}
                                      </span>
                                      <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                        {isPOInvoiced ? 'Incl. of GST (18%)' : 'Excl. of GST'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-100">
                                    <button 
                                      onClick={(e) => handleViewDocument(e, po.id, 'po')}
                                      className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-xs font-medium"
                                    >
                                      <DocumentTextIcon className="h-3.5 w-3.5" /> View PO
                                    </button>
                                    
                                    {po.status === 'Approved' && (
                                      <button 
                                        onClick={(e) => handleGenerateInvoice(e, po.id)}
                                        className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded font-bold transition shadow-sm border border-emerald-200"
                                      >
                                        Generate Invoice
                                      </button>
                                    )}

                                    {po.status === 'Invoiced' && (
                                      <button 
                                        onClick={(e) => handleViewDocument(e, po.id, 'invoice')}
                                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-xs font-medium"
                                      >
                                        <DocumentArrowDownIcon className="h-3.5 w-3.5" /> Invoice
                                      </button>
                                    )}
                                  </div>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  {analytics && (
                    <>
                      {/* KPI CARDS */}
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Revenue */}
                        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 p-5">
                          <dt className="truncate text-sm font-medium text-gray-500 uppercase tracking-wider">YTD Revenue</dt>
                          <dd className="mt-1 text-3xl font-black tracking-tight text-gray-900">₹{analytics.kpis.revenue_ytd.toLocaleString()}</dd>
                          <div className="mt-2 text-xs text-indigo-600 font-semibold">MTD: ₹{analytics.kpis.revenue_mtd.toLocaleString()}</div>
                        </div>
                        
                        {/* Pending POs */}
                        <div 
                          onClick={() => { isDeepLink.current = true; setActiveTab('Purchase Orders'); setStatusFilter('pending'); }}
                          className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-orange-300 hover:ring-1 hover:ring-orange-300 transition group"
                        >
                          <dt className="truncate text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-orange-600">Pending Approvals</dt>
                          <dd className="mt-1 text-3xl font-black tracking-tight text-gray-900">{analytics.kpis.pending_count}</dd>
                          <div className="mt-2 text-xs text-orange-600 font-semibold">Pipeline: ₹{analytics.kpis.pending_value.toLocaleString()}</div>
                        </div>

                        {/* Backordered POs */}
                        <div 
                          onClick={() => { isDeepLink.current = true; setActiveTab('Purchase Orders'); setStatusFilter('backordered'); }}
                          className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-red-300 hover:ring-1 hover:ring-red-300 transition group"
                        >
                          <dt className="truncate text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-red-600">Backordered</dt>
                          <dd className="mt-1 text-3xl font-black tracking-tight text-gray-900">{analytics.kpis.backordered_count}</dd>
                          <div className="mt-2 text-xs text-red-600 font-semibold">Pipeline: ₹{analytics.kpis.backordered_value.toLocaleString()}</div>
                        </div>

                        {/* Action Items */}
                        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
                          <div 
                            onClick={() => { isDeepLink.current = true; setActiveTab('Inventory'); setStatusFilter('out_of_stock'); }}
                            className="flex justify-between items-center cursor-pointer group pb-2 border-b border-gray-100"
                          >
                            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-red-600">Low Stock Warnings</span>
                            <span className="font-bold text-gray-900 group-hover:text-red-600">{analytics.kpis.low_stock_count} Items</span>
                          </div>
                          <div 
                            onClick={() => { isDeepLink.current = true; setActiveTab('Manage Customers'); setStatusFilter('pending'); }}
                            className="flex justify-between items-center cursor-pointer group pt-2"
                          >
                            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider group-hover:text-indigo-600">Pending Users</span>
                            <span className="font-bold text-gray-900 group-hover:text-indigo-600">{analytics.kpis.pending_customers} Users</span>
                          </div>
                        </div>
                      </div>

                      {/* CHARTS ROW 1 */}
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Revenue Trend */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-base font-bold text-gray-900 mb-6">6-Month Revenue Trend (Invoiced)</h3>
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={analytics.charts.trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                <YAxis 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{ fontSize: 12, fill: '#6b7280' }} 
                                  tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`} 
                                />
                                <Tooltip 
                                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Status Distribution */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-base font-bold text-gray-900 mb-6">Order Status Distribution</h3>
                          <div className="h-72 w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={analytics.charts.status}
                                  innerRadius={70}
                                  outerRadius={100}
                                  paddingAngle={5}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  {analytics.charts.status.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute flex flex-col gap-2">
                              {analytics.charts.status.map((entry: any, index: number) => (
                                <div key={entry.name} className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                  <span className="text-xs font-semibold text-gray-700">{entry.name} ({entry.value})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CHARTS ROW 2 */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-6">Top 5 Fast-Moving Items</h3>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.charts.top_items} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} width={150} />
                              <Tooltip 
                                cursor={{fill: '#f3f4f6'}}
                                formatter={(value: any) => [`${value} Units Sold`, 'Volume']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* --- INVENTORY TAB --- */}
              {activeTab === 'Inventory' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">Inventory Data</h3>
                  </div>
                  {/* Secondary Filter Toolbar */}
                  <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FunnelIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">Status:</span>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm">
                        <option value="all">All Items</option>
                        <option value="in_stock">In Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      {(statusFilter !== 'all' || searchQuery) && (
                        <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-indigo-700 transition flex items-center gap-1 font-medium mr-2">
                          <ArrowPathIcon className="h-4 w-4" /> Clear Filters
                        </button>
                      )}
                      <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-md font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        + Add Item
                      </button>
                    </div>
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
                        {filteredInventory.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                            {searchQuery || statusFilter !== 'all' ? "No inventory items match your criteria." : 'No inventory items found.'}
                          </td></tr>
                        ) : (
                          filteredInventory.map((item) => {
                            const isExpanded = expandedRow === item.item_code;
                            
                            return (
                              <tr 
                                key={item.item_code} 
                                className={classNames(
                                  "hover:bg-gray-50 transition-colors cursor-pointer",
                                  isExpanded ? "bg-indigo-50/40" : ""
                                )}
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest('button')) return;
                                  setExpandedRow(isExpanded ? null : item.item_code);
                                }}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">#{item.item_code}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 uppercase tracking-wider">{item.serial_number || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{item.item_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">₹{item.price ? item.price.toFixed(2) : '0.00'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{item.quantity}</td>
                                
                                <td className={classNames(
                                  "px-6 py-4 text-sm text-gray-500 transition-all duration-200",
                                  isExpanded ? "whitespace-normal wrap-break-words min-w-[250px]" : "truncate max-w-xs"
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

              {/* --- MANAGE CUSTOMERS TAB --- */}
              {activeTab === 'Manage Customers' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">Manage Customers</h3>
                  </div>
                  {/* Secondary Filter Toolbar */}
                  <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-3">
                        <FunnelIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Status:</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm">
                          <option value="all">All Accounts</option>
                          <option value="approved">Approved</option>
                          <option value="pending">Pending / Revoked</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {(statusFilter !== 'all' || sortConfig !== 'default' || searchQuery) && (
                        <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-indigo-700 transition flex items-center gap-1 font-medium mr-2">
                          <ArrowPathIcon className="h-4 w-4" /> Clear Filters
                        </button>
                      )}
                      <span className="text-sm font-medium text-gray-500">Sort By:</span>
                      <select value={sortConfig} onChange={(e) => setSortConfig(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm">
                        <option value="default">Default</option>
                        <option value="org_asc">Organization (A-Z)</option>
                        <option value="org_desc">Organization (Z-A)</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Name</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Organization</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredCustomers.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            {searchQuery || statusFilter !== 'all' ? "No customers match your criteria." : "No customers registered yet."}
                          </td></tr>
                        ) : (
                          filteredCustomers.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-900">{c.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">User ID: #{c.id} &bull; Login: {c.username}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 font-medium">{c.organization}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <StatusBadge status={c.is_approved ? 'Approved' : 'Pending'} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap flex justify-center gap-2">
                                
                                {c.is_approved ? (
                                  <button 
                                    onClick={() => { setCustomerToRevoke(c); setIsRevokeModalOpen(true); }}
                                    className="text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 px-3 py-1.5 rounded font-medium transition inline-flex items-center gap-1 border border-orange-200"
                                  >
                                    <NoSymbolIcon className="h-4 w-4" /> Revoke
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleApproveUser(c.id)}
                                    className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded font-bold transition shadow-sm border border-emerald-200 inline-flex items-center gap-1"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" /> Approve
                                  </button>
                                )}
                                
                                <button 
                                  onClick={() => { setCustomerToDelete(c); setDeleteCustomerError(''); setIsDeleteCustomerModalOpen(true); }}
                                  className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded font-medium transition inline-flex items-center gap-1 border border-red-200"
                                >
                                  <TrashIcon className="h-4 w-4" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- PURCHASE ORDERS TAB (Detailed View) --- */}
              {activeTab === 'Purchase Orders' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">Manage Customer Purchase Orders</h3>
                  </div>
                  {/* Secondary Filter Toolbar */}
                  <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-3">
                        <FunnelIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Status:</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm">
                          <option value="all">All Orders</option>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="invoiced">Invoiced</option>
                          <option value="backordered">Backordered</option>
                        </select>
                      </div>
                      
                      <div className="hidden sm:block h-5 w-px bg-gray-300"></div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">From:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">To:</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(statusFilter !== 'all' || sortConfig !== 'default' || startDate || endDate || searchQuery) && (
                        <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-indigo-700 transition flex items-center gap-1 font-medium mr-2">
                          <ArrowPathIcon className="h-4 w-4" /> Clear Filters
                        </button>
                      )}
                      <span className="text-sm font-medium text-gray-500">Sort By:</span>
                      <select value={sortConfig} onChange={(e) => setSortConfig(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm">
                        <option value="default">Default (Newest)</option>
                        <option value="org_asc">Organization (A-Z)</option>
                        <option value="org_desc">Organization (Z-A)</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PO ID</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Organization</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shipping Address</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Address</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredPOs.length === 0 ? (
                          <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                            {searchQuery || startDate || endDate || statusFilter !== 'all' ? "No purchase orders match your criteria." : "No purchase orders recorded yet."}
                          </td></tr>
                        ) : (
                          filteredPOs.map((po) => {
                            const isExpanded = expandedPoRow === po.id;
                            const isPOInvoiced = po.status === 'Invoiced';
                            const displayTotal = isPOInvoiced ? po.total_amount * 1.18 : po.total_amount;

                            return (
                              <tr 
                                key={po.id} 
                                onClick={() => setExpandedPoRow(isExpanded ? null : po.id)}
                                className={classNames("hover:bg-gray-50 transition-colors cursor-pointer", isExpanded ? "bg-indigo-50/30" : "")}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {po.created_at ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(po.created_at)) : '--'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">#{po.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-bold text-gray-800">{po.organization_name || 'N/A'}</div>
                                  <div className="text-xs text-gray-500">{po.customer_name || `User #${po.customer_id}`}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {po.total_amount ? `₹${displayTotal.toFixed(2)}` : '₹ --'}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                    {isPOInvoiced ? 'Incl. of GST (18%)' : 'Excl. of GST'}
                                  </div>
                                  {/* THE INVOICE TRACKER DISPLAY */}
                                  {isPOInvoiced && po.invoiced_by_name && (
                                    <div className="text-[10px] text-indigo-500 font-semibold mt-0.5">
                                      Invoiced by {po.invoiced_by_name}
                                    </div>
                                  )}
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
                                <td className="px-6 py-4 whitespace-nowrap flex justify-center gap-2">
                                  
                                  <button 
                                    onClick={(e) => handleViewDocument(e, po.id, 'po')}
                                    className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-xs font-medium"
                                  >
                                    <DocumentTextIcon className="h-4 w-4" /> PO PDF
                                  </button>

                                  {po.status === 'Approved' && (
                                    <button 
                                      onClick={(e) => handleGenerateInvoice(e, po.id)}
                                      className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded font-bold transition shadow-sm"
                                    >
                                      Generate Invoice
                                    </button>
                                  )}

                                  {po.status === 'Invoiced' && (
                                    <button 
                                      onClick={(e) => handleViewDocument(e, po.id, 'invoice')}
                                      className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded transition inline-flex items-center gap-1 text-xs font-medium"
                                    >
                                      <DocumentArrowDownIcon className="h-3.5 w-3.5" /> Invoice
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

              {/* --- DEDICATED NOTIFICATIONS TAB --- */}
              {activeTab === 'Notifications' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                  <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <BellIcon className="h-5 w-5 text-indigo-600" /> Notification Center
                    </h3>
                  </div>
                  
                  {/* Filter Toolbar for Notifications */}
                  <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-3">
                        <FunnelIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Status:</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm">
                          <option value="all">All Alerts</option>
                          <option value="unread">Unread Only</option>
                          <option value="read">Read</option>
                        </select>
                      </div>
                      
                      <div className="hidden sm:block h-5 w-px bg-gray-300"></div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">From:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">To:</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(statusFilter !== 'all' || startDate || endDate) && (
                        <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-indigo-700 transition flex items-center gap-1 font-medium mr-2">
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
                        {filteredNotifications.length === 0 ? (
                          <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            {startDate || endDate || statusFilter !== 'all' ? "No notifications match your filters." : "No notifications recorded yet."}
                          </td></tr>
                        ) : (
                          filteredNotifications.map((notif) => {
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
                                  <div className={classNames("text-sm", !notif.is_read ? "font-bold text-indigo-900" : "font-medium text-gray-800")}>
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
                                    className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold transition shadow-sm border border-indigo-200 inline-flex items-center gap-1"
                                  >
                                    <EyeIcon className="h-4 w-4" /> View Details
                                  </button>
                                  {!notif.is_read && (
                                    <button 
                                      onClick={(e) => handleNotificationClick(e, notif, false)}
                                      className="text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded font-medium transition inline-flex items-center gap-1 border border-gray-200"
                                    >
                                      Mark As Read
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

              {/* --- ACTIVITY HISTORY TAB (AUDIT LOGS) --- */}
              {activeTab === 'Activity History' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
                  <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" /> Administrative Audit Trail
                    </h3>
                  </div>
                  
                  {/* Filter Toolbar for Logs */}
                  <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="flex items-center gap-3">
                        <FunnelIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-500">Action:</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm">
                          <option value="all">All Actions</option>
                          <option value="create">CREATE</option>
                          <option value="update">UPDATE</option>
                          <option value="delete">DELETE</option>
                          <option value="approve">APPROVE</option>
                          <option value="revoke">REVOKE</option>
                          <option value="invoice">INVOICE</option>
                        </select>
                      </div>
                      
                      <div className="hidden sm:block h-5 w-px bg-gray-300"></div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">From:</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">To:</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border border-gray-300 rounded-md py-1.5 px-3 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white shadow-sm" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {(statusFilter !== 'all' || startDate || endDate || searchQuery) && (
                        <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-indigo-700 transition flex items-center gap-1 font-medium mr-2">
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
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Snapshot</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Target Entity</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity ID</th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredLogs.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            {searchQuery || startDate || endDate || statusFilter !== 'all' ? "No activity logs match your criteria." : "No activity recorded yet."}
                          </td></tr>
                        ) : (
                          filteredLogs.map((log) => {
                            const isExpanded = expandedLogRow === log.id;
                            const hasDelta = log.action_type === 'UPDATE' && log.changes && Object.keys(log.changes).length > 0;
                            
                            return (
                              <Fragment key={log.id}>
                                <tr 
                                  onClick={() => hasDelta && setExpandedLogRow(isExpanded ? null : log.id)}
                                  className={classNames("transition-colors", hasDelta ? "hover:bg-indigo-50/50 cursor-pointer" : "", isExpanded ? "bg-indigo-50/30" : "")}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-900">
                                      {log.timestamp ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(log.timestamp)) : '--'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-medium tracking-wide uppercase mt-0.5">
                                      {log.timestamp ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(log.timestamp)) : ''}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-800">{log.admin_name}</div>
                                    <div className="text-xs text-gray-500">{log.admin_email}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <ActionBadge action={log.action_type} />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                                    {log.entity_type}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-indigo-600">#{log.entity_id}</div>
                                    {hasDelta && (
                                      <div className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                                        Click row to view changes
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap flex justify-center">
                                    <button 
                                      onClick={(e) => handleLogDetailsNavigation(e, log)}
                                      className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold transition shadow-sm border border-indigo-200 inline-flex items-center gap-1"
                                    >
                                      <EyeIcon className="h-4 w-4" /> View Details
                                    </button>
                                  </td>
                                </tr>
                                
                                {/* THE DELTA JSON DROPDOWN */}
                                {isExpanded && hasDelta && (
                                  <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <td colSpan={6} className="px-6 py-6">
                                      <div className="max-w-3xl border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                          Data Modifications (Delta)
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                          {Object.entries(log.changes).map(([field, vals]: [string, any]) => (
                                            <div key={field} className="px-4 py-3 flex items-center gap-6">
                                              <div className="w-1/4 text-sm font-semibold text-gray-700 capitalize">{field.replace('_', ' ')}</div>
                                              <div className="w-3/4 flex items-center gap-4 text-sm">
                                                <span className="px-3 py-1 bg-red-50 text-red-700 rounded border border-red-100 line-through decoration-red-300">
                                                  {String(vals.old || 'Null')}
                                                </span>
                                                <span className="text-gray-400">➔</span>
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 font-medium">
                                                  {String(vals.new || 'Null')}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
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

      {/* --- ADD ITEM MODAL OVERLAY --- */}
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

      {/* --- REVOKE CUSTOMER MODAL --- */}
      <Dialog open={isRevokeModalOpen} onClose={() => setIsRevokeModalOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              {customerToRevoke && (
                <>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <DialogTitle as="h3" className="text-lg font-bold leading-6 text-gray-900 mb-2">
                      Revoke Customer Access
                    </DialogTitle>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Are you sure you want to temporarily suspend <strong className="text-gray-900">{customerToRevoke.name}</strong>?</p>
                      <p><strong className="text-gray-900">Customer Details:</strong> <br />Organization: <strong className="text-gray-900">{customerToRevoke.organization}</strong> <br />
                      Email: <strong className="text-gray-900">{customerToRevoke.email}</strong> &bull; Login: <strong className="text-gray-900">{customerToRevoke.username}</strong></p>
                      <p className="mt-2 text-orange-600 font-medium">This will immediately block their ability to log in and submit purchase orders. You can re-approve them at any time.</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button type="button" onClick={confirmRevokeUser} disabled={isRevoking} className="inline-flex w-full justify-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:ml-3 sm:w-auto disabled:opacity-50">
                      {isRevoking ? 'Revoking...' : 'Yes, Revoke Access'}
                    </button>
                    <button type="button" onClick={() => setIsRevokeModalOpen(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* --- DELETE CUSTOMER MODAL --- */}
      <Dialog open={isDeleteCustomerModalOpen} onClose={() => setIsDeleteCustomerModalOpen(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              {customerToDelete && (
                <>
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <DialogTitle as="h3" className="text-lg font-bold leading-6 text-gray-900 mb-2">
                      Permanently Delete Customer
                    </DialogTitle>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Are you sure you want to permanently delete <strong className="text-gray-900">{customerToDelete.name}</strong>?</p>
                      <p><strong className="text-gray-900">Customer Details:</strong> <br />Organization: <strong className="text-gray-900">{customerToDelete.organization}</strong> <br />
                      Email: <strong className="text-gray-900">{customerToDelete.email}</strong> &bull; Login: <strong className="text-gray-900">{customerToDelete.username}</strong></p>
                      <p className="mt-2 text-red-600 font-medium">This action cannot be undone. If this customer has existing Purchase Orders, you must use "Revoke" instead to preserve the database integrity.</p>
                    </div>
                    {deleteCustomerError && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-md border border-red-200">{deleteCustomerError}</div>}
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button type="button" onClick={confirmDeleteUser} disabled={isDeletingCustomer} className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto disabled:opacity-50">
                      {isDeletingCustomer ? 'Deleting...' : 'Yes, Permanently Delete'}
                    </button>
                    <button type="button" onClick={() => setIsDeleteCustomerModalOpen(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">
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