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
        userManagerMap.set(u.name, mgr.name);
      }
    }
  });

  console.log("\nSalesperson manager mapping:");
  for (const [sp, mgr] of userManagerMap.entries()) {
    console.log(`- ${sp} => Manager: ${mgr}`);
  }

  console.log("\nCalculating updates per salesperson...");
  for (const [sp, expectedRm] of userManagerMap.entries()) {
    // Check how many invoices need update
    const { count, error } = await supabase
      .from('sales_data')
      .select('*', { count: 'exact', head: true })
      .eq('salesperson', sp)
      .neq('regional_manager', expectedRm);

    if (error) {
      console.error(`Error checking salesperson ${sp}:`, error);
    } else {
      console.log(`- ${sp}: ${count} invoices have incorrect RM (should be '${expectedRm}')`);
    }
  }
}

run();
