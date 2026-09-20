import { describe, expect, it } from "vitest";
import { parseChinaNotice, parseTaiwanCsv } from "../supabase/functions/refresh-holidays/parser";

describe("official holiday source parsers", () => {
  it("parses China holiday ranges and replacement workdays", () => {
    const html = `<p>一、元旦：1月1日（周四）至3日（周六）放假调休，共3天。1月4日（周日）上班。</p>
      <p>二、春节：2月15日（周日）至23日（周一）放假调休，共9天。2月14日（周六）、2月28日（周六）上班。</p>
      <p>三、清明节：4月4日（周六）至6日（周一）放假，共3天。</p>
      <p>四、劳动节：5月1日（周五）至5日（周二）放假调休，共5天。5月9日（周六）上班。</p>
      <p>五、端午节：6月19日（周五）至21日（周日）放假，共3天。</p>
      <p>六、中秋节：9月25日（周五）至27日（周日）放假，共3天。</p>
      <p>七、国庆节：10月1日（周四）至7日（周三）放假调休，共7天。9月20日（周日）、10月10日（周六）上班。</p>`;
    const rows = parseChinaNotice(html, "https://official.example/cn", 2026);
    expect(rows).toContainEqual(expect.objectContaining({ day: "2026-01-04", day_type: "workday" }));
    expect(rows).toContainEqual(expect.objectContaining({ day: "2026-02-23", name: "春节" }));
    expect(rows).toContainEqual(expect.objectContaining({ day: "2026-10-10", day_type: "workday" }));
  });

  it("keeps named Taiwan holidays and weekend replacement workdays", () => {
    const csv = `\uFEFF西元日期,星期,是否放假,備註\r\n20260101,四,2,開國紀念日\r\n20260102,五,0,\r\n20260103,六,2,\r\n20260215,日,2,小年夜\r\n20260220,五,2,補假\r\n20260221,六,0,補行上班\r\n20261225,五,2,行憲紀念日\r\n20261226,六,2,\r\n20260928,一,2,教師節\r\n20261009,五,2,補假\r\n20261010,六,2,國慶日\r\n20261025,日,2,臺灣光復紀念日\r\n20261026,一,2,補假\r\n20260403,五,2,補假\r\n20260404,六,2,兒童節\r\n20260405,日,2,清明節\r\n20260406,一,2,補假`;
    const rows = parseTaiwanCsv(csv, "https://official.example/tw", 2026);
    expect(rows).toContainEqual(expect.objectContaining({ day: "2026-02-21", day_type: "workday" }));
    expect(rows).toContainEqual(expect.objectContaining({ day: "2026-01-01", name: "開國紀念日" }));
    expect(rows.some((row) => row.day === "2026-01-03")).toBe(false);
  });
});
