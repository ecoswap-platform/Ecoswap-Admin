import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const charityId = searchParams.get("charityId");
  const year = searchParams.get("year");

  let query = supabase
    .from("donations")
    .select(`
      id,
      status,
      created_at,
      donation_items (category, quantity)
    `);

  if (charityId) {
    query = query.eq("charity_id", charityId);
  }

  if (year) {
    query = query.gte("created_at", `${year}-01-01`)
                 .lte("created_at", `${year}-12-31`);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // ---------------- ANALYTICS ----------------
  const totalDonations = data.length;

  const totalItems = data.reduce((sum, d) => {
    return sum + d.donation_items.reduce((s, i) => s + i.quantity, 0);
  }, 0);

  const categoryCount = {};
  const monthlyTrend = {};
  let approved = 0;

  data.forEach(d => {
    if (d.status === "completed") approved++;

    const month = new Date(d.created_at).getMonth() + 1;
    monthlyTrend[month] = (monthlyTrend[month] || 0) + 1;

    d.donation_items.forEach(i => {
      categoryCount[i.category] =
        (categoryCount[i.category] || 0) + i.quantity;
    });
  });

  const approvalRatio = totalDonations
    ? Math.round((approved / totalDonations) * 100)
    : 0;

  const trustScore = Math.min(
    100,
    approvalRatio + totalItems
  );

  return Response.json({
    totalDonations,
    totalItems,
    categoryCount,
    monthlyTrend,
    approvalRatio,
    trustScore
  });
}
