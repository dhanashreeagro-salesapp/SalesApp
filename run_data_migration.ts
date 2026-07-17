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

async function run() {
  console.log("Starting Customer Master one-time data migration...");

  // Authenticate as Admin to satisfy write RLS policy
  console.log("Authenticating as admin to satisfy Row Level Security (RLS) write policies...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@agroiq.com",
    password: "admin123"
  });

  if (authErr) {
    const { data: authData2, error: authErr2 } = await supabase.auth.signInWithPassword({
      email: "dhanashree.agro@gmail.com",
      password: "MyWorld99"
    });
    if (authErr2) {
      console.error("Failed to authenticate as Admin/Dhanashree. RLS write policies will block insertion:", authErr2.message);
      process.exit(1);
    }
    console.log("Successfully authenticated as 'dhanashree.agro@gmail.com' (Admin)!");
  } else {
    console.log("Successfully authenticated as 'admin@agroiq.com' (Admin)!");
  }

  // 1. Fetch all users from Supabase
  const { data: dbUsers, error: usersErr } = await supabase.from('users').select('*');
  if (usersErr) throw usersErr;
  console.log(`Loaded ${dbUsers?.length || 0} users from database.`);

  // 2. Fetch all sales invoices to extract unique customer names and salesperson details
  // Using head: false, we fetch invoice properties
  let allInvoices: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data: chunk, error: err } = await supabase
      .from('sales_data')
      .select('customer_name, customer_code, region, salesperson')
      .range(start, end);

    if (err) throw err;
    if (chunk && chunk.length > 0) {
      allInvoices = [...allInvoices, ...chunk];
      if (chunk.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }
  console.log(`Loaded ${allInvoices.length} historical invoices from sales_data.`);

  // 3. Auto-generate customer master records and default assignments
  const customersMap = new Map<string, any>();
  const assignmentsList: any[] = [];

  const cleanStr = (s: string) => (s || "").trim();

  allInvoices.forEach(inv => {
    const cName = cleanStr(inv.customer_name);
    if (!cName) return;

    const normName = cName.toLowerCase();
    if (!customersMap.has(normName)) {
      customersMap.set(normName, {
        customer_name: cName,
        contact_person: "",
        contact_number: "",
        email: "",
        address: "",
        city: "",
        state: inv.region || "",
        pin_code: "",
        gst_number: inv.customer_code || "",
        pan_number: "",
        status: "Active"
      });

      const spNameNorm = cleanStr(inv.salesperson).toLowerCase();
      const matchedUser = (dbUsers || []).find(u => u.name && u.name.toLowerCase().trim() === spNameNorm);
      const userId = matchedUser ? matchedUser.id : ((dbUsers || []).find(u => u.role === 'Admin')?.id || null);

      assignmentsList.push({
        customerName: cName,
        userId: userId,
        allocationPercentage: 100
      });
    }
  });

  const uniqueCustomers = Array.from(customersMap.values());
  console.log(`Computed ${uniqueCustomers.length} unique customer master records.`);

  // 4. Check if tables exist by querying, and start inserting
  // If tables do not exist, we will warn the user to run migrations first
  const { error: testErr } = await supabase.from('customer_master').select('id').limit(1);
  if (testErr) {
    console.error("==========================================================");
    console.error("⚠️  MIGRATION WARNING: Tables do not exist in Supabase yet!");
    console.error("Please run the SQL schema migration in your Supabase SQL editor first:");
    console.error("customer_assignment_migration.sql");
    console.error("==========================================================");
    process.exit(1);
  }

  // Clear existing customer master and assignments to reload clean migration records
  console.log("Clearing any existing customer master records...");
  await supabase.from('customer_master').delete().neq('customer_name', '');

  // Insert customers in chunks of 100
  console.log("Inserting Customer Master records into Supabase...");
  const chunk = 100;
  const insertedCustomers: any[] = [];

  for (let i = 0; i < uniqueCustomers.length; i += chunk) {
    const sub = uniqueCustomers.slice(i, i + chunk);
    const { data, error } = await supabase.from('customer_master').insert(sub).select();
    if (error) {
      console.error("Failed to insert customer masters:", error.message);
      throw error;
    }
    if (data) insertedCustomers.push(...data);
  }
  console.log(`Inserted ${insertedCustomers.length} customer master records successfully!`);

  // Insert customer assignments
  console.log("Mapping and inserting Customer Assignments...");
  const finalAssignments = assignmentsList.map(assign => {
    const dbCust = insertedCustomers.find(c => c.customer_name === assign.customerName);
    return {
      customer_id: dbCust?.id,
      user_id: assign.userId,
      allocation_percentage: assign.allocationPercentage,
      is_active: true
    };
  }).filter(r => r.customer_id && r.user_id);

  for (let i = 0; i < finalAssignments.length; i += chunk) {
    const sub = finalAssignments.slice(i, i + chunk);
    const { error } = await supabase.from('customer_assignment').insert(sub);
    if (error) {
      console.error("Failed to insert assignments:", error.message);
      throw error;
    }
  }
  console.log(`Inserted ${finalAssignments.length} default customer assignments successfully!`);
  console.log("Migration complete!");
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
