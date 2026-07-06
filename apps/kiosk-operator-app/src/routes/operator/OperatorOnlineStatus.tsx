import { useEffect, useState } from "react";
import { fetchHealth } from "../../lib/pointServer.js";

type Status = "checking" | "online" | "offline";

/** Compact "● Онлайн" indicator for the sidebar footer (see `docs/ui-mockups/operator.png`). */
export function OperatorOnlineStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then(() => !cancelled && setStatus("online"))
      .catch(() => !cancelled && setStatus("offline"));
    return () => {
      cancelled = true;
    };
  }, []);

  const color = status === "online" ? "#2ecc71" : status === "offline" ? "#ff4d4f" : "#f5a623";
  const label = status === "online" ? "Онлайн" : status === "offline" ? "Офлайн" : "Проверка…";

  return (
    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
