import { useState, useEffect } from "react";
import type { E2eAggregateReport, E2eRunEntry } from "./types";
import type { ReportProps, RefreshStatus } from "../index";
import OverviewView, {
  runLabel,
  runStatusColor,
  isInProgressStatus,
  runEffectiveStatus,
  browserName,
} from "./OverviewView";
import RunDetailView from "./RunDetailView";
import ReportSidebar from "../../components/ReportSidebar";
import SidebarBoarHeader from "../../components/SidebarBoarHeader";
import MobileTopBar from "../../components/MobileTopBar";
import JsonToggleButton from "../../components/JsonToggleButton";
import RawJsonModal from "../../components/RawJsonModal";
import DocsButton from "../../components/DocsButton";
import DocsModal from "../../components/DocsModal";
import { useSidebarWidth } from "../../hooks/useSidebarWidth";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stable key for a run entry: prefer reportBlobPath (unique per run), else positional
function runKey(r: E2eRunEntry, idx: number): string {
  return r.reportBlobPath ?? `run-${idx}`;
}

function fmtRunTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

// ── Run grouping ──────────────────────────────────────────────────────────────
//
// One CI build fans out into a separate report per browser target (its own
// reportBlobPath, own pass/fail counts) but it's one logical "run" to a human.
// Group sidebar rows by (build, suite) so browser targets become facets of one
// row — shown as clickable chips — instead of separate rows.

interface KeyedRun {
  run: E2eRunEntry;
  key: string;
}

interface RunGroup {
  key: string;
  suiteName: string;
  entries: KeyedRun[]; // canonical browser order first (Chromium preferred)
}

const BROWSER_ORDER = ["chromium", "edge", "firefox", "webkit"];

function browserRank(label: string | undefined): number {
  const idx = BROWSER_ORDER.indexOf(browserName(label).toLowerCase());
  return idx === -1 ? BROWSER_ORDER.length : idx;
}

function groupKeyFor({ run: r, key }: KeyedRun): string {
  const build = r.buildId ?? r.buildNumber;
  const suite = r.suiteName ?? r.suite ?? r.jobName ?? "Unknown";
  if (build) return `build:${build}::${suite}`;
  if (r.commit && r.branch) return `cb:${r.branch}::${r.commit}::${suite}`;
  return `solo:${key}`; // nothing reliable to group on — its own group
}

function buildGroups(runs: E2eRunEntry[]): RunGroup[] {
  const order: string[] = [];
  const map = new Map<string, KeyedRun[]>();
  runs.forEach((run, idx) => {
    const kr: KeyedRun = { run, key: runKey(run, idx) };
    const gk = groupKeyFor(kr);
    if (!map.has(gk)) {
      map.set(gk, []);
      order.push(gk);
    }
    map.get(gk)!.push(kr);
  });
  return order.map((gk) => {
    const entries = [...map.get(gk)!].sort(
      (a, b) => browserRank(a.run.matrixLabel) - browserRank(b.run.matrixLabel),
    );
    const first = entries[0].run;
    return {
      key: gk,
      suiteName: first.suiteName ?? first.suite ?? first.jobName ?? "Run",
      entries,
    };
  });
}

// Severity ranking used to pick the "worst" browser target in a group — the
// group's status dot always reflects the worst target, never hides a failure
// behind a healthier default (Chromium).
const STATUS_SEVERITY: Record<string, number> = {
  failed: 0,
  timedout: 0,
  succeeded_with_issues: 1,
  cancelling: 1,
  flaky: 2,
  interrupted: 3,
  inProgress: 4,
  notStarted: 4,
};

function severity(eff: string): number {
  return STATUS_SEVERITY[eff] ?? 5; // passed/succeeded/unknown — lowest severity
}

function worstEntry(entries: KeyedRun[]): KeyedRun {
  return entries.reduce((worst, e) =>
    severity(runEffectiveStatus(e.run)) < severity(runEffectiveStatus(worst.run)) ? e : worst,
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function OverviewLink({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 10px 8px 7px",
        borderRadius: "6px",
        cursor: "pointer",
        marginBottom: "2px",
        userSelect: "none",
        background: active
          ? "var(--color-sidebar-selected)"
          : hovered
            ? "var(--color-sidebar-raised)"
            : "transparent",
        transition: "background 0.1s",
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 14 14"
        fill="none"
        style={{ color: "var(--color-sidebar-muted)" }}
      >
        <rect
          x="1"
          y="1"
          width="5.5"
          height="5.5"
          rx="1.2"
          fill="currentColor"
        />
        <rect
          x="7.5"
          y="1"
          width="5.5"
          height="5.5"
          rx="1.2"
          fill="currentColor"
        />
        <rect
          x="1"
          y="7.5"
          width="5.5"
          height="5.5"
          rx="1.2"
          fill="currentColor"
        />
        <rect
          x="7.5"
          y="7.5"
          width="5.5"
          height="5.5"
          rx="1.2"
          fill="currentColor"
        />
      </svg>
      <span
        style={{
          color: "var(--color-sidebar-foreground)",
          fontSize: "12.5px",
          fontWeight: 500,
        }}
      >
        Overview
      </span>
    </div>
  );
}

function GroupRow({
  group,
  selKey,
  onSelect,
}: {
  group: RunGroup;
  selKey: string | null;
  onSelect: (key: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const defaultEntry = group.entries[0]; // Chromium-preferred (see browserRank)
  const activeEntry = group.entries.find((e) => e.key === selKey) ?? null;
  const selected = activeEntry !== null;
  // The row's stats/meta reflect whichever target is actually selected; if
  // none is (row isn't the active one), fall back to the default target.
  const shown = activeEntry ?? defaultEntry;
  const run = shown.run;

  const worst = worstEntry(group.entries);
  const worstEff = runEffectiveStatus(worst.run);
  const statusColor = runStatusColor(worstEff);
  const inProgress = isInProgressStatus(worstEff);

  const label = runLabel(run);
  const eff = runEffectiveStatus(run);
  const isPass = eff === "passed" || eff === "succeeded";
  const s = run.summary;
  const total = s?.total ?? run.testCount ?? 0;
  const hasMultipleTargets = group.entries.length > 1;

  return (
    <div
      onClick={() => onSelect(defaultEntry.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "9px 10px 8px",
        borderRadius: "7px",
        cursor: "pointer",
        marginBottom: "3px",
        userSelect: "none",
        border: `1px solid ${selected || hovered ? "var(--color-sidebar-muted)" : "var(--color-sidebar-border)"}`,
        background: selected
          ? "var(--color-sidebar-selected)"
          : "var(--color-sidebar-raised)",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {/* Headline: dot (worst target across browsers) + suite name + branch/ticket + stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: run.matrixLabel ? "4px" : "0",
        }}
      >
        <div
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: statusColor,
            flexShrink: 0,
            animation: inProgress
              ? "dashboar-pulse 1.5s ease-in-out infinite"
              : undefined,
          }}
        />
        {/* Suite name — never truncated */}
        <span
          style={{
            fontSize: "12.5px",
            fontWeight: 700,
            color: "var(--color-sidebar-foreground)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        {/* Branch / ticket — fills middle, truncates if tight */}
        {run.branch && (
          <span
            style={{
              fontSize: "10.5px",
              color: "var(--color-sidebar-muted)",
              fontFamily: "ui-monospace,monospace",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              flex: 1,
              minWidth: 0,
            }}
          >
            {run.branch}
          </span>
        )}
        {!run.branch && <span style={{ flex: 1 }} />}
        {/* Pass/fail stats — or "Running" for in-progress */}
        {inProgress ? (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#3b82f6",
              flexShrink: 0,
            }}
          >
            Running
          </span>
        ) : s && s.total > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
              fontSize: "10.5px",
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            <span style={{ color: isPass ? "var(--color-sidebar-success)" : "var(--color-sidebar-danger)" }}>
              {s.passed}/{s.total}
            </span>
            {(s.failed ?? 0) > 0 && (
              <span style={{ color: "var(--color-sidebar-danger)", fontWeight: 500 }}>·{s.failed}✗</span>
            )}
            {(s.flaky ?? 0) > 0 && (
              <span style={{ color: "#b45309", fontWeight: 500 }}>·{s.flaky}~</span>
            )}
          </div>
        ) : total > 0 ? (
          <span
            style={{
              fontSize: "10px",
              color: "var(--color-sidebar-muted)",
              flexShrink: 0,
            }}
          >
            {total}
          </span>
        ) : null}
      </div>
      {/* Matrix label (browser / platform) + run timestamp — secondary row */}
      {(run.matrixLabel || run.generatedAt) && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "6px",
            paddingLeft: "13px",
          }}
        >
          {run.matrixLabel && (
            <span
              style={{
                color: "var(--color-sidebar-muted)",
                fontSize: "10.5px",
                fontFamily: "ui-monospace,monospace",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {run.matrixLabel}
            </span>
          )}
          {run.generatedAt && (
            <span
              style={{
                color: "var(--color-sidebar-secondary)",
                fontSize: "10px",
                marginLeft: "auto",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {fmtRunTime(run.generatedAt)}
            </span>
          )}
        </div>
      )}
      {/* Other browser targets for this same build/suite — click to jump straight to one */}
      {hasMultipleTargets && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", paddingLeft: "13px", marginTop: "5px" }}>
          {group.entries.map((e) => {
            const name = browserName(e.run.matrixLabel);
            const chipEff = runEffectiveStatus(e.run);
            const chipColor = runStatusColor(chipEff);
            const isShown = e.key === shown.key;
            return (
              <span
                key={e.key}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect(e.key);
                }}
                title={`${name} · ${chipEff}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "9.5px",
                  fontWeight: 600,
                  padding: "1.5px 6px",
                  borderRadius: "999px",
                  border: `1px solid ${isShown ? chipColor : "var(--color-sidebar-border)"}`,
                  color: isShown ? chipColor : "var(--color-sidebar-muted)",
                  cursor: "pointer",
                }}
              >
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: chipColor, flexShrink: 0 }} />
                {name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  groups: RunGroup[];
  selKey: string | null;
  isMobile: boolean;
  sidebarOpen: boolean;
  search: string;
  statusFilter: "failed" | "passed" | null;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onSearch: (q: string) => void;
  onStatusFilter: (f: "failed" | "passed" | null) => void;
  onOverview: () => void;
  onSelect: (key: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshStatus?: RefreshStatus;
}

function Sidebar({
  groups,
  selKey,
  isMobile,
  sidebarOpen,
  search,
  statusFilter,
  width,
  onWidthChange,
  onClose,
  onSearch,
  onStatusFilter,
  onOverview,
  onSelect,
  onRefresh,
  refreshing,
  refreshStatus,
}: SidebarProps) {
  const trimQ = search.trim().toLowerCase();

  const groupWorstEff = (g: RunGroup) => runEffectiveStatus(worstEntry(g.entries).run);
  const isUnhealthy = (g: RunGroup) => {
    const e = groupWorstEff(g);
    return e === "failed" || e === "succeeded_with_issues" || e === "timedout";
  };
  const isHealthy = (g: RunGroup) => {
    const e = groupWorstEff(g);
    return e === "passed" || e === "succeeded";
  };

  const failed = groups.filter(isUnhealthy).length;
  const passed = groups.filter(isHealthy).length;

  const groupMatchesSearch = (g: RunGroup) =>
    g.entries.some(
      ({ run: r }) =>
        runLabel(r).toLowerCase().includes(trimQ) ||
        r.branch?.toLowerCase().includes(trimQ) ||
        r.commit?.toLowerCase().includes(trimQ) ||
        r.matrixLabel?.toLowerCase().includes(trimQ) ||
        r.buildNumber?.toLowerCase().includes(trimQ),
    );

  const filtered = groups.filter((g) => {
    if (statusFilter === "failed" && !isUnhealthy(g)) return false;
    if (statusFilter === "passed" && !isHealthy(g)) return false;
    if (!trimQ) return true;
    return groupMatchesSearch(g);
  });

  return (
    <ReportSidebar
      isMobile={isMobile}
      open={sidebarOpen}
      onClose={onClose}
      width={width}
      onWidthChange={onWidthChange}
      header={<SidebarBoarHeader onRefresh={onRefresh} refreshing={refreshing} refreshStatus={refreshStatus} />}
    >
      <div style={{ padding: "8px 8px 0", flexShrink: 0 }}>
        <OverviewLink active={!selKey} onClick={onOverview} />

        {/* Status pills — clickable to filter */}
        {(failed > 0 || passed > 0) && (
          <div
            style={{
              padding: "4px 10px 2px",
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {failed > 0 && (
              <button
                onClick={() =>
                  onStatusFilter(statusFilter === "failed" ? null : "failed")
                }
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  color: "var(--color-sidebar-danger)",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  background:
                    statusFilter === "failed" ? "#ef444430" : "#ef444415",
                  outline:
                    statusFilter === "failed"
                      ? "1.5px solid var(--color-sidebar-danger)"
                      : "none",
                  transition: "background 0.1s",
                }}
              >
                ✗ {failed} failed
              </button>
            )}
            {passed > 0 && (
              <button
                onClick={() =>
                  onStatusFilter(statusFilter === "passed" ? null : "passed")
                }
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  color: "var(--color-sidebar-success)",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  background:
                    statusFilter === "passed" ? "#22c55e30" : "#22c55e15",
                  outline:
                    statusFilter === "passed"
                      ? "1.5px solid var(--color-sidebar-success)"
                      : "none",
                  transition: "background 0.1s",
                }}
              >
                ✓ {passed} passed
              </button>
            )}
          </div>
        )}

        {/* Search */}
        <div style={{ padding: "6px 2px 2px" }}>
          <div style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                left: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "var(--color-sidebar-muted)",
              }}
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle
                cx="6"
                cy="6"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M9.5 9.5l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Filter runs…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 26px 6px 26px",
                background: "var(--color-sidebar-raised)",
                border: "1px solid var(--color-sidebar-border)",
                borderRadius: "6px",
                color: "var(--color-sidebar-foreground)",
                fontSize: "11.5px",
                outline: "none",
                caretColor: "var(--color-accent)",
              }}
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                style={{
                  position: "absolute",
                  right: "7px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-sidebar-muted)",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 2l6 6M8 2l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "10px 10px 5px",
            color: "var(--color-sidebar-secondary)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          }}
        >
          {trimQ || statusFilter
            ? `${filtered.length} of ${groups.length}`
            : `${groups.length} Run${groups.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: "0 8px 8px" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "16px",
              fontSize: "12px",
              color: "var(--color-sidebar-muted)",
              textAlign: "center",
            }}
          >
            No runs match your filter.
          </div>
        ) : (
          filtered.map((g) => (
            <GroupRow key={g.key} group={g} selKey={selKey} onSelect={onSelect} />
          ))
        )}
      </div>
    </ReportSidebar>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard({ data, onRefresh, refreshing, refreshStatus }: ReportProps) {
  const report = data as E2eAggregateReport;
  const allRuns = report.reviews ?? report.runs ?? [];
  const groups = buildGroups(allRuns);
  const reportType =
    new URLSearchParams(window.location.search).get("report") ??
    "playwright-trace";

  const [selKey, setSelKey] = useState<string | null>(null);
  // lastSelKey persists the last viewed run so RunDetailView stays mounted
  // (and its iframe stays loaded) when the user navigates back to the overview.
  const [lastSelKey, setLastSelKey] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 768,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"failed" | "passed" | null>(
    null,
  );
  const [showJson, setShowJson] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useSidebarWidth(reportType);

  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 768;
      setIsMobile(m);
      if (m) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleSelect = (key: string) => {
    setSelKey(key);
    setLastSelKey(key);
    if (isMobile) setSidebarOpen(false);
  };

  const handleOverview = () => {
    setSelKey(null);
    // lastSelKey intentionally not cleared — keeps RunDetailView mounted
    if (isMobile) setSidebarOpen(false);
  };

  const handleSelectRun = (run: E2eRunEntry) => {
    const idx = allRuns.indexOf(run);
    if (idx === -1) return;
    handleSelect(runKey(run, idx));
  };

  // The run we keep rendered (may differ from selKey when on overview)
  const viewKey = selKey ?? lastSelKey;
  const viewRun = viewKey
    ? (allRuns.find((r, i) => runKey(r, i) === viewKey) ?? null)
    : null;

  // Other browser targets for the same (build, suite) as viewRun — powers the
  // pill switcher in RunDetailView. Falls back to just the run itself when it
  // couldn't be grouped with anything.
  const siblings = viewRun
    ? (groups.find((g) => g.entries.some((e) => e.run === viewRun))?.entries.map((e) => e.run) ?? [viewRun])
    : [];

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
        background: "var(--color-background)",
      }}
    >
      <Sidebar
        groups={groups}
        selKey={selKey}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        search={search}
        statusFilter={statusFilter}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        onClose={() => setSidebarOpen(false)}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onOverview={handleOverview}
        onSelect={handleSelect}
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshStatus={refreshStatus}
      />

      <main
        style={{
          flex: 1,
          overflow: "hidden",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isMobile && (
          <MobileTopBar
            title={
              allRuns.length ? `E2E · ${allRuns.length} runs` : "E2E Tests"
            }
            onToggle={() => setSidebarOpen((s) => !s)}
          />
        )}

        {/* Both panels stay mounted; CSS visibility swaps them without unmounting. */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Detail view — hidden (but alive) when on overview */}
          {viewRun && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                visibility: selKey ? "visible" : "hidden",
                pointerEvents: selKey ? "auto" : "none",
              }}
            >
              <RunDetailView
                run={viewRun}
                siblings={siblings}
                reportType={reportType}
                onBack={handleOverview}
                onSelectRun={handleSelectRun}
              />
            </div>
          )}

          {/* Overview — hidden when a run is selected */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              visibility: selKey ? "hidden" : "visible",
              pointerEvents: selKey ? "none" : "auto",
            }}
          >
            <OverviewView report={report} onSelectRun={handleSelectRun} />
          </div>
        </div>
      </main>

      <JsonToggleButton active={showJson} onClick={() => setShowJson(true)} />
      {showJson && (
        <RawJsonModal
          data={selKey ? (viewRun ?? report) : report}
          title={selKey && viewRun ? (viewRun.suiteName ?? viewRun.jobName ?? `Run ${viewKey}`) : "E2E Aggregate Report"}
          subtitle={selKey ? "Raw JSON — selected run" : "Raw JSON — full report"}
          onClose={() => setShowJson(false)}
        />
      )}

      <DocsButton active={showDocs} onClick={() => setShowDocs(true)} />
      {showDocs && <DocsModal defaultTopic={reportType} onClose={() => setShowDocs(false)} />}
    </div>
  );
}
