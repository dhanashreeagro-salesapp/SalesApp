import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let url = process.env.SUPABASE_URL || "";
if (url.endsWith("/rest/v1/")) {
  url = url.substring(0, url.length - "/rest/v1/".length);
} else if (url.endsWith("/rest/v1")) {
  url = url.substring(0, url.length - "/rest/v1".length);
}
if (url.endsWith("/")) {
  url = url.slice(0, -1);
}
const anonKey = process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(url, anonKey);

async function check() {
  try {
    const { data: users, error } = await supabase.from("users").select("id, name, email, role, region, territory, manager_id");
    if (error) throw error;
    console.log("Current users in database:");
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Error checking table:", err.message || err);
  }
}

check();
