(() => {
  const PAGE_W = 8.5;
  const PAGE_H = 11;
  const CARD_W = 4;
  const CARD_H = 5;
  const DPI = 300;
  const STRIP_H = 1;
  const SLOT_X = (PAGE_W - CARD_W) / 2;
  const SLOT_GAP = .25;
  const TOTAL_H = CARD_H * 2 + SLOT_GAP;
  const SLOT_TOP = (PAGE_H - TOTAL_H) / 2;
  const SLOT_Y = [SLOT_TOP, SLOT_TOP + CARD_H + SLOT_GAP];
  const CROP_GAP = .04;
  const CROP_LEN = .12;

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
    canvas.width = CARD_W * DPI;
    canvas.height = CARD_H * DPI;
    const ctx = canvas.getContext("2d");
    const colW = canvas.width / 6;
    const stripPx = STRIP_H * DPI;

    palette.originals.forEach((original, index) => {
      ctx.fillStyle = sourceHex(original);
      ctx.fillRect(index * colW, 0, Math.ceil(colW) + 1, stripPx);
    });

    const image = await loadCorsImage(palette.printImage || palette.image);
    const photoCanvas = document.createElement("canvas");
    photoCanvas.width = canvas.width;
    photoCanvas.height = 3 * DPI;
    drawCover(photoCanvas.getContext("2d"), image, photoCanvas.width, photoCanvas.height);
    ctx.drawImage(photoCanvas, 0, stripPx, canvas.width, photoCanvas.height);

    palette.markers.forEach((marker, index) => {
      ctx.fillStyle = marker.hex;
      ctx.fillRect(index * colW, canvas.height - stripPx, Math.ceil(colW) + 1, stripPx);
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
      ctx.fillRect(index * colW, 0, Math.ceil(colW) + 1, halfH);
    });

    markers.forEach((marker, index) => {
      const left = index * colW;
      ctx.fillStyle = marker.hex;
      ctx.fillRect(left, halfH, Math.ceil(colW) + 1, halfH);

      ctx.save();
      ctx.translate(left + 52, halfH + 34);
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

  function addSheet(doc, firstPage) {
    if (!firstPage) doc.addPage([PAGE_W, PAGE_H], "portrait");
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  function drawCropMarks(doc, x, y) {
    const right = x + CARD_W;
    const bottom = y + CARD_H;
    doc.setDrawColor(45, 45, 45);
    doc.setLineWidth(.005);

    doc.line(x - CROP_GAP - CROP_LEN, y, x - CROP_GAP, y);
    doc.line(right + CROP_GAP, y, right + CROP_GAP + CROP_LEN, y);
    doc.line(x - CROP_GAP - CROP_LEN, bottom, x - CROP_GAP, bottom);
    doc.line(right + CROP_GAP, bottom, right + CROP_GAP + CROP_LEN, bottom);

    doc.line(x, y - CROP_GAP - CROP_LEN, x, y - CROP_GAP);
    doc.line(right, y - CROP_GAP - CROP_LEN, right, y - CROP_GAP);
    doc.line(x, bottom + CROP_GAP, x, bottom + CROP_GAP + CROP_LEN);
    doc.line(right, bottom + CROP_GAP, right, bottom + CROP_GAP + CROP_LEN);
  }

  async function placeCard(doc, palette, slotIndex, face) {
    const canvas = face === "front"
      ? await renderFrontCanvas(palette)
      : await renderBackCanvas(palette);
    const format = face === "front" ? "JPEG" : "PNG";
    const data = face === "front"
      ? canvas.toDataURL("image/jpeg", .95)
      : canvas.toDataURL("image/png");
    const x = SLOT_X;
    const y = SLOT_Y[slotIndex];

    doc.addImage(data, format, x, y, CARD_W, CARD_H, undefined, "FAST");
    drawCropMarks(doc, x, y);
  }

  async function exportStaplesPdf() {
    const palettes = palettesForExport();
    if (!palettes.length) {
      showToast("There are no palettes to export at the current match setting.");
      return;
    }

    const button = document.getElementById("exportPdfButton");
    if (button) button.disabled = true;
    showToast("Building Staples card-cut PDF…");

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
        title: "Ohuhu Palette Cards - Staples Card Cut",
        subject: "8.5 x 11 inch duplex sheets with two exact 4 x 5 inch square-corner cards per side; no bleed; trim crop marks; 300 ppi RGB; aligned for long-edge duplex printing and Complex Cutting As Cards",
        creator: "Photo Palette Maker",
        keywords: "Staples, complex cutting, as cards, letter, 4x5, crop marks, duplex, square palette cards"
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
      doc.save(`ohuhu-palette-cards-STAPLES-card-cut-${stamp}.pdf`);
      showToast(`Staples PDF exported: ${palettes.length} cards, two per Letter side.`);
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
    button.innerHTML = '<i data-lucide="file-down"></i>Staples PDF';
    button.addEventListener("click", exportStaplesPdf);

    const note = document.querySelector(".pdf-export-note");
    if (note) {
      note.textContent = "Staples setup: Letter, double-sided colour, flip on long edge, Complex Cutting → As Cards. The PDF has two exact 4 × 5 in square-corner cards per side with a 0.25 in gap, no bleed, and subtle trim crop marks.";
      note.style.maxWidth = "680px";
      note.style.fontSize = "12px";
      note.style.lineHeight = "1.4";
    }

    const footer = document.querySelector(".app-footer p");
    if (footer) {
      footer.textContent = "Cards are fixed at 4 × 5 in with square corners. The Staples PDF uses 8.5 × 11 in Letter pages with two exact-size cards per side, no bleed, subtle trim crop marks, and aligned fronts/backs for double-sided long-edge printing with Complex Cutting → As Cards.";
    }

    refreshIcons();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(replaceExportControl, 0));
})();
