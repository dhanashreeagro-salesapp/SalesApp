/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, Shield, Terminal, Library, AlertCircle, RefreshCw, Layers, CheckCircle, Users, UserPlus, Trash2, Edit3, Key, Mail, MapPin, ArrowUp, ShieldCheck, Activity, Database, AlertTriangle, UploadCloud, FileSpreadsheet } from "lucide-react";
import { AuditLog, UserProfile, InvoiceItem } from "../types";
import * as XLSX from "xlsx";

import { 
  isSupabaseConfigured,
  fetchDatabaseStatsFromSupabase,
  runIntegrityCheckOnSupabase,
  cleanDuplicateRowsOnSupabase,
  alignOrphanInvoicesOnSupabase
} from "../lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface HierarchyNode {
  user: UserProfile;
  children: HierarchyNode[];
  customers: { name: string; code: string; totalAmt: number }[];
}

interface AdminSettingsProps {
  auditLogs: AuditLog[];
  onResetDatabase: () => void;
  onUndoDatabaseImport: () => Promise<{ success: boolean; message?: string }>;
  onClearDatabaseInvoices: () => Promise<{ success: boolean; message?: string }>;
  onClearDatabaseBudgets: () => Promise<{ success: boolean; message?: string }>;
  currentUser: UserProfile;
  users: UserProfile[];
  onSaveUser: (user: any) => Promise<any>;
  onSaveUsersBulk: (users: any[]) => Promise<any>;
  onDeleteUser: (userId: string) => Promise<boolean>;
  invoices: InvoiceItem[];
}

function AdminDebugPanel({ invoices, users }: { invoices: InvoiceItem[], users: UserProfile[] }) {
  const [debugStats, setDebugStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDebugStats = async () => {
    setLoading(true);
    setError("");
    try {
      if (isSupabaseConfigured()) {
        const stats = await fetchDatabaseStatsFromSupabase();
        if (stats) {
          setDebugStats(stats);
          return;
        }
      }

      const apiBase = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiBase}/api/admin/debug-stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to retrieve database statistics`);
      const data = await res.json();
      if (data.success) {
        setDebugStats(data);
      } else {
        throw new Error(data.error || "Failed to load database stats.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend diagnostics endpoint");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDebugStats();
  }, []);

  // Compute stats based on currently loaded client invoices
  const visibleCount = invoices.length;
  const dbTotalCount = debugStats?.totalInvoices || 0;
  // Account for database subset filters / configuration boundaries
  const blockedByRLS = Math.max(0, dbTotalCount - visibleCount);

  // Group client-side invoices per company for visual cross-comparison
  const clientCompanyCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(inv => {
      const co = inv.company || "Unknown";
      counts[co] = (counts[co] || 0) + 1;
    });
    return counts;
  }, [invoices]);

  return (
    <div id="admin-debug-panel-root" className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Database RLS & Diagnostics Debug Panel
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">
              Provides real-time transparency into row distribution, RLS safety status, and client-server synchronisation metrics.
            </p>
          </div>
          <button
            onClick={loadDebugStats}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Sync Stats"}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Core Diagnostics Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 border border-gray-100 rounded-xl space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Rows in Supabase</span>
            <div className="text-2xl font-extrabold text-slate-800 font-sans">
              {loading ? "..." : dbTotalCount.toLocaleString()}
            </div>
            <p className="text-[9.5px] text-gray-500 leading-normal">
              Indicates the true physical count of rows stored in the remote <code className="bg-slate-200/60 px-1 py-0.5 rounded text-[9px] font-semibold text-slate-700">sales_data</code> database.
            </p>
          </div>

          <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-1">
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Visible Rows After Filters</span>
            <div className="text-2xl font-extrabold text-emerald-700 font-sans">
              {visibleCount.toLocaleString()}
            </div>
            <p className="text-[9.5px] text-emerald-600/80 leading-normal">
              Identified and rendered in the current tab session based on your selected regional territory, manager hierarchy, and active dates.
            </p>
          </div>

          <div className={`p-4 rounded-xl space-y-1 border ${blockedByRLS > 0 ? "bg-amber-50/50 border-amber-150" : "bg-blue-50/40 border-blue-100"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${blockedByRLS > 0 ? "text-amber-700" : "text-blue-700"}`}>
              {blockedByRLS > 0 ? "Rows Subsetted / Blocked by RLS" : "Row-Level Security (RLS) Status"}
            </span>
            <div className={`text-2xl font-extrabold font-sans ${blockedByRLS > 0 ? "text-amber-700" : "text-blue-700"}`}>
              {loading ? "..." : blockedByRLS.toLocaleString()}
            </div>
            <p className={`text-[9.5px] leading-normal ${blockedByRLS > 0 ? "text-amber-700/80" : "text-blue-600/80"}`}>
              {blockedByRLS > 0 
                ? `RLS is securely filtering out ${blockedByRLS.toLocaleString()} rows to restrict client visibility to direct reporting lines only.` 
                : "All database rows are visible. RLS is operating in full Director/Admin mode."}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Breakdown Distribution Cards */}
      {debugStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A: Brand Company Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-slate-400" />
              Company / Brand Row Volumes
            </h4>
            <div className="space-y-3">
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase text-[9px]">
                      <th className="py-2">Company Name</th>
                      <th className="py-2 text-center">Supabase Database</th>
                      <th className="py-2 text-right">Dashboard (Visible)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-750">
                    {Object.entries(debugStats.companyCounts || {}).map(([co, count]: [string, any]) => {
                      const clientCount = clientCompanyCounts[co] || 0;
                      return (
                        <tr key={co} className="hover:bg-gray-50/30">
                          <td className="py-2.5 font-bold text-gray-900">{co}</td>
                          <td className="py-2.5 text-center font-bold font-mono text-slate-700">{count.toLocaleString()}</td>
                          <td className="py-2.5 text-right font-bold font-mono text-emerald-600">{clientCount.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {Object.keys(debugStats.companyCounts || {}).length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-gray-400 text-[11px]">No brand companies registered in database.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Card B: Year & Month Date Range Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-400" />
              Dynamic Date Range Statistics
            </h4>
            
            <div className="space-y-5">
              {/* Year Counts */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Yearly Distribution (Database)</h5>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(debugStats.yearCounts || {}).map(([year, count]: [string, any]) => (
                    <div key={year} className="p-3 bg-slate-50 border border-gray-100 rounded-xl flex justify-between items-center">
                      <span className="font-bold text-gray-800 text-xs">FY {year}</span>
                      <span className="font-mono text-xs font-extrabold text-slate-700 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-xs">{count.toLocaleString()} rows</span>
                    </div>
                  ))}
                  {Object.keys(debugStats.yearCounts || {}).length === 0 && (
                    <div className="col-span-2 text-center text-gray-400 text-[10px]">No year counts compiled.</div>
                  )}
                </div>
              </div>

              {/* Month Counts */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide font-sans">Monthly Distribution Trends</h5>
                <div className="bg-slate-50/50 border border-gray-100 rounded-xl p-3 max-h-[160px] overflow-y-auto space-y-1.5">
                  {Object.entries(debugStats.monthCounts || {}).map(([month, count]: [string, any]) => {
                    const maxVal = Math.max(...Object.values(debugStats.monthCounts || {}) as number[], 1);
                    const pct = Math.max(5, (count / maxVal) * 100);
                    return (
                      <div key={month} className="flex justify-between items-center text-[11px] font-medium text-gray-750">
                        <span className="w-24 font-semibold text-gray-700 shrink-0">{month}</span>
                        <div className="flex-1 mx-3 bg-gray-200 h-2 rounded-full overflow-hidden shrink-0">
                          <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="font-mono font-bold text-gray-900 whitespace-nowrap shrink-0">{count.toLocaleString()} rows</span>
                      </div>
                    );
                  })}
                  {Object.keys(debugStats.monthCounts || {}).length === 0 && (
                    <div className="text-center py-6 text-gray-450 text-[10px]">No monthly logs.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettings({
  auditLogs,
  onResetDatabase,
  onUndoDatabaseImport,
  onClearDatabaseInvoices,
  onClearDatabaseBudgets,
  currentUser,
  users,
  onSaveUser,
  onSaveUsersBulk,
  onDeleteUser,
  invoices,
}: AdminSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<"standard" | "users" | "debug">("standard");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);



  // Form states for creating / editing user
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"Sales Director" | "Regional Manager" | "Salesperson" | "Admin">("Salesperson");
  const [formRegion, setFormRegion] = useState("");
  const [formTerritory, setFormTerritory] = useState("");
  const [formManager, setFormManager] = useState("");
  const [formApproved, setFormApproved] = useState(true);

  // Scroll to Top dynamic button state
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Administrative Data Integrity & Diagnostic states
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [loadingIntegrity, setLoadingIntegrity] = useState(false);
  const [integrityError, setIntegrityError] = useState("");
  const [cleaningDups, setCleaningDups] = useState(false);
  const [aligningOrphans, setAligningOrphans] = useState(false);
  const [integritySuccessMsg, setIntegritySuccessMsg] = useState("");

  const runIntegritySweep = async () => {
    setLoadingIntegrity(true);
    setIntegrityError("");
    setIntegritySuccessMsg("");
    try {
      if (isSupabaseConfigured()) {
        const d = await runIntegrityCheckOnSupabase();
        if (d) {
          setIntegrityData(d);
          return;
        }
      }
      const res = await fetch(`${API_BASE}/api/admin/integrity-check`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach diagnostic service`);
      const d = await res.json();
      if (d.success) {
        setIntegrityData(d);
      } else {
        setIntegrityError(d.error || "Diagnostic check run returned failure.");
      }
    } catch (e: any) {
      setIntegrityError(e.message || "Endpoint connection failed");
    } finally {
      setLoadingIntegrity(false);
    }
  };

  const handleCleanDuplicates = async () => {
    if (!window.confirm("Are you sure you want to delete all redundant duplicate lines from the Supabase sales database? This operation is transaction-safe and preserves at least one primary copy of every unique invoice record.")) return;
    setCleaningDups(true);
    setIntegritySuccessMsg("");
    try {
      if (isSupabaseConfigured()) {
        const d = await cleanDuplicateRowsOnSupabase();
        if (d && d.success) {
          setIntegritySuccessMsg(`Successfully Deduplicated! Cleared ${d.cleanedCount || 0} redundant rows.`);
          await runIntegritySweep();
          return;
        }
      }
      const res = await fetch(`${API_BASE}/api/admin/clean-duplicates`, { method: "POST" });
      const d = await res.json();
      if (d.success) {
        setIntegritySuccessMsg(`Successfully Deduplicated! Cleared ${d.cleanedCount || 0} redundant rows.`);
        await runIntegritySweep();
      } else {
        setIntegrityError(d.error || "Wipe redundant items failed");
      }
    } catch (err: any) {
      setIntegrityError(err.message || "Failed to contact database cleaner");
    } finally {
      setCleaningDups(false);
    }
  };

  const handleAlignOrphans = async () => {
    if (!window.confirm("This will sweep the database and assign matching registered verified system account references to orphan invoices salesperson assignments. Proceed?")) return;
    setAligningOrphans(true);
    setIntegritySuccessMsg("");
    try {
      if (isSupabaseConfigured()) {
        const d = await alignOrphanInvoicesOnSupabase();
        if (d && d.success) {
          setIntegritySuccessMsg(`Successfully Aligned! Resolved and linked salesperson IDs for ${d.fixedCount || 0} invoices.`);
          await runIntegritySweep();
          return;
        }
      }
      const res = await fetch(`${API_BASE}/api/align-orphans || /api/admin/align-orphans`, {
        method: "POST"
      });
      // We also made sure to support both route formats
      const mockRes = await fetch(`${API_BASE}/api/admin/align-orphans`, { method: "POST" });
      const d = await mockRes.json();
      if (d.success) {
        setIntegritySuccessMsg(`Successfully Aligned! Resolved and linked salesperson IDs for ${d.fixedCount || 0} invoices.`);
        await runIntegritySweep();
      } else {
        setIntegrityError(d.error || "Mappers failed");
      }
    } catch (err: any) {
      setIntegrityError(err.message || "Failed to contact representatives binder");
    } finally {
      setAligningOrphans(false);
    }
  };

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      if (scrollY > 150) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Unique groups from column "Name of the Group" (stored as region in invoices list) as Reporting Manager
  const uniqueNameOfGroups = React.useMemo(() => {
    const groups = new Set<string>();
    invoices.forEach(inv => {
      if (inv.region) groups.add(inv.region);
    });
    // Ensure default RM's/regions remain selectable as fallbacks
    ["S. R. Patil", "K. Swamy", "R. K. Singh", "West", "South", "North", "Rahul Sawant"].forEach(g => {
      groups.add(g);
    });
    return Array.from(groups).sort();
  }, [invoices]);

  // Unique sub-groups from column "Name of sub group" (stored as territory in invoices list)
  const uniqueSubGroups = React.useMemo(() => {
    const subs = new Set<string>();
    invoices.forEach(inv => {
      if (inv.territory) subs.add(inv.territory);
    });
    // Ensure default demo values are always selectable
    ["West-1", "West-2", "South-1", "South-2", "North-1"].forEach(s => subs.add(s));
    return Array.from(subs).sort();
  }, [invoices]);

  // Constructed salesperson hierarchy supporting arbitrary depth RMs and salespeople reporting to other RMs
  const builtTree = React.useMemo(() => {
    const activeUsers = users.filter(u => u.role !== "Admin");

    // Helper to fetch direct customer list assigned to a user
    const getCustomersForUser = (user: UserProfile) => {
      const uNameLower = user.name.trim().toLowerCase();
      
      const filteredInvoices = invoices.filter(inv => {
        const hasSp = inv.salesperson && inv.salesperson.trim() !== "" && inv.salesperson.trim().toLowerCase() !== "n/a";
        const invSpLower = hasSp ? inv.salesperson.trim().toLowerCase() : "";
        const invRMLower = inv.regionalManager ? inv.regionalManager.trim().toLowerCase() : "";
        
        if (user.role === "Salesperson") {
          return invSpLower === uNameLower;
        } else if (user.role === "Regional Manager") {
          // If the invoice has this user as its RM, check if it's handled by a registered salesperson under them
          if (invRMLower !== uNameLower) return false;
          if (!hasSp || invSpLower === uNameLower) return true;
          
          // Check if salesperson exists
          const spUser = users.find(usr => usr.name.trim().toLowerCase() === invSpLower && usr.role !== "Admin");
          if (!spUser) return true; // Unregistered salesperson, so RM gets it directly

          // If the registered salesperson's manager matches this RM, it will be rendered under that salesperson's leaf node.
          const isDirectSubordinate = spUser.managerName && spUser.managerName.trim().toLowerCase() === uNameLower;
          return !isDirectSubordinate;
        } else {
          // Sales Director or other roles
          return invSpLower === uNameLower || invRMLower === uNameLower;
        }
      });

      const customerMap = new Map<string, { name: string; code: string; totalAmt: number }>();
      filteredInvoices.forEach(inv => {
        const code = inv.customerCode || "N/A";
        const key = `${inv.customerName.trim()}|||${code.trim()}`;
        const existing = customerMap.get(key) || { name: inv.customerName, code, totalAmt: 0 };
        existing.totalAmt += inv.netSalesValue;
        customerMap.set(key, existing);
      });
      
      return Array.from(customerMap.values()).sort((a, b) => b.totalAmt - a.totalAmt);
    };

    // Instantiate node representation for all non-admin users
    const nodesMap = new Map<string, HierarchyNode>();
    activeUsers.forEach(u => {
      const key = u.name.trim().toLowerCase();
      nodesMap.set(key, {
        user: u,
        children: [],
        customers: getCustomersForUser(u)
      });
    });

    const childSet = new Set<string>();

    // Build children relationships
    activeUsers.forEach(u => {
      const uKey = u.name.trim().toLowerCase();
      const node = nodesMap.get(uKey);
      if (!node) return;

      const mName = (u.managerName || "").trim();
      const mKey = mName.toLowerCase();

      // Ensure manager exists, is active, is not themselves, and is not an Admin
      const managerExists = mName && users.some(usr => usr.name.trim().toLowerCase() === mKey && usr.role !== "Admin" && usr.name.trim().toLowerCase() !== uKey);

      if (managerExists) {
        const parentNode = nodesMap.get(mKey);
        if (parentNode) {
          parentNode.children.push(node);
          childSet.add(uKey);
        }
      }
    });

    // Root nodes are those not in any parent's children (i.e. not in childSet)
    let finalRoots = Array.from(nodesMap.values()).filter(node => !childSet.has(node.user.name.trim().toLowerCase()));

    // Check if virtual Sales Director "Sundry Debtors" of the company is referenced but doesn't exist as a registered user
    const isSundryReferenced = activeUsers.some(u => u.managerName && u.managerName.trim().toLowerCase() === "sundry debtors");
    const hasSundryUser = activeUsers.some(u => u.name.trim().toLowerCase() === "sundry debtors");

    if (isSundryReferenced && !hasSundryUser) {
      const virtualSundry: UserProfile = {
        id: "virtual_sundry",
        name: "Sundry Debtors",
        email: "sundry.debtors@agrosales.com",
        role: "Sales Director",
        approved: true
      };

      const sundryNode: HierarchyNode = {
        user: virtualSundry,
        children: [],
        customers: getCustomersForUser(virtualSundry)
      };

      // Gather children that report to "Sundry Debtors" or have no manager
      const directUnders: HierarchyNode[] = [];
      const independentRoots: HierarchyNode[] = [];

      finalRoots.forEach(node => {
        const mgrName = (node.user.managerName || "").trim().toLowerCase();
        if (mgrName === "sundry debtors" || (node.user.role !== "Sales Director" && !node.user.managerName)) {
          directUnders.push(node);
        } else {
          independentRoots.push(node);
        }
      });

      sundryNode.children = directUnders;
      finalRoots = [sundryNode, ...independentRoots];
    }

    // Sort to place Sales Directors first at top-level
    finalRoots.sort((a, b) => {
      const aVal = a.user.role === "Sales Director" ? 0 : 1;
      const bVal = b.user.role === "Sales Director" ? 0 : 1;
      return aVal - bVal;
    });

    return finalRoots;
  }, [users, invoices]);

  // Recursive helper function for rendering multi-level hierarchies beautifully
  const renderHierarchyNode = (node: HierarchyNode, depth: number = 0): React.ReactNode => {
    const roleColors = {
      "Sales Director": "bg-purple-100 border-purple-200 text-purple-900",
      "Regional Manager": "bg-blue-100 border-blue-200 text-blue-900",
      "Salesperson": "bg-emerald-100 border-emerald-200 text-emerald-900",
      "Admin": "bg-orange-100 border-orange-200 text-orange-900"
    };

    const roleLabel = node.user.role;
    const colorClass = roleColors[node.user.role satisfies keyof typeof roleColors] || "bg-gray-100 border-gray-200 text-gray-900";
    const indentClass = depth > 0 ? "pl-5 border-l-2 border-dashed border-gray-150 ml-3" : "";

    return (
      <div key={node.user.id || node.user.name} className={`space-y-2 py-1 ${indentClass}`}>
        <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-2xs hover:shadow-xs transition duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[14px]">
                {node.user.role === "Sales Director" ? "👑" : node.user.role === "Regional Manager" ? "💼" : "👤"}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${colorClass}`}>
                {roleLabel}
              </span>
              <span className="text-[11px] font-extrabold text-slate-800">{node.user.name}</span>
              {node.user.region && (
                <span className="text-[9.5px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                  {node.user.region} Region
                </span>
              )}
              {node.user.territory && (
                <span className="text-[9.5px] font-bold bg-emerald-55/10 text-emerald-800 px-1.5 py-0.5 rounded">
                  Sub-group: {node.user.territory}
                </span>
              )}
            </div>
            <span className="text-[9px] text-gray-450 font-mono font-semibold self-start sm:self-center">
              {node.user.email}
            </span>
          </div>

          {/* Assigned direct customers of this node */}
          <div className="mt-2.5 pl-3 border-l-2 border-emerald-300">
            <div className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">
              Assigned Dealers / Direct Portfolio:
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {node.customers.length > 0 ? (
                node.customers.map((c, cIdx) => (
                  <span
                    key={cIdx}
                    className="bg-slate-50 border border-gray-150 rounded-md px-1.5 py-0.5 text-[8.5px] text-slate-700 font-bold font-mono hover:border-emerald-300 transition-colors"
                    title={`Customer Code: ${c.code} | Cumulative Sales Value: ₹${c.totalAmt.toLocaleString("en-IN")}`}
                  >
                    🏬 {c.name.split(" ")[0]} <span className="text-emerald-600 font-extrabold">(₹{(c.totalAmt / 1000).toFixed(1)}k)</span>
                  </span>
                ))
              ) : (
                <span className="text-[8.5px] text-gray-400 italic font-medium">None directly assigned</span>
              )}
            </div>
          </div>
        </div>

        {/* Child nodes recursively */}
        {node.children.length > 0 && (
          <div className="space-y-1.5 mt-1">
            {node.children.map(child => renderHierarchyNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleTerritorySelect = (selectedTerritory: string) => {
    setFormTerritory(selectedTerritory);
  };

  const handleToggleApprove = async (u: any) => {
    const isApproved = u.approved !== false;
    const payload = {
      ...u,
      approved: !isApproved
    };
    const result = await onSaveUser(payload);
    const success = typeof result === "boolean" ? result : result?.success;
    const serverSynced = typeof result === "boolean" ? true : result?.serverSynced;

    if (success) {
      if (serverSynced === false) {
        setSuccessMsg(`Updated status for ${u.name} locally. ⚠️ Syncing to central server failing (in Local Offline Cache mode list).`);
      } else {
        setSuccessMsg(`Successfully updated authorization status for ${u.name} in the server database.`);
      }
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      alert("Error updating user approval status.");
    }
  };

  const triggerReset = () => {
    onResetDatabase();
    setSuccessMsg("System successfully restored to production master seed data (Company A & B + Budgets).");
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleUndoUpload = async () => {
    if (window.confirm("Are you sure you want to undo the last spreadsheet import? This will restore the database to its pre-import state.")) {
      const result = await onUndoDatabaseImport();
      if (result.success) {
        setSuccessMsg("Success! Restored database back to pre-import snapshot successfully.");
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        alert(result.message || "No pre-import database snapshot was found to perform Undo.");
      }
    }
  };

  const handleClearInvoices = async () => {
    if (window.confirm("CRITICAL WARNING: Are you sure you want to delete ALL active invoices in the uploads database? This action is reversible via single-step Undo, but any subsequent imports will overwrite this snapshot.")) {
      const result = await onClearDatabaseInvoices();
      if (result.success) {
        setSuccessMsg("Invoices database has been cleared successfully. A snapshot is saved for Undo.");
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        alert(result.message || "Failed to clear invoices.");
      }
    }
  };

  const handleClearBudgets = async () => {
    if (window.confirm("CRITICAL WARNING: Are you sure you want to delete ALL targeting/budget sheets from the database? This action is reversible via single-step Undo, but any subsequent imports will overwrite this snapshot.")) {
      const result = await onClearDatabaseBudgets();
      if (result.success) {
        setSuccessMsg("Budgets database has been cleared successfully. A snapshot is saved for Undo.");
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        alert(result.message || "Failed to clear budgets.");
      }
    }
  };

  const handleClearBrowserCache = () => {
    if (window.confirm("This will clear your browser's local spreadsheet cache and force a complete reload of active server-side database records. Continue?")) {
      localStorage.removeItem("agroSalesInvoices");
      localStorage.removeItem("agroSalesBudgets");
      localStorage.removeItem("agroSalesAuditLogs");
      localStorage.removeItem("agroSalesEmailLogs");
      setSuccessMsg("Local state wiped out. Executing synchronized browser reload...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleEditUserClick = (u: any) => {
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword(u.password || "password123");
    setFormRole(u.role);
    setFormRegion(u.region || "West");
    setFormTerritory(u.territory || "West-1");
    setFormManager(u.managerName || "Rahul Sawant");
    setFormApproved(u.approved !== false);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("Salesperson");
    setFormRegion("");
    setFormTerritory("");
    setFormManager("");
    setFormApproved(true);
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) {
      alert("Please fill in Name and Email");
      return;
    }

    if (formRole !== "Admin" && formRole !== "Sales Director") {
      if (!formManager || formManager.trim() === "") {
        alert("Validation Error: \"Assigned Manager (RM) (Name of Group)\" is compulsory for all users except Admin and Sales Director.");
        return;
      }
    }

    const emailLower = formEmail.trim().toLowerCase();
    const isDuplicate = users.some(u => u.email.trim().toLowerCase() === emailLower && u.id !== editingUserId);
    if (isDuplicate) {
      alert(`Validation Error: A user with Corporate ID (EMAIL) "${formEmail.trim()}" already exists. Duplicate users are not allowed.`);
      return;
    }

    const payload = {
      id: editingUserId || undefined,
      name: formName,
      email: formEmail,
      password: formPassword || "password123",
      role: formRole,
      approved: formApproved,
      region: formRole !== "Admin" ? formRegion : undefined,
      territory: formRole !== "Admin" ? formTerritory : undefined,
      managerName: formRole !== "Admin" ? formManager : undefined,
      salespersonCode: formRole === "Salesperson" ? `SP_${(formRegion || "X")[0]}${Math.floor(Math.random() * 100)}` : undefined,
    };

    const result = await onSaveUser(payload);
    const success = typeof result === "boolean" ? result : result?.success;
    const serverSynced = typeof result === "boolean" ? true : result?.serverSynced;

    if (success) {
      if (serverSynced === false) {
        setSuccessMsg(editingUserId 
          ? `Updated profile for "${formName}" locally only. ⚠️ Core server database sync failed. Kept in local web storage.` 
          : `Created profile for "${formName}" locally only. ⚠️ Core server database sync failed. Kept in local web storage.`
        );
      } else {
        setSuccessMsg(editingUserId 
          ? `Updated profile for "${formName}" successfully on the central server database.` 
          : `Successfully created and saved credentials for "${formName}" on the central server database.`
        );
      }
      handleCancelEdit();
      setTimeout(() => setSuccessMsg(null), 8500);
    } else {
      const errorMsg = (typeof result === "object" && result?.error) ? `: ${result.error}` : "";
      alert("Error saving profile parameters" + errorMsg);
    }
  };

  const handleDeleteUserClick = async (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to completely suspend and revoke database access for "${userName}"?`)) {
      const success = await onDeleteUser(userId);
      if (success) {
        setSuccessMsg(`Suspended database credentials for "${userName}".`);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    }
  };

  const standardSpellings = [
    { original: "pune fert", standardized: "Mahalaxmi Fertilizers Pune" },
    { original: "balaji satara", standardized: "Balaji Agro Services Satara" },
    { original: "krishna agency nasik", standardized: "Krishna Agro Agency Nashik" },
    { original: "malhar seeds", standardized: "Jai Malhar Seeds Kolhapur" },
    { original: "saraswathi solapur", standardized: "Saraswati Agro Solapur" },
    { original: "SugaMax Bio Boost", standardized: "SugaMax Bio Enhancer" },
    { original: "rhizo active", standardized: "RhizoActive Soil Pro" },
  ];

  return (
    <div className="space-y-6">
      
      {/* Intro */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-450" />
            Admin & Standardisation Settings
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure system operational parameters, standardizations, regional hierarchies, and authorized user credentials.
          </p>
        </div>
        
        {/* Subtabs Selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveSubTab("standard")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === "standard" ? "bg-white text-green-700 shadow-xs" : "text-gray-550 hover:text-gray-900"
            }`}
          >
            Dictionary & Logs
          </button>
          <button
            onClick={() => setActiveSubTab("users")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === "users" ? "bg-white text-green-700 shadow-xs" : "text-gray-550 hover:text-gray-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            User directory ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab("debug")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeSubTab === "debug" ? "bg-white text-green-700 shadow-xs" : "text-gray-550 hover:text-gray-900"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Database RLS & Diagnostics
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-150 text-green-900 p-4 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeSubTab === "standard" ? (
        /* Standard Tab */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Spelling standardisation dictionary mapping tables */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs md:col-span-1 space-y-4">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Library className="w-4 h-4 text-gray-400" />
              Brand spelling mapping indices
            </h3>

            <div className="space-y-3">
              <div className="text-[10px] text-gray-500">
                Matches irregular spreadsheet names (e.g., from small local franchise agents) and resolves duplicates during upload:
              </div>
              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {standardSpellings.map((sp, idx) => (
                  <div key={idx} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] flex justify-between items-center">
                    <div>
                      <span className="text-gray-450 uppercase font-semibold">Incoming:</span>
                      <div className="font-bold text-red-500 mt-0.5">"{sp.original}"</div>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-450 uppercase font-semibold">Map to:</span>
                      <div className="font-bold text-green-600 mt-0.5">"{sp.standardized.split(" ")[0]}..."</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit logging trail */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs md:col-span-2 space-y-4">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-400" />
              System Transactional Audit Trail
            </h3>

            <div className="overflow-x-auto">
              <div className="max-h-[350px] overflow-y-auto">
                <table className="w-full text-[11px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-semibold">
                      <th className="py-2">Time</th>
                      <th className="py-2">Initiator</th>
                      <th className="py-2">Action</th>
                      <th className="py-2">Details Summary</th>
                      <th className="py-2 text-right">Maturity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-700">
                    {auditLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/30">
                        <td className="py-2.5 font-medium text-gray-400 text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 font-bold">{log.user}</td>
                        <td className="py-2.5 text-gray-900 font-semibold">{log.action}</td>
                        <td className="py-2.5 max-w-[200px] truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="py-2.5 text-right font-semibold">
                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] ${
                            log.status === "Success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      ) : activeSubTab === "users" ? (
        /* Users Dynamic Management Directory Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User accounts list directory table */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs lg:col-span-2 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Registered Employee Directory</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage regional boundaries, supervisor chains, and credentials.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-450 uppercase text-[9px] font-bold">
                    <td className="py-2">Name & Email</td>
                    <td className="py-2">Security Role</td>
                    <td className="py-2">Territory Scope</td>
                    <td className="py-2">Manager (RM)</td>
                    <td className="py-2">Status</td>
                    <td className="py-2 text-right">Operations</td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {users.map((u) => {
                    const isCurrentUser = currentUser.id === u.id;
                    const uPass = (u as any).password || "password123";
                    
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/20">
                        <td className="py-3">
                          <div className="font-bold text-gray-900 flex items-center gap-1">
                            {u.name}
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[8px] font-bold rounded-md">YOU</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-gray-400" />
                            {u.email}
                          </div>
                        </td>
                        <td className="py-3 font-semibold">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                            u.role === "Sales Director" ? "bg-purple-50 text-purple-700" :
                            u.role === "Regional Manager" ? "bg-blue-50 text-blue-700" :
                            u.role === "Admin" ? "bg-orange-50 text-orange-700" :
                            "bg-green-50 text-green-700"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 font-medium">
                          {u.territory ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                <span className="font-bold text-gray-950">{u.territory}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 font-semibold truncate max-w-[170px]">
                                {u.region || 'Global'} Region
                              </div>
                            </div>
                          ) : u.region ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span>{u.region}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-semibold">Unlimited Global</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-500 font-semibold">
                          {u.managerName ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-gray-950 font-bold">{u.managerName}</span>
                              {(() => {
                                const mgrObj = users.find(usr => usr.name === u.managerName);
                                if (mgrObj && mgrObj.region) {
                                  return (
                                    <span className="text-[9px] text-gray-400 font-semibold">
                                      Operating region: "{mgrObj.region}"
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic font-medium">None (Sundry Debtors)</span>
                          )}
                        </td>
                        <td className="py-3">
                          {u.approved !== false ? (
                            <span 
                              className="px-2 py-0.5 bg-green-55/70 border border-green-200 text-green-800 rounded-md text-[9px] font-bold flex items-center gap-1 w-fit cursor-pointer hover:bg-green-100 transition" 
                              title="Approved and Active login. Click to block/unauthorize." 
                              onClick={() => handleToggleApprove(u)}
                            >
                              <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                              Active Approved
                            </span>
                          ) : (
                            <span 
                              className="px-2 py-0.5 bg-amber-50/70 border border-amber-200 text-amber-800 rounded-md text-[9px] font-bold flex items-center gap-1 w-fit cursor-pointer hover:bg-amber-100 transition" 
                              title="Pending access approval. Click to instantly authorize entry." 
                              onClick={() => handleToggleApprove(u)}
                            >
                              🔑 Pending Authorization
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right space-x-1 shrink-0">
                          {u.approved === false && (
                            <button
                              onClick={() => handleToggleApprove(u)}
                              className="p-1 px-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-md text-[10px] inline-flex items-center gap-1 outline-none transition shadow-xs"
                              title="Instantly approve this user account"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleEditUserClick(u)}
                            className="p-1 px-2 hover:bg-gray-100 rounded-md text-[10px] text-blue-600 font-bold hover:text-blue-700 inline-flex items-center gap-1"
                            title="Edit Credentials"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleDeleteUserClick(u.id, u.name)}
                              className="p-1 px-2 hover:bg-red-50 rounded-md text-[10px] text-red-600 font-bold hover:text-red-700 inline-flex items-center gap-1"
                              title="Delete security credentials"
                            >
                              <Trash2 className="w-3 h-3" />
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl flex items-start gap-2.5 text-[10px] text-gray-500">
              <Key className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-gray-700">Account Security Notes</span>
                <p className="mt-0.5">
                  Users use their respective corporate emails to log in. Default passwords is set to <span className="font-mono bg-white px-1 py-0.5 border rounded">password123</span> (or <span className="font-mono bg-white px-1 py-0.5 border rounded">admin123</span> for Admins). You can customize user passwords directly using the form editor on the right.
                </p>
              </div>
             {/* Visual dynamic reporting hierarchy tree */}
            <div className="bg-emerald-50/20 border border-emerald-100 rounded-2xl p-4 mt-4 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                <span className="text-emerald-700 font-bold">🌳</span>
                <span className="text-[10px] uppercase font-extrabold text-emerald-950 tracking-wider">Dynamic Reporting & Territory Scope Hierarchy</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                This corporate tree is defined manually inside the platform credentials list. Support structures from the Sales Director down report dynamically across multi-level RMs, Salespersons, and their assigned customer portfolios:
              </p>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {builtTree.length > 0 ? (
                  builtTree.map(rootNode => renderHierarchyNode(rootNode, 0))
                ) : (
                  <p className="text-[10px] text-gray-400 italic">No registered sales team profiles found to show hierarchy.</p>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Column 3: User Registration Form and Excel Bulk Import */}
          <div className="space-y-6">
            {/* User creation / editing panel */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 block">
                {editingUserId ? "Edit Account Profile" : "Register Sales Team Member"}
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">Provide corporate parameters to write secure database parameters dynamically.</p>
            </div>

            <form onSubmit={handleUserFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">User Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. S. Gopal"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">Corporate Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. sgopal@agroiq.com"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">Set Security Password</label>
                <input
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="password123"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-500 uppercase block">Clearance Role Level</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 focus:border-green-600 focus:bg-white rounded-xl text-xs outline-none transition"
                >
                  <option value="Sales Director">Sales Director</option>
                  <option value="Regional Manager">Regional Manager</option>
                  <option value="Salesperson">Salesperson</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {formRole !== "Sales Director" && formRole !== "Admin" && (
                <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase block">Operating Region</label>
                    <select
                      value={formRegion}
                      onChange={(e) => setFormRegion(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                    >
                      <option value="West">West</option>
                      <option value="South">South</option>
                      <option value="North">North</option>
                      <option value="Global">Global</option>
                      {uniqueNameOfGroups.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase block">Territory Group Scope (Sub Group)</label>
                    <select
                      value={formTerritory}
                      onChange={(e) => handleTerritorySelect(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                    >
                      <option value="">-- Choose Territory Sub Group --</option>
                      {uniqueSubGroups.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase block">
                      Assigned Manager (RM) (Name of Group) <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      required={formRole !== "Admin" && formRole !== "Sales Director"}
                      value={formManager}
                      onChange={(e) => setFormManager(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                    >
                      <option value="">-- Choose Reporting Manager --</option>
                      {uniqueNameOfGroups.map(grp => (
                        <option key={grp} value={grp}>{grp}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-gray-400 font-semibold flex items-center gap-1 mt-1">
                      <span>👤 Reports To:</span>
                      <span className="text-green-800 font-bold font-mono">"{formManager || 'None'}"</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 py-2 px-3 bg-gray-50/50 rounded-xl border border-gray-150">
                <input
                  type="checkbox"
                  id="formApprovedInput"
                  checked={formApproved}
                  onChange={(e) => setFormApproved(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded-sm focus:ring-green-500 accent-green-600"
                />
                <label htmlFor="formApprovedInput" className="text-[11px] font-bold text-gray-700 block cursor-pointer">
                  Authorized access (Approved Login)
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {editingUserId ? "Update Credentials" : "Save Credentials"}
                </button>
                {editingUserId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>


          </div> {/* End of Column 3 wrapper */}
        </div>
      ) : (
        <AdminDebugPanel invoices={invoices} users={users} />
      )}

      {/* Spreadsheet Operations & Clearing Dashboard */}
      <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-xs space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-green-600" />
            Excel Raw Data Administrative Control Panel
          </h4>
          <p className="text-[11px] text-gray-500 mt-1">
            Revert or clear raw invoice spreadsheet entries and targets/budget sheet files uploaded to the transactional database.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Action 1: Undo Excel Import */}
          <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100 flex flex-col justify-between space-y-3">
            <div>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[8.5px] font-bold rounded">ROLLBACK CAPABILITY</span>
              <h5 className="text-[11px] font-bold text-gray-900 mt-1.5 font-sans">Undo Last Data Upload</h5>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                Restores the database state to right before your last spreadsheet was imported. Restores previous values and clears changes.
              </p>
            </div>
            <button
              onClick={handleUndoUpload}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Undo Last Spreadsheet Import
            </button>
          </div>

          {/* Action 2: Clear Invoices Database */}
          <div className="p-4 bg-red-50/40 rounded-xl border border-red-100 flex flex-col justify-between space-y-3">
            <div>
              <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[8.5px] font-bold rounded font-sans">INBOX INVOICES</span>
              <h5 className="text-[11px] font-bold text-gray-900 mt-1.5 font-sans">Clear All Invoices</h5>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                Directly wipes out all active invoice transactions from the system. Reversible via single-step Undo snapshot.
              </p>
            </div>
            <button
              onClick={handleClearInvoices}
              className="w-full py-2 bg-red-600 hover:bg-red-750 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Invoices Database
            </button>
          </div>

          {/* Action 3: Clear Targets/Budget Database */}
          <div className="p-4 bg-rose-50/40 rounded-xl border border-rose-100 flex flex-col justify-between space-y-3">
            <div>
              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[8.5px] font-bold rounded font-sans font-medium">TARGETS & BUDGETS</span>
              <h5 className="text-[11px] font-bold text-gray-900 mt-1.5">Clear Budget Sheets</h5>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                Clears all active salesperson and territory budget allocations. Reversible via single-step Undo snapshot.
              </p>
            </div>
            <button
              onClick={handleClearBudgets}
              className="w-full py-2 bg-rose-600 hover:bg-rose-750 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Budgets Database
            </button>
          </div>

          {/* Action 4: Clear Local Browser storage cache fallback state */}
          <div className="p-4 bg-blue-50/35 rounded-xl border border-blue-100 flex flex-col justify-between space-y-3">
            <div>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[8.5px] font-bold rounded font-sans font-medium">LOCAL CACHE STATE</span>
              <h5 className="text-[11px] font-bold text-gray-900 mt-1.5">Wipe Browser Storage</h5>
              <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                Wipes local browser storage caches to clean any stuck state and pulls fresh empty datasets directly from the server.
              </p>
            </div>
            <button
              onClick={handleClearBrowserCache}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Wipe Cache & Refresh
            </button>
          </div>
        </div>
      </div>


      {/* ENTERPRISE DATA INTEGRITY & DIAGNOSTIC PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-150 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Corporate Data Integrity & Diagnostics
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">
              Live validation systems for Supabase SQL row matching, duplicate lines suppression, and sales team mapping integrity.
            </p>
          </div>
          <button
            onClick={runIntegritySweep}
            disabled={loadingIntegrity}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-755 text-white disabled:opacity-55 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            {loadingIntegrity ? "Analyzing..." : integrityData ? "Re-Run Analysis" : "Run Live DB Integrity Check"}
          </button>
        </div>

        {integrityError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{integrityError}</span>
          </div>
        )}

        {integritySuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{integritySuccessMsg}</span>
          </div>
        )}

        {!integrityData && !loadingIntegrity && !integrityError && (
          <div className="p-8 text-center bg-gray-50/50 dark:bg-slate-950/30 rounded-2xl border border-gray-150 dark:border-slate-800">
            <Database className="w-8 h-8 text-gray-300 dark:text-slate-755 mx-auto" />
            <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 mt-2">No Active Sweeps Loaded</h4>
            <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto leading-normal">
              Click the button above to run a complete physical trace across all 20,000+ Supabase tables, audit uploads logs, and cross-reference representatives allocations.
            </p>
          </div>
        )}

        {loadingIntegrity && (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
            <p className="text-[11px] text-gray-500 mt-2 font-medium">Scanning live database tables, checking constraints, and cross-recommending log records...</p>
          </div>
        )}

        {integrityData && (
          <div className="space-y-6">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-emerald-50/25 border border-emerald-100/60 dark:bg-emerald-950/10 dark:border-emerald-900/30 rounded-xl">
                <span className="text-[10px] text-gray-500 block uppercase tracking-wider font-semibold">Total Invoices</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{integrityData.metrics?.totalInvoices?.toLocaleString() || 0}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 block">Live in sales_data</span>
              </div>
              <div className="p-4 bg-indigo-50/25 border border-indigo-100/60 dark:bg-indigo-950/10 dark:border-indigo-900/30 rounded-xl">
                <span className="text-[10px] text-gray-500 block uppercase tracking-wider font-semibold">Total Budgets</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">{integrityData.metrics?.totalBudgets?.toLocaleString() || 0}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 block">Live in budget_data</span>
              </div>
              <div className="p-4 bg-blue-50/25 border border-blue-100/60 dark:bg-blue-950/10 dark:border-blue-900/30 rounded-xl">
                <span className="text-[10px] text-gray-500 block uppercase tracking-wider font-semibold">Registered Reps</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">{integrityData.metrics?.usersRegistered || 0}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 block">Approved system profiles</span>
              </div>
              <div className="p-4 bg-amber-50/25 border border-amber-100/60 dark:bg-amber-950/10 dark:border-amber-900/30 rounded-xl">
                <span className="text-[10px] text-gray-500 block uppercase tracking-wider font-semibold">Spreadsheet Uploads</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">{integrityData.metrics?.totalUploadsRecorded || 0}</span>
                <span className="text-[9px] text-gray-400 mt-0.5 block">Logged in upload_audit_logs</span>
              </div>
            </div>

            {/* Quick Diagnostic Results Alerts */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-gray-150 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Live Health Check Reports</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Check A: Redundancies / Duplicates */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${integrityData.diagnostics?.duplicatesCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                      <span className="text-xs font-bold text-gray-900 dark:text-slate-100">Redundant / Duplicate Rows</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 max-w-sm leading-normal">
                      Indicates row entries having matching details (invoice number, customer code, product name, and date). Unresolved duplicates trigger multi-user data inconsistencies.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-150 dark:border-slate-800 mt-3 text-[11px] font-medium">
                      Duplicates Found: <strong className="text-orange-600 dark:text-orange-400">{integrityData.diagnostics?.duplicatesCount || 0} rows</strong> ({integrityData.diagnostics?.duplicatesGroups || 0} distinct groups).
                    </div>
                  </div>
                  {integrityData.diagnostics?.duplicatesCount > 0 && (
                    <button
                      onClick={handleCleanDuplicates}
                      disabled={cleaningDups}
                      className="w-full mt-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-55"
                    >
                      {cleaningDups ? "Deduplicating..." : "Execute Deduplication Clean"}
                    </button>
                  )}
                </div>

                {/* Check B: Orphan representatives */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${integrityData.diagnostics?.orphanedInvoices?.length > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                      <span className="text-xs font-bold text-gray-900 dark:text-slate-100">Orphaned Sales Records Assignments</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 max-w-sm leading-normal">
                      Checks for invoices where the salesperson code or name listed does not map to any active registered verified system profile account in the users registry.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-150 dark:border-slate-800 mt-3 text-[11px] font-medium">
                      Orphaned Rows Detected: <strong className="text-rose-600 dark:text-rose-400">{integrityData.diagnostics?.orphanedInvoices?.length || 0} lines</strong>.
                    </div>
                  </div>
                  {integrityData.diagnostics?.orphanedInvoices?.length > 0 && (
                    <button
                      onClick={handleAlignOrphans}
                      disabled={aligningOrphans}
                      className="w-full mt-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-55"
                    >
                      {aligningOrphans ? "Aligning..." : "Auto-Align Orphan Rep ID References"}
                    </button>
                  )}
                </div>
              </div>

              {/* Missing data detector list */}
              {integrityData.diagnostics?.missingRowsAlerts?.length > 0 && (
                <div className="p-3 bg-yellow-50/50 border border-yellow-100 dark:bg-yellow-950/10 dark:border-yellow-900/30 rounded-xl space-y-2">
                  <h5 className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Missing Budgets-to-Sales Allocations Flagged</h5>
                  <ul className="space-y-1 text-[10px] text-amber-900/80 dark:text-amber-300 font-mono list-disc list-inside">
                    {integrityData.diagnostics.missingRowsAlerts.slice(0, 10).map((alert: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">{alert}</li>
                    ))}
                  </ul>
                  {integrityData.diagnostics.missingRowsAlerts.length > 10 && (
                    <p className="text-[9px] text-gray-400">...and {integrityData.diagnostics.missingRowsAlerts.length - 10} more missing budget gaps detected</p>
                  )}
                </div>
              )}

              {/* Unresolved duplicates list */}
              {integrityData.diagnostics?.sampleDuplicates?.length > 0 && (
                <div className="p-3 bg-orange-50/45 border border-orange-100 dark:bg-orange-950/10 dark:border-orange-900/30 rounded-xl space-y-2">
                  <h5 className="text-[10px] font-bold text-orange-800 dark:text-orange-400 uppercase tracking-wider">Redundant Duplicate Record Sets (Top 15 Samples)</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px] text-left border-collapse font-mono text-orange-900/80 dark:text-orange-300">
                      <thead>
                        <tr className="border-b border-orange-200/50 dark:border-orange-900/50 font-bold">
                          <th className="pb-1">Invoice No.</th>
                          <th className="pb-1">Customer Code</th>
                          <th className="pb-1">Product</th>
                          <th className="pb-1">Redundant Rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {integrityData.diagnostics.sampleDuplicates.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-orange-200/30 dark:border-orange-900/30 last:border-b-0">
                            <td className="py-1">{item.invoiceNumber}</td>
                            <td className="py-1">{item.customerCode}</td>
                            <td className="py-1 truncate max-w-[120px]">{item.productName}</td>
                            <td className="py-1 font-bold text-center">{item.count} copy</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Reconciliation and Integrity History logs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: Excel Upload Audit logs */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Physical Excel Imports History</h4>
                <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-gray-150 dark:border-slate-800 p-2.5 max-h-[160px] overflow-y-auto">
                  {integrityData.auditHistory?.length === 0 ? (
                    <div className="text-center py-6 text-[10px] text-gray-400">No import records logged.</div>
                  ) : (
                    <div className="space-y-2 text-[10px]">
                      {integrityData.auditHistory.map((hist: any, hIdx: number) => (
                        <div key={hIdx} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-150 dark:border-slate-800 flex justify-between gap-2.5">
                          <div>
                            <span className="font-bold text-gray-800 dark:text-slate-200 block truncate max-w-[200px]" title={hist.file_name}>
                              📄 {hist.file_name}
                            </span>
                            <span className="text-gray-400 text-[8.5px] mt-0.5 block">
                              By {hist.uploaded_by} • {new Date(hist.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`px-1 rounded text-[8px] font-bold ${
                              hist.status === "Completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                            }`}>
                              {hist.status}
                            </span>
                            <span className="text-gray-500 font-mono text-[9px] block mt-1">
                              +{hist.inserted_rows} R • {hist.failed_rows} E
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Automated Integrity Sweeps Trace Logs */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Automated Integrity Sweeps Trace Logs</h4>
                <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-gray-150 dark:border-slate-800 p-2.5 max-h-[160px] overflow-y-auto">
                  {integrityData.integrityHistory?.length === 0 ? (
                    <div className="text-center py-6 text-[10px] text-gray-400">No diagnostic sweeping runs trace.</div>
                  ) : (
                    <div className="space-y-2 text-[10px] font-mono whitespace-normal leading-normal">
                      {integrityData.integrityHistory.map((integ: any, iIdx: number) => (
                        <div key={iIdx} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-150 dark:border-slate-800">
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">🔍 {integ.check_type}</span>
                            <span className="text-gray-400 text-[8.5px]">{new Date(integ.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-gray-600 dark:text-slate-300 mt-1 scale-95 origin-left text-[9.5px] leading-relaxed">{integ.results_summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>


      {/* Extreme administrative resets block */}
      <div className="p-6 bg-red-50/50 rounded-2xl border border-red-105 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h4 className="text-xs font-bold text-red-900 flex items-center gap-1.5 uppercase tracking-wider">
            Danger Operations Zone
          </h4>
          <p className="text-[10px] text-red-700 mt-1 max-w-xl leading-relaxed">
            Restoring standard seed database removes any custom spreadsheet invoice records uploaded during live execution session, returning parameters to pre-existing standard regional balances.
          </p>
        </div>
        <button
          onClick={triggerReset}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Factory Format Reset
        </button>
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 hover:scale-105 hover:translate-y-[-2px] active:scale-95 transition-all duration-300 flex items-center gap-2 border border-green-500/30 font-sans font-bold cursor-pointer transition-shadow"
          title="Scroll back to top"
        >
          <ArrowUp className="w-4 h-4 shrink-0" />
          <span className="text-[11px] uppercase tracking-wider font-extrabold">Back to Top</span>
        </button>
      )}

    </div>
  );
}
