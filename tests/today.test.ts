import { describe, expect, it } from "vitest";
import { nextChinaWorkdays } from "../src/Today";
import type { CalendarDay } from "../src/domain";

function day(
  value: string,
  day_type: CalendarDay["day_type"],
): CalendarDay {
  return {
    region: "CN",
    day: value,
    day_type,
    name: "official override",
    source_url: "https://www.gov.cn/",
    fetched_at: "2026-01-01T00:00:00Z",
  };
}

describe("China workday calendar", () => {
  it("honors official weekend workdays and holiday overrides", () => {
    const calendar = [
      day("2026-09-20", "workday"),
      day("2026-09-25", "holiday"),
      day("2026-09-26", "holiday"),
      day("2026-09-27", "holiday"),
    ];
    const dates = nextChinaWorkdays(
      new Date("2026-09-19T12:00:00"),
      calendar,
      6,
    ).map(
      (value) =>
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
    );
    expect(dates).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-28",
    ]);
  });
});
