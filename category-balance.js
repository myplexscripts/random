(() => {
  const CATEGORIES = ["pastel", "vivid", "moody", "earthy", "warm", "cool", "neutral", "jewel", "muted", "monochrome", "balanced"];
  const LABELS = {
    pastel: "Pastel", vivid: "Vivid", moody: "Moody", earthy: "Earthy", warm: "Warm", cool: "Cool",
    neutral: "Neutral", jewel: "Jewel", muted: "Muted", monochrome: "Monochrome", balanced: "Balanced"
  };
  const PROFILE = {
    pastel: .10, vivid: .10, moody: .08, earthy: .10, warm: .10, cool: .10,
    neutral: .08, jewel: .08, muted: .08, monochrome: .08, balanced: .10
  };
  const SEARCHES = {
    pastel: ["pastel still life", "soft pastel interior", "blush flowers", "pastel dessert", "spring flowers pastel", "soft ceramics"],
    vivid: ["colourful market", "bright fruit still life", "vivid flowers", "colourful food", "painted houses", "colourful pottery"],
    moody: ["moody interior", "dark floral still life", "rainy city night", "misty forest", "stormy coast", "low light still life"],
    earthy: ["earth tone interior", "terracotta pottery", "autumn landscape", "desert landscape", "olive green interior", "rustic ceramics"],
    warm: ["golden hour still life", "warm kitchen interior", "orange flowers", "sunset coast", "cozy cafe", "amber interior"],
    cool: ["blue coast", "winter landscape", "teal interior", "mountain lake", "misty blue forest", "blue ceramic still life"],
    neutral: ["minimal neutral interior", "linen bedding", "white ceramics", "beige still life", "stone interior", "minimalist kitchen"],
    jewel: ["jewel tone interior", "gemstone still life", "peacock colours", "stained glass", "emerald velvet interior", "rich purple flowers"],
    muted: ["muted still life", "dusty rose interior", "sage green interior", "faded vintage colours", "muted ceramics", "hazy landscape"],
    monochrome: ["monochromatic blue", "monochromatic pink", "monochromatic green", "tonal orange still life", "single colour interior", "tonal flowers"],
    balanced: ["curated still life", "farmers market", "flower bouquet", "coffee shop interior", "coastal village", "art studio desk"]
  };
  const KEY_STORAGE = "oahu-unsplash-access-key";

  const sourceHex = original => typeof original === "string" ? original : (typeof original?.hex === "string" ? original.hex : original?.hex?.hex || "#FFFFFF");
  const labsFor = palette => (palette?.originals || []).map(sourceHex).filter(hex => /^#[0-9a-f]{6}$/i.test(hex)).map(hexToOklab);
  const chroma = lab => Math.hypot(lab.a, lab.b);
  const hue = lab => { let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI; return h < 0 ? h + 360 : h; };

  function hueSpan(labs) {
    const hues = labs.filter(lab => chroma(lab) >= .028).map(hue).sort((a, b) => a - b);
    if (hues.length < 3) return 360;
    let largestGap = 0;
    hues.forEach((value, i) => {
      const next = i === hues.length - 1 ? hues[0] + 360 : hues[i + 1];
      largestGap = Math.max(largestGap, next - value);
    });
    return 360 - largestGap;
  }

  function classify(palette) {
    const labs = labsFor(palette);
    if (labs.length !== 6) return "balanced";

    const cs = labs.map(chroma);
    const ls = labs.map(lab => lab.L);
    const sortedL = [...ls].sort((a, b) => a - b);
    const sortedC = [...cs].sort((a, b) => a - b);
    const avgL = ls.reduce((sum, value) => sum + value, 0) / 6;
    const avgC = cs.reduce((sum, value) => sum + value, 0) / 6;
    const medianL = (sortedL[2] + sortedL[3]) / 2;
    const trimmedL = sortedL.slice(1, 5).reduce((sum, value) => sum + value, 0) / 4;
    const trimmedC = sortedC.slice(1, 5).reduce((sum, value) => sum + value, 0) / 4;
    const maxC = Math.max(...cs);

    const dark = labs.filter(v => v.L < .48).length;
    const low = labs.filter(v => v.L < .58).length;
    const light = labs.filter(v => v.L >= .68).length;
    const veryLight = labs.filter(v => v.L >= .76).length;
    const pastelFriendly = labs.filter(v => v.L >= .64 && chroma(v) <= .115).length;
    const vivid = labs.filter(v => chroma(v) >= .095).length;
    const neutralish = labs.filter(v => chroma(v) <= .038).length;
    const warm = labs.filter(v => { const h = hue(v); return h <= 110 || h >= 315; }).length;
    const cool = labs.filter(v => { const h = hue(v); return h > 110 && h < 315; }).length;
    const earthy = labs.filter(v => {
      const h = hue(v), c = chroma(v);
      return h >= 25 && h <= 155 && c >= .018 && c <= .095 && v.L >= .32 && v.L <= .84;
    }).length;
    const jewel = labs.filter(v => v.L >= .28 && v.L <= .70 && chroma(v) >= .072).length;

    // A single black, white, or vivid accent should not decide the whole family.
    // These rules lean on the middle four colours and majority counts so the label
    // reads more like a person would describe the overall palette.
    if ((neutralish >= 5 && avgC <= .034) || (avgC <= .026 && maxC <= .060)) return "neutral";

    if (
      (pastelFriendly >= 4 && medianL >= .66 && trimmedC <= .090 && vivid <= 2)
      || (light >= 4 && trimmedL >= .70 && avgC <= .095 && maxC <= .150)
    ) return "pastel";

    if (jewel >= 3 && medianL <= .64 && avgC >= .060 && veryLight <= 2) return "jewel";

    if ((vivid >= 3 && avgC >= .072) || (avgC >= .098 && vivid >= 2)) return "vivid";

    if (
      (dark >= 4 && medianL <= .50)
      || (low >= 5 && trimmedL <= .53)
      || (dark >= 3 && low >= 5 && veryLight === 0)
    ) return "moody";

    if (earthy >= 4 && avgC <= .095 && vivid <= 2) return "earthy";

    if (avgC >= .028 && avgC <= .062 && trimmedL >= .44 && trimmedL <= .80 && vivid <= 1) return "muted";

    if (hueSpan(labs) <= 58) return "monochrome";

    if (warm >= 4 && pastelFriendly < 4 && medianL < .80) return "warm";
    if (cool >= 4 && pastelFriendly < 4 && medianL < .80) return "cool";

    return "balanced";
  }

  window.classifyPalette = classify;
  window.PALETTE_CATEGORY_LABELS = LABELS;

  const blankCounts = () => Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  function countsFor(palettes = state.palettes) {
    const counts = blankCounts();
    palettes.forEach(p => counts[classify(p)] += 1);
    return counts;
  }

  function profileTargets(total, counts) {
    const targets = {};
    const fractions = [];
    let assigned = 0;
    CATEGORIES.forEach(category => {
      const exact = total * PROFILE[category];
      const base = Math.floor(exact);
      targets[category] = base;
      assigned += base;
      fractions.push({ category, fraction: exact - base, current: counts[category] || 0 });
    });
    fractions.sort((a, b) => b.fraction - a.fraction || a.current - b.current || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
    for (let i = 0; assigned < total; i += 1, assigned += 1) targets[fractions[i % fractions.length].category] += 1;
    return targets;
  }

  function mostNeeded(counts, targets) {
    return [...CATEGORIES].sort((a, b) => (targets[b] - counts[b]) - (targets[a] - counts[a]) || counts[a] - counts[b])[0];
  }

  function setDistance(a, b) {
    const A = labsFor(a), B = labsFor(b);
    if (A.length !== 6 || B.length !== 6) return Infinity;
    const directed = (from, to) => from.reduce((sum, lab) => sum + Math.min(...to.map(other => oklabDistance(lab, other))), 0) / from.length;
    return (directed(A, B) + directed(B, A)) / 2;
  }

  isDuplicatePalette = candidate => {
    const codes = new Set(candidate.markers.map(m => m.code));
    const category = classify(candidate);
    return state.palettes.some(existing => {
      let overlap = 0;
      const existingCodes = new Set(existing.markers.map(m => m.code));
      codes.forEach(code => { if (existingCodes.has(code)) overlap += 1; });
      if (overlap >= 5) return true;
      const distance = setDistance(candidate, existing);
      if (distance < .050) return true;
      if (category === classify(existing) && distance < .064) return true;
      return overlap >= 4 && distance < .082;
    });
  };

  function canAccept(category, counts, targets, made, target, attempts, maxAttempts) {
    if (counts[category] < targets[category]) return true;
    if (!CATEGORIES.some(c => counts[c] < targets[c])) return true;
    const hardCap = Math.max(...Object.values(targets)) + 1;
    if (counts[category] >= hardCap) return false;
    return attempts / maxAttempts >= .84 || made / target >= .88;
  }

  function summary() {
    const heading = document.querySelector(".library .section-heading");
    if (!heading) return;
    let box = document.getElementById("paletteCategorySummary");
    if (!box) {
      box = document.createElement("div");
      box.id = "paletteCategorySummary";
      box.className = "palette-category-summary";
      heading.insertAdjacentElement("afterend", box);
    }
    const counts = countsFor();
    box.innerHTML = CATEGORIES.map(c => `<span><strong>${LABELS[c]}</strong> ${counts[c]}</span>`).join("");
    box.hidden = state.palettes.length === 0;
  }

  window.updatePaletteCategorySummary = summary;

  generateBatch = async function generateColourCubeBalancedBatch() {
    if (state.running || state.markers.length !== 100) return;
    if (!(localStorage.getItem(KEY_STORAGE) || "").trim()) { showToast("Add your Unsplash access key first."); return; }

    const target = Number(els.targetCount.value || 24);
    const starting = state.palettes.length;
    const counts = countsFor();
    const targets = profileTargets(starting + target, counts);
    const maxSearches = Math.min(42, Math.max(16, Math.ceil(target * .58)));
    const maxAttempts = maxSearches * 30;
    let searches = 0;

    state.stopRequested = false;
    state.attempts = 0;
    state.rejected = 0;
    els.progressWrap.hidden = false;
    setBusy(true, "Building a balanced 11-family collection");

    try {
      while (!state.stopRequested && state.palettes.length - starting < target && state.attempts < maxAttempts && searches < maxSearches) {
        const wanted = mostNeeded(counts, targets);
        const pool = SEARCHES[wanted];
        const subject = pool[Math.floor(Math.random() * pool.length)];
        els.progressLabel.textContent = `Finding ${LABELS[wanted]} palettes`;
        searches += 1;
        const photos = await sourcePhotos(subject).catch(error => { console.warn("Unsplash sourcing failed", error); return []; });
        if (!photos.length) { state.rejected += 1; continue; }
        shuffle(photos);

        for (const photo of photos) {
          const made = state.palettes.length - starting;
          if (state.stopRequested || made >= target || state.attempts >= maxAttempts) break;
          if (state.usedPhotoIds.has(String(photo.id))) continue;
          state.attempts += 1;
          els.progressBar.style.width = `${clamp(made / target * 100, 0, 100)}%`;
          els.progressMeta.textContent = `${made}/${target} kept · ${state.rejected} rejected · ${searches}/${maxSearches} searches`;

          try {
            const analysis = await analysePhoto(photo);
            if (!analysis || analysis.markers.length !== 6 || analysis.originals.length !== 6) { state.rejected += 1; continue; }
            const candidate = {
              id: `${photo.source}-${photo.id}`, photoId: String(photo.id), subject,
              image: photo.image, printImage: photo.printImage || photo.image, sourceUrl: photo.sourceUrl,
              source: photo.source, creator: photo.creator || "Unknown creator", licence: photo.licence || "See source",
              score: Math.round(analysis.score),
              markers: analysis.markers.map(m => ({ code: m.code, name: m.name || m.code, hex: m.hex })),
              originals: analysis.originals.map(o => ({ hex: sourceHex(o) })), complexity: analysis.complexity || null, createdAt: Date.now()
            };
            candidate.category = classify(candidate);
            if (!canAccept(candidate.category, counts, targets, made, target, state.attempts, maxAttempts) || isDuplicatePalette(candidate)) {
              state.rejected += 1; continue;
            }
            state.palettes.unshift(candidate);
            state.usedPhotoIds.add(String(photo.id));
            counts[candidate.category] += 1;
            persistPalettes();
            renderPalettes();
          } catch (error) {
            console.warn("Photo analysis failed", error);
            state.rejected += 1;
          }
        }
      }
      const made = state.palettes.length - starting;
      if (state.stopRequested) showToast(`Stopped after ${made} palette${made === 1 ? "" : "s"}.`);
      else if (made < target) showToast(`Created ${made} balanced palettes before the quality/API limit was reached.`);
      else showToast(`Created ${made} balanced photo palettes.`);
    } finally {
      const made = state.palettes.length - starting;
      els.progressBar.style.width = `${clamp(made / target * 100, 0, 100)}%`;
      els.progressLabel.textContent = "Complete";
      els.progressMeta.textContent = `${made}/${target} kept · ${state.rejected} rejected`;
      setBusy(false, "Ready");
      setTimeout(() => { els.progressWrap.hidden = true; }, 1100);
      summary();
    }
  };

  const priorRenderPalettes = renderPalettes;
  renderPalettes = function renderPalettesWithElevenFamilySummary() {
    priorRenderPalettes();
    setTimeout(summary, 0);
  };

  document.addEventListener("DOMContentLoaded", () => {
    let changed = false;
    state.palettes.forEach(p => { const c = classify(p); if (p.category !== c) { p.category = c; changed = true; } });
    if (changed) persistPalettes();
    setTimeout(summary, 20);
  });
})();