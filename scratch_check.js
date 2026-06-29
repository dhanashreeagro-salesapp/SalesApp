import fetch from "node-fetch";
async function check() {
  try {
    console.log("Fetching http://localhost:3000/api/db...");
    const res = await fetch("http://localhost:3000/api/db");
    const data = await res.json();
    console.log("Invoices count returned by backend:", data.invoices?.length);
    console.log("Budgets count returned by backend:", data.budgets?.length);
    console.log("Users count returned by backend:", data.users?.length);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
check();
