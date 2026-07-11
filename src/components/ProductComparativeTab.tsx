import React, { useState, useMemo } from "react";
import { 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Ban, 
  Trophy 
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

interface ProductComparativeTabProps {
  productStats: any[];
  p1Records?: any[];
  p2Records?: any[];
}

export default function ProductComparativeTab({
  productStats,
  p1Records = [],
  p2Records = [],
}: ProductComparativeTabProps) {
  const [productSubView, setProductSubView] = useState<"all" | "top20qty" | "bottom20qty" | "topValue" | "nonBilling">("all");
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

  const toggleRow = (name: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Helper to discover dealers that registered a volume drop (qtyDiff < 0) for a given product category
  const getDealersWithLoss = (productCategoryName: string) => {
    // Filter records for this product category
    const p1ProdRecords = p1Records.filter(r => r.productCategory === productCategoryName);
    const p2ProdRecords = p2Records.filter(r => r.productCategory === productCategoryName);

    // Group by dealer
    const dealerMap: { [dealerName: string]: { p1Qty: number; p2Qty: number; p1Val: number; p2Val: number } } = {};

    p1ProdRecords.forEach(r => {
      const dName = r.customerName || "Standard Dealer";
      if (!dealerMap[dName]) {
        dealerMap[dName] = { p1Qty: 0, p2Qty: 0, p1Val: 0, p2Val: 0 };
      }
      dealerMap[dName].p1Qty += r.quantity || 0;
      dealerMap[dName].p1Val += r.netSalesValue || 0;
    });

    p2ProdRecords.forEach(r => {
      const dName = r.customerName || "Standard Dealer";
      if (!dealerMap[dName]) {
        dealerMap[dName] = { p1Qty: 0, p2Qty: 0, p1Val: 0, p2Val: 0 };
      }
      dealerMap[dName].p2Qty += r.quantity || 0;
      dealerMap[dName].p2Val += r.netSalesValue || 0;
    });

    // Compute drops and return dealers that dropped
    return Object.entries(dealerMap)
      .map(([dealerName, stats]) => {
        const qtyDiff = stats.p2Qty - stats.p1Qty;
        const valDiff = stats.p2Val - stats.p1Val;
        return {
          dealerName,
          p1Qty: stats.p1Qty,
          p2Qty: stats.p2Qty,
          qtyDiff,
          valDiff,
        };
      })
      .filter(d => d.qtyDiff < 0) // Only dealers with a volume loss
      .sort((a, b) => a.qtyDiff - b.qtyDiff); // Largest drop in volume first (most negative)
  };

  // Dynamic category ranking calculations (with ranks and differences)
  const sortedByLYProducts = useMemo(() => {
    return [...productStats].sort((a, b) => b.p1Qty - a.p1Qty);
  }, [productStats]);

  const sortedByTYProducts = useMemo(() => {
    return [...productStats].sort((a, b) => b.p2Qty - a.p2Qty);
  }, [productStats]);

  const scoredProductsList = useMemo(() => {
    return productStats.map(prod => {
      const lyRank = sortedByLYProducts.findIndex(p => p.name === prod.name) + 1;
      const tyRank = sortedByTYProducts.findIndex(p => p.name === prod.name) + 1;
      const rankDelta = lyRank - tyRank; // Positive means rank improved (e.g. was #4 now #2 -> +2)

      let status = "Declining";
      if (prod.p1Qty === 0 && prod.p2Qty > 0) status = "New Segment Launch";
      else if (prod.p2Qty === 0 && prod.p1Qty > 0) status = "Zero Billing";
      else if (prod.qtyGrowth > 10) status = "Rising Segment Star";
      else if (prod.qtyGrowth > 0) status = "Stable";
      else if (prod.qtyGrowth < -20) status = "Critical Decline";

      return {
        ...prod,
        lyRank,
        tyRank,
        rankDelta,
        status
      };
    });
  }, [productStats, sortedByLYProducts, sortedByTYProducts]);

  // Apply visual filter sub-views
  const filteredProducts = useMemo(() => {
    let result = [...scoredProductsList];

    if (productSubView === "all") {
      result = [...result].sort((a, b) => b.p2Qty - a.p2Qty);
    } else if (productSubView === "top20qty") {
      result = [...result].sort((a, b) => b.p2Qty - a.p2Qty).slice(0, 20);
    } else if (productSubView === "bottom20qty") {
      // Filter items that have at least some transaction history but are the lowest sellers (ascending order, lowest to highest)
      result = [...result].filter(p => p.p2Qty > 0).sort((a, b) => a.p2Qty - b.p2Qty).slice(0, 20);
    } else if (productSubView === "topValue") {
      result = [...result].sort((a, b) => b.p2Val - a.p2Val);
    } else if (productSubView === "nonBilling") {
      // Products invoiced in previous period (P1) but not invoiced in Current period (P2)
      const zeroInvoiced = [...scoredProductsList].filter(p => p.p1Qty > 0 && p.p2Qty === 0);
      
      if (zeroInvoiced.length > 0) {
        // Sort by maximum drop in volume (highest p1Qty first, because p2Qty is 0, so drop is exactly p1Qty)
        result = zeroInvoiced.sort((a, b) => b.p1Qty - a.p1Qty);
      } else {
        // If no products with p2Qty === 0 exist, show the products with the maximum drop in volume (qtyDiff < 0)
        // Sorted with biggest negative qtyDiff first
        result = [...scoredProductsList]
          .filter(p => p.qtyDiff < 0)
          .sort((a, b) => a.qtyDiff - b.qtyDiff);
      }
    }

    return result;
  }, [scoredProductsList, productSubView]);

  // Sliced products for view-more mechanism
  const visibleProducts = useMemo(() => {
    if (filteredProducts.length <= 20) return filteredProducts;
    return isExpanded ? filteredProducts : filteredProducts.slice(0, 20);
  }, [filteredProducts, isExpanded]);

  // Aggregate stats blocks
  const zeroBillingCount = useMemo(() => {
    return scoredProductsList.filter(p => p.p1Qty > 0 && p.p2Qty === 0).length;
  }, [scoredProductsList]);

  const newLaunchCount = useMemo(() => {
    return scoredProductsList.filter(p => p.p1Qty === 0 && p.p2Qty > 0).length;
  }, [scoredProductsList]);

  const decliningSlopCount = useMemo(() => {
    return scoredProductsList.filter(p => p.qtyDiff < 0).length;
  }, [scoredProductsList]);

  const isValueView = productSubView === "topValue";

  // Chart data: Top 10 categories
  const top10BarData = useMemo(() => {
    return [...filteredProducts]
      .slice(0, 10)
      .map(p => {
        if (isValueView) {
          return {
            name: p.name,
            "LY Value": Math.round(p.p1Val),
            "TY Value": Math.round(p.p2Val)
          };
        } else {
          return {
            name: p.name,
            "LY Qty": Math.round(p.p1Qty),
            "TY Qty": Math.round(p.p2Qty)
          };
        }
      });
  }, [filteredProducts, isValueView]);

  return (
    <div className="space-y-6" id="productComparativeWorkspace">
      
      {/* Tab filter control bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-3 gap-3">
        <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1 rounded-xl">
          {[
            { id: "all", label: "All Category Segments" },
            { id: "top20qty", label: "Top Segment Volume" },
            { id: "bottom20qty", label: "Bottom Segment Volume" },
            { id: "topValue", label: "Segment Value Standing" },
            { id: "nonBilling", label: "Non-Billing Segment Volume" },
          ].map(view => (
            <button
              key={view.id}
              onClick={() => {
                setProductSubView(view.id as any);
                setIsExpanded(false); // Reset expand on subview change
                setExpandedRows({}); // Reset expanded rows
              }}
              className={`px-3 py-1 text-xs rounded-lg cursor-pointer transition font-bold ${
                productSubView === view.id 
                  ? "bg-white text-green-700 shadow-2xs font-sans" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-white/20"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
 
        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
          Filter bounds: {filteredProducts.length} segments parsed
        </span>
      </div>

      {/* Top statistics banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-orange-50/50 border border-orange-105 p-4 rounded-xl text-left flex items-center justify-between sub-card-item">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-orange-600">Zero Volume Segments TY</span>
            <div className="text-lg font-black text-orange-950 mt-1">{zeroBillingCount} Segments</div>
            <span className="text-[9px] text-gray-500">Deactivated or unpurchased in current period</span>
          </div>
          <Ban className="w-5 h-5 text-orange-400" />
        </div>

        <div className="bg-green-50/50 border border-green-105 p-4 rounded-xl text-left flex items-center justify-between sub-card-item">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-green-700">New Category Segment Launches</span>
            <div className="text-lg font-black text-green-950 mt-1">{newLaunchCount} Launch Segments</div>
            <span className="text-[9px] text-gray-500">Active now with no baseline last year</span>
          </div>
          <Sparkles className="w-5 h-5 text-green-400" />
        </div>

        <div className="bg-red-50/50 border border-red-105 p-4 rounded-xl text-left flex items-center justify-between sub-card-item">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-700">Category Segments in Decline</span>
            <div className="text-lg font-black text-red-950 mt-1">{decliningSlopCount} Segments</div>
            <span className="text-[9px] text-gray-500">Category segments tracking lower volumes than baseline</span>
          </div>
          <ArrowDownRight className="w-5 h-5 text-red-400" />
        </div>

      </div>

      {/* Product Volume comparison chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4 shadow-sub">
        <div className="text-left">
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-widest">
            {productSubView === "nonBilling" 
              ? "Non-Billing & Volumetric Decline Product Segments" 
              : isValueView
              ? "Top Category Segments Comparative Value Standings"
              : productSubView === "bottom20qty"
              ? "Bottom Category Segments Comparative Volume Standings"
              : "Top Category Segments Comparative Volume Standings"}
          </h4>
          <p className="text-[10px] text-gray-450">
            {productSubView === "nonBilling"
              ? "Current volume outputs for missing or highest declining segments versus previous period"
              : isValueView
              ? "Current sales value outputs versus matching historical bounds"
              : "Current volume outputs versus matching historical bounds"}
          </p>
        </div>

        <div className="h-[200px] w-full text-xs">
          {top10BarData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10BarData} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={9} stroke="#94a3b8" tickLine={false} />
                <YAxis 
                  fontSize={9} 
                  stroke="#94a3b8" 
                  tickLine={false} 
                  tickFormatter={val => isValueView ? `₹${(val/1000).toFixed(0)}k` : `${val}`}
                />
                <Tooltip 
                  formatter={v => isValueView ? `₹${Number(v).toLocaleString()}` : `${Number(v).toLocaleString()} kg`}
                />
                {isValueView ? (
                  <>
                    <Bar name="LY Value (P1)" dataKey="LY Value" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                    <Bar name="TY Value (P2)" dataKey="TY Value" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  </>
                ) : (
                  <>
                    <Bar name="LY Qty (P1)" dataKey="LY Qty" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                    <Bar name="TY Qty (P2)" dataKey="TY Qty" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-450 italic text-xs">No chart records matches filters</div>
          )}
        </div>
      </div>

      {/* Complete descriptive table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-3.5 text-left table-card">
        <div>
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            {productSubView === "nonBilling" 
              ? "Non-Billing Segments & Value At Risk (P1 ➜ P2)" 
              : "Category Segment Comparative Standings"}
          </h4>
          <p className="text-[10px] text-gray-400">
            {productSubView === "nonBilling"
              ? "Products invoiced in primary period (P1) but missing entries currently (P2), or segments with largest absolute volumetric decline."
              : "Category segment listings with comparison boundaries, volume shift records, and financial indices."}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" id="productComparativeTable">
            <thead>
              {productSubView === "nonBilling" ? (
                <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                  <th className="py-2.5">Category Segment Name</th>
                  <th className="py-2.5 text-right font-mono">LY Qty (P1)</th>
                  <th className="py-2.5 text-right font-mono">TY Qty (P2)</th>
                  <th className="py-2.5 text-right text-red-650 font-bold">Qty Drop</th>
                  <th className="py-2.5 text-right font-mono">LY Value (P1)</th>
                  <th className="py-2.5 text-right font-mono">TY Value (P2)</th>
                  <th className="py-2.5 text-right text-red-650 font-bold">Value Drop</th>
                  <th className="py-2.5 text-center">Laggard Dealers</th>
                </tr>
              ) : (
                <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                  <th className="py-2.5">Category Segment Name</th>
                  <th className="py-2.5">Period 2 Rank</th>
                  <th className="py-2.5 text-right font-mono">LY Qty</th>
                  <th className="py-2.5 text-right font-mono">TY Qty</th>
                  <th className="py-2.5 text-right font-bold">Qty Diff</th>
                  <th className="py-2.5 text-right font-mono">LY Value</th>
                  <th className="py-2.5 text-right font-mono">TY Value</th>
                  <th className="py-2.5 text-right font-bold">Val Diff</th>
                  <th className="py-2.5 text-center">Rank Shift</th>
                  <th className="py-2.5 text-right font-bold">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-50">
              {productSubView === "nonBilling" ? (
                visibleProducts.map((p, idx) => (
                  <React.Fragment key={p.name}>
                    <tr className="hover:bg-gray-50/40 align-middle">
                      <td className="py-3 font-bold text-gray-900 max-w-[280px] whitespace-normal leading-relaxed">
                        {p.name}
                      </td>
                      <td className="py-3 text-right text-gray-500 font-mono">
                        {Math.round(p.p1Qty).toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-bold text-gray-800 font-mono">
                        {Math.round(p.p2Qty).toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-bold text-red-650 font-mono">
                        -{Math.round(Math.abs(p.qtyDiff)).toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-gray-500 font-mono">
                        ₹{Math.round(p.p1Val).toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-bold text-gray-800 font-mono">
                        ₹{Math.round(p.p2Val).toLocaleString()}
                      </td>
                      <td className={`py-3 text-right font-bold font-mono ${p.valDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {p.valDiff >= 0 ? "+" : "-"}₹{Math.round(Math.abs(p.valDiff)).toLocaleString()}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => toggleRow(p.name)}
                          className="px-2.5 py-1 text-[10px] font-semibold text-red-750 bg-red-50 hover:bg-red-100 border border-red-200/50 rounded-lg cursor-pointer transition flex items-center gap-1 mx-auto"
                        >
                          <span>{expandedRows[p.name] ? "Hide Dealers" : "View Dealers"}</span>
                          <span className="bg-red-200/60 text-red-800 text-[8px] font-bold px-1 rounded-full font-mono">
                            {getDealersWithLoss(p.name).length}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {expandedRows[p.name] && (
                      <tr>
                        <td colSpan={8} className="bg-gray-50/70 p-4 font-sans rounded-xl border-t border-gray-100">
                          <div className="space-y-2">
                            <h5 className="text-[11px] font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                              Dealer-level Volumetric Decline Analytics ({p.name})
                            </h5>
                            {getDealersWithLoss(p.name).length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {getDealersWithLoss(p.name).map((d, dIdx) => (
                                  <div key={dIdx} className="bg-white border border-gray-150 p-2.5 rounded-xl shadow-4xs text-left">
                                    <div className="font-semibold text-gray-800 text-[11px] truncate" title={d.dealerName}>
                                      {d.dealerName}
                                    </div>
                                    <div className="mt-1 space-y-0.5 text-[10px] font-mono text-gray-500">
                                      <div className="flex justify-between">
                                        <span>Prev Vol (P1):</span>
                                        <span className="font-bold text-gray-700">{Math.round(d.p1Qty).toLocaleString()} Kg/L</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Curr Vol (P2):</span>
                                        <span className="font-bold text-gray-700">{Math.round(d.p2Qty).toLocaleString()} Kg/L</span>
                                      </div>
                                      <div className="flex justify-between border-t border-gray-100 pt-0.5 mt-0.5 text-[10px]">
                                        <span className="text-red-500 font-bold">Vol Loss:</span>
                                        <span className="text-red-600 font-bold">-{Math.round(Math.abs(d.qtyDiff)).toLocaleString()} Kg/L</span>
                                      </div>
                                      <div className="flex justify-between text-[10px]">
                                        <span className="text-red-500 font-bold">Val Loss:</span>
                                        <span className="text-red-600 font-bold">-₹{Math.round(Math.abs(d.valDiff)).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-450 italic pl-3">No dealers registered a drop in volume for this segment in this period.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                visibleProducts.map((p, idx) => (
                  <React.Fragment key={p.name}>
                    <tr className="hover:bg-gray-50/40 align-middle">
                      <td className="py-2.5 font-bold text-gray-900 max-w-[280px] whitespace-normal leading-relaxed">
                        {p.name}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-750 text-[9px] font-black rounded-md font-mono">
                          Rank #{p.tyRank}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-gray-500 font-mono">
                        {Math.round(p.p1Qty).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-bold text-gray-800 font-mono">
                        {Math.round(p.p2Qty).toLocaleString()}
                      </td>
                      <td className={`py-2.5 text-right font-bold font-mono ${p.qtyDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {p.qtyDiff >= 0 ? "+" : ""}{Math.round(p.qtyDiff).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-gray-500 font-mono">
                        ₹{Math.round(p.p1Val).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-bold text-gray-800 font-mono font-mono">
                        ₹{Math.round(p.p2Val).toLocaleString()}
                      </td>
                      <td className={`py-2.5 text-right font-bold font-mono ${p.valDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {p.valDiff >= 0 ? "+" : ""}{Math.round(p.valDiff).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[10px] text-gray-450 font-medium">#{p.lyRank} ➜ #{p.tyRank}</span>
                          {p.rankDelta > 0 ? (
                            <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1 rounded">▲+{p.rankDelta}</span>
                          ) : p.rankDelta < 0 ? (
                            <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1 rounded">▼{p.rankDelta}</span>
                          ) : (
                            <span className="text-[9px] text-gray-400 font-bold bg-gray-100 px-1 rounded">=</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                          p.status.includes("Star") || p.status.includes("Launch") || p.status.includes("Rising")
                            ? "bg-green-50 text-green-700 border border-green-150"
                            : p.status.includes("Stable")
                            ? "bg-slate-50 text-slate-700"
                            : "bg-red-50 text-red-700"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Expand/Collapse pagination button */}
        {filteredProducts.length > 20 && (
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
                  <span>View More ({filteredProducts.length - 20} hidden)</span>
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
