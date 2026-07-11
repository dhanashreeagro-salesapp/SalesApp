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
    .ilike('product_name', '%14-48%');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total Novatec 14-48 invoices in April 2026: ${invs?.length}`);
  
  // Aggregate by salesperson
  const spSummary: Record<string, number> = {};
  invs.forEach((inv: any) => {
    const sp = inv.salesperson || "Unknown";
    spSummary[sp] = (spSummary[sp] || 0) + (Number(inv.quantity) || 0);
  });

  console.log("\nNovatec 14-48 April 2026 Sales by Salesperson:");
  console.log(JSON.stringify(spSummary, null, 2));
}

run();
