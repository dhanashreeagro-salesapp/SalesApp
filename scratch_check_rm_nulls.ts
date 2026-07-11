import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Loading users from database...");
  const { data: dbUsers, error: uErr } = await supabase
    .from('users')
    .select('id, name, manager_id');
  if (uErr) {
    console.error("Error loading users:", uErr);
    return;
  }

  // Map user name -> manager name
  const userManagerMap = new Map<string, string>();
  dbUsers.forEach((u: any) => {
    if (u.manager_id) {
      const mgr = dbUsers.find(m => m.id === u.manager_id);
      if (mgr) {
        userManagerMap.set(u.name.trim().toLowerCase(), mgr.name);
      }
    }
  });

  console.log("Loading sales data...");
  const { data: dbSales, error: sErr } = await supabase
    .from('sales_data')
    .select('id, salesperson, regional_manager');
  if (sErr) {
    console.error("Error loading sales:", sErr);
    return;
  }

  console.log(`Loaded ${dbSales.length} invoices.`);

  // Find invoices where regional_manager is different from what it should be based on the user's manager
  let count = 0;
  const incorrectRMCountBySP: Record<string, { current: string, expected: string, count: number }> = {};

  dbSales.forEach((inv: any) => {
    const sp = (inv.salesperson || "").trim();
    const spLower = sp.toLowerCase();
    const currentRm = (inv.regional_manager || "").trim();
    
    if (userManagerMap.has(spLower)) {
      const expectedRm = userManagerMap.get(spLower)!;
      if (currentRm !== expectedRm) {
        count++;
        const key = `${sp} (${currentRm} vs ${expectedRm})`;
        if (!incorrectRMCountBySP[key]) {
          incorrectRMCountBySP[key] = {
            current: currentRm,
            expected: expectedRm,
            count: 0
          };
        }
        incorrectRMCountBySP[key].count++;
      }
    }
  });

  console.log(`Total invoices with mismatched regional manager: ${count}`);
  console.log("Mismatches summary:");
  console.log(JSON.stringify(incorrectRMCountBySP, null, 2));
}

run();
