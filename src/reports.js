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
  return `<mui-body size="small">${escapeHtml(label)}: ${escapeHtml(value)}</mui-body>`;
}

function renderScoreMetric(label, value) {
  return `<mui-v-stack alignX="center" class="metrics" space="var(--space-000)">
    <mui-body size="small" variant="optional">${escapeHtml(label)}</mui-body>
    <mui-heading level="3" size="5">${escapeHtml(value)}</mui-heading>
  </mui-v-stack>`;
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
    .map((report) => {
      const scoreMetrics = [
        renderScoreMetric("Success", report.taskSuccess ? "Yes" : "No"),
        renderScoreMetric("Friction", report.frictionScore),
        renderScoreMetric("Clarity", report.clarityScore),
      ].join("\n");

      return `
        <mui-card class="report-card" style="padding: var(--space-500) var(--space-500) var(--space-400) var(--space-500);">
          <mui-card-body condensed>
            <mui-v-stack space="var(--space-400)">

              <mui-h-stack class="report-type" space="var(--space-000)" alignY="center" alignX="space-between">
                <mui-v-stack space="var(--space-000)">
                  <mui-body size="small" variant="optional">
                    ${escapeHtml(report.persona.type)}
                  </mui-body>
                  <mui-body size="small" weight="bold">
                    ${escapeHtml(report.persona.role)}
                  </mui-body>
                </mui-v-stack>
              </mui-h-stack>

              <mui-responsive breakpoint="960">
                <mui-h-stack slot="showBelow" class="report-header" space="var(--space-050)" alignY="center" alignX="space-between">
                  <mui-heading level="2" size="6">${escapeHtml(report.persona.name)}</mui-heading>
                  <mui-badge size="x-small" variant="neutral">CSAT ${escapeHtml(report.csat)}</mui-badge>
                </mui-h-stack>
                <mui-h-stack slot="showAbove" class="report-header" space="var(--space-300)" alignY="center" alignX="space-between">
                  <mui-heading level="2" size="4">${escapeHtml(report.persona.name)}</mui-heading>
                  <mui-badge size="large" variant="neutral">CSAT ${escapeHtml(report.csat)}</mui-badge>
                </mui-h-stack>
              </mui-responsive>

              <mui-v-stack space="var(--space-400)">
              
                <mui-responsive breakpoint-low="599" breakpoint-high="1024">
                  <mui-v-stack slot="showBelow" class="score-row" space="var(--space-200)">
                    ${scoreMetrics}
                  </mui-v-stack>
                  <mui-grid slot="showMiddle" class="score-row" space="var(--space-200)" col="1fr 1fr 1fr">
                    ${scoreMetrics}
                  </mui-grid>
                  <mui-grid slot="showAbove" class="score-row" space="var(--space-400)" col="1fr 1fr 1fr">
                    ${scoreMetrics}
                  </mui-grid>
                </mui-responsive>

                <mui-v-stack space="var(--space-000)">
                  <mui-body style="margin-bottom: var(--space-050);" size="small" weight="bold">Friction</mui-body>
                  ${renderList(report.frictionPoints)}
                </mui-v-stack>
                <mui-v-stack space="var(--space-000)">
                  <mui-body style="margin-bottom: var(--space-050);" size="small" weight="bold">Confusion</mui-body>
                  ${renderList(report.confusionPoints)}
                </mui-v-stack>
                <mui-v-stack space="var(--space-000)">
                  <mui-body style="margin-bottom: var(--space-050);" size="small" weight="bold">Recommendations</mui-body>
                  ${renderList(report.recommendations)}
                </mui-v-stack>

              </mui-v-stack>


              <mui-responsive breakpoint="960">
                <mui-h-stack slot="showAbove" class="links" space="var(--space-000)">
                  <mui-link variant="tertiary" size="small" href="./json/${encodeURIComponent(
                    report.persona.id,
                  )}.json">JSON</mui-link>
                  <mui-link variant="tertiary" size="small" href="./md/${encodeURIComponent(
                    report.persona.id,
                  )}.md">Markdown</mui-link>
                </mui-h-stack>
                <mui-v-stack slot="showBelow" class="links" space="var(--space-000)" alignX="stretch">
                  <mui-link variant="tertiary" size="small" href="./json/${encodeURIComponent(
                    report.persona.id,
                  )}.json">JSON</mui-link>
                  <mui-link variant="tertiary" size="small" href="./md/${encodeURIComponent(
                    report.persona.id,
                  )}.md">Markdown</mui-link>
                </mui-v-stack>
              </mui-responsive>

            </mui-v-stack>
          </mui-card-body>
        </mui-card>
      `;
    })
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
              <mui-h-stack class="page-stats" space="var(--space-400)">
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

    *:not(mui-row) {
      box-sizing: border-box;
    }

    html {
      background: var(--surface);
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--surface);
      color: var(--text-color);
    }

    .hero {
      z-index: 1;
    }

    .reports-grid,
    .reports-stack,
    .report-header,
    .score-row {
      width: 100%;
    }

    .score-row {
      margin-bottom: var(--space-400);
    }

    .report-type {
      margin-bottom: var(--space-200);
      padding-bottom: var(--space-200);
      border-bottom: var(--border-thin);
    }

    .links {
      margin-top: var(--space-200);
      padding-top: var(--space-200);
      border-top: var(--border-thin);
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

    @media (min-width: 960px) {
      .report-type {
        margin-bottom: var(--space-400);
        padding-bottom: var(--space-400);
      }

      .links {
        margin-top: var(--space-400);
        padding-top: var(--space-400);
      }
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

      const revealLoaders = () => {
        document.querySelectorAll("mui-loader[data-dashboard-loader]").forEach((loader) => {
          loader.removeAttribute("loading");
        });
      };

      const copyText = async (value) => {
        if (!value) return;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          return;
        }

        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      };

      document.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target.closest("[data-copy-path], [data-open-dialog], [data-close]") : null;
        if (!target) return;

        if (target.hasAttribute("data-copy-path")) {
          const value = target.getAttribute("data-copy-path");
          const originalLabel = target.textContent;
          target.textContent = "Copying...";
          try {
            await copyText(value);
          } catch {}
          window.setTimeout(() => {
            target.textContent = originalLabel;
          }, 900);
        }

        if (target.hasAttribute("data-open-dialog")) {
          const dialogName = target.getAttribute("data-open-dialog");
          const dialog = dialogName
            ? document.querySelector('mui-dialog[data-dialog="' + dialogName + '"]')
            : null;
          if (dialog) {
            dialog.setAttribute("open", "");
          }
        }

        if (target.hasAttribute("data-close")) {
          const dialog = target.closest("mui-dialog");
          if (dialog) {
            dialog.removeAttribute("open");
          }
        }
      });

      Promise.all([
        customElements.whenDefined("mui-loader"),
        customElements.whenDefined("mui-button"),
        customElements.whenDefined("mui-dialog"),
      ]).then(() => {
        window.requestAnimationFrame(() => {
          revealLoaders();
        });
      }).catch(() => {
        revealLoaders();
      });
    })();
  </script>
</head>
<body>
  <main>
    <mui-container large center>
    <mui-v-stack space="var(--space-600)">
      <mui-loader data-dashboard-loader loading animation="fade-in">
        <section class="hero">
          <mui-h-stack alignx="space-between" aligny="center" space="var(--space-200)">
            <mui-v-stack space="var(--space-000)">
              <mui-heading level="1" size="2">Insights</mui-heading>
              <mui-body size="small" variant="optional">
                Persona feedback
              </mui-body>
            </mui-v-stack>
            <mui-dropdown position="right" style="--dropdown-min-width: 20rem;">
              <mui-button
                slot="action"
                variant="tertiary"
                aria-label="Open dashboard menu"
                title="Dashboard menu"
              >
                <mui-icon-ellipsis size="medium"></mui-icon-ellipsis>
              </mui-button>
              <mui-button
                variant="tertiary"
                dropdown-slot
                dropdown-slot-first
                data-copy-path="${escapeHtml(project.projectPath)}"
              >
                Copy Folder Path
              </mui-button>
              <mui-button
                variant="tertiary"
                dropdown-slot
                data-open-dialog="stats-for-nerds"
              >
                Stats for Nerds
              </mui-button>
            </mui-dropdown>
          </mui-h-stack>
        </section>
      </mui-loader>

      <mui-dialog
        data-dialog="stats-for-nerds"
        aria-labelledby="stats-for-nerds-title"
        aria-describedby="stats-for-nerds-description"
        width="480px"
      >
        <mui-heading slot="title" id="stats-for-nerds-title" level="2" size="3">Stats for Nerds</mui-heading>
        <mui-v-stack space="var(--space-300)">
          <mui-v-stack space="var(--space-100)">
            ${heroMetaItems.join("\n")}
          </mui-v-stack>
        </mui-v-stack>
      </mui-dialog>

      <mui-loader data-dashboard-loader loading animation="fade-in">
        <section class="overview">
          <mui-responsive breakpoint="720">
            <mui-grid slot="showBelow" class="overview-grid" space="var(--space-400)" col="1fr 1fr">
              ${overviewCards}
            </mui-grid>
            <mui-grid slot="showAbove" class="overview-grid" space="var(--space-400)" col="1fr 1fr 1fr 1fr">
              ${overviewCards}
            </mui-grid>
          </mui-responsive>
        </section>
      </mui-loader>

      <mui-loader data-dashboard-loader loading animation="fade-in">
        <section class="pages">
          <mui-v-stack space="var(--space-400)">
            <mui-heading level="2" size="3">Pages</mui-heading>
            <mui-responsive breakpoint="720">
              <mui-v-stack slot="showBelow" class="page-cards" space="var(--space-400)">
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
      </mui-loader>

      <mui-loader data-dashboard-loader loading animation="fade-in">
        <section class="reports">
          <mui-v-stack space="var(--space-400)">
            <mui-heading level="2" size="3">Persona Reports</mui-heading>
            <mui-responsive breakpoint="720">
              <mui-v-stack slot="showBelow" class="reports-stack" space="var(--space-400)">
                ${reportCards}
              </mui-v-stack>
              <mui-grid slot="showAbove" class="reports-grid" space="var(--space-400)" style="--grid-item-size: 320px;">
                ${reportCards}
              </mui-grid>
            </mui-responsive>
          </mui-v-stack>
        </section>
      </mui-loader>
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
