/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
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
  Info,
  Terminal,
  Target,
  AlertTriangle,
  X
} from "lucide-react";
import { InvoiceItem, BudgetItem, UserProfile, AuditLog, EmailLog } from "./types";
import { SEED_USERS } from "./data/seedData";
import { compileAnalytics, filterDataByRole } from "./utils/analytics";
import ExecutiveDashboard from "./components/ExecutiveDashboard";
import UploadCenter from "./components/UploadCenter";
import AiAssistant from "./components/AiAssistant";
import EmailScheduler from "./components/EmailScheduler";
import AdminSettings from "./components/AdminSettings";
import LoginScreen from "./components/LoginScreen";
import InvoiceLedger from "./components/InvoiceLedger";
import BudgetLedger from "./components/BudgetLedger";
import AuditLogsView from "./components/AuditLogsView";
import dhanashreeLogo from "./assets/images/dhanashree_logo_1779970374585.png";
import { 
  isSupabaseConfigured, 
  fetchUsersFromSupabase, 
  fetchSalesDataFromSupabase, 
  fetchBudgetDataFromSupabase,
  fetchEmailLogsFromSupabase,
  fetchAuditLogsFromSupabase,
  saveUserProfileToSupabase,
  deleteUserFromSupabase,
  saveBudgetsToSupabase,
  clearAllSalesData,
  clearAllBudgetsData
} from "./lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Safely resolve build constants injected by Vite at compile time
declare const __COMMIT_HASH__: string;
declare const __BUILD_TIME__: string;

const BUILD_VERSION = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev-local';
const BUILD_TIMESTAMP = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'Just now';

const safeSetLocalStorage = (key: string, value: string) => {
  if (key === "agroSalesInvoices" || key === "agroSalesBudgets") {
    return; // Bypass client-side local caching for large datasets to prevent browser QuotaExceeded crash hazards
  }
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Local Storage write failed for key "${key}". Browser storage quota exceeded, but transaction is safely written to the backend server.`, error);
  }
};

export default function App() {
  const isVercelOrStatic = typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("github.io"));
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reconciliationWarning, setReconciliationWarning] = useState<{
    mismatch: boolean;
    loadedCount: number;
    dbCount: number;
    message: string;
  } | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserProfile>(SEED_USERS[0]); // Default to Sales Director
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab ] = useState<"executive" | "upload" | "scheduler" | "advisor" | "admin" | "ledger" | "audit" | "budget-ledger">("executive");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    } catch (_) {
      return "light";
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", theme);
    } catch (_) {}
  }, [theme]);

  // Sync state from server on reload
  const fetchDatabase = async (skipLoading = false) => {
    if (!skipLoading) setIsLoading(true);
    try {
      let serverInvoices: InvoiceItem[] = [];
      let serverBudgets: BudgetItem[] = [];
      let serverAuditLogs: AuditLog[] = [];
      let serverEmailLogs: EmailLog[] = [];
      let serverUsers: UserProfile[] = [];
      let loadedFromBackend = false;
      try {
        const response = await fetch(`${API_BASE}/api/db`);
        if (response.ok) {
          const data = await response.json();
          serverInvoices = data.invoices || [];
          serverBudgets = data.budgets || [];
          serverAuditLogs = data.auditLogs || [];
          serverEmailLogs = data.emailLogs || [];
          serverUsers = data.users || [];
          loadedFromBackend = true;
          console.log("Database Sync: Loaded all records successfully from local Express API backend.");
        }
      } catch (err) {
        console.warn("Local backend API not responding, falling back to direct Supabase queries:", err);
      }

      if (!loadedFromBackend) {
        if (isSupabaseConfigured()) {
          console.log("Supabase Cloud Sync: Fetching records directly from PostgreSQL...");
          [serverUsers, serverInvoices, serverBudgets, serverEmailLogs, serverAuditLogs] = await Promise.all([
            fetchUsersFromSupabase(),
            fetchSalesDataFromSupabase(),
            fetchBudgetDataFromSupabase(),
            fetchEmailLogsFromSupabase(),
            fetchAuditLogsFromSupabase()
          ]);
        } else {
          serverInvoices = [];
          serverBudgets = [];
          serverAuditLogs = [];
          serverEmailLogs = [];
          serverUsers = [...SEED_USERS];
        }
      }
      
      setInvoices(serverInvoices);
      setBudgets(serverBudgets);
      setAuditLogs(serverAuditLogs);
      setEmailLogs(serverEmailLogs);

      // Row count reconciliation check
      if (isSupabaseConfigured()) {
        try {
          const { getSupabase } = await import("./lib/supabaseClient");
          const sb = getSupabase();
          if (sb) {
            const { count, error } = await sb.from("sales_data").select("*", { count: "exact", head: true });
            if (!error && count !== null) {
              if (count !== serverInvoices.length) {
                const message = `Loaded ${serverInvoices.length} invoices in memory, but Supabase sales_data table contains ${count} rows.`;
                setReconciliationWarning({
                  mismatch: true,
                  loadedCount: serverInvoices.length,
                  dbCount: count,
                  message
                });
                console.warn(message);
              } else {
                setReconciliationWarning(null);
              }
            }
          }
        } catch (recErr) {
          console.warn("Failed to perform row count reconciliation check:", recErr);
        }
      } else {
        setReconciliationWarning(null);
      }
      
      // Retrieve user profiles from browser local storage to preserve admin user-corrected details (e.g., Gajanan's email)
      const cachedUsersStr = localStorage.getItem("agroSalesUsersList");
      let parsedCachedUsers: any[] = [];
      if (cachedUsersStr && cachedUsersStr !== "[]") {
        try {
          parsedCachedUsers = JSON.parse(cachedUsersStr);
        } catch (_) {}
      }

      const loadedUsers = serverUsers.length > 0 ? serverUsers : [...SEED_USERS];
      
      // Merge loaded server users with cached user profiles to persist admin edits
      const mergedUsers = loadedUsers.map((u: any) => {
        const cachedMatch = parsedCachedUsers.find(
          (c: any) => 
            (c.email && u.email && c.email.trim().toLowerCase() === u.email.trim().toLowerCase()) ||
            (c.id && u.id && c.id === u.id)
        );
        if (cachedMatch) {
          return {
            ...cachedMatch,
            ...u,
            id: u.id || cachedMatch.id
          };
        }
        return u;
      });

      // Identify cached users that are missing from the server list (Self-healing recovery)
      const missingFromServer = parsedCachedUsers.filter((cachedUser: any) => {
        if (!cachedUser.email) return false;
        return !loadedUsers.some((serverUser: any) => 
          (serverUser.email && serverUser.email.trim().toLowerCase() === cachedUser.email.trim().toLowerCase()) ||
          (serverUser.id && serverUser.id === cachedUser.id)
        );
      });

      // Append missing users to mergedUsers
      if (missingFromServer.length > 0) {
        console.log(`Self-healing sync: Restoring ${missingFromServer.length} local storage users missing from server...`, missingFromServer);
        mergedUsers.push(...missingFromServer);
      }

      // Ensure critical Dhanashree and admin credentials are fully configured with custom passwords
      const verifiedUsers = mergedUsers.map((u: any) => {
        const withApproval = { ...u, approved: u.approved !== false };
        if (withApproval.email && withApproval.email.toLowerCase() === "dhanashree.agro@gmail.com" && !withApproval.password) {
          return { ...withApproval, password: "MyWorld99", approved: true };
        }
        if (withApproval.email && withApproval.email.toLowerCase() === "admin@agroiq.com" && !withApproval.password) {
          return { ...withApproval, password: "admin123", approved: true };
        }
        return withApproval;
      });

      // Ensure all preloaded seed users exist in the client verifiedUsers list (Uniquely matched by email id)
      if (!isSupabaseConfigured() && !loadedFromBackend) {
        SEED_USERS.forEach((seedUser: any) => {
          if (!verifiedUsers.some((u: any) => 
            u.email && seedUser.email && u.email.toLowerCase() === seedUser.email.toLowerCase()
          )) {
            verifiedUsers.push({ ...seedUser, approved: true, password: "password123" });
          }
        });
      }

      // Quick double check: if dhanashree is somehow absent from list, prepend/append her
      if (!verifiedUsers.some((u: any) => u.email && u.email.toLowerCase() === "dhanashree.agro@gmail.com")) {
        verifiedUsers.push({
          id: "user_dhanashree",
          name: "Dhanashree Agro",
          email: "dhanashree.agro@gmail.com",
          role: "Admin",
          password: "MyWorld99",
          approved: true
        });
      }

      // Resolve managerName from managerId dynamically for all loaded users
      verifiedUsers.forEach((u: any) => {
        if (u.managerId) {
          const mgr = verifiedUsers.find((m: any) => m.id === u.managerId);
          if (mgr) {
            u.managerName = mgr.name;
          } else {
            u.managerName = undefined;
          }
        } else {
          u.managerName = undefined;
        }
      });

      // Trigger background sync upload for the self-healed missing users
      if (missingFromServer.length > 0) {
        (async () => {
          try {
            if (isSupabaseConfigured()) {
              const { saveUserProfilesToSupabase } = await import("./lib/supabaseClient");
              await saveUserProfilesToSupabase(missingFromServer, verifiedUsers);
            } else {
              await fetch(`${API_BASE}/api/users/save-bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  users: missingFromServer,
                  initiator: selectedUser
                })
              });
            }
            console.log("Self-healing background user sync upload completed successfully.");
          } catch (syncErr) {
            console.warn("Self-healing background user sync upload failed:", syncErr);
          }
        })();
      }

      setUsers(verifiedUsers);
      
      // Save client backup snapshot securely using final healed states to preserve data
      safeSetLocalStorage("agroSalesAuditLogs", JSON.stringify(serverAuditLogs));
      safeSetLocalStorage("agroSalesEmailLogs", JSON.stringify(serverEmailLogs));
      safeSetLocalStorage("agroSalesUsersList", JSON.stringify(verifiedUsers));

      // Update our selected user state in case list changed
      const localSession = localStorage.getItem("agroSalesSession");
      if (localSession && localSession !== "undefined" && localSession !== "null") {
        try {
          const savedUser = JSON.parse(localSession);
          const currentInList = verifiedUsers.find((u: any) => u.email && savedUser?.email && (
            u.email.toLowerCase() === savedUser.email.toLowerCase() ||
            (savedUser.email.toLowerCase() === "mdamodare@gmail.com" && u.email.toLowerCase() === "rahul@plantnutrition.in")
          ));
          if (currentInList) {
            setSelectedUser(currentInList);
            setIsAuthenticated(true);
          }
        } catch (err) {
          console.error("Corrupt session data detected. Cleaning session storage cache.", err);
          localStorage.removeItem("agroSalesSession");
        }
      } else {
        const currentInList = verifiedUsers.find((u: any) => u.id === selectedUser?.id);
        if (currentInList) setSelectedUser(currentInList);
      }
    } catch (e) {
      console.warn("Could not query server backend API. Booting high-fidelity local cache/local storage fallback engine.", e);
      
      // Fallback Engine (No invoice or budget falls back to local cache)
      const fallbackAuditLogsStr = localStorage.getItem("agroSalesAuditLogs");
      const fallbackEmailLogsStr = localStorage.getItem("agroSalesEmailLogs");
      const fallbackUsersStr = localStorage.getItem("agroSalesUsersList");

      let localInvoices: InvoiceItem[] = [];
      let localBudgets: BudgetItem[] = [];
      let localAuditLogs: AuditLog[] = [];
      let localEmailLogs: EmailLog[] = [];
      let localUsersList: UserProfile[] = [];

      if (fallbackAuditLogsStr) {
        try { localAuditLogs = JSON.parse(fallbackAuditLogsStr); } catch (_) {}
      }
      if (fallbackEmailLogsStr) {
        try { localEmailLogs = JSON.parse(fallbackEmailLogsStr); } catch (_) {}
      }
      if (fallbackUsersStr) {
        try { localUsersList = JSON.parse(fallbackUsersStr); } catch (_) {}
      }

      if (localUsersList.length === 0) {
        localUsersList = [...SEED_USERS];
        safeSetLocalStorage("agroSalesUsersList", JSON.stringify(localUsersList));
      }

      // Enforce the dhanashree user with password MyWorld99 exists and is in the list
      localUsersList = localUsersList.map((u: any) => {
        const withApproval = { ...u, approved: u.approved !== false };
        if (withApproval.email && withApproval.email.toLowerCase() === "dhanashree.agro@gmail.com") {
          return { ...withApproval, password: "MyWorld99", approved: true };
        }
        if (withApproval.email && withApproval.email.toLowerCase() === "admin@agroiq.com") {
          return { ...withApproval, password: "admin123", approved: true };
        }
        return withApproval;
      });

      if (!localUsersList.some((u: any) => u.email && u.email.toLowerCase() === "dhanashree.agro@gmail.com")) {
        localUsersList.push({
          id: "user_dhanashree",
          name: "Dhanashree Agro",
          email: "dhanashree.agro@gmail.com",
          role: "Admin",
          password: "MyWorld99",
          approved: true
        });
      }

      // Enforce admin@agroiq.com password too
      const foundIdx = localUsersList.findIndex((u: any) => u.email && u.email.toLowerCase() === "admin@agroiq.com");
      if (foundIdx >= 0 && !(localUsersList[foundIdx] as any).password) {
        (localUsersList[foundIdx] as any).password = "admin123";
      }

      // Sync state back
      setInvoices(localInvoices);
      setBudgets(localBudgets);
      setAuditLogs(localAuditLogs);
      setEmailLogs(localEmailLogs);
      setUsers(localUsersList);

      const localSession = localStorage.getItem("agroSalesSession");
      if (localSession && localSession !== "undefined" && localSession !== "null") {
        try {
          const savedUser = JSON.parse(localSession);
          const currentInList = localUsersList.find((u: any) => u.email && savedUser?.email && u.email.toLowerCase() === savedUser.email.toLowerCase());
          if (currentInList) {
            setSelectedUser(currentInList);
            setIsAuthenticated(true);
          }
        } catch (err) {
          console.error("Corrupt session fallback data detected. Cleaning session storage cache.", err);
          localStorage.removeItem("agroSalesSession");
        }
      } else {
        const currentInList = localUsersList.find((u: any) => u.id === selectedUser?.id);
        if (currentInList) setSelectedUser(currentInList);
      }
    } finally {
      if (!skipLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  const handleLoginSuccess = (user: UserProfile) => {
    setSelectedUser(user);
    setIsAuthenticated(true);
    setActiveTab("executive");
    safeSetLocalStorage("agroSalesSession", JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab("executive");
    localStorage.removeItem("agroSalesSession");
    if (users.length > 0) {
      setSelectedUser(users[0]);
    } else {
      setSelectedUser(SEED_USERS[0]);
    }
  };

  // Bulk upload users from spreadsheet
  const handleSaveUsersBulk = async (usersList: any[]) => {
    try {
      if (isSupabaseConfigured()) {
        const { saveUserProfilesToSupabase } = await import("./lib/supabaseClient");
        const success = await saveUserProfilesToSupabase(usersList, users);
        if (success) {
          await fetchDatabase(true);
          return { success: true, serverSynced: true };
        }
      }

      const response = await fetch(`${API_BASE}/api/users/save-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          users: usersList,
          initiator: selectedUser
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const verified = data.users.map((u: any) => {
            const withApproval = { ...u, approved: u.approved !== false };
            if (withApproval.email && withApproval.email.toLowerCase() === "dhanashree.agro@gmail.com") {
              return { ...withApproval, password: "MyWorld99", approved: true };
            }
            if (withApproval.email && withApproval.email.toLowerCase() === "admin@agroiq.com") {
              return { ...withApproval, password: "admin123", approved: true };
            }
            return withApproval;
          });
          setUsers(verified);
          safeSetLocalStorage("agroSalesUsersList", JSON.stringify(verified));
          await fetchDatabase(true);
          return { success: true, serverSynced: true };
        }
      }
      throw new Error(`Server returned HTTP ${response.status}`);
    } catch (e: any) {
      console.error("Failed bulk users save:", e);
      // Client-side fallback if offline
      const localUsersStr = localStorage.getItem("agroSalesUsersList") || "[]";
      let fallbackUsers: any[] = [];
      try { fallbackUsers = JSON.parse(localUsersStr); } catch (_) {}
      if (fallbackUsers.length === 0) fallbackUsers = [...users];

      usersList.forEach(u => {
        const compiledUser = {
          ...u,
          id: u.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          password: u.password || "password123"
        };
        const idx = fallbackUsers.findIndex(fu => fu.email.toLowerCase() === compiledUser.email.toLowerCase());
        if (idx >= 0) {
          fallbackUsers[idx] = compiledUser;
        } else {
          fallbackUsers.push(compiledUser);
        }
      });

      setUsers(fallbackUsers);
      safeSetLocalStorage("agroSalesUsersList", JSON.stringify(fallbackUsers));
      return { success: true, serverSynced: false, error: "Offline fallback cache merged: " + (e.message || e) };
    }
  };

  // Add/Update User from Settings panel or login signup
  const handleSaveUser = async (userPayload: any) => {
    let isEditing = false;
    try {
      if (isSupabaseConfigured()) {
        const success = await saveUserProfileToSupabase(userPayload, users);
        if (success) {
            await fetchDatabase(true);
            return { success: true, serverSynced: true };
        }
      }

      const response = await fetch(`${API_BASE}/api/users/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: userPayload,
          initiator: selectedUser
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Sync with verified passwords
          const verified = data.users.map((u: any) => {
            const withApproval = { ...u, approved: u.approved !== false };
            if (withApproval.email && withApproval.email.toLowerCase() === "dhanashree.agro@gmail.com") {
              return { ...withApproval, password: "MyWorld99", approved: true };
            }
            if (withApproval.email && withApproval.email.toLowerCase() === "admin@agroiq.com") {
              return { ...withApproval, password: "admin123", approved: true };
            }
            return withApproval;
          });
          setUsers(verified);
          safeSetLocalStorage("agroSalesUsersList", JSON.stringify(verified));
          
          const updatedSelf = verified.find((u: any) => u.email && selectedUser?.email && u.email.toLowerCase() === selectedUser.email.toLowerCase());
          if (updatedSelf) {
            setSelectedUser(updatedSelf);
            safeSetLocalStorage("agroSalesSession", JSON.stringify(updatedSelf));
          }
          await fetchDatabase(true); // Sync silently in backup
          return { success: true, serverSynced: true };
        }
      }
      throw new Error(`Server returned HTTP ${response.status}`);
    } catch (e: any) {
      console.error("Failed to save credentials to active backend server. Performing local storage signup fallback mechanism.", e);
    }

    // Client-side execution path fallback
    const localUsersStr = localStorage.getItem("agroSalesUsersList") || "[]";
    let fallbackUsers: any[] = [];
    try {
      fallbackUsers = JSON.parse(localUsersStr);
    } catch (_) {}

    if (fallbackUsers.length === 0) {
      fallbackUsers = [...users];
    }

    const compiledUser = {
      ...userPayload,
      id: userPayload.id || `user_${Date.now()}`,
      password: userPayload.password || "password123"
    };

    const idx = fallbackUsers.findIndex(u => u.email.toLowerCase() === compiledUser.email.toLowerCase());
    isEditing = idx >= 0;
    if (idx >= 0) {
      fallbackUsers[idx] = compiledUser;
    } else {
      fallbackUsers.push(compiledUser);
    }

    // Always enforce Dhanashree exists in local storage list with MyWorld99 too
    if (!fallbackUsers.some(u => u.email.toLowerCase() === "dhanashree.agro@gmail.com")) {
      fallbackUsers.push({
        id: "user_dhanashree",
        name: "Dhanashree Agro",
        email: "dhanashree.agro@gmail.com",
        role: "Admin",
        password: "MyWorld99"
      });
    }

    setUsers(fallbackUsers);
    safeSetLocalStorage("agroSalesUsersList", JSON.stringify(fallbackUsers));

    // Sign session if changed current
    if (selectedUser && compiledUser.email && selectedUser.email && compiledUser.email.toLowerCase() === selectedUser.email.toLowerCase()) {
      setSelectedUser(compiledUser);
      safeSetLocalStorage("agroSalesSession", JSON.stringify(compiledUser));
    }

    // Offline Audit Log record
    const localAuditStr = localStorage.getItem("agroSalesAuditLogs") || "[]";
    let fallbackLogs: any[] = [];
    try { fallbackLogs = JSON.parse(localAuditStr); } catch (_) {}
    fallbackLogs.unshift({
      timestamp: new Date().toISOString(),
      user: selectedUser?.name || "System Admin",
      action: isEditing ? "Edit User Profile" : "Register User Profile",
      details: `Safely managed credentials for ${compiledUser.name} (${compiledUser.role}) in workspace database cache.`,
      status: "Success"
    });
    setAuditLogs(fallbackLogs);
    safeSetLocalStorage("agroSalesAuditLogs", JSON.stringify(fallbackLogs));

    return { success: true, serverSynced: false, error: "Database offline fallback: saved in browser local storage only." };
  };

  // Revoke credentials
  const handleDeleteUser = async (userId: string) => {
    try {
      if (isSupabaseConfigured()) {
        const success = await deleteUserFromSupabase(userId);
        if (success) {
           await fetchDatabase(true);
           return true;
        }
      }

      const response = await fetch(`${API_BASE}/api/users/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          initiator: selectedUser
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUsers(data.users);
          await fetchDatabase();
          return true;
        }
      }
    } catch (e) {
      console.error("Failed to suspend credentials", e);
    }

    // Local fallback delete
    const localUsersStr = localStorage.getItem("agroSalesUsersList") || "[]";
    let fallbackUsers: any[] = [];
    try {
      fallbackUsers = JSON.parse(localUsersStr);
    } catch (_) {}

    fallbackUsers = fallbackUsers.filter(u => u.id !== userId);
    setUsers(fallbackUsers);
    safeSetLocalStorage("agroSalesUsersList", JSON.stringify(fallbackUsers));
    return true;
  };

  // Save parsed spreadsheets back to persistent server database
  const handleUploadedFiles = async (
    newInvoices: InvoiceItem[],
    newBudgets: BudgetItem[],
    duplicateAction: "replace" | "ignore" = "replace"
  ) => {
    setIsSyncing(true);
    try {
      // Direct call refresh from Supabase
      await fetchDatabase(true);
      return {
        success: true,
        serverSynced: true,
        totalInvoices: invoices.length,
        totalBudgets: budgets.length,
        newInvoicesCount: 0,
        newBudgetsCount: 0,
        duplicateResolution: duplicateAction
      };
    } catch (err: any) {
      console.error("Refresh failed:", err);
      return {
        success: false,
        serverSynced: false,
        error: err.message || "Failed to sync database changes.",
        totalInvoices: invoices.length,
        totalBudgets: budgets.length,
        newInvoicesCount: 0,
        newBudgetsCount: 0,
        duplicateResolution: duplicateAction
      };
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveBudgets = async (updatedBudgets: BudgetItem[]) => {
    setBudgets(updatedBudgets);
    safeSetLocalStorage("agroSalesBudgets", JSON.stringify(updatedBudgets));
    
    try {
      if (isSupabaseConfigured()) {
        const success = await saveBudgetsToSupabase(updatedBudgets, users);
        if (success) {
          await fetchDatabase(true);
          return;
        }
      }

      const response = await fetch(`${API_BASE}/api/db/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgets: updatedBudgets,
          userDetails: selectedUser
        })
      });
      if (response.ok) {
        await fetchDatabase(true);
      }
    } catch (err) {
      console.error("Failed to sync edited budgets with backend:", err);
    }
  };

  // Simulates monthly campaign triggers
  const triggerCampaignSimulation = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch(`${API_BASE}/api/email/scheduler/simulate`, {
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
        await fetchDatabase(true);
      }
    } catch (e) {
      console.warn("Scheduler run bypassed. Adding client model simulation logs.", e);
      // Fallback email logs simulation in local storage
      const localEmailStr = localStorage.getItem("agroSalesEmailLogs") || "[]";
      let fallbackEmails: any[] = [];
      try { fallbackEmails = JSON.parse(localEmailStr); } catch (_) {}

      const timestamp = new Date().toISOString();
      const mockCampaignEmails = [
        {
          id: `em_sim_offline_1`,
          dateSent: timestamp,
          recipientEmail: "rahul@plantnutrition.in",
          recipientName: "Rahul Sawant",
          recipientRole: "Sales Director",
          subject: "Dhanashree AgriPulse Offline Run: Corporate Executive Digest",
          bodyPreview: `<h3>Dear Sales Director Rahul Sawant,</h3><p>Operational YTD Sales reaches ₹${(activeAnalytics.currentYtdSales/100000).toFixed(2)}L representing a growth of ${activeAnalytics.growthPercent.toFixed(1)}% YoY.</p>`,
          status: "Delivered",
          attachments: ["Sales_Summary.pdf"],
          triggerType: "Manual"
        },
        {
          id: `em_sim_offline_2`,
          dateSent: timestamp,
          recipientEmail: "srpatil@agroiq.com",
          recipientName: "S. R. Patil",
          recipientRole: "Regional Manager",
          subject: "Dhanashree AgriPulse Offline Run: Regional Executive Statement",
          bodyPreview: `<h3>Dear Regional Manager S. R. Patil,</h3><p>Your team is successfully synced with client targets. High-growth territory includes Pune and West-2.</p>`,
          status: "Delivered",
          attachments: ["Sales_Summary.pdf"],
          triggerType: "Manual"
        }
      ];

      fallbackEmails = [...mockCampaignEmails, ...fallbackEmails];
      setEmailLogs(fallbackEmails);
      safeSetLocalStorage("agroSalesEmailLogs", JSON.stringify(fallbackEmails));

      const localAuditStr = localStorage.getItem("agroSalesAuditLogs") || "[]";
      let fallbackLogs: any[] = [];
      try { fallbackLogs = JSON.parse(localAuditStr); } catch (_) {}
      fallbackLogs.unshift({
        timestamp,
        user: selectedUser?.name || "System Scheduler",
        action: "Campaign Run (Offline Sim)",
        details: "Generated and simulated dispatch of offline performance HTML updates.",
        status: "Success"
      });
      setAuditLogs(fallbackLogs);
      safeSetLocalStorage("agroSalesAuditLogs", JSON.stringify(fallbackLogs));
    } finally {
      setIsSimulating(false);
    }
  };

  // Reset database back to default seed setup
  const handleResetDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/db/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDetails: selectedUser })
      });
      if (response.ok) {
        await fetchDatabase(true);
      }
    } catch (e) {
      console.warn("Failed to reset backend database. Resetting local cache/web storage instead.", e);
      // Local seeds reset
      const { SEED_INVOICES, SEED_BUDGETS, SEED_USERS, INITIAL_AUDIT_LOGS, INITIAL_EMAIL_LOGS } = await import("./data/seedData");
      
      const verifiedUsers = SEED_USERS.map((u: any) => {
        if (u.email && u.email.toLowerCase() === "dhanashree.agro@gmail.com") {
          return { ...u, password: "MyWorld99" };
        }
        if (u.email && u.email.toLowerCase() === "admin@agroiq.com") {
          return { ...u, password: "admin123" };
        }
        return u;
      });

      if (!verifiedUsers.some((u: any) => u.email && u.email.toLowerCase() === "dhanashree.agro@gmail.com")) {
        verifiedUsers.push({
          id: "user_dhanashree",
          name: "Dhanashree Agro",
          email: "dhanashree.agro@gmail.com",
          role: "Admin",
          password: "MyWorld99"
        });
      }

      setInvoices(SEED_INVOICES);
      setBudgets(SEED_BUDGETS);
      setAuditLogs(INITIAL_AUDIT_LOGS);
      setEmailLogs(INITIAL_EMAIL_LOGS);
      setUsers(verifiedUsers);

      safeSetLocalStorage("agroSalesInvoices", JSON.stringify(SEED_INVOICES));
      safeSetLocalStorage("agroSalesBudgets", JSON.stringify(SEED_BUDGETS));
      safeSetLocalStorage("agroSalesAuditLogs", JSON.stringify(INITIAL_AUDIT_LOGS));
      safeSetLocalStorage("agroSalesEmailLogs", JSON.stringify(INITIAL_EMAIL_LOGS));
      safeSetLocalStorage("agroSalesUsersList", JSON.stringify(verifiedUsers));
      
      const adminUser = verifiedUsers.find((u: any) => u.email.toLowerCase() === "dhanashree.agro@gmail.com") || verifiedUsers[0];
      setSelectedUser(adminUser);
      safeSetLocalStorage("agroSalesSession", JSON.stringify(adminUser));
    } finally {
      setIsLoading(false);
    }
  };

  // Undo the last spreadsheet excel upload/revert to pre-import snapshot
  const handleUndoDatabaseImport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/db/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDetails: selectedUser })
      });
      if (response.ok) {
        await fetchDatabase(true);
        return { success: true };
      } else {
        const errData = await response.json().catch(() => ({}));
        return { success: false, message: errData.error || "No pre-import database snapshot was found." };
      }
    } catch (e: any) {
      console.error("Failed to undo database import:", e);
      return { success: false, message: e.message || "Network request failed." };
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all invoices from the database
  const handleClearDatabaseInvoices = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const success = await clearAllSalesData();
        if (success) {
          await fetchDatabase(true);
          return { success: true };
        }
      }
      const response = await fetch(`${API_BASE}/api/db/clear-invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDetails: selectedUser })
      });
      if (response.ok) {
        await fetchDatabase(true);
        return { success: true };
      } else {
        return { success: false, message: "Could not clear invoice database records." };
      }
    } catch (e: any) {
      console.error("Failed to clear database invoices:", e);
      return { success: false, message: e.message || "Network request failed." };
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all budgets from the database
  const handleClearDatabaseBudgets = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const success = await clearAllBudgetsData();
        if (success) {
          await fetchDatabase(true);
          return { success: true };
        }
      }
      const response = await fetch(`${API_BASE}/api/db/clear-budgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDetails: selectedUser })
      });
      if (response.ok) {
        await fetchDatabase(true);
        return { success: true };
      } else {
        return { success: false, message: "Could not clear budget sheets database records." };
      }
    } catch (e: any) {
      console.error("Failed to clear database budgets:", e);
      return { success: false, message: e.message || "Network request failed." };
    } finally {
      setIsLoading(false);
    }
  };

  // Find the latest invoice date to determine dynamic month and day bounds
  const { latestMonth, latestDay } = useMemo(() => {
    let m = 4; // default May (months are 0-indexed)
    let d = 26; // default 26th
    if (invoices && invoices.length > 0) {
      let maxTime = 0;
      let latestInvDate: Date | null = null;
      invoices.forEach((inv) => {
        if (inv.invoiceDate) {
          const t = new Date(inv.invoiceDate).getTime();
          if (!isNaN(t) && t > maxTime) {
            maxTime = t;
            latestInvDate = new Date(inv.invoiceDate);
          }
        }
      });
      if (latestInvDate) {
        m = (latestInvDate as Date).getMonth();
        d = (latestInvDate as Date).getDate();
      }
    }
    return { latestMonth: m, latestDay: d };
  }, [invoices]);

  // Compile operational metrics dynamically on the client based on selected role
  const activeAnalytics = compileAnalytics(invoices, budgets, selectedUser, latestMonth, latestDay, users);

  // Filter local dashboard listings dynamically based on filter values
  const [activeFilters, setActiveFilters] = useState({
    companies: [] as string[],
    rm: "All",
    category: "All",
    searchQuery: "",
  });

  const handleFilterUpdate = (filters: typeof activeFilters) => {
    setActiveFilters(filters);
  };

  // Helper to find all descendants of a given scope in the group-subgroup hierarchy
  const getScopedInvoicesForUser = (user: UserProfile, allInvoices: InvoiceItem[]) => {
    return filterDataByRole(allInvoices, user, users);
  };

  // Memoized scoped invoices for current user to avoid duplicate heavy calculation passes
  const currentUserInvoices = useMemo(() => {
    return filterDataByRole(invoices, selectedUser, users);
  }, [invoices, selectedUser, users]);

  const analyticsToRender = useMemo(() => {
    let filteredInvoices = currentUserInvoices;

    // Apply dashboard filters
    if (activeFilters.companies && activeFilters.companies.length > 0) {
      filteredInvoices = filteredInvoices.filter(inv => {
        if (!inv.company) return false;
        const normComp = inv.company.trim().toLowerCase();
        return activeFilters.companies.some(c => c.trim().toLowerCase() === normComp);
      });
    }
    if (activeFilters.rm !== "All") {
      const filterRmNorm = activeFilters.rm.trim().toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv => {
        const invRmNorm = (inv.regionalManager || "").trim().toLowerCase();
        const invSpNorm = (inv.salesperson || "").trim().toLowerCase();
        return invRmNorm === filterRmNorm || invSpNorm === filterRmNorm;
      });
    }
    if (activeFilters.category !== "All") {
      filteredInvoices = filteredInvoices.filter(inv => inv.productCategory === activeFilters.category);
    }
    if (activeFilters.searchQuery.trim() !== "") {
      const q = activeFilters.searchQuery.toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv => {
        const custName = (inv.customerName || "").toLowerCase();
        const custCode = (inv.customerCode || "").toLowerCase();
        const prodName = (inv.productName || "").toLowerCase();
        return custName.includes(q) || custCode.includes(q) || prodName.includes(q);
      });
    }

    return compileAnalytics(filteredInvoices, budgets, selectedUser, latestMonth, latestDay, users);
  }, [currentUserInvoices, budgets, selectedUser, activeFilters, users, latestMonth, latestDay]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 animate-spin border-2 border-green-200 border-t-green-600 rounded-full"></div>
          <img src={dhanashreeLogo} alt="Dhanashree AgriPulse" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-gray-900">Synchronizing Dhanashree AgriPulse Datasets</h3>
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
        invoices={invoices}
      />
    );
  }

  return (
    <div className={`min-h-screen ${theme === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-slate-50/50 text-slate-900"} flex flex-col antialiased transition-colors duration-200`}>
      
      {/* Upper Navigation Global Header Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-150 dark:border-slate-800 sticky top-0 z-40 px-4 md:px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Hamburger Menu Trigger */}
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="md:hidden p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100 ring-1 ring-gray-100 dark:ring-slate-800 bg-white dark:bg-slate-900 cursor-pointer"
            aria-label="Toggle Side Nav menu"
          >
            {isMobileSidebarOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>

          <img src={dhanashreeLogo} alt="Dhanashree AgriPulse Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" referrerPolicy="no-referrer" />
          <div>
            <h1 className="text-sm md:text-base font-bold text-gray-950 dark:text-slate-50 tracking-tight leading-none">Dhanashree AgriPulse</h1>
            <p className="text-[9px] md:text-[10px] text-gray-500 dark:text-slate-400 font-medium mt-0.5">Enterprise Sales Intelligence Suite</p>
          </div>
        </div>

        {/* Dynamic Logged-in Persona Swapper Panel */}
        <div className="flex items-center gap-1.5 md:gap-4">
          <div className="relative">
            <button
              onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
              className="flex items-center gap-1.5 md:gap-2.5 bg-gray-50 border border-gray-200 dark:bg-slate-800 dark:border-slate-700 hover:bg-gray-100/80 dark:hover:bg-slate-700 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs text-left transition focus:outline-none"
            >
              <div>
                <div className="text-[8px] md:text-[10px] uppercase font-semibold tracking-wider text-gray-400">Viewing Role Scope</div>
                <div className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1 mt-0.5 text-[10px] md:text-xs">
                  <span className="truncate max-w-[80px] md:max-w-none">{selectedUser.name}</span>
                  <ChevronDown className="w-3 md:w-3.5 h-3 md:h-3.5 text-gray-500" />
                </div>
              </div>
            </button>

            {showPersonaDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 space-y-1">
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
                      selectedUser.id === u.id ? "bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 font-bold" : "text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/50"
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

          {/* Theme Mode Toggler */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="p-1.5 md:p-2 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs rounded-xl flex items-center justify-center cursor-pointer transition shadow-3xs"
            title={theme === "light" ? "Switch to High-Contrast Night-Vision Mode" : "Switch to Crisp Executive Light Mode"}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          <button
            onClick={handleLogout}
            className="px-2.5 py-1.5 md:px-3 md:py-2 border border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition flex items-center gap-1 md:gap-1.5"
            title="Terminate Secure Session"
          >
            🔒 <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Structural Enterprise Layout Drawer */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Navigation Sidebar (Slide-out drawer on mobile, static on desktop) */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden transition-all"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-gray-150 dark:border-slate-800 p-4 space-y-6 transform ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300 ease-in-out md:static md:translate-x-0 shrink-0 shadow-lg md:shadow-none flex flex-col`}
        >
          {/* Active User Information Box */}
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-2.5">
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
            <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest block px-3 mb-2">Platform Navigation</span>
            
            <button
              onClick={() => { setActiveTab("executive"); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "executive" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              Executive Dashboard
            </button>

            <button
              onClick={() => { setActiveTab("advisor"); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "advisor" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              AI Insights Assistant
            </button>

            {selectedUser && selectedUser.role === "Admin" && (
              <button
                onClick={() => { setActiveTab("upload"); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                  activeTab === "upload" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
                }`}
              >
                <Upload className="w-4 h-4 shrink-0" />
                Excel Upload Center
              </button>
            )}

            {selectedUser && selectedUser.role === "Admin" && (
              <>

                <button
                  id="nav-invoice-ledger"
                  onClick={() => { setActiveTab("ledger"); setIsMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                    activeTab === "ledger" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  Invoice Ledger
                </button>

                <button
                  id="nav-budget-ledger"
                  onClick={() => { setActiveTab("budget-ledger"); setIsMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                    activeTab === "budget-ledger" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
                  }`}
                >
                  <Target className="w-4 h-4 shrink-0" />
                  Budget Target Ledger
                </button>

                <button
                  id="nav-audit-logs"
                  onClick={() => { setActiveTab("audit"); setIsMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                    activeTab === "audit" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
                  }`}
                >
                  <Terminal className="w-4 h-4 shrink-0" />
                  Audit Logs
                </button>
              </>
            )}

            <button
              onClick={() => { setActiveTab("scheduler"); setIsMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                activeTab === "scheduler" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              Campaign Scheduler
            </button>

            {selectedUser && selectedUser.role === "Admin" && (
              <button
                onClick={() => { setActiveTab("admin"); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition ${
                  activeTab === "admin" ? "bg-green-50 dark:bg-green-950/40 text-green-750 dark:text-green-400 font-bold" : "text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800/40 hover:text-gray-900 dark:hover:text-slate-100"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                Platform Settings
              </button>
            )}
          </div>

          <div className="pt-8 border-t border-gray-100 dark:border-slate-800 space-y-2 text-[10px] text-gray-450 dark:text-slate-500 leading-relaxed font-semibold">
            <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              <Info className="w-3.5 h-3.5" />
              <span>RLS Row Scoping Active</span>
            </div>
            <p className="font-normal text-gray-450 dark:text-slate-400">
              CRM dashboard elements, KPIs, Recharts summaries and AI advisory prompts automatically filter based on the logged-in user profile.
            </p>
          </div>

          {/* Deployment Version and Status Footer */}
          <div className="pt-4 mt-6 border-t border-gray-100 dark:border-slate-800 space-y-2 text-[10px] text-gray-450 dark:text-slate-500 font-semibold">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-gray-500 dark:text-slate-400 uppercase tracking-wide font-bold">
                <Database className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span>Sync Status</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                isSupabaseConfigured() 
                  ? "bg-green-100 dark:bg-green-950/40 text-green-750 dark:text-green-400" 
                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-750 dark:text-amber-400"
              }`}>
                {isSupabaseConfigured() ? "Supabase Cloud" : "Local Mode"}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-gray-450 dark:text-slate-400 font-normal">
              <span>Build Version:</span>
              <span className="font-mono bg-gray-50 dark:bg-slate-800/60 px-1 py-0.2 rounded text-[9px] font-bold text-gray-700 dark:text-slate-300">
                {BUILD_VERSION}
              </span>
            </div>

            <div className="flex items-center justify-between text-gray-450 dark:text-slate-400 font-normal">
              <span>Deployed At:</span>
              <span className="text-[9px] font-medium text-gray-600 dark:text-slate-300">
                {BUILD_TIMESTAMP}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-gray-450 dark:text-slate-400 font-normal">
              <span>Environment:</span>
              <span className="text-[9px] font-semibold text-gray-600 dark:text-slate-300">
                {isVercelOrStatic ? "Vercel Production" : "Local Dev"}
              </span>
            </div>
          </div>

        </aside>

        {/* Primary Content Canvas */}
        <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-x-hidden">

          {/* Row Count Reconciliation Warning Banner */}
          {reconciliationWarning && (
            <div id="reconciliation-mismatch-banner" className="bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/55 rounded-2xl p-5 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-605 dark:text-amber-400 animate-bounce" />
              </div>
              <div className="space-y-1 mt-0.5">
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-405 font-sans">
                  Data Integrity Alert: Row Count Reconciliation Mismatch
                </h3>
                <p className="text-[11px] text-amber-750 dark:text-slate-300 leading-relaxed max-w-4xl">
                  {reconciliationWarning.message} There is a discrepancy between the invoices loaded in memory and the remote Supabase table row count. Please run the integrity sweep in Platform Settings or re-upload your Excel spreadsheets to synchronize the data sets.
                </p>
              </div>
            </div>
          )}
          
          {/* Global Startup Supabase Configuration Validation Banner */}
          {!isSupabaseConfigured() && (
            <div id="global-supabase-missing-banner" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-950/55 rounded-2xl p-5 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-xl shrink-0">
                <Shield className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1 mt-0.5">
                <h3 className="text-sm font-bold text-red-900 dark:text-red-405">
                  Supabase configuration missing. Check environment variables.
                </h3>
                <p className="text-[11px] text-red-700/80 dark:text-red-400/80 leading-relaxed max-w-4xl">
                  The application is unable to initialize a cloud connection with Supabase. Real-time ledger synchronize pipelines, bulk spreadsheet ETL workflows, and storage archive updates are disabled. Please see your deployment configuration and ensure both <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> variables are populated correctly.
                </p>
              </div>
            </div>
          )}
          
          {/* Active component switch */}
          {activeTab === "executive" && (
            <ExecutiveDashboard
              analytics={analyticsToRender}
              onFilterChange={handleFilterUpdate}
              currentUser={selectedUser}
              scopedInvoices={currentUserInvoices}
              users={users}
              budgets={budgets}
            />
          )}

          {activeTab === "upload" && selectedUser && selectedUser.role === "Admin" && (
            <UploadCenter
              onDataUploaded={handleUploadedFiles}
              onSaveUsersBulk={handleSaveUsersBulk}
              currentUser={selectedUser}
              existingInvoicesCount={invoices.length}
              existingBudgetsCount={budgets.length}
              onResetDatabase={handleResetDatabase}
              isSyncing={isSyncing}
              existingInvoices={invoices}
              users={users}
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

          {activeTab === "admin" && selectedUser && selectedUser.role === "Admin" && (
            <AdminSettings
              auditLogs={auditLogs}
              onResetDatabase={handleResetDatabase}
              onUndoDatabaseImport={handleUndoDatabaseImport}
              onClearDatabaseInvoices={handleClearDatabaseInvoices}
              onClearDatabaseBudgets={handleClearDatabaseBudgets}
              currentUser={selectedUser}
              users={users}
              onSaveUser={handleSaveUser}
              onSaveUsersBulk={handleSaveUsersBulk}
              onDeleteUser={handleDeleteUser}
              invoices={invoices}
            />
          )}

          {activeTab === "ledger" && selectedUser && selectedUser.role === "Admin" && (
            <InvoiceLedger invoices={invoices} />
          )}

          {activeTab === "budget-ledger" && selectedUser && selectedUser.role === "Admin" && (
            <BudgetLedger budgets={budgets} onUpdateBudgets={handleSaveBudgets} />
          )}

          {activeTab === "audit" && selectedUser && selectedUser.role === "Admin" && (
            <AuditLogsView 
              auditLogs={auditLogs} 
              onResetDatabase={handleResetDatabase} 
              currentUser={selectedUser} 
            />
          )}

        </main>

      </div>

    </div>
  );
}
