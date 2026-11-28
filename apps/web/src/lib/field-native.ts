/**
 * Ponte com o app Android "Bispo Campo" (Capacitor).
 * Dentro do app, o GPS é registrado por um serviço do Android com notificação fixa,
 * mesmo com a tela bloqueada. Os pontos são enviados pelo HTTP nativo (o da WebView
 * é limitado pelo Android depois de alguns minutos em segundo plano).
 * Fora do app, nada aqui é usado.
 */

type Location = { latitude: number; longitude: number; accuracy?: number | null; speed?: number | null; time?: number | null };
type Call = (options?: unknown, callback?: (location?: Location, error?: { code?: string; message?: string }) => void) => Promise<unknown>;
type Plugin = { addWatcher: Call; removeWatcher: Call; openSettings?: Call; post: Call };
type CapacitorGlobal = { isNativePlatform?: () => boolean; registerPlugin?: (name: string) => Plugin; Plugins?: Record<string, Plugin> };
export type FieldPoint = { at: string; lat: number; lng: number; accuracy: number | null; speed: number | null };

const STORE = "bbos.campo.pending";
const SEND_EVERY_MS = 60_000;
const MAX_BUFFER = 2_000;

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

function plugin(name: string): Plugin | null {
  const cap = capacitor();
  if (!cap) return null;
  return cap.Plugins?.[name] ?? cap.registerPlugin?.(name) ?? null;
}

function readPending(): FieldPoint[] {
  try { return JSON.parse(window.localStorage.getItem(STORE) ?? "[]") as FieldPoint[]; } catch { return []; }
}
function writePending(points: FieldPoint[]) {
  try { window.localStorage.setItem(STORE, JSON.stringify(points.slice(-MAX_BUFFER))); } catch { /* sem armazenamento: segue só em memória */ }
}

/** Converte a leitura do Android no formato aceito por POST /field/points. */
export function toFieldPoint(location: Location, now = Date.now()): FieldPoint | null {
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const at = Number.isFinite(location.time) && location.time ? location.time : now;
  return {
    at: new Date(at).toISOString(),
    lat: location.latitude,
    lng: location.longitude,
    accuracy: Number.isFinite(location.accuracy) ? Number(location.accuracy) : null,
    speed: Number.isFinite(location.speed) ? Number(location.speed) : null,
  };
}

let watcherId: string | null = null;
let buffer: FieldPoint[] = [];
let lastSent = 0;
let sending = false;

async function send(force = false) {
  if (sending || !buffer.length || (!force && Date.now() - lastSent < SEND_EVERY_MS)) return;
  sending = true;
  const points = buffer.splice(0, 500);
  const http = plugin("CapacitorHttp");
  try {
    const url = `${window.location.origin}/api/field/points`;
    const result = http
      ? ((await http.post({ url, headers: { "content-type": "application/json" }, data: { points } })) as { status?: number })
      : { status: (await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ points }) })).status };
    if (!result.status || result.status >= 500) throw new Error("falha no envio");
    lastSent = Date.now();
  } catch {
    buffer = [...points, ...buffer]; // sem sinal: tenta de novo no próximo ponto
  } finally {
    writePending(buffer);
    sending = false;
  }
}

export const fieldNative = {
  available: () => Boolean(plugin("BackgroundGeolocation")),

  async start() {
    const geo = plugin("BackgroundGeolocation");
    if (!geo || watcherId) return;
    buffer = [...readPending(), ...buffer];
    watcherId = String(
      await geo.addWatcher(
        {
          backgroundTitle: "Bispo Campo · dia em andamento",
          backgroundMessage: "Registrando o trajeto até você encerrar o dia.",
          requestPermissions: true,
          stale: false,
          distanceFilter: 20,
        },
        (location, error) => {
          if (error?.code === "NOT_AUTHORIZED") {
            if (window.confirm("O Bispo Campo precisa da localização para contar os km. Abrir as configurações?")) void geo.openSettings?.();
            return;
          }
          const point = location ? toFieldPoint(location) : null;
          if (!point) return;
          buffer.push(point);
          writePending(buffer);
          void send();
        },
      ),
    );
  },

  async stop() {
    const geo = plugin("BackgroundGeolocation");
    await send(true);
    if (geo && watcherId) await geo.removeWatcher({ id: watcherId }).catch(() => undefined);
    watcherId = null;
  },

  flush: () => send(true),
};
