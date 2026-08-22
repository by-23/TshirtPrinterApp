import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { designCategorySchema } from "@tshirt/shared-types";
import { KioskFrame } from "./components/KioskFrame.js";
import { OperatorFrame } from "./components/OperatorFrame.js";
import { KioskShell } from "./components/KioskShell.js";
import { KioskHome } from "./routes/kiosk/KioskHome.js";
import { CategoryStub } from "./routes/kiosk/CategoryStub.js";
import { CategoryGallery } from "./routes/kiosk/CategoryGallery.js";

const Editor = lazy(() => import("./routes/kiosk/Editor.js").then((m) => ({ default: m.Editor })));
const AiFlow = lazy(() => import("./routes/kiosk/ai/AiFlow.js").then((m) => ({ default: m.AiFlow })));
const Checkout = lazy(() =>
  import("./routes/kiosk/checkout/Checkout.js").then((m) => ({ default: m.Checkout })),
);
const OperatorHome = lazy(() =>
  import("./routes/operator/OperatorHome.js").then((m) => ({ default: m.OperatorHome })),
);

// Misc/anime/games are gallery categories (Stage 3); ai_style has its own
// wizard (`/kiosk/ai`, Этап 9, see `getCategoryRoute`); everything else
// still stays on the placeholder stub.
const GALLERY_CATEGORIES = new Set(["misc", "anime_movies", "games"]);

function CategoryRoute() {
  const { category } = useParams<{ category: string }>();
  if (category === "memes") {
    return <Navigate to="/kiosk/category/misc" replace />;
  }
  const parsed = designCategorySchema.safeParse(category);
  if (parsed.success && GALLERY_CATEGORIES.has(parsed.data)) {
    return <CategoryGallery />;
  }
  return <CategoryStub />;
}

function RouteFallback() {
  return <div className="flex h-full w-full items-center justify-center bg-ink-950 text-ink-400" />;
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
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
}
