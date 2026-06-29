import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Clean URL: strip trailing /rest/v1/
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

async function run() {
  try {
    // 1. Fetch all users
    const { data: users, error: uErr } = await supabase.from("users").select("*");
    if (uErr) throw uErr;

    const userNames = new Set(users.map(u => (u.name || "").trim().toLowerCase()));
    const userEmails = new Set(users.map(u => (u.email || "").trim().toLowerCase()));

    console.log(`Registered users in database: ${users.length}`);

    // 2. Fetch all sales invoices salespeople
    console.log("Fetching unique salespeople from sales_data...");
    
    // We paginate through sales_data
    let allSalespeopleMap = new Map();
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;
      const { data, error } = await supabase
        .from("sales_data")
        .select("salesperson, territory, region, regional_manager")
        .range(start, end);

      if (error) throw error;
      if (data && data.length > 0) {
        for (const row of data) {
          const spName = (row.salesperson || "").trim();
          if (!spName || spName.toLowerCase() === "representative" || spName.toLowerCase() === "unassigned") continue;
          
          const key = spName.toLowerCase();
          if (!allSalespeopleMap.has(key)) {
            allSalespeopleMap.set(key, {
              name: spName,
              territories: new Set(),
              regions: new Set(),
              managers: new Set()
            });
          }
          const info = allSalespeopleMap.get(key);
          if (row.territory) info.territories.add(row.territory.trim());
          if (row.region) info.regions.add(row.region.trim());
          if (row.regional_manager) info.managers.add(row.regional_manager.trim());
        }
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`Total unique salespeople found in invoice dataset: ${allSalespeopleMap.size}`);

    // 3. Identify missing ones
    const missing = [];
    for (const [key, info] of allSalespeopleMap.entries()) {
      if (!userNames.has(key)) {
        missing.push({
          name: info.name,
          territory: Array.from(info.territories)[0] || "Unassigned",
          region: Array.from(info.regions)[0] || "Unassigned",
          manager: Array.from(info.managers)[0] || "None"
        });
      }
    }

    console.log(`Total missing salespeople from user registry: ${missing.length}`);
    console.log("Missing salespeople details:");
    console.log(JSON.stringify(missing, null, 2));

  } catch (err) {
    console.error("Error running script:", err.message || err);
  }
}

run();
