import { useState, type FormEvent } from "react";
import {
  searchFieldLabels,
  type SearchField,
  type SearchOperations,
  type SearchResult,
} from "./search";

export function SearchView({
  operations,
  openTask,
}: {
  operations?: SearchOperations;
  openTask: (taskId: string, noteId?: string, summaryId?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!operations || !query.trim()) return;
    setBusy(true);
    setError("");
    try {
      setResults(await operations.search(query.trim(), field));
      setSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  function open(result: SearchResult) {
    if (result.task_id)
      openTask(
        result.task_id,
        result.note_id ?? undefined,
        result.summary_id ?? undefined,
      );
  }

  return (
    <section className="history-search" aria-label="歷史搜尋">
      <div className="heading">
        <div>
          <p className="eyebrow">HISTORY SEARCH</p>
          <h1>找回工作紀錄</h1>
          <p className="muted">
            搜尋工作紀錄、任務欄位、Calendar 關聯與 AI Summary。ChatGPT 對話請在 ChatGPT 內搜尋。
          </p>
        </div>
      </div>
      <form className="search-form" onSubmit={submit}>
        <label>
          搜尋內容
          <input
            value={query}
            maxLength={500}
            placeholder="輸入關鍵字"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          指定欄位
          <select
            value={field}
            onChange={(event) => setField(event.target.value as SearchField)}
          >
            {Object.entries(searchFieldLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={busy || !operations || !query.trim()}
        >
          {busy ? "搜尋中…" : "搜尋"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="search-count" role="status">
        {searched ? `找到 ${results.length} 筆結果` : ""}
      </p>
      <ol className="search-results">
        {results.map((result) => (
          <li
            key={`${result.result_type}-${result.result_id}-${result.matched_field}`}
          >
            <button onClick={() => open(result)}>
              <span className="search-result-meta">
                {searchFieldLabels[result.matched_field]} ·{" "}
                {new Date(result.occurred_at).toLocaleString("zh-TW")}
              </span>
              <strong>{result.result_title}</strong>
              <span className="search-snippet">{result.snippet}</span>
            </button>
          </li>
        ))}
      </ol>
      {searched && !results.length && (
        <p className="subtle">沒有符合的歷史紀錄。</p>
      )}
    </section>
  );
}
