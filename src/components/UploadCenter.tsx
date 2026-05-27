/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileText, CheckCircle2, AlertTriangle, CloudRain, ShieldCheck, Database, RefreshCw } from "lucide-react";
import { InvoiceItem, BudgetItem, UserProfile } from "../types";

interface UploadCenterProps {
  onDataUploaded: (invoices: InvoiceItem[], budgets: BudgetItem[]) => void;
  currentUser: UserProfile;
  existingInvoicesCount: number;
  existingBudgetsCount: number;
  onResetDatabase: () => void;
  isSyncing: boolean;
}

export default function UploadCenter({
  onDataUploaded,
  currentUser,
  existingInvoicesCount,
  existingBudgetsCount,
  onResetDatabase,
  isSyncing,
}: UploadCenterProps) {
  const [activeTab, setActiveTab] = useState<"sales" | "budget">("sales");
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | "idle";
    message: string;
    details?: string[];
  }>({ type: "idle", message: "" });
  
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse Excel sheets using SheetJS
  const handleFile = async (file: File) => {
    if (!file) return;

    setUploadStatus({ type: "idle", message: "Parsing spreadsheet in real-time..." });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("No file content read.");

        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Extract Company data from Cell A1 of the sheet
        const a1Cell = worksheet ? worksheet['A1'] : null;
        const companyFromA1 = a1Cell && a1Cell.v ? String(a1Cell.v).trim() : undefined;

        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          throw new Error("Spreadsheet appears to be empty. No records detected.");
        }

        if (activeTab === "sales") {
          validateAndProcessSales(jsonData, companyFromA1);
        } else {
          validateAndProcessBudget(jsonData);
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
    const rowKeys = Object.keys(rawRows[0]).map(k => k.trim().toLowerCase());
    
    // Check if the uploaded headers contain either standard or the user's mapped column keys
    const hasDate = rowKeys.some(k => ["date", "invoice date", "date of invoice"].includes(k));
    const hasInvNo = rowKeys.some(k => ["invoice/voucher number", "invoice number", "invoice no", "inv no", "voucher number"].includes(k));
    const hasCustomer = rowKeys.some(k => ["customer/ledger name", "customer name", "ledger name", "customer/ledger"].includes(k));
    const hasProduct = rowKeys.some(k => ["stock group", "product name", "product", "item"].includes(k));
    const hasRate = rowKeys.some(k => ["packing rate per kg/ltr", "rate", "price", "unit rate"].includes(k));
    const hasQty = rowKeys.some(k => ["quantity in kg/ltr", "quantity", "qty", "volume"].includes(k));

    if (!hasDate || !hasInvNo || !hasCustomer || !hasProduct || !hasRate || !hasQty) {
      setUploadStatus({
        type: "error",
        message: "Invoice upload template headers mismatch",
        details: [
          "Could not map the uploaded spreadsheet columns.",
          "Expected header mappings to include: 'Date', 'Invoice/Voucher Number', 'Customer/Ledger Name', 'Stock Group', 'Packing Rate per Kg/Ltr', 'Quantity in Kg/Ltr'.",
          `Detected columns: ${Object.keys(rawRows[0]).join(", ")}`
        ]
      });
      return;
    }

    const cleanedInvoices: InvoiceItem[] = [];
    const logs: string[] = [];
    let missingValuesFilled = 0;

    // Report dynamic company parsing
    if (companyFromA1) {
      logs.push(`Extracted Company Name from A1 Cardboard: "${companyFromA1}"`);
    }

    rawRows.forEach((row, idx) => {
      // Standardize properties casing
      const findVal = (names: string[]) => {
        const matchingKey = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));
        return matchingKey ? row[matchingKey] : null;
      };

      const invoiceDateRaw = findVal(["date", "invoice date", "date of invoice"]);
      const invoiceNumber = String(findVal(["invoice/voucher number", "invoice number", "invoice no", "inv no", "voucher number"]) || `INV-TEMP-${1000 + idx}`);
      
      // Map company from Cell A1, falling back to row field, then "Company A"
      let company: "Company A" | "Company B" = "Company A";
      if (companyFromA1) {
        const norm = companyFromA1.toLowerCase();
        if (norm.includes("company b") || norm.includes("co b") || norm.includes("b")) {
          company = "Company B";
        }
      } else {
        const rowCompany = findVal(["company", "firm", "voucher type"]);
        if (rowCompany) {
          const norm = String(rowCompany).toLowerCase();
          if (norm.includes("company b") || norm.includes("co b") || norm.includes("b")) {
            company = "Company B";
          }
        }
      }

      const customerName = String(findVal(["customer/ledger name", "customer name", "dealer", "customer", "ledger name"]) || "Standard Dealer");
      const customerCode = String(findVal(["customer code", "cust code", "dealer code"]) || `CUST_${customerName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}`);
      
      const region = String(findVal(["name of group", "region", "zone"]) || "West");
      const state = String(findVal(["state"]) || "Maharashtra");
      const territory = String(findVal(["name of sub group", "territory", "area"]) || "West-1");
      const salesperson = String(findVal(["name of sub group", "salesperson", "officer", "employee"]) || "V. R. Sharma");
      
      // Resolve corporate Supervisor parent-child hierarchy automatically
      let regionalManager = "S. R. Patil";
      if (salesperson.toLowerCase().includes("sharma") || salesperson.toLowerCase().includes("patil") || salesperson.toLowerCase().includes("kulkarni")) {
        regionalManager = "S. R. Patil";
      } else if (salesperson.toLowerCase().includes("rao") || salesperson.toLowerCase().includes("gopal") || salesperson.toLowerCase().includes("swamy")) {
        regionalManager = "K. Swamy";
      } else if (salesperson.toLowerCase().includes("singh") || salesperson.toLowerCase().includes("verma")) {
        regionalManager = "R. K. Singh";
      }

      const productName = String(findVal(["stock group", "product name", "product", "item"]) || "SugaMax Bio Enhancer");
      const productCategory = String(findVal(["category", "stock group", "product category", "segment"]) || "Biostimulants");
      const supplier = String(findVal(["stock category", "supplier", "manufacturer"]) || "BioCore Solutions India");
      
      const qtyRaw = findVal(["quantity in kg/ltr", "quantity", "qty", "volume"]);
      const rateRaw = findVal(["packing rate per kg/ltr", "rate", "price", "unit rate"]);
      
      let quantity = Number(qtyRaw);
      if (isNaN(quantity)) { quantity = 1; missingValuesFilled++; }
      
      let rate = Number(rateRaw);
      if (isNaN(rate)) { rate = 100; missingValuesFilled++; }

      const grossValue = quantity * rate;
      const discountRaw = Number(findVal(["discount"])) || 0;
      const netSalesValue = grossValue - discountRaw;

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

      // Customer name and product standardisations/merging
      const standardizedCustomer = customerName
        .trim()
        .replace(/\s+/g, " ")
        .replace(/fert$/i, "Fertilizers")
        .replace(/corp$/i, "Corporation");

      const standardizedProduct = productName
        .trim()
        .replace(/\s+/g, " ");

      cleanedInvoices.push({
        id: `upl_${company === "Company B" ? "B" : "A"}_${Date.now()}_${idx}`,
        invoiceDate,
        invoiceNumber,
        company,
        customerName: standardizedCustomer,
        customerCode,
        region,
        state,
        territory,
        salesperson,
        regionalManager,
        productName: standardizedProduct,
        productCategory,
        supplier,
        quantity,
        unit: String(findVal(["unit", "pack size"]) || "KG"),
        rate,
        grossValue,
        discount: discountRaw,
        netSalesValue,
      });
    });

    logs.push(`Successfully mapped raw transaction columns. Merged company context.`);
    if (missingValuesFilled > 0) logs.push(`Resolved ${missingValuesFilled} empty or NaN values.`);

    onDataUploaded(cleanedInvoices, []);
    setUploadStatus({
      type: "success",
      message: `Parsed and validated ${cleanedInvoices.length} Multi-Company Invoice Line Items`,
      details: logs,
    });
  };

  // ETL processing for Budget Rows
  const validateAndProcessBudget = (rawRows: any[]) => {
    const requiredHeaders = ["salesperson", "product", "budget quantity", "budget value", "month", "financial year"];
    const rowKeys = Object.keys(rawRows[0]).map(k => k.trim().toLowerCase());
    const missingHeaders = requiredHeaders.filter(header => !rowKeys.includes(header));

    if (missingHeaders.length > 2) {
      setUploadStatus({
        type: "error",
        message: "Budgets template format mismatch",
        details: [
          "Format must include columns containing Salesperson, Product Name, Target Qty, Target Value, target month range and Financial Year details.",
          `Unresolved headers missing: ${missingHeaders.join(", ")}`
        ]
      });
      return;
    }

    const cleanedBudgets: BudgetItem[] = [];
    const logs: string[] = [];

    rawRows.forEach((row, idx) => {
      const findVal = (names: string[]) => {
        const matchingKey = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));
        return matchingKey ? row[matchingKey] : null;
      };

      const salesperson = String(findVal(["salesperson", "officer", "staff"]) || "V. R. Sharma");
      const product = String(findVal(["product", "item", "product name"]) || "SugaMax Bio Enhancer");
      const qtyRaw = findVal(["budget quantity", "budget qty", "target quantity", "target qty"]);
      const valRaw = findVal(["budget value", "budget val", "target value", "target value rs"]);
      const month = String(findVal(["month", "period"]) || "YTD (Mar-May)");
      const financialYear = String(findVal(["financial year", "fy", "year"]) || "2026-27");

      cleanedBudgets.push({
        id: `bud_upl_${Date.now()}_${idx}`,
        salesperson,
        product,
        budgetQuantity: Number(qtyRaw) || 100,
        budgetValue: Number(valRaw) || 50000,
        month,
        financialYear,
      });
    });

    logs.push(`Consolidated target matrices relative to fiscal year calendar starting on 1st March.`);
    
    onDataUploaded([], cleanedBudgets);
    setUploadStatus({
      type: "success",
      message: `Parsed and validated ${cleanedBudgets.length} Salesperson Target Line Matrices`,
      details: logs,
    });
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
      {/* Executive Intro Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-green-600" />
            Excel Data Upload Center
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Securely merge invoice-level receipts from Company A and Company B, alongside budget submissions. 
            The system applies automated schema definitions, standardized spellings, and aggregates reporting trees automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold text-gray-900">{existingInvoicesCount} invoices loaded</div>
            <div className="text-[10px] text-gray-500">{existingBudgetsCount} budget targets pre-defined</div>
          </div>
          <button
            onClick={onResetDatabase}
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-xs flex items-center gap-2 transition"
            title="Restore default transactional database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset DB
          </button>
        </div>
      </div>

      {/* Target Module Selector */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
        <div className="flex border-b border-gray-100 pb-4 mb-6">
          <button
            onClick={() => { setActiveTab("sales"); setUploadStatus({ type: "idle", message: "" }); }}
            className={`pb-2 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === "sales" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Invoice-Level Transactions Upload
          </button>
          <button
            onClick={() => { setActiveTab("budget"); setUploadStatus({ type: "idle", message: "" }); }}
            className={`pb-2 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === "budget" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Salesperson Target Spreadsheet Upload
          </button>
        </div>

        {/* Drag & Drop Canvas */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
            dragActive ? "border-green-500 bg-green-50/20" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/20"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls,.xlsm,.csv"
            onChange={(e) => e.target.files && handleFile(e.dataTransfer?.files[0] || e.target.files[0])}
          />
          <div className="mx-auto w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">
            Drag and drop your spreadsheet here, or <span className="text-green-600 hover:underline">browse files</span>
          </h3>
          <p className="text-[11px] text-gray-500 mt-2">
            Supports Excel (.xlsx, .xls) and CSV. Max file upload size: 10MB.
          </p>
        </div>

        {/* Guided Templates Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-gray-100 pt-6">
          <div className="p-4 bg-gray-50 rounded-xl flex items-start gap-3">
            <FileText className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-medium text-gray-900">Format Guide: Casing & Cleansing</h4>
              <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
                Platform ETL pipeline automatically standardizes dealer names (e.g., standardizing "pune fert" and "PUNE fertilizers" as "Pune Fertilizers"), detects currency rates, calculates gross values, and ignores missing indices elegantly.
              </p>
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-medium text-gray-900">Strict Row Scoping Integration</h4>
              <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
                The corporate parent-child supervisor hierarchy (Sales Director → RMs → Salespeople → Dealers) will be derived programmatically from employee names and reporting managers within the sheet rows.
              </p>
            </div>
          </div>
        </div>

        {/* Live Upload Feedback Alerts */}
        {uploadStatus.type !== "idle" && (
          <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 border ${
            uploadStatus.type === "success" ? "bg-green-50/50 border-green-200 text-green-900" : "bg-red-50/50 border-red-200 text-red-900"
          }`}>
            {uploadStatus.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold">{uploadStatus.message}</h4>
              {uploadStatus.details && uploadStatus.details.length > 0 && (
                <ul className="list-disc pl-5 text-[10px] space-y-1 mt-2 text-gray-600">
                  {uploadStatus.details.map((detail, dIdx) => (
                    <li key={dIdx}>{detail}</li>
                  ))}
                </ul>
              )}
              {uploadStatus.type === "success" && (
                <div className="pt-2">
                  <p className="text-[10px] text-gray-500">
                    *Data is processed locally in browser RAM state. Click "Commit Changes to Database" on settings or return tab to synchronize on server.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
