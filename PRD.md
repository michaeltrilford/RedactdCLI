# PRD: Redactd CLI for Design Canvas

## Overview

Redactd CLI is a local-first command-line tool for Design Canvas projects.

It reads user-managed UI artifact folders on disk and runs AI-assisted evaluation workflows against those artifacts.

The planned workflow is:

Design Canvas files
↓
Synthetic persona testing
↓
Critique
↓
Iteration

This PRD focuses primarily on phase 1: synthetic persona testing for UI flows represented as structured JSON.

The product is intended to accelerate early UX evaluation before human user testing, not replace real research.

---

# Product Context

Design Canvas is the source environment where users create and save product and UI artifacts.

Users retain ownership of their saved files and manage those files themselves.

Redactd CLI does not act as a hosted project management layer. Instead, it operates on folders the user already owns locally.

The CLI should be able to inspect those folders, understand the Design Canvas artifact structure, and run local evaluation workflows that output reports and follow-on artifacts.

---

# Visual Language

Redactd CLI should align with the broader product ecosystem and reuse the existing theme decisions established in OpenNote where they make sense for a terminal-first interface.

This does not mean Redactd CLI replaces or merges with OpenNote.

It means both tools should feel like part of the same family through shared color and tone choices.

## Theme Direction

- terminal-first
- dark-first
- purple-accented
- minimal, focused, and technical rather than playful

## Shared Palette

The current OpenNote palette should be adopted as the baseline theme for Redactd CLI:

- primary accent: `#d199ff`
- soft foreground: `#ecebff`
- deep dark surface/background: `#120a1a`

These colors come from the existing OpenNote CLI and supporting export surfaces and should be treated as the initial canonical ecosystem palette.

## CLI Styling Guidance

- use the purple accent for key highlights, active states, headings, and important progress indicators
- use the soft foreground for supporting copy, labels, descriptive text, and secondary output
- use the deep dark background as the default visual base for screenshots, docs, demos, and any terminal-themed output surfaces
- keep warning and error states visually distinct from the brand purple so system status remains clear
- avoid introducing a different primary brand hue for Redactd CLI in phase 1

## Terminal Theme Modes

Redactd CLI should support:

- `auto`
- `dark`
- `light`

On macOS, the terminal application controls the actual background theme.

The CLI should therefore treat theme selection as a text-color and emphasis decision rather than attempting to control the terminal background itself.

`auto` should be the default mode.

If terminal theme detection is unreliable, the CLI should fall back to the dark palette unless the user explicitly selects light mode.

## Default Theme Tokens

The default semantic theme tokens for Redactd CLI should be:

### Dark

- `accent`: `#d199ff`
- `text`: `#ecebff`
- `muted`: `#b8afcf`
- `subtle`: `#8f86a8`
- `success`: `#7ce2b3`
- `warning`: `#ffd166`
- `error`: `#ff7a90`
- `info`: `#8ec5ff`
- `background`: `#120a1a`
- `surface`: `#1a1126`
- `border`: `#312341`

### Light

- `accent`: `#8f4fd6`
- `text`: `#24172f`
- `muted`: `#5d4d73`
- `subtle`: `#7a6b90`
- `success`: `#1f8f63`
- `warning`: `#9a6700`
- `error`: `#c23b57`
- `info`: `#2f6fdd`
- `background`: `#fcf8ff`
- `surface`: `#f2eafe`
- `border`: `#d8c7f2`

These are the default starting values for implementation and can be tuned later without changing the broader visual direction.

## UX Tone

The CLI output should feel:

- precise
- calm
- design-aware
- system-oriented

The visual treatment should support readability first, with branding expressed through restrained accent usage rather than heavy decoration.

---

# Goals

## Primary Goals

1. Provide a Redactd CLI for Design Canvas artifacts
2. Allow users to run synthetic persona simulations against UI JSON flows
3. Generate structured usability feedback that is easy to compare across runs
4. Keep project artifacts and generated outputs user-owned and stored locally

## Secondary Goals

- establish the foundation for critique agents
- establish the foundation for guided iteration loops
- support multiple personas and repeatable runs

---

# Non Goals

This product will not:

- replace real user research
- host Design Canvas projects remotely
- manage file storage on behalf of users
- generate UI artifacts in phase 1
- perform automated browser interaction in phase 1

The CLI evaluates structured Design Canvas artifacts on disk.

---

# Target Users

## Primary

- product designers using Design Canvas
- frontend engineers working from structured UI definitions
- design system engineers reviewing flow quality
- AI-assisted product builders working locally

## Secondary

- startups validating early product UX
- teams experimenting with local AI-assisted product design workflows

---

# Product Phases

## Phase 1: Synthetic Persona Testing

The first deliverable is a CLI workflow that runs synthetic personas against Design Canvas UI flow JSON and produces structured reports.

## Phase 2: Critique

Later versions introduce critique agents that review flows through different lenses such as UX, accessibility, design system consistency, and product quality.

## Phase 3: Iteration

Later versions introduce guided revision workflows that use prior outputs to suggest or generate improved UI JSON artifacts.

Iteration should be constrained to avoid uncontrolled revision loops.

---

# Inputs

## Design Canvas Project Folder

The CLI operates on a user-managed project folder.

At minimum, phase 1 expects a UI flow folder and optional persona definitions.

Example structure:

/project
/flow
01-cart.json
02-checkout.json
03-payment.json
04-confirmation.json
/personas
julie.md
max.md

The exact folder contract should be formalized in implementation.

## UI Flow JSON

Each JSON file represents one screen in an ordered flow.

Phase 1 assumes these files are saved from the Redactd builder and therefore use a predictable component-tree structure.

Example saved page structure:

```json
{
  "id": "root",
  "type": "Root",
  "props": {},
  "children": [
    {
      "id": "canvas",
      "type": "_Canvas",
      "props": {},
      "children": [
        {
          "id": "comp_10068-1773020542940-6726",
          "type": "Container",
          "props": {
            "center": true,
            "size": "large"
          },
          "children": []
        }
      ]
    }
  ]
}
```

For phase 1, the CLI should treat this structure as the canonical page artifact contract unless a later schema version replaces it.

### Page Artifact Contract

- each file is one page
- the top-level node is `Root`
- `Root.children[0]` is `_Canvas`
- `_Canvas.children` contains the actual page component tree
- phase 1 assumes `_Canvas.children` contains exactly one primary page root node
- page content is evaluated recursively from that page root node downward
- `id` fields are builder metadata and should not be treated as semantically meaningful for UX evaluation
- `type`, `props`, `children`, and optional `slot` values are semantically meaningful
- if wrapper nodes are present, the CLI should ignore `Root` and `_Canvas` as editor/runtime scaffolding and evaluate the actual page content inside `_Canvas`
- if a file does not match this structure, the CLI should fail with a clear validation error

### Parsing Rules

- load the JSON file
- validate that the top-level object has `type: "Root"`
- validate that `Root.children` contains a `_Canvas` node
- use the first valid `_Canvas` node as the page container
- validate that `_Canvas.children` contains exactly one primary page root node in phase 1
- traverse the page root recursively in document order
- use file ordering to determine screen sequence across a flow

### Schema Stability

The current Redactd saved-page JSON is considered structured and usable for CLI scanning in phase 1.

The CLI should not infer meaning from editor-specific implementation details beyond the explicit contract above.

If the saved artifact shape changes later, the schema should be versioned explicitly rather than relying on implicit parser changes.

Example:

```json
{
  "screen": "checkout",
  "components": [
    { "type": "ui-input", "label": "Email", "required": true },
    { "type": "ui-input", "label": "Address", "required": true },
    { "type": "ui-button", "label": "Continue", "variant": "primary" }
  ]
}
```

The CLI should evaluate the flow sequentially based on file ordering unless a later schema introduces explicit navigation metadata.

## Persona Files

Personas are defined as markdown files.

Example:

```md
# Julie

Context
Economic downturn

Traits
Cost-conscious
Suspicious of hidden fees
Impatient with long forms

Goals
Complete purchase
Confirm total cost early

Behaviour
Abandons checkout if pricing unclear
```

The persona format can remain lightweight in phase 1 as long as it is consistent enough for repeatable agent execution.

---

# CLI Interface

Initial implementation will be CLI-based.

Example commands:

```bash
redactd test ./project
redactd test ./project --personas ./project/personas
redactd test ./project --persona julie
```

Future commands may separate testing, critique, and iteration into distinct subcommands, for example:

```bash
redactd critique ./project
redactd iterate ./project
```

Phase 1 only requires the testing workflow.

---

# Execution Flow

Design Canvas project folder
↓
Artifact loader
↓
Flow parser
↓
Persona loader
↓
Persona simulation agent
↓
Structured evaluation
↓
Local reports

---

# Persona Simulation

Each persona receives:

- persona definition
- UI JSON flow
- task context

Example task:

Complete checkout and confirm final price.

The agent simulates movement through the UI screens in order and records observations based on the persona's goals, traits, and behaviour patterns.

Persona agents must:

- act according to the defined persona
- attempt to complete the stated task
- evaluate screens sequentially
- produce structured feedback
- avoid referencing internal prompts or generation logic

Persona agents should focus on:

- clarity of actions
- friction in task completion
- confusion points
- perceived trust or risk
- emotional reaction to interface choices

Persona agents should not:

- redesign the UI in phase 1
- propose full implementation solutions
- invent components not present in the JSON

---

# Outputs

All outputs are saved locally inside the user-controlled project or run directory.

Example:

/project
/runs
/run-001
julie-report.md
max-report.md
summary.json
scores.json

Each run should be isolated enough to compare outputs across versions of the same flow.

## Example Output JSON

```json
{
  "persona": "Julie",
  "task_success": true,
  "csat": 6.2,
  "friction_points": [
    "Shipping cost appears late",
    "Too many payment fields"
  ],
  "confusion_points": [
    "Promo code field unclear"
  ],
  "recommendations": [
    "Show final price earlier",
    "Reduce checkout fields"
  ]
}
```

## Report Structure

Persona reports should include:

- persona name
- task attempted
- task success
- CSAT score
- friction points
- confusion points
- recommendations

Reports should be structured enough to support comparison between runs, personas, and later iterations.

---

# Scoring System

Each persona run produces evaluation scores.

Initial scores:

- CSAT: 1-10
- Task Success: true / false
- Friction Score: 1-10
- Clarity Score: 1-10

Scores are directional and should help compare different UI versions rather than imply objective truth.

---

# Data Ownership

User data remains user-owned.

The system should:

- read local Design Canvas artifacts
- write reports locally
- avoid remote project storage

An implementation decision is still required on model execution:

- local storage is mandatory
- local model inference is preferred if feasible
- if external model APIs are used, that needs to be explicitly disclosed as a separate implementation constraint

---

# Risks

## AI Bias

Synthetic personas may produce plausible but inaccurate insights.

Outputs should be treated as directional feedback.

## Overconfidence

Teams may give synthetic outputs too much authority.

Human testing remains necessary for meaningful product decisions.

## Weak Input Schemas

If the Design Canvas artifact schema is too loose, results will be inconsistent and difficult to compare across runs.

Phase 1 depends on a stable enough folder and JSON contract.

---

# Success Metrics

## Phase 1 Metrics

- successful execution rate across project folders
- report clarity
- usefulness of recommendations
- ability to compare multiple persona runs on the same flow

## Later Metrics

- critique quality
- iteration improvement score
- UX issue detection quality across versions

---

# Long Term Vision

Redactd CLI becomes the evaluation and improvement layer for Design Canvas.

The long-term workflow is:

Idea
↓
Design Canvas artifacts
↓
Synthetic persona testing
↓
Critique agents
↓
Iteration
↓
Improved proposal

This creates a local-first workflow for rapid product exploration before human validation.

---

# Open Questions

- What exact folder structure should Redactd CLI require for Design Canvas projects?
- What is the minimum stable JSON schema needed for useful persona evaluation?
- How deterministic should outputs be across repeated runs?
- Should reports live inside the project folder or in a separate global runs directory?
- Will phase 1 support only local inference, or permit external model providers with explicit user consent?
