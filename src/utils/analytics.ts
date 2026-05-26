/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InvoiceItem, BudgetItem, UserProfile } from "../types";

// Helper to determine if a date falls in a given YTD range (1 March to same day of year)
// Current YTD corresponds to 1 March 2026 -> 26 May 2026
// Previous YTD corresponds to 1 March 2025 -> 26 May 2025
// But we generalize this helper to accept any invoiceDate and compare it within the respective financial years.
export function isDateInYTDPeriod(dateStr: string, year: 2025 | 2026, upToMonth: number = 4, upToDay: number = 26): boolean {
  const d = new Date(dateStr);
  const start = new Date(year, 2, 1); // 1st March (Months are 0-indexed, so 2 = March)
  const end = new Date(year, upToMonth, upToDay, 23, 59, 59); // Limit to May 26 of that year
  
  return d >= start && d <= end;
}

// Check if a date falls in the full fiscal year (1 Mar to 28 Feb)
export function isDateInFiscalYear(dateStr: string, startYear: number): boolean {
  const d = new Date(dateStr);
  const start = new Date(startYear, 2, 1); // 1 Mar
  const end = new Date(startYear + 1, 1, 28, 23, 59, 59); // 28 Feb
  return d >= start && d <= end;
}

// Scopes invoices based on the user's role and hierarchy
export function filterDataByRole(
  invoices: InvoiceItem[],
  user: UserProfile
): InvoiceItem[] {
  if (!user) return invoices;
  if (user.role === "Sales Director" || user.role === "Admin") {
    return invoices; // Full access
  }
  if (user.role === "Regional Manager") {
    // Only see data for their supervised region (matched by region name or supervisor field)
    return invoices.filter(
      (inv) =>
        inv.region.toLowerCase() === user.region?.toLowerCase() ||
        inv.regionalManager.toLowerCase() === user.name.toLowerCase()
    );
  }
  if (user.role === "Salesperson") {
    // Only see their own salesperson code or salesperson name
    return invoices.filter(
      (inv) =>
        inv.salesperson.toLowerCase() === user.name.toLowerCase() ||
        inv.territory.toLowerCase() === user.territory?.toLowerCase()
    );
  }
  return [];
}

// Scopes budgets based on role/hierarchy
export function filterBudgetsByRole(
  budgets: BudgetItem[],
  user: UserProfile
): BudgetItem[] {
  if (!user) return budgets;
  if (user.role === "Sales Director" || user.role === "Admin") {
    return budgets;
  }
  if (user.role === "Regional Manager") {
    // Match salespeople in their region
    // In our seed setup, SPs report to RMs
    const rmSalespeople = ["V. R. Sharma", "A. P. Kulkarni", "M. N. Rao", "S. Gopal", "Amit Verma", "Sanjay Dutta"];
    // For West RM (S. R. Patil), subordinate names are "V. R. Sharma" and "A. P. Kulkarni"
    let subNames: string[] = [];
    if (user.region === "West") subNames = ["V. R. Sharma", "A. P. Kulkarni"];
    else if (user.region === "South") subNames = ["M. N. Rao", "S. Gopal"];
    else if (user.region === "North") subNames = ["Amit Verma", "Sanjay Dutta"];
    
    return budgets.filter((b) => subNames.includes(b.salesperson));
  }
  if (user.role === "Salesperson") {
    return budgets.filter(
      (b) => b.salesperson.toLowerCase() === user.name.toLowerCase()
    );
  }
  return [];
}

// Core Calculations Object
export interface CompiledAnalytics {
  currentYtdSales: number;
  prevYtdSales: number;
  growthValue: number;
  growthPercent: number;
  
  currentYtdQty: number;
  prevYtdQty: number;
  qtyGrowthPercent: number;

  totalBudget: number;
  budgetAchievement: number;

  activeCustomersCount: number;
  activeProductsCount: number;

  regionPerformances: { region: string; currentSales: number; prevSales: number; growthPercent: number }[];
  categoryPerformances: { category: string; value: number; share: number }[];
  customerPerformances: { customerName: string; currentSales: number; prevSales: number; growthPercent: number; change: number }[];
  supplierPerformances: { supplier: string; currentSales: number; prevSales: number; growthPercent: number; share: number }[];
  salespersonRankings: { name: string; region: string; currentActual: number; budgetValue: number; gap: number; achievement: number }[];
  
  // Mandatory Alerts lists
  droppedCustomers: { customer: string; prev: number; current: number; dropPercent: number }[];
  decliningProductsQty: { product: string; prevQty: number; currQty: number; dropQtyPercent: number }[];
  decliningProductsVal: { product: string; prevVal: number; currVal: number; dropValPercent: number }[];
  newCustomers: { customer: string; value: number }[];
  lostCustomers: { customer: string; valueLastYear: number }[];
  fastGrowingProducts: { product: string; growthPercent: number; value: number }[];
  slowMovingProducts: { product: string; qty: number; value: number }[];
  underperformingVsPrevYear: { product: string; prevVal: number; currVal: number; diff: number }[];
  weakRegions: { region: string; growth: number }[];
  decliningSuppliers: { supplier: string; prev: number; current: number; diff: number }[];
  salespersonsBelowBudget: { name: string; budget: number; actual: number; targetShortfall: number }[];
}

export function compileAnalytics(
  invoices: InvoiceItem[],
  budgets: BudgetItem[],
  user: UserProfile,
  upToMonth = 4, // May
  upToDay = 26
): CompiledAnalytics {
  // 1. Role Scoping
  const scopedInvoices = filterDataByRole(invoices, user);
  const scopedBudgets = filterBudgetsByRole(budgets, user);

  // 2. Separate into Current YTD and Previous YTD lines
  const currentInvoices = scopedInvoices.filter((inv) =>
    isDateInYTDPeriod(inv.invoiceDate, 2026, upToMonth, upToDay)
  );
  const prevInvoices = scopedInvoices.filter((inv) =>
    isDateInYTDPeriod(inv.invoiceDate, 2025, upToMonth, upToDay)
  );

  // Total sales
  const currentYtdSales = currentInvoices.reduce((sum, item) => sum + item.netSalesValue, 0);
  const prevYtdSales = prevInvoices.reduce((sum, item) => sum + item.netSalesValue, 0);
  const growthValue = currentYtdSales - prevYtdSales;
  const growthPercent = prevYtdSales > 0 ? (growthValue / prevYtdSales) * 100 : 0;

  // Quantity totals
  const currentYtdQty = currentInvoices.reduce((sum, item) => sum + item.quantity, 0);
  const prevYtdQty = prevInvoices.reduce((sum, item) => sum + item.quantity, 0);
  const qtyGrowthPercent = prevYtdQty > 0 ? ((currentYtdQty - prevYtdQty) / prevYtdQty) * 100 : 0;

  // Total budgets value for current YTD (we assume our loaded budgets are for YTD or handle month scaling)
  const totalBudget = scopedBudgets.reduce((sum, b) => sum + b.budgetValue, 0);
  const budgetAchievement = totalBudget > 0 ? (currentYtdSales / totalBudget) * 100 : 0;

  // Distinct count
  const activeCustomers = new Set(currentInvoices.map((i) => i.customerCode));
  const activeCustomersCount = activeCustomers.size;
  const activeProducts = new Set(currentInvoices.map((i) => i.productName));
  const activeProductsCount = activeProducts.size;

  // --- Aggregations ---

  // 1. Region Performances
  const regionsMap = new Map<string, { current: number; prev: number }>();
  const allRegions = Array.from(new Set(scopedInvoices.map((i) => i.region)));
  allRegions.forEach((r) => regionsMap.set(r, { current: 0, prev: 0 }));

  currentInvoices.forEach((inv) => {
    const entry = regionsMap.get(inv.region) || { current: 0, prev: 0 };
    entry.current += inv.netSalesValue;
    regionsMap.set(inv.region, entry);
  });
  prevInvoices.forEach((inv) => {
    const entry = regionsMap.get(inv.region) || { current: 0, prev: 0 };
    entry.prev += inv.netSalesValue;
    regionsMap.set(inv.region, entry);
  });

  const regionPerformances = Array.from(regionsMap.entries()).map(([region, value]) => {
    const diff = value.current - value.prev;
    return {
      region,
      currentSales: value.current,
      prevSales: value.prev,
      growthPercent: value.prev > 0 ? (diff / value.prev) * 100 : 0,
    };
  }).sort((a, b) => b.currentSales - a.currentSales);

  // 2. Category Performance (Pie chart / Share)
  const categoryMap = new Map<string, number>();
  currentInvoices.forEach((inv) => {
    const val = categoryMap.get(inv.productCategory) || 0;
    categoryMap.set(inv.productCategory, val + inv.netSalesValue);
  });
  const totalCatVal = Array.from(categoryMap.values()).reduce((sum, v) => sum + v, 0);
  const categoryPerformances = Array.from(categoryMap.entries()).map(([category, value]) => ({
    category,
    value,
    share: totalCatVal > 0 ? (value / totalCatVal) * 100 : 0,
  })).sort((a, b) => b.value - a.value);

  // 3. Customer Performance (Waterfall / Table)
  const customerMap = new Map<string, { current: number; prev: number }>();
  // We use customer name for representation simplicity, standardizing keys
  scopedInvoices.forEach((i) => {
    if (!customerMap.has(i.customerName)) {
      customerMap.set(i.customerName, { current: 0, prev: 0 });
    }
  });
  currentInvoices.forEach((inv) => {
    const entry = customerMap.get(inv.customerName)!;
    entry.current += inv.netSalesValue;
  });
  prevInvoices.forEach((inv) => {
    const entry = customerMap.get(inv.customerName)!;
    entry.prev += inv.netSalesValue;
  });

  const customerPerformances = Array.from(customerMap.entries())
    .map(([customerName, value]) => {
      const change = value.current - value.prev;
      return {
        customerName,
        currentSales: value.current,
        prevSales: value.prev,
        growthPercent: value.prev > 0 ? (change / value.prev) * 100 : 0,
        change,
      };
    })
    .filter((c) => c.currentSales > 0 || c.prevSales > 0)
    .sort((a, b) => b.currentSales - a.currentSales);

  // 4. Supplier Performance
  const supplierMap = new Map<string, { current: number; prev: number }>();
  scopedInvoices.forEach((i) => {
    if (!supplierMap.has(i.supplier)) {
      supplierMap.set(i.supplier, { current: 0, prev: 0 });
    }
  });
  currentInvoices.forEach((inv) => {
    const entry = supplierMap.get(inv.supplier)!;
    entry.current += inv.netSalesValue;
  });
  prevInvoices.forEach((inv) => {
    const entry = supplierMap.get(inv.supplier)!;
    entry.prev += inv.netSalesValue;
  });
  const totalSupplierSales = Array.from(supplierMap.values()).reduce((sum, entry) => sum + entry.current, 0);
  const supplierPerformances = Array.from(supplierMap.entries()).map(([supplier, val]) => {
    const diff = val.current - val.prev;
    return {
      supplier,
      currentSales: val.current,
      prevSales: val.prev,
      growthPercent: val.prev > 0 ? (diff / val.prev) * 100 : 0,
      share: totalSupplierSales > 0 ? (val.current / totalSupplierSales) * 100 : 0,
    };
  }).sort((a, b) => b.currentSales - a.currentSales);

  // 5. Salesperson Rankings / Budgets
  const salespersonMap = new Map<string, { name: string; region: string; actual: number; budget: number }>();
  // Pre-seed known salespeople under current user scope
  const activeSps = Array.from(new Set(scopedInvoices.map((i) => i.salesperson)));
  activeSps.forEach((spName) => {
    const invSample = scopedInvoices.find((i) => i.salesperson === spName);
    salespersonMap.set(spName, {
      name: spName,
      region: invSample?.region || "Unknown",
      actual: 0,
      budget: 0,
    });
  });

  currentInvoices.forEach((inv) => {
    const sp = salespersonMap.get(inv.salesperson) || { name: inv.salesperson, region: inv.region, actual: 0, budget: 0 };
    sp.actual += inv.netSalesValue;
    salespersonMap.set(inv.salesperson, sp);
  });
  scopedBudgets.forEach((bud) => {
    const sp = salespersonMap.get(bud.salesperson) || { name: bud.salesperson, region: "Unknown", actual: 0, budget: 0 };
    sp.budget += bud.budgetValue;
    salespersonMap.set(bud.salesperson, sp);
  });

  const salespersonRankings = Array.from(salespersonMap.values()).map((sp) => {
    const gap = sp.actual - sp.budget;
    return {
      name: sp.name,
      region: sp.region,
      currentActual: sp.actual,
      budgetValue: sp.budget,
      gap,
      achievement: sp.budget > 0 ? (sp.actual / sp.budget) * 100 : 0,
    };
  }).sort((a, b) => b.currentActual - a.currentActual);


  // --- Mandatory Insights Logic (Business Intelligence Alerts) ---

  // 1. Customers whose business dropped (purchases dropped by > 15% this year compared to last year)
  const droppedCustomers = customerPerformances
    .filter((c) => c.prevSales > 10000 && c.change < 0 && (c.change / c.prevSales) <= -0.15)
    .map((c) => ({
      customer: c.customerName,
      prev: c.prevSales,
      current: c.currentSales,
      dropPercent: (Math.abs(c.change) / c.prevSales) * 100,
    }));

  // 2-3. Products declining in quantity or value
  const productQuantities = new Map<string, { prevQty: number; currQty: number; prevVal: number; currVal: number }>();
  scopedInvoices.forEach((i) => {
    if (!productQuantities.has(i.productName)) {
      productQuantities.set(i.productName, { prevQty: 0, currQty: 0, prevVal: 0, currVal: 0 });
    }
  });
  currentInvoices.forEach((inv) => {
    const row = productQuantities.get(inv.productName)!;
    row.currQty += inv.quantity;
    row.currVal += inv.netSalesValue;
  });
  prevInvoices.forEach((inv) => {
    const row = productQuantities.get(inv.productName)!;
    row.prevQty += inv.quantity;
    row.prevVal += inv.netSalesValue;
  });

  const decliningProductsQty: { product: string; prevQty: number; currQty: number; dropQtyPercent: number }[] = [];
  const decliningProductsVal: { product: string; prevVal: number; currVal: number; dropValPercent: number }[] = [];
  const underperformingVsPrevYear: { product: string; prevVal: number; currVal: number; diff: number }[] = [];
  const fastGrowingProducts: { product: string; growthPercent: number; value: number }[] = [];
  const slowMovingProducts: { product: string; qty: number; value: number }[] = [];

  productQuantities.forEach((v, productName) => {
    // Declining Qty
    if (v.prevQty > 0 && v.currQty < v.prevQty) {
      decliningProductsQty.push({
        product: productName,
        prevQty: v.prevQty,
        currQty: v.currQty,
        dropQtyPercent: ((v.prevQty - v.currQty) / v.prevQty) * 100,
      });
    }
    // Declining Value
    if (v.prevVal > 0 && v.currVal < v.prevVal) {
      decliningProductsVal.push({
        product: productName,
        prevVal: v.prevVal,
        currVal: v.currVal,
        dropValPercent: ((v.prevVal - v.currVal) / v.prevVal) * 100,
      });
    }
    // Underperforming (Val decline of any kind)
    if (v.currVal < v.prevVal) {
      underperformingVsPrevYear.push({
        product: productName,
        prevVal: v.prevVal,
        currVal: v.currVal,
        diff: v.prevVal - v.currVal,
      });
    }
    // Fast Growing
    if (v.prevVal > 5000 && v.currVal > v.prevVal) {
      const pct = ((v.currVal - v.prevVal) / v.prevVal) * 100;
      if (pct > 15) {
        fastGrowingProducts.push({
          product: productName,
          growthPercent: pct,
          value: v.currVal,
        });
      }
    }
    // Slow Moving (Low total qty and low value this year relative to overall metrics)
    if (v.currQty > 0 && v.currQty < 300 && v.currVal < 100000) {
      slowMovingProducts.push({
        product: productName,
        qty: v.currQty,
        value: v.currVal,
      });
    }
  });

  // Sort declining/fast-growing lists
  decliningProductsQty.sort((a,b) => b.dropQtyPercent - a.dropQtyPercent);
  decliningProductsVal.sort((a,b) => b.dropValPercent - a.dropValPercent);
  underperformingVsPrevYear.sort((a,b) => b.diff - a.diff);
  fastGrowingProducts.sort((a,b) => b.growthPercent - a.growthPercent);

  // 4. Weak regions (growth % < 5%)
  const weakRegions = regionPerformances
    .filter((rp) => rp.growthPercent < 5)
    .map((rp) => ({
      region: rp.region,
      growth: rp.growthPercent,
    }));

  // 5. Suppliers with declining contribution
  const decliningSuppliers = supplierPerformances
    .filter((sp) => sp.growthPercent < 0)
    .map((sp) => ({
      supplier: sp.supplier,
      prev: sp.prevSales,
      current: sp.currentSales,
      diff: sp.prevSales - sp.currentSales,
    }));

  // 6. Salesperson below budget
  const salespersonsBelowBudget = salespersonRankings
    .filter((sp) => sp.budgetValue > 0 && sp.gap < 0)
    .map((sp) => ({
      name: sp.name,
      budget: sp.budgetValue,
      actual: sp.currentActual,
      targetShortfall: Math.abs(sp.gap),
    })).sort((a,b) => b.targetShortfall - a.targetShortfall);

  // 7. New Customers (bought this year but 0 last year)
  const newCustomers = customerPerformances
    .filter((c) => c.currentSales > 0 && c.prevSales === 0)
    .map((c) => ({
      customer: c.customerName,
      value: c.currentSales,
    }));

  // 8. Lost Customers (bought last year but 0 this year in YTD period)
  const lostCustomers = customerPerformances
    .filter((c) => c.prevSales > 0 && c.currentSales === 0)
    .map((c) => ({
      customer: c.customerName,
      valueLastYear: c.prevSales,
    }));

  return {
    currentYtdSales,
    prevYtdSales,
    growthValue,
    growthPercent,
    currentYtdQty,
    prevYtdQty,
    qtyGrowthPercent,
    totalBudget,
    budgetAchievement,
    activeCustomersCount,
    activeProductsCount,
    regionPerformances,
    categoryPerformances,
    customerPerformances,
    supplierPerformances,
    salespersonRankings,
    droppedCustomers,
    decliningProductsQty,
    decliningProductsVal,
    newCustomers,
    lostCustomers,
    fastGrowingProducts,
    slowMovingProducts,
    underperformingVsPrevYear,
    weakRegions,
    decliningSuppliers,
    salespersonsBelowBudget,
  };
}
