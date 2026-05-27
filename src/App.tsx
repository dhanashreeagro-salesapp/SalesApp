/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Award,
  Upload,
  Calendar,
  Sparkles,
  Settings,
  Users,
  Shield,
  FileText,
  HelpCircle,
  FolderSync,
  Layers,
  Database,
  Briefcase,
  Sliders,
  ChevronDown,
  Info
} from "lucide-react";
import { InvoiceItem, BudgetItem, UserProfile, AuditLog, EmailLog } from "./types";
import { SEED_USERS } from "./data/seedData";
import { compileAnalytics } from "./utils/analytics";
import ExecutiveDashboard from "./components/ExecutiveDashboard";
import UploadCenter from "./components/UploadCenter";
import AiAssistant from "./components/AiAssistant";
import EmailScheduler from "./components/EmailScheduler";
import AdminSettings from "./components/AdminSettings";
import LoginScreen from "./components/LoginScreen";

export default function App() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [selectedUser, setSelectedUser] = useState<UserProfile>(SEED_USERS[0]); // Default to Sales Director
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab ] = useState<"executive" | "upload" | "scheduler" | "advisor" | "admin">("executive");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);

  // Sync state from server on reload
  const fetchDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/db");
      const data = await response.json();
      setInvoices(data.invoices || []);
      setBudgets(data.budgets || []);
      setAuditLogs(data.auditLogs || []);
      setEmailLogs(data.emailLogs || []);
      setUsers(data.users || SEED_USERS);
      
      // Update our selected user state in case list changed
      const localSession = localStorage.getItem("agroSalesSession");
      if (localSession) {
        const savedUser = JSON.parse(localSession);
        const currentInList = (data.users || SEED_USERS).find((u: any) => u.email.toLowerCase() === savedUser.email.toLowerCase());
        if (currentInList) {
          setSelectedUser(currentInList);
          setIsAuthenticated(true);
        }
      } else {
        const currentInList = (data.users || SEED_USERS).find((u: any) => u.id === selectedUser.id);
        if (currentInList) setSelectedUser(currentInList);
      }
    } catch (e) {
      console.error("Failed to load full-stack persistent database", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  const handleLoginSuccess = (user: UserProfile) => {
    setSelectedUser(user);
    setIsAuthenticated(true);
    localStorage.setItem("agroSalesSession", JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("agroSalesSession");
    if (users.length > 0) {
      setSelectedUser(users[0]);
    } else {
      setSelectedUser(SEED_USERS[0]);
    }
  };

  // Add/Update User from Settings panel or login signup
  const handleSaveUser = async (userPayload: any) => {
    try {
      const response = await fetch("/api/users/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: userPayload,
          initiator: selectedUser
        })
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        const updatedSelf = data.users.find((u: any) => u.email.toLowerCase() === selectedUser.email.toLowerCase());
        if (updatedSelf) {
          setSelectedUser(updatedSelf);
          localStorage.setItem("agroSalesSession", JSON.stringify(updatedSelf));
        }
        await fetchDatabase();
        return true;
      }
    } catch (e) {
      console.error("Failed to save credentials", e);
    }
    return false;
  };

  // Revoke credentials
  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          initiator: selectedUser
        })
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        await fetchDatabase();
        return true;
      }
    } catch (e) {
      console.error("Failed to suspend credentials", e);
    }
    return false;
  };

  // Save parsed spreadsheets back to persistent server database
  const handleUploadedFiles = async (newInvoices: InvoiceItem[], newBudgets: BudgetItem[]) => {
    setIsSyncing(true);
    let updatedInvoices = [...invoices];
    let updatedBudgets = [...budgets];

    if (newInvoices.length > 0) {
      // Merge: keeping existing, appending new
      updatedInvoices = [...newInvoices, ...updatedInvoices];
    }
    if (newBudgets.length > 0) {
      updatedBudgets = [...newBudgets, ...updatedBudgets];
    }

    try {
      const response = await fetch("/api/db/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoices: updatedInvoices,
          budgets: updatedBudgets,
          userDetails: selectedUser
        })
      });
      const data = await response.json();
      if (data.success) {
        // Redraw local states
        setInvoices(updatedInvoices);
        setBudgets(updatedBudgets);
        
        // Refresh entire state (brings updated audit logs)
        await fetchDatabase();
      }
    } catch (err) {
      console.error("Error saving to database", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Simulates monthly campaign triggers
  const triggerCampaignSimulation = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch("/api/email/scheduler/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userTriggering: selectedUser,
          contextData: {
            totalCurrentSales: activeAnalytics.currentYtdSales,
            growthPercent: activeAnalytics.growthPercent,
            regions: activeAnalytics.regionPerformances,
            salespersons: activeAnalytics.salespersonRankings,
            droppedCustomers: activeAnalytics.droppedCustomers,
            decliningProductsVal: activeAnalytics.decliningProductsVal,
            newCustomers: activeAnalytics.newCustomers,
            lostCustomers: activeAnalytics.lostCustomers,
          }
        })
      });
      if (response.ok) {
        await fetchDatabase();
      }
    } catch (e) {
      console.error("Scheduler run error", e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Reset database back to default seed setup
  const handleResetDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/db/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDetails: selectedUser })
      });
      if (response.ok) {
        await fetchDatabase();
      }
    } catch (e) {
      console.error("Database reset error", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Compile operational metrics dynamically on the client based on selected role
  const activeAnalytics = compileAnalytics(invoices, budgets, selectedUser);

  // Filter local dashboard listings dynamically based on filter values
  const [activeFilters, setActiveFilters] = useState({
    company: "All",
    rm: "All",
    category: "All",
    searchQuery: "",
  });

  const handleFilterUpdate = (filters: typeof activeFilters) => {
    setActiveFilters(filters);
  };

  const getFilteredAnalytics = () => {
    let filteredInvoices = [...invoices];
    
    // Apply role-based scoping first
    filteredInvoices = filteredInvoices.filter(inv => {
      if (selectedUser.role === "Sales Director" || selectedUser.role === "Admin") return true;
      if (selectedUser.role === "Regional Manager") {
        return inv.region === selectedUser.region || inv.regionalManager === selectedUser.name;
      }
      if (selectedUser.role === "Salesperson") {
        return inv.salesperson === selectedUser.name || inv.territory === selectedUser.territory;
      }
      return false;
    });

    // Apply dashboard filters
    if (activeFilters.company !== "All") {
      filteredInvoices = filteredInvoices.filter(inv => inv.company === activeFilters.company);
    }
    if (activeFilters.rm !== "All") {
      filteredInvoices = filteredInvoices.filter(inv => inv.regionalManager === activeFilters.rm);
    }
    if (activeFilters.category !== "All") {
      filteredInvoices = filteredInvoices.filter(inv => inv.productCategory === activeFilters.category);
    }
    if (activeFilters.searchQuery.trim() !== "") {
      const q = activeFilters.searchQuery.toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv => 
        inv.customerName.toLowerCase().includes(q) || 
        inv.customerCode.toLowerCase().includes(q) ||
        inv.productName.toLowerCase().includes(q)
      );
    }

    return compileAnalytics(filteredInvoices, budgets, selectedUser);
  };

  const analyticsToRender = getFilteredAnalytics();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin text-green-600">
          <FolderSync className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-gray-900">Synchronizing AgroSales IQ Datasets</h3>
          <p className="text-[11px] text-gray-500 mt-1">Downloading transaction records, supervisor assignments, and AI schemas...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        users={users}
        onLoginSuccess={handleLoginSuccess}
        onRegisterUser={handleSaveUser}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col antialiased">
      
      {/* Upper Navigation Global Header Bar */}
      <header className="bg-white border-b border-gray-150 sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center text-white">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 tracking-tight leading-none">AgroSales IQ</h1>
            <p className="text-[10px] text-gray-500 font-medium mt-0.5">Enterprise Sales Intelligence Suite</p>
          </div>
        </div>

        {/* Dynamic Logged-in Persona Swapper Panel */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
              className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100/80 px-4 py-2 rounded-xl text-xs text-left transition focus:outline-none"
            >
              <div>
                <div className="text-[10px] uppercase font-semibold tracking-wider text-gray-400">Viewing Role Scope</div>
                <div className="font-bold text-gray-900 flex items-center gap-1 mt-0.5">
                  {selectedUser.name} ({selectedUser.role === "Regional Manager" ? `RM ${selectedUser.region}` : selectedUser.role})
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                </div>
              </div>
            </button>

            {showPersonaDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-2 space-y-1">
                <div className="px-3 py-1.5 text-[10px] text-gray-450 uppercase font-semibold">Switch Persona (Interactive RLS testing)</div>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setShowPersonaDropdown(false);
                      // Clear filters on role switch to avoid empty states
                      setActiveFilters({ company: "All", rm: "All", category: "All", searchQuery: "" });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                      selectedUser.id === u.id ? "bg-green-50 text-green-700 font-bold" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <div>{u.name}</div>
                      <div className="text-[9px] text-gray-450 font-normal">{u.role} {u.region ? `• ${u.region}` : ""} {u.territory ? `• ${u.territory}` : ""}</div>
                    </div>
                    {selectedUser.id === u.id && <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="Terminate Secure Session"
          >
            🔒 Logout
          </button>
        </div>
      </header>

      {/* Main Structural Enterprise Layout Drawer */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 bg-white border-r border-gray-150 shrink-0 p-4 space-y-6">
          
          {/* Active User Information Box */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Active Security Profile</span>
            </div>
            <div className="text-xs space-y-1">
              <div className="font-bold text-gray-950 truncate">{selectedUser.name}</div>
              <div className="text-[10px] text-gray-500">Security Clearance: {selectedUser.role === "Regional Manager" ? `RM West Superviser` : selectedUser.role}</div>
              {selectedUser.region && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-semibold mt-1">
                  Region: {selectedUser.region}
                </div>
              )}
            </div>
          </div>

          {/* Nav menu links list */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block px-3 mb-2">Platform Navigation</span>
            
            <button
              onClick={() => setActiveTab("executive")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "executive" ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              Executive Dashboard
            </button>

            <button
              onClick={() => setActiveTab("advisor")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "advisor" ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              AI Insights Assistant
            </button>

            <button
              onClick={() => setActiveTab("upload")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "upload" ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Upload className="w-4 h-4 shrink-0" />
              Excel Upload Center
            </button>

            <button
              onClick={() => setActiveTab("scheduler")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "scheduler" ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              Campaign Scheduler
            </button>

            <button
              onClick={() => setActiveTab("admin")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "admin" ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              Platform Settings
            </button>
          </div>

          <div className="pt-8 border-t border-gray-100 space-y-2 text-[10px] text-gray-450 leading-relaxed font-semibold">
            <div className="flex items-center gap-1 text-gray-500 uppercase tracking-wide">
              <Info className="w-3.5 h-3.5" />
              <span>RLS Row Scoping Active</span>
            </div>
            <p className="font-normal">
              CRM dashboard elements, KPIs, Recharts summaries and AI advisory prompts automatically filter based on the logged-in user profile.
            </p>
          </div>

        </aside>

        {/* Primary Content Canvas */}
        <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-x-hidden">
          
          {/* Active component switch */}
          {activeTab === "executive" && (
            <ExecutiveDashboard
              analytics={analyticsToRender}
              onFilterChange={handleFilterUpdate}
              currentUser={selectedUser}
            />
          )}

          {activeTab === "upload" && (
            <UploadCenter
              onDataUploaded={handleUploadedFiles}
              currentUser={selectedUser}
              existingInvoicesCount={invoices.length}
              existingBudgetsCount={budgets.length}
              onResetDatabase={handleResetDatabase}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === "advisor" && (
            <AiAssistant
              currentUser={selectedUser}
              analytics={analyticsToRender}
            />
          )}

          {activeTab === "scheduler" && (
            <EmailScheduler
              emailLogs={emailLogs}
              onTriggerSimulate={triggerCampaignSimulation}
              currentUser={selectedUser}
              isSimulating={isSimulating}
              analytics={analyticsToRender}
            />
          )}

          {activeTab === "admin" && (
            <AdminSettings
              auditLogs={auditLogs}
              onResetDatabase={handleResetDatabase}
              currentUser={selectedUser}
              users={users}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

        </main>

      </div>

    </div>
  );
}
