import { supabase } from "./api";

export type ExchangeRate = {
  currency: "USD" | "CNY" | "JPY" | "EUR" | "AUD";
  spot_buy: number;
  spot_sell: number;
  cash_buy: number;
  cash_sell: number;
  quoted_at: string;
  fetched_at: string;
  source_url: string;
};

export type ExchangeRateState = {
  rates: ExchangeRate[];
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string;
};

export const emptyExchangeRateState: ExchangeRateState = {
  rates: [],
  last_attempt_at: null,
  last_success_at: null,
  last_error: "",
};

export type ExchangeRateOperations = {
  load: () => Promise<ExchangeRateState>;
  refresh: () => Promise<ExchangeRateState>;
};

export async function loadExchangeRates(): Promise<ExchangeRateState> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("exchange_rate_state");
  if (error) throw new Error(error.message);
  return { ...emptyExchangeRateState, ...(data as Partial<ExchangeRateState>) };
}

export async function refreshExchangeRates(): Promise<ExchangeRateState> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { error } = await supabase.functions.invoke("refresh-exchange-rates");
  const state = await loadExchangeRates();
  if (error && !state.last_error) throw new Error(error.message);
  return state;
}

export function ExchangeRates({
  state,
  busy,
  refresh,
}: {
  state: ExchangeRateState;
  busy: boolean;
  refresh: () => void;
}) {
  return (
    <section
      className="today-module exchange-rates"
      aria-label="玉山銀行外幣匯率"
    >
      <div className="module-heading">
        <div>
          <p className="eyebrow">E.SUN BANK · TWD</p>
          <h2>外幣匯率</h2>
          <p className="subtle">
            {state.last_success_at
              ? `最後更新 ${new Date(state.last_success_at).toLocaleString("zh-TW")}`
              : "尚無成功同步資料"}
          </p>
        </div>
        <button disabled={busy} onClick={refresh}>
          {busy ? "更新中…" : state.last_error ? "重試" : "更新報價"}
        </button>
      </div>
      {state.last_error && (
        <p className="error" role="alert">
          更新失敗：{state.last_error}。已保留最後成功報價。
        </p>
      )}
      {state.rates.length ? (
        <div className="rate-table-wrap">
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>幣別</th>
                <th colSpan={2}>即期</th>
                <th colSpan={2}>現金</th>
              </tr>
              <tr>
                <th>銀行買入</th>
                <th>銀行賣出</th>
                <th>銀行買入</th>
                <th>銀行賣出</th>
              </tr>
            </thead>
            <tbody>
              {state.rates.map((rate) => (
                <tr key={rate.currency}>
                  <th>
                    {rate.currency === "CNY" ? "RMB／CNY" : rate.currency}
                  </th>
                  <td>{rate.spot_buy}</td>
                  <td>{rate.spot_sell}</td>
                  <td>{rate.cash_buy}</td>
                  <td>{rate.cash_sell}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="subtle">按「更新報價」取得 USD、RMB、JPY、EUR、AUD。</p>
      )}
      <p className="subtle">
        僅供參考，實際交易以玉山銀行交易當時匯率為準。{" "}
        <a
          href="https://www.esunbank.com/zh-tw/personal/deposit/rate/forex/foreign-exchange-rates"
          target="_blank"
          rel="noreferrer"
        >
          官方來源
        </a>
      </p>
    </section>
  );
}
