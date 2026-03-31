"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ALLOWED_ADMINS = [
  "bhadanerupesh0249@gmail.com",
  "janhavithoke1@gmail.com",
  "rutikyadav2004@gmail.com",
  "pirjademl7@gmail.com"
];

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export default function AdminLogin() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [otp,      setOtp]      = useState("");
  const [otpSent,  setOtpSent]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [err,      setErr]      = useState("");

  const verifyAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user session");
    const { data: admin } = await supabase
      .from("admins").select("*").eq("email", user.email).single();
    if (!admin || !admin.approved || !admin.is_active) {
      await supabase.auth.signOut();
      throw new Error("Admin access denied");
    }
    router.push("/admin/dashboard");
  };

  const handlePasswordLogin = async () => {
    setErr("");
    if (!ALLOWED_ADMINS.includes(email.trim())) {
      setErr("This email is not authorised as an admin."); return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const generatedOtp = generateOtp();
      const { error: otpError } = await supabase.from("admin_otps").upsert({
        email: email.trim(), otp: generatedOtp,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });
      if (otpError) { setErr("Failed to generate OTP. Try again."); return; }
      await fetch("/api/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: generatedOtp })
      });
      console.log("ADMIN OTP:", generatedOtp);
      setOtpSent(true);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setErr("");
    try {
      setLoading(true);
      const { data, error } = await supabase.from("admin_otps").select("*")
        .eq("email", email.trim()).eq("otp", otp.trim())
        .gte("expires_at", new Date().toISOString()).single();
      if (error || !data) { setErr("Invalid or expired OTP."); return; }
      await supabase.from("admin_otps").delete().eq("email", email.trim());
      await verifyAdminAccess();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={LS.wrap}>
      {/* Decorative background circles */}
      <div style={LS.orb1} />
      <div style={LS.orb2} />
      <div style={LS.orb3} />

      <div style={LS.card}>
        {/* Top accent line */}
        <div style={LS.topLine} />

        {/* Logo block */}
        <div style={LS.logoBlock}>
          <div style={LS.logoRing}>
            <img src="/ecoswap-logo.png" alt="EcoSwap" style={{ width:"52px", height:"auto" }} />
          </div>
          <div>
            <div style={LS.logoTitle}>EcoSwap</div>
            <div style={LS.logoBadge}>ADMIN PORTAL</div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom:"28px" }}>
          <h1 style={LS.heading}>
            {otpSent ? "Enter your OTP" : "Welcome back"}
          </h1>
          <p style={LS.subheading}>
            {otpSent
              ? `A 6-digit code was sent to ${email}`
              : "Sign in to manage the EcoSwap platform"}
          </p>
        </div>

        {/* Step indicator */}
        <div style={LS.steps}>
          <div style={{ ...LS.step, ...(otpSent ? LS.stepDone : LS.stepActive) }}>
            <span style={LS.stepNum}>{otpSent ? "✓" : "1"}</span>
            <span style={LS.stepLabel}>Credentials</span>
          </div>
          <div style={LS.stepLine} />
          <div style={{ ...LS.step, ...(!otpSent ? LS.stepInactive : LS.stepActive) }}>
            <span style={LS.stepNum}>2</span>
            <span style={LS.stepLabel}>OTP Verify</span>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div style={LS.errBox}>
            <span style={{ fontSize:"15px" }}>⚠</span> {err}
          </div>
        )}

        {/* Fields */}
        {!otpSent ? (
          <>
            <div style={LS.fieldWrap}>
              <label style={LS.label}>Email Address</label>
              <div style={LS.inputWrap}>
                <span style={LS.inputIcon}>✉</span>
                <input
                  type="email" placeholder="admin@ecoswap.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handlePasswordLogin()}
                  style={LS.input} />
              </div>
            </div>
            <div style={LS.fieldWrap}>
              <label style={LS.label}>Password</label>
              <div style={LS.inputWrap}>
                <span style={LS.inputIcon}>🔒</span>
                <input
                  type={showPass ? "text" : "password"} placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handlePasswordLogin()}
                  style={{ ...LS.input, paddingRight:"44px" }} />
                <button onClick={() => setShowPass(p=>!p)} style={LS.eyeBtn}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            <button onClick={handlePasswordLogin} disabled={loading} style={LS.primaryBtn}>
              {loading
                ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                    <span style={LS.spinner} /> Authenticating...
                  </span>
                : "Login & Send OTP →"}
            </button>
          </>
        ) : (
          <>
            <div style={LS.fieldWrap}>
              <label style={LS.label}>6-Digit OTP Code</label>
              <input
                type="text" placeholder="_ _ _ _ _ _" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,""))}
                onKeyDown={e => e.key==="Enter" && handleVerifyOtp()}
                style={{ ...LS.input, textAlign:"center", fontSize:"22px", letterSpacing:"12px", fontWeight:800 }} />
            </div>
            <button onClick={handleVerifyOtp} disabled={loading} style={LS.primaryBtn}>
              {loading
                ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                    <span style={LS.spinner} /> Verifying...
                  </span>
                : "Verify & Enter Dashboard →"}
            </button>
            <button onClick={() => { setOtpSent(false); setOtp(""); setErr(""); }} style={LS.ghostBtn}>
              ← Back to login
            </button>
          </>
        )}

        {/* Footer */}
        <div style={LS.footer}>
          <span style={{ width:"20px", height:"1px", background:"rgba(52,211,153,0.2)", display:"inline-block" }} />
          <span style={{ fontSize:"11px", color:"#4a7a68", letterSpacing:"0.08em" }}>SECURED · ENCRYPTED · MONITORED</span>
          <span style={{ width:"20px", height:"1px", background:"rgba(52,211,153,0.2)", display:"inline-block" }} />
        </div>
      </div>
    </div>
  );
}

const LS = {
  wrap: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0f0d", position:"relative", overflow:"hidden", padding:"20px" },
  orb1: { position:"absolute", top:"-20%", left:"-10%", width:"600px", height:"600px", borderRadius:"50%", background:"radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)", pointerEvents:"none" },
  orb2: { position:"absolute", bottom:"-20%", right:"-10%", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)", pointerEvents:"none" },
  orb3: { position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"800px", height:"800px", borderRadius:"50%", background:"radial-gradient(circle, rgba(52,211,153,0.03) 0%, transparent 60%)", pointerEvents:"none" },
  card: { position:"relative", zIndex:1, width:"100%", maxWidth:"420px", background:"linear-gradient(145deg, #1a2620, #141f18)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"28px", padding:"40px 36px", boxShadow:"0 0 0 1px rgba(52,211,153,0.06), 0 32px 80px rgba(0,0,0,0.7), 0 0 80px rgba(52,211,153,0.05)", animation:"fadeInUp 0.5s ease" },
  topLine: { position:"absolute", top:0, left:"10%", right:"10%", height:"1px", background:"linear-gradient(90deg, transparent, rgba(52,211,153,0.6), transparent)" },
  logoBlock: { display:"flex", alignItems:"center", gap:"14px", marginBottom:"32px" },
  logoRing: { width:"64px", height:"64px", borderRadius:"18px", background:"linear-gradient(135deg,rgba(52,211,153,0.15),rgba(16,185,129,0.08))", border:"1px solid rgba(52,211,153,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  logoTitle: { fontFamily:"'Syne',sans-serif", fontSize:"20px", fontWeight:800, color:"#e8f5f0", letterSpacing:"-0.5px" },
  logoBadge: { fontSize:"10px", fontWeight:700, letterSpacing:"0.15em", color:"#34d399", background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"4px", padding:"2px 8px", marginTop:"4px", display:"inline-block" },
  heading: { fontFamily:"'Syne',sans-serif", fontSize:"26px", fontWeight:800, color:"#e8f5f0", letterSpacing:"-0.8px", marginBottom:"6px" },
  subheading: { fontSize:"13px", color:"#6b9e8e", lineHeight:1.5 },
  steps: { display:"flex", alignItems:"center", gap:"0", marginBottom:"24px" },
  step: { display:"flex", alignItems:"center", gap:"8px", flex:1 },
  stepActive: { opacity:1 },
  stepDone: { opacity:1 },
  stepInactive: { opacity:0.35 },
  stepNum: { width:"26px", height:"26px", borderRadius:"50%", background:"rgba(52,211,153,0.15)", border:"1px solid rgba(52,211,153,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:800, color:"#34d399", flexShrink:0 },
  stepLabel: { fontSize:"12px", fontWeight:600, color:"#9dbfb3" },
  stepLine: { flex:1, height:"1px", background:"rgba(52,211,153,0.15)", margin:"0 8px" },
  errBox: { display:"flex", alignItems:"center", gap:"8px", padding:"11px 14px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:"10px", marginBottom:"16px", fontSize:"13px", color:"#fca5a5", fontWeight:500 },
  fieldWrap: { marginBottom:"16px" },
  label: { display:"block", fontSize:"11px", fontWeight:700, letterSpacing:"0.08em", color:"#6b9e8e", marginBottom:"8px", textTransform:"uppercase" },
  inputWrap: { position:"relative", display:"flex", alignItems:"center" },
  inputIcon: { position:"absolute", left:"14px", fontSize:"14px", pointerEvents:"none", zIndex:1 },
  input: { width:"100%", padding:"13px 16px 13px 40px", background:"rgba(10,15,13,0.8)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"12px", color:"#e8f5f0", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", outline:"none", transition:"border-color 0.2s, box-shadow 0.2s" },
  eyeBtn: { position:"absolute", right:"12px", background:"none", border:"none", cursor:"pointer", fontSize:"14px", color:"#6b9e8e", padding:"4px" },
  primaryBtn: { width:"100%", padding:"14px", background:"linear-gradient(135deg, #10b981, #059669)", color:"white", border:"none", borderRadius:"14px", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"14px", cursor:"pointer", marginBottom:"10px", transition:"transform 0.15s, box-shadow 0.15s", boxShadow:"0 4px 24px rgba(16,185,129,0.4)", letterSpacing:"0.2px" },
  ghostBtn: { width:"100%", padding:"12px", background:"transparent", color:"#6b9e8e", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"12px", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:"13px", cursor:"pointer", transition:"border-color 0.2s, color 0.2s" },
  footer: { display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", marginTop:"28px" },
  spinner: { width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"white", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" },
};
