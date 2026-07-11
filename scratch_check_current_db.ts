import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Checking database...");
  const { data, error } = await supabase
    .from('sales_data')
    .select('id, salesperson, regional_manager')
    .eq('salesperson', 'Digvijay Pawar')
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

run();
