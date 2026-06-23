-- Dhanashree SalesIQ Supabase Schema Migration
-- Designed for enterprise Agro sales intelligence and analytics platform
-- Incorporates full role hierarchy (Admin, Sales Director, Regional Manager, Salesperson)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. USERS TABLE
-- ==========================================
create table if not exists public.users (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    email text unique not null,
    employee_code text,
    role text not null check (role in ('Sales Director', 'Regional Manager', 'Salesperson', 'Admin')),
    territory text,
    region text,
    manager_id uuid references public.users(id) on delete set null,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Index user lookups
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_manager on public.users(manager_id);

-- ==========================================
-- 2. PRODUCTS TABLE
-- ==========================================
create table if not exists public.products (
    id uuid primary key default uuid_generate_v4(),
    product_name text unique not null,
    product_category text not null,
    supplier text not null,
    unit text not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ==========================================
-- 3. CUSTOMERS TABLE
-- ==========================================
create table if not exists public.customers (
    id uuid primary key default uuid_generate_v4(),
    customer_name text not null,
    customer_code text unique not null,
    territory text not null,
    region text not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists idx_customers_code on public.customers(customer_code);
create index if not exists idx_customers_territory on public.customers(territory);

-- ==========================================
-- 4. SALES DATA TABLE
-- ==========================================
create table if not exists public.sales_data (
    id uuid primary key default uuid_generate_v4(),
    invoice_date date not null,
    invoice_number text not null,
    company text not null,
    customer_name text not null,
    customer_code text not null,
    region text not null,
    territory text not null,
    salesperson text not null,
    salesperson_id uuid references public.users(id) on delete set null,
    manager_id uuid references public.users(id) on delete set null,
    regional_manager text not null,
    product_name text not null,
    product_category text not null,
    supplier text not null,
    quantity numeric not null,
    unit text not null,
    rate numeric not null,
    gross_value numeric not null,
    discount numeric default 0,
    net_value numeric not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists idx_sales_date on public.sales_data(invoice_date);
create index if not exists idx_sales_salesperson on public.sales_data(salesperson_id);
create index if not exists idx_sales_manager on public.sales_data(manager_id);
create index if not exists idx_sales_territory on public.sales_data(territory);

-- ==========================================
-- 5. BUDGET DATA TABLE
-- ==========================================
create table if not exists public.budget_data (
    id uuid primary key default uuid_generate_v4(),
    salesperson_id uuid references public.users(id) on delete cascade,
    product_name text not null,
    budget_quantity numeric not null,
    budget_value numeric not null,
    month text not null, -- "March", "April" etc.
    financial_year text not null, -- e.g. "2025-26"
    created_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists idx_budget_salesperson on public.budget_data(salesperson_id);
create index if not exists idx_budget_fy on public.budget_data(financial_year);

-- ==========================================
-- 6. UPLOADS LOG TABLE
-- ==========================================
create table if not exists public.uploads (
    id uuid primary key default uuid_generate_v4(),
    uploaded_by uuid references public.users(id) on delete set null,
    file_name text not null,
    file_type text not null, -- e.g. "Company A sales", "Company B sales", "Budget sheets"
    upload_date timestamp with time zone default timezone('utc'::text, now()),
    company text
);

-- ==========================================
-- 7. EMAIL LOGS TABLE
-- ==========================================
create table if not exists public.email_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete set null,
    recipient_email text not null,
    recipient_name text not null,
    recipient_role text not null,
    subject text not null,
    body_preview text,
    report_month text not null,
    email_sent_at timestamp with time zone default timezone('utc'::text, now()),
    status text not null check (status in ('Delivered', 'Failed', 'Retrying')),
    attachments text[] default '{}'
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ==========================================

-- Helper function to fetch current user's profile inside rules context
create or replace function public.get_current_user_profile()
returns public.users as $$
declare
    u_profile public.users;
begin
    select * into u_profile 
    from public.users 
    where email = auth.email()
    limit 1;
    
    return u_profile;
end;
$$ language plpgsql security definer;

-- Recursive helper to check if manager_id is in any level of reporting hierarchy
create or replace function public.is_descendant_of(employee_id uuid, possible_manager_id uuid)
returns boolean as $$
declare
    current_manager_id uuid;
begin
    select manager_id into current_manager_id 
    from public.users 
    where id = employee_id;
    
    if current_manager_id is null then
        return false;
    elsif current_manager_id = possible_manager_id then
        return true;
    else
        return public.is_descendant_of(current_manager_id, possible_manager_id);
    end if;
end;
$$ language plpgsql security definer;

-- ==========================================
-- ENABLE ROW LEVEL SECURITY
-- ==========================================
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.sales_data enable row level security;
alter table public.budget_data enable row level security;
alter table public.uploads enable row level security;
alter table public.email_logs enable row level security;

-- ==========================================
-- SECURITY POLICIES
-- ==========================================

-- 1. USERS POLICIES
create policy "Allow all users to read active user directories" 
on public.users for select 
using (true);

create policy "Allow admins and directors full write control over profiles" 
on public.users for all 
using (
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director')
);

create policy "Allow users to edit their own profile basic details" 
on public.users for update 
using (email = auth.email());

-- 2. PRODUCTS POLICIES
create policy "Allow authenticated users to read product catalog"
on public.products for select
using (true);

create policy "Allow admin/director to insert/update products"
on public.products for all
using (
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director')
);

-- 3. CUSTOMERS POLICIES
create policy "Allow authenticated users to read customer entries"
on public.customers for select
using (true);

create policy "Allow admin/director/rm to write customer profiles"
on public.customers for all
using (
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director', 'Regional Manager')
);

-- 4. SALES_DATA POLICIES
create policy "Salesperson read/write restrictions: self territory only"
on public.sales_data for select
using (
    auth.email() is null  -- Allow backend server admin credentials fallback queries
    or
    (select role from public.get_current_user_profile()) = 'Salesperson' and territory = (select territory from public.get_current_user_profile())
    or 
    (select role from public.get_current_user_profile()) = 'Regional Manager' and (manager_id = (select id from public.get_current_user_profile()) or salesperson_id = (select id from public.get_current_user_profile()) or public.is_descendant_of(salesperson_id, (select id from public.get_current_user_profile())))
    or
    (select role from public.get_current_user_profile()) in ('Sales Director', 'Admin')
);

create policy "Allow writes on sales data for direct sales representatives and up"
on public.sales_data for all
using (
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director')
    or
    ((select role from public.get_current_user_profile()) = 'Regional Manager' and manager_id = (select id from public.get_current_user_profile()))
    or
    ((select role from public.get_current_user_profile()) = 'Salesperson' and salesperson_id = (select id from public.get_current_user_profile()))
);

-- 5. BUDGET_DATA POLICIES
create policy "Sub-access rules for budget sheets based on role hierarchy"
on public.budget_data for select
using (
    auth.email() is null  -- Allow backend server admin credentials fallback queries
    or
    (select role from public.get_current_user_profile()) = 'Salesperson' and salesperson_id = (select id from public.get_current_user_profile())
    or 
    (select role from public.get_current_user_profile()) = 'Regional Manager' and (salesperson_id = (select id from public.get_current_user_profile()) or public.is_descendant_of(salesperson_id, (select id from public.get_current_user_profile())))
    or 
    (select role from public.get_current_user_profile()) in ('Sales Director', 'Admin')
);

create policy "Allow budget updates for self or admin/directors"
on public.budget_data for all
using (
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director')
    or
    (salesperson_id = (select id from public.get_current_user_profile()))
);

-- 6. UPLOADS POLICIES
create policy "Allow read on system spreadsheet uploads log"
on public.uploads for select
using (true);

create policy "Allow writes relative to spreadsheets uploads"
on public.uploads for insert
with check (true);

-- 7. EMAIL LOGS POLICIES
create policy "Allow read of email report histories"
on public.email_logs for select
using (true);

create policy "Allow creation of email communication reports"
on public.email_logs for insert
with check (true);

-- ==========================================
-- 8. INTEGRITY AND UPLOAD AUDITING TABLES
-- ==========================================

create table if not exists public.upload_audit_logs (
    id uuid primary key default uuid_generate_v4(),
    file_name text not null,
    file_type text not null,
    uploaded_by text,
    total_rows integer default 0,
    inserted_rows integer default 0,
    duplicate_rows integer default 0,
    failed_rows integer default 0,
    status text not null check (status in ('Completed', 'Partial_Success', 'Failed')),
    timestamp timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.failed_upload_rows (
    id uuid primary key default uuid_generate_v4(),
    audit_id uuid references public.upload_audit_logs(id) on delete cascade,
    row_index integer not null,
    invoice_number text,
    error_message text not null,
    timestamp timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.data_integrity_logs (
    id uuid primary key default uuid_generate_v4(),
    check_type text not null,
    results_summary text not null,
    details jsonb default '{}'::jsonb,
    timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on audit tables
alter table public.upload_audit_logs enable row level security;
alter table public.failed_upload_rows enable row level security;
alter table public.data_integrity_logs enable row level security;

-- Policies for audit tables
create policy "Allow select on upload_audit_logs" on public.upload_audit_logs for select using (true);
create policy "Allow insert on upload_audit_logs" on public.upload_audit_logs for insert with check (true);

create policy "Allow select on failed_upload_rows" on public.failed_upload_rows for select using (true);
create policy "Allow insert on failed_upload_rows" on public.failed_upload_rows for insert with check (true);

create policy "Allow select on data_integrity_logs" on public.data_integrity_logs for select using (true);
create policy "Allow insert on data_integrity_logs" on public.data_integrity_logs for insert with check (true);

-- ==========================================
-- SUPABASE STORAGE BUCKET CONFIGURATION
-- ==========================================
-- Note: Executable via Supabase UI or API commands:
-- insert into storage.buckets (id, name, public) values ('spreadsheets', 'spreadsheets', true);
-- create policy "Allow authenticated users to read from spreadsheets bucket" on storage.objects for select using (bucket_id = 'spreadsheets');
-- create policy "Allow authenticated uploads to spreadsheets bucket" on storage.objects for insert with check (bucket_id = 'spreadsheets');
