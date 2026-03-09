# Redactd CLI Task List

## Outcome

Build a local-first CLI that scans folders of Redactd-saved page JSON, runs synthetic persona evaluations across ordered flows, and writes structured reports locally.

## Current Scope

Phase 1 is synthetic persona testing only.

The CLI will:

- read page JSON files from disk
- read persona definitions from disk
- evaluate pages in flow order
- generate structured persona reports
- save outputs locally

The CLI will not yet:

- redesign pages
- generate replacement UI artifacts
- perform browser automation
- run critique or iteration workflows beyond persona testing

## Task List

### 1. Lock Input Contracts

- finalize the project folder structure
- finalize the page JSON parsing rules from saved Redactd files
- define validation errors for malformed page files
- define validation errors for malformed persona files
- decide whether persona files are required or whether starter personas are bundled

### 2. Define Persona System

- define the persona markdown format
- create an initial persona set for testing
- define the task context each persona receives
- define how persona tone, goals, and behaviors are encoded
- define how many personas phase 1 ships with by default

### 3. Define Report Contract

- define the JSON report schema
- define the markdown report schema
- define summary and score aggregation outputs
- define run folder naming
- define how runs are compared across multiple executions

### 4. CLI Architecture

- choose the CLI runtime and package structure
- define the `redactd test` command
- define flags for project path, personas path, single persona selection, output path, and theme
- define terminal theme behavior for `auto`, `dark`, and `light`
- define logging and validation output style

### 5. Implement Core Loaders

- implement project folder loader
- implement page file discovery and ordering
- implement Redactd page JSON parser
- implement persona markdown loader
- implement input validation pipeline

### 6. Implement Evaluation Engine

- build normalized page-flow representation from saved JSON
- build persona execution context
- run persona evaluation screen by screen
- collect friction, confusion, trust, and clarity observations
- calculate initial phase 1 scores

### 7. Implement Output Writing

- write per-persona markdown reports
- write per-persona JSON reports
- write flow summary JSON
- write scores JSON
- save outputs in isolated local run directories

### 8. Theme and UX

- implement ANSI theme tokens from `THEME.md`
- style headings, status states, prompts, and summaries
- ensure readable output in both dark and light terminals
- keep warnings and errors distinct from the brand accent

### 9. Testing

- add parser tests for valid saved Redactd page JSON
- add parser tests for invalid page structures
- add persona loader tests
- add report schema tests
- add end-to-end fixture tests for a sample project folder

### 10. Starter Assets

- create a sample project folder fixture
- create starter persona markdown files
- create example output reports
- document the minimum setup in the README

## Suggested Immediate Order

1. lock the folder contract
2. lock the persona format
3. lock the report schema
4. scaffold the CLI command
5. build loaders and validators
6. add fixture-based tests

## Open Questions

- do we bundle default personas, require user-supplied personas, or support both?
- should the task prompt be global per run, or derived from the project folder?
- should run outputs live inside the project folder, a sibling `runs` folder, or a configurable location?
- how deterministic do we want repeated persona runs to be?
