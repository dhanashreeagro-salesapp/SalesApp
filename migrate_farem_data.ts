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

async function runMigration() {
  console.log("=== Starting FaReM Data Reconciliation & Strict Test Cleanup ===");

  // 1. Authenticate as Admin
  await supabase.auth.signInWithPassword({
    email: "dhanashree.agro@gmail.com",
    password: "MyWorld99"
  }).catch(() => {});

  // 2. Load SalesApp Central Users
  const { data: salesUsers, error: uErr } = await supabase.from("users").select("id, name, email, employee_code, role");
  if (uErr) {
    console.error("Error fetching SalesApp users:", uErr);
    process.exit(1);
  }

  console.log(`Loaded ${salesUsers?.length || 0} valid SalesApp users.`);
  const validUserIds = new Set((salesUsers || []).map(u => u.id));
  const emailToUserMap = new Map((salesUsers || []).map(u => [u.email ? u.email.toLowerCase().trim() : '', u]));
  const codeToUserMap = new Map((salesUsers || []).filter(u => u.employee_code).map(u => [u.employee_code.toLowerCase().trim(), u]));

  // 3. Reconcile Farmers table (`core_farmer`)
  console.log("Checking FaReM Farmers (`core_farmer`)...");
  const { data: farmers, error: fErr } = await supabase.from("core_farmer").select("id, full_name, primary_mobile, assigned_staff_id");

  if (fErr) {
    console.log("Notice: `core_farmer` table not yet populated or accessible on primary database schema:", fErr.message);
  } else if (farmers && farmers.length > 0) {
    console.log(`Found ${farmers.length} farmer records.`);
    let retainedCount = 0;
    let purgedCount = 0;

    for (const farmer of farmers) {
      const currentStaffId = farmer.assigned_staff_id;
      let matchedUser = null;

      if (currentStaffId && validUserIds.has(currentStaffId)) {
        matchedUser = (salesUsers || []).find(u => u.id === currentStaffId);
      }

      if (!matchedUser) {
        // Purge unresolved test farmer and child data
        console.log(`Purging unmapped test farmer "${farmer.full_name}" (ID: ${farmer.id}) with unmapped staff ID: ${currentStaffId}`);
        await supabase.from("core_plot").delete().eq("farmer_id", farmer.id);
        await supabase.from("core_activitylog").delete().eq("farmer_id", farmer.id);
        await supabase.from("core_recommendation").delete().eq("farmer_id", farmer.id);
        await supabase.from("core_farmer").delete().eq("id", farmer.id);
        purgedCount++;
      } else {
        retainedCount++;
      }
    }
    console.log(`Farmers summary: Retained ${retainedCount} valid records. Purged ${purgedCount} unmapped test records.`);
  }

  // 4. Clean orphan Activity Logs (`core_activitylog`)
  const { data: activities } = await supabase.from("core_activitylog").select("id, logged_by_user_id");
  if (activities && activities.length > 0) {
    for (const act of activities) {
      if (!act.logged_by_user_id || !validUserIds.has(act.logged_by_user_id)) {
        await supabase.from("core_activitylog").delete().eq("id", act.id);
      }
    }
  }

  // 5. Clean orphan Recommendations (`core_recommendation`)
  const { data: recommendations } = await supabase.from("core_recommendation").select("id, created_by_user_id");
  if (recommendations && recommendations.length > 0) {
    for (const rec of recommendations) {
      if (!rec.created_by_user_id || !validUserIds.has(rec.created_by_user_id)) {
        await supabase.from("core_recommendation").delete().eq("id", rec.id);
      }
    }
  }

  console.log("=== FaReM Data Reconciliation & Cleanup Complete ===");
}

runMigration().catch(err => {
  console.error("Migration script encountered error:", err);
  process.exit(1);
});
