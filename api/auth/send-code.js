import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const gmailUser = (process.env.GMAIL_USER || '').trim();
  const gmailPassRaw = (process.env.GMAIL_APP_PASSWORD || '').trim();
  const gmailPass = gmailPassRaw.replace(/\s/g, "");

  if (!gmailUser || !gmailPass) {
    console.warn("Email credentials missing. SMTP transporter not initialized.");
    return null;
  }

  transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });

  return transporter;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const gmailUser = (process.env.GMAIL_USER || '').trim();
  const gmailPassRaw = (process.env.GMAIL_APP_PASSWORD || '').trim();
  const gmailPass = gmailPassRaw.replace(/\s/g, "");
  const mailer = getTransporter();

  // Diagnostic check for environment variables
  if (!mailer || !gmailUser || !gmailPass) {
    console.error("Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables");
    return res.status(500).json({
      error: "Server configuration error: Email credentials not found. Please set GMAIL_USER and GMAIL_APP_PASSWORD in the Settings menu (Secrets)."
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  try {
    console.log(`Attempting to send verification code to ${email}`);

    // Store code in Supabase
    try {
      const { error } = await supabase
        .from('verification_codes')
        .upsert({
          id: email,
          code,
          expiresAt,
        });
      if (error) throw error;
      console.log("Code stored in Supabase successfully");
    } catch (dbError) {
      console.error("Supabase Error storing code:", dbError);
      return res.status(500).json({
        error: "Database error: Failed to store verification code.",
        diagnostic: "Supabase write failed. Check your database configuration.",
        details: dbError.message
      });
    }

    // Send Email
    await mailer.sendMail({
      from: `"Epimetheus Security" <${gmailUser}>`,
      to: email,
      subject: "Your Verification Code",
      text: `Your verification code is: ${code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white; border-radius: 10px;">
          <h2 style="color: #38bdf8;">Epimetheus Verification</h2>
          <p>Use the following code to complete your registration:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 20px; background: rgba(255,255,255,0.05); text-align: center; border-radius: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 12px;">This code will expire in 10 minutes.</p>
        </div>
      `,
    });

    res.json({ success: true, message: "Verification code sent successfully" });
  } catch (error) {
    console.error("Error sending verification code:", error);
    res.status(500).json({
      error: "Failed to send verification code",
      details: error.message
    });
  }
}