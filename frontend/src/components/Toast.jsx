import { useEffect, useState } from "react";

export default function Toast({ message, type = "success", onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const colors =
    type === "success"
      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
      : type === "error"
      ? "bg-red-500/20 border-red-500/50 text-red-300"
      : "bg-amber-500/20 border-amber-500/50 text-amber-300";

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl border font-body text-sm font-medium shadow-xl backdrop-blur-sm ${colors}`}
      style={{ animation: "slideIn 0.3s ease" }}
    >
      {message}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }`}</style>
    </div>
  );
}
