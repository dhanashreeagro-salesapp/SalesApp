import React, { useState, useMemo } from "react";
import { Users, Search, Edit3, Plus, Shield, Layers, Calendar, Check, AlertTriangle, X, UserCheck } from "lucide-react";
import { UserProfile, CustomerMaster, CustomerAssignment, AssignmentAuditLog } from "../types";

interface CustomerAssignmentsPanelProps {
  currentUser: UserProfile;
  users: UserProfile[];
  customers: CustomerMaster[];
  assignments: CustomerAssignment[];
  assignmentAuditLogs: AssignmentAuditLog[];
  onSaveCustomer: (customer: any) => Promise<any>;
  onSaveAssignments: (customerId: string, customerName: string, assignments: any[], adminUser: string) => Promise<any>;
}

export default function CustomerAssignmentsPanel({
  currentUser,
  users,
  customers,
  assignments,
  assignmentAuditLogs,
  onSaveCustomer,
  onSaveAssignments,
}: CustomerAssignmentsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMode, setActiveMode] = useState<"directory" | "audits">("directory");
  
  // Modals state
  const [editingCustomer, setEditingCustomer] = useState<CustomerMaster | null>(null);
  const [editingAllocations, setEditingAllocations] = useState<{
    customer: CustomerMaster;
    allocs: { user_id: string; allocation_percentage: number; is_active: boolean }[];
  } | null>(null);
  
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for Customer Master Details
  const [cmName, setCmName] = useState("");
  const [cmGst, setCmGst] = useState("");
  const [cmPerson, setCmPerson] = useState("");
  const [cmNumber, setCmNumber] = useState("");
  const [cmEmail, setCmEmail] = useState("");
  const [cmAddress, setCmAddress] = useState("");
  const [cmCity, setCmCity] = useState("");
  const [cmState, setCmState] = useState("");
  const [cmStatus, setCmStatus] = useState<"Active" | "Inactive">("Active");

  // User list sorted for drop downs
  const salesUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Map user ID to UserProfile for fast lookups
  const userMap = useMemo(() => {
    return new Map(users.map(u => [u.id, u]));
  }, [users]);

  // Aggregate current allocations per customer
  const customerAllocationsMap = useMemo(() => {
    const map = new Map<string, { user_id: string; allocation_percentage: number }[]>();
    assignments.forEach(a => {
      if (!a.is_active) return;
      const current = map.get(a.customer_id) || [];
      current.push({ user_id: a.user_id, allocation_percentage: Number(a.allocation_percentage) || 0 });
      map.set(a.customer_id, current);
    });
    return map;
  }, [assignments]);

  // Search filter
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase().replace(/[\s\-_]/g, "");
    if (!query) return customers;

    return customers.filter(c => {
      const name = c.customer_name.toLowerCase().replace(/[\s\-_]/g, "");
      const city = (c.city || "").toLowerCase().replace(/[\s\-_]/g, "");
      const state = (c.state || "").toLowerCase().replace(/[\s\-_]/g, "");
      const gst = (c.gst_number || "").toLowerCase().replace(/[\s\-_]/g, "");

      // Match assignments
      const customerAllocs = customerAllocationsMap.get(c.id) || [];
      const hasSalespersonMatch = customerAllocs.some(a => {
        const u = userMap.get(a.user_id);
        return u && u.name.toLowerCase().replace(/[\s\-_]/g, "").includes(query);
      });

      return name.includes(query) || city.includes(query) || state.includes(query) || gst.includes(query) || hasSalespersonMatch;
    });
  }, [customers, searchQuery, customerAllocationsMap, userMap]);

  // Opening the customer detail form
  const handleOpenEditCustomer = (c: CustomerMaster) => {
    setEditingCustomer(c);
    setCmName(c.customer_name);
    setCmGst(c.gst_number || "");
    setCmPerson(c.contact_person || "");
    setCmNumber(c.contact_number || "");
    setCmEmail(c.email || "");
    setCmAddress(c.address || "");
    setCmCity(c.city || "");
    setCmState(c.state || "");
    setCmStatus(c.status);
    setErrorMsg(null);
  };

  const handleOpenCreateCustomer = () => {
    setIsCreatingCustomer(true);
    setCmName("");
    setCmGst("");
    setCmPerson("");
    setCmNumber("");
    setCmEmail("");
    setCmAddress("");
    setCmCity("");
    setCmState("");
    setCmStatus("Active");
    setErrorMsg(null);
  };

  const handleSaveCustomerMasterForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmName.trim()) {
      setErrorMsg("Customer name is required.");
      return;
    }

    const payload = {
      id: editingCustomer?.id,
      customer_name: cmName.trim(),
      gst_number: cmGst.trim(),
      contact_person: cmPerson.trim(),
      contact_number: cmNumber.trim(),
      email: cmEmail.trim(),
      address: cmAddress.trim(),
      city: cmCity.trim(),
      state: cmState.trim(),
      status: cmStatus
    };

    try {
      setErrorMsg(null);
      await onSaveCustomer(payload);
      setSuccessMsg(`Customer "${payload.customer_name}" saved successfully.`);
      setEditingCustomer(null);
      setIsCreatingCustomer(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save customer master details.");
    }
  };

  // Allocations Editing Logic
  const handleOpenEditAllocations = (c: CustomerMaster) => {
    const existing = assignments.filter(a => a.customer_id === c.id);
    let initialAllocs = existing.map(a => ({
      user_id: a.user_id,
      allocation_percentage: Number(a.allocation_percentage) || 0,
      is_active: a.is_active
    }));

    if (initialAllocs.length === 0) {
      // Default placeholder allocation if empty
      initialAllocs = [{ user_id: salesUsers[0]?.id || "", allocation_percentage: 100, is_active: true }];
    }

    setEditingAllocations({
      customer: c,
      allocs: initialAllocs
    });
    setErrorMsg(null);
  };

  const handleAddAllocationRow = () => {
    if (!editingAllocations) return;
    setEditingAllocations({
      ...editingAllocations,
      allocs: [...editingAllocations.allocs, { user_id: salesUsers[0]?.id || "", allocation_percentage: 0, is_active: true }]
    });
  };

  const handleRemoveAllocationRow = (index: number) => {
    if (!editingAllocations) return;
    const list = [...editingAllocations.allocs];
    list.splice(index, 1);
    setEditingAllocations({
      ...editingAllocations,
      allocs: list
    });
  };

  const handleAllocationFieldChange = (index: number, field: string, value: any) => {
    if (!editingAllocations) return;
    const list = [...editingAllocations.allocs];
    list[index] = {
      ...list[index],
      [field]: value
    };
    setEditingAllocations({
      ...editingAllocations,
      allocs: list
    });
  };

  const totalAllocationSum = useMemo(() => {
    if (!editingAllocations) return 0;
    return editingAllocations.allocs.reduce((sum, a) => sum + (Number(a.allocation_percentage) || 0), 0);
  }, [editingAllocations]);

  const handleSaveAllocationsForm = async () => {
    if (!editingAllocations) return;

    if (totalAllocationSum !== 100) {
      setErrorMsg(`Validation Error: The total allocation percentage must equal exactly 100%. Current total: ${totalAllocationSum}%.`);
      return;
    }

    // Check for duplicate users
    const userIds = editingAllocations.allocs.map(a => a.user_id);
    const hasDuplicates = new Set(userIds).size !== userIds.length;
    if (hasDuplicates) {
      setErrorMsg("Validation Error: The same user cannot be assigned more than once for this customer.");
      return;
    }

    try {
      setErrorMsg(null);
      await onSaveAssignments(
        editingAllocations.customer.id,
        editingAllocations.customer.customer_name,
        editingAllocations.allocs,
        currentUser.name
      );
      setSuccessMsg(`Customer allocations for "${editingAllocations.customer.customer_name}" updated successfully.`);
      setEditingAllocations(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update allocations.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigators */}
      <div className="flex items-center justify-between border-b border-gray-150 pb-4 text-left">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveMode("directory")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeMode === "directory" ? "bg-green-50 text-green-700" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Layers className="w-4 h-4" />
            Customer Assignments Directory
          </button>
          <button
            onClick={() => setActiveMode("audits")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeMode === "audits" ? "bg-green-50 text-green-700" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Assignment Audit Trail
          </button>
        </div>

        {activeMode === "directory" && (
          <button
            onClick={handleOpenCreateCustomer}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Customer Master
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Mode 1: Directory */}
      {activeMode === "directory" && (
        <div className="space-y-4 text-left">
          {/* Search bar */}
          <div className="relative max-w-md w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by customer name, city, state, GST, or assigned user..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-700"
            />
          </div>

          {/* Customers Directory Table */}
          <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-3xs max-h-160 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 text-gray-650 font-bold border-b border-gray-150 uppercase tracking-wider text-[9px] sticky top-0 bg-white z-10">
                <tr>
                  <th className="p-3">Customer Acc Name</th>
                  <th className="p-3">GST / PAN</th>
                  <th className="p-3">City / State</th>
                  <th className="p-3">Active Sales Allocations</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-slate-750 font-medium">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(cust => {
                    const allocs = customerAllocationsMap.get(cust.id) || [];
                    return (
                      <tr key={cust.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-slate-900 max-w-[200px] truncate" title={cust.customer_name}>
                          {cust.customer_name}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-gray-500">{cust.gst_number || "N/A"}</td>
                        <td className="p-3 text-gray-500">{cust.city ? `${cust.city}, ${cust.state || ""}` : cust.state || "N/A"}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {allocs.length > 0 ? (
                              allocs.map((a, idx) => {
                                const u = userMap.get(a.user_id);
                                return (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-[10px] font-bold border border-green-150">
                                    👤 {u ? u.name : "Unassigned"} ({a.allocation_percentage}%)
                                  </span>
                                );
                              })
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-md text-[10px] font-bold border border-red-150">
                                ⚠️ No Active Allocations
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cust.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                          }`}>
                            {cust.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEditAllocations(cust)}
                              className="px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg font-bold text-[10px] flex items-center gap-1 transition"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Edit Allocations
                            </button>
                            <button
                              onClick={() => handleOpenEditCustomer(cust)}
                              className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold text-[10px] flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Profile Master
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">No customers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 2: Audit Logs */}
      {activeMode === "audits" && (
        <div className="space-y-4 text-left">
          <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-3xs max-h-160 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-50 text-gray-650 font-bold border-b border-gray-150 uppercase tracking-wider text-[9px] sticky top-0 bg-white z-10">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Customer Acc</th>
                  <th className="p-3">Admin User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Old Value Summary</th>
                  <th className="p-3">New Value Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-slate-750 font-medium">
                {assignmentAuditLogs.length > 0 ? (
                  assignmentAuditLogs.map(log => {
                    // Try parsing values to print pretty lists
                    const prettyAllocs = (str: string | undefined) => {
                      if (!str) return "None";
                      try {
                        const parsed = JSON.parse(str);
                        if (Array.isArray(parsed)) {
                          return parsed.map((a: any) => {
                            const u = userMap.get(a.user_id);
                            return `${u ? u.name : "ID: " + a.user_id} (${a.allocation_percentage || a.allocation || 0}%)`;
                          }).join(", ");
                        }
                      } catch (_) {}
                      return str;
                    };

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-gray-400 text-[10px] font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{log.customer_name}</td>
                        <td className="p-3 text-gray-600 font-bold">👤 {log.admin_user}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-[9px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[10px] max-w-xs truncate" title={prettyAllocs(log.old_value)}>
                          {prettyAllocs(log.old_value)}
                        </td>
                        <td className="p-3 text-teal-700 font-semibold font-mono text-[10px] max-w-xs truncate" title={prettyAllocs(log.new_value)}>
                          {prettyAllocs(log.new_value)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">No allocation audit logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Create / Edit Customer Master Profile */}
      {(editingCustomer || isCreatingCustomer) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-2xl max-w-lg w-full overflow-hidden text-left transform scale-100 transition-all">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-green-600" />
                {isCreatingCustomer ? "Create Customer Master Profile" : `Edit Profile: ${editingCustomer?.customer_name}`}
              </h3>
              <button
                onClick={() => { setEditingCustomer(null); setIsCreatingCustomer(false); }}
                className="p-1.5 hover:bg-gray-200 rounded-full transition text-gray-500 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerMasterForm} className="p-6 space-y-4 max-h-[480px] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-150 text-red-800 text-[11px] font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Customer Name (Unique) *</label>
                  <input
                    type="text"
                    required
                    value={cmName}
                    onChange={e => setCmName(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="Enter unique Customer Business Name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">GST / Tax Number</label>
                  <input
                    type="text"
                    value={cmGst}
                    onChange={e => setCmGst(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="27XXXXX0000X0"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Status</label>
                  <select
                    value={cmStatus}
                    onChange={e => setCmStatus(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Contact Person Name</label>
                  <input
                    type="text"
                    value={cmPerson}
                    onChange={e => setCmPerson(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="Owner / Representative"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Contact Mobile Number</label>
                  <input
                    type="text"
                    value={cmNumber}
                    onChange={e => setCmNumber(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="+91 99000 00000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Email Address</label>
                  <input
                    type="email"
                    value={cmEmail}
                    onChange={e => setCmEmail(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">City</label>
                  <input
                    type="text"
                    value={cmCity}
                    onChange={e => setCmCity(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="Enter City Name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">State / Region</label>
                  <input
                    type="text"
                    value={cmState}
                    onChange={e => setCmState(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="State / Region Name"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Physical Address details</label>
                  <textarea
                    value={cmAddress}
                    onChange={e => setCmAddress(e.target.value)}
                    rows={2}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-slate-700"
                    placeholder="Enter business address details..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-150 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setEditingCustomer(null); setIsCreatingCustomer(false); }}
                  className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  Save Profile Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Customer Allocations Split */}
      {editingAllocations && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-2xl max-w-xl w-full overflow-hidden text-left transform scale-100 transition-all">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-600" />
                Manage Salesperson Allocations Split
              </h3>
              <button
                onClick={() => setEditingAllocations(null)}
                className="p-1.5 hover:bg-gray-200 rounded-full transition text-gray-500 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-150 space-y-1">
                <span className="text-[9px] uppercase font-bold text-teal-700 tracking-wide block">Customer Target</span>
                <span className="text-xs font-bold text-slate-900">{editingAllocations.customer.customer_name}</span>
                <p className="text-[10px] text-slate-500">
                  Define user allocation splits. The sum of all splits must equal exactly 100%.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-150 text-red-800 text-[11px] font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}

              {/* Allocation Rows */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {editingAllocations.allocs.map((alloc, index) => (
                  <div key={index} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] uppercase font-bold text-gray-400">Representative / Subordinate</label>
                      <select
                        value={alloc.user_id}
                        onChange={e => handleAllocationFieldChange(index, "user_id", e.target.value)}
                        className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-teal-500 text-slate-700"
                      >
                        {salesUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role} - {u.region || u.territory || "No region"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28 space-y-1">
                      <label className="text-[9px] uppercase font-bold text-gray-400">Split Share %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={alloc.allocation_percentage}
                        onChange={e => handleAllocationFieldChange(index, "allocation_percentage", Number(e.target.value) || 0)}
                        className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-teal-500 font-mono font-bold text-slate-700"
                        placeholder="0 - 100"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveAllocationRow(index)}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
                        title="Remove Representative Assignment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-gray-150 pt-4">
                <button
                  type="button"
                  onClick={handleAddAllocationRow}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Salesperson Allocation
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Allocation Sum:</span>
                  <span className={`text-xs font-extrabold font-mono px-2.5 py-1 rounded-full ${
                    totalAllocationSum === 100 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {totalAllocationSum}%
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-150 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingAllocations(null)}
                  className="px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllocationsForm}
                  disabled={totalAllocationSum !== 100}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    totalAllocationSum === 100 ? "bg-teal-600 hover:bg-teal-700" : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  Save Allocation Splits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
