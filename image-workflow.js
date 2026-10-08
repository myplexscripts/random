(() => {
  const IMAGE_PALETTE_SIZE = 6;
  const CLUSTER_COUNT = 12;
  const PREVIEW_SIZE = 640;
  const SAMPLE_MAX_SIDE = 180;

  const ui = {
    result: null,
    originalCanvas: null,
    oahuCanvas: null,
    qualityValue: null,
    qualityLabel: null,
    downloadButton: null,
    note: null,
  };

  let latestPreviewUrl = null;
  let processing = false;

  function injectStyles() {
    if (document.getElementById("imageWorkflowStyles")) return;
    const style = document.createElement("style");
    style.id = "imageWorkflowStyles";
    style.textContent = `
      .image-workflow-result {
        display: grid;
        gap: 14px;
        margin-top: 14px;
      }
      .image-workflow-result[hidden] { display: none !important; }
      .image-workflow-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 13px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
      }
      .image-workflow-summary strong {
        display: block;
        font-size: 15px;
      }
      .image-workflow-summary span {
        display: block;
        margin-top: 2px;
        color: var(--muted);
        font-size: 14px;
      }
      .match-score {
        min-width: 66px;
        min-height: 44px;
        display: grid;
        place-items: center;
        padding: 0 10px;
        border-radius: 999px;
        background: var(--soft);
        font-size: 14px;
        font-weight: 800;
        white-space: nowrap;
      }
      .image-workflow-previews {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .image-preview-card {
        min-width: 0;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
      }
      .image-preview-card canvas {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        background: #f4f2ed;
      }
      .image-preview-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 44px;
        gap: 8px;
        padding: 0 11px;
        border-top: 1px solid var(--line);
        font-size: 14px;
        font-weight: 720;
      }
      .image-preview-label span:last-child {
        color: var(--muted);
        font-weight: 600;
      }
      .image-workflow-actions {
        display: flex;
        gap: 8px;
      }
      .image-workflow-actions > button { flex: 1; }
      .image-workflow-note {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
      }
      .image-process-status {
        margin-top: 10px;
        color: var(--muted);
        font-size: 14px;
        text-align: center;
      }
      @media (max-width: 560px) {
        .image-workflow-previews { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceCopy() {
    const subtitle = document.querySelector(".app-header .subtitle");
    if (subtitle) {
      subtitle.textContent = "Start with an image, extract its strongest colours, match them to six real Oahu 100 markers, and preview the exact marker-limited result.";
    }

    if (els?.imageTab) {
      els.imageTab.innerHTML = '<i data-lucide="image" aria-hidden="true"></i> Image → palette';
    }
    if (els?.generateTab) {
      els.generateTab.innerHTML = '<i data-lucide="sparkles" aria-hidden="true"></i> Quick palette';
    }
    if (els?.matchButton) {
      els.matchButton.innerHTML = '<i data-lucide="scan-search" aria-hidden="true"></i> Build 6-marker palette';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function buildResultUI() {
    if (!els?.imageControls || document.getElementById("imageWorkflowResult")) return;

    const result = document.createElement("div");
    result.className = "image-workflow-result";
    result.id = "imageWorkflowResult";
    result.hidden = true;
    result.innerHTML = `
      <div class="image-workflow-summary">
        <div>
          <strong>Six-marker translation</strong>
          <span id="imageMatchQualityLabel">Waiting for an image</span>
        </div>
        <div class="match-score" id="imageMatchQuality">--</div>
      </div>
      <div class="image-workflow-previews">
        <div class="image-preview-card">
          <canvas id="imageOriginalCanvas" width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}" aria-label="Original image preview"></canvas>
          <div class="image-preview-label"><span>Original</span><span>source</span></div>
        </div>
        <div class="image-preview-card">
          <canvas id="imageOahuCanvas" width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}" aria-label="Oahu six-marker preview"></canvas>
          <div class="image-preview-label"><span>Oahu preview</span><span>6 colours</span></div>
        </div>
      </div>
      <div class="image-workflow-actions">
        <button class="secondary-button" id="downloadOahuPreview" type="button">
          <i data-lucide="download" aria-hidden="true"></i>
          Download preview
        </button>
      </div>
      <p class="image-workflow-note" id="imageWorkflowNote">The right preview is reduced to only the six calibrated marker colours shown in the palette.</p>
    `;

    els.matchButton.insertAdjacentElement("afterend", result);
    ui.result = result;
    ui.originalCanvas = result.querySelector("#imageOriginalCanvas");
    ui.oahuCanvas = result.querySelector("#imageOahuCanvas");
    ui.qualityValue = result.querySelector("#imageMatchQuality");
    ui.qualityLabel = result.querySelector("#imageMatchQualityLabel");
    ui.downloadButton = result.querySelector("#downloadOahuPreview");
    ui.note = result.querySelector("#imageWorkflowNote");

    ui.downloadButton.addEventListener("click", downloadPreview);
    if (window.lucide) window.lucide.createIcons();
  }

  function resetResult() {
    latestPreviewUrl = null;
    if (ui.result) ui.result.hidden = true;
  }

  function labDistance(a, b) {
    return Math.sqrt(
      Math.pow(a.l - b.l, 2) +
      Math.pow(a.a - b.a, 2) +
      Math.pow(a.b - b.b, 2)
    );
  }

  function cropSquare(img, canvas, size = PREVIEW_SIZE) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, size, size);
    const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - side) / 2;
    const sy = ((img.naturalHeight || img.height) - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return ctx;
  }

  function samplePixels(img) {
    const canvas = document.createElement("canvas");
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const scale = Math.min(SAMPLE_MAX_SIDE / width, SAMPLE_MAX_SIDE / height, 1);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = [];

    for (let i = 0; i < data.length; i += 12) {
      if (data[i + 3] < 180) continue;
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      pixels.push({ rgb, lab: rgbToLab(rgb) });
    }
    return pixels;
  }

  function kMeansLab(pixels, count = CLUSTER_COUNT) {
    if (!pixels.length) return [];
    const sorted = [...pixels].sort((a, b) => a.lab.l - b.lab.l);
    const centroids = Array.from({ length: Math.min(count, pixels.length) }, (_, index) => {
      const position = Math.min(sorted.length - 1, Math.floor(((index + 0.5) / Math.min(count, pixels.length)) * sorted.length));
      return { ...sorted[position].lab };
    });

    let assignments = new Array(pixels.length).fill(0);
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, n: 0 }));
      pixels.forEach((pixel, pixelIndex) => {
        let best = 0;
        let bestDistance = Infinity;
        centroids.forEach((centroid, index) => {
          const distance = labDistance(pixel.lab, centroid);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        });
        assignments[pixelIndex] = best;
        const sum = sums[best];
        sum.l += pixel.lab.l;
        sum.a += pixel.lab.a;
        sum.b += pixel.lab.b;
        sum.n += 1;
      });

      sums.forEach((sum, index) => {
        if (!sum.n) return;
        centroids[index] = {
          l: sum.l / sum.n,
          a: sum.a / sum.n,
          b: sum.b / sum.n,
        };
      });
    }

    const clusters = centroids.map((lab, index) => ({ lab, count: 0, rgbSum: { r: 0, g: 0, b: 0 } }));
    pixels.forEach((pixel, pixelIndex) => {
      const cluster = clusters[assignments[pixelIndex]];
      cluster.count += 1;
      cluster.rgbSum.r += pixel.rgb.r;
      cluster.rgbSum.g += pixel.rgb.g;
      cluster.rgbSum.b += pixel.rgb.b;
    });

    return clusters
      .filter(cluster => cluster.count)
      .map(cluster => ({
        lab: cluster.lab,
        count: cluster.count,
        weight: cluster.count / pixels.length,
        rgb: {
          r: cluster.rgbSum.r / cluster.count,
          g: cluster.rgbSum.g / cluster.count,
          b: cluster.rgbSum.b / cluster.count,
        },
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  function chooseRepresentativeClusters(clusters, count = IMAGE_PALETTE_SIZE) {
    if (clusters.length <= count) return clusters.slice(0, count);
    const selected = [clusters[0]];
    const remaining = clusters.slice(1);

    while (selected.length < count && remaining.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;

      remaining.forEach((cluster, index) => {
        const minDistance = Math.min(...selected.map(chosen => labDistance(cluster.lab, chosen.lab)));
        const valueBonus = 1 + Math.abs(cluster.lab.l - 55) / 85;
        const score = (0.45 + cluster.weight * 5.5) * (1 + Math.min(minDistance, 55) / 28) * valueBonus;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      selected.push(remaining.splice(bestIndex, 1)[0]);
    }

    return selected.sort((a, b) => b.lab.l - a.lab.l);
  }

  function matchClustersToMarkers(clusters) {
    const markerLabs = state.markers.map(marker => ({ marker, lab: rgbToLab(hexToRgb(marker.hex)) }));
    const used = new Set();
    const matches = [];

    const ordered = [...clusters].sort((a, b) => b.weight - a.weight);
    ordered.forEach(cluster => {
      const ranked = markerLabs
        .filter(entry => !used.has(entry.marker.code))
        .map(entry => {
          const base = labDistance(cluster.lab, entry.lab);
          const similarityPenalty = matches.length
            ? Math.max(0, 10 - Math.min(...matches.map(match => labDistance(entry.lab, match.lab)))) * 0.55
            : 0;
          return { ...entry, score: base + similarityPenalty, source: cluster, baseDistance: base };
        })
        .sort((a, b) => a.score - b.score);

      if (!ranked.length) return;
      const chosen = ranked[0];
      used.add(chosen.marker.code);
      matches.push(chosen);
    });

    return matches.slice(0, IMAGE_PALETTE_SIZE);
  }

  function nearestPaletteEntry(lab, paletteEntries) {
    let best = paletteEntries[0];
    let bestDistance = Infinity;
    paletteEntries.forEach(entry => {
      const distance = labDistance(lab, entry.lab);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    });
    return { entry: best, distance: bestDistance };
  }

  function qualityFromPixels(pixels, paletteEntries) {
    if (!pixels.length || !paletteEntries.length) return { score: 0, average: 100 };
    let weightedDistance = 0;
    pixels.forEach(pixel => {
      weightedDistance += nearestPaletteEntry(pixel.lab, paletteEntries).distance;
    });
    const average = weightedDistance / pixels.length;
    const score = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-average / 24))));
    return { score, average };
  }

  function qualityLabel(score) {
    if (score >= 80) return "Excellent marker match";
    if (score >= 68) return "Strong marker match";
    if (score >= 55) return "Good marker match";
    if (score >= 42) return "Usable marker match";
    return "Loose marker match";
  }

  function renderQuantizedPreview(img, paletteEntries) {
    const originalCtx = cropSquare(img, ui.originalCanvas, PREVIEW_SIZE);
    const source = originalCtx.getImageData(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    const output = new ImageData(PREVIEW_SIZE, PREVIEW_SIZE);
    const cache = new Map();

    for (let i = 0; i < source.data.length; i += 4) {
      const alpha = source.data[i + 3];
      if (!alpha) continue;
      const key = `${source.data[i] >> 3},${source.data[i + 1] >> 3},${source.data[i + 2] >> 3}`;
      let rgb = cache.get(key);
      if (!rgb) {
        const sourceLab = rgbToLab({ r: source.data[i], g: source.data[i + 1], b: source.data[i + 2] });
        rgb = paletteEntries.length ? paletteEntries.reduce((best, entry) => {
          const distance = labDistance(sourceLab, entry.lab);
          return !best || distance < best.distance ? { distance, rgb: entry.rgb } : best;
        }, null).rgb : { r: 255, g: 255, b: 255 };
        cache.set(key, rgb);
      }
      output.data[i] = rgb.r;
      output.data[i + 1] = rgb.g;
      output.data[i + 2] = rgb.b;
      output.data[i + 3] = alpha;
    }

    const oahuCtx = ui.oahuCanvas.getContext("2d");
    oahuCtx.putImageData(output, 0, 0);
    latestPreviewUrl = ui.oahuCanvas.toDataURL("image/png");
  }

  function sortPaletteForDisplay(markers) {
    return [...markers].sort((a, b) => {
      const aLab = rgbToLab(hexToRgb(a.hex));
      const bLab = rgbToLab(hexToRgb(b.hex));
      return bLab.l - aLab.l;
    });
  }

  function applyLatestCalibration() {
    const overrides = window.OAHU_REAL_WORLD_HEX;
    if (!overrides) return;
    state.markers.forEach(marker => {
      if (overrides[marker.code]) marker.hex = overrides[marker.code];
    });
  }

  function buildImagePalette() {
    if (processing || !state.imageElement || !state.markers?.length) return;
    applyLatestCalibration();
    processing = true;
    els.matchButton.disabled = true;
    els.matchButton.textContent = "Analysing image…";

    requestAnimationFrame(() => {
      try {
        const pixels = samplePixels(state.imageElement);
        const clusters = kMeansLab(pixels, CLUSTER_COUNT);
        const representatives = chooseRepresentativeClusters(clusters, IMAGE_PALETTE_SIZE);
        const matches = matchClustersToMarkers(representatives);
        const markers = sortPaletteForDisplay(matches.map(match => match.marker));
        const paletteEntries = markers.map(marker => ({
          marker,
          rgb: hexToRgb(marker.hex),
          lab: rgbToLab(hexToRgb(marker.hex)),
        }));
        const quality = qualityFromPixels(pixels, paletteEntries);

        state.locks.clear();
        state.palette = markers;
        state.mode = "image";
        if (els.sizeSelect) els.sizeSelect.value = String(IMAGE_PALETTE_SIZE);
        renderPalette(`Image palette · ${IMAGE_PALETTE_SIZE} colours`, "Oahu 100 image match");
        renderQuantizedPreview(state.imageElement, paletteEntries);

        ui.qualityValue.textContent = `${quality.score}%`;
        ui.qualityLabel.textContent = qualityLabel(quality.score);
        ui.note.textContent = `Average Lab distance ${quality.average.toFixed(1)}. The Oahu preview uses only ${markers.map(marker => marker.code).join(", ")}.`;
        ui.result.hidden = false;
        ui.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (error) {
        console.error(error);
        showToast("Could not analyse that image");
      } finally {
        processing = false;
        els.matchButton.disabled = !state.markers.length || !state.imageElement;
        els.matchButton.innerHTML = '<i data-lucide="scan-search" aria-hidden="true"></i> Build 6-marker palette';
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  function downloadPreview() {
    if (!latestPreviewUrl) return;
    const anchor = document.createElement("a");
    anchor.href = latestPreviewUrl;
    anchor.download = "Oahu 6-marker preview.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function interceptActions() {
    els.matchButton?.addEventListener("click", event => {
      if (!state.imageElement || !state.markers.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      buildImagePalette();
    }, true);

    els.refreshButton?.addEventListener("click", event => {
      if (state.mode !== "image" || !state.imageElement || !state.markers.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      buildImagePalette();
    }, true);

    els.imagePreview?.addEventListener("load", resetResult);
  }

  function defaultToImageWorkflow() {
    try {
      if (typeof setMode === "function") setMode("image");
    } catch (error) {
      console.warn("Could not switch to image workflow", error);
    }
  }

  function init() {
    if (typeof state === "undefined" || typeof els === "undefined") return;
    injectStyles();
    enhanceCopy();
    buildResultUI();
    interceptActions();
    defaultToImageWorkflow();
  }

  init();
})();
