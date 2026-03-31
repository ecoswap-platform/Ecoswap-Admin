"use client";

import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Tooltip, Legend
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import jsPDF from "jspdf";
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ── chart defaults ───────────────────────────────────────────────────────────
const chartDefaults = {
  responsive: true,
  plugins: { legend: { labels: { color:"#9dbfb3", font:{ family:"DM Sans", size:12 } } } },
  scales: {
    x: { ticks:{ color:"#6b9e8e" }, grid:{ color:"rgba(52,211,153,0.06)" } },
    y: { ticks:{ color:"#6b9e8e" }, grid:{ color:"rgba(52,211,153,0.06)" } },
  }
};

export default function AdminDashboard() {
  const router = useRouter();

  const [admins,            setAdmins]            = useState([]);
  const [users,             setUsers]             = useState([]);
  const [allUsers,          setAllUsers]          = useState([]);
  const [search,            setSearch]            = useState("");
  const [logs,              setLogs]              = useState([]);
  const [currentAdminEmail, setCurrentAdminEmail] = useState("");
  const [charities,         setCharities]         = useState([]);
  const [allCharities,      setAllCharities]      = useState([]);
  const [pendingCharities,  setPendingCharities]  = useState([]);
  const [charitySearch,     setCharitySearch]     = useState("");
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState("");
  const [sidebarOpen,       setSidebarOpen]       = useState(true);
  const [activeSection,     setActiveSection]     = useState("overview");
  const [toast,             setToast]             = useState(null);

  const [analyticsTab,      setAnalyticsTab]      = useState("overall");
  const [selectedYear,      setSelectedYear]      = useState(new Date().getFullYear());
  const [selectedMonth,     setSelectedMonth]     = useState("");
  const [selectedCharityId, setSelectedCharityId] = useState("");
  const [overallAnalytics,  setOverallAnalytics]  = useState(null);
  const [userAnalytics,     setUserAnalytics]     = useState(null);
  const [charityAnalytics,  setCharityAnalytics]  = useState(null);
  const [prediction,        setPrediction]        = useState(null);

  // ── Reports state ─────────────────────────────────────────────────────────
  const [reports,           setReports]           = useState([]);
  const [reportFilter,      setReportFilter]      = useState("pending"); // pending | resolved | dismissed | all
  const [selectedReport,    setSelectedReport]    = useState(null); // full detail modal

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const protect = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/admin/login"); return; }
        const { data: admin, error: adminErr } = await supabase
          .from("admins").select("*").eq("email", user.email).single();
        if (adminErr || !admin || !admin.approved || !admin.is_active) {
          await supabase.auth.signOut(); router.push("/admin/login"); return;
        }
        setCurrentAdminEmail(user.email);
        setLoading(false);
        await Promise.all([fetchAdmins(), fetchAllUsers(), fetchLogs(), fetchPendingCharities(), fetchAllCharities(), fetchReports()]);
        fetchOverallAnalytics();
      } catch (err) { setError("Failed to load."); setLoading(false); }
    };
    protect();
  }, [router]);

  useEffect(() => {
    if (!currentAdminEmail) return;
    if (analyticsTab === "overall") fetchOverallAnalytics();
    if (analyticsTab === "user")    fetchUserAnalytics();
    if (analyticsTab === "charity") { fetchCharityAnalytics(); fetchPrediction(); }
  }, [analyticsTab, selectedYear, selectedMonth, selectedCharityId, currentAdminEmail]);

  useEffect(() => {
    if (!currentAdminEmail) return;
    fetchReports();
  }, [reportFilter, currentAdminEmail]);

  const createLog = async (action, target) => {
    if (!currentAdminEmail) return;
    await supabase.from("admin_logs").insert([{ performed_by: currentAdminEmail, action, target }]);
    fetchLogs();
  };

  const fetchAdmins = async () => {
    const { data } = await supabase.from("admins").select("email, role, is_active");
    setAdmins(data || []);
  };
  const toggleAdminStatus = async (email, cur) => {
    if (email === currentAdminEmail) { showToast("Cannot deactivate yourself.", "error"); return; }
    await supabase.from("admins").update({ is_active: !cur }).eq("email", email);
    await createLog(`Admin ${!cur?"ENABLED":"DISABLED"}`, email);
    fetchAdmins(); showToast(`Admin ${!cur?"enabled":"disabled"}: ${email}`);
  };

  const fetchAllUsers = async () => {
    const { data, error } = await supabase.from("users")
      .select("id, full_name, username, avatar_url, role, is_active, is_verified, total_swaps, rating, city, country, created_at")
      .order("created_at", { ascending:false }).limit(100);
    if (error) { console.error(error.message); return; }
    setAllUsers(data||[]); setUsers(data||[]);
  };
  const searchUsers = async () => {
    if (!search.trim()) { setUsers(allUsers); return; }
    const t = search.trim();
    const { data } = await supabase.from("users")
      .select("id, full_name, username, avatar_url, role, is_active, is_verified, total_swaps, rating, city, country, created_at")
      .or(`full_name.ilike.%${t}%,username.ilike.%${t}%,city.ilike.%${t}%`)
      .order("created_at", { ascending:false });
    setUsers(data||[]);
  };
  const deleteUser = async (id, label) => {
    if (!confirm(`Permanently delete user: ${label}?`)) return;
    await supabase.from("users").delete().eq("id", id);
    await createLog("User deleted", label); fetchAllUsers();
    showToast(`User deleted: ${label}`, "error");
  };

  const fetchAllCharities = async () => {
    const { data } = await supabase.from("charities")
      .select("id, charity_name, auto_registration_id, email, status, is_active, created_at")
      .order("created_at", { ascending:false });
    setAllCharities(data||[]); setCharities(data||[]);
  };
  const searchCharities = async () => {
    if (!charitySearch.trim()) { setCharities(allCharities); return; }
    const { data } = await supabase.from("charities")
      .select("id, charity_name, auto_registration_id, email, status, is_active")
      .or(`charity_name.ilike.%${charitySearch.trim()}%,email.ilike.%${charitySearch.trim()}%`);
    setCharities(data||[]);
  };
  const toggleCharityFreeze = async (c) => {
    const ns = c.is_active?"FROZEN":"ACTIVE";
    await supabase.from("charities").update({ is_active:!c.is_active, status:ns }).eq("id", c.id);
    await createLog(`Charity ${ns}`, c.charity_name); fetchAllCharities();
    showToast(`${c.charity_name} ${ns.toLowerCase()}`, ns==="FROZEN"?"error":"success");
  };
  const deleteCharity = async (c) => {
    if (!confirm(`Delete: ${c.charity_name}?`)) return;
    await supabase.from("charities").delete().eq("id", c.id);
    await createLog("Charity DELETED", c.charity_name); fetchAllCharities();
    showToast(`Charity deleted`, "error");
  };

  const fetchPendingCharities = async () => {
    const { data } = await supabase.from("charities")
      .select("id, charity_name, auto_registration_id, email, status, created_at")
      .eq("status","PENDING").order("created_at", { ascending:true });
    setPendingCharities(data||[]);
  };
  const approveCharity = async (c) => {
    const { error } = await supabase.from("charities")
      .update({ status:"ACTIVE", is_active:true, reviewed_by:currentAdminEmail, reviewed_at:new Date().toISOString() })
      .eq("id", c.id);
    if (error) { showToast("Approve failed: "+error.message,"error"); return; }
    await createLog("Charity APPROVED", `${c.charity_name} (${c.email})`);
    fetchPendingCharities(); fetchAllCharities();
    showToast(`✅ ${c.charity_name} approved!`);
  };
  const rejectCharity = async (c) => {
    if (!confirm(`Reject: ${c.charity_name}?`)) return;
    const { error } = await supabase.from("charities")
      .update({ status:"REJECTED", is_active:false, reviewed_by:currentAdminEmail, reviewed_at:new Date().toISOString() })
      .eq("id", c.id);
    if (error) { showToast("Reject failed: "+error.message,"error"); return; }
    await createLog("Charity REJECTED", `${c.charity_name} (${c.email})`);
    fetchPendingCharities(); fetchAllCharities();
    showToast(`${c.charity_name} rejected`, "error");
  };

  const bp = () => { let p=`year=${selectedYear}`; if(selectedMonth) p+=`&month=${selectedMonth}`; return p; };
  const fetchOverallAnalytics = async () => {
    try { const r=await fetch(`/api/overall-analytics?${bp()}`); setOverallAnalytics(await r.json()); } catch(e){}
  };
  const fetchUserAnalytics = async () => {
    try { const r=await fetch(`/api/user-analytics?${bp()}`); setUserAnalytics(await r.json()); } catch(e){}
  };
  const fetchCharityAnalytics = async () => {
    try {
      let url=`/api/charity-analytics?${bp()}`;
      if(selectedCharityId) url+=`&charityId=${selectedCharityId}`;
      const r=await fetch(url); setCharityAnalytics(await r.json());
    } catch(e){}
  };
  const fetchPrediction = async () => {
    try {
      let url="/api/predict-donations";
      if(selectedCharityId) url+=`?charityId=${selectedCharityId}`;
      const r=await fetch(url); if(r.ok) setPrediction(await r.json());
    } catch(e){}
  };
  // ── Reports ──────────────────────────────────────────────────────────────
  const fetchReports = async () => {
    const selectQuery = `
        id, reason, details, status, created_at,
        item:items (
          id, title, description, category, images, status, condition,
          views, looking_for, created_at,
          owner:users!items_owner_id_fkey (
            id, full_name, username, rating, total_swaps, is_verified, city, country
          )
        ),
        reporter:users!item_reports_reporter_id_fkey (
          id, full_name, username, rating, is_verified
        )
      `;
    let q = supabase
      .from("item_reports")
      .select(selectQuery)
      .order("created_at", { ascending: false });

    if (reportFilter !== "all") q = q.eq("status", reportFilter);
    const { data, error } = await q;
    if (error) { console.error("fetchReports:", error.message); return; }
    setReports(data || []);
  };

  const resolveReport = async (reportId, itemTitle) => {
    await supabase.from("item_reports").update({ status: "resolved" }).eq("id", reportId);
    await createLog("Report RESOLVED", itemTitle);
    setSelectedReport(null);
    fetchReports();
    showToast("Report marked as resolved");
  };

  const dismissReport = async (reportId, itemTitle) => {
    await supabase.from("item_reports").update({ status: "dismissed" }).eq("id", reportId);
    await createLog("Report DISMISSED", itemTitle);
    setSelectedReport(null);
    fetchReports();
    showToast("Report dismissed", "error");
  };

  const deleteReportedItem = async (itemId, itemTitle, reportId) => {
    const confirmed = window.confirm(
      "⚠️ PERMANENT DELETE\n\nAre you sure you want to permanently delete the item:\n\"" + itemTitle + "\"\n\nThis action CANNOT be undone. The item and all its data will be lost."
    );
    if (!confirmed) return;
    await supabase.from("items").delete().eq("id", itemId);
    await supabase.from("item_reports").update({ status: "resolved" }).eq("id", reportId);
    await createLog("Reported item DELETED", itemTitle);
    setSelectedReport(null);
    fetchReports();
    showToast("Item deleted: " + itemTitle, "error");
  };

  const freezeReportedItem = async (itemId, itemTitle, reportId) => {
    const confirmed = window.confirm(
      "Freeze item: \"" + itemTitle + "\"?\n\nThis will set the item status to 'frozen' making it invisible to users. You can unfreeze it later."
    );
    if (!confirmed) return;
    await supabase.from("items").update({ status: "frozen" }).eq("id", itemId);
    await supabase.from("item_reports").update({ status: "resolved" }).eq("id", reportId);
    await createLog("Reported item FROZEN", itemTitle);
    setSelectedReport(null);
    fetchReports();
    showToast("Item frozen: " + itemTitle);
  };

  const warnOwner = async (report) => {
    // Log the warning action (email integration can be added later)
    await createLog("Owner WARNING issued", (report.item?.owner?.username || "unknown") + " for item: " + (report.item?.title || "unknown"));
    showToast("Warning logged for item owner");
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from("admin_logs").select("*")
      .order("created_at",{ascending:false}).limit(30);
    setLogs(data||[]);
  };

  const exportCSV = (data, filename) => {
    if(!data) return;
    const rows=Object.entries(data).filter(([,v])=>typeof v!=="object").map(([k,v])=>[k,v]);
    const link=document.createElement("a");
    link.setAttribute("href",encodeURI("data:text/csv;charset=utf-8,Metric,Value\n"+rows.map(r=>r.join(",")).join("\n")));
    link.setAttribute("download",filename);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  const exportPDF = (data, title) => {
    if(!data) return;
    const doc=new jsPDF();
    doc.setFontSize(16); doc.text(title,20,20); doc.setFontSize(12);
    Object.entries(data).filter(([,v])=>typeof v!=="object")
      .forEach(([k,v],i)=>doc.text(`${k}: ${v}`,20,40+i*10));
    doc.save(`${title.replace(/ /g,"_")}.pdf`);
  };

  const logout = async () => { await supabase.auth.signOut(); router.push("/admin/login"); };

  const navItems = [
    { id:"overview",  icon:"⚡", label:"Overview"    },
    { id:"users",     icon:"👥", label:"Users"       },
    { id:"charities", icon:"🏥", label:"Charities"   },
    { id:"approvals", icon:"⏳", label:"Approvals", badge: pendingCharities.length },
    { id:"reports",   icon:"🚨", label:"Reports",  badge: reports.filter(r=>r.status==="pending").length },
    { id:"analytics", icon:"📊", label:"Analytics"   },
    { id:"admins",    icon:"🔐", label:"Permissions" },
    { id:"logs",      icon:"📋", label:"Logs"        },
  ];

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#0a0f0d", gap:"20px" }}>
      <div style={{ width:"56px", height:"56px", borderRadius:"16px", background:"linear-gradient(135deg,rgba(52,211,153,0.2),rgba(16,185,129,0.1))", border:"1px solid rgba(52,211,153,0.3)", display:"flex", alignItems:"center", justifyContent:"center", animation:"float 2s ease-in-out infinite" }}>
        <img src="/ecoswap-logo.png" alt="" style={{ width:"36px" }} />
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"48px", height:"3px", background:"linear-gradient(90deg,transparent,#34d399,transparent)", borderRadius:"2px", margin:"0 auto 12px", animation:"shimmer 1.5s linear infinite", backgroundSize:"200% 100%" }} />
        <p style={{ color:"#6b9e8e", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"14px", letterSpacing:"0.1em" }}>LOADING ADMIN PORTAL</p>
      </div>
    </div>
  );

  return (
    <div style={D.root}>
      {/* Toast */}
      {toast && (
        <div style={{ ...D.toast, background: toast.type==="error"?"rgba(248,113,113,0.15)":"rgba(52,211,153,0.15)", borderColor: toast.type==="error"?"rgba(248,113,113,0.3)":"rgba(52,211,153,0.3)", color: toast.type==="error"?"#fca5a5":"#34d399" }}>
          {toast.type==="error" ? "⚠" : "✓"} {toast.msg}
        </div>
      )}

      {/* SIDEBAR */}
      <aside style={{ ...D.sidebar, width: sidebarOpen?"240px":"68px" }}>
        <div style={D.sidebarTop}>
          {sidebarOpen && (
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <div style={D.sideLogoBox}>
                <img src="/ecoswap-logo.png" alt="" style={{ width:"28px" }} />
              </div>
              <div>
                <div style={D.sideTitle}>EcoSwap</div>
                <div style={D.sideSub}>Admin Portal</div>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(o=>!o)} style={D.toggleBtn}>
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <nav style={{ flex:1, padding:"8px 10px", display:"flex", flexDirection:"column", gap:"4px" }}>
          {navItems.map(item => (
            <button key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{ ...D.navItem, ...(activeSection===item.id ? D.navItemActive : {}) }}>
              <span style={{ fontSize:"16px", flexShrink:0 }}>{item.icon}</span>
              {sidebarOpen && (
                <>
                  <span style={{ flex:1, textAlign:"left", fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:"13.5px" }}>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={D.navBadge}>{item.badge}</span>
                  )}
                </>
              )}
              {!sidebarOpen && item.badge > 0 && (
                <span style={{ ...D.navBadge, position:"absolute", top:"4px", right:"4px", fontSize:"9px", padding:"1px 4px" }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding:"10px" }}>
          <button onClick={logout} style={D.logoutBtn}>
            <span>🚪</span>
            {sidebarOpen && <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"13px", fontWeight:600 }}>Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={D.main}>
        {/* Top bar */}
        <header style={D.topbar}>
          <div>
            <h1 style={D.pageTitle}>
              {navItems.find(n=>n.id===activeSection)?.icon}{" "}
              {navItems.find(n=>n.id===activeSection)?.label}
            </h1>
            <p style={D.pageSub}>EcoSwap Admin · {new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
          </div>
          <div style={D.adminChip}>
            <div style={D.adminDot} />
            <span style={{ fontSize:"12px", color:"#9dbfb3", fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>{currentAdminEmail}</span>
          </div>
        </header>

        {error && <div style={D.errBar}>⚠ {error}</div>}

        <div style={{ padding:"0 28px 28px" }}>

          {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
          {activeSection === "overview" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={D.statsRow}>
                {[
                  { label:"Total Users",    value:allUsers.length,     icon:"👥", color:"#60a5fa", bg:"rgba(96,165,250,0.08)" },
                  { label:"Total Charities",value:allCharities.length, icon:"🏥", color:"#fbbf24", bg:"rgba(251,191,36,0.08)" },
                  { label:"Pending Approvals",value:pendingCharities.length, icon:"⏳", color:"#f87171", bg:"rgba(248,113,113,0.08)" },
                  { label:"Open Reports",   value:reports.filter(r=>r.status==="pending").length, icon:"🚨", color:"#f472b6", bg:"rgba(244,114,182,0.08)" },
                  { label:"Active Admins",  value:admins.filter(a=>a.is_active).length, icon:"🔐", color:"#34d399", bg:"rgba(52,211,153,0.08)" },
                ].map(s => (
                  <div key={s.label} style={{ ...D.overviewCard, background:s.bg, border:`1px solid ${s.color}22` }}>
                    <div style={{ fontSize:"28px", marginBottom:"10px" }}>{s.icon}</div>
                    <div style={{ fontSize:"36px", fontWeight:900, color:s.color, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:"12px", color:"#6b9e8e", marginTop:"6px", fontWeight:600, letterSpacing:"0.05em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent logs preview */}
              <div style={D.card}>
                <div style={D.cardHead}>
                  <span style={D.cardTitle}>Recent Activity</span>
                  <button style={D.smallBtn} onClick={() => setActiveSection("logs")}>View All →</button>
                </div>
                {logs.slice(0,5).map(log => (
                  <div key={log.id} style={D.logRow}>
                    <div style={D.logDot} />
                    <div style={{ flex:1 }}>
                      <span style={{ color:"#34d399", fontWeight:700, fontSize:"13px" }}>{log.action}</span>
                      {log.target && <span style={{ color:"#6b9e8e", fontSize:"13px" }}> · {log.target}</span>}
                    </div>
                    <span style={{ fontSize:"11px", color:"#4a7a68" }}>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {logs.length === 0 && <p style={{ color:"#4a7a68", fontSize:"13px", padding:"12px 0" }}>No activity yet.</p>}
              </div>

              {/* Pending approvals alert */}
              {pendingCharities.length > 0 && (
                <div style={D.alertCard} onClick={() => setActiveSection("approvals")}>
                  <div style={{ fontSize:"24px" }}>🔔</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"14px", color:"#fbbf24" }}>
                      {pendingCharities.length} Charity Request{pendingCharities.length>1?"s":""} Awaiting Approval
                    </div>
                    <div style={{ fontSize:"12px", color:"#9dbfb3", marginTop:"2px" }}>Click to review and approve or reject</div>
                  </div>
                  <span style={{ color:"#fbbf24", fontSize:"18px" }}>→</span>
                </div>
              )}
              {/* Open reports alert */}
              {reports.filter(r=>r.status==="pending").length > 0 && (
                <div style={{ ...D.alertCard, background:"rgba(244,114,182,0.06)", border:"1px solid rgba(244,114,182,0.2)" }} onClick={() => setActiveSection("reports")}>
                  <div style={{ fontSize:"24px" }}>🚨</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"14px", color:"#f472b6" }}>
                      {reports.filter(r=>r.status==="pending").length} Item Report{reports.filter(r=>r.status==="pending").length>1?"s":""} Require Attention
                    </div>
                    <div style={{ fontSize:"12px", color:"#9dbfb3", marginTop:"2px" }}>Click to review reported items</div>
                  </div>
                  <span style={{ color:"#f472b6", fontSize:"18px" }}>→</span>
                </div>
              )}
            </div>
          )}

          {/* ── USERS ──────────────────────────────────────────────────────── */}
          {activeSection === "users" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={D.card}>
                <div style={D.cardHead}>
                  <span style={D.cardTitle}>User Management</span>
                  <span style={D.countBadge}>{users.length} shown</span>
                </div>
                <div style={D.searchRow}>
                  <div style={D.searchWrap}>
                    <span style={D.searchIcon}>🔍</span>
                    <input style={D.searchInput} placeholder="Search by name, username or city..."
                      value={search} onChange={e=>setSearch(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&searchUsers()} />
                  </div>
                  <button style={D.actionBtn} onClick={searchUsers}>Search</button>
                  <button style={D.ghostBtn} onClick={()=>{setSearch("");setUsers(allUsers);}}>Reset</button>
                </div>
                <div style={{ maxHeight:"480px", overflowY:"auto" }}>
                  {users.length === 0 && <EmptyState icon="👤" msg="No users found." />}
                  {users.map(u => (
                    <div key={u.id} style={D.dataRow}>
                      <div style={D.avatar}>{(u.full_name||u.username||"U")[0].toUpperCase()}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, color:"#e8f5f0", fontSize:"14px" }}>{u.full_name||u.username||"—"}</div>
                        <div style={{ color:"#6b9e8e", fontSize:"12px" }}>@{u.username||"—"}{u.city&&` · 📍${u.city}`}</div>
                        <div style={{ display:"flex", gap:"6px", marginTop:"4px", flexWrap:"wrap" }}>
                          <Tag label={u.role||"user"} color="#9dbfb3" />
                          {u.is_verified && <Tag label="✓ Verified" color="#34d399" />}
                          <Tag label={`⭐ ${u.rating||0}`} color="#fbbf24" />
                          <Tag label={`🔄 ${u.total_swaps||0}`} color="#60a5fa" />
                        </div>
                      </div>
                      <button style={D.dangerBtn} onClick={()=>deleteUser(u.id,u.username||u.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CHARITIES ──────────────────────────────────────────────────── */}
          {activeSection === "charities" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={D.card}>
                <div style={D.cardHead}>
                  <span style={D.cardTitle}>Manage Charities</span>
                  <span style={D.countBadge}>{charities.length} shown</span>
                </div>
                <div style={D.searchRow}>
                  <div style={D.searchWrap}>
                    <span style={D.searchIcon}>🔍</span>
                    <input style={D.searchInput} placeholder="Search by name or email..."
                      value={charitySearch} onChange={e=>setCharitySearch(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&searchCharities()} />
                  </div>
                  <button style={D.actionBtn} onClick={searchCharities}>Search</button>
                  <button style={D.ghostBtn} onClick={()=>{setCharitySearch("");setCharities(allCharities);}}>Reset</button>
                </div>
                <div style={{ maxHeight:"480px", overflowY:"auto" }}>
                  {charities.length === 0 && <EmptyState icon="🏥" msg="No charities found." />}
                  {charities.map(c => (
                    <div key={c.id} style={D.dataRow}>
                      <div style={{ ...D.avatar, background:"rgba(251,191,36,0.15)", color:"#fbbf24" }}>🏥</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, color:"#e8f5f0", fontSize:"14px" }}>{c.charity_name}</div>
                        <div style={{ color:"#6b9e8e", fontSize:"12px" }}>{c.email}</div>
                        <div style={{ marginTop:"4px" }}>
                          <StatusPill status={c.status} />
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:"6px" }}>
                        <button style={{ ...D.actionBtn, background:c.is_active?"rgba(251,191,36,0.15)":"rgba(52,211,153,0.15)", color:c.is_active?"#fbbf24":"#34d399", border:`1px solid ${c.is_active?"rgba(251,191,36,0.3)":"rgba(52,211,153,0.3)"}`, fontSize:"12px", padding:"6px 12px" }}
                          onClick={()=>toggleCharityFreeze(c)}>
                          {c.is_active?"Freeze":"Unfreeze"}
                        </button>
                        <button style={D.dangerBtn} onClick={()=>deleteCharity(c)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── APPROVALS ──────────────────────────────────────────────────── */}
          {activeSection === "approvals" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={{ ...D.card, border: pendingCharities.length>0?"1px solid rgba(251,191,36,0.3)":"1px solid rgba(52,211,153,0.12)" }}>
                <div style={D.cardHead}>
                  <span style={D.cardTitle}>Charity Approval Requests</span>
                  {pendingCharities.length > 0 && (
                    <span style={{ background:"rgba(251,191,36,0.2)", color:"#fbbf24", border:"1px solid rgba(251,191,36,0.3)", borderRadius:"999px", padding:"3px 12px", fontSize:"12px", fontWeight:800 }}>
                      {pendingCharities.length} PENDING
                    </span>
                  )}
                </div>
                {pendingCharities.length === 0 && (
                  <EmptyState icon="✅" msg="All caught up! No pending requests." />
                )}
                {pendingCharities.map(c => (
                  <div key={c.id} style={{ ...D.approvalCard }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"12px" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:"16px", color:"#e8f5f0", marginBottom:"6px" }}>{c.charity_name}</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                          <span style={{ color:"#9dbfb3", fontSize:"13px" }}>📧 {c.email}</span>
                          {c.auto_registration_id && <span style={{ color:"#6b9e8e", fontSize:"12px" }}>🆔 {c.auto_registration_id}</span>}
                          <span style={{ color:"#6b9e8e", fontSize:"12px" }}>📅 Applied {new Date(c.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:"10px" }}>
                        <button style={D.approveBtn} onClick={()=>approveCharity(c)}>✅ Approve</button>
                        <button style={D.rejectBtn}  onClick={()=>rejectCharity(c)}>❌ Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── REPORTS ───────────────────────────────────────────────────────── */}
          {activeSection === "reports" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={D.card}>
                <div style={D.cardHead}>
                  <span style={D.cardTitle}>🚨 Item Reports</span>
                  <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                    <span style={{ background:"rgba(244,114,182,0.1)", color:"#f472b6", border:"1px solid rgba(244,114,182,0.2)", borderRadius:"999px", padding:"3px 10px", fontSize:"11px", fontWeight:700 }}>
                      {reports.filter(r=>r.status==="pending").length} open
                    </span>
                    <button style={D.smallBtn} onClick={fetchReports}>&#x21BB; Refresh</button>
                  </div>
                </div>

                <div style={{ ...D.tabRow, marginBottom:"20px" }}>
                  {[
                    { key:"pending",   label:"Pending"   },
                    { key:"resolved",  label:"Resolved"  },
                    { key:"dismissed", label:"Dismissed" },
                    { key:"all",       label:"All"       },
                  ].map(t => (
                    <button key={t.key}
                      style={{ ...D.tab, ...(reportFilter===t.key ? D.tabActive : {}) }}
                      onClick={() => setReportFilter(t.key)}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {reports.length === 0 && <EmptyState icon="🛡️" msg="No reports found for this filter." />}

                <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                  {reports.map(r => (
                    <div key={r.id}
                      onClick={() => setSelectedReport(r)}
                      style={{
                        background:"rgba(10,15,13,0.6)",
                        border: r.status==="pending" ? "1px solid rgba(244,114,182,0.25)" : r.status==="resolved" ? "1px solid rgba(52,211,153,0.15)" : "1px solid rgba(52,211,153,0.06)",
                        borderRadius:"16px", padding:"18px 20px", cursor:"pointer", transition:"border-color 0.2s"
                      }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:"14px" }}>
                        <div style={{ width:"52px", height:"52px", borderRadius:"12px", flexShrink:0, background:"rgba(244,114,182,0.08)", border:"1px solid rgba(244,114,182,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", overflow:"hidden" }}>
                          {r.item?.images?.[0] ? <img src={r.item.images[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"11px" }} /> : "📦"}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"8px", flexWrap:"wrap" }}>
                            <div>
                              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:"15px", color:"#e8f5f0", marginBottom:"2px" }}>{r.item?.title || "Deleted Item"}</div>
                              <div style={{ fontSize:"12px", color:"#6b9e8e" }}>Owner: <span style={{ color:"#9dbfb3", fontWeight:600 }}>@{r.item?.owner?.username || "unknown"}</span>{r.item?.category && <span style={{ marginLeft:"8px", color:"#4a7a68" }}>· {r.item.category}</span>}</div>
                            </div>
                            <ReportStatusPill status={r.status} />
                          </div>
                          <div style={{ marginTop:"8px", display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
                            <span style={{ fontSize:"12px", padding:"3px 10px", borderRadius:"8px", background:"rgba(248,113,113,0.12)", color:"#fca5a5", border:"1px solid rgba(248,113,113,0.2)", fontWeight:600 }}>🏷 {r.reason}</span>
                            <span style={{ fontSize:"11px", color:"#4a7a68" }}>by <span style={{ color:"#6b9e8e" }}>@{r.reporter?.username || "unknown"}</span></span>
                            <span style={{ fontSize:"11px", color:"#4a7a68" }}>{new Date(r.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
                          </div>
                          {r.details && (
                            <div style={{ marginTop:"8px", fontSize:"12px", color:"#6b9e8e", fontStyle:"italic", background:"rgba(52,211,153,0.03)", borderRadius:"8px", padding:"6px 10px", border:"1px solid rgba(52,211,153,0.06)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              "{r.details}"
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize:"12px", color:"#4a7a68", flexShrink:0 }}>→</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedReport && (
                <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}
                  onClick={(e) => { if(e.target===e.currentTarget) setSelectedReport(null); }}>
                  <div style={{ width:"100%", maxWidth:"720px", maxHeight:"90vh", overflowY:"auto", background:"linear-gradient(145deg,#1a2620,#0f1712)", border:"1px solid rgba(244,114,182,0.25)", borderRadius:"24px", boxShadow:"0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(244,114,182,0.06)" }}>

                    <div style={{ padding:"20px 24px", borderBottom:"1px solid rgba(52,211,153,0.1)", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#1a2620", borderRadius:"24px 24px 0 0", zIndex:1 }}>
                      <div>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:"17px", color:"#e8f5f0" }}>🚨 Report Details</div>
                        <div style={{ fontSize:"11px", color:"#4a7a68", marginTop:"2px" }}>Submitted {new Date(selectedReport.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                        <ReportStatusPill status={selectedReport.status} />
                        <button onClick={() => setSelectedReport(null)} style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:"8px", color:"#f87171", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                      </div>
                    </div>

                    <div style={{ padding:"24px" }}>
                      <div style={{ background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.15)", borderRadius:"14px", padding:"16px 18px", marginBottom:"20px" }}>
                        <div style={{ fontSize:"11px", fontWeight:700, color:"#f87171", letterSpacing:"0.08em", marginBottom:"10px" }}>REPORT INFORMATION</div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                          <div><div style={{ fontSize:"11px", color:"#6b9e8e", marginBottom:"3px" }}>Reason</div><div style={{ fontSize:"14px", fontWeight:700, color:"#fca5a5" }}>{selectedReport.reason}</div></div>
                          <div><div style={{ fontSize:"11px", color:"#6b9e8e", marginBottom:"3px" }}>Reported By</div><div style={{ fontSize:"14px", fontWeight:700, color:"#e8f5f0" }}>@{selectedReport.reporter?.username || "unknown"}{selectedReport.reporter?.is_verified && <span style={{ marginLeft:"6px", fontSize:"11px", color:"#34d399" }}>✓</span>}</div></div>
                        </div>
                        {selectedReport.details && (
                          <div style={{ marginTop:"12px" }}>
                            <div style={{ fontSize:"11px", color:"#6b9e8e", marginBottom:"3px" }}>Additional Details</div>
                            <div style={{ fontSize:"13px", color:"#9dbfb3", fontStyle:"italic", lineHeight:1.6 }}>"{selectedReport.details}"</div>
                          </div>
                        )}
                      </div>

                      <div style={{ background:"rgba(52,211,153,0.04)", border:"1px solid rgba(52,211,153,0.12)", borderRadius:"14px", padding:"16px 18px", marginBottom:"20px" }}>
                        <div style={{ fontSize:"11px", fontWeight:700, color:"#34d399", letterSpacing:"0.08em", marginBottom:"12px" }}>REPORTED ITEM</div>
                        <div style={{ display:"flex", gap:"14px", alignItems:"flex-start" }}>
                          <div style={{ width:"80px", height:"80px", borderRadius:"12px", background:"rgba(10,15,13,0.8)", border:"1px solid rgba(52,211,153,0.15)", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px" }}>
                            {selectedReport.item?.images?.[0] ? <img src={selectedReport.item.images[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "📦"}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:"16px", color:"#e8f5f0", marginBottom:"6px" }}>{selectedReport.item?.title || "Item no longer exists"}</div>
                            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"8px" }}>
                              {selectedReport.item?.category && <Tag label={selectedReport.item.category} color="#34d399" />}
                              {selectedReport.item?.condition && <Tag label={selectedReport.item.condition} color="#9dbfb3" />}
                              {selectedReport.item?.status && <Tag label={selectedReport.item.status} color={selectedReport.item.status==="active"?"#34d399":"#f87171"} />}
                            </div>
                            <div style={{ fontSize:"13px", color:"#6b9e8e", lineHeight:1.6 }}>{selectedReport.item?.description?.slice(0,200)}{(selectedReport.item?.description?.length||0)>200?"...":""}</div>
                            <div style={{ display:"flex", gap:"16px", marginTop:"8px" }}>
                              <span style={{ fontSize:"12px", color:"#4a7a68" }}>👁 {selectedReport.item?.views||0} views</span>
                              {selectedReport.item?.looking_for && <span style={{ fontSize:"12px", color:"#4a7a68" }}>🔄 {selectedReport.item.looking_for}</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedReport.item?.owner && (
                        <div style={{ background:"rgba(96,165,250,0.04)", border:"1px solid rgba(96,165,250,0.12)", borderRadius:"14px", padding:"16px 18px", marginBottom:"24px" }}>
                          <div style={{ fontSize:"11px", fontWeight:700, color:"#60a5fa", letterSpacing:"0.08em", marginBottom:"12px" }}>ITEM OWNER</div>
                          <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                            <div style={{ width:"44px", height:"44px", borderRadius:"12px", background:"rgba(96,165,250,0.12)", border:"1px solid rgba(96,165,250,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:"18px", color:"#60a5fa", flexShrink:0 }}>
                              {(selectedReport.item.owner.full_name||selectedReport.item.owner.username||"?")[0].toUpperCase()}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:700, color:"#e8f5f0", fontSize:"15px" }}>{selectedReport.item.owner.full_name||selectedReport.item.owner.username}{selectedReport.item.owner.is_verified && <span style={{ marginLeft:"6px", fontSize:"11px", color:"#34d399" }}>✓</span>}</div>
                              <div style={{ fontSize:"12px", color:"#6b9e8e", marginTop:"2px" }}>@{selectedReport.item.owner.username}{selectedReport.item.owner.city && " · 📍 "+selectedReport.item.owner.city}</div>
                              <div style={{ display:"flex", gap:"8px", marginTop:"6px" }}>
                                <Tag label={"⭐ "+(selectedReport.item.owner.rating||0)} color="#fbbf24" />
                                <Tag label={"🔄 "+(selectedReport.item.owner.total_swaps||0)+" swaps"} color="#60a5fa" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedReport.status === "pending" ? (
                        <div>
                          <div style={{ fontSize:"11px", fontWeight:700, color:"#6b9e8e", letterSpacing:"0.08em", marginBottom:"12px" }}>TAKE ACTION</div>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"10px" }}>
                            {[
                              { icon:"🗑️", label:"Delete Item",    sub:"Permanent",     onClick:()=>deleteReportedItem(selectedReport.item?.id,selectedReport.item?.title,selectedReport.id), bg:"rgba(248,113,113,0.12)", border:"rgba(248,113,113,0.3)", color:"#f87171" },
                              { icon:"🧊", label:"Freeze Item",    sub:"Hides from users", onClick:()=>freezeReportedItem(selectedReport.item?.id,selectedReport.item?.title,selectedReport.id), bg:"rgba(96,165,250,0.1)", border:"rgba(96,165,250,0.25)", color:"#60a5fa" },
                              { icon:"⚠️", label:"Warn Owner",     sub:"Log warning",   onClick:()=>warnOwner(selectedReport), bg:"rgba(251,191,36,0.08)", border:"rgba(251,191,36,0.2)", color:"#fbbf24" },
                              { icon:"✅", label:"Mark Resolved",  sub:"No action",     onClick:()=>resolveReport(selectedReport.id,selectedReport.item?.title), bg:"rgba(52,211,153,0.1)", border:"rgba(52,211,153,0.25)", color:"#34d399" },
                              { icon:"🚫", label:"Dismiss",        sub:"False report",  onClick:()=>dismissReport(selectedReport.id,selectedReport.item?.title), bg:"rgba(107,158,142,0.08)", border:"rgba(107,158,142,0.15)", color:"#6b9e8e" },
                            ].map(a => (
                              <button key={a.label} onClick={a.onClick}
                                style={{ padding:"14px 12px", background:a.bg, border:"1px solid "+a.border, borderRadius:"12px", color:a.color, fontWeight:700, fontSize:"13px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", textAlign:"center" }}>
                                <span style={{ fontSize:"22px" }}>{a.icon}</span>
                                <span>{a.label}</span>
                                <span style={{ fontSize:"10px", opacity:0.7, fontWeight:400 }}>{a.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign:"center", padding:"20px", background:"rgba(52,211,153,0.04)", borderRadius:"12px", border:"1px solid rgba(52,211,153,0.1)" }}>
                          <div style={{ fontSize:"24px", marginBottom:"8px" }}>{selectedReport.status==="resolved"?"✅":"🚫"}</div>
                          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#9dbfb3", fontSize:"14px" }}>This report has been {selectedReport.status}</div>
                          <button style={{ marginTop:"12px", ...D.ghostBtn, fontSize:"12px", padding:"8px 16px" }} onClick={() => setSelectedReport(null)}>Close</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYTICS ──────────────────────────────────────────────────── */}
          {activeSection === "analytics" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={D.card}>
                <div style={D.cardHead}><span style={D.cardTitle}>Platform Analytics</span></div>

                {/* Tab switcher */}
                <div style={D.tabRow}>
                  {[{key:"overall",label:"🌐 Overall"},{key:"user",label:"👥 Users"},{key:"charity",label:"🏥 Charity"}].map(t=>(
                    <button key={t.key} style={{ ...D.tab, ...(analyticsTab===t.key?D.tabActive:{}) }} onClick={()=>setAnalyticsTab(t.key)}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Filters */}
                <div style={D.filterRow}>
                  <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)} style={D.select}>
                    {[2023,2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={D.select}>
                    <option value="">All Months</option>
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=>(
                      <option key={m} value={i+1}>{m}</option>
                    ))}
                  </select>
                  {analyticsTab==="charity" && (
                    <select value={selectedCharityId} onChange={e=>setSelectedCharityId(e.target.value)} style={D.select}>
                      <option value="">All Charities</option>
                      {allCharities.filter(c=>c.status==="ACTIVE").map(c=>(
                        <option key={c.id} value={c.id}>{c.charity_name}</option>
                      ))}
                    </select>
                  )}
                  <button style={D.actionBtn} onClick={()=>{const d=analyticsTab==="overall"?overallAnalytics:analyticsTab==="user"?userAnalytics:charityAnalytics;exportCSV(d,`${analyticsTab}.csv`);}}>↓ CSV</button>
                  <button style={D.actionBtn} onClick={()=>{const d=analyticsTab==="overall"?overallAnalytics:analyticsTab==="user"?userAnalytics:charityAnalytics;exportPDF(d,`${analyticsTab} Analytics`);}}>↓ PDF</button>
                </div>

                {analyticsTab==="overall" && (overallAnalytics?<OverallTab data={overallAnalytics}/>:<ALoader/>)}
                {analyticsTab==="user"    && (userAnalytics?<UserTab data={userAnalytics}/>:<ALoader/>)}
                {analyticsTab==="charity" && (charityAnalytics?<CharityTab data={charityAnalytics} prediction={prediction}/>:<ALoader/>)}
              </div>
            </div>
          )}

          {/* ── ADMIN PERMISSIONS ──────────────────────────────────────────── */}
          {activeSection === "admins" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={D.card}>
                <div style={D.cardHead}><span style={D.cardTitle}>Admin Permissions</span></div>
                {admins.map(a => (
                  <div key={a.email} style={D.dataRow}>
                    <div style={{ ...D.avatar, background:"rgba(52,211,153,0.1)", color:"#34d399" }}>🔐</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:"#e8f5f0", fontSize:"14px" }}>{a.email}</div>
                      <div style={{ color:"#6b9e8e", fontSize:"12px", marginTop:"2px" }}>Role: {a.role}</div>
                    </div>
                    <button
                      style={{ ...D.actionBtn, background:a.is_active?"rgba(52,211,153,0.12)":"rgba(248,113,113,0.12)", color:a.is_active?"#34d399":"#f87171", border:`1px solid ${a.is_active?"rgba(52,211,153,0.25)":"rgba(248,113,113,0.25)"}`, cursor:"pointer" }}
                      onClick={()=>toggleAdminStatus(a.email,a.is_active)}>
                      {a.is_active?"ACTIVE":"INACTIVE"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LOGS ───────────────────────────────────────────────────────── */}
          {activeSection === "logs" && (
            <div style={{ animation:"fadeInUp 0.3s ease" }}>
              <div style={D.card}>
                <div style={D.cardHead}>
                  <span style={D.cardTitle}>Admin Activity Logs</span>
                  <button style={D.smallBtn} onClick={fetchLogs}>↻ Refresh</button>
                </div>
                {logs.length===0 && <EmptyState icon="📋" msg="No activity logs yet." />}
                {logs.map(log=>(
                  <div key={log.id} style={D.logRow}>
                    <div style={D.logDot} />
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"4px" }}>
                        <span style={{ fontWeight:700, color:"#9dbfb3", fontSize:"12px" }}>{log.performed_by||log.admin_email||"Admin"}</span>
                        <span style={{ fontSize:"11px", color:"#4a7a68" }}>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ marginTop:"3px", fontSize:"13px" }}>
                        <span style={{ color:"#34d399", fontWeight:700 }}>{log.action}</span>
                        {log.target&&<><span style={{ color:"#4a7a68" }}> → </span><em style={{ color:"#6b9e8e" }}>{log.target}</em></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ── HELPER COMPONENTS ────────────────────────────────────────────────────────

function ReportStatusPill({ status }) {
  const cfg = {
    pending:   { bg:"rgba(244,114,182,0.15)", color:"#f472b6", border:"rgba(244,114,182,0.3)", label:"PENDING"   },
    resolved:  { bg:"rgba(52,211,153,0.15)",  color:"#34d399", border:"rgba(52,211,153,0.3)",  label:"RESOLVED"  },
    dismissed: { bg:"rgba(107,158,142,0.15)", color:"#6b9e8e", border:"rgba(107,158,142,0.3)", label:"DISMISSED" },
  }[status] || { bg:"rgba(156,163,175,0.15)", color:"#9ca3af", border:"rgba(156,163,175,0.3)", label:status };
  return (
    <span style={{ fontSize:"10px", padding:"3px 10px", borderRadius:"999px", background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, fontWeight:800, letterSpacing:"0.06em", flexShrink:0 }}>
      {cfg.label}
    </span>
  );
}

function Tag({ label, color }) {
  return <span style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"999px", background:`${color}18`, color, fontWeight:600, border:`1px solid ${color}30` }}>{label}</span>;
}

function StatusPill({ status }) {
  const cfg = {
    ACTIVE:   { bg:"rgba(52,211,153,0.15)",  color:"#34d399", border:"rgba(52,211,153,0.3)" },
    PENDING:  { bg:"rgba(251,191,36,0.15)",  color:"#fbbf24", border:"rgba(251,191,36,0.3)" },
    FROZEN:   { bg:"rgba(96,165,250,0.15)",  color:"#60a5fa", border:"rgba(96,165,250,0.3)" },
    REJECTED: { bg:"rgba(248,113,113,0.15)", color:"#f87171", border:"rgba(248,113,113,0.3)" },
  }[status] || { bg:"rgba(156,163,175,0.15)", color:"#9ca3af", border:"rgba(156,163,175,0.3)" };
  return (
    <span style={{ fontSize:"11px", padding:"3px 10px", borderRadius:"999px", background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, fontWeight:800, letterSpacing:"0.05em" }}>
      {status}
    </span>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div style={{ textAlign:"center", padding:"40px 20px" }}>
      <div style={{ fontSize:"36px", marginBottom:"10px", opacity:0.5 }}>{icon}</div>
      <p style={{ color:"#4a7a68", fontSize:"13px" }}>{msg}</p>
    </div>
  );
}

function ALoader() {
  return (
    <div style={{ textAlign:"center", padding:"48px", color:"#4a7a68" }}>
      <div style={{ width:"36px", height:"36px", border:"3px solid rgba(52,211,153,0.2)", borderTopColor:"#34d399", borderRadius:"50%", margin:"0 auto 12px", animation:"spin 0.8s linear infinite" }} />
      Loading analytics...
    </div>
  );
}

function StatCard({ label, value, color="#34d399", bg="rgba(52,211,153,0.06)" }) {
  return (
    <div style={{ background:bg, border:`1px solid ${color}22`, borderRadius:"14px", padding:"18px 14px", textAlign:"center" }}>
      <div style={{ fontSize:"11px", color:"#6b9e8e", marginBottom:"8px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</div>
      <div style={{ fontSize:"26px", fontWeight:900, color, fontFamily:"'Syne',sans-serif" }}>{value??0}</div>
    </div>
  );
}

function ChartWrap({ title, children }) {
  return (
    <div style={{ marginBottom:"28px" }}>
      <h4 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"14px", color:"#9dbfb3", marginBottom:"14px", letterSpacing:"0.03em" }}>{title}</h4>
      {children}
    </div>
  );
}

// ── ANALYTICS TABS ───────────────────────────────────────────────────────────

function OverallTab({ data: d }) {
  const months = Array.from({length:12},(_,i)=>i+1);
  const mL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div>
      <div style={{ textAlign:"center", padding:"24px", background:"linear-gradient(135deg,rgba(52,211,153,0.08),rgba(16,185,129,0.04))", borderRadius:"16px", border:"1px solid rgba(52,211,153,0.15)", marginBottom:"24px" }}>
        <div style={{ fontSize:"11px", fontWeight:700, color:"#34d399", letterSpacing:"0.1em", marginBottom:"8px" }}>🌍 PLATFORM HEALTH SCORE</div>
        <div style={{ fontSize:"64px", fontWeight:900, color:"#34d399", fontFamily:"'Syne',sans-serif", lineHeight:1 }}>{d.healthScore}<span style={{ fontSize:"24px", color:"#6b9e8e" }}>/100</span></div>
        <div style={{ fontSize:"12px", color:"#6b9e8e", marginTop:"8px" }}>Active users · Swap success · Verified users · Charity activity</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <StatCard label="Users"     value={d.totalUsers}     color="#60a5fa" bg="rgba(96,165,250,0.08)"  />
        <StatCard label="Items"     value={d.totalItems}     color="#34d399" bg="rgba(52,211,153,0.08)"  />
        <StatCard label="Swaps"     value={d.totalSwaps}     color="#a78bfa" bg="rgba(167,139,250,0.08)" />
        <StatCard label="Charities" value={d.totalCharities} color="#fbbf24" bg="rgba(251,191,36,0.08)"  />
        <StatCard label="Messages"  value={d.totalMessages}  color="#22d3ee" bg="rgba(34,211,238,0.08)"  />
        <StatCard label="Reviews"   value={d.totalReviews}   color="#f472b6" bg="rgba(244,114,182,0.08)" />
        <StatCard label="Wishlists" value={d.totalWishlists} color="#34d399" bg="rgba(52,211,153,0.06)"  />
        <StatCard label="Donations" value={d.totalDonations} color="#f87171" bg="rgba(248,113,113,0.08)" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <StatCard label="Active Users"    value={d.activeUsers}      color="#34d399" />
        <StatCard label="Verified"        value={d.verifiedUsers}    color="#60a5fa" />
        <StatCard label="Success Rate"    value={`${d.swapSuccessRate}%`} color="#a78bfa" />
        <StatCard label="Active Charities"value={d.activeCharities}  color="#fbbf24" />
        <StatCard label="Pending"         value={d.pendingCharities} color="#f87171" />
        <StatCard label="Avg Rating"      value={d.avgRating}        color="#f472b6" />
      </div>
      {Object.keys(d.monthlyGrowth||{}).length>0&&(
        <ChartWrap title="📈 Monthly Growth Trend">
          <Line data={{ labels:mL, datasets:[
            {label:"Users",    data:months.map(m=>d.monthlyGrowth[m]?.users||0),    borderColor:"#60a5fa",tension:0.4,fill:false},
            {label:"Items",    data:months.map(m=>d.monthlyGrowth[m]?.items||0),    borderColor:"#34d399",tension:0.4,fill:false},
            {label:"Swaps",    data:months.map(m=>d.monthlyGrowth[m]?.swaps||0),    borderColor:"#a78bfa",tension:0.4,fill:false},
            {label:"Messages", data:months.map(m=>d.monthlyGrowth[m]?.messages||0), borderColor:"#22d3ee",tension:0.4,fill:false},
          ]}} options={chartDefaults} />
        </ChartWrap>
      )}
      {Object.keys(d.itemsByCategory||{}).length>0&&(
        <ChartWrap title="📦 Items by Category">
          <Doughnut data={{ labels:Object.keys(d.itemsByCategory), datasets:[{data:Object.values(d.itemsByCategory),backgroundColor:["#34d399","#60a5fa","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#10b981"]}] }}
            options={{responsive:true,plugins:{legend:{position:"right",labels:{color:"#9dbfb3",font:{family:"DM Sans"}}}}}} />
        </ChartWrap>
      )}
      {Object.keys(d.monthlyGrowth||{}).length===0&&<NoData/>}
    </div>
  );
}

function UserTab({ data: d }) {
  const months=Array.from({length:12},(_,i)=>i+1);
  const mL=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <StatCard label="Total Users"    value={d.totalUsers}    color="#60a5fa" bg="rgba(96,165,250,0.08)" />
        <StatCard label="New Users"      value={d.newUsers}      color="#34d399" bg="rgba(52,211,153,0.08)" />
        <StatCard label="Active"         value={d.activeUsers}   color="#34d399" />
        <StatCard label="Verified"       value={d.verifiedUsers} color="#a78bfa" />
        <StatCard label="Total Items"    value={d.totalItems}    color="#34d399" bg="rgba(52,211,153,0.08)" />
        <StatCard label="Total Views"    value={d.totalViews}    color="#22d3ee" />
        <StatCard label="Total Swaps"    value={d.totalSwaps}    color="#a78bfa" bg="rgba(167,139,250,0.08)" />
        <StatCard label="Completed"      value={d.completedSwaps}color="#34d399" />
        <StatCard label="Success Rate"   value={`${d.swapSuccessRate}%`}color="#34d399"/>
        <StatCard label="Avg Rating"     value={d.avgRating}     color="#f472b6" />
        <StatCard label="Reviews"        value={d.totalReviews}  color="#f472b6" />
        <StatCard label="Wishlists"      value={d.totalWishlists}color="#34d399" />
      </div>
      {Object.keys(d.registrationTrend||{}).length>0&&(
        <ChartWrap title="📈 User Registration Trend">
          <Bar data={{labels:mL,datasets:[{label:"New Registrations",data:months.map(m=>d.registrationTrend[m]||0),backgroundColor:"rgba(96,165,250,0.7)",borderRadius:6}]}} options={chartDefaults} />
        </ChartWrap>
      )}
      {Object.keys(d.swapTrend||{}).length>0&&(
        <ChartWrap title="🔄 Swap Activity Trend">
          <Line data={{labels:mL,datasets:[{label:"Swap Requests",data:months.map(m=>d.swapTrend[m]||0),borderColor:"#a78bfa",tension:0.4,fill:true,backgroundColor:"rgba(167,139,250,0.08)"}]}} options={chartDefaults} />
        </ChartWrap>
      )}
      {Object.keys(d.itemsByCategory||{}).length>0&&(
        <ChartWrap title="📦 Items by Category">
          <Bar data={{labels:Object.keys(d.itemsByCategory),datasets:[{label:"Items",data:Object.values(d.itemsByCategory),backgroundColor:"rgba(52,211,153,0.7)",borderRadius:6}]}} options={chartDefaults} />
        </ChartWrap>
      )}
      {Object.keys(d.topCities||{}).length>0&&(
        <ChartWrap title="🏙️ Top Cities">
          <Bar data={{labels:Object.keys(d.topCities),datasets:[{label:"Users",data:Object.values(d.topCities),backgroundColor:"rgba(34,211,238,0.7)",borderRadius:6}]}} options={chartDefaults} />
        </ChartWrap>
      )}
      {Object.keys(d.registrationTrend||{}).length===0&&<NoData/>}
    </div>
  );
}

function CharityTab({ data: d, prediction }) {
  const months=Array.from({length:12},(_,i)=>i+1);
  const mL=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"12px",marginBottom:"24px"}}>
        <StatCard label="Total Donations" value={d.totalDonations}  color="#34d399" bg="rgba(52,211,153,0.08)" />
        <StatCard label="Total Items"     value={d.totalItems}      color="#60a5fa" bg="rgba(96,165,250,0.08)" />
        <StatCard label="Approval Ratio"  value={`${d.approvalRatio}%`} color="#a78bfa" bg="rgba(167,139,250,0.08)" />
        <StatCard label="Trust Score"     value={d.trustScore}      color="#fbbf24" bg="rgba(251,191,36,0.08)" />
      </div>
      {Object.keys(d.categoryCount||{}).length>0?(
        <>
          <ChartWrap title="📦 Category-wise Donations">
            <Bar data={{labels:Object.keys(d.categoryCount),datasets:[{label:"Donations",data:Object.values(d.categoryCount),backgroundColor:"rgba(52,211,153,0.7)",borderRadius:6}]}} options={chartDefaults} />
          </ChartWrap>
          <ChartWrap title="📈 Monthly Donation Trend">
            <Line data={{labels:mL,datasets:[{label:"Monthly Trend",data:months.map(m=>d.monthlyTrend?.[m]||0),borderColor:"#34d399",tension:0.4,fill:true,backgroundColor:"rgba(52,211,153,0.06)"}]}} options={chartDefaults} />
          </ChartWrap>
        </>
      ):<NoData/>}
      <div style={{background:"rgba(52,211,153,0.04)",border:"1px solid rgba(52,211,153,0.12)",borderRadius:"14px",padding:"20px",marginBottom:"20px"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:"14px",color:"#34d399",marginBottom:"12px"}}>🔐 Trust Score Formula</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
          {[["Approval Ratio","% of completed donations"],["Item Volume","Higher donations = higher trust"],["Consistency","Regular monthly donations"],["Admin Reviews","Rejections reduce score"]].map(([t,d])=>(
            <div key={t} style={{background:"rgba(10,15,13,0.5)",borderRadius:"10px",padding:"10px 12px"}}>
              <div style={{fontWeight:700,color:"#9dbfb3",fontSize:"12px",marginBottom:"2px"}}>{t}</div>
              <div style={{color:"#4a7a68",fontSize:"11px"}}>{d}</div>
            </div>
          ))}
        </div>
      </div>
      {prediction?.futureMonths&&(
        <ChartWrap title="🔮 Predicted Donation Trend">
          <Line data={{labels:prediction.futureMonths.map(m=>`Month ${m}`),datasets:[{label:"Predicted",data:prediction.predictedCounts,borderColor:"#fbbf24",borderDash:[6,6],tension:0.4}]}} options={chartDefaults} />
        </ChartWrap>
      )}
    </div>
  );
}

function NoData() {
  return (
    <div style={{textAlign:"center",padding:"48px",background:"rgba(52,211,153,0.03)",borderRadius:"14px",border:"1px dashed rgba(52,211,153,0.12)"}}>
      <div style={{fontSize:"40px",marginBottom:"12px",opacity:0.4}}>📭</div>
      <p style={{color:"#4a7a68",fontSize:"13px"}}>No data for this period. Charts appear once activity is recorded.</p>
    </div>
  );
}

// ── DASHBOARD STYLES ─────────────────────────────────────────────────────────
const D = {
  root:       { display:"flex", minHeight:"100vh", background:"#0a0f0d", fontFamily:"'DM Sans',sans-serif", position:"relative", overflow:"hidden" },
  toast:      { position:"fixed", top:"20px", right:"20px", zIndex:9999, padding:"12px 18px", borderRadius:"12px", border:"1px solid", fontSize:"13px", fontWeight:600, backdropFilter:"blur(12px)", boxShadow:"0 8px 32px rgba(0,0,0,0.4)", animation:"fadeInUp 0.3s ease", display:"flex", alignItems:"center", gap:"8px" },
  sidebar:    { height:"100vh", position:"sticky", top:0, background:"linear-gradient(180deg,#0f1712,#0a0f0d)", borderRight:"1px solid rgba(52,211,153,0.1)", display:"flex", flexDirection:"column", transition:"width 0.25s ease", overflow:"hidden", flexShrink:0, zIndex:10 },
  sidebarTop: { padding:"20px 14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(52,211,153,0.08)", minHeight:"72px" },
  sideLogoBox:{ width:"36px", height:"36px", borderRadius:"10px", background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  sideTitle:  { fontFamily:"'Syne',sans-serif", fontSize:"15px", fontWeight:800, color:"#e8f5f0", letterSpacing:"-0.3px" },
  sideSub:    { fontSize:"10px", color:"#4a7a68", fontWeight:600, letterSpacing:"0.08em" },
  toggleBtn:  { background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"8px", color:"#34d399", width:"28px", height:"28px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", flexShrink:0 },
  navItem:    { display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px", border:"none", background:"transparent", color:"#6b9e8e", cursor:"pointer", transition:"background 0.15s, color 0.15s", width:"100%", textAlign:"left", position:"relative", whiteSpace:"nowrap", overflow:"hidden" },
  navItemActive:{ background:"rgba(52,211,153,0.12)", color:"#34d399", border:"1px solid rgba(52,211,153,0.2)" },
  navBadge:   { background:"#f87171", color:"white", borderRadius:"999px", padding:"1px 7px", fontSize:"10px", fontWeight:800, flexShrink:0 },
  logoutBtn:  { display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px", border:"1px solid rgba(248,113,113,0.2)", background:"rgba(248,113,113,0.06)", color:"#f87171", cursor:"pointer", width:"100%", whiteSpace:"nowrap", overflow:"hidden" },
  main:       { flex:1, overflowY:"auto", overflowX:"hidden" },
  topbar:     { position:"sticky", top:0, zIndex:5, padding:"16px 28px", background:"rgba(10,15,13,0.9)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(52,211,153,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center" },
  pageTitle:  { fontFamily:"'Syne',sans-serif", fontSize:"20px", fontWeight:800, color:"#e8f5f0", letterSpacing:"-0.5px", margin:0 },
  pageSub:    { fontSize:"11px", color:"#4a7a68", marginTop:"2px", fontWeight:500 },
  adminChip:  { display:"flex", alignItems:"center", gap:"8px", padding:"6px 14px", background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"999px" },
  adminDot:   { width:"7px", height:"7px", borderRadius:"50%", background:"#34d399", animation:"pulse-green 2s infinite" },
  errBar:     { margin:"16px 28px", padding:"12px 16px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:"10px", color:"#fca5a5", fontSize:"13px", fontWeight:600 },
  statsRow:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"16px", marginBottom:"24px" },
  overviewCard:{ padding:"24px 20px", borderRadius:"18px", textAlign:"center", cursor:"default", transition:"transform 0.2s" },
  card:       { background:"linear-gradient(145deg,rgba(26,38,32,0.8),rgba(20,31,24,0.6))", border:"1px solid rgba(52,211,153,0.12)", borderRadius:"20px", padding:"24px", marginBottom:"20px", backdropFilter:"blur(8px)" },
  cardHead:   { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" },
  cardTitle:  { fontFamily:"'Syne',sans-serif", fontSize:"16px", fontWeight:800, color:"#e8f5f0" },
  countBadge: { background:"rgba(52,211,153,0.1)", color:"#34d399", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"999px", padding:"3px 10px", fontSize:"11px", fontWeight:700 },
  smallBtn:   { background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"8px", color:"#34d399", padding:"6px 12px", cursor:"pointer", fontSize:"12px", fontWeight:600 },
  searchRow:  { display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" },
  searchWrap: { flex:1, position:"relative", minWidth:"200px" },
  searchIcon: { position:"absolute", left:"13px", top:"50%", transform:"translateY(-50%)", fontSize:"14px", pointerEvents:"none" },
  searchInput:{ width:"100%", padding:"10px 14px 10px 38px", background:"rgba(10,15,13,0.8)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"10px", color:"#e8f5f0", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", outline:"none" },
  actionBtn:  { padding:"10px 16px", background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.25)", borderRadius:"10px", color:"#34d399", fontWeight:700, fontSize:"13px", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" },
  ghostBtn:   { padding:"10px 16px", background:"transparent", border:"1px solid rgba(52,211,153,0.12)", borderRadius:"10px", color:"#6b9e8e", fontWeight:600, fontSize:"13px", cursor:"pointer", whiteSpace:"nowrap" },
  dangerBtn:  { padding:"8px 14px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:"10px", color:"#f87171", fontWeight:700, fontSize:"12px", cursor:"pointer", whiteSpace:"nowrap" },
  dataRow:    { display:"flex", alignItems:"center", gap:"14px", padding:"14px 0", borderBottom:"1px solid rgba(52,211,153,0.06)" },
  avatar:     { width:"40px", height:"40px", borderRadius:"12px", background:"rgba(96,165,250,0.12)", color:"#60a5fa", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:"16px", flexShrink:0, border:"1px solid rgba(96,165,250,0.2)" },
  approvalCard:{ padding:"18px", background:"rgba(10,15,13,0.5)", borderRadius:"14px", border:"1px solid rgba(251,191,36,0.15)", marginBottom:"12px" },
  approveBtn: { padding:"10px 18px", background:"rgba(52,211,153,0.15)", border:"1px solid rgba(52,211,153,0.3)", borderRadius:"10px", color:"#34d399", fontWeight:700, fontSize:"13px", cursor:"pointer" },
  rejectBtn:  { padding:"10px 18px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:"10px", color:"#f87171", fontWeight:700, fontSize:"13px", cursor:"pointer" },
  tabRow:     { display:"flex", gap:"6px", marginBottom:"20px", background:"rgba(10,15,13,0.5)", padding:"4px", borderRadius:"12px", width:"fit-content" },
  tab:        { padding:"9px 18px", borderRadius:"9px", border:"none", background:"transparent", color:"#6b9e8e", fontWeight:700, fontSize:"13px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"background 0.15s, color 0.15s" },
  tabActive:  { background:"rgba(52,211,153,0.15)", color:"#34d399", border:"1px solid rgba(52,211,153,0.25)" },
  filterRow:  { display:"flex", gap:"8px", marginBottom:"24px", flexWrap:"wrap", alignItems:"center" },
  select:     { padding:"9px 14px", background:"rgba(10,15,13,0.8)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"10px", color:"#9dbfb3", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", outline:"none" },
  alertCard:  { display:"flex", alignItems:"center", gap:"14px", padding:"18px 20px", background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:"16px", cursor:"pointer", marginTop:"16px" },
  logRow:     { display:"flex", gap:"12px", alignItems:"flex-start", padding:"12px 0", borderBottom:"1px solid rgba(52,211,153,0.06)" },
  logDot:     { width:"8px", height:"8px", borderRadius:"50%", background:"#34d399", marginTop:"5px", flexShrink:0, boxShadow:"0 0 6px rgba(52,211,153,0.5)" },
};
