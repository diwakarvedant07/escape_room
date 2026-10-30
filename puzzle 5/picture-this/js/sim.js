// Attack-graph simulation (spec §4 stage 5). A real graph search over data/graph.json:
// the attacker wins if any OUT -> PAY path has every edge uncut.
function cutEdges(graph, controlIds) {
  const cut = new Set();
  for (const id of controlIds) {
    const control = graph.controls.find((c) => c.id === id);
    if (!control) throw new Error('Unknown control ' + id);
    control.cuts.forEach((e) => cut.add(e));
  }
  return cut;
}

// Breadth-first search; returns the edge ids of a shortest open path, or null.
function findPath(graph, cut) {
  const via = new Map([[graph.start, null]]);
  const queue = [graph.start];
  while (queue.length) {
    const node = queue.shift();
    if (node === graph.goal) break;
    for (const edge of graph.edges) {
      if (edge.from === node && !cut.has(edge.id) && !via.has(edge.to)) {
        via.set(edge.to, edge);
        queue.push(edge.to);
      }
    }
  }
  if (!via.has(graph.goal)) return null;
  const path = [];
  for (let node = graph.goal; via.get(node); node = via.get(node).from) path.unshift(via.get(node).id);
  return path;
}

function reachable(graph, cut, origin, forward) {
  const seen = new Set([origin]);
  const stack = [origin];
  while (stack.length) {
    const node = stack.pop();
    for (const edge of graph.edges) {
      if (cut.has(edge.id)) continue;
      const [a, b] = forward ? [edge.from, edge.to] : [edge.to, edge.from];
      if (a === node && !seen.has(b)) {
        seen.add(b);
        stack.push(b);
      }
    }
  }
  return seen;
}

// Edges that lie on at least one open start -> goal route.
function openEdges(graph, cut) {
  const fromStart = reachable(graph, cut, graph.start, true);
  const toGoal = reachable(graph, cut, graph.goal, false);
  return graph.edges
    .filter((e) => !cut.has(e.id) && fromStart.has(e.from) && toGoal.has(e.to))
    .map((e) => e.id);
}

function simulate(graph, controlIds) {
  const cut = cutEdges(graph, controlIds);
  const path = findPath(graph, cut);
  return { reached: !!path, path, cut: [...cut], open: path ? openEdges(graph, cut) : [] };
}

function combinations(items, k) {
  if (k === 0) return [[]];
  const out = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), k - 1)) out.push([item, ...rest]);
  });
  return out;
}

// Every control set of size <= maxK that leaves no open path, grouped by size.
function blockingSets(graph, maxK) {
  const ids = graph.controls.map((c) => c.id);
  const bySize = {};
  for (let k = 0; k <= maxK; k++) {
    bySize[k] = combinations(ids, k).filter((set) => !simulate(graph, set).reached);
  }
  return bySize;
}

function minimumCutSize(graph, maxK) {
  const bySize = blockingSets(graph, maxK);
  for (let k = 0; k <= maxK; k++) if (bySize[k].length) return k;
  return null;
}

// Grades a rack placement: 'fail' | 'sufficient' | 'minimal' | 'too-many'.
function evaluate(graph, controlIds) {
  const result = simulate(graph, controlIds);
  const max = graph.maxControls;
  if (controlIds.length > max) result.verdict = 'too-many';
  else if (result.reached) result.verdict = 'fail';
  else result.verdict = controlIds.length === minimumCutSize(graph, max) ? 'minimal' : 'sufficient';
  return result;
}

export const sim = { cutEdges, findPath, openEdges, simulate, combinations, blockingSets, minimumCutSize, evaluate };
