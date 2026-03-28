const mongoose = require("mongoose");

const IssueSchema = new mongoose.Schema({
  images: [String],
  type: { type: String, default: "pothole" },
  dimensions: {
    length: Number,
    width: Number,
    depth: Number,
  },
  severity: { type: String, enum: ["low", "medium", "high", "none"] },
  cost: Number,
  cost_range: { min: Number, max: Number },
  cost_breakdown: {
    cement_bags: Number, cement_cost_inr: Number,
    sand_cft: Number, sand_cost_inr: Number,
    aggregate_cft: Number, aggregate_cost_inr: Number,
    bitumen_kg: Number, bitumen_cost_inr: Number,
    labor_days: Number, labor_cost_inr: Number,
    equipment_cost_inr: Number, misc_cost_inr: Number,
  },
  repair_method: String,
  urgency: { type: String, enum: ["immediate", "within_week", "within_month"] },
  confidence: Number,
  location: { lat: Number, lng: Number },
  roadType: String,
  timestamp: { type: Date, default: Date.now },
  ai_report: String,
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed"],
    default: "pending",
  },
  approved: { type: Boolean, default: null },
  admin_message: { type: String, default: "" },
});

module.exports = mongoose.model("Issue", IssueSchema);
