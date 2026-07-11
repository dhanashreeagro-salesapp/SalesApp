import React, { useMemo, useState } from "react";
import { 
  UsersRound, 
  Trash2, 
  ArrowDownRight, 
  ShieldAlert, 
  MapPin, 
  Layers 
} from "lucide-react";
import { InvoiceItem } from "../types";
import { 
  ResponsiveContainer, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Bar 
} from "recharts";

interface DroppedLostCRMTabProps {
  customerStats: any[];
  p1Records: InvoiceItem[];
  p2Records: InvoiceItem[];
}

export default function DroppedLostCRMTab({
  customerStats,
  p1Records,
  p2Records,
}: DroppedLostCRMTabProps) {
  const [isExpandedLost, setIsExpandedLost] = useState(false);
  const [isExpandedDropped, setIsExpandedDropped] = useState(false);
  const [isExpandedGaps, setIsExpandedGaps] = useState(false);

  // 1. Identify LOST CUSTOMERS (bought in Period 1, but zero in Period 2)
  const lostCustomersList = useMemo(() => {
    return customerStats
      .filter(c => c.p1Qty > 0 && c.p2Qty === 0)
      .map(c => {
        // Find their highest-selling product category in period 1
        const matches = p1Records.filter(r => r.customerName === c.customerName);
        const categoryVals: Record<string, number> = {};
        matches.forEach(r => {
          const cat = r.productCategory || "Other";
          categoryVals[cat] = (categoryVals[cat] || 0) + r.netSalesValue;
        });
        const lastCategory = Object.keys(categoryVals)
          .sort((a,b) => categoryVals[b] - categoryVals[a])[0] || "Various Segments";

        // Business risk rating based on sales value
        let riskRating = "Low Risk";
        if (c.p1Val > 100000) riskRating = "CRITICAL / VERY HIGH";
        else if (c.p1Val > 40000) riskRating = "High Risk";
        else if (c.p1Val > 15000) riskRating = "Medium Risk";

        return {
          ...c,
          lastProduct: lastCategory,
          riskRating
        };
      })
      .sort((a,b) => b.p1Qty - a.p1Qty); // Sorted descending by volume loss
  }, [customerStats, p1Records]);

  // 2. Identify DROPPED CUSTOMERS (bought in Period 1 and Period 2, but declined by >15% in Qty)
  const droppedCustomersList = useMemo(() => {
    return customerStats
      .filter(c => c.p1Qty > 0 && c.p2Qty > 0 && c.qtyDiff < 0 && (c.qtyDiff / c.p1Qty) <= -0.15)
      .map(c => {
        const dropPercent = (Math.abs(c.qtyDiff) / c.p1Qty) * 100;
        return {
          ...c,
          dropPercent
        };
      })
      .sort((a,b) => a.qtyDiff - b.qtyDiff); // Largest physical drops at the top
  }, [customerStats]);

  // 3. Categories where sales were lost
  const lostProductsGaps = useMemo(() => {
    const lostCustomerNames = lostCustomersList.map(c => c.customerName);
    const lostCategoryMap: Record<string, { category: string; qty: number; val: number }> = {};
    
    p1Records
      .filter(r => lostCustomerNames.includes(r.customerName))
      .forEach(r => {
        const cat = r.productCategory || "Product";
        if (!lostCategoryMap[cat]) lostCategoryMap[cat] = { category: cat, qty: 0, val: 0 };
        lostCategoryMap[cat].qty += r.quantity;
        lostCategoryMap[cat].val += r.netSalesValue;
      });

    return Object.entries(lostCategoryMap).map(([cat, stats]) => ({
      productName: cat, // reuse productName to avoid type errors
      category: cat,
      qtyLost: stats.qty,
      valLost: stats.val
    })).sort((a,b) => b.valLost - a.valLost);
  }, [lostCustomersList, p1Records]);

  // Sliced lists for toggling more/less
  const visibleLost = useMemo(() => {
    if (lostCustomersList.length <= 20) return lostCustomersList;
    return isExpandedLost ? lostCustomersList : lostCustomersList.slice(0, 20);
  }, [lostCustomersList, isExpandedLost]);

  const visibleDropped = useMemo(() => {
    if (droppedCustomersList.length <= 20) return droppedCustomersList;
    return isExpandedDropped ? droppedCustomersList : droppedCustomersList.slice(0, 20);
  }, [droppedCustomersList, isExpandedDropped]);

  const visibleGaps = useMemo(() => {
    if (lostProductsGaps.length <= 20) return lostProductsGaps;
    return isExpandedGaps ? lostProductsGaps : lostProductsGaps.slice(0, 20);
  }, [lostProductsGaps, isExpandedGaps]);

  // Aggregate metrics
  const totalLostValue = useMemo(() => lostCustomersList.reduce((sum, c) => sum + c.p1Val, 0), [lostCustomersList]);
  const totalLostQty = useMemo(() => lostCustomersList.reduce((sum, c) => sum + c.p1Qty, 0), [lostCustomersList]);

  const totalDroppedValueAtRisk = useMemo(() => {
    return droppedCustomersList.reduce((sum, c) => sum + (c.p1Val - c.p2Val), 0);
  }, [droppedCustomersList]);

  // Region breakdown of lost accounts
  const regionLostBreakdown = useMemo(() => {
    const regionMap: Record<string, { count: number; qtyLost: number; valLost: number }> = {};
    lostCustomersList.forEach(c => {
      const rName = c.region || "Unknown";
      if (!regionMap[rName]) regionMap[rName] = { count: 0, qtyLost: 0, valLost: 0 };
      regionMap[rName].count += 1;
      regionMap[rName].qtyLost += c.p1Qty;
      regionMap[rName].valLost += c.p1Val;
    });

    return Object.entries(regionMap).map(([region, stats]) => ({
      region,
      lostCount: stats.count,
      qtyLost: Math.round(stats.qtyLost),
      valueLost: Math.round(stats.valLost)
    })).sort((a,b) => b.valueLost - a.valueLost);
  }, [lostCustomersList]);

  const worstCRMRegion = useMemo(() => {
    return regionLostBreakdown[0] || { region: "None", lostCount: 0, qtyLost: 0 };
  }, [regionLostBreakdown]);

  // Chart data: lost region analytics
  const lostRegionChartData = useMemo(() => {
    return regionLostBreakdown.map(r => ({
      name: r.region,
      "Lost Accounts": r.lostCount,
      "Lost Qty (x10)": Math.round(r.qtyLost / 10) // downscaled for comparison
    }));
  }, [regionLostBreakdown]);

  return (
    <div className="space-y-6" id="droppedLostCrmWorkspace">
      
      {/* Alarming indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-4 shadow-3xs text-left space-y-1 indicator-card">
          <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">Lost Dealers (TY)</span>
          <div className="text-2xl font-black text-red-950 leading-none">{lostCustomersList.length} Accounts</div>
          <span className="text-[10px] text-gray-400 font-semibold">Dealers with zero current billing</span>
        </div>

        <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-4 shadow-3xs text-left space-y-1 indicator-card">
          <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider block">Value of Lost Sales</span>
          <div className="text-2xl font-black text-orange-950 leading-none">₹{Math.round(totalLostValue).toLocaleString()}</div>
          <span className="text-[10px] text-gray-400 font-semibold">Financial gap of unbilled historical accounts</span>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-3xs text-left space-y-1 indicator-card">
          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Shrinkage Value Gaps</span>
          <div className="text-2xl font-black text-amber-955 leading-none">₹{Math.round(totalDroppedValueAtRisk).toLocaleString()}</div>
          <span className="text-[10px] text-gray-400 font-semibold">Decline revenue at risk from active accounts</span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 shadow-3xs text-left space-y-1 indicator-card">
          <span className="text-[10px] text-slate-505 font-bold uppercase tracking-wider block">Declining Dealers (TY)</span>
          <div className="text-2xl font-black text-slate-900 leading-none">{droppedCustomersList.length} Accounts</div>
          <span className="text-[10px] text-gray-400 font-semibold">Dealers exhibiting over 15% shrinkage</span>
        </div>

      </div>

      {/* CRM analysis complete list of lost relationships (24 customers) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4 text-left table-card">
        <div>
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest flex items-center gap-1.5">
            <Trash2 className="w-4 h-4 text-red-600" /> Lost Customer audit log
          </h4>
          <p className="text-[10px] text-gray-400">Complete registers of dealers transacting inside last baseline year, but showing zero bookings this current year</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="lostCustomersTable">
            <thead>
              <tr className="border-b border-gray-100 text-gray-450 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-2">Dealer / Client Name</th>
                <th className="py-2">Region Map</th>
                <th className="py-2 text-right font-mono">LY Lost Qty</th>
                <th className="py-2 text-right">Lost Value (₹)</th>
                <th className="py-2">Dominant Lost Category</th>
                <th className="py-2 text-right">Business Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleLost.map((c, idx) => (
                <tr key={idx} className="hover:bg-red-50/10">
                  <td className="py-3 font-bold text-red-950 leading-snug">{c.customerName}</td>
                  <td className="py-3 text-gray-655 font-medium">{c.region} - {c.territory}</td>
                  <td className="py-3 text-right font-extrabold text-red-700 font-mono">{Math.round(c.p1Qty).toLocaleString()} Kg/L</td>
                  <td className="py-3 text-right font-semibold text-gray-800 font-mono">₹{Math.round(c.p1Val).toLocaleString()}</td>
                  <td className="py-3 text-gray-600 italic font-medium">{c.lastProduct}</td>
                  <td className="py-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-normal ${
                      c.riskRating.includes("CRITICAL") 
                        ? "bg-red-100 text-red-800"
                        : c.riskRating.includes("High")
                        ? "bg-orange-100 text-orange-850"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {c.riskRating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse Lost Customers pagination button */}
        {lostCustomersList.length > 20 && (
          <div className="flex justify-center pt-2 pb-1 border-t border-gray-50">
            <button
              onClick={() => setIsExpandedLost(!isExpandedLost)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200/50 rounded-xl transition cursor-pointer shadow-3xs"
            >
              {isExpandedLost ? (
                <>
                  <span>View Less</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>View More ({lostCustomersList.length - 20} hidden)</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* CRM audit list of dropped customers (>15% decline) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4 text-left table-card">
        <div>
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest flex items-center gap-1.5">
            <ArrowDownRight className="w-4 h-4 text-orange-500" /> Dropped dealer accounts audit log (&gt;15% shrinkage)
          </h4>
          <p className="text-[10px] text-gray-440">Dealers still transacting currently but exhibiting severe shrinkage thresholds compared to historical bounds</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="droppedCustomersTable">
            <thead>
              <tr className="border-b border-gray-100 text-gray-450 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-2">Dealer / Client Name</th>
                <th className="py-2">Region Scope</th>
                <th className="py-2 text-right font-mono">LY Qty</th>
                <th className="py-2 text-right font-mono">TY Qty</th>
                <th className="py-2 text-right">Qty shrinkage</th>
                <th className="py-2 text-right">LY Value</th>
                <th className="py-2 text-right font-bold text-gray-900">Current Value</th>
                <th className="py-2 text-right">Risk Warning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleDropped.map((c, idx) => (
                <tr key={idx} className="hover:bg-orange-50/10">
                  <td className="py-3 font-bold text-gray-901 leading-snug">{c.customerName}</td>
                  <td className="py-3 text-gray-650 font-medium">{c.region} - {c.territory}</td>
                  <td className="py-3 text-right text-gray-550 font-mono">{Math.round(c.p1Qty).toLocaleString()}</td>
                  <td className="py-3 text-right font-semibold text-gray-800 font-mono">{Math.round(c.p2Qty).toLocaleString()}</td>
                  <td className="py-3 text-right font-extrabold text-orange-600 font-mono">-{c.dropPercent.toFixed(0)}%</td>
                  <td className="py-3 text-right text-gray-400">₹{Math.round(c.p1Val).toLocaleString()}</td>
                  <td className="py-3 text-right font-bold text-gray-900">₹{Math.round(c.p2Val).toLocaleString()}</td>
                  <td className="py-3 text-right">
                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[9px] font-bold border border-yellow-250 rounded">
                      Decline Alert
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse Dropped Customers pagination button */}
        {droppedCustomersList.length > 20 && (
          <div className="flex justify-center pt-2 pb-1 border-t border-gray-50">
            <button
              onClick={() => setIsExpandedDropped(!isExpandedDropped)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200/50 rounded-xl transition cursor-pointer shadow-3xs"
            >
              {isExpandedDropped ? (
                <>
                  <span>View Less</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>View More ({droppedCustomersList.length - 20} hidden)</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Lost Product Gaps panel */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4 text-left table-card">
        <div>
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-purple-600" /> Unfulfilled category segment gaps with lost accounts
          </h4>
          <p className="text-[10px] text-gray-400">Category segments that were purchased previously by lost accounts that represent lost trade slots currently</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="unfulfilledCategoryGapsTable">
            <thead>
              <tr className="border-b border-gray-100 text-gray-450 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-2">Unfulfilled Category Segment</th>
                <th className="py-2">Category Segment</th>
                <th className="py-2 text-right">Qty Lost</th>
                <th className="py-2 text-right font-bold text-gray-900">Financial Value Lost</th>
                <th className="py-2 text-right">Intervention Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleGaps.map((p, idx) => (
                <tr key={idx} className="hover:bg-purple-50/10">
                  <td className="py-3 font-bold text-purple-950">{p.productName}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold rounded">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono">{Math.round(p.qtyLost).toLocaleString()} kg/L</td>
                  <td className="py-3 text-right font-extrabold text-purple-900 font-mono">₹{Math.round(p.valLost).toLocaleString()}</td>
                  <td className="py-3 text-right font-sans">
                    <button className="text-[9px] text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold px-2.5 py-1 rounded-md cursor-pointer transition">
                      Reclaim slot
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse lost product gaps pagination button */}
        {lostProductsGaps.length > 20 && (
          <div className="flex justify-center pt-2 pb-1 border-t border-gray-50">
            <button
              onClick={() => setIsExpandedGaps(!isExpandedGaps)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200/50 rounded-xl transition cursor-pointer shadow-3xs"
            >
              {isExpandedGaps ? (
                <>
                  <span>View Less</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>View More ({lostProductsGaps.length - 20} hidden)</span>
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
