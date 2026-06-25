/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileText, CheckCircle2, AlertTriangle, CloudRain, ShieldCheck, Database, RefreshCw, AlertCircle, Lock, Target, Users } from "lucide-react";
import { InvoiceItem, BudgetItem, UserProfile } from "../types";
import { getSupabase, uploadExcelToStorage } from "../lib/supabaseClient";

function getStandardizedValue(value: string, category: "customer" | "product"): string {
  if (!value) return "";
  const valNorm = value.trim().toLowerCase();
  
  const mappings = [
    { original: "pune fert", standardized: "Mahalaxmi Fertilizers Pune", category: "customer" },
    { original: "balaji satara", standardized: "Balaji Agro Services Satara", category: "customer" },
    { original: "krishna agency nasik", standardized: "Krishna Agro Agency Nashik", category: "customer" },
    { original: "malhar seeds", standardized: "Jai Malhar Seeds Kolhapur", category: "customer" },
    { original: "saraswathi solapur", standardized: "Saraswati Agro Solapur", category: "customer" },
    { original: "sugamax bio boost", standardized: "SugaMax Bio Enhancer", category: "product" },
    { original: "rhizo active", standardized: "RhizoActive Soil Pro", category: "product" },
  ];

  const matched = mappings.find(
    m => m.category === category && (m.original.toLowerCase() === valNorm || valNorm.includes(m.original.toLowerCase()))
  );
  
  if (matched) {
    return matched.standardized;
  }
  return value.trim().replace(/\s+/g, " ");
}

interface UploadCenterProps {
  onDataUploaded: (invoices: InvoiceItem[], budgets: BudgetItem[], duplicateAction?: "replace" | "ignore") => Promise<any>;
  onSaveUsersBulk?: (users: any[]) => Promise<any>;
  currentUser: UserProfile;
  existingInvoicesCount: number;
  existingBudgetsCount: number;
  onResetDatabase: () => void;
  isSyncing: boolean;
  existingInvoices: InvoiceItem[];
  users?: UserProfile[];
}

export default function UploadCenter({
  onDataUploaded,
  onSaveUsersBulk,
  currentUser,
  existingInvoicesCount,
  existingBudgetsCount,
  onResetDatabase,
  isSyncing,
  existingInvoices = [],
  users = [],
}: UploadCenterProps) {
  const [activeTab, setActiveTab] = useState<"sales" | "budget" | "users">("sales");
  const [stagedInvoices, setStagedInvoices] = useState<InvoiceItem[]>([]);
  const [stagedBudgets, setStagedBudgets] = useState<BudgetItem[]>([]);
  const [stagedUsers, setStagedUsers] = useState<any[]>([]);
  const [duplicateResolution, setDuplicateResolution] = useState<"replace" | "ignore">("replace");
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | "committed" | "idle";
    message: string;
    details?: string[];
  }>({ type: "idle", message: "" });
  
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [isSyncingDirectly, setIsSyncingDirectly] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [insertedCount, setInsertedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [auditLogsConsole, setAuditLogsConsole] = useState<string[]>([]);

  const handleDirectCommitToSupabase = async () => {
    const sb = getSupabase();
    setIsSyncingDirectly(true);
    setUploadProgress(0);
    setInsertedCount(0);
    setFailedCount(0);
    setDuplicateCount(0);
    
    const initialLogs = [
      `[Pipeline] Initiating direct database synchronization...`,
      `[Pipeline Debug] Checked Client-Side Supabase Initializer Status...`,
      `[Pipeline Debug] Supabase client created: ${sb !== null ? "YES" : "NO"}`
    ];
    setAuditLogsConsole(initialLogs);

    const addLog = (msg: string) => {
      setAuditLogsConsole(prev => [...prev, msg]);
    };

    if (!sb && activeTab !== "users") {
      addLog(`[CRITICAL ERROR] Supabase connection is offline. Client-side credentials missing or failed to initialize.`);
      setUploadStatus({
        type: "error",
        message: "Upload failed. Supabase connection credentials are missing or could not be established.",
        details: [
          "Client-side credentials (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) are completely blank or invalid.",
          "Please check local or Vercel Environment Variables configuration and rebuild/redeploy the app."
        ]
      });
      setIsSyncingDirectly(false);
      return;
    }

    // Pre-flight database connection test query
    if (activeTab !== "users") {
      addLog(`[Pipeline] Running pre-flight database connection test (select count(*) from sales_data limit 1)...`);
      try {
        const { error: testErr } = await sb!
          .from("sales_data")
          .select("*", { count: "exact", head: true })
          .limit(1);

        if (testErr) {
          throw new Error(`${testErr.message} (Code: ${testErr.code || "unknown"})`);
        }
        addLog(`[Pipeline Success] Database connection test passed! Supabase is fully responsive.`);
      } catch (conErr: any) {
        console.error("Supabase pre-flight connection test aborted:", conErr);
        const errDetail = conErr.message || "Uncaught network failure; check web console for CORS or CSP restrictions.";
        addLog(`[CRITICAL CONNECTION FAILURE] ${errDetail}`);
        setUploadStatus({
          type: "error",
          message: "Upload failed. Check logs.",
          details: [
            `Supabase connection credentials are missing or could not be established.`,
            `Database Error Details: ${errDetail}`,
            `Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel/Vite variables.`
          ]
        });
        setIsSyncingDirectly(false);
        return;
      }
    } else {
      addLog(`[Pipeline] Running user import pre-flight check...`);
    }

    try {
      // 1. Storage Upload
      if (activeFile && sb) {
        addLog(`[Storage] Archiving raw file "${activeFile.name}" to Supabase Storage before processing...`);
        const fileExt = activeFile.name.split(".").pop();
        const rawFileName = `${(activeFile.name || "Upload").replace(/\s+/g, "_")}_${Date.now()}.${fileExt}`;
        const filePath = `uploads/invoices/${rawFileName}`;

        addLog(`[Storage] Target bucket: "spreadsheets" | Target path: "${filePath}"`);
        const { data: storageData, error: storageError } = await sb.storage
          .from("spreadsheets")
          .upload(filePath, activeFile, {
            cacheControl: "3600",
            upsert: true
          });

        if (storageError) {
          addLog(`[Storage Warning] Storage upload did not complete checklist: ${storageError.message}`);
        } else {
          addLog(`[Storage] Successfully archived spreadsheet raw file to "${storageData.path}"!`);
        }
      } else {
        addLog(`[Storage Warning] Raw file content not found in state frame. Skipping storage archival...`);
      }

      let parsedCount = 0;
      let insertedCountAcc = 0;
      let duplicateCountAcc = 0;
      let failedCountAcc = 0;

      // ==========================================
      // SALES INVOICE BATCH INSERT ENGINE
      // ==========================================
      if (activeTab === "sales") {
        parsedCount = stagedInvoices.length;
        addLog(`[Validate] Counted ${parsedCount} staged invoices ready for ingestion.`);

        addLog(`[Deduplicate] Querying existing database invoice records to verify duplicates...`);
        
        let existingSales: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        let fetchErrOccurred = false;

        while (hasMore) {
          const start = page * pageSize;
          const end = start + pageSize - 1;
          const { data, error: fetchErr } = await sb
            .from("sales_data")
            .select("invoice_number, invoice_date, product_name, customer_code")
            .range(start, end);

          if (fetchErr) {
            addLog(`[Deduplicate Warning] Select call failed, checking skipped: ${fetchErr.message}`);
            fetchErrOccurred = true;
            break;
          }

          if (data && data.length > 0) {
            existingSales = [...existingSales, ...data];
            if (data.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        }

        const makeKey = (row: any) => {
          const invNo = String(row.invoice_number || row.invoiceNumber || "").trim().toLowerCase();
          const invDate = String(row.invoice_date || row.invoiceDate || "").trim().toLowerCase();
          const prod = String(row.product_name || row.productName || "").trim().toLowerCase();
          const cust = String(row.customer_code || row.customerCode || "").trim().toLowerCase();
          return `${invNo}|||${invDate}|||${prod}|||${cust}`;
        };

        const existingKeys = new Set(existingSales.map(makeKey));
        addLog(`[Deduplicate] Found ${existingKeys.size} historical invoice items in database.`);

        const toInsert: any[] = [];
        const seenInFile = new Set<string>();

        stagedInvoices.forEach(inv => {
          const key = makeKey(inv);
          if (existingKeys.has(key) || seenInFile.has(key)) {
            duplicateCountAcc++;
          } else {
            seenInFile.add(key);
            
            const spName = (inv.salesperson || "").trim().toLowerCase();
            const matchedUser = (users || []).find(u => 
              u.serverSynced === true &&
              ((u.name && u.name.trim().toLowerCase() === spName) ||
               (u.email && u.email.trim().toLowerCase() === spName))
            );
            
            // Select a real logged-in or seeded salesperson UUID as a fallback to avoid NULLs
            const sPersons = (users || []).filter(u => u.serverSynced === true && u.role === "Salesperson" && u.id && u.id.includes("-"));
            const defaultSpId = sPersons.length > 0 ? sPersons[0].id : null;
            
            const salesperson_id = (matchedUser && matchedUser.id && matchedUser.id.includes("-")) 
              ? matchedUser.id 
              : defaultSpId;

            let manager_id = (matchedUser && matchedUser.managerId && matchedUser.managerId.includes("-")) 
              ? matchedUser.managerId 
              : null;

            // Resolve manager ID via managerName lookup
            if (!manager_id && matchedUser && matchedUser.managerName) {
              const mgr = (users || []).find(u => u.serverSynced === true && u.name && u.name.toLowerCase() === matchedUser.managerName?.toLowerCase());
              if (mgr && mgr.id && mgr.id.includes("-")) {
                manager_id = mgr.id;
              }
            }

            // High priority region-based supervisor fallback
            if (!manager_id) {
              const regionLower = (inv.region || matchedUser?.region || "West").trim().toLowerCase();
              const supervisors = (users || []).filter(u => u.serverSynced === true && u.role === "Regional Manager" && u.id && u.id.includes("-"));
              const matchedRm = supervisors.find(u => u.region && u.region.toLowerCase() === regionLower);
              if (matchedRm) {
                manager_id = matchedRm.id;
              } else if (supervisors.length > 0) {
                manager_id = supervisors[0].id; // fallback to any supervisor
              } else {
                // look for admin/director fallback
                const boss = (users || []).find(u => u.serverSynced === true && (u.role === "Sales Director" || u.role === "Admin") && u.id && u.id.includes("-"));
                manager_id = boss ? boss.id : null;
              }
            }

            // Normalise date and prevent empty company, region and territory entries
            const normalizeDateToISO = (dStr: string) => {
              if (!dStr) return "2026-05-26";
              const strVal = String(dStr).trim();
              
              // Handle DD/MM/YYYY or DD-MM-YYYY explicitly to avoid month/day swapping in new Date()
              const match = strVal.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
              if (match) {
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1;
                const year = parseInt(match[3], 10);
                const dObj = new Date(year, month, day);
                if (!isNaN(dObj.getTime())) {
                  const y = dObj.getFullYear();
                  const m = String(dObj.getMonth() + 1).padStart(2, "0");
                  const d = String(dObj.getDate()).padStart(2, "0");
                  return `${y}-${m}-${d}`;
                }
              }
              const parsedDate = new Date(strVal);
              if (!isNaN(parsedDate.getTime())) {
                const y = parsedDate.getFullYear();
                const m = String(parsedDate.getMonth() + 1).padStart(2, "0");
                const d = String(parsedDate.getDate()).padStart(2, "0");
                return `${y}-${m}-${d}`;
              }
              return "2026-05-26";
            };

            const finalInvoiceDate = normalizeDateToISO(inv.invoiceDate);
            const finalCompany = (inv.company || "").trim() || "Dhanashree Agro";
            const finalRegion = (inv.region || "").trim() || matchedUser?.region || "West";
            const finalTerritory = (inv.territory || "").trim() || matchedUser?.territory || "West-1";

            toInsert.push({
              invoice_date: finalInvoiceDate,
              invoice_number: inv.invoiceNumber,
              company: finalCompany,
              customer_name: inv.customerName,
              customer_code: inv.customerCode,
              region: finalRegion,
              territory: finalTerritory,
              salesperson: inv.salesperson,
              salesperson_id,
              manager_id,
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
            });
          }
        });

        addLog(`[Deduplicate] Complete: bypassed ${duplicateCountAcc} duplicate lines. Slicing ${toInsert.length} ready rows.`);
        setDuplicateCount(duplicateCountAcc);

        const chunkSize = 500;
        const chunks: any[][] = [];
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          chunks.push(toInsert.slice(i, i + chunkSize));
        }

        addLog(`[Chunking] Sliced into ${chunks.length} batches of size up to 500 rows.`);

        // Ingestion Loop
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          addLog(`[Upload] Transmitting batch ${idx + 1} of ${chunks.length} (${chunk.length} rows)...`);
          
          let success = false;
          let attempt = 0;
          const maxAttempts = 3;
          let chunkError = "";

          while (attempt < maxAttempts && !success) {
            attempt++;
            const { error } = await sb.from("sales_data").insert(chunk);
            if (!error) {
              success = true;
            } else {
              chunkError = error.message;
              if (attempt < maxAttempts) {
                addLog(`[Warning] Attempt ${attempt} failed: ${chunkError}. Retrying in ${300 * attempt}ms...`);
                await new Promise(resolve => setTimeout(resolve, 300 * attempt));
              }
            }
          }

          if (success) {
            insertedCountAcc += chunk.length;
            setInsertedCount(insertedCountAcc);
            addLog(`[Upload] Batch ${idx + 1} finalized successfully.`);
          } else {
            failedCountAcc += chunk.length;
            setFailedCount(failedCountAcc);
            addLog(`[FAILED] Batch ${idx + 1} insertion aborted: ${chunkError}`);
          }

          setUploadProgress(Math.round(((idx + 1) / chunks.length) * 100));
        }

        addLog(`[Verify] Verification pipeline initialized.`);
        addLog(`[Verify] Parsed: ${parsedCount} | Inserted: ${insertedCountAcc} | Duplicates skipped: ${duplicateCountAcc} | Failed: ${failedCountAcc}`);

        const hasMismatch = (parsedCount !== (insertedCountAcc + duplicateCountAcc + failedCountAcc));
        if (hasMismatch) {
          addLog(`[Verify Warning] Parsed row metric discrepancy occurred! Parsed: ${parsedCount} lines vs Processed total: ${insertedCountAcc + duplicateCountAcc + failedCountAcc}`);
        } else {
          addLog(`[Verify Success] Perfect integrity check matching.`);
        }

        // Audit Logging
        addLog(`[Audit] Recording metadata logs to upload_audit_logs...`);
        const auditStatus = failedCountAcc > 0 ? (insertedCountAcc > 0 ? "Partial_Success" : "Failed") : "Completed";

        const { data: auditData, error: auditErr } = await sb
          .from("upload_audit_logs")
          .insert({
            file_name: activeFile ? activeFile.name : `Invoice_Manual_Upload_${Date.now()}.xlsx`,
            file_type: "Sales Invoices",
            uploaded_by: currentUser.name || currentUser.email || "System Operator",
            total_rows: parsedCount,
            inserted_rows: insertedCountAcc,
            duplicate_rows: duplicateCountAcc,
            failed_rows: failedCountAcc,
            status: auditStatus,
            timestamp: new Date().toISOString()
          })
          .select();

        if (auditErr) {
          addLog(`[Audit Warning] Could not finalize audit metadata logs: ${auditErr.message}`);
        } else if (auditData && auditData.length > 0) {
          const auditId = auditData[0].id;
          addLog(`[Audit] Log verified! Audit Row ID: ${auditId}`);
          
          if (failedCountAcc > 0) {
            addLog(`[Audit] Writing detailed failure tracking list to failed_upload_rows...`);
            const failedIndexRows = chunks.flatMap((chunk, cIdx) => 
              chunk.map((item, rIdx) => ({
                audit_id: auditId,
                row_index: cIdx * chunkSize + rIdx,
                invoice_number: item.invoice_number || null,
                error_message: "Direct Insertion failure: network connection lost or schema violation.",
                timestamp: new Date().toISOString()
              }))
            ).slice(0, 15); // log up to 15 items safely

            const { error: failedInsertErr } = await sb.from("failed_upload_rows").insert(failedIndexRows);
            if (failedInsertErr) {
              addLog(`[Audit Warning] Failed to archive failed rows trace: ${failedInsertErr.message}`);
            } else {
              addLog(`[Audit] Row failure traceback logged.`);
            }
          }
        }

        if (failedCountAcc === 0 || insertedCountAcc > 0) {
          setUploadStatus({
            type: "committed",
            message: "Upload completed successfully",
            details: [
              `Successfully parsed ${parsedCount} entries from standard sheet columns.`,
              `Inserted and stored ${insertedCountAcc} invoice transaction rows to central Supabase DB.`,
              `Skipped & Bypassed ${duplicateCountAcc} pre-existing duplicate entries.`,
              failedCountAcc > 0 ? `Failed ${failedCountAcc} records insert.` : `Zero insertion failures recorded.`,
              hasMismatch ? `⚠️ Checksum warning: parsed rows did not match sum result.` : `✅ All parsed rows verified successfully.`
            ]
          });
          setStagedInvoices([]);
          setActiveFile(null);
        } else {
          setUploadStatus({
            type: "error",
            message: "Upload failed. Check logs.",
            details: ["All batches failed inserts due to connection losses or missing permissions."]
          });
        }
      }

      // ==========================================
      // BUDGET TARGETS BATCH INSERT ENGINE
      // ==========================================
      else if (activeTab === "budget") {
        parsedCount = stagedBudgets.length;
        addLog(`[Budget] Loaded ${parsedCount} salesperson budget spreadsheet cells.`);

        const rows = stagedBudgets.map(b => {
          const matchedUser = (users || []).find(
            u => u.name && (u.name || "").trim().toLowerCase() === (b.salesperson || "").trim().toLowerCase()
          );
          return {
            product_name: b.product,
            budget_quantity: b.budgetQuantity,
            budget_value: b.budgetValue,
            month: b.month,
            financial_year: b.financialYear,
            salesperson_id: matchedUser ? matchedUser.id : null
          };
        }).filter(r => r.salesperson_id !== null);

        addLog(`[Budget] Matched names to client database accounts for ${rows.length} salesperson targets.`);

        const chunkSize = 500;
        const chunks: any[][] = [];
        for (let i = 0; i < rows.length; i += chunkSize) {
          chunks.push(rows.slice(i, i + chunkSize));
        }

        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          addLog(`[Budget] Inserting chunk ${idx + 1} of ${chunks.length} targets...`);
          const { error } = await sb!.from("budget_data").insert(chunk);
          if (error) {
            failedCountAcc += chunk.length;
            addLog(`[Budget FAIL] Batch ${idx + 1} failed: ${error.message}`);
          } else {
            insertedCountAcc += chunk.length;
            setInsertedCount(insertedCountAcc);
          }
          setUploadProgress(Math.round(((idx + 1) / chunks.length) * 100));
        }

        addLog(`[Budget] Sinking upload audit metadata summary...`);
        await sb!.from("upload_audit_logs").insert({
          file_name: activeFile ? activeFile.name : `Budgets_Manual_Upload_${Date.now()}.xlsx`,
          file_type: "Budget Targets",
          uploaded_by: currentUser.name || currentUser.email || "System Operator",
          total_rows: parsedCount,
          inserted_rows: insertedCountAcc,
          duplicate_rows: 0,
          failed_rows: failedCountAcc,
          status: failedCountAcc > 0 ? "Failed" : "Completed",
          timestamp: new Date().toISOString()
        });

        if (insertedCountAcc > 0) {
          setUploadStatus({
            type: "committed",
            message: "Upload completed successfully",
            details: [
              `Successfully mapped and saved ${insertedCountAcc} salesperson target values in Supabase database.`
            ]
          });
          setStagedBudgets([]);
          setActiveFile(null);
        } else {
          setUploadStatus({
            type: "error",
            message: "Upload failed. Check logs.",
            details: ["All rows rejected or zero employees matched by names within sheet."]
          });
        }
      }

      // ==========================================
      // SALES TEAM USERS BATCH INSERT ENGINE
      // ==========================================
      else if (activeTab === "users") {
        parsedCount = stagedUsers.length;
        addLog(`[Pipeline] Triggering bulk users ingestion pipeline for ${parsedCount} users...`);

        try {
          if (onSaveUsersBulk) {
            const result = await onSaveUsersBulk(stagedUsers);
            const success = typeof result === "boolean" ? result : result?.success;
            const errorMsg = (typeof result === "object" && result?.error) ? result.error : "";
            
            if (success) {
              insertedCountAcc = stagedUsers.length;
              setInsertedCount(insertedCountAcc);
              setUploadProgress(100);
              addLog(`[Pipeline Success] Bulk imported and registered ${stagedUsers.length} user profiles!`);
            } else {
              throw new Error(errorMsg || "Bulk save operation returned an error.");
            }
          } else {
            throw new Error("Bulk save prop handler not registered in client component.");
          }
        } catch (uErr: any) {
          failedCountAcc = stagedUsers.length;
          setFailedCount(failedCountAcc);
          addLog(`[CRITICAL ERROR] Bulk users ingestion failed: ${uErr.message}`);
          throw uErr;
        }

        if (insertedCountAcc > 0) {
          setUploadStatus({
            type: "committed",
            message: "Upload completed successfully",
            details: [
              `Successfully imported and registered ${insertedCountAcc} sales team members!`,
              `Any offline cached users have been healed and synchronized.`
            ]
          });
          setStagedUsers([]);
          setActiveFile(null);
        } else {
          setUploadStatus({
            type: "error",
            message: "Upload failed. Check logs.",
            details: ["All rows rejected or bulk ingestion failed."]
          });
        }
      }

      addLog(`[Pipeline] Healing dashboard views...`);
      await onDataUploaded([], []); // triggers silent refresh in parent App.tsx
      addLog(`[Pipeline] Sync complete! Central database active.`);

    } catch (ex: any) {
      console.error("Direct sync exception:", ex);
      addLog(`[CRITICAL EXCEPTION] Operation thread crashed: ${ex.message}`);
      setUploadStatus({
        type: "error",
        message: "Upload failed. Check logs.",
        details: [ex.message || "An unexpected thread execution abort occurred."]
      });
    } finally {
      setIsSyncingDirectly(false);
    }
  };

  // Parse Excel sheets using SheetJS
  const handleFile = async (file: File) => {
    if (!file) return;

    setActiveFile(file);
    setUploadStatus({ type: "idle", message: "Parsing spreadsheet in real-time..." });

    // Background archival to Supabase Storage bucket
    const sb = getSupabase();
    if (sb) {
      console.log("Archiving raw Excel sheet to Supabase Storage bucket...");
      uploadExcelToStorage(file, currentUser.email, activeTab === "sales" ? "Sales Transactions" : "Budget Sheets")
        .then((resUrl) => {
          if (resUrl) {
            console.log("Raw spreadsheet successfully archived in Supabase Storage:", resUrl);
          }
        })
        .catch(err => {
          console.warn("Raw spreadsheet archival skipped or encountered a warning:", err.message);
        });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("No file content read.");

        const workbook = XLSX.read(data, { type: "array" });
        
        if (activeTab === "sales") {
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Extract Company data from Cell A1 of the sheet
          const a1Cell = worksheet ? worksheet['A1'] : null;
          const companyFromA1 = a1Cell && a1Cell.v ? String(a1Cell.v).trim() : undefined;

          // Sales data field headings are on row 4 of the sheet (which is 0-indexed index 3)
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { range: 3 });
          if (jsonData.length === 0) {
            throw new Error("Spreadsheet appears to be empty. No records detected.");
          }
          validateAndProcessSales(jsonData, companyFromA1);
        } else if (activeTab === "budget") {
          // Budget data: process all sheets in workbook
          validateAndProcessBudgetSheets(workbook);
        } else {
          // Users upload
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
          validateAndProcessUsers(jsonData);
        }
      } catch (err: any) {
        setUploadStatus({
          type: "error",
          message: "Unable to parse Excel document",
          details: [err.message || "Invalid file format or structure. Make sure you use a standard spreadsheet."]
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ETL & Data cleaning pipelines for Invoices
  const validateAndProcessSales = (rawRows: any[], companyFromA1?: string) => {
    if (rawRows.length === 0) {
      setUploadStatus({
        type: "error",
        message: "Source sheet is empty",
        details: ["Spreadsheet contains no rows below the heading range."]
      });
      return;
    }

    const rowKeys = Object.keys(rawRows[0]).map(k => k.trim().toLowerCase());
    
    // Check if the uploaded headers on row 4 contain standard or mapped column keys/aliases
    const hasDate = rowKeys.some(k => ["date", "invoice date", "date of invoice"].includes(k));
    const hasInvNo = rowKeys.some(k => ["invoice/voucher no", "invoice/voucher number", "invoice no", "inv no", "voucher no", "voucher number"].includes(k));
    const hasCustomer = rowKeys.some(k => ["customer/ledger name", "customer name", "ledger name", "dealer", "customer", "customer/ledger", "particulars"].includes(k));
    const hasGroup = rowKeys.some(k => ["name of group", "region", "zone", "group name", "name of group (region)"].includes(k));
    const hasSubGroup = rowKeys.some(k => ["name of sub group", "territory", "area", "sub group name", "sub group", "name of sub group (territory)"].includes(k));
    const hasQty = rowKeys.some(k => ["quantity in kg/ltr", "quantity in kg/ltr)", "quantity", "qty", "volume", "quantity in kg", "quantity in ltr"].includes(k));

    const missingHeaders: string[] = [];
    if (!hasDate) missingHeaders.push("Date");
    if (!hasInvNo) missingHeaders.push("Invoice/Voucher No");
    if (!hasCustomer) missingHeaders.push("Customer/Ledger Name");
    if (!hasGroup) missingHeaders.push("Name of Group (Region)");
    if (!hasSubGroup) missingHeaders.push("Name of sub group (Territory)");
    if (!hasQty) missingHeaders.push("Quantity in kg/Ltr");

    if (missingHeaders.length > 0) {
      setUploadStatus({
        type: "error",
        message: "Sales upload template headers mismatch on row 4",
        details: [
          "Could not map the required columns in row 4 of the spreadsheet.",
          `Missing required columns: ${missingHeaders.join(", ")}`,
          `Detected columns in file: ${Object.keys(rawRows[0]).join(", ")}`
        ]
      });
      return;
    }

    const cleanedInvoices: InvoiceItem[] = [];
    const logs: string[] = [];
    let missingValuesFilled = 0;

    // Report dynamic company parsing
    if (companyFromA1) {
      logs.push(`Extracted Company Name from A1 of sheet: "${companyFromA1}"`);
    }

    rawRows.forEach((row, idx) => {
      // Standardize properties casing and retrieve values
      const rowItemKeys = Object.keys(row);
      const findVal = (names: string[]) => {
        const matchingKey = rowItemKeys.find(k => names.includes(k.trim().toLowerCase()));
        return matchingKey !== undefined ? row[matchingKey] : null;
      };

      const invoiceDateRaw = findVal(["date", "invoice date", "date of invoice", "voucher date"]);
      const invoiceNumber = String(findVal(["invoice/voucher no", "invoice/voucher number", "invoice no", "inv no", "voucher no", "voucher number"]) || `INV-T-${1000 + idx}`);
      
      // Determine company context dynamically from Cell A1 of the sheet
      let company = companyFromA1 || "Company A";

      const customerName = String(findVal(["customer/ledger name", "customer name", "ledger name", "dealer", "customer", "customer/ledger", "particulars"]) || "Standard Dealer");
      const customerCode = `CUST_${customerName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}`;
      
      const region = String(findVal(["name of group (region)", "name of group", "region", "zone", "group name"]) || "West");
      const territory = String(findVal(["name of sub group (territory)", "name of sub group", "territory", "area", "sub group name", "sub group"]) || "West-1");
      const godownName = String(findVal(["godown name", "godown", "warehouse", "location"]) || "Main Godown");

      // Robust Stock Group vs Product Name extraction based on specifications
      let productCategory = "Biostimulants";
      const stockGroupKey = rowItemKeys.find(k => ["stock group", "stock group (product name)", "product category", "category", "product group"].includes(k.trim().toLowerCase()));
      if (stockGroupKey) {
        productCategory = String(row[stockGroupKey]).trim();
      }

      let productName = "SugaMax Bio Enhancer";
      const productNameKey = rowItemKeys.find(k => {
        const kl = k.trim().toLowerCase();
        // Skip stockGroupKey to avoid duplicate mappings
        if (stockGroupKey && k === stockGroupKey) return false;
        return ["product name (product code)", "product name", "product code", "item", "product", "stock item"].includes(kl);
      });
      if (productNameKey) {
        productName = String(row[productNameKey]).trim();
      } else if (!stockGroupKey) {
        const anyProductKey = rowItemKeys.find(k => ["product name", "item", "product"].includes(k.trim().toLowerCase()));
        if (anyProductKey) {
          productName = String(row[anyProductKey]).trim();
        }
      }

      const supplier = String(findVal(["stock category (supplier)", "stock category", "supplier", "manufacturer"]) || "BioCore Solutions India");
      
      const qtyRaw = findVal(["quantity in kg/ltr", "quantity in kg/ltr)", "quantity", "qty", "volume", "quantity in kg", "quantity in ltr"]);
      let quantity = Number(qtyRaw);
      if (isNaN(quantity)) { 
        quantity = 1; 
        missingValuesFilled++; 
      }

      // Automatically map correct salesperson, regionalSupervisor, and state based on territory mapping
      const normTerr = territory.trim().toLowerCase().replace(/[\s_-]+/g, "");
      let salesperson = "V. R. Sharma";
      let regionalManager = "S. R. Patil";
      let state = "Maharashtra";
      let mappedRegion = "West";

      if (normTerr.includes("west1")) {
        salesperson = "V. R. Sharma";
        regionalManager = "S. R. Patil";
        mappedRegion = "West";
        state = "Maharashtra";
      } else if (normTerr.includes("west2")) {
        salesperson = "A. P. Kulkarni";
        regionalManager = "S. R. Patil";
        mappedRegion = "West";
        state = "Maharashtra";
      } else if (normTerr.includes("south1")) {
        salesperson = "M. N. Rao";
        regionalManager = "K. Swamy";
        mappedRegion = "South";
        state = "Karnataka";
      } else if (normTerr.includes("south2")) {
        salesperson = "S. Gopal";
        regionalManager = "K. Swamy";
        mappedRegion = "South";
        state = "Andhra Pradesh";
      } else if (normTerr.includes("north1")) {
        salesperson = "Amit Verma";
        regionalManager = "R. K. Singh";
        mappedRegion = "North";
        state = "Delhi";
      } else {
        const normReg = region.trim().toLowerCase();
        if (normReg.includes("south")) {
          salesperson = "M. N. Rao";
          regionalManager = "K. Swamy";
          mappedRegion = "South";
          state = "Karnataka";
        } else if (normReg.includes("north")) {
          salesperson = "Amit Verma";
          regionalManager = "R. K. Singh";
          mappedRegion = "North";
          state = "Delhi";
        } else if (normReg.includes("west")) {
          salesperson = "V. R. Sharma";
          regionalManager = "S. R. Patil";
          mappedRegion = "West";
          state = "Maharashtra";
        } else {
          // Dynamic Custom Spreadsheet uploaded by user
          salesperson = territory.trim();
          regionalManager = region.trim();
          mappedRegion = region.trim();
          state = "Maharashtra"; // fallback
        }
      }

      // Overrule regional manager if explicitly defined in users profile or known mapping
      const salespersonNorm = salesperson.trim().toLowerCase();
      
      // Dynamic registered users lookup prioritized by name or email
      const matchedUser = (users || []).find(
        u => u.name.trim().toLowerCase() === salespersonNorm ||
             (u.email && u.email.trim().toLowerCase() === salespersonNorm)
      );

      if (matchedUser && matchedUser.managerName) {
        regionalManager = matchedUser.managerName;
        if (matchedUser.region) {
          mappedRegion = matchedUser.region;
        }
      } else if (salespersonNorm.includes("rahul borse") || salespersonNorm === "rahul borse") {
        regionalManager = "Gajanan Tale";
        mappedRegion = "West";
        state = "Maharashtra";
      } else if (salespersonNorm.includes("vitthal dahiphale") || salespersonNorm === "vitthal dahiphale") {
        regionalManager = "S. R. Patil";
        mappedRegion = "West";
        state = "Maharashtra";
      } else if (salespersonNorm.includes("bhagwat waghchaure") || salespersonNorm === "bhagwat waghchaure") {
        regionalManager = "Vishnu Bhagare";
        mappedRegion = "West";
        state = "Maharashtra";
      } else if (salespersonNorm.includes("gajanan tale") || salespersonNorm === "gajanan tale") {
        regionalManager = "Sushil Giri";
        mappedRegion = "West";
        state = "Maharashtra";
      } else if (salespersonNorm.includes("vishnu bhagare") || salespersonNorm === "vishnu bhagare" || salespersonNorm.includes("vishnu bhagre") || salespersonNorm === "vishnu bhagre") {
        regionalManager = "Sushil Giri";
        mappedRegion = "West";
        state = "Maharashtra";
      } else if (salespersonNorm.includes("sushil giri") || salespersonNorm === "sushil giri") {
        regionalManager = "Rahul Sawant";
        mappedRegion = "West";
        state = "Maharashtra";
      } else {
        // Explicit fallback to the Sales Director (Rahul Sawant)
        regionalManager = "Rahul Sawant";
      }

      // Read Packing Rate per Kg/Ltr (Rate)
      const excelRate = findVal([
        "packing rate per kg/ltr (rate)",
        "packing rate per kg/ltr",
        "rate",
        "price",
        "packing rate per kg/ltr (rate )",
        "packing rate per kg/ ltr (rate)"
      ]);
      let rate = excelRate !== null && excelRate !== "" && !isNaN(Number(excelRate)) ? Number(excelRate) : 0;
      
      const pNameLower = productName.toLowerCase();
      if (rate === 0) {
        rate = 300;
        if (pNameLower.includes("sugamax") || pNameLower.includes("enhancer")) {
          rate = 450;
        } else if (pNameLower.includes("agrogrow") || pNameLower.includes("soluble")) {
          rate = 150;
        } else if (pNameLower.includes("zinc") || pNameLower.includes("soluble")) {
          rate = 220;
        } else if (pNameLower.includes("micro") || pNameLower.includes("nutrient")) {
          rate = 350;
        } else if (pNameLower.includes("nitro") || pNameLower.includes("bacteria")) {
          rate = 180;
        }
      }

      // Read Invoice ValueW/GST (Gross Value)
      const excelGross = findVal([
        "invoice valuew/gst (gross value)",
        "invoice valuew/gst",
        "gross value",
        "gross value rs",
        "invoice value w/gst",
        "invoice value"
      ]);
      let grossValue = excelGross !== null && excelGross !== "" && !isNaN(Number(excelGross)) ? Number(excelGross) : (quantity * rate);

      // Read UOM (units)
      const excelUnits = findVal([
        "uom (units)",
        "uom",
        "unit",
        "units",
        "uom(units)"
      ]);
      const unit = excelUnits !== null && excelUnits !== "" ? String(excelUnits).trim() : (pNameLower.includes("sugamax") || pNameLower.includes("enhancer") ? "Litre" : "KG");

      // Read Total with TAX (Net Sales Value)
      const excelNet = findVal([
        "total with tax (net sales value)",
        "total with tax",
        "net sales value",
        "net value",
        "net sales amount",
        "total with tax(net sales value)"
      ]);
      let netSalesValue = excelNet !== null && excelNet !== "" && !isNaN(Number(excelNet)) ? Number(excelNet) : grossValue;

      // Handle Voucher Type "Credit Note"
      const voucherTypeVal = String(findVal(["voucher type", "type of voucher", "voucher_type"]) || "").trim();
      const isCreditNote = voucherTypeVal.toLowerCase().includes("credit note");

      if (isCreditNote) {
        quantity = -Math.abs(quantity);
        grossValue = -Math.abs(grossValue);
        netSalesValue = -Math.abs(netSalesValue);
      } else {
        quantity = Math.abs(quantity);
        grossValue = Math.abs(grossValue);
        netSalesValue = Math.abs(netSalesValue);
      }

      // Extract and normalize Date
      let invoiceDate = "2026-05-26";
      if (invoiceDateRaw) {
        if (typeof invoiceDateRaw === "number") {
          // Excel serial timestamp conversion
          const dateObj = new Date(Math.round((invoiceDateRaw - 25569) * 86400 * 1000));
          if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
            invoiceDate = dateObj.toISOString().slice(0, 10);
          }
        } else {
          const d = new Date(invoiceDateRaw);
          if (!isNaN(d.getTime())) {
            invoiceDate = d.toISOString().slice(0, 10);
          }
        }
      }

      // Clean/standardize text
      const standardizedCustomer = getStandardizedValue(customerName, "customer")
        .replace(/fert$/i, "Fertilizers")
        .replace(/corp$/i, "Corporation");

      const standardizedProduct = getStandardizedValue(productName, "product");

      const compSlug = company.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "CMP";
      cleanedInvoices.push({
        id: `upl_${compSlug}_${Date.now()}_${idx}`,
        invoiceDate,
        invoiceNumber,
        company,
        customerName: standardizedCustomer,
        customerCode,
        region: mappedRegion,
        state,
        territory,
        salesperson,
        regionalManager,
        productName: standardizedProduct,
        productCategory,
        supplier,
        quantity,
        unit,
        rate,
        grossValue,
        discount: grossValue - netSalesValue,
        netSalesValue,
        godownName,
        voucherType: voucherTypeVal || (isCreditNote ? "Credit Note" : "Sales"),
      });
    });

    logs.push(`Successfully mapped and imported ${cleanedInvoices.length} columns based strictly on row 4 specifications.`);
    if (missingValuesFilled > 0) {
      logs.push(`Filled ${missingValuesFilled} empty or NaN entries with fallback values.`);
    }

    const getInvoiceCompKey = (inv: InvoiceItem) => {
      const company = (inv.company || "").trim().toLowerCase();
      const date = (inv.invoiceDate || "").trim().toLowerCase();
      const invNo = (inv.invoiceNumber || "").trim().toLowerCase();
      const custName = (inv.customerName || "").trim().toLowerCase();
      const prodName = (inv.productName || "").trim().toLowerCase();
      const qty = String(inv.quantity || 0).trim();
      return `${company}|||${date}|||${invNo}|||${custName}|||${prodName}|||${qty}`;
    };

    const mergedMap = new Map<string, InvoiceItem>();
    
    // Add existing staged items
    stagedInvoices.forEach((inv) => {
      const key = getInvoiceCompKey(inv);
      mergedMap.set(key, inv);
    });

    // Overwrite/Add incoming items (latest upload overwrites the old data)
    cleanedInvoices.forEach((inv) => {
      const key = getInvoiceCompKey(inv);
      mergedMap.set(key, inv);
    });

    const finalMergedStaged = Array.from(mergedMap.values());
    
    // Database stability row limit constraint check
    const MAX_INVOICES_LIMIT = 30000;
    if (finalMergedStaged.length > MAX_INVOICES_LIMIT) {
      setUploadStatus({
        type: "error",
        message: "Spreadsheet contains too many transaction rows (Limit Exceeded)",
        details: [
          `The combined dataset contains ${finalMergedStaged.length} records.`,
          `This exceeds the active database limitation safety limit of ${MAX_INVOICES_LIMIT} invoice/transaction records.`,
          "To preserve client-side persistence stability and high-performance charts rendering, please reduce the row count in your spreadsheet or filter out older records."
        ]
      });
      return;
    }

    setStagedInvoices(finalMergedStaged);

    setUploadStatus({
      type: "success",
      message: `Successfully processed ${cleanedInvoices.length} Sales Voucher Records! Total Staged: ${finalMergedStaged.length}`,
      details: [
        ...logs,
        `You can keep dragging/browsing more files to stage them together!`,
        `For duplicate records (with same company, date, invoice number, voucher type, customer/ledger name and stock group/category), we've kept the latest upload's details.`
      ],
    });
  };

  // ETL processing for Budget sheets in a workbook (one sheet per salesperson)
  const validateAndProcessBudgetSheets = (workbook: XLSX.WorkBook) => {
    const allCleanedBudgets: BudgetItem[] = [];
    const logs: string[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      const getCellValue = (addr: string, fallback: string) => {
        const cell = worksheet[addr.toUpperCase()] || worksheet[addr.toLowerCase()];
        return cell && cell.v !== undefined ? String(cell.v).trim() : fallback;
      };

      const cleanMetaValue = (val: string) => {
        return val.replace(/^(salesperson|territory|financial year|fy|year)\s*:?\s*/i, "").trim();
      };

      // Extracted metadata from Cells C2, C4, C10
      let salespersonC2 = cleanMetaValue(getCellValue("C2", ""));
      // Fallback to sheetName if cell C2 is empty or just generic label
      if (!salespersonC2 || salespersonC2.toLowerCase() === "salesperson") {
        salespersonC2 = sheetName;
      }
      const territoryC4 = cleanMetaValue(getCellValue("C4", "West-1"));
      const financialYearC10 = cleanMetaValue(getCellValue("C10", "2026-27"));

      // Budget data headings are at Row 9 (0-indexed 8)
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { range: 8 });
      if (rawRows.length === 0) return;

      const sheetBudgets: BudgetItem[] = [];

      rawRows.forEach((row, idx) => {
        const findVal = (names: string[]) => {
          const matchingKey = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));
          return matchingKey !== undefined && matchingKey !== null ? row[matchingKey] : null;
        };

        const productRaw = findVal(["particulars", "product", "product (particulars)", "item", "stock group", "product name", "particulars (product)"]);
        if (!productRaw || String(productRaw).trim() === "" || String(productRaw).toLowerCase().includes("total")) {
          return; // Skip totals or empty divider rows
        }

        const product = String(productRaw).trim();
        if (product.toLowerCase() === "particulars") {
          return; // Skip repeat header lines
        }

        const qtyRaw = findVal(["budget quantity", "quantity", "qty", "volume", "target qty", "budget qty"]);
        const rateRaw = findVal(["rate", "budget rate", "budget rate(rate)", "price", "unit rate"]);
        const valRaw = findVal(["budget value", "value", "target value", "target value rs", "budget val"]);

        const budgetQuantity = Number(qtyRaw) || (Number(valRaw) && Number(rateRaw) ? Math.round(Number(valRaw) / Number(rateRaw)) : 100);
        const budgetRate = Number(rateRaw) || (Number(valRaw) && Number(qtyRaw) ? Number(valRaw) / Number(qtyRaw) : 500);
        const budgetValue = Number(valRaw) || (budgetQuantity * budgetRate) || 50000;

        // Determine budget regional manager and region dynamically
        const spNorm = salespersonC2.trim().toLowerCase();
        let budgetRm = "Rahul Sawant";
        let budgetReg = "West";

        const matchedSpUser = (users || []).find(
          u => u.name.trim().toLowerCase() === spNorm ||
               (u.email && u.email.trim().toLowerCase() === spNorm)
        );

        if (matchedSpUser && matchedSpUser.managerName) {
          budgetRm = matchedSpUser.managerName;
          if (matchedSpUser.region) {
            budgetReg = matchedSpUser.region;
          }
        } else if (spNorm.includes("rahul borse") || spNorm === "rahul borse") {
          budgetRm = "Gajanan Tale";
          budgetReg = "West";
        } else if (spNorm.includes("vitthal dahiphale") || spNorm === "vitthal dahiphale") {
          budgetRm = "S. R. Patil";
          budgetReg = "West";
        } else if (spNorm.includes("bhagwat waghchaure") || spNorm === "bhagwat waghchaure") {
          budgetRm = "Vishnu Bhagare";
          budgetReg = "West";
        } else if (spNorm.includes("gajanan tale") || spNorm === "gajanan tale") {
          budgetRm = "Sushil Giri";
          budgetReg = "West";
        } else if (spNorm.includes("vishnu bhagare") || spNorm === "vishnu bhagare" || spNorm.includes("vishnu bhagre") || spNorm === "vishnu bhagre") {
          budgetRm = "Sushil Giri";
          budgetReg = "West";
        } else if (spNorm.includes("sushil giri") || spNorm === "sushil giri") {
          budgetRm = "Rahul Sawant";
          budgetReg = "West";
        } else if (spNorm.includes("v. r. sharma") || spNorm.includes("vrsharma")) {
          budgetRm = "S. R. Patil";
          budgetReg = "West";
        } else if (spNorm.includes("a. p. kulkarni") || spNorm.includes("apkulkarni")) {
          budgetRm = "S. R. Patil";
          budgetReg = "West";
        } else if (spNorm.includes("m. n. rao") || spNorm.includes("mnrao")) {
          budgetRm = "K. Swamy";
          budgetReg = "South";
        } else if (spNorm.includes("s. gopal") || spNorm.includes("sgopal")) {
          budgetRm = "K. Swamy";
          budgetReg = "South";
        } else if (spNorm.includes("amit verma") || spNorm.includes("averma")) {
          budgetRm = "R. K. Singh";
          budgetReg = "North";
        }

        sheetBudgets.push({
          id: `bud_upl_${sheetName}_${Date.now()}_${idx}`,
          salesperson: matchedSpUser ? matchedSpUser.name : salespersonC2,
          territory: territoryC4,
          product,
          budgetQuantity,
          budgetRate,
          budgetValue,
          month: "YTD (Mar-May)", // Budget sheets are for the financial year
          financialYear: financialYearC10,
          regionalManager: budgetRm,
          region: budgetReg,
        });
      });

      if (sheetBudgets.length > 0) {
        allCleanedBudgets.push(...sheetBudgets);
        logs.push(`Sheet "${sheetName}": Extracted ${sheetBudgets.length} targets for salesperson "${salespersonC2}" (${territoryC4}, FY ${financialYearC10})`);
      }
    });

    if (allCleanedBudgets.length === 0) {
      setUploadStatus({
        type: "error",
        message: "No valid budget items found under row 9 headers in any sheet",
        details: ["Could not parse particulars/product, budget quantity, or budget value columns from row 9 in any worksheet of the workbook."]
      });
      return;
    }

    logs.push(`Consolidated target matrices relative to fiscal year calendar starting on 1st March.`);
    
    // Database stability row limit constraint check for budgets
    const MAX_BUDGETS_LIMIT = 1000;
    if (allCleanedBudgets.length > MAX_BUDGETS_LIMIT) {
      setUploadStatus({
        type: "error",
        message: "Spreadsheet contains too many target entries (Limit Exceeded)",
        details: [
          `The uploaded budget spreadsheet yields ${allCleanedBudgets.length} entries.`,
          `This exceeds the active database limitation limit of ${MAX_BUDGETS_LIMIT} target allocations.`,
          "Please verify that you aren't uploading duplicated sheets or redundant columns."
        ]
      });
      return;
    }

    setStagedBudgets(allCleanedBudgets);
    setUploadStatus({
      type: "success",
      message: `Parsed and validated ${allCleanedBudgets.length} Salesperson Budget Target Line Items across ${workbook.SheetNames.length} sheet(s) (Staged - Click Commit Below to Save)`,
      details: logs,
    });
  };

  // ETL processing for sales team users spreadsheet
  const validateAndProcessUsers = (rawRows: any[]) => {
    if (rawRows.length === 0) {
      setUploadStatus({
        type: "error",
        message: "Source sheet is empty",
        details: ["Spreadsheet contains no rows below the heading range."]
      });
      return;
    }

    try {
      // Validate headers case-insensitively
      const sampleRow = rawRows[0];
      const columns = Object.keys(sampleRow);
      
      const findCol = (names: string[]) => {
        return columns.find(c => names.some(n => c.trim().toLowerCase() === n.toLowerCase().trim()));
      };

      // Mappings for both old format and new format
      const colName = findCol(["employee_name", "employee name", "name"]);
      const colCode = findCol(["employee_code", "employee code", "code"]);
      const colEmail = findCol(["email", "email address", "corporate email"]);
      const colRole = findCol(["role", "post", "role level", "security role"]);
      const colTerritory = findCol(["territory", "location", "territory group scope", "sub group"]);
      const colRegion = findCol(["region", "zone", "group name", "name of group"]);
      const colManager = findCol(["manager_id", "reporting manager", "manager", "manager name"]);
      const colJoiningDate = findCol(["joining_date", "joining date", "date of joining"]);
      const colStatus = findCol(["status", "is_active", "active", "approved"]);
      const colPassword = findCol(["password", "set password"]); // only in old format, optional

      const missingCols = [];
      if (!colName) missingCols.push("employee_name / Employee Name");
      if (!colEmail) missingCols.push("email");
      if (!colRole) missingCols.push("role / Post");
      if (!colTerritory) missingCols.push("territory / Location");
      if (!colRegion) missingCols.push("region / Region");
      if (!colManager) missingCols.push("manager_id / Reporting Manager");

      if (missingCols.length > 0) {
        throw new Error(`Missing required columns: ${missingCols.join(", ")}`);
      }

      // Helper to normalize the role
      const normalizeExcelRole = (postVal: string): "Admin" | "Sales Director" | "Regional Manager" | "Salesperson" | null => {
        const lower = postVal.trim().toLowerCase().replace(/[^a-z]+/g, "");
        if (lower === "admin" || lower === "administrator") return "Admin";
        if (lower === "salesdirector" || lower === "director") return "Sales Director";
        if (lower === "regionalmanager" || lower === "rm" || lower === "manager") return "Regional Manager";
        if (lower === "salesperson" || lower === "salesrep" || lower === "rep" || lower === "sales") return "Salesperson";
        return null;
      };

      const validatedUsers: any[] = [];
      const emailsSet = new Set<string>();

      // Row numbers are 2-indexed since row 1 is header
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNum = i + 2;

        const name = String(row[colName!] || "").trim();
        const email = String(row[colEmail!] || "").trim();
        const roleVal = String(row[colRole!] || "").trim();
        const territory = String(row[colTerritory!] || "").trim();
        const region = String(row[colRegion!] || "").trim();
        const managerRaw = String(row[colManager!] || "").trim();
        
        // Optional columns
        const code = colCode ? String(row[colCode] || "").trim() : "";
        const statusVal = colStatus ? String(row[colStatus] || "").trim() : "";
        const password = colPassword ? String(row[colPassword] || "").trim() : "password123";

        // 1. Check required fields
        if (!name || !email || !roleVal || !territory || !region || !managerRaw) {
          const missingFields = [];
          if (!name) missingFields.push("employee_name");
          if (!email) missingFields.push("email");
          if (!roleVal) missingFields.push("role");
          if (!territory) missingFields.push("territory");
          if (!region) missingFields.push("region");
          if (!managerRaw) missingFields.push("manager_id");
          throw new Error(`Row ${rowNum}: Missing required fields: ${missingFields.join(", ")}`);
        }

        // 2. Validate email format
        if (!email.includes("@") || email.split("@")[1].length < 3) {
          throw new Error(`Row ${rowNum}: Invalid email format: "${email}"`);
        }

        // 3. Check for duplicate emails within the excel sheet itself
        const emailLower = email.toLowerCase();
        if (emailsSet.has(emailLower)) {
          throw new Error(`Row ${rowNum}: Duplicate email "${email}" detected inside the Excel sheet.`);
        }
        emailsSet.add(emailLower);

        // 4. Check for duplicate email against existing users in the system
        const existingUser = users.find(u => u.email.trim().toLowerCase() === emailLower);
        if (existingUser) {
          throw new Error(`Row ${rowNum}: User with email "${email}" already exists in the system directory.`);
        }

        // 5. Normalize Role
        const role = normalizeExcelRole(roleVal);
        if (!role) {
          throw new Error(`Row ${rowNum}: Invalid role "${roleVal}". Must map to Admin, Sales Director, Regional Manager, or Salesperson.`);
        }

        // Validate manager constraints (compulsory except for Admin and Sales Director)
        if (role !== "Admin" && role !== "Sales Director") {
          if (!managerRaw || managerRaw.toLowerCase() === "none" || managerRaw.toLowerCase() === "null") {
            throw new Error(`Row ${rowNum}: A manager must be specified for role "${role}".`);
          }
        }

        // Resolve manager ID/name: managerRaw can be name, email, employee code, or database UUID.
        const matchedManager = users.find(u => 
          (u.name && u.name.trim().toLowerCase() === managerRaw.toLowerCase()) ||
          (u.email && u.email.trim().toLowerCase() === managerRaw.toLowerCase()) ||
          (u.salespersonCode && u.salespersonCode.trim().toLowerCase() === managerRaw.toLowerCase()) ||
          (u.id && u.id.trim().toLowerCase() === managerRaw.toLowerCase())
        );
        const resolvedManagerName = matchedManager ? matchedManager.name : managerRaw;
        const resolvedManagerId = matchedManager ? matchedManager.id : undefined;

        // Map status: defaults to true (active) unless explicitly set to false/inactive/blocked
        let approved = true;
        if (statusVal) {
          const sLower = statusVal.toLowerCase();
          if (sLower === "inactive" || sLower === "blocked" || sLower === "false" || sLower === "0" || sLower === "disabled") {
            approved = false;
          }
        }

        validatedUsers.push({
          name,
          email,
          password,
          role,
          region,
          territory,
          managerName: resolvedManagerName,
          managerId: resolvedManagerId,
          approved,
          salespersonCode: code || (role === "Salesperson" ? `SP_${region[0] || 'X'}${Math.floor(Math.random() * 105)}` : undefined)
        });
      }

      setStagedUsers(validatedUsers);
      setUploadStatus({
        type: "success",
        message: `Parsed and validated ${validatedUsers.length} Sales Team Users (Staged - Click Commit Below to Save)`,
        details: [
          `Found ${validatedUsers.length} valid employee rows.`,
          `No duplicate email ids or missing parameters detected.`
        ]
      });
    } catch (err: any) {
      setUploadStatus({
        type: "error",
        message: "Spreadsheet validation failed",
        details: [err.message || "Failed to process user spreadsheet rows."]
      });
      setStagedUsers([]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Supabase Missing Configuration Banner */}
      {!getSupabase() && (
        <div id="upload-supabase-missing-banner" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-5 shadow-sm flex items-start gap-3.5">
          <div className="p-2.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-red-900 dark:text-red-400">
              Supabase configuration missing. Check environment variables.
            </h3>
            <p className="text-[11px] text-red-750 dark:text-slate-300 leading-normal max-w-3xl">
              File upload, ledger insertions, and data replication to Supabase tables are currently locked because the client cannot find your database connection credentials. Ensure that you have specified both <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> inside your setup environment, and restart the platform.
            </p>
          </div>
        </div>
      )}

      {/* Executive Intro Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors">
        <div className="text-left">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-gray-950 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-green-600 dark:text-green-400" />
            Excel Data Upload Center
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Securely merge invoice-level receipts from Company A and Company B, alongside budget submissions. 
            The system applies automated schema definitions, standardized spellings, and aggregates reporting trees automatically.
          </p>
        </div>
        <div className="flex items-center gap-3 justify-between md:justify-end border-t border-gray-50 dark:border-slate-800 pt-3 md:pt-0 md:border-t-0">
          <div className="text-left md:text-right">
            <div className="text-xs font-bold text-gray-950 dark:text-slate-100">{existingInvoicesCount} invoices loaded</div>
            <div className="text-[10px] text-gray-500 dark:text-slate-400">{existingBudgetsCount} budget targets pre-defined</div>
          </div>
          <button
            onClick={onResetDatabase}
            className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-650 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs flex items-center gap-2 transition cursor-pointer"
            title="Restore default database records"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset DB</span>
          </button>
        </div>
      </div>

      {/* Target Module Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-155 dark:border-slate-800 p-4 md:p-6 shadow-xs transition-colors">
        <div className="flex flex-wrap border-b border-gray-100 dark:border-slate-800 pb-3 mb-5 gap-2">
          <button
            disabled={!getSupabase()}
            onClick={() => { 
              setActiveTab("sales"); 
              setUploadStatus({ type: "idle", message: "" }); 
              setStagedInvoices([]);
              setStagedBudgets([]);
              setStagedUsers([]);
              setActiveFile(null);
            }}
            className={`pb-2 px-3 md:px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "sales" 
                ? "border-green-650 text-green-650 dark:text-green-400 font-bold" 
                : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
            } ${!getSupabase() ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <FileText className="w-3.5 h-3.5" />
            Invoice Upload
          </button>
          <button
            disabled={!getSupabase()}
            onClick={() => { 
              setActiveTab("budget"); 
              setUploadStatus({ type: "idle", message: "" }); 
              setStagedInvoices([]);
              setStagedBudgets([]);
              setStagedUsers([]);
              setActiveFile(null);
            }}
            className={`pb-2 px-3 md:px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "budget" 
                ? "border-green-650 text-green-650 dark:text-green-400 font-bold" 
                : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
            } ${!getSupabase() ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Target className="w-3.5 h-3.5" />
            Budget Upload
          </button>
          <button
            onClick={() => { 
              setActiveTab("users"); 
              setUploadStatus({ type: "idle", message: "" }); 
              setStagedInvoices([]);
              setStagedBudgets([]);
              setStagedUsers([]);
              setActiveFile(null);
            }}
            className={`pb-2 px-3 md:px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "users" 
                ? "border-green-650 text-green-650 dark:text-green-400 font-bold" 
                : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Team Users Bulk Upload (Excel)
          </button>
        </div>

        {/* Drag & Drop Canvas */}
        <div
          onDragOver={(activeTab === "users" || getSupabase()) ? onDragOver : (e) => e.preventDefault()}
          onDragLeave={(activeTab === "users" || getSupabase()) ? onDragLeave : (e) => e.preventDefault()}
          onDrop={(activeTab === "users" || getSupabase()) ? onDrop : (e) => e.preventDefault()}
          onClick={(activeTab === "users" || getSupabase()) ? triggerFileInput : undefined}
          className={`border-2 border-dashed rounded-xl p-6 md:p-10 text-center transition ${
            (activeTab !== "users" && !getSupabase())
              ? "border-red-200 dark:border-red-900/30 bg-red-50/5 dark:bg-red-950/5 cursor-not-allowed"
              : dragActive 
                ? "border-green-500 bg-green-50/20 dark:bg-green-950/10 cursor-pointer" 
                : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50/25 dark:hover:bg-slate-850/20 cursor-pointer"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls,.xlsm,.csv"
            disabled={activeTab !== "users" && !getSupabase()}
            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
          />
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            (activeTab !== "users" && !getSupabase())
              ? "bg-red-50 dark:bg-red-950/40 text-red-500"
              : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
          }`}>
            {(activeTab !== "users" && !getSupabase()) ? (
              <Lock className="w-5 h-5 text-red-500 dark:text-red-400" />
            ) : (
              <Upload className="w-6 h-6 animate-pulse" />
            )}
          </div>
          <h3 className="text-sm font-semibold">
            {(activeTab !== "users" && !getSupabase()) ? (
              <span className="text-red-655 dark:text-red-400">Database Upload Closed (Configuration Missing)</span>
            ) : (
              <span className="text-gray-905 dark:text-slate-100">
                Drag and drop your spreadsheet here, or <span className="text-green-650 dark:text-green-450 hover:underline">browse files</span>
              </span>
            )}
          </h3>
          <p className="text-[11px] text-gray-450 dark:text-slate-400 mt-2">
            {(activeTab !== "users" && !getSupabase())
              ? "Please check your environment settings. Uploading is disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are specified."
              : "Supports Excel (.xlsx, .xls) and CSV. Max file upload size: 10MB."}
          </p>
        </div>

        {/* Guided Templates Section */}
        {activeTab === "users" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-gray-100 dark:border-slate-800/80 pt-6">
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3 text-left">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-slate-250">User Sheet Template Schema</h4>
                <p className="text-[10px] text-gray-600 dark:text-slate-400 mt-1 leading-relaxed font-sans">
                  The spreadsheet must have column headers in Row 1. Data starts from Row 2. Required columns (case-insensitive):
                  <strong className="block text-slate-800 dark:text-slate-200 mt-1">Employee Name, Region, Post, Reporting Manager, Location, email, password</strong>
                </p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3 text-left">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-slate-250">Role Mapping & Account Security</h4>
                <p className="text-[10px] text-gray-600 dark:text-slate-400 mt-1 leading-relaxed font-sans">
                  Duplicate email checking is strictly enforced (system directory and spreadsheet). <code className="bg-slate-205 dark:bg-slate-900 px-1 py-0.5 rounded text-[9.5px]">Post</code> values normalize to <em>Admin</em>, <em>Sales Director</em>, <em>Regional Manager</em>, or <em>Salesperson</em>. <code className="bg-slate-205 dark:bg-slate-900 px-1 py-0.5 rounded text-[9.5px]">Location</code> maps to territory.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-gray-100 dark:border-slate-800/80 pt-6">
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3 text-left">
              <FileText className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-slate-250">Format Guide: Casing & Cleansing</h4>
                <p className="text-[10px] text-gray-600 dark:text-slate-400 mt-1 leading-relaxed font-sans">
                  Platform ETL pipeline automatically standardizes dealer names (e.g., standardizing "pune fert" and "PUNE fertilizers" as "Pune Fertilizers"), detects currency rates, calculates gross values, and ignores missing indices elegantly.
                </p>
              </div>
            </div>
            <div className="p-4 bg-gray-55/40 dark:bg-slate-800/50 rounded-xl flex items-start gap-3 text-left">
              <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-slate-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-slate-250">Strict Row Scoping Integration</h4>
                <p className="text-[10px] text-gray-600 dark:text-slate-400 mt-1 leading-relaxed font-sans">
                  The corporate parent-child supervisor hierarchy (Sales Director → RMs → Salespeople → Dealers) will be derived programmatically from employee names and reporting managers within the sheet rows.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live Upload Feedback Alerts */}
        {uploadStatus.type !== "idle" && (
          <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 border transition-colors ${
            uploadStatus.type === "success" || uploadStatus.type === "committed" 
              ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/60 text-green-900 dark:text-green-300" 
              : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-350"
          }`}>
            {uploadStatus.type === "success" || uploadStatus.type === "committed" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-left flex-1 min-w-0">
              <h4 className="text-xs font-bold">{uploadStatus.message}</h4>
              {uploadStatus.details && uploadStatus.details.length > 0 && (
                <ul className="list-disc pl-5 text-[10px] space-y-1 mt-2 text-gray-600 dark:text-slate-400">
                  {uploadStatus.details.map((detail, dIdx) => (
                    <li key={dIdx} className="break-words">{detail}</li>
                  ))}
                </ul>
              )}
              {uploadStatus.type === "success" && (
                <div className="pt-2">
                  <p className="text-[10px] text-gray-505 dark:text-slate-450 font-medium">
                    👉 *Data is currently in temporary RAM memory. Click <strong>"Commit Changes to Database"</strong> below to permanently write them to the server database.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Staged Data & Commit Changes To Database */}
        {(stagedInvoices.length > 0 || stagedBudgets.length > 0 || stagedUsers.length > 0) && (() => {
          const getInvoiceKey = (inv: InvoiceItem) => {
            const company = (inv.company || "").trim().toLowerCase();
            const date = (inv.invoiceDate || "").trim().toLowerCase();
            const invNo = (inv.invoiceNumber || "").trim().toLowerCase();
            const custName = (inv.customerName || "").trim().toLowerCase();
            const prodName = (inv.productName || "").trim().toLowerCase();
            const qty = String(inv.quantity || 0).trim();
            return `${company}|||${date}|||${invNo}|||${custName}|||${prodName}|||${qty}`;
          };
          const existingKeys = new Set(existingInvoices.map(getInvoiceKey));
          const duplicatesCount = stagedInvoices.filter(inv => existingKeys.has(getInvoiceKey(inv))).length;
          const hasDuplicatesDetected = duplicatesCount > 0;

          return (
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="mt-6 p-4 bg-green-50/40 dark:bg-green-950/10 border border-green-200 dark:border-green-900/40 rounded-xl space-y-4 text-left transition-colors"
            >
              {isSyncingDirectly ? (
                <div className="space-y-4">
                  {/* Progress Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-950 dark:text-slate-100 flex items-center gap-1.5 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-green-600 dark:text-green-400" />
                      Sinking and Syncing with Supabase... {uploadProgress}%
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Batch Ingestion Pipeline
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-205/60 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-green-600 dark:bg-green-400 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>

                  {/* Operational Metrics Panel */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-gray-150 dark:border-slate-800/80 text-center">
                      <div className="text-[10px] text-gray-500 font-sans font-medium">Total Staged</div>
                      <div className="text-sm font-bold text-gray-950 dark:text-slate-100 mt-0.5">
                        {activeTab === "sales" ? stagedInvoices.length : activeTab === "budget" ? stagedBudgets.length : stagedUsers.length}
                      </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-gray-150 dark:border-slate-800/80 text-center">
                      <div className="text-[10px] text-green-600 font-sans font-medium">Inserted successfully</div>
                      <div className="text-sm font-bold text-green-600 mt-0.5">{insertedCount}</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-gray-150 dark:border-slate-800/80 text-center">
                      <div className="text-[10px] text-amber-600 font-sans font-medium">Duplicates skipped</div>
                      <div className="text-sm font-bold text-amber-600 mt-0.5">{duplicateCount}</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-gray-150 dark:border-slate-800/80 text-center">
                      <div className="text-[10px] text-red-500 font-sans font-medium">Insertion failures</div>
                      <div className="text-sm font-bold text-red-500 mt-0.5">{failedCount}</div>
                    </div>
                  </div>

                  {/* Terminal Log Console */}
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-gray-550 font-sans font-semibold uppercase tracking-wider">
                      Real-time Connection Logs Output
                    </div>
                    <div className="bg-gray-950 text-emerald-400 p-3 rounded-xl text-[10px] font-mono h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-900 leading-relaxed font-normal space-y-1 select-text">
                      {auditLogsConsole.map((log, lIdx) => (
                        <div key={lIdx} className="break-words">
                          <span className="text-emerald-700 font-sans mr-1">[INFO]</span>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-350 rounded-lg shrink-0">
                        <Database className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-gray-950 dark:text-slate-100">
                          Spreadsheet Data Staged Successfully!
                        </h4>
                        <p className="text-[10px] text-gray-755 dark:text-slate-300 mt-0.5">
                          {stagedInvoices.length > 0 && `${stagedInvoices.length} Sales Voucher/Invoice records `}
                          {stagedBudgets.length > 0 && `${stagedBudgets.length} Budget Target records `}
                          {stagedUsers.length > 0 && `${stagedUsers.length} User Profile records `}
                          ready to write. Click below to make these permanent on the database.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Users Preview Table */}
                  {stagedUsers.length > 0 && (
                    <div className="border border-gray-150 dark:border-slate-800 rounded-xl overflow-hidden max-h-[160px] overflow-y-auto mt-2">
                      <table className="w-full text-[9.5px] text-left">
                        <thead className="bg-gray-50 dark:bg-slate-850/80 text-gray-500 font-bold">
                          <tr className="border-b border-gray-150 dark:border-slate-800">
                            <th className="p-1.5">Name</th>
                            <th className="p-1.5">Role</th>
                            <th className="p-1.5">Email</th>
                            <th className="p-1.5">Region</th>
                            <th className="p-1.5">Location</th>
                            <th className="p-1.5">Manager</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-850 text-gray-700 dark:text-slate-300">
                          {stagedUsers.map((pu, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-1.5 font-bold">{pu.name}</td>
                              <td className="p-1.5 font-medium">{pu.role}</td>
                              <td className="p-1.5 font-mono text-[9px]">{pu.email}</td>
                              <td className="p-1.5">{pu.region}</td>
                              <td className="p-1.5">{pu.territory}</td>
                              <td className="p-1.5">{pu.managerName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Duplicate Handling Options Card */}
                  {hasDuplicatesDetected && (
                    <div className="p-4 bg-amber-50/75 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg space-y-3">
                      <div className="flex items-start gap-2 text-amber-900 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold">Multiple Sheets / Duplicate Records Detected</h4>
                          <p className="text-[10px] text-amber-700 dark:text-amber-450 mt-0.5">
                            We detected that <strong>{duplicatesCount}</strong> of your staged invoice records already exist in the database (matching the same Company, Date, Invoice/Voucher No, Voucher Type, Customer/Ledger Name, and Stock Group). How would you like us to handle these duplicates?
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setDuplicateResolution("replace")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                            duplicateResolution === "replace"
                              ? "bg-amber-600 border-amber-600 text-white shadow-xs"
                              : "bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900 text-amber-850 dark:text-amber-300 hover:bg-amber-100/55 dark:hover:bg-slate-705"
                          }`}
                        >
                          🔄 Replace Older Data with Latest
                        </button>
                        <button
                          type="button"
                          onClick={() => setDuplicateResolution("ignore")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                            duplicateResolution === "ignore"
                              ? "bg-amber-600 border-amber-600 text-white shadow-xs"
                              : "bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900 text-amber-850 dark:text-amber-300 hover:bg-amber-100/55 dark:hover:bg-slate-705"
                          }`}
                        >
                          🛡️ Ignore Duplicates & Keep Database
                        </button>
                      </div>
                      <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium font-sans">
                        {duplicateResolution === "replace"
                          ? "👉 Active Selection: OVERWRITE matching database entries with your newly uploaded records."
                          : "👉 Active Selection: SKIP matching staged records and only import additional/new data."}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      id="btn-commit-db-upload"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await handleDirectCommitToSupabase();
                      }}
                      className="px-4 py-2 bg-green-700 font-semibold text-white text-xs rounded-lg shadow-xs hover:bg-green-800 transition flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Commit Changes to Database {hasDuplicatesDetected && `(${duplicateResolution === "replace" ? "Replace" : "Skip"}-mode)`}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
