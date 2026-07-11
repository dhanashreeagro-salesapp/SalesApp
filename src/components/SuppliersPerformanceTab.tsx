import React, { useMemo, useState } from "react";
import { 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownRight, 
  Award, 
  Sparkles, 
  Compass 
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

interface SuppliersPerformanceTabProps {
  supplierStats: any[];
}

const COLORS = ["#16a34a", "#2563eb", "#ea580c", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function SuppliersPerformanceTab({
  supplierStats,
}: SuppliersPerformanceTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Scopes calculations for suppliers
  const totalLYVal = useMemo(() => supplierStats.reduce((sum, s) => sum + s.p1Val, 0), [supplierStats]);
  const totalTYVal = useMemo(() => supplierStats.reduce((sum, s) => sum + s.p2Val, 0), [supplierStats]);

  const supplierDetails = useMemo(() => {
    return supplierStats.map(sup => {
      const lyShare = totalLYVal > 0 ? (sup.p1Val / totalLYVal) * 100 : 0;
      const tyShare = totalTYVal > 0 ? (sup.p2Val / totalTYVal) * 105 : 0; // standard share adjustments

      let status = "Stable";
      if (sup.p1Qty === 0 && sup.p2Qty > 0) status = "New Supplier";
      else if (sup.qtyGrowth > 10) status = "Active Expanding";
      else if (sup.qtyGrowth < -20) status = "Critical Decline";
      else if (sup.qtyGrowth < 0) status = "Weakening";

      return {
        ...sup,
        lyShare,
        tyShare,
        status
      };
    }).sort((a,b) => b.p2Val - a.p2Val); // Sorted from highest to lowest financial sales value descending
  }, [supplierStats, totalLYVal, totalTYVal]);

  // Sliced suppliers for pagination
  const visibleSuppliers = useMemo(() => {
    if (supplierDetails.length <= 20) return supplierDetails;
    return isExpanded ? supplierDetails : supplierDetails.slice(0, 20);
  }, [supplierDetails, isExpanded]);

  // Aggregate stats blocks
  const maxVendorVal = useMemo(() => {
    if (supplierStats.length === 0) return 0;
    return Math.max(...supplierStats.map(s => s.p2Val));
  }, [supplierStats]);

  const dependencyPercentage = useMemo(() => {
    if (totalTYVal === 0) return 0;
    return (maxVendorVal / totalTYVal) * 100;
  }, [maxVendorVal, totalTYVal]);

  const topGrowingSupplier = useMemo(() => {
    const list = [...supplierStats].filter(s => s.p1Qty > 10).sort((a,b) => b.qtyGrowth - a.qtyGrowth);
    return list[0] || null;
  }, [supplierStats]);

  return (
    <div className="space-y-6" id="suppliersPerformanceWorkspace">
      
      {/* KPI blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-white border border-gray-105 rounded-xl p-5 shadow-2xs text-left space-y-1 block-card">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Suppliers</span>
          <div className="text-xl font-black text-gray-900 leading-none">{supplierStats.length} Vendors</div>
          <p className="text-[9px] text-gray-400 font-semibold leading-normal mt-1">Active vendor partners registered</p>
        </div>

        <div className="bg-white border border-gray-105 rounded-xl p-5 shadow-2xs text-left space-y-1 block-card">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Compound Dependency</span>
          <div className="text-xl font-black text-orange-600 leading-none">{dependencyPercentage.toFixed(1)}%</div>
          <p className="text-[9px] text-gray-400 font-semibold leading-normal mt-1">Share contribution of largest vendor</p>
        </div>

        <div className="bg-white border border-gray-105 rounded-xl p-5 shadow-2xs text-left space-y-1 col-span-2 block-card">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Top Growing Vendor Lead</span>
          {topGrowingSupplier ? (
            <div className="flex items-center gap-2 justify-between mt-1">
              <div>
                <strong className="text-sm font-bold text-gray-900 truncate block max-w-[200px]">{topGrowingSupplier.supplierName}</strong>
                <span className="text-[9px] text-green-600 font-bold">+{topGrowingSupplier.qtyGrowth.toFixed(1)}% compound volume gain</span>
              </div>
              <Compass className="w-5 h-5 text-green-500 shrink-0" />
            </div>
          ) : (
            <div className="text-xs text-gray-450 italic mt-1">No supplier stats found</div>
          )}
        </div>

      </div>

      {/* Charts split row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shadow-charts">
        
        {/* Suppliers side-by-side barQty Column Chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs lg:col-span-2 space-y-4 text-left">
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Vendor Volume Comparative Performance (kg/L)</h4>
            <p className="text-[10px] text-gray-400">Total volume deliveries by registered vendors comparing LY versus current TY period</p>
          </div>

          <div className="h-[200px] w-full text-xs">
            {supplierDetails.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierDetails} margin={{ left: -10, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="supplierName" fontSize={8} stroke="#94a3b8" tickFormatter={(v) => v.split(" ")[0]} tickLine={false} />
                  <YAxis fontSize={8} stroke="#94a3b8" tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="p1Qty" fill="#94a3b8" radius={[2, 2, 0, 0]} name="LY Volume" />
                  <Bar dataKey="p2Qty" fill="#1e40af" radius={[2, 2, 0, 0]} name="TY Volume" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400 italic">No supplier charts</div>
            )}
          </div>
        </div>

        {/* Supplier share donut */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4 text-left">
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Vendor Delivery Shares</h4>
            <p className="text-[10px] text-gray-440">Net sales value share contribution margins</p>
          </div>

          <div className="h-[140px] w-full flex items-center justify-center">
            {supplierDetails.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={supplierDetails}
                    dataKey="p2Val"
                    nameKey="supplierName"
                    cx="50%"
                    cy="55%"
                    innerRadius={45}
                    outerRadius={60}
                    paddingAngle={3}
                  >
                    {supplierDetails.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-400 font-sans">Empty</div>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-1 text-[10px]">
            {supplierDetails.slice(0, 3).map((s, idx) => {
              const totalVal = supplierDetails.reduce((sum, x) => sum + x.p2Val, 0);
              const share = totalVal > 0 ? (s.p2Val / totalVal) * 100 : 0;
              return (
                <div key={idx} className="flex justify-between items-center font-mono">
                  <span className="flex items-center gap-1 min-w-[120px] truncate text-gray-600 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate">{s.supplierName}</span>
                  </span>
                  <strong className="text-gray-950 font-black">{share.toFixed(0)}%</strong>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Supplier Register scoreboard Table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs text-left space-y-4 table-card">
        <div>
          <h4 className="text-xs font-bold text-gray-905 uppercase tracking-wider">Register Supplier comparative matrix</h4>
          <p className="text-[10px] text-gray-440">Complete comparative ledger listings of delivery volumes, net purchase shares, rank progressions, and validation status</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="supplierRegisterTable">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-2.5">Supplier Vendor Name</th>
                <th className="py-2.5 text-right font-mono">LY Qty</th>
                <th className="py-2.5 text-right font-mono">TY Qty</th>
                <th className="py-2.5 text-right">Volume growth</th>
                <th className="py-2.5 text-right">LY Value</th>
                <th className="py-2.5 text-right">TY Value</th>
                <th className="py-2.5 text-right">LY Share%</th>
                <th className="py-2.5 text-right font-bold text-gray-900">TY Share%</th>
                <th className="py-2.5 text-right">Tactical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleSuppliers.map((sup, idx) => {
                const totalLY = supplierDetails.reduce((v, x) => v + x.p1Val, 0);
                const totalTY = supplierDetails.reduce((v, x) => v + x.p2Val, 0);
                const lyShare = totalLY > 0 ? (sup.p1Val / totalLY) * 100 : 0;
                const tyShare = totalTY > 0 ? (sup.p2Val / totalTY) * 100 : 0;

                return (
                  <tr key={idx} className="hover:bg-gray-50/40">
                    <td className="py-3 font-semibold text-gray-901 leading-snug">{sup.supplierName}</td>
                    <td className="py-3 text-right text-gray-550 font-mono">{Math.round(sup.p1Qty).toLocaleString()}</td>
                    <td className="py-3 text-right font-bold text-gray-850 font-mono">{Math.round(sup.p2Qty).toLocaleString()}</td>
                    <td className={`py-3 text-right font-semibold font-mono ${sup.qtyDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {sup.qtyDiff >= 0 ? "+" : ""}{sup.qtyGrowth.toFixed(1)}%
                    </td>
                    <td className="py-3 text-right text-gray-400">₹{Math.round(sup.p1Val).toLocaleString()}</td>
                    <td className="py-3 text-right font-bold text-gray-900">₹{Math.round(sup.p2Val).toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-550 font-mono">{lyShare.toFixed(1)}%</td>
                    <td className="py-3 text-right font-bold text-gray-900 font-mono">{tyShare.toFixed(1)}%</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                        sup.status.includes("Active") || sup.status.includes("New")
                          ? "bg-green-50 text-green-700 font-sans"
                          : sup.status.includes("Weakening")
                          ? "bg-orange-50 text-orange-700"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {sup.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse pagination button */}
        {supplierDetails.length > 20 && (
          <div className="flex justify-center pt-2 pb-1 border-t border-gray-50">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200/50 rounded-xl transition cursor-pointer shadow-3xs"
            >
              {isExpanded ? (
                <>
                  <span>View Less</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>View More ({supplierDetails.length - 20} hidden)</span>
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
