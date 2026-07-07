import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { designCategorySchema } from "@tshirt/shared-types";
import { KioskFrame } from "./components/KioskFrame.js";
import { OperatorFrame } from "./components/OperatorFrame.js";
import { KioskShell } from "./components/KioskShell.js";
import { KioskHome } from "./routes/kiosk/KioskHome.js";
import { CategoryStub } from "./routes/kiosk/CategoryStub.js";
import { CategoryGallery } from "./routes/kiosk/CategoryGallery.js";
import { Editor } from "./routes/kiosk/Editor.js";
import { AiFlow } from "./routes/kiosk/ai/AiFlow.js";
import { Checkout } from "./routes/kiosk/checkout/Checkout.js";
import { OperatorHome } from "./routes/operator/OperatorHome.js";

// Memes/anime/games are gallery categories (Stage 3); ai_style has its own
// wizard (`/kiosk/ai`, Этап 9, see `getCategoryRoute`); everything else
// still stays on the placeholder stub.
const GALLERY_CATEGORIES = new Set(["memes", "anime_movies", "games"]);

function CategoryRoute() {
  const { category } = useParams<{ category: string }>();
  const parsed = designCategorySchema.safeParse(category);
  if (parsed.success && GALLERY_CATEGORIES.has(parsed.data)) {
    return <CategoryGallery />;
  }
  return <CategoryStub />;
}

// The kiosk is a fixed-resolution 1080x1920 touchscreen — every /kiosk/* route
// is rendered inside the same on-screen device simulator (see KioskFrame).
function KioskLayout() {
  return (
    <KioskFrame>
      <KioskShell />
    </KioskFrame>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/kiosk" replace />} />
      <Route element={<KioskLayout />}>
        <Route path="/kiosk" element={<KioskHome />} />
        <Route path="/kiosk/category/:category" element={<CategoryRoute />} />
        <Route path="/kiosk/ai" element={<AiFlow />} />
        <Route path="/kiosk/editor" element={<Editor />} />
        <Route path="/kiosk/checkout" element={<Checkout />} />
      </Route>
      <Route
        path="/operator"
        element={
          <OperatorFrame>
            <OperatorHome />
          </OperatorFrame>
        }
      />
    </Routes>
  );
}
