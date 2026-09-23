import { describe, expect, it } from "vitest";
import { parseEsunRates } from "../supabase/functions/refresh-exchange-rates/parser";

describe("E.SUN exchange rate parser", () => {
  it("extracts spot and cash rates for the five approved currencies", () => {
    const html = `<p>資料日期：2026年09月23日 10:48:00</p>
      <div>USD 銀行買入 銀行賣出 31.63 31.73 31.661 31.699 31.38 31.93</div>
      <div>CNY 銀行買入 銀行賣出 4.701 4.751 4.716 4.736 4.655 4.815</div>
      <div>JPY 0.199 0.203 0.2002 0.2018 0.198 0.205</div>
      <div>EUR 37.1 37.5 37.2 37.4 36.7 37.9</div>
      <div>AUD 20.8 21.2 20.9 21.1 20.3 21.7</div>`;
    const result = parseEsunRates(html);
    expect(result.quoted_at).toBe("2026-09-23T10:48:00+08:00");
    expect(result.rates).toHaveLength(5);
    expect(result.rates[0]).toMatchObject({
      currency: "USD",
      spot_buy: 31.63,
      spot_sell: 31.73,
      cash_buy: 31.38,
      cash_sell: 31.93,
    });
    expect(result.rates[1].currency).toBe("CNY");
  });

  it("fails closed when a requested currency is absent", () => {
    expect(() =>
      parseEsunRates("資料日期：2026年09月23日 10:48:00 USD 1 2 3 4"),
    ).toThrow("CNY");
  });
});
