import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Toast from "../components/Toast";
import socket from "../socket";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Fix default marker icon broken by webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const SEV_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };
const STATUS_COLOR = { pending: "text-amber-400", "in-progress": "text-sky-400", completed: "text-emerald-400" };

function makeIcon(severity) {
  const color = SEV_COLOR[severity] || "#888";
  return L.divIcon({
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};
      border:2.5px solid rgba(255,255,255,0.9);
      box-shadow:0 0 10px ${color}99, 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function Admin() {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [msgInput, setMsgInput] = useState("");
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");

  // ── Fetch ─────────────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    const res = await fetch(`/issues`);
    const data = await res.json();
    setIssues(data);
  }, []);

  useEffect(() => {
    fetchIssues();
    socket.on("new_issue", (issue) => setIssues((p) => [issue, ...p]));
    socket.on("update_issue", (upd) => {
      setIssues((p) => p.map((i) => (i._id === upd._id ? upd : i)));
      setSelected((p) => (p?._id === upd._id ? upd : p));
    });
    return () => { socket.off("new_issue"); socket.off("update_issue"); };
  }, []);

  // ── Init Leaflet map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = L.map(mapContainer.current, {
      center: [17.385, 78.4867],
      zoom: 12,
      zoomControl: false,
    });

    // OpenStreetMap tile layer (free, no API key needed)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Dark-ish overlay using CartoDB Dark (also free)
    // Uncomment to use dark theme:
    // L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    //   attribution: "© OpenStreetMap, © CartoDB",
    // }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // ── Update markers when issues change ────────────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const validIssues = issues.filter((i) => i.location?.lat && i.location?.lng);

    validIssues.forEach((issue) => {
      const marker = L.marker([issue.location.lat, issue.location.lng], {
        icon: makeIcon(issue.severity),
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;min-width:160px">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">
            ${issue.type?.toUpperCase() || "ISSUE"}
          </div>
          <div style="font-size:11px;color:#555;line-height:1.6">
            Severity: <b style="color:${SEV_COLOR[issue.severity]}">${issue.severity}</b><br/>
            Cost: <b>₹${(issue.cost || 0).toLocaleString()}</b><br/>
            Status: ${issue.status}<br/>
            ${issue.repair_method ? `Method: ${issue.repair_method}` : ""}
          </div>
        </div>
      `, { maxWidth: 220 });

      marker.on("click", () => setSelected(issue));
      markersRef.current.push(marker);
    });

    // Fit map to markers if any exist
    if (validIssues.length > 0 && markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14 });
    }
  }, [issues]);

  // ── Approval actions ──────────────────────────────────────────────
  const patch = async (id, body) => {
    const res = await fetch(`/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const approve = async () => {
    if (!selected) return;
    await patch(selected._id, { approved: true, admin_message: msgInput || "Approved for repair", status: "in-progress" });
    setToast({ message: "Issue approved", type: "success" });
    setMsgInput("");
  };

  const reject = async () => {
    if (!selected) return;
    await patch(selected._id, { approved: false, admin_message: msgInput || "Rejected" });
    setToast({ message: "Issue rejected", type: "error" });
    setMsgInput("");
  };

  const markComplete = async () => {
    if (!selected) return;
    await patch(selected._id, { status: "completed" });
    setToast({ message: "Marked as completed", type: "success" });
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const stats = {
    total: issues.length,
    high: issues.filter((i) => i.severity === "high").length,
    pending: issues.filter((i) => i.status === "pending").length,
    budget: issues.reduce((a, b) => a + (b.cost || 0), 0),
  };

  const filtered = filter === "all" ? issues : issues.filter((i) => i.severity === filter || i.status === filter);

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-white/30 hover:text-white/70 text-sm">←</button>
          <span className="font-display text-sky-400 text-sm tracking-wider">ADMIN DASHBOARD</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/30 text-xs font-display">LIVE</span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 border-b border-white/5 flex-shrink-0">
        {[
          { label: "TOTAL", value: stats.total, color: "text-white" },
          { label: "HIGH SEV", value: stats.high, color: "text-red-400" },
          { label: "PENDING", value: stats.pending, color: "text-amber-400" },
          { label: "BUDGET", value: `₹${stats.budget.toLocaleString()}`, color: "text-sky-400" },
        ].map((s) => (
          <div key={s.label} className="p-3 text-center border-r border-white/5 last:border-r-0">
            <div className={`font-display text-lg ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-white/25 font-display">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map - takes most space */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Legend overlay */}
          <div className="absolute top-3 left-3 z-[1000] flex gap-2">
            {Object.entries(SEV_COLOR).map(([sev, color]) => (
              <button
                key={sev}
                onClick={() => setFilter(f => f === sev ? "all" : sev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg backdrop-blur-sm text-xs font-display transition-all
                  ${filter === sev ? "bg-white/20 border border-white/30" : "bg-black/50 border border-white/10"}`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-white/70">{sev}</span>
              </button>
            ))}
          </div>

          {/* OSM attribution is handled by Leaflet */}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-white/5 flex flex-col overflow-hidden bg-[#0a0a0f]">

          {/* Issue list */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-display text-white/40 tracking-wider">ISSUES</span>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/50 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {filtered.length === 0 && (
              <div className="p-8 text-center text-white/20 text-sm">No issues</div>
            )}

            {filtered.map((issue) => {
              const sev = SEV_COLOR[issue.severity];
              const isSelected = selected?._id === issue._id;
              return (
                <div
                  key={issue._id}
                  onClick={() => {
                    setSelected(isSelected ? null : issue);
                    setMsgInput("");
                    // Fly map to this issue
                    if (!isSelected && issue.location?.lat && mapInstance.current) {
                      mapInstance.current.flyTo([issue.location.lat, issue.location.lng], 15, { duration: 1 });
                    }
                  }}
                  className={`p-3 border-b border-white/4 cursor-pointer transition-all ${isSelected ? "bg-sky-500/8 border-l-2 border-l-sky-400" : "hover:bg-white/2"}`}
                >
                  <div className="flex items-center gap-2.5">
                    {issue.images?.[0] ? (
                      <img src={issue.images[0]} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-base flex-shrink-0">📍</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-display text-white/80 truncate">{issue.type?.toUpperCase()}</span>
                        {sev && (
                          <span className="text-[9px] font-display px-1.5 py-0.5 rounded" style={{ background: `${sev}22`, color: sev }}>
                            {issue.severity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/35">₹{(issue.cost || 0).toLocaleString()}</span>
                        <span className={`text-[9px] font-display ${STATUS_COLOR[issue.status]}`}>• {issue.status}</span>
                      </div>
                      {issue.urgency && (
                        <div className="text-[9px] text-white/25 mt-0.5">{issue.urgency?.replace("_", " ")}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail + Approval panel */}
          {selected && (
            <div className="border-t border-white/10 bg-white/[0.015] flex-shrink-0 max-h-[55%] overflow-y-auto">
              <div className="p-4 space-y-3">
                <div className="font-display text-xs text-white/40 tracking-wider">
                  REVIEW · {selected.type?.toUpperCase()}
                </div>

                {selected.images?.[0] && (
                  <img src={selected.images[0]} className="w-full h-32 object-cover rounded-xl" />
                )}

                {/* AI report */}
                {selected.ai_report && (
                  <div className="text-xs text-white/50 bg-white/3 rounded-xl px-3 py-2 leading-relaxed">
                    {selected.ai_report}
                  </div>
                )}

                {/* Detail grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Cost", value: `₹${(selected.cost || 0).toLocaleString()}` },
                    { label: "Severity", value: selected.severity, color: SEV_COLOR[selected.severity] },
                    { label: "Method", value: selected.repair_method || "—" },
                    { label: "Urgency", value: selected.urgency?.replace("_", " ") || "—" },
                    { label: "Road", value: selected.roadType || "—" },
                    { label: "Status", value: selected.status },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/4 rounded-lg p-2">
                      <div className="text-white/30 text-[9px] mb-0.5">{label}</div>
                      <div className="font-display text-xs" style={color ? { color } : { color: "#fff" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Cost breakdown mini */}
                {selected.cost_breakdown && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-display text-white/30 tracking-wider">COST BREAKDOWN</div>
                    {[
                      { label: "Cement", cost: selected.cost_breakdown.cement_cost_inr },
                      { label: "Sand", cost: selected.cost_breakdown.sand_cost_inr },
                      { label: "Aggregate", cost: selected.cost_breakdown.aggregate_cost_inr },
                      { label: "Bitumen", cost: selected.cost_breakdown.bitumen_cost_inr },
                      { label: "Labor", cost: selected.cost_breakdown.labor_cost_inr },
                      { label: "Equipment", cost: selected.cost_breakdown.equipment_cost_inr },
                    ].filter(r => r.cost > 0).map(({ label, cost }) => (
                      <div key={label} className="flex justify-between text-[10px]">
                        <span className="text-white/40">{label}</span>
                        <span className="text-white/60 font-display">₹{cost?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Admin message */}
                <textarea
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  placeholder="Add decision note..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-sky-500/40"
                />

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={approve}
                    className="py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-display hover:bg-emerald-500/30 transition-all"
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={reject}
                    className="py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-display hover:bg-red-500/30 transition-all"
                  >
                    REJECT
                  </button>
                  <button
                    onClick={markComplete}
                    disabled={selected.status === "completed"}
                    className="py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[10px] font-display hover:bg-sky-500/30 transition-all disabled:opacity-30"
                  >
                    DONE ✓
                  </button>
                </div>

                {/* Previous admin message */}
                {selected.admin_message && (
                  <div className="text-[10px] text-white/30 bg-white/3 rounded-lg px-2 py-1.5">
                    <span className="text-white/20">Note: </span>{selected.admin_message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
