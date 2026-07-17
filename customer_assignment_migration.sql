-- Dhanashree SalesIQ Customer Assignment Master Migration
-- Creates Customer Master, Customer Assignment, and Assignment Audit Logs tables
-- Configures hierarchy-aware Row Level Security (RLS) policies

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. CUSTOMER MASTER TABLE
-- ==========================================
create table if not exists public.customer_master (
    id uuid primary key default uuid_generate_v4(),
    customer_name text unique not null,
    contact_person text,
    contact_number text,
    email text,
    address text,
    city text,
    state text,
    pin_code text,
    gst_number text,
    pan_number text,
    status text default 'Active' check (status in ('Active', 'Inactive')),
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists idx_customer_master_name on public.customer_master(customer_name);
create index if not exists idx_customer_master_status on public.customer_master(status);

-- ==========================================
-- 2. CUSTOMER ASSIGNMENT TABLE
-- ==========================================
create table if not exists public.customer_assignment (
    id uuid primary key default uuid_generate_v4(),
    customer_id uuid references public.customer_master(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    allocation_percentage numeric not null check (allocation_percentage >= 0 and allocation_percentage <= 100),
    effective_from date default current_date not null,
    effective_to date,
    is_active boolean default true,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists idx_cust_assign_customer on public.customer_assignment(customer_id);
create index if not exists idx_cust_assign_user on public.customer_assignment(user_id);
create index if not exists idx_cust_assign_active on public.customer_assignment(is_active);

-- ==========================================
-- 3. CUSTOMER ASSIGNMENT AUDIT LOGS TABLE
-- ==========================================
create table if not exists public.customer_assignment_audit_logs (
    id uuid primary key default uuid_generate_v4(),
    customer_id uuid references public.customer_master(id) on delete cascade,
    customer_name text not null,
    admin_user text not null,
    timestamp timestamp with time zone default timezone('utc'::text, now()),
    action text not null, -- e.g. "Create Assignment", "Update Allocation", "Remove Assignment"
    old_value text,
    new_value text
);

create index if not exists idx_cust_assign_audit_cust on public.customer_assignment_audit_logs(customer_id);
create index if not exists idx_cust_assign_audit_time on public.customer_assignment_audit_logs(timestamp);

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) ACTIVATION
-- ==========================================
alter table public.customer_master enable row level security;
alter table public.customer_assignment enable row level security;
alter table public.customer_assignment_audit_logs enable row level security;

-- ==========================================
-- 5. SECURITY POLICIES
-- ==========================================

-- A. CUSTOMER MASTER POLICIES
create policy "Allow read access on customer master to all authenticated users"
on public.customer_master for select
using (true);

create policy "Allow write access on customer master to admins and sales directors"
on public.customer_master for all
using (
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director')
);

-- B. CUSTOMER ASSIGNMENT POLICIES
create policy "Allow hierarchy-based read access on customer assignments"
on public.customer_assignment for select
using (
    auth.email() is null  -- Allow backend server bypass
    or
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director')
    or
    user_id = (select id from public.get_current_user_profile())
    or
    (
        (select role from public.get_current_user_profile()) = 'Regional Manager' 
        and (
            user_id = (select id from public.get_current_user_profile())
            or
            public.is_descendant_of(user_id, (select id from public.get_current_user_profile()))
        )
    )
);

create policy "Allow write access on customer assignments to admins and sales directors"
on public.customer_assignment for all
using (
    (select role from public.get_current_user_profile()) in ('Admin', 'Sales Director')
);

-- C. AUDIT LOGS POLICIES
create policy "Allow select access on customer assignment audit logs to all authenticated users"
on public.customer_assignment_audit_logs for select
using (true);

create policy "Allow insert access on customer assignment audit logs"
on public.customer_assignment_audit_logs for insert
with check (true);
