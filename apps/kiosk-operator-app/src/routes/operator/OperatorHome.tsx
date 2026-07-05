import { PointServerStatus } from "../../components/PointServerStatus.js";

export function OperatorHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100">
      <h1 className="text-4xl font-bold">Окно оператора (заглушка)</h1>
      <p className="text-gray-500">Здесь появится лента заказов в реальном времени.</p>
      <PointServerStatus />
    </div>
  );
}
