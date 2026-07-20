import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!url || !key) {
  console.error("Missing Supabase credentials in environment config");
  process.exit(1);
}

const supabase = createClient(url, key);

const isFuzzyMatch = (str1: string, str2: string): boolean => {
  if (!str1 || !str2) return false;
  const clean1 = str1.toLowerCase().replace(/[\s\-_.,()]/g, "");
  const clean2 = str2.toLowerCase().replace(/[\s\-_.,()]/g, "");
  return clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1);
};

async function run() {
  console.log("Starting Sales Data orphan salesperson alignment...");

  // Authenticate as Admin
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: "dhanashree.agro@gmail.com",
    password: "MyWorld99"
  });
  if (authErr) {
    await supabase.auth.signInWithPassword({
      email: "admin@agroiq.com",
      password: "admin123"
    });
  }

  // 1. Load users
  const { data: users, error: uErr } = await supabase.from('users').select('id, name, email');
  if (uErr) throw uErr;
  console.log(`Loaded ${users?.length || 0} users.`);

  // 2. Fetch all sales_data rows
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data, error: sErr } = await supabase
      .from('sales_data')
      .select('id, salesperson, salesperson_id, regional_manager')
      .range(start, end);

    if (sErr) throw sErr;
    if (data && data.length > 0) {
      allRows = [...allRows, ...data];
      if (data.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }
  console.log(`Fetched ${allRows.length} total invoice rows from sales_data.`);

  // 3. Align salesperson_id where missing or unlinked
  let updatedCount = 0;
  for (const inv of allRows) {
    const spName = (inv.salesperson || "").trim();
    const rmName = (inv.regional_manager || "").trim();

    if (!spName && !rmName) continue;

    // Find matching user by name or email or fuzzy match
    let matchedUser = users?.find(u => 
      (u.name && isFuzzyMatch(u.name, spName)) ||
      (u.email && isFuzzyMatch(u.email, spName))
    );

    if (!matchedUser && rmName) {
      matchedUser = users?.find(u => 
        (u.name && isFuzzyMatch(u.name, rmName)) ||
        (u.email && isFuzzyMatch(u.email, rmName))
      );
    }

    if (matchedUser && inv.salesperson_id !== matchedUser.id) {
      const { error: upErr } = await supabase
        .from('sales_data')
        .update({ salesperson_id: matchedUser.id })
        .eq('id', inv.id);

      if (!upErr) {
        updatedCount++;
      }
    }
  }

  console.log(`Successfully aligned ${updatedCount} sales_data rows with user IDs!`);
  console.log("Alignment complete.");
}

run().catch(err => {
  console.error("Alignment script failed:", err);
  process.exit(1);
});
