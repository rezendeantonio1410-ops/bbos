"use client";

const KEY = "bbos:intelligence:route-visits:v1";

type Visit = { path: string; at: number };
type FrictionSignal = { repeated: boolean; visits: number; message?: string };

function readVisits(): Visit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Visit[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRouteVisit(path: string): FrictionSignal {
  if (typeof window === "undefined") return { repeated: false, visits: 0 };
  const now = Date.now();
  const windowMs = 20 * 60 * 1000;
  const recent = readVisits().filter((visit) => now - visit.at <= windowMs);
  recent.push({ path, at: now });
  window.localStorage.setItem(KEY, JSON.stringify(recent.slice(-80)));
  const visits = recent.filter((visit) => visit.path === path).length;
  if (visits >= 3) {
    return {
      repeated: true,
      visits,
      message: `Você voltou ${visits} vezes a esta área nos últimos minutos. Posso ajudar a concluir esta tarefa com menos passos.`,
    };
  }
  return { repeated: false, visits };
}

export function dismissRouteHelp(path: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`bbos:intelligence:dismiss:${path}`, "1");
}

export function routeHelpDismissed(path: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`bbos:intelligence:dismiss:${path}`) === "1";
}
