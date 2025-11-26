#!/usr/bin/env bun
/* eslint-disable no-console */

/**
 * 🔍 Fetch SonarQube issues AND duplication metrics
 *
 * This script fetches both:
 * 1. File-level code quality issues (bugs, code smells, vulnerabilities)
 * 2. Project-level duplication metrics (duplicated blocks, lines, files)
 *
 * Usage:
 *   bun run health/sonar/result_with_duplications.ts
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

interface SonarMeasure {
  metric: string;
  value?: string;
  periods?: Array<{ index: number; value: string }>;
}

interface SonarMeasuresResponse {
  component: {
    key: string;
    name: string;
    measures: SonarMeasure[];
  };
}

interface DuplicationBlock {
  from: number;
  size: number;
  _ref?: string;
}

interface DuplicationGroup {
  blocks: DuplicationBlock[];
}

interface SonarDuplicationsResponse {
  duplications: DuplicationGroup[];
  files: Record<
    string,
    {
      key: string;
      name: string;
    }
  >;
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
  CYAN: "\x1b[0;36m",
  MAGENTA: "\x1b[0;35m",
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
    console.log(`\n${COLORS.GREEN}✨ No code quality issues found!${COLORS.NC}\n`);
    return;
  }

  const grouped = groupIssuesByFile(issues, projectKey);

  // Sort files alphabetically
  const sortedFiles = Array.from(grouped.keys()).sort();

  console.log(`\n${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}`);
  console.log(`${COLORS.CYAN}  CODE QUALITY ISSUES${COLORS.NC}`);
  console.log(`${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}`);

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
 * 📊 Print duplication metrics
 */
function printDuplicationMetrics(measures: SonarMeasure[]): void {
  const metricsMap = new Map(measures.map(m => [m.metric, m]));

  // Overall code duplication
  const duplicatedLinesDensity = metricsMap.get("duplicated_lines_density")?.value;
  const duplicatedLines = metricsMap.get("duplicated_lines")?.value;
  const duplicatedBlocks = metricsMap.get("duplicated_blocks")?.value;
  const duplicatedFiles = metricsMap.get("duplicated_files")?.value;

  // New code duplication
  const newDuplicatedLinesDensity = metricsMap.get("new_duplicated_lines_density")?.periods?.[0]?.value;
  const newDuplicatedLines = metricsMap.get("new_duplicated_lines")?.periods?.[0]?.value;
  const newDuplicatedBlocks = metricsMap.get("new_duplicated_blocks")?.periods?.[0]?.value;

  console.log(`${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}`);
  console.log(`${COLORS.CYAN}  CODE DUPLICATION METRICS${COLORS.NC}`);
  console.log(`${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}\n`);

  // Overall Code section
  console.log(`${COLORS.MAGENTA}Overall Code:${COLORS.NC}`);
  if (duplicatedLinesDensity) {
    const density = parseFloat(duplicatedLinesDensity);
    const color = density > 3 ? COLORS.RED : density > 0 ? COLORS.YELLOW : COLORS.GREEN;
    console.log(`  Density:           ${color}${density.toFixed(1)}%${COLORS.NC}`);
  }
  if (duplicatedLines) {
    console.log(`  Duplicated Lines:  ${COLORS.NC}${duplicatedLines}`);
  }
  if (duplicatedBlocks) {
    console.log(`  Duplicated Blocks: ${COLORS.NC}${duplicatedBlocks}`);
  }
  if (duplicatedFiles) {
    console.log(`  Duplicated Files:  ${COLORS.NC}${duplicatedFiles}`);
  }

  // New Code section
  if (newDuplicatedLinesDensity ?? newDuplicatedLines ?? newDuplicatedBlocks) {
    console.log(`\n${COLORS.MAGENTA}New Code:${COLORS.NC}`);
    if (newDuplicatedLinesDensity) {
      const density = parseFloat(newDuplicatedLinesDensity);
      const color = density > 3 ? COLORS.RED : density > 0 ? COLORS.YELLOW : COLORS.GREEN;
      console.log(`  Density:           ${color}${density.toFixed(1)}%${COLORS.NC}`);
    }
    if (newDuplicatedLines) {
      console.log(`  Duplicated Lines:  ${COLORS.NC}${newDuplicatedLines}`);
    }
    if (newDuplicatedBlocks) {
      console.log(`  Duplicated Blocks: ${COLORS.NC}${newDuplicatedBlocks}`);
    }
  }

  console.log("");
}

/**
 * 🔍 Fetch and print duplicated blocks details
 */
async function fetchAndPrintDuplicatedBlocks(token: string, projectKey: string, sonarHost: string): Promise<void> {
  // First, get all files with duplications
  const measuresUrl = new URL(`${sonarHost}/api/measures/component_tree`);
  measuresUrl.searchParams.set("component", projectKey);
  measuresUrl.searchParams.set("metricKeys", "duplicated_blocks");
  measuresUrl.searchParams.set("ps", "500");

  const authHeader = `Basic ${btoa(`${token}:`)}`;

  const response = await fetch(measuresUrl.toString(), {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    console.error(`${COLORS.YELLOW}⚠${COLORS.NC} Could not fetch duplicated blocks details`);
    return;
  }

  interface ComponentTreeResponse {
    baseComponent: { key: string; name: string };
    components: Array<{
      key: string;
      name: string;
      qualifier: string;
      path: string;
      measures: SonarMeasure[];
    }>;
  }

  const data = (await response.json()) as ComponentTreeResponse;

  // Filter files with duplications (exclude directories - they have qualifier "DIR")
  const filesWithDuplications = data.components.filter(comp => {
    const blocks = comp.measures.find(m => m.metric === "duplicated_blocks");
    const hasBlocks = blocks?.value && parseInt(blocks.value) > 0;
    // Only include actual files (FIL), not directories (DIR)
    const isFile = comp.qualifier === "FIL";
    return hasBlocks && isFile;
  });

  if (filesWithDuplications.length === 0) {
    return;
  }

  console.log(`${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}`);
  console.log(`${COLORS.CYAN}  DUPLICATED BLOCKS DETAILS${COLORS.NC}`);
  console.log(`${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}\n`);

  // Fetch duplication details for each file
  for (const file of filesWithDuplications) {
    const blocks = file.measures.find(m => m.metric === "duplicated_blocks");
    const blockCount = blocks?.value ? parseInt(blocks.value) : 0;

    const filePath = file.path;
    console.log(`${COLORS.NC}${filePath} ${COLORS.YELLOW}(${String(blockCount)} duplicated blocks)${COLORS.NC}`);

    // Fetch duplication details
    const dupUrl = new URL(`${sonarHost}/api/duplications/show`);
    dupUrl.searchParams.set("key", file.key);

    const dupResponse = await fetch(dupUrl.toString(), {
      headers: { Authorization: authHeader },
    });

    if (dupResponse.ok) {
      const dupData = (await dupResponse.json()) as SonarDuplicationsResponse;

      for (const [index, group] of dupData.duplications.entries()) {
        console.log(`  ${COLORS.MAGENTA}Duplication Group ${String(index + 1)}:${COLORS.NC}`);

        for (const block of group.blocks) {
          if (block._ref) {
            const refFile = dupData.files[block._ref];
            const refPath = refFile?.name ?? block._ref;
            console.log(
              `    ${COLORS.CYAN}→${COLORS.NC} ${refPath} (lines ${String(block.from)}-${String(block.from + block.size - 1)})`
            );
          } else {
            console.log(
              `    ${COLORS.CYAN}→${COLORS.NC} ${filePath} (lines ${String(block.from)}-${String(block.from + block.size - 1)})`
            );
          }
        }
      }
    }

    console.log("");
  }
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
      `${COLORS.BLUE}ℹ${COLORS.NC} Fetched issues page ${String(page)}/${String(totalPages)} (${String(allIssues.length)}/${String(data.paging.total)} issues)`
    );

    if (allIssues.length >= data.paging.total) {
      break;
    }

    page++;
  }

  return allIssues;
}

/**
 * 📊 Fetch duplication metrics from SonarQube API
 */
async function fetchDuplicationMetrics(token: string, projectKey: string, sonarHost: string): Promise<SonarMeasure[]> {
  const url = new URL(`${sonarHost}/api/measures/component`);
  url.searchParams.set("component", projectKey);
  url.searchParams.set(
    "metricKeys",
    [
      "duplicated_lines_density",
      "duplicated_lines",
      "duplicated_blocks",
      "duplicated_files",
      "new_duplicated_lines_density",
      "new_duplicated_lines",
      "new_duplicated_blocks",
    ].join(",")
  );

  const authHeader = `Basic ${btoa(`${token}:`)}`;

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`SonarQube API error: ${String(response.status)} ${response.statusText}`);
  }

  const data = (await response.json()) as SonarMeasuresResponse;
  return data.component.measures;
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
    console.error("\nCreate a .sonar-token file in the health/sonar directory");
    process.exit(1);
  }

  console.error(`\n${COLORS.BLUE}ℹ${COLORS.NC} Fetching data from SonarQube...`);
  console.error(`   Host: ${sonarHost}`);
  console.error(`   Project: ${projectKey}\n`);

  try {
    // Fetch both issues and duplication metrics
    const [issues, duplicationMetrics] = await Promise.all([
      fetchIssues(token, projectKey, sonarHost),
      fetchDuplicationMetrics(token, projectKey, sonarHost),
    ]);

    // Print duplication metrics first
    printDuplicationMetrics(duplicationMetrics);

    // Print detailed duplicated blocks
    await fetchAndPrintDuplicatedBlocks(token, projectKey, sonarHost);

    // Print code quality issues
    printIssues(issues, projectKey);

    // Print dashboard link
    console.log(`${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}`);
    console.log(`${COLORS.CYAN}  SONARQUBE DASHBOARD${COLORS.NC}`);
    console.log(`${COLORS.CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.NC}\n`);
    console.log(`  View detailed report: ${COLORS.BLUE}${sonarHost}/dashboard?id=${projectKey}${COLORS.NC}`);
    console.log(
      `  Duplications page:    ${COLORS.BLUE}${sonarHost}/component_measures?id=${projectKey}&metric=duplicated_lines_density${COLORS.NC}\n`
    );
  } catch (error) {
    console.error(`\n${COLORS.RED}✖${COLORS.NC} Error fetching data:`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
