import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year")  || new Date().getFullYear();
  const month = searchParams.get("month") || "";

  try {
    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (String(d.getFullYear()) !== String(year)) return false;
      if (month && String(d.getMonth() + 1) !== String(month)) return false;
      return true;
    };

    // ── Fetch all tables in parallel ───────────────────────────────────────
    const [
      { data: users },
      { data: items },
      { data: swaps },
      { data: charities },
      { data: reviews },
      { data: messages },
      { data: wishlists },
      { data: donations },
      { data: campaigns },
    ] = await Promise.all([
      supabase.from("users").select("id, is_active, is_verified, created_at, total_swaps, role"),
      supabase.from("items").select("id, category, status, views, created_at"),
      supabase.from("swap_requests").select("id, status, created_at"),
      supabase.from("charities").select("id, status, is_active, created_at"),
      supabase.from("reviews").select("id, rating, created_at"),
      supabase.from("messages").select("id, created_at"),
      supabase.from("wishlists").select("id, created_at"),
      supabase.from("donations").select("id, status, created_at").catch(() => ({ data: [] })),
      supabase.from("donation_campaigns").select("id, created_at").catch(() => ({ data: [] })),
    ]);

    const safeFilter = (arr, fn) => (arr || []).filter(fn);

    // ── Overall platform metrics ────────────────────────────────────────────
    const totalUsers        = (users  || []).length;
    const totalItems        = (items  || []).length;
    const totalSwaps        = (swaps  || []).length;
    const totalCharities    = (charities || []).length;
    const totalReviews      = (reviews || []).length;
    const totalMessages     = (messages || []).length;
    const totalWishlists    = (wishlists || []).length;
    const totalDonations    = (donations || []).length;
    const totalCampaigns    = (campaigns || []).length;

    // ── Period-filtered counts ─────────────────────────────────────────────
    const newUsers       = safeFilter(users,     u => inPeriod(u.created_at)).length;
    const newItems       = safeFilter(items,     i => inPeriod(i.created_at)).length;
    const newSwaps       = safeFilter(swaps,     s => inPeriod(s.created_at)).length;
    const newCharities   = safeFilter(charities, c => inPeriod(c.created_at)).length;
    const newMessages    = safeFilter(messages,  m => inPeriod(m.created_at)).length;

    // ── Status breakdowns ──────────────────────────────────────────────────
    const activeUsers      = (users || []).filter(u => u.is_active !== false).length;
    const verifiedUsers    = (users || []).filter(u => u.is_verified).length;
    const activeItems      = (items || []).filter(i => i.status === "active").length;
    const completedSwaps   = (swaps || []).filter(s => s.status === "accepted").length;
    const activeCharities  = (charities || []).filter(c => c.status === "ACTIVE").length;
    const pendingCharities = (charities || []).filter(c => c.status === "PENDING").length;

    // ── Engagement metrics ─────────────────────────────────────────────────
    const totalViews = (items || []).reduce((s, i) => s + (i.views || 0), 0);
    const avgRating  = totalReviews
      ? ((reviews || []).reduce((s, r) => s + (r.rating || 0), 0) / totalReviews).toFixed(1)
      : 0;
    const swapSuccessRate = totalSwaps
      ? Math.round((completedSwaps / totalSwaps) * 100)
      : 0;

    // ── Monthly growth trend (all key metrics) ─────────────────────────────
    const monthlyGrowth = {};
    const addToMonth = (arr, key) => {
      safeFilter(arr, i => inPeriod(i.created_at)).forEach(i => {
        const m = new Date(i.created_at).getMonth() + 1;
        if (!monthlyGrowth[m]) monthlyGrowth[m] = { users: 0, items: 0, swaps: 0, messages: 0 };
        monthlyGrowth[m][key] = (monthlyGrowth[m][key] || 0) + 1;
      });
    };
    addToMonth(users,    "users");
    addToMonth(items,    "items");
    addToMonth(swaps,    "swaps");
    addToMonth(messages, "messages");

    // ── Category breakdown ─────────────────────────────────────────────────
    const itemsByCategory = {};
    (items || []).forEach(i => {
      itemsByCategory[i.category || "Other"] = (itemsByCategory[i.category || "Other"] || 0) + 1;
    });

    // ── Platform health score (0–100) ──────────────────────────────────────
    const healthScore = Math.min(100, Math.round(
      (activeUsers / Math.max(totalUsers, 1)) * 30 +
      (swapSuccessRate * 0.3) +
      (verifiedUsers / Math.max(totalUsers, 1)) * 20 +
      (activeCharities / Math.max(totalCharities, 1)) * 20
    ));

    return Response.json({
      // Totals
      totalUsers, totalItems, totalSwaps, totalCharities,
      totalReviews, totalMessages, totalWishlists, totalDonations, totalCampaigns,
      // Period new
      newUsers, newItems, newSwaps, newCharities, newMessages,
      // Status
      activeUsers, verifiedUsers, activeItems,
      completedSwaps, activeCharities, pendingCharities,
      // Engagement
      totalViews, avgRating, swapSuccessRate, healthScore,
      // Trends
      monthlyGrowth, itemsByCategory,
    });

  } catch (err) {
    console.error("overall-analytics error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
