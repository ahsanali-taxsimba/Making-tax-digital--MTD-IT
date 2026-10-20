import { AlertsService } from "./alerts.service";
import { MetricsService } from "./metrics.service";

describe("AlertsService", () => {
  it("escalates repeated failed logins", () => {
    const alerts = new AlertsService(new MetricsService());
    for (let i = 0; i < 5; i += 1) {
      alerts.loginFailed("james@northbridge.test");
    }
    expect(alerts.emitted.some((row) => row.kind === "auth.suspicious_activity")).toBe(true);
  });

  it("flags abnormal VAT box 5", () => {
    const alerts = new AlertsService(new MetricsService());
    alerts.abnormalVat(2_500_000, { periodKey: "26A1" });
    expect(alerts.emitted[0].kind).toBe("vat.abnormal_value");
  });
});
