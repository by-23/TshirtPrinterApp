import { useEffect, useState } from "react";
import { fetchHealth } from "../lib/pointServer.js";

type Status = "checking" | "online" | "offline";

export function PointServerStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    fetchHealth()
      .then(() => {
        if (!cancelled) setStatus("online");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const color =
    status === "online"
      ? "bg-green-500"
      : status === "offline"
        ? "bg-red-500"
        : "bg-yellow-500";

  const label =
    status === "online"
      ? "point-server: online"
      : status === "offline"
        ? "point-server: offline"
        : "point-server: проверка...";

  return (
    <div className="flex items-center gap-2 text-sm text-ink-200">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}
