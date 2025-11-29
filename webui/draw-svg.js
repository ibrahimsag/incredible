
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

function createNodeSvg(cx, cy, r) {
  r = r || 3;
  return se('circle', {
    cx: cx * 10,
    cy: cy * 10,
    r: r,
    fill: '#00d2ff', // Cyan-ish
    'stroke-width': 1,
  });
}

function createPathSvg(points, stroke) {
  stroke = stroke || '#00d2ff';
  var d = points.map(function(p, i) {
      return (i === 0 ? 'M' : 'L') + " " + (p[0] * 10) + " " + (p[1] * 10);
  }).join(' ');
  return se('path', {
    d: d,
    stroke: stroke,
    'stroke-width': 1,
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

function createBandSvg(interval, color) {
  var t0 = interval[0];
  var t1 = interval[1];
  var points = [
    [-t0, t0],
    [-t1, t0],
    [-t1, t1]
  ];
  return createPathSvg(points, color);
}

function pushNetSvg(svg, nodes) {
  var r = 2;
  var pos_map = {}; // Maps ID to Interval
  var cursor = 0;

  // Layout Pass
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var start = cursor;

    if (node.before) {
      for (var j = 0; j < node.before.length; j++) {
        var link_node = node.before[j];
        // Link gets a unit interval
        link_node.interval = [cursor, cursor + 1];
        link_node.broad_interval = [cursor, cursor + 1];
        pos_map[link_node.id] = link_node.interval;
        cursor++;
      }
    }

    // Node gets a unit interval
    node.interval = [cursor, cursor + 1];
    pos_map[node.id] = node.interval;
    cursor++;

    // Broad interval covers from start of inputs (or self) to end of self
    node.broad_interval = [start, cursor];
  }

  // Render Pass
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];

    // Draw Broad Interval as L-shape
    if (node.broad_interval) {
      svg.appendChild(
        createBandSvg(node.broad_interval, node.type === 'link' ? '#555' : '#00d2ff')
      );
      
      // Draw Label for Node
      // Place at the corner of the L-shape or center of vertical span
      if (node.type !== 'link') {
          var t0 = node.interval[0];
          var t1 = node.interval[1];
          svg.appendChild(createLabelSvg(-t1 + 0.2, t0 + 0.2, node.type));
      }
    }

    // Draw Links
    if (node.before) {
      for (var j = 0; j < node.before.length; j++) {
        var link_node = node.before[j];
        var link_mid = (link_node.interval[0] + link_node.interval[1]) / 2;

        if (link_node.link) {
          var target_interval = pos_map[link_node.link];
          if (target_interval) {
            var target_mid = (target_interval[0] + target_interval[1]) / 2;
            svg.appendChild(createNodeSvg(-link_mid, target_mid, r));
          }
        }
      }
    }
  }
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
