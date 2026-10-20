import { Injectable, Logger } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

export type AlertKind =
  | "auth.login_failed"
  | "auth.mfa_failed"
  | "auth.suspicious_activity"
  | "vat.abnormal_value"
  | "itsa.abnormal_value"
  | "bank.reconciliation_anomaly"
  | "http.high_volume"
  | "document.deletion_spike";

export interface SecurityAlert {
  kind: AlertKind;
  severity: "info" | "warning" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
  at: string;
}

const WINDOW_MS = 10 * 60 * 1000;
const LOGIN_SPIKE = 5;
const DELETE_SPIKE = 8;
const VOLUME_SPIKE = 120;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger("SecurityAlerts");
  private readonly events: Array<{ kind: AlertKind; at: number }> = [];
  readonly emitted: SecurityAlert[] = [];

  constructor(private readonly metrics: MetricsService) {}

  loginFailed(email: string, metadata: Record<string, unknown> = {}) {
    this.emit("auth.login_failed", "warning", "Failed login", { email, ...metadata });
    if (this.count("auth.login_failed") >= LOGIN_SPIKE) {
      this.emit("auth.suspicious_activity", "critical", "Repeated failed logins", { email });
    }
  }

  mfaFailed(userId: string, metadata: Record<string, unknown> = {}) {
    this.emit("auth.mfa_failed", "warning", "MFA verification failed", { userId, ...metadata });
  }

  documentDeleted(actorId: string) {
    this.note("document.deletion_spike");
    if (this.count("document.deletion_spike") >= DELETE_SPIKE) {
      this.emit("document.deletion_spike", "critical", "Document deletion spike", { actorId });
    }
  }

  httpHit(service: string) {
    this.note("http.high_volume");
    if (this.count("http.high_volume") >= VOLUME_SPIKE) {
      this.emit("http.high_volume", "warning", "High-volume API calls", { service });
    }
  }

  abnormalVat(box5: number, metadata: Record<string, unknown> = {}) {
    if (Math.abs(box5) >= 1_000_000) {
      this.emit("vat.abnormal_value", "warning", "Abnormal VAT net due", { box5, ...metadata });
    }
  }

  abnormalItsa(turnover: number, metadata: Record<string, unknown> = {}) {
    if (Math.abs(turnover) >= 10_000_000) {
      this.emit("itsa.abnormal_value", "warning", "Abnormal ITSA turnover", { turnover, ...metadata });
    }
  }

  reconciliationAnomaly(metadata: Record<string, unknown> = {}) {
    this.emit("bank.reconciliation_anomaly", "warning", "Reconciliation anomaly", metadata);
  }

  emit(kind: AlertKind, severity: SecurityAlert["severity"], message: string, metadata: Record<string, unknown> = {}) {
    this.note(kind);
    const alert: SecurityAlert = { kind, severity, message, metadata, at: new Date().toISOString() };
    this.emitted.push(alert);
    this.metrics.inc("mtd_security_alerts_total", { kind, severity });
    this.logger.warn(JSON.stringify({ alert: true, ...alert }));
  }

  private note(kind: AlertKind) {
    const now = Date.now();
    this.events.push({ kind, at: now });
    while (this.events[0] && now - this.events[0].at > WINDOW_MS) {
      this.events.shift();
    }
  }

  private count(kind: AlertKind) {
    const cutoff = Date.now() - WINDOW_MS;
    return this.events.filter((event) => event.kind === kind && event.at >= cutoff).length;
  }
}
