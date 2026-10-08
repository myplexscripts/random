(() => {
  const PAGE_W = 8.5;
  const PAGE_H = 11;
  const TRIM_W = 4;
  const TRIM_H = 5;
  const BLEED = .125;
  const DPI = 300;
  const STRIP_H = 1;
  const ART_W = TRIM_W + BLEED * 2;
  const ART_H = TRIM_H + BLEED * 2;
  const SLOT_X = (PAGE_W - ART_W) / 2;
  const SLOT_Y = [.25, .25 + ART_H];

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
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
  }

  async function renderFrontCanvas(palette) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(ART_W * DPI);
    canvas.height = Math.round(ART_H * DPI);
    const ctx = canvas.getContext("2d");
    const bleedPx = BLEED * DPI;
    const trimWpx = TRIM_W * DPI;
    const trimHpx = TRIM_H * DPI;
    const colW = trimWpx / 6;
    const stripPx = STRIP_H * DPI;

    palette.originals.forEach((original, index) => {
      const left = index === 0 ? 0 : bleedPx + index * colW;
      const right = index === 5 ? canvas.width : bleedPx + (index + 1) * colW;
      ctx.fillStyle = sourceHex(original);
      ctx.fillRect(left, 0, right - left + 1, bleedPx + stripPx);
    });

    const image = await loadCorsImage(palette.printImage || palette.image);
    const photoCanvas = document.createElement("canvas");
    photoCanvas.width = canvas.width;
    photoCanvas.height = Math.round(3 * DPI);
    drawCover(photoCanvas.getContext("2d"), image, photoCanvas.width, photoCanvas.height);
    ctx.drawImage(photoCanvas, 0, bleedPx + stripPx, canvas.width, photoCanvas.height);

    palette.markers.forEach((marker, index) => {
      const left = index === 0 ? 0 : bleedPx + index * colW;
      const right = index === 5 ? canvas.width : bleedPx + (index + 1) * colW;
      ctx.fillStyle = marker.hex;
      ctx.fillRect(left, bleedPx + 4 * DPI, right - left + 1, canvas.height - (bleedPx + 4 * DPI));
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

  function drawCropMarks(doc, artX, artY) {
    const trimLeft = artX + BLEED;
    const trimTop = artY + BLEED;
    const trimRight = trimLeft + TRIM_W;
    const trimBottom = trimTop + TRIM_H;
    const outside = .095;
    const gap = .025;

    doc.setDrawColor(45, 45, 45);
    doc.setLineWidth(.006);

    doc.line(artX - outside, trimTop, artX - gap, trimTop);
    doc.line(artX + ART_W + gap, trimTop, artX + ART_W + outside, trimTop);
    doc.line(artX - outside, trimBottom, artX - gap, trimBottom);
    doc.line(artX + ART_W + gap, trimBottom, artX + ART_W + outside, trimBottom);

    doc.line(trimLeft, artY - outside, trimLeft, artY - gap);
    doc.line(trimRight, artY - outside, trimRight, artY - gap);
    doc.line(trimLeft, artY + ART_H + gap, trimLeft, artY + ART_H + outside);
    doc.line(trimRight, artY + ART_H + gap, trimRight, artY + ART_H + outside);
  }

  function addSheet(doc, firstPage) {
    if (!firstPage) doc.addPage([PAGE_W, PAGE_H], "portrait");
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  async function placeCard(doc, palette, slotIndex, face) {
    const x = SLOT_X;
    const y = SLOT_Y[slotIndex];
    const canvas = face === "front"
      ? await renderFrontCanvas(palette)
      : await renderBackCanvas(palette);
    const format = face === "front" ? "JPEG" : "PNG";
    const data = face === "front"
      ? canvas.toDataURL("image/jpeg", .94)
      : canvas.toDataURL("image/png");

    doc.addImage(data, format, x, y, ART_W, ART_H, undefined, "FAST");
    drawCropMarks(doc, x, y);
  }

  async function exportPrintShopPdf() {
    const palettes = palettesForExport();
    if (!palettes.length) {
      showToast("There are no palettes to export at the current match setting.");
      return;
    }

    const button = document.getElementById("exportPdfButton");
    if (button) button.disabled = true;
    showToast("Building Staples-ready PDF…");

    try {
      const jsPDF = await loadJsPdf();
      const doc = new jsPDF({
        unit: "in",
        format: "letter",
        orientation: "portrait",
        compress: true,
        putOnlyUsedFonts: true,
        precision: 4
      });

      doc.setProperties({
        title: "Ohuhu Palette Cards - Staples Letter Master",
        subject: "8.5 x 11 inch duplex sheets; two square 4 x 5 inch cards per side; 0.125 inch bleed; crop marks; 300 ppi RGB; fronts and backs paired for long-edge duplex printing",
        creator: "Photo Palette Maker",
        keywords: "Staples, letter, 4x5, bleed, crop marks, duplex, square palette cards"
      });

      let firstPage = true;
      for (let offset = 0; offset < palettes.length; offset += 2) {
        const batch = palettes.slice(offset, offset + 2);

        addSheet(doc, firstPage);
        firstPage = false;
        for (let i = 0; i < batch.length; i += 1) {
          await placeCard(doc, batch[i], i, "front");
        }

        addSheet(doc, false);
        for (let i = 0; i < batch.length; i += 1) {
          await placeCard(doc, batch[i], i, "back");
        }

        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`ohuhu-palette-cards-STAPLES-letter-${stamp}.pdf`);
      showToast(`Staples PDF exported: ${palettes.length} square cards, two per Letter sheet side.`);
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
      note.textContent = "Staples-ready Letter PDF: two square 4 × 5 in cards per side, 0.125 in bleed, crop marks, 300 ppi RGB, paired fronts/backs. Choose double-sided printing and flip on the long edge.";
      note.style.maxWidth = "620px";
      note.style.fontSize = "12px";
      note.style.lineHeight = "1.4";
    }
    refreshIcons();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(replaceExportControl, 0));
})();
