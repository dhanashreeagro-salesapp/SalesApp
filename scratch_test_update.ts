import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Testing single update...");
  // Let's find one record
  const { data: records } = await supabase
    .from('sales_data')
    .select('id, salesperson, regional_manager')
    .eq('salesperson', 'Digvijay Pawar')
    .limit(1);

  if (!records || records.length === 0) {
    console.log("No records found.");
    return;
  }

  const record = records[0];
  console.log("Before update:", record);

  const res = await supabase
    .from('sales_data')
    .update({ regional_manager: 'Tembhurni (Shridhar Patil)' })
    .eq('id', record.id)
    .select();

  console.log("Update response status:", res.status, res.statusText);
  console.log("Update response error:", res.error);
  console.log("Update response data:", res.data);
}

run();
