import React, { useMemo, useState } from "react";
import { 
  TrendingUp, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  Award, 
  Lightbulb, 
  AlertTriangle,
  Calendar
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Bar, 
  Legend 
} from "recharts";
import { UserProfile, BudgetItem, InvoiceItem } from "../types";
import { getUserDescendantsList } from "../utils/analytics";

function getStandardizedValue(value: string, category: "customer" | "product"): string {
  if (!value) return "";
  const valNorm = value.trim().toLowerCase();
  
  const mappings = [
    { original: "pune fert", standardized: "Mahalaxmi Fertilizers Pune", category: "customer" },
    { original: "balaji satara", standardized: "Balaji Agro Services Satara", category: "customer" },
    { original: "krishna agency nasik", standardized: "Krishna Agro Agency Nashik", category: "customer" },
    { original: "malhar seeds", standardized: "Jai Malhar Seeds Kolhapur", category: "customer" },
    { original: "saraswathi solapur", standardized: "Saraswati Agro Solapur", category: "customer" },
    { original: "sugamax bio boost", standardized: "SugaMax Bio Enhancer", category: "product" },
    { original: "rhizo active", standardized: "RhizoActive Soil Pro", category: "product" },
  ];

  const matched = mappings.find(
    m => m.category === category && (m.original.toLowerCase() === valNorm || valNorm.includes(m.original.toLowerCase()))
  );
  
  if (matched) {
    return matched.standardized;
  }
  return value.trim().replace(/\s+/g, " ");
}

interface BudgetvsActualTabProps {
  currentUser: UserProfile;
  scopedInvoices?: InvoiceItem[];
  budgets?: BudgetItem[];
  users?: UserProfile[];
  selectedCompanies?: string[];
  selectedRm?: string;
  selectedCategory?: string;
  searchQuery?: string;
  period2Start?: string;
  period2End?: string;
}

export default function BudgetvsActualTab({
  currentUser,
  scopedInvoices = [],
  budgets = [],
  users = [],
  selectedCompanies = [],
  selectedRm = "All",
  selectedCategory = "All",
  searchQuery = "",
  period2Start,
  period2End,
}: BudgetvsActualTabProps) {

  // Report Run Date state - initialized to period2End by default, can be overridden locally
  const [localReportRunDate, setLocalReportRunDate] = useState<string | null>(null);
  const reportRunDate = localReportRunDate || period2End || "2026-06-05";

  // Dynamic Preceding March 1st calculator based on the selected report run date
  const precedingMarch1stStr = useMemo(() => {
    if (period2Start) return period2Start;
    if (!reportRunDate) return "2026-03-01";
    const parts = reportRunDate.split("-");
    const runDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    
    const year = runDateObj.getFullYear();
    const month = runDateObj.getMonth(); // 0-indexed (Jan = 0, Feb = 1, Mar = 2)

    // Preceding March 1st: March 1st of the same year if month is March (2) to December (11),
    // or March 1st of the previous year if month is January (0) or February (1).
    const precedingYear = month >= 2 ? year : year - 1;
    return `${precedingYear}-03-01`;
  }, [reportRunDate, period2Start]);

  // Building lookups for product -> company and product -> category based on invoices
  const { productToCompanyMap, productToCategoryMap } = useMemo(() => {
    const compMap = new Map<string, Set<string>>(); // lowercase product/category -> set of lowercase companies
    const catMap = new Map<string, Set<string>>();  // lowercase product/category -> set of categories
    
    (scopedInvoices || []).forEach(inv => {
      const prodNorm = (inv.productName || "").trim().toLowerCase();
      const catNorm = (inv.productCategory || "").trim().toLowerCase();
      
      if (inv.company) {
        const compNorm = inv.company.trim().toLowerCase();
        if (!compMap.has(prodNorm)) compMap.set(prodNorm, new Set());
        compMap.get(prodNorm)!.add(compNorm);
        
        // Also map by category name (e.g. "ag fort") to support budget-by-category references
        if (catNorm) {
          if (!compMap.has(catNorm)) compMap.set(catNorm, new Set());
          compMap.get(catNorm)!.add(compNorm);
        }
      }
      
      if (inv.productCategory) {
        if (!catMap.has(prodNorm)) catMap.set(prodNorm, new Set());
        catMap.get(prodNorm)!.add(catNorm);
        
        // Also map category to itself
        if (!catMap.has(catNorm)) catMap.set(catNorm, new Set());
        catMap.get(catNorm)!.add(catNorm);
      }
    });
    
    return { productToCompanyMap: compMap, productToCategoryMap: catMap };
  }, [scopedInvoices]);

  // 1. Identify active direct subordinate names and direct dealers associated with the user (including self)
  const targetSalespersonNames = useMemo(() => {
    if (!currentUser) return [];
    const names = new Set<string>();
    
    // Include user themselves to compile their own direct dealer achievements
    names.add(currentUser.name.trim().toLowerCase());
    if (currentUser.email) {
      names.add(currentUser.email.trim().toLowerCase());
    }

    const userRole = currentUser.role;
    const userNameNorm = (currentUser.name || "").trim().toLowerCase();
    const userRegionNorm = (currentUser.region || "").trim().toLowerCase();

    // High level managers of organization supervise everyone
    if (userRole === "Admin" || userRole === "Sales Director") {
      (users || []).forEach(u => {
        if (u.name) names.add(u.name.trim().toLowerCase());
        if (u.email) names.add(u.email.trim().toLowerCase());
      });
      // Also collect from budgets and scopedInvoices so uploaded records and seed records are fully visible
      (budgets || []).forEach(b => {
        if (b.salesperson) names.add(b.salesperson.trim().toLowerCase());
      });
      (scopedInvoices || []).forEach(inv => {
        if (inv.salesperson) names.add(inv.salesperson.trim().toLowerCase());
      });
    } else {
      // Add recursive descendants (both direct and indirect subordinates)
      const descendants = getUserDescendantsList(currentUser, users || []);
      descendants.forEach(d => {
        if (d.name) names.add(d.name.trim().toLowerCase());
        if (d.email) names.add(d.email.trim().toLowerCase());
      });
    }

    let finalNames = Array.from(names);

    // Apply the active Regional Manager filter!
    if (selectedRm && selectedRm !== "All") {
      const rmNorm = selectedRm.trim().toLowerCase();
      const rmSubordinateNames = new Set<string>();
      
      // Include the RM themselves
      rmSubordinateNames.add(rmNorm);

      // 1. Dynamic database lookup for RM and their descendants using getUserDescendantsList
      const matchingRmUser = (users || []).find(u => {
        const uName = (u.name || "").trim().toLowerCase();
        const uEmail = (u.email || "").trim().toLowerCase();
        const uId = (u.id || "").trim().toLowerCase();
        return uName === rmNorm || uEmail === rmNorm || uId === rmNorm;
      });

      if (matchingRmUser) {
        rmSubordinateNames.add((matchingRmUser.name || "").trim().toLowerCase());
        if (matchingRmUser.email) rmSubordinateNames.add(matchingRmUser.email.trim().toLowerCase());
        
        const rmDesc = getUserDescendantsList(matchingRmUser, users || []);
        rmDesc.forEach(d => {
          if (d.name) rmSubordinateNames.add(d.name.trim().toLowerCase());
          if (d.email) rmSubordinateNames.add(d.email.trim().toLowerCase());
        });
      }

      // 2. Hardcoded fallback dictionary to keep compatibility with seed data/original users
      const rmToSubordinatesMap: Record<string, string[]> = {
        "s. r. patil": ["v. r. sharma", "a. p. kulkarni", "b. waghachaure", "bwaghachaure@plantnutrition.in", "vbhagre@plantnutrition.in", "s. r. patil"],
        "k. swamy": ["m. n. rao", "s. gopal", "k. swamy"],
        "r. k. singh": ["amit verma", "sanjay dutta", "r. k. singh"],
      };

      const subordinatesOfRm = rmToSubordinatesMap[rmNorm] || [];
      subordinatesOfRm.forEach(n => rmSubordinateNames.add(n));

      // 3. Keep searching database for fallback direct reports matching rmName
      (users || []).forEach(u => {
        if (u.managerName && u.managerName.trim().toLowerCase() === rmNorm) {
          if (u.name) rmSubordinateNames.add(u.name.trim().toLowerCase());
          if (u.email) rmSubordinateNames.add(u.email.trim().toLowerCase());
        }
        if (u.name && u.name.trim().toLowerCase() === rmNorm) {
          rmSubordinateNames.add(u.name.trim().toLowerCase());
          if (u.email) rmSubordinateNames.add(u.email.trim().toLowerCase());
        }
      });

      // 4. Scan invoices and budgets for salespeople mapping to this RM to include custom spreadsheet entries
      (scopedInvoices || []).forEach(inv => {
        if (inv.regionalManager && inv.regionalManager.trim().toLowerCase() === rmNorm && inv.salesperson) {
          rmSubordinateNames.add(inv.salesperson.trim().toLowerCase());
        }
      });
      (budgets || []).forEach(b => {
        if (b.regionalManager && b.regionalManager.trim().toLowerCase() === rmNorm && b.salesperson) {
          rmSubordinateNames.add(b.salesperson.trim().toLowerCase());
        }
      });

      // Intersect
      finalNames = finalNames.filter(name => rmSubordinateNames.has(name));
    }

    return finalNames;
  }, [currentUser, users, selectedRm, budgets, scopedInvoices]);

  // Tab visibility guard (if user has absolutely no budget records assigned in database)
  const hasBudgetAssigned = useMemo(() => {
    if (!budgets || !currentUser) return false;
    if (currentUser.role === "Admin" || currentUser.role === "Sales Director") return true;
    return budgets.some(b => {
      const salespersonNorm = (b.salesperson || "").trim().toLowerCase();
      
       // Start with original targetSalespersonNames based purely on RLS clearance
      const baseNames = new Set<string>();
      baseNames.add(currentUser.name.trim().toLowerCase());
      if (currentUser.role === "Regional Manager") {
        // Collect descendants dynamically!
        const descendants = getUserDescendantsList(currentUser, users || []);
        descendants.forEach(d => {
          if (d.name) baseNames.add(d.name.trim().toLowerCase());
          if (d.email) baseNames.add(d.email.trim().toLowerCase());
        });

        let subNames: string[] = [];
        const rmRegion = (currentUser.region || "").trim().toLowerCase();
        const rmName = (currentUser.name || "").trim().toLowerCase();

        if (currentUser.region === "West") {
          subNames = ["v. r. sharma", "a. p. kulkarni", "b. waghachaure", "bwaghachaure@plantnutrition.in", "vbhagre@plantnutrition.in"];
        } else if (currentUser.region === "South") {
          subNames = ["m. n. rao", "s. gopal"];
        } else if (currentUser.region === "North") {
          subNames = ["amit verma", "sanjay dutta"];
        }
        subNames.forEach(n => baseNames.add(n));

        // Scan invoices and budgets with this regional manager or region
        (scopedInvoices || []).forEach(inv => {
          const invRm = (inv.regionalManager || "").trim().toLowerCase();
          const pReg = (inv.region || "").trim().toLowerCase();
          if (inv.salesperson && (invRm === rmName || (rmRegion && pReg === rmRegion))) {
            baseNames.add(inv.salesperson.trim().toLowerCase());
          }
        });
        (budgets || []).forEach(b => {
          const bRm = (b.regionalManager || "").trim().toLowerCase();
          const bReg = (b.region || "").trim().toLowerCase();
          if (b.salesperson && (bRm === rmName || (rmRegion && bReg === rmRegion))) {
            baseNames.add(b.salesperson.trim().toLowerCase());
          }
        });
      }
      (users || []).forEach(u => {
        if (u.role === "Salesperson" && u.managerName) {
          const mgrNorm = u.managerName.trim().toLowerCase();
          if (mgrNorm === currentUser.name.trim().toLowerCase() || (currentUser.region && mgrNorm === currentUser.region.trim().toLowerCase())) {
            baseNames.add(u.name.trim().toLowerCase());
          }
        }
      });
      return baseNames.has(salespersonNorm);
    });
  }, [budgets, currentUser, users, scopedInvoices]);

  // 2. Identify the budget items matching chosen salespeople list, company scope, category segment, and search query
  const userBudgets = useMemo(() => {
    if (!budgets || !currentUser) return [];
    
    const userNameNorm = (currentUser.name || "").trim().toLowerCase();
    const userEmailNorm = (currentUser.email || "").trim().toLowerCase();
    const userRole = currentUser.role;

    // Start with budgets filtered: Admin can see selected targets, others ONLY their own direct budget sheets
    let filtered = budgets.filter(b => {
      const salespersonNorm = (b.salesperson || "").trim().toLowerCase();
      if (userRole === "Admin") {
        return targetSalespersonNames.includes(salespersonNorm);
      } else {
        return salespersonNorm === userNameNorm || salespersonNorm === userEmailNorm;
      }
    });

    // A. Apply Company Scope Filter on budgets using product mapping
    if (selectedCompanies && selectedCompanies.length > 0) {
      const activeCosNorm = selectedCompanies.map(c => c.trim().toLowerCase());
      filtered = filtered.filter(b => {
        const prodNorm = (b.product || "").trim().toLowerCase();
        const mappedCompanies = productToCompanyMap.get(prodNorm);
        if (!mappedCompanies) return false;
        // Check if any mapped company of this product matches selected companies
        return Array.from(mappedCompanies).some(co => activeCosNorm.includes(co as string));
      });
    }

    // B. Apply Product Segment Filter on budgets using product mapping
    if (selectedCategory && selectedCategory !== "All") {
      const catNorm = selectedCategory.trim().toLowerCase();
      filtered = filtered.filter(b => {
        const prodNormRaw = (b.product || "").trim().toLowerCase();
        const prodNorm = getStandardizedValue(prodNormRaw, "product").toLowerCase();
        const mappedCategories = productToCategoryMap.get(prodNorm);
        if (mappedCategories && Array.from(mappedCategories).some(cat => (cat as string) === catNorm)) {
          return true;
        }
        return prodNorm === catNorm;
      });
    }

    // C. Apply Search Query Filter on budgets
    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b => {
        const prod = (b.product || "").toLowerCase();
        const sp = (b.salesperson || "").toLowerCase();
        return prod.includes(q) || sp.includes(q);
      });
    }

    return filtered;
  }, [budgets, currentUser, targetSalespersonNames, selectedCompanies, selectedCategory, searchQuery, productToCompanyMap, productToCategoryMap]);

  // 3. Filter YTD actual invoices starting from preceding March 1st up to report run date with all top-level filters applied
  const actualInvoicesYtd = useMemo(() => {
    return (scopedInvoices || []).filter(inv => {
      const salespersonNorm = (inv.salesperson || "").trim().toLowerCase();
      const isSubordinateOrSelf = targetSalespersonNames.includes(salespersonNorm);
      if (!isSubordinateOrSelf) return false;
      
      // Match within the custom dynamic YTD range (From preceding March 1st to report run date)
      const isYtd = inv.invoiceDate >= precedingMarch1stStr && inv.invoiceDate <= reportRunDate;
      if (!isYtd) return false;

      // Apply Company Scope filter
      if (selectedCompanies && selectedCompanies.length > 0) {
        const normComp = (inv.company || "").trim().toLowerCase();
        const hasMatch = selectedCompanies.some(c => c.trim().toLowerCase() === normComp);
        if (!hasMatch) return false;
      }

      // Apply Product Segment filter
      if (selectedCategory && selectedCategory !== "All") {
        const catNorm = selectedCategory.trim().toLowerCase();
        const invCatNorm = (inv.productCategory || "").trim().toLowerCase();
        if (invCatNorm !== catNorm) return false;
      }

      // Apply Search Query filter
      if (searchQuery && searchQuery.trim() !== "") {
        const clean = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const q = clean(searchQuery);
        const custName = clean(inv.customerName);
        const custCode = clean(inv.customerCode);
        const prodName = clean(inv.productName);
        const isMatch = custName.includes(q) || custCode.includes(q) || prodName.includes(q);
        if (!isMatch) return false;
      }

      return true;
    });
  }, [scopedInvoices, targetSalespersonNames, precedingMarch1stStr, reportRunDate, selectedCompanies, selectedCategory, searchQuery]);

  // 4. Group targets and actual achievements by Product Category Segment
  const processedData = useMemo(() => {
    const typedUserBudgets = userBudgets as BudgetItem[];
    const typedActualInvoices = actualInvoicesYtd as InvoiceItem[];
    const uniqueProducts = Array.from(new Set(typedUserBudgets.map(b => (b.product || "").trim())));

    const list = uniqueProducts.map(prodName => {
      const segmentBudgets = typedUserBudgets.filter(
        b => (b.product || "").trim().toLowerCase() === prodName.trim().toLowerCase()
      );

      // Find YTD invoices matching this product segment
      const matchedYtdInvoices = typedActualInvoices.filter(inv => {
        const invProd = (inv.productName || "").trim().toLowerCase();
        const invCat = (inv.productCategory || "").trim().toLowerCase();
        const bProd = prodName.trim().toLowerCase();
        
        const bProdStd = getStandardizedValue(bProd, "product").toLowerCase();
        const invProdStd = getStandardizedValue(invProd, "product").toLowerCase();
        
        return invProd === bProd || 
               invCat === bProd || 
               invProdStd === bProdStd || 
               invCat === bProdStd ||
               invProdStd === bProd || 
               invProd === bProdStd;
      });

      // Total Budgeted Quantity & budgeted value
      const budgetQty = segmentBudgets.reduce((sum, b) => sum + (b.budgetQuantity || 0), 0);
      const budgetValue = segmentBudgets.reduce((sum, b) => sum + (b.budgetValue || 0), 0);

      // Total YTD Actual Quantity achieved (across user & subordinatess)
      const actualQty = matchedYtdInvoices.reduce((sum, inv) => sum + (inv.quantity || 0), 0);

      // Volume gap (deficit/shortfall is negative, surplus is positive)
      const qtyGap = actualQty - budgetQty;
      const qtyGapAbs = Math.abs(qtyGap);

      // Weighted budgeted rate: Sum (Budgeted Rate * Budget Quantity) / Sum (Budget Quantity)
      let budgetRate = 0;
      const totalWeightedRate = segmentBudgets.reduce((sum, b) => {
        const rate = b.budgetRate || (b.budgetQuantity > 0 ? b.budgetValue / b.budgetQuantity : 0);
        return sum + (rate * (b.budgetQuantity || 0));
      }, 0);
      if (budgetQty > 0) {
        budgetRate = totalWeightedRate / budgetQty;
      } else {
        const firstRate = segmentBudgets[0]?.budgetRate || 0;
        budgetRate = firstRate > 0 ? firstRate : 0;
      }

      // If budgetRate remains 0, fallback to average system rate or default
      if (budgetRate === 0) {
        budgetRate = 500; 
      }

      // Computed Actual Value = Actual YTD Volume * Budgeted Rate
      const actualValueAtBudgetRate = actualQty * budgetRate;

      // Actual Net Invoice Value sum
      const invoiceValue = matchedYtdInvoices.reduce((sum, inv) => sum + (inv.netSalesValue || 0), 0);

      const qtyAchievementPercent = budgetQty > 0 ? (actualQty / budgetQty) * 100 : 0;
      const valueAchievementPercent = budgetValue > 0 ? (invoiceValue / budgetValue) * 100 : 0;

      return {
        productName: prodName,
        budgetQty,
        actualQty,
        qtyGap,
        qtyGapAbs,
        budgetRate,
        budgetValue,
        actualValueAtBudgetRate,
        invoiceValue,
        qtyAchievementPercent,
        valueAchievementPercent,
      };
    });

    // Rank critical shortfalls ONLY (products with a negative volume gap)
    const shortfallsOnly = list.filter(item => item.qtyGap < 0);
    const sortedShortfalls = [...shortfallsOnly].sort((a, b) => b.qtyGapAbs - a.qtyGapAbs);

    return list.map(item => {
      let isTop10Gap = false;
      let gapRank = -1;

      if (item.qtyGap < 0) {
        const rankIndex = sortedShortfalls.findIndex(s => s.productName === item.productName);
        if (rankIndex !== -1) {
          gapRank = rankIndex + 1;
          isTop10Gap = gapRank <= 10;
        }
      }

      return {
        ...item,
        gapRank,
        isTop10Gap,
      };
    });
  }, [userBudgets, actualInvoicesYtd]);

  // Sort list logically (alphabetical) for table presentation
  const sortedProcessedData = useMemo(() => {
    return [...processedData].sort((a, b) => a.productName.localeCompare(b.productName));
  }, [processedData]);

  // Aggregate parameters
  const aggregateStats = useMemo(() => {
    const totalBudgetQty = processedData.reduce((sum, item) => sum + item.budgetQty, 0);
    const totalActualQty = processedData.reduce((sum, item) => sum + item.actualQty, 0);
    const totalBudgetVal = processedData.reduce((sum, item) => sum + item.budgetValue, 0);
    const totalInvoiceVal = processedData.reduce((sum, item) => sum + item.invoiceValue, 0);
    const overachievedCount = processedData.filter(item => item.qtyGap >= 0).length;
    const underachievedCount = processedData.filter(item => item.qtyGap < 0).length;

    const overallQtyPercent = totalBudgetQty > 0 ? (totalActualQty / totalBudgetQty) * 100 : 0;
    const overallValPercent = totalBudgetVal > 0 ? (totalInvoiceVal / totalBudgetVal) * 100 : 0;

    return {
      totalBudgetQty,
      totalActualQty,
      totalBudgetVal,
      totalInvoiceVal,
      overachievedCount,
      underachievedCount,
      overallQtyPercent,
      overallValPercent,
    };
  }, [processedData]);

  // Suggestions generator tailored to closed gaps
  const activeSuggestions = useMemo(() => {
    return processedData
      .map(item => {
        const isShortfall = item.qtyGap < 0;
        const deficitQty = Math.abs(item.qtyGap);
        const valDeficit = Math.max(0, item.budgetValue - item.actualValueAtBudgetRate);

        let suggestionText = "";
        let actionColor: "amber" | "red" | "green" = "amber";

        if (isShortfall) {
          actionColor = item.isTop10Gap ? "red" : "amber";
          if (item.isTop10Gap) {
            suggestionText = `Critical gap of ${Math.round(deficitQty).toLocaleString()} Kg/L for ${item.productName} (Top 10 Volume Shortfall). Immediate priority: Coordinate target dealer visits and offer preferential fast-delivery allocations to clear the inventory discrepancy.`;
          } else {
            suggestionText = `Minor shortfall of ${Math.round(deficitQty).toLocaleString()} Kg/L for ${item.productName}. Consider bundle alignment or regional trade displays with distributors to drive local demand.`;
          }
        } else {
          actionColor = "green";
          suggestionText = `Target Exceeded! You achieved ${Math.round(item.actualQty).toLocaleString()} Kg/L vs ${Math.round(item.budgetQty).toLocaleString()} budget (+${(item.qtyAchievementPercent - 100).toFixed(1)}%). Sustain the distributor relationship to retain this market share.`;
        }

        return {
          productName: item.productName,
          isShortfall,
          deficitQty,
          valDeficit,
          suggestionText,
          actionColor,
          qtyAchievementPercent: item.qtyAchievementPercent,
        };
      })
      .sort((a, b) => {
        if (a.isShortfall && !b.isShortfall) return -1;
        if (!a.isShortfall && b.isShortfall) return 1;
        return b.deficitQty - a.deficitQty;
      });
  }, [processedData]);

  // Target values to present in chart
  const chartData = useMemo(() => {
    return sortedProcessedData.map(item => ({
      name: item.productName.length > 20 ? item.productName.substring(0, 18) + "..." : item.productName,
      "Budget Qty": Math.round(item.budgetQty),
      "Actual Qty": Math.round(item.actualQty),
    }));
  }, [sortedProcessedData]);

  if (!hasBudgetAssigned) {
    return null;
  }

  const renderHeader = () => (
    <div className="border-b border-gray-100 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-gray-950 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Budget v/s Actual Comparative Statement (YTD)
          </h3>
          <span className="bg-green-100 text-green-800 text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-green-200">
            Hierarchy Active
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Showing target quantities, budgeted rates, actual volumes (including all reporting subordinates and direct dealers), computed values, and net ledger values for <strong className="text-gray-700">{currentUser.name}</strong>.
          <span className="block mt-1 text-emerald-650 font-semibold bg-emerald-50/50 inline-block px-2 py-0.5 rounded border border-emerald-100/60 font-sans">
            YTD Period Range: <strong className="font-bold underline">{precedingMarch1stStr}</strong> to <strong className="font-bold underline">{reportRunDate}</strong>
          </span>
        </p>
      </div>

      {/* Dynamic Customizable Report Run Date selector to adjust preceding March 1st ranges */}
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl flex-shrink-0 self-start md:self-auto">
        <Calendar className="w-4 h-4 text-slate-500" />
        <div className="text-left">
          <span className="block text-[8px] font-bold uppercase text-slate-400 tracking-wider font-sans">Report End Date</span>
          <input
            type="date"
            className="border-0 p-0 text-xs font-extrabold text-slate-800 bg-transparent focus:ring-0 cursor-pointer outline-none"
            value={reportRunDate}
            onChange={(e) => setLocalReportRunDate(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  if (sortedProcessedData.length === 0) {
    return (
      <div className="space-y-6 text-left" id="budgetVsActualWorkspace">
        {renderHeader()}
        
        {/* Beautiful empty state for filter mismatch */}
        <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-2xs space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-sans">No matching records found</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              No budgets or actual transactional units matched the active dashboard filters.
            </p>
            <div className="text-[10px] text-gray-400 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2 font-mono space-y-1 text-left">
              <div>• Selected Companies: <span className="text-gray-600 font-semibold">{selectedCompanies.length > 0 ? selectedCompanies.join(", ") : "All"}</span></div>
              <div>• Product Category: <span className="text-gray-600 font-semibold">{selectedCategory}</span></div>
              <div>• Regional Manager: <span className="text-gray-600 font-semibold">{selectedRm}</span></div>
              {searchQuery && <div>• Keyword: <span className="text-gray-600 font-semibold">"{searchQuery}"</span></div>}
            </div>
            <p className="text-[10px] text-slate-400 pt-2">
              Try adjusting the filters at the top of the dashboard to expand your search scope.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left" id="budgetVsActualWorkspace">
      
      {/* Upper Descriptive Header Cards */}
      {renderHeader()}

      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Cumulative Target Volume</span>
            <div className="text-lg font-black text-slate-900 mt-1">
              {Math.round(aggregateStats.totalBudgetQty).toLocaleString()} Kg/L
            </div>
          </div>
          <span className="text-[9px] text-gray-400 mt-1">Total aggregated target limits for the team</span>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">Actual achievement (YTD)</span>
            <div className="text-lg font-black text-blue-900 mt-1">
              {Math.round(aggregateStats.totalActualQty).toLocaleString()} Kg/L
            </div>
          </div>
          <div className="text-[10px] text-blue-700 font-bold flex items-center gap-1 mt-1">
            <span>Overall: {aggregateStats.overallQtyPercent.toFixed(1)}% volumetric target met</span>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Cumulative Invoice Value</span>
            <div className="text-lg font-black text-emerald-900 mt-1 font-mono">
              ₹{Math.round(aggregateStats.totalInvoiceVal).toLocaleString()}
            </div>
          </div>
          <span className="text-[9px] text-emerald-700 font-bold mt-1">
            vs Budgeted Val: ₹{Math.round(aggregateStats.totalBudgetVal).toLocaleString()} ({aggregateStats.overallValPercent.toFixed(1)}%)
          </span>
        </div>

        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600">LOB Breakdown</span>
            <div className="text-lg font-black text-amber-900 mt-1">
              {aggregateStats.underachievedCount} Below target / {aggregateStats.overachievedCount} Exceeded
            </div>
          </div>
          <span className="text-[9px] text-gray-400 mt-1">Unique category segments tracked</span>
        </div>

      </div>

      {/* Double Bar Chart for Budget v/s Actual */}
      <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl">
          <div className="text-left">
            <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest">
              Team Volumetric Target v/s Actual Achievement Map
            </h4>
            <p className="text-[10px] text-gray-450 mt-0.5">
              Consolidated visualization of budgeted segment quantities contrasted against actual achievements.
            </p>
          </div>
        </div>

        <div className="h-[240px] w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" fontSize={9} stroke="#64748b" tickLine={false} />
              <YAxis fontSize={9} stroke="#64748b" tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
              <Bar name="Budget Target" dataKey="Budget Qty" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
              <Bar name="Actual Achievement" dataKey="Actual Qty" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Budget vs Actual Grid Table */}
      <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider">
              Segment Quota Tracking Ledger
            </h4>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Direct comparisons of volume gaps, computed value matrices, and final actual billed billing invoices.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-bold">
            <div className="flex items-center gap-1.5 font-sans">
              <span className="w-3 h-3 bg-red-100 border border-red-300 rounded inline-block"></span>
              <span className="text-red-700">Top 10 Volume Shortfall Gap Highlight</span>
            </div>
            <div className="flex items-center gap-1.5 font-sans">
              <span className="w-3 h-3 bg-indigo-50 border border-indigo-200 rounded inline-block"></span>
              <span className="text-indigo-700">Underperforming Lower Gap</span>
            </div>
            <div className="flex items-center gap-1.5 font-sans">
              <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded inline-block"></span>
              <span className="text-emerald-750">Achieved/Exceeded Goals</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="budgetVsActualTable">
            <thead>
              <tr className="border-b border-gray-150 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-2.5 px-2">Product Category Segment</th>
                <th className="py-2.5 text-right font-mono">Budget Qty</th>
                <th className="py-2.5 text-right font-mono">Actual Qty</th>
                <th className="py-2.5 text-right font-semibold">Volume Gap</th>
                <th className="py-2.5 text-right font-mono">Budget Rate</th>
                <th className="py-2.5 text-right font-mono">Budget Value</th>
                <th className="py-2.5 text-right text-green-700 font-bold">Value (Actual Qty * Rate)</th>
                <th className="py-2.5 text-right text-blue-750 font-bold bg-slate-50/50">Invoice Value Column</th>
                <th className="py-2.5 text-center">Gap Rank</th>
                <th className="py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {sortedProcessedData.map((item) => {
                const isUnderDeficit = item.qtyGap < 0;
                const isMaxCriticalGap = item.isTop10Gap;
                
                // Colors layout configurations:
                // 1. Highlighting top ten products with the maximum volume gap in red.
                // 2. Also show the products with a lower volume gap in a different colour (e.g. indigo).
                // 3. Highlight achieved/exceeded products in soft green/emerald.
                let bgRowColor = "bg-emerald-50/20 text-emerald-950 font-bold hover:bg-emerald-50/40";
                let badgeColor = "bg-green-100 text-green-800 border-green-200";
                let statusLabel = "Achieved";

                if (isUnderDeficit) {
                  if (isMaxCriticalGap) {
                    bgRowColor = "bg-red-50/70 text-red-950 font-bold hover:bg-red-50/90";
                    badgeColor = "bg-red-100 text-red-800 border-red-200";
                    statusLabel = "Critical Gap (#" + item.gapRank + ")";
                  } else {
                    bgRowColor = "bg-indigo-50/30 text-indigo-950 hover:bg-indigo-50/50";
                    badgeColor = "bg-indigo-100 text-indigo-800 border-indigo-250";
                    statusLabel = "Deficit Gap";
                  }
                }

                return (
                  <tr key={item.productName} className={`${bgRowColor} transition align-middle`}>
                    <td className="py-3 px-2 font-black truncate max-w-[210px]" title={item.productName}>
                      {item.productName}
                    </td>
                    <td className="py-3 text-right font-mono text-gray-500">
                      {Math.round(item.budgetQty).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-gray-900 font-bold">
                      {Math.round(item.actualQty).toLocaleString()}
                    </td>
                    <td className={`py-3 text-right font-mono font-bold ${isUnderDeficit ? "text-red-700" : "text-emerald-700"}`}>
                      {item.qtyGap >= 0 ? "+" : ""}{Math.round(item.qtyGap).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-gray-400">
                      ₹{Math.round(item.budgetRate).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-gray-500">
                      ₹{Math.round(item.budgetValue).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-green-700 font-extrabold" title="YTD sales volume * budget rate">
                      ₹{Math.round(item.actualValueAtBudgetRate).toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-blue-900 font-bold bg-slate-50/30">
                      ₹{Math.round(item.invoiceValue).toLocaleString()}
                    </td>
                    <td className="py-3 text-center">
                      {item.gapRank !== -1 ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          isMaxCriticalGap ? "bg-red-200 text-red-950" : "bg-indigo-100 text-indigo-900"
                        }`}>
                          #{item.gapRank}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded border ${badgeColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🚀 AI Sales Copilot Suggestion Cards to Close Volume & Revenue shortfalls */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-150 p-6 rounded-2xl shadow-3xs space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-green-700" />
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest text-green-950">
            AI Sales Copilot: Recommendation Cards for Goal Achievement
          </h4>
        </div>
        <p className="text-[11px] text-emerald-950 leading-relaxed max-w-4xl">
          Based on the consolidated group actual volumes and budgeted segment estimates, we formulated specific micro-tactical playbooks for your business segment lines to recover gaps and capture higher fiscal shares:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeSuggestions.map((sug, idx) => {
            const suggestionId = `sug_${idx}`;
            
            return (
              <div 
                key={suggestionId} 
                className={`border p-4 rounded-xl flex items-start gap-3 transition hover:shadow-2xs ${
                  sug.actionColor === "red" 
                    ? "border-red-200 bg-white shadow-red-50/40 text-red-950" 
                    : sug.actionColor === "amber"
                    ? "border-indigo-200 bg-white shadow-indigo-50/40 text-indigo-950"
                    : "border-green-200 bg-white shadow-green-50/40 text-emerald-950"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-2.5 flex-shrink-0 ${
                  sug.actionColor === "red" ? "bg-red-650 animate-pulse" : sug.actionColor === "amber" ? "bg-indigo-600" : "bg-green-600"
                }`} />
                <div className="space-y-1 w-full">
                  <div className="font-extrabold text-[11px] text-gray-950 flex justify-between items-center">
                    <span>{sug.productName}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      sug.actionColor === "red" 
                        ? "bg-red-100 text-red-800" 
                        : sug.actionColor === "amber" 
                        ? "bg-indigo-100 text-indigo-800" 
                        : "bg-green-100 text-green-800"
                    }`}>
                      {sug.qtyAchievementPercent.toFixed(0)}% Target met
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-700 leading-relaxed font-medium">
                    {sug.suggestionText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
