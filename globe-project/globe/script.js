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

  // --- placeholder visuals: color lerp + bar + stage label ---------------
  // Dormant: muted grey-green. Thriving: saturated green. This is a stand-in
  // for the mycelium thread/bioluminescence treatment planned later.
  const DORMANT_COLOR = [138, 143, 135]; // #8a8f87
  const THRIVING_COLOR = [76, 175, 80]; // #4caf50

  function lerpColor(a, b, t) {
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function stageForHealth(h) {
    if (h < 34) return 'Dormant';
    if (h < 67) return 'Awakening';
    return 'Thriving';
  }

  function render() {
    const t = state.healthValue / HEALTH_MAX;
    const color = lerpColor(DORMANT_COLOR, THRIVING_COLOR, t);

    fillEl.style.width = `${state.healthValue}%`;
    fillEl.style.backgroundColor = color;
    stageEl.textContent = stageForHealth(state.healthValue);
    countEl.textContent = `${state.messageCount} message${state.messageCount === 1 ? '' : 's'} received`;

    if (globe) {
      globe.globeMaterial().color.set(color);
      globe.atmosphereColor(color);
    }
  }

  function onMessageReceived() {
    state.messageCount += 1;
    state.healthValue = Math.min(HEALTH_MAX, state.healthValue + (config.HEALTH_INCREMENT || 2));
    saveState();
    render();
  }

  // --- globe (placeholder: plain colored sphere, no texture/threads yet) -
  const globe = Globe()(document.getElementById('globeViz'))
    .backgroundColor('#f3e6eb')
    .showAtmosphere(true)
    .atmosphereAltitude(0.2);

  globe.globeMaterial().color.set(lerpColor(DORMANT_COLOR, THRIVING_COLOR, state.healthValue / HEALTH_MAX));

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
