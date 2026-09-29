import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const migrationDirectory = path.resolve("supabase/migrations");
const filenamePattern = /^(\d{12})_([a-z0-9_]+)\.sql$/;
const files = readdirSync(migrationDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

const errors = [];
const versions = new Set();

for (const file of files) {
  const match = filenamePattern.exec(file);
  if (!match) {
    errors.push(`${file}: 檔名必須符合 YYYYMMDDHHMM_description.sql`);
    continue;
  }
  if (versions.has(match[1])) {
    errors.push(`${file}: migration version ${match[1]} 重複`);
  }
  versions.add(match[1]);
  if (!readFileSync(path.join(migrationDirectory, file), "utf8").trim()) {
    errors.push(`${file}: migration 不得為空檔`);
  }
}

const baseRef = process.env.MIGRATION_BASE_REF?.trim();
if (baseRef) {
  const diff = execFileSync(
    "git",
    ["diff", "--name-status", `${baseRef}...HEAD`, "--", "supabase/migrations"],
    { encoding: "utf8" },
  ).trim();
  for (const line of diff ? diff.split(/\r?\n/) : []) {
    const [status, ...names] = line.split(/\s+/);
    if (status !== "A") {
      errors.push(
        `${names.join(" -> ")}: 已存在的 migration 只能追加，不得修改、刪除或改名（${status}）`,
      );
    }
  }
}

if (errors.length) {
  console.error(`Migration guard FAIL\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `Migration guard PASS: ${files.length} 份 migration，版本唯一、非空${baseRef ? "，且相對 Base 只有新增檔" : ""}。`,
);
