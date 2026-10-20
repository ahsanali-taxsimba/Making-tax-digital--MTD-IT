import { Injectable } from "@nestjs/common";

type Labels = Record<string, string>;

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();

  inc(name: string, labels: Labels = {}, amount = 1) {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
  }

  get(name: string, labels: Labels = {}) {
    return this.counters.get(this.key(name, labels)) ?? 0;
  }

  render(): string {
    const grouped = new Map<string, Array<{ labels: string; value: number }>>();
    for (const [key, value] of this.counters.entries()) {
      const [name, labels] = key.split("|");
      const rows = grouped.get(name) ?? [];
      rows.push({ labels, value });
      grouped.set(name, rows);
    }
    const lines: string[] = ["# HELP mtd_up 1 if the process is serving traffic", "# TYPE mtd_up gauge", "mtd_up 1"];
    for (const [name, rows] of grouped.entries()) {
      lines.push(`# TYPE ${name} counter`);
      for (const row of rows) {
        lines.push(row.labels ? `${name}{${row.labels}} ${row.value}` : `${name} ${row.value}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }

  private key(name: string, labels: Labels) {
    const encoded = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${escape(v)}"`)
      .join(",");
    return `${name}|${encoded}`;
  }
}

function escape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
