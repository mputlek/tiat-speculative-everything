(async function () {
  const statusEl = document.getElementById('status');
  const stageEl = document.getElementById('stage');
  const fillEl = document.getElementById('healthBarFill');
  const countEl = document.getElementById('healthCount');

  // Fetched at load time from a Next.js API route rather than a build-time-
  // generated shared/config.js — this page now lives in the Next.js app's
  // public/ folder, which isn't templated at build time.
  let config;
  try {
    config = await fetch('/api/globe-config').then((r) => r.json());
  } catch (e) {
    config = null;
  }

  if (!config || !config.ABLY_API_KEY) {
    statusEl.textContent = 'not configured — set ABLY_API_KEY';
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

  // --- attract mode: rotating mushroom + welcome text until first message,
  // cycling back after a long idle gap -------------------------------------
  const attractModeEl = document.getElementById('attractMode');
  const mushroomCanvas = document.getElementById('mushroomCanvas');
  const attractTextEl = document.getElementById('attractText');
  const globeVizEl = document.getElementById('globeViz');
  const overlayEl = document.querySelector('.overlay');

  const ATTRACT_PAGE_INTERVAL_MS = 6000;
  const IDLE_THRESHOLD_MS = 3 * 60 * 1000; // 3 min of no messages -> back to attract mode. Tune here.
  const IDLE_CHECK_INTERVAL_MS = 15000;

  let isRevealed = state.messageCount > 0;
  // Only set "now" if we're starting already-revealed (real prior activity)
  // — starting at 0 would make a fresh, never-engaged kiosk look idle
  // immediately and never matters anyway, since returnToAttractMode() only
  // fires while isRevealed.
  let lastMessageAt = isRevealed ? Date.now() : 0;

  let mushroomRenderer = null;
  let mushroomScene = null;
  let mushroomCamera = null;
  let mushroomControls = null;
  let mushroomAnimationHandle = null;
  let mushroomSceneBuildPromise = null;

  function mushroomAnimateFrame() {
    mushroomControls.update();
    mushroomRenderer.render(mushroomScene, mushroomCamera);
    mushroomAnimationHandle = requestAnimationFrame(mushroomAnimateFrame);
  }

  function startMushroomAnimation() {
    if (mushroomAnimationHandle == null && mushroomRenderer) {
      mushroomAnimateFrame();
    }
  }

  function stopMushroomAnimation() {
    if (mushroomAnimationHandle != null) {
      cancelAnimationFrame(mushroomAnimationHandle);
      mushroomAnimationHandle = null;
    }
  }

  // Built once, lazily, the first time attract mode is actually needed
  // (initial load or a later idle cycle-back) — not eagerly on every page
  // load, since a kiosk that's already been engaged with skips attract mode
  // entirely and never needs this. Independent scene/canvas/renderer from
  // Globe.gl's own — never shares a THREE instance across the two, so
  // there's no repeat of the earlier clouds-layer version-conflict issue.
  function ensureMushroomScene() {
    if (mushroomSceneBuildPromise) return mushroomSceneBuildPromise;
    mushroomSceneBuildPromise = (async () => {
      try {
        const THREE = await import('https://unpkg.com/three/build/three.module.js');
        const { GLTFLoader } = await import(
          'https://unpkg.com/three/examples/jsm/loaders/GLTFLoader.js'
        );
        const { OrbitControls } = await import(
          'https://unpkg.com/three/examples/jsm/controls/OrbitControls.js'
        );

        mushroomRenderer = new THREE.WebGLRenderer({
          canvas: mushroomCanvas,
          antialias: true,
          alpha: true,
        });
        mushroomRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mushroomRenderer.setSize(window.innerWidth, window.innerHeight);

        mushroomScene = new THREE.Scene();
        mushroomCamera = new THREE.PerspectiveCamera(
          45,
          window.innerWidth / window.innerHeight,
          0.1,
          100
        );
        mushroomCamera.position.set(0, 0, 5);

        mushroomScene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(3, 5, 4);
        mushroomScene.add(dirLight);

        const gltf = await new GLTFLoader().loadAsync('/assets/mushroom-scan.glb');
        const model = gltf.scene;

        // Center + scale to a consistent on-screen size regardless of the
        // source model's native dimensions.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(2.4 / maxDim);
        mushroomScene.add(model);

        mushroomControls = new OrbitControls(mushroomCamera, mushroomRenderer.domElement);
        mushroomControls.enableDamping = true;
        mushroomControls.autoRotate = true;
        mushroomControls.autoRotateSpeed = 1.5;
        mushroomControls.enableZoom = false;
        mushroomControls.enablePan = false;

        window.addEventListener('resize', () => {
          mushroomRenderer.setSize(window.innerWidth, window.innerHeight);
          mushroomCamera.aspect = window.innerWidth / window.innerHeight;
          mushroomCamera.updateProjectionMatrix();
        });
      } catch (err) {
        // Best-effort, same as the globe's own texture/clouds/specular
        // pieces — a failure here just means attract mode shows text only,
        // never breaks the page.
        console.error('Mushroom scene failed to load — showing text only:', err);
      }
    })();
    return mushroomSceneBuildPromise;
  }

  let showingMushroomPage = true;
  let pageCycleInterval = null;

  function cycleAttractPage() {
    showingMushroomPage = !showingMushroomPage;
    mushroomCanvas.classList.toggle('pageHidden', !showingMushroomPage);
    attractTextEl.classList.toggle('pageHidden', showingMushroomPage);
  }

  function startPageCycle() {
    if (pageCycleInterval) return;
    showingMushroomPage = true;
    mushroomCanvas.classList.remove('pageHidden');
    attractTextEl.classList.add('pageHidden');
    pageCycleInterval = setInterval(cycleAttractPage, ATTRACT_PAGE_INTERVAL_MS);
  }

  function stopPageCycle() {
    if (pageCycleInterval) {
      clearInterval(pageCycleInterval);
      pageCycleInterval = null;
    }
  }

  function enterAttractMode() {
    globeVizEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    attractModeEl.classList.remove('hidden');
    ensureMushroomScene().then(startMushroomAnimation);
    startPageCycle();
  }

  function revealGlobe() {
    if (isRevealed) return;
    isRevealed = true;
    attractModeEl.classList.add('hidden');
    globeVizEl.classList.remove('hidden');
    overlayEl.classList.remove('hidden');
    stopPageCycle();
    stopMushroomAnimation();
  }

  function returnToAttractMode() {
    if (!isRevealed) return;
    isRevealed = false;
    enterAttractMode();
  }

  // Runs continuously; only acts while revealed, so no need to start/stop
  // it as attract/revealed state changes.
  setInterval(() => {
    if (isRevealed && Date.now() - lastMessageAt > IDLE_THRESHOLD_MS) {
      returnToAttractMode();
    }
  }, IDLE_CHECK_INTERVAL_MS);

  if (!isRevealed) {
    enterAttractMode();
  }

  function render() {
    const color = lerpColor(DORMANT_COLOR, THRIVING_COLOR, state.healthValue / HEALTH_MAX);
    fillEl.style.width = `${state.healthValue}%`;
    fillEl.style.backgroundColor = color;
    stageEl.textContent = stageForHealth(state.healthValue);
    countEl.textContent = `${state.messageCount} message${state.messageCount === 1 ? '' : 's'} received`;
    // Covers both the initial load (already-engaged kiosk should start
    // revealed, not replay attract mode) and every subsequent message —
    // idempotent, so calling it every render is harmless.
    if (state.messageCount > 0) revealGlobe();
  }

  function onMessageReceived() {
    lastMessageAt = Date.now();
    state.messageCount += 1;
    state.healthValue = Math.min(HEALTH_MAX, state.healthValue + (config.HEALTH_INCREMENT || 2));
    saveState();
    render();
  }

  render();

  // --- debug slider (only shown with ?debug in the URL) ------------------
  // Scrubs healthValue/messageCount directly so the Dormant -> Thriving
  // transition can be previewed without sending real Ably messages. Lives
  // here (not inside setUpGlobe) so it drives both the 2D health bar and,
  // via the shared `state` object, the 3D globe's own animation loop
  // whenever that succeeds — same as a real message would.
  if (new URLSearchParams(location.search).has('debug')) {
    const debugPanel = document.getElementById('debugPanel');
    const debugSlider = document.getElementById('debugSlider');
    const debugSliderValue = document.getElementById('debugSliderValue');
    const healthIncrement = config.HEALTH_INCREMENT || 2;
    const maxMessages = Math.ceil(HEALTH_MAX / healthIncrement);

    debugPanel.hidden = false;
    debugSlider.max = String(maxMessages);
    debugSlider.value = String(state.messageCount);
    debugSliderValue.textContent = String(state.messageCount);

    debugSlider.addEventListener('input', () => {
      const count = Number(debugSlider.value);
      lastMessageAt = Date.now();
      state.messageCount = count;
      state.healthValue = Math.min(HEALTH_MAX, count * healthIncrement);
      debugSliderValue.textContent = String(count);
      saveState();
      render();
    });
  }

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
    // Surfaced visibly (not just console) — a silent fallback to
    // Globe.gl's bare default appearance previously looked like a
    // half-working feature rather than a clear failure, which cost a lot
    // of back-and-forth to diagnose.
    console.error('Globe visuals failed to initialize:', err);
    countEl.textContent = `Globe visuals failed to load (${err.message || err}) — messaging still works`;
  }

  async function setUpGlobe() {
    // Health-driven palette: atmosphere + mycelium arc glow. Reverted to
    // match the reference photo's actual colors (dark blue background,
    // natural photographic ocean) rather than the earlier beige/aqua
    // experiment.
    const ATMOSPHERE_DORMANT = [90, 110, 140]; // dim grey-blue
    const ATMOSPHERE_THRIVING = [100, 180, 240]; // vivid sky blue

    function lerpColor(a, b, t) {
      const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }

    function lerpColorAlpha(a, b, t, alphaMin, alphaMax) {
      const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
      const alpha = alphaMin + (alphaMax - alphaMin) * t;
      return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(2)})`;
    }

    // --- realistic Earth texture ----------------------------------------
    // Real photographic Earth (three-globe's bundled Blue Marble asset) +
    // terrain bump map, desaturated toward Dormant / full color toward
    // Thriving, ocean tinted toward aqua/turquoise (Blue Marble's default
    // ocean reads as a duller navy), soft cloud wisps composited into the
    // same canvas. Regenerated only on a 5% health step, not every
    // animation frame.
    // Matches the bump map's native resolution (2048x1024) — the earlier
    // 1024x512 (halved for perceived perf headroom around the per-pixel
    // ocean-tint loop) threw away real detail from the 4096x2048 source
    // photo and read visibly soft/blurry. The tint loop is still cheap at
    // this size (~2M simple pixel ops, well under render-blocking territory
    // for an operation that only fires ~20x per session, not per frame).
    const TEXTURE_WIDTH = 2048;
    const TEXTURE_HEIGHT = 1024;
    // Self-hosted rather than loaded cross-origin from a CDN: canvas
    // getImageData()/toDataURL() below require the source image to be
    // taint-free, and same-origin assets are taint-free by web platform
    // guarantee — no dependency on a third party's CORS headers holding up
    // across every redirect hop, browser, and cache state.
    const EARTH_IMAGE_URL = 'assets/earth-blue-marble.jpg';
    const BUMP_IMAGE_URL = 'assets/earth-topology.png';
    const SPECULAR_MAP_URL = 'assets/earth-water.png'; // white=ocean, black=land
    const OCEAN_TARGET = [110, 220, 225]; // aqua/turquoise
    // Raised close to 1 so deep/shallow ocean pixels converge toward
    // nearly the same light target color — subtle variation between the
    // two rather than a stark light/dark contrast.
    const OCEAN_BLEND = 0.98;
    const GREEN_TARGET = [70, 195, 85]; // vivid, brighter vegetation green
    const GREEN_BLEND = 0.5; // milder than ocean — keep some natural photo variation

    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }

    function tintOceanAndGreen(ctx, width, height) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Ratio-based, not a raw channel difference — a raw difference
        // shrinks in dark/deep water even though it's still clearly
        // blue-toned (every channel scales down together), which meant
        // the darkest water was getting LESS tint, not more, leaving
        // exactly the dark patches this was supposed to lighten. A ratio
        // is brightness-independent: dark water with the same blue-vs-
        // other-channels proportions still saturates to full blend.
        const maxRG = Math.max(r, g);
        const blueRatio = b / (maxRG + 1);
        const blueness = Math.max(0, Math.min(1, (blueRatio - 1) / 0.25));
        if (blueness > 0) {
          const blend = blueness * OCEAN_BLEND;
          data[i] = Math.round(r + (OCEAN_TARGET[0] - r) * blend);
          data[i + 1] = Math.round(g + (OCEAN_TARGET[1] - g) * blend);
          data[i + 2] = Math.round(b + (OCEAN_TARGET[2] - b) * blend);
          continue; // a pixel is either water or land, never both
        }

        const greenDominance = g - Math.max(r, b);
        const greenness = Math.max(0, Math.min(1, greenDominance / 20));
        if (greenness > 0) {
          const blend = greenness * GREEN_BLEND;
          data[i] = Math.round(r + (GREEN_TARGET[0] - r) * blend);
          data[i + 1] = Math.round(g + (GREEN_TARGET[1] - g) * blend);
          data[i + 2] = Math.round(b + (GREEN_TARGET[2] - b) * blend);
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    function generateGlobeTexture(earthImage, t) {
      const canvas = document.createElement('canvas');
      canvas.width = TEXTURE_WIDTH;
      canvas.height = TEXTURE_HEIGHT;
      const ctx = canvas.getContext('2d');

      // Damaged (t=0): desaturated and dim, but not washed-out grey — floor
      // raised (was 20%/70%) so land keeps some natural color even early
      // on. Healed (t=1): full vivid color, matching the reference photo.
      const saturation = 40 + t * 60;
      const brightness = 80 + t * 20;
      ctx.filter = `saturate(${saturation}%) brightness(${brightness}%)`;
      ctx.drawImage(earthImage, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      tintOceanAndGreen(ctx, canvas.width, canvas.height);

      return canvas.toDataURL('image/jpeg', 0.95);
    }

    // --- clouds: a genuinely separate, independently-rotating layer -----
    // A prior attempt at this broke globe.gl entirely ("Globe is not
    // defined") — root cause turned out to be pinning an external three.js
    // to v0.155, well below globe.gl's actual peer requirement
    // (>=0.179 <1). Versions in that range dropped the classic global/UMD
    // script format, so this uses a scoped dynamic import() of the current
    // ES module build instead: never assigned to window.THREE, so it can't
    // collide with globe.gl's own internal instance the way a global did.
    //
    // Uses a real cloud texture with genuine alpha transparency (the
    // standard asset for this technique across Globe.gl/three-globe
    // examples, originally from the webgl-earth project) rather than
    // hand-drawn canvas shapes — actual satellite cloud data reads as
    // properly wispy in a way procedural shapes couldn't quite match.
    // Self-hosted alongside the Earth/bump textures rather than loaded
    // from a third party for the same reliability reasons.
    const CLOUDS_IMAGE_URL = 'assets/clouds.png';

    async function buildCloudsLayer(scene, THREE) {
      const texture = await new THREE.TextureLoader().loadAsync(CLOUDS_IMAGE_URL);
      const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.004, 75, 75);
      const material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      return mesh;
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
      .backgroundColor('#f3e6eb')
      .showAtmosphere(true)
      .arcAltitude(0.05)
      .arcDashLength(0.4)
      .arcDashGap(0.3)
      .arcDashAnimateTime(5000);

    globe.globeMaterial().color.set('#ffffff');
    // bumpScale isn't a Globe.gl chainable accessor (that call was
    // throwing, silently killing everything later in the chain — the root
    // cause of the missing background/atmosphere/arcs). It's a real
    // property on the underlying three.js material, set directly instead.
    globe.globeMaterial().bumpScale = 10;

    // THREE is needed for both the specular map (a texture assigned
    // directly to the material) and the clouds layer (a whole custom
    // mesh) below — loaded once here and shared, rather than importing
    // twice. Everything past this point is best-effort: each piece is
    // isolated in its own try/catch so a failure in one (missing THREE,
    // a bad texture load) can't take down the terrain/atmosphere/arcs
    // that already rendered successfully above.
    let THREE = null;
    try {
      THREE = await import('https://unpkg.com/three/build/three.module.js');
    } catch (err) {
      console.error('Failed to load THREE (specular map + clouds unavailable):', err);
    }

    if (THREE) {
      try {
        // Official Globe.gl technique: earth-water.png is a black/white
        // land-water mask used as specularMap — white (ocean) picks up
        // the shininess/highlight, black (land) stays matte. Gives the
        // glossy-water/matte-land contrast automatically instead of a
        // uniform sheen across the whole sphere.
        const specularTexture = await new THREE.TextureLoader().loadAsync(SPECULAR_MAP_URL);
        globe.globeMaterial().specularMap = specularTexture;
        globe.globeMaterial().specular.set('#888888');
        globe.globeMaterial().shininess = 15;
      } catch (err) {
        console.error('Specular map failed, falling back to whole-surface sheen:', err);
        globe.globeMaterial().specular.set('#6a86b0');
        globe.globeMaterial().shininess = 15;
      }
    }

    const GLOBE_RADIUS = 100; // three-globe's internal globe radius convention
    let cloudsMesh = null;
    if (THREE) {
      try {
        cloudsMesh = await buildCloudsLayer(globe.scene(), THREE);
      } catch (err) {
        console.error('Clouds layer failed, continuing without it:', err);
      }
    }

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

      // Clouds drift at their own slow, independent rate — separate from
      // the camera's auto-rotate orbit, which leaves the terrain itself
      // stationary in world space. Guarded since the clouds layer is
      // best-effort and may not exist if it failed to load.
      if (cloudsMesh) {
        cloudsMesh.rotation.y += 0.0006;
      }

      requestAnimationFrame(animateGlobe);
    }
    animateGlobe();
  }
})();
