
function builder() {
  var nodes = [];
  var fresh = 1;

  function j(attrs) {
    var node = _.extend({}, attrs, { id: fresh++ });
    return node;
  }
  function k(new_node) {
    nodes.push(new_node);
    return new_node.id;
  }
  function l(node_id) {
    return { type: 'link', link: node_id };
  }
  function kj(attrs) {
    return k(j(attrs));
  }
  function lkj(attrs) {
    return l(k(j(attrs)));
  }
  function jlkj(attrs) {
    return j(l(k(j(attrs))));
  }
  return { nodes: nodes, j: j, k: k, l: l, kj: kj, lkj: lkj, jlkj: jlkj };
}

function buildDefaultGraph() {
  var b = builder();

  var l_a = b.lkj({ type: 'A' });
  // Default graph definition
  b.kj({
    type: 'and',
    before: [
      b.jlkj({ type: 'or', before: [b.j(l_a), b.jlkj({ type: 'B' })] }),
      b.jlkj({ type: 'or', before: [b.jlkj({ type: 'C' }), b.j(l_a)] }),
    ],
  });

  return b.nodes;
}

function buildDefaultTree() {
  var b = builder();
  
  b.kj({
    type: 'and',
    before: [
      b.jlkj({ type: 'or', before: [b.jlkj({ type: 'A' }), b.jlkj({ type: 'B' })] }),
      b.jlkj({ type: 'or', before: [b.jlkj({ type: 'C' }), b.jlkj({ type: 'D' })] }),
    ],
  });

  return b.nodes;
}
