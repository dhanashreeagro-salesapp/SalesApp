/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Local database path
const DATA_DIR = path.join(process.cwd(), "data");
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

// Lazy Load seed data inside server to write initial DB
import { SEED_INVOICES, SEED_BUDGETS, SEED_USERS, INITIAL_AUDIT_LOGS, INITIAL_EMAIL_LOGS } from "./src/data/seedData";

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const data = JSON.parse(content);
      localInvoices = data.invoices || [];
      localBudgets = data.budgets || [];
      localAuditLogs = data.auditLogs || [];
      localEmailLogs = data.emailLogs || [];
      localUsers = data.users || [];
      console.log(`Database loaded successfully with ${localInvoices.length} invoices and ${localUsers.length} users.`);
    } catch (e) {
      console.error("Error reading db.json, resetting to seed data", e);
      resetToDefaultSeed();
    }
  } else {
    resetToDefaultSeed();
  }
}

function saveDB() {
  try {
    const data = {
      invoices: localInvoices,
      budgets: localBudgets,
      auditLogs: localAuditLogs,
      emailLogs: localEmailLogs,
      users: localUsers,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write to db.json", e);
  }
}

function resetToDefaultSeed() {
  localInvoices = [...SEED_INVOICES];
  localBudgets = [...SEED_BUDGETS];
  localAuditLogs = [...INITIAL_AUDIT_LOGS];
  localEmailLogs = [...INITIAL_EMAIL_LOGS];
  localUsers = SEED_USERS.map(u => ({
    ...u,
    password: u.email === "admin@agroiq.com" ? "admin123" : "password123"
  }));
  saveDB();
  console.log("Database initialized with seed data.");
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

// 1. Get entire database
app.get("/api/db", (req, res) => {
  res.json({
    invoices: localInvoices,
    budgets: localBudgets,
    auditLogs: localAuditLogs,
    emailLogs: localEmailLogs,
    users: localUsers,
  });
});

// Create/Update User profile (used by both general Registration and Admin settings panels)
app.post("/api/users/save", (req, res) => {
  const { user, initiator } = req.body;
  if (!user || !user.email) {
    return res.status(400).json({ error: "Missing required profile parameters" });
  }

  const existingIdx = localUsers.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  
  const updatedUser = {
    ...user,
    id: user.id || `user_${Date.now()}`,
    password: user.password || "password123"
  };

  if (existingIdx >= 0) {
    localUsers[existingIdx] = updatedUser;
  } else {
    localUsers.push(updatedUser);
  }

  // Log action to System Audit trail
  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: initiator?.name || "System Admin",
    action: existingIdx >= 0 ? "Edit User Profile" : "Create User Profile",
    details: `Successfully managed profile for ${updatedUser.name} with security clearance role '${updatedUser.role}'.`,
    status: "Success"
  });

  saveDB();
  res.json({ success: true, users: localUsers });
});

// Delete User profile
app.post("/api/users/delete", (req, res) => {
  const { userId, initiator } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing Target User Identification ID" });
  }

  const foundUser = localUsers.find(u => u.id === userId);
  if (!foundUser) {
    return res.status(404).json({ error: "No profile matching specified ID exists" });
  }

  localUsers = localUsers.filter(u => u.id !== userId);

  // Log action
  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: initiator?.name || "System Admin",
    action: "Delete User Profile",
    details: `Deleted database clearance profile for ${foundUser.name} (${foundUser.role}).`,
    status: "Success"
  });

  saveDB();
  res.json({ success: true, users: localUsers });
});

// 2. Save database changes (updates invoices / budgets)
app.post("/api/db/save", (req, res) => {
  const { invoices, budgets, userDetails } = req.body;
  
  if (Array.isArray(invoices)) {
    localInvoices = invoices;
  }
  if (Array.isArray(budgets)) {
    localBudgets = budgets;
  }
  
  // Append Audit Log
  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: userDetails?.name || "System User",
    action: "Database Synchronization",
    details: `Updated invoices line items. Active set length is now ${localInvoices.length} entries.`,
    status: "Success"
  });

  saveDB();
  res.json({ success: true, count: localInvoices.length });
});

// Reset Database to Seed data
app.post("/api/db/reset", (req, res) => {
  const { userDetails } = req.body;
  resetToDefaultSeed();
  
  const timestamp = new Date().toISOString();
  localAuditLogs.unshift({
    timestamp,
    user: userDetails?.name || "System Admin",
    action: "Factory Reset",
    details: "Restored invoice database, salesperson targets, and email schedule timelines back to standard factory settings.",
    status: "Success"
  });
  saveDB();
  res.json({ success: true });
});

// 3. AI Smart Insights Chat proxy using recommended model gemini-3.5-flash
app.post("/api/gemini/insights", async (req, res) => {
  const { messages, contextData } = req.body;
  
  try {
    const ai = getGeminiClient();
    const isMock = process.env.GEMINI_API_KEY ? false : true;
    
    if (isMock) {
      // Local fallback text simulation in case key is missing
      const lastMsg = messages[messages.length - 1]?.content || "";
      const lower = lastMsg.toLowerCase();
      let reply = "";
      if (lower.includes("customer") && lower.includes("25%")) {
        reply = `**AI Insights:** Based on YTD comparison (1 Mar 2026 - 26 May 2026 vs last year):
- **Krishna Agro Agency Nashik** dropped by **100%** (Value ₹1,08,000 last year to ₹0 this year - Classified as *Lost Customer*).
- **Cauvery Fertilizers Salem** (under S. Gopal in South) decreased from ₹1,30,000 to ₹1,23,000 (A slight decline of **5.4%**).
- **Jai Malhar Seeds** grew strongly by **44.4%** matching excellent soil biostimulant penetration in cane fields!`;
      } else if (lower.includes("maharashtra") || lower.includes("declining")) {
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
      return res.json({ text: reply });
    }

    // Build highly rich system context
    const systemPrompt = `You are an expert Agro-inputs Enterprise Sales Director AI Assistant.
You have access to the active operational metrics for "AgroSales IQ" compiled dynamically from CRM receipts and salesperson Excel budgets over two financial years starting on March 1st.
Operational Context provided by server:
- Total Current YTD Sales: ₹${contextData.totalCurrentSales ? (contextData.totalCurrentSales / 100000).toFixed(2) : "45.00"} Lakhs
- YTD Year-on-Year Growth: ${contextData.growthPercent ? contextData.growthPercent.toFixed(1) : "11.7"}%
- Region Performances: ${JSON.stringify(contextData.regions || [])}
- Alerted dropped customers (>15% fall): ${JSON.stringify(contextData.droppedCustomers || [])}
- Salesperson current achievements: ${JSON.stringify(contextData.salespersons || [])}
- Declining Products: ${JSON.stringify(contextData.decliningProductsVal || [])}
- New Dealers: ${JSON.stringify(contextData.newCustomers || [])}
- Lost Dealers: ${JSON.stringify(contextData.lostCustomers || [])}

Provide detailed, humanized, extremely professional and highly precise enterprise reports. Mention the actual rupee values, regional supervisors, salesperson names (e.g. S. R. Patil, V. R. Sharma), and products. Keep formatting clear with sub-headers.`;

    const formattedContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Failed to query Gemini model. " + error.message });
  }
});

// 4. Monthly Automated Performance Email Scheduler Simulator
// On 3rd of the month Scheduler simulation
app.post("/api/email/scheduler/simulate", async (req, res) => {
  const { userTriggering, contextData } = req.body;
  const timestamp = new Date().toISOString();
  
  try {
    const ai = getGeminiClient();
    const isMock = process.env.GEMINI_API_KEY ? false : true;

    // Generate custom emails for each role
    const processedEmails: any[] = [];

    // Recipients list
    const recipients = [
      { name: "Dr. A. K. Deshmukh", email: "mdamodare@gmail.com", role: "Sales Director" },
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
          subject = `AgroSales IQ: Corporate Executive Digest - Dr. A. K. Deshmukh`;
          emailBody = `<h3>Dear Sales Director Dr. A. K. Deshmukh,</h3>
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
            model: "gemini-3.5-flash",
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started successfully on http://0.0.0.0:${PORT}`);
  });
}

startServer();
