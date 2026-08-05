import { networkInterfaces } from "node:os";
import { env } from "../env.js";

export interface LanAddress {
  address: string;
  /** e.g. Ethernet, Wi-Fi */
  interfaceName: string;
}

function isVirtualInterface(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("vethernet") ||
    n.includes("hyper-v") ||
    n.includes("wsl") ||
    n.includes("docker") ||
    n.includes("vbox") ||
    n.includes("virtualbox") ||
    n.includes("vmware") ||
    n.includes("loopback") ||
    n.includes("bluetooth")
  );
}

/** Lower score = better candidate for kiosk LAN URL. */
function scoreLanAddress(addr: LanAddress): number {
  let score = 100;
  if (isVirtualInterface(addr.interfaceName)) score += 500;
  if (addr.address.startsWith("192.168.")) score -= 40;
  else if (addr.address.startsWith("10.")) score -= 30;
  else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(addr.address)) score -= 10;
  if (/ethernet|wi-?fi|wlan|wifi/i.test(addr.interfaceName)) score -= 5;
  return score;
}

/**
 * Non-internal IPv4 addresses on this machine — used for kiosk/QR LAN URLs.
 * Sorted best-first (real Ethernet/Wi-Fi before Hyper-V/WSL).
 */
export function listLanIpv4Addresses(): LanAddress[] {
  const result: LanAddress[] = [];
  const ifaces = networkInterfaces();
  for (const [name, entries] of Object.entries(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" && (entry.family as string) !== "4") continue;
      if (entry.internal) continue;
      result.push({ address: entry.address, interfaceName: name });
    }
  }
  return result.sort((a, b) => scoreLanAddress(a) - scoreLanAddress(b));
}

/** Prefer explicit PUBLIC_LAN_HOST host part, else best LAN IPv4. */
export function resolvePreferredLanHost(): string | null {
  const configured = env.PUBLIC_LAN_HOST?.trim();
  if (configured) {
    // PUBLIC_LAN_HOST may be `192.168.1.13` or `192.168.1.13:4000`
    return configured.split(":")[0] || configured;
  }
  return listLanIpv4Addresses()[0]?.address ?? null;
}

export function buildLanInfo() {
  const port = env.PORT;
  const addresses = listLanIpv4Addresses();
  const preferredHost = resolvePreferredLanHost();

  const ordered: LanAddress[] = [];
  if (preferredHost) {
    const match = addresses.find((a) => a.address === preferredHost);
    ordered.push(match ?? { address: preferredHost, interfaceName: "configured" });
  }
  for (const addr of addresses) {
    if (!ordered.some((a) => a.address === addr.address)) {
      ordered.push(addr);
    }
  }

  const kioskUrls = ordered.map((h) => ({
    host: h.address,
    interfaceName: h.interfaceName,
    origin: `http://${h.address}:${port}`,
    kioskUrl: `http://${h.address}:${port}/kiosk?native=1`,
    operatorUrl: `http://${h.address}:${port}/operator?native=1`,
  }));

  return {
    port,
    publicLanHost: env.PUBLIC_LAN_HOST ?? null,
    preferredHost,
    addresses: ordered,
    kioskUrls,
  };
}
