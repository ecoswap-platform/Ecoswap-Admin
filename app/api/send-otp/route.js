import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { email, otp } = await req.json();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: `"EcoSwap Admin" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Your EcoSwap Admin OTP",
      text: `Your EcoSwap Admin OTP is ${otp}. It is valid for 5 minutes.`,
      html: `
        <h2>EcoSwap Admin Login</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This OTP is valid for <b>5 minutes</b>.</p>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("OTP EMAIL ERROR:", error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
