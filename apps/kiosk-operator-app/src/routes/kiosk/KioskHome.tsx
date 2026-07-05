import { PointServerStatus } from "../../components/PointServerStatus.js";

export function KioskHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
      <h1 className="text-4xl font-bold">Киоск (заглушка)</h1>
      <p className="text-gray-500">
        Здесь будет главная страница киоска: выбор языка, баннер, разделы.
      </p>
      <PointServerStatus />
    </div>
  );
}
