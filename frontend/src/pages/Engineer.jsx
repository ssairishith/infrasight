import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import socket from "../socket";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const severityColors = {
  low: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  medium: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  high: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
};

const urgencyLabel = {
  immediate: "⚠ Immediate action",
  within_week: "📅 Within a week",
  within_month: "🗓 Within a month",
};

const statusColor = {
  pending: "text-amber-400",
  "in-progress": "text-sky-400",
  completed: "text-emerald-400",
};

const statusNext = { pending: "in-progress", "in-progress": "completed" };

export default function Engineer() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [images, setImages] = useState([]);
  const [toast, setToast] = useState(null);
  const [issues, setIssues] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null); // full AI response

  // GPS state
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | loading | found | error
  const [location, setLocation] = useState({ lat: null, lng: null });

  // Manual form
  const [roadType, setRoadType] = useState("arterial");

  // ── Fetch issues ──────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/issues`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setIssues(data);
      } else {
        console.error("fetch issues error:", data);
        setIssues([]);
      }
    } catch (err) {
        console.error("fetch issues failed:", err);
        setIssues([]);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    socket.on("new_issue", fetchIssues);
    socket.on("update_issue", fetchIssues);
    return () => {
      socket.off("new_issue", fetchIssues);
      socket.off("update_issue", fetchIssues);
      stopCamera();
    };
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────
  const getGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setGpsStatus("found");
      },
      () => {
        // fallback to Hyderabad random
        setLocation({
          lat: (17.2 + Math.random() * 0.4).toFixed(6),
          lng: (78.2 + Math.random() * 0.5).toFixed(6),
        });
        setGpsStatus("found");
        setToast({ message: "GPS unavailable — using simulated Hyderabad coords", type: "warn" });
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => { getGPS(); }, []);

  // ── Camera ────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      setToast({ message: "Camera access denied", type: "error" });
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  };

  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const b64 = canvas.toDataURL("image/jpeg", 0.8);
    addImageAndAnalyze(b64);
  };

  const handleUpload = (e) => {
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => addImageAndAnalyze(ev.target.result);
      reader.readAsDataURL(file);
    });
  };

  // ── AI Analysis ───────────────────────────────────────────────────
  const addImageAndAnalyze = async (b64) => {
    setImages((prev) => [...prev, b64]);
    setAnalysis(null);
    setAnalyzing(true);
    try {
const res = await fetch(`${BACKEND}/issues/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, roadType }),
      });
      const data = await res.json();
      setAnalysis(data);
      if (data.detected) {
        setToast({ message: `${data.type} detected — ${data.severity} severity`, type: "success" });
      } else {
        setToast({ message: "No road damage detected in image", type: "warn" });
      }
    } catch {
      setToast({ message: "AI analysis failed", type: "error" });
    }
    setAnalyzing(false);
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!analysis?.detected) {
      setToast({ message: "No damage detected to submit", type: "error" });
      return;
    }
    if (!location.lat) {
      setToast({ message: "Waiting for GPS location", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const dim = analysis.dimensions_estimate || {};
      const body = {
        images,
        type: analysis.type,
        dimensions: { length: dim.length_m, width: dim.width_m, depth: dim.depth_m },
        severity: analysis.severity,
        cost: analysis.total_cost_inr,
        cost_range: analysis.cost_range,
        cost_breakdown: analysis.materials,
        repair_method: analysis.repair_method,
        urgency: analysis.urgency,
        location: { lat: Number(location.lat), lng: Number(location.lng) },
        roadType,
        timestamp: new Date(),
        ai_report: analysis.description,
        confidence: analysis.confidence,
        status: "pending",
        admin_message: "",
      };
await fetch(`${BACKEND}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setToast({ message: "Issue submitted successfully!", type: "success" });
      setImages([]);
      setAnalysis(null);
      getGPS();
    } catch {
      setToast({ message: "Submit failed", type: "error" });
    }
    setSubmitting(false);
  };

  const updateStatus = async (id, status) => {
await fetch(`${BACKEND}/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const sc = analysis?.severity ? severityColors[analysis.severity] : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0f] z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/30 hover:text-white/70 text-sm">←</button>
          <span className="font-display text-orange-400 text-sm tracking-wider">FIELD ENGINEER</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${gpsStatus === "found" ? "bg-emerald-400" : gpsStatus === "loading" ? "bg-amber-400 animate-pulse" : "bg-red-400"}`} />
          <span className="text-white/30 text-xs font-display">
            {gpsStatus === "found" ? `${location.lat}, ${location.lng}` : gpsStatus === "loading" ? "ACQUIRING GPS..." : "NO GPS"}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Section 1: Capture ── */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xs text-white/50 tracking-[0.2em]">01 / CAPTURE IMAGE</h2>
            <select
              value={roadType}
              onChange={(e) => setRoadType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="arterial">Arterial Road</option>
              <option value="residential">Residential</option>
              <option value="highway">Highway</option>
              <option value="service">Service Road</option>
            </select>
          </div>

          {/* Video preview */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-3 flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${cameraOn ? "" : "hidden"}`} />
            <canvas ref={canvasRef} className="hidden" />
            {!cameraOn && (
              <div className="flex flex-col items-center gap-2 text-white/20">
                <span className="text-3xl">📷</span>
                <span className="text-xs font-display">NO FEED</span>
              </div>
            )}
            {analyzing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-orange-300 text-xs font-display">AI ANALYZING...</span>
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="flex gap-2">
            {!cameraOn ? (
              <button onClick={startCamera} className="flex-1 py-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-sm font-display hover:bg-orange-500/30 transition-all">
                START CAMERA
              </button>
            ) : (
              <>
                <button onClick={captureImage} disabled={analyzing} className="flex-1 py-3 rounded-xl bg-orange-500/30 border border-orange-500/50 text-orange-200 text-sm font-display hover:bg-orange-500/40 transition-all disabled:opacity-50">
                  CAPTURE
                </button>
                <button onClick={stopCamera} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-display hover:bg-white/10 transition-all">
                  STOP
                </button>
              </>
            )}
            <label className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-display hover:bg-white/10 transition-all cursor-pointer">
              UPLOAD
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            </label>
          </div>

          {/* Thumbnails */}
          {images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] hidden group-hover:flex items-center justify-center"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 2: AI Detection Result ── */}
        {(analyzing || analysis) && (
          <div className={`rounded-2xl border p-5 transition-all ${sc ? `${sc.bg} ${sc.border}` : "border-white/8 bg-white/[0.02]"}`}>
            <h2 className="font-display text-xs text-white/50 tracking-[0.2em] mb-4">02 / AI DETECTION</h2>

            {analyzing && (
              <div className="flex items-center gap-3 text-white/50">
                <div className="w-4 h-4 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Analyzing image with AI vision...</span>
              </div>
            )}

            {!analyzing && analysis && (
              <div className="space-y-4">
                {/* Detection badge */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-3 py-1.5 rounded-lg font-display text-xs ${analysis.detected ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "bg-white/5 text-white/40"}`}>
                    {analysis.detected ? `✓ ${analysis.type?.toUpperCase()} DETECTED` : "✗ NO DAMAGE"}
                  </span>
                  {analysis.detected && (
                    <>
                      <span className={`px-3 py-1.5 rounded-lg font-display text-xs ${sc?.bg} ${sc?.text} border ${sc?.border}`}>
                        {analysis.severity?.toUpperCase()}
                      </span>
                      <span className="text-xs text-white/30 font-display">
                        {Math.round((analysis.confidence || 0) * 100)}% confidence
                      </span>
                    </>
                  )}
                </div>

                {/* Description */}
                {analysis.description && (
                  <p className="text-sm text-white/70 leading-relaxed">{analysis.description}</p>
                )}

                {/* Dimensions */}
                {analysis.detected && analysis.dimensions_estimate && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "LENGTH", val: `${analysis.dimensions_estimate.length_m}m` },
                      { label: "WIDTH", val: `${analysis.dimensions_estimate.width_m}m` },
                      { label: "DEPTH", val: `${analysis.dimensions_estimate.depth_m}m` },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-black/30 rounded-xl p-3 text-center">
                        <div className="font-display text-white text-sm">{val}</div>
                        <div className="text-white/30 text-[10px]">{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Repair info */}
                {analysis.detected && (
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300">
                      🔧 {analysis.repair_method}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50">
                      {urgencyLabel[analysis.urgency] || analysis.urgency}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Section 3: Cost Breakdown ── */}
        {analysis?.detected && analysis.materials && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="font-display text-xs text-white/50 tracking-[0.2em] mb-4">03 / COST ESTIMATE</h2>

            {/* Total */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mb-4 flex items-center justify-between">
              <div>
                <div className="font-display text-2xl text-white">
                  ₹{(analysis.cost_range?.min || 0).toLocaleString()} – ₹{(analysis.cost_range?.max || 0).toLocaleString()}
                </div>
                <div className="text-xs text-white/40 mt-0.5">Estimated repair cost range</div>
              </div>
              <div className="text-right">
                <div className="font-display text-orange-400 text-lg">₹{(analysis.total_cost_inr || 0).toLocaleString()}</div>
                <div className="text-xs text-white/40">Base estimate</div>
              </div>
            </div>

            {/* Material breakdown */}
            <div className="space-y-2">
              {[
                { label: "Cement", qty: `${analysis.materials.cement_bags} bags`, cost: analysis.materials.cement_cost_inr },
                { label: "River Sand", qty: `${analysis.materials.sand_cft} cft`, cost: analysis.materials.sand_cost_inr },
                { label: "Aggregate (20mm)", qty: `${analysis.materials.aggregate_cft} cft`, cost: analysis.materials.aggregate_cost_inr },
                { label: "Bitumen VG-30", qty: `${analysis.materials.bitumen_kg} kg`, cost: analysis.materials.bitumen_cost_inr },
                { label: "Labor", qty: `${analysis.materials.labor_days} day(s)`, cost: analysis.materials.labor_cost_inr },
                { label: "Equipment Hire", qty: "—", cost: analysis.materials.equipment_cost_inr },
                { label: "Miscellaneous", qty: "—", cost: analysis.materials.misc_cost_inr },
              ].filter(r => r.cost > 0).map(({ label, qty, cost }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/4">
                  <div>
                    <span className="text-sm text-white/70">{label}</span>
                    <span className="text-xs text-white/30 ml-2">{qty}</span>
                  </div>
                  <span className="font-display text-sm text-white/80">₹{cost?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GPS & Submit ── */}
        {analysis?.detected && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="font-display text-xs text-white/50 tracking-[0.2em] mb-4">04 / LOCATION & SUBMIT</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-white/40 font-display block mb-1">LATITUDE</label>
                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 font-display">
                  {location.lat || "—"}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 font-display block mb-1">LONGITUDE</label>
                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 font-display">
                  {location.lng || "—"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={getGPS} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-display hover:bg-white/10">
                🔄 RE-ACQUIRE GPS
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !location.lat}
                className="flex-1 py-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 font-display tracking-widest hover:bg-orange-500/30 transition-all disabled:opacity-40 text-sm"
              >
                {submitting ? "SUBMITTING..." : "SUBMIT ISSUE →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Task Panel ── */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="font-display text-xs text-white/50 tracking-[0.2em] mb-4">05 / MY SUBMISSIONS</h2>
          {issues.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">No issues submitted yet</div>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => {
                const col = severityColors[issue.severity];
                return (
                  <div key={issue._id} className={`flex items-center gap-3 p-3 rounded-xl border ${col?.border || "border-white/5"} ${col?.bg || "bg-white/3"}`}>
                    {issue.images?.[0] && (
                      <img src={issue.images[0]} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-display text-white/80">{issue.type?.toUpperCase()}</span>
                        <span className={`text-[10px] font-display ${col?.text}`}>{issue.severity}</span>
                        <span className={`text-[10px] font-display ${statusColor[issue.status]}`}>• {issue.status}</span>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        ₹{(issue.cost || 0).toLocaleString()} · {issue.repair_method || "—"}
                      </div>
                      {issue.admin_message && (
                        <div className="text-xs text-sky-300/70 mt-0.5 truncate">Admin: {issue.admin_message}</div>
                      )}
                    </div>
                    {statusNext[issue.status] && (
                      <button
                        onClick={() => updateStatus(issue._id, statusNext[issue.status])}
                        className="text-[10px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 font-display hover:bg-white/10 whitespace-nowrap"
                      >
                        → {statusNext[issue.status]}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
