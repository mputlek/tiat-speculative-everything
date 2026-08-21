(function () {
  const config = window.FUNGUY_CONFIG;
  const statusEl = document.getElementById('status');
  const form = document.getElementById('messageForm');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const feedback = document.getElementById('feedback');

  if (!config || !config.ABLY_API_KEY || config.ABLY_API_KEY === 'YOUR_ABLY_API_KEY_HERE') {
    statusEl.textContent = 'not configured — see shared/config.template.js';
    statusEl.className = 'status error';
    sendBtn.disabled = true;
    return;
  }

  const clientId = 'visitor-' + Math.random().toString(36).slice(2, 10);
  const ably = new Ably.Realtime({ key: config.ABLY_API_KEY, clientId });
  const channel = ably.channels.get(config.CHANNEL_NAME);

  ably.connection.on('connected', () => {
    statusEl.textContent = 'connected to the mycelium';
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

  const COOLDOWN_MS = 3000;
  let lastSentAt = 0;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    const now = Date.now();
    if (now - lastSentAt < COOLDOWN_MS) {
      feedback.textContent = 'Give the mycelium a moment…';
      return;
    }
    lastSentAt = now;

    sendBtn.disabled = true;
    channel.publish('message', { text, ts: now, clientId }, (err) => {
      sendBtn.disabled = false;
      if (err) {
        feedback.textContent = 'Message did not reach the mycelium. Try again.';
        feedback.style.color = '#c0392b';
        console.error('Ably publish error', err);
        return;
      }
      feedback.style.color = '#4caf50';
      feedback.textContent = 'Your message reached the mycelium.';
      input.value = '';
    });
  });
})();
