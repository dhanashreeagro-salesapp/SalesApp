import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Querying sales_data in Supabase...");

  // 1. Fetch all Fetrilon Combi-2 invoices in April 2026 (2026-04-01 to 2026-04-30)
  const { data: fetrilonInvs, error: e1 } = await supabase
    .from('sales_data')
    .select('*')
    .gte('invoice_date', '2026-04-01')
    .lte('invoice_date', '2026-04-30')
    .ilike('product_name', '%fetrilon%');

  if (e1) {
    console.error("Error fetching Fetrilon invoices:", e1);
  } else {
    console.log(`\nFound ${fetrilonInvs?.length} Fetrilon invoices in April 2026:`);
    console.log(JSON.stringify(fetrilonInvs.map(inv => ({
      invoice_date: inv.invoice_date,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      territory: inv.territory,
      salesperson: inv.salesperson,
      product_name: inv.product_name,
      quantity: inv.quantity,
      unit: inv.unit,
      net_value: inv.net_value
    })), null, 2));
  }

  // 2. Fetch all Novatec 14-48 invoices in April 2026
  const { data: novatecInvs, error: e2 } = await supabase
    .from('sales_data')
    .select('*')
    .gte('invoice_date', '2026-04-01')
    .lte('invoice_date', '2026-04-30')
    .ilike('product_name', '%14-48%');

  if (e2) {
    console.error("Error fetching Novatec 14-48 invoices:", e2);
  } else {
    console.log(`\nFound ${novatecInvs?.length} Novatec 14-48 invoices in April 2026:`);
    console.log(JSON.stringify(novatecInvs.map(inv => ({
      invoice_date: inv.invoice_date,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      territory: inv.territory,
      salesperson: inv.salesperson,
      product_name: inv.product_name,
      quantity: inv.quantity,
      unit: inv.unit,
      net_value: inv.net_value
    })), null, 2));
  }
}

run();
