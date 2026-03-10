import path from 'node:path';
import { listFilesRecursive, readJson } from './fs-utils.js';

function validateRootShape(filePath, value) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid page JSON in ${filePath}: expected object`);
  }

  if (value.type !== 'Root' || !Array.isArray(value.children)) {
    throw new Error(`Invalid page JSON in ${filePath}: expected Root node with children`);
  }

  const canvasNode = value.children.find((child) => child && child.type === '_Canvas');
  if (!canvasNode || !Array.isArray(canvasNode.children)) {
    throw new Error(`Invalid page JSON in ${filePath}: missing _Canvas wrapper`);
  }

  if (canvasNode.children.length === 0) {
    throw new Error(`Invalid page JSON in ${filePath}: _Canvas does not contain any page nodes`);
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    wrapperType: value.type,
    canvasType: canvasNode.type,
    canvasChildren: canvasNode.children,
    rootNode:
      canvasNode.children.length === 1
        ? canvasNode.children[0]
        : {
            id: `${path.basename(filePath, path.extname(filePath))}::canvas-group`,
            type: 'CanvasGroup',
            props: {},
            children: canvasNode.children
          }
  };
}

function collectNodes(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  acc.push(node);
  for (const child of node.children ?? []) {
    collectNodes(child, acc);
  }
  return acc;
}

function summarizePage(page) {
  const nodes = collectNodes(page.rootNode);
  const componentCounts = {};

  for (const node of nodes) {
    componentCounts[node.type] = (componentCounts[node.type] ?? 0) + 1;
  }

  return {
    ...page,
    totalNodes: nodes.length,
    componentCounts
  };
}

export async function loadProject(projectPath) {
  const candidateFiles = (await listFilesRecursive(projectPath)).filter((filePath) =>
    filePath.endsWith('.json')
  );
  const pages = [];

  for (const filePath of candidateFiles) {
    try {
      const parsed = await readJson(filePath);
      pages.push(summarizePage(validateRootShape(filePath, parsed)));
    } catch {
      // Ignore JSON files that are not valid Redactd page artifacts.
    }
  }

  if (pages.length === 0) {
    throw new Error(`No valid Redactd page JSON files found in ${projectPath}`);
  }

  return {
    projectPath,
    pages
  };
}
