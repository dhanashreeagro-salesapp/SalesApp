import fs from "fs";
import path from "path";

const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "data/db.json"), "utf8"));

console.log("=== UNIQUE PRODUCT CATEGORIES IN INVOICES ===");
const cats = new Set(data.invoices?.map((i: any) => i.productCategory).filter(Boolean));
console.log(Array.from(cats));

console.log("=== UNIQUE PRODUCT NAMES IN INVOICES ===");
const pNames = new Set(data.invoices?.map((i: any) => i.productName).filter(Boolean));
console.log(Array.from(pNames));

console.log("=== UNIQUE PRODUCTS IN BUDGETS ===");
const bProds = new Set(data.budgets?.map((b: any) => b.product).filter(Boolean));
console.log(Array.from(bProds));
