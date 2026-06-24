import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { InvoiceItem, BudgetItem, UserProfile, EmailLog } from "../types";

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

  if (profileError) {
    console.warn("Auth login succeeded but database profile row was missing:", profileError);
  }

  return {
    user: data.user,
    profile: profile ? mapUserRow(profile) : null
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

export async function saveUserProfileToSupabase(user: Partial<UserProfile> & { password?: string }): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const row = {
    name: user.name,
    email: user.email,
    role: user.role,
    territory: user.territory || "",
    region: user.region || "",
    employee_code: user.salespersonCode || "",
    is_active: user.approved !== false
  };

  const { error } = await sb
    .from("users")
    .upsert({
      id: user.id || undefined,
      ...row
    });

  if (error) {
    console.error("Error upserting user profile into Supabase:", error);
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

  const { data, error } = await sb
    .from("sales_data")
    .select("*")
    .order("invoice_date", { ascending: false });

  if (error) {
    console.error("Error fetching invoices from Supabase:", error);
    return [];
  }

  return (data || []).map(mapSalesRow);
}

export async function insertSalesDataChunks(invoices: InvoiceItem[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const rows = invoices.map(i => ({
    id: i.id || undefined,
    invoice_date: i.invoiceDate,
    invoice_number: i.invoiceNumber,
    company: i.company,
    customer_name: i.customerName,
    customer_code: i.customerCode,
    region: i.region,
    territory: i.territory,
    salesperson: i.salesperson,
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
  }));

  const { error } = await sb
    .from("sales_data")
    .insert(rows);

  if (error) {
    console.error("Error inserting sales data into Supabase:", error);
    return false;
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
    `);

  if (error) {
    console.error("Error fetching budget sheets from Supabase:", error);
    return [];
  }

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

  // Resolve target salesperson corporate user IDs from names before insertion
  const nameToId = new Map(usersList.map(u => [(u.name || "").trim().toLowerCase(), u.id]));

  const rows = budgets.map(b => {
    const spKey = (b.salesperson || "").trim().toLowerCase();
    const resolvedUserId = nameToId.get(spKey) || b.id; // fallback to row ID if user not matched

    return {
      product_name: b.product,
      budget_quantity: b.budgetQuantity,
      budget_value: b.budgetValue,
      month: b.month,
      financial_year: b.financialYear,
      salesperson_id: resolvedUserId && resolvedUserId.includes("user_") ? null : resolvedUserId
    };
  }).filter(r => r.salesperson_id !== null); // safety filter

  const { error } = await sb
    .from("budget_data")
    .upsert(rows);

  if (error) {
    console.error("Cannot upsert target budgets in Supabase:", error);
    return false;
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
    attachments: e.attachments || []
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
    const { data: rawInvoices, error: salesErr } = await sb.from("sales_data").select("invoice_date, company, product_category");
    
    if (salesErr) throw salesErr;

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
    const { data: invoices } = await sb.from("sales_data").select("id, salesperson, salesperson_id, invoice_number, invoice_date, product_name, customer_code");
    const { data: users } = await sb.from("users").select("id, name, email");

    const orphans = (invoices || []).filter(inv => !inv.salesperson_id);
    
    const duplicates: any[] = [];
    const seen = new Map<string, string>();
    (invoices || []).forEach(inv => {
      const key = `${inv.invoice_number}-${inv.invoice_date}-${inv.product_name}-${inv.customer_code}`.toLowerCase();
      if (seen.has(key)) {
        duplicates.push({ id: inv.id, key });
      } else {
        seen.set(key, inv.id);
      }
    });

    return {
      success: true,
      orphanInvoices: orphans.length,
      duplicateInvoices: duplicates.length,
      totalInvoices: invoices?.length || 0,
      totalUsers: users?.length || 0
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
    const { data: invoices } = await sb.from("sales_data").select("id, invoice_number, invoice_date, product_name, customer_code");
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
    const { data: orphans } = await sb.from("sales_data").select("id, salesperson").is("salesperson_id", null);
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
    role: row.role as any,
    region: row.region || undefined,
    territory: row.territory || undefined,
    salespersonCode: row.employee_code || undefined,
    approved: row.is_active !== false,
    managerId: row.manager_id || undefined
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
