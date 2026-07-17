/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "Sales Director" | "Regional Manager" | "Salesperson" | "Admin";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  region?: string;       // For Regional Manager (e.g. "West")
  territory?: string;    // For Salesperson (e.g. "West-1")
  salespersonCode?: string; // For Salesperson mapping
  managerName?: string;  // Reporting manager
  managerId?: string;    // Reporting manager ID
  password?: string;
  approved?: boolean;
  serverSynced?: boolean;
}

export interface InvoiceItem {
  id: string;            // Generated row ID
  invoiceDate: string;   // YYYY-MM-DD
  invoiceNumber: string;
  company: string;
  customerName: string;
  customerCode: string;
  region: string;
  state: string;
  territory: string;
  salesperson: string;
  regionalManager: string;
  productName: string;
  productCategory: "Plant Nutrients" | "Fertilizers" | "Biostimulants" | "Microbial products" | string;
  supplier: string;
  quantity: number;
  unit: string;
  rate: number;
  grossValue: number;
  discount: number;
  netSalesValue: number;
  godownName?: string;
  voucherType?: string;
}

export interface BudgetItem {
  id: string;
  salesperson: string;
  product: string;
  budgetQuantity: number;
  budgetValue: number;
  month: string;          // e.g. "March", "April" or monthly date YYYY-MM
  financialYear: string;  // e.g. "2025-26", "2026-27"
  territory?: string;
  budgetRate?: number;
  regionalManager?: string;
  region?: string;
}

export interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  details: string;
  status: "Success" | "Warning" | "Error";
}

export interface EmailLog {
  id: string;
  dateSent: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: string;
  subject: string;
  bodyPreview: string; // Brief HTML/Text summary
  status: "Delivered" | "Failed" | "Retrying";
  attachments: string[]; // Options: ["Sales_Summary.pdf", "Variance_Details.xlsx"]
  triggerType: "Scheduled" | "Manual";
}

export interface StandardNameMapping {
  original: string;
  standardized: string;
  category: "customer" | "product";
}

export interface DashboardMetrics {
  totalYtdSales: number;
  ytdGrowthPercent: number;
  quantityGrowthPercent: number;
  budgetAchievementPercent: number;
  activeCustomers: number;
  activeProducts: number;
  topPerformingRegion: string;
  topDecliningRegion: string;
}

export interface CustomerMaster {
  id: string;
  customer_name: string;
  contact_person?: string;
  contact_number?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  gst_number?: string;
  pan_number?: string;
  status: "Active" | "Inactive";
  created_at?: string;
  updated_at?: string;
}

export interface CustomerAssignment {
  id: string;
  customer_id: string;
  user_id: string;
  allocation_percentage: number;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssignmentAuditLog {
  id: string;
  customer_id?: string;
  customer_name: string;
  admin_user: string;
  timestamp: string;
  action: string;
  old_value?: string;
  new_value?: string;
}
