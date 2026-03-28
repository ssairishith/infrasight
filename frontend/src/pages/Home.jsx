import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0a0a0f]">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#e8e8f0 1px, transparent 1px), linear-gradient(90deg, #e8e8f0 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-12 px-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center gap-3 justify-center mb-3">
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-orange-400/80 text-xs tracking-[0.3em] uppercase font-display">
              Live System
            </span>
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-2 tracking-tight">
            INFRA<span className="text-orange-400">SIGHT</span>
          </h1>
          <p className="text-white/40 text-sm tracking-widest uppercase font-display">
            AI Infrastructure Monitoring
          </p>
        </div>

        {/* Role buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
          <button
            onClick={() => navigate("/engineer")}
            className="flex-1 group relative overflow-hidden rounded-2xl border border-orange-500/30 bg-orange-500/5 px-8 py-8 text-left transition-all hover:bg-orange-500/10 hover:border-orange-500/60 hover:scale-[1.02]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:bg-orange-500/10 transition-all" />
            <div className="relative">
              <div className="text-3xl mb-3">🔧</div>
              <div className="font-display text-white text-lg mb-1">
                Field Engineer
              </div>
              <div className="text-white/40 text-xs">
                Capture · Report · Track
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/admin")}
            className="flex-1 group relative overflow-hidden rounded-2xl border border-sky-500/30 bg-sky-500/5 px-8 py-8 text-left transition-all hover:bg-sky-500/10 hover:border-sky-500/60 hover:scale-[1.02]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full -translate-x-4 -translate-y-4 group-hover:bg-sky-500/10 transition-all" />
            <div className="relative">
              <div className="text-3xl mb-3">📊</div>
              <div className="font-display text-white text-lg mb-1">
                Admin Dashboard
              </div>
              <div className="text-white/40 text-xs">
                Review · Approve · Monitor
              </div>
            </div>
          </button>
        </div>

        <p className="text-white/20 text-xs font-display tracking-widest">
          HYDERABAD MUNICIPAL INFRASTRUCTURE
        </p>
      </div>
    </div>
  );
}
