import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { writeJson } from './fs-utils.js';

function toPosixRelative(projectPath, targetPath) {
  return path.relative(projectPath, targetPath).split(path.sep).join('/');
}

async function listJsonFiles(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(dirPath, entry.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function listLoopSummaryPaths(sessionDir) {
  try {
    const entries = await readdir(sessionDir, { withFileTypes: true });
    const loopDirs = entries
      .filter((entry) => entry.isDirectory() && /^loop-\d+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return loopDirs.map((loopDir) => path.join(sessionDir, loopDir, 'summary.json'));
  } catch {
    return [];
  }
}

export async function writeRunManifest({
  projectPath,
  mode,
  critiqueRunDir,
  iterationSessionDir = null,
}) {
  const critiqueJsonDir = path.join(critiqueRunDir, 'json');
  const reportFiles = await listJsonFiles(critiqueJsonDir);
  const loopSummaryFiles = iterationSessionDir
    ? await listLoopSummaryPaths(iterationSessionDir)
    : [];

  const critiqueRunName = path.basename(critiqueRunDir);
  const iterationSessionName = iterationSessionDir
    ? path.basename(iterationSessionDir)
    : null;

  const manifest = {
    runId: iterationSessionName || critiqueRunName,
    projectKey: path.basename(projectPath),
    mode,
    timestamp: new Date().toISOString(),
    summaryPath: toPosixRelative(projectPath, path.join(critiqueRunDir, 'summary.json')),
    scoresPath: toPosixRelative(projectPath, path.join(critiqueRunDir, 'scores.json')),
    reportPaths: reportFiles.map((filePath) => toPosixRelative(projectPath, filePath)),
    loopSummaryPaths: loopSummaryFiles.map((filePath) =>
      toPosixRelative(projectPath, filePath),
    ),
  };

  await writeJson(path.join(projectPath, 'run-manifest.json'), manifest);
  return path.join(projectPath, 'run-manifest.json');
}
