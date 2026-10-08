(() => {
  const PRINT_PAPER_STORAGE = "oahu-print-paper-size";
  const CARD_W = 4;
  const CARD_H = 5;
  const PAGE_MARGIN = .125;
  const CARD_GAP = .125;

  const PAPERS = {
    letter: { label: "Letter (8.5 × 11 in)", width: 8.5, height: 11 },
    a4: { label: "A4 (210 × 297 mm)", width: 8.2677, height: 11.6929 },
    legal: { label: "Legal (8.5 × 14 in)", width: 8.5, height: 14 },
    tabloid: { label: "Tabloid (11 × 17 in)", width: 11, height: 17 },
    a3: { label: "A3 (297 × 420 mm)", width: 11.6929, height: 16.5354 }
  };

  const nativePrint = window.print.bind(window);

  function threshold() {
    const slider = document.getElementById("matchThreshold");
    return Math.max(85, Math.min(100, Number(slider?.value || 85)));
  }

  function visiblePalettes() {
    const minimum = threshold();
    return state.palettes.filter(palette =>
      palette?.source === "Unsplash"
      && Number(palette.score) >= minimum
      && Array.isArray(palette.originals)
      && palette.originals.length === 6
      && Array.isArray(palette.markers)
      && palette.markers.length === 6
    );
  }

  function originalHex(original) {
    return typeof original === "string" ? original : original?.hex || "#FFFFFF";
  }

  function readableText(hex) {
    const raw = String(hex || "#FFFFFF").replace("#", "");
    const r = parseInt(raw.slice(0, 2), 16) || 0;
    const g = parseInt(raw.slice(2, 4), 16) || 0;
    const b = parseInt(raw.slice(4, 6), 16) || 0;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > .57 ? "#171814" : "#FFFFFF";
  }

  function originalStrip(palette, reverse = false, className = "") {
    const colours = palette.originals.map(originalHex);
    if (reverse) colours.reverse();
    return `<div class="front-swatch-row ${className}">${colours.map(hex => `<div class="front-swatch" style="background:${hex}"></div>`).join("")}</div>`;
  }

  function markerStrip(palette, reverse = false, className = "") {
    const markers = [...palette.markers];
    if (reverse) markers.reverse();
    return `<div class="front-swatch-row ${className}">${markers.map(marker => `<div class="front-swatch" style="background:${marker.hex}"></div>`).join("")}</div>`;
  }

  function backOriginalHalf(palette) {
    const colours = palette.originals.map(originalHex).reverse();
    return `<div class="back-half back-original-half">${colours.map(hex => `<div class="back-column" style="background:${hex}"></div>`).join("")}</div>`;
  }

  function backMarkerHalf(palette) {
    const markers = [...palette.markers].reverse();
    return `<div class="back-half back-marker-half">${markers.map(marker => `
      <div class="back-column back-marker-column" style="background:${marker.hex}">
        <span class="back-marker-label" style="color:${readableText(marker.hex)}">
          <strong>${escapeHtml(marker.code)}</strong><span>${escapeHtml(marker.name || marker.code)}</span>
        </span>
      </div>`).join("")}</div>`;
  }

  renderPalettes = function renderCardsWithMirroredBacks() {
    const minimum = threshold();
    const visible = visiblePalettes();

    els.paletteGrid.innerHTML = "";
    els.emptyState.hidden = visible.length > 0;
    els.printButton.disabled = els.clearButton.disabled = state.palettes.length === 0;
    els.libraryCopy.textContent = visible.length
      ? `${visible.length} palette${visible.length === 1 ? "" : "s"} at ${minimum}% or higher.`
      : `No saved palettes meet the ${minimum}% minimum.`;

    visible.forEach(palette => {
      const article = document.createElement("article");
      article.className = "palette-card palette-card-double";
      article.dataset.face = "front";
      article.setAttribute("role", "button");
      article.setAttribute("tabindex", "0");
      article.setAttribute("aria-label", "Palette card. Activate to flip between front and back.");
      article.innerHTML = `
        <section class="card-face card-front" aria-label="Palette card front">
          ${originalStrip(palette, false, "original-swatch-row")}
          <div class="photo-wrap">
            <img src="${escapeAttr(palette.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">
          </div>
          ${markerStrip(palette, false, "matched-swatch-row")}
        </section>
        <section class="card-face card-back" aria-label="Palette card back">
          ${backOriginalHalf(palette)}
          ${backMarkerHalf(palette)}
        </section>`;

      const toggleFace = () => {
        article.dataset.face = article.dataset.face === "front" ? "back" : "front";
      };

      article.addEventListener("click", toggleFace);
      article.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleFace();
        }
      });

      els.paletteGrid.appendChild(article);
    });

    updatePrintSummary();
    refreshIcons();
  };

  function fitFor(width, height) {
    const usableW = width - PAGE_MARGIN * 2;
    const usableH = height - PAGE_MARGIN * 2;
    const cols = Math.max(1, Math.floor((usableW + CARD_GAP) / (CARD_W + CARD_GAP)));
    const rows = Math.max(1, Math.floor((usableH + CARD_GAP) / (CARD_H + CARD_GAP)));
    return { width, height, cols, rows, capacity: cols * rows };
  }

  function bestPaperLayout(paper) {
    const portrait = fitFor(paper.width, paper.height);
    const landscape = fitFor(paper.height, paper.width);
    if (landscape.capacity > portrait.capacity) return { ...landscape, orientation: "landscape" };
    return { ...portrait, orientation: "portrait" };
  }

  function selectedPaper() {
    const key = document.getElementById("printPaperSize")?.value || "letter";
    return { key, paper: PAPERS[key] || PAPERS.letter };
  }

  function injectPrintControls() {
    const actions = document.querySelector(".section-actions");
    const printButton = document.getElementById("printButton");
    if (!actions || !printButton || document.getElementById("printPaperSize")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "print-settings-control";
    wrapper.innerHTML = `
      <label for="printPaperSize">
        <span>Paper</span>
        <select id="printPaperSize" aria-label="Paper size for printing">
          ${Object.entries(PAPERS).map(([key, paper]) => `<option value="${key}">${paper.label}</option>`).join("")}
        </select>
      </label>
      <span class="print-layout-summary" id="printLayoutSummary"></span>`;

    actions.insertBefore(wrapper, printButton);
    const select = wrapper.querySelector("select");
    const saved = localStorage.getItem(PRINT_PAPER_STORAGE);
    if (saved && PAPERS[saved]) select.value = saved;
    select.addEventListener("change", () => {
      localStorage.setItem(PRINT_PAPER_STORAGE, select.value);
      updatePrintSummary();
    });
    updatePrintSummary();
  }

  function updatePrintSummary() {
    const summary = document.getElementById("printLayoutSummary");
    if (!summary) return;
    const { paper } = selectedPaper();
    const layout = bestPaperLayout(paper);
    const duplexEdge = layout.orientation === "portrait" ? "long edge" : "short edge";
    summary.textContent = `${layout.capacity} cards/sheet · 4 × 5 in · ${layout.orientation} · flip ${duplexEdge}`;
  }

  function printStrip(items, key) {
    return `<div class="print-strip">${items.map(item => `<div style="background:${item[key] || item}"></div>`).join("")}</div>`;
  }

  function printFrontCard(palette) {
    const originals = palette.originals.map(original => ({ hex: originalHex(original) }));
    return `
      <article class="print-card print-card-front">
        ${printStrip(originals, "hex")}
        <div class="print-photo"><img src="${escapeAttr(palette.image)}" alt=""></div>
        ${printStrip(palette.markers, "hex")}
      </article>`;
  }

  function printBackCard(palette) {
    const pairs = palette.markers.map((marker, index) => ({ marker, original: originalHex(palette.originals[index]) })).reverse();
    return `
      <article class="print-card print-card-back">
        <div class="print-back-half print-back-original-half">
          ${pairs.map(pair => `<div style="background:${pair.original}"></div>`).join("")}
        </div>
        <div class="print-back-half print-back-marker-half">
          ${pairs.map(({ marker }) => `
            <div class="print-back-marker-column" style="background:${marker.hex}">
              <span class="print-marker-label" style="color:${readableText(marker.hex)}"><strong>${escapeHtml(marker.code)}</strong><span>${escapeHtml(marker.name || marker.code)}</span></span>
            </div>`).join("")}
        </div>
      </article>`;
  }

  function buildPrintSheet(slots, face, layout, paperIndex) {
    return `
      <section class="print-sheet print-sheet-${face}" data-sheet="${paperIndex}" style="--paper-w:${layout.width}in;--paper-h:${layout.height}in;--cols:${layout.cols};--rows:${layout.rows};">
        <div class="print-sheet-grid">
          ${slots.map(palette => palette
            ? `<div class="print-slot">${face === "front" ? printFrontCard(palette) : printBackCard(palette)}</div>`
            : `<div class="print-slot print-slot-empty"></div>`).join("")}
        </div>
      </section>`;
  }

  function duplexEdgeFor(layout) {
    return layout.orientation === "portrait" ? "long edge" : "short edge";
  }

  function preparePrintPages() {
    const palettes = visiblePalettes();
    if (!palettes.length) {
      showToast("There are no palettes to print at the current match setting.");
      return false;
    }

    const { paper } = selectedPaper();
    const layout = bestPaperLayout(paper);
    const capacity = layout.capacity;
    const pages = [];

    for (let offset = 0, sheetIndex = 0; offset < palettes.length; offset += capacity, sheetIndex += 1) {
      const batch = palettes.slice(offset, offset + capacity);
      const frontSlots = new Array(capacity).fill(null);
      const backSlots = new Array(capacity).fill(null);

      batch.forEach((palette, index) => {
        frontSlots[index] = palette;
        const row = Math.floor(index / layout.cols);
        const col = index % layout.cols;
        const mirroredIndex = row * layout.cols + (layout.cols - 1 - col);
        backSlots[mirroredIndex] = palette;
      });

      pages.push(buildPrintSheet(frontSlots, "front", layout, sheetIndex));
      pages.push(buildPrintSheet(backSlots, "back", layout, sheetIndex));
    }

    let root = document.getElementById("printRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "printRoot";
      document.body.appendChild(root);
    }
    root.innerHTML = pages.join("");

    let pageStyle = document.getElementById("dynamicPrintPageStyle");
    if (!pageStyle) {
      pageStyle = document.createElement("style");
      pageStyle.id = "dynamicPrintPageStyle";
      document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = `@page { size: ${layout.width}in ${layout.height}in; margin: 0; }`;

    return layout;
  }

  window.print = function printPaletteCards() {
    const layout = preparePrintPages();
    if (!layout) return;
    showToast(`For aligned backs: print double-sided, flip on ${duplexEdgeFor(layout)}, at 100% / actual size.`);
    setTimeout(() => nativePrint(), 120);
  };

  window.addEventListener("afterprint", () => {
    const root = document.getElementById("printRoot");
    if (root) root.innerHTML = "";
  });

  document.addEventListener("DOMContentLoaded", () => {
    injectPrintControls();
    const footer = document.querySelector(".app-footer p");
    if (footer) footer.textContent = "Cards are fixed at 4 × 5 in. Fronts are entirely filled by the sampled palette, source photo, and marker palette. Tap a card to flip it. Backs remain full-colour with mirrored marker order for duplex alignment.";
    renderPalettes();
  });
})();