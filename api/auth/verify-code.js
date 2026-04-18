import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: "Email and token are required" });

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) throw error;

    res.json({ success: true, message: "OTP verified successfully", user: data.user });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      error: "Failed to verify OTP",
      details: error.message
    });
  }
}