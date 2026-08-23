(async function () {
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

  function stageForHealth(h) {
    if (h < 34) return 'Dormant';
    if (h < 67) return 'Awakening';
    return 'Thriving';
  }

  // Health bar fill color lives here (not inside setUpGlobe below) so it
  // keeps working even if the globe's texture/canvas setup fails.
  const DORMANT_COLOR = [168, 161, 144]; // dusty sage-taupe
  const THRIVING_COLOR = [79, 209, 165]; // saturated mint

  function lerpColor(a, b, t) {
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function render() {
    const color = lerpColor(DORMANT_COLOR, THRIVING_COLOR, state.healthValue / HEALTH_MAX);
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

  render();

  // --- ably -------------------------------------------------------------
  // Connects immediately, independent of everything below — the core
  // message pipeline must keep working even if the globe's visuals
  // (texture loading, canvas processing) fail for any reason.
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

  // --- globe visuals ------------------------------------------------------
  // Everything below is best-effort: if texture loading or canvas
  // processing throws for any reason, we fall back to a plain placeholder
  // globe rather than taking down the page (and with it, Ably/messaging).
  try {
    await setUpGlobe();
  } catch (err) {
    console.error('Globe visuals failed to initialize, falling back:', err);
  }

  async function setUpGlobe() {
    // Health-driven palette: atmosphere + mycelium arc glow. Beige page
    // background/aqua ocean per current design direction.
    const ATMOSPHERE_DORMANT = [216, 207, 197]; // barely-there warm glow
    const ATMOSPHERE_THRIVING = [130, 220, 225]; // aqua glow

    function lerpColor(a, b, t) {
      const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }

    function lerpColorAlpha(a, b, t, alphaMin, alphaMax) {
      const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
      const alpha = alphaMin + (alphaMax - alphaMin) * t;
      return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(2)})`;
    }

    // --- realistic Earth texture, ocean recolored toward aqua -----------
    // Real photographic Earth (three-globe's bundled Blue Marble asset) +
    // terrain bump map, desaturated toward Dormant / full color toward
    // Thriving, ocean pixels tinted toward a sky-blue/aqua target (Blue
    // Marble's ocean is a duller navy by default), soft cloud wisps
    // composited into the same canvas. Regenerated only on a 5% health
    // step, not every animation frame.
    const TEXTURE_WIDTH = 1024;
    const TEXTURE_HEIGHT = 512;
    const EARTH_IMAGE_URL = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
    const BUMP_IMAGE_URL = '//unpkg.com/three-globe/example/img/earth-topology.png';
    const OCEAN_TARGET = [110, 220, 225]; // aqua/turquoise
    const OCEAN_BLEND = 0.6;

    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }

    function tintOceanTowardAqua(ctx, width, height) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Ocean in Blue Marble-style imagery is a clear blue-dominant
        // pixel; this threshold avoids catching white/grey ice or clouds.
        const isOcean = b - r > 15 && b - g > 10;
        if (isOcean) {
          data[i] = Math.round(r + (OCEAN_TARGET[0] - r) * OCEAN_BLEND);
          data[i + 1] = Math.round(g + (OCEAN_TARGET[1] - g) * OCEAN_BLEND);
          data[i + 2] = Math.round(b + (OCEAN_TARGET[2] - b) * OCEAN_BLEND);
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    function buildCloudBlobs() {
      const blobs = [];
      const cloudCount = 30;
      for (let i = 0; i < cloudCount; i++) {
        blobs.push({
          x: Math.random() * TEXTURE_WIDTH,
          y: Math.random() * TEXTURE_HEIGHT,
          r: 30 + Math.random() * 70,
        });
      }
      return blobs;
    }

    // Built once — fixed cloud shapes, so regenerating the texture doesn't
    // make clouds visibly jump around.
    const cloudBlobs = buildCloudBlobs();

    function generateGlobeTexture(earthImage, t) {
      const canvas = document.createElement('canvas');
      canvas.width = TEXTURE_WIDTH;
      canvas.height = TEXTURE_HEIGHT;
      const ctx = canvas.getContext('2d');

      // Damaged (t=0): desaturated and dim. Healed (t=1): full vivid color.
      const saturation = 20 + t * 80;
      const brightness = 70 + t * 30;
      ctx.filter = `saturate(${saturation}%) brightness(${brightness}%)`;
      ctx.drawImage(earthImage, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      tintOceanTowardAqua(ctx, canvas.width, canvas.height);

      const cloudOpacity = 0.45;
      cloudBlobs.forEach(({ x, y, r }) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${cloudOpacity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      return canvas.toDataURL('image/jpeg', 0.85);
    }

    // --- mycelium thread network ------------------------------------
    const MYCELIUM_NODE_COUNT = 50;
    const MYCELIUM_NEIGHBORS_PER_NODE = 3;

    function randomPointOnSphere() {
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

    // --- build the globe --------------------------------------------
    const earthBaseImage = await loadImage(EARTH_IMAGE_URL);
    const initialT = state.healthValue / HEALTH_MAX;

    const globe = Globe()(document.getElementById('globeViz'))
      .globeImageUrl(generateGlobeTexture(earthBaseImage, initialT))
      .bumpImageUrl(BUMP_IMAGE_URL)
      .bumpScale(10)
      .backgroundColor('#f3e6eb')
      .showAtmosphere(true)
      .arcAltitude(0.05)
      .arcDashLength(0.4)
      .arcDashGap(0.3)
      .arcDashAnimateTime(5000);

    globe.globeMaterial().color.set('#ffffff');

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 1.2;

    const BASE_ATMOSPHERE_ALTITUDE = 0.2;
    const PULSE_AMPLITUDE = 0.02;
    const PULSE_PERIOD_MS = 6000;
    const ARC_COLOR_DIM = [140, 150, 158];
    const ARC_COLOR_GLOW = [130, 255, 210];
    const TEXTURE_STEPS = 20; // 5% granularity
    let currentT = initialT;
    let lastRevealCount = -1;
    let lastTextureBucket = Math.floor(currentT * TEXTURE_STEPS);

    function animateGlobe() {
      const targetT = state.healthValue / HEALTH_MAX;
      currentT += (targetT - currentT) * 0.02;

      const atmosphereColor = lerpColor(ATMOSPHERE_DORMANT, ATMOSPHERE_THRIVING, currentT);
      const pulse = Math.sin((performance.now() / PULSE_PERIOD_MS) * 2 * Math.PI) * PULSE_AMPLITUDE;

      globe.atmosphereColor(atmosphereColor);
      globe.atmosphereAltitude(BASE_ATMOSPHERE_ALTITUDE + pulse);

      const textureBucket = Math.floor(currentT * TEXTURE_STEPS);
      if (textureBucket !== lastTextureBucket) {
        lastTextureBucket = textureBucket;
        globe.globeImageUrl(generateGlobeTexture(earthBaseImage, currentT));
      }

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
  }
})();
