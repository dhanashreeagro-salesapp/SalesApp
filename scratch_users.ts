import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  const { data: dbUsers, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error("Error fetching users:", error);
  } else {
    console.log("Supabase Users count:", dbUsers?.length);
    console.log("Supabase Users list:");
    console.log(JSON.stringify(dbUsers, null, 2));
  }
}

run();
