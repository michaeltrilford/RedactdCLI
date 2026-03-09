#!/usr/bin/env node
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { evaluatePersona } from './evaluator.js';
import { createColors } from './colors.js';
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
  redactd test <project-path> [--personas <path>] [--persona <id>] [--provider <name>] [--model <name>] [--theme dark|light|auto]

Examples
  redactd test ./examples/project
  redactd test ./project --personas ./project/personas
  redactd test ./project --persona cost-conscious-impatient
  redactd test ./project --provider openai

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

async function ensureProjectFolder(colors, projectPath) {
  if (await pathExists(projectPath)) {
    return projectPath;
  }

  const shouldCreate = await confirmPrompt(
    colors,
    'Create project folder?',
    `${projectPath} does not exist yet.`
  );

  if (!shouldCreate) {
    return null;
  }

  await ensureDir(projectPath);

  await writeJson(path.join(projectPath, '01-sample-page.json'), {
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

  console.log(colors.success(`Created project folder at ${projectPath}`));
  console.log(colors.info('Added a starter page JSON to the project folder.'));
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

async function runTest(projectPathArg, flags) {
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
  const selectedPersonaIds =
    flags.personaIds.length > 0
      ? flags.personaIds
      : filterPersonaIdsByScope(allPersonas, await choosePersonaScope(colors));
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

    const runDir = await writeRun(project, reports, path.join(projectPath, 'testing'));

    console.log(colors.success(`Validated ${project.pages.length} page files.`));
    console.log(colors.success(`Evaluated ${reports.length} personas.`));
    if (failures.length > 0) {
      console.log(colors.warning(`Skipped ${failures.length} personas due to provider output issues.`));
    }
    console.log(colors.info(`Output written to ${runDir}`));
    return;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (argv.length === 0) {
    const colors = createColors('dark');
    const projectPath = await chooseProjectPath(colors);
    if (!projectPath) {
      return;
    }
    await runTest(projectPath, {
      personasPath: null,
      personaIds: [],
      provider: null,
      model: null,
      theme: 'dark'
    });
    return;
  }

  const { command, projectPath, flags } = parseArgs(argv);

  if (command !== 'test') {
    printHelp();
    throw new Error(`Unsupported command: ${command}`);
  }

  await runTest(projectPath, flags);
}

main().catch((error) => {
  const colors = createColors('dark');
  console.error(colors.error(`Error: ${error.message}`));
  process.exit(1);
});
