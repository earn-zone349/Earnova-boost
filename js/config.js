// ───────────────────────────────────────────────────────────────
//  এই একটাই ফাইল তোমাকে বদলাতে হবে।
//  Supabase → Project Settings → API থেকে নিচের দুটো মান বসাও।
//  (anon key গোপন না — ওয়েবসাইটে থাকাই নিয়ম। service_role key কখনো এখানে দেবে না!)
// ───────────────────────────────────────────────────────────────
window.BOOST_CONFIG = {
  SUPABASE_URL: 'https://koocdqhcnjktolniwnlw.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvb2NkcWhjbmprdG9sbml3bmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4ODYxNjYsImV4cCI6MjEwOTQ2MjE2Nn0.YkZLT5yHe_mTsyTuOhHvl45x-dGDH6KtDiMBx2C6FTs',
  // Cloudflare Turnstile (বট আটকানো) — পরে চাইলে Site Key বসাবে, এখন খালি রাখলেও চলবে
  TURNSTILE_SITE_KEY: '',
};
