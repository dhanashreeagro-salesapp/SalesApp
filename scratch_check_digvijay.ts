import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Fetching April 2026 invoices for Digvijay Pawar...");
  
  const { data: invs, error } = await supabase
    .from('sales_data')
    .select('*')
    .eq('salesperson', 'Digvijay Pawar')
    .gte('invoice_date', '2026-04-01')
    .lte('invoice_date', '2026-04-30');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${invs?.length} invoices for Digvijay Pawar in April 2026.`);
  console.log(JSON.stringify(invs.map(inv => ({
    invoice_date: inv.invoice_date,
    invoice_number: inv.invoice_number,
    customer_name: inv.customer_name,
    territory: inv.territory,
    salesperson: inv.salesperson,
    product_name: inv.product_name,
    quantity: inv.quantity,
    net_value: inv.net_value
  })), null, 2));
}

run();
