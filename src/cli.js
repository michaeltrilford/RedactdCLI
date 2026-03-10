#!/usr/bin/env node
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { evaluatePersona } from './evaluator.js';
import { createColors } from './colors.js';
import { listCritiqueRuns, loadCritiqueRun, runIterationSession } from './iteration.js';
import { filterPersonaIdsByScope, loadPersonas } from './personas.js';
import { passwordPrompt, pathPrompt, selectPrompt } from './interactive.js';
import { ensureDir, writeJson } from './fs-utils.js';
import { loadProject } from './project.js';
import { ProviderAuthError } from './providers/errors.js';
import { buildProvider, providerNames } from './providers/factory.js';
import { writeRun } from './reports.js';

function printHelp() {
  console.log(`Redactd CLI

Usage
  redactd critique <project-path> [--personas <path>] [--persona <id>] [--provider <name>] [--model <name>] [--theme dark|light|auto]
  redactd iterate <project-path> [--provider <name>] [--model <name>] [--theme dark|light|auto]
  redactd test <project-path> [--personas <path>] [--persona <id>] [--provider <name>] [--model <name>] [--theme dark|light|auto]

Examples
  redactd critique ./examples/project
  redactd critique ./project --personas ./project/personas
  redactd critique ./project --persona cost-conscious-impatient
  redactd iterate ./project --provider openai

Providers
  ${providerNames.join(', ')}

Path notes
  ~ means your home folder.
  Example: ~/Documents/Redactd
`);
}

function parseArgs(argv) {
  const [command, projectPath, ...rest] = argv;
  const flags = {
    personasPath: null,
    personaIds: [],
    provider: null,
    model: null,
    theme: 'dark'
  };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--personas') {
      flags.personasPath = rest[i + 1];
      i += 1;
    } else if (token === '--persona') {
      flags.personaIds.push(rest[i + 1]);
      i += 1;
    } else if (token === '--theme') {
      flags.theme = rest[i + 1] ?? 'dark';
      i += 1;
    } else if (token === '--provider') {
      flags.provider = rest[i + 1] ?? 'mock';
      i += 1;
    } else if (token === '--model') {
      flags.model = rest[i + 1] ?? null;
      i += 1;
    }
  }

  return { command, projectPath, flags };
}

function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') {
    return os.homedir();
  }
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function getProviderAvailability() {
  return {
    mock: { available: true, env: null },
    openai: { available: Boolean(process.env.OPENAI_API_KEY), env: 'OPENAI_API_KEY' },
    claude: { available: Boolean(process.env.ANTHROPIC_API_KEY), env: 'ANTHROPIC_API_KEY' },
    gemini: { available: Boolean(process.env.GEMINI_API_KEY), env: 'GEMINI_API_KEY' },
    groq: { available: Boolean(process.env.GROQ_API_KEY), env: 'GROQ_API_KEY' },
    grok: { available: Boolean(process.env.XAI_API_KEY), env: 'XAI_API_KEY' }
  };
}

function getProviderEnvName(providerName) {
  if (providerName === 'openai') return 'OPENAI_API_KEY';
  if (providerName === 'claude') return 'ANTHROPIC_API_KEY';
  if (providerName === 'gemini') return 'GEMINI_API_KEY';
  if (providerName === 'groq') return 'GROQ_API_KEY';
  if (providerName === 'grok') return 'XAI_API_KEY';
  return null;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function hasMarkdownFiles(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'));
  } catch {
    return false;
  }
}

function isVersionFolderName(name) {
  return /^v\d+$/i.test(name);
}

function compareVersionNamesDescending(a, b) {
  return Number.parseInt(b.slice(1), 10) - Number.parseInt(a.slice(1), 10);
}

async function listVersionFolders(projectRoot) {
  try {
    const entries = await readdir(projectRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && isVersionFolderName(entry.name))
      .map((entry) => entry.name)
      .sort(compareVersionNamesDescending);
  } catch {
    return [];
  }
}

async function confirmPrompt(colors, title, subtitle) {
  return await selectPrompt({
    colors,
    title,
    subtitle,
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' }
    ]
  });
}

async function scaffoldVersionFolder(versionPath) {
  await ensureDir(versionPath);
  await ensureDir(path.join(versionPath, 'critique'));
  await ensureDir(path.join(versionPath, 'iteration'));

  await writeJson(path.join(versionPath, '01-sample-page.json'), {
    id: 'root',
    type: 'Root',
    props: {},
    children: [
      {
        id: 'canvas',
        type: '_Canvas',
        props: {},
        children: [
          {
            id: 'sample-page',
            type: 'Container',
            props: {
              center: true,
              size: 'large'
            },
            children: [
              {
                id: 'sample-stack',
                type: 'VStack',
                props: {
                  space: 'var(--space-400)'
                },
                children: [
                  {
                    id: 'sample-heading',
                    type: 'Heading',
                    props: {
                      level: '1',
                      size: '1',
                      text: 'Sample Redactd page'
                    },
                    children: []
                  },
                  {
                    id: 'sample-body',
                    type: 'Body',
                    props: {
                      text: 'Replace this page with your own saved Redactd JSON.'
                    },
                    children: []
                  },
                  {
                    id: 'sample-button',
                    type: 'Button',
                    props: {
                      variant: 'primary',
                      text: 'Continue'
                    },
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  });
}

async function chooseVersionFolder(colors, projectRoot, versionNames) {
  const selected = await selectPrompt({
    colors,
    title: 'Choose a version',
    subtitle: 'Each version keeps design files with critique and iteration outputs.',
    options: [
      ...versionNames.map((name) => ({
        value: path.join(projectRoot, name),
        label: name,
        description: `${path.join(projectRoot, name)}`
      })),
      {
        value: '__create__',
        label: 'Create new version',
        description: 'Start a fresh version folder in this project.'
      },
      {
        value: '__back__',
        label: 'Back',
        description: 'Choose a different project.'
      }
    ]
  });

  if (selected === '__back__') {
    return { action: 'back' };
  }

  if (selected === '__create__') {
    const nextNumber =
      versionNames.length === 0
        ? 0
        : Math.max(...versionNames.map((name) => Number.parseInt(name.slice(1), 10))) + 1;
    const nextVersionName = `v${nextNumber}`;
    const versionPath = path.join(projectRoot, nextVersionName);
    await scaffoldVersionFolder(versionPath);
    console.log(colors.success(`Created ${nextVersionName} at ${versionPath}`));
    return { action: 'selected', versionPath };
  }

  return { action: 'selected', versionPath: selected };
}

async function ensureProjectFolder(colors, projectPath) {
  const exists = await pathExists(projectPath);

  if (!exists) {
    const shouldCreate = await confirmPrompt(
      colors,
      'Create project folder?',
      `${projectPath} does not exist yet.`
    );

    if (!shouldCreate) {
      return null;
    }

    await ensureDir(projectPath);
    const versionPath = path.join(projectPath, 'v0');
    await scaffoldVersionFolder(versionPath);

    console.log(colors.success(`Created project folder at ${projectPath}`));
    console.log(colors.info(`Added versioned workspace at ${versionPath}.`));
    return versionPath;
  }

  const projectName = path.basename(projectPath);
  if (isVersionFolderName(projectName)) {
    await ensureDir(path.join(projectPath, 'critique'));
    await ensureDir(path.join(projectPath, 'iteration'));
    return projectPath;
  }

  const versionNames = await listVersionFolders(projectPath);
  if (versionNames.length > 0) {
    return await chooseVersionFolder(colors, projectPath, versionNames);
  }

  return projectPath;
}

async function chooseProvider(colors) {
  const availability = getProviderAvailability();
  const options = [
    { value: 'mock', label: 'Mock', description: 'Offline fallback for local testing.' },
    { value: 'openai', label: 'OpenAI', description: availability.openai.available ? 'API key detected.' : 'Requires OPENAI_API_KEY.' },
    { value: 'claude', label: 'Claude', description: availability.claude.available ? 'API key detected.' : 'Requires ANTHROPIC_API_KEY.' },
    { value: 'gemini', label: 'Gemini', description: availability.gemini.available ? 'API key detected.' : 'Requires GEMINI_API_KEY.' },
    { value: 'groq', label: 'Groq', description: availability.groq.available ? 'API key detected.' : 'Requires GROQ_API_KEY.' },
    { value: 'grok', label: 'Grok', description: availability.grok.available ? 'API key detected.' : 'Requires XAI_API_KEY.' }
  ];

  const preferredOrder = ['openai', 'claude', 'gemini', 'groq', 'grok', 'mock'];
  const firstAvailable = preferredOrder.find((name) => availability[name].available) ?? 'mock';
  const initialIndex = options.findIndex((option) => option.value === firstAvailable);

  return await selectPrompt({
    colors,
    title: 'Choose an evaluation provider',
    subtitle: 'Use arrow keys and Enter.',
    options,
    initialIndex: initialIndex >= 0 ? initialIndex : 0
  });
}

async function resolveProvider(colors, flags) {
  if (flags.provider) {
    return buildProvider(flags.provider, flags.model);
  }

  for (;;) {
    const providerName = (await chooseProvider(colors)) ?? 'mock';
    try {
      return buildProvider(providerName, flags.model);
    } catch (error) {
      const envName = getProviderEnvName(providerName);

      if (!envName) {
        console.log(colors.warning(error.message));
        continue;
      }

      console.log(colors.warning(`${envName} is not set.`));
      console.log(colors.subtle('Paste key for this session (not saved to disk).'));

      const key = await passwordPrompt({
        colors,
        label: envName
      });

      const trimmed = key.trim();
      if (!trimmed) {
        console.log(colors.warning('No key entered.'));
        console.log(colors.subtle('Choose another provider or select mock mode.'));
        continue;
      }

      process.env[envName] = trimmed;
      console.log(colors.success(`${envName} received for this session.`));

      try {
        return buildProvider(providerName, flags.model);
      } catch (retryError) {
        console.log(colors.warning(retryError.message));
      }
    }
  }
}

async function recoverProviderAuth(colors, providerName) {
  const envName = getProviderEnvName(providerName);
  if (!envName) return false;

  console.log(colors.warning(`${providerName} authentication failed.`));
  console.log(colors.subtle('Paste a new key for this session or choose another provider.'));

  const action = await selectPrompt({
    colors,
    title: 'Authentication failed',
    subtitle: 'Choose what to do next.',
    options: [
      { value: 'paste', label: `Paste new ${envName}` },
      { value: 'switch', label: 'Choose another provider' }
    ]
  });

  if (action === 'switch') {
    return false;
  }

  const key = await passwordPrompt({
    colors,
    label: envName
  });
  const trimmed = key.trim();
  if (!trimmed) {
    console.log(colors.warning('No key entered.'));
    return false;
  }

  process.env[envName] = trimmed;
  console.log(colors.success(`${envName} received for this session.`));
  return true;
}

async function choosePersonaScope(colors) {
  return await selectPrompt({
    colors,
    title: 'Choose persona scope',
    subtitle: 'Run all personas or narrow to a slice first.',
    options: [
      {
        value: 'all',
        label: 'All personas',
        description: 'Users plus stakeholder hats.'
      },
      {
        value: 'users',
        label: 'Users only',
        description: 'End-user behavior personas only.'
      },
      {
        value: 'stakeholders',
        label: 'Stakeholder hats only',
        description: 'Internal review lenses only.'
      },
      {
        value: '__back__',
        label: 'Back',
        description: 'Choose a different project.'
      }
    ]
  });
}

async function chooseMode(colors) {
  return await selectPrompt({
    colors,
    title: 'Choose a mode',
    subtitle: 'Critique the current version or act on saved critique feedback.',
    options: [
      {
        value: 'critique',
        label: 'Critique',
        description: 'Review the current saved design flow.'
      },
      {
        value: 'iterate',
        label: 'Iterate',
        description: 'Use a saved critique to generate revision loops.'
      },
      {
        value: 'critique-and-iterate',
        label: 'Critique and Iterate',
        description: 'Run a fresh critique, then move into iteration loops.'
      },
      {
        value: '__back__',
        label: 'Back',
        description: 'Choose a different version.'
      }
    ]
  });
}

async function chooseCritiqueRun(colors, projectPath) {
  const runNames = await listCritiqueRuns(projectPath);
  if (runNames.length === 0) {
    throw new Error(`No saved critique runs found in ${path.join(projectPath, 'critique')}`);
  }

  const selected = await selectPrompt({
    colors,
    title: 'Choose a critique',
    subtitle: 'Iteration uses a saved critique as its source input.',
    options: [
      ...runNames.map((runName) => ({
        value: runName,
        label: runName
      })),
      {
        value: '__back__',
        label: 'Back',
        description: 'Choose a different mode.'
      }
    ]
  });

  return selected;
}

async function chooseIterationDepth(colors) {
  return await selectPrompt({
    colors,
    title: 'Choose iteration depth',
    subtitle: 'Save each loop separately in the iteration folder.',
    options: [
      {
        value: 2,
        label: 'Two loops',
        description: 'Save loop 1 and loop 2.'
      },
      {
        value: 1,
        label: 'One loop',
        description: 'Save a single revision pass.'
      },
      {
        value: '__back__',
        label: 'Back',
        description: 'Choose a different critique.'
      }
    ]
  });
}

async function chooseProjectPath(colors) {
  const documentsRedactd = '~/Documents/Redactd';
  const iCloudRedactd = '~/iCloud/Redactd';

  const selected = await selectPrompt({
    colors,
    title: 'Redactd CLI',
    subtitle: 'Choose a design project.',
    options: [
      {
        value: './examples/project',
        label: 'Sample project (Try demo)'
      },
      {
        value: documentsRedactd,
        label: 'Documents (~/Documents/Redactd)'
      },
      {
        value: iCloudRedactd,
        label: 'iCloud (~/iCloud/Redactd)'
      },
      {
        value: '__custom__',
        label: 'Choose another folder (~/path/name)'
      }
    ]
  });

  if (selected !== '__custom__') {
    return await ensureProjectFolder(colors, expandHome(selected));
  }

  const customPath = expandHome(
    await pathPrompt({
      colors,
      title: 'Choose another project',
      subtitle: 'Paste the folder location for your design project.',
      label: 'Project folder',
      defaultValue: './examples/project'
    })
  );

  return await ensureProjectFolder(colors, customPath);
}

async function runCritique(projectPathArg, flags) {
  if (!projectPathArg) {
    throw new Error('Missing project path');
  }

  const projectPath = path.resolve(expandHome(projectPathArg));
  const projectPersonaDir = path.join(projectPath, 'personas');
  const builtInPersonaDir = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'personas'));
  const personaDir = flags.personasPath
    ? path.resolve(expandHome(flags.personasPath))
    : (await hasMarkdownFiles(projectPersonaDir))
      ? projectPersonaDir
      : builtInPersonaDir;

  const colors = createColors(flags.theme);
  console.log(colors.accent('Redactd CLI'));
  console.log(colors.muted(`Project: ${projectPath}`));
  console.log(colors.muted(`Personas: ${personaDir}`));

  const project = await loadProject(projectPath);
  const allPersonas = await loadPersonas(personaDir, []);
  let selectedPersonaIds = flags.personaIds;

  if (selectedPersonaIds.length === 0) {
    const scope = await choosePersonaScope(colors);
    if (scope === '__back__') {
      return { action: 'back' };
    }
    selectedPersonaIds = filterPersonaIdsByScope(allPersonas, scope);
  }

  const personas = allPersonas.filter((persona) => selectedPersonaIds.includes(persona.id));

  if (personas.length === 0) {
    throw new Error('No personas selected for evaluation');
  }

  for (;;) {
    const provider = await resolveProvider(colors, flags);
    console.log(colors.muted(`Provider: ${provider.name}${provider.model ? ` (${provider.model})` : ''}`));

    const reports = [];
    const failures = [];
    let shouldRetryProvider = false;

    for (let index = 0; index < personas.length; index += 1) {
      const persona = personas[index];
      process.stdout.write(
        `${colors.accent('→')} ${colors.text(`Evaluating ${persona.name}`)} ${colors.subtle(`(${index + 1}/${personas.length})`)}\n`
      );
      try {
        reports.push(await evaluatePersona(project, persona, provider));
      } catch (error) {
        if (error instanceof ProviderAuthError && !flags.provider) {
          shouldRetryProvider = await recoverProviderAuth(colors, provider.name);
          if (!shouldRetryProvider) {
            flags.provider = null;
          }
          break;
        }

        failures.push({
          persona: persona.name,
          message: error.message
        });
        console.log(colors.warning(`Skipped ${persona.name}: ${error.message}`));
      }
    }

    if (shouldRetryProvider) {
      continue;
    }

    if (reports.length === 0) {
      throw new Error('All persona evaluations failed.');
    }

    await ensureDir(path.join(projectPath, 'critique'));
    const runDir = await writeRun(project, reports, path.join(projectPath, 'critique'));

    console.log(colors.success(`Validated ${project.pages.length} page files.`));
    console.log(colors.success(`Evaluated ${reports.length} personas.`));
    if (failures.length > 0) {
      console.log(colors.warning(`Skipped ${failures.length} personas due to provider output issues.`));
    }
    console.log(colors.info(`Output written to ${runDir}`));
    return { action: 'completed', runDir };
  }
}

async function runIterate(projectPathArg, flags, selectedRunName = null, selectedLoops = null) {
  if (!projectPathArg) {
    throw new Error('Missing project path');
  }

  const projectPath = path.resolve(expandHome(projectPathArg));
  const colors = createColors(flags.theme);
  const project = await loadProject(projectPath);

  let critiqueRunName = selectedRunName;
  if (!critiqueRunName) {
    critiqueRunName = await chooseCritiqueRun(colors, projectPath);
    if (critiqueRunName === '__back__') {
      return { action: 'back' };
    }
  }

  let loops = selectedLoops;
  if (!loops) {
    loops = await chooseIterationDepth(colors);
    if (loops === '__back__') {
      return { action: 'back' };
    }
  }

  const critique = await loadCritiqueRun(projectPath, critiqueRunName);
  const provider = await resolveProvider(colors, flags);

  console.log(colors.accent('Redactd CLI'));
  console.log(colors.muted(`Project: ${projectPath}`));
  console.log(colors.muted(`Critique: ${critique.runName}`));
  console.log(colors.muted(`Provider: ${provider.name}${provider.model ? ` (${provider.model})` : ''}`));

  const result = await runIterationSession({
    project,
    critique,
    provider,
    loops,
    outputRoot: path.join(projectPath, 'iteration')
  });

  console.log(colors.success(`Loaded critique ${critique.runName}.`));
  console.log(colors.success(`Saved ${result.loops.length} iteration loops.`));
  console.log(colors.info(`Output written to ${result.sessionDir}`));
  return { action: 'completed', sessionDir: result.sessionDir };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (argv.length === 0) {
    const colors = createColors('dark');
    for (;;) {
    const projectSelection = await chooseProjectPath(colors);
    if (!projectSelection) {
        return;
      }

      if (typeof projectSelection === 'object' && projectSelection.action === 'back') {
        continue;
      }

      const projectPath =
        typeof projectSelection === 'string'
          ? projectSelection
          : projectSelection.versionPath;

      const baseFlags = {
        personasPath: null,
        personaIds: [],
        provider: null,
        model: null,
        theme: 'dark'
      };

      const mode = await chooseMode(colors);
      if (mode === '__back__') {
        continue;
      }

      let result;
      if (mode === 'critique') {
        result = await runCritique(projectPath, baseFlags);
      } else if (mode === 'iterate') {
        result = await runIterate(projectPath, baseFlags);
      } else {
        const critiqueResult = await runCritique(projectPath, baseFlags);
        if (critiqueResult?.action === 'back') {
          continue;
        }
        const runName = critiqueResult?.runDir ? path.basename(critiqueResult.runDir) : null;
        result = await runIterate(projectPath, baseFlags, runName, 2);
      }

      if (result?.action === 'back') {
        continue;
      }

      return;
    }
  }

  const { command, projectPath, flags } = parseArgs(argv);

  if (!['test', 'critique', 'iterate'].includes(command)) {
    printHelp();
    throw new Error(`Unsupported command: ${command}`);
  }

  if (command === 'iterate') {
    await runIterate(projectPath, flags);
    return;
  }

  await runCritique(projectPath, flags);
}

main().catch((error) => {
  const colors = createColors('dark');
  console.error(colors.error(`Error: ${error.message}`));
  process.exit(1);
});
