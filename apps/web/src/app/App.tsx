import { AlertCircle, CheckCircle2, Github, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PrInputForm } from "../features/analysis/PrInputForm";
import { AnalysisReport, AnalysisTask, analyzePullRequest } from "../lib/api-client";

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
        message: error instanceof Error ? error.message : "Unable to analyze this pull request."
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
          <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer">
            <Github aria-hidden="true" />
            GitHub
          </a>
        </header>

        <div className="review-layout">
          <section className="review-panel">
            <div className="panel-heading">
              <p className="eyebrow">Review workflow</p>
              <h1>Analyze a GitHub pull request</h1>
              <p>
                Paste a public PR URL to create an analysis task, fetch the generated report, and review the
                structured findings before deciding what needs human attention.
              </p>
            </div>
            <PrInputForm disabled={viewState.status === "loading"} onSubmit={handleAnalyze} />
            <StatusMessage viewState={viewState} />
          </section>

          <aside className="status-panel" aria-label="Analysis state">
            <h2>Current run</h2>
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
        Creating analysis task and loading the report for {viewState.pullRequestUrl}
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
        Report loaded for task {viewState.task.taskId}
      </p>
    );
  }

  return <p className="form-status">No analysis has been run yet.</p>;
}

function RunSummary({ viewState }: { viewState: ViewState }) {
  if (viewState.status === "success") {
    const snapshot = viewState.task.snapshot;
    const blockingCount = viewState.report.findings.filter((finding) => finding.blocking).length;

    return (
      <dl className="run-summary">
        <div>
          <dt>Status</dt>
          <dd>{viewState.task.status}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd className={`risk-value risk-${viewState.report.riskLevel}`}>{viewState.report.riskLevel}</dd>
        </div>
        <div>
          <dt>Findings</dt>
          <dd>{viewState.report.findings.length}</dd>
        </div>
        <div>
          <dt>Blocking</dt>
          <dd>{blockingCount}</dd>
        </div>
        <div>
          <dt>Changed files</dt>
          <dd>{snapshot?.changedFiles.length ?? "Unknown"}</dd>
        </div>
      </dl>
    );
  }

  if (viewState.status === "loading") {
    return <p className="muted">Waiting for the API to create the task and return the report.</p>;
  }

  if (viewState.status === "error") {
    return <p className="muted">Fix the URL or API issue, then run the analysis again.</p>;
  }

  return <p className="muted">Enter a public GitHub PR URL to start the MVP review loop.</p>;
}

function ReportView({ viewState }: { viewState: ViewState }) {
  if (viewState.status === "loading") {
    return (
      <section className="report-empty loading-state">
        <Loader2 aria-hidden="true" />
        <h2>Loading report</h2>
        <p>The API is fetching PR data and generating a deterministic MVP review report.</p>
      </section>
    );
  }

  if (viewState.status === "error") {
    return (
      <section className="report-empty error-state">
        <AlertCircle aria-hidden="true" />
        <h2>Analysis failed</h2>
        <p>{viewState.message}</p>
      </section>
    );
  }

  if (viewState.status !== "success") {
    return (
      <section className="report-empty">
        <ShieldAlert aria-hidden="true" />
        <h2>No report yet</h2>
        <p>The report area will show PR details, summary, risk level, and review findings after analysis.</p>
      </section>
    );
  }

  const { task, report } = viewState;
  const snapshot = task.snapshot;
  const sortedFindings = [...report.findings].sort(
    (left, right) => severityRank[left.severity] - severityRank[right.severity],
  );

  return (
    <section className="report-grid" aria-label="Analysis report">
      <article className="report-section pr-overview">
        <div>
          <p className="eyebrow">Pull request</p>
          <h2>{snapshot?.title ?? `${task.repositoryOwner}/${task.repositoryName}#${task.pullRequestNumber}`}</h2>
          <p className="muted">
            {task.repositoryOwner}/{task.repositoryName} #{task.pullRequestNumber}
          </p>
        </div>
        <dl className="metadata-grid">
          <Metadata label="Author" value={snapshot?.author ?? "Unknown"} />
          <Metadata label="Base" value={snapshot?.baseRef ?? "Unknown"} />
          <Metadata label="Head" value={snapshot?.headRef ?? "Unknown"} />
          <Metadata label="Commit" value={snapshot?.commitSha.slice(0, 8) ?? "Unknown"} />
        </dl>
      </article>

      <article className="report-section summary-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Summary</p>
            <h2>Review brief</h2>
          </div>
          <span className={`risk-badge risk-${report.riskLevel}`}>{report.riskLevel}</span>
        </div>
        <p>{report.summary}</p>
      </article>

      <article className="report-section findings-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Findings</p>
            <h2>Structured review items</h2>
          </div>
          <span className="count-badge">{sortedFindings.length}</span>
        </div>

        {sortedFindings.length === 0 ? (
          <div className="empty-findings">
            <CheckCircle2 aria-hidden="true" />
            <p>No findings were returned for this report.</p>
          </div>
        ) : (
          <div className="finding-list">
            {sortedFindings.map((finding) => (
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
                  <span className="confidence">{Math.round(finding.confidence * 100)}%</span>
                </header>
                <p className="file-path">
                  {finding.filePath}
                  {finding.line ? `:${finding.line}` : ""}
                </p>
                <dl className="finding-detail">
                  <div>
                    <dt>Evidence</dt>
                    <dd>{finding.evidence}</dd>
                  </div>
                  <div>
                    <dt>Suggestion</dt>
                    <dd>{finding.suggestion}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
