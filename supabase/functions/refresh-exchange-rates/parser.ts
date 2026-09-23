export const currencies = ["USD", "CNY", "JPY", "EUR", "AUD"] as const;
export type ParsedRate = {
  currency: (typeof currencies)[number];
  spot_buy: number;
  spot_sell: number;
  cash_buy: number;
  cash_sell: number;
};

function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

export function parseEsunRates(html: string) {
  const text = visibleText(html);
  const timestamp = text.match(
    /(?:資料日期|更新時間)\s*[：:]?\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2}):(\d{2})/,
  );
  if (!timestamp) throw new Error("找不到玉山報價時間");
  const quoted_at = `${timestamp[1]}-${timestamp[2].padStart(2, "0")}-${timestamp[3].padStart(2, "0")}T${timestamp[4].padStart(2, "0")}:${timestamp[5]}:${timestamp[6]}+08:00`;
  const rates = currencies.map((currency, index) => {
    const codePattern = new RegExp(`\\b${currency}\\b`, "g");
    const occurrences = [...text.matchAll(codePattern)].map(
      (match) => match.index!,
    );
    let values: number[] = [];
    for (const start of occurrences) {
      const laterCodes = currencies.flatMap((item) =>
        [
          ...text
            .slice(start + currency.length)
            .matchAll(new RegExp(`\\b${item}\\b`, "g")),
        ].map((match) => start + currency.length + match.index!),
      );
      const end = laterCodes.length ? Math.min(...laterCodes) : start + 800;
      values = [
        ...text
          .slice(start, end)
          .matchAll(/(?<![\d.])(\d+(?:\.\d+)?)(?![\d.])/g),
      ]
        .map((match) => Number(match[1]))
        .filter((value) => Number.isFinite(value));
      if (values.length >= 4) break;
    }
    if (values.length < 4) throw new Error(`找不到 ${currency} 完整報價`);
    const cashOffset = values.length >= 6 ? 4 : 2;
    return {
      currency: currencies[index],
      spot_buy: values[0],
      spot_sell: values[1],
      cash_buy: values[cashOffset],
      cash_sell: values[cashOffset + 1],
    } satisfies ParsedRate;
  });
  return { quoted_at, rates };
}
