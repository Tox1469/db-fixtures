import * as fs from "fs";
import * as path from "path";

export interface FixtureClient {
  query(sql: string, params?: any[]): Promise<any>;
}

export type FixtureData = Record<string, Record<string, any>[]>;

export class Fixtures {
  constructor(private client: FixtureClient) {}

  async loadFile(filePath: string): Promise<number> {
    const raw = fs.readFileSync(filePath, "utf8");
    const data: FixtureData = JSON.parse(raw);
    return this.load(data);
  }

  async loadDir(dirPath: string): Promise<number> {
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
    let total = 0;
    for (const f of files) total += await this.loadFile(path.join(dirPath, f));
    return total;
  }

  async load(data: FixtureData): Promise<number> {
    let count = 0;
    for (const [table, rows] of Object.entries(data)) {
      for (const row of rows) {
        const keys = Object.keys(row);
        const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
        const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${ph})`;
        await this.client.query(sql, keys.map((k) => row[k]));
        count++;
      }
    }
    return count;
  }

  async truncate(tables: string[]): Promise<void> {
    for (const t of tables) {
      await this.client.query(`DELETE FROM ${t}`);
    }
  }

  async dump(tables: string[]): Promise<FixtureData> {
    const out: FixtureData = {};
    for (const t of tables) {
      const res = await this.client.query(`SELECT * FROM ${t}`);
      out[t] = (res?.rows ?? res ?? []) as Record<string, any>[];
    }
    return out;
  }

  saveDump(data: FixtureData, filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
