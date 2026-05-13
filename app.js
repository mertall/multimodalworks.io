"use strict";

document.getElementById("year").textContent = String(new Date().getFullYear());

// ---------- USA flag stars: 50 stars in the canton, 9-row offset pattern. ----------
(function drawFlagStars() {
  const flags = document.querySelectorAll("svg #stars");
  if (!flags.length) return;
  const cantonW = 494;
  const cantonH = 350;
  const rows = 9;
  const colsLong = 6;
  const colsShort = 5;

  const points = [];
  for (let r = 0; r < rows; r++) {
    const isLong = r % 2 === 0;
    const cols = isLong ? colsLong : colsShort;
    const yStep = cantonH / (rows + 1);
    const y = yStep * (r + 1);
    const xStep = cantonW / (cols + 1);
    for (let c = 0; c < cols; c++) {
      points.push({ x: xStep * (c + 1), y });
    }
  }

  const starPath = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.4;
      pts.push(`${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`);
    }
    return `M${pts.join("L")}Z`;
  };

  flags.forEach((g) => {
    let d = "";
    for (const p of points) d += starPath(p.x, p.y, 13);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "#ffffff");
    g.appendChild(path);
  });
})();

// ---------- Hero: neural-net forward pass with streaming brand snippets. ----------
(function heroNetwork() {
  const svg = d3.select("#hero-network");
  if (svg.empty()) return;
  const containerEl = document.getElementById("hero-canvas");
  const tickerEl = document.getElementById("hero-ticker");

  const node = svg.node();
  const bbox = node.getBoundingClientRect();
  const w = bbox.width;
  const h = bbox.height;
  svg.attr("viewBox", `0 0 ${w} ${h}`);

  // ---------- Layout: 4-layer stylized network in the top 70%, console below.
  const layers = [4, 6, 5, 3];
  const netTop = h * 0.10;
  const netBottom = h * 0.68;
  const padX = w * 0.12;

  const nodes = [];
  layers.forEach((count, li) => {
    const cx = padX + (li / (layers.length - 1)) * (w - padX * 2);
    for (let i = 0; i < count; i++) {
      const cy = netTop + ((i + 0.5) / count) * (netBottom - netTop);
      nodes.push({ id: `${li}-${i}`, layer: li, idx: i, x: cx, y: cy });
    }
  });
  const byLayer = (li) => nodes.filter((n) => n.layer === li);

  // Sparse cross-layer connections (each node hits ~60-70% of next-layer nodes).
  const links = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const src = byLayer(li);
    const dst = byLayer(li + 1);
    src.forEach((s) => {
      dst.forEach((t) => {
        // Use deterministic-ish jitter from indices so the network is stable.
        const seed = Math.sin((s.idx + 1) * 17 + (t.idx + 1) * 31 + li * 7);
        if (seed > -0.25) links.push({ source: s, target: t });
      });
    });
  }

  // ---------- Render the static network. ----------
  const g = svg.append("g");

  const linkSel = g
    .append("g")
    .attr("stroke", "#9bb6ff")
    .attr("stroke-opacity", 0.18)
    .attr("stroke-width", 1)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);

  const nodeSel = g
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", 4.5)
    .attr("fill", "#f5f2e8")
    .attr("fill-opacity", 0.85)
    .attr("stroke", "#0a3161")
    .attr("stroke-width", 0.8);

  // Output "antennae" — short lines coming out the right of the last layer.
  byLayer(layers.length - 1).forEach((n) => {
    g.append("line")
      .attr("x1", n.x + 6)
      .attr("y1", n.y)
      .attr("x2", w - padX * 0.4)
      .attr("y2", n.y)
      .attr("stroke", "#9bb6ff")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-dasharray", "2 3");
  });

  // ---------- Console area at the bottom: streaming text + cursor. ----------
  const consoleTop = h * 0.74;
  const consoleH = h * 0.18;
  const consolePad = w * 0.05;

  g.append("rect")
    .attr("x", consolePad)
    .attr("y", consoleTop)
    .attr("width", w - consolePad * 2)
    .attr("height", consoleH)
    .attr("rx", 6)
    .attr("fill", "#0a3161")
    .attr("fill-opacity", 0.45)
    .attr("stroke", "#9bb6ff")
    .attr("stroke-opacity", 0.25);

  // Tiny prompt prefix to anchor the eye.
  const promptTextX = consolePad + 14;
  const textY = consoleTop + consoleH / 2 + 4;
  g.append("text")
    .attr("x", promptTextX)
    .attr("y", textY)
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", Math.max(11, Math.min(14, h * 0.034)))
    .attr("fill", "#9bb6ff")
    .attr("opacity", 0.85)
    .text(">");

  const streamText = g
    .append("text")
    .attr("x", promptTextX + 14)
    .attr("y", textY)
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", Math.max(11, Math.min(14, h * 0.034)))
    .attr("fill", "#f5f2e8")
    .text("");

  // ---------- Animation logic ----------
  const snippets = [
    "Local AI · 380ms first-token",
    "Zero data egress · cloud UX",
    "Cloud AI · 99.9% SLOs",
    "+20% Recall@10 on retrieval",
    "128 GB unified memory · ½ Mac Studio",
    "Prototype → production · 3–6 mo",
    "60-qubit peak circuit · laptop",
    "AWS SageMaker · FastAPI · HNSW",
  ];
  let snippetIdx = 0;
  let firing = false;
  let typeTimer = null;

  function clearText() {
    if (typeTimer) clearInterval(typeTimer);
    streamText.text("");
  }

  function streamSnippet(text) {
    clearText();
    let i = 0;
    typeTimer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(typeTimer);
        typeTimer = null;
        // Flash a cursor for a beat, then clear before next pulse.
        let on = true;
        let blinks = 0;
        const blinkTimer = setInterval(() => {
          streamText.text(text + (on ? "▌" : " "));
          on = !on;
          blinks += 1;
          if (blinks > 5) {
            clearInterval(blinkTimer);
            streamText.text("");
          }
        }, 220);
        return;
      }
      streamText.text(text.slice(0, i + 1) + "▌");
      i += 1;
    }, 26);
  }

  function fireWave() {
    if (firing) return;
    firing = true;
    const layerDelay = 220;

    // Sweep the pulse layer by layer.
    layers.forEach((_, li) => {
      const delay = li * layerDelay;
      nodeSel
        .filter((d) => d.layer === li)
        .transition()
        .delay(delay)
        .duration(170)
        .attr("fill", "#b31942")
        .attr("r", 7)
        .transition()
        .duration(280)
        .attr("fill", "#f5f2e8")
        .attr("r", 4.5);

      if (li < layers.length - 1) {
        linkSel
          .filter((d) => d.source.layer === li)
          .transition()
          .delay(delay + 80)
          .duration(160)
          .attr("stroke", "#b31942")
          .attr("stroke-opacity", 0.85)
          .attr("stroke-width", 1.4)
          .transition()
          .duration(360)
          .attr("stroke", "#9bb6ff")
          .attr("stroke-opacity", 0.18)
          .attr("stroke-width", 1);
      }
    });

    // After the pulse reaches the output layer, stream the next snippet.
    const totalSweep = layers.length * layerDelay;
    setTimeout(() => {
      const text = snippets[snippetIdx];
      snippetIdx = (snippetIdx + 1) % snippets.length;
      if (tickerEl) tickerEl.textContent = `snippet ${snippetIdx + 1} / ${snippets.length}`;
      streamSnippet(text);
      // Release the firing lock once the typing has time to start.
      setTimeout(() => {
        firing = false;
      }, 800);
    }, totalSweep);
  }

  // Auto-fire on a gentle interval; clicking the canvas also fires immediately.
  setTimeout(fireWave, 600);
  setInterval(() => {
    if (!firing) fireWave();
  }, 4800);

  if (containerEl) {
    containerEl.addEventListener("click", () => {
      if (!firing) fireWave();
    });
    containerEl.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !firing) {
        e.preventDefault();
        fireWave();
      }
    });
  }
})();

// ---------- Local AI Station architecture flow: query → agent → recall → router → LLM. ----------
(function localArchFlow() {
  const svg = d3.select("#local-arch");
  if (svg.empty()) return;
  const node = svg.node();
  const rect = node.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  svg.attr("viewBox", `0 0 ${w} ${h}`);

  const stages = [
    { id: "user", label: "user", sub: "prompt" },
    { id: "hermes", label: "Hermes", sub: "agent" },
    { id: "recall", label: "recall", sub: "AGE · Qdrant" },
    { id: "router", label: "LiteLLM", sub: "routing" },
    { id: "llm", label: "Qwen3", sub: "Ollama · APU" },
    { id: "stream", label: "stream", sub: "tokens" },
  ];

  const pad = 16;
  const boxW = (w - pad * 2) / stages.length - 14;
  const boxH = Math.min(64, h * 0.32);
  // Shift main pipeline up to leave room for the Langfuse observer lane.
  const y = h / 2 - boxH / 2 - 14;

  const defs = svg.append("defs");
  const grad = defs
    .append("linearGradient")
    .attr("id", "local-grad")
    .attr("x1", "0%")
    .attr("x2", "100%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", "#b31942");
  grad.append("stop").attr("offset", "100%").attr("stop-color", "#7f1d1d");

  defs
    .append("marker")
    .attr("id", "local-arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,0 L10,5 L0,10 Z")
    .attr("fill", "#0b1220");

  const g = svg.append("g");

  stages.forEach((stage, i) => {
    const x = pad + i * (boxW + 14);
    const boxG = g
      .append("g")
      .attr("transform", `translate(${x}, ${y})`)
      .attr("opacity", 0);

    boxG
      .append("rect")
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("rx", 8)
      .attr("fill", "url(#local-grad)")
      .attr("stroke", "#0b1220")
      .attr("stroke-opacity", 0.35);

    boxG
      .append("text")
      .attr("x", boxW / 2)
      .attr("y", boxH / 2 - 4)
      .attr("text-anchor", "middle")
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "#f6f3ec")
      .text(stage.label);
    boxG
      .append("text")
      .attr("x", boxW / 2)
      .attr("y", boxH / 2 + 14)
      .attr("text-anchor", "middle")
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 9)
      .attr("fill", "#f6f3ec")
      .attr("opacity", 0.75)
      .text(stage.sub);

    boxG
      .transition()
      .delay(i * 180)
      .duration(360)
      .attr("opacity", 1);

    if (i < stages.length - 1) {
      const arrowX1 = x + boxW + 2;
      const arrowX2 = x + boxW + 12;
      const arrowY = h / 2;
      g.append("line")
        .attr("x1", arrowX1)
        .attr("y1", arrowY)
        .attr("x2", arrowX1)
        .attr("y2", arrowY)
        .attr("stroke", "#0b1220")
        .attr("stroke-opacity", 0.7)
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#local-arrowhead)")
        .transition()
        .delay(i * 180 + 90)
        .duration(280)
        .attr("x2", arrowX2);
    }
  });

  // ----- Langfuse observer lane: shows telemetry tapping each stage -----
  const obsY = y + boxH + 22;
  const obsX1 = pad + boxW / 2;
  const obsX2 = pad + (stages.length - 1) * (boxW + 14) + boxW / 2;
  // Horizontal observer rail.
  g.append("line")
    .attr("x1", obsX1)
    .attr("y1", obsY)
    .attr("x2", obsX1)
    .attr("y2", obsY)
    .attr("stroke", "#0a3161")
    .attr("stroke-opacity", 0.55)
    .attr("stroke-width", 1.2)
    .attr("stroke-dasharray", "3 3")
    .transition()
    .delay(stages.length * 180 + 200)
    .duration(700)
    .attr("x2", obsX2);
  // Tap notch + dot per stage.
  stages.forEach((stage, i) => {
    const sx = pad + i * (boxW + 14) + boxW / 2;
    g.append("line")
      .attr("x1", sx)
      .attr("y1", y + boxH)
      .attr("x2", sx)
      .attr("y2", obsY)
      .attr("stroke", "#0a3161")
      .attr("stroke-opacity", 0.45)
      .attr("stroke-width", 0.8)
      .attr("opacity", 0)
      .transition()
      .delay(i * 180 + stages.length * 180 + 300)
      .duration(260)
      .attr("opacity", 1);
    g.append("circle")
      .attr("cx", sx)
      .attr("cy", obsY)
      .attr("r", 0)
      .attr("fill", "#0a3161")
      .transition()
      .delay(i * 180 + stages.length * 180 + 320)
      .duration(240)
      .attr("r", 2.6);
  });
  // Langfuse label.
  g.append("text")
    .attr("x", obsX1 - 8)
    .attr("y", obsY + 4)
    .attr("text-anchor", "end")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 10)
    .attr("font-weight", 600)
    .attr("fill", "#0a3161")
    .attr("opacity", 0)
    .text("Langfuse")
    .transition()
    .delay(stages.length * 180 + 600)
    .duration(300)
    .attr("opacity", 0.9);
  g.append("text")
    .attr("x", obsX2 + 8)
    .attr("y", obsY + 4)
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 9)
    .attr("fill", "#0a3161")
    .attr("opacity", 0)
    .text("traces · latency · tokens")
    .transition()
    .delay(stages.length * 180 + 700)
    .duration(300)
    .attr("opacity", 0.65);

  // "Local network · zero egress" boundary line.
  g.append("rect")
    .attr("x", 6)
    .attr("y", 6)
    .attr("width", w - 12)
    .attr("height", h - 12)
    .attr("rx", 10)
    .attr("fill", "none")
    .attr("stroke", "#0a3161")
    .attr("stroke-opacity", 0.35)
    .attr("stroke-dasharray", "6 4");

  g.append("text")
    .attr("x", w / 2)
    .attr("y", h - 8)
    .attr("text-anchor", "middle")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 10)
    .attr("fill", "#0a3161")
    .attr("opacity", 0.7)
    .text("· local network · zero egress ·");

  // Pulse along the flow.
  function spawnPulse() {
    const dot = g
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#0a3161")
      .attr("opacity", 0.95)
      .attr("cy", h / 2)
      .attr("cx", pad - 6);
    dot
      .transition()
      .duration(stages.length * 600)
      .ease(d3.easeLinear)
      .attr("cx", pad + stages.length * (boxW + 14) - 4)
      .attr("opacity", 0.1)
      .remove();
  }
  setTimeout(() => {
    spawnPulse();
    setInterval(spawnPulse, 2800);
  }, stages.length * 200);
})();

// ---------- Local-vs-cloud latency comparison · sourced from JSON ----------
(async function localLatency() {
  const svg = d3.select("#local-latency");
  if (svg.empty()) return;
  const node = svg.node();
  const rect = node.getBoundingClientRect();
  const margin = { top: 22, right: 56, bottom: 32, left: 92 };
  const w = rect.width - margin.left - margin.right;
  const h = rect.height - margin.top - margin.bottom;
  svg.attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

  // Pull real, attributed measurements from the JSON. Defaults to public
  // benchmark medians; can be overwritten by scripts/run_langfuse_export.py
  // pointing at the user's own Langfuse instance.
  let benchmark;
  try {
    benchmark = await fetch("assets/data/latency_benchmark.json").then((r) =>
      r.json()
    );
  } catch (err) {
    svg
      .append("text")
      .attr("x", rect.width / 2)
      .attr("y", rect.height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#b31942")
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 11)
      .text("· latency_benchmark.json not loaded ·");
    return;
  }

  const data = benchmark.datasets
    .map((d) => ({
      task: d.task,
      cloud: d.cloud?.value_ms,
      cloudSrc: d.cloud?.source,
      local: d.local?.value_ms,
      localSrc: d.local?.source,
    }))
    .filter((d) => d.cloud != null && d.local != null);

  // Surface the source label live on the page so visitors see provenance.
  const captionEl = document.getElementById("local-latency-caption");
  if (captionEl) {
    captionEl.textContent = benchmark.source_label || "";
  }

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const maxV = d3.max(data, (d) => Math.max(d.cloud, d.local)) * 1.1;
  const x = d3.scaleLinear().domain([0, maxV]).range([0, w]);
  const yTask = d3
    .scaleBand()
    .domain(data.map((d) => d.task))
    .range([0, h])
    .padding(0.4);

  const barH = yTask.bandwidth() / 2 - 2;

  // Helper: place bar value just past the bar, but clamp inside chart edge.
  const placeValueX = (barEndX) => Math.min(barEndX + 4, w + margin.right - 6);

  data.forEach((d) => {
    const yBase = yTask(d.task);
    // Cloud bar (top sub-row).
    root
      .append("rect")
      .attr("x", 0)
      .attr("y", yBase)
      .attr("width", 0)
      .attr("height", barH)
      .attr("fill", "#0b1220")
      .attr("opacity", 0.35)
      .attr("rx", 2)
      .transition()
      .duration(700)
      .attr("width", x(d.cloud));
    root
      .append("text")
      .attr("x", placeValueX(x(d.cloud)))
      .attr("y", yBase + barH * 0.75)
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 9)
      .attr("fill", "#0b1220")
      .attr("opacity", 0)
      .text(`${d.cloud}ms`)
      .transition()
      .delay(720)
      .duration(200)
      .attr("opacity", 0.65);

    // Local bar (bottom sub-row).
    root
      .append("rect")
      .attr("x", 0)
      .attr("y", yBase + barH + 4)
      .attr("width", 0)
      .attr("height", barH)
      .attr("fill", "#b31942")
      .attr("rx", 2)
      .transition()
      .delay(120)
      .duration(700)
      .attr("width", x(d.local));
    root
      .append("text")
      .attr("x", placeValueX(x(d.local)))
      .attr("y", yBase + barH + 4 + barH * 0.75)
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 9)
      .attr("fill", "#b31942")
      .attr("font-weight", 600)
      .attr("opacity", 0)
      .text(`${d.local}ms`)
      .transition()
      .delay(840)
      .duration(200)
      .attr("opacity", 1);

    // Task label, right-aligned in the left margin gutter.
    root
      .append("text")
      .attr("x", -10)
      .attr("y", yBase + yTask.bandwidth() / 2 + 3)
      .attr("text-anchor", "end")
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 10)
      .attr("font-weight", 500)
      .attr("fill", "#0b1220")
      .attr("opacity", 0.85)
      .text(d.task);
  });

  // Live provenance — the first source listed in the JSON gets watermarked.
  const sourceName =
    benchmark.sources && benchmark.sources.length
      ? benchmark.sources[0].name
      : "public benchmarks";
  root
    .append("text")
    .attr("x", w)
    .attr("y", -10)
    .attr("text-anchor", "end")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 8)
    .attr("fill", "#0b1220")
    .attr("opacity", 0.55)
    .text(`source · ${sourceName}`);

  // x-axis (ms).
  const axis = d3
    .axisBottom(x)
    .ticks(4)
    .tickFormat((d) => `${d}ms`);
  root
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .attr("color", "#0b122099")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 9)
    .call(axis)
    .call((g) => g.selectAll(".domain, line").attr("stroke", "#0b122044"));
})();

// ---------- Enterprise architecture flow: model → SageMaker → HNSW → API. ----------
(function architectureFlow() {
  const svg = d3.select("#enterprise-arch");
  if (svg.empty()) return;
  const node = svg.node();
  const rect = node.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  svg.attr("viewBox", `0 0 ${w} ${h}`);

  // Pipeline stages — kept abstract so it reads at any width.
  const stages = [
    { id: "clip", label: "CLIP", sub: "vit-base" },
    { id: "pkg", label: "tar.gz", sub: "→ S3" },
    { id: "sm", label: "SageMaker", sub: "endpoint" },
    { id: "embed", label: "embed", sub: "img · text" },
    { id: "hnsw", label: "HNSW", sub: "index" },
    { id: "api", label: "FastAPI", sub: "router" },
  ];

  const pad = 16;
  const boxW = (w - pad * 2) / stages.length - 14;
  const boxH = Math.min(72, h * 0.38);
  const y = h / 2 - boxH / 2;

  const g = svg.append("g");

  // Gradient between navy and ivory — feels enterprise-y.
  const defs = svg.append("defs");
  const grad = defs
    .append("linearGradient")
    .attr("id", "arch-grad")
    .attr("x1", "0%")
    .attr("x2", "100%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", "#0a3161");
  grad.append("stop").attr("offset", "100%").attr("stop-color", "#1e3a8a");

  // Arrows between boxes.
  defs
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,0 L10,5 L0,10 Z")
    .attr("fill", "#f5f2e8");

  stages.forEach((stage, i) => {
    const x = pad + i * (boxW + 14);
    const boxG = g
      .append("g")
      .attr("transform", `translate(${x}, ${y})`)
      .attr("opacity", 0)
      .attr("aria-label", stage.label);

    boxG
      .append("rect")
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("rx", 8)
      .attr("fill", "url(#arch-grad)")
      .attr("stroke", "#f5f2e8")
      .attr("stroke-opacity", 0.35);

    boxG
      .append("text")
      .attr("x", boxW / 2)
      .attr("y", boxH / 2 - 4)
      .attr("text-anchor", "middle")
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "#f5f2e8")
      .text(stage.label);
    boxG
      .append("text")
      .attr("x", boxW / 2)
      .attr("y", boxH / 2 + 14)
      .attr("text-anchor", "middle")
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 9)
      .attr("fill", "#f5f2e8")
      .attr("opacity", 0.7)
      .text(stage.sub);

    boxG
      .transition()
      .delay(i * 180)
      .duration(360)
      .attr("opacity", 1);

    if (i < stages.length - 1) {
      const arrowX1 = x + boxW + 2;
      const arrowX2 = x + boxW + 12;
      const arrowY = h / 2;
      g.append("line")
        .attr("x1", arrowX1)
        .attr("y1", arrowY)
        .attr("x2", arrowX1)
        .attr("y2", arrowY)
        .attr("stroke", "#f5f2e8")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)")
        .transition()
        .delay(i * 180 + 90)
        .duration(280)
        .attr("x2", arrowX2);
    }
  });

  // Pulse a "request" along the flow to hint at the live request path.
  const pulseRadius = 4;
  function spawnPulse() {
    const dot = g
      .append("circle")
      .attr("r", pulseRadius)
      .attr("fill", "#b31942")
      .attr("opacity", 0.9)
      .attr("cy", h / 2)
      .attr("cx", pad - 6);
    dot
      .transition()
      .duration(stages.length * 700)
      .ease(d3.easeLinear)
      .attr("cx", pad + stages.length * (boxW + 14) - 4)
      .attr("opacity", 0.1)
      .remove();
  }
  setTimeout(() => {
    spawnPulse();
    setInterval(spawnPulse, 3200);
  }, stages.length * 200);
})();

// ---------- Recall@K curve: pretrained vs fine-tuned. ----------
(function recallCurve() {
  const svg = d3.select("#recall-curve");
  if (svg.empty()) return;
  const node = svg.node();
  const rect = node.getBoundingClientRect();
  const margin = { top: 14, right: 12, bottom: 26, left: 32 };
  const w = rect.width - margin.left - margin.right;
  const h = rect.height - margin.top - margin.bottom;
  svg.attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

  // Synthetic but realistic Recall@K curves shaped to land ~+20% at K=10.
  const ks = [1, 2, 5, 10, 20, 50, 100];
  const baseline = ks.map((k) => 1 - Math.exp(-k / 18));            // ~0.05 / 0.10 / 0.24 / 0.43 / 0.67 / 0.94 / 0.997
  const tuned = ks.map((k, i) => Math.min(0.99, baseline[i] + (0.20 - 0.001 * (k - 10) ** 2 * 0.04)));

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLog().base(10).domain([1, 100]).range([0, w]);
  const y = d3.scaleLinear().domain([0, 1]).range([h, 0]);

  // Gridlines.
  root
    .append("g")
    .attr("color", "#f5f2e833")
    .call(d3.axisLeft(y).ticks(4).tickSize(-w).tickFormat(""));
  root.selectAll(".tick line").attr("stroke", "#f5f2e833");
  root.selectAll(".domain").remove();

  const line = d3
    .line()
    .x((_, i) => x(ks[i]))
    .y((d) => y(d))
    .curve(d3.curveMonotoneX);

  // Baseline.
  root
    .append("path")
    .attr("d", line(baseline))
    .attr("fill", "none")
    .attr("stroke", "#f5f2e8")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 1.8)
    .attr("stroke-dasharray", "4 3");

  // Tuned.
  const tunedPath = root
    .append("path")
    .attr("d", line(tuned))
    .attr("fill", "none")
    .attr("stroke", "#b31942")
    .attr("stroke-width", 2.4);

  const totalLength = tunedPath.node().getTotalLength();
  tunedPath
    .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .duration(900)
    .delay(300)
    .attr("stroke-dashoffset", 0);

  // Highlight the +20% delta at K=10.
  const k10x = x(10);
  root
    .append("line")
    .attr("x1", k10x)
    .attr("x2", k10x)
    .attr("y1", y(baseline[3]))
    .attr("y2", y(tuned[3]))
    .attr("stroke", "#b31942")
    .attr("stroke-width", 1.4)
    .attr("opacity", 0)
    .transition()
    .delay(1200)
    .duration(300)
    .attr("opacity", 0.9);
  root
    .append("text")
    .attr("x", k10x + 6)
    .attr("y", y((baseline[3] + tuned[3]) / 2) + 3)
    .attr("fill", "#b31942")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 10)
    .attr("font-weight", 600)
    .attr("opacity", 0)
    .text("+20% @ K=10")
    .transition()
    .delay(1300)
    .duration(300)
    .attr("opacity", 1);

  // Axes.
  const xAxis = d3
    .axisBottom(x)
    .tickValues([1, 5, 10, 50, 100])
    .tickFormat((d) => `K=${d}`);
  root
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .attr("color", "#f5f2e8aa")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 9)
    .call(xAxis)
    .call((g) => g.selectAll(".domain, line").attr("stroke", "#f5f2e855"));

  const yAxis = d3.axisLeft(y).ticks(4).tickFormat(d3.format(".0%"));
  root
    .append("g")
    .attr("color", "#f5f2e8aa")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 9)
    .call(yAxis)
    .call((g) => g.selectAll(".domain, line").attr("stroke", "#f5f2e855"));

  root
    .append("text")
    .attr("x", w)
    .attr("y", h + margin.bottom - 4)
    .attr("text-anchor", "end")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 9)
    .attr("fill", "#f5f2e8aa")
    .text("retrieved · K");
  root
    .append("text")
    .attr("x", 0)
    .attr("y", -4)
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 9)
    .attr("fill", "#f5f2e8aa")
    .text("Recall");
})();

// ---------- Tensor network: proper open-leg graph with animated contractions. ----------
(function tensorGraph() {
  const svg = d3.select("#tensor-graph");
  if (svg.empty()) return;

  const node = svg.node();
  const rect = node.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  svg.attr("viewBox", `0 0 ${w} ${h}`);

  // ---------- Build the initial network. ----------
  // We model a peaked circuit as: 8 open legs (qubits) along the bottom feed
  // into a layered fabric of single- and two-qubit tensors. After contraction
  // it collapses to a small handful of high-rank tensors — which is the
  // point of the BlueQubit / cotengra technique.
  const N_QUBITS = 8;
  const N_LAYERS = 4;

  const baseNodes = [];
  const baseLinks = [];

  // Open-leg input nodes (bottom row).
  for (let q = 0; q < N_QUBITS; q++) {
    baseNodes.push({
      id: `in${q}`,
      kind: "leg",
      label: `q${q}`,
      fx: 60 + ((w - 120) / (N_QUBITS - 1)) * q,
      fy: h - 28,
    });
  }
  // Open-leg output nodes (top row, measurement).
  for (let q = 0; q < N_QUBITS; q++) {
    baseNodes.push({
      id: `out${q}`,
      kind: "leg",
      label: "⟨z⟩",
      fx: 60 + ((w - 120) / (N_QUBITS - 1)) * q,
      fy: 28,
    });
  }

  // Internal tensor nodes, organized in N_LAYERS layers.
  const innerByLayer = [];
  for (let L = 0; L < N_LAYERS; L++) {
    const row = [];
    const layerY = h - 28 - ((L + 1) * (h - 56)) / (N_LAYERS + 1);
    for (let q = 0; q < N_QUBITS; q++) {
      row.push({
        id: `t${L}_${q}`,
        kind: "tensor",
        layer: L,
        // bond dimension carries weight semantics for line thickness
        weight: 1,
      });
    }
    // Add ~3 entangler tensors per layer between random adjacent qubits.
    for (let i = 0; i < 3; i++) {
      const q = Math.floor(Math.random() * (N_QUBITS - 1));
      const layerY2 = layerY + (Math.random() - 0.5) * 12;
      row.push({
        id: `e${L}_${i}`,
        kind: "entangler",
        layer: L,
        weight: 1,
      });
    }
    innerByLayer.push(row);
  }
  for (const row of innerByLayer) baseNodes.push(...row);

  // Wire qubit rails through every layer.
  for (let q = 0; q < N_QUBITS; q++) {
    let prev = `in${q}`;
    for (let L = 0; L < N_LAYERS; L++) {
      baseLinks.push({ source: prev, target: `t${L}_${q}`, weight: 1 });
      prev = `t${L}_${q}`;
    }
    baseLinks.push({ source: prev, target: `out${q}`, weight: 1 });
  }
  // Wire entanglers to their nearest neighboring rails.
  innerByLayer.forEach((row, L) => {
    const entanglers = row.filter((n) => n.kind === "entangler");
    entanglers.forEach((e, i) => {
      const q = (i * 2 + L) % (N_QUBITS - 1);
      baseLinks.push({ source: `t${L}_${q}`, target: e.id, weight: 1 });
      baseLinks.push({ source: e.id, target: `t${L}_${q + 1}`, weight: 1 });
    });
  });

  // ---------- Active mutable copies used through contraction cycles. ----------
  let nodes = baseNodes.map((n) => ({ ...n }));
  let links = baseLinks.map((l) => ({ ...l }));

  const colorFor = (n) => {
    if (n.kind === "leg") return "#f5f2e8";
    if (n.kind === "entangler") return "#b31942";
    if (n.kind === "merged") return "#fbbf24";
    return "#9bb6ff";
  };
  const radiusFor = (n) => {
    if (n.kind === "leg") return 3.5;
    if (n.kind === "entangler") return 5;
    if (n.kind === "merged") return 6 + Math.min(8, n.weight * 1.5);
    return 4 + Math.min(6, (n.weight || 1) * 0.6);
  };
  const strokeWidthFor = (l) => Math.min(4, 0.9 + (l.weight - 1) * 0.7);

  // ---------- Rendering layers. ----------
  const linkLayer = svg.append("g").attr("stroke", "#a8c0ff").attr("stroke-opacity", 0.55);
  const nodeLayer = svg.append("g");
  const labelLayer = svg
    .append("g")
    .attr("font-family", "ui-monospace, Menlo, monospace")
    .attr("font-size", 9)
    .attr("fill", "#f5f2e8")
    .attr("opacity", 0.55);

  let sim;
  function bind() {
    // Resolve link endpoints to current node references each time we rebuild.
    const byId = new Map(nodes.map((n) => [n.id, n]));
    links = links
      .map((l) => ({
        source: byId.get(typeof l.source === "object" ? l.source.id : l.source),
        target: byId.get(typeof l.target === "object" ? l.target.id : l.target),
        weight: l.weight || 1,
      }))
      .filter((l) => l.source && l.target && l.source !== l.target);

    const lineSel = linkLayer.selectAll("line").data(links, (d, i) => i);
    lineSel.exit().transition().duration(400).attr("stroke-opacity", 0).remove();
    const lineEnter = lineSel
      .enter()
      .append("line")
      .attr("stroke-opacity", 0);
    const lineMerged = lineEnter.merge(lineSel);
    lineMerged
      .transition()
      .duration(500)
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", strokeWidthFor);

    const dotSel = nodeLayer
      .selectAll("circle")
      .data(nodes, (d) => d.id);
    dotSel.exit().transition().duration(400).attr("r", 0).style("opacity", 0).remove();
    const dotEnter = dotSel
      .enter()
      .append("circle")
      .attr("r", 0)
      .attr("fill", colorFor)
      .attr("stroke", "#0a3161")
      .attr("stroke-width", 0.8);
    dotEnter.merge(dotSel)
      .transition()
      .duration(500)
      .attr("r", radiusFor)
      .attr("fill", colorFor);

    const labelSel = labelLayer
      .selectAll("text")
      .data(nodes.filter((n) => n.kind === "leg"), (d) => d.id);
    labelSel.exit().remove();
    const labelEnter = labelSel
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.fy > h / 2 ? 16 : -8))
      .text((d) => d.label);
    labelEnter.merge(labelSel);

    if (sim) sim.stop();
    sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink(links).distance((d) => 32 / Math.max(1, d.weight * 0.5)).strength(0.55)
      )
      .force("charge", d3.forceManyBody().strength((d) => (d.kind === "merged" ? -120 : -50)))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.02))
      .alpha(0.85)
      .on("tick", () => {
        lineMerged
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        nodeLayer
          .selectAll("circle")
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y);
        labelLayer
          .selectAll("text")
          .attr("x", (d) => d.x)
          .attr("y", (d) => d.y);
      });

    dotEnter.merge(dotSel).call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          // Keep boundary legs pinned, release internals.
          if (d.kind !== "leg") {
            d.fx = null;
            d.fy = null;
          }
        })
    );
  }
  bind();

  // ---------- Contraction step: pick an internal-internal edge, merge it. ----------
  function contractStep() {
    const candidates = links.filter(
      (l) => l.source.kind !== "leg" && l.target.kind !== "leg"
    );
    if (candidates.length === 0) return false;
    // Prefer the highest-bond edge — that's where contraction matters.
    candidates.sort((a, b) => b.weight - a.weight);
    const edge = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];

    const survivor = edge.source;
    const absorbed = edge.target;

    // Flash the pair before merging.
    nodeLayer
      .selectAll("circle")
      .filter((d) => d === survivor || d === absorbed)
      .transition()
      .duration(280)
      .attr("fill", "#fbbf24");

    setTimeout(() => {
      survivor.kind = "merged";
      survivor.weight = (survivor.weight || 1) + (absorbed.weight || 1);
      // Redirect every edge that touched the absorbed node onto the survivor.
      const newLinks = [];
      const seen = new Map();
      for (const l of links) {
        if (l === edge) continue;
        let s = l.source === absorbed ? survivor : l.source;
        let t = l.target === absorbed ? survivor : l.target;
        if (s === t) continue;
        const key = s.id < t.id ? `${s.id}|${t.id}` : `${t.id}|${s.id}`;
        if (seen.has(key)) {
          seen.get(key).weight += l.weight;
        } else {
          const nl = { source: s, target: t, weight: l.weight };
          seen.set(key, nl);
          newLinks.push(nl);
        }
      }
      links = newLinks;
      nodes = nodes.filter((n) => n !== absorbed);
      bind();
    }, 320);
    return true;
  }

  // ---------- Status ticker shows the simplification sequence. ----------
  let stepCount = 0;
  const stages = ["raw graph", "A · antidiagonal", "D · diagonal", "C · column", "R · rank", "S · split"];
  function setStatus(text) {
    let t = svg.select("text#tn-status");
    if (t.empty()) {
      t = svg
        .append("text")
        .attr("id", "tn-status")
        .attr("x", 14)
        .attr("y", 22)
        .attr("font-family", "ui-monospace, Menlo, monospace")
        .attr("font-size", 11)
        .attr("fill", "#f5f2e8")
        .attr("opacity", 0.75);
    }
    t.text(text);
  }
  setStatus("· raw tensor network · 8 qubits × 4 layers");

  // Periodically contract; when only a handful of internal nodes remain, reset.
  const tick = () => {
    const internalCount = nodes.filter((n) => n.kind !== "leg").length;
    if (internalCount <= 3) {
      // Reset back to the raw graph and start over.
      setStatus("· resetting · ADCRS cycle complete");
      setTimeout(() => {
        nodes = baseNodes.map((n) => ({ ...n }));
        links = baseLinks.map((l) => ({ ...l }));
        stepCount = 0;
        bind();
        setStatus("· raw tensor network · 8 qubits × 4 layers");
      }, 1400);
    } else {
      contractStep();
      stepCount = (stepCount + 1) % stages.length;
      setStatus(`· contracting · ${stages[Math.min(stepCount, stages.length - 1)]}`);
    }
  };
  setTimeout(() => {
    tick();
    setInterval(tick, 2400);
  }, 1500);
})();

// ---------- VisionSearch embedding space: query → top-5 nearest neighbors. ----------
(function embeddingSpace() {
  const svg = d3.select("#embedding-space");
  if (svg.empty()) return;
  const captionEl = document.getElementById("embedding-space-caption");

  const node = svg.node();
  const rect = node.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  svg.attr("viewBox", `0 0 ${w} ${h}`);

  // Generate ~120 synthetic embedding points in 4 latent classes, each
  // clustered around a center with some spread. The classes loosely stand in
  // for "vehicles · animals · outdoors · food" — labels only used for the
  // synthetic query captions.
  const classes = [
    { name: "vehicles", cx: 0.22, cy: 0.30, color: "#f5f2e8" },
    { name: "animals",  cx: 0.75, cy: 0.28, color: "#fbbf24" },
    { name: "outdoors", cx: 0.28, cy: 0.78, color: "#a8c0ff" },
    { name: "food",     cx: 0.78, cy: 0.78, color: "#b31942" },
  ];
  const sampleCaptions = {
    vehicles: ["red sedan on a wet street", "vintage motorcycle, side view", "city bus at dusk"],
    animals:  ["golden retriever in a yard", "barn owl, close up", "tabby cat on a windowsill"],
    outdoors: ["pine forest at sunrise", "snowy mountain ridge", "field of wildflowers"],
    food:     ["bowl of ramen, overhead", "espresso shot, crema", "stack of pancakes with syrup"],
  };

  // Random in [-1, 1] gaussian-ish via box-muller-lite.
  function jitter(scale) {
    return (Math.random() + Math.random() + Math.random() - 1.5) * scale;
  }

  const points = [];
  const perClass = 30;
  classes.forEach((c, ci) => {
    for (let i = 0; i < perClass; i++) {
      points.push({
        id: `${ci}_${i}`,
        cls: ci,
        x: (c.cx + jitter(0.06)) * w,
        y: (c.cy + jitter(0.06)) * h,
      });
    }
  });

  // Cluster label whispers, very faint. Clamp y to stay inside the SVG.
  const labelLayer = svg.append("g");
  classes.forEach((c) => {
    const labelX = Math.max(40, Math.min(w - 40, c.cx * w));
    const labelY = Math.max(14, Math.min(h - 8, c.cy * h - 56));
    labelLayer
      .append("text")
      .attr("x", labelX)
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .attr("font-family", "ui-monospace, Menlo, monospace")
      .attr("font-size", 10)
      .attr("fill", c.color)
      .attr("opacity", 0.5)
      .text(`· ${c.name} ·`);
  });

  const pointLayer = svg.append("g");
  const dot = pointLayer
    .selectAll("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", 3)
    .attr("fill", (d) => classes[d.cls].color)
    .attr("opacity", 0.65)
    .attr("stroke", "#0a3161")
    .attr("stroke-width", 0.4);

  const arcLayer = svg.append("g");

  // Query node sits on top.
  const query = svg
    .append("circle")
    .attr("r", 7)
    .attr("fill", "#b31942")
    .attr("stroke", "#f5f2e8")
    .attr("stroke-width", 2)
    .attr("cx", w / 2)
    .attr("cy", h / 2);

  function nextQuery() {
    const cls = classes[Math.floor(Math.random() * classes.length)];
    const captions = sampleCaptions[cls.name];
    const caption = captions[Math.floor(Math.random() * captions.length)];
    // Place the query somewhere near (but not exactly at) the chosen cluster.
    const qx = (cls.cx + jitter(0.10)) * w;
    const qy = (cls.cy + jitter(0.10)) * h;

    // Compute Euclidean k-NN for top-5.
    const scored = points
      .map((p) => ({ p, d: Math.hypot(p.x - qx, p.y - qy) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);

    // Reset previous highlight.
    dot
      .transition()
      .duration(400)
      .attr("r", 3)
      .attr("opacity", 0.65);

    arcLayer.selectAll("line").remove();

    query
      .transition()
      .duration(700)
      .ease(d3.easeCubicInOut)
      .attr("cx", qx)
      .attr("cy", qy);

    // Highlight neighbors + draw arcs after the query moves.
    setTimeout(() => {
      const ids = new Set(scored.map((s) => s.p.id));
      dot
        .filter((d) => ids.has(d.id))
        .transition()
        .duration(420)
        .attr("r", 6)
        .attr("opacity", 1);

      scored.forEach((s, idx) => {
        arcLayer
          .append("line")
          .attr("x1", qx)
          .attr("y1", qy)
          .attr("x2", qx)
          .attr("y2", qy)
          .attr("stroke", "#b31942")
          .attr("stroke-width", 1.2)
          .attr("opacity", 0.7 - idx * 0.1)
          .transition()
          .duration(420)
          .attr("x2", s.p.x)
          .attr("y2", s.p.y);
      });
    }, 720);

    if (captionEl) {
      captionEl.textContent = `query · "${caption}" → 5 nearest matches (highlighted)`;
    }
  }

  // First run after layout settles, then loop.
  setTimeout(() => {
    nextQuery();
    setInterval(nextQuery, 3400);
  }, 600);
})();
