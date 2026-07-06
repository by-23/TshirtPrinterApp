import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout.js";
import { Login } from "./routes/Login.js";
import { PointsPage } from "./routes/PointsPage.js";
import { CatalogPage } from "./routes/CatalogPage.js";
import { PricingPage } from "./routes/PricingPage.js";
import { StatsPage } from "./routes/StatsPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/points" replace />} />
        <Route path="/points" element={<PointsPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
