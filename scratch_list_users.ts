import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Listing all users...");
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, role, territory, region, manager_id');

  if (error) {
    console.error("Error:", error);
    return;
  }

  // Resolve manager name
  const list = users.map((u: any) => {
    const mgr = users.find((m: any) => m.id === u.manager_id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      territory: u.territory,
      region: u.region,
      manager_id: u.manager_id,
      manager_name: mgr ? mgr.name : 'None'
    };
  });

  console.log(JSON.stringify(list, null, 2));
}

run();
