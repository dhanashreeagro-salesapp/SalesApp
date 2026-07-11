import React, { useState, useMemo } from "react";
import { 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  UsersRound, 
  Award, 
  Sparkles, 
  AlertTriangle 
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Bar 
} from "recharts";

interface CustomerStandingsTabProps {
  customerStats: any[];
}

export default function CustomerStandingsTab({
  customerStats,
}: CustomerStandingsTabProps) {
  const [customerSubView, setCustomerSubView] = useState<"all" | "topQty" | "topValue" | "bottom20" | "regionBreakdown">("all");
  const [isExpanded, setIsExpanded] = useState(false);

  // Format customer standings positions
  const scoredCustomers = useMemo(() => {
    return customerStats.map(cust => {
      let status = "Inactive";
      if (cust.p1Qty === 0 && cust.p2Qty > 0) status = "New Customer";
      else if (cust.p2Qty === 0 && cust.p1Qty > 0) status = "Inactive Loss";
      else if (cust.p2Val > 150000) status = "VIP Key Account";
      else if (cust.valGrowth > 5) status = "Growing Partner";
      else if (cust.valGrowth < -15) status = "Declining Risk";
      else status = "Stable";

      return {
        ...cust,
        status
      };
    });
  }, [customerStats]);

  // Apply conditional sub-view filters
  const filteredCustomers = useMemo(() => {
    let list = [...scoredCustomers];

    if (customerSubView === "all") {
      list = [...list].sort((a,b) => b.p2Qty - a.p2Qty);
    } else if (customerSubView === "topQty") {
      list = [...list].sort((a,b) => b.p2Qty - a.p2Qty);
    } else if (customerSubView === "topValue") {
      list = [...list].sort((a,b) => b.p2Val - a.p2Val);
    } else if (customerSubView === "bottom20") {
      list = [...list].filter(c => c.p2Qty > 0).sort((a,b) => a.p2Qty - b.p2Qty);
    } else if (customerSubView === "regionBreakdown") {
      list = [...list].sort((a,b) => {
        const regComp = a.region.localeCompare(b.region);
        if (regComp !== 0) return regComp;
        return b.p2Qty - a.p2Qty;
      });
    }

    return list;
  }, [scoredCustomers, customerSubView]);

  // Sliced customers for expanding/condensing table
  const visibleCustomers = useMemo(() => {
    if (filteredCustomers.length <= 20) return filteredCustomers;
    return isExpanded ? filteredCustomers : filteredCustomers.slice(0, 20);
  }, [filteredCustomers, isExpanded]);

  // Aggregate stats counts
  const vipAccountsCount = useMemo(() => {
    return scoredCustomers.filter(c => c.status === "VIP Key Account").length;
  }, [scoredCustomers]);

  const atRiskAccountsCount = useMemo(() => {
    return scoredCustomers.filter(c => c.status === "Declining Risk").length;
  }, [scoredCustomers]);

  const newAccountsOnboarded = useMemo(() => {
    return scoredCustomers.filter(c => c.status === "New Customer").length;
  }, [scoredCustomers]);

  const isValueView = customerSubView === "topValue";

  // Chart data: Top 10 by active subview selection
  const top10CustomersChart = useMemo(() => {
    return [...filteredCustomers]
      .slice(0, 10)
      .map(c => {
        const namePart = c.customerName.split(" ").slice(0, 2).join(" ");
        if (isValueView) {
          return {
            name: namePart,
            "LY Value": Math.round(c.p1Val),
            "TY Value": Math.round(c.p2Val)
          };
        } else {
          return {
            name: namePart,
            "LY Qty": Math.round(c.p1Qty),
            "TY Qty": Math.round(c.p2Qty)
          };
        }
      });
  }, [filteredCustomers, isValueView]);

  return (
    <div className="space-y-6" id="customerStandingsWorkspace">
      
      {/* Sub-view filters row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-150 dark:border-slate-800 pb-3 gap-3">
        <div className="flex flex-wrap gap-1.5 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
          {[
            { id: "all", label: "All Accounts" },
            { id: "topQty", label: "Top Volume" },
            { id: "topValue", label: "Top Value Partner" },
            { id: "bottom20", label: "Bottom Laggards" },
          ].map(view => (
            <button
              key={view.id}
              onClick={() => {
                setCustomerSubView(view.id as any);
                setIsExpanded(false);
              }}
              className={`flex-1 sm:flex-initial text-center px-2.5 py-1 text-xs rounded-lg cursor-pointer transition font-bold ${
                customerSubView === view.id 
                  ? "bg-white dark:bg-slate-700 text-green-700 dark:text-green-400 shadow-2xs font-sans" 
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-white/20"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase tracking-wider self-end sm:self-auto">
          Filter bounds: {filteredCustomers.length} accounts analyzed
        </span>
      </div>

      {/* Summary KPI banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-4 rounded-xl text-left flex items-center justify-between customer-kpi-block">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">VIP Key Accounts</span>
            <div className="text-lg font-black text-blue-900 dark:text-blue-100 mt-1">{vipAccountsCount} Dealers</div>
            <span className="text-[9px] text-gray-500 dark:text-slate-450">Dealers tracking above ₹1.5 Lakhs in period value</span>
          </div>
          <Award className="w-5 h-5 text-blue-400 dark:text-blue-500 shrink-0" />
        </div>

        <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-105 p-4 rounded-xl text-left flex items-center justify-between customer-kpi-block font-sans">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">New Onboardings</span>
            <div className="text-lg font-black text-green-950 mt-1">{newAccountsOnboarded} Active Accounts</div>
            <span className="text-[9px] text-gray-500 dark:text-slate-450">New billing registrations with no baseline histories</span>
          </div>
          <Sparkles className="w-5 h-5 text-green-400 dark:text-green-500 shrink-0" />
        </div>

        <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 p-4 rounded-xl text-left flex items-center justify-between customer-kpi-block">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Relationship Risks</span>
            <div className="text-lg font-black text-red-900 dark:text-red-100 mt-1">{atRiskAccountsCount} Decline Risks</div>
            <span className="text-[9px] text-gray-500 dark:text-slate-450">Partners tracking negative drop thresholds &gt;15%</span>
          </div>
          <AlertTriangle className="w-5 h-5 text-red-400 dark:text-red-500 shrink-0" />
        </div>

      </div>

      {/* Top 10 customer sales bar value comparison */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="text-left">
          <h4 className="text-xs font-bold text-gray-950 dark:text-slate-100 uppercase tracking-widest">
            {customerSubView === "bottom20"
              ? "Bottom 10 Dealer Account Comparative Volume Standings"
              : isValueView
              ? "Top 10 Dealer Account Net Sales Value Standings"
              : "Top 10 Dealer Account Comparative Volume Standings"}
          </h4>
          <p className="text-[10px] text-gray-450 dark:text-slate-400 font-medium font-sans">
            {isValueView
              ? "Dealer sales value contribution ranking comparison indices"
              : "Dealer sales volume contribution ranking comparison indices"}
          </p>
        </div>

        <div className="h-[200px] w-full text-xs animate-fade-in">
          {top10CustomersChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10CustomersChart} margin={{ left: -15, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis dataKey="name" fontSize={8} stroke="#94a3b8" tickLine={false} />
                <YAxis 
                  fontSize={8} 
                  stroke="#94a3b8" 
                  tickLine={false} 
                  tickFormatter={(val) => isValueView ? `₹${val/1000}k` : `${val}`} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: '8px', color: '#fff' }}
                  formatter={(v) => isValueView ? `₹${Number(v).toLocaleString()}` : `${Number(v).toLocaleString()} kg`} 
                />
                {isValueView ? (
                  <>
                    <Bar dataKey="LY Value" name="P1 Value" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="TY Value" name="P2 Value" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="LY Qty" name="P1 Volume" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="TY Qty" name="P2 Volume" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-450 italic text-xs">No customer values found</div>
          )}
        </div>
      </div>

      {/* Descriptive table & Mobile cards list */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-2xs space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h4 className="text-xs font-bold text-gray-950 dark:text-slate-100 uppercase tracking-wider">Dealer Comparative Performance Scoreboard</h4>
            <p className="text-[10px] text-gray-400 dark:text-slate-400">Interactive profiles, transaction quantities, and period-over-period margins</p>
          </div>
          <div className="text-[9px] font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded self-start sm:self-auto">
            Showing {visibleCustomers.length} of {filteredCustomers.length} Records
          </div>
        </div>

        {/* 1. MOBILE RESPONSIVE CARDS (Visible under `lg` width) */}
        <div className="block lg:hidden space-y-3">
          {visibleCustomers.length > 0 ? (
            visibleCustomers.map((cust, idx) => (
              <div 
                key={idx} 
                className="bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-4 border border-gray-150 dark:border-slate-800 space-y-3 hover:shadow-xs transition"
              >
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-slate-800/60 pb-2">
                  <div>
                    <h5 className="font-extrabold text-xs text-gray-950 dark:text-slate-50 leading-tight">{cust.customerName}</h5>
                    <p className="text-[9px] text-gray-400 dark:text-slate-500 font-mono mt-0.5">Code: {cust.customerCode} | {cust.region} - {cust.territory}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[8px] font-bold rounded-md shrink-0 whitespace-nowrap ${
                    cust.status.includes("VIP") 
                      ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      : cust.status.includes("Partner") || cust.status.includes("New")
                      ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-bold"
                      : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                  }`}>
                    {cust.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                  {/* Qty row */}
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-semibold text-gray-450 dark:text-slate-500 uppercase tracking-wide block">Quantity Lift (P1 vs P2)</span>
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-gray-500 dark:text-slate-400">{Math.round(cust.p1Qty).toLocaleString()}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-bold text-gray-800 dark:text-slate-200">{Math.round(cust.p2Qty).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[8px] font-semibold text-gray-450 dark:text-slate-500 uppercase tracking-wide block">Volume Shift (%)</span>
                    <span className={`font-bold font-mono flex items-center gap-0.5 text-xs ${cust.qtyDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                      {cust.qtyDiff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {cust.qtyDiff >= 0 ? "+" : ""}{cust.qtyGrowth.toFixed(0)}%
                    </span>
                  </div>

                  {/* Value row */}
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-semibold text-gray-450 dark:text-slate-500 uppercase tracking-wide block">Value Margin (P1 vs P2)</span>
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-gray-500 dark:text-slate-400">₹{Math.round(cust.p1Val).toLocaleString()}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-bold text-gray-800 dark:text-slate-200">₹{Math.round(cust.p2Val).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[8px] font-semibold text-gray-450 dark:text-slate-500 uppercase tracking-wide block">Revenue Drift (%)</span>
                    <span className={`font-bold font-mono flex items-center gap-0.5 text-xs ${cust.valDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                      {cust.valDiff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {cust.valDiff >= 0 ? "+" : ""}{cust.valGrowth.toFixed(0)}%
                    </span>
                  </div>
                </div>

              </div>
            ))
          ) : (
            <p className="text-center italic text-xs text-slate-500 py-6">No matching dealer stats scoped inside filters.</p>
          )}
        </div>

        {/* 2. DESKTOP TRADITIONAL TABLE (Visible on `lg` and above) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-xs text-left" id="customerStandingsTable">
            <thead>
              <tr className="border-b border-gray-150 dark:border-slate-800 text-gray-400 dark:text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-3">Customer / Dealer Name</th>
                <th className="py-3">Code</th>
                <th className="py-3">Region Scope</th>
                <th className="py-3 text-right font-mono">LY Qty</th>
                <th className="py-3 text-right font-mono">TY Qty</th>
                <th className="py-3 text-right">Volume Shift</th>
                <th className="py-3 text-right">LY Value</th>
                <th className="py-3 text-right">TY Value</th>
                <th className="py-3 text-right">Revenue Change</th>
                <th className="py-3 text-right">Tactical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/40">
              {visibleCustomers.map((cust, idx) => (
                <tr key={idx} className="hover:bg-gray-50/40 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 font-bold text-gray-950 dark:text-slate-100 leading-tight max-w-[200px] whitespace-normal">{cust.customerName}</td>
                  <td className="py-3 text-gray-500 dark:text-slate-450 font-mono text-[10px]">{cust.customerCode}</td>
                  <td className="py-3 font-medium text-gray-600 dark:text-slate-400">{cust.region} - {cust.territory}</td>
                  <td className="py-3 text-right text-gray-500 dark:text-slate-400 font-mono">{Math.round(cust.p1Qty).toLocaleString()}</td>
                  <td className="py-3 text-right font-bold text-gray-800 dark:text-slate-200 font-mono">{Math.round(cust.p2Qty).toLocaleString()}</td>
                  <td className={`py-3 text-right font-bold font-mono ${cust.qtyDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {cust.qtyDiff >= 0 ? "+" : ""}{cust.qtyGrowth.toFixed(0)}%
                  </td>
                  <td className="py-3 text-right text-gray-500 dark:text-slate-400 font-mono">₹{Math.round(cust.p1Val).toLocaleString()}</td>
                  <td className="py-3 text-right font-bold text-gray-950 dark:text-slate-50">₹{Math.round(cust.p2Val).toLocaleString()}</td>
                  <td className={`py-3 text-right font-bold ${cust.valDiff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {cust.valDiff >= 0 ? "+" : ""}{cust.valGrowth.toFixed(0)}%
                  </td>
                  <td className="py-3 text-right">
                    <span className={`px-2 py-1 text-[9px] font-bold rounded-md ${
                      cust.status.includes("VIP") 
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                        : cust.status.includes("Partner") || cust.status.includes("New")
                        ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 font-bold border border-green-200/20"
                        : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200/20"
                    }`}>
                      {cust.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse pagination button */}
        {filteredCustomers.length > 20 && (
          <div className="flex justify-center pt-3 pb-1 border-t border-gray-50 dark:border-slate-800/60">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 border border-green-200/50 dark:border-green-900/50 rounded-xl transition cursor-pointer shadow-3xs"
            >
              {isExpanded ? (
                <>
                  <span>View Less List</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>View More ({filteredCustomers.length - 20} Hidden Dealers)</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
