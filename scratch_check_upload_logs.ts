import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Fetching upload audit logs...");
  const { data: logs, error } = await supabase
    .from('upload_audit_logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${logs?.length} upload audit logs:`);
  console.log(JSON.stringify(logs, null, 2));

  // Let's also check if there are failed upload rows
  const { data: failedRows, error: e2 } = await supabase
    .from('failed_upload_rows')
    .select('*')
    .limit(10);
  
  if (!e2) {
    console.log(`Failed upload rows count: ${failedRows?.length}`);
  }
}

run();
