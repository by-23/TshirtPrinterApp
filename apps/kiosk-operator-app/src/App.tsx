import { Navigate, Route, Routes } from "react-router-dom";
import { KioskHome } from "./routes/kiosk/KioskHome.js";
import { OperatorHome } from "./routes/operator/OperatorHome.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/kiosk" replace />} />
      <Route path="/kiosk" element={<KioskHome />} />
      <Route path="/operator" element={<OperatorHome />} />
    </Routes>
  );
}
