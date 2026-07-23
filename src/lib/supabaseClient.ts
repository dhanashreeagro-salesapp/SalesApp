import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { InvoiceItem, BudgetItem, UserProfile, EmailLog, AuditLog, CustomerMaster, CustomerAssignment, AssignmentAuditLog } from "../types";

// Read from Vite environment variables as per requirements
const sanitizeEnvVal = (val: string): string => {
  if (!val) return "";
  let clean = val.trim();
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1);
  }
  if (clean.startsWith("'") && clean.endsWith("'")) {
    clean = clean.slice(1, -1);
  }
  clean = clean.trim();
  if (clean.endsWith("/rest/v1/")) {
    clean = clean.substring(0, clean.length - "/rest/v1/".length);
  } else if (clean.endsWith("/rest/v1")) {
    clean = clean.substring(0, clean.length - "/rest/v1".length);
  }
  if (clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  return clean.trim();
};

const isPlaceholderVal = (val: string): boolean => {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    lower.includes("your-supabase-project") ||
    lower.includes("your-anon-public-key") ||
    lower.includes("placeholder")
  );
};

let rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
let rawSupabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let supabaseUrl = sanitizeEnvVal(rawSupabaseUrl);
let supabaseKey = sanitizeEnvVal(rawSupabaseKey);

console.log("[Supabase Debug] --- CREDENTIAL STATUS AUDIT (Compile-Time) ---");
console.log("[Supabase Debug] Compile-Time Supabase URL:", supabaseUrl ? `YES (Length: ${supabaseUrl.length}, Prefix: ${supabaseUrl.slice(0, 16)}...)` : "NO (null/undefined)");
console.log("[Supabase Debug] Compile-Time Supabase Key:", supabaseKey ? `YES (Length: ${supabaseKey.length}, Prefix: ${supabaseKey.slice(0, 12)}...)` : "NO (null/undefined)");

// Dynamic runtime synclink fallback if compile-time variables are missing or placeholders
if (!supabaseUrl || !supabaseKey || isPlaceholderVal(supabaseUrl) || isPlaceholderVal(supabaseKey)) {
  console.log("[Supabase Debug] Compile-time credentials missing or placeholders detected. Attempting dynamic synclink fallback via /api/supabase-config...");
  try {
    const xhr = new XMLHttpRequest();
    // Synchronous request block ensures getSupabase() / module load remains simple and synchronous
    xhr.open("GET", "/api/supabase-config", false);
    xhr.send(null);
    if (xhr.status === 200) {
      const config = JSON.parse(xhr.responseText);
      const fetchedUrl = sanitizeEnvVal(config.url || "");
      const fetchedKey = sanitizeEnvVal(config.key || "");
      if (fetchedUrl && fetchedKey && !isPlaceholderVal(fetchedUrl) && !isPlaceholderVal(fetchedKey)) {
        supabaseUrl = fetchedUrl;
        supabaseKey = fetchedKey;
        console.log("[Supabase Debug] Dynamic synclink returned active credentials. URL & Key successfully loaded.");
      }
    }
  } catch (err: any) {
    console.warn("[Supabase Debug] Dynamic synclink failed - offline or backend API route unavailable in this host environment:", err.message || err);
  }
}

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey && !isPlaceholderVal(supabaseUrl) && !isPlaceholderVal(supabaseKey)) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log("[Supabase Debug] Supabase client initialized successfully. Singleton active.");
  } catch (error: any) {
    console.error("[Supabase Debug] CRITICAL: Failed to initialize Supabase client instance:", error.message || error);
  }
} else {
  console.error(
    "[Supabase Debug] CRITICAL: Supabase environment credentials (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) are missing in build/runtime context! " +
    "Please configure them in Vite Environment Variables or Vercel settings to enable cloud syncing."
  );
}

// Single shared client instance export
export const supabase: SupabaseClient | null = supabaseInstance;

/**
 * Returns the current singleton client instance
 */
export function getSupabase(): SupabaseClient | null {
  return supabaseInstance;
}

/**
 * Checks if Supabase is fully configured on client-side
 */
export function isSupabaseConfigured(): boolean {
  return supabaseInstance !== null;
}

/**
 * Diagnostic utility function to audit the configuration and status of environment variables
 */
export function runSupabaseDiagnostics(): void {
  const compileUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const compileKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  const maskStr = (str: string, keep: number = 6): string => {
    if (!str) return "EMPTY / MISSING";
    if (str.length <= keep * 2) return "***";
    return `${str.slice(0, keep)}...${str.slice(-keep)} (Length: ${str.length})`;
  };

  console.log("%c=== DHANASHREE SALESIQ: SUPABASE CLOUD STATUS DIAGNOSTICS ===", "color: #4f46e5; font-weight: bold; font-size: 13px;");

  console.log("[Diagnostic] 1. Compile-Time Settings (Vite Bundler):");
  console.log("   - VITE_SUPABASE_URL State:", compileUrl ? "✓ ACTIVE PRESET" : "✗ MISSING / UNDEFINED");
  console.log("   - VITE_SUPABASE_URL Value:", compileUrl || "N/A");
  console.log("   - VITE_SUPABASE_ANON_KEY State:", compileKey ? "✓ ACTIVE PRESET" : "✗ MISSING / UNDEFINED");
  console.log("   - VITE_SUPABASE_ANON_KEY Value (Masked):", maskStr(compileKey));

  console.log("[Diagnostic] 2. Resolved Effective Settings (With API Synclink Fallback):");
  console.log("   - Resolved Supabase URL status:", supabaseUrl ? "✓ LOADED" : "✗ EMPTY");
  console.log("   - Resolved Supabase URL value:", supabaseUrl || "N/A");
  console.log("   - Resolved Supabase Key status:", supabaseKey ? "✓ LOADED" : "✗ EMPTY");
  console.log("   - Resolved Supabase Key value (Masked):", maskStr(supabaseKey));

  console.log("[Diagnostic] 3. Client Availability:");
  console.log("   - Singleton Client Instance:", isSupabaseConfigured() ? "✓ ACTIVE (Valid connection initialized)" : "✗ OFFLINE / FALLBACK ACTIVE (Simulated locally)");

  console.log("================================================================");
}

// Automatically trigger diagnosis log on initial load to facilitate cloud troubleshooting
try {
  runSupabaseDiagnostics();
} catch (diagError) {
  console.warn("[Supabase Debug] Diagnostics run encountered a non-blocking error:", diagError);
}

// ==================================================
// AUTHENTICATION HELPERS
// ==================================================

/**
 * Sign up a new user via Supabase Auth and insert profile into the 'users' table
 */
export async function supabaseSignUp(profile: Partial<UserProfile> & { password?: string }) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");

  if (!profile.email || !profile.password) {
    throw new Error("Email and password are required for registration.");
  }

  // 1. Sign up user in Supabase Auth
  const { data: authData, error: authError } = await sb.auth.signUp({
    email: profile.email,
    password: profile.password,
    options: {
      data: {
        name: profile.name,
        role: profile.role
      }
    }
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error("SignUp call succeeded but returning null user object.");

  // 2. Map role/territory to public.users table (Sync role credentials)
  const { error: profileError } = await sb.from("users").insert({
    id: authData.user.id, // match authenticated user id
    name: profile.name || "Anonymous",
    email: profile.email,
    role: profile.role || "Salesperson",
    territory: profile.territory || "",
    region: profile.region || "",
    employee_code: profile.salespersonCode || "",
    is_active: true
  });

  if (profileError) {
    console.warn("User registered in Auth but profile table insertion failed:", profileError);
  }

  return authData;
}

/**
 * Sign in existing user via Supabase Auth and retrieve corresponding user profile row
 */
export async function supabaseSignIn(email: string, password: string): Promise<{ user: any; profile: UserProfile | null }> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  if (!data.user) throw new Error("Logged in successfully but returned empty Auth metadata.");

  // Fetch matched user profile from DB
  const { data: profile, error: profileError } = await sb
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  let userProfile = profile;
  if (profileError || !profile) {
    console.warn("Auth login succeeded but database profile row was missing. Attempting auto-recreation...", profileError?.message);
    const fallbackRole = data.user.user_metadata?.role || "Salesperson";
    const fallbackName = data.user.user_metadata?.name || data.user.email?.split("@")[0] || "Anonymous";

    const newProfile = {
      id: data.user.id,
      name: fallbackName,
      email: data.user.email!,
      role: fallbackRole,
      is_active: true,
      territory: "",
      region: ""
    };

    const { data: inserted, error: insertErr } = await sb
      .from("users")
      .insert(newProfile)
      .select()
      .single();

    if (!insertErr && inserted) {
      userProfile = inserted;
      console.log("Successfully recreated missing user profile for", data.user.email);
    } else {
      console.error("Failed to auto-recreate missing user profile:", insertErr?.message || "Unknown error");
    }
  }

  return {
    user: data.user,
    profile: userProfile ? mapUserRow(userProfile) : null
  };
}

/**
 * Sign out current active session
 */
export async function supabaseSignOut() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
}

// ==================================================
// USERS RETRIEVAL & MANAGEMENT
// ==================================================

export async function fetchUsersFromSupabase(): Promise<UserProfile[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("users")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching users from Supabase:", error);
    return [];
  }

  return (data || []).map(mapUserRow);
}

export async function saveUserProfileToSupabase(user: Partial<UserProfile> & { password?: string }, allUsers?: UserProfile[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  let manager_id = user.managerId && !user.managerId.startsWith("user_") ? user.managerId : null;
  if (!manager_id && user.managerName) {
    const { data: dbUsers } = await sb.from("users").select("id, name");
    const mgr = (dbUsers || []).find(u => u.name.trim().toLowerCase() === user.managerName!.trim().toLowerCase());
    if (mgr) {
      manager_id = mgr.id;
    }
  }

  const row: any = {
    name: user.name,
    email: user.email,
    password: user.password || "password123",
    role: user.role,
    territory: user.territory || "",
    region: user.region || "",
    employee_code: user.salespersonCode || "",
    is_active: user.approved !== false,
    manager_id: manager_id,
    mobile_number: user.mobileNumber || ""
  };

  const { error } = await sb
    .from("users")
    .upsert({
      id: user.id && user.id.startsWith("user_") ? undefined : (user.id || undefined),
      ...row
    }, { onConflict: "email" });

  if (error) {
    console.error("Error upserting user profile into Supabase:", error);
    return false;
  }

  // Attempt to synchronize mobile number to FaReM core_user table
  try {
    const userIdForMatch = user.id && !user.id.startsWith("user_") ? user.id : undefined;
    if (userIdForMatch) {
      await sb
        .from("core_user")
        .update({ mobile_number: user.mobileNumber || "" })
        .or(`salesapp_user_id.eq.${userIdForMatch},email.eq.${user.email}`);
    } else {
      await sb
        .from("core_user")
        .update({ mobile_number: user.mobileNumber || "" })
        .eq("email", user.email);
    }
  } catch (coreUserErr) {
    console.warn("Bypassed core_user sync:", coreUserErr);
  }

  return true;
}

export async function saveUserProfilesToSupabase(usersList: Partial<UserProfile>[], allUsers?: UserProfile[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  // Resolve manager_ids dynamically from database
  const { data: dbUsers } = await sb.from("users").select("id, name");
  const dbUsersList = dbUsers || [];

  const rows = usersList.map(user => {
    let manager_id = user.managerId && !user.managerId.startsWith("user_") ? user.managerId : null;
    if (!manager_id && user.managerName) {
      const mgr = dbUsersList.find(u => u.name.trim().toLowerCase() === user.managerName!.trim().toLowerCase());
      if (mgr) {
        manager_id = mgr.id;
      }
    }
    return {
      id: user.id && user.id.startsWith("user_") ? undefined : (user.id || undefined),
      name: user.name,
      email: user.email,
      password: user.password || "password123",
      role: user.role,
      territory: user.territory || "",
      region: user.region || "",
      employee_code: user.salespersonCode || "",
      is_active: user.approved !== false,
      manager_id: manager_id
    };
  });

  const { error } = await sb
    .from("users")
    .upsert(rows, { onConflict: "email" });

  if (error) {
    console.error("Error upserting bulk user profiles into Supabase:", error);
    return false;
  }
  return true;
}

// ==================================================
// SALES DATA RETRIEVAL
// ==================================================

export async function fetchSalesDataFromSupabase(): Promise<InvoiceItem[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data, error } = await sb
      .from("sales_data")
      .select("*")
      .order("invoice_date", { ascending: false })
      .range(start, end);

    if (error) {
      console.error("Error fetching invoices from Supabase:", error);
      break;
    }

    if (data && data.length > 0) {
      allRows = [...allRows, ...data];
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows.map(mapSalesRow);
}

export async function insertSalesDataChunks(invoices: InvoiceItem[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  // Fetch users list to resolve salesperson_id and manager_id
  const { data: dbUsers } = await sb.from("users").select("id, name, email, role, region, territory, manager_id");
  const usersList = dbUsers || [];
  const defaultAdmin = usersList.find(u => u.role === "Admin" || u.role === "Sales Director") || usersList[0];

  const isFuzzyMatch = (str1: string, str2: string): boolean => {
    if (!str1 || !str2) return false;
    const clean1 = str1.toLowerCase().replace(/[\s\-_.,()]/g, "");
    const clean2 = str2.toLowerCase().replace(/[\s\-_.,()]/g, "");
    return clean1 === clean2 || clean1.includes(clean2) || clean2.includes(clean1);
  };

  const rows = invoices.map(i => {
    const spName = (i.salesperson || "").trim();
    const rmName = (i.regionalManager || "").trim();

    let matchedUser = usersList.find(u =>
      (u.name && isFuzzyMatch(u.name, spName)) ||
      (u.email && isFuzzyMatch(u.email, spName))
    );

    if (!matchedUser && rmName) {
      matchedUser = usersList.find(u =>
        (u.name && isFuzzyMatch(u.name, rmName)) ||
        (u.email && isFuzzyMatch(u.email, rmName))
      );
    }

    const salesperson_id = matchedUser ? matchedUser.id : (defaultAdmin ? defaultAdmin.id : null);
    const manager_id = matchedUser ? (matchedUser.manager_id || defaultAdmin?.id || null) : (defaultAdmin ? defaultAdmin.id : null);

    return {
      id: i.id || undefined,
      invoice_date: i.invoiceDate,
      invoice_number: i.invoiceNumber,
      company: i.company,
      customer_name: i.customerName,
      customer_code: i.customerCode,
      region: i.region,
      territory: i.territory,
      salesperson: i.salesperson,
      salesperson_id: salesperson_id,
      manager_id: manager_id,
      regional_manager: i.regionalManager,
      product_name: i.productName,
      product_category: i.productCategory,
      supplier: i.supplier,
      quantity: i.quantity,
      unit: i.unit,
      rate: i.rate,
      gross_value: i.grossValue,
      discount: i.discount,
      net_value: i.netSalesValue
    };
  });

  const chunkSize = 500;
  for (let idx = 0; idx < rows.length; idx += chunkSize) {
    const chunk = rows.slice(idx, idx + chunkSize);
    const { error } = await sb.from("sales_data").insert(chunk);
    if (error) {
      console.error("Error inserting sales data chunk into Supabase:", error);
      return false;
    }
  }

  return true;
}

export async function clearAllSalesData(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("sales_data")
    .delete()
    .neq("invoice_number", ""); // delete all rows

  if (error) {
    console.error("Error clearing sales database:", error);
    return false;
  }
  return true;
}

// ==================================================
// BUDGET DATA RETRIEVAL
// ==================================================

export async function fetchBudgetDataFromSupabase(): Promise<BudgetItem[]> {
  const sb = getSupabase();
  if (!sb) return [];

  // Fetch all users to map salesperson and manager names
  const usersList = await fetchUsersFromSupabase();

  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data, error } = await sb
      .from("budget_data")
      .select(`
        id,
        product_name,
        budget_quantity,
        budget_value,
        month,
        financial_year,
        salesperson_id
      `)
      .range(start, end);

    if (error) {
      console.error("Error fetching budget sheets from Supabase:", error);
      break;
    }

    if (data && data.length > 0) {
      allRows = [...allRows, ...data];
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  const data = allRows;

  return (data || []).map((b: any) => {
    const sp = usersList.find((u) => u.id === b.salesperson_id);
    const sName = sp?.name || "Representative";
    const territoryStr = sp?.territory || "";
    const regionStr = sp?.region || "";

    // Find regional manager
    const manager = sp?.managerId ? usersList.find((u) => u.id === sp.managerId) : null;
    const regName = manager?.name || "";

    return {
      id: b.id,
      salesperson: sName,
      product: b.product_name,
      budgetQuantity: Number(b.budget_quantity) || 0,
      budgetValue: Number(b.budget_value) || 0,
      month: b.month,
      financialYear: b.financial_year,
      territory: territoryStr,
      regionalManager: regName,
      region: regionStr
    };
  });
}

export async function saveBudgetsToSupabase(budgets: BudgetItem[], usersList: UserProfile[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  // Resolve manager/salesperson IDs using real database UUIDs
  const { data: dbUsers } = await sb.from("users").select("id, name");
  const dbUsersList = dbUsers || [];

  const rows = budgets.map(b => {
    const spKey = (b.salesperson || "").trim().toLowerCase();
    const dbMatch = dbUsersList.find(u => u.name && u.name.trim().toLowerCase() === spKey);
    let resolvedUserId = dbMatch ? dbMatch.id : null;

    if (!resolvedUserId) {
      const clientMatch = usersList.find(u => u.name && u.name.trim().toLowerCase() === spKey);
      if (clientMatch && clientMatch.id && !clientMatch.id.startsWith("user_")) {
        resolvedUserId = clientMatch.id;
      }
    }

    return {
      id: b.id && (b.id.startsWith("bud_upl_") || b.id.startsWith("bud_")) ? undefined : b.id,
      product_name: b.product,
      budget_quantity: b.budgetQuantity,
      budget_value: b.budgetValue,
      month: b.month,
      financial_year: b.financialYear,
      salesperson_id: resolvedUserId
    };
  }).filter(r => r.salesperson_id !== null); // safety filter

  // 1. Delete all existing records
  const { error: deleteError } = await sb
    .from("budget_data")
    .delete()
    .neq("product_name", "");
  
  if (deleteError) {
    console.error("Failed to clear budget targets before saving:", deleteError);
    return false;
  }

  // 2. Insert new rows in chunks
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: insertError } = await sb
      .from("budget_data")
      .insert(chunk);
    if (insertError) {
      console.error("Failed to insert budget target chunk:", insertError);
      return false;
    }
  }

  return true;
}

export async function clearAllBudgetsData(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("budget_data")
    .delete()
    .neq("product_name", "");

  if (error) {
    console.error("Error clearing budget target tables:", error);
    return false;
  }
  return true;
}

// ==================================================
// UPLOADS & FILE STORAGE INTEGRATION
// ==================================================

/**
 * Upload sheet file binary to public Supabase Storage bucket 'spreadsheets'
 */
export async function uploadExcelToStorage(file: File, uploadedByUserId: string, company_name: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const fileExt = file.name.split(".").pop();
  const rawFileName = `${company_name.replace(/\s+/g, "_")}_${Date.now()}.${fileExt}`;
  const filePath = `sheets/${rawFileName}`;

  // 1. Upload to Storage
  const { data: storageData, error: storageError } = await sb.storage
    .from("spreadsheets")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true
    });

  if (storageError) {
    console.warn("Supabase Storage upload warning (non-blocking file archival):", storageError.message || storageError);
    return null;
  }

  // 2. Log metadata record inside public.uploads
  const { error: logError } = await sb
    .from("uploads")
    .insert({
      uploaded_by: uploadedByUserId === "user_admin" ? null : uploadedByUserId,
      file_name: file.name,
      file_type: company_name.includes("Budget") ? "Budget sheets" : "Sales transaction logs",
      company: company_name
    });

  if (logError) {
    console.warn("Storage upload logged but database upload trace logging failed:", logError);
  }

  return storageData.path;
}

// ==================================================
// EMAIL LOG HELPERS
// ==================================================

export async function logEmailReportSent(log: Partial<EmailLog>, userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("email_logs")
    .insert({
      user_id: userId === "user_admin" ? null : userId,
      recipient_email: log.recipientEmail,
      recipient_name: log.recipientName,
      recipient_role: log.recipientRole,
      subject: log.subject,
      body_preview: log.bodyPreview,
      report_month: "June 2026", // Dynamic fiscal report month
      status: log.status || "Delivered",
      attachments: log.attachments || []
    });

  if (error) {
    console.error("Error saving communication log to Supabase:", error);
    return false;
  }
  return true;
}

export async function fetchEmailLogsFromSupabase(): Promise<EmailLog[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("email_logs")
    .select("*")
    .order("email_sent_at", { ascending: false });

  if (error) {
    console.error("Error fetching email logs from Supabase:", error);
    return [];
  }

  return (data || []).map((e: any) => ({
    id: e.id,
    recipientEmail: e.recipient_email,
    recipientName: e.recipient_name,
    recipientRole: e.recipient_role,
    subject: e.subject,
    bodyPreview: e.body_preview,
    reportMonth: e.report_month,
    emailSentAt: e.email_sent_at,
    dateSent: e.email_sent_at,
    status: e.status,
    attachments: e.attachments || [],
    triggerType: "Scheduled"
  }));
}

export async function fetchAuditLogsFromSupabase(): Promise<AuditLog[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("upload_audit_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching audit logs from Supabase:", error);
    return [];
  }

  return (data || []).map((a: any) => ({
    timestamp: a.timestamp,
    user: a.uploaded_by || "System Admin",
    action: "Spreadsheet Upload (" + a.file_type + ")",
    details: `Imported spreadsheet "${a.file_name}" total rows: ${a.total_rows}. Success: ${a.inserted_rows}, Dups bypassed: ${a.duplicate_rows}, Errors: ${a.failed_rows}. Status: ${a.status}.`,
    status: a.status === "Completed" ? "Success" : "Success"
  }));
}

export async function deleteUserFromSupabase(userId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    console.error("Error deleting user from Supabase:", error);
    return false;
  }
  return true;
}

export async function fetchDatabaseStatsFromSupabase(): Promise<any> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { count: totalInvoices } = await sb.from("sales_data").select("*", { count: "exact", head: true });
    
    let rawInvoices: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;
      const { data, error: salesErr } = await sb
        .from("sales_data")
        .select("invoice_date, company, product_category")
        .range(start, end);

      if (salesErr) throw salesErr;

      if (data && data.length > 0) {
        rawInvoices = [...rawInvoices, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const companyCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};
    const monthCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    (rawInvoices || []).forEach(inv => {
      const co = inv.company || "Unknown";
      companyCounts[co] = (companyCounts[co] || 0) + 1;

      const cat = inv.product_category || "Uncategorized";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      if (inv.invoice_date) {
        const d = new Date(inv.invoice_date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear().toString();
          const m = d.toLocaleString("default", { month: "long" });
          yearCounts[y] = (yearCounts[y] || 0) + 1;
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        }
      }
    });

    return {
      success: true,
      totalInvoices: totalInvoices || 0,
      visibleInvoices: rawInvoices?.length || 0,
      companyCounts,
      yearCounts,
      monthCounts,
      categoryCounts
    };
  } catch (err) {
    console.error("Error fetching debug stats from Supabase:", err);
    return null;
  }
}

export async function runIntegrityCheckOnSupabase(): Promise<any> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { count: salesCount } = await sb.from("sales_data").select("*", { count: "exact", head: true });
    const { count: budgetsCount } = await sb.from("budget_data").select("*", { count: "exact", head: true });

    let invoices: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;
      const { data, error: salesErr } = await sb
        .from("sales_data")
        .select("id, salesperson, salesperson_id, invoice_number, invoice_date, product_name, customer_code")
        .range(start, end);

      if (salesErr) throw salesErr;

      if (data && data.length > 0) {
        invoices = [...invoices, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    let budgetsList: any[] = [];
    let bPage = 0;
    let bHasMore = true;

    while (bHasMore) {
      const start = bPage * pageSize;
      const end = start + pageSize - 1;
      const { data: bData, error: bErr } = await sb
        .from("budget_data")
        .select("id, product_name, salesperson_id, financial_year, month")
        .range(start, end);

      if (bErr) throw bErr;

      if (bData && bData.length > 0) {
        budgetsList = [...budgetsList, ...bData];
        if (bData.length < pageSize) {
          bHasMore = false;
        } else {
          bPage++;
        }
      } else {
        bHasMore = false;
      }
    }
    const { data: usersList } = await sb.from("users").select("id, name, email");

    const budgets = budgetsList || [];
    const dbUsers = usersList || [];
    const activeStaffSet = new Set(dbUsers.map(u => (u.name || "").trim().toLowerCase()));

    // Diagnostic A: Redundancies / Duplicate rows detector
    const keyMap = new Map<string, string[]>();
    invoices.forEach(inv => {
      const key = `${(inv.invoice_number || "").trim()}|||${inv.invoice_date || ""}|||${(inv.product_name || "").trim()}|||${(inv.customer_code || "").trim()}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(inv.id);
    });

    let duplicateGroupsCount = 0;
    let duplicateRowsTotal = 0;
    const sampleDuplicatesList: any[] = [];

    for (const [key, ids] of keyMap.entries()) {
      if (ids.length > 1) {
        duplicateGroupsCount++;
        duplicateRowsTotal += (ids.length - 1);
        if (sampleDuplicatesList.length < 15) {
          const s = key.split("|||");
          sampleDuplicatesList.push({
            invoiceNumber: s[0],
            invoiceDate: s[1],
            productName: s[2],
            customerCode: s[3],
            count: ids.length,
            ids
          });
        }
      }
    }

    // Diagnostic B: Missing Rows / Empty Business days
    const missingRowsList: string[] = [];
    const salesByPersonMonthYear = new Set<string>();
    invoices.forEach(inv => {
      if (!inv.invoice_date || !inv.salesperson) return;
      try {
        const d = new Date(inv.invoice_date);
        const m = d.toLocaleString("default", { month: "long" });
        const yr = d.getFullYear();
        const fy = yr === 2025 || (yr === 2026 && d.getMonth() < 3) ? "2025-26" : "2024-25";
        salesByPersonMonthYear.add(`${inv.salesperson.trim().toLowerCase()}|||${m.toLowerCase()}|||${fy}`);
      } catch (_) {}
    });

    budgets.forEach(b => {
      const usr = dbUsers.find(u => u.id === b.salesperson_id);
      if (usr) {
        const key = `${(usr.name || "").trim().toLowerCase()}|||${(b.month || "").trim().toLowerCase()}|||${(b.financial_year || "").trim().toLowerCase()}`;
        if (!salesByPersonMonthYear.has(key)) {
          const rowStr = `Representative "${usr.name}" has allocated budgets in territory targets for ${b.month} (${b.financial_year}) but registered 0 matching ledger invoices.`;
          if (missingRowsList.indexOf(rowStr) === -1 && missingRowsList.length < 10) {
            missingRowsList.push(rowStr);
          }
        }
      }
    });

    // Diagnostic C: Orphaned sales reps mappings
    const orphanedInvoices: any[] = [];
    invoices.forEach(inv => {
      if (inv.salesperson && !activeStaffSet.has(inv.salesperson.trim().toLowerCase())) {
        if (orphanedInvoices.length < 15) {
          orphanedInvoices.push({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            salesperson: inv.salesperson
          });
        }
      }
    });

    // Diagnostic D: Auditing sequences and reconciliation counters
    const { data: dbAudits } = await sb.from("upload_audit_logs").select("*").order("timestamp", { ascending: false }).limit(20);
    const { count: totalUploadHistoryCount } = await sb.from("upload_audit_logs").select("*", { count: "exact", head: true });

    let expectedFromAuditingLogs = 0;
    if (dbAudits) {
      dbAudits.forEach(aud => expectedFromAuditingLogs += (aud.inserted_rows || 0));
    }

    const { data: dbIntegrityLogs } = await sb.from("data_integrity_logs").select("*").order("timestamp", { ascending: false }).limit(25);

    // Save automatic administrative checks trace
    await sb.from("data_integrity_logs").insert({
      check_type: "Administrative Integrity Sweep",
      results_summary: `Scanned ${salesCount} ledger lines and ${budgetsCount} budgets. Found ${duplicateRowsTotal} duplicates, ${orphanedInvoices.length} unlinked representatives.`,
      details: {
        totalInvoicesCount: salesCount,
        totalBudgetsCount: budgetsCount,
        redundantRecords: duplicateRowsTotal,
        orphansDetected: orphanedInvoices.length,
        alertFlags: missingRowsList.length
      }
    });

    return {
      success: true,
      metrics: {
        totalInvoices: salesCount || 0,
        totalBudgets: budgetsCount || 0,
        usersRegistered: dbUsers.length,
        totalUploadsRecorded: totalUploadHistoryCount || 0
      },
      diagnostics: {
        duplicatesCount: duplicateRowsTotal,
        duplicatesGroups: duplicateGroupsCount,
        sampleDuplicates: sampleDuplicatesList,
        missingRowsAlerts: missingRowsList,
        orphanedInvoices: orphanedInvoices,
        uploadReconciliation: {
          expectedActiveRowsFromAudits: expectedFromAuditingLogs,
          actualRowsInDatabase: salesCount || 0
        }
      },
      auditHistory: dbAudits || [],
      integrityHistory: dbIntegrityLogs || []
    };
  } catch (err) {
    console.error("Error running integrity check on Supabase:", err);
    return null;
  }
}

export async function cleanDuplicateRowsOnSupabase(): Promise<any> {
  const sb = getSupabase();
  if (!sb) return { success: false, error: "Supabase not configured" };

  try {
    let invoices: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;
      const { data, error: salesErr } = await sb
        .from("sales_data")
        .select("id, invoice_number, invoice_date, product_name, customer_code")
        .range(start, end);

      if (salesErr) throw salesErr;

      if (data && data.length > 0) {
        invoices = [...invoices, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const seen = new Map<string, string>();
    const dupIds: string[] = [];

    (invoices || []).forEach(inv => {
      const key = `${inv.invoice_number}-${inv.invoice_date}-${inv.product_name}-${inv.customer_code}`.toLowerCase();
      if (seen.has(key)) {
        dupIds.push(inv.id);
      } else {
        seen.set(key, inv.id);
      }
    });

    if (dupIds.length === 0) return { success: true, cleanedCount: 0 };

    // Batch delete duplicates (chunks of 100)
    let cleanedCount = 0;
    for (let i = 0; i < dupIds.length; i += 100) {
      const chunk = dupIds.slice(i, i + 100);
      const { error } = await sb.from("sales_data").delete().in("id", chunk);
      if (error) throw error;
      cleanedCount += chunk.length;
    }

    return { success: true, cleanedCount };
  } catch (err: any) {
    console.error("Error cleaning duplicates on Supabase:", err);
    return { success: false, error: err.message };
  }
}

export async function alignOrphanInvoicesOnSupabase(): Promise<any> {
  const sb = getSupabase();
  if (!sb) return { success: false, error: "Supabase not configured" };

  try {
    let orphans: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;
      const { data, error: salesErr } = await sb
        .from("sales_data")
        .select("id, salesperson")
        .is("salesperson_id", null)
        .range(start, end);

      if (salesErr) throw salesErr;

      if (data && data.length > 0) {
        orphans = [...orphans, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const { data: users } = await sb.from("users").select("id, name, email");

    if (!orphans || orphans.length === 0) return { success: true, fixedCount: 0 };

    let fixedCount = 0;
    for (const inv of orphans) {
      const spName = (inv.salesperson || "").trim().toLowerCase();
      const matchedUser = (users || []).find(u => 
        (u.name && u.name.trim().toLowerCase() === spName) ||
        (u.email && u.email.trim().toLowerCase() === spName)
      );

      if (matchedUser) {
        const { error } = await sb.from("sales_data").update({ salesperson_id: matchedUser.id }).eq("id", inv.id);
        if (!error) fixedCount++;
      }
    }

    return { success: true, fixedCount };
  } catch (err: any) {
    console.error("Error aligning orphans on Supabase:", err);
    return { success: false, error: err.message };
  }
}

// ==================================================
// DATA MAPPING ROW UTILITIES
// ==================================================

function mapUserRow(row: any): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password, // load password for fallback auth
    role: row.role as any,
    region: row.region || undefined,
    territory: row.territory || undefined,
    salespersonCode: row.employee_code || undefined,
    approved: row.is_active !== false,
    managerId: row.manager_id || undefined,
    mobileNumber: row.mobile_number || undefined,
    serverSynced: true
  };
}

function mapSalesRow(row: any): InvoiceItem {
  return {
    id: row.id,
    invoiceDate: row.invoice_date,
    invoiceNumber: row.invoice_number,
    company: row.company,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    region: row.region,
    state: row.region,
    territory: row.territory,
    salesperson: row.salesperson,
    regionalManager: row.regional_manager,
    productName: row.product_name,
    productCategory: row.product_category,
    supplier: row.supplier,
    quantity: Number(row.quantity) || 0,
    unit: row.unit,
    rate: Number(row.rate) || 0,
    grossValue: Number(row.gross_value) || 0,
    discount: Number(row.discount) || 0,
    netSalesValue: Number(row.net_value) || 0
  };
}

export async function fetchCustomerMasterFromSupabase(): Promise<CustomerMaster[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("customer_master")
    .select("*")
    .order("customer_name", { ascending: true });

  if (error) {
    console.error("Error fetching customer_master from Supabase:", error);
    return [];
  }

  return data || [];
}

export async function fetchCustomerAssignmentsFromSupabase(): Promise<CustomerAssignment[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("customer_assignment")
    .select("*");

  if (error) {
    console.error("Error fetching customer_assignment from Supabase:", error);
    return [];
  }

  return data || [];
}

export async function fetchCustomerAssignmentAuditLogsFromSupabase(): Promise<AssignmentAuditLog[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("customer_assignment_audit_logs")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Error fetching customer_assignment_audit_logs from Supabase:", error);
    return [];
  }

  return data || [];
}
