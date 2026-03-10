function countAcrossPages(pages, componentType) {
  return pages.reduce((sum, page) => sum + (page.componentCounts[componentType] ?? 0), 0);
}

function hasAnyTextMatch(pages, pattern) {
  const needle = pattern.toLowerCase();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return false;
    for (const value of Object.values(node.props ?? {})) {
      if (typeof value === 'string' && value.toLowerCase().includes(needle)) {
        return true;
      }
    }
    return (node.children ?? []).some(visit);
  };

  return pages.some((page) => visit(page.rootNode));
}

function cloneNode(node) {
  if (!node || typeof node !== 'object') return node;
  return {
    ...node,
    props: { ...(node.props ?? {}) },
    children: (node.children ?? []).map(cloneNode)
  };
}

function cloneCanvasChildren(page) {
  return (page.canvasChildren ?? [page.rootNode]).map(cloneNode);
}

export class MockProvider {
  constructor() {
    this.name = 'mock';
    this.model = 'heuristic-offline';
  }

  async evaluate({ project, persona }) {
    const pages = project.pages;
    const buttons = countAcrossPages(pages, 'Button');
    const inputs = countAcrossPages(pages, 'Input');
    const headings = countAcrossPages(pages, 'Heading');
    const cards = countAcrossPages(pages, 'Card');

    const frictionPoints = [];
    const confusionPoints = [];
    const recommendations = [];

    if (inputs >= 8) {
      frictionPoints.push('The flow asks for a large amount of input, which may feel effortful.');
      recommendations.push('Reduce or better stage required inputs across the flow.');
    }

    if (buttons === 0) {
      confusionPoints.push('No explicit button actions were detected in the page set.');
      recommendations.push('Ensure the primary action is represented clearly in the component tree.');
    }

    if (headings < pages.length) {
      confusionPoints.push('Some screens may lack strong heading structure for orientation.');
      recommendations.push('Add clear screen-level headings for faster orientation.');
    }

    if (persona.focus.includes('upfront pricing clarity') && !hasAnyTextMatch(pages, '$')) {
      frictionPoints.push('Pricing does not appear clearly represented in the saved flow.');
      recommendations.push('Expose total cost or pricing earlier in the flow.');
    }

    if (persona.focus.includes('trust signals') && !hasAnyTextMatch(pages, 'secure')) {
      confusionPoints.push('The flow does not show obvious trust or reassurance language.');
      recommendations.push('Add clear trust and safety reassurance near sensitive actions.');
    }

    if (persona.focus.includes('mobile clarity') && cards >= 6) {
      frictionPoints.push('A dense card-heavy layout may feel crowded on smaller screens.');
      recommendations.push('Check whether screen density remains manageable on mobile.');
    }

    if (persona.type.toLowerCase().includes('stakeholder') && recommendations.length === 0) {
      recommendations.push('The flow appears structurally coherent at a high level; validate this with deeper review.');
    }

    if (frictionPoints.length === 0) {
      frictionPoints.push('No major friction was obvious from the artifact structure alone.');
    }

    if (confusionPoints.length === 0) {
      confusionPoints.push('No major confusion point was obvious from the artifact structure alone.');
    }

    let clarity = 8;
    let friction = 3;
    let csat = 7.5;

    clarity -= Math.min(3, confusionPoints.length - 1);
    friction += Math.min(4, frictionPoints.length - 1);
    csat -= Math.min(3, (frictionPoints.length + confusionPoints.length - 2) * 0.6);

    if (persona.type === 'User' && persona.traits.includes('impatient')) {
      csat -= 0.5;
    }

    if (persona.type === 'Stakeholder Hat') {
      csat -= 0.3;
    }

    return {
      taskSuccess: clarity >= 5,
      csat: Number(Math.max(1, Math.min(10, csat)).toFixed(1)),
      frictionScore: Math.max(1, Math.min(10, friction)),
      clarityScore: Math.max(1, Math.min(10, clarity)),
      frictionPoints,
      confusionPoints,
      recommendations
    };
  }

  async iterate({ project, critique, loopNumber, previousLoop }) {
    const priorityActions = critique.topRecommendations.slice(0, 3);
    const priorChanges = previousLoop?.changes ?? [];

    return {
      summary: `Loop ${loopNumber} focuses on the strongest critique themes and preserves the current overall flow.`,
      changes: priorityActions.length > 0
        ? priorityActions.map((item, index) => `Loop ${loopNumber} change ${index + 1}: ${item}`)
        : [`Loop ${loopNumber} change 1: tighten clarity around the primary path.`],
      retained: priorChanges.length > 0
        ? priorChanges.slice(0, 2)
        : ['Preserve the page order and existing component structure where possible.'],
      risks: [
        'Updated copy and hierarchy should be reviewed against the original product intent.',
        'Generated changes still need human verification before replacing a saved version.'
      ],
      pages: project.pages.map((page) => ({
        fileName: page.fileName,
        canvasChildren: cloneCanvasChildren(page)
      }))
    };
  }
}
