const DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTXyBuMZShW6A_T96cn-InrAbiv2ef9C4aEuVBewjqaaSaZ5Y8irlKwE3sKHwf4jA/pub?output=csv";

const OAHU_100_FALLBACK = [
  ["Y08", "Pineapple"], ["Y111", "Mustard"], ["Y26", "Light Gold"], ["Y27", "Sunflower"],
  ["Y28", "Corn Yellow"], ["Y29", "Melon Yellow"], ["Y210", "Pumpkin Yellow"], ["Y211", "Deep Yellow"],
  ["Y213", "Dark Marigold"], ["Y216", "Caramel"], ["Y315", "Olive Yellow"], ["Y415", "Sand Storm"],
  ["Y611", "Dark Sand"], ["YR02", "Peach Silk"], ["YR04", "Pastel Peach"], ["YR07", "Salmon Orange"],
  ["YR112", "Orange"], ["YR114", "Deep Sunset Orange"], ["YR33", "Rose Cream"], ["YR34", "Peach Cream"],
  ["YR39", "Cinnamon"], ["YR316", "Hazelnut Cocoa"], ["YR515", "Burnt Sienna"], ["E312", "Fennel Seed"],
  ["E511", "Chocolate Mocha"], ["E513", "Taupe Brown"], ["E613", "Reddish Brown"], ["E615", "Cherry Cola"],
  ["R014", "Deep Vermilion"], ["R015", "Crimson"], ["R16", "Light Salmon"], ["R111", "Hot Pink Carnation"],
  ["R28", "Pink Carnation"], ["R210", "Deep Blush"], ["R213", "Pomegranate"], ["R214", "Cranberry"],
  ["R215", "Morello Cherry"], ["R38", "Rose Pink"], ["R412", "Cerise"], ["R413", "Amaranth"],
  ["R510", "Wine Red"], ["RV08", "Pastel Pink"], ["RV17", "Pink"], ["RV19", "Dahlia Pink"],
  ["RV111", "Hot Pink"], ["RV212", "Rich Raspberry"], ["RV311", "Pansy"], ["RV313", "Dark Pansy"],
  ["RV314", "Grape Juice"], ["RV316", "Grape Jelly"], ["V010", "Faded Violet"], ["V18", "Bright Lavender"],
  ["V214", "Purple"], ["V38", "Deep Periwinkle"], ["BV26", "Pale Blue Violet"], ["BV38", "Sky Blue"],
  ["BV310", "Brilliant Blue"], ["BV314", "Lapis Lazuli"], ["BV315", "Cobalt Blue"], ["BV514", "Vintage Navy"],
  ["B08", "Cotton Candy Blue"], ["B010", "Blue Lagoon"], ["B111", "Pool Blue"], ["B114", "Cerulean Blue"],
  ["B115", "Classic Blue"], ["B315", "Deep Cerulean"], ["B411", "Rich Slate Blue"], ["B415", "Stormy Night"],
  ["BG05", "Light Sea Blue"], ["BG010", "Peacock Blue"], ["BG212", "Bright Pine Green"], ["BG311", "Turquoise"],
  ["BG312", "Deep Turquoise"], ["BG314", "Peacock Green"], ["BG315", "Castleton Green"], ["G213", "Rainforest Green"],
  ["G215", "Dark Green"], ["G310", "Shamrock Green"], ["G312", "Emerald Green"], ["G315", "Dark Emerald"],
  ["G316", "Deep Jade Green"], ["G49", "Sour Apple"], ["G410", "Grass Green"], ["YG012", "Yellow Green"],
  ["YG015", "Dark Olive"], ["YG414", "Dark Fern Green"], ["BGY05", "Shark Grey"], ["BGY08", "Gentlemans Grey"],
  ["YGY11", "Collingwood Grey"], ["WG10", "Porcelain"], ["WG27", "Antique Silver"], ["WG28", "Jet Grey"],
  ["WG36", "Deep Slate Grey"], ["GG05", "Evergreen Fog"], ["GG10", "Soft Cool Grey"], ["FY00", "Fluorescent Yellow"],
  ["FY01", "Fluorescent Orange"], ["FY02", "Fluorescent Red"], ["FY03", "Fluorescent Pink"], ["120", "Black"]
];

const OAHU_100_CODES = new Set(OAHU_100_FALLBACK.map(([code]) => code.toUpperCase()));
const FALLBACK_NAMES = new Map(OAHU_100_FALLBACK.map(([code, name]) => [code.toUpperCase(), name]));

const state = {
  markers: [],
  palette: [],
  locks: new Set(),
  mode: "generate",
  imageDataUrl: null,
  imageElement: null,
  printCards: [],
  loadingError: null,
};

const els = {
  loadPill: document.getElementById("loadPill"),
  loadText: document.getElementById("loadText"),
  generateTab: document.getElementById("generateTab"),
  imageTab: document.getElementById("imageTab"),
  generateControls: document.getElementById("generateControls"),
  imageControls: document.getElementById("imageControls"),
  styleSelect: document.getElementById("styleSelect"),
  sizeSelect: document.getElementById("sizeSelect"),
  generateButton: document.getElementById("generateButton"),
  refreshButton: document.getElementById("refreshButton"),
  paletteKicker: document.getElementById("paletteKicker"),
  paletteTitle: document.getElementById("paletteTitle"),
  paletteEmpty: document.getElementById("paletteEmpty"),
  paletteList: document.getElementById("paletteList"),
  paletteActions: document.getElementById("paletteActions"),
  copyButton: document.getElementById("copyButton"),
  sortButton: document.getElementById("sortButton"),
  addPrintButton: document.getElementById("addPrintButton"),
  imageInput: document.getElementById("imageInput"),
  uploadZone: document.getElementById("uploadZone"),
  uploadEmpty: document.getElementById("uploadEmpty"),
  imagePreview: document.getElementById("imagePreview"),
  matchButton: document.getElementById("matchButton"),
  savedGrid: document.getElementById("savedGrid"),
  savedEmpty: document.getElementById("savedEmpty"),
  clearPrintButton: document.getElementById("clearPrintButton"),
  printButton: document.getElementById("printButton"),
  printRoot: document.getElementById("printRoot"),
  markerSearch: document.getElementById("markerSearch"),
  markerGrid: document.getElementById("markerGrid"),
  resultCount: document.getElementById("resultCount"),
  sampleCanvas: document.getElementById("sampleCanvas"),
  toast: document.getElementById("toast"),
};

function initIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some(cell => cell.trim() !== "")) rows.push(row);
  return rows;
}

async function loadMarkerData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    const rows = parseCsv(await response.text()).slice(1);
    const byCode = new Map();

    for (const columns of rows) {
      const newNumber = (columns[0] || "").trim().toUpperCase();
      const newName = (columns[1] || "").trim();
      const oldNumber = (columns[4] || "").trim();
      const oldName = (columns[5] || "").trim();
      const hexRaw = (columns[8] || "").trim().replace(/^#/, "");
      const hex = /^[0-9a-fA-F]{6}$/.test(hexRaw) ? `#${hexRaw.toUpperCase()}` : null;

      if (!OAHU_100_CODES.has(newNumber) || !hex || !oldNumber) continue;
      byCode.set(newNumber, {
        code: newNumber,
        name: newName || FALLBACK_NAMES.get(newNumber) || newNumber,
        oldCode: oldNumber,
        oldName: oldName || "",
        hex,
      });
    }

    state.markers = OAHU_100_FALLBACK
      .map(([code, name]) => {
        const found = byCode.get(code.toUpperCase());
        return found ? { ...found, name: found.name || name } : null;
      })
      .filter(Boolean);

    if (state.markers.length !== 100) {
      throw new Error(`Expected 100 Oahu colours but loaded ${state.markers.length}.`);
    }

    state.loadingError = null;
    els.loadPill.className = "load-pill ready";
    els.loadText.textContent = "100 markers ready";
    renderMarkerBrowser();
    els.generateButton.disabled = false;
    els.matchButton.disabled = !state.imageElement;
  } catch (error) {
    console.error(error);
    state.loadingError = error;
    state.markers = [];
    els.loadPill.className = "load-pill error";
    els.loadText.textContent = "Marker data unavailable";
    els.generateButton.disabled = true;
    els.matchButton.disabled = true;
    els.resultCount.textContent = "Data unavailable";
    els.markerGrid.innerHTML = `<div class="saved-empty" style="grid-column:1/-1">Could not load the colour database. Reload the page and try again.</div>`;
  }
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const diff = max - min;
  let h = 0;

  if (diff !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / diff) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / diff + 2);
    else h = 60 * ((rr - gg) / diff + 4);
  }
  if (h < 0) h += 360;

  return {
    h,
    s: max === 0 ? 0 : (diff / max) * 100,
    v: max * 100,
  };
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function filterMarkers(style) {
  if (style === "random") return [...state.markers];

  if (style === "similar") {
    const seedHue = Math.random() * 360;
    return state.markers.filter(marker => hueDistance(hexToHsv(marker.hex).h, seedHue) <= 10);
  }

  return state.markers.filter(marker => {
    const hsv = hexToHsv(marker.hex);
    switch (style) {
      case "pastel": return hsv.s <= 30 && hsv.v >= 80;
      case "vivid": return hsv.s >= 50 && hsv.v >= 50;
      case "moody": return hsv.v <= 60;
      case "neutrals": return hsv.s <= 7 || (hsv.h >= 15 && hsv.h <= 50 && hsv.v <= 85);
      case "warm": return ((hsv.h >= 0 && hsv.h <= 50) || (hsv.h >= 340 && hsv.h <= 360)) && hsv.s >= 20;
      case "cool": return hsv.h >= 160 && hsv.h <= 280 && hsv.s >= 15;
      default: return true;
    }
  });
}

function randomUnique(items, count, excludedCodes = new Set()) {
  const pool = items.filter(item => !excludedCodes.has(item.code));
  const picked = [];

  while (pool.length && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function generatePalette() {
  if (!state.markers.length) return;
  const desired = Number(els.sizeSelect.value);
  const locked = state.palette.filter(marker => state.locks.has(marker.code));
  const lockedCodes = new Set(locked.map(marker => marker.code));
  let candidates = filterMarkers(els.styleSelect.value);

  if (candidates.length + locked.length < desired) {
    candidates = [...state.markers];
  }

  const fresh = randomUnique(candidates, Math.max(0, desired - locked.length), lockedCodes);
  state.palette = [...locked, ...fresh].slice(0, desired);
  state.mode = "generate";

  const label = els.styleSelect.options[els.styleSelect.selectedIndex].text;
  renderPalette(`${label} · ${state.palette.length} colours`, "Generated palette");
}

function renderPalette(title, kicker) {
  const hasPalette = state.palette.length > 0;
  els.paletteEmpty.hidden = hasPalette;
  els.paletteActions.hidden = !hasPalette;
  els.refreshButton.disabled = !hasPalette || !state.markers.length;
  els.paletteTitle.textContent = hasPalette ? title : "Ready to generate";
  els.paletteKicker.textContent = hasPalette ? kicker : "Current palette";
  els.paletteList.innerHTML = "";

  state.palette.forEach(marker => {
    const row = document.createElement("div");
    row.className = "palette-row";
    const locked = state.locks.has(marker.code);
    row.innerHTML = `
      <div class="colour-chip" style="background:${marker.hex}" aria-label="${escapeHtml(marker.name)} colour swatch"></div>
      <div class="marker-copy">
        <div class="marker-code">${escapeHtml(marker.code)}</div>
        <div class="marker-name">
          <strong>${escapeHtml(marker.name)}</strong>
          <span>${marker.oldCode ? `Old: ${escapeHtml(marker.oldCode)}${marker.oldName ? ` · ${escapeHtml(marker.oldName)}` : ""}` : ""}</span>
        </div>
      </div>
      <button class="lock-button ${locked ? "locked" : ""}" type="button" data-lock="${escapeHtml(marker.code)}" aria-label="${locked ? "Unlock" : "Lock"} ${escapeHtml(marker.code)}" title="${locked ? "Unlock" : "Lock"} colour">
        <i data-lucide="${locked ? "lock" : "unlock"}" aria-hidden="true"></i>
      </button>
    `;
    els.paletteList.appendChild(row);
  });

  initIcons();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMode(mode) {
  state.mode = mode;
  const isGenerate = mode === "generate";
  els.generateTab.classList.toggle("active", isGenerate);
  els.imageTab.classList.toggle("active", !isGenerate);
  els.generateTab.setAttribute("aria-selected", String(isGenerate));
  els.imageTab.setAttribute("aria-selected", String(!isGenerate));
  els.generateControls.classList.toggle("active", isGenerate);
  els.imageControls.classList.toggle("active", !isGenerate);
  els.generateControls.hidden = !isGenerate;
  els.imageControls.hidden = isGenerate;
}

function sortCurrentPalette() {
  state.palette.sort((a, b) => {
    const ah = hexToHsv(a.hex);
    const bh = hexToHsv(b.hex);
    if (ah.s < 7 && bh.s >= 7) return 1;
    if (bh.s < 7 && ah.s >= 7) return -1;
    return ah.h - bh.h || bh.v - ah.v;
  });
  renderPalette(els.paletteTitle.textContent, els.paletteKicker.textContent);
}

async function copyCodes() {
  const text = state.palette.map(marker => `${marker.code} ${marker.name}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    showToast("Palette codes copied");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("Palette codes copied");
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}

function renderMarkerBrowser(query = "") {
  if (!state.markers.length) return;
  const needle = query.trim().toLowerCase();
  const filtered = state.markers.filter(marker => {
    const haystack = `${marker.code} ${marker.name} ${marker.oldCode || ""} ${marker.oldName || ""}`.toLowerCase();
    return !needle || haystack.includes(needle);
  });

  const sorted = [...filtered].sort((a, b) => {
    const ah = hexToHsv(a.hex);
    const bh = hexToHsv(b.hex);
    if (ah.s < 7 && bh.s >= 7) return 1;
    if (bh.s < 7 && ah.s >= 7) return -1;
    return ah.h - bh.h || bh.v - ah.v;
  });

  els.resultCount.textContent = `${filtered.length} marker${filtered.length === 1 ? "" : "s"}`;
  els.markerGrid.innerHTML = sorted.map(marker => `
    <div class="marker-tile">
      <div class="marker-tile-swatch" style="background:${marker.hex}"></div>
      <div class="marker-tile-copy">
        <strong>${escapeHtml(marker.code)} · ${escapeHtml(marker.name)}</strong>
        <span>${marker.oldCode ? `Old ${escapeHtml(marker.oldCode)}` : ""}</span>
      </div>
    </div>
  `).join("");
}

function handleImageFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Choose an image file");
    return;
  }

  const reader = new FileReader();
  reader.onload = event => {
    const img = new Image();
    img.onload = () => {
      state.imageDataUrl = event.target.result;
      state.imageElement = img;
      els.imagePreview.src = state.imageDataUrl;
      els.imagePreview.hidden = false;
      els.uploadEmpty.hidden = true;
      els.matchButton.disabled = !state.markers.length;
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function rgbToLab(rgb) {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;
  const transform = value => value > 0.04045 ? Math.pow((value + 0.055) / 1.055, 2.4) : value / 12.92;
  r = transform(r);
  g = transform(g);
  b = transform(b);

  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = value => value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + (16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);

  return {
    l: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

function deltaE(a, b) {
  return Math.sqrt(
    Math.pow(a.l - b.l, 2) +
    Math.pow(a.a - b.a, 2) +
    Math.pow(a.b - b.b, 2)
  );
}

function extractDominantColours(img, count) {
  const canvas = els.sampleCanvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const maxSide = 110;
  const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 16) {
    const a = data[i + 3];
    if (a < 180) continue;
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    if (max > 248 && min > 248) continue;
    pixels.push(rgb);
  }

  if (!pixels.length) return [];

  const sorted = [...pixels].sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
  const centroids = Array.from({ length: count }, (_, index) => {
    const position = Math.min(sorted.length - 1, Math.floor(((index + 0.5) / count) * sorted.length));
    return { ...sorted[position] };
  });

  for (let iteration = 0; iteration < 10; iteration += 1) {
    const groups = Array.from({ length: count }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const pixel of pixels) {
      let best = 0;
      let bestDistance = Infinity;
      centroids.forEach((centroid, index) => {
        const distance = Math.pow(pixel.r - centroid.r, 2) + Math.pow(pixel.g - centroid.g, 2) + Math.pow(pixel.b - centroid.b, 2);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      const group = groups[best];
      group.r += pixel.r;
      group.g += pixel.g;
      group.b += pixel.b;
      group.n += 1;
    }

    groups.forEach((group, index) => {
      if (!group.n) return;
      centroids[index] = {
        r: Math.round(group.r / group.n),
        g: Math.round(group.g / group.n),
        b: Math.round(group.b / group.n),
      };
    });
  }

  return centroids;
}

function matchImageToMarkers() {
  if (!state.imageElement || !state.markers.length) return;
  const desired = Number(els.sizeSelect.value);
  const dominant = extractDominantColours(state.imageElement, desired + 2);
  const markerLabs = state.markers.map(marker => ({ marker, lab: rgbToLab(hexToRgb(marker.hex)) }));
  const used = new Set();
  const matches = [];

  for (const colour of dominant) {
    const target = rgbToLab(colour);
    const ranked = markerLabs
      .filter(entry => !used.has(entry.marker.code))
      .map(entry => ({ ...entry, distance: deltaE(target, entry.lab) }))
      .sort((a, b) => a.distance - b.distance);
    if (!ranked.length) break;
    used.add(ranked[0].marker.code);
    matches.push(ranked[0].marker);
    if (matches.length >= desired) break;
  }

  state.locks.clear();
  state.palette = matches;
  sortCurrentPalette();
  renderPalette(`Image match · ${matches.length} colours`, "Reference image palette");
}

function addPrintCard() {
  if (!state.palette.length) return;
  state.printCards.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    colours: state.palette.map(marker => ({ ...marker })),
    image: state.mode === "image" ? state.imageDataUrl : null,
  });
  renderPrintTray();
  showToast("Print card added");
}

function renderPrintTray() {
  const hasCards = state.printCards.length > 0;
  els.savedEmpty.hidden = hasCards;
  els.clearPrintButton.disabled = !hasCards;
  els.printButton.disabled = !hasCards;

  els.savedGrid.querySelectorAll(".saved-card").forEach(node => node.remove());
  state.printCards.forEach((card, index) => {
    const node = document.createElement("article");
    node.className = "saved-card";
    node.innerHTML = `
      ${card.image ? `<img class="saved-image" src="${card.image}" alt="Reference image">` : ""}
      <div class="saved-strip">${card.colours.map(colour => `<span style="background:${colour.hex}"></span>`).join("")}</div>
      <div class="saved-meta">Card ${index + 1} · ${card.colours.length} colours</div>
      <button class="saved-remove" type="button" data-remove-card="${card.id}" aria-label="Remove card ${index + 1}" title="Remove card">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
    `;
    els.savedGrid.appendChild(node);
  });
  initIcons();
  renderPrintRoot();
}

function renderPrintRoot() {
  const pages = [];
  for (let i = 0; i < state.printCards.length; i += 4) pages.push(state.printCards.slice(i, i + 4));

  els.printRoot.innerHTML = pages.map(page => `
    <section class="print-page">
      ${page.map(card => `
        <article class="print-card">
          ${card.image ? `<img class="print-card-image" src="${card.image}" alt="">` : ""}
          <div class="print-colours">
            ${card.colours.map(colour => `
              <div class="print-row">
                <span class="print-colour" style="background:${colour.hex}"></span>
                <span class="print-copy">
                  <strong class="print-code">${escapeHtml(colour.code)}</strong>
                  <span class="print-name">${escapeHtml(colour.name)}</span>
                </span>
                <span class="print-swatch"></span>
              </div>
            `).join("")}
          </div>
        </article>
      `).join("")}
    </section>
  `).join("");
}

function clearPrintCards() {
  state.printCards = [];
  renderPrintTray();
}

function refreshCurrent() {
  if (state.mode === "image" && state.imageElement) matchImageToMarkers();
  else generatePalette();
}

function attachEvents() {
  els.generateTab.addEventListener("click", () => setMode("generate"));
  els.imageTab.addEventListener("click", () => setMode("image"));
  els.generateButton.addEventListener("click", generatePalette);
  els.refreshButton.addEventListener("click", refreshCurrent);
  els.styleSelect.addEventListener("change", () => { if (state.palette.length && state.mode === "generate") generatePalette(); });
  els.sizeSelect.addEventListener("change", () => {
    if (state.palette.length) refreshCurrent();
  });

  els.paletteList.addEventListener("click", event => {
    const button = event.target.closest("[data-lock]");
    if (!button) return;
    const code = button.dataset.lock;
    if (state.locks.has(code)) state.locks.delete(code);
    else state.locks.add(code);
    renderPalette(els.paletteTitle.textContent, els.paletteKicker.textContent);
  });

  els.copyButton.addEventListener("click", copyCodes);
  els.sortButton.addEventListener("click", sortCurrentPalette);
  els.addPrintButton.addEventListener("click", addPrintCard);

  els.imageInput.addEventListener("change", event => handleImageFile(event.target.files[0]));
  els.matchButton.addEventListener("click", matchImageToMarkers);

  ["dragenter", "dragover"].forEach(type => els.uploadZone.addEventListener(type, event => {
    event.preventDefault();
    els.uploadZone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => els.uploadZone.addEventListener(type, event => {
    event.preventDefault();
    els.uploadZone.classList.remove("dragover");
  }));
  els.uploadZone.addEventListener("drop", event => handleImageFile(event.dataTransfer.files[0]));

  els.savedGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-card]");
    if (!button) return;
    state.printCards = state.printCards.filter(card => card.id !== button.dataset.removeCard);
    renderPrintTray();
  });

  els.clearPrintButton.addEventListener("click", clearPrintCards);
  els.printButton.addEventListener("click", () => {
    renderPrintRoot();
    window.print();
  });
  els.markerSearch.addEventListener("input", event => renderMarkerBrowser(event.target.value));
}

async function boot() {
  initIcons();
  attachEvents();
  els.generateButton.disabled = true;
  renderPrintTray();
  await loadMarkerData();
}

boot();
