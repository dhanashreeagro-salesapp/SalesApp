import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  const { data: invs, error } = await supabase
    .from('sales_data')
    .select('*')
    .gte('invoice_date', '2026-04-01')
    .lte('invoice_date', '2026-04-30')
    .ilike('product_name', '%fetrilon%');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total Fetrilon invoices in April 2026: ${invs?.length}`);
  
  // Aggregate by salesperson
  const spSummary: Record<string, number> = {};
  invs.forEach((inv: any) => {
    const sp = inv.salesperson || "Unknown";
    spSummary[sp] = (spSummary[sp] || 0) + (Number(inv.quantity) || 0);
  });

  console.log("\nFetrilon Combi-2 April 2026 Sales by Salesperson:");
  console.log(JSON.stringify(spSummary, null, 2));

  // Let's print all of them where salesperson contains "Patil" or "Solapur" or "Tembhurni"
  const patilInvs = invs.filter((inv: any) => 
    (inv.salesperson && inv.salesperson.toLowerCase().includes("patil")) ||
    (inv.salesperson && inv.salesperson.toLowerCase().includes("tembhurni")) ||
    (inv.salesperson && inv.salesperson.toLowerCase().includes("solapur"))
  );

  console.log("\nPatil / Tembhurni / Solapur Fetrilon Invoices:");
  console.log(JSON.stringify(patilInvs.map(inv => ({
    date: inv.invoice_date,
    inv_no: inv.invoice_number,
    customer: inv.customer_name,
    salesperson: inv.salesperson,
    territory: inv.territory,
    product: inv.product_name,
    qty: inv.quantity,
    net_val: inv.net_value
  })), null, 2));
}

run();
