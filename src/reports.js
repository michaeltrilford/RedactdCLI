import path from "node:path";
import { ensureDir, writeJson, writeText } from "./fs-utils.js";

const DESIGN_SYSTEM_CSS_URLS = [
  "https://unpkg.com/@muibook/components@18.0.1/dist/esm/css/mui-reset.css",
  "https://unpkg.com/@muibook/components@18.0.1/dist/esm/css/mui-base.css",
  "https://unpkg.com/@muibook/components@18.0.1/dist/esm/css/mui-brand.css",
  "https://unpkg.com/@muibook/components@18.0.1/dist/esm/css/mui-tokens.css",
];
const DESIGN_SYSTEM_JS_URLS = ["https://unpkg.com/@muibook/components@18.0.1/dist/esm/index.js"];
const COMPONENT_FLASH_GUARD_CSS = `
  /* Prevent flash of unupgraded custom elements while Muibook loads. */
  :not(:defined) {
    visibility: hidden;
  }
`;

function nowStamp() {
  return new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", "-")
    .replace(/:/g, "-");
}

function reportMarkdown(report) {
  return `# ${report.persona.name}

Type
${report.persona.type}

Role
${report.persona.role}

Task
${report.task}

Task Success
${report.taskSuccess ? "true" : "false"}

CSAT
${report.csat}

Friction Score
${report.frictionScore}

Clarity Score
${report.clarityScore}

Pages Reviewed
${report.pagesReviewed.join(", ")}

Friction Points
${report.frictionPoints.map((item) => `- ${item}`).join("\n")}

Confusion Points
${report.confusionPoints.map((item) => `- ${item}`).join("\n")}

Recommendations
${report.recommendations.map((item) => `- ${item}`).join("\n")}
`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderList(items) {
  return `<mui-list>${items
    .map((item) => `<mui-list-item size="small">${escapeHtml(item)}</mui-list-item>`)
    .join("")}</mui-list>`;
}

function renderMetricCard(label, value) {
  return `<mui-card><mui-card-body><mui-v-stack space="var(--space-100)"><mui-body size="small" variant="optional">${escapeHtml(
    label,
  )}</mui-body><mui-heading level="2" size="4">${escapeHtml(
    value,
  )}</mui-heading></mui-v-stack></mui-card-body></mui-card>`;
}

function renderMetaItem(label, value) {
  return `<mui-body size="small" variant="optional">${escapeHtml(label)}: ${escapeHtml(value)}</mui-body>`;
}

function dashboardHtml({ project, reports, summary, scores, runDirName }) {
  const cssLinks = DESIGN_SYSTEM_CSS_URLS.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");
  const jsScripts = DESIGN_SYSTEM_JS_URLS.map((src) => `<script type="module" src="${src}"></script>`).join("\n");
  const flashGuard = COMPONENT_FLASH_GUARD_CSS ? `<style>${COMPONENT_FLASH_GUARD_CSS}</style>` : "";
  const overviewCards = [
    renderMetricCard("Average CSAT", scores.averageCsat),
    renderMetricCard("Success Rate", scores.successRate),
    renderMetricCard("Pages", summary.pages.length),
    renderMetricCard("Personas", summary.personas.length),
  ].join("\n");
  const heroMetaItems = [
    renderMetaItem("Run", runDirName),
    renderMetaItem("Reports", reports.length),
    renderMetaItem("Provider", reports[0]?.provider ?? "unknown"),
    renderMetaItem("Model", reports[0]?.model ?? "unknown"),
  ];

  const reportCards = reports
    .map(
      (report) => `
        <mui-card class="report-card" style="padding: var(--space-400);">
          <mui-card-body condensed>
            <mui-v-stack space="var(--space-400)">

              <mui-h-stack class="report-type" space="var(--space-000)" alignX="space-between">
                <mui-v-stack space="var(--space-000)">
                  <mui-body size="x-small" variant="optional">
                    ${escapeHtml(report.persona.type)}
                  </mui-body>
                  <mui-body size="x-small" weight="bold">
                    ${escapeHtml(report.persona.role)}
                  </mui-body>
                </mui-v-stack>
                <mui-badge variant="neutral">CSAT ${escapeHtml(report.csat)}</mui-badge>
              </mui-h-stack>

              <mui-h-stack class="report-header" space="var(--space-300)" aligny="start">
                <mui-heading level="2" size="4">${escapeHtml(report.persona.name)}</mui-heading>
              </mui-h-stack>

              <mui-v-stack space="var(--space-400)">
                <mui-grid class="score-row" space="var(--space-400)" col="1fr 1fr 1fr">
                  <mui-v-stack alignX="center" class="metrics" space="var(--space-000)">
                    <mui-body size="small" variant="optional">Success</mui-body>
                    <mui-heading level="3" size="5">${report.taskSuccess ? "Yes" : "No"}</mui-heading>
                  </mui-v-stack>
                  <mui-v-stack alignX="center" class="metrics" space="var(--space-000)">
                    <mui-body size="small" variant="optional">Friction</mui-body>
                    <mui-heading level="3" size="5">${escapeHtml(report.frictionScore)}</mui-heading>
                  </mui-v-stack>
                  <mui-v-stack alignX="center" class="metrics" space="var(--space-000)">
                    <mui-body size="small" variant="optional">Clarity</mui-body>
                    <mui-heading level="3" size="5">${escapeHtml(report.clarityScore)}</mui-heading>
                  </mui-v-stack>
                </mui-grid>
                <mui-v-stack space="var(--space-100)">
                  <mui-heading level="3" size="6">Friction</mui-heading>
                  ${renderList(report.frictionPoints)}
                </mui-v-stack>
                <mui-v-stack space="var(--space-100)">
                  <mui-heading level="3" size="6">Confusion</mui-heading>
                  ${renderList(report.confusionPoints)}
                </mui-v-stack>
                <mui-v-stack space="var(--space-100)">
                  <mui-heading level="3" size="6">Recommendations</mui-heading>
                  ${renderList(report.recommendations)}
                </mui-v-stack>
              </mui-v-stack>

              <mui-h-stack class="links" space="var(--space-200)">
                <mui-link size="small" href="./json/${encodeURIComponent(report.persona.id)}.json">JSON</mui-link>
                <mui-link size="small" href="./md/${encodeURIComponent(report.persona.id)}.md">Markdown</mui-link>
              </mui-h-stack>

            </mui-v-stack>
          </mui-card-body>
        </mui-card>
      `,
    )
    .join("\n");

  const pageColumns = "minmax(0, 1.8fr) minmax(96px, 0.7fr) minmax(140px, 0.9fr)";

  const pageRows = summary.pages
    .map(
      (page) => `
        <mui-row columns="${pageColumns}">
          <mui-cell>${escapeHtml(page.fileName)}</mui-cell>
          <mui-cell>${escapeHtml(page.totalNodes)}</mui-cell>
          <mui-cell>${escapeHtml(Object.keys(page.componentCounts).length)}</mui-cell>
        </mui-row>
      `,
    )
    .join("\n");

  const pageCards = summary.pages
    .map(
      (page) => `
        <mui-card>
          <mui-card-body>
            <mui-v-stack space="var(--space-100)">
              <mui-heading level="3" size="6">${escapeHtml(page.fileName)}</mui-heading>
              <mui-h-stack class="page-stats" space="var(--space-200)">
                <mui-body size="small" variant="optional">Nodes: ${escapeHtml(page.totalNodes)}</mui-body>
                <mui-body size="small" variant="optional">Types: ${escapeHtml(
                  Object.keys(page.componentCounts).length,
                )}</mui-body>
              </mui-h-stack>
            </mui-v-stack>
          </mui-card-body>
        </mui-card>
      `,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redactd Testing Dashboard</title>
  ${cssLinks}
  ${jsScripts}
  ${flashGuard}
  <style>

    :where(html) {
      --theme-400: #d199ff;
      --theme-500: #c066ff;
    }
  
    html[data-theme="light"] {
      --link-color: var(--theme-500);
    }

    html[data-theme="dark"] {
      --link-color: var(--theme-400);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--surface);
      color: var(--text-color);
      opacity: 0;
      animation: dashboard-fade-in 320ms ease-out forwards;
    }

    @keyframes dashboard-fade-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .hero,
    .overview-grid > mui-card,
    .pages,
    .report-card {
      opacity: 0;
      animation: section-rise 420ms ease-out forwards;
    }

    .overview-grid > mui-card:nth-child(1) { animation-delay: 80ms; }
    .overview-grid > mui-card:nth-child(2) { animation-delay: 120ms; }
    .overview-grid > mui-card:nth-child(3) { animation-delay: 160ms; }
    .overview-grid > mui-card:nth-child(4) { animation-delay: 200ms; }
    .pages { animation-delay: 240ms; }
    .report-card:nth-child(1) { animation-delay: 280ms; }
    .report-card:nth-child(2) { animation-delay: 320ms; }
    .report-card:nth-child(3) { animation-delay: 360ms; }
    .report-card:nth-child(4) { animation-delay: 400ms; }

    @keyframes section-rise {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .reports-grid,
    .reports-stack,
    .report-header,
    .score-row {
      width: 100%;
    }

    mui-link::part(color) {
      color: var(--link-color);
    }

    .metrics {
      border: var(--border-thin);
      background: var(--surface-elevated-200);
      padding: var(--space-200) var(--space-200) var(--space-300) var(--space-200);
      border-radius: var(--radius-200);
    }

  </style>
  <script>
    (() => {
      const query = window.matchMedia("(prefers-color-scheme: light)");
      const applyTheme = () => {
        document.documentElement.setAttribute("data-theme", query.matches ? "light" : "dark");
      };
      applyTheme();
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", applyTheme);
      } else if (typeof query.addListener === "function") {
        query.addListener(applyTheme);
      }
    })();
  </script>
</head>
<body>
  <main>
    <mui-container large center>
    <mui-v-stack space="var(--space-400)">
      <section class="hero">
        <mui-v-stack space="var(--space-300)">
        <mui-heading level="1" size="2">Review Dashboard</mui-heading>
          <mui-v-stack space="var(--space-050)">
            <mui-body size="small">Local review output for</mui-body>
            <mui-link size="small">${escapeHtml(project.projectPath)}.</mui-link>
          </mui-v-stack>
          <mui-responsive breakpoint="720">
            <mui-v-stack slot="showBelow" space="var(--space-000)">
              <mui-h-stack space="var(--space-300)">
                ${heroMetaItems.slice(0, 2).join("\n")}
              </mui-h-stack>
              <mui-h-stack space="var(--space-300)">
                ${heroMetaItems.slice(2).join("\n")}
              </mui-h-stack>
            </mui-v-stack>
            <mui-h-stack slot="showAbove" space="var(--space-300)">
              ${heroMetaItems.join("\n")}
            </mui-h-stack>
          </mui-responsive>
        </mui-v-stack>
      </section>

      <section class="overview">
        <mui-responsive breakpoint="720">
          <mui-grid slot="showBelow" class="overview-grid" space="var(--space-200)" col="1fr 1fr">
            ${overviewCards}
          </mui-grid>
          <mui-grid slot="showAbove" class="overview-grid" space="var(--space-500)" col="1fr 1fr 1fr 1fr">
            ${overviewCards}
          </mui-grid>
        </mui-responsive>
      </section>

      <section class="pages">
        <mui-v-stack space="var(--space-400)">
          <mui-heading level="2" size="3">Pages</mui-heading>
          <mui-responsive breakpoint="720">
            <mui-v-stack slot="showBelow" class="page-cards" space="var(--space-200)">
              ${pageCards}
            </mui-v-stack>
            <mui-card slot="showAbove">
              <mui-card-body>
                <mui-table class="page-table">
                  <mui-row-group heading>
                    <mui-row columns="${pageColumns}">
                      <mui-cell>File</mui-cell>
                      <mui-cell>Nodes</mui-cell>
                      <mui-cell>Component</mui-cell>
                    </mui-row>
                  </mui-row-group>
                  <mui-row-group>
                    ${pageRows}
                  </mui-row-group>
                </mui-table>
              </mui-card-body>
            </mui-card>
          </mui-responsive>
        </mui-v-stack>
      </section>

      <section class="reports">
        <mui-v-stack space="var(--space-400)">
          <mui-heading level="2" size="3">Persona Reports</mui-heading>
          <mui-responsive breakpoint="720">
            <mui-v-stack slot="showBelow" class="reports-stack" space="var(--space-200)">
              ${reportCards}
            </mui-v-stack>
            <mui-grid slot="showAbove" class="reports-grid" space="var(--space-200)" style="--grid-item-size: 320px;">
              ${reportCards}
            </mui-grid>
          </mui-responsive>
        </mui-v-stack>
      </section>
    </mui-v-stack>
    </mui-container>
  </main>
</body>
</html>`;
}

export async function writeRun(project, reports, outputRoot) {
  const runDir = path.join(outputRoot, nowStamp());
  const jsonDir = path.join(runDir, "json");
  const mdDir = path.join(runDir, "md");
  await ensureDir(runDir);
  await ensureDir(jsonDir);
  await ensureDir(mdDir);

  for (const report of reports) {
    await writeJson(path.join(jsonDir, `${report.persona.id}.json`), report);
    await writeText(path.join(mdDir, `${report.persona.id}.md`), reportMarkdown(report));
  }

  const summary = {
    projectPath: project.projectPath,
    pages: project.pages.map((page) => ({
      fileName: page.fileName,
      totalNodes: page.totalNodes,
      componentCounts: page.componentCounts,
    })),
    personas: reports.map((report) => ({
      id: report.persona.id,
      name: report.persona.name,
      type: report.persona.type,
      provider: report.provider,
      model: report.model,
      taskSuccess: report.taskSuccess,
      csat: report.csat,
      frictionScore: report.frictionScore,
      clarityScore: report.clarityScore,
    })),
  };

  const scores = {
    averageCsat: Number((reports.reduce((sum, report) => sum + report.csat, 0) / reports.length).toFixed(1)),
    successRate: Number((reports.filter((report) => report.taskSuccess).length / reports.length).toFixed(2)),
  };

  await writeJson(path.join(runDir, "summary.json"), summary);
  await writeJson(path.join(runDir, "scores.json"), scores);
  await writeText(
    path.join(runDir, "index.html"),
    dashboardHtml({
      project,
      reports,
      summary,
      scores,
      runDirName: path.basename(runDir),
    }),
  );

  return runDir;
}
