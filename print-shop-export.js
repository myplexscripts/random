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
  const CATEGORY_ORDER = ["pastel", "vivid", "moody", "earthy", "warm", "cool", "neutral", "jewel", "muted", "monochrome", "balanced"];
  const FALLBACK_LABELS = {
    pastel: "Pastel", vivid: "Vivid", moody: "Moody", earthy: "Earthy", warm: "Warm", cool: "Cool",
    neutral: "Neutral", jewel: "Jewel", muted: "Muted", monochrome: "Monochrome", balanced: "Balanced"
  };
  const CATEGORY_BACKS = {
    pastel: {
      background: "#E9DDE8",
      foreground: "#352F34",
      blurb: "Soft colour can still carry a lot of character. Let these palettes slow things down, leave room to breathe, and make subtle shifts matter."
    },
    vivid: {
      background: "#D65343",
      foreground: "#FFFFFF",
      blurb: "Turn the volume up. These palettes are built for bold contrasts, clear focal points, and colour that refuses to sit quietly."
    },
    moody: {
      background: "#34323C",
      foreground: "#FFFFFF",
      blurb: "Lean into shadow, atmosphere, and restraint. Moody palettes work best when every colour earns its place."
    },
    earthy: {
      background: "#77664F",
      foreground: "#FFFFFF",
      blurb: "Grounded, warm, and easy to live with. These palettes borrow from soil, stone, wood, leaves, and colours that already know how to work together."
    },
    warm: {
      background: "#C86D3E",
      foreground: "#FFFFFF",
      blurb: "Use warmth to pull things closer. These palettes are made for glow, comfort, energy, and that last bit of light before evening."
    },
    cool: {
      background: "#55738C",
      foreground: "#FFFFFF",
      blurb: "Clean, calm, and spacious. Cool palettes are great for creating distance, clarity, and a quieter kind of contrast."
    },
    neutral: {
      background: "#B8B1A5",
      foreground: "#25231F",
      blurb: "Neutrals are not empty space. They are where texture, value, and the smallest colour shifts get to do the heavy lifting."
    },
    jewel: {
      background: "#59436F",
      foreground: "#FFFFFF",
      blurb: "Rich colour, deep contrast, and a little drama. Jewel tones are at their best when they feel deliberate rather than decorative."
    },
    muted: {
      background: "#8A817D",
      foreground: "#FFFFFF",
      blurb: "Dial the saturation back and the relationships forward. Muted palettes make small differences feel more important."
    },
    monochrome: {
      background: "#4F6874",
      foreground: "#FFFFFF",
      blurb: "One colour family, plenty of range. Let value, temperature, and saturation create the movement instead of hue changes."
    },
    balanced: {
      background: "#70745F",
      foreground: "#FFFFFF",
      blurb: "Nothing has to dominate. Balanced palettes give you room to move between quiet and bold without losing cohesion."
    }
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

  function categoryFor(palette) {
    if (typeof window.classifyPalette === "function") return window.classifyPalette(palette);
    return palette.category || "balanced";
  }

  function categoryLabel(category) {
    return window.PALETTE_CATEGORY_LABELS?.[category] || FALLBACK_LABELS[category] || category;
  }

  function buildDeck(palettes) {
    const groups = Object.fromEntries(CATEGORY_ORDER.map(category => [category, []]));
    palettes.forEach(palette => {
      const category = categoryFor(palette);
      if (!groups[category]) groups[category] = [];
      groups[category].push(palette);
    });

    Object.values(groups).forEach(group => {
      group.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    });

    const deck = [];
    let collectionNumber = 1;

    CATEGORY_ORDER.forEach(category => {
      const group = groups[category] || [];
      if (!group.length) return;
      const startNumber = collectionNumber;
      const numbered = group.map(palette => ({
        palette,
        collectionNumber: collectionNumber++
      }));
      const endNumber = collectionNumber - 1;

      deck.push({
        type: "title",
        category,
        label: categoryLabel(category),
        cards: numbered,
        startNumber,
        endNumber
      });

      numbered.forEach(item => deck.push({
        type: "palette",
        category,
        palette: item.palette,
        collectionNumber: item.collectionNumber
      }));
    });

    return deck;
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

  function drawNumberBadge(ctx, number, photoTop) {
    const radius = 47;
    const edgeGap = 30;
    const cx = radius + edgeGap;
    const cy = photoTop + radius + edgeGap;
    const digits = String(number).length;
    const fontSize = digits <= 2 ? 34 : digits === 3 ? 29 : 25;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.fillStyle = "#171814";
    ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), cx, cy + 1);
    ctx.restore();
  }

  async function renderFrontCanvas(palette, collectionNumber, withNumber = true) {
    if (document.fonts?.load) await Promise.allSettled([document.fonts.load("800 34px Inter")]);

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
    drawCover(ctx, image, 0, stripPx, canvas.width, 3 * DPI);

    if (withNumber && Number.isFinite(collectionNumber)) {
      drawNumberBadge(ctx, collectionNumber, stripPx);
    }

    palette.markers.forEach((marker, index) => {
      ctx.fillStyle = marker.hex;
      ctx.fillRect(index * colW, canvas.height - stripPx, Math.ceil(colW) + 1, stripPx);
    });

    return canvas;
  }

  function truncateToWidth(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let shown = String(text);
    while (shown.length > 3 && ctx.measureText(`${shown}…`).width > maxWidth) shown = shown.slice(0, -1);
    return `${shown.trim()}…`;
  }

  function drawVerticalMarkerLabel(ctx, marker, left, colW, halfH) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = Math.max(360, Math.floor(halfH - 64));
    labelCanvas.height = 92;
    const labelCtx = labelCanvas.getContext("2d");
    const textColour = readableText(marker.hex);
    const baseline = 58;
    const startX = 10;

    labelCtx.fillStyle = textColour;
    labelCtx.textBaseline = "alphabetic";
    labelCtx.font = "800 34px Inter, Arial, sans-serif";
    labelCtx.fillText(marker.code, startX, baseline);
    const codeWidth = labelCtx.measureText(marker.code).width;

    labelCtx.font = "600 28px Inter, Arial, sans-serif";
    const nameX = startX + codeWidth + 15;
    const maxNameWidth = labelCanvas.width - nameX - 16;
    const name = truncateToWidth(labelCtx, marker.name || marker.code, maxNameWidth);
    labelCtx.fillText(name, nameX, baseline);

    ctx.save();
    ctx.translate(left + colW * .34, halfH + 26);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(labelCanvas, 0, -labelCanvas.height / 2);
    ctx.restore();
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
      drawVerticalMarkerLabel(ctx, marker, left, colW, halfH);
    });

    return canvas;
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  async function renderTitleCanvas(titleItem) {
    if (document.fonts?.load) {
      await Promise.allSettled([
        document.fonts.load("800 78px Inter"),
        document.fonts.load("700 28px Inter"),
        document.fonts.load("600 24px Inter")
      ]);
    }

    const canvas = document.createElement("canvas");
    canvas.width = CARD_W * DPI;
    canvas.height = CARD_H * DPI;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#F7F6F2";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#777970";
    ctx.font = "700 28px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("PALETTE FAMILY", width / 2, 100);

    ctx.fillStyle = "#191A17";
    ctx.font = "800 78px Inter, Arial, sans-serif";
    ctx.fillText(titleItem.label, width / 2, 194);

    ctx.fillStyle = "#70726B";
    ctx.font = "600 24px Inter, Arial, sans-serif";
    const range = titleItem.startNumber === titleItem.endNumber
      ? `Card ${titleItem.startNumber}`
      : `Cards ${titleItem.startNumber}–${titleItem.endNumber}`;
    ctx.fillText(range, width / 2, 238);

    const miniCanvases = [];
    for (const card of titleItem.cards) {
      miniCanvases.push(await renderFrontCanvas(card.palette, card.collectionNumber, false));
    }

    const count = miniCanvases.length;
    const cols = count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : 5;
    const rows = Math.ceil(count / cols);
    const gap = 18;
    const sidePad = 70;
    const gridTop = 300;
    const bottomPad = 70;
    const availableW = width - sidePad * 2;
    const availableH = height - gridTop - bottomPad;

    let thumbW = (availableW - gap * (cols - 1)) / cols;
    let thumbH = thumbW * 1.25;
    const maxThumbH = (availableH - gap * (rows - 1)) / rows;
    if (thumbH > maxThumbH) {
      thumbH = maxThumbH;
      thumbW = thumbH * .8;
    }

    const gridW = cols * thumbW + (cols - 1) * gap;
    const gridH = rows * thumbH + (rows - 1) * gap;
    const startX = (width - gridW) / 2;
    const startY = gridTop + Math.max(0, (availableH - gridH) / 2);

    miniCanvases.forEach((mini, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = startX + col * (thumbW + gap);
      const y = startY + row * (thumbH + gap);
      ctx.drawImage(mini, x, y, thumbW, thumbH);
      ctx.strokeStyle = "rgba(25,26,23,.14)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, thumbW, thumbH);
    });

    return canvas;
  }

  async function renderTitleBackCanvas(titleItem) {
    if (document.fonts?.load) {
      await Promise.allSettled([
        document.fonts.load("800 76px Inter"),
        document.fonts.load("600 34px Inter")
      ]);
    }

    const canvas = document.createElement("canvas");
    canvas.width = CARD_W * DPI;
    canvas.height = CARD_H * DPI;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const style = CATEGORY_BACKS[titleItem.category] || CATEGORY_BACKS.balanced;

    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = style.foreground;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 76px Inter, Arial, sans-serif";
    ctx.fillText(titleItem.label, width / 2, 430);

    ctx.font = "600 34px Inter, Arial, sans-serif";
    const maxWidth = width - 210;
    const lines = wrapText(ctx, style.blurb, maxWidth);
    const lineHeight = 53;
    const totalHeight = Math.max(0, lines.length - 1) * lineHeight;
    const startY = 690 - totalHeight / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight);
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

  async function canvasForDeckItem(item, face) {
    if (item.type === "title") {
      return face === "front" ? renderTitleCanvas(item) : renderTitleBackCanvas(item);
    }
    return face === "front"
      ? renderFrontCanvas(item.palette, item.collectionNumber, true)
      : renderBackCanvas(item.palette);
  }

  async function placeDeckItem(doc, item, slotIndex, face) {
    const canvas = await canvasForDeckItem(item, face);
    const format = face === "front" && item.type === "palette" ? "JPEG" : "PNG";
    const data = format === "JPEG"
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

    const deck = buildDeck(palettes);
    const titleCount = deck.filter(item => item.type === "title").length;
    const button = document.getElementById("exportPdfButton");
    if (button) button.disabled = true;
    showToast("Building numbered Staples deck with category cards…");

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
        subject: "8.5 x 11 inch duplex sheets with two exact 4 x 5 inch square-corner cards per side; category divider cards with solid inspirational backs; numbered palette fronts; no bleed; trim crop marks; 300 ppi RGB; aligned for long-edge duplex printing and Complex Cutting As Cards",
        creator: "Photo Palette Maker",
        keywords: "Staples, complex cutting, as cards, letter, 4x5, category cards, numbered, crop marks, duplex, square palette cards"
      });

      let firstPage = true;
      for (let offset = 0; offset < deck.length; offset += 2) {
        const batch = deck.slice(offset, offset + 2);

        addSheet(doc, firstPage);
        firstPage = false;
        for (let i = 0; i < batch.length; i += 1) {
          await placeDeckItem(doc, batch[i], i, "front");
        }

        addSheet(doc, false);
        for (let i = 0; i < batch.length; i += 1) {
          await placeDeckItem(doc, batch[i], i, "back");
        }

        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`ohuhu-palette-cards-STAPLES-card-cut-${stamp}.pdf`);
      showToast(`Staples PDF exported: ${palettes.length} numbered palettes + ${titleCount} category cards.`);
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
      note.textContent = "Staples setup: Letter, double-sided colour, flip on long edge, Complex Cutting → As Cards. Export groups palettes by family, inserts a category title card with a solid category blurb on its back, numbers every palette on the image, and includes subtle 4 × 5 in trim crop marks.";
      note.style.maxWidth = "720px";
      note.style.fontSize = "12px";
      note.style.lineHeight = "1.4";
    }

    const footer = document.querySelector(".app-footer p");
    if (footer) {
      footer.textContent = "Cards are fixed at 4 × 5 in with square corners. The Staples PDF groups the deck by palette family, adds category divider cards with miniature unnumbered palette fronts and solid category blurbs on the backs, numbers every palette card, includes subtle trim crop marks, and aligns fronts/backs for double-sided long-edge printing with Complex Cutting → As Cards.";
    }

    refreshIcons();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(replaceExportControl, 0));
})();