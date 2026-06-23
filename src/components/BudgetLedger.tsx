import React, { useState, useMemo, useEffect } from "react";
import { BudgetItem } from "../types";
import { 
  Search, 
  Download, 
  ChevronUp, 
  ChevronDown, 
  User, 
  MapPin, 
  ChevronLeft, 
  ChevronRight, 
  Target,
  ArrowLeft,
  Save,
  Undo,
  CheckCircle,
  Eye,
  AlertCircle,
  Edit2
} from "lucide-react";

interface BudgetLedgerProps {
  budgets: BudgetItem[];
  onUpdateBudgets?: (updatedBudgets: BudgetItem[]) => void;
}

interface GroupedBudget {
  key: string; // "salesperson|||financialYear"
  salesperson: string;
  financialYear: string;
  regionalManager: string;
  region: string;
  territory: string;
  productsCount: number;
  totalQuantity: number;
  totalValue: number;
  items: BudgetItem[];
}

export default function BudgetLedger({ budgets, onUpdateBudgets }: BudgetLedgerProps) {
  // Navigation State: null means grouped ledger view, otherwise holds active salesperson + FY view key
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

  // Grouped View filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRm, setSelectedRm] = useState<string>("All");
  const [selectedFY, setSelectedFY] = useState<string>("All");

  // Sorted State for Grouped Ledger
  const [sortField, setSortField] = useState<"salesperson" | "financialYear" | "totalQuantity" | "totalValue" | "productsCount">("salesperson");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination State for Grouped Ledger
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Detail Draft state (key -> list of budget items in detail view being edited)
  const [draftItems, setDraftItems] = useState<BudgetItem[]>([]);
  const [detailSearchTerm, setDetailSearchTerm] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Sync draft list when active group key shifts
  useEffect(() => {
    if (activeGroupKey) {
      const parts = activeGroupKey.split("|||");
      const spName = parts[0];
      const fYear = parts[1];
      
      // Load deep-copied rows into local state for draft editing
      const matching = budgets.filter(
        b => (b.salesperson || "").trim().toLowerCase() === spName.trim().toLowerCase() && 
             (b.financialYear || "").trim().toLowerCase() === fYear.trim().toLowerCase()
      );
      setDraftItems(JSON.parse(JSON.stringify(matching)));
      setDetailSearchTerm("");
      setSaveSuccess(null);
    } else {
      setDraftItems([]);
    }
  }, [activeGroupKey, budgets]);

  // Dynamic filter lookup lists
  const uniqueRms = useMemo(() => {
    const list = new Set(budgets.map(b => b.regionalManager).filter(Boolean));
    return Array.from(list).sort() as string[];
  }, [budgets]);

  const uniqueFYs = useMemo(() => {
    const list = new Set(budgets.map(b => b.financialYear).filter(Boolean));
    return Array.from(list).sort() as string[];
  }, [budgets]);

  // Grouped Records builder
  const groupedBudgets = useMemo(() => {
    const groups: { [key: string]: GroupedBudget } = {};

    // Filter raw budgets based on primary tab filters first
    const rawFiltered = budgets.filter(b => {
      // 1. Text Search matching salesperson or territory
      const text = searchTerm.toLowerCase();
      const matchSearch = 
        (b.salesperson || "").toLowerCase().includes(text) ||
        (b.territory || "").toLowerCase().includes(text) ||
        (b.product || "").toLowerCase().includes(text);

      if (!matchSearch) return false;

      // 2. Rm filter
      if (selectedRm !== "All") {
        if ((b.regionalManager || "").trim().toLowerCase() !== selectedRm.trim().toLowerCase()) {
          return false;
        }
      }

      // 3. FY filter
      if (selectedFY !== "All") {
        if ((b.financialYear || "").trim().toLowerCase() !== selectedFY.trim().toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    // Bucket into groups
    rawFiltered.forEach(b => {
      const key = `${(b.salesperson || "").trim()}|||${(b.financialYear || "").trim()}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          salesperson: b.salesperson,
          financialYear: b.financialYear,
          regionalManager: b.regionalManager || "",
          region: b.region || "",
          territory: b.territory || "",
          productsCount: 0,
          totalQuantity: 0,
          totalValue: 0,
          items: []
        };
      }

      groups[key].items.push(b);
      groups[key].totalQuantity += b.budgetQuantity || 0;
      groups[key].totalValue += b.budgetValue || 0;
    });

    // Finalize groups
    return Object.values(groups).map(g => {
      const uniqueProducts = new Set(g.items.map(item => item.product).filter(Boolean));
      const repItem = g.items[0];
      return {
        ...g,
        productsCount: uniqueProducts.size,
        regionalManager: g.regionalManager || repItem?.regionalManager || "-",
        region: g.region || repItem?.region || "-",
        territory: g.territory || repItem?.territory || "-"
      };
    });
  }, [budgets, searchTerm, selectedRm, selectedFY]);

  // Sort Grouped List
  const sortedGroupedBudgets = useMemo(() => {
    const result = [...groupedBudgets];
    result.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDirection === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }
    });
    return result;
  }, [groupedBudgets, sortField, sortDirection]);

  // Pagination for Grouped List
  const paginatedGrouped = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedGroupedBudgets.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedGroupedBudgets, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedGroupedBudgets.length / itemsPerPage) || 1;

  // Aggregate values of filtered list
  const totals = useMemo(() => {
    let quantity = 0;
    let value = 0;
    groupedBudgets.forEach(g => {
      quantity += g.totalQuantity;
      value += g.totalValue;
    });
    return { quantity, value };
  }, [groupedBudgets]);

  // Sorting handler
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Detailed View: Filter items based on local search term
  const filteredDraftItems = useMemo(() => {
    return draftItems.filter(item => {
      if (!detailSearchTerm) return true;
      const text = detailSearchTerm.toLowerCase();
      return (
        (item.product || "").toLowerCase().includes(text) ||
        (item.month || "").toLowerCase().includes(text)
      );
    });
  }, [draftItems, detailSearchTerm]);

  // Compute live aggregates of detailed draft state
  const draftTotals = useMemo(() => {
    let quantity = 0;
    let value = 0;
    draftItems.forEach(i => {
      quantity += Number(i.budgetQuantity) || 0;
      value += Number(i.budgetValue) || 0;
    });
    return { quantity, value };
  }, [draftItems]);

  // Handler for individual input edits in detail view
  const handleEditQuantity = (itemId: string, newQtyStr: string) => {
    const quantity = Math.max(0, parseInt(newQtyStr) || 0);

    setDraftItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Preserving initial average price rate
        const rate = item.budgetRate || (item.budgetQuantity > 0 ? item.budgetValue / item.budgetQuantity : 0);
        const autoValue = quantity * rate;
        return {
          ...item,
          budgetQuantity: quantity,
          budgetValue: Math.round(autoValue)
        };
      }
      return item;
    }));
  };

  // Discard edits
  const handleDiscardChanges = () => {
    setActiveGroupKey(null);
  };

  // Commit saved targets back to parent container
  const handleSaveChanges = () => {
    if (!onUpdateBudgets) return;

    // Create lookup index of draft edits
    const draftIndex = new Map<string, BudgetItem>();
    draftItems.forEach(d => {
      draftIndex.set(d.id, d);
    });

    // Map existing budgets to updated values
    const mergedBudgets = budgets.map(b => {
      if (draftIndex.has(b.id)) {
        return draftIndex.get(b.id)!;
      }
      return b;
    });

    onUpdateBudgets(mergedBudgets);
    setSaveSuccess("Successfully updated target database and synchronized server metrics.");
    
    // Auto clear success banner
    setTimeout(() => {
      setSaveSuccess(null);
      setActiveGroupKey(null); // return to grouped view
    }, 2000);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (sortedGroupedBudgets.length === 0) return;
    
    // Exports full detail row metrics of all matches
    const headers = ["Salesperson", "Product", "Budget Qty", "Budget Rate", "Budget Value", "Territory", "Regional Manager", "Region", "Period", "Financial Year"];
    const rows: any[] = [];

    sortedGroupedBudgets.forEach(g => {
      g.items.forEach(b => {
        const budgetRate = b.budgetRate || (b.budgetQuantity > 0 ? b.budgetValue / b.budgetQuantity : 0);
        rows.push([
          `"${b.salesperson || ""}"`,
          `"${b.product || ""}"`,
          b.budgetQuantity || 0,
          budgetRate.toFixed(2),
          b.budgetValue || 0,
          `"${b.territory || ""}"`,
          `"${b.regionalManager || ""}"`,
          `"${b.region || ""}"`,
          `"${b.month || ""}"`,
          `"${b.financialYear || ""}"`
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `grouped_budget_target_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="budgetLedgerWorkspace">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-green-50 text-green-700 rounded-lg">
              <Target className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-sans">
              Budget Target Ledger (Admin Panel)
            </h2>
          </div>
          <p className="text-xs text-gray-400">
            {activeGroupKey 
              ? "Modify individual sales targets and adjust sales volumes directly. Prices will recompute automatically." 
              : "Consolidated enterprise budget target sheets organized by individual sales representatives and fiscal periods."}
          </p>
        </div>

        {!activeGroupKey && (
          <button
            onClick={handleExportCSV}
            disabled={sortedGroupedBudgets.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-gray-100 disabled:text-gray-400 text-white transition shadow-xs w-fit"
          >
            <Download className="w-4 h-4" />
            Export Targets CSV
          </button>
        )}
      </div>

      {/* Success banner if updated */}
      {saveSuccess && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl text-left font-medium animate-fade-in shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* ----------------- SUB-VIEW DETAILED EDIT MODE ----------------- */}
      {activeGroupKey ? (
        <div className="bg-white border border-gray-150 rounded-2xl shadow-xs overflow-hidden">
          
          {/* Detailed Top Bar */}
          <div className="bg-slate-50 border-b border-gray-150 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            <button
              onClick={handleDiscardChanges}
              className="group flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold text-xs py-1.5 px-3 border border-slate-200 rounded-lg hover:border-slate-350 transition w-fit bg-white"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to Ledger
            </button>

            <div className="text-left space-y-1 sm:text-right">
              <h3 className="text-sm font-bold text-gray-800">
                Editing Targets for: <span className="text-green-700 font-black">{activeGroupKey.split("|||")[0]}</span>
              </h3>
              <p className="text-xs text-gray-400 font-medium font-mono">
                Financial Year: {activeGroupKey.split("|||")[1]}
              </p>
            </div>
          </div>

          {/* Quick Metrics of Edited User */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-5 border-b border-gray-100 bg-slate-50/40">
            <div className="bg-white p-3 border border-gray-150 rounded-xl text-left shadow-2xs">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block">Total Budget Units</span>
              <span className="text-md font-black text-gray-850 mt-1 font-mono">{draftTotals.quantity.toLocaleString()}</span>
            </div>
            <div className="bg-white p-3 border border-gray-150 rounded-xl text-left shadow-2xs">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block">Total Target Value</span>
              <span className="text-md font-black text-slate-800 mt-1 font-mono text-green-700">₹{Math.round(draftTotals.value).toLocaleString()}</span>
            </div>
            <div className="bg-white p-3 border border-gray-150 rounded-xl text-left shadow-2xs">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block">Region / Territory</span>
              <span className="text-xs font-bold text-slate-600 mt-1 block truncate">
                {draftItems[0]?.region || "West"} / {draftItems[0]?.territory || "West-1"}
              </span>
            </div>
            <div className="bg-white p-3 border border-gray-150 rounded-xl text-left shadow-2xs">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block">Assigned Mgr</span>
              <span className="text-xs font-bold text-slate-600 mt-1 block truncate">{draftItems[0]?.regionalManager || "S. R. Patil"}</span>
            </div>
          </div>

          <div className="p-4 md:p-5 space-y-4">
            
            {/* Search field and Actions in Detailed View */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              <div className="relative w-full sm:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Filter local products or period..."
                  value={detailSearchTerm}
                  onChange={(e) => setDetailSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-gray-200 bg-slate-50/50 hover:bg-slate-50 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:border-green-600 focus:bg-white focus:ring-1 focus:ring-green-600"
                />
              </div>

              {/* Edit Controls */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleDiscardChanges}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-850 font-semibold border border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-green-600 hover:bg-green-700 font-bold rounded-lg hover:shadow-xs transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>

            </div>

            {/* Editable Grid Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-150">
              <table className="w-full text-xs text-left" id="adminEditableDetailBudgetTable">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-gray-150 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-right">Rep. Target Rate</th>
                    <th className="py-2.5 px-3 text-right w-[150px]">Budget Quantity</th>
                    <th className="py-2.5 px-3 text-right">Recalculated Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredDraftItems.length > 0 ? (
                    filteredDraftItems.map(item => {
                      const rate = item.budgetRate || (item.budgetQuantity > 0 ? item.budgetValue / item.budgetQuantity : 0);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition align-middle">
                          
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.product}
                          </td>
                          
                          <td className="py-2.5 px-3 text-slate-500 font-medium">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600 font-semibold">
                              {item.month}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono text-slate-400 font-medium">
                            ₹{Math.round(rate).toLocaleString()}
                          </td>

                          {/* EDITABLE INPUT */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min="0"
                                value={item.budgetQuantity}
                                onChange={(e) => handleEditQuantity(item.id, e.target.value)}
                                className="w-[100px] text-right py-1 px-2 border border-gray-200 rounded-md focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 font-semibold font-mono bg-slate-50/50 hover:bg-slate-50"
                              />
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold font-mono text-blue-900 bg-blue-50/5">
                            ₹{(item.budgetValue || 0).toLocaleString()}
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                        No product items found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-1.5 p-3.5 bg-indigo-50/40 border border-indigo-100 text-indigo-800 text-[11px] rounded-xl text-left">
              <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Editing budget quantities dynamically recomputes the financial value based on the original average rate. Click **&quot;Save Changes&quot;** to lock adjustments permanently.</span>
            </div>

          </div>

        </div>
      ) : (
        /* ----------------- PRIMARY GROUPED LEDGER VIEW ----------------- */
        <>
          {/* Aggregate metrics widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-white border border-gray-150 p-4 rounded-xl text-left shadow-2xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Filtered Sales Reps</span>
              <div className="text-lg font-black text-gray-800 mt-1">{sortedGroupedBudgets.length} entries</div>
              <span className="text-[10px] text-gray-400 mt-0.5 block">Summed staff members with active targets</span>
            </div>

            <div className="bg-white border border-gray-150 p-4 rounded-xl text-left shadow-2xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-600">Total Grouped Volume</span>
              <div className="text-lg font-black text-green-800 mt-1 font-mono">{Math.round(totals.quantity).toLocaleString()} units</div>
              <span className="text-[10px] text-gray-400 mt-0.5 block">Aggregated product quantities (Kg/Litres)</span>
            </div>

            <div className="bg-white border border-gray-150 p-4 rounded-xl text-left shadow-2xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">Total Grouped Value</span>
              <div className="text-lg font-black text-blue-800 mt-1 font-mono">₹{Math.round(totals.value).toLocaleString()}</div>
              <span className="text-[10px] text-gray-400 mt-0.5 block">Aggregated total financial requirements</span>
            </div>

          </div>

          {/* Filter and Control Bar */}
          <div className="bg-white border border-gray-150 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 align-middle">
              
              {/* Key lookup search field */}
              <div className="relative sm:col-span-2">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search by salesperson, product or territory..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-1.5 border border-gray-200 bg-slate-50/50 hover:bg-slate-50 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:border-green-600 focus:bg-white focus:ring-1 focus:ring-green-600"
                />
              </div>

              {/* Regional Manager Filter */}
              <div className="flex flex-col gap-1 text-left">
                <select
                  value={selectedRm}
                  onChange={(e) => {
                    setSelectedRm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                >
                  <option value="All">All regional managers</option>
                  {uniqueRms.map(rm => (
                    <option key={rm} value={rm}>{rm}</option>
                  ))}
                </select>
              </div>

              {/* Financial Year filter */}
              <div className="flex flex-col gap-1 text-left">
                <select
                  value={selectedFY}
                  onChange={(e) => {
                    setSelectedFY(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                >
                  <option value="All">All financial years</option>
                  {uniqueFYs.map(fy => (
                    <option key={fy} value={fy}>FY {fy}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Dense Grouped Table */}
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-xs text-left" id="adminGroupedBudgetLedgerTable">
                <thead>
                  <tr className="border-b border-gray-150 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                    <th 
                      className="py-3 px-2 cursor-pointer hover:bg-gray-50/70"
                      onClick={() => handleSort("salesperson")}
                    >
                      <div className="flex items-center gap-1">
                        Salesperson / User
                        {sortField === "salesperson" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-2 cursor-pointer hover:bg-gray-50/70"
                      onClick={() => handleSort("financialYear")}
                    >
                      <div className="flex items-center gap-1">
                        Financial Year
                        {sortField === "financialYear" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th className="py-3 px-2">Regional Manager</th>
                    <th className="py-3 px-2">Territory / Region</th>
                    <th 
                      className="py-3 px-2 cursor-pointer hover:bg-gray-50/70 text-right"
                      onClick={() => handleSort("productsCount")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Budgeted Products
                        {sortField === "productsCount" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-2 cursor-pointer hover:bg-gray-50/70 text-right"
                      onClick={() => handleSort("totalQuantity")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Volume Quantity
                        {sortField === "totalQuantity" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-2 cursor-pointer hover:bg-gray-50/70 text-right"
                      onClick={() => handleSort("totalValue")}
                    >
                      <div className="flex items-center justify-end gap-1 font-semibold text-gray-800">
                        Total Financial target
                        {sortField === "totalValue" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th className="py-3 px-2 text-center w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {paginatedGrouped.length > 0 ? (
                    paginatedGrouped.map(g => (
                      <tr key={g.key} className="hover:bg-slate-50 transition align-middle">
                        
                        <td className="py-2.5 px-2 font-bold text-gray-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {g.salesperson}
                        </td>

                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                            {g.financialYear}
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-slate-650 font-medium">
                          {g.regionalManager}
                        </td>

                        <td className="py-2.5 px-2 text-slate-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{g.territory} ({g.region})</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-right font-semibold text-slate-650">
                          {g.productsCount} products
                        </td>

                        <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                          {Math.round(g.totalQuantity).toLocaleString()}
                        </td>

                        <td className="py-2.5 px-2 text-right font-bold font-mono text-blue-900 bg-blue-50/10">
                          ₹{Math.round(g.totalValue).toLocaleString()}
                        </td>

                        {/* VIEW BUDGET BUTTON */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveGroupKey(g.key)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 hover:border-green-300 transition"
                          >
                            <Edit2 className="w-3 h-3" />
                            View Budget
                          </button>
                        </td>

                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        No budget target records found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {sortedGroupedBudgets.length > itemsPerPage && (
              <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-medium text-gray-500">
                <div>
                  Showing <span className="text-gray-800 font-semibold">{((currentPage - 1) * itemsPerPage) + 1}</span> to{" "}
                  <span className="text-gray-800 font-semibold">
                    {Math.min(currentPage * itemsPerPage, sortedGroupedBudgets.length)}
                  </span>{" "}
                  of <span className="text-gray-800 font-semibold">{sortedGroupedBudgets.length}</span> staff targets
                </div>
                
                <div className="flex items-center gap-1 flex-row">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 px-2.5 border border-gray-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1 px-2.5 border border-gray-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}
