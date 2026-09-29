import { readFileSync } from "node:fs";

const [, , expectedPath, actualPath] = process.argv;
if (!expectedPath || !actualPath) {
  console.error(
    "Usage: node scripts/compare-migration-catalogs.mjs <expected.json> <actual.json>",
  );
  process.exit(2);
}

const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
const actual = JSON.parse(readFileSync(actualPath, "utf8"));

function normalizeSqlWhitespace(sql) {
  let result = "";
  let quote = null;
  let pendingSpace = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      result += char;
      if (char === quote) {
        if (sql[index + 1] === quote) {
          result += sql[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      if (pendingSpace && result && !result.endsWith(" ")) result += " ";
      pendingSpace = false;
      quote = char;
      result += char;
      continue;
    }
    if (/\s/.test(char)) {
      pendingSpace = true;
      continue;
    }
    if (pendingSpace && result && !result.endsWith(" ")) result += " ";
    pendingSpace = false;
    result += char;
  }
  return result.trim();
}

function normalized(value, parentKey = "") {
  if (Array.isArray(value))
    return value.map((item) => normalized(item, parentKey));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        normalized(child, key),
      ]),
    );
  }
  if (typeof value === "string" && parentKey === "definition") {
    return normalizeSqlWhitespace(value);
  }
  return value;
}

const categories = [
  "tables",
  "policies",
  "functions",
  "triggers",
  "attachment_bucket",
];
const mismatches = [];

for (const category of categories) {
  const expectedValue = normalized(expected[category] ?? []);
  const actualValue = normalized(actual[category] ?? []);
  if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
    mismatches.push(category);
  }
  console.log(
    `${category}: expected=${expectedValue.length}, production=${actualValue.length}, ${mismatches.includes(category) ? "DIFF" : "MATCH"}`,
  );
}

if (mismatches.length) {
  console.error(`Catalog comparison FAIL: ${mismatches.join(", ")}`);
  process.exit(1);
}

console.log(
  "Catalog comparison PASS: Production 與 14 份 migrations 的最終結構一致。",
);
