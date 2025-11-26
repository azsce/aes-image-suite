# SonarQube Analysis Scripts

This directory contains scripts for running SonarQube analysis and fetching results.

## Scripts

### `run.sh`

Main script that:

1. Starts SonarQube Docker container
2. Configures authentication
3. Runs the scanner
4. Fetches and displays results (including duplications)

**Usage:**

```bash
bun run sonar-scan
# or
bash health/sonar/run.sh
```

**Reset setup state:**

```bash
bash health/sonar/run.sh --reset
```

### `result_only.ts`

Fetches **file-level code quality issues** only:

- Bugs
- Code smells
- Vulnerabilities
- Security hotspots

**Does NOT include:**

- Project-level duplication metrics
- Duplicated blocks details

**Usage:**

```bash
bun run sonar-result
# or
bun run health/sonar/result_only.ts
```

### `result_with_duplications.ts` (Enhanced)

Fetches **both** file-level issues AND project-level duplication data:

**File-Level Issues:**

- Bugs
- Code smells
- Vulnerabilities
- Security hotspots

**Project-Level Duplication Metrics:**

- Overall Code:
  - Duplication density (%)
  - Duplicated lines count
  - Duplicated blocks count
  - Duplicated files count
- New Code:
  - Duplication density (%)
  - Duplicated lines count
  - Duplicated blocks count

**Duplicated Blocks Details:**

- Lists all files with duplications
- Shows duplication groups
- Displays line ranges for each duplicated block
- Shows which files share duplicated code

**Usage:**

```bash
bun run sonar-full
# or
bun run health/sonar/result_with_duplications.ts
```

## Output Comparison

### `result_only.ts` Output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CODE QUALITY ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/components/MyComponent.tsx
  10:5  ⚠  Cognitive Complexity of this function is too high  sonarjs/cognitive-complexity

✖ 1 problems (0 errors, 1 warnings, 0 infos)
```

### `result_with_duplications.ts` Output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CODE DUPLICATION METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Code:
  Density:           2.8%
  Duplicated Lines:  40
  Duplicated Blocks: 4
  Duplicated Files:  18

New Code:
  Density:           0.0%
  Duplicated Lines:  0
  Duplicated Blocks: 4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DUPLICATED BLOCKS DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/components/AnalysisPane/CircuitGraphEngine/LayoutOptimizer.test.ts (2 duplicated blocks)
  Duplication Group 1:
    → src/components/AnalysisPane/CircuitGraphEngine/LayoutOptimizer.test.ts (lines 100-120)
    → src/components/AnalysisPane/CircuitGraphEngine/GraphLayoutEngine.test.ts (lines 150-170)
  Duplication Group 2:
    → src/components/AnalysisPane/CircuitGraphEngine/LayoutOptimizer.test.ts (lines 200-215)
    → src/components/AnalysisPane/CircuitGraphEngine/NodePlacer.dynamicSpacing.test.ts (lines 50-65)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CODE QUALITY ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/components/MyComponent.tsx
  10:5  ⚠  Cognitive Complexity of this function is too high  sonarjs/cognitive-complexity

✖ 1 problems (0 errors, 1 warnings, 0 infos)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SONARQUBE DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  View detailed report: http://localhost:9000/dashboard?id=cad
  Duplications page:    http://localhost:9000/component_measures?id=cad&metric=duplicated_lines_density
```

## Key Differences

| Feature                            | `result_only.ts` | `result_with_duplications.ts` |
| ---------------------------------- | ---------------- | ----------------------------- |
| File-level issues                  | ✅               | ✅                            |
| Duplication density                | ❌               | ✅                            |
| Duplicated lines count             | ❌               | ✅                            |
| Duplicated blocks count            | ❌               | ✅                            |
| Duplicated files count             | ❌               | ✅                            |
| New code duplication               | ❌               | ✅                            |
| Duplicated blocks details          | ❌               | ✅                            |
| Line-by-line duplication locations | ❌               | ✅                            |

## When to Use Which

### Use `result_only.ts` when:

- You only care about code quality issues (bugs, smells, vulnerabilities)
- You want a quick check without duplication analysis
- You're focused on fixing specific issues

### Use `result_with_duplications.ts` when:

- You want a complete picture of code health
- You need to track duplication metrics
- You want to identify and eliminate duplicated code
- You're preparing for a code review or quality gate
- You want to see exactly where code is duplicated

## Configuration

Both scripts read the SonarQube token from `.sonar-token` file in this directory.

The token is automatically generated by `run.sh` during first setup.

## SonarQube API Endpoints Used

### `result_only.ts`:

- `/api/issues/search` - Fetch code quality issues

### `result_with_duplications.ts`:

- `/api/issues/search` - Fetch code quality issues
- `/api/measures/component` - Fetch project-level duplication metrics
- `/api/measures/component_tree` - Fetch file-level duplication metrics
- `/api/duplications/show` - Fetch detailed duplication blocks

## Notes

- The `run.sh` script now uses `result_with_duplications.ts` by default
- Both scripts support the same authentication mechanism
- Duplication metrics are calculated during the normal SonarQube scan
- No additional configuration needed to enable duplication detection
