import { useEffect, useState } from "react";
import type { Snapshot } from "./domain";
import {
  emptySummaryState,
  type SummaryOperations,
  type SummaryState,
} from "./summary";

export function SummaryView({
  operations,
  tasks,
  openTask,
}: {
  operations?: SummaryOperations;
  tasks: Snapshot["tasks"];
  openTask: (taskId: string, summaryId: string) => void;
}) {
  const [state, setState] = useState<SummaryState>(emptySummaryState);
  const [busy, setBusy] = useState(Boolean(operations));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!operations) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    operations
      .load()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [operations]);

  const summaries = [...state.summaries].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return (
    <section className="summary-view" aria-label="AI 摘要">
      <div className="heading">
        <div>
          <p className="eyebrow">AI SUMMARY</p>
          <h1>AI 摘要</h1>
          <p className="muted">查看所有 Task 的摘要版本與來源。</p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="status" role="status">
        {busy ? "載入摘要…" : `${summaries.length} 份摘要`}
      </p>
      <ol className="summary-index">
        {summaries.map((summary) => {
          const task = tasks.find((item) => item.id === summary.task_id);
          return (
            <li key={summary.id}>
              <button
                disabled={!task}
                onClick={() => task && openTask(task.id, summary.id)}
              >
                <span>{summary.version_label}</span>
                <strong>{summary.title}</strong>
                <small>來源 Task：{task?.title ?? "已刪除的 Task"}</small>
                <time>
                  {new Date(summary.created_at).toLocaleString("zh-TW")}
                </time>
              </button>
            </li>
          );
        })}
      </ol>
      {!busy && !summaries.length && (
        <p className="subtle">尚無摘要。可從 Task 詳細資料使用「@AI 整理」。</p>
      )}
    </section>
  );
}
