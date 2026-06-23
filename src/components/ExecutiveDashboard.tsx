/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  TrendingUp,
  Users,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShoppingBag,
  Target,
  FileText,
  Filter,
  DollarSign,
  Briefcase,
  Layers,
  Search,
  BookOpen,
  Calendar,
  ChevronDown,
  X
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from "recharts";
import { InvoiceItem, UserProfile, BudgetItem } from "../types";
import { CompiledAnalytics, getUserDescendantsList } from "../utils/analytics";

// Sub-Tab Components Imports
import DashboardOverviewTab from "./DashboardOverviewTab";
import ProductComparativeTab from "./ProductComparativeTab";
import CustomerStandingsTab from "./CustomerStandingsTab";
import SuppliersPerformanceTab from "./SuppliersPerformanceTab";
import DroppedLostCRMTab from "./DroppedLostCRMTab";
import YoYComparisonTab from "./YoYComparisonTab";
import BudgetvsActualTab from "./BudgetvsActualTab";

interface ExecutiveDashboardProps {
  analytics: CompiledAnalytics;
  onFilterChange: (filters: {
    companies: string[];
    rm: string;
    category: string;
    searchQuery: string;
  }) => void;
  currentUser: UserProfile;
  scopedInvoices: InvoiceItem[];
  users: UserProfile[];
  budgets: BudgetItem[];
}

export default function ExecutiveDashboard({
  analytics,
  onFilterChange,
  currentUser,
  scopedInvoices,
  users,
  budgets,
}: ExecutiveDashboardProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [selectedRm, setSelectedRm] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [drillDownCustomer, setDrillDownCustomer] = useState<string | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const handleClearAllFilters = () => {
    setSelectedCompanies([]);
    setSelectedRm("All");
    setSelectedCategory("All");
    setSearchQuery("");
    applyFilters([], "All", "All", "");
  };

  // Dynamic unique companies list based on actual dataset loaded
  const uniqueCompanies = React.useMemo(() => {
    const nameMap = new Map<string, string>(); // lowercase -> original case
    (scopedInvoices || []).forEach(inv => {
      if (inv.company) {
        const trimmed = inv.company.trim();
        const lower = trimmed.toLowerCase();
        if (!nameMap.has(lower)) {
          nameMap.set(lower, trimmed);
        }
      }
    });
    return Array.from(nameMap.values()).sort();
  }, [scopedInvoices]);

  // All subordinates upto the salesperson level in the hierarchy of the logged-in user, sorted alphabetically
  const subordinateUsersForFilter = React.useMemo(() => {
    if (!users || !currentUser) return [];
    
    let list: UserProfile[] = [];
    if (currentUser.role === "Admin" || currentUser.role === "Sales Director") {
      // Admin/Director level can see/filter everyone (Regional Managers and Salespersons)
      list = users.filter(u => u.role === "Regional Manager" || u.role === "Salesperson");
    } else {
      // Otherwise, get recursive descendants under the current user
      list = getUserDescendantsList(currentUser, users);
    }

    // Sort alphabetically by name
    return [...list].sort((a, b) => {
      const nameA = (a.name || "").trim().toLowerCase();
      const nameB = (b.name || "").trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users, currentUser]);

  // Helper to compute dynamic dates boundaries
  const getInitialDates = () => {
    const datesObj = (scopedInvoices || [])
      .map(inv => inv.invoiceDate)
      .filter(Boolean)
      .map(dStr => new Date(dStr))
      .filter(d => !isNaN(d.getTime()));

    let lastDateStr = "2026-05-12";
    if (datesObj.length > 0) {
      const lastDate = new Date(Math.max(...datesObj.map(d => d.getTime())));
      const y = lastDate.getFullYear();
      const m = String(lastDate.getMonth() + 1).padStart(2, "0");
      const d = String(lastDate.getDate()).padStart(2, "0");
      lastDateStr = `${y}-${m}-${d}`;
    }

    const lastDate = new Date(lastDateStr);
    const monthIdx = lastDate.getMonth();
    const fyStartYear = monthIdx >= 2 ? lastDate.getFullYear() : lastDate.getFullYear() - 1;
    const fyStartStr = `${fyStartYear}-03-01`;

    const p1StartYear = fyStartYear - 1;
    const p1StartStr = `${p1StartYear}-03-01`;

    const p1EndYear = lastDate.getFullYear() - 1;
    const p1EndMonth = String(lastDate.getMonth() + 1).padStart(2, "0");
    const p1EndDate = String(lastDate.getDate()).padStart(2, "0");
    const p1EndStr = `${p1EndYear}-${p1EndMonth}-${p1EndDate}`;

    return {
      p1Start: p1StartStr,
      p1End: p1EndStr,
      p2Start: fyStartStr,
      p2End: lastDateStr,
      maxAllowed: lastDateStr
    };
  };

  const initialDates = getInitialDates();
  const [period1Start, setPeriod1Start] = useState(initialDates.p1Start);
  const [period1End, setPeriod1End] = useState(initialDates.p1End);
  const [period2Start, setPeriod2Start] = useState(initialDates.p2Start);
  const [period2End, setPeriod2End] = useState(initialDates.p2End);
  const [isSandboxCollapsed, setIsSandboxCollapsed] = useState(false);

  // Real-time custom salesperson assignments
  const assignedCustomers = React.useMemo(() => {
    if (currentUser.role !== "Salesperson" && currentUser.role !== "Regional Manager") return [];
    const customersMap = new Map<string, { name: string; code: string; count: number; totalAmt: number }>();
    const myNameNorm = (currentUser.name || "").trim().toLowerCase();
    const myEmailNorm = (currentUser.email || "").trim().toLowerCase();
    const myIdNorm = (currentUser.id || "").trim().toLowerCase();

    (scopedInvoices || []).forEach(inv => {
      // For Regional Manager, only show their DIRECTLY assigned customer accounts (not of their subordinates)
      if (currentUser.role === "Regional Manager") {
        const invSp = (inv.salesperson || "").trim().toLowerCase();
        const invRm = (inv.regionalManager || "").trim().toLowerCase();
        const isDirectToRM = (
          (myNameNorm && (invSp === myNameNorm || invRm === myNameNorm)) ||
          (myEmailNorm && (invSp === myEmailNorm || invRm === myEmailNorm)) ||
          (myIdNorm && (invSp === myIdNorm || invRm === myIdNorm))
        );
        if (!isDirectToRM) return;
      }

      if (inv.customerName) {
        const code = inv.customerCode || "N/A";
        const key = `${inv.customerName.trim()}|||${code.trim()}`;
        const existing = customersMap.get(key) || { name: inv.customerName, code, count: 0, totalAmt: 0 };
        existing.count += 1;
        existing.totalAmt += inv.netSalesValue;
        customersMap.set(key, existing);
      }
    });
    return Array.from(customersMap.values()).sort((a, b) => b.totalAmt - a.totalAmt);
  }, [scopedInvoices, currentUser]);

  // Real-time custom regional manager subordinate listing
  const mySubordinates = React.useMemo(() => {
    if (currentUser.role !== "Regional Manager") return [];
    const rmNameNorm = (currentUser.name || "").trim().toLowerCase();
    const rmEmailNorm = (currentUser.email || "").trim().toLowerCase();
    const rmIdNorm = (currentUser.id || "").trim().toLowerCase();
    
    return (users || []).filter(usr => {
      // Avoid infinite loop / reporting to oneself
      if (usr.id === currentUser.id) return false;
      const usrNameNorm = (usr.name || "").trim().toLowerCase();
      const usrEmailNorm = (usr.email || "").trim().toLowerCase();
      const usrIdNorm = (usr.id || "").trim().toLowerCase();
      if (usrNameNorm === rmNameNorm || (rmEmailNorm && usrEmailNorm === rmEmailNorm)) return false;

      if (usr.role !== "Salesperson" && usr.role !== "Regional Manager") return false;
      const mgrNorm = (usr.managerName || "").trim().toLowerCase();
      
      // 1. Direct reports based on user profile structure
      const isDirectReport = (rmNameNorm && mgrNorm === rmNameNorm) || 
                            (rmEmailNorm && mgrNorm === rmEmailNorm) ||
                            (rmIdNorm && mgrNorm === rmIdNorm);
      if (isDirectReport) return true;

      // 2. Direct reports based on dynamic invoice assignments
      let isInvoiceMatchedReport = false;
      if (scopedInvoices && scopedInvoices.length > 0) {
        scopedInvoices.forEach(inv => {
          const invRm = (inv.regionalManager || "").trim().toLowerCase();
          const invSp = (inv.salesperson || "").trim().toLowerCase();
          if (
            (rmNameNorm && invRm === rmNameNorm) || 
            (rmEmailNorm && invRm === rmEmailNorm) || 
            (rmIdNorm && invRm === rmIdNorm)
          ) {
            if (
              (usrNameNorm && invSp === usrNameNorm) || 
              (usrEmailNorm && invSp === usrEmailNorm) || 
              (usrIdNorm && invSp === usrIdNorm)
            ) {
              isInvoiceMatchedReport = true;
            }
          }
        });
      }
      return isInvoiceMatchedReport;
    });
  }, [users, currentUser, scopedInvoices]);

  // Real-time subordinate hierarchy (salespeople + their unique customers)
  const subordinateHierarchy = React.useMemo(() => {
    return mySubordinates.map(sub => {
      // Collect descendants under this specific direct report recursively
      const subDescendants = getUserDescendantsList(sub, users || []);
      const allSubUsers = [sub, ...subDescendants];
      
      const subDealers = new Set<string>();
      allSubUsers.forEach(su => {
        const suTerritory = (su.territory || "").trim().toLowerCase();
        const suName = (su.name || "").trim().toLowerCase();
        const suEmail = (su.email || "").trim().toLowerCase();
        const suId = (su.id || "").trim().toLowerCase();

        (scopedInvoices || []).forEach(inv => {
          const invTerr = (inv.territory || "").trim().toLowerCase();
          const invSp = (inv.salesperson || "").trim().toLowerCase();
          const invRm = (inv.regionalManager || "").trim().toLowerCase();

          // Match by territory
          const terrMatch = suTerritory && invTerr === suTerritory;
          // Match by salesperson/RM directly
          const directMatch = (suName && (invSp === suName || invRm === suName)) ||
                              (suEmail && (invSp === suEmail || invRm === suEmail)) ||
                              (suId && (invSp === suId || invRm === suId));

          if ((terrMatch || directMatch) && inv.customerName) {
            subDealers.add(inv.customerName.trim().toLowerCase());
          }
        });
      });

      // Filter sub's invoices based on subDealers names or direct user matching
      const subInvoices = (scopedInvoices || []).filter(inv => {
        if (!inv.customerName) return false;
        
        // Direct matching as an override fallback
        const invSp = (inv.salesperson || "").trim().toLowerCase();
        const invRm = (inv.regionalManager || "").trim().toLowerCase();
        const matchesSubUser = allSubUsers.some(su => {
          const suName = (su.name || "").trim().toLowerCase();
          const suEmail = (su.email || "").trim().toLowerCase();
          const suId = (su.id || "").trim().toLowerCase();
          return (
            (suName && (invSp === suName || invRm === suName)) ||
            (suEmail && (invSp === suEmail || invRm === suEmail)) ||
            (suId && (invSp === suId || invRm === suId))
          );
        });
        if (matchesSubUser) return true;

        return subDealers.has(inv.customerName.trim().toLowerCase());
      });
      
      const custMap = new Map<string, { name: string; code: string; totalAmt: number }>();
      subInvoices.forEach(inv => {
        const code = inv.customerCode || "N/A";
        const key = `${inv.customerName.trim()}|||${code.trim()}`;
        const existing = custMap.get(key) || { name: inv.customerName, code, totalAmt: 0 };
        existing.totalAmt += inv.netSalesValue;
        custMap.set(key, existing);
      });
      
      const customers = Array.from(custMap.values()).sort((a,b) => b.totalAmt - a.totalAmt);
      return {
        subordinate: sub,
        customers
      };
    });
  }, [mySubordinates, scopedInvoices, users]);

  // Auto-reset when scopedInvoices size changes
  const lastInvoicesCountRef = React.useRef(scopedInvoices?.length || 0);
  React.useEffect(() => {
    if (scopedInvoices && scopedInvoices.length !== lastInvoicesCountRef.current) {
      lastInvoicesCountRef.current = scopedInvoices.length;
      const dates = getInitialDates();
      setPeriod1Start(dates.p1Start);
      setPeriod1End(dates.p1End);
      setPeriod2Start(dates.p2Start);
      setPeriod2End(dates.p2End);
    }
  }, [scopedInvoices]);

  // Rankings lists view expansions states
  // Sub-tabs navigation state & inside-tab sub-view filter selections
   const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "product" | "customer" | "supplier" | "lost" | "yoy" | "budgetVsActual">("dashboard");
  const [productSubView, setProductSubView] = useState<"all" | "top20qty" | "bottom20qty" | "topValue" | "nonBilling">("all");
  const [customerSubView, setCustomerSubView] = useState<"all" | "topQty" | "topValue" | "bottom20" | "regionBreakdown">("all");

  // Helper to get active subordinate salesperson names under current user
  const targetSalespersonNames = React.useMemo(() => {
    if (!currentUser) return [];
    const names = new Set<string>();
    names.add(currentUser.name.trim().toLowerCase());
    if (currentUser.email) {
      names.add(currentUser.email.trim().toLowerCase());
    }

    // Add recursive descendants (both direct and indirect subordinates)
    const descendants = getUserDescendantsList(currentUser, users || []);
    descendants.forEach(d => {
      if (d.name) names.add(d.name.trim().toLowerCase());
      if (d.email) names.add(d.email.trim().toLowerCase());
    });

    return Array.from(names);
  }, [currentUser, users]);

  // Check if current active user has sales budgets assigned (either directly or via reports)
  const userBudgets = React.useMemo(() => {
    if (!budgets || !currentUser) return [];
    
    // For Admin / Sales Director, if there are any budgets in system, show budget tab
    if (currentUser.role === "Admin" || currentUser.role === "Sales Director") {
      return budgets;
    }

    return budgets.filter(b => {
      const salespersonNorm = (b.salesperson || "").trim().toLowerCase();
      return targetSalespersonNames.includes(salespersonNorm);
    });
  }, [budgets, currentUser, targetSalespersonNames]);

  const hasBudget = userBudgets.length > 0;

  React.useEffect(() => {
    if (!hasBudget && activeSubTab === "budgetVsActual") {
      setActiveSubTab("dashboard");
    }
  }, [hasBudget, activeSubTab]);

  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [showAllSalespeople, setShowAllSalespeople] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const applyFilters = (comps: string[], rm: string, cat: string, query: string) => {
    onFilterChange({
      companies: comps,
      rm: rm,
      category: cat,
      searchQuery: query,
    });
  };

  const applyCompaniesFilter = (comps: string[]) => {
    applyFilters(comps, selectedRm, selectedCategory, searchQuery);
  };

  const formatDateFriendly = (dStr: string) => {
    if (!dStr || dStr === "N/A") return "N/A";
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getCompanyDateRanges = () => {
    const getMinMax = (arr: InvoiceItem[]) => {
      const sortedInvoices = [...arr].sort((a,b) => {
        if (a.invoiceDate < b.invoiceDate) return -1;
        if (a.invoiceDate > b.invoiceDate) return 1;
        return 0;
      });
      if (sortedInvoices.length === 0) return { min: "N/A", max: "N/A" };
      return { 
        min: formatDateFriendly(sortedInvoices[0].invoiceDate), 
        max: formatDateFriendly(sortedInvoices[sortedInvoices.length - 1].invoiceDate) 
      };
    };

    const compRanges = uniqueCompanies.map(comp => ({
      company: comp,
      range: getMinMax((scopedInvoices || []).filter(i => (i.company || "").trim().toLowerCase() === comp.toLowerCase()))
    }));

    return {
      compRanges,
      overall: getMinMax(scopedInvoices || [])
    };
  };

  const COLORS = ["#16a34a", "#2563eb", "#ea580c", "#d97706", "#7c3aed", "#db2777"];

  // Sandbox data slicing & aggregation engine (obeys active filters & scopes)
  const getSandboxPeriodData = (start: string, end: string) => {
    return (scopedInvoices || []).filter(inv => {
      // 1. Date range match - use robust string comparison to avoid any client-browser timezone/offset shifts on day boundary
      if (inv.invoiceDate < start || inv.invoiceDate > end) return false;

      // 2. Active filters match - make company selection robust against leading/trailing whitespace & casing variations
      if (selectedCompanies && selectedCompanies.length > 0) {
        const normComp = (inv.company || "").trim().toLowerCase();
        const hasMatch = selectedCompanies.some(c => c.trim().toLowerCase() === normComp);
        if (!hasMatch) return false;
      }
      if (selectedRm !== "All") {
        const filterRmNorm = selectedRm.trim().toLowerCase();
        const invRmNorm = (inv.regionalManager || "").trim().toLowerCase();
        const invSpNorm = (inv.salesperson || "").trim().toLowerCase();
        if (invRmNorm !== filterRmNorm && invSpNorm !== filterRmNorm) return false;
      }
      if (selectedCategory !== "All" && inv.productCategory !== selectedCategory) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        if (!inv.customerName.toLowerCase().includes(q) &&
            !inv.customerCode.toLowerCase().includes(q) &&
            !inv.productName.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  };

  const p1Records = getSandboxPeriodData(period1Start, period1End);
  const p2Records = getSandboxPeriodData(period2Start, period2End);

  const p1Sales = p1Records.reduce((sum, r) => sum + r.netSalesValue, 0);
  const p2Sales = p2Records.reduce((sum, r) => sum + r.netSalesValue, 0);
  const salesChange = p2Sales - p1Sales;
  const salesChangePct = p1Sales > 0 ? (salesChange / p1Sales) * 100 : 0;

  const p1Qty = p1Records.reduce((sum, r) => sum + r.quantity, 0);
  const p2Qty = p2Records.reduce((sum, r) => sum + r.quantity, 0);
  const qtyChange = p2Qty - p1Qty;
  const qtyChangePct = p1Qty > 0 ? (qtyChange / p1Qty) * 100 : 0;

  const getTopProductsVal = (records: InvoiceItem[]) => {
    const map = new Map<string, number>();
    records.forEach(r => {
      const cat = r.productCategory || "Product";
      map.set(cat, (map.get(cat) || 0) + r.netSalesValue);
    });
    return Array.from(map.entries())
      .map(([name, val]) => ({ name, val }))
      .sort((a,b) => b.val - a.val)
      .slice(0, 3);
  };

  const getTopCustomersVal = (records: InvoiceItem[]) => {
    const map = new Map<string, number>();
    records.forEach(r => {
      map.set(r.customerName, (map.get(r.customerName) || 0) + r.netSalesValue);
    });
    return Array.from(map.entries())
      .map(([name, val]) => ({ name, val }))
      .sort((a,b) => b.val - a.val)
      .slice(0, 3);
  };

  const getProductPerformancesList = () => {
    const map = new Map<string, { current: number; prev: number; qtyCurr: number; qtyPrev: number; category: string }>();
    (scopedInvoices || []).forEach(inv => {
      const cat = inv.productCategory || "Product";
      if (!map.has(cat)) {
        map.set(cat, { current: 0, prev: 0, qtyCurr: 0, qtyPrev: 0, category: cat });
      }
      const entry = map.get(cat)!;
      const matchYear = inv.invoiceDate ? Number(inv.invoiceDate.split("-")[0]) : 0;
      if (matchYear === 2026) {
        entry.current += inv.netSalesValue;
        entry.qtyCurr += inv.quantity;
      } else if (matchYear === 2025) {
        entry.prev += inv.netSalesValue;
        entry.qtyPrev += inv.quantity;
      }
    });

    return Array.from(map.entries())
      .map(([name, stats]) => {
        const change = stats.current - stats.prev;
        return {
          productName: name,
          productCategory: stats.category,
          currentSales: stats.current,
          prevSales: stats.prev,
          growthPercent: stats.prev > 0 ? (change / stats.prev) * 105 : 0,
          qtyCurr: stats.qtyCurr,
          qtyPrev: stats.qtyPrev
        };
      })
      .sort((a,b) => b.currentSales - a.currentSales);
  };

  const p1TopProducts = getTopProductsVal(p1Records);
  const p2TopProducts = getTopProductsVal(p2Records);

  const p1TopCustomers = getTopCustomersVal(p1Records);
  const p2TopCustomers = getTopCustomersVal(p2Records);

  // Prepare monthly comparative trend data for chart
  // In March, April, May as YTD
  const monthlyTimelineData = [
    { name: "March", "Last Year (2025)": (analytics.prevYtdSales * 0.3), "Current Year (2026)": (analytics.currentYtdSales * 0.28) },
    { name: "April", "Last Year (2025)": (analytics.prevYtdSales * 0.32), "Current Year (2026)": (analytics.currentYtdSales * 0.34) },
    { name: "May (YTD)", "Last Year (2025)": (analytics.prevYtdSales * 0.38), "Current Year (2026)": (analytics.currentYtdSales * 0.38) },
  ];

  // ===============================================
  // DYNAMIC COMPILED LISTS BOUND TO USER FILTERS & COMPARISON DATES
  // ===============================================
  const productCategoriesAll = React.useMemo(() => {
    return Array.from(new Set([
      ...p1Records.map(r => r.productCategory),
      ...p2Records.map(r => r.productCategory)
    ])).filter(Boolean);
  }, [p1Records, p2Records]);

  const customerNamesAll = React.useMemo(() => {
    return Array.from(new Set([
      ...p1Records.map(r => r.customerName),
      ...p2Records.map(r => r.customerName)
    ])).filter(Boolean);
  }, [p1Records, p2Records]);

  const regionsAll = React.useMemo(() => {
    return Array.from(new Set([
      ...p1Records.map(r => r.region),
      ...p2Records.map(r => r.region)
    ])).filter(Boolean);
  }, [p1Records, p2Records]);

  const suppliersAll = React.useMemo(() => {
    return Array.from(new Set([
      ...p1Records.map(r => r.supplier || "Standard Supplier"),
      ...p2Records.map(r => r.supplier || "Standard Supplier")
    ])).filter(Boolean);
  }, [p1Records, p2Records]);

  const productStats = React.useMemo(() => {
    return productCategoriesAll.map(cat => {
      const p1Matches = p1Records.filter(r => r.productCategory === cat);
      const p2Matches = p2Records.filter(r => r.productCategory === cat);

      const p1Qty = p1Matches.reduce((sum, r) => sum + r.quantity, 0);
      const p2Qty = p2Matches.reduce((sum, r) => sum + r.quantity, 0);

      const p1Val = p1Matches.reduce((sum, r) => sum + r.netSalesValue, 0);
      const p2Val = p2Matches.reduce((sum, r) => sum + r.netSalesValue, 0);

      return {
        name: cat,
        category: cat,
        p1Qty,
        p2Qty,
        qtyDiff: p2Qty - p1Qty,
        qtyGrowth: p1Qty > 0 ? ((p2Qty - p1Qty) / p1Qty) * 100 : 0,
        p1Val,
        p2Val,
        valDiff: p2Val - p1Val,
        valGrowth: p1Val > 0 ? ((p2Val - p1Val) / p1Val) * 100 : 0,
      };
    });
  }, [productCategoriesAll, p1Records, p2Records]);

  const customerStats = React.useMemo(() => {
    return customerNamesAll.map(name => {
      const p1Matches = p1Records.filter(r => r.customerName === name);
      const p2Matches = p2Records.filter(r => r.customerName === name);

      const p1Qty = p1Matches.reduce((sum, r) => sum + r.quantity, 0);
      const p2Qty = p2Matches.reduce((sum, r) => sum + r.quantity, 0);

      const p1Val = p1Matches.reduce((sum, r) => sum + r.netSalesValue, 0);
      const p2Val = p2Matches.reduce((sum, r) => sum + r.netSalesValue, 0);

      const code = p2Matches[0]?.customerCode || p1Matches[0]?.customerCode || "N/A";
      const region = p2Matches[0]?.region || p1Matches[0]?.region || "N/A";
      const territory = p2Matches[0]?.territory || p1Matches[0]?.territory || "N/A";

      return {
        customerName: name,
        customerCode: code,
        region,
        territory,
        p1Qty,
        p2Qty,
        qtyDiff: p2Qty - p1Qty,
        qtyGrowth: p1Qty > 0 ? ((p2Qty - p1Qty) / p1Qty) * 100 : 0,
        p1Val,
        p2Val,
        valDiff: p2Val - p1Val,
        valGrowth: p1Val > 0 ? ((p2Val - p1Val) / p1Val) * 100 : 0,
      };
    });
  }, [customerNamesAll, p1Records, p2Records]);

  const supplierStats = React.useMemo(() => {
    return suppliersAll.map(supName => {
      const p1Matches = p1Records.filter(r => (r.supplier || "Standard Supplier") === supName);
      const p2Matches = p2Records.filter(r => (r.supplier || "Standard Supplier") === supName);

      const p1Qty = p1Matches.reduce((sum, r) => sum + r.quantity, 0);
      const p2Qty = p2Matches.reduce((sum, r) => sum + r.quantity, 0);

      const p1Val = p1Matches.reduce((sum, r) => sum + r.netSalesValue, 0);
      const p2Val = p2Matches.reduce((sum, r) => sum + r.netSalesValue, 0);

      return {
        supplierName: supName,
        p1Qty,
        p2Qty,
        qtyDiff: p2Qty - p1Qty,
        qtyGrowth: p1Qty > 0 ? ((p2Qty - p1Qty) / p1Qty) * 100 : 0,
        p1Val,
        p2Val,
        valDiff: p2Val - p1Val,
        valGrowth: p1Val > 0 ? ((p2Val - p1Val) / p1Val) * 100 : 0,
      };
    });
  }, [suppliersAll, p1Records, p2Records]);

  const regionStats = React.useMemo(() => {
    return regionsAll.map(regName => {
      const p1Matches = p1Records.filter(r => r.region === regName);
      const p2Matches = p2Records.filter(r => r.region === regName);

      const p1Qty = p1Matches.reduce((sum, r) => sum + r.quantity, 0);
      const p2Qty = p2Matches.reduce((sum, r) => sum + r.quantity, 0);

      const p1Val = p1Matches.reduce((sum, r) => sum + r.netSalesValue, 0);
      const p2Val = p2Matches.reduce((sum, r) => sum + r.netSalesValue, 0);

      return {
        regionName: regName,
        p1Qty,
        p2Qty,
        qtyDiff: p2Qty - p1Qty,
        qtyGrowth: p1Qty > 0 ? ((p2Qty - p1Qty) / p1Qty) * 100 : 0,
        p1Val,
        p2Val,
        valDiff: p2Val - p1Val,
        valGrowth: p1Val > 0 ? ((p2Val - p1Val) / p1Val) * 100 : 0,
      };
    });
  }, [regionsAll, p1Records, p2Records]);

  const getMonthLabel = (dateStr: string) => {
    if (!dateStr) return "Unknown";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { month: "long" });
  };

  const monthNamesOrdered = ["March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February"];

  const monthYearNames = React.useMemo(() => {
    return Array.from(new Set([
      ...p1Records.map(r => getMonthLabel(r.invoiceDate)),
      ...p2Records.map(r => getMonthLabel(r.invoiceDate))
    ])).sort((a,b) => monthNamesOrdered.indexOf(a) - monthNamesOrdered.indexOf(b));
  }, [p1Records, p2Records]);

  const monthlyStats = React.useMemo(() => {
    return monthYearNames.map(mName => {
      const p1Matches = p1Records.filter(r => getMonthLabel(r.invoiceDate) === mName);
      const p2Matches = p2Records.filter(r => getMonthLabel(r.invoiceDate) === mName);

      const p1Qty = p1Matches.reduce((sum, r) => sum + r.quantity, 0);
      const p2Qty = p2Matches.reduce((sum, r) => sum + r.quantity, 0);

      const p1Val = p1Matches.reduce((sum, r) => sum + r.netSalesValue, 0);
      const p2Val = p2Matches.reduce((sum, r) => sum + r.netSalesValue, 0);

      return {
        monthName: mName,
        p1Qty,
        p2Qty,
        qtyDiff: p2Qty - p1Qty,
        qtyGrowth: p1Qty > 0 ? ((p2Qty - p1Qty) / p1Qty) * 100 : 0,
        p1Val,
        p2Val,
        valDiff: p2Val - p1Val,
        valGrowth: p1Val > 0 ? ((p2Val - p1Val) / p1Val) * 100 : 0,
      };
    });
  }, [monthYearNames, p1Records, p2Records]);

  const tabsList = React.useMemo(() => {
    const list = [
      { id: "dashboard", label: "Dashboard", desc: "Executive KPI Hub" },
      { id: "product", label: "Product Comparative", desc: "SKU Volume Standings" },
      { id: "customer", label: "Customer Standings", desc: "Dealer Accounts" },
      { id: "supplier", label: "Suppliers Performance", desc: "Vendor Analysis" },
      { id: "lost", label: "Dropped & Lost CRM", desc: "CRM Risk Audit" },
      { id: "yoy", label: "YoY Comparison", desc: "Year over Year Grid" },
    ];
    if (hasBudget) {
      list.push({ id: "budgetVsActual", label: "Budget v/s Actual", desc: "Sales Target Standing" });
    }
    return list;
  }, [hasBudget]);

  return (
    <div className="space-y-6">
      
      {/* 📅 Company Invoice Date Coverage Banner */}
      {(() => {
        const ranges = getCompanyDateRanges();
        return (
          <div className="bg-gradient-to-r from-green-50/70 to-blue-50/50 border border-gray-150 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 text-left">
              <span className="text-[10px] uppercase font-bold tracking-widest text-green-700">
                📅 Database Coverage & Date Boundaries
              </span>
              <h2 className="text-sm font-semibold text-gray-900 leading-none">
                First and Last Invoice Dates
              </h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              {ranges.compRanges.map(({ company, range }) => (
                <div key={company} className="bg-white border border-gray-150 px-3.5 py-2 rounded-xl text-left shadow-2xs space-y-0.5">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">🏢 {company} Range</span>
                  <span className="text-[11px] text-gray-800 font-bold font-mono">
                    {range.min} <span className="text-gray-400 font-normal">to</span> {range.max}
                  </span>
                </div>
              ))}

              <div className="bg-green-600 border border-green-650 px-3.5 py-2 rounded-xl text-left shadow-sm space-y-0.5 block">
                <span className="text-[9px] text-green-200 font-bold uppercase tracking-wider block">📊 Total Combined Range</span>
                <span className="text-[11px] text-white font-bold font-mono">
                  {ranges.overall.min} <span className="text-green-300 font-normal">to</span> {ranges.overall.max}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 👤 Salesperson & Regional Manager direct customer assignments table */}
      {(currentUser.role === "Salesperson" || (currentUser.role === "Regional Manager" && assignedCustomers.length > 0)) && (
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-5 shadow-xs text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-teal-150 pb-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-teal-600 text-white p-2 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-teal-700 block">Registered Sales Desk Info</span>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>👤 My Assigned Customer Portfolio</span>
                  <span className="bg-teal-100 text-teal-800 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                    {assignedCustomers.length} Assigned Accounts
                  </span>
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Scope: <span className="font-semibold text-slate-700">{currentUser.role === "Salesperson" ? `Sub Group (Territory) - ${currentUser.territory || "Unassigned"}` : "Direct Accounts Portfolio"}</span> | Supervisor RM: <span className="font-semibold text-slate-700">{currentUser.managerName || "None"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-teal-150 bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-teal-50/50 text-slate-600 font-bold border-b border-teal-100 uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="p-3">Customer Acc Name</th>
                  <th className="p-3">Customer Code</th>
                  <th className="p-3 text-right">Transactions</th>
                  <th className="p-3 text-right">Total Net Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {assignedCustomers.length > 0 ? (
                  assignedCustomers.map((cust, itemIdx) => (
                    <tr key={itemIdx} className="hover:bg-slate-50 font-medium">
                      <td className="p-3 font-semibold text-slate-900">{cust.name}</td>
                      <td className="p-3 font-mono text-[10px]">{cust.code}</td>
                      <td className="p-3 text-right font-semibold">{cust.count} ledger lines</td>
                      <td className="p-3 text-right text-emerald-700 font-bold font-mono">₹{cust.totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 italic">No customer invoice receipts found matching your salesperson name in the active database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🌳 Regional Manager Reporting Sales Team Block */}
      {currentUser.role === "Regional Manager" && (
        <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 border border-blue-200 rounded-2xl p-5 shadow-xs text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-150 pb-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-xl">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-blue-700 block">Regional Command Desk Info</span>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>🌳 My Reporting Salesperson & Client Hierarchy</span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                    {subordinateHierarchy.length} Reporting Agents
                  </span>
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Operating Region: <span className="font-semibold text-slate-700">{currentUser.region || "Unassigned"}</span> | Role Position: <span className="font-semibold text-slate-700">Reporting Regional Overseer</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subordinateHierarchy.length > 0 ? (
              subordinateHierarchy.map((sub, spIdx) => (
                <div key={spIdx} className="bg-white rounded-xl border border-blue-100 p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-505 bg-blue-500"></span>
                        {sub.subordinate.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">{sub.subordinate.email}</p>
                    </div>
                    <span className="bg-blue-50 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-md font-mono">
                      {sub.subordinate.role === "Regional Manager" ? "Regional Manager" : (sub.subordinate.territory || "No Territory")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Assigned Dealer Accounts ({sub.customers.length})</span>
                    <div className="bg-slate-50/50 rounded-lg p-2.5 max-h-40 overflow-y-auto border border-slate-100 divide-y divide-slate-100">
                      {sub.customers.length > 0 ? (
                        sub.customers.map((cust, cIdx) => (
                          <div key={cIdx} className="flex items-center justify-between text-[11px] py-1.5 font-medium">
                            <div className="truncate pr-2">
                              <p className="text-slate-800 font-semibold truncate leading-tight" title={cust.name}>{cust.name}</p>
                              <p className="text-[8px] text-slate-400 font-mono font-semibold">Code: {cust.code}</p>
                            </div>
                            <span className="text-blue-700 font-bold font-mono text-[10px] shrink-0">₹{(cust.totalAmt/1000).toFixed(1)}k</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">No customer invoices in scope.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                No active salesperson accounts currently report to {currentUser.name} on the users list database.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Multi-Select Filters Panel */}
      {/* 1. DESKTOP ONLY INLINE FILTER ENGINE (Visible on `lg` screens and above) */}
      <div className="hidden lg:flex bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-xs items-center gap-4 transition-colors">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mr-2">
          <Filter className="w-4 h-4 text-gray-400 dark:text-slate-500" />
          <span>Interactive Filter Engine</span>
        </div>

        {/* Company filter */}
        <div className="flex flex-col gap-1 relative" id="company-multiselect-container">
          <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Company Scope</span>
          
          <button
            type="button"
            onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
            className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs text-gray-800 dark:text-slate-100 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 flex items-center justify-between gap-2 min-w-[180px] h-8 cursor-pointer shadow-3xs"
          >
            <span className="truncate">
              {selectedCompanies.length === 0 
                ? "All Companies (Combined)" 
                : selectedCompanies.length === uniqueCompanies.length
                ? "All Companies selected"
                : `${selectedCompanies.length} selected: ${selectedCompanies.join(", ")}`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          </button>

          {isCompanyDropdownOpen && (
            <>
              {/* Overlay background to dismiss the dropdown when clicking outside */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsCompanyDropdownOpen(false)} 
              />
              <div className="absolute top-13 left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-3 z-20 min-w-[220px] max-h-[300px] overflow-y-auto space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-750 mb-1">
                  <span className="text-[10px] font-bold text-gray-450 dark:text-slate-450 uppercase">Select Entity</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompanies([]);
                        applyCompaniesFilter([]);
                      }}
                      className="text-[9px] font-semibold text-green-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompanies(uniqueCompanies);
                        applyCompaniesFilter(uniqueCompanies);
                      }}
                      className="text-[9px] font-semibold text-green-600 hover:underline cursor-pointer"
                    >
                      All
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  {uniqueCompanies.map((companyName) => {
                    const isChecked = selectedCompanies.includes(companyName);
                    return (
                      <label 
                        key={companyName}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md cursor-pointer select-none text-xs text-gray-800 dark:text-slate-100"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let next: string[];
                            if (isChecked) {
                              next = selectedCompanies.filter(c => c !== companyName);
                            } else {
                              next = [...selectedCompanies, companyName];
                            }
                            setSelectedCompanies(next);
                            applyCompaniesFilter(next);
                          }}
                          className="rounded text-green-600 focus:ring-green-500 border-gray-300 dark:border-slate-650 w-3.5 h-3.5 bg-white dark:bg-slate-905"
                        />
                        <span className="font-medium">{companyName}</span>
                      </label>
                    );
                  })}
                  {uniqueCompanies.length === 0 && (
                    <span className="text-gray-450 text-xs italic block py-2 px-2 text-center">No companies available</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Filter on logged-in user subordinates */}
        {currentUser.role !== "Salesperson" && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold">SELECT USER</span>
            <select
              value={selectedRm}
              onChange={(e) => {
                setSelectedRm(e.target.value);
                applyFilters(selectedCompanies, e.target.value, selectedCategory, searchQuery);
              }}
              className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs text-gray-850 dark:text-slate-100 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 shadow-3xs cursor-pointer"
            >
              <option value="All">All</option>
              {subordinateUsersForFilter.map((usr) => (
                <option key={usr.id} value={usr.name}>
                  {usr.name} ({usr.role === "Regional Manager" ? `${usr.region || "RM"}` : `${usr.territory || "Salesperson"}`})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category segment filter */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Product Segment</span>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              applyFilters(selectedCompanies, selectedRm, e.target.value, searchQuery);
            }}
            className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs text-gray-850 dark:text-slate-100 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 shadow-3xs cursor-pointer"
          >
            <option value="All">All Segments</option>
            <option value="Plant Nutrients">Plant Nutrients</option>
            <option value="Fertilizers">Fertilizers</option>
            <option value="Biostimulants">Biostimulants</option>
            <option value="Microbial products">Microbial products</option>
          </select>
        </div>

        {/* Customer text lookup */}
        <div className="flex-1 min-w-[185px] flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Search Client Accounts</span>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by names or code matches..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                applyFilters(selectedCompanies, selectedRm, selectedCategory, e.target.value);
              }}
              className="w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 dark:text-slate-100 font-medium placeholder:text-gray-400 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Clear All parameters */}
        {(selectedCompanies.length > 0 || selectedRm !== "All" || selectedCategory !== "All" || searchQuery) && (
          <button
            onClick={() => {
              setSelectedCompanies([]);
              setSelectedRm("All");
              setSelectedCategory("All");
              setSearchQuery("");
              applyFilters([], "All", "All", "");
            }}
            className="self-end px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer transition shrink-0"
          >
            Clear All
          </button>
        )}
      </div>

      {/* 2. MOBILE & TABLET FLEXIBLE RESPONSIVE BAR (Visible under `lg` screens) */}
      <div className="flex lg:hidden flex-col gap-3.5 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 p-4 rounded-2xl shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-green-600" />
            <span>Interactive Filter Engine</span>
          </div>
          
          {(selectedCompanies.length > 0 || selectedRm !== "All" || selectedCategory !== "All" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCompanies([]);
                setSelectedRm("All");
                setSelectedCategory("All");
                setSearchQuery("");
                applyFilters([], "All", "All", "");
              }}
              className="text-[10px] font-extrabold text-red-600 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {/* Main search field */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search customers or codes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                applyFilters(selectedCompanies, selectedRm, selectedCategory, e.target.value);
              }}
              className="w-full border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800 rounded-xl pl-8.5 pr-2.5 py-2 text-xs text-gray-800 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 h-9"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Trigger filter drawer bottom panel */}
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(true)}
            className="px-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer h-9 shrink-0 relative"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Select Filters</span>
            {(selectedCompanies.length > 0 || selectedRm !== "All" || selectedCategory !== "All") && (
              <span className="w-2 h-2 rounded-full bg-red-400 absolute -top-0.5 -right-0.5 animate-pulse" />
            )}
          </button>
        </div>

        {/* 3. ACTIVE FILTERS TAG CHIPS */}
        {(selectedCompanies.length > 0 || selectedRm !== "All" || selectedCategory !== "All" || searchQuery) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-50 dark:border-slate-800/60 mt-1">
            <span className="text-[8px] font-bold text-gray-400 uppercase mr-1">Active Criteria:</span>
            
            {/* Companies chips */}
            {selectedCompanies.map(c => (
              <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-950/30 text-green-750 dark:text-green-400 rounded-md text-[9px] font-semibold border border-green-250/20">
                <span>{c}</span>
                <X 
                  className="w-2.5 h-2.5 hover:text-green-900 cursor-pointer" 
                  onClick={() => {
                    const next = selectedCompanies.filter(item => item !== c);
                    setSelectedCompanies(next);
                    applyCompaniesFilter(next);
                  }}
                />
              </span>
            ))}

            {/* RM selector chip */}
            {selectedRm !== "All" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-750 dark:text-blue-450 rounded-md text-[9px] font-semibold border border-blue-200/30">
                <span>RM: {selectedRm.split(" ").slice(-1)[0]}</span>
                <X 
                  className="w-2.5 h-2.5 hover:text-blue-900 cursor-pointer" 
                  onClick={() => {
                    setSelectedRm("All");
                    applyFilters(selectedCompanies, "All", selectedCategory, searchQuery);
                  }}
                />
              </span>
            )}

            {/* Category sector chip */}
            {selectedCategory !== "All" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/30 text-purple-750 dark:text-purple-400 rounded-md text-[9px] font-semibold border border-purple-200/30">
                <span>Segment: {selectedCategory}</span>
                <X 
                  className="w-2.5 h-2.5 hover:text-purple-900 cursor-pointer" 
                  onClick={() => {
                    setSelectedCategory("All");
                    applyFilters(selectedCompanies, selectedRm, "All", searchQuery);
                  }}
                />
              </span>
            )}

            {/* Search query chip */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-md text-[9px] font-semibold border border-amber-200/30">
                <span>Keyword: "{searchQuery.slice(0, 10)}"</span>
                <X 
                  className="w-2.5 h-2.5 hover:text-amber-900 cursor-pointer" 
                  onClick={() => {
                    setSearchQuery("");
                    applyFilters(selectedCompanies, selectedRm, selectedCategory, "");
                  }}
                />
              </span>
            )}
          </div>
        )}

        {/* 4. MOBILE DRAWER FILTER BOTTOM SHEET OVERLAY */}
        {isMobileFiltersOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop drawer background */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileFiltersOpen(false)}
            />
            
            {/* Main bottom drawer body */}
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl p-6 w-full max-w-lg shadow-2xl relative z-50 space-y-5 animate-slide-up border-t border-gray-150 dark:border-slate-800 text-left">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800/60 pb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-950 dark:text-slate-50 uppercase tracking-widest">
                  <Filter className="w-4 h-4 text-green-600" />
                  <span>Configure Filters</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Company check options */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-550 dark:text-slate-400 uppercase tracking-wider font-semibold block">Company Scope selection</span>
                <div className="grid grid-cols-2 gap-2 bg-gray-50/50 dark:bg-slate-950/30 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                  {uniqueCompanies.map((companyName) => {
                    const isChecked = selectedCompanies.includes(companyName);
                    return (
                      <label 
                        key={companyName}
                        className="flex items-center gap-2 py-1.5 px-1 hover:bg-slate-100 rounded-md cursor-pointer text-[11px] text-gray-700 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let next: string[];
                            if (isChecked) {
                              next = selectedCompanies.filter(c => c !== companyName);
                            } else {
                              next = [...selectedCompanies, companyName];
                            }
                            setSelectedCompanies(next);
                            applyCompaniesFilter(next);
                          }}
                          className="rounded text-green-600 focus:ring-green-500 border-gray-300 w-4 h-4"
                        />
                        <span className="truncate">{companyName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* RM dropdown on mobile */}
              {currentUser.role !== "Salesperson" && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold block">SELECT USER</span>
                  <select
                    value={selectedRm}
                    onChange={(e) => {
                      setSelectedRm(e.target.value);
                      applyFilters(selectedCompanies, e.target.value, selectedCategory, searchQuery);
                    }}
                    className="w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-slate-100 font-medium focus:outline-none"
                  >
                    <option value="All">All</option>
                    {subordinateUsersForFilter.map((usr) => (
                      <option key={usr.id} value={usr.name}>
                        {usr.name} ({usr.role === "Regional Manager" ? `${usr.region || "RM"}` : `${usr.territory || "Salesperson"}`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category selector on mobile */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold block">Product Segment catalog</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    applyFilters(selectedCompanies, selectedRm, e.target.value, searchQuery);
                  }}
                  className="w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-slate-100 font-medium focus:outline-none"
                >
                  <option value="All">All Segments</option>
                  <option value="Plant Nutrients">Plant Nutrients</option>
                  <option value="Fertilizers">Fertilizers</option>
                  <option value="Biostimulants">Biostimulants</option>
                  <option value="Microbial products">Microbial products</option>
                </select>
              </div>

              {/* Close / Apply action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="flex-1 py-2.5 border border-red-250 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 📅 Custom Dual-Period Comparative Sandbox */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-gray-150 dark:border-slate-800 p-4 md:p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsSandboxCollapsed(!isSandboxCollapsed)}
            className="flex items-center gap-2.5 text-xs font-bold text-gray-800 uppercase tracking-widest focus:outline-none hover:text-green-700 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-green-600" />
            <span>📅 Custom Dual-Period Analysis Sandbox</span>
            <span className="text-[10px] text-gray-400 font-medium normal-case">({isSandboxCollapsed ? "Click to Expand" : "Click to Collapse"})</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const dates = getInitialDates();
                setPeriod1Start(dates.p1Start);
                setPeriod1End(dates.p1End);
                setPeriod2Start(dates.p2Start);
                setPeriod2End(dates.p2End);
              }}
              className="text-[10px] bg-white border border-gray-250 hover:bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold cursor-pointer transition flex items-center gap-1 shadow-2xs"
            >
              📅 01-Mar to YTD
            </button>
            <button
              onClick={() => {
                const dates = getInitialDates();
                const lastDate = new Date(dates.maxAllowed);
                const y = lastDate.getFullYear();
                const mStr = String(lastDate.getMonth() + 1).padStart(2, "0");
                const dStr = String(lastDate.getDate()).padStart(2, "0");
                
                // Set Period 2 (Last Month): month start to last invoice date
                const p2S = `${y}-${mStr}-01`;
                const p2E = `${y}-${mStr}-${dStr}`;

                // Set Period 1 (Corresponding previous year period)
                const p1S = `${y - 1}-${mStr}-01`;
                const p1E = `${y - 1}-${mStr}-${dStr}`;

                setPeriod2Start(p2S);
                setPeriod2End(p2E);
                setPeriod1Start(p1S);
                setPeriod1End(p1E);
              }}
              className="text-[10px] bg-white border border-gray-250 hover:bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-bold cursor-pointer transition flex items-center gap-1 shadow-2xs"
            >
              📊 Last Available Month ({(() => {
                const dates = getInitialDates();
                const d = new Date(dates.maxAllowed);
                return d.toLocaleString("en-US", { month: "long" });
              })()})
            </button>
          </div>
        </div>

        {!isSandboxCollapsed && (
          <div className="space-y-4 pt-1">
            {/* Input selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-3.5 rounded-xl border border-gray-100">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Period 1 Start Date</label>
                <input
                  type="date"
                  value={period1Start}
                  max={getInitialDates().maxAllowed}
                  onChange={(e) => setPeriod1Start(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Period 1 End Date</label>
                <input
                  type="date"
                  value={period1End}
                  max={getInitialDates().maxAllowed}
                  onChange={(e) => setPeriod1End(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Period 2 Start Date</label>
                <input
                  type="date"
                  value={period2Start}
                  max={getInitialDates().maxAllowed}
                  onChange={(e) => setPeriod2Start(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Period 2 End Date</label>
                <input
                  type="date"
                  value={period2End}
                  max={getInitialDates().maxAllowed}
                  onChange={(e) => setPeriod2End(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                />
              </div>
            </div>

            {/* Metrics Dashboard output */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Metric 1: Sales comparative */}
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-2xs space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Period Sales Contrast</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-extrabold text-gray-800">₹{(p2Sales/100000).toFixed(2)}L</span>
                  <span className="text-[10px] text-gray-400 font-normal">vs P1: ₹{(p1Sales/100000).toFixed(2)}L</span>
                </div>
                <div className="flex items-center gap-1">
                  {salesChange >= 0 ? (
                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" /> +{salesChangePct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5">
                      <ArrowDownRight className="w-3.5 h-3.5 shrink-0" /> {salesChangePct.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-[9px] text-gray-400 font-semibold">({salesChange >= 0 ? "+" : ""}₹{(salesChange/100000).toFixed(1)}L change)</span>
                </div>
              </div>

              {/* Metric 2: Quantity comparative */}
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-2xs space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Cumulative Volume (Qty)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-extrabold text-gray-800">{(p2Qty).toLocaleString()} Kg/Ltr</span>
                  <span className="text-[10px] text-gray-400 font-normal">vs P1: {(p1Qty).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  {qtyChange >= 0 ? (
                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" /> +{qtyChangePct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5">
                      <ArrowDownRight className="w-3.5 h-3.5 shrink-0" /> {qtyChangePct.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-[9px] text-gray-400 font-semibold">({qtyChange >= 0 ? "+" : ""}{(qtyChange).toLocaleString()} Kg/Ltr)</span>
                </div>
              </div>

              {/* Metric 3: Top Products contrast */}
              <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-2xs space-y-1.5 col-span-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Segment Category Contribution</span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wide block mb-1">Period 1 Top</span>
                    <ul className="space-y-1">
                      {p1TopProducts.length > 0 ? p1TopProducts.map((p, idx) => (
                        <li key={idx} className="text-gray-700 font-semibold truncate" title={p.name}>• {p.name}</li>
                      )) : <li className="text-gray-400 italic">No sales</li>}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wide block mb-1">Period 2 Top</span>
                    <ul className="space-y-1">
                      {p2TopProducts.length > 0 ? p2TopProducts.map((p, idx) => (
                        <li key={idx} className="text-green-700 font-bold truncate" title={p.name}>• {p.name}</li>
                      )) : <li className="text-gray-400 italic">No sales</li>}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Metric 4: Top Customers contrast */}
              <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-2xs space-y-1.5 col-span-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Dealer Purchases Ranks</span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wide block mb-1">Period 1 Top</span>
                    <ul className="space-y-1">
                      {p1TopCustomers.length > 0 ? p1TopCustomers.map((c, idx) => (
                        <li key={idx} className="text-gray-700 font-semibold truncate" title={c.name}>• {c.name.split(" ")[0]}</li>
                      )) : <li className="text-gray-400 italic">No sales</li>}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wide block mb-1">Period 2 Top</span>
                    <ul className="space-y-1">
                      {p2TopCustomers.length > 0 ? p2TopCustomers.map((c, idx) => (
                        <li key={idx} className="text-blue-700 font-bold truncate" title={c.name}>• {c.name.split(" ")[0]}</li>
                      )) : <li className="text-gray-400 italic">No sales</li>}
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

       {/* 🔮 Interactive Multi-Tab Dashboard Suite */}
      <div id="subTabNavigationSuite" className="bg-gray-50 border border-gray-150 p-1.5 rounded-2xl flex flex-wrap gap-1">
        {tabsList.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 min-w-[125px] font-sans text-left px-3 py-2 rounded-xl cursor-pointer transition-all ${
              activeSubTab === tab.id 
                ? "bg-white text-green-700 font-bold shadow-xs border-b-2 border-green-600" 
                : "text-gray-500 hover:bg-white/50 hover:text-gray-900 font-semibold"
            }`}
          >
            <div className="text-xs">{tab.label}</div>
            <div className={`text-[8px] font-normal leading-none mt-0.5 ${activeSubTab === tab.id ? "text-green-500 font-bold" : "text-gray-400"}`}>{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* Render Active Sub-Tab View */}
      <div className="mt-4 transition-all duration-350 bg-white border border-gray-100 p-6 rounded-2xl shadow-3xs" id="activeSubTabRenderViewport">
        {activeSubTab === "dashboard" && (
          <DashboardOverviewTab 
            p1Records={p1Records} 
            p2Records={p2Records} 
            productStats={productStats} 
            customerStats={customerStats}
            regionStats={regionStats} 
          />
        )}
        {activeSubTab === "product" && (
          <ProductComparativeTab productStats={productStats} p1Records={p1Records} p2Records={p2Records} />
        )}
        {activeSubTab === "customer" && (
          <CustomerStandingsTab customerStats={customerStats} />
        )}
        {activeSubTab === "supplier" && (
          <SuppliersPerformanceTab supplierStats={supplierStats} />
        )}
        {activeSubTab === "lost" && (
          <DroppedLostCRMTab 
            customerStats={customerStats} 
            p1Records={p1Records} 
            p2Records={p2Records} 
          />
        )}
        {activeSubTab === "yoy" && (
          <YoYComparisonTab monthlyStats={monthlyStats} regionStats={regionStats} />
        )}
        {activeSubTab === "budgetVsActual" && (
          <BudgetvsActualTab 
            currentUser={currentUser} 
            scopedInvoices={scopedInvoices} 
            budgets={budgets} 
            users={users}
            selectedCompanies={selectedCompanies}
            selectedRm={selectedRm}
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
            period2Start={period2Start}
            period2End={period2End}
          />
        )}
      </div>

    </div>
  );
}
