# Redactd CLI

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-ff69b4?logo=githubsponsors)](https://github.com/sponsors/michaeltrilford)
![License](https://img.shields.io/badge/License-Commercial-0f172a?style=flat-square)

Redactd CLI is a local-first command-line tool for critiquing and iterating on Redactd-saved Design Canvas JSON.

It reads saved version folders from disk, runs synthetic persona critique, and can generate iteration loops from a saved critique run.

## What It Does

- works against version folders like `v0`, `v1`, `v2`
- critiques saved Redactd page JSON with built-in personas
- saves critique output locally inside each version folder
- generates iteration loops from existing critique data
- writes local dashboards and structured JSON/Markdown artifacts

## Modes

- `Critique`
  Review the current saved version and write outputs into `critique/`

- `Iterate`
  Select a saved critique and generate looped iteration output into `iteration/`

- `Critique and Iterate`
  Run a fresh critique, then feed it directly into iteration loops

## Project Structure

```text
Redactd/
  v0/
    01-sample-page.json
    critique/
    iteration/

  v1/
    pricing-page.json
    critique/
    iteration/
```

Each version folder is the working unit. Design files and feedback stay grouped together.

## Running

From the repo root:

```bash
node ./src/cli.js
```

Or directly:

```bash
node ./src/cli.js critique /path/to/project/v1 --provider mock
node ./src/cli.js iterate /path/to/project/v1 --provider openai
```

## License

This repository is proprietary and is not open source.

Use of this repository and its contents is governed by the Redactd Commercial License.

A valid Redactd subscription or separate written permission from Redactd is required for authorized use.

Copying, redistributing, hosting, selling, or using this repository for commercial gain without proper licensing is not allowed.

## Status

Working CLI with critique, iteration scaffolding, version-aware folder setup, and local HTML dashboards.
