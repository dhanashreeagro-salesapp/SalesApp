import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Checking for duplicate rows in sales_data...");

  // Fetch all invoices in April 2026 for Tembhurni (Shridhar Patil)
  const { data: invs, error } = await supabase
    .from('sales_data')
    .select('*')
    .eq('salesperson', 'Tembhurni (Shridhar Patil)')
    .gte('invoice_date', '2026-04-01')
    .lte('invoice_date', '2026-04-30');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${invs?.length} invoices for Tembhurni in April 2026.`);

  // Let's identify duplicate entries: same invoice_number, product_name, customer_name, quantity, invoice_date
  const seen = new Map<string, any[]>();
  invs.forEach((inv: any) => {
    const key = `${inv.invoice_number} | ${inv.product_name} | ${inv.customer_name} | ${inv.quantity} | ${inv.invoice_date}`;
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(inv);
  });

  console.log("\nDuplicate groups found:");
  let duplicatesCount = 0;
  for (const [key, list] of seen.entries()) {
    if (list.length > 1) {
      console.log(`Key: ${key}`);
      console.log(`Count: ${list.length}`);
      console.log("IDs:", list.map(x => x.id).join(', '));
      duplicatesCount += (list.length - 1);
    }
  }
  console.log(`Total duplicate records identified: ${duplicatesCount}`);
}

run();
