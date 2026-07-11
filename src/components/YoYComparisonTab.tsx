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

    </div>
  );
}
