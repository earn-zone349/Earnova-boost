// ───────────────────────────────────────────────────────────────
//  এই একটাই ফাইল তোমাকে বদলাতে হবে।
//  Supabase → Project Settings → API থেকে নিচের দুটো মান বসাও।
//  (anon key গোপন না — ওয়েবসাইটে থাকাই নিয়ম। service_role key কখনো এখানে দেবে না!)
// ───────────────────────────────────────────────────────────────
window.BOOST_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_PUBLIC_KEY',
  // Cloudflare Turnstile (বট আটকানো) — পরে চাইলে Site Key বসাবে, এখন খালি রাখলেও চলবে
  TURNSTILE_SITE_KEY: '',
};
