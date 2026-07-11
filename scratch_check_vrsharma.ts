import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Checking for misattributed Tembhurni/Solapur sales in April 2026...");

  // Fetch all invoices in April 2026 that have Tembhurni or Solapur customers,
  // or show their salesperson and territory.
  const { data: invs, error } = await supabase
    .from('sales_data')
    .select('*')
    .gte('invoice_date', '2026-04-01')
    .lte('invoice_date', '2026-04-30');

  if (error) {
    console.error("Error:", error);
    return;
  }

  // Customers containing "Tembhurni", "Akluj", "Pimpalner", "Vairag" (known Shridhar Patil customers)
  const shridharCustomers = ["tembhurni", "akluj", "pimpalner", "vairag", "kurduwadi", "madha"];

  const potentialMisattributions = invs.filter((inv: any) => {
    const custLower = (inv.customer_name || "").toLowerCase();
    const isShridharCust = shridharCustomers.some(c => custLower.includes(c));
    return isShridharCust;
  });

  console.log(`Found ${potentialMisattributions.length} invoices for Shridhar's potential customers in April 2026:`);

  // Group these by salesperson, product category, and sum the quantities
  const summary: Record<string, any> = {};
  potentialMisattributions.forEach((inv: any) => {
    const key = `${inv.salesperson} | ${inv.territory} | ${inv.product_name}`;
    if (!summary[key]) {
      summary[key] = { qty: 0, count: 0, customers: new Set() };
    }
    summary[key].qty += Number(inv.quantity) || 0;
    summary[key].count += 1;
    summary[key].customers.add(inv.customer_name);
  });

  for (const [key, val] of Object.entries(summary)) {
    console.log(`${key} => Qty: ${val.qty}, Invoices count: ${val.count}, Customers: ${Array.from(val.customers).join(', ')}`);
  }
}

run();
