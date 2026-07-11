import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Checking regional_manager for Digvijay Pawar's invoices in April 2026...");
  
  const { data: invs, error } = await supabase
    .from('sales_data')
    .select('regional_manager, salesperson, customer_name, quantity, product_name')
    .eq('salesperson', 'Digvijay Pawar')
    .gte('invoice_date', '2026-04-01')
    .lte('invoice_date', '2026-04-30');

  if (error) {
    console.error("Error:", error);
    return;
  }

  // Print unique regional_manager values
  const rms = Array.from(new Set(invs.map(i => i.regional_manager)));
  console.log("Unique regional managers:", rms);
}

run();
