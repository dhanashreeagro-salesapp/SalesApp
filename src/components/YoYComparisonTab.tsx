import React, { useMemo } from "react";
import { 
  Calendar, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Map 
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

interface YoYComparisonTabProps {
  monthlyStats: any[];
  regionStats: any[];
}

const COLORS = ["#16a34a", "#2563eb", "#ea580c", "#8b5cf6", "#ec4899", "#115e59", "#b45309"];

export default function YoYComparisonTab({
  monthlyStats,
  regionStats,
}: YoYComparisonTabProps) {

  // Total sums for contribution denominators
  const totalLYQtyRegion = useMemo(() => regionStats.reduce((sum, r) => sum + r.p1Qty, 0), [regionStats]);
  const totalTYQtyRegion = useMemo(() => regionStats.reduce((sum, r) => sum + r.p2Qty, 0), [regionStats]);

  const regionYoYDetails = useMemo(() => {
    return regionStats.map(r => {
      const lyShare = totalLYQtyRegion > 0 ? (r.p1Qty / totalLYQtyRegion) * 100 : 0;
      const tyShare = totalTYQtyRegion > 0 ? (r.p2Qty / totalTYQtyRegion) * 100 : 0;

      let status = "Stable";
      if (r.qtyGrowth > 10) status = "Expanding";
      else if (r.qtyGrowth < -15) status = "Decline Hazard";
      else if (r.qtyGrowth < 0) status = "Contraction";

      return {
        ...r,
        lyShare,
        tyShare,
        status
      };
    }).sort((a,b) => b.p2Qty - a.p2Qty);
  }, [regionStats, totalLYQtyRegion, totalTYQtyRegion]);

  // Chart data: Region growth percent column
  const regionGrowthChartData = useMemo(() => {
    return regionStats.map(r => ({
      name: r.regionName,
      "Growth Qty (%)": Math.round(r.qtyGrowth),
      "Growth Value (%)": Math.round(r.valGrowth)
    }));
  }, [regionStats]);

  // Pie chart shares
  const lyPieData = useMemo(() => {
    return regionYoYDetails.map(r => ({
      name: r.regionName,
      value: Math.max(0, r.p1Qty)
    }));
  }, [regionYoYDetails]);

  const tyPieData = useMemo(() => {
    return regionYoYDetails.map(r => ({
      name: r.regionName,
      value: Math.max(0, r.p2Qty)
    }));
  }, [regionYoYDetails]);

  return (
    <div className="space-y-6" id="yoyComparisonWorkspace">
      
      {/* Overview Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        
        {/* Region growth comparison bar */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-green-600" /> Region YoY Growth Rate index
            </h4>
            <p className="text-[10px] text-gray-400 font-semibold">YoY comparison rates by quantities and revenue across supervised territories</p>
          </div>

          <div className="h-[180px] w-full text-xs">
            {regionGrowthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionGrowthChartData} margin={{ left: -15, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip />
                  <Bar dataKey="Growth Qty (%)" fill="#16a34a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Growth Value (%)" fill="#2563eb" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400 italic text-xs">No region targets</div>
            )}
          </div>
        </div>

        {/* Region Qty Share Dual Pie Charts (LY vs TY) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Map className="w-4 h-4 text-blue-600" /> Comparison Share: LY versus TY Volumes
            </h4>
            <p className="text-[10px] text-gray-400 font-semibold">Side by side structural comparison of regional quantities</p>
          </div>

          <div className="grid grid-cols-2 gap-4 h-[180px]">
            {/* Left Pie: LY Share */}
            <div className="flex flex-col items-center justify-center relative">
              <h5 className="text-[9px] font-bold uppercase text-gray-400 absolute top-0">Baseline LY</h5>
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lyPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="55%"
                      outerRadius={45}
                    >
                      {lyPieData.map((entry, index) => (
                        <Cell key={`lycell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Pie: TY Share */}
            <div className="flex flex-col items-center justify-center relative">
              <h5 className="text-[9px] font-bold uppercase text-blue-500 absolute top-0">Current TY</h5>
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tyPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="55%"
                      outerRadius={45}
                    >
                      {tyPieData.map((entry, index) => (
                        <Cell key={`tycell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Month YoY comparative table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs text-left space-y-4">
        <div>
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-green-600" /> Multi-Company Month-wise Comparison Ledger
          </h4>
          <p className="text-[10px] text-gray-400 font-semibold">Monthly comparison parameters measuring volume quantity differences and financial value progression parameters</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-2.5">Month Period</th>
                <th className="py-2.5 text-right font-mono">LY Qty</th>
                <th className="py-2.5 text-right font-mono">TY Qty</th>
                <th className="py-2.5 text-right">Qty Diff</th>
                <th className="py-2.5 text-right">Qty Growth</th>
                <th className="py-2.5 text-right">LY Value</th>
                <th className="py-2.5 text-right">TY Value</th>
                <th className="py-2.5 text-right">Value Diff</th>
                <th className="py-2.5 text-right">Value Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthlyStats.map((mon, idx) => (
                <tr key={idx} className="hover:bg-gray-50/40">
                  <td className="py-3 font-semibold text-gray-900">{mon.monthName}</td>
                  <td className="py-3 text-right text-gray-550 font-mono">{Math.round(mon.p1Qty).toLocaleString()}</td>
                  <td className="py-3 text-right font-bold text-gray-800 font-mono">{Math.round(mon.p2Qty).toLocaleString()}</td>
                  <td className={`py-3 text-right font-semibold font-mono ${mon.qtyDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {mon.qtyDiff >= 0 ? "+" : ""}{Math.round(mon.qtyDiff).toLocaleString()}
                  </td>
                  <td className={`py-3 text-right font-bold font-mono ${mon.qtyDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {mon.qtyDiff >= 0 ? "+" : ""}{mon.qtyGrowth.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right text-gray-400">₹{Math.round(mon.p1Val).toLocaleString()}</td>
                  <td className="py-3 text-right font-bold text-gray-900">₹{Math.round(mon.p2Val).toLocaleString()}</td>
                  <td className={`py-3 text-right font-semibold ${mon.valDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {mon.valDiff >= 0 ? "+" : ""}₹{Math.round(mon.valDiff).toLocaleString()}
                  </td>
                  <td className={`py-3 text-right font-bold ${mon.valDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {mon.valDiff >= 0 ? "+" : ""}{mon.valGrowth.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Region YoY comparison table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs text-left space-y-4">
        <div>
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest flex items-center gap-1.5">
            <Map className="w-4 h-4 text-blue-600" /> Territorial YoY volume structure matrices
          </h4>
          <p className="text-[10px] text-gray-400 font-semibold">Comparing territorial sales volumes, volume changes, baseline structural and current structural shares side by side</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                <th className="py-2.5">Region Scope</th>
                <th className="py-2.5 text-right font-mono">LY Qty</th>
                <th className="py-2.5 text-right font-mono">TY Qty</th>
                <th className="py-2.5 text-right">Volume Shift</th>
                <th className="py-2.5 text-right">Qty Growth</th>
                <th className="py-2.5 text-right">LY Share%</th>
                <th className="py-2.5 text-right">TY Share%</th>
                <th className="py-2.5 text-right font-mono">Value Shift (₹)</th>
                <th className="py-2.5 text-right">Tactical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {regionYoYDetails.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50/40">
                  <td className="py-3 font-semibold text-gray-900">{r.regionName}</td>
                  <td className="py-3 text-right text-gray-550 font-mono">{Math.round(r.p1Qty).toLocaleString()}</td>
                  <td className="py-3 text-right font-black text-gray-900 font-mono">{Math.round(r.p2Qty).toLocaleString()}</td>
                  <td className={`py-3 text-right font-semibold font-mono ${r.qtyDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.qtyDiff >= 0 ? "+" : ""}{Math.round(r.qtyDiff).toLocaleString()}
                  </td>
                  <td className={`py-3 text-right font-bold ${r.qtyDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.qtyDiff >= 0 ? "+" : ""}{r.qtyGrowth.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right text-gray-500 font-mono">{r.lyShare.toFixed(1)}%</td>
                  <td className="py-3 text-right font-bold text-gray-950 font-mono">{r.tyShare.toFixed(1)}%</td>
                  <td className={`py-3 text-right font-semibold font-mono ${r.valDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.valDiff >= 0 ? "+" : ""}₹{Math.round(r.valDiff).toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      r.status === "Expanding" 
                        ? "bg-green-50 text-green-700"
                        : r.status === "Contraction"
                        ? "bg-orange-50 text-orange-700"
                        : "bg-red-50 text-red-700"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
