import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!url || !key) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Connecting to Supabase at:", url);

  // Get total counts
  const { count: salesCount, error: salesErr } = await supabase
    .from('sales_data')
    .select('*', { count: 'exact', head: true });

  if (salesErr) {
    console.error("Error getting count:", salesErr);
    return;
  }
  console.log("Total sales_data records in Supabase:", salesCount);

  // Let's query all records for salesperson containing "Tembhurni" or "Shridhar" or "Patil"
  // Note: we can query the database or just fetch pages. Since count might be small, let's fetch all.
  const { data: spSales, error: spErr } = await supabase
    .from('sales_data')
    .select('*')
    .ilike('salesperson', '%tembhurni%');

  if (spErr) {
    console.error("Error fetching salesperson data:", spErr);
  } else {
    console.log("Invoices matching salesperson 'tembhurni' count:", spSales?.length);
    if (spSales && spSales.length > 0) {
      console.log("First 3 tembhurni records:");
      console.log(JSON.stringify(spSales.slice(0, 3), null, 2));

      // Let's summarize by product and month for FY 2026-27 (2026-04-01 onwards)
      const fy26Invoices = spSales.filter((inv: any) => inv.invoice_date && inv.invoice_date.startsWith("2026-"));
      console.log("FY 2026-27 invoices for Tembhurni count:", fy26Invoices.length);

      const summary: Record<string, { qty: number, netValue: number, count: number, dates: string[] }> = {};
      fy26Invoices.forEach((inv: any) => {
        const key = `${inv.invoice_date.slice(0, 7)} | ${inv.product_name}`;
        if (!summary[key]) {
          summary[key] = { qty: 0, netValue: 0, count: 0, dates: [] };
        }
        summary[key].qty += Number(inv.quantity) || 0;
        summary[key].netValue += Number(inv.net_value) || 0;
        summary[key].count += 1;
        summary[key].dates.push(inv.invoice_date);
      });

      console.log("FY 2026-27 Tembhurni Sales Summary by Month and Product:");
      console.log(JSON.stringify(summary, null, 2));

      // Specifically, let's find Fetrilon Combi-2 in April 2026
      const fetrilonApril26 = fy26Invoices.filter((inv: any) => 
        inv.invoice_date.startsWith("2026-04") && 
        inv.product_name.toLowerCase().includes("fetrilon")
      );
      console.log("Fetrilon Combi-2 in April 2026 for Tembhurni:");
      console.log(JSON.stringify(fetrilonApril26, null, 2));

      // Specifically, let's find Novatec 14-48 in April 2026 or any month in FY 2026-27
      const novatecFY26 = fy26Invoices.filter((inv: any) => 
        inv.product_name.toLowerCase().includes("novatec")
      );
      console.log("Novatec in FY 2026-27 for Tembhurni:");
      console.log(JSON.stringify(novatecFY26, null, 2));
    }
  }

  // Let's also look for all invoices matching Shridhar Patil or S. R. Patil
  const { data: patilSales, error: patilErr } = await supabase
    .from('sales_data')
    .select('*')
    .ilike('salesperson', '%patil%');

  if (!patilErr && patilSales) {
    console.log("Total sales matching '%patil%' salesperson:", patilSales.length);
    const uniquePatils = Array.from(new Set(patilSales.map((inv: any) => inv.salesperson)));
    console.log("Unique Patil salesperson names:", uniquePatils);
  }
}

run();
