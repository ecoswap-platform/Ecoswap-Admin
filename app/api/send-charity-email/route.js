/**
 * POST /api/send-charity-email
 *
 * Called by the Admin Dashboard after approving/rejecting a charity.
 * Does two things:
 *   1. Updates public.users (is_active, is_verified, role) using service role key
 *      — works correctly because we look up the user by email via auth.admin API
 *   2. Sends the approval/rejection email via nodemailer (Gmail SMTP)
 *
 * No shared secret needed between admin and ecoswap.
 * Admin panel has SUPABASE_SERVICE_ROLE_KEY so it can do both.
 *
 * Body: { type, charityName, email, reason? }
 */

import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SITE_URL     = process.env.NEXT_PUBLIC_ECOSWAP_URL ?? "https://ecoswap.in";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req) {
  try {
    const { type, charityName, email, reason } = await req.json();

    if (!type || !email || !charityName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const isApproved = type === "approved";

    // ── 1. Update public.users via service role ──────────────────────────────
    const admin = getAdminSupabase();
    if (admin) {
      try {
        // Find the auth user ID by email
        const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const authUser = authList?.users?.find(u => u.email === email);

        if (authUser?.id) {
          await admin.from("users")
            .update({
              is_active:   isApproved,
              is_verified: isApproved,
              role:        isApproved ? "charity" : "charity",  // keep as charity even if rejected
            })
            .eq("id", authUser.id);
          console.log(`[send-charity-email] users table updated for ${email} → is_active: ${isApproved}`);
        } else {
          console.warn(`[send-charity-email] No auth user found for email: ${email}`);
        }
      } catch (dbErr) {
        console.warn("[send-charity-email] users update failed:", dbErr.message);
        // Non-fatal — continue with email
      }
    }

    // ── 2. Send email via Gmail SMTP ─────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const subject = isApproved
      ? `🎉 Your EcoSwap Charity Account Has Been Approved — ${charityName}`
      : `Update on Your EcoSwap Charity Registration — ${charityName}`;

    const html = isApproved
      ? `
        <div style="font-family:-apple-system,Arial,sans-serif;max-width:580px;margin:0 auto;background:#f9fafb;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#052e1a,#16a34a);padding:32px 28px;text-align:center;">
            <div style="font-size:48px;margin-bottom:10px;">🎉</div>
            <h1 style="color:white;font-size:24px;margin:0 0 8px;font-weight:900;">You're Approved!</h1>
            <p style="color:rgba(255,255,255,.85);margin:0;font-size:15px;">Welcome to EcoSwap, <strong>${charityName}</strong></p>
          </div>
          <div style="background:white;padding:32px 28px;">
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
              Your charity account has been reviewed and <strong style="color:#16a34a;">approved</strong>. 
              You can now log in and start creating donation campaigns.
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 24px;">
              <p style="color:#15803d;font-size:13px;font-weight:700;margin:0 0 10px;text-transform:uppercase;letter-spacing:.5px;">What you can do now</p>
              <p style="color:#166534;font-size:13px;margin:5px 0;">📢 Post donation campaigns to thousands of users</p>
              <p style="color:#166534;font-size:13px;margin:5px 0;">💬 Receive messages &amp; donations directly</p>
              <p style="color:#166534;font-size:13px;margin:5px 0;">📊 Track your charity's impact</p>
            </div>
            <div style="text-align:center;">
              <a href="${SITE_URL}/login" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#166534);color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 4px 14px rgba(22,163,74,.3);">
                Go to My Dashboard →
              </a>
            </div>
          </div>
          <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">EcoSwap · ecoswap.in · Pune, Maharashtra</p>
          </div>
        </div>`
      : `
        <div style="font-family:-apple-system,Arial,sans-serif;max-width:580px;margin:0 auto;background:#f9fafb;border-radius:16px;overflow:hidden;">
          <div style="background:#1f2937;padding:32px 28px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">😔</div>
            <h1 style="color:white;font-size:22px;margin:0 0 8px;font-weight:900;">Application Update</h1>
            <p style="color:rgba(255,255,255,.7);margin:0;font-size:14px;">${charityName}</p>
          </div>
          <div style="background:white;padding:32px 28px;">
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 18px;">
              Thank you for registering on EcoSwap. After reviewing your application, 
              we were <strong>unable to approve</strong> your charity account at this time.
            </p>
            ${reason ? `
            <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
              <p style="color:#92400e;font-size:13px;font-weight:700;margin:0 0 4px;">Reason:</p>
              <p style="color:#92400e;font-size:13px;margin:0;line-height:1.6;">${reason}</p>
            </div>` : ""}
            <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 20px;">
              If you believe this was a mistake or would like to provide more information, 
              please <a href="${SITE_URL}/contact" style="color:#16a34a;font-weight:700;">contact our team</a>.
            </p>
          </div>
          <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">EcoSwap · ecoswap.in</p>
          </div>
        </div>`;

    await transporter.sendMail({
      from: `"EcoSwap" <${process.env.SMTP_EMAIL}>`,
      to:   email,
      subject,
      html,
    });

    console.log(`[send-charity-email] ✅ ${type} email sent to ${email}`);
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[send-charity-email] ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
