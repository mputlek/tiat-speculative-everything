(function () {
  const config = window.FUNGUY_CONFIG;
  const statusEl = document.getElementById('status');
  const stageEl = document.getElementById('stage');
  const fillEl = document.getElementById('healthBarFill');
  const countEl = document.getElementById('healthCount');

  if (!config || !config.ABLY_API_KEY || config.ABLY_API_KEY === 'YOUR_ABLY_API_KEY_HERE') {
    statusEl.textContent = 'not configured — see shared/config.template.js';
    statusEl.className = 'status error';
    return;
  }

  const STORAGE_KEY = 'funguy-health-state';
  const HEALTH_MAX = config.HEALTH_MAX || 100;

  // --- persisted state (survives page reload on the kiosk machine) -------
  let state = { healthValue: 0, messageCount: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.healthValue === 'number') state = saved;
  } catch (e) {
    /* ignore corrupt storage */
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // --- Animal Crossing-inspired palette: color lerp + bar + stage label --
  // Dormant: muted dusty pastel (dim, not dead). Thriving: saturated mint.
  // The atmosphere lerps separately toward a soft lavender-pink glow rather
  // than mirroring the surface color, per the warm/pastel direction (no
  // cold sci-fi blue). This is still a stand-in for the mycelium
  // thread/bioluminescence treatment planned later.
  const DORMANT_COLOR = [168, 161, 144]; // #a8a190 dusty sage-taupe
  const THRIVING_COLOR = [79, 209, 165]; // #4fd1a5 saturated mint

  const ATMOSPHERE_DORMANT = [216, 207, 197]; // #d8cfc5 barely-there warm glow
  const ATMOSPHERE_THRIVING = [232, 184, 222]; // #e8b8de soft lavender-pink

  // Land color only — ocean stays a fixed blue regardless of health (see
  // generateGlobeTexture below). Bare/damaged brown regrows into forest
  // green as the mycelium network spreads.
  const LAND_DORMANT = [180, 140, 100]; // #b48c64 bare warm brown
  const LAND_THRIVING = [100, 180, 120]; // #64b478 soft forest green

  function lerpColor(a, b, t) {
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function stageForHealth(h) {
    if (h < 34) return 'Dormant';
    if (h < 67) return 'Awakening';
    return 'Thriving';
  }

  // Procedurally generated placeholder surface texture: fixed ocean (blue)
  // + landmass shapes whose fill color lerps brown -> green as healthValue
  // rises, standing in for forests regrowing on the land. The landmass
  // *shape* (landBlobs, built once below) never changes — only the fill
  // color is redrawn — so regenerating the texture as health changes
  // doesn't make continents visibly jitter/reshuffle.
  const TEXTURE_WIDTH = 1024;
  const TEXTURE_HEIGHT = 512;
  const OCEAN_COLOR = '#8fc7e8';

  // Loose, made-up continent positions (not geographically precise) purely
  // to give the globe a recognizable "this is Earth" silhouette until real
  // art replaces this.
  const CONTINENT_SEEDS = [
    { lat: 45, lng: -100 }, // North America
    { lat: -15, lng: -60 }, // South America
    { lat: 50, lng: 15 }, // Europe
    { lat: 5, lng: 20 }, // Africa
    { lat: 45, lng: 90 }, // Asia
    { lat: -25, lng: 135 }, // Australia
  ];

  function latLngToXY(lat, lng, width, height) {
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return { x, y };
  }

  function buildLandBlobs() {
    const blobs = [];
    CONTINENT_SEEDS.forEach(({ lat, lng }) => {
      const { x, y } = latLngToXY(lat, lng, TEXTURE_WIDTH, TEXTURE_HEIGHT);
      const blobCount = 7 + Math.floor(Math.random() * 4);
      for (let i = 0; i < blobCount; i++) {
        blobs.push({
          x: x + (Math.random() - 0.5) * 90,
          y: y + (Math.random() - 0.5) * 60,
          r: 25 + Math.random() * 35,
        });
      }
    });
    return blobs;
  }

  // Built once at load — this is the fixed "coastline" shape.
  const landBlobs = buildLandBlobs();

  function generateGlobeTexture(landColor) {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_WIDTH;
    canvas.height = TEXTURE_HEIGHT;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = OCEAN_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = landColor;
    landBlobs.forEach(({ x, y, r }) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    return canvas.toDataURL('image/png');
  }

  // --- mycelium thread network ---------------------------------------
  // A fixed set of scattered growth points connected into a small
  // nearest-neighbor graph, revealed progressively — growing outward via
  // BFS order from a single seed point, like a real colony spreading —
  // as healthValue rises. Stands in for real visitor-message origins
  // until that data exists (open decision, not yet resolved). Rendered
  // as Globe.gl arcs below.
  const MYCELIUM_NODE_COUNT = 50;
  const MYCELIUM_NEIGHBORS_PER_NODE = 3;

  function randomPointOnSphere() {
    // Uniform distribution over the sphere surface (avoids pole clustering
    // that plain random lat would cause).
    const lat = (Math.asin(Math.random() * 2 - 1) * 180) / Math.PI;
    const lng = Math.random() * 360 - 180;
    return { lat, lng };
  }

  function angularDistance(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function buildMyceliumNetwork() {
    const nodes = Array.from({ length: MYCELIUM_NODE_COUNT }, randomPointOnSphere);

    // Connect each node to its nearest few neighbors, deduped.
    const edgeSet = new Set();
    const edges = [];
    nodes.forEach((node, i) => {
      const nearest = nodes
        .map((other, j) => ({ j, d: i === j ? Infinity : angularDistance(node, other) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, MYCELIUM_NEIGHBORS_PER_NODE);

      nearest.forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ a: i, b: j });
        }
      });
    });

    // BFS outward from one random seed node, so the network reveals as a
    // single spreading colony rather than edges popping in at
    // disconnected random spots.
    const adjacency = nodes.map(() => []);
    edges.forEach((edge, idx) => {
      adjacency[edge.a].push({ to: edge.b, edgeIdx: idx });
      adjacency[edge.b].push({ to: edge.a, edgeIdx: idx });
    });

    const seed = Math.floor(Math.random() * nodes.length);
    const visited = new Set([seed]);
    const queue = [seed];
    const edgeGeneration = new Array(edges.length).fill(Infinity);
    let generation = 0;
    while (queue.length) {
      const levelSize = queue.length;
      generation += 1;
      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift();
        adjacency[current].forEach(({ to, edgeIdx }) => {
          if (edgeGeneration[edgeIdx] === Infinity) {
            edgeGeneration[edgeIdx] = generation;
          }
          if (!visited.has(to)) {
            visited.add(to);
            queue.push(to);
          }
        });
      }
    }

    return edges
      .map((edge, idx) => ({ edge, generation: edgeGeneration[idx] }))
      .sort((a, b) => a.generation - b.generation)
      .map(({ edge }) => ({
        startLat: nodes[edge.a].lat,
        startLng: nodes[edge.a].lng,
        endLat: nodes[edge.b].lat,
        endLng: nodes[edge.b].lng,
      }));
  }

  const myceliumEdges = buildMyceliumNetwork();

  function lerpColorAlpha(a, b, t, alphaMin, alphaMax) {
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const alpha = alphaMin + (alphaMax - alphaMin) * t;
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(2)})`;
  }

  function render() {
    const t = state.healthValue / HEALTH_MAX;
    const color = lerpColor(DORMANT_COLOR, THRIVING_COLOR, t);

    // DOM elements only — the health bar's own CSS transition already
    // smooths width/color changes. The 3D globe's color/glow are eased
    // continuously in the animateGlobe() loop below instead, since
    // three.js Color.set() has no built-in transition of its own.
    fillEl.style.width = `${state.healthValue}%`;
    fillEl.style.backgroundColor = color;
    stageEl.textContent = stageForHealth(state.healthValue);
    countEl.textContent = `${state.messageCount} message${state.messageCount === 1 ? '' : 's'} received`;
  }

  function onMessageReceived() {
    state.messageCount += 1;
    state.healthValue = Math.min(HEALTH_MAX, state.healthValue + (config.HEALTH_INCREMENT || 2));
    saveState();
    render();
  }

  // --- globe (placeholder procedural texture; mycelium threads below) -----
  const initialLandColor = lerpColor(LAND_DORMANT, LAND_THRIVING, state.healthValue / HEALTH_MAX);
  const globe = Globe()(document.getElementById('globeViz'))
    .globeImageUrl(generateGlobeTexture(initialLandColor))
    .backgroundColor('#f3e6eb')
    .showAtmosphere(true)
    .arcAltitude(0.05)
    .arcDashLength(0.4)
    .arcDashGap(0.3)
    .arcDashAnimateTime(5000);

  // White so the globe material doesn't tint the texture — three.js
  // multiplies map texture x material color, and generateGlobeTexture()
  // already encodes final land/ocean colors directly, so anything other
  // than white here would wash out the ocean's blue.
  globe.globeMaterial().color.set('#ffffff');

  // Slow ambient auto-rotate so the display reads as alive even when no
  // visitor is touching it — living-system pacing, not a static image.
  // Visitors can still drag to spin manually; OrbitControls pauses
  // auto-rotate during that interaction and resumes after.
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 1.2;

  // Continuously eases the atmosphere glow toward healthValue's target
  // (rather than snapping on each message) and adds a slow idle
  // "breathing" pulse to its altitude — living-system pacing, not a
  // static image or a tech-style instant jump. The globe's land texture is
  // regenerated on the same easing curve, just throttled (see textureBucket
  // below) since redrawing a canvas is far more expensive than a color set.
  const BASE_ATMOSPHERE_ALTITUDE = 0.2;
  const PULSE_AMPLITUDE = 0.02;
  const PULSE_PERIOD_MS = 6000;
  const ARC_COLOR_DIM = [168, 161, 144]; // matches dormant surface tone
  const ARC_COLOR_GLOW = [130, 255, 210]; // vivid bright mint glow
  const TEXTURE_STEPS = 20; // 5% granularity
  let currentT = state.healthValue / HEALTH_MAX;
  let lastRevealCount = -1;
  let lastTextureBucket = Math.floor(currentT * TEXTURE_STEPS);

  function animateGlobe() {
    const targetT = state.healthValue / HEALTH_MAX;
    currentT += (targetT - currentT) * 0.02;

    const atmosphereColor = lerpColor(ATMOSPHERE_DORMANT, ATMOSPHERE_THRIVING, currentT);
    const pulse = Math.sin((performance.now() / PULSE_PERIOD_MS) * 2 * Math.PI) * PULSE_AMPLITUDE;

    globe.atmosphereColor(atmosphereColor);
    globe.atmosphereAltitude(BASE_ATMOSPHERE_ALTITUDE + pulse);

    // Regrow forests on the land as health rises — regenerate the texture
    // only when currentT crosses a new 5% step, not every frame.
    const textureBucket = Math.floor(currentT * TEXTURE_STEPS);
    if (textureBucket !== lastTextureBucket) {
      lastTextureBucket = textureBucket;
      const landColor = lerpColor(LAND_DORMANT, LAND_THRIVING, currentT);
      globe.globeImageUrl(generateGlobeTexture(landColor));
    }

    // Reveal threads gradually as currentT eases upward — sparse/no
    // network at Dormant, fully spread at Thriving. Only touch arcsData
    // when the revealed count actually changes, so we're not rebuilding
    // Globe.gl's arc meshes every animation frame.
    const revealCount = Math.floor(currentT * myceliumEdges.length);
    if (revealCount !== lastRevealCount) {
      lastRevealCount = revealCount;
      globe.arcsData(myceliumEdges.slice(0, revealCount));
    }
    globe.arcColor(() => lerpColorAlpha(ARC_COLOR_DIM, ARC_COLOR_GLOW, currentT, 0.35, 0.95));
    globe.arcStroke(0.15 + currentT * 0.35);

    requestAnimationFrame(animateGlobe);
  }
  animateGlobe();

  render();

  // --- ably -----------------------------------------------------------
  const ably = new Ably.Realtime({ key: config.ABLY_API_KEY, clientId: 'globe-display' });
  const channel = ably.channels.get(config.CHANNEL_NAME);

  ably.connection.on('connected', () => {
    statusEl.textContent = 'connected';
    statusEl.className = 'status connected';
  });
  ably.connection.on('disconnected', () => {
    statusEl.textContent = 'disconnected — reconnecting…';
    statusEl.className = 'status';
  });
  ably.connection.on('failed', () => {
    statusEl.textContent = 'connection failed — check config/network';
    statusEl.className = 'status error';
  });

  channel.subscribe('message', (msg) => {
    console.log('Received message from mycelium visitor:', msg.data);
    onMessageReceived();
  });
})();
