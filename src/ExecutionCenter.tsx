import { useMemo, useState, type FormEvent } from "react";
import type { Task } from "./domain";
import {
  runDuration,
  workflowStatusLabels,
  type WorkflowNode,
  type WorkflowState,
  type WorkflowStatus,
} from "./workflow";
import type { LocalExecutorOperations } from "./localExecutor";

const statusSymbols: Record<WorkflowStatus, string> = {
  queued: "○",
  running: "●",
  waiting_external: "◌",
  waiting_human: "!",
  retrying: "↻",
  paused: "‖",
  failed: "×",
  success: "✓",
  cancelled: "–",
};

function jsonText(value: Record<string, unknown>) {
  return Object.keys(value).length ? JSON.stringify(value, null, 2) : "—";
}

export function ExecutionCenter({
  state,
  busy,
  selectedRunId,
  selectRun,
  run,
  tasks,
  openTask,
  executeLocal,
}: {
  state: WorkflowState;
  busy: boolean;
  selectedRunId: string | null;
  selectRun: (id: string) => void;
  run: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
  tasks: Task[];
  openTask: (id: string) => void;
  executeLocal?: LocalExecutorOperations["execute"];
}) {
  const [view, setView] = useState<"runs" | "graph" | "timeline" | "detail">(
    "runs",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | WorkflowStatus>(
    "all",
  );
  const [projectFilter, setProjectFilter] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [taskId, setTaskId] = useState("");
  const [gateResponse, setGateResponse] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const selectedRun =
    state.runs.find((item) => item.id === selectedRunId) ??
    state.runs[0] ??
    null;
  const nodes = selectedRun
    ? state.nodes
        .filter((item) => item.run_id === selectedRun.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const selectedNode =
    nodes.find((item) => item.id === selectedNodeId) ??
    nodes.find((item) => item.id === selectedRun?.current_node_id) ??
    nodes[0] ??
    null;
  const events = selectedRun
    ? state.events.filter((item) => item.run_id === selectedRun.id)
    : [];
  const artifacts = selectedRun
    ? state.artifacts.filter((item) => item.run_id === selectedRun.id)
    : [];
  const logs = selectedRun
    ? state.logs.filter((item) => item.run_id === selectedRun.id)
    : [];
  const gates = selectedRun
    ? state.human_gates.filter((item) => item.run_id === selectedRun.id)
    : [];
  const selectedNodeLogs = selectedNode
    ? logs.filter((item) => item.node_id === selectedNode.id)
    : [];
  const selectedNodeArtifacts = selectedNode
    ? artifacts.filter((item) => item.node_id === selectedNode.id)
    : [];
  const filteredRuns = useMemo(
    () =>
      state.runs.filter(
        (item) =>
          (statusFilter === "all" || item.status === statusFilter) &&
          (!projectFilter || item.project === projectFilter) &&
          (!taskFilter || item.task_id === taskFilter),
      ),
    [state.runs, statusFilter, projectFilter, taskFilter],
  );
  const projects = [
    ...new Set(state.runs.map((item) => item.project).filter(Boolean)),
  ];

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (
      await run("create_run", {
        title: title.trim(),
        source: "工作台",
        project: project.trim(),
        task_id: taskId || null,
        executor: "待連接",
        input: { request: title.trim() },
      })
    ) {
      setTitle("");
      setProject("");
      setTaskId("");
    }
  }

  return (
    <section className="execution-center" aria-label="AI 執行中心">
      <div className="heading">
        <div>
          <p className="eyebrow">AI EXECUTION CENTER</p>
          <h1>AI 執行中心</h1>
          <p className="muted">唯讀觀察 Run、Node、驗證、事件與交付物。</p>
        </div>
      </div>

      <nav className="execution-tabs" aria-label="執行中心檢視">
        {(["runs", "graph", "timeline", "detail"] as const).map((item) => (
          <button
            key={item}
            aria-current={view === item ? "page" : undefined}
            onClick={() => setView(item)}
          >
            {item === "runs"
              ? "Runs"
              : item === "graph"
                ? "Graph"
                : item === "timeline"
                  ? "Timeline"
                  : "Detail"}
          </button>
        ))}
      </nav>

      {view === "runs" && (
        <div className="execution-runs-layout">
          <div>
            <form className="run-create" onSubmit={create}>
              <h2>建立可追蹤 Run</h2>
              <label>
                Run 標題
                <input
                  value={title}
                  maxLength={300}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Project
                <input
                  value={project}
                  maxLength={300}
                  onChange={(e) => setProject(e.target.value)}
                />
              </label>
              <label>
                關聯 Task
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                >
                  <option value="">不關聯</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" disabled={busy || !title.trim()}>
                建立 Run
              </button>
              <p className="subtle">
                尚未連接 executor 時會顯示 Waiting External，不會假裝已執行。
              </p>
            </form>
            <div className="run-filters">
              <label>
                狀態
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | WorkflowStatus)
                  }
                >
                  <option value="all">全部</option>
                  {Object.entries(workflowStatusLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Project
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="">全部</option>
                  {projects.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Task
                <select
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value)}
                >
                  <option value="">全部</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <ol className="run-list">
            {filteredRuns.map((item) => (
              <li key={item.id}>
                <button
                  className={item.id === selectedRun?.id ? "selected" : ""}
                  onClick={() => {
                    selectRun(item.id);
                    setView("graph");
                  }}
                >
                  <span className={`workflow-status ${item.status}`}>
                    {statusSymbols[item.status]}{" "}
                    {workflowStatusLabels[item.status]}
                  </span>
                  <strong>{item.title}</strong>
                  <code>{item.run_code}</code>
                  <small>
                    {item.project || "未指定 Project"} · {runDuration(item)} 秒
                  </small>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {view !== "runs" && !selectedRun && <p className="subtle">尚無 Run。</p>}

      {view === "graph" && selectedRun && (
        <div
          className="workflow-graph"
          aria-label={`Graph ${selectedRun.run_code}`}
        >
          {nodes.map((node, index) => (
            <div className="graph-step" key={node.id}>
              <button
                className={`workflow-node ${node.status}${selectedNode?.id === node.id ? " selected" : ""}`}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setView("detail");
                }}
              >
                <span>{statusSymbols[node.status]}</span>
                <strong>{node.name}</strong>
                <small>{workflowStatusLabels[node.status]}</small>
              </button>
              {index < nodes.length - 1 && (
                <span className="graph-edge">→</span>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "timeline" && selectedRun && (
        <ol className="workflow-timeline">
          {[...events].reverse().map((event) => (
            <li key={event.id}>
              <time>{new Date(event.created_at).toLocaleString("zh-TW")}</time>
              <strong>{event.title}</strong>
              <small>{event.event_type}</small>
            </li>
          ))}
        </ol>
      )}

      {view === "detail" && selectedRun && (
        <div className="workflow-detail">
          <section>
            <h2>{selectedRun.title}</h2>
            <p>
              <code>{selectedRun.run_code}</code> ·{" "}
              {workflowStatusLabels[selectedRun.status]}
            </p>
            <p>
              Source：{selectedRun.source} · Executor：
              {selectedRun.executor || "未連接"}
            </p>
            {selectedRun.task_id && (
              <button onClick={() => openTask(selectedRun.task_id!)}>
                開啟關聯 Task：
                {tasks.find((task) => task.id === selectedRun.task_id)?.title ??
                  selectedRun.task_id}
              </button>
            )}
            {selectedRun.error && (
              <p className="error" role="alert">
                {selectedRun.error}
              </p>
            )}
            {selectedRun.status === "waiting_external" && (
              <div className="local-executor-action">
                <button
                  className="primary"
                  disabled={busy || localBusy || !executeLocal}
                  onClick={() => {
                    if (!executeLocal) return;
                    setLocalBusy(true);
                    setLocalError("");
                    executeLocal(selectedRun.id)
                      .catch((reason) =>
                        setLocalError(
                          reason instanceof Error
                            ? reason.message
                            : String(reason),
                        ),
                      )
                      .finally(() => setLocalBusy(false));
                  }}
                >
                  {localBusy ? "本機 Codex 執行中…" : "交給本機 Codex"}
                </button>
                <p className="subtle">
                  使用本機 Codex CLI 與目前訂閱額度；需先啟動本機 bridge。
                </p>
                {localError && (
                  <p className="error" role="alert">
                    {localError}
                  </p>
                )}
              </div>
            )}
          </section>
          {selectedNode && (
            <section>
              <h3>{selectedNode.name}</h3>
              <dl>
                <dt>Type</dt>
                <dd>{selectedNode.type}</dd>
                <dt>Status</dt>
                <dd>{workflowStatusLabels[selectedNode.status]}</dd>
                <dt>Tool</dt>
                <dd>{selectedNode.tool || "—"}</dd>
                <dt>Retry</dt>
                <dd>{selectedNode.retry_count}</dd>
              </dl>
              <h4>Input</h4>
              <pre>{jsonText(selectedNode.input)}</pre>
              <h4>Output</h4>
              <pre>{jsonText(selectedNode.output)}</pre>
              <h4>Verification</h4>
              <pre>{jsonText(selectedNode.verification)}</pre>
              {selectedNode.error && (
                <>
                  <h4>Error</h4>
                  <pre className="error">{selectedNode.error}</pre>
                </>
              )}
              <h4>Node Logs</h4>
              {selectedNodeLogs.length ? (
                selectedNodeLogs.map((log) => (
                  <p key={log.id}>
                    {log.level} · {log.summary}
                  </p>
                ))
              ) : (
                <p className="subtle">此 Node 尚無 Log</p>
              )}
              <h4>Node Artifacts</h4>
              {selectedNodeArtifacts.length ? (
                selectedNodeArtifacts.map((artifact) => (
                  <p key={artifact.id}>
                    {artifact.kind} ·{" "}
                    {artifact.url ? (
                      <a href={artifact.url} target="_blank" rel="noreferrer">
                        {artifact.label}
                      </a>
                    ) : (
                      artifact.label
                    )}
                  </p>
                ))
              ) : (
                <p className="subtle">此 Node 尚無 Artifact</p>
              )}
              {selectedNode.status === "failed" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run("retry_node", {
                      node_id: selectedNode.id,
                      reason: "使用者從執行中心重試",
                    })
                  }
                >
                  Retry
                </button>
              )}
            </section>
          )}
          <section>
            <h3>Run Logs</h3>
            {logs.length ? (
              logs.map((log) => (
                <p key={log.id}>
                  {log.level} · {log.summary}
                </p>
              ))
            ) : (
              <p className="subtle">尚無 Log</p>
            )}
            <h3>Run Artifacts</h3>
            {artifacts.length ? (
              artifacts.map((artifact) => (
                <p key={artifact.id}>
                  {artifact.kind} ·{" "}
                  {artifact.url ? (
                    <a href={artifact.url} target="_blank" rel="noreferrer">
                      {artifact.label}
                    </a>
                  ) : (
                    artifact.label
                  )}
                </p>
              ))
            ) : (
              <p className="subtle">尚無 Artifact</p>
            )}
          </section>
          {gates
            .filter((gate) => gate.status === "open")
            .map((gate) => (
              <form
                className="human-gate"
                key={gate.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    await run("resolve_human_gate", {
                      gate_id: gate.id,
                      response: gateResponse.trim(),
                    })
                  )
                    setGateResponse("");
                }}
              >
                <h3>Waiting Human</h3>
                <p>{gate.prompt}</p>
                <label>
                  處理結果
                  <textarea
                    value={gateResponse}
                    onChange={(e) => setGateResponse(e.target.value)}
                  />
                </label>
                <button disabled={busy || !gateResponse.trim()}>
                  記錄並繼續
                </button>
              </form>
            ))}
        </div>
      )}
    </section>
  );
}

export function ExecutionSummary({
  state,
  openRun,
}: {
  state: WorkflowState;
  openRun: (id: string) => void;
}) {
  const groups: Array<{ label: string; statuses: WorkflowStatus[] }> = [
    { label: "Running", statuses: ["running", "retrying"] },
    { label: "Waiting Human", statuses: ["waiting_human"] },
    { label: "Failed", statuses: ["failed", "paused"] },
    { label: "Completed Today", statuses: ["success"] },
  ];
  const today = new Date().toDateString();
  return (
    <section className="today-module" aria-label="AI 執行狀態">
      <div className="module-heading">
        <div>
          <p className="eyebrow">AI EXECUTION</p>
          <h2>AI 執行狀態</h2>
        </div>
      </div>
      <div className="execution-summary-grid">
        {groups.map((group) => {
          const items = state.runs.filter(
            (run) =>
              group.statuses.includes(run.status) &&
              (group.label !== "Completed Today" ||
                (run.finished_at &&
                  new Date(run.finished_at).toDateString() === today)),
          );
          return (
            <section key={group.label} aria-label={group.label}>
              <h3>
                {group.label} <span>{items.length}</span>
              </h3>
              {items.slice(0, 5).map((run) => (
                <button key={run.id} onClick={() => openRun(run.id)}>
                  <strong>{run.title}</strong>
                  <code>{run.run_code}</code>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}
