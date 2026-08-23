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

  function lerpColor(a, b, t) {
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function stageForHealth(h) {
    if (h < 34) return 'Dormant';
    if (h < 67) return 'Awakening';
    return 'Thriving';
  }

  // Procedurally generated placeholder surface texture — soft, feathered
  // blobs standing in for landmass/mycelium-colony shapes until real
  // artwork replaces this. Drawn in a light, low-contrast neutral tone on
  // purpose: three.js multiplies this texture against globeMaterial's
  // color, so keeping it pale lets the health-driven Dormant/Thriving tint
  // (see render loop below) still read as the globe's dominant color —
  // this canvas only adds gentle surface relief, not the actual color.
  function generateGlobeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ede8de';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blobCount = 55;
    for (let i = 0; i < blobCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 30 + Math.random() * 70;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(216, 207, 192, 0.55)');
      gradient.addColorStop(1, 'rgba(216, 207, 192, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas.toDataURL('image/png');
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

  // --- globe (placeholder procedural texture; mycelium threads come next) -
  const globe = Globe()(document.getElementById('globeViz'))
    .globeImageUrl(generateGlobeTexture())
    .backgroundColor('#f3e6eb')
    .showAtmosphere(true);

  // Slow ambient auto-rotate so the display reads as alive even when no
  // visitor is touching it — living-system pacing, not a static image.
  // Visitors can still drag to spin manually; OrbitControls pauses
  // auto-rotate during that interaction and resumes after.
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.4;

  // Continuously eases the globe's surface/atmosphere color toward
  // healthValue's target (rather than snapping on each message) and adds a
  // slow idle "breathing" pulse to the atmosphere altitude — living-system
  // pacing, not a static image or a tech-style instant jump.
  const BASE_ATMOSPHERE_ALTITUDE = 0.2;
  const PULSE_AMPLITUDE = 0.02;
  const PULSE_PERIOD_MS = 6000;
  let currentT = state.healthValue / HEALTH_MAX;

  function animateGlobe() {
    const targetT = state.healthValue / HEALTH_MAX;
    currentT += (targetT - currentT) * 0.02;

    const color = lerpColor(DORMANT_COLOR, THRIVING_COLOR, currentT);
    const atmosphereColor = lerpColor(ATMOSPHERE_DORMANT, ATMOSPHERE_THRIVING, currentT);
    const pulse = Math.sin((performance.now() / PULSE_PERIOD_MS) * 2 * Math.PI) * PULSE_AMPLITUDE;

    globe.globeMaterial().color.set(color);
    globe.atmosphereColor(atmosphereColor);
    globe.atmosphereAltitude(BASE_ATMOSPHERE_ALTITUDE + pulse);

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
