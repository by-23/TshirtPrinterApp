import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { KioskFrame } from "./components/KioskFrame.js";
import { KioskHome } from "./routes/kiosk/KioskHome.js";
import { CategoryStub } from "./routes/kiosk/CategoryStub.js";
import { Editor } from "./routes/kiosk/Editor.js";
import { OperatorHome } from "./routes/operator/OperatorHome.js";

// The kiosk is a fixed-resolution 1080x1920 touchscreen — every /kiosk/* route
// is rendered inside the same on-screen device simulator (see KioskFrame).
function KioskLayout() {
  return (
    <KioskFrame>
      <Outlet />
    </KioskFrame>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/kiosk" replace />} />
      <Route element={<KioskLayout />}>
        <Route path="/kiosk" element={<KioskHome />} />
        <Route path="/kiosk/category/:category" element={<CategoryStub />} />
        <Route path="/kiosk/editor" element={<Editor />} />
      </Route>
      <Route path="/operator" element={<OperatorHome />} />
    </Routes>
  );
}
