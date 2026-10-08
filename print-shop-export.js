(() => {
  const TRIM_W = 4;
  const TRIM_H = 5;
  const BLEED = .125;
  const SLUG = .125;
  const DPI = 300;
  const STRIP_H = 1;
  const PAGE_W = TRIM_W + 2 * (BLEED + SLUG);
  const PAGE_H = TRIM_H + 2 * (BLEED + SLUG);
  const ART_X = SLUG;
  const ART_Y = SLUG;
  const TRIM_X = SLUG + BLEED;
  const TRIM_Y = SLUG + BLEED;
  const ART_W = TRIM_W + BLEED * 2;
  const ART_H = TRIM_H + BLEED * 2;
  const ROUND_CORNER_MM = 3;

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
    if (typeof original?.hex === "string") return original.hex;
    return original?.hex?.hex || "#FFFFFF";
  }

  function hexRgb(hex) {
    const raw = String(hex || "#FFFFFF").replace("#", "");
    return [parseInt(raw.slice(0, 2), 16) || 0, parseInt(raw.slice(2, 4), 16) || 0, parseInt(raw.slice(4, 6), 16) || 0];
  }

  function readableText(hex) {
    const [r, g, b] = hexRgb(hex);
    return (.2126 * r + .7152 * g + .0722 * b) / 255 > .57 ? "#171814" : "#FFFFFF";
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

  function drawCover(ctx, image, w, h) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = w / h;
    let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
    if (sourceRatio > targetRatio) {
      sw = sh * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = sw / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  }

  async function renderPhotoCanvas(palette) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(ART_W * DPI);
    canvas.height = Math.round(3 * DPI);
    const image = await loadCorsImage(palette.printImage || palette.image);
    drawCover(canvas.getContext("2d"), image, canvas.width, canvas.height);
    return canvas;
  }

  async function renderBackCanvas(palette) {
    if (document.fonts?.load) {
      await Promise.allSettled([document.fonts.load("800 34px Inter"), document.fonts.load("600 28px Inter")]);
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(ART_W * DPI);
    canvas.height = Math.round(ART_H * DPI);
    const ctx = canvas.getContext("2d");
    const bleedPx = BLEED * DPI;
    const trimWpx = TRIM_W * DPI;
    const trimHpx = TRIM_H * DPI;
    const colW = trimWpx / 6;
    const seamY = bleedPx + trimHpx / 2;
    const originals = palette.originals.map(sourceHex).reverse();
    const markers = [...palette.markers].reverse();

    originals.forEach((hex, index) => {
      const left = index === 0 ? 0 : bleedPx + index * colW;
      const right = index === 5 ? canvas.width : bleedPx + (index + 1) * colW;
      ctx.fillStyle = hex;
      ctx.fillRect(left, 0, right - left + 1, seamY);
    });

    markers.forEach((marker, index) => {
      const left = index === 0 ? 0 : bleedPx + index * colW;
      const right = index === 5 ? canvas.width : bleedPx + (index + 1) * colW;
      ctx.fillStyle = marker.hex;
      ctx.fillRect(left, seamY, right - left + 1, canvas.height - seamY);

      const trimLeft = bleedPx + index * colW;
      ctx.save();
      ctx.translate(trimLeft + 52, seamY + 34);
      ctx.rotate(Math.PI / 2);
      ctx.textBaseline = "top";
      ctx.fillStyle = readableText(marker.hex);
      ctx.font = "800 34px Inter, Arial, sans-serif";
      ctx.fillText(marker.code, 0, 0);
      const codeWidth = ctx.measureText(marker.code).width;
      ctx.font = "600 28px Inter, Arial, sans-serif";
      const name = marker.name || marker.code;
      const maxLength = trimHpx / 2 - 80 - codeWidth;
      let shown = name;
      while (shown.length > 4 && ctx.measureText(shown).width > maxLength) shown = `${shown.slice(0, -2)}…`;
      ctx.fillText(shown, codeWidth + 14, 3);
      ctx.restore();
    });

    return canvas;
  }

  function setFill(doc, hex) {
    const [r, g, b] = hexRgb(hex);
    doc.setFillColor(r, g, b);
  }

  function swatchBounds(index) {
    const colW = TRIM_W / 6;
    const left = index === 0 ? ART_X : TRIM_X + index * colW;
    const right = index === 5 ? PAGE_W - ART_X : TRIM_X + (index + 1) * colW;
    return { left, width: right - left };
  }

  function drawFront(doc, palette, photoCanvas) {
    palette.originals.forEach((original, index) => {
      const { left, width } = swatchBounds(index);
      setFill(doc, sourceHex(original));
      doc.rect(left, ART_Y, width + .002, TRIM_Y + STRIP_H - ART_Y, "F");
    });

    doc.addImage(photoCanvas.toDataURL("image/jpeg", .94), "JPEG", ART_X, TRIM_Y + STRIP_H, ART_W, 3, undefined, "FAST");

    palette.markers.forEach((marker, index) => {
      const { left, width } = swatchBounds(index);
      setFill(doc, marker.hex);
      const y = TRIM_Y + 4;
      doc.rect(left, y, width + .002, PAGE_H - ART_Y - y, "F");
    });
  }

  function drawCropMarks(doc) {
    const right = TRIM_X + TRIM_W;
    const bottom = TRIM_Y + TRIM_H;
    const outerRight = PAGE_W - SLUG;
    const outerBottom = PAGE_H - SLUG;
    doc.setDrawColor(35, 35, 35);
    doc.setLineWidth(.006);
    doc.line(0, TRIM_Y, SLUG, TRIM_Y);
    doc.line(outerRight, TRIM_Y, PAGE_W, TRIM_Y);
    doc.line(0, bottom, SLUG, bottom);
    doc.line(outerRight, bottom, PAGE_W, bottom);
    doc.line(TRIM_X, 0, TRIM_X, SLUG);
    doc.line(right, 0, right, SLUG);
    doc.line(TRIM_X, outerBottom, TRIM_X, PAGE_H);
    doc.line(right, outerBottom, right, PAGE_H);
  }

  function drawSlug(doc, index, face) {
    doc.setTextColor(70, 70, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    const number = String(index + 1).padStart(3, "0");
    doc.text(
      `CARD ${number} ${face.toUpperCase()} • 4 × 5 in trim • 0.125 in bleed • 300 ppi RGB • ${ROUND_CORNER_MM} mm round corners • NO SCALING`,
      PAGE_W / 2,
      PAGE_H - .035,
      { align: "center" }
    );
  }

  function addArtPage(doc, firstPage) {
    if (!firstPage) doc.addPage([PAGE_W, PAGE_H], "portrait");
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  async function exportPrintShopPdf() {
    const palettes = palettesForExport();
    if (!palettes.length) { showToast("There are no palettes to export at the current match setting."); return; }

    const button = document.getElementById("exportPdfButton");
    if (button) button.disabled = true;
    showToast("Building printer-ready PDF…");

    try {
      const jsPDF = await loadJsPdf();
      const doc = new jsPDF({ unit: "in", format: [PAGE_W, PAGE_H], orientation: "portrait", compress: true, putOnlyUsedFonts: true, precision: 4 });
      doc.setProperties({
        title: "Ohuhu Palette Cards - Print Shop Master",
        subject: "4 × 5 inch cards; 0.125 inch bleed; crop marks; 300 ppi RGB; 3 mm rounded corners; alternating front/back pages; printer handles imposition and CMYK/PDF-X conversion",
        creator: "Photo Palette Maker",
        keywords: "print-ready, 4x5, bleed, crop marks, duplex, palette cards"
      });

      let firstPage = true;
      for (let index = 0; index < palettes.length; index += 1) {
        const palette = palettes[index];
        const photoCanvas = await renderPhotoCanvas(palette);
        addArtPage(doc, firstPage);
        firstPage = false;
        drawFront(doc, palette, photoCanvas);
        drawCropMarks(doc);
        drawSlug(doc, index, "front");

        const backCanvas = await renderBackCanvas(palette);
        addArtPage(doc, false);
        doc.addImage(backCanvas.toDataURL("image/png"), "PNG", ART_X, ART_Y, ART_W, ART_H, undefined, "FAST");
        drawCropMarks(doc);
        drawSlug(doc, index, "back");
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`ohuhu-palette-cards-PRINT-SHOP-4x5-${stamp}.pdf`);
      showToast(`Print-shop PDF exported: ${palettes.length} cards, fronts and backs paired.`);
    } catch (error) {
      console.error("PDF export failed", error);
      showToast("PDF export failed. Try again after the images finish loading.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function replaceExportControl() {
    const oldButton = document.getElementById("exportPdfButton");
    if (!oldButton) return;
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.innerHTML = '<i data-lucide="file-down"></i>Print shop PDF';
    button.addEventListener("click", exportPrintShopPdf);

    const note = document.querySelector(".pdf-export-note");
    if (note) {
      note.textContent = "Printer master: individual 4 × 5 in cards, 0.125 in bleed, crop marks, 300 ppi, paired front/back pages and 3 mm corner-round spec. RGB is intentional so the print shop can apply its own CMYK/PDF-X press profile and impose the sheets.";
      note.style.maxWidth = "620px";
      note.style.fontSize = "12px";
      note.style.lineHeight = "1.4";
    }
    refreshIcons();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(replaceExportControl, 0));
})();