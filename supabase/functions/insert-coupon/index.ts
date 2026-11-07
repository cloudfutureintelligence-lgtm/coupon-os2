// Supabase Edge Function: insert-coupon
// POST https://ckmmidhudgkdhnocyruq.supabase.co/functions/v1/insert-coupon
// Headers: { "x-api-key": "couponosMain" }
// Body:
// {
//   "site_name": "RAMlA CAMP",
//   "codes": [
//     { "code": "1234567890", "profile_name": "30-Days" },
//     { "code": "123456780",  "profile_name": "1-Day"   }
//   ]
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_SECRET_KEY    = Deno.env.get("INSERT_COUPON_API_KEY") ?? "couponosMain";

const uid = () => "id-" + Date.now() + "-" + Math.floor(Math.random() * 10000);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
      },
    });
  }

  if (req.method !== "POST") return json({ error: "Only POST allowed" }, 405);

  // ── Auth ────────────────────────────────────────────────────
  if (req.headers.get("x-api-key") !== API_SECRET_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Parse body ──────────────────────────────────────────────
  let body: { site_name?: string; codes?: { code: string; profile_name: string }[] };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  const { site_name, codes } = body;

  if (!site_name || !codes || !Array.isArray(codes) || codes.length === 0) {
    return json({ error: "Missing required fields: site_name, codes (array)" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Find site by name (case-insensitive) ─────────────────────
  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .ilike("name", site_name.trim())
    .maybeSingle();

  if (!site) return json({ error: `Site not found: "${site_name}"` }, 404);

  // ── Load all profiles once ───────────────────────────────────
  const { data: allProfiles } = await supabase
    .from("coupon_profiles")
    .select("id, name, sale_price, cost_price");

  const profileMap = new Map(
    (allProfiles ?? []).map((p: any) => [p.name.toLowerCase(), p])
  );

  // ── Load site_prices overrides for this site ─────────────────
  const { data: sitePrices } = await supabase
    .from("site_prices")
    .select("profile_id, sale_price, cost_price")
    .eq("site_id", site.id);

  const sitePriceMap = new Map(
    (sitePrices ?? []).map((sp: any) => [sp.profile_id, sp])
  );

  // ── Process each code ────────────────────────────────────────
  const results: any[] = [];

  for (const item of codes) {
    const code        = item.code?.trim();
    const profileName = item.profile_name?.trim();

    if (!code || !profileName) {
      results.push({ code, status: "skipped", reason: "Missing code or profile_name" });
      continue;
    }

    // Find profile
    const profile = profileMap.get(profileName.toLowerCase());
    if (!profile) {
      results.push({ code, status: "failed", reason: `Profile not found: "${profileName}"` });
      continue;
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("coupons")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (existing) {
      results.push({ code, status: "duplicate", reason: "Code already exists" });
      continue;
    }

    // Insert — use site_prices override if available, fallback to profile defaults
    const priceOverride = sitePriceMap.get(profile.id);
    const effectiveSalePrice = priceOverride ? priceOverride.sale_price : profile.sale_price;
    const effectiveCostPrice = priceOverride ? priceOverride.cost_price : profile.cost_price;

    const newId = uid();
    const { data: inserted, error: insertError } = await supabase
      .from("coupons")
      .insert({
        id: newId,
        code,
        profile_id: profile.id,
        site_id: site.id,
        cost: effectiveCostPrice,
        sale_price: effectiveSalePrice,
        is_free: false,
        status: "Available",
      })
      .select("id, code, status")
      .single();

    if (insertError) {
      results.push({ code, status: "failed", reason: insertError.message });
      continue;
    }

    // Log history
    await supabase.from("coupon_history").insert({
      coupon_id: inserted.id,
      action: "Imported via API",
      details: `Bulk API push — site: ${site.name}, profile: ${profileName}`,
      user_id: "api",
      timestamp: new Date().toISOString(),
    });

    results.push({ code, status: "inserted", coupon_id: inserted.id });
  }

  const inserted  = results.filter(r => r.status === "inserted").length;
  const failed    = results.filter(r => r.status === "failed").length;
  const duplicate = results.filter(r => r.status === "duplicate").length;

  return json({
    success: true,
    site: site.name,
    summary: { total: codes.length, inserted, duplicate, failed },
    results,
  }, 201);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
