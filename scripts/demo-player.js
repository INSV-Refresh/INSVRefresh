(function () {
  // Step timestamps (seconds) — update these once the real video is ready
  const STEPS = [
    { at: 0,  label: "1 · Clique no ícone da extensão" },
    { at: 12, label: "2 · Cole o link da fila do Salesforce" },
    { at: 28, label: "3 · Defina o intervalo de atualização" },
    { at: 44, label: "4 · Ative o monitoramento" },
    { at: 62, label: "5 · Receba notificações em tempo real" },
  ];

  const player   = document.getElementById('demo-player');
  const video    = document.getElementById('demo-video');
  const bigPlay  = document.getElementById('vp-big-play');
  const scrub    = document.getElementById('vp-scrub');
  const scrubFill  = document.getElementById('vp-scrub-fill');
  const scrubThumb = document.getElementById('vp-scrub-thumb');
  const dotsWrap = document.getElementById('vp-dots');
  const stepText = document.getElementById('vp-step-text');
  const btnPlay  = document.getElementById('vp-play-pause');
  const btnMute  = document.getElementById('vp-mute');
  const btnFs    = document.getElementById('vp-fullscreen');
  const timeEl   = document.getElementById('vp-time');

  if (!player || !video) return;

  // Build step dots
  STEPS.forEach((s, i) => {
    const dot = document.createElement('div');
    dot.className = 'vp-dot';
    dot.dataset.index = i;
    s._dot = dot;
    dotsWrap.appendChild(dot);
  });

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function setState(state) {
    player.dataset.state = state;
  }

  function positionDots() {
    if (!video.duration) return;
    STEPS.forEach(s => {
      const pct = Math.min(s.at / video.duration, 1) * 100;
      s._dot.style.left = pct + '%';
    });
  }

  function updateActiveStep() {
    let activeIdx = 0;
    for (let i = 0; i < STEPS.length; i++) {
      if (video.currentTime >= STEPS[i].at) activeIdx = i;
    }
    STEPS.forEach((s, i) => s._dot.classList.toggle('active', i === activeIdx));
    stepText.textContent = STEPS[activeIdx].label;
  }

  function updateScrub() {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    scrubFill.style.width = pct + '%';
    scrubThumb.style.left = pct + '%';
    timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    updateActiveStep();
  }

  // Init
  stepText.textContent = STEPS[0].label;
  setState('idle');

  video.addEventListener('loadedmetadata', () => {
    timeEl.textContent = '0:00 / ' + fmt(video.duration);
    positionDots();
  });

  video.addEventListener('timeupdate', updateScrub);
  video.addEventListener('play',  () => setState('playing'));
  video.addEventListener('pause', () => setState('paused'));
  video.addEventListener('ended', () => setState('ended'));

  // Sync play/pause icon
  function syncPlayIcon() {
    const playing = !video.paused && !video.ended;
    btnPlay.querySelector('.icon-play').style.display  = playing ? 'none' : '';
    btnPlay.querySelector('.icon-pause').style.display = playing ? '' : 'none';
  }
  video.addEventListener('play',  syncPlayIcon);
  video.addEventListener('pause', syncPlayIcon);
  video.addEventListener('ended', syncPlayIcon);

  // Big center play button
  bigPlay.addEventListener('click', e => {
    e.stopPropagation();
    video.play();
  });

  // Click on player body toggles play/pause
  player.addEventListener('click', e => {
    if (e.target.closest('.vp-hud') || e.target.closest('.vp-big-play')) return;
    if (video.paused || video.ended) video.play(); else video.pause();
  });

  // Controls: play/pause
  btnPlay.addEventListener('click', e => {
    e.stopPropagation();
    if (video.paused || video.ended) video.play(); else video.pause();
  });

  // Mute toggle
  btnMute.addEventListener('click', e => {
    e.stopPropagation();
    video.muted = !video.muted;
    btnMute.querySelector('.icon-sound').style.display = video.muted ? 'none' : '';
    btnMute.querySelector('.icon-mute').style.display  = video.muted ? '' : 'none';
  });

  // Fullscreen
  btnFs.addEventListener('click', e => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      player.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });

  // Scrub by dragging
  let scrubbing = false;

  function seekTo(clientX) {
    const track = scrub.querySelector('.vp-scrub-track');
    const rect  = track.getBoundingClientRect();
    const pct   = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    if (video.duration) video.currentTime = pct * video.duration;
  }

  scrub.addEventListener('mousedown', e => {
    e.stopPropagation();
    scrubbing = true;
    seekTo(e.clientX);
  });
  document.addEventListener('mousemove', e => { if (scrubbing) seekTo(e.clientX); });
  document.addEventListener('mouseup',   () => { scrubbing = false; });

  // Step dot click → seek to that step
  dotsWrap.addEventListener('click', e => {
    e.stopPropagation();
    const dot = e.target.closest('.vp-dot');
    if (!dot) return;
    const idx = parseInt(dot.dataset.index, 10);
    if (video.duration) {
      video.currentTime = STEPS[idx].at;
      if (video.paused) video.play();
    }
  });
})();
