import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

  try {
    const { data, error } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('id', email)
      .single();

    if (error || !data) {
      return res.status(400).json({ error: "No verification code found for this email" });
    }

    if (data.code !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    if (Date.now() > data.expiresAt) {
      return res.status(400).json({ error: "Verification code has expired" });
    }

    // Code is valid, delete it from Supabase
    await supabase
      .from('verification_codes')
      .delete()
      .eq('id', email);

    res.json({ success: true, message: "Code verified successfully" });
  } catch (error) {
    console.error("Error verifying code:", error);
    res.status(500).json({
      error: "Failed to verify code",
      details: error.message
    });
  }
}