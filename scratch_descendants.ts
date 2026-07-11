import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getUserDescendantsList } from './src/utils/analytics';
import { UserProfile } from './src/types';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  const { data: dbUsers, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  // Format users just like in App.tsx
  const formattedUsers: UserProfile[] = (dbUsers || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    region: u.region || undefined,
    territory: u.territory || undefined,
    salespersonCode: u.employee_code || undefined,
    approved: u.is_active !== false,
    managerId: u.manager_id || undefined
  }));

  // Resolve managerName from managerId dynamically
  formattedUsers.forEach((u: any) => {
    if (u.managerId && !u.managerName) {
      const mgr = formattedUsers.find((m: any) => m.id === u.managerId);
      if (mgr) {
        u.managerName = mgr.name;
      }
    }
  });

  // Find user Tembhurni (Shridhar Patil)
  const shridhar = formattedUsers.find(u => u.name.includes("Shridhar"));
  if (!shridhar) {
    console.log("Could not find Shridhar Patil in users");
    return;
  }

  console.log("Shridhar Patil profile:", JSON.stringify(shridhar, null, 2));

  const descendants = getUserDescendantsList(shridhar, formattedUsers);
  console.log("Descendants of Shridhar Patil count:", descendants.length);
  console.log("Descendants list:", JSON.stringify(descendants.map(d => ({ name: d.name, role: d.role, managerName: d.managerName })), null, 2));
}

run();
