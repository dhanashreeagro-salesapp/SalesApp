import fs from "fs";
import path from "path";

const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "data/db.json"), "utf8"));
const invoices = data.invoices;

// Default period calculations from ExecutiveDashboard.tsx
// find last invoice date
const datesObj = invoices
  .map((inv: any) => inv.invoiceDate)
  .filter(Boolean)
  .map((dStr: string) => new Date(dStr))
  .filter((d: any) => !isNaN(d.getTime()));

let lastDateStr = "2026-05-12";
if (datesObj.length > 0) {
  const lastDate = new Date(Math.max(...datesObj.map((d: any) => d.getTime())));
  const y = lastDate.getFullYear();
  const m = String(lastDate.getMonth() + 1).padStart(2, "0");
  const d = String(lastDate.getDate()).padStart(2, "0");
  lastDateStr = `${y}-${m}-${d}`;
}

const lastDate = new Date(lastDateStr);
const monthIdx = lastDate.getMonth();
const fyStartYear = monthIdx >= 2 ? lastDate.getFullYear() : lastDate.getFullYear() - 1;
const p2Start = `${fyStartYear}-03-01`;
const p2End = lastDateStr;

const p1Start = `${fyStartYear - 1}-03-01`;
const p1End = `${fyStartYear - 1}-${String(lastDate.getMonth() + 1).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;

console.log("Period 1 Range:", p1Start, "to", p1End);
console.log("Period 2 Range:", p2Start, "to", p2End);

// Filter invoices for P1 and P2
const p1Records = invoices.filter((inv: any) => inv.invoiceDate >= p1Start && inv.invoiceDate <= p1End);
const p2Records = invoices.filter((inv: any) => inv.invoiceDate >= p2Start && inv.invoiceDate <= p2End);

console.log("P1 Total Records:", p1Records.length);
console.log("P2 Total Records:", p2Records.length);

// Get unique categories
const productCategoriesAll = Array.from(new Set([
  ...p1Records.map((r: any) => r.productCategory),
  ...p2Records.map((r: any) => r.productCategory)
])).filter(Boolean);

console.log("All Categories:", productCategoriesAll);

const productStats = productCategoriesAll.map((cat: string) => {
  const p1Matches = p1Records.filter((r: any) => r.productCategory === cat);
  const p2Matches = p2Records.filter((r: any) => r.productCategory === cat);

  const p1Qty = p1Matches.reduce((sum: number, r: any) => sum + r.quantity, 0);
  const p2Qty = p2Matches.reduce((sum: number, r: any) => sum + r.quantity, 0);

  const p1Val = p1Matches.reduce((sum: number, r: any) => sum + r.netSalesValue, 0);
  const p2Val = p2Matches.reduce((sum: number, r: any) => sum + r.netSalesValue, 0);

  return {
    category: cat,
    p1Qty,
    p2Qty,
    p1Val,
    p2Val
  };
});

console.log("Product Categories Stats:", productStats);
