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
    // ── Users ──────────────────────────────────────────────────────────────
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, role, is_active, is_verified, created_at, total_swaps, rating, city, country");
    if (usersErr) throw usersErr;

    // ── Items ──────────────────────────────────────────────────────────────
    const { data: items, error: itemsErr } = await supabase
      .from("items")
      .select("id, category, status, views, created_at, owner_id");
    if (itemsErr) throw itemsErr;

    // ── Swap Requests ──────────────────────────────────────────────────────
    const { data: swaps, error: swapsErr } = await supabase
      .from("swap_requests")
      .select("id, status, created_at");
    if (swapsErr) throw swapsErr;

    // ── Reviews ────────────────────────────────────────────────────────────
    const { data: reviews, error: reviewsErr } = await supabase
      .from("reviews")
      .select("id, rating, created_at");
    if (reviewsErr) throw reviewsErr;

    // ── Wishlists ──────────────────────────────────────────────────────────
    const { data: wishlists, error: wishErr } = await supabase
      .from("wishlists")
      .select("id, created_at");
    if (wishErr) throw wishErr;

    // ── Filter by year (and optional month) ───────────────────────────────
    const inPeriod = (dateStr) => {
      const d = new Date(dateStr);
      if (String(d.getFullYear()) !== String(year)) return false;
      if (month && String(d.getMonth() + 1) !== String(month)) return false;
      return true;
    };

    const filteredUsers  = users.filter(u  => inPeriod(u.created_at));
    const filteredItems  = items.filter(i  => inPeriod(i.created_at));
    const filteredSwaps  = swaps.filter(s  => inPeriod(s.created_at));
    const filteredReviews = reviews.filter(r => inPeriod(r.created_at));

    // ── User stats ─────────────────────────────────────────────────────────
    const totalUsers      = users.length;
    const newUsers        = filteredUsers.length;
    const activeUsers     = users.filter(u => u.is_active).length;
    const verifiedUsers   = users.filter(u => u.is_verified).length;

    // ── Registration trend by month ────────────────────────────────────────
    const registrationTrend = {};
    filteredUsers.forEach(u => {
      const m = new Date(u.created_at).getMonth() + 1;
      registrationTrend[m] = (registrationTrend[m] || 0) + 1;
    });

    // ── Items stats ────────────────────────────────────────────────────────
    const totalItems     = items.length;
    const newItems       = filteredItems.length;
    const itemsByCategory = {};
    filteredItems.forEach(i => {
      itemsByCategory[i.category || "Other"] = (itemsByCategory[i.category || "Other"] || 0) + 1;
    });
    const totalViews = filteredItems.reduce((s, i) => s + (i.views || 0), 0);

    // ── Swap stats ─────────────────────────────────────────────────────────
    const totalSwaps     = swaps.length;
    const newSwaps       = filteredSwaps.length;
    const completedSwaps = filteredSwaps.filter(s => s.status === "accepted").length;
    const pendingSwaps   = filteredSwaps.filter(s => s.status === "pending").length;
    const swapSuccessRate = newSwaps ? Math.round((completedSwaps / newSwaps) * 100) : 0;

    const swapTrend = {};
    filteredSwaps.forEach(s => {
      const m = new Date(s.created_at).getMonth() + 1;
      swapTrend[m] = (swapTrend[m] || 0) + 1;
    });

    // ── Review stats ───────────────────────────────────────────────────────
    const totalReviews = filteredReviews.length;
    const avgRating    = totalReviews
      ? (filteredReviews.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews).toFixed(1)
      : 0;

    // ── Location breakdown ─────────────────────────────────────────────────
    const usersByCity = {};
    users.forEach(u => {
      if (u.city) usersByCity[u.city] = (usersByCity[u.city] || 0) + 1;
    });
    const topCities = Object.entries(usersByCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {});

    // ── Wishlist stats ─────────────────────────────────────────────────────
    const totalWishlists = wishlists.length;

    return Response.json({
      // User metrics
      totalUsers, newUsers, activeUsers, verifiedUsers,
      registrationTrend,
      topCities,
      // Item metrics
      totalItems, newItems, itemsByCategory, totalViews,
      // Swap metrics
      totalSwaps, newSwaps, completedSwaps, pendingSwaps,
      swapSuccessRate, swapTrend,
      // Review metrics
      totalReviews, avgRating,
      // Wishlist
      totalWishlists,
    });

  } catch (err) {
    console.error("user-analytics error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
