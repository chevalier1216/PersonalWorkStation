import { readdirSync, readFileSync } from "node:fs";

const expectedVersions = readdirSync("supabase/migrations")
  .map((name) => /^(\d{12})_.+\.sql$/.exec(name)?.[1])
  .filter(Boolean)
  .sort();

const source = process.argv[2]
  ? readFileSync(process.argv[2], "utf8")
  : await new Promise((resolve) => {
      let value = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => (value += chunk));
      process.stdin.on("end", () => resolve(value));
    });

const remoteVersions = new Set();
const jsonStart = source.indexOf('{"migrations"');
if (jsonStart >= 0) {
  const payload = JSON.parse(source.slice(jsonStart).trim());
  for (const migration of payload.migrations ?? []) {
    if (/^\d{12}$/.test(migration.remote ?? "")) {
      remoteVersions.add(migration.remote);
    }
  }
} else {
  for (const line of source.split(/\r?\n/)) {
    const columns = line
      .split("|")
      .map((value) => value.trim().replaceAll("`", ""));
    if (columns.length < 2) continue;
    if (/^\d{12}$/.test(columns[1])) remoteVersions.add(columns[1]);
  }
}

const missing = expectedVersions.filter(
  (version) => !remoteVersions.has(version),
);
const unknown = [...remoteVersions].filter(
  (version) => !expectedVersions.includes(version),
);

if (missing.length || unknown.length) {
  console.error("Production Migration History FAIL");
  if (missing.length) console.error(`- Production 缺少：${missing.join(", ")}`);
  if (unknown.length) console.error(`- Repo 缺少：${unknown.join(", ")}`);
  process.exit(1);
}

console.log(
  `Production Migration History PASS: ${expectedVersions.length} 個 repo versions 均已登錄。`,
);
