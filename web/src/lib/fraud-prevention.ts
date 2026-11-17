const DEVICE_KEY = "mtd.gov-client-device-id";

export interface BrowserFraudPrevention {
  deviceId: string;
  timezone: string;
  screens: string;
  windowSize: string;
  userAgent: string;
  doNotTrack: string;
  browserPlugins: string;
  userIds: string;
  localIps: string;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function deviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) {
      return existing;
    }
    const created = uuid();
    window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return uuid();
  }
}

function timezoneOffset(): string {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const rest = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${rest}`;
}

function pluginNames(): string {
  const plugins = typeof navigator !== "undefined" ? Array.from(navigator.plugins ?? []) : [];
  const names = plugins.map((plugin) => plugin.name).filter(Boolean);
  return names.length ? names.join(",") : "PDF Viewer";
}

function doNotTrack(): string {
  const value = typeof navigator !== "undefined" ? navigator.doNotTrack ?? (navigator as Navigator & { msDoNotTrack?: string }).msDoNotTrack : "0";
  return value === "1" || value === "yes" ? "true" : "false";
}

export function collectFraudPrevention(userId?: string | null): BrowserFraudPrevention {
  if (typeof window === "undefined") {
    return {
      deviceId: "00000000-0000-4000-8000-000000000000",
      timezone: "UTC+00:00",
      screens: "width=1920&height=1080&scaling-factor=1&colour-depth=24",
      windowSize: "width=1920&height=1080",
      userAgent: "Mozilla/5.0",
      doNotTrack: "false",
      browserPlugins: "PDF Viewer",
      userIds: "os=unknown",
      localIps: "127.0.0.1",
    };
  }
  const screenObj = window.screen;
  const platform = typeof navigator !== "undefined" ? navigator.platform || "unknown" : "unknown";
  return {
    deviceId: deviceId(),
    timezone: timezoneOffset(),
    screens: `width=${screenObj.width}&height=${screenObj.height}&scaling-factor=${window.devicePixelRatio || 1}&colour-depth=${screenObj.colorDepth || 24}`,
    windowSize: `width=${window.innerWidth}&height=${window.innerHeight}`,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Mozilla/5.0",
    doNotTrack: doNotTrack(),
    browserPlugins: pluginNames(),
    userIds: userId ? `mtd=${userId}` : `os=${platform}`,
    localIps: "127.0.0.1",
  };
}

export function fraudPreventionHeader(userId?: string | null): string {
  return JSON.stringify(collectFraudPrevention(userId));
}
