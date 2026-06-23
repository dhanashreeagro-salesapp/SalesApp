import React, { useMemo, useState } from "react";
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Users, 
  ShieldAlert,
  Compass
} from "lucide-react";
import { InvoiceItem } from "../types";
import { 
  ResponsiveContainer, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Bar, 
  Cell, 
  PieChart, 
  Pie 
} from "recharts";

interface DashboardOverviewTabProps {
  p1Records: InvoiceItem[];
  p2Records: InvoiceItem[];
  productStats: any[];
  customerStats: any[];
  regionStats: any[];
}

const COLORS = ["#16a34a", "#2563eb", "#ea580c", "#8b5cf6", "#ec4899", "#f59e0b", "#14b8a6"];

export default function DashboardOverviewTab({
  p1Records,
  p2Records,
  productStats,
  customerStats,
  regionStats,
}: DashboardOverviewTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Aggregate Core Metrics
  const totalP1Value = useMemo(() => p1Records.reduce((sum, r) => sum + r.netSalesValue, 0), [p1Records]);
  const totalP2Value = useMemo(() => p2Records.reduce((sum, r) => sum + r.netSalesValue, 0), [p2Records]);
  const valDiff = totalP2Value - totalP1Value;
  const valGrowth = totalP1Value > 0 ? (valDiff / totalP1Value) * 100 : 0;

  const totalP1Qty = useMemo(() => p1Records.reduce((sum, r) => sum + r.quantity, 0), [p1Records]);
  const totalP2Qty = useMemo(() => p2Records.reduce((sum, r) => sum + r.quantity, 0), [p2Records]);
  const qtyDiff = totalP2Qty - totalP1Qty;
  const qtyGrowth = totalP1Qty > 0 ? (qtyDiff / totalP1Qty) * 105 : 0; // consistent scaling

  // Additional dynamic indicators requested by the user, calculated at Category Level
  const regionsWithGrowth = useMemo(() => regionStats.filter(r => r.qtyDiff > 0).length, [regionStats]);
  const productsWithGrowthValue = useMemo(() => productStats.filter(p => p.valDiff > 0).length, [productStats]);
  const productsWithGrowthQty = useMemo(() => productStats.filter(p => p.qtyDiff > 0).length, [productStats]);
  const productsWithDegrowthQty = useMemo(() => productStats.filter(p => p.qtyDiff < 0).length, [productStats]);
  
  const newProductsCount = useMemo(() => productStats.filter(p => p.p2Qty > 0 && p.p1Qty === 0).length, [productStats]);
  const newCustomersCount = useMemo(() => customerStats.filter(c => c.p2Qty > 0 && c.p1Qty === 0).length, [customerStats]);

  // Leaders / Laggards
  const topGrowingProduct = useMemo(() => {
    const list = [...productStats].filter(p => p.p1Qty > 5).sort((a,b) => b.qtyGrowth - a.qtyGrowth);
    return list[0] || null;
  }, [productStats]);

  const biggestQtyLoss = useMemo(() => {
    const list = [...productStats].sort((a,b) => a.qtyDiff - b.qtyDiff);
    return list[0] && list[0].qtyDiff < 0 ? list[0] : null;
  }, [productStats]);

  const worstRegion = useMemo(() => {
    const list = [...regionStats].sort((a,b) => a.qtyGrowth - b.qtyGrowth);
    return list[0] || null;
  }, [regionStats]);

  const lostCustomersCount = useMemo(() => {
    return customerStats.filter(c => c.p1Qty > 0 && c.p2Qty === 0).length;
  }, [customerStats]);

  // Category summary map
  const categorySummary = useMemo(() => {
    const matchedCategories = Array.from(new Set([
      ...p1Records.map(r => r.productCategory),
      ...p2Records.map(r => r.productCategory)
    ])).filter(Boolean);

    return matchedCategories.map(cat => {
      const p1Match = p1Records.filter(r => r.productCategory === cat);
      const p2Match = p2Records.filter(r => r.productCategory === cat);
      
      const p1Q = p1Match.reduce((sum, r) => sum + r.quantity, 0);
      const p2Q = p2Match.reduce((sum, r) => sum + r.quantity, 0);
      const qDiff = p2Q - p1Q;
      const qGr = p1Q > 0 ? (qDiff / p1Q) * 100 : 0;

      const p1V = p1Match.reduce((sum, r) => sum + r.netSalesValue, 0);
      const p2V = p2Match.reduce((sum, r) => sum + r.netSalesValue, 0);
      const vDiff = p2V - p1V;
      const vGr = p1V > 0 ? (vDiff / p1V) * 100 : 0;

      let status = "Stable";
      if (qGr > 10) status = "Strong Growth";
      else if (qGr > 0) status = "Steady";
      else if (qGr < -15) status = "Severe Decline";
      else if (qGr < 0) status = "Weak";

      return {
        category: cat,
        p1Qty: p1Q,
        p2Qty: p2Q,
        qtyDiff: qDiff,
        qtyGrowth: qGr,
        p1Val: p1V,
        p2Val: p2V,
        valDiff: vDiff,
        valGrowth: vGr,
        status
      };
    }).sort((a,b) => b.p2Val - a.p2Val);
  }, [p1Records, p2Records]);

  // Sliced categories for pagination
  const visibleCategories = useMemo(() => {
    if (categorySummary.length <= 20) return categorySummary;
    return isExpanded ? categorySummary : categorySummary.slice(0, 20);
  }, [categorySummary, isExpanded]);

  // Compile monthly bar chart data
  const getMonthName = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("en-US", { month: "short" });
  };
  const monthNamesOrdered = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const monthlyBarData = useMemo(() => {
    const p1ByMonth: Record<string, number> = {};
    const p2ByMonth: Record<string, number> = {};

    p1Records.forEach(r => {
      const m = getMonthName(r.invoiceDate);
      if (m) p1ByMonth[m] = (p1ByMonth[m] || 0) + r.quantity;
    });

    p2Records.forEach(r => {
      const m = getMonthName(r.invoiceDate);
      if (m) p2ByMonth[m] = (p2ByMonth[m] || 0) + r.quantity;
    });

    const activeMonths = Array.from(new Set([...Object.keys(p1ByMonth), ...Object.keys(p2ByMonth)]))
      .sort((a,b) => monthNamesOrdered.indexOf(a) - monthNamesOrdered.indexOf(b));

    return activeMonths.map(m => ({
      name: m,
      "Previous Year": Math.round(p1ByMonth[m] || 0),
      "Current Year": Math.round(p2ByMonth[m] || 0)
    }));
  }, [p1Records, p2Records]);

  return (
    <div className="space-y-6" id="dashboardOverviewWorkspace">
      
      {/* Risk Alert Panel if growth values are down */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all duration-300 ${
        qtyGrowth < 0 
          ? "bg-red-50/70 border-red-150 text-red-900" 
          : "bg-green-50/70 border-green-150 text-green-900"
      }`}>
        <ShieldAlert className={`w-5 h-5 mt-0.5 shrink-0 ${qtyGrowth < 0 ? "text-red-500 animate-pulse" : "text-green-600"}`} />
        <div className="text-xs text-left leading-relaxed">
          <strong className="font-bold block text-sm">
            {qtyGrowth < 0 ? "CRM Warning Notice" : "Operations Insight Notice"}
          </strong>
          {qtyGrowth < 0 ? (
            <span>
              Overall product volume (quantity) has declined by <strong className="font-extrabold">{Math.abs(qtyGrowth).toFixed(1)}%</strong> ({qtyDiff.toLocaleString()} kg/L lost) versus the comparable baseline period. Take immediate trade interventions with laggard dealers.
            </span>
          ) : (
            <span>
              Overall product volume is expanding successfully by <strong className="font-extrabold">+{qtyGrowth.toFixed(1)}%</strong> ({qtyDiff.toLocaleString()} kg/L added) compared to the baseline period last year, indicating healthy demand generation.
            </span>
          )}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Quantity Change */}
        <div id="kpi-qty-summary" className="bg-white dark:bg-slate-900 border border-gray-105 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-1.5 text-left kpi-box-item transition-colors">
          <span className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-widest block font-sans">Volume (Qty) Change</span>
          <div className="text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-none">
            {qtyGrowth >= 0 ? "+" : ""}{qtyGrowth.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 leading-snug font-mono">
            Diff: <span className={`font-bold ${qtyGrowth >= 0 ? "text-green-600" : "text-red-500"}`}>{qtyDiff.toLocaleString()} kg/L</span>
          </div>
        </div>

        {/* KPI 2: Value Change */}
        <div id="kpi-value-summary" className="bg-white dark:bg-slate-900 border border-gray-105 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-1.5 text-left kpi-box-item transition-colors">
          <span className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-widest block font-sans">Net Value Change</span>
          <div className="text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-none font-mono">
            {valGrowth >= 0 ? "+" : ""}{valGrowth.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 leading-snug font-mono">
            Diff: <span className={`font-bold ${valGrowth >= 0 ? "text-green-600" : "text-red-500"}`}>₹{(valDiff/100000).toFixed(2)} Lakhs</span>
          </div>
        </div>

        {/* KPI 3: Regional Growth Stats */}
        <div id="kpi-regions-growth" className="bg-white dark:bg-slate-900 border border-gray-105 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-1.5 text-left kpi-box-item transition-colors">
          <span className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-widest block font-sans">Regions with Growth</span>
          <div className="text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-none">
            {regionsWithGrowth} <span className="text-xs text-gray-400 dark:text-slate-500 font-semibold">of {regionStats.length}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-400 leading-snug">
            Regions experiencing positive dynamic expansion.
          </div>
        </div>

        {/* KPI 4: Catalog Segment metrics */}
        <div id="kpi-products-qty-trend" className="bg-white dark:bg-slate-900 border border-gray-105 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-1.5 text-left kpi-box-item transition-colors">
          <span className="text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-widest block font-sans">Brand Growth status</span>
          <div className="text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-none font-mono">
            {productsWithGrowthQty} <span className="text-gray-400 font-light text-sm">/</span> <span className="text-red-500">{productsWithDegrowthQty}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-slate-450 leading-snug">
            Count of product categories growing versus declining.
          </div>
        </div>

      </div>

      {/* Secondary Quick Metric Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-100/80 rounded-xl px-4 py-2.5 text-left flex items-center justify-between mini-badge">
          <div>
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">New Launch Categories</span>
            <strong className="text-sm font-extrabold text-slate-800">{newProductsCount} Segments</strong>
          </div>
          <Layers className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="bg-slate-50 border border-slate-100/80 rounded-xl px-4 py-2.5 text-left flex items-center justify-between mini-badge">
          <div>
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">New Dealers onboarded</span>
            <strong className="text-sm font-extrabold text-slate-800">{newCustomersCount} Accounts</strong>
          </div>
          <Users className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="bg-slate-50 border border-slate-100/80 rounded-xl px-4 py-2.5 text-left flex items-center justify-between col-span-2 mini-badge">
          <div>
            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider block">Lost Dealers active last year</span>
            <strong className="text-sm font-extrabold text-red-600">{lostCustomersCount || 0} Accounts inactive now</strong>
          </div>
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
        </div>
      </div>

      {/* Charts & Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shadow-charts">
        
        {/* Month-wise Volume column comparison */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs lg:col-span-2 space-y-4">
          <div className="text-left">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Month-wise Comparative Product Volume (kg/L)</h4>
            <p className="text-[10px] text-gray-400">Monthly breakdown comparing baseline targets versus current results</p>
          </div>

          <div className="h-[240px] w-full text-xs" id="monthlyBarChartContainer animate-fade-in">
            {monthlyBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBarData} margin={{ left: -10, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip formatter={(val) => [`${Number(val).toLocaleString()} kg/L`, "Volume"]} />
                  <Bar dataKey="Previous Year" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={35} />
                  <Bar dataKey="Current Year" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={35} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-450 italic">
                No monthly transactions filtered inside active range
              </div>
            )}
          </div>
        </div>

        {/* Category Share & growth visual */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="text-left">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Brand Segment Value Share</h4>
            <p className="text-[10px] text-gray-400">Contribution summary profile across categories</p>
          </div>

          <div className="h-[150px] w-full flex items-center justify-center animate-fade-in">
            {categorySummary.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySummary}
                    dataKey="p2Val"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {categorySummary.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-400 font-sans">No active categories found</div>
            )}
          </div>

          {/* Legend Table */}
          <div className="space-y-1.5 text-[10px] text-left pt-2">
            {categorySummary.slice(0, 4).map((c, idx) => {
              const totalVal = categorySummary.reduce((s, x) => s + x.p2Val, 0);
              const share = totalVal > 0 ? (c.p2Val / totalVal) * 100 : 0;
              return (
                <div key={idx} className="flex items-center justify-between font-mono">
                  <div className="flex items-center gap-1.5 truncate max-w-[150px] font-sans">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate text-gray-600 font-medium">{c.category}</span>
                  </div>
                  <strong className="text-gray-900 font-bold">{share.toFixed(0)}% (₹{(c.p2Val/100000).toFixed(1)}L)</strong>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Category Performance Matrices Table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs text-left space-y-4 table-card">
        <div>
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Product Category Standings Matrix</h4>
          <p className="text-[10px] text-gray-450">Complete brand segments side-by-side volume and value scorecard</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="categoryOverviewTable">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold pb-2">
                <th className="py-2">Category Segment</th>
                <th className="py-2 text-right">LY Qty</th>
                <th className="py-2 text-right">TY Qty</th>
                <th className="py-2 text-right">Qty Growth</th>
                <th className="py-2 text-right font-mono">LY Value</th>
                <th className="py-2 text-right font-mono">TY Value</th>
                <th className="py-2 text-right font-mono">Value Growth</th>
                <th className="py-2 text-right">Tactical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleCategories.map((cat, idx) => (
                <tr key={idx} className="hover:bg-gray-50/40">
                  <td className="py-3 font-semibold text-gray-850">{cat.category}</td>
                  <td className="py-3 text-right text-gray-500 font-mono">{Math.round(cat.p1Qty).toLocaleString()}</td>
                  <td className="py-3 text-right font-semibold text-gray-800 font-mono">{Math.round(cat.p2Qty).toLocaleString()}</td>
                  <td className={`py-3 text-right font-bold font-mono ${cat.qtyDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {cat.qtyDiff >= 0 ? "+" : ""}{cat.qtyGrowth.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right text-gray-450 font-mono">₹{Math.round(cat.p1Val).toLocaleString()}</td>
                  <td className="py-3 text-right font-bold text-gray-900 font-mono font-sans">₹{Math.round(cat.p2Val).toLocaleString()}</td>
                  <td className={`py-3 text-right font-bold font-mono ${cat.valDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {cat.valDiff >= 0 ? "+" : ""}{cat.valGrowth.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                      cat.status.includes("Growth") 
                        ? "bg-green-50 text-green-700" 
                        : cat.status.includes("Steady")
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700"
                    }`}>
                      {cat.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse pagination button */}
        {categorySummary.length > 20 && (
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
                  <span>View More ({categorySummary.length - 20} hidden)</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Leaderboards highlights Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left shadow-badges">
        
        {/* Leaderboard card 1: Top volume categories */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4.5 h-4.5 text-green-600 shrink-0" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest block">Top Volume Category Segment Gain</span>
          </div>
          {topGrowingProduct ? (
            <div className="space-y-2">
              <strong className="text-sm text-gray-900 block leading-tight">{topGrowingProduct.name}</strong>
              <div className="text-[11px] text-gray-500 space-y-1 bg-green-50/40 p-3 rounded-xl border border-green-100">
                <div className="flex justify-between font-mono"><span>Baseline Qty:</span><strong>{Math.round(topGrowingProduct.p1Qty).toLocaleString()} Kg/L</strong></div>
                <div className="flex justify-between font-mono"><span>Current Qty:</span><strong className="text-green-700">{Math.round(topGrowingProduct.p2Qty).toLocaleString()} Kg/L</strong></div>
                <div className="flex justify-between font-mono"><span>Growth Rate:</span><span className="text-green-600 font-bold">+{topGrowingProduct.qtyGrowth.toFixed(1)}%</span></div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">No growing Category Segment detected</div>
          )}
        </div>

        {/* Leaderboard card 2: Worst Category Loss */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-red-600 shrink-0" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest block">Worst Volume Category Segment Drop</span>
          </div>
          {biggestQtyLoss ? (
            <div className="space-y-2">
              <strong className="text-sm text-gray-950 block leading-tight">{biggestQtyLoss.name}</strong>
              <div className="text-[11px] text-gray-500 space-y-1 bg-red-50/40 p-3 rounded-xl border border-red-100">
                <div className="flex justify-between font-mono"><span>Baseline Qty:</span><strong>{Math.round(biggestQtyLoss.p1Qty).toLocaleString()} Kg/L</strong></div>
                <div className="flex justify-between font-mono"><span>Current Qty:</span><strong className="text-red-700">{Math.round(biggestQtyLoss.p2Qty).toLocaleString()} Kg/L</strong></div>
                <div className="flex justify-between font-mono"><span>Net Lost:</span><span className="text-red-600 font-extrabold">{Math.round(biggestQtyLoss.qtyDiff).toLocaleString()} kg/L</span></div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">No declining Category Segment found</div>
          )}
        </div>

        {/* Leaderboard card 3: Regional laggard */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-orange-600 shrink-0" style={{ transform: "rotate(180deg)" }} />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest block">Critical Region Status</span>
          </div>
          {worstRegion ? (
            <div className="space-y-2">
              <strong className="text-sm text-gray-900 block leading-tight">{worstRegion.regionName} Region</strong>
              <div className="text-[11px] text-gray-500 space-y-1 bg-orange-50/40 p-3 rounded-xl border border-orange-100">
                <div className="flex justify-between font-mono"><span>Baseline Qty:</span><strong>{Math.round(worstRegion.p1Qty).toLocaleString()}</strong></div>
                <div className="flex justify-between font-mono"><span>Current Qty:</span><strong className="text-orange-700">{Math.round(worstRegion.p2Qty).toLocaleString()}</strong></div>
                <div className="flex justify-between font-mono"><span>Region Growth:</span><span className={`font-bold ${worstRegion.qtyGrowth >= 0 ? "text-green-600" : "text-red-500"}`}>{worstRegion.qtyGrowth.toFixed(1)}%</span></div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">No region found</div>
          )}
        </div>

      </div>

    </div>
  );
}
