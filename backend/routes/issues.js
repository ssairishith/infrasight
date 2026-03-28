const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ─── Helper: map flat DB row → shaped object for frontend ─────────
function rowToIssue(r) {
  if (!r) return null;
  return {
    _id: r.id,
    images: r.images || [],
    type: r.type,
    dimensions: { length: r.dim_length, width: r.dim_width, depth: r.dim_depth },
    severity: r.severity,
    status: r.status,
    approved: r.approved,
    admin_message: r.admin_message,
    location: { lat: r.lat, lng: r.lng },
    roadType: r.road_type,
    cost: r.cost,
    cost_range: { min: r.cost_min, max: r.cost_max },
    cost_breakdown: {
      cement_bags: r.cb_cement_bags, cement_cost_inr: r.cb_cement_cost,
      sand_cft: r.cb_sand_cft, sand_cost_inr: r.cb_sand_cost,
      aggregate_cft: r.cb_aggregate_cft, aggregate_cost_inr: r.cb_aggregate_cost,
      bitumen_kg: r.cb_bitumen_kg, bitumen_cost_inr: r.cb_bitumen_cost,
      labor_days: r.cb_labor_days, labor_cost_inr: r.cb_labor_cost,
      equipment_cost_inr: r.cb_equipment_cost,
      misc_cost_inr: r.cb_misc_cost,
    },
    repair_method: r.repair_method,
    urgency: r.urgency,
    confidence: r.confidence,
    ai_report: r.ai_report,
    timestamp: r.created_at,
  };
}

// ─── Helper: shaped body → flat DB row ───────────────────────────
function issueToRow(b) {
  return {
    images: b.images || [],
    type: b.type || "pothole",
    dim_length: b.dimensions?.length,
    dim_width: b.dimensions?.width,
    dim_depth: b.dimensions?.depth,
    severity: b.severity,
    status: b.status || "pending",
    approved: b.approved ?? null,
    admin_message: b.admin_message || "",
    lat: b.location?.lat,
    lng: b.location?.lng,
    road_type: b.roadType,
    cost: b.cost,
    cost_min: b.cost_range?.min,
    cost_max: b.cost_range?.max,
    cb_cement_bags: b.cost_breakdown?.cement_bags,
    cb_cement_cost: b.cost_breakdown?.cement_cost_inr,
    cb_sand_cft: b.cost_breakdown?.sand_cft,
    cb_sand_cost: b.cost_breakdown?.sand_cost_inr,
    cb_aggregate_cft: b.cost_breakdown?.aggregate_cft,
    cb_aggregate_cost: b.cost_breakdown?.aggregate_cost_inr,
    cb_bitumen_kg: b.cost_breakdown?.bitumen_kg,
    cb_bitumen_cost: b.cost_breakdown?.bitumen_cost_inr,
    cb_labor_days: b.cost_breakdown?.labor_days,
    cb_labor_cost: b.cost_breakdown?.labor_cost_inr,
    cb_equipment_cost: b.cost_breakdown?.equipment_cost_inr,
    cb_misc_cost: b.cost_breakdown?.misc_cost_inr,
    repair_method: b.repair_method,
    urgency: b.urgency,
    confidence: b.confidence,
    ai_report: b.ai_report,
  };
}

// ─── GET /issues ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(rowToIssue));
});

// ─── POST /issues ─────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const row = issueToRow(req.body);
  const { data, error } = await supabase
    .from("issues")
    .insert(row)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  const issue = rowToIssue(data);
  const io = req.app.get("io");
  if (io) io.emit("new_issue", issue);
  res.status(201).json(issue);
});

// ─── PATCH /issues/:id ────────────────────────────────────────────
router.patch("/:id", async (req, res) => {
  const b = req.body;
  // Only update fields that are actually sent
  const patch = {};
  if (b.status !== undefined) patch.status = b.status;
  if (b.approved !== undefined) patch.approved = b.approved;
  if (b.admin_message !== undefined) patch.admin_message = b.admin_message;

  const { data, error } = await supabase
    .from("issues")
    .update(patch)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  const issue = rowToIssue(data);
  const io = req.app.get("io");
  if (io) io.emit("update_issue", issue);
  res.json(issue);
});

// ─── POST /issues/analyze — AI Vision (YOLOv8 + Groq Cost) ───────
router.post("/analyze", async (req, res) => {
  const { image, roadType } = req.body;
  
  if (!image) {
    return res.status(400).json({ error: "Missing 'image' in request" });
  }

  try {
    // Step 1: Get detection + dimensions from local YOLOv8 analyzer
    const analyzerUrl = process.env.ANALYZER_URL || "http://localhost:5001";
    const analyzerResponse = await fetch(`${analyzerUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, roadType: roadType || "arterial" }),
    });

    if (!analyzerResponse.ok) {
      throw new Error(`Analyzer service error: ${analyzerResponse.status}`);
    }

    const yoloResult = await analyzerResponse.json();

    // Step 2: If no damage detected, return as-is
    if (!yoloResult.detected) {
      return res.json({
        ...yoloResult,
        materials: {},
        total_cost_inr: 0,
        cost_range: { min: 0, max: 0 },
        repair_method: "None",
        urgency: "none",
      });
    }

    // Step 3: Use Groq to estimate realistic cost based on actual dimensions
    const groqResult = await estimateCostWithGroq(yoloResult, roadType);

    // Step 4: Combine detection results with Groq cost estimation
    const finalResult = {
      ...yoloResult,
      ...groqResult,
    };

    return res.json(finalResult);
  } catch (err) {
    console.error("Analysis error:", err.message);
    return res.status(500).json({
      error: err.message,
      detected: false,
    });
  }
});

// ─── Helper: Call Groq for realistic cost estimation ──────────────
async function estimateCostWithGroq(yoloResult, roadType) {
  const apiKey = process.env.AI_API_KEY;
  
  if (!apiKey || !apiKey.startsWith("gsk_")) {
    console.warn("Groq API key missing, using fallback cost");
    return buildFallbackCost(yoloResult.severity);
  }

  try {
    const dims = yoloResult.dimensions_estimate;
    const volume_m3 = (dims.length_m * dims.width_m * dims.depth_m).toFixed(4);

    const prompt = `You are a civil infrastructure cost estimator for Hyderabad roads. Based on REAL damage analysis, provide accurate material and labor costs.

DAMAGE DETAILS (from computer vision analysis):
- Type: ${yoloResult.type}
- Severity: ${yoloResult.severity}
- Length: ${dims.length_m} meters
- Width: ${dims.width_m} meters  
- Depth: ${dims.depth_m} meters
- Volume: ${volume_m3} m³
- Road Type: ${roadType}
- Confidence: ${yoloResult.confidence}

Return ONLY valid JSON (no markdown, no explanation):
{
  "materials": {
    "cement_bags": number,
    "cement_cost_inr": number (₹400/bag as of 2024),
    "sand_cft": number (cubic feet),
    "sand_cost_inr": number (₹60/cft as of 2024),
    "aggregate_cft": number,
    "aggregate_cost_inr": number (₹55/cft as of 2024),
    "bitumen_kg": number,
    "bitumen_cost_inr": number (₹65/kg as of 2024),
    "labor_days": number,
    "labor_cost_inr": number (₹750/day as of 2024),
    "equipment_cost_inr": number (₹500-5000 based on severity),
    "misc_cost_inr": number (contingency)
  },
  "total_cost_inr": number,
  "cost_range": {"min": number, "max": number},
  "repair_method": "Cold Mix Patching" or "Hot Mix Patching" or "Full Depth Reclamation",
  "urgency": "immediate" or "within_week" or "within_month"
}

Guidelines:
- Calculate materials based on ACTUAL volume (${volume_m3}m³), not templates
- Cold Mix Patching: ₹1200-2000/bag, for small pothole <0.5m²
- Hot Mix Patching: ₹2500/bag, for pothole 0.5-1.5m² 
- Full Depth Reclamation: ₹5000/m² for severe damage >1.5m²
- Labor: typically 1-4 days depending on severity
- Equipment rental: ₹500 (small) to ₹4500 (large machinery) per day`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Groq API error");
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "{}";
    
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const costData = jsonMatch ? JSON.parse(jsonMatch[0]) : buildFallbackCost(yoloResult.severity);

    return costData;
  } catch (err) {
    console.error("Groq cost estimation error:", err.message);
    return buildFallbackCost(yoloResult.severity);
  }
}

// ─── Fallback: Basic cost structure if Groq unavailable ───────────
function buildFallbackCost(severity) {
  const templates = {
    low: {
      materials: {
        cement_bags: 2, cement_cost_inr: 800,
        sand_cft: 2, sand_cost_inr: 120,
        aggregate_cft: 2, aggregate_cost_inr: 110,
        bitumen_kg: 5, bitumen_cost_inr: 325,
        labor_days: 0.5, labor_cost_inr: 375,
        equipment_cost_inr: 500, misc_cost_inr: 200,
      },
      total_cost_inr: 3430,
      cost_range: { min: 2900, max: 4100 },
      repair_method: "Cold Mix Patching",
      urgency: "within_month",
    },
    medium: {
      materials: {
        cement_bags: 5, cement_cost_inr: 2000,
        sand_cft: 5, sand_cost_inr: 300,
        aggregate_cft: 5, aggregate_cost_inr: 275,
        bitumen_kg: 15, bitumen_cost_inr: 975,
        labor_days: 1.5, labor_cost_inr: 1125,
        equipment_cost_inr: 2000, misc_cost_inr: 350,
      },
      total_cost_inr: 7025,
      cost_range: { min: 5920, max: 8430 },
      repair_method: "Hot Mix Patching",
      urgency: "within_week",
    },
    high: {
      materials: {
        cement_bags: 10, cement_cost_inr: 4000,
        sand_cft: 10, sand_cost_inr: 600,
        aggregate_cft: 10, aggregate_cost_inr: 550,
        bitumen_kg: 30, bitumen_cost_inr: 1950,
        labor_days: 3, labor_cost_inr: 2250,
        equipment_cost_inr: 4500, misc_cost_inr: 500,
      },
      total_cost_inr: 14950,
      cost_range: { min: 12700, max: 17940 },
      repair_method: "Full Depth Reclamation",
      urgency: "immediate",
    },
  };
  return templates[severity] || templates.medium;
}

module.exports = router;
