import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const [directory] = process.argv.slice(2);
if (!directory) throw new Error('Supply a private production-audit directory.');
const report = { workflows: 0, codeNodes: 0, syntaxFailures: [] };
for (const filename of await fs.readdir(directory)) {
  if (!/^workflow-[a-zA-Z0-9_-]+\.json$/.test(filename)) continue;
  const workflow = JSON.parse(await fs.readFile(path.join(directory, filename), 'utf8'));
  report.workflows++;
  for (const [kind, graph] of [['saved', workflow], ['active', workflow.activeVersion]]) {
    if (!graph) continue;
    for (const node of graph.nodes || []) {
      if (!node.type.endsWith('.code') || !node.parameters.jsCode) continue;
      report.codeNodes++;
      try { new vm.Script(`(async function(){${node.parameters.jsCode}\n})`); }
      catch { report.syntaxFailures.push({ workflowId: workflow.id, graph: kind, nodeName: node.name }); }
    }
  }
}
// Syntax validation does not execute remote code or prove its business behavior.
console.log(JSON.stringify(report, null, 2));
if (report.syntaxFailures.length) process.exitCode = 1;
