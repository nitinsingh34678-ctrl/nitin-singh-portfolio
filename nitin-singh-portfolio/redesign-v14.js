(() => {
  const hero = document.querySelector('#home .hero-visual');
  const reveal = hero?.querySelector('.portrait-reveal');
  const holo = hero?.querySelector('.portrait-holo');
  const frame = hero?.querySelector('.portrait-placeholder');
  const base = hero?.querySelector('.portrait-photo');
  if (!hero || !reveal || !holo || !frame) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let touchTimer = 0;
  let target = { x: -999, y: -999, radius: 0 };
  let current = { x: -999, y: -999, radius: 0 };

  const draw = () => {
    const easing = reduceMotion ? 1 : .2;
    current.x += (target.x - current.x) * easing;
    current.y += (target.y - current.y) * easing;
    current.radius += (target.radius - current.radius) * (reduceMotion ? 1 : .18);
    [reveal, holo].forEach(layer => {
      layer.style.setProperty('--reveal-x', `${current.x}px`);
      layer.style.setProperty('--reveal-y', `${current.y}px`);
      layer.style.setProperty('--reveal-radius', `${current.radius}px`);
    });
    frame.style.setProperty('--scan-x', `${current.x}px`);
    frame.style.setProperty('--scan-y', `${current.y}px`);
    frame.style.setProperty('--scan-radius', `${current.radius * 1.12}px`);
    if (Math.abs(target.x-current.x)>.5 || Math.abs(target.y-current.y)>.5 || Math.abs(target.radius-current.radius)>.5) {
      raf = requestAnimationFrame(draw);
    } else {
      raf = 0;
      if (target.radius === 0) frame.classList.remove('is-scanning');
    }
  };

  const activate = e => {
    const rect = hero.getBoundingClientRect();
    target = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      radius: e.pointerType === 'touch' ? 150 : 230
    };
    frame.classList.add('is-scanning');
    if (!raf) raf = requestAnimationFrame(draw);
  };

  const deactivate = () => {
    target.radius = 0;
    if (!raf) raf = requestAnimationFrame(draw);
  };

  hero.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') activate(e);
  }, { passive: true });
  hero.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      clearTimeout(touchTimer);
      activate(e);
    }
  }, { passive: true });
  hero.addEventListener('pointerup', e => {
    if (e.pointerType !== 'mouse') {
      clearTimeout(touchTimer);
      touchTimer = setTimeout(deactivate, 1150);
    }
  }, { passive: true });
  hero.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse') deactivate();
  }, { passive: true });

  // Keep the effect aligned when the browser window or layout changes.
  window.addEventListener('blur', deactivate);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) deactivate();
  });

})();
