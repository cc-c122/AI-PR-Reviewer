import { AlertCircle, CheckCircle2, Copy, Filter, Github, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PrInputForm } from "../features/analysis/PrInputForm";
import { AnalysisReport, AnalysisTask, analyzePullRequest } from "../lib/api-client";
import { formatFindingComment, formatReviewSummary } from "../lib/review-comments";

type ViewState =
  | { status: "empty" }
  | { status: "loading"; pullRequestUrl: string }
  | { status: "error"; message: string }
  | { status: "success"; task: AnalysisTask; report: AnalysisReport };

const severityRank = {
  critical: 0,
  major: 1,
  minor: 2,
  info: 3
};

const signalSeverityOptions = ["all", "high", "medium", "low"] as const;

type SignalSeverityFilter = (typeof signalSeverityOptions)[number];
type ReportDetails = NonNullable<AnalysisReport["details"]>;
type StaticSignal = ReportDetails["staticAnalysis"]["signals"][number];

export function App() {
  const [viewState, setViewState] = useState<ViewState>({ status: "empty" });

  async function handleAnalyze(pullRequestUrl: string) {
    setViewState({ status: "loading", pullRequestUrl });

    try {
      const result = await analyzePullRequest(pullRequestUrl);
      setViewState({ status: "success", ...result });
    } catch (error) {
      setViewState({
        status: "error",
        message: error instanceof Error ? error.message : "无法分析这个 Pull Request。"
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <ShieldCheck aria-hidden="true" />
            <span>AI PR Reviewer</span>
          </div>
          <a className="github-link" href="https://github.com/cc-c122/AI-PR-Reviewer" target="_blank" rel="noreferrer">
            <Github aria-hidden="true" />
            GitHub
          </a>
        </header>

        <div className="review-layout">
          <section className="review-panel">
            <div className="panel-heading">
              <p className="eyebrow">Review 工作流</p>
              <h1>分析 GitHub Pull Request</h1>
              <p>
                粘贴公开 PR URL 后创建分析任务，获取生成报告，并在人工判断前先查看结构化 Review 结果。
              </p>
            </div>
            <PrInputForm disabled={viewState.status === "loading"} onSubmit={handleAnalyze} />
            <StatusMessage viewState={viewState} />
          </section>

          <aside className="status-panel" aria-label="分析状态">
            <h2>当前任务</h2>
            <RunSummary viewState={viewState} />
          </aside>
        </div>

        <ReportView viewState={viewState} />
      </section>
    </main>
  );
}

function StatusMessage({ viewState }: { viewState: ViewState }) {
  if (viewState.status === "loading") {
    return (
      <p className="form-status is-loading">
        <Loader2 aria-hidden="true" />
        正在创建分析任务并加载报告：{viewState.pullRequestUrl}
      </p>
    );
  }

  if (viewState.status === "error") {
    return (
      <p className="form-status is-error">
        <AlertCircle aria-hidden="true" />
        {viewState.message}
      </p>
    );
  }

  if (viewState.status === "success") {
    return (
      <p className="form-status is-success">
        <CheckCircle2 aria-hidden="true" />
        已加载任务 {viewState.task.taskId} 的报告
      </p>
    );
  }

  return <p className="form-status">还没有运行分析。</p>;
}

function RunSummary({ viewState }: { viewState: ViewState }) {
  if (viewState.status === "success") {
    const snapshot = viewState.task.snapshot;
    const blockingCount = viewState.report.findings.filter((finding) => finding.blocking).length;

    return (
      <dl className="run-summary">
        <div>
          <dt>状态</dt>
          <dd>{viewState.task.status}</dd>
        </div>
        <div>
          <dt>风险</dt>
          <dd className={`risk-value risk-${viewState.report.riskLevel}`}>{viewState.report.riskLevel}</dd>
        </div>
        <div>
          <dt>问题</dt>
          <dd>{viewState.report.findings.length}</dd>
        </div>
        <div>
          <dt>阻塞</dt>
          <dd>{blockingCount}</dd>
        </div>
        <div>
          <dt>变更文件</dt>
          <dd>{snapshot?.changedFiles.length ?? "未知"}</dd>
        </div>
      </dl>
    );
  }

  if (viewState.status === "loading") {
    return <p className="muted">等待 API 创建任务并返回报告。</p>;
  }

  if (viewState.status === "error") {
    return <p className="muted">修正 URL 或 API 问题后再重新分析。</p>;
  }

  return <p className="muted">输入公开 GitHub PR URL，开始 MVP Review 流程。</p>;
}

function ReportView({ viewState }: { viewState: ViewState }) {
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  if (viewState.status === "loading") {
    return (
      <section className="report-empty loading-state">
        <Loader2 aria-hidden="true" />
        <h2>正在加载报告</h2>
        <p>API 正在获取 PR 数据并生成确定性的 MVP Review 报告。</p>
      </section>
    );
  }

  if (viewState.status === "error") {
    return (
      <section className="report-empty error-state">
        <AlertCircle aria-hidden="true" />
        <h2>分析失败</h2>
        <p>{viewState.message}</p>
      </section>
    );
  }

  if (viewState.status !== "success") {
    return (
      <section className="report-empty">
        <ShieldAlert aria-hidden="true" />
        <h2>暂无报告</h2>
        <p>
          在线 Demo 使用 mock 数据，不会调用 GitHub、API 服务或 AI 模型。本地运行可分析真实 GitHub PR。
        </p>
      </section>
    );
  }

  const { task, report } = viewState;
  const snapshot = task.snapshot;
  const signalsByFilePath = groupSignalsByFilePath(report.details?.staticAnalysis.signals ?? []);
  const sortedFindings = [...report.findings].sort(
    (left, right) => severityRank[left.severity] - severityRank[right.severity],
  );
  const blockingFindings = sortedFindings.filter((finding) => finding.blocking);
  const prFilesUrl = snapshot?.url ? `${snapshot.url}/files` : undefined;

  async function copyReviewText(label: string, text: string) {
    await copyTextToClipboard(text);
    setCopiedAction(label);
    window.setTimeout(() => setCopiedAction((current) => current === label ? null : current), 1800);
  }

  return (
    <section className="report-grid" aria-label="Analysis report">
      <article className="report-section pr-overview">
        <div>
          <p className="eyebrow">Pull Request</p>
          <h2>{snapshot?.title ?? `${task.repositoryOwner}/${task.repositoryName}#${task.pullRequestNumber}`}</h2>
          <p className="muted">
            {task.repositoryOwner}/{task.repositoryName} #{task.pullRequestNumber}
          </p>
          {snapshot?.url ? (
            <a className="pr-link" href={snapshot.url} target="_blank" rel="noreferrer">
              打开 PR
            </a>
          ) : null}
        </div>
        <dl className="metadata-grid">
          <Metadata label="作者" value={snapshot?.author ?? "未知"} />
          <Metadata label="Base" value={snapshot?.baseRef ?? "未知"} />
          <Metadata label="Head" value={snapshot?.headRef ?? "未知"} />
          <Metadata label="Commit" value={snapshot?.commitSha.slice(0, 8) ?? "未知"} />
        </dl>
      </article>

      <article className="report-section summary-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">摘要</p>
            <h2>Review 简报</h2>
          </div>
          <div className="section-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => copyReviewText("summary", formatReviewSummary(report, task))}
            >
              <Copy aria-hidden="true" />
              复制完整 Review 摘要
            </button>
            <span className={`risk-badge risk-${report.riskLevel}`}>{report.riskLevel}</span>
          </div>
        </div>
        {copiedAction === "summary" ? <p className="copy-status">已复制完整 Review 摘要。</p> : null}
        <p>{report.summary}</p>
      </article>

      <article className="report-section findings-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">问题</p>
            <h2>结构化 Review 项</h2>
          </div>
          <div className="section-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={blockingFindings.length === 0}
              onClick={() =>
                copyReviewText(
                  "blocking",
                  blockingFindings.map((finding) => formatFindingComment(finding)).join("\n\n---\n\n"),
                )
              }
            >
              <Copy aria-hidden="true" />
              复制所有阻塞项
            </button>
            <span className="count-badge">{sortedFindings.length}</span>
          </div>
        </div>
        {copiedAction === "blocking" ? <p className="copy-status">已复制阻塞 Review 评论。</p> : null}

        {sortedFindings.length === 0 ? (
          <div className="empty-findings">
            <CheckCircle2 aria-hidden="true" />
            <p>这份报告没有返回 Review 问题。</p>
          </div>
        ) : (
          <div className="finding-list">
            {sortedFindings.map((finding) => {
              const matchingSignals = signalsByFilePath.get(finding.filePath) ?? [];
              const commentMarkdown = formatFindingComment(finding);
              const copyLabel = `finding:${finding.id}`;

              return (
              <article className="finding-card" key={finding.id}>
                <header>
                  <div>
                    <div className="finding-tags">
                      <span className={`severity severity-${finding.severity}`}>{finding.severity}</span>
                      <span>{finding.category}</span>
                      {finding.blocking ? <span className="blocking-tag">blocking</span> : null}
                    </div>
                    <h3>{finding.title}</h3>
                  </div>
                  <div className="finding-actions">
                    <span className="confidence">{Math.round(finding.confidence * 100)}%</span>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => copyReviewText(copyLabel, commentMarkdown)}
                    >
                      <Copy aria-hidden="true" />
                      复制评论
                    </button>
                  </div>
                </header>
                {copiedAction === copyLabel ? <p className="copy-status">已复制评论 Markdown。</p> : null}
                <p className="file-path">
                  {prFilesUrl ? (
                    <a href={prFilesUrl} target="_blank" rel="noreferrer">
                      {finding.filePath}
                      {finding.line ? `:${finding.line}` : ""}
                    </a>
                  ) : (
                    <>
                      {finding.filePath}
                      {finding.line ? `:${finding.line}` : ""}
                    </>
                  )}
                </p>
                <dl className="finding-detail">
                  <div>
                    <dt>证据</dt>
                    <dd>{finding.evidence}</dd>
                  </div>
                  <div>
                    <dt>建议</dt>
                    <dd>{finding.suggestion}</dd>
                  </div>
                </dl>
                {matchingSignals.length > 0 ? (
                  <div className="rule-evidence">
                    <strong>规则证据</strong>
                    <span>
                      {matchingSignals.slice(0, 2).map((signal) => {
                        const confirmation = signal.needsHumanConfirmation ? ", 需要人工确认" : "";

                        return `${signal.ruleId} (${signal.severity}, ${signal.source}${confirmation})`;
                      }).join(", ")}
                      {matchingSignals.length > 2 ? ` +${matchingSignals.length - 2}` : ""}
                    </span>
                  </div>
                ) : null}
              </article>
              );
            })}
          </div>
        )}
      </article>

      {report.details ? <AnalysisEvidenceSection details={report.details} /> : null}
    </section>
  );
}

function AnalysisEvidenceSection({ details }: { details: ReportDetails }) {
  const [severityFilter, setSeverityFilter] = useState<SignalSeverityFilter>("all");
  const sourceCounts = countContextSources(details);
  const signals = details.staticAnalysis.signals;
  const filteredSignals = severityFilter === "all"
    ? signals
    : signals.filter((signal) => signal.severity === severityFilter);

  return (
    <article className="report-section evidence-section">
      <div className="section-title">
        <div>
          <p className="eyebrow">分析依据</p>
          <h2>分析证据</h2>
          <p className="muted">用于支撑 Review 判断的上下文来源、规则信号和已跳过文件。</p>
        </div>
        <span className="count-badge">{details.reviewContextSummary.files.length} 个文件</span>
      </div>

      <div className="source-stats" aria-label="Context source statistics">
        {(["metadata", "patch", "file_content", "test_candidate"] as const).map((sourceType) => (
          <div key={sourceType}>
            <dt>{sourceType}</dt>
            <dd>{sourceCounts[sourceType] ?? 0}</dd>
          </div>
        ))}
      </div>

      {details.staticAnalysis.riskHints.length > 0 ? (
        <section className="evidence-block">
          <h3>风险提示</h3>
          <ul className="compact-list">
            {details.staticAnalysis.riskHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="evidence-block">
        <div className="evidence-toolbar">
          <h3>静态分析信号</h3>
          <label>
            <Filter aria-hidden="true" />
            <span>严重级别</span>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as SignalSeverityFilter)}
            >
              {signalSeverityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredSignals.length === 0 ? (
          <p className="muted">没有静态分析信号匹配当前筛选条件。</p>
        ) : (
          <div className="signal-list">
            {filteredSignals.map((signal) => (
              <article className="signal-row" key={signal.id}>
                <div className="signal-header">
                  <span className={`signal-severity signal-${signal.severity}`}>{signal.severity}</span>
                  <strong>{signal.ruleId}</strong>
                  <span>{signal.category}</span>
                  <span className={`signal-source signal-source-${signal.source}`}>{signal.source}</span>
                  {signal.needsHumanConfirmation ? <span className="confirmation-badge">需要人工确认</span> : null}
                  <span>{Math.round(signal.confidence * 100)}%</span>
                </div>
                <p className="file-path">{signal.filePath}</p>
                <p>{signal.message}</p>
                <dl className="finding-detail">
                  <div>
                    <dt>证据</dt>
                    <dd>{signal.evidence}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="evidence-block">
        <h3>文件上下文</h3>
        <div className="context-file-list">
          {details.reviewContextSummary.files.map((file) => (
            <details className="context-file" key={file.path}>
              <summary>
                <span className="file-path">{file.path}</span>
                <span>{file.contentAvailable ? "内容可用" : "仅元数据"}</span>
              </summary>
              <dl className="context-meta">
                <Metadata label="内容" value={file.contentAvailable ? "可用" : "未获取"} />
                <Metadata label="已截断" value={file.contentTruncated ? "是" : "否"} />
                <Metadata label="测试文件" value={file.isTestFile ? "是" : "否"} />
              </dl>
              <div className="context-sources">
                {file.contextSources.map((source) => (
                  <span key={`${file.path}:${source.type}:${source.description}`}>{source.type}</span>
                ))}
              </div>
              <ul className="compact-list">
                {file.contextSources.map((source) => (
                  <li key={`${file.path}:${source.type}:${source.description}:detail`}>
                    {source.type}: {source.description}
                  </li>
                ))}
              </ul>
              {file.testCandidatePaths.length > 0 ? (
                <div className="test-candidates">
                  <dt>候选测试</dt>
                  <ul className="compact-list mono-list">
                    {file.testCandidatePaths.map((candidate) => (
                      <li key={candidate}>{candidate}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </details>
          ))}
        </div>
      </section>

      {details.staticAnalysis.skippedFiles.length > 0 ? (
        <section className="evidence-block">
          <details className="skipped-files">
            <summary>已跳过文件 ({details.staticAnalysis.skippedFiles.length})</summary>
            <ul className="compact-list mono-list">
              {details.staticAnalysis.skippedFiles.map((file) => (
                <li key={`${file.filePath}:${file.reason}`}>
                  {file.filePath} <span>{file.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
    </article>
  );
}

function countContextSources(details: ReportDetails): Record<string, number> {
  return details.reviewContextSummary.contextSources.reduce<Record<string, number>>((counts, source) => {
    counts[source.type] = (counts[source.type] ?? 0) + 1;

    return counts;
  }, {});
}

function groupSignalsByFilePath(signals: StaticSignal[]): Map<string, StaticSignal[]> {
  return signals.reduce<Map<string, StaticSignal[]>>((groups, signal) => {
    const existingSignals = groups.get(signal.filePath) ?? [];

    groups.set(signal.filePath, [...existingSignals, signal]);

    return groups;
  }, new Map());
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);

    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
