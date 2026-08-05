import { useCallback, useEffect, useState } from "react";
import { Monitor, SpinnerIcon } from "../../components/icons.js";
import { fetchLanInfo, type LanInfoResponse } from "../../lib/pointServer.js";

const CARD_STYLE = {
  backgroundColor: "var(--operator-card-bg)",
  border: "1px solid var(--operator-card-border)",
};
const LABEL_STYLE = { color: "var(--operator-text-muted)" };

/**
 * Operator «Киоск» — LAN URL for the second PC running Tshirt Printer Kiosk.
 * Dual-monitor assignment on one PC is retired; kiosk connects over the network.
 */
export function DisplaysPanel() {
  const [info, setInfo] = useState<LanInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchLanInfo();
      setInfo(next);
    } catch (err) {
      setInfo(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl((cur) => (cur === url ? null : cur)), 2000);
    } catch {
      setError("Не удалось скопировать в буфер обмена");
    }
  }

  const primary = info?.kioskUrls[0] ?? null;

  return (
    <div className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Киоск</h2>
          <p className="mt-1 text-sm" style={LABEL_STYLE}>
            Второй ПК подключается к этому серверу по локальной сети. На киоске установите «Tshirt Printer
            Kiosk» или откройте URL в браузере.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--operator-accent, #2563eb)" }}
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-sm" style={LABEL_STYLE}>
          <SpinnerIcon className="h-5 w-5 animate-spin" />
          Загрузка сетевых адресов…
        </div>
      ) : error && !info ? (
        <div className="rounded-xl p-5 text-sm text-red-300" style={CARD_STYLE}>
          {error}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {primary ? (
            <div className="rounded-xl p-5" style={CARD_STYLE}>
              <div className="mb-3 flex items-center gap-2">
                <Monitor className="h-5 w-5 text-white" />
                <h3 className="text-lg font-bold text-white">Адрес для киоска</h3>
              </div>
              <p className="mb-3 font-mono text-base break-all text-white">{primary.kioskUrl}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void copyUrl(primary.kioskUrl)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--operator-accent, #2563eb)" }}
                >
                  {copiedUrl === primary.kioskUrl ? "Скопировано" : "Копировать URL"}
                </button>
                <span className="self-center text-sm" style={LABEL_STYLE}>
                  Порт {info?.port ?? 4000}
                  {primary.interfaceName ? ` · ${primary.interfaceName}` : ""}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-5 text-sm text-amber-200" style={CARD_STYLE}>
              LAN IP не найден. Проверьте сетевое подключение ПК оператора. Можно задать вручную через
              переменную окружения TSHIRT_PUBLIC_LAN_HOST.
            </div>
          )}

          {(info?.kioskUrls.length ?? 0) > 1 ? (
            <div className="rounded-xl p-5" style={CARD_STYLE}>
              <h3 className="mb-3 text-base font-bold text-white">Другие адреса</h3>
              <ul className="flex flex-col gap-3">
                {info!.kioskUrls.slice(1).map((item) => (
                  <li key={item.kioskUrl} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm break-all text-white">{item.kioskUrl}</p>
                      <p className="text-xs" style={LABEL_STYLE}>
                        {item.interfaceName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyUrl(item.kioskUrl)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: "#2a3144" }}
                    >
                      {copiedUrl === item.kioskUrl ? "Скопировано" : "Копировать"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl p-5" style={CARD_STYLE}>
            <h3 className="mb-2 text-base font-bold text-white">Как подключить</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm" style={LABEL_STYLE}>
              <li>На этом ПК запущен «Tshirt Printer Operator» (сервер точки).</li>
              <li>
                В брандмауэре Windows разрешите входящие подключения на порт {info?.port ?? 4000} (TCP).
              </li>
              <li>
                На ПК киоска установите «Tshirt Printer Kiosk», введите IP из списка выше — или откройте URL в
                Chrome/Edge в режиме киоска.
              </li>
              <li>Оба ПК должны быть в одной локальной сети.</li>
            </ol>
          </div>

          {error ? (
            <p className="text-sm text-amber-200">{error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
