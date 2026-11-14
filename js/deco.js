// Cuadrados decorativos: recortes de las fotos que van apareciendo en la
// franja del título, en el espacio libre a la derecha del texto.
(function decoSquares() {
  // Cada foto con su color promedio, que se ve mientras la imagen carga
  const PHOTOS = [
    { src: 'img/000011.jpg', color: '#9b9a86' },
    { src: 'img/000013.jpg', color: '#4d6e71' },
    { src: 'img/000019.jpg', color: '#5e655e' },
  ];
  const frame = document.getElementById('header');
  const deco = document.getElementById('deco');
  const SIZE = 22;         // lado de cada cuadrado (todos iguales)
  const GAP = 2;           // separación entre cuadrados y con el título
  const STEP = SIZE + GAP; // paso de la grilla
  const MARGIN = 8;        // distancia al borde del recuadro
  const SKIP_COLS = 4;     // columnas que quedan vacías junto al título
  const MAX = 60;          // cuántos cuadrados como máximo a la vez
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const squares = [];      // { el, x, y, w, h, key }

  // Lo que está ocupado: el título y su descripción
  function busyRect() {
    const el = document.getElementById('colTitle');
    const f = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // Toda la altura de la franja, y 4 columnas extra libres a la derecha del título
    return { x: 0, y: 0, w: r.right - f.left + SKIP_COLS * STEP, h: f.height };
  }
  const overlaps = (a, b) =>
    a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x &&
    a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y;

  function spawn(instant = false) {
    if (squares.length >= MAX) return;
    const W = frame.clientWidth, H = frame.clientHeight;
    const busy = busyRect();
    // Celdas libres de la grilla: dentro de la franja y fuera del título
    const cols = Math.floor((W - 2 * MARGIN + GAP) / STEP);
    const rows = Math.floor((H - 2 * MARGIN + GAP) / STEP);
    const ox = (W - (cols * STEP - GAP)) / 2;   // grilla centrada en la franja
    const oy = (H - (rows * STEP - GAP)) / 2;
    const taken = new Set(squares.map(q => q.key));
    const free = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = { x: ox + c * STEP, y: oy + r * STEP, w: SIZE, h: SIZE, key: c + ',' + r };
        if (!taken.has(cell.key) && !overlaps(cell, busy)) free.push(cell);
      }
    }
    if (!free.length) return;

    {
      const cand = free[Math.floor(Math.random() * free.length)];
      const s = SIZE;
      const el = document.createElement('div');
      el.className = 'deco-sq';
      const photo = PHOTOS[Math.floor(Math.random() * PHOTOS.length)];
      const zoom = 700 + Math.random() * 500; // foto grande: el cuadrado muestra un fragmento chico
      Object.assign(el.style, {
        left: cand.x + 'px', top: cand.y + 'px', width: s + 'px', height: s + 'px',
        backgroundImage: `url("${photo.src}")`,
        backgroundColor: photo.color,
        backgroundSize: zoom + 'px auto',
        backgroundPosition: `${Math.random() * 100}% ${Math.random() * 100}%`,
      });
      deco.appendChild(el);
      const sq = { el, ...cand };
      squares.push(sq);
      if (instant) {
        // Ya visible desde que carga la página, sin fundido de entrada
        el.style.transition = 'none';
        el.classList.add('is-in');
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; }));
      } else {
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
      }

      if (!reduceMotion) {
        // Cada cuadrado se queda un rato y luego se desvanece
        setTimeout(() => {
          el.classList.remove('is-in');
          setTimeout(() => {
            el.remove();
            const i = squares.indexOf(sq);
            if (i !== -1) squares.splice(i, 1);
          }, 900);
        }, 12000 + Math.random() * 10000);
      }
      return;
    }
  }

  // El alto de la franja se usa para que el mosaico quepa debajo
  const setHeaderH = () =>
    document.documentElement.style.setProperty('--header-h', frame.offsetHeight + 'px');
  setHeaderH();
  // Al cambiar el tamaño de la ventana la grilla cambia: se parte de cero
  window.addEventListener('resize', () => {
    setHeaderH();
    squares.forEach(q => q.el.remove());
    squares.length = 0;
  });

  if (reduceMotion) {
    for (let i = 0; i < MAX; i++) spawn(true);
  } else {
    // Al cargar, la franja ya parte con cuadrados puestos
    for (let i = 0; i < 40; i++) spawn(true);
    setInterval(() => { if (!document.hidden) spawn(); }, 350);
  }
})();
