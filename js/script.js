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
  const update = () => {
    fixedEl.hidden = checkbox.checked;
    varEl.hidden = !checkbox.checked;
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

document.querySelectorAll('.panel input, .panel select').forEach(el => {
  if (el.type === 'file') return;
  el.addEventListener(el.type === 'range' ? 'input' : 'change', () => scheduleBuild());
});
downloadBtn.addEventListener('click', () => {
  if (!mosaicCanvas) return;
  const link = document.createElement('a');
  link.download = 'mosaico-' + lastFormatName + '.png';
  link.href = mosaicCanvas.toDataURL('image/png');
  link.click();
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
    heights.forEach(h => {
      const widths = o.varW ? splitExact(fmt.w, o.minW, o.maxW, rand) : repeatExact(fmt.w, o.tileW);
      let x = 0;
      widths.forEach(w => { slots.push({ x, y, w, h }); x += w; });
      y += h;
    });
  } else {
    // Ancho fijo y altos variados: por columnas, cada una de arriba a abajo.
    let x = 0;
    repeatExact(fmt.w, o.tileW).forEach(w => {
      let y = 0;
      splitExact(fmt.h, o.minH, o.maxH, rand).forEach(h => { slots.push({ x, y, w, h }); y += h; });
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
    const noiseRand = mulberry32(seed ^ 0x9e3779b9);
    const mode = getSortValue();
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
    const byImage = images.map(() => []);
    slots.forEach(s => {
      const c = queues.get(sizeKey(s.w, s.h)).shift();
      byImage[c.img].push({ c, s });
    });

    const out = document.createElement('canvas');
    out.width = fmt.w;
    out.height = fmt.h;
    const octx = out.getContext('2d');
    byImage.forEach((list, i) => {
      if (!list.length) return;
      drawCover(wctx, images[i], fmt.w, fmt.h);
      list.forEach(({ c, s }) => {
        // Copia píxel a píxel: mismo tamaño de origen y destino, sin estirar.
        octx.drawImage(work, c.sx, c.sy, c.w, c.h, s.x, s.y, s.w, s.h);
      });
    });
    showCanvas(out);

    imgCount.textContent = images.length + (images.length === 1 ? ' imagen' : ' imágenes') +
      ' · ' + slots.length + ' recortes · toca una foto para eliminarla';
    downloadBtn.disabled = false;
  }

  if (cached) sortAndRender();
  else processStep();
}

function showCanvas(canvas) {
  const holder = document.getElementById('canvas-holder');
  holder.innerHTML = '';
  holder.appendChild(canvas);
  mosaicCanvas = canvas;
}
