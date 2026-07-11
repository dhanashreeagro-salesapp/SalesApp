import React, { useState, useMemo } from "react";
import { InvoiceItem } from "../types";
import { 
  Search, 
  Download, 
  ChevronUp, 
  ChevronDown, 
  FileText, 
  Tags, 
  TrendingUp, 
  User, 
  MapPin, 
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface InvoiceLedgerProps {
  invoices: InvoiceItem[];
}

export default function InvoiceLedger({ invoices }: InvoiceLedgerProps) {
  // Query Filters & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  
  // Date boundaries
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Sorting State
  const [sortField, setSortField] = useState<keyof InvoiceItem>("invoiceDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Dynamic filter lists
  const uniqueCompanies = useMemo(() => {
    const list = new Set(invoices.map(inv => inv.company).filter(Boolean));
    return Array.from(list).sort();
  }, [invoices]);

  const regions = useMemo(() => {
    const list = new Set(invoices.map(inv => inv.region).filter(Boolean));
    return Array.from(list).sort();
  }, [invoices]);

  const categories = useMemo(() => {
    const list = new Set(invoices.map(inv => inv.productCategory).filter(Boolean));
    return Array.from(list).sort();
  }, [invoices]);

  // Handle Header Sorting click
  const handleSort = (field: keyof InvoiceItem) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  // Filter & Sort Logic
  const filteredSortedInvoices = useMemo(() => {
    let result = [...invoices];

    // Search filter
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        inv =>
          (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
          (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
          (inv.productName && inv.productName.toLowerCase().includes(q)) ||
          (inv.salesperson && inv.salesperson.toLowerCase().includes(q))
      );
    }

    // Company filter (multi-select)
    if (selectedCompanies && selectedCompanies.length > 0) {
      result = result.filter(inv => selectedCompanies.includes(inv.company));
    }

    // Region filter
    if (selectedRegion !== "All") {
      result = result.filter(inv => inv.region === selectedRegion);
    }

    // Category filter
    if (selectedCategory !== "All") {
      result = result.filter(inv => inv.productCategory === selectedCategory);
    }

    // Date Range filters
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      result = result.filter(inv => new Date(inv.invoiceDate).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      result = result.filter(inv => new Date(inv.invoiceDate).getTime() <= endMs);
    }

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();

      if (strA < strB) return sortDirection === "asc" ? -1 : 1;
      if (strA > strB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, searchTerm, selectedCompanies, selectedRegion, selectedCategory, startDate, endDate, sortField, sortDirection]);

  // Aggregate stats on filtered subset
  const ledgerStats = useMemo(() => {
    let totalValue = 0;
    let totalQuantity = 0;
    filteredSortedInvoices.forEach(inv => {
      totalValue += inv.netSalesValue || 0;
      totalQuantity += inv.quantity || 0;
    });
    return {
      count: filteredSortedInvoices.length,
      value: totalValue,
      quantity: totalQuantity
    };
  }, [filteredSortedInvoices]);

  // Pagination slices
  const totalPages = Math.ceil(filteredSortedInvoices.length / itemsPerPage) || 1;
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSortedInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSortedInvoices, currentPage, itemsPerPage]);

  // Reset pagination if filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCompanies, selectedRegion, selectedCategory, startDate, endDate, itemsPerPage]);

  // Client-Side CSV Export Utility
  const handleExportCSV = () => {
    const headers = [
      "Invoice Date",
      "Invoice Number",
      "Company",
      "Customer Code",
      "Customer/Ledger Name",
      "Region",
      "State",
      "Territory",
      "Salesperson",
      "Regional Manager",
      "Product Name",
      "Category",
      "Quantity",
      "Unit",
      "Rate",
      "Net Sales Value"
    ];

    const rows = filteredSortedInvoices.map(inv => [
      inv.invoiceDate,
      `"${inv.invoiceNumber || ''}"`,
      `"${inv.company}"`,
      `"${inv.customerCode || ''}"`,
      `"${(inv.customerName || '').replace(/"/g, '""')}"`,
      `"${inv.region || ''}"`,
      `"${inv.state || ''}"`,
      `"${inv.territory || ''}"`,
      `"${(inv.salesperson || '').replace(/"/g, '""')}"`,
      `"${(inv.regionalManager || '').replace(/"/g, '""')}"`,
      `"${(inv.productName || '').replace(/"/g, '""')}"`,
      `"${inv.productCategory || ''}"`,
      inv.quantity,
      `"${inv.unit || 'kg'}"`,
      inv.rate,
      inv.netSalesValue
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Invoice_Ledger_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Page Title & Export Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-left space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-green-700">
            📊 Financial Transactions Log
          </span>
          <h1 className="text-lg lg:text-xl font-bold font-sans text-gray-900 tracking-tight">
            Invoice Ledger Book
          </h1>
          <p className="text-[11px] text-gray-500">
            Audit-grade record of transactional invoices with active database querying, sorting and exports.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-xs transition shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Spreadsheet (.csv)
        </button>
      </div>

      {/* Summary KPI Cards Grid representing Filtered Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-150 p-4 rounded-2xl text-left space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-green-600" />
            <span>Matched Record Count</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 leading-none">
            {ledgerStats.count.toLocaleString()} <span className="text-xs text-gray-400 font-normal">Invoices</span>
          </p>
          <div className="text-[10px] text-gray-500">
            Current matches from database
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-2xl text-left space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span>Total Cumulative Value</span>
          </div>
          <p className="text-xl font-extrabold text-green-700 leading-none">
            ₹{ledgerStats.value.toLocaleString()}
          </p>
          <div className="text-[10px] text-gray-500">
            Net sales volume sum
          </div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-2xl text-left space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-green-600" />
            <span>Total Quantity Shipped</span>
          </div>
          <p className="text-xl font-extrabold text-blue-600 leading-none">
            {ledgerStats.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs text-gray-400 font-normal">kg/L</span>
          </p>
          <div className="text-[10px] text-gray-500">
            Product distribution mass
          </div>
        </div>
      </div>

      {/* Multi-Filter Panel controls */}
      <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Universal Search bar */}
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice #, customer name, salesperson, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition"
            />
          </div>

          {/* Multi-Select Company filter */}
          <div className="flex items-center gap-2 relative" id="ledger-company-multiselect-container">
            <span className="text-[10px] uppercase font-bold text-gray-450 tracking-wider font-semibold">Company Scope:</span>
            <button
              type="button"
              onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
              className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 flex items-center justify-between gap-1.5 min-w-[150px] cursor-pointer"
            >
              <span className="truncate max-w-[150px]">
                {selectedCompanies.length === 0 
                  ? "All Companies (Combined)" 
                  : selectedCompanies.length === uniqueCompanies.length
                  ? "All Selected"
                  : `${selectedCompanies.length} selected`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            </button>

            {isCompanyDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsCompanyDropdownOpen(false)} 
                />
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 min-w-[200px] max-h-[250px] overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 mb-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Select Company</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCompanies([])}
                        className="text-[9px] font-semibold text-green-600 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCompanies(uniqueCompanies)}
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
                          className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-50 rounded cursor-pointer select-none text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedCompanies(selectedCompanies.filter(c => c !== companyName));
                              } else {
                                setSelectedCompanies([...selectedCompanies, companyName]);
                              }
                            }}
                            className="rounded text-green-600 focus:ring-green-500 border-gray-300 w-3.5 h-3.5"
                          />
                          <span className="text-gray-700 font-medium">{companyName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>


          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-gray-450 tracking-wider">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600"
            >
              <option value="All">All Segments</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Ranges sub-scoping */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-50 text-[11px] text-gray-600 text-left">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-semibold text-gray-500">Invoice Date Between:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-200 bg-white rounded-lg px-2 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600"
            />
            <span className="text-gray-400">and</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-200 bg-white rounded-lg px-2 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:border-green-600"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-red-500 hover:underline font-bold text-[10px] ml-2"
              >
                Clear Date Bounds
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <span>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-gray-200 bg-white rounded-md px-1.5 py-0.5 text-xs text-gray-600 font-bold"
            >
              <option value="15">15 rows</option>
              <option value="30">30 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-2xs overflow-hidden text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-[9px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 text-[10px]" onClick={() => handleSort("invoiceDate")}>
                  <div className="flex items-center gap-1">
                    Invoice Date
                    {sortField === "invoiceDate" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 text-[10px]" onClick={() => handleSort("invoiceNumber")}>
                  <div className="flex items-center gap-1">
                    Invoice No
                    {sortField === "invoiceNumber" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 text-[10px]" onClick={() => handleSort("company")}>
                  <div className="flex items-center gap-1">
                    Company
                    {sortField === "company" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 text-[10px]" onClick={() => handleSort("customerName")}>
                  <div className="flex items-center gap-1">
                    Customer / Ledger Name
                    {sortField === "customerName" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Segment Segment</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 text-right text-[10px]" onClick={() => handleSort("netSalesValue")}>
                  <div className="flex items-center justify-end gap-1">
                    Net Value (₹)
                    {sortField === "netSalesValue" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-3 px-4">Territory / Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-750">
              {paginatedInvoices.length > 0 ? (
                paginatedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-green-50/20 transition">
                    <td className="py-3 px-4 font-mono font-medium text-gray-500">
                      {new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 font-mono">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        inv.company === "Company A" 
                          ? "bg-green-100 text-green-850" 
                          : "bg-blue-100 text-blue-850"
                      }`}>
                        {inv.company}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-950 font-bold max-w-[200px] truncate" title={inv.customerName}>
                      {inv.customerName}
                      <span className="block text-[9px] text-gray-400 font-medium">Code: {inv.customerCode || "N/A"}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800 max-w-[180px] break-words whitespace-normal leading-snug">
                      {inv.productName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[9px] font-semibold">
                        {inv.productCategory || "Product"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-gray-900">
                      {inv.quantity?.toLocaleString() || "0"} {inv.unit || "kg"}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 font-mono">
                      ₹{inv.rate?.toLocaleString() || "0"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-955 font-mono">
                      ₹{inv.netSalesValue?.toLocaleString() || "0"}
                    </td>
                    <td className="py-3 px-4 text-[10px] text-gray-600">
                      <div className="font-semibold text-gray-800">{inv.salesperson}</div>
                      <div className="text-[9px] text-gray-400 uppercase font-medium">{inv.region} - {inv.territory}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    <div className="space-y-2">
                      <Sparkles className="w-8 h-8 text-gray-300 mx-auto animate-pulse" />
                      <p className="font-semibold text-sm">No transaction matches defined database queries</p>
                      <p className="text-[10px] text-gray-500">Try loosening your text search keywords or filtering parameters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4 text-xs font-semibold text-gray-500">
          <div>
            Showing <span className="font-bold text-gray-800">{Math.min(filteredSortedInvoices.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{" "}
            <span className="font-bold text-gray-800">{Math.min(filteredSortedInvoices.length, currentPage * itemsPerPage)}</span> of{" "}
            <span className="font-bold text-gray-800">{filteredSortedInvoices.length}</span> transaction lines
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 transition cursor-pointer ${
                currentPage === 1 ? "opacity-40 cursor-not-allowed" : ""
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-gray-700 font-bold">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 transition cursor-pointer ${
                currentPage === totalPages ? "opacity-40 cursor-not-allowed" : ""
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
