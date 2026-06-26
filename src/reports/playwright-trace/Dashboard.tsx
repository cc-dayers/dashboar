import { useState, useEffect } from "react";
import type { PlaywrightTraceReport, TestRun, RunStatus } from "./types";
import type { ReportProps } from "../index";
import ReportSidebar from "../../components/ReportSidebar";
import SidebarBoarHeader from "../../components/SidebarBoarHeader";
import MobileTopBar from "../../components/MobileTopBar";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Status config ─────────────────────────────────────────────────────────────

function statusCfg(s: RunStatus) {
  if (s === "passed")
    return { color: "#22c55e", label: "passed", bg: "#22c55e18" };
  if (s === "failed")
    return { color: "#ef4444", label: "failed", bg: "#ef444418" };
  return { color: "#f59e0b", label: "flaky", bg: "#f59e0b18" };
}

// Build a URL for our self-hosted trace viewer. Routing through /api/blob
// means the service worker fetches from our own origin — zero CORS issues.
function selfHostedTraceUrl(traceId: string): string {
  const proxyUrl = `${window.location.origin}/api/blob?path=${encodeURIComponent(traceId)}&report=playwright-trace`;
  return `/trace-viewer/index.html?trace=${encodeURIComponent(proxyUrl)}`;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  report: PlaywrightTraceReport;
  selId: string | null;
  isMobile: boolean;
  sidebarOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}

function RunRow({
  run,
  selected,
  onClick,
}: {
  run: TestRun;
  selected: boolean;
  onClick: () => void;
}) {
  const st = statusCfg(run.status);
  const passRate =
    run.totalTests && run.totalTests > 0
      ? `${run.passedTests ?? 0}/${run.totalTests}`
      : null;

  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "11px 16px",
        border: "none",
        cursor: "pointer",
        background: selected ? "#1e3a5f" : "transparent",
        borderLeft: `3px solid ${selected ? "#3b82f6" : "transparent"}`,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "#1e293b";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: st.color,
            flexShrink: 0,
            marginTop: "5px",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: 1.35,
              color: selected ? "#f1f5f9" : "#cbd5e1",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {run.suiteName}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "4px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {fmtDate(run.timestamp)} {fmtTime(run.timestamp)}
            </span>
            {run.duration != null && (
              <span style={{ fontSize: "11px", color: "#475569" }}>
                · {fmtMs(run.duration)}
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginTop: "4px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {passRate && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: st.color,
                  background: st.bg,
                  borderRadius: "4px",
                  padding: "1px 5px",
                }}
              >
                {passRate}
              </span>
            )}
            {run.browser && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#475569",
                  fontFamily: "ui-monospace,monospace",
                }}
              >
                {run.browser}
              </span>
            )}
            {run.project && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#334155",
                  background: "#1e293b",
                  borderRadius: "4px",
                  padding: "1px 5px",
                  fontFamily: "ui-monospace,monospace",
                }}
              >
                {run.project}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function Sidebar({
  report,
  selId,
  isMobile,
  sidebarOpen,
  onClose,
  onSelect,
}: SidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? report.runs.filter(
        (r) =>
          r.suiteName.toLowerCase().includes(search.toLowerCase()) ||
          r.project?.toLowerCase().includes(search.toLowerCase()) ||
          r.browser?.toLowerCase().includes(search.toLowerCase()),
      )
    : report.runs;

  const passed = report.runs.filter((r) => r.status === "passed").length;
  const failed = report.runs.filter((r) => r.status === "failed").length;
  const flaky = report.runs.filter((r) => r.status === "flaky").length;

  return (
    <ReportSidebar
      isMobile={isMobile}
      open={sidebarOpen}
      onClose={onClose}
      header={<SidebarBoarHeader />}
    >
      {(passed > 0 || failed > 0 || flaky > 0) && (
        <div
          style={{
            padding: "8px 12px 4px",
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          {passed > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#4ade80",
                background: "#4ade8018",
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              ✓ {passed} passed
            </span>
          )}
          {failed > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#f87171",
                background: "#f8717118",
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              ✗ {failed} failed
            </span>
          )}
          {flaky > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#fbbf24",
                background: "#fbbf2418",
                borderRadius: "4px",
                padding: "2px 7px",
              }}
            >
              ~ {flaky} flaky
            </span>
          )}
        </div>
      )}
      <div
        style={{
          padding: "6px 12px 8px",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        <div style={{ position: "relative" }}>
          <svg
            style={{
              position: "absolute",
              left: "9px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#475569",
              pointerEvents: "none",
            }}
            width="13"
            height="13"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            placeholder="Filter runs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "7px",
              padding: "6px 10px 6px 28px",
              fontSize: "12px",
              color: "#e2e8f0",
              outline: "none",
            }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              fontSize: "12px",
              color: "#475569",
              textAlign: "center",
            }}
          >
            No runs match your filter.
          </div>
        ) : (
          filtered.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              selected={run.id === selId}
              onClick={() => onSelect(run.id)}
            />
          ))
        )}
      </div>
    </ReportSidebar>
  );
}

// ── Run detail panel (no iframe — just metadata + one-click trace button) ─────

function RunDetail({ run }: { run: TestRun }) {
  const st = statusCfg(run.status);
  const viewerUrl = selfHostedTraceUrl(run.traceId);
  const passRate = run.totalTests
    ? Math.round(((run.passedTests ?? 0) / run.totalTests) * 100)
    : null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--color-background)",
        gap: "24px",
      }}
    >
      {/* Status card */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "14px",
          padding: "24px 28px",
          maxWidth: "480px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: st.color,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--color-foreground)",
            }}
          >
            {run.suiteName}
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "11px",
              fontWeight: 600,
              color: st.color,
              background: st.bg,
              borderRadius: "5px",
              padding: "2px 8px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {st.label}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 24px",
            fontSize: "12px",
            color: "var(--color-foreground-muted)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: "2px",
                color: "var(--color-foreground-subtle)",
              }}
            >
              Date
            </div>
            <div style={{ color: "var(--color-foreground)" }}>
              {fmtDate(run.timestamp)} at {fmtTime(run.timestamp)}
            </div>
          </div>
          {run.duration != null && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: "2px",
                  color: "var(--color-foreground-subtle)",
                }}
              >
                Duration
              </div>
              <div style={{ color: "var(--color-foreground)" }}>
                {fmtMs(run.duration)}
              </div>
            </div>
          )}
          {run.browser && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: "2px",
                  color: "var(--color-foreground-subtle)",
                }}
              >
                Browser
              </div>
              <div
                style={{
                  color: "var(--color-foreground)",
                  fontFamily: "ui-monospace,monospace",
                }}
              >
                {run.browser}
              </div>
            </div>
          )}
          {run.project && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: "2px",
                  color: "var(--color-foreground-subtle)",
                }}
              >
                Project
              </div>
              <div
                style={{
                  color: "var(--color-foreground)",
                  fontFamily: "ui-monospace,monospace",
                }}
              >
                {run.project}
              </div>
            </div>
          )}
          {run.totalTests != null && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  marginBottom: "2px",
                  color: "var(--color-foreground-subtle)",
                }}
              >
                Tests
              </div>
              <div style={{ color: "var(--color-foreground)" }}>
                <span style={{ color: "#22c55e", fontWeight: 600 }}>
                  {run.passedTests ?? 0}
                </span>
                {" / "}
                {run.totalTests} passed
                {passRate != null && (
                  <span
                    style={{
                      color: "var(--color-foreground-subtle)",
                      marginLeft: "6px",
                    }}
                  >
                    ({passRate}%)
                  </span>
                )}
                {(run.failedTests ?? 0) > 0 && (
                  <span
                    style={{
                      color: "#ef4444",
                      marginLeft: "8px",
                      fontWeight: 600,
                    }}
                  >
                    {run.failedTests} failed
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The one-click button */}
      <a
        href={viewerUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 24px",
          borderRadius: "10px",
          background: "#7c3aed",
          color: "#fff",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: 600,
          boxShadow: "0 4px 14px #7c3aed40",
          transition: "background 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#6d28d9";
          e.currentTarget.style.boxShadow = "0 4px 18px #7c3aed60";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#7c3aed";
          e.currentTarget.style.boxShadow = "0 4px 14px #7c3aed40";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1v8h8V4H4zm3 2l3 2-3 2V6z" />
        </svg>
        Open Trace Viewer
      </a>

      <div
        style={{
          fontSize: "11.5px",
          color: "var(--color-foreground-subtle)",
          textAlign: "center",
          maxWidth: "360px",
          lineHeight: 1.6,
        }}
      >
        Opens in a new tab. The trace is streamed through this app's own proxy —
        no external CORS dependencies.
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ runCount }: { runCount: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background)",
        textAlign: "center",
        padding: "40px",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        style={{ marginBottom: "16px", opacity: 0.4 }}
      >
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
          stroke="var(--color-foreground-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="9"
          y="3"
          width="6"
          height="4"
          rx="1"
          stroke="var(--color-foreground-muted)"
          strokeWidth="1.5"
        />
        <path
          d="M9 12h6M9 16h4"
          stroke="var(--color-foreground-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--color-foreground-muted)",
          marginBottom: "6px",
        }}
      >
        Select a test run
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--color-foreground-subtle)",
          maxWidth: "280px",
          lineHeight: 1.5,
        }}
      >
        Choose one of the {runCount} run{runCount !== 1 ? "s" : ""} in the
        sidebar to view its trace.
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard({ data }: ReportProps) {
  const report = data as PlaywrightTraceReport;

  const [selId, setSelId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const selRun = selId
    ? (report.runs.find((r) => r.id === selId) ?? null)
    : null;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <Sidebar
        report={report}
        selId={selId}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={(id) => {
          setSelId(id);
          if (isMobile) setSidebarOpen(false);
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {isMobile && (
          <MobileTopBar
            title={report.title ?? "Playwright Trace"}
            onToggle={() => setSidebarOpen((s) => !s)}
          />
        )}
        {selRun ? (
          <RunDetail run={selRun} />
        ) : (
          <EmptyState runCount={report.runs.length} />
        )}
      </div>
    </div>
  );
}
