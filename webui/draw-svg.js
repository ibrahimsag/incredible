
function se(tagName, attrs) {
  attrs = attrs || {};
  var el = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  for (var key in attrs) {
    if (attrs.hasOwnProperty(key)) {
      var value = attrs[key];
      if (key === 'style' && typeof value === 'object' && value !== null) {
        $.extend(el.style, value);
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  return el;
}

function createPathSvg(points, stroke) {
  stroke = stroke || '#00d2ff';
  var d = points.map(function(p, i) {
      return (i === 0 ? 'M' : 'L') + " " + (p[0] * 10) + " " + (p[1] * 10);
  }).join(' ');
  return se('path', {
    d: d,
    stroke: stroke,
    'stroke-width': 0.3,
    fill: 'none',
  });
}

function createLabelSvg(cx, cy, text) {
  var el = se('text', {
    x: cx * 10,
    y: cy * 10,
    'font-size': 6,
    fill: '#fff',
    'font-family': 'sans-serif',
    'pointer-events': 'none',
    'text-anchor': 'start',
    'alignment-baseline': 'hanging',
  });
  el.textContent = text;
  return el;
}

function points_band(interval) {
  var t0 = interval[0];
  var t1 = interval[1];
  let inv = t0 > t1;

  var points = [
    [-t0, t0],
    inv ? [-t0, t1] : [-t1, t0],
    [-t1, t1]
  ];

  return [points, inv];
}

function createLinkSvg(interval, color) {
  var group = se('g', {});
  
  let [points, inv] = points_band(interval);
  group.appendChild(createPathSvg(points, color));

  // Arrowhead at points[1] (the corner)
  var p1 = points[1]; 
  var p2 = points[2]; // The end of the segment from p1
  
  var cx = p1[0] * 10;
  var cy = p1[1] * 10;
  var sz = 1.5; // Size of arrow

  var arrowPath = [
    [cx - sz, cy - sz],
    inv ? [cx + sz, cy - sz] : [cx - sz, cy + sz],
    [cx + sz, cy + sz],
  ];
  var d = arrowPath.map(function(p, i) {
    return (i === 0 ? 'M' : 'L') + " " + (p[0]) + " " + (p[1]);
  }).join(' ') + ' Z';

  group.appendChild(se('path', {
    d: d,
    'stroke-width': 0.3,
    fill: '#555',
    stroke: '#999',
  }));
  
  return group;
}
function createBandSvg(interval, color) {
  let [points, _] = points_band(interval);
  return createPathSvg(points, color);
}

function pushNetSvg(svg, nodes) {
  var r = 2;
  var pos_map = {}; // Maps ID to Interval
  var cursor = 0;

  // Helper for Layout
  function layoutNode(node) {
    var start = cursor;

    if (node.before && node.before.length > 0) {
      cursor += 0.1;
      for (var j = 0; j < node.before.length; j++) {
        layoutNode(node.before[j]);
      }
      cursor += 0.1;
    }

    node.interval = [cursor, cursor + 1];
    // Handle non-numeric IDs if necessary, though proofToNodes uses ints
    pos_map[node.id] = node.interval;
    cursor += 1.0;

    if (node.after && node.after.length > 0) {
      cursor += 0.1;
      for (var j = 0; j < node.after.length; j++) {
        layoutNode(node.after[j]);
      }
      cursor += 0.1;
    }

    node.broad_interval = [start, cursor];
  }

  // Layout Pass
  for (var i = 0; i < nodes.length; i++) {
    layoutNode(nodes[i]);
  }

  // Helper for Render
  function renderNode(node) {
    // Draw Node Body (L-shape)
    if (node.broad_interval) {
      svg.appendChild(
        createBandSvg(node.broad_interval, node.label === 'link' ? '#555' : '#00d2ff')
      );

      if (node.interval) {
          svg.appendChild(
            createBandSvg(node.interval, node.label === 'link' ? '#555' : '#00d2ff')
          );
      }

      // Draw Label
      if (node.label !== 'link') {
          var t0 = node.interval[0];
          var t1 = node.interval[1];
          svg.appendChild(createLabelSvg(-t1 + 0.2, t0 + 0.2, node.label));
      }
    }

    // Draw Children (Before)
    if (node.before) {
      for (let j = 0; j < node.before.length; j++) {
        let child = node.before[j];
        renderNode(child);
      }
    }
    
    // Draw Children (After)
    if (node.after) {
      for (let j = 0; j < node.after.length; j++) {
        let child = node.after[j];
        renderNode(child);
        // Usually output ports don't link *out* via 'link' property in this model
      }
    }

    // Draw Link Connection if applicable
    if (node.link) {
      var link_mid = (node.interval[0] + node.interval[1]) / 2;
      var target_interval = pos_map[node.link];
      if (target_interval) {
        var target_mid = (target_interval[0] + target_interval[1]) / 2;
        svg.appendChild(createLinkSvg([target_mid, link_mid], node.label === 'link' ? '#555' : '#00d2ff'));
      }
    }
  }

  // Render Pass
  for (var i = 0; i < nodes.length; i++) {
    renderNode(nodes[i]);
  }
  
  return cursor;
}

function createDebugSvg(nodes) {
  nodes = nodes || buildDefaultGraph();
  var width = 1024;
  var height = 768;
  var svg = se('svg', {
    width: width,
    height: height,
    style: {
      display: 'block',
      margin: '10px auto',
      border: '1px solid #333',
      backgroundColor: '#1e1e1e',
      maxWidth: '100%',
      height: 'auto',
    },
  });

  pushNetSvg(svg, nodes);

  // Temporarily append to DOM to calculate BBox
  svg.style.visibility = 'hidden';
  svg.style.position = 'absolute';
  document.body.appendChild(svg);

  try {
    var bbox = svg.getBBox();
    var padding = 50;
    var vbX = bbox.x - padding;
    var vbY = bbox.y - padding;
    var vbW = bbox.width + padding * 2;
    var vbH = bbox.height + padding * 2;

    svg.setAttribute('viewBox', vbX + " " + vbY + " " + vbW + " " + vbH);
  } catch (e) {
    console.warn('createDebugSvg: Could not calculate BBox', e);
  } finally {
    document.body.removeChild(svg);
    // Reset temporary styles
    svg.style.visibility = '';
    svg.style.position = '';
  }

  return svg;
}

function getBlockPorts(block) {
  var inputs = [];
  var outputs = [];
  
  if (block.rule) {
      var rule = current_logic().rules.find(function(r) { return r.id === block.rule; });
      if (rule) {
          $.each(rule.ports, function(name, port) {
              // Logic gates: assumptions are inputs, conclusions are outputs
              // In standard rules: 
              // 'assumption' ports are inputs.
              // 'conclusion' ports are outputs.
              // 'local hypothesis' ports are outputs (they provide a hypothesis).
              
              if (port.type === 'assumption') inputs.push(name);
              else outputs.push(name);
          });
      }
  } else if (block.assumption) {
      outputs.push('out');
  } else if (block.conclusion) {
      inputs.push('in');
  } else if (block.annotation) {
      inputs.push('in');
      outputs.push('out');
  }
  
  return { inputs: inputs, outputs: outputs };
}

function topologicalSortBlocks(proof) {
  var inDegree = {};
  var graph = {};
  var allBlocks = Object.keys(proof.blocks);
  
  allBlocks.forEach(function(id) {
    inDegree[id] = 0;
    graph[id] = [];
  });
  
  if (proof.connections) {
    $.each(proof.connections, function(id, conn) {
      var source = conn.from.block;
      var target = conn.to.block;
      if (graph[source] && graph[target]) {
        graph[source].push(target);
        inDegree[target]++;
      }
    });
  }
  
  var queue = [];
  allBlocks.forEach(function(id) {
    if (inDegree[id] === 0) {
      queue.push(id);
    }
  });
  
  queue.sort(); 
  
  var sorted = [];
  while (queue.length > 0) {
    var u = queue.shift();
    sorted.push(u);
    
    if (graph[u]) {
      graph[u].forEach(function(v) {
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      });
    }
  }
  
  if (sorted.length < allBlocks.length) {
    var visited = {};
    sorted.forEach(function(id) { visited[id] = true; });
    allBlocks.forEach(function(id) {
      if (!visited[id]) sorted.push(id);
    });
  }
  
  return sorted;
}

function proofToNodes(proof, analysis) {
  var nodes = [];
  var blockToNodeMap = {};
  var nextId = 1;
  analysis = analysis || {};
  var portLabels = analysis.portLabels || {};

  // Sort blocks topologically
  var sortedBlockIds = topologicalSortBlocks(proof);

  // Helper to get port label from analysis
  function getPortLabel(blockId, portName) {
    if (portLabels[blockId] && portLabels[blockId][portName]) {
      return portLabels[blockId][portName];
    }
    return portName;
  }

  // Collect assumption and conclusion blocks
  var assumptionBlocks = [];
  var conclusionBlocks = [];
  var otherBlockIds = [];

  sortedBlockIds.forEach(function(blockId) {
    var block = proof.blocks[blockId];
    if (block.assumption) {
      assumptionBlocks.push({ blockId: blockId, proposition: block.assumption });
    } else if (block.conclusion) {
      conclusionBlocks.push({ blockId: blockId, proposition: block.conclusion });
    } else {
      otherBlockIds.push(blockId);
    }
  });

  // Create single "assumption" node with all propositions as children
  if (assumptionBlocks.length > 0) {
    var assumptionNode = {
      id: nextId++,
      label: 'assumption',
      before: [],
      after: [],
      portNodes: {},
      outPortNodes: {}
    };
    nodes.push(assumptionNode);

    assumptionBlocks.forEach(function(ab) {
      var propNode = {
        id: nextId++,
        label: ab.proposition,
        before: []
      };
      assumptionNode.after.push(propNode);
      // Map original blockId to this node for connection lookup
      blockToNodeMap[ab.blockId] = {
        outPortNodes: { 'out': propNode },
        portNodes: {}
      };
    });
  }

  // Create nodes for rules and annotations
  otherBlockIds.forEach(function(blockId) {
    var block = proof.blocks[blockId];
    var label = block.rule || block.annotation || "unknown";
    if (typeof label !== 'string') label = JSON.stringify(label);

    var blockNode = {
      id: nextId++,
      blockId: blockId,
      label: label,
      before: [],
      after: [],
      portNodes: {},
      outPortNodes: {}
    };
    blockToNodeMap[blockId] = blockNode;
    nodes.push(blockNode);

    var ports = getBlockPorts(block);

    // Create explicit nodes for Output Ports
    $.each(ports.outputs, function(i, portName) {
        var outNode = {
            id: nextId++,
            label: portName,
            before: []
        };
        blockNode.after.push(outNode);
        blockNode.outPortNodes[portName] = outNode;
    });

    // Create explicit nodes for Input Ports
    $.each(ports.inputs, function(i, portName) {
        var portNode = {
            id: nextId++,
            label: portName,
            before: []
        };
        blockNode.before.push(portNode);
        blockNode.portNodes[portName] = portNode;
    });
  });

  // Create single "conclusion" node at the end
  if (conclusionBlocks.length > 0) {
    var conclusionNode = {
      id: nextId++,
      label: 'conclusion',
      before: [],
      after: [],
      portNodes: {},
      outPortNodes: {}
    };
    nodes.push(conclusionNode);

    conclusionBlocks.forEach(function(cb) {
      var propNode = {
        id: nextId++,
        label: cb.proposition,
        before: []
      };
      conclusionNode.before.push(propNode);
      // Map original blockId to this node for connection lookup
      blockToNodeMap[cb.blockId] = {
        portNodes: { 'in': propNode },
        outPortNodes: {}
      };
    });
  }

  // 2. Process connections
  if (proof.connections) {
      $.each(proof.connections, function(connId, conn) {
        var targetNode = blockToNodeMap[conn.to.block];
        var sourceNode = blockToNodeMap[conn.from.block];

        if (targetNode && sourceNode) {
          var targetPortNode = targetNode.portNodes[conn.to.port];
          var sourcePortNode = sourceNode.outPortNodes[conn.from.port];
          
          var targetBefore = targetPortNode ? targetPortNode.before : targetNode.before;
          var linkId = sourcePortNode ? sourcePortNode.id : sourceNode.id;

          var linkNode = {
            id: nextId++,
            label: 'link',
            link: linkId,
            port: conn.to.port
          };
          targetBefore.push(linkNode);
        }
      });
  }

  return nodes;
}

function updateDebugGraph(proof, analysis) {
  var overlay = $("#debug-overlay");
  // if (overlay.length === 0) return; // Removed this check

  var svg = overlay.find("svg").get(0);
  if (!svg) return;

  // Clear existing SVG content
  while (svg.lastChild) {
    svg.removeChild(svg.lastChild);
  }

  var nodes = proofToNodes(proof, analysis);
  pushNetSvg(svg, nodes);

  try {
    var bbox = svg.getBBox();
    var padding = 50;
    var vbX = bbox.x - padding;
    var vbY = bbox.y - padding;
    var vbW = bbox.width + padding * 2;
    var vbH = bbox.height + padding * 2;

    svg.setAttribute('viewBox', vbX + " " + vbY + " " + vbW + " " + vbH);
  } catch (e) {
    console.warn('updateDebugGraph: Could not calculate BBox', e);
  }
}
