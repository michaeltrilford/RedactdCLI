import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { ensureDir, readJson, writeJson, writeText } from './fs-utils.js';

function serializePage(fileName, canvasChildren) {
  return {
    id: 'root',
    type: 'Root',
    props: {},
    children: [
      {
        id: 'canvas',
        type: '_Canvas',
        props: {},
        children: canvasChildren
      }
    ]
  };
}

function iterationMarkdown(loop) {
  return `# Loop ${loop.loopNumber}

Summary
${loop.summary}

Changes
${loop.changes.map((item) => `- ${item}`).join('\n')}

Retained
${loop.retained.map((item) => `- ${item}`).join('\n')}

Risks
${loop.risks.map((item) => `- ${item}`).join('\n')}
`;
}

function dedupe(items) {
  return [...new Set(items.filter(Boolean))];
}

export async function listCritiqueRuns(projectPath) {
  const critiqueRoot = path.join(projectPath, 'critique');
  try {
    const entries = await readdir(critiqueRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

export async function loadCritiqueRun(projectPath, runName) {
  const runDir = path.join(projectPath, 'critique', runName);
  const summary = await readJson(path.join(runDir, 'summary.json'));
  const scores = await readJson(path.join(runDir, 'scores.json'));
  const jsonDir = path.join(runDir, 'json');
  let personaFiles = [];

  try {
    const entries = await readdir(jsonDir, { withFileTypes: true });
    personaFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    personaFiles = [];
  }

  const reports = [];
  for (const fileName of personaFiles) {
    reports.push(await readJson(path.join(jsonDir, fileName)));
  }

  const topRecommendations = dedupe(reports.flatMap((report) => report.recommendations ?? [])).slice(0, 8);
  const topFrictionPoints = dedupe(reports.flatMap((report) => report.frictionPoints ?? [])).slice(0, 8);
  const topConfusionPoints = dedupe(reports.flatMap((report) => report.confusionPoints ?? [])).slice(0, 8);

  return {
    runName,
    runDir,
    summary,
    scores,
    reports,
    topRecommendations,
    topFrictionPoints,
    topConfusionPoints
  };
}

function normalizeIterationResult(result, loopNumber, fallbackProject) {
  const pages = Array.isArray(result.pages) ? result.pages : [];
  return {
    loopNumber,
    summary: typeof result.summary === 'string' ? result.summary : `Loop ${loopNumber} iteration output.`,
    changes: Array.isArray(result.changes) ? result.changes : [],
    retained: Array.isArray(result.retained) ? result.retained : [],
    risks: Array.isArray(result.risks) ? result.risks : [],
    pages:
      pages.length > 0
        ? pages.map((page) => ({
            fileName: page.fileName,
            canvasChildren: Array.isArray(page.canvasChildren) ? page.canvasChildren : []
          }))
        : fallbackProject.pages.map((page) => ({
            fileName: page.fileName,
            canvasChildren: page.canvasChildren ?? [page.rootNode]
          }))
  };
}

export async function runIterationSession({ project, critique, provider, loops, outputRoot }) {
  const sessionDir = path.join(
    outputRoot,
    new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '-')
  );
  await ensureDir(sessionDir);
  await writeJson(path.join(sessionDir, 'source-critique.json'), {
    runName: critique.runName,
    scores: critique.scores,
    topRecommendations: critique.topRecommendations,
    topFrictionPoints: critique.topFrictionPoints,
    topConfusionPoints: critique.topConfusionPoints
  });

  const loopResults = [];
  let previousLoop = null;

  for (let loopNumber = 1; loopNumber <= loops; loopNumber += 1) {
    const result = normalizeIterationResult(
      await provider.iterate({ project, critique, loopNumber, previousLoop }),
      loopNumber,
      project
    );
    loopResults.push(result);
    previousLoop = result;

    const loopDir = path.join(sessionDir, `loop-${loopNumber}`);
    const designDir = path.join(loopDir, 'design');
    await ensureDir(loopDir);
    await ensureDir(designDir);

    await writeJson(path.join(loopDir, 'summary.json'), result);
    await writeText(path.join(loopDir, 'summary.md'), iterationMarkdown(result));

    for (const page of result.pages) {
      await writeJson(path.join(designDir, page.fileName), serializePage(page.fileName, page.canvasChildren));
    }
  }

  await writeJson(path.join(sessionDir, 'session.json'), {
    critiqueRun: critique.runName,
    provider: provider.name,
    model: provider.model,
    loops: loopResults.map((loop) => ({
      loopNumber: loop.loopNumber,
      summary: loop.summary,
      changes: loop.changes,
      retained: loop.retained,
      risks: loop.risks
    }))
  });

  return {
    sessionDir,
    loops: loopResults
  };
}
