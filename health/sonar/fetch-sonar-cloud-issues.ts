#!/usr/bin/env bun
/* eslint-disable no-console */

/**
 * 🔍 Fetch SonarCloud issues and display them in ESLint format
 *
 * Usage:
 *   bun run scripts/fetch-sonar-issues.ts
 *
 * Environment variables:
 *   SONAR_TOKEN - Your SonarCloud API token (required)
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

const SONAR_CONFIG = {
  organization: "azsce",
  projectKey: "azsce_cad",
  baseUrl: "https://sonarcloud.io/api",
};

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

/**
 * 🎨 Format issue in ESLint style
 */
function formatIssue(issue: SonarIssue, _projectRoot: string): string {
  const severity = SEVERITY_MAP[issue.severity] ?? "warning";
  const symbol = SEVERITY_SYMBOLS[severity] ?? "•";

  // Extract file path from component (format: projectKey:path/to/file.ts)
  const line = issue.line ?? issue.textRange?.startLine ?? 0;
  const column = issue.textRange?.startOffset ?? 0;

  return `  ${String(line)}:${String(column)}  ${symbol}  ${issue.message}  ${issue.rule}`;
}

/**
 * 📊 Group issues by file
 */
function groupIssuesByFile(issues: SonarIssue[]): Map<string, SonarIssue[]> {
  const grouped = new Map<string, SonarIssue[]>();

  for (const issue of issues) {
    const filePath = issue.component.replace(`${SONAR_CONFIG.projectKey}:`, "");
    const fileIssues = grouped.get(filePath) ?? [];
    fileIssues.push(issue);
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
function printIssues(issues: SonarIssue[]): void {
  if (issues.length === 0) {
    console.log("\n✨ No issues found!\n");
    return;
  }

  const grouped = groupIssuesByFile(issues);
  const projectRoot = process.cwd();

  // Print issues grouped by file
  for (const [filePath, fileIssues] of grouped) {
    console.log(`\n${filePath}`);
    for (const issue of fileIssues) {
      console.log(formatIssue(issue, projectRoot));
    }
  }

  // Print summary
  const summary = calculateSummary(issues);
  const totalProblems = summary.errors + summary.warnings + summary.infos;
  console.log("");
  console.log(
    `✖ ${String(totalProblems)} problems (${String(summary.errors)} errors, ${String(summary.warnings)} warnings, ${String(summary.infos)} infos)`
  );
  console.log("");
}

/**
 * 🌐 Fetch issues from SonarCloud API
 */
async function fetchIssues(token: string, statuses: string[] = ["OPEN", "CONFIRMED"]): Promise<SonarIssue[]> {
  const allIssues: SonarIssue[] = [];
  let page = 1;
  const pageSize = 500;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const url = new URL(`${SONAR_CONFIG.baseUrl}/issues/search`);
    url.searchParams.set("componentKeys", SONAR_CONFIG.projectKey);
    url.searchParams.set("organization", SONAR_CONFIG.organization);
    url.searchParams.set("statuses", statuses.join(","));
    url.searchParams.set("p", String(page));
    url.searchParams.set("ps", String(pageSize));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`SonarCloud API error: ${String(response.status)} ${response.statusText}`);
    }

    const data = (await response.json()) as SonarResponse;
    allIssues.push(...data.issues);

    const totalPages = Math.ceil(data.paging.total / pageSize);
    console.error(
      `Fetched page ${String(page)}/${String(totalPages)} (${String(allIssues.length)}/${String(data.paging.total)} issues)`
    );

    if (allIssues.length >= data.paging.total) {
      break;
    }

    page++;
  }

  return allIssues;
}

/**
 * 🚀 Main execution
 */
const token = process.env.SONAR_TOKEN;

if (!token) {
  console.error("❌ Error: SONAR_TOKEN environment variable is required");
  console.error("\nGenerate a token at: https://sonarcloud.io/account/security");
  console.error("\nUsage:");
  console.error("  SONAR_TOKEN=your_token_here bun run scripts/fetch-sonar-issues.ts");
  process.exit(1);
}

console.error(`\n🔍 Fetching issues from SonarCloud...`);
console.error(`   Organization: ${SONAR_CONFIG.organization}`);
console.error(`   Project: ${SONAR_CONFIG.projectKey}\n`);

try {
  const issues = await fetchIssues(token);
  printIssues(issues);
} catch (error) {
  console.error("\n❌ Error fetching issues:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
