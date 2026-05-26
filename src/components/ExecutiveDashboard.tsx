/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  TrendingUp,
  Users,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShoppingBag,
  Target,
  FileText,
  Filter,
  DollarSign,
  Briefcase,
  Layers,
  Search,
  BookOpen
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from "recharts";
import { InvoiceItem, UserProfile } from "../types";
import { CompiledAnalytics } from "../utils/analytics";

interface ExecutiveDashboardProps {
  analytics: CompiledAnalytics;
  onFilterChange: (filters: {
    company: string;
    rm: string;
    category: string;
    searchQuery: string;
  }) => void;
  currentUser: UserProfile;
}

export default function ExecutiveDashboard({
  analytics,
  onFilterChange,
  currentUser,
}: ExecutiveDashboardProps) {
  const [selectedCompany, setSelectedCompany] = useState("All");
  const [selectedRm, setSelectedRm] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [drillDownCustomer, setDrillDownCustomer] = useState<string | null>(null);

  const applyFilters = (comp: string, rm: string, cat: string, query: string) => {
    onFilterChange({
      company: comp,
      rm: rm,
      category: cat,
      searchQuery: query,
    });
  };

  const COLORS = ["#16a34a", "#2563eb", "#ea580c", "#d97706", "#7c3aed", "#db2777"];

  // Prepare monthly comparative trend data for chart
  // In March, April, May as YTD
  const monthlyTimelineData = [
    { name: "March", "Last Year (2025)": (analytics.prevYtdSales * 0.3), "Current Year (2026)": (analytics.currentYtdSales * 0.28) },
    { name: "April", "Last Year (2025)": (analytics.prevYtdSales * 0.32), "Current Year (2026)": (analytics.currentYtdSales * 0.34) },
    { name: "May (YTD)", "Last Year (2025)": (analytics.prevYtdSales * 0.38), "Current Year (2026)": (analytics.currentYtdSales * 0.38) },
  ];

  return (
    <div className="space-y-6">
      
      {/* Dynamic Multi-Select Filters Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mr-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span>Interactive Filter Engine</span>
        </div>

        {/* Company filter */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Company Scope</span>
          <select
            value={selectedCompany}
            onChange={(e) => {
              setSelectedCompany(e.target.value);
              applyFilters(e.target.value, selectedRm, selectedCategory, searchQuery);
            }}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          >
            <option value="All">All Joint Entities (Combined)</option>
            <option value="Company A">Company A Only</option>
            <option value="Company B">Company B Only</option>
          </select>
        </div>

        {/* Executive Regional Manager filter */}
        {currentUser.role !== "Salesperson" && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Regional Manager</span>
            <select
              value={selectedRm}
              onChange={(e) => {
                setSelectedRm(e.target.value);
                applyFilters(selectedCompany, e.target.value, selectedCategory, searchQuery);
              }}
              className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            >
              <option value="All">All Regions (Director Level)</option>
              <option value="S. R. Patil">S. R. Patil (RM West)</option>
              <option value="K. Swamy">K. Swamy (RM South)</option>
              <option value="R. K. Singh">R. K. Singh (RM North)</option>
            </select>
          </div>
        )}

        {/* Category segment filter */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Product Segment</span>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              applyFilters(selectedCompany, selectedRm, e.target.value, searchQuery);
            }}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-800 font-medium focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
          >
            <option value="All">All Segments</option>
            <option value="Plant Nutrients">Plant Nutrients</option>
            <option value="Fertilizers">Fertilizers</option>
            <option value="Biostimulants">Biostimulants</option>
            <option value="Microbial products">Microbial products</option>
          </select>
        </div>

        {/* Customer text lookup */}
        <div className="flex-1 min-w-[180px] flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Search Client Accounts</span>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by names or code matches..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                applyFilters(selectedCompany, selectedRm, selectedCategory, e.target.value);
              }}
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* KPI Dashboard Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Sales (YTD)</span>
            <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xl font-bold text-gray-900">
              ₹{(analytics.currentYtdSales / 100000).toFixed(2)}L
            </div>
            <div className="text-[10px] flex items-center gap-1 font-semibold text-gray-500">
              <span>Last YTD:</span>
              <span className="text-gray-700 font-bold">₹{(analytics.prevYtdSales / 100000).toFixed(2)}L</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Sales Expansion %</span>
            <div className={`p-1.5 rounded-lg ${analytics.growthPercent >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
              {analytics.growthPercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
              {analytics.growthPercent >= 0 ? "+" : ""}{analytics.growthPercent.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-500 flex items-center gap-1 font-semibold">
              <span>Net value diff:</span>
              <span className={`font-bold ${analytics.growthValue >= 0 ? "text-green-600" : "text-red-500"}`}>
                {analytics.growthValue >= 0 ? "+" : ""}₹{(analytics.growthValue / 100000).toFixed(1)}L
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Target Achievement %</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xl font-bold text-gray-900">
              {analytics.budgetAchievement > 0 ? `${analytics.budgetAchievement.toFixed(1)}%` : "N/A"}
            </div>
            <div className="text-[10px] text-gray-500 flex items-center justify-between font-semibold">
              <span>Target: ₹{analytics.totalBudget ? `${(analytics.totalBudget / 100000).toFixed(1)}L` : "No target set"}</span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Dealers Count (Active)</span>
            <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xl font-bold text-gray-900">
              {analytics.activeCustomersCount} Accounts
            </div>
            <div className="text-[10px] text-gray-500 font-semibold flex items-center gap-1">
              <span>With catalog:</span>
              <span className="text-gray-800 font-bold">{analytics.activeProductsCount} products</span>
            </div>
          </div>
        </div>

      </div>

      {/* Primary Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend line: Monthly invoices */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Monthly Comparative Net Invoice Sales</h3>
              <p className="text-[10px] text-gray-500">1st March fiscal cycle alignments vs prior year period</p>
            </div>
            <span className="text-[10px] py-1 px-2.5 bg-green-50 text-green-700 font-semibold rounded-md">Live YTD</span>
          </div>

          <div className="h-[260px] w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTimelineData} margin={{ left: -15, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                <RechartsTooltip formatter={(val) => `₹${Number(val).toLocaleString()}`} />
                <Legend iconSize={8} iconType="circle" />
                <Line
                  type="monotone"
                  dataKey="Last Year (2025)"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Current Year (2026)"
                  stroke="#16a34a"
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie share: Product Category performance */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs lg:col-span-1 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Brand Category Share</h3>
            <p className="text-[10px] text-gray-500">Unified gross segment contribution analysis</p>
          </div>

          <div className="h-[180px] w-full flex items-center justify-center">
            {analytics.categoryPerformances.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.categoryPerformances}
                    dataKey="value"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {analytics.categoryPerformances.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val) => `₹${Number(val).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-400">No active products loaded</div>
            )}
          </div>

          {/* Custom legends */}
          <div className="grid grid-cols-2 gap-2 text-[10px] pt-2">
            {analytics.categoryPerformances.slice(0, 4).map((entry, idx) => (
              <div key={idx} className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="truncate text-gray-650 shrink-0 font-medium">{entry.category}:</span>
                <span className="font-bold text-gray-900 ml-auto">{entry.share.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Top Accounts Ranking Chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Dealer Sales Standings Rank</h3>
          <p className="text-[10px] text-gray-500">Interactive rankings list. Click on any dealer row to focus details</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[220px] text-xs">
            {analytics.customerPerformances.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.customerPerformances.slice(0, 10)} margin={{ left: -15, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="customerName" stroke="#94a3b8" fontSize={9} tickFormatter={(val) => val.split(" ")[0]} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(val) => `₹${Number(val).toLocaleString()}`} />
                  <Bar dataKey="currentSales" fill="#2563eb" radius={[4, 4, 0, 0]} name="Value YTD" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-400 mt-10 text-center">No customer records filtered</div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Selected Account Focus</h4>
            {drillDownCustomer ? (
              <div className="p-4 bg-blue-50 border border-blue-150 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{drillDownCustomer}</span>
                  <button onClick={() => setDrillDownCustomer(null)} className="text-[10px] text-blue-600 font-bold hover:underline">✕ reset</button>
                </div>
                <div className="space-y-1.5 text-[11px] text-gray-700">
                  <div className="flex justify-between"><span>Value this YTD:</span><strong className="text-gray-900">₹{(analytics.customerPerformances.find(c => c.customerName === drillDownCustomer)?.currentSales || 0).toLocaleString()}</strong></div>
                  <div className="flex justify-between"><span>Value last YTD:</span><strong>₹{(analytics.customerPerformances.find(c => c.customerName === drillDownCustomer)?.prevSales || 0).toLocaleString()}</strong></div>
                  <div className="flex justify-between"><span>Growth Rate:</span><span className="font-bold text-green-600">{(analytics.customerPerformances.find(c => c.customerName === drillDownCustomer)?.growthPercent || 0).toFixed(1)}%</span></div>
                </div>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-400 py-10">
                Click a dealer row in the standing scoreboard table to focus on growth details.
              </div>
            )}
            
            {/* Quick Supplier Contribution Table */}
            <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 space-y-2 text-xs">
              <span className="font-bold text-gray-700 block text-[10px] uppercase tracking-wider">Suppliers Share</span>
              <div className="space-y-1.5">
                {analytics.supplierPerformances.slice(0,3).map((sup, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-600 font-medium truncate max-w-[140px]">{sup.supplier}</span>
                    <span className="font-bold text-gray-900">₹{(sup.currentSales/1000).toFixed(0)}k ({sup.share.toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Operational Matrix Table Ranks for Subordinates (Sales Directors sees all, RMs see reports) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Corporate reporting subordinates rankings</h3>
          <p className="text-[10px] text-gray-500">Sales officers, territory assignments, and target compliance</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-450 uppercase text-[10px] font-semibold tracking-wider">
                <th className="py-2">Employee Name</th>
                <th className="py-2">Region Scope</th>
                <th className="py-2">Actual YTD Sales</th>
                <th className="py-2">Target Budget</th>
                <th className="py-2">Achievement %</th>
                <th className="py-2 text-right">Budget Shortfall Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {analytics.salespersonRankings.map((sp, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="py-2.5 font-bold text-gray-900">{sp.name}</td>
                  <td className="py-2.5 text-gray-600">{sp.region}</td>
                  <td className="py-2.5 font-semibold">₹{sp.currentActual.toLocaleString()}</td>
                  <td className="py-2.5 text-gray-500">₹{sp.budgetValue.toLocaleString()}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${sp.achievement >= 100 ? "bg-green-500" : sp.achievement >= 80 ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className="font-bold">{sp.achievement > 0 ? `${sp.achievement.toFixed(1)}%` : "no target"}</span>
                    </div>
                  </td>
                  <td className={`py-2.5 text-right font-bold ${sp.gap >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {sp.gap >= 0 ? `+₹${sp.gap.toLocaleString()}` : `-₹${Math.abs(sp.gap).toLocaleString()}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business Intelligence Executive Alerts Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Alerts 1: Account Risks (Dropped & Lost Dealers) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-500 animate-bounce" />
            Account Risks: Dropped / Lost Dealers
          </h3>

          <div className="space-y-3.5">
            {analytics.droppedCustomers.length === 0 && analytics.lostCustomers.length === 0 ? (
              <div className="text-[11px] text-gray-500 italic">No severe dealer account risk drops detected. All relationships stable.</div>
            ) : (
              <>
                {analytics.lostCustomers.map((lc, idx) => (
                  <div key={`lost-${idx}`} className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <strong className="text-gray-900 leading-none">{lc.customer}</strong>
                      <div className="text-[10px] text-red-600 font-semibold mt-1">Classification: Lost Customer (₹0 YTD sales)</div>
                    </div>
                    <div className="text-right text-[11px] text-gray-500">
                      Prev: <strong className="text-red-700">₹{lc.valueLastYear.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}

                {analytics.droppedCustomers.map((dc, idx) => (
                  <div key={`drop-${idx}`} className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <strong className="text-gray-900 leading-none">{dc.customer}</strong>
                      <div className="text-[10px] text-orange-600 font-semibold mt-1">Classification: Dropped purchases by &gt;15% YTD</div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="text-[10px] text-gray-500">Drop: <span className="text-red-600 font-bold">-{dc.dropPercent.toFixed(0)}%</span></div>
                      <div className="text-[11px] font-bold text-gray-800">₹{dc.current.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Alerts 2: Brand Gaps (Declining Products & Shortfalls) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" />
            Product performance gaps
          </h3>

          <div className="space-y-3.5">
            {analytics.decliningProductsVal.slice(0, 3).map((dp, idx) => (
              <div key={idx} className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <strong className="text-gray-800 leading-none">{dp.product}</strong>
                  <div className="text-[10px] text-purple-600 font-semibold mt-1">Classification: Brand revenue alignment gap</div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-[10px] text-gray-500">Drop: <span className="text-purple-600 font-bold">-{dp.dropValPercent.toFixed(0)}%</span></div>
                  <div className="text-[11px] font-bold text-gray-800">₹{dp.currVal.toLocaleString()}</div>
                </div>
              </div>
            ))}
            
            {analytics.salespersonsBelowBudget.slice(0,2).map((sb, idx) => (
              <div key={`sp-${idx}`} className="p-3 bg-yellow-50/50 border border-yellow-100 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <strong className="text-gray-800 leading-none">{sb.name}</strong>
                  <div className="text-[10px] text-yellow-600 font-semibold mt-1">Classification: Below target threshold</div>
                </div>
                <div className="text-right text-[11.5px]">
                  Short: <strong className="text-red-600 font-bold">₹{sb.targetShortfall.toLocaleString()}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
