const PHOTO_SUBJECTS = [
  "cozy bakery interior", "flower market", "botanical garden", "coffee shop interior", "fruit market", "seaside village", "vintage kitchen", "greenhouse plants", "ice cream shop", "tea shop", "bookstore interior", "farmers market", "ceramic pottery", "wildflower meadow", "autumn forest", "winter cabin interior", "Mediterranean food", "Japanese restaurant food", "pastry display", "candy shop", "linen bedroom", "colourful front doors", "picnic food", "garden shed", "coastal house", "rainy city street", "fresh vegetables", "berry dessert", "sushi plate", "ramen bowl", "pizza restaurant", "vintage sewing room", "art studio desk", "home office desk", "plant shop", "antique shop", "record store", "beach umbrellas", "fishing village", "country garden", "apple orchard", "pumpkin market", "Christmas interior", "spring flowers", "summer fruit", "colourful houses", "farmhouse table", "spice market", "macarons", "books and coffee", "bathroom spa", "laundry room interior", "wood workshop", "toy shop", "clothing boutique", "market stall", "cafe exterior", "sunlit room", "painted pottery", "flower bouquet"
];

const state = {
  markers: [], palettes: [], running: false, stopRequested: false,
  attempts: 0, rejected: 0, sourceCursor: 0, usedPhotoIds: new Set()
};
const els = {};
const STORAGE_KEY = "oahu-photo-palettes-v3";
const $ = id => document.getElementById(id);

function init() {
  ["generateButton","stopButton","targetCount","progressWrap","progressLabel","progressMeta","progressBar","sourceStatus","paletteGrid","emptyState","libraryCopy","printButton","clearButton","markerGrid","toast"].forEach(id => els[id] = $(id));
  state.markers = (window.OAHU_MARKERS || []).map(marker => ({ ...marker, oklab: hexToOklab(marker.hex) }));
  restorePalettes();
  renderMarkerBrowser();
  renderPalettes();
  els.generateButton.addEventListener("click", generateBatch);
  els.stopButton.addEventListener("click", () => state.stopRequested = true);
  els.printButton.addEventListener("click", () => window.print());
  els.clearButton.addEventListener("click", clearPalettes);
  refreshIcons();
}

function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
function setBusy(busy, text = "Ready") {
  state.running = busy;
  els.generateButton.disabled = busy;
  els.targetCount.disabled = busy;
  els.stopButton.hidden = !busy;
  els.sourceStatus.classList.toggle("busy", busy);
  els.sourceStatus.querySelector("span:last-child").textContent = text;
}

async function generateBatch() {
  if (state.running || !state.markers.length) return;
  const target = Number(els.targetCount.value || 24);
  const startingCount = state.palettes.length;
  const goalCount = startingCount + target;
  const maxAttempts = Math.max(target * 42, 240);
  state.stopRequested = false;
  state.attempts = 0;
  state.rejected = 0;
  els.progressWrap.hidden = false;
  setBusy(true, "Searching Unsplash");

  try {
    while (!state.stopRequested && state.palettes.length < goalCount && state.attempts < maxAttempts) {
      const subject = nextSubject();
      updateProgress(startingCount, goalCount, subject);
      const photos = await sourcePhotos(subject).catch(error => {
        console.warn("Photo sourcing failed", error);
        return [];
      });
      if (!photos.length) {
        state.attempts += 1;
        state.rejected += 1;
        continue;
      }

      shuffle(photos);
      for (const photo of photos.slice(0, 14)) {
        if (state.stopRequested || state.palettes.length >= goalCount || state.attempts >= maxAttempts) break;
        if (state.usedPhotoIds.has(String(photo.id))) continue;
        state.attempts += 1;
        updateProgress(startingCount, goalCount, subject);
        try {
          const analysis = await analysePhoto(photo);
          if (!analysis || analysis.score < 85 || analysis.markers.length !== 6 || analysis.originals.length !== 6) {
            state.rejected += 1;
            continue;
          }
          const candidate = {
            id: `${photo.source}-${photo.id}`,
            photoId: String(photo.id),
            subject,
            image: photo.image,
            sourceUrl: photo.sourceUrl,
            source: photo.source,
            creator: photo.creator || "Unknown creator",
            licence: photo.licence || "See source",
            score: Math.round(analysis.score),
            markers: analysis.markers.map(marker => ({ code: marker.code, name: marker.name || marker.code, hex: marker.hex })),
            originals: analysis.originals.map(hex => ({ hex })),
            complexity: analysis.complexity || null,
            createdAt: Date.now()
          };
          if (isDuplicatePalette(candidate)) {
            state.rejected += 1;
            continue;
          }
          state.palettes.unshift(candidate);
          state.usedPhotoIds.add(String(photo.id));
          persistPalettes();
          renderPalettes();
        } catch (error) {
          console.warn("Photo analysis failed", error);
          state.rejected += 1;
        }
      }
    }

    const made = state.palettes.length - startingCount;
    if (state.stopRequested) showToast(`Stopped after ${made} palette${made === 1 ? "" : "s"}.`);
    else if (made < target) showToast(`Created ${made} strong palettes before the quality limit was reached.`);
    else showToast(`Created ${made} photo palettes.`);
  } finally {
    updateProgress(startingCount, goalCount, "Complete");
    setBusy(false, "Ready");
    setTimeout(() => els.progressWrap.hidden = true, 900);
  }
}

function nextSubject() {
  if (state.sourceCursor % PHOTO_SUBJECTS.length === 0) shuffle(PHOTO_SUBJECTS);
  return PHOTO_SUBJECTS[state.sourceCursor++ % PHOTO_SUBJECTS.length];
}

async function sourcePhotos() { return []; }

async function analysePhoto(photo) {
  const image = await loadCorsImage(photo.image);
  const samples = sampleImage(image, 88);
  if (samples.length < 300 || !state.markers.length) return null;
  const clusters = kMeans(samples, 14, 8);
  const mapped = mapClustersToMarkers(clusters);
  if (mapped.length < 6) return null;
  const markers = choosePalette(mapped, 6);
  if (markers.length < 6) return null;

  let averageDistance = 0;
  let closeCoverage = 0;
  clusters.forEach(cluster => {
    const nearest = nearestMarker(cluster.lab);
    averageDistance += nearest.distance * cluster.weight;
    if (nearest.distance <= .075) closeCoverage += cluster.weight;
  });
  const closeness = clamp(100 * (1 - averageDistance / .145), 0, 100);
  const coverage = closeCoverage * 100;
  const distinctness = paletteDistinctness(markers) * 100;
  return { score: closeness * .58 + coverage * .27 + distinctness * .15, markers, originals: [] };
}

function sampleImage(image, size) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const ratio = image.naturalWidth / image.naturalHeight;
  canvas.width = ratio >= 1 ? size : Math.max(40, Math.round(size * ratio));
  canvas.height = ratio >= 1 ? Math.max(40, Math.round(size / ratio)) : size;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples = [];
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 230) continue;
    const lab = rgbToOklab(data[i], data[i + 1], data[i + 2]);
    if (lab.L > .035 && lab.L < .985) samples.push(lab);
  }
  return samples;
}

function kMeans(samples, k, iterations) {
  if (samples.length < k) return [];
  const sorted = [...samples].sort((a, b) => a.L - b.L);
  const centers = Array.from({ length: k }, (_, i) => ({ ...sorted[Math.min(sorted.length - 1, Math.floor((i + .5) * sorted.length / k))] }));
  let assignments = new Array(samples.length).fill(0);

  for (let iteration = 0; iteration < iterations; iteration++) {
    const sums = Array.from({ length: k }, () => ({ L: 0, a: 0, b: 0, count: 0 }));
    samples.forEach((sample, index) => {
      let best = 0, bestDistance = Infinity;
      centers.forEach((center, c) => {
        const distance = oklabDistance(sample, center);
        if (distance < bestDistance) { bestDistance = distance; best = c; }
      });
      assignments[index] = best;
      sums[best].L += sample.L;
      sums[best].a += sample.a;
      sums[best].b += sample.b;
      sums[best].count += 1;
    });
    sums.forEach((sum, i) => {
      if (sum.count) centers[i] = { L: sum.L / sum.count, a: sum.a / sum.count, b: sum.b / sum.count };
    });
  }

  const counts = new Array(k).fill(0);
  assignments.forEach(index => counts[index]++);
  return centers.map((lab, i) => ({ lab, weight: counts[i] / assignments.length }))
    .filter(cluster => cluster.weight >= .008)
    .sort((a, b) => b.weight - a.weight);
}

function mapClustersToMarkers(clusters) {
  const merged = new Map();
  clusters.forEach(cluster => {
    const match = nearestMarker(cluster.lab);
    const item = merged.get(match.marker.code) || { marker: match.marker, weight: 0, distance: 0, chroma: 0 };
    item.weight += cluster.weight;
    item.distance += match.distance * cluster.weight;
    item.chroma = Math.max(item.chroma, Math.hypot(cluster.lab.a, cluster.lab.b));
    merged.set(match.marker.code, item);
  });
  return [...merged.values()].sort((a, b) => b.weight - a.weight);
}

function choosePalette(mapped, count) {
  const selected = [];
  const pool = mapped.slice(0, 18);
  while (selected.length < count && pool.length) {
    let bestIndex = 0, bestScore = -Infinity;
    pool.forEach((candidate, index) => {
      const separation = selected.length ? Math.min(...selected.map(item => oklabDistance(item.marker.oklab, candidate.marker.oklab))) : .12;
      const lightness = selected.length ? Math.min(...selected.map(item => Math.abs(item.marker.oklab.L - candidate.marker.oklab.L))) : .12;
      const score = candidate.weight * 2.9 + candidate.chroma * .35 - candidate.distance * .35 + Math.min(separation, .18) * 1.5 + Math.min(lightness, .22) * .35;
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    const chosen = pool.splice(bestIndex, 1)[0];
    if (!selected.length || Math.min(...selected.map(item => oklabDistance(item.marker.oklab, chosen.marker.oklab))) >= .028) selected.push(chosen);
  }
  mapped.forEach(candidate => {
    if (selected.length < count && !selected.some(item => item.marker.code === candidate.marker.code)) selected.push(candidate);
  });
  return selected.slice(0, count).map(item => item.marker).sort((a, b) => a.oklab.L - b.oklab.L);
}

function paletteDistinctness(markers) {
  let total = 0, pairs = 0;
  for (let i = 0; i < markers.length; i++) for (let j = i + 1; j < markers.length; j++) {
    total += Math.min(oklabDistance(markers[i].oklab, markers[j].oklab) / .18, 1);
    pairs++;
  }
  return pairs ? total / pairs : 0;
}

function nearestMarker(lab) {
  let marker = state.markers[0], distance = Infinity;
  state.markers.forEach(candidate => {
    const next = oklabDistance(lab, candidate.oklab);
    if (next < distance) { marker = candidate; distance = next; }
  });
  return { marker, distance };
}

function isDuplicatePalette(candidate) {
  const codes = new Set(candidate.markers.map(marker => marker.code));
  return state.palettes.some(existing => {
    const existingCodes = new Set(existing.markers.map(marker => marker.code));
    let overlap = 0;
    codes.forEach(code => { if (existingCodes.has(code)) overlap++; });
    return overlap >= 5;
  });
}

function renderPalettes() {
  els.paletteGrid.innerHTML = "";
  els.emptyState.hidden = state.palettes.length > 0;
  els.printButton.disabled = els.clearButton.disabled = state.palettes.length === 0;
  els.libraryCopy.textContent = state.palettes.length ? `${state.palettes.length} automatically generated palette${state.palettes.length === 1 ? "" : "s"}.` : "No generated palettes yet.";
}

function renderMarkerBrowser() {
  els.markerGrid.innerHTML = state.markers.map(marker => `<div class="marker-chip"><div class="marker-colour" style="background:${marker.hex}"></div><span class="marker-code">${marker.code}</span></div>`).join("");
}

function updateProgress(startingCount, goalCount, subject) {
  const made = Math.max(0, state.palettes.length - startingCount);
  const target = Math.max(1, goalCount - startingCount);
  els.progressBar.style.width = `${clamp(made / target * 100, 0, 100)}%`;
  els.progressLabel.textContent = made >= target ? "Batch complete" : `Finding ${titleCase(subject)}`;
  els.progressMeta.textContent = `${made}/${target} kept · ${state.rejected} rejected`;
}

function removePalette(id) {
  state.palettes = state.palettes.filter(palette => palette.id !== id);
  persistPalettes();
  renderPalettes();
}
function clearPalettes() {
  state.palettes = [];
  state.usedPhotoIds.clear();
  persistPalettes();
  renderPalettes();
  showToast("Generated palettes cleared.");
}
function persistPalettes() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.palettes.slice(0, 160))); }
  catch (error) { console.warn("Could not save palettes", error); }
}
function restorePalettes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return;
    state.palettes = saved.filter(item => item?.image && Array.isArray(item.markers) && item.markers.length === 6 && Array.isArray(item.originals) && item.originals.length === 6);
    state.palettes.forEach(item => state.usedPhotoIds.add(String(item.photoId || item.id)));
  } catch (error) { console.warn("Could not restore palettes", error); }
}

async function loadCorsImage(url) {
  const response = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!response.ok) throw new Error(`Image ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });
  } finally { setTimeout(() => URL.revokeObjectURL(objectUrl), 5000); }
}

function rgbToOklab(r, g, b) {
  const [R, G, B] = [r, g, b].map(value => {
    const x = value / 255;
    return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
  });
  const l = .4122214708 * R + .5363325363 * G + .0514459929 * B;
  const m = .2119034982 * R + .6806995451 * G + .1073969566 * B;
  const s = .0883024619 * R + .2817188376 * G + .6299787005 * B;
  const l3 = Math.cbrt(l), m3 = Math.cbrt(m), s3 = Math.cbrt(s);
  return { L: .2104542553*l3 + .793617785*m3 - .0040720468*s3, a: 1.9779984951*l3 - 2.428592205*m3 + .4505937099*s3, b: .0259040371*l3 + .7827717662*m3 - .808675766*s3 };
}
function hexToOklab(hex) {
  const value = hex.replace("#", "");
  return rgbToOklab(parseInt(value.slice(0,2),16), parseInt(value.slice(2,4),16), parseInt(value.slice(4,6),16));
}
function oklabDistance(a, b) { return Math.hypot(a.L-b.L, a.a-b.a, a.b-b.b); }
function contrastText(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0,2),16), g = parseInt(value.slice(2,4),16), b = parseInt(value.slice(4,6),16);
  return ((.2126*r + .7152*g + .0722*b) / 255) > .6 ? "#151612" : "#ffffff";
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char])); }
function escapeAttr(value) { return escapeHtml(value); }
function titleCase(value) { return String(value || "").replace(/\b\w/g, char => char.toUpperCase()); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

document.addEventListener("DOMContentLoaded", init);
