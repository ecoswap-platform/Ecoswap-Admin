import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const charityId = searchParams.get("charityId");

  let query = supabase
    .from("donations")
    .select("created_at")
    .eq("status", "completed");

  if (charityId) {
    query = query.eq("charity_id", charityId);
  }

  const { data } = await query;

  // Group donations by month
  const monthlyCounts = {};
  data.forEach(d => {
    const month = new Date(d.created_at).getMonth() + 1;
    monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
  });

  const months = Object.keys(monthlyCounts).map(Number);
  const counts = Object.values(monthlyCounts);

  return new Promise((resolve) => {
    const py = spawn("python", ["ml/predict_donations.py"]);

    py.stdin.write(JSON.stringify({ months, counts }));
    py.stdin.end();

    let output = "";
    py.stdout.on("data", data => output += data.toString());

    py.on("close", () => {
      resolve(Response.json(JSON.parse(output)));
    });
  });
}
