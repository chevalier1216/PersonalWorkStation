export type CalendarDayInput = {
  region: "CN" | "TW";
  day: string;
  day_type: "holiday" | "workday";
  name: string;
  source_url: string;
};

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const eachDate = (year: number, startMonth: number, startDay: number, endMonth: number, endDay: number) => {
  const result: string[] = [];
  const cursor = new Date(Date.UTC(year, startMonth - 1, startDay));
  const end = new Date(Date.UTC(year, endMonth - 1, endDay));
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
};

const textFromHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

export function parseChinaNotice(html: string, sourceUrl: string, year: number): CalendarDayInput[] {
  const text = textFromHtml(html);
  const names = ["元旦", "春节", "清明节", "劳动节", "端午节", "中秋节", "国庆节"];
  const rows = new Map<string, CalendarDayInput>();

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    const nextName = names[index + 1];
    const start = text.indexOf(`${name}：`);
    const end = nextName ? text.indexOf(`${nextName}：`, start + name.length) : text.length;
    if (start < 0 || end < 0) throw new Error(`中國官方公告缺少${name}段落`);
    const section = text.slice(start, end);
    const range = section.match(/(\d{1,2})月(\d{1,2})日[^至]{0,40}至(?:(\d{1,2})月)?(\d{1,2})日[^。]*放假/);
    if (!range) throw new Error(`無法解析${name}放假區間`);
    const startMonth = Number(range[1]);
    const startDay = Number(range[2]);
    const endMonth = Number(range[3] ?? range[1]);
    const endDay = Number(range[4]);
    for (const day of eachDate(year, startMonth, startDay, endMonth, endDay)) {
      rows.set(day, { region: "CN", day, day_type: "holiday", name, source_url: sourceUrl });
    }
    for (const sentence of section.split("。")) {
      if (!sentence.includes("上班")) continue;
      for (const match of sentence.matchAll(/(\d{1,2})月(\d{1,2})日/g)) {
        const day = isoDate(year, Number(match[1]), Number(match[2]));
        rows.set(day, { region: "CN", day, day_type: "workday", name: `${name}補班`, source_url: sourceUrl });
      }
    }
  }

  if (rows.size < 35) throw new Error(`中國官方公告只解析到 ${rows.size} 筆，拒絕覆寫`);
  return [...rows.values()].sort((a, b) => a.day.localeCompare(b.day));
}

const parseCsvLine = (line: string) => {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      value += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      fields.push(value);
      value = "";
    } else value += char;
  }
  fields.push(value);
  return fields;
};

export function parseTaiwanCsv(csv: string, sourceUrl: string, year: number): CalendarDayInput[] {
  const rows: CalendarDayInput[] = [];
  for (const line of csv.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [rawDate, , rawHoliday, rawNote = ""] = parseCsvLine(line);
    if (!/^\d{8}$/.test(rawDate) || !["0", "2"].includes(rawHoliday)) continue;
    if (Number(rawDate.slice(0, 4)) !== year) continue;
    const day = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = rawHoliday === "2";
    const note = rawNote.trim();
    if ((isHoliday === isWeekend && !note) || (!isHoliday && !isWeekend)) continue;
    rows.push({
      region: "TW",
      day,
      day_type: isHoliday ? "holiday" : "workday",
      name: note || (isHoliday ? "假日" : "補班"),
      source_url: sourceUrl,
    });
  }
  if (rows.length < 10) throw new Error(`台灣官方 CSV 只解析到 ${rows.length} 筆，拒絕覆寫`);
  return rows;
}
