import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(url, key);

async function run() {
  console.log("Registering admin account in Supabase Auth...");
  const { data, error } = await supabase.auth.signUp({
    email: 'rahul@plantnutrition.in',
    password: 'welcome123'
  });

  if (error) {
    console.error("SignUp Error:", error.message);
  } else {
    console.log("SignUp Success! User ID:", data.user?.id);
  }
}

run();
