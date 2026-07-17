import React, { useState, useMemo } from "react";
import { Users, Briefcase, Search, Shield, ChevronDown, ChevronRight, Award, TrendingUp } from "lucide-react";
import { UserProfile, InvoiceItem } from "../types";
import { getUserDescendantsList, isFuzzyNameMatch } from "../utils/analytics";

interface MySalesDeskProps {
  currentUser: UserProfile;
  scopedInvoices: InvoiceItem[]; // This is already filtered and dynamically split at runtime in memory!
  users: UserProfile[];
}

export default function MySalesDesk({ currentUser, scopedInvoices, users }: MySalesDeskProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSubordinates, setExpandedSubordinates] = useState<Record<string, boolean>>({});

  // 1. Calculate dynamic date boundaries from invoices
  const dateBoundaries = useMemo(() => {
    const dates = scopedInvoices.map(inv => inv.invoiceDate).filter(Boolean);
    let lastDateStr = "2026-05-12";
    if (dates.length > 0) {
      lastDateStr = dates.reduce((max, d) => d > max ? d : max, dates[0]);
    }

    const parts = lastDateStr.split("-");
    const year = Number(parts[0]);
    const monthIdx = Number(parts[1]) - 1;

    const fyStartYear = monthIdx >= 2 ? year : year - 1;
    const fyStartStr = `${fyStartYear}-03-01`;

    const p1StartYear = fyStartYear - 1;
    const p1StartStr = `${p1StartYear}-03-01`;

    const p1EndYear = year - 1;
    const p1EndStr = `${p1EndYear}-${parts[1]}-${parts[2]}`;

    return {
      p1Start: p1StartStr,
      p1End: p1EndStr,
      p2Start: fyStartStr,
      p2End: lastDateStr
    };
  }, [scopedInvoices]);

  // 2. Identify recursive descendants for current user
  const descendants = useMemo(() => {
    return getUserDescendantsList(currentUser, users);
  }, [currentUser, users]);

  const allHierarchyUsers = useMemo(() => {
    return [currentUser, ...descendants];
  }, [currentUser, descendants]);

  // 3. Compile assigned customer portfolio (including sub-assignments for managers)
  const assignedCustomers = useMemo(() => {
    const customerMap = new Map<string, {
      name: string;
      code: string;
      region: string;
      salesperson: string;
      cyAmt: number;
      lyAmt: number;
    }>();

    // Scan all scoped split invoices
    // If the invoice salesperson is the current user or one of their descendants, aggregate it!
    scopedInvoices.forEach(inv => {
      const spName = inv.salesperson || "";
      const isUserOrSub = allHierarchyUsers.some(u => isFuzzyNameMatch(u.name, spName));

      if (isUserOrSub && inv.customerName) {
        const code = inv.customerCode || "N/A";
        const key = `${inv.customerName.trim()}|||${code.trim()}`;
        const existing = customerMap.get(key) || {
          name: inv.customerName,
          code,
          region: inv.region || inv.state || "",
          salesperson: spName,
          cyAmt: 0,
          lyAmt: 0
        };

        const dt = inv.invoiceDate;
        if (dt >= dateBoundaries.p2Start && dt <= dateBoundaries.p2End) {
          existing.cyAmt += inv.netSalesValue;
        } else if (dt >= dateBoundaries.p1Start && dt <= dateBoundaries.p1End) {
          existing.lyAmt += inv.netSalesValue;
        }

        customerMap.set(key, existing);
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => b.cyAmt - a.cyAmt);
  }, [scopedInvoices, allHierarchyUsers, dateBoundaries]);

  // 4. Space-insensitive fuzzy search matching
  const filteredCustomers = useMemo(() => {
    const cleanSearch = searchQuery.replace(/[\s\-_]/g, "").toLowerCase();
    if (!cleanSearch) return assignedCustomers;

    return assignedCustomers.filter(c => {
      const cleanName = c.name.replace(/[\s\-_]/g, "").toLowerCase();
      const cleanSP = c.salesperson.replace(/[\s\-_]/g, "").toLowerCase();
      return cleanName.includes(cleanSearch) || cleanSP.includes(cleanSearch);
    });
  }, [assignedCustomers, searchQuery]);

  // 5. Compile reporting subordinate tree structure
  const subordinateHierarchy = useMemo(() => {
    const directReports = users.filter(u => u.managerId === currentUser.id);

    return directReports.map(sub => {
      // Gather recursive subordinates for this direct report
      const subDesc = getUserDescendantsList(sub, users);
      const allSubUsers = [sub, ...subDesc];

      // Aggregate sales data and customer list for this subordinate branch
      const subCustomersMap = new Map<string, { name: string; code: string; cySales: number }>();
      
      scopedInvoices.forEach(inv => {
        const spName = inv.salesperson || "";
        const isMatched = allSubUsers.some(u => isFuzzyNameMatch(u.name, spName));

        if (isMatched && inv.customerName) {
          const code = inv.customerCode || "N/A";
          const key = `${inv.customerName.trim()}|||${code.trim()}`;
          const existing = subCustomersMap.get(key) || { name: inv.customerName, code, cySales: 0 };

          if (inv.invoiceDate >= dateBoundaries.p2Start && inv.invoiceDate <= dateBoundaries.p2End) {
            existing.cySales += inv.netSalesValue;
          }
          subCustomersMap.set(key, existing);
        }
      });

      const customers = Array.from(subCustomersMap.values()).sort((a, b) => b.cySales - a.cySales);
      return {
        subordinate: sub,
        customers,
        totalSales: customers.reduce((sum, c) => sum + c.cySales, 0)
      };
    }).sort((a, b) => b.totalSales - a.totalSales);
  }, [currentUser, users, scopedInvoices, dateBoundaries]);

  // Total sums
  const totalCySales = useMemo(() => assignedCustomers.reduce((sum, c) => sum + c.cyAmt, 0), [assignedCustomers]);
  const totalLySales = useMemo(() => assignedCustomers.reduce((sum, c) => sum + c.lyAmt, 0), [assignedCustomers]);

  const toggleSubordinate = (id: string) => {
    setExpandedSubordinates(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5 text-left">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            My Sales Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Displaying direct customer portfolios, manager rollups, and reporting hierachical structures.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="px-2.5 py-1 bg-slate-100 rounded-lg">Clearance: {currentUser.role}</span>
          {currentUser.region && <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg">Region: {currentUser.region}</span>}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-150 rounded-2xl p-5 text-left shadow-3xs hover:shadow-2xs transition-all flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Assigned Accounts</span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">{assignedCustomers.length}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 rounded-2xl p-5 text-left shadow-3xs hover:shadow-2xs transition-all flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">CY Portfolio Sales</span>
            <span className="text-lg font-extrabold text-blue-700 font-mono">₹{(totalCySales / 100000).toFixed(2)} L</span>
          </div>
        </div>

        <div className="bg-white border border-gray-150 rounded-2xl p-5 text-left shadow-3xs hover:shadow-2xs transition-all flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">LY Portfolio Sales</span>
            <span className="text-lg font-extrabold text-slate-700 font-mono">₹{(totalLySales / 100000).toFixed(2)} L</span>
          </div>
        </div>
      </div>

      {/* 👤 My Assigned Customer Portfolio Section */}
      <div className="bg-gradient-to-r from-teal-50/70 to-emerald-50/50 border border-teal-200 rounded-2xl p-5 shadow-3xs text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-teal-150 pb-4 mb-4">
          <div>
            <span className="text-[9px] uppercase font-bold tracking-widest text-teal-700 block">Registered Sales Desk Info</span>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>👤 My Assigned Customer Portfolio</span>
              <span className="bg-teal-100 text-teal-800 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                {filteredCustomers.length} Accounts
              </span>
            </h2>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md w-full md:w-72">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-teal-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search customers or salespeople..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 border border-teal-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700"
            />
          </div>
        </div>

        <div className="max-h-120 overflow-y-auto rounded-xl border border-teal-100 bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-teal-50/60 text-slate-600 font-bold border-b border-teal-100 uppercase tracking-wider text-[9px] sticky top-0 bg-white z-10">
              <tr>
                <th className="p-3">Customer Acc Name</th>
                <th className="p-3">Assigned Salesperson</th>
                <th className="p-3">Region</th>
                <th className="p-3 text-right">CY Sales (Lakhs)</th>
                <th className="p-3 text-right">LY Sales (Lakhs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-750 font-medium">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((cust, itemIdx) => (
                  <tr key={itemIdx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-950">{cust.name}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px]">
                        👤 {cust.salesperson}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[10px]">{cust.region}</td>
                    <td className="p-3 text-right text-teal-700 font-bold font-mono">₹{(cust.cyAmt / 100000).toFixed(2)} L</td>
                    <td className="p-3 text-right text-slate-500 font-mono">₹{(cust.lyAmt / 100000).toFixed(2)} L</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400 italic">No assigned customers found in the database.</td>
                </tr>
              )}
            </tbody>
            {filteredCustomers.length > 0 && (
              <tfoot className="bg-teal-50/90 backdrop-blur-xs font-bold border-t border-teal-200 text-slate-900 text-[11px] sticky bottom-0 z-10">
                <tr>
                  <td colSpan={3} className="p-3 font-bold text-teal-900">Total Portfolio</td>
                  <td className="p-3 text-right text-teal-800 font-extrabold font-mono">₹{(filteredCustomers.reduce((sum, c) => sum + c.cyAmt, 0) / 100000).toFixed(2)} L</td>
                  <td className="p-3 text-right text-slate-700 font-extrabold font-mono">₹{(filteredCustomers.reduce((sum, c) => sum + c.lyAmt, 0) / 100000).toFixed(2)} L</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 🌳 Reporting Sales Team Hierarchy Section (for Managers & Admins) */}
      {(currentUser.role !== "Salesperson" || subordinateHierarchy.length > 0) && (
        <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 border border-blue-200 rounded-2xl p-5 shadow-3xs text-left">
          <div className="border-b border-blue-150 pb-4 mb-4">
            <span className="text-[9px] uppercase font-bold tracking-widest text-blue-700 block">Regional Command Desk Info</span>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>🌳 My Reporting Salesperson & Client Hierarchy</span>
              <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                {subordinateHierarchy.length} Reporting Lines
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subordinateHierarchy.length > 0 ? (
              subordinateHierarchy.map((sub, spIdx) => {
                const isExpanded = !!expandedSubordinates[sub.subordinate.id];
                return (
                  <div key={spIdx} className="bg-white rounded-xl border border-blue-100 p-4 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                          {sub.subordinate.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">{sub.subordinate.email}</p>
                        <span className="inline-block bg-blue-50 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded-md mt-1.5 border border-blue-150">
                          CY Sales: ₹{(sub.totalSales / 100000).toFixed(2)} L
                        </span>
                      </div>
                      <span className="bg-blue-50 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-md font-mono shrink-0">
                        {sub.subordinate.role === "Regional Manager" ? "RM" : (sub.subordinate.territory || "Representative")}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                      <button
                        onClick={() => toggleSubordinate(sub.subordinate.id)}
                        className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Assigned Accounts ({sub.customers.length})
                      </button>

                      {isExpanded && (
                        <div className="bg-slate-50/50 rounded-lg p-2 max-h-48 overflow-y-auto border border-slate-100 divide-y divide-slate-100 mt-1">
                          {sub.customers.length > 0 ? (
                            sub.customers.map((cust, cIdx) => (
                              <div key={cIdx} className="flex items-center justify-between text-[11px] py-1.5 font-medium">
                                <div className="truncate pr-2">
                                  <p className="text-slate-800 font-semibold truncate leading-tight" title={cust.name}>{cust.name}</p>
                                </div>
                                <span className="text-blue-700 font-bold font-mono text-[10px] shrink-0">₹{(cust.cySales / 100000).toFixed(2)} L</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-slate-400 italic py-2 text-center">No customer invoices in scope.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full p-8 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                No active salesperson accounts report to {currentUser.name}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
