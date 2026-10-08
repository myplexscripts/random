(() => {
  const CARD_W = 4;
  const CARD_H = 5;
  const PAGE_MARGIN = .125;
  const CARD_GAP = .125;
  const DPI = 300;
  const STRIP_H = 1;
  const PAPERS = {
    letter: { label: "Letter", width: 8.5, height: 11 },
    a4: { label: "A4", width: 8.2677, height: 11.6929 },
    legal: { label: "Legal", width: 8.5, height: 14 },
    tabloid: { label: "Tabloid", width: 11, height: 17 },
    a3: { label: "A3", width: 11.6929, height: 16.5354 }
  };

  function threshold() {
    return Math.max(85, Math.min(100, Number(document.getElementById("matchThreshold")?.value || 85)));
  }

  function palettesForExport() {
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

  function sourceHex(original) {
    if (typeof original === "string") return original;
    if (original?.hex && typeof original.hex === "string") return original.hex;
    if (original?.hex?.hex) return original.hex.hex;
    return "#FFFFFF";
  }

  function hexRgb(hex) {
    const raw = String(hex || "#FFFFFF").replace("#", "");
    return [
      parseInt(raw.slice(0, 2), 16) || 0,
      parseInt(raw.slice(2, 4), 16) || 0,
      parseInt(raw.slice(4, 6), 16) || 0
    ];
  }

  function readableText(hex) {
    const [r, g, b] = hexRgb(hex);
    return (.2126 * r + .7152 * g + .0722 * b) / 255 > .57 ? "#171814" : "#FFFFFF";
  }

  function fitFor(width, height) {
    const usableW = width - PAGE_MARGIN * 2;
    const usableH = height - PAGE_MARGIN * 2;
    const cols = Math.max(1, Math.floor((usableW + CARD_GAP) / (CARD_W + CARD_GAP)));
    const rows = Math.max(1, Math.floor((usableH + CARD_GAP) / (CARD_H + CARD_GAP)));
    return { width, height, cols, rows, capacity: cols * rows };
  }

  function bestLayout(paper) {
    const portrait = fitFor(paper.width, paper.height);
    const landscape = fitFor(paper.height, paper.width);
    return landscape.capacity > portrait.capacity
      ? { ...landscape, orientation: "landscape" }
      : { ...portrait, orientation: "portrait" };
  }

  function selectedPaper() {
    const key = document.getElementById("printPaperSize")?.value || "letter";
    return PAPERS[key] || PAPERS.letter;
  }

  function loadJsPdf() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-jspdf-loader="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.jspdf.jsPDF), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.jspdfLoader = "true";
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js";
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = () => reject(new Error("Could not load the PDF exporter."));
      document.head.appendChild(script);
    });
  }

  function drawCover(ctx, image, x, y, w, h) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = w / h;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (sourceRatio > targetRatio) {
      sw = sh * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = sw / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  }

  async function renderFrontCanvas(palette) {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W * DPI;
    canvas.height = CARD_H * DPI;
    const ctx = canvas.getContext("2d");
    const swatchW = canvas.width / 6;
    const stripPx = STRIP_H * DPI;

    palette.originals.forEach((original, index) => {
      ctx.fillStyle = sourceHex(original);
      ctx.fillRect(index * swatchW, 0, Math.ceil(swatchW), stripPx);
    });

    const image = await loadCorsImage(palette.printImage || palette.image);
    drawCover(ctx, image, 0, stripPx, canvas.width, canvas.height - stripPx * 2);

    palette.markers.forEach((marker, index) => {
      ctx.fillStyle = marker.hex;
      ctx.fillRect(index * swatchW, canvas.height - stripPx, Math.ceil(swatchW), stripPx);
    });

    return canvas;
  }

  async function renderBackCanvas(palette) {
    if (document.fonts?.load) {
      await Promise.allSettled([
        document.fonts.load("800 34px Inter"),
        document.fonts.load("600 28px Inter")
      ]);
    }

    const canvas = document.createElement("canvas");
    canvas.width = CARD_W * DPI;
    canvas.height = CARD_H * DPI;
    const ctx = canvas.getContext("2d");
    const colW = canvas.width / 6;
    const halfH = canvas.height / 2;
    const originals = palette.originals.map(sourceHex).reverse();
    const markers = [...palette.markers].reverse();

    originals.forEach((hex, index) => {
      ctx.fillStyle = hex;
      ctx.fillRect(index * colW, 0, Math.ceil(colW), halfH);
    });

    markers.forEach((marker, index) => {
      const x = index * colW;
      ctx.fillStyle = marker.hex;
      ctx.fillRect(x, halfH, Math.ceil(colW), halfH);

      ctx.save();
      ctx.translate(x + 52, halfH + 34);
      ctx.rotate(Math.PI / 2);
      ctx.textBaseline = "top";
      ctx.fillStyle = readableText(marker.hex);
      ctx.font = "800 34px Inter, Arial, sans-serif";
      ctx.fillText(marker.code, 0, 0);
      const codeWidth = ctx.measureText(marker.code).width;
      ctx.font = "600 28px Inter, Arial, sans-serif";
      const name = marker.name || marker.code;
      const maxLength = halfH - 80 - codeWidth;
      let shown = name;
      while (shown.length > 4 && ctx.measureText(shown).width > maxLength) shown = `${shown.slice(0, -2)}…`;
      ctx.fillText(shown, codeWidth + 14, 3);
      ctx.restore();
    });

    return canvas;
  }

  function pagePositions(layout) {
    const gridW = layout.cols * CARD_W + (layout.cols - 1) * CARD_GAP;
    const gridH = layout.rows * CARD_H + (layout.rows - 1) * CARD_GAP;
    const startX = (layout.width - gridW) / 2;
    const startY = (layout.height - gridH) / 2;
    return Array.from({ length: layout.capacity }, (_, index) => {
      const row = Math.floor(index / layout.cols);
      const col = index % layout.cols;
      return {
        x: startX + col * (CARD_W + CARD_GAP),
        y: startY + row * (CARD_H + CARD_GAP),
        row,
        col
      };
    });
  }

  function addPage(doc, layout, first) {
    if (first) return;
    doc.addPage([layout.width, layout.height], layout.orientation);
  }

  async function exportPdf() {
    const palettes = palettesForExport();
    if (!palettes.length) {
      showToast("There are no palettes to export at the current match setting.");
      return;
    }

    const button = document.getElementById("exportPdfButton");
    if (button) button.disabled = true;
    showToast("Building high-resolution PDF…");

    try {
      const jsPDF = await loadJsPdf();
      const paper = selectedPaper();
      const layout = bestLayout(paper);
      const positions = pagePositions(layout);
      const doc = new jsPDF({
        unit: "in",
        format: [layout.width, layout.height],
        orientation: layout.orientation,
        compress: true,
        putOnlyUsedFonts: true
      });
      doc.setProperties({
        title: "Ohuhu Palette Cards",
        subject: "4 × 5 inch duplex palette cards",
        creator: "Photo Palette Maker"
      });

      let firstPage = true;
      for (let offset = 0; offset < palettes.length; offset += layout.capacity) {
        const batch = palettes.slice(offset, offset + layout.capacity);

        addPage(doc, layout, firstPage);
        firstPage = false;
        for (let i = 0; i < batch.length; i += 1) {
          const canvas = await renderFrontCanvas(batch[i]);
          const pos = positions[i];
          doc.addImage(canvas.toDataURL("image/jpeg", .90), "JPEG", pos.x, pos.y, CARD_W, CARD_H, undefined, "FAST");
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        addPage(doc, layout, false);
        for (let i = 0; i < batch.length; i += 1) {
          const frontPos = positions[i];
          const mirroredIndex = frontPos.row * layout.cols + (layout.cols - 1 - frontPos.col);
          const pos = positions[mirroredIndex];
          const canvas = await renderBackCanvas(batch[i]);
          doc.addImage(canvas.toDataURL("image/png"), "PNG", pos.x, pos.y, CARD_W, CARD_H, undefined, "FAST");
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`ohuhu-palette-cards-${stamp}.pdf`);
      showToast(`PDF exported. ${layout.capacity} cards/sheet, duplex aligned.`);
    } catch (error) {
      console.error("PDF export failed", error);
      showToast("PDF export failed. Try again after the images finish loading.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function injectPdfControls() {
    const actions = document.querySelector(".section-actions");
    const printButton = document.getElementById("printButton");
    if (!actions || !printButton || document.getElementById("exportPdfButton")) return;

    const button = document.createElement("button");
    button.className = "secondary-button";
    button.id = "exportPdfButton";
    button.type = "button";
    button.innerHTML = '<i data-lucide="file-down"></i>Export PDF';
    button.addEventListener("click", exportPdf);
    actions.insertBefore(button, printButton.nextSibling);

    const note = document.createElement("span");
    note.className = "pdf-export-note";
    note.textContent = "300 ppi RGB PDF. For commercial printing, ask the print shop to convert it to their CMYK/PDF-X profile.";
    actions.appendChild(note);

    const style = document.createElement("style");
    style.textContent = `.pdf-export-note{flex-basis:100%;max-width:420px;color:var(--muted);font-size:12px;line-height:1.35}`;
    document.head.appendChild(style);
    refreshIcons();
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectPdfControls();
  });
})();