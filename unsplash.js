(() => {
  const KEY_STORAGE = "oahu-unsplash-access-key";
  const THRESHOLD_STORAGE = "oahu-match-threshold";
  const MIN_MATCH_SCORE = 85;
  const MAX_MATCH_SCORE = 100;
  const MARKER_DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTXyBuMZShW6A_T96cn-InrAbiv2ef9C4aEuVBewjqaaSaZ5Y8irlKwE3sKHwf4jA/pub?output=csv";

  const ORIGINAL_PALETTE_SEARCHES = [
    "Berry Cream", "Midnight Cream", "Soft Garden", "Peach Sorbet", "Poolside", "Candy Sky",
    "Retro Diner", "Ember Glow", "Olive Orchard", "Forest Gold", "Vintage Rose", "Orchid Pop",
    "Blush Clay", "Sea Glass", "Natural Linen", "Spring Meadow", "Electric Garden", "Deep Riviera",
    "Lavender Smoke", "Teal Stone", "Cozy Bedroom", "Pet Shop", "Holiday Boutique", "Coffee Shop",
    "Yard Sale", "Spa Bath", "Ice Cream Truck", "Farmers Market", "Sewing Room", "Juice Bar",
    "Flower Stall", "Home Office", "Nursery", "Bakery", "Cat Fish Shop", "Art Desk", "Beauty Vanity",
    "Gym", "Home Kitchen", "Workshop", "Laundry Room", "Thank You Desk", "Ramen Night", "Autumn Magic",
    "Pizza Kitchen", "Lovely Bakery", "Sleepy Bedroom", "Farm Garden", "Sushi Bar", "Bubble Tea",
    "Halloween Toy Shop", "Cozy Closet", "Christmas Fireplace"
  ];

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

  const OAHU_CODES = new Set(OAHU_100_FALLBACK.map(([code]) => code));
  const FALLBACK_NAMES = new Map(OAHU_100_FALLBACK);
  const originalSetBusy = setBusy;

  if (Array.isArray(PHOTO_SUBJECTS)) {
    const existing = new Set(PHOTO_SUBJECTS.map(item => item.toLowerCase()));
    ORIGINAL_PALETTE_SEARCHES.forEach(name => {
      if (!existing.has(name.toLowerCase())) PHOTO_SUBJECTS.push(name);
    });
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

  async function loadOriginalMarkerData() {
    const response = await fetch(MARKER_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Marker data ${response.status}`);
    const rows = parseCsv(await response.text()).slice(1);
    const byCode = new Map();

    rows.forEach(columns => {
      const code = (columns[0] || "").trim().toUpperCase();
      const name = (columns[1] || "").trim();
      const hexRaw = (columns[8] || "").trim().replace(/^#/, "");
      const hex = /^[0-9a-fA-F]{6}$/.test(hexRaw) ? `#${hexRaw.toUpperCase()}` : null;
      if (!OAHU_CODES.has(code) || !hex) return;
      byCode.set(code, { code, name: name || FALLBACK_NAMES.get(code) || code, hex });
    });

    const markers = OAHU_100_FALLBACK.map(([code, name]) => {
      const found = byCode.get(code);
      return found ? { ...found, name: found.name || name } : null;
    }).filter(Boolean);

    if (markers.length !== 100) throw new Error(`Expected 100 original marker colours, received ${markers.length}.`);
    state.markers = markers.map(marker => ({ ...marker, oklab: hexToOklab(marker.hex) }));
    window.OAHU_MARKERS = Object.freeze(markers.map(marker => Object.freeze({ ...marker })));
    renderMarkerBrowser();
  }

  function getMatchThreshold() {
    const slider = document.getElementById("matchThreshold");
    const stored = Number(localStorage.getItem(THRESHOLD_STORAGE));
    const raw = slider ? Number(slider.value) : stored;
    const value = Number.isFinite(raw) ? raw : MIN_MATCH_SCORE;
    return Math.max(MIN_MATCH_SCORE, Math.min(MAX_MATCH_SCORE, Math.round(value)));
  }

  function updateThresholdUi() {
    const slider = document.getElementById("matchThreshold");
    const output = document.getElementById("matchThresholdValue");
    const threshold = getMatchThreshold();
    if (slider && Number(slider.value) !== threshold) slider.value = String(threshold);
    if (output) output.textContent = `${threshold}%`;
  }

  async function fetchUnsplashPhotos(subject, accessKey) {
    const params = new URLSearchParams({
      query: subject,
      page: "1",
      per_page: "30",
      orientation: "landscape",
      content_filter: "high",
      order_by: "relevant"
    });

    const response = await fetch(`https://api.unsplash.com/search/photos?${params.toString()}`, {
      headers: {
        "Accept-Version": "v1",
        "Authorization": `Client-ID ${accessKey}`
      }
    });

    if (!response.ok) throw new Error(`Unsplash ${response.status}`);
    const data = await response.json();

    return (data.results || [])
      .filter(photo => photo.urls?.regular && Number(photo.width) >= 900 && Number(photo.height) >= 650)
      .map(photo => ({
        id: `unsplash-${photo.id}`,
        image: photo.urls.regular,
        sourceUrl: photo.links?.html
          ? `${photo.links.html}${photo.links.html.includes("?") ? "&" : "?"}utm_source=myplexscripts_photo_palette_maker&utm_medium=referral`
          : "https://unsplash.com/",
        source: "Unsplash",
        creator: photo.user?.name || photo.user?.username || "Unsplash photographer",
        licence: "Unsplash license"
      }));
  }

  sourcePhotos = async function sourcePhotosFromUnsplash(subject) {
    const accessKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    if (!accessKey) return [];
    return fetchUnsplashPhotos(subject, accessKey);
  };

  function mapClustersToCandidates(clusters) {
    const merged = new Map();

    clusters.forEach(cluster => {
      const match = nearestMarker(cluster.lab);
      const item = merged.get(match.marker.code) || {
        marker: match.marker,
        weight: 0,
        distanceWeight: 0,
        chroma: 0,
        sourceL: 0,
        sourceA: 0,
        sourceB: 0
      };
      item.weight += cluster.weight;
      item.distanceWeight += match.distance * cluster.weight;
      item.chroma = Math.max(item.chroma, Math.hypot(cluster.lab.a, cluster.lab.b));
      item.sourceL += cluster.lab.L * cluster.weight;
      item.sourceA += cluster.lab.a * cluster.weight;
      item.sourceB += cluster.lab.b * cluster.weight;
      merged.set(match.marker.code, item);
    });

    return [...merged.values()].map(item => ({
      ...item,
      averageDistance: item.distanceWeight / Math.max(item.weight, .0001),
      originalLab: {
        L: item.sourceL / Math.max(item.weight, .0001),
        a: item.sourceA / Math.max(item.weight, .0001),
        b: item.sourceB / Math.max(item.weight, .0001)
      }
    })).sort((a, b) => b.weight - a.weight);
  }

  function chooseCandidatePalette(mapped, count) {
    const selected = [];
    const pool = mapped.slice(0, 18);

    while (selected.length < count && pool.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      pool.forEach((candidate, index) => {
        const separation = selected.length
          ? Math.min(...selected.map(item => oklabDistance(item.marker.oklab, candidate.marker.oklab)))
          : .12;
        const lightness = selected.length
          ? Math.min(...selected.map(item => Math.abs(item.originalLab.L - candidate.originalLab.L)))
          : .12;
        const score = candidate.weight * 3.2
          + candidate.chroma * .35
          - candidate.averageDistance * .45
          + Math.min(separation, .18) * 1.45
          + Math.min(lightness, .22) * .35;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      const chosen = pool.splice(bestIndex, 1)[0];
      const farEnough = !selected.length || Math.min(...selected.map(item => oklabDistance(item.marker.oklab, chosen.marker.oklab))) >= .028;
      if (farEnough) selected.push(chosen);
    }

    mapped.forEach(candidate => {
      if (selected.length < count && !selected.some(item => item.marker.code === candidate.marker.code)) selected.push(candidate);
    });

    return selected.slice(0, count).sort((a, b) => a.originalLab.L - b.originalLab.L);
  }

  function countMeaningfulColours(clusters) {
    const representatives = [];
    clusters.filter(cluster => cluster.weight >= .025).forEach(cluster => {
      if (representatives.every(existing => oklabDistance(existing.lab, cluster.lab) > .055)) representatives.push(cluster);
    });
    return representatives.length;
  }

  function measureSixColourCompression(clusters) {
    const anchors = clusters.slice(0, 6);
    if (anchors.length < 6) return { reject: true, dominantCoverage: 0, outlierMass: 1, compressionError: 1, distinctCount: 0 };

    const dominantCoverage = anchors.reduce((sum, cluster) => sum + cluster.weight, 0);
    let outlierMass = 0;
    let compressionError = 0;

    clusters.forEach(cluster => {
      const nearest = Math.min(...anchors.map(anchor => oklabDistance(cluster.lab, anchor.lab)));
      compressionError += nearest * cluster.weight;
      if (nearest > .07) outlierMass += cluster.weight;
    });

    const distinctCount = countMeaningfulColours(clusters);
    const reject = outlierMass > .26
      || compressionError > .075
      || (distinctCount > 8 && outlierMass > .15 && dominantCoverage < .78);

    return { reject, dominantCoverage, outlierMass, compressionError, distinctCount };
  }

  function oklabToHex(lab) {
    const l_ = lab.L + .3963377774 * lab.a + .2158037573 * lab.b;
    const m_ = lab.L - .1055613458 * lab.a - .0638541728 * lab.b;
    const s_ = lab.L - .0894841775 * lab.a - 1.291485548 * lab.b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    let r = 4.0767416621 * l - 3.3077115913 * m + .2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s;
    let b = -.0041960863 * l - .7034186147 * m + 1.707614701 * s;

    const encode = value => {
      const clamped = Math.max(0, Math.min(1, value));
      const srgb = clamped <= .0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - .055;
      return Math.max(0, Math.min(255, Math.round(srgb * 255)));
    };
    const toHex = value => encode(value).toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  analysePhoto = async function analysePhotoForCard(photo) {
    if (!state.markers.length) return null;
    const image = await loadCorsImage(photo.image);
    const samples = sampleImage(image, 96);
    if (samples.length < 300) return null;

    const clusters = kMeans(samples, 12, 10);
    if (clusters.length < 6) return null;

    const complexity = measureSixColourCompression(clusters);
    if (complexity.reject) return null;

    const mapped = mapClustersToCandidates(clusters);
    if (mapped.length < 6) return null;
    const selected = chooseCandidatePalette(mapped, 6);
    if (selected.length !== 6) return null;

    let averageDistance = 0;
    let closeCoverage = 0;
    clusters.forEach(cluster => {
      const nearest = nearestMarker(cluster.lab);
      averageDistance += nearest.distance * cluster.weight;
      if (nearest.distance <= .075) closeCoverage += cluster.weight;
    });

    const markers = selected.map(item => item.marker);
    const originals = selected.map(item => oklabToHex(item.originalLab));
    const closeness = clamp(100 * (1 - averageDistance / .145), 0, 100);
    const coverage = closeCoverage * 100;
    const distinctness = paletteDistinctness(markers) * 100;
    const score = closeness * .58 + coverage * .27 + distinctness * .15;

    if (score < getMatchThreshold()) return null;
    return { score, markers, originals, complexity };
  };

  function buildBackRows(palette) {
    return palette.markers.map((marker, index) => {
      const original = palette.originals[index]?.hex || "#FFFFFF";
      return `
        <div class="back-swatch-row">
          <div class="back-marker-colour" style="background:${marker.hex}"></div>
          <div class="back-marker-copy">
            <strong>${escapeHtml(marker.code)}</strong>
            <span>${escapeHtml(marker.name || marker.code)}</span>
          </div>
          <div class="back-original-colour" style="background:${original}"></div>
        </div>`;
    }).join("");
  }

  renderPalettes = function renderPhotoCards() {
    const threshold = getMatchThreshold();
    const visible = state.palettes.filter(palette =>
      palette?.source === "Unsplash"
      && Number(palette.score) >= threshold
      && Array.isArray(palette.originals)
      && palette.originals.length === 6
      && Array.isArray(palette.markers)
      && palette.markers.length === 6
    );

    els.paletteGrid.innerHTML = "";
    els.emptyState.hidden = visible.length > 0;
    els.printButton.disabled = els.clearButton.disabled = state.palettes.length === 0;
    els.libraryCopy.textContent = visible.length
      ? `${visible.length} palette${visible.length === 1 ? "" : "s"} at ${threshold}% or higher.`
      : `No saved palettes meet the ${threshold}% minimum.`;

    visible.forEach(palette => {
      const article = document.createElement("article");
      article.className = "palette-card palette-card-double";
      article.dataset.face = "front";
      article.innerHTML = `
        <section class="card-face card-front" aria-label="Palette card front">
          <div class="photo-wrap">
            <img src="${escapeAttr(palette.image)}" alt="Source photo for ${escapeAttr(palette.subject)}" loading="lazy" referrerpolicy="no-referrer">
            <span class="score-badge">${palette.score}% match</span>
          </div>
          <div class="front-swatch-stack" aria-label="Original and marker matched colours">
            <div class="front-swatch-row original-swatch-row">${palette.originals.map(original => `<div class="front-swatch" style="background:${original.hex}" title="Original sampled colour ${original.hex}"></div>`).join("")}</div>
            <div class="front-swatch-row matched-swatch-row">${palette.markers.map(marker => `<div class="front-swatch" style="background:${marker.hex}" title="${escapeAttr(`${marker.code} ${marker.name || ""}`)}"></div>`).join("")}</div>
          </div>
          <div class="palette-meta"><strong>${escapeHtml(titleCase(palette.subject))}</strong><span>${escapeHtml(palette.licence || palette.source)}</span></div>
          <div class="card-footer card-controls">
            <a class="source-link" href="${escapeAttr(palette.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(`${palette.source} · ${palette.creator}`)}</a>
            <div class="card-action-group">
              <button class="card-flip secondary-button" type="button"><i data-lucide="rotate-cw"></i><span>Back</span></button>
              <button class="card-remove" type="button" aria-label="Remove palette"><i data-lucide="x"></i></button>
            </div>
          </div>
        </section>
        <section class="card-face card-back" aria-label="Palette card back">
          <div class="back-palette-grid">${buildBackRows(palette)}</div>
          <div class="back-card-footer card-controls">
            <button class="card-flip secondary-button" type="button"><i data-lucide="rotate-ccw"></i><span>Front</span></button>
          </div>
        </section>`;

      article.querySelectorAll(".card-flip").forEach(button => {
        button.addEventListener("click", () => {
          article.dataset.face = article.dataset.face === "front" ? "back" : "front";
        });
      });
      article.querySelector(".card-remove")?.addEventListener("click", () => removePalette(palette.id));
      els.paletteGrid.appendChild(article);
    });
    refreshIcons();
  };

  function pruneLibrary() {
    if (!Array.isArray(state.palettes)) return;
    const filtered = state.palettes.filter(palette =>
      palette?.source === "Unsplash"
      && Number(palette.score) >= MIN_MATCH_SCORE
      && Array.isArray(palette.originals)
      && palette.originals.length === 6
      && Array.isArray(palette.markers)
      && palette.markers.length === 6
    );
    const changed = filtered.length !== state.palettes.length;
    state.palettes = filtered;
    state.usedPhotoIds.clear();
    state.palettes.forEach(palette => state.usedPhotoIds.add(String(palette.photoId || palette.id)));
    if (changed) persistPalettes();
  }

  setBusy = function setBusyWithControls(busy, text = "Ready") {
    originalSetBusy(busy, text);
    const threshold = document.getElementById("matchThreshold");
    const save = document.getElementById("saveUnsplashKey");
    const clear = document.getElementById("clearUnsplashKey");
    const input = document.getElementById("unsplashKey");
    if (threshold) threshold.disabled = busy;
    if (save) save.disabled = busy;
    if (clear) clear.disabled = busy;
    if (input) input.disabled = busy;
  };

  async function validateKey(key) {
    const response = await fetch("https://api.unsplash.com/photos?per_page=1", {
      headers: {
        "Accept-Version": "v1",
        "Authorization": `Client-ID ${key}`
      }
    });
    return response.ok;
  }

  function updateUi() {
    const input = document.getElementById("unsplashKey");
    const status = document.getElementById("unsplashStatus");
    const generate = document.getElementById("generateButton");
    const savedKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    const markerReady = state.markers.length === 100;

    if (input && document.activeElement !== input) input.value = savedKey;
    if (status) {
      status.textContent = !markerReady
        ? "Loading original Ohuhu marker colours..."
        : savedKey
          ? `Unsplash connected. Original marker colours are active. Minimum match is ${getMatchThreshold()}%.`
          : "No Unsplash key saved. Add one before generating palettes.";
    }
    if (generate && !state.running) generate.disabled = !savedKey || !markerReady;
  }

  async function saveKey() {
    const input = document.getElementById("unsplashKey");
    const button = document.getElementById("saveUnsplashKey");
    const status = document.getElementById("unsplashStatus");
    const key = (input?.value || "").trim();

    if (!key) {
      localStorage.removeItem(KEY_STORAGE);
      updateUi();
      showToast("Enter your Unsplash access key first.");
      return;
    }

    if (button) button.disabled = true;
    if (status) status.textContent = "Checking Unsplash access key...";

    try {
      const valid = await validateKey(key);
      if (!valid) throw new Error("Invalid key");
      localStorage.setItem(KEY_STORAGE, key);
      updateUi();
      showToast("Unsplash connected.");
    } catch (error) {
      localStorage.removeItem(KEY_STORAGE);
      if (status) status.textContent = "That Unsplash access key could not be verified.";
      showToast("Unsplash key could not be verified.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function clearKey() {
    localStorage.removeItem(KEY_STORAGE);
    const input = document.getElementById("unsplashKey");
    if (input) input.value = "";
    updateUi();
    showToast("Unsplash key cleared.");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const input = document.getElementById("unsplashKey");
    const save = document.getElementById("saveUnsplashKey");
    const clear = document.getElementById("clearUnsplashKey");
    const slider = document.getElementById("matchThreshold");

    const storedThreshold = Number(localStorage.getItem(THRESHOLD_STORAGE));
    if (slider && Number.isFinite(storedThreshold) && storedThreshold >= MIN_MATCH_SCORE && storedThreshold <= MAX_MATCH_SCORE) {
      slider.value = String(Math.round(storedThreshold));
    }
    updateThresholdUi();

    slider?.addEventListener("input", () => {
      const threshold = getMatchThreshold();
      localStorage.setItem(THRESHOLD_STORAGE, String(threshold));
      updateThresholdUi();
      renderPalettes();
      updateUi();
    });

    const savedKey = localStorage.getItem(KEY_STORAGE) || "";
    if (input) input.value = savedKey;
    save?.addEventListener("click", saveKey);
    clear?.addEventListener("click", clearKey);
    input?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveKey();
      }
    });

    pruneLibrary();
    updateUi();

    try {
      await loadOriginalMarkerData();
      renderPalettes();
    } catch (error) {
      console.error("Could not load original marker colours", error);
      state.markers = [];
      renderMarkerBrowser();
      showToast("Original marker colours could not be loaded.");
    }

    updateUi();
    refreshIcons();
  });
})();
