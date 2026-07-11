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
    .ilike('salesperson', '%tembhurni%');

  if (error) {
    console.error("Error:", error);
    return;
  }

  const mismatch = invs.filter((inv: any) => inv.territory !== inv.salesperson);
  console.log(`Total invoices for salesperson Tembhurni: ${invs.length}`);
  console.log(`Territory mismatch invoices count: ${mismatch.length}`);
  if (mismatch.length > 0) {
    console.log("Some mismatched invoices:");
    console.log(JSON.stringify(mismatch.slice(0, 5).map(inv => ({
      invoice_date: inv.invoice_date,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      territory: inv.territory,
      salesperson: inv.salesperson
    })), null, 2));
  }
}

run();
