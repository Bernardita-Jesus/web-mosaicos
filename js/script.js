let uploadedImages = [];
let mosaicCanvas = null;

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const thumbrow = document.getElementById('thumbrow');
const imgCount = document.getElementById('imgCount');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const tileWSlider = document.getElementById('tileW');
const tileWVal = document.getElementById('tileWVal');
const tileHSlider = document.getElementById('tileH');
const tileHVal = document.getElementById('tileHVal');
const variableWCheckbox = document.getElementById('variableW');
const variableHCheckbox = document.getElementById('variableH');
const fixedWControls = document.getElementById('fixedWControls');
const varWControls = document.getElementById('varWControls');
const fixedHControls = document.getElementById('fixedHControls');
const varHControls = document.getElementById('varHControls');
const minWidthSlider = document.getElementById('minWidth');
const minWidthVal = document.getElementById('minWidthVal');
const maxWidthSlider = document.getElementById('maxWidth');
const maxWidthVal = document.getElementById('maxWidthVal');
const minHeightSlider = document.getElementById('minHeight');
const minHeightVal = document.getElementById('minHeightVal');
const maxHeightSlider = document.getElementById('maxHeight');
const maxHeightVal = document.getElementById('maxHeightVal');
const getSortValue = () => (document.querySelector('input[name=sort]:checked') || {}).value || 'brightness';
const getFormatValue = () => (document.querySelector('input[name=format]:checked') || {}).value;

// Tamaños típicos de Instagram (en px).
const FORMATS = {
  square:     { w: 1080, h: 1080, name: '1x1' },
  portrait:   { w: 1080, h: 1350, name: '4x5' },
  portrait34: { w: 1080, h: 1440, name: '3x4' },
  story:      { w: 1080, h: 1920, name: '9x16' },
  landscape:  { w: 1080, h: 567,  name: '191x100' }, // 567 en vez de 566 para que tenga tamaños de recorte exactos
};
let lastFormatName = FORMATS.story.name;
const jitterSlider = document.getElementById('jitter');
const jitterVal = document.getElementById('jitterVal');

function toggleVariable(checkbox, fixedEl, varEl) {
  // Los dos grupos siempre se ven; el que no se está usando queda
  // semitransparente y desactivado.
  const setOff = (el, off) => {
    el.classList.toggle('is-off', off);
    el.querySelectorAll('input').forEach(i => { i.disabled = off; });
  };
  const update = () => {
    setOff(fixedEl, checkbox.checked);
    setOff(varEl, !checkbox.checked);
  };
  checkbox.addEventListener('change', update);
  update();
}
toggleVariable(variableWCheckbox, fixedWControls, varWControls);
toggleVariable(variableHCheckbox, fixedHControls, varHControls);

// Mínimo y máximo enlazados: el mínimo nunca pasa al máximo y viceversa.
function linkMinMax(minS, minV, maxS, maxV) {
  minS.addEventListener('input', () => {
    minV.textContent = minS.value;
    if (+minS.value >= +maxS.value) {
      maxS.value = Math.min(+maxS.max, +minS.value + 20);
      maxV.textContent = maxS.value;
    }
  });
  maxS.addEventListener('input', () => {
    maxV.textContent = maxS.value;
    if (+maxS.value <= +minS.value) {
      minS.value = Math.max(+minS.min, +maxS.value - 20);
      minV.textContent = minS.value;
    }
  });
}
linkMinMax(minWidthSlider, minWidthVal, maxWidthSlider, maxWidthVal);
linkMinMax(minHeightSlider, minHeightVal, maxHeightSlider, maxHeightVal);

// ---------- Deslizadores que solo se detienen en tamaños exactos ----------
// Cada deslizador recorre únicamente los tamaños que dividen exacto el ancho
// (o el alto) del formato elegido, así los recortes llenan el formato completo
// sin que ninguno quede cortado ni estirado.

function divisorsInRange(total, min, max) {
  const out = [];
  for (let d = min; d <= max; d++) if (total % d === 0) out.push(d);
  return out;
}

function snapSlider(slider, label, getTotal, min, max, initial) {
  let values = [];
  const value = () => values[parseInt(slider.value, 10)];
  function rebuild() {
    const prev = value() || initial;
    values = divisorsInRange(getTotal(), min, max);
    if (values.length === 0) values = [getTotal()];
    let best = 0;
    values.forEach((v, i) => { if (Math.abs(v - prev) < Math.abs(values[best] - prev)) best = i; });
    slider.min = 0;
    slider.max = values.length - 1;
    slider.step = 1;
    slider.value = best;
    label.textContent = value();
  }
  slider.addEventListener('input', () => { label.textContent = value(); });
  return { rebuild, value };
}

const currentFormat = () => FORMATS[getFormatValue()] || FORMATS.story;
const tileWSnap = snapSlider(tileWSlider, tileWVal, () => currentFormat().w, 20, 300, 120);
const tileHSnap = snapSlider(tileHSlider, tileHVal, () => currentFormat().h, 8, 300, 120);
function rebuildSnapSliders() {
  tileWSnap.rebuild();
  tileHSnap.rebuild();
}
document.querySelectorAll('input[name=format]').forEach(r => r.addEventListener('change', rebuildSnapSliders));
rebuildSnapSliders();
jitterSlider.addEventListener('input', () => {
  jitterVal.textContent = jitterSlider.value;
});

dropzone.addEventListener('click', () => fileInput.click());
document.getElementById('addBtn').addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', e => {
  handleFiles(e.target.files);
  fileInput.value = ''; // permite volver a elegir una foto que se había eliminado
});

function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (files.length === 0 && fileList.length > 0) {
    imgCount.textContent = 'Ese archivo no es una imagen soportada.';
    return;
  }
  files.forEach(file => {
    const reader = new FileReader();
    reader.onerror = () => {
      imgCount.textContent = 'No se pudo leer "' + file.name + '".';
    };
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => {
        imgCount.textContent = '"' + file.name + '" no se pudo abrir (formato no soportado, prueba con JPG o PNG).';
      };
      img.onload = () => {
        uploadedImages.push(img);
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'thumb';
        t.title = 'Eliminar foto';
        t.setAttribute('aria-label', 'Eliminar ' + file.name);
        const ti = document.createElement('img');
        ti.src = ev.target.result;
        ti.alt = '';
        t.appendChild(ti);
        t.addEventListener('click', () => {
          const idx = uploadedImages.indexOf(img);
          if (idx !== -1) uploadedImages.splice(idx, 1);
          t.remove();
          updateCount();
        });
        thumbrow.appendChild(t);
        updateCount();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function updateCount() {
  const has = uploadedImages.length > 0;
  dropzone.hidden = has;
  document.getElementById('photosRow').hidden = !has;
  imgCount.textContent = uploadedImages.length === 0 ? '' : uploadedImages.length + (uploadedImages.length === 1 ? ' imagen cargada · toca una para eliminarla' : ' imágenes cargadas · toca una para eliminarla');
  processBtn.disabled = uploadedImages.length === 0;
  scheduleBuild(0);
}

// ---------- Actualización automática ----------
// Cualquier cambio rearma el mosaico solo (con una pequeña espera mientras se
// arrastra un deslizador). El azar usa una semilla fija, así mover un control
// no reordena todo de golpe; "Mezclar de nuevo" cambia la semilla.

let seed = (Math.random() * 2 ** 32) >>> 0;
let buildTimer = null;
let buildId = 0;            // cada armado nuevo invalida al que estaba en curso
let analysisCache = null;   // colores ya medidos para el plan actual

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scheduleBuild(delay = 180) {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(buildMosaic, delay);
}

processBtn.addEventListener('click', () => {
  seed = (Math.random() * 2 ** 32) >>> 0;
  scheduleBuild(0);
});

document.querySelectorAll('#app input, #app select').forEach(el => {
  if (el.type === 'file') return;
  el.addEventListener(el.type === 'range' ? 'input' : 'change', () => scheduleBuild());
});
// Guardar: en el teléfono se abre el menú de compartir (ahí está "Guardar
// imagen" / "Guardar en Fotos"); en el computador se descarga el archivo.
// La imagen se deja preparada cada vez que el mosaico cambia, porque Safari
// solo abre el menú si se pide en el mismo instante del toque.
let mosaicFile = null;
let fileTimer = null;
function prepareFile() {
  mosaicFile = null;
  clearTimeout(fileTimer);
  const canvas = mosaicCanvas;
  if (!canvas) return;
  fileTimer = setTimeout(() => {
    canvas.toBlob(blob => {
      if (blob && canvas === mosaicCanvas) {
        mosaicFile = new File([blob], 'mosaico-' + lastFormatName + '.png', { type: 'image/png' });
      }
    }, 'image/png');
  }, 150);
}

function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link); // algunos navegadores lo necesitan en la página
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

downloadBtn.addEventListener('click', () => {
  if (!mosaicCanvas) return;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const file = mosaicFile;
  if (file && isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Mosaico fotográfico' }).catch(err => {
      if (err.name !== 'AbortError') downloadFile(file, file.name); // si no se pudo compartir, se descarga
    });
    return;
  }
  if (file) { downloadFile(file, file.name); return; }
  // Si la imagen aún no estaba lista, se prepara y se descarga
  const name = 'mosaico-' + lastFormatName + '.png';
  mosaicCanvas.toBlob(blob => { if (blob) downloadFile(blob, name); }, 'image/png');
});

function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const bri = max;
  return { h, s, bri };
}

// ---------- Plan del mosaico ----------
// Primero se decide dónde va cada recorte dentro del formato (posición y
// tamaño exactos). Después cada foto se corta con ese mismo plan, así hay
// recortes de cada tamaño para cada espacio y todo calza sin estirar.

// Reparte `total` px en tramos de entre `min` y `max` que suman exacto `total`.
// Se eligen al azar entre mínimo, medio y máximo, sin dejar nunca un resto
// más chico que el mínimo.
function splitExact(total, min, max, rand) {
  const options = [min, Math.round((min + max) / 2), max];
  const parts = [];
  let left = total;
  while (left > 0) {
    let w;
    if (left <= max) {
      w = left;
    } else {
      const fits = options.filter(o => left - o >= min);
      if (fits.length) {
        w = fits[Math.floor(rand() * fits.length)];
      } else {
        const hi = Math.min(max, left - min);
        w = hi >= min ? min + Math.floor(rand() * (hi - min + 1)) : Math.ceil(left / 2);
      }
    }
    parts.push(w);
    left -= w;
  }
  return parts;
}

function repeatExact(total, size) {
  return Array.from({ length: Math.round(total / size) }, () => size);
}

function planLayout(fmt, o, rand) {
  const slots = [];
  if (o.varW || !o.varH) {
    // Por filas: cada fila tiene un alto y se llena de izquierda a derecha.
    const heights = o.varH ? splitExact(fmt.h, o.minH, o.maxH, rand) : repeatExact(fmt.h, o.tileH);
    let y = 0;
    heights.forEach((h, r) => {
      const widths = o.varW ? splitExact(fmt.w, o.minW, o.maxW, rand) : repeatExact(fmt.w, o.tileW);
      let x = 0;
      widths.forEach((w, c) => { slots.push({ x, y, w, h, r, c }); x += w; });
      y += h;
    });
  } else {
    // Ancho fijo y altos variados: por columnas, cada una de arriba a abajo.
    let x = 0;
    repeatExact(fmt.w, o.tileW).forEach((w, c) => {
      let y = 0;
      splitExact(fmt.h, o.minH, o.maxH, rand).forEach((h, r) => { slots.push({ x, y, w, h, r, c }); y += h; });
      x += w;
    });
  }
  // Orden de lectura (arriba → abajo, izquierda → derecha) para el degradé de color.
  slots.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);
  return slots;
}

function sizeKey(w, h) { return w + 'x' + h; }

// Toma `count` elementos repartidos a lo largo de la lista ordenada,
// para que no desaparezca ningún tono entero.
function spreadPick(list, count) {
  const n = list.length;
  const out = [];
  for (let k = 0; k < count; k++) out.push(list[Math.floor((k * n) / count)]);
  return out;
}

// Dibuja una foto recortada al centro para cubrir el formato completo.
function drawCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
}

function buildMosaic() {
  const myId = ++buildId;
  if (uploadedImages.length === 0) {
    document.getElementById('canvas-holder').innerHTML = '';
    mosaicCanvas = null;
    current = null;
    prepareFile();
    downloadBtn.disabled = true;
    analysisCache = null;
    return;
  }

  const fmt = currentFormat();
  lastFormatName = fmt.name;
  const images = uploadedImages.slice();
  const opts = {
    varW: variableWCheckbox.checked,
    varH: variableHCheckbox.checked,
    tileW: tileWSnap.value(),
    tileH: tileHSnap.value(),
    minW: +minWidthSlider.value,
    maxW: +maxWidthSlider.value,
    minH: +minHeightSlider.value,
    maxH: +maxHeightSlider.value,
  };
  const planKey = JSON.stringify([fmt.w, fmt.h, opts, seed]);
  const rand = mulberry32(seed);

  // Si solo cambió el orden o la aleatoriedad, los colores ya están medidos.
  const cached = analysisCache && analysisCache.planKey === planKey &&
    analysisCache.images.length === images.length &&
    analysisCache.images.every((img, i) => img === images[i]);
  const slots = cached ? analysisCache.slots : planLayout(fmt, opts, rand);

  // Un lienzo de trabajo del tamaño del formato, reutilizado para cada foto.
  const work = document.createElement('canvas');
  work.width = fmt.w;
  work.height = fmt.h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.imageSmoothingQuality = 'high';

  // 1x1 scratch canvas: drawing a region scaled down to a single pixel
  // makes the browser do the color averaging for us, no manual pixel loop.
  const avgCanvas = document.createElement('canvas');
  avgCanvas.width = 1;
  avgCanvas.height = 1;
  const actx = avgCanvas.getContext('2d', { willReadFrequently: true });

  const candidates = cached ? analysisCache.candidates : []; // un candidato por (foto, espacio del plan)
  let imgIdx = 0, slotIdx = 0;
  const total = images.length * slots.length;
  const BATCH = 200;

  function processStep() {
    if (myId !== buildId) return; // llegó un cambio más nuevo
    try {
      let done = 0;
      while (done < BATCH && imgIdx < images.length) {
        if (slotIdx === 0) drawCover(wctx, images[imgIdx], fmt.w, fmt.h);
        const s = slots[slotIdx];
        actx.clearRect(0, 0, 1, 1);
        actx.drawImage(work, s.x, s.y, s.w, s.h, 0, 0, 1, 1);
        const avg = actx.getImageData(0, 0, 1, 1).data;
        const hsb = rgbToHsb(avg[0], avg[1], avg[2]);
        candidates.push({ img: imgIdx, sx: s.x, sy: s.y, w: s.w, h: s.h, h_: hsb.h, s: hsb.s, bri: hsb.bri });
        done++;
        if (++slotIdx === slots.length) { slotIdx = 0; imgIdx++; }
      }
      imgCount.textContent = 'Armando… ' + Math.round((candidates.length / total) * 100) + '%';
      if (imgIdx < images.length) {
        setTimeout(processStep, 0);
      } else {
        analysisCache = { planKey, images, slots, candidates };
        sortAndRender();
      }
    } catch (err) {
      console.error(err);
      imgCount.textContent = 'Ups, falló: ' + err.message;
    }
  }

  function sortAndRender() {
    if (myId !== buildId) return;
    const mode = getSortValue();
    const placed = mode === 'checker' ? placeChecker() : placeByColor(mode);

    const out = document.createElement('canvas');
    out.width = fmt.w;
    out.height = fmt.h;
    const octx = out.getContext('2d');
    images.forEach((img, i) => {
      const list = placed.filter(p => p.c.img === i);
      if (!list.length) return;
      drawCover(wctx, img, fmt.w, fmt.h);
      list.forEach(({ c, s }) => {
        // Copia píxel a píxel: mismo tamaño de origen y destino, sin estirar.
        octx.drawImage(work, c.sx, c.sy, c.w, c.h, s.x, s.y, s.w, s.h);
      });
    });
    showCanvas(out);
    current = { fmt, images, placed, octx, wctx, mode };

    imgCount.textContent = images.length + (images.length === 1 ? ' imagen' : ' imágenes') +
      ' · ' + slots.length + ' recortes · toca una foto para eliminarla';
    downloadBtn.disabled = false;
  }

  // Ajedrez: cada espacio toma el recorte del mismo lugar, de una foto distinta
  // que su vecino (las fotos se van intercalando como en un tablero).
  function placeChecker() {
    // "Mezclar de nuevo" cambia qué foto va en qué casilla
    const order = images.map((_, i) => i);
    const r = mulberry32(seed ^ 0x51ed270b);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return slots.map((s, j) => {
      const img = order[(s.r + s.c) % images.length];
      return { s, c: candidates[img * slots.length + j] };
    });
  }

  function placeByColor(mode) {
    const noiseRand = mulberry32(seed ^ 0x9e3779b9);
    const jitterAmount = parseInt(jitterSlider.value, 10) / 100; // 0..1

    // Build a single numeric sort key per mode, then blend in noise scaled
    // to that key's range. 0% jitter = strict sort, 100% = near shuffle.
    candidates.forEach(t => {
      let key;
      if (mode === 'hue') key = t.h_;                          // 0..360
      else if (mode === 'brightness') key = (1 - t.bri) * 360; // flip so low = bright, scale to 360
      else if (mode === 'saturation') key = (1 - t.s) * 360;
      else key = t.h_ + t.bri * 40;                            // hue-bright, small brightness nudge

      const noise = (noiseRand() - 0.5) * jitterAmount * 480; // up to ~±240 at max
      t.sortKey = key + noise;
    });
    // Se ordena una copia: la lista original guarda su orden para que el azar sea estable.
    const sorted = candidates.slice().sort((a, b) => a.sortKey - b.sortKey);

    // Por cada tamaño: los candidatos ordenados por color, y cuántos espacios hay.
    const pools = new Map();
    sorted.forEach(c => {
      const k = sizeKey(c.w, c.h);
      if (!pools.has(k)) pools.set(k, []);
      pools.get(k).push(c);
    });
    const need = new Map();
    slots.forEach(s => {
      const k = sizeKey(s.w, s.h);
      need.set(k, (need.get(k) || 0) + 1);
    });
    const queues = new Map();
    need.forEach((count, k) => queues.set(k, spreadPick(pools.get(k), count)));

    // Cada espacio (en orden de lectura) recibe el siguiente recorte de su tamaño.
    return slots.map(s => ({ s, c: queues.get(sizeKey(s.w, s.h)).shift() }));
  }

  if (cached) sortAndRender();
  else processStep();
}

function showCanvas(canvas) {
  const holder = document.getElementById('canvas-holder');
  holder.innerHTML = '';
  holder.appendChild(canvas);
  mosaicCanvas = canvas;
  selected = null;
  canvas.addEventListener('click', onTileClick);
  prepareFile();
}

// ---------- Intercambiar cuadrados a mano ----------
// Toca un cuadrado (queda marcado) y luego otro: se intercambian.
// Si tienen distinto tamaño, cada uno se recorta de nuevo desde su foto,
// centrado en el mismo punto, para que calce sin estirarse.

let current = null;   // lo que está dibujado: { fmt, images, placed, octx, wctx }
let selected = null;  // índice en current.placed del primer cuadrado tocado

function tileAt(e) {
  const rect = e.target.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (current.fmt.w / rect.width);
  const y = (e.clientY - rect.top) * (current.fmt.h / rect.height);
  return current.placed.findIndex(({ s }) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
}

// El mismo recorte, pero del tamaño de otro espacio
function recrop(c, w, h, fmt) {
  const cx = c.sx + c.w / 2, cy = c.sy + c.h / 2;
  return {
    ...c, w, h,
    sx: Math.max(0, Math.min(fmt.w - w, Math.round(cx - w / 2))),
    sy: Math.max(0, Math.min(fmt.h - h, Math.round(cy - h / 2))),
  };
}

function drawTile(p) {
  const { fmt, images, octx, wctx } = current;
  drawCover(wctx, images[p.c.img], fmt.w, fmt.h);
  octx.drawImage(wctx.canvas, p.c.sx, p.c.sy, p.c.w, p.c.h, p.s.x, p.s.y, p.s.w, p.s.h);
}

function markSelected() {
  const holder = document.getElementById('canvas-holder');
  let box = holder.querySelector('.tile-sel');
  if (selected === null) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'tile-sel'; holder.appendChild(box); }
  const k = mosaicCanvas.clientWidth / current.fmt.w;
  const { s } = current.placed[selected];
  Object.assign(box.style, {
    left: s.x * k + 'px', top: s.y * k + 'px', width: s.w * k + 'px', height: s.h * k + 'px',
  });
}

function onTileClick(e) {
  if (!current) return;
  const i = tileAt(e);
  if (i === -1) return;

  // Ajedrez: el cuadrado cambia al recorte del mismo lugar, de la siguiente foto
  if (current.mode === 'checker') {
    const p = current.placed[i];
    const img = (p.c.img + 1) % current.images.length;
    p.c = { img, sx: p.s.x, sy: p.s.y, w: p.s.w, h: p.s.h };
    drawTile(p);
    prepareFile();
    return;
  }
  if (selected === null || selected === i) {
    selected = selected === i ? null : i;   // tocar el mismo otra vez lo desmarca
  } else {
    const a = current.placed[selected], b = current.placed[i];
    const ca = a.c, cb = b.c;
    a.c = recrop(cb, a.s.w, a.s.h, current.fmt);
    b.c = recrop(ca, b.s.w, b.s.h, current.fmt);
    drawTile(a);
    drawTile(b);
    selected = null;
    prepareFile();
  }
  markSelected();
}
window.addEventListener('resize', markSelected);

// En "Ajedrez" la aleatoriedad no se usa: queda semitransparente
function syncJitter() {
  const off = getSortValue() === 'checker';
  document.getElementById('jitterField').classList.toggle('is-off', off);
  jitterSlider.disabled = off;
  document.getElementById('tapHint').textContent = off
    ? 'Toca un cuadrado del mosaico para cambiarlo por el mismo recorte de otra foto.'
    : 'Toca un cuadrado del mosaico y luego otro para intercambiarlos.';
}
document.querySelectorAll('input[name=sort]').forEach(r => r.addEventListener('change', syncJitter));
syncJitter();

// Pasos como carpetas: al tocar el título se abre (y se cierran las demás);
// tocar el título de la abierta la cierra.
const stepCards = document.querySelectorAll('.step-card');
stepCards.forEach(card => {
  const head = card.querySelector('.field-label');
  const toggle = () => {
    const open = !card.classList.contains('is-open');
    stepCards.forEach(c => {
      const isIt = c === card && open;
      c.classList.toggle('is-open', isIt);
      c.querySelector('.field-label').setAttribute('aria-expanded', isIt);
    });
  };
  head.setAttribute('aria-expanded', card.classList.contains('is-open'));
  head.addEventListener('click', toggle);
  head.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
});
