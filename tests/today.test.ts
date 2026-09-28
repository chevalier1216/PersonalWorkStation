import { describe, expect, it } from "vitest";
import { calendarMonthDates, nextChinaWorkdays } from "../src/Today";
import type { CalendarDay } from "../src/domain";

function day(value: string, day_type: CalendarDay["day_type"]): CalendarDay {
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

describe("expanded Calendar months", () => {
  it("includes every date through the end of the following month", () => {
    const months = calendarMonthDates(new Date(2026, 8, 28));
    const dates = months.flatMap((month) =>
      month.dates.map((date) => date.toLocaleDateString("sv-SE")),
    );
    expect(months.map((month) => month.key)).toEqual(["2026-09", "2026-10"]);
    expect(months.map((month) => month.dates.length)).toEqual([30, 31]);
    expect(dates[0]).toBe("2026-09-01");
    expect(dates.at(-1)).toBe("2026-10-31");
    for (let index = 1; index < dates.length; index++) {
      const previous = months.flatMap((month) => month.dates)[index - 1];
      const current = months.flatMap((month) => month.dates)[index];
      expect(current.getTime() - previous.getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });
});
