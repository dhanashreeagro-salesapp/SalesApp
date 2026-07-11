/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import compression from "compression";

dotenv.config();

export const app = express();
const PORT = 3000;

app.use(compression());
app.use(express.json({ limit: "50mb" }));

// Resolve DATA_DIR cleanly and robustly whether executed in dev mode or as a bundled production file
const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Fallback & File Sync setup
let localInvoices: any[] = [];
let localBudgets: any[] = [];
let localAuditLogs: any[] = [];
let localEmailLogs: any[] = [];
let localUsers: any[] = [];
let backupInvoices: any[] | null = null;
let backupBudgets: any[] | null = null;

// Lazy Load seed data inside server to write initial DB
import { SEED_INVOICES, SEED_BUDGETS, SEED_USERS, INITIAL_AUDIT_LOGS, INITIAL_EMAIL_LOGS } from "../src/data/seedData";

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

let sbAdmin: any = null;
let supabaseSyncEnabled = false;
function getSupabaseAdminClient() {
  if (sbAdmin) return sbAdmin;
  const url = sanitizeEnvVal(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  const key = sanitizeEnvVal(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "");
  if (!url || !key || isPlaceholderVal(url) || isPlaceholderVal(key)) {
    return null;
  }
  try {
    sbAdmin = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    return sbAdmin;
  } catch (err) {
    console.error("Failed to initialize server-side Supabase client:", err);
    return null;
  }
}

async function fetchAllSalesFromSupabase(
  sb: any,
  selectStr: string = "*",
  orderOptions?: { column: string; ascending?: boolean },
  isNullFilter?: string
): Promise<any[]> {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    let query = sb.from("sales_data").select(selectStr);
    
    if (isNullFilter) {
      query = query.is(isNullFilter, null);
    }
    
    if (orderOptions) {
      query = query.order(orderOptions.column, { ascending: orderOptions.ascending !== false });
    }
    
    query = query.range(start, end);

    const { data, error } = await query;
    if (error) {
      throw error;
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
  return allRows;
}

async function fetchAllBudgetsFromSupabase(
  sb: any,
  selectStr: string = "*"
): Promise<any[]> {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data, error } = await sb
      .from("budget_data")
      .select(selectStr)
      .range(start, end);

    if (error) {
      throw error;
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
  return allRows;
}

async function syncLocalToSupabase(scope: "users" | "invoices" | "budgets" | "all" = "all") {
  const sb = getSupabaseAdminClient();
  if (!sb) return;

  if (!supabaseSyncEnabled) {
    console.log("Supabase replication bypassed (disabled or fallback mode active).");
    return;
  }

  try {
    console.log(`Synchronizing current in-memory dataset state to Supabase tables (Scope: ${scope})...`);

    // 1. Sync users
    if ((scope === "all" || scope === "users") && localUsers.length > 0) {
      // Sort users by role priority to avoid foreign key violations (manager must exist first)
      const rolePriority: Record<string, number> = {
        "Admin": 1,
        "Sales Director": 2,
        "Regional Manager": 3,
        "Salesperson": 4
      };
      
      const sortedLocalUsers = [...localUsers].sort((a, b) => (rolePriority[a.role] || 5) - (rolePriority[b.role] || 5));

      const userRows = sortedLocalUsers.map(u => {
        // Resolve manager_id
        const mgr = sortedLocalUsers.find(m => m.name === u.managerName);
        const manager_id = mgr ? (mgr.id && !mgr.id.includes("user_") ? mgr.id : null) : null;

        return {
          id: u.id && u.id.includes("user_") ? undefined : u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          region: u.region || "",
          territory: u.territory || "",
          employee_code: u.salespersonCode || "",
          is_active: u.approved !== false,
          password: u.password || "password123",
          manager_id: manager_id
        };
      }).filter(u => u.email);

      for (const row of userRows) {
        const { error: ue } = await sb.from("users").upsert(row, { onConflict: "email" });
        if (ue) console.warn("Supabase user sync table insert fail:", ue.message, row.email);
      }
    }

    // 2. Sync sales data
    if ((scope === "all" || scope === "invoices") && localInvoices.length > 0) {
      await sb.from("sales_data").delete().neq("invoice_number", "");
      const chunkSize = 200;
      for (let i = 0; i < localInvoices.length; i += chunkSize) {
        const chunk = localInvoices.slice(i, i + chunkSize);
        const invoiceRows = chunk.map(inv => ({
          invoice_date: inv.invoiceDate,
          invoice_number: inv.invoiceNumber,
          company: inv.company,
          customer_name: inv.customerName,
          customer_code: inv.customerCode,
          region: inv.region,
          territory: inv.territory,
          salesperson: inv.salesperson,
          regional_manager: inv.regionalManager,
          product_name: inv.productName,
          product_category: inv.productCategory,
          supplier: inv.supplier,
          quantity: inv.quantity,
          unit: inv.unit,
          rate: inv.rate,
          gross_value: inv.grossValue,
          discount: inv.discount,
          net_value: inv.netSalesValue
        }));

        const { error: se } = await sb.from("sales_data").insert(invoiceRows);
        if (se) {
          console.warn(`Sales data insert chunk issue at offset ${i}:`, se.message);
        }
      }
    }

    // 3. Sync budgets data
    if ((scope === "all" || scope === "budgets") && localBudgets.length > 0) {
      await sb.from("budget_data").delete().neq("product_name", "");
      const { data: dbUsers } = await sb.from("users").select("id, name");
      const nameToId = new Map((dbUsers || []).map((u: any) => [u.name.toLowerCase().trim(), u.id]));

      const budgetRows = localBudgets.map(b => {
        const spKey = (b.salesperson || "").trim().toLowerCase();
        const salespersonId = nameToId.get(spKey) || null;
        return {
          product_name: b.product,
          budget_quantity: b.budgetQuantity,
          budget_value: b.budgetValue,
          month: b.month,
          financial_year: b.financialYear,
          salesperson_id: salespersonId
        };
      }).filter(r => r.salesperson_id !== null);

      if (budgetRows.length > 0) {
        const { error: be } = await sb.from("budget_data").insert(budgetRows);
        if (be) console.warn("Budget targets sync upload issue:", be.message);
      }
    }

    // 4. Sync email logs
    if (scope === "all" && localEmailLogs.length > 0) {
      const { data: dbUsers } = await sb.from("users").select("id, email");
      const emailToId = new Map((dbUsers || []).map((u: any) => [u.email.toLowerCase().trim(), u.id]));

      const emailRows = localEmailLogs.map(el => {
        const emailKey = (el.recipientEmail || "").trim().toLowerCase();
        const userId = emailToId.get(emailKey) || null;
        return {
          user_id: userId,
          recipient_email: el.recipientEmail,
          recipient_name: el.recipientName,
          recipient_role: el.recipientRole,
          subject: el.subject,
          body_preview: el.bodyPreview,
          report_month: "May 2026",
          status: el.status || "Delivered",
          attachments: el.attachments || []
        };
      });

      if (emailRows.length > 0) {
         await sb.from("email_logs").delete().neq("subject", "");
         const { error: ee } = await sb.from("email_logs").insert(emailRows);
         if (ee) console.warn("Email reports sync upload issue:", ee.message);
      }
    }

    console.log("Supabase datalayer synchronization completed successfully.");
  } catch (err: any) {
    console.error("Supabase dynamic replication error failed:", err.message);
  }
}

async function loadDB() {
  const sb = getSupabaseAdminClient();
  if (sb) {
    try {
      console.log("Supabase recognized. Attributing load operation to PostgreSQL backend...");

      // Proactively ensure public storage bucket 'spreadsheets' exists
      try {
        const { data: buckets, error: bError } = await sb.storage.listBuckets();
        if (!bError && buckets) {
          const hasBucket = buckets.some((b: any) => b.name === "spreadsheets");
          if (!hasBucket) {
            console.log("[Supabase Bucket Provision] Bucket 'spreadsheets' not found. Creating...");
            const { error: bkCreateErr } = await sb.storage.createBucket("spreadsheets", {
              public: true
            });
            if (bkCreateErr) {
              console.warn("[Supabase Bucket Provision Warning] Could not create spreadsheets bucket:", bkCreateErr.message);
            } else {
              console.log("[Supabase Bucket Provision] Created spreadsheets bucket successfully!");
            }
          } else {
            console.log("[Supabase Bucket Provision] Bucket 'spreadsheets' already exists.");
          }
        }
      } catch (err: any) {
        console.warn("[Supabase Bucket Provision Error] Failed to list or create spreadsheets bucket:", err.message);
      }

      const { data: usersData, error: ue } = await sb.from("users").select("*");
      if (ue) throw ue;

      const salesData = await fetchAllSalesFromSupabase(sb, "*");

      const budgetsData = await fetchAllBudgetsFromSupabase(sb, `
        id,
        product_name,
        budget_quantity,
        budget_value,
        month,
        financial_year,
        salesperson_id
      `);

      const { data: emailLogsData } = await sb.from("email_logs").select("*");
      supabaseSyncEnabled = true;

      let loadedInvoices: any[] = [];
      let loadedBudgets: any[] = [];
      let loadedUsers: any[] = [];
      let loadedEmailLogs: any[] = [];

      if (usersData && usersData.length > 0) {
        loadedUsers = usersData.map((u: any) => ({
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
      }

      if (salesData && salesData.length > 0) {
        loadedInvoices = salesData.map((row: any) => ({
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
        }));
      }

      if (budgetsData && budgetsData.length > 0) {
        loadedBudgets = budgetsData.map((b: any) => {
          const spUser = loadedUsers.find((u: any) => u.id === b.salesperson_id);
          const sName = spUser?.name || "Representative";
          const territoryStr = spUser?.territory || "";
          const regionStr = spUser?.region || "";
          const managerUser = spUser?.managerId ? loadedUsers.find((u: any) => u.id === spUser.managerId) : null;
          const regName = managerUser?.name || "";
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

      if (emailLogsData && emailLogsData.length > 0) {
        loadedEmailLogs = emailLogsData.map((el: any) => ({
          id: el.id,
          dateSent: el.email_sent_at,
          recipientEmail: el.recipient_email,
          recipientName: el.recipient_name,
          recipientRole: el.recipient_role,
          subject: el.subject,
          bodyPreview: el.body_preview,
          status: el.status,
          attachments: el.attachments || [],
          triggerType: "Scheduled"
        }));
      }

      if (loadedUsers.length > 0 || loadedInvoices.length > 0) {
        localUsers = loadedUsers;
        localInvoices = loadedInvoices;
        localBudgets = loadedBudgets;
        localEmailLogs = loadedEmailLogs;
        localAuditLogs = [
          {
            timestamp: new Date().toISOString(),
            user: "System",
            action: "Load Supabase Store",
            details: `Successfully fetched dataset from Supabase instance. Users: ${localUsers.length}, Invoices: ${localInvoices.length}, Budgets: ${localBudgets.length}`,
            status: "Success"
          }
        ];
        console.log(`Supabase dynamic loaded: Users: ${localUsers.length}, Invoices: ${localInvoices.length}, Budgets: ${localBudgets.length}`);
        return;
      }
    } catch (err: any) {
      supabaseSyncEnabled = false;
      console.warn("=========================================================================");
      console.warn("⚠️  SUPABASE INITIALIZATION RECOMMENDATION:");
      console.warn("Failed to read from Supabase instance:", err.message);
      console.warn("If you are configuring a new Supabase environment, please execute the SQL in '/supabase_schema.sql'");
      console.warn("inside your Supabase Dashboard SQL Editor (https://database.new) to seed schemas and RLS roles.");
      console.warn("The server is gracefully falling back to your persistent local JSON db fallback ('data/db.json').");
      console.warn("=========================================================================");
    }
  }

  // File fallback system disabled: Direct writes to disk are removed. Everything is in-memory only when Supabase is offline.
  localInvoices = [];
  localBudgets = [];
  localAuditLogs = [];
  localEmailLogs = [];
  localUsers = [
    {
      id: "user_admin",
      name: "System Admin",
      email: "admin@agroiq.com",
      role: "Admin",
      password: "admin123",
      approved: true
    },
    {
      id: "user_dhanashree",
      name: "Dhanashree Agro",
      email: "dhanashree.agro@gmail.com",
      role: "Admin",
      password: "MyWorld99",
      approved: true
    }
  ];

  SEED_USERS.forEach(seedUser => {
    if (!localUsers.some(u => 
      u.email && seedUser.email && u.email.toLowerCase() === seedUser.email.toLowerCase()
    )) {
      localUsers.push({ ...seedUser, approved: true, password: "password123" });
    }
  });

  console.log("File database loading skipped: db.json persistence layer has been removed.");
}

function saveDB(scope: "users" | "invoices" | "budgets" | "all" = "all") {
  // Persistence strictly disabled: No longer writing anything to private db.json file
  try {
    // Sync to Supabase in background if valid client is available
    syncLocalToSupabase(scope).catch(err => {
      console.warn("Dispatched background Supabase synchronization warning:", err);
    });
    return true;
  } catch (e) {
    console.error("Failed to process saveDB background sync trigger", e);
    return false;
  }
}

function resetToDefaultSeed() {
  localInvoices = [];
  localBudgets = [];
  localAuditLogs = [];
  localEmailLogs = [];
  backupInvoices = null;
  backupBudgets = null;
  localUsers = [
    {
      id: "user_admin",
      name: "System Admin",
      email: "admin@agroiq.com",
      role: "Admin",
      password: "admin123",
      approved: true
    },
    {
      id: "user_dhanashree",
      name: "Dhanashree Agro",
      email: "dhanashree.agro@gmail.com",
      role: "Admin",
      password: "MyWorld99",
      approved: true
    }
  ];
  saveDB();
  console.log("Database initialized with empty collections.");
}

loadDB();

// Initialize Gemini Client safely
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in environment secrets. AI insights will use local summaries.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}


// --- API ROUTES ---

// Expose public Supabase configuration variables dynamically
app.get("/api/supabase-config", (req, res) => {
  res.json({
    url: sanitizeEnvVal(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""),
    key: sanitizeEnvVal(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "")
  });
});

// Admin diagnostic and debugging stats endpoint
app.get("/api/admin/debug-stats", async (req, res) => {
  const sb = getSupabaseAdminClient();
  if (!sb) {
    return res.status(400).json({ error: "Supabase client not initialized or offline." });
  }
  try {
    // Select essential columns from active dataset bypassing RLS
    const allSales = await fetchAllSalesFromSupabase(sb, "company, invoice_date");

    const totalRows = allSales?.length || 0;
    
    // Group occurrences for debugging distribution checks
    const companyCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};
    const monthCounts: Record<string, number> = {};

    (allSales || []).forEach((row: any) => {
      const co = String(row.company || "Unknown").trim();
      companyCounts[co] = (companyCounts[co] || 0) + 1;

      if (row.invoice_date) {
        const d = new Date(row.invoice_date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear().toString();
          const m = d.toLocaleString("default", { month: "long" });
          yearCounts[y] = (yearCounts[y] || 0) + 1;
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        }
      }
    });

    const { count: totalBudgets } = await sb.from("budget_data").select("*", { count: "exact", head: true });

    return res.json({
      success: true,
      totalInvoices: totalRows,
      totalBudgets: totalBudgets || 0,
      companyCounts,
      yearCounts,
      monthCounts,
    });
  } catch (error: any) {
    console.error("Failed to compile admin debugger stats dashboard view:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to query database statistics." });
  }
});

// 1. Get entire database
app.get("/api/db", async (req, res) => {
  const sb = getSupabaseAdminClient();
  if (sb) {
    try {
      console.log("Direct-DB-Read: Querying live Supabase Postgres tables for synchronization...");
      // Fetch Users
      const { data: dbUsers, error: ue } = await sb.from("users").select("*");
      if (ue) throw ue;
      const formattedUsers = (dbUsers || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password || "password123",
        role: u.role,
        region: u.region || undefined,
        territory: u.territory || undefined,
        salespersonCode: u.employee_code || undefined,
        approved: u.is_active !== false,
        managerId: u.manager_id || undefined
      }));

      // Fetch Sales Data
      const dbSales = await fetchAllSalesFromSupabase(sb, "*", { column: "invoice_date", ascending: false });
      const formattedInvoices = (dbSales || []).map((row: any) => ({
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
        netSalesValue: Number(row.net_value) || 0,
        godownName: "Main Godown",
        voucherType: "Sales"
      }));

      // Fetch Budgets
      const dbBudgets = await fetchAllBudgetsFromSupabase(sb, "*");
      const formattedBudgets = (dbBudgets || []).map((b: any) => {
        const u = formattedUsers.find(elem => elem.id === b.salesperson_id);
        return {
          id: b.id,
          salesperson: u ? u.name : "Unassigned rep",
          salesperson_id: b.salesperson_id,
          productName: b.product_name,
          product: b.product_name,
          budgetQuantity: Number(b.budget_quantity) || 0,
          budgetValue: Number(b.budget_value) || 0,
          month: b.month,
          financialYear: b.financial_year
        };
      });

      // Fetch Email Logs
      const { data: dbEmails } = await sb.from("email_logs").select("*").order("email_sent_at", { ascending: false });
      const formattedEmailLogs = (dbEmails || []).map((e: any) => ({
        id: e.id,
        recipientEmail: e.recipient_email,
        recipientName: e.recipient_name,
        recipientRole: e.recipient_role,
        subject: e.subject,
        bodyPreview: e.body_preview,
        reportMonth: e.report_month,
        emailSentAt: e.email_sent_at,
        status: e.status,
        attachments: e.attachments || []
      }));

      // Fetch Audit Logs (convert PostgreSQL entries to client logs)
      const { data: dbAudits } = await sb.from("upload_audit_logs").select("*").order("timestamp", { ascending: false }).limit(40);
      const formattedAudits = (dbAudits || []).map((a: any) => ({
        timestamp: a.timestamp,
        user: a.uploaded_by || "System Admin",
        action: "Spreadsheet Upload (" + a.file_type + ")",
        details: `Imported spreadsheet "${a.file_name}" total rows: ${a.total_rows}. Success: ${a.inserted_rows}, Dups bypassed: ${a.duplicate_rows}, Errors: ${a.failed_rows}. Status: ${a.status}.`,
        status: a.status === "Completed" ? "Success" : "Success"
      }));

      // Update backend server local cache as hot standby
      localInvoices = formattedInvoices;
      localBudgets = formattedBudgets;
      localUsers = formattedUsers;
      localEmailLogs = formattedEmailLogs;

      return res.json({
        invoices: formattedInvoices,
        budgets: formattedBudgets,
        auditLogs: [...formattedAudits, ...localAuditLogs],
        emailLogs: formattedEmailLogs,
        users: formattedUsers,
      });
    } catch (err: any) {
      console.warn("Direct-DB-Read-Warn: Fallback to local memory file due to database issue:", err.message);
    }
  }

  // Local standard in-memory fallback
  res.json({
    invoices: localInvoices,
    budgets: localBudgets,
    auditLogs: localAuditLogs,
    emailLogs: localEmailLogs,
    users: localUsers,
  });
});

// Create/Update User profile (used by both general Registration and Admin settings panels)
app.post("/api/users/save", async (req, res) => {
  const { user, initiator } = req.body;
  if (!user || !user.email) {
    return res.status(400).json({ error: "Missing required profile parameters" });
  }

  const emailLower = user.email.trim().toLowerCase();
  const duplicateUser = localUsers.find(u => u.email.trim().toLowerCase() === emailLower && u.id !== user.id);
  if (duplicateUser) {
    return res.status(400).json({ error: "A user with this Corporate ID (EMAIL) already exists." });
  }

  const updatedUser = {
    ...user,
    id: user.id || `user_${Date.now()}`,
    password: user.password || "password123"
  };

  // Sync to Supabase directly first if available
  const sb = getSupabaseAdminClient();
  let supabaseSynced = false;
  if (sb) {
    try {
      // Resolve manager_id
      let manager_id = updatedUser.managerId && !updatedUser.managerId.startsWith("user_") ? updatedUser.managerId : null;
      if (!manager_id && updatedUser.managerName) {
        const { data: dbUsers } = await sb.from("users").select("id, name");
        const mgr = (dbUsers || []).find(u => u.name.trim().toLowerCase() === updatedUser.managerName!.trim().toLowerCase());
        if (mgr) {
          manager_id = mgr.id;
        }
      }

      const userRow = {
        // Only strip if it's the client-side mock string
        id: updatedUser.id.startsWith("user_") ? undefined : updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        region: updatedUser.region || "",
        territory: updatedUser.territory || "",
        employee_code: updatedUser.salespersonCode || "",
        is_active: updatedUser.approved !== false,
        password: updatedUser.password || "password123",
        manager_id: manager_id
      };

      const { data: upserted, error: ue } = await sb.from("users").upsert(userRow, { onConflict: "email" }).select();
      if (ue) throw ue;
      if (upserted && upserted[0]) {
        updatedUser.id = upserted[0].id;
      }
      supabaseSynced = true;
    } catch (err: any) {
      console.error("Profile write failure to Supabase:", err.message);
      return res.status(500).json({ error: `Database write failure: ${err.message}. Please configure SUPABASE_SERVICE_ROLE_KEY or disable Row Level Security (RLS) on the 'users' table in the Supabase console.` });
    }
  }

  let indexToUpdate = localUsers.findIndex(u => u.email.trim().toLowerCase() === emailLower);
  if (indexToUpdate >= 0) {
    localUsers[indexToUpdate] = updatedUser;
  } else {
    localUsers.push(updatedUser);
  }

  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: initiator?.name || "System Admin",
    action: indexToUpdate >= 0 ? "Edit User Profile" : "Create User Profile",
    details: `Managed profile for ${updatedUser.name} (${updatedUser.role}). DB Synced: ${supabaseSynced}.`,
    status: "Success"
  });

  saveDB("users");
  res.json({ success: true, users: localUsers });
});

// Bulk Create/Update User profiles (used by Excel User upload)
app.post("/api/users/save-bulk", async (req, res) => {
  const { users: inputUsers, initiator } = req.body;
  if (!Array.isArray(inputUsers)) {
    return res.status(400).json({ error: "Missing or invalid users array" });
  }

  // 1. Strict duplicate email checks in the upload list itself
  const emailsInUpload = new Set<string>();
  for (const u of inputUsers) {
    if (!u.email) continue;
    const emailLower = u.email.trim().toLowerCase();
    if (emailsInUpload.has(emailLower)) {
      return res.status(400).json({ error: `Duplicate email detected in the uploaded list: ${u.email}` });
    }
    emailsInUpload.add(emailLower);
  }

  // 2. Strict duplicate email checks against existing users
  for (const u of inputUsers) {
    if (!u.email) continue;
    const emailLower = u.email.trim().toLowerCase();
    const existingMatch = localUsers.find(lu => lu.email.trim().toLowerCase() === emailLower && lu.id !== u.id);
    if (existingMatch) {
      return res.status(400).json({ error: `A user with email "${u.email}" already exists in the database.` });
    }
  }

  const updatedUsers: any[] = [];
  for (const user of inputUsers) {
    if (!user || !user.email) continue;
    const emailLower = user.email.trim().toLowerCase();
    
    const updatedUser = {
      ...user,
      id: user.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      password: user.password || "password123"
    };

    let indexToUpdate = localUsers.findIndex(u => u.email.trim().toLowerCase() === emailLower);
    if (indexToUpdate >= 0) {
      localUsers[indexToUpdate] = updatedUser;
    } else {
      localUsers.push(updatedUser);
    }
    updatedUsers.push(updatedUser);
  }

  // Sync to Supabase directly first if available
  const sb = getSupabaseAdminClient();
  let supabaseSynced = false;
  if (sb) {
    try {
      // Sort users by role priority to avoid foreign key violations (manager must exist first)
      const rolePriority: Record<string, number> = {
        "Admin": 1,
        "Sales Director": 2,
        "Regional Manager": 3,
        "Salesperson": 4
      };
      const sortedUsers = [...updatedUsers].sort((a, b) => (rolePriority[a.role] || 5) - (rolePriority[b.role] || 5));

      const { data: dbUsers } = await sb.from("users").select("id, name");
      const dbUsersList = dbUsers || [];

      const rows = sortedUsers.map(u => {
        let manager_id = u.managerId && !u.managerId.startsWith("user_") ? u.managerId : null;
        if (!manager_id && u.managerName) {
          const mgr = dbUsersList.find(m => m.name.trim().toLowerCase() === u.managerName!.trim().toLowerCase());
          if (mgr) {
            manager_id = mgr.id;
          }
        }
        
        return {
          id: u.id && u.id.startsWith("user_") ? undefined : u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          region: u.region || "",
          territory: u.territory || "",
          employee_code: u.salespersonCode || "",
          is_active: u.approved !== false,
          password: u.password || "password123",
          manager_id: manager_id
        };
      });

      const { error: ue } = await sb.from("users").upsert(rows, { onConflict: "email" });
      if (ue) throw ue;
      supabaseSynced = true;
    } catch (err: any) {
      console.error("Bulk profile write failure to Supabase:", err.message);
      return res.status(500).json({ error: `Database write failure: ${err.message}. Please configure SUPABASE_SERVICE_ROLE_KEY or disable Row Level Security (RLS) on the 'users' table in the Supabase console.` });
    }
  }

  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: initiator?.name || "System Admin",
    action: "Bulk Import Users",
    details: `Successfully imported ${updatedUsers.length} user profiles. DB Synced: ${supabaseSynced}.`,
    status: "Success"
  });

  saveDB("users");
  res.json({ success: true, users: localUsers });
});

// Delete User profile
app.post("/api/users/delete", async (req, res) => {
  const { userId, initiator } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing Target User Identification ID" });
  }

  const foundUser = localUsers.find(u => u.id === userId);
  if (!foundUser) {
    return res.status(404).json({ error: "No profile matching specified ID exists" });
  }

  // Delete from Supabase
  const sb = getSupabaseAdminClient();
  let supabaseSynced = false;
  if (sb) {
    try {
      const { error: de } = await sb.from("users").delete().eq("id", userId);
      if (de) {
        // Try fallback deletion by email
        if (foundUser.email) {
          await sb.from("users").delete().eq("email", foundUser.email);
        }
      }
      supabaseSynced = true;
    } catch (err: any) {
      console.warn("Suppressed profile deletion issue from Supabase:", err.message);
    }
  }

  localUsers = localUsers.filter(u => u.id !== userId);

  const deleteTimestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp: deleteTimestamp,
    user: initiator?.name || "System Admin",
    action: "Delete User Profile",
    details: `Deleted profile for ${foundUser.name} (${foundUser.role}). DB Synced: ${supabaseSynced}.`,
    status: "Success"
  });

  saveDB("users");
  res.json({ success: true, users: localUsers });
});

// 2. Save database changes (updates invoices / budgets)
app.post("/api/db/save", async (req, res) => {
  const { invoices, budgets, userDetails, isImport } = req.body || {};
  
  const MAX_INVOICES_LIMIT = 30000;
  const MAX_BUDGETS_LIMIT = 1000;

  if (Array.isArray(invoices) && invoices.length > MAX_INVOICES_LIMIT) {
    return res.status(400).json({
      success: false,
      error: `Database transaction refused: Total active rows would exceed stability threshold of ${MAX_INVOICES_LIMIT}.`
    });
  }

  if (Array.isArray(budgets) && budgets.length > MAX_BUDGETS_LIMIT) {
    return res.status(400).json({
      success: false,
      error: `Database transaction refused: Total budget allocations would exceed safety limit of ${MAX_BUDGETS_LIMIT}.`
    });
  }

  if (isImport) {
    backupInvoices = [...localInvoices];
    backupBudgets = [...localBudgets];
  }

  if (Array.isArray(invoices)) {
    const seen = new Set<string>();
    const uniqueInvoices = [];
    for (const inv of invoices) {
      if (!inv) continue;
      const company = (inv.company || "").trim().toLowerCase();
      const date = (inv.invoiceDate || "").trim().toLowerCase();
      const invNo = (inv.invoiceNumber || "").trim().toLowerCase();
      const custName = (inv.customerName || "").trim().toLowerCase();
      const prodName = (inv.productName || "").trim().toLowerCase();
      const qty = String(inv.quantity || 0).trim();
      const key = `${company}|||${date}|||${invNo}|||${custName}|||${prodName}|||${qty}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueInvoices.push(inv);
      }
    }
    localInvoices = uniqueInvoices;
  }
  if (Array.isArray(budgets)) {
    localBudgets = budgets;
  }

  // Push directly to Supabase if connected
  const sb = getSupabaseAdminClient();
  let supSynced = false;
  if (sb) {
    try {
      if (Array.isArray(budgets)) {
        // Direct targets overwrite
        await sb.from("budget_data").delete().not("id", "is", null);
        const { data: dbUsers } = await sb.from("users").select("id, name");
        const bRows = budgets.map(b => {
          const spKey = (b.salesperson || "").trim().toLowerCase();
          const dbMatch = (dbUsers || []).find((u: any) => u.name && u.name.toLowerCase().trim() === spKey);
          const salespersonId = dbMatch ? dbMatch.id : null;
          return {
            product_name: b.product || b.productName,
            budget_quantity: b.budgetQuantity,
            budget_value: b.budgetValue,
            month: b.month,
            financial_year: b.financialYear,
            salesperson_id: salespersonId
          };
        }).filter(r => r.salesperson_id !== null);

        if (bRows.length > 0) {
          await sb.from("budget_data").insert(bRows);
        }
      }
      supSynced = true;
    } catch (err: any) {
      console.warn("Direct-DB-Save budget upload issue:", err.message);
    }
  }
  
  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: userDetails?.name || "System User",
    action: isImport ? "Excel Spreadsheet Import" : "Database Save Actions",
    details: `Updated local structures. Active Invoices: ${localInvoices.length}, target sheets: ${localBudgets.length}. Supabase synced: ${supSynced}.`,
    status: "Success"
  });

  saveDB();
  res.json({ success: true, count: localInvoices.length });
});

// Helper for waiting/retrying with exponential spacing
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 2b. Import lightweight spreadsheet delta rows (SAFE BULK INSERT STRATEGY DIRECT-TO-SUPABASE)
app.post("/api/db/import", async (req, res) => {
  const { newInvoices = [], newBudgets = [], duplicateAction = "replace", userDetails } = req.body || {};

  backupInvoices = [...localInvoices];
  backupBudgets = [...localBudgets];

  const sb = getSupabaseAdminClient();
  if (!sb) {
    // FALLBACK OFFLINE IN-MEMORY FILE REPLICATION
    let mergedInvoices = [...localInvoices];
    let mergedBudgets = [...localBudgets];

    const getInvoiceCompKey = (inv: any) => {
      const company = (inv.company || "").trim().toLowerCase();
      const date = (inv.invoiceDate || "").trim().toLowerCase();
      const invNo = (inv.invoiceNumber || "").trim().toLowerCase();
      const custName = (inv.customerName || "").trim().toLowerCase();
      const prodName = (inv.productName || "").trim().toLowerCase();
      const qty = String(inv.quantity || 0).trim();
      return `${company}|||${date}|||${invNo}|||${custName}|||${prodName}|||${qty}`;
    };

    if (Array.isArray(newInvoices) && newInvoices.length > 0) {
      if (duplicateAction === "replace") {
        const newMap = new Map<string, any>();
        newInvoices.forEach(inv => newMap.set(getInvoiceCompKey(inv), inv));
        const filtered = localInvoices.filter(inv => !newMap.has(getInvoiceCompKey(inv)));
        mergedInvoices = [...Array.from(newMap.values()), ...filtered];
      } else {
        const keys = new Set(localInvoices.map(getInvoiceCompKey));
        const nonDups = newInvoices.filter(inv => !keys.has(getInvoiceCompKey(inv)));
        mergedInvoices = [...nonDups, ...localInvoices];
      }
    }

    if (Array.isArray(newBudgets) && newBudgets.length > 0) {
      mergedBudgets = [...newBudgets, ...localBudgets];
    }

    localInvoices = mergedInvoices;
    localBudgets = mergedBudgets;
    saveDB();

    return res.json({
      success: true,
      totalInvoices: localInvoices.length,
      totalBudgets: localBudgets.length,
      newInvoicesCount: newInvoices.length,
      newBudgetsCount: newBudgets.length
    });
  }

  // LIVE SUPABASE ENTERPRISE UPLOAD CONTROLLER & SAFE BULK IMPORT PIPELINE
  try {
    const uploadedBy = userDetails?.name || "System Import Handler";
    const totalNewInvoices = newInvoices.length;
    let insertedRows = 0;
    let duplicateRows = 0;
    let failedRowsCount = 0;
    const failedRowsList: any[] = [];

    // Create Initial Audit Row in Supabase to track transaction chain and get a unique run UUID
    const { data: auditRecord, error: are } = await sb.from("upload_audit_logs").insert({
      file_name: `Spreadsheet_Sync_${Date.now()}.xlsx`,
      file_type: newInvoices.length > 0 ? "Sales Invoices" : "Budget Sheets",
      uploaded_by: uploadedBy,
      total_rows: totalNewInvoices + newBudgets.length,
      status: "Failed" // starts with failed status, updated to completed if we succeed!
    }).select();

    const auditId = auditRecord && auditRecord[0] ? auditRecord[0].id : null;

    if (Array.isArray(newInvoices) && newInvoices.length > 0) {
      console.log(`Supabase-Upload: Compiling matching entries to resolve duplicates (Strategy: ${duplicateAction})...`);
      
      // Step A: Pull the existing invoice rows to detect duplicates
      const existingSales = await fetchAllSalesFromSupabase(sb, "id, invoice_number, invoice_date, product_name, customer_code");

      // Map row signature keys: invoice_number + invoice_date + product_name + customer_code
      const makeCompositeKey = (row: any) => {
        const invNo = String(row.invoice_number || row.invoiceNumber || "").trim().toLowerCase();
        const invDate = String(row.invoice_date || row.invoiceDate || "").trim().toLowerCase();
        const prod = String(row.product_name || row.productName || "").trim().toLowerCase();
        const cust = String(row.customer_code || row.customerCode || "").trim().toLowerCase();
        return `${invNo}|||${invDate}|||${prod}|||${cust}`;
      };

      const existingMap = new Map<string, string>(); // Key -> DB ID
      (existingSales || []).forEach(row => {
        existingMap.set(makeCompositeKey(row), row.id);
      });

      const idsToDelete: string[] = [];
      const invoicesToInsert: any[] = [];

      newInvoices.forEach((inv, index) => {
        const key = makeCompositeKey(inv);
        if (existingMap.has(key)) {
          duplicateRows++;
          if (duplicateAction === "replace") {
            // Overwrite duplicate: delete existing row and write new one
            idsToDelete.push(existingMap.get(key)!);
            invoicesToInsert.push({
              invoice_date: inv.invoiceDate,
              invoice_number: inv.invoiceNumber,
              company: inv.company,
              customer_name: inv.customerName,
              customer_code: inv.customerCode,
              region: inv.region,
              territory: inv.territory,
              salesperson: inv.salesperson,
              regional_manager: inv.regionalManager,
              product_name: inv.productName,
              product_category: inv.productCategory,
              supplier: inv.supplier,
              quantity: inv.quantity,
              unit: inv.unit,
              rate: inv.rate,
              gross_value: inv.grossValue,
              discount: inv.discount || 0,
              net_value: inv.netSalesValue
            });
          } else {
            // "skip" duplication mode - do nothing
          }
        } else {
          // New row to insert
          invoicesToInsert.push({
            invoice_date: inv.invoiceDate,
            invoice_number: inv.invoiceNumber,
            company: inv.company,
            customer_name: inv.customerName,
            customer_code: inv.customerCode,
            region: inv.region,
            territory: inv.territory,
            salesperson: inv.salesperson,
            regional_manager: inv.regionalManager,
            product_name: inv.productName,
            product_category: inv.productCategory,
            supplier: inv.supplier,
            quantity: inv.quantity,
            unit: inv.unit,
            rate: inv.rate,
            gross_value: inv.grossValue,
            discount: inv.discount || 0,
            net_value: inv.netSalesValue
          });
        }
      });

      // Execute Overwrite Deletions in batches of 500
      if (idsToDelete.length > 0) {
        console.log(`Supabase-Upload: Clearing ${idsToDelete.length} duplicate spreadsheet logs to replace...`);
        const delChunk = 500;
        for (let j = 0; j < idsToDelete.length; j += delChunk) {
          const idsSub = idsToDelete.slice(j, j + delChunk);
          await sb.from("sales_data").delete().in("id", idsSub);
        }
      }

      // Step B: Bulk insert new and replacement rows using the SAFE 500-CHUNK METHOD
      const CHUNK_SIZE = 500;
      console.log(`Supabase-Upload: Dispatching ${invoicesToInsert.length} sales rows in batches of ${CHUNK_SIZE} with retry capabilities...`);

      for (let i = 0; i < invoicesToInsert.length; i += CHUNK_SIZE) {
        const chunk = invoicesToInsert.slice(i, i + CHUNK_SIZE);
        let success = false;
        let attempts = 0;
        let chunkErrorMsg = "";

        while (!success && attempts < 3) {
          attempts++;
          const { error: insertError } = await sb.from("sales_data").insert(chunk);
          if (!insertError) {
            success = true;
            insertedRows += chunk.length;
            console.log(`Chunk [${i} to ${i + chunk.length}] written successfully (Attempt ${attempts}/3).`);
          } else {
            chunkErrorMsg = insertError.message;
            console.warn(`Chunk insertion retry warning (Attempt ${attempts}/3) failed:`, insertError.message);
            if (attempts < 3) {
              await sleep(150); // Pause before retry
            }
          }
        }

        // If the chunk still failed after 3 attempts, mark row metadata for analysis
        if (!success) {
          failedRowsCount += chunk.length;
          chunk.forEach((rowObj, indexWithinChunk) => {
            failedRowsList.push({
              index: i + indexWithinChunk,
              invoiceNumber: rowObj.invoice_number,
              error: `Chunk execution error (retries exhausted): ${chunkErrorMsg}`
            });
          });
          console.error(`CRITICAL: Batch failed permanently: Row index bounds [${i} to ${i + chunk.length}]. Saved rows to failing lists.`);
        }
      }
    }

    // Process Budget Sheets safely on live tables
    if (Array.isArray(newBudgets) && newBudgets.length > 0) {
      const { data: dbUsers } = await sb.from("users").select("id, name");
      const nameToId = new Map((dbUsers || []).map((u: any) => [u.name.toLowerCase().trim(), u.id]));

      const bRows = newBudgets.map(b => {
        const spKey = (b.salesperson || "").trim().toLowerCase();
        const salespersonId = nameToId.get(spKey) || null;
        return {
          product_name: b.product || b.productName,
          budget_quantity: b.budgetQuantity,
          budget_value: b.budgetValue,
          month: b.month,
          financial_year: b.financialYear,
          salesperson_id: salespersonId
        };
      }).filter(r => r.salesperson_id !== null);

      if (bRows.length > 0) {
        await sb.from("budget_data").insert(bRows);
      }
    }

    // Step C: Post-Upload Reconciliation, Row Count Verification, and Audit Updates
    const finalStatus = failedRowsCount === 0 ? "Completed" : (insertedRows > 0 ? "Partial_Success" : "Failed");
    if (auditId) {
      await sb.from("upload_audit_logs").update({
        inserted_rows: insertedRows,
        duplicate_rows: duplicateRows,
        failed_rows: failedRowsCount,
        status: finalStatus
      }).eq("id", auditId);

      if (failedRowsList.length > 0) {
        const errorBatches = failedRowsList.map(item => ({
          audit_id: auditId,
          row_index: item.index,
          invoice_number: item.invoiceNumber,
          error_message: item.error
        }));
        await sb.from("failed_upload_rows").insert(errorBatches);
      }
    }

    // Row count validation
    const { count: freshDbSalesCount } = await sb.from("sales_data").select("*", { count: "exact", head: true });
    console.log(`Reconciliation Complete: DB Sales Record count is now: ${freshDbSalesCount}. Newly Added: ${insertedRows}, Skipped/Bypassed: ${duplicateRows}, Failed: ${failedRowsCount}.`);

    // Write reconciliation sweep record
    await sb.from("data_integrity_logs").insert({
      check_type: "Upload Reconciliation",
      results_summary: `Spreadsheet uploaded by ${uploadedBy} completed with status: ${finalStatus}. Expected New: ${totalNewInvoices}, Injected: ${insertedRows}, Failed: ${failedRowsCount}.`,
      details: {
        uploader: uploadedBy,
        duplicateAction,
        newInvoicesChecked: totalNewInvoices,
        insertedRows,
        duplicateRows,
        failedRowsCount,
        reconciledCount: freshDbSalesCount
      }
    });

    res.json({
      success: true,
      totalInvoices: freshDbSalesCount || 0,
      totalBudgets: localBudgets.length + newBudgets.length,
      newInvoicesCount: insertedRows,
      newBudgetsCount: newBudgets.length,
      failedRowsCount: failedRowsCount,
      duplicateRowsBypassed: duplicateRows,
      auditId: auditId
    });

  } catch (err: any) {
    console.error("Supabase bulk excel importer master pipeline crash:", err);
    res.status(500).json({ success: false, error: `Critical bulk upload failure: ${err.message}` });
  }
});

// Revert/Undo last transaction excel sheet upload
app.post("/api/db/undo", async (req, res) => {
  const { userDetails } = req.body;
  if (!backupInvoices && !backupBudgets) {
    return res.status(400).json({ error: "No pre-import database snapshot was found to perform Undo operation." });
  }

  const sb = getSupabaseAdminClient();
  let supSynced = false;
  if (sb) {
    try {
      console.log("Supabase-Undo: Restoring previous parameters directly to live SQL tables...");
      // Revert sales invoices
      if (backupInvoices) {
        await sb.from("sales_data").delete().not("id", "is", null);
        const CHUNK = 500;
        const mappedRows = backupInvoices.map(inv => ({
          invoice_date: inv.invoiceDate,
          invoice_number: inv.invoiceNumber,
          company: inv.company,
          customer_name: inv.customerName,
          customer_code: inv.customerCode,
          region: inv.region,
          territory: inv.territory,
          salesperson: inv.salesperson,
          regional_manager: inv.regionalManager,
          product_name: inv.productName,
          product_category: inv.productCategory,
          supplier: inv.supplier,
          quantity: inv.quantity,
          unit: inv.unit,
          rate: inv.rate,
          gross_value: inv.grossValue,
          discount: inv.discount || 0,
          net_value: inv.netSalesValue
        }));

        for (let k = 0; k < mappedRows.length; k += CHUNK) {
          await sb.from("sales_data").insert(mappedRows.slice(k, k + CHUNK));
        }
      }

      // Revert budgets
      if (backupBudgets) {
        await sb.from("budget_data").delete().not("id", "is", null);
        const { data: dbUsers } = await sb.from("users").select("id, name");
        const nameToId = new Map((dbUsers || []).map((u: any) => [u.name.toLowerCase().trim(), u.id]));

        const bRows = backupBudgets.map(b => {
          const spKey = (b.salesperson || "").trim().toLowerCase();
          const salespersonId = nameToId.get(spKey) || null;
          return {
            product_name: b.product || b.productName,
            budget_quantity: b.budgetQuantity,
            budget_value: b.budgetValue,
            month: b.month,
            financial_year: b.financialYear,
            salesperson_id: salespersonId
          };
        }).filter(r => r.salesperson_id !== null);

        if (bRows.length > 0) {
          await sb.from("budget_data").insert(bRows);
        }
      }

      supSynced = true;
    } catch (err: any) {
      console.warn("Supabase undo database failure:", err.message);
    }
  }

  if (backupInvoices) {
    localInvoices = backupInvoices;
  }
  if (backupBudgets) {
    localBudgets = backupBudgets;
  }

  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: userDetails?.name || "System Admin",
    action: "Undo Spreadsheet Import",
    details: `Restored pre-import snapshot parameters. Invoices lines reverted. Supabase live rollback: ${supSynced}.`,
    status: "Success"
  });

  backupInvoices = null;
  backupBudgets = null;

  saveDB();
  res.json({ success: true, count: localInvoices.length });
});

// Clear all active invoice records
app.post("/api/db/clear-invoices", async (req, res) => {
  const { userDetails } = req.body;

  backupInvoices = [...localInvoices];
  localInvoices = [];

  const sb = getSupabaseAdminClient();
  let supSynced = false;
  if (sb) {
    try {
      await sb.from("sales_data").delete().not("id", "is", null);
      supSynced = true;
    } catch (err: any) {
      console.warn("Supabase wipe sales table failed:", err.message);
    }
  }

  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: userDetails?.name || "System Admin",
    action: "Clear Invoices Database",
    details: `Cleared all active invoices from the dashboard database. Snapshot saved to cache backups. Supabase wiped: ${supSynced}.`,
    status: "Success"
  });

  saveDB();
  res.json({ success: true });
});

// Clear all active budgets
app.post("/api/db/clear-budgets", async (req, res) => {
  const { userDetails } = req.body;

  backupBudgets = [...localBudgets];
  localBudgets = [];

  const sb = getSupabaseAdminClient();
  let supSynced = false;
  if (sb) {
    try {
      await sb.from("budget_data").delete().not("id", "is", null);
      supSynced = true;
    } catch (err: any) {
      console.warn("Supabase wipe budgets table failed:", err.message);
    }
  }

  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: userDetails?.name || "System Admin",
    action: "Clear Budgets Database",
    details: `Cleared salesperson targets from the budgets database. Snapshot saved to backups. Supabase wiped: ${supSynced}.`,
    status: "Success"
  });

  saveDB();
  res.json({ success: true });
});

// DB Reset to Seeds
app.post("/api/db/reset", async (req, res) => {
  const { userDetails } = req.body;
  resetToDefaultSeed();

  const sb = getSupabaseAdminClient();
  let supSynced = false;
  if (sb) {
    try {
      await sb.from("sales_data").delete().not("id", "is", null);
      await sb.from("budget_data").delete().not("id", "is", null);
      supSynced = true;
    } catch (err: any) {
      console.warn("Supabase factory clear failed:", err.message);
    }
  }
  
  const factoryTimestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp: factoryTimestamp,
    user: userDetails?.name || "System Admin",
    action: "Factory Reset",
    details: `Restored standard system parameters to local blank matrices. Supabase schemas cleared: ${supSynced}.`,
    status: "Success"
  });

  saveDB();
  res.json({ success: true });
});

// ==========================================
// 8. DATA INTEGRITYsweep & DIAGNOSTIC ENDPOINTS
// ==========================================

app.get("/api/admin/integrity-check", async (req, res) => {
  const sb = getSupabaseAdminClient();
  if (!sb) {
    return res.json({
      success: false,
      error: "Supabase integration not configured or credentials missing."
    });
  }

  try {
    const { count: salesCount } = await sb.from("sales_data").select("*", { count: "exact", head: true });
    const { count: budgetsCount } = await sb.from("budget_data").select("*", { count: "exact", head: true });

    const salesList = await fetchAllSalesFromSupabase(sb, "id, invoice_date, invoice_number, product_name, customer_code, salesperson");
    const budgetsList = await fetchAllBudgetsFromSupabase(sb, "id, product_name, salesperson_id, financial_year, month");
    const { data: usersList } = await sb.from("users").select("id, name, email");

    const invoices = salesList || [];
    const budgets = budgetsList || [];
    const dbUsers = usersList || [];

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
    const activeStaffSet = new Set(dbUsers.map(u => u.name.trim().toLowerCase()));
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
        const key = `${usr.name.trim().toLowerCase()}|||${(b.month || "").trim().toLowerCase()}|||${(b.financial_year || "").trim().toLowerCase()}`;
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

    return res.json({
      success: true,
      metrics: {
        totalInvoices: salesCount,
        totalBudgets: budgetsCount,
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
          actualRowsInDatabase: salesCount
        }
      },
      auditHistory: dbAudits || [],
      integrityHistory: dbIntegrityLogs || []
    });

  } catch (err: any) {
    console.error("Diagnostic-Integrity-Error: sweeps crash:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dedup Action API
app.post("/api/admin/clean-duplicates", async (req, res) => {
  const sb = getSupabaseAdminClient();
  if (!sb) return res.status(400).json({ error: "Supabase client not initialized." });

  try {
    const salesList = await fetchAllSalesFromSupabase(sb, "id, invoice_number, invoice_date, product_name, customer_code");
    if (!salesList || salesList.length === 0) return res.json({ success: true, count: 0 });

    const keyMap = new Map<string, string[]>();
    salesList.forEach(inv => {
      const key = `${(inv.invoice_number || "").trim()}|||${inv.invoice_date || ""}|||${(inv.product_name || "").trim()}|||${(inv.customer_code || "").trim()}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key)!.push(inv.id);
    });

    const idsToDelete: string[] = [];
    for (const [key, ids] of keyMap.entries()) {
      if (ids.length > 1) {
        idsToDelete.push(...ids.slice(1)); // keep one, schedule the rest for delete
      }
    }

    if (idsToDelete.length > 0) {
      const chunk = 500;
      for (let w = 0; w < idsToDelete.length; w += chunk) {
        await sb.from("sales_data").delete().in("id", idsToDelete.slice(w, w + chunk));
      }
    }

    await sb.from("data_integrity_logs").insert({
      check_type: "Manual Deduplication Action",
      results_summary: `Wiped out duplicate lines from data tables. Records Removed: ${idsToDelete.length}.`,
      details: {
         deletedLines: idsToDelete.length
      }
    });

    res.json({ success: true, cleanedCount: idsToDelete.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Align Orphan Reps API
app.post("/api/admin/align-orphans", async (req, res) => {
  const sb = getSupabaseAdminClient();
  if (!sb) return res.status(400).json({ error: "Supabase not connected." });

  try {
    const { data: usersData } = await sb.from("users").select("id, name");
    const salesWithNoRepId = await fetchAllSalesFromSupabase(sb, "id, salesperson", undefined, "salesperson_id");

    if (!usersData || !salesWithNoRepId || salesWithNoRepId.length === 0) {
      return res.json({ success: true, fixedCount: 0 });
    }

    const defaultAdmin = usersData.find((u: any) => u.name.toLowerCase().includes("admin")) || usersData[0];
    let fixed = 0;

    for (const inv of salesWithNoRepId) {
      const match = usersData.find((u: any) => u.name.trim().toLowerCase() === inv.salesperson.trim().toLowerCase());
      if (match) {
        await sb.from("sales_data").update({ salesperson_id: match.id }).eq("id", inv.id);
        fixed++;
      } else if (defaultAdmin) {
        await sb.from("sales_data").update({ salesperson_id: defaultAdmin.id }).eq("id", inv.id);
        fixed++;
      }
    }

    await sb.from("data_integrity_logs").insert({
      check_type: "Manual Orphans Alignment",
      results_summary: `Linked ${fixed} un-bound invoices to database verified users.`,
      details: {
        recordsMapped: fixed
      }
    });

    res.json({ success: true, fixedCount: fixed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. AI Smart Insights Chat proxy using recommended model gemini-2.5-flash
app.post("/api/gemini/insights", async (req, res) => {
  try {
    const { messages = [], contextData = {} } = req.body || {};
    
    // Prepare fallback mock response matching user prompt patterns
    const lastMsg = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1]?.content || "" : "";
    const lower = lastMsg.toLowerCase();
    let reply = "";
    if (lower.includes("customer") && lower.includes("25%")) {
      reply = `**AI Insights:** Based on YTD comparison (1 Mar 2026 - 26 May 2026 vs last year):
- **Krishna Agro Agency Nashik** dropped by **100%** (Value ₹1,08,000 last year to ₹0 this year - Classified as *Lost Customer*).
- **Cauvery Fertilizers Salem** (under S. Gopal in South) decreased from ₹1,30,005 to ₹1,23,000 (A slight decline of **5.4%**).
- **Jai Malhar Seeds** grew strongly by **44.4%** matching excellent soil biostimulant penetration in cane fields!`;
    } else if (lower.includes("maharashtra") || lower.includes("declining") || lower.includes("region") || lower.includes("west")) {
      reply = `**AI Insights:** In Maharashtra (West Region supervised by RM S. R. Patil):
- **Urea Premium Shaktiman** (handled by salesperson V. R. Sharma) registered a tiny decline in Satara territory from ₹2.91L to ₹2.86L.
- However, our premium category **Biostimulants** grew strongly! **SugaMax Bio Enhancer** increased from ₹42k to ₹57k (up 34%).
- A brand new customer **Navnath Seeds & Fert Baramati** was successfully added under V. R. Sharma contributing ₹55,000 in sales.`;
    } else {
      reply = `**AgroSales IQ Business Advisory Summary:**
- **Overall YTD Growth:** Sales expanded to ₹45.8 Lakhs representing a strong pre-monsoon rise (+11.7% Year-on-Year).
- **Region Highlights:** South Region is the largest contributor (₹12.8L DAP fertilizers advance order is our biggest growth catalyst).
- **RM Supervision:** S. R. Patil's team in West is outperforming targets with **93%** budget alignment.
- *AI Recommendation:* Re-allocate biostimulants incentive structures to Western sugarcane clusters to harness immediate soil nutrient demands before monsoon break.`;
    }

    const hasApiKey = !(!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "" || process.env.GEMINI_API_KEY.startsWith("YOUR_"));

    if (!hasApiKey) {
      return res.json({ text: reply });
    }

    const ai = getGeminiClient();
    
    // Safely extract context data with defaults to prevent nested TypeErrors
    const safeContext = contextData || {};
    const totalCurrentSales = safeContext.totalCurrentSales ? (safeContext.totalCurrentSales / 100000).toFixed(2) : "45.00";
    const growthPercent = safeContext.growthPercent ? safeContext.growthPercent.toFixed(1) : "11.7";
    const regions = safeContext.regions || [];
    const droppedCustomers = safeContext.droppedCustomers || [];
    const salespersons = safeContext.salespersons || [];
    const decliningProductsVal = safeContext.decliningProductsVal || [];
    const newCustomers = safeContext.newCustomers || [];
    const lostCustomers = safeContext.lostCustomers || [];

    // Build highly rich system context
    const systemPrompt = `You are an expert Agro-inputs Enterprise Sales Director AI Assistant.
You have access to the active operational metrics for "AgroSales IQ" compiled dynamically from CRM receipts and salesperson Excel budgets over two financial years starting on March 1st.
Operational Context provided by server:
- Total Current YTD Sales: ₹${totalCurrentSales} Lakhs
- YTD Year-on-Year Growth: ${growthPercent}%
- Region Performances: ${JSON.stringify(regions)}
- Alerted dropped customers (>15% fall): ${JSON.stringify(droppedCustomers)}
- Salesperson current achievements: ${JSON.stringify(salespersons)}
- Declining Products: ${JSON.stringify(decliningProductsVal)}
- New Dealers: ${JSON.stringify(newCustomers)}
- Lost Dealers: ${JSON.stringify(lostCustomers)}

Provide detailed, humanized, extremely professional and highly precise enterprise reports. Mention the actual rupee values, regional supervisors, salesperson names (e.g. S. R. Patil, V. R. Sharma), and products. Keep formatting clear with sub-headers.`;

    // Sanitize message history to comply with Gemini API safety expectations:
    // 1. Alternating user/model roles.
    // 2. Must start with a "user" role.
    const cleanMessages = Array.isArray(messages) ? [...messages] : [];
    while (cleanMessages.length > 0 && cleanMessages[0].role === "assistant") {
      cleanMessages.shift();
    }

    const formattedContents: any[] = [];
    let expectedRole: "user" | "model" = "user";

    for (const m of cleanMessages) {
      if (!m || typeof m !== "object") continue;
      const currentRole = m.role === "assistant" ? "model" : "user";
      if (currentRole === expectedRole) {
        formattedContents.push({
          role: currentRole as "user" | "model",
          parts: [{ text: m.content || "" }]
        });
        expectedRole = expectedRole === "user" ? "model" : "user";
      } else {
        if (formattedContents.length > 0) {
          const lastPart = formattedContents[formattedContents.length - 1];
          if (Array.isArray(lastPart.parts)) {
            lastPart.parts.push({ text: m.content || "" });
          } else {
            lastPart.parts = [{ text: m.content || "" }];
          }
        } else {
          formattedContents.push({
            role: "user" as const,
            parts: [{ text: m.content || "" }]
          });
          expectedRole = "model";
        }
      }
    }

    // Always ensure we have at least one user query
    if (formattedContents.length === 0) {
      formattedContents.push({
        role: "user" as const,
        parts: [{ text: lastMsg || "Provide a quick overview of current sales performance." }]
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      },
    });

    if (response && response.text) {
      return res.json({ text: response.text });
    } else {
      throw new Error("Empty text returned from Google GenAI model.");
    }
  } catch (error: any) {
    console.error("Gemini API call failed, using mock advisor fallback response. Error:", error);
    // Graceful fallback response including a subtle fallback suffix to always keep user experience green
    const messages = req.body?.messages || [];
    const lastMsg = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1]?.content || "" : "";
    const lower = lastMsg.toLowerCase();
    
    let fallbackReply = `**AgroSales IQ Business Advisory Summary:**
- **Overall YTD Growth:** Sales expanded to ₹45.8 Lakhs representing a strong pre-monsoon rise (+11.7% Year-on-Year).
- **Region Highlights:** South Region is the largest contributor (₹12.8L DAP fertilizers advance order is our biggest growth catalyst).
- **RM Supervision:** S. R. Patil's team in West is outperforming targets with **93%** budget alignment.
- *AI Recommendation:* Re-allocate biostimulants incentive structures to Western sugarcane clusters to harness immediate soil nutrient demands before monsoon break.`;

    if (lower.includes("customer") && lower.includes("25%")) {
      fallbackReply = `**AI Insights:** Based on YTD comparison (1 Mar 2026 - 26 May 2026 vs last year):
- **Krishna Agro Agency Nashik** dropped by **100%** (Value ₹1,08,000 last year to ₹0 this year - Classified as *Lost Customer*).
- **Cauvery Fertilizers Salem** (under S. Gopal in South) decreased from ₹1,30,005 to ₹1,23,000 (A slight decline of **5.4%**).
- **Jai Malhar Seeds** grew strongly by **44.4%** matching excellent soil biostimulant penetration in cane fields!`;
    } else if (lower.includes("maharashtra") || lower.includes("declining") || lower.includes("region") || lower.includes("west")) {
      fallbackReply = `**AI Insights:** In Maharashtra (West Region supervised by RM S. R. Patil):
- **Urea Premium Shaktiman** (handled by salesperson V. R. Sharma) registered a tiny decline in Satara territory from ₹2.91L to ₹2.86L.
- However, our premium category **Biostimulants** grew strongly! **SugaMax Bio Enhancer** increased from ₹42k to ₹57k (up 34%).
- A brand new customer **Navnath Seeds & Fert Baramati** was successfully added under V. R. Sharma contributing ₹55,000 in sales.`;
    }

    return res.json({
      text: fallbackReply + `\n\n*(Note: Real-time insights fell back to pre-compiled enterprise advisory engine. Reason: ${error.message || "Endpoint error"})*`
    });
  }
});

// 4. Monthly Automated Performance Email Scheduler Simulator
// On 3rd of the month Scheduler simulation
app.post("/api/email/scheduler/simulate", async (req, res) => {
  try {
    const { userTriggering, contextData = {} } = req.body || {};
    const timestamp = new Date().toISOString();
    
    const ai = getGeminiClient();
    const isMock = process.env.GEMINI_API_KEY ? false : true;

    // Generate custom emails for each role
    const processedEmails: any[] = [];

    // Recipients list
    const recipients = [
      { name: "Rahul Sawant", email: "rahul@plantnutrition.in", role: "Sales Director" },
      { name: "S. R. Patil", email: "srpatil@agroiq.com", role: "Regional Manager" },
      { name: "V. R. Sharma", email: "vrsharma@agroiq.com", role: "Salesperson" },
    ];

    for (const rec of recipients) {
      let emailBody = "";
      let subject = `AgroSales IQ: Performance Report - Scheduled May 2026`;
      
      if (isMock) {
        if (rec.role === "Salesperson") {
          subject = `AgroSales IQ: Monthly Performance Report - V. R. Sharma`;
          emailBody = `<h3>Dear V. R. Sharma,</h3>
          <p>Here is your individual Salesperson scorecard summary for May 2026:</p>
          <ul>
            <li><strong>Territory:</strong> West-1 (Maharashtra)</li>
            <li><strong>YTD Sales Accomplished:</strong> ₹5.03 Lakhs</li>
            <li><strong>Budget Achievement Rate:</strong> 93.7%</li>
            <li><strong>Top Customer Growth:</strong> Mahalaxmi Fertilizers Pune (+34.3% in SugaMax Biostimulants)</li>
            <li><strong>Risk Highlight:</strong> Krishna Agro Agency Nashik bought ₹0. Possible transition to competitor detected.</li>
          </ul>
          <p><em>AI Smart Comment:</em> Pre-monsoon biostimulants advances are trending strong. Re-prioritize sugarcane dealer channels immediately.</p>`;
        } else if (rec.role === "Regional Manager") {
          subject = `AgroSales IQ: Regional Executive Statement - S. R. Patil`;
          emailBody = `<h3>Dear Regional Manager S. R. Patil,</h3>
          <p>Here is your Consolidated Region Scorecard for May 2026:</p>
          <ul>
            <li><strong>Region:</strong> West</li>
            <li><strong>Total Sales Volume:</strong> ₹7.29 Lakhs</li>
            <li><strong>YoY Performance Growth:</strong> +13.5%</li>
            <li><strong>Active Customers:</strong> 5 dealers</li>
            <li><strong>Top Territory:</strong> West-1 (V. R. Sharma: ₹5.03L)</li>
          </ul>
          <p><strong>Subordinate Performance Summary:</strong><br/>
          - V. R. Sharma: 93% Achievement against targets.<br/>
          - A. P. Kulkarni: 110% target alignment in West-2 territory driven by MycoRoot Fungi.</p>`;
        } else {
          subject = `AgroSales IQ: Corporate Executive Digest - Rahul Sawant`;
          emailBody = `<h3>Dear Sales Director Rahul Sawant,</h3>
          <p>We are delighted to supply the Unified AgroSales IQ Corporate Performance Audit for May 2026.</p>
          <ul>
            <li><strong>Global Combined Enterprise Net Sales:</strong> ₹45.80 Lakhs</li>
            <li><strong>Global YTD Sales Growth:</strong> +11.7% Year-on-Year</li>
            <li><strong>Budget Accomplishment Index:</strong> 90.6% globally</li>
            <li><strong>Category Champion:</strong> Fertilizers (₹23.0L) followed closely by Plant Nutrients and Biostimulants</li>
          </ul>
          <p><strong>Top Executive Strategic Insight:</strong> South region (RM: K. Swamy) has generated ₹12.8L in DAP fertilizer bulk allocations, representing 28% of total current revenue. Re-check biostimulant growth rates in West Region as well.</p>`;
        }
      } else {
        // Real Gemini AI creation of custom emails!
        try {
          const aiPrompt = `Generate a highly professional enterprise automated performance report email for a user in an agro-inputs company.
Recipient Details: Name: "${rec.name}", Email: "${rec.email}", Role: "${rec.role}".
Current metrics context:
- Total Sales: ₹${contextData.totalCurrentSales ? (contextData.totalCurrentSales / 100000).toFixed(2) : "45.0"} Lakhs
- YoY Growth: ${contextData.growthPercent ? contextData.growthPercent.toFixed(1) : "11.7"}%
- Subordinates rankings: ${JSON.stringify(contextData.salespersons || [])}
- Region details: ${JSON.stringify(contextData.regions || [])}
- Declining customer warnings: ${JSON.stringify(contextData.droppedCustomers || [])}

Instructions:
Generate a valid HTML structured email. Do NOT include Markdown formatting (like \`\`\`html) around the output; just output the raw parsed styled HTML.
Include bullet points for key KPI targets, highlight achievements or gaps, and generate deep AI advice tailored strictly to their access level. Ensure Sales Director gets the company-wide metrics, RM gets regional team ranks, and Salesperson gets individual numbers.`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: aiPrompt,
            config: {
              temperature: 0.2,
            }
          });
          
          emailBody = response.text || "<p>Error generating email</p>";
        } catch (e: any) {
          console.error("Gemini email generation failed, using mock templates", e);
          emailBody = `<p>Error generating real AI insights: ${e.message}</p>`;
        }
      }

      processedEmails.push({
        id: `em_sim_${Math.floor(1000 + Math.random() * 9000)}`,
        dateSent: timestamp,
        recipientEmail: rec.email,
        recipientName: rec.name,
        recipientRole: rec.role,
        subject,
        bodyPreview: emailBody,
        status: "Delivered",
        attachments: ["Sales_Summary.pdf", "Variance_Details.xlsx"],
        triggerType: "Manual"
      });
    }

    // Prepend generated emails to local email database
    localEmailLogs = [...processedEmails, ...localEmailLogs];
    
    // Add audit logs
    localAuditLogs.unshift({
      timestamp,
      user: userTriggering?.name || "System Scheduler",
      action: "Monthly Reporting Run",
      details: `Generated and dispatched ${processedEmails.length} automated HTML email performance reports matching enterprise tree.`,
      status: "Success"
    });

    saveDB();
    res.json({ success: true, count: processedEmails.length, logs: processedEmails });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to run scheduler. " + error.message });
  }
});


// --- VITE MIDDLEWARE & STATIC FILE FALLBACK ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite Dev mode
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    // Resolve static assets from 'dist' directory relative to project root
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server started successfully on http://0.0.0.0:${PORT}`);
    });
  }
}

// Start the Express and Vite hybrid dev/production full-stack server
startServer();
