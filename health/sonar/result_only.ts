#!/usr/bin/env bun
/* eslint-disable no-console */

/**
 * 🔍 Fetch SonarQube issues and display them in ESLint format
 *
 * Usage:
 *   bun run sonar/fetch-issues.ts [token] [project_key] [sonar_host]
 *
 * Arguments:
 *   token       - SonarQube API token (optional, reads from .sonar-token if not provided)
 *   project_key - Project key (default: cad)
 *   sonar_host  - SonarQube host URL (default: http://localhost:9000)
 */

interface SonarIssue {
  key: string;
  rule: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
  type: string;
  status: string;
  textRange?: {
    startLine: number;
    endLine: number;
    startOffset: number;
    endOffset: number;
  };
}

interface SonarResponse {
  total: number;
  p: number;
  ps: number;
  paging: {
    pageIndex: number;
    pageSize: number;
    total: number;
  };
  issues: SonarIssue[];
}

const SEVERITY_MAP: Record<string, string> = {
  BLOCKER: "error",
  CRITICAL: "error",
  MAJOR: "warning",
  MINOR: "warning",
  INFO: "info",
};

const SEVERITY_SYMBOLS: Record<string, string> = {
  error: "✖",
  warning: "⚠",
  info: "ℹ",
};

// ANSI color codes
const COLORS = {
  RED: "\x1b[0;31m",
  YELLOW: "\x1b[1;33m",
  BLUE: "\x1b[0;34m",
  GREEN: "\x1b[0;32m",
  NC: "\x1b[0m", // No Color
};

const SEVERITY_COLORS: Record<string, string> = {
  error: COLORS.RED,
  warning: COLORS.YELLOW,
  info: COLORS.BLUE,
};

/**
 * 🎨 Format issue in ESLint style
 */
function formatIssue(issue: SonarIssue): string {
  const severity = SEVERITY_MAP[issue.severity] ?? "warning";
  const symbol = SEVERITY_SYMBOLS[severity] ?? "•";
  const color = SEVERITY_COLORS[severity] ?? COLORS.NC;

  const line = issue.line ?? issue.textRange?.startLine ?? 0;
  const column = issue.textRange?.startOffset ?? 0;

  return `  ${COLORS.NC}${String(line)}:${String(column)}  ${color}${symbol}${COLORS.NC}  ${issue.message}  ${COLORS.NC}${issue.rule}`;
}

/**
 * 📊 Group issues by file
 */
function groupIssuesByFile(issues: SonarIssue[], projectKey: string): Map<string, SonarIssue[]> {
  const grouped = new Map<string, SonarIssue[]>();

  for (const issue of issues) {
    const filePath = issue.component.replace(`${projectKey}:`, "");
    const fileIssues = grouped.get(filePath) ?? [];
    fileIssues.push(issue);
    grouped.set(filePath, fileIssues);
  }

  // Sort issues within each file by line number
  for (const [filePath, fileIssues] of grouped) {
    fileIssues.sort((a, b) => {
      const lineA = a.line ?? a.textRange?.startLine ?? 0;
      const lineB = b.line ?? b.textRange?.startLine ?? 0;
      return lineA - lineB;
    });
    grouped.set(filePath, fileIssues);
  }

  return grouped;
}

/**
 * 📈 Calculate summary statistics
 */
function calculateSummary(issues: SonarIssue[]): { errors: number; warnings: number; infos: number } {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const issue of issues) {
    const severity = SEVERITY_MAP[issue.severity] ?? "warning";
    if (severity === "error") errors++;
    else if (severity === "warning") warnings++;
    else infos++;
  }

  return { errors, warnings, infos };
}

/**
 * 🎨 Print issues in ESLint format
 */
function printIssues(issues: SonarIssue[], projectKey: string): void {
  if (issues.length === 0) {
    console.log(`\n${COLORS.GREEN}✨ No issues found!${COLORS.NC}\n`);
    return;
  }

  const grouped = groupIssuesByFile(issues, projectKey);

  // Sort files alphabetically
  const sortedFiles = Array.from(grouped.keys()).sort();

  // Print issues grouped by file
  for (const filePath of sortedFiles) {
    const fileIssues = grouped.get(filePath);
    if (!fileIssues) continue;

    console.log(`\n${COLORS.NC}${filePath}`);
    for (const issue of fileIssues) {
      console.log(formatIssue(issue));
    }
  }

  // Print summary
  const summary = calculateSummary(issues);
  const totalProblems = summary.errors + summary.warnings + summary.infos;
  console.log("");
  console.log(
    `${COLORS.RED}✖ ${String(totalProblems)} problems ${COLORS.NC}(${COLORS.RED}${String(summary.errors)} errors${COLORS.NC}, ${COLORS.YELLOW}${String(summary.warnings)} warnings${COLORS.NC}, ${COLORS.BLUE}${String(summary.infos)} infos${COLORS.NC})`
  );
  console.log("");
}

/**
 * 🌐 Fetch issues from SonarQube API
 */
async function fetchIssues(
  token: string,
  projectKey: string,
  sonarHost: string,
  statuses: string[] = ["OPEN", "CONFIRMED"]
): Promise<SonarIssue[]> {
  const allIssues: SonarIssue[] = [];
  let page = 1;
  const pageSize = 500;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const url = new URL(`${sonarHost}/api/issues/search`);
    url.searchParams.set("componentKeys", projectKey);
    url.searchParams.set("statuses", statuses.join(","));
    url.searchParams.set("p", String(page));
    url.searchParams.set("ps", String(pageSize));

    const authHeader = `Basic ${btoa(`${token}:`)}`;

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`SonarQube API error: ${String(response.status)} ${response.statusText}`);
    }

    const data = (await response.json()) as SonarResponse;
    allIssues.push(...data.issues);

    const totalPages = Math.ceil(data.paging.total / pageSize);
    console.error(
      `${COLORS.BLUE}ℹ${COLORS.NC} Fetched page ${String(page)}/${String(totalPages)} (${String(allIssues.length)}/${String(data.paging.total)} issues)`
    );

    if (allIssues.length >= data.paging.total) {
      break;
    }

    page++;
  }

  return allIssues;
}

/**
 * 📄 Read token from file
 */
async function readTokenFromFile(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    return content.trim();
  } catch {
    return null;
  }
}

/**
 * 🚀 Main execution
 */
async function main(): Promise<void> {
  const scriptDir = import.meta.dir;
  const tokenFile = `${scriptDir}/.sonar-token`;
  const projectKey = "cad";
  const sonarHost = "http://localhost:9000";

  const token = (await readTokenFromFile(tokenFile)) ?? "";

  if (!token) {
    console.error(`${COLORS.RED}✖${COLORS.NC} Error: SonarQube token not found`);
    console.error("\nCreate a .sonar-token file in the sonar directory");
    process.exit(1);
  }

  console.error(`\n${COLORS.BLUE}ℹ${COLORS.NC} Fetching issues from SonarQube...`);
  console.error(`   Host: ${sonarHost}`);
  console.error(`   Project: ${projectKey}\n`);

  try {
    const issues = await fetchIssues(token, projectKey, sonarHost);
    printIssues(issues, projectKey);
  } catch (error) {
    console.error(`\n${COLORS.RED}✖${COLORS.NC} Error fetching issues:`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
