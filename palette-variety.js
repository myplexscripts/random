(() => {
  const KEY_STORAGE = "oahu-unsplash-access-key";
  const CATEGORY_ORDER = ["pastel", "vivid", "moody", "earthy", "warm", "cool", "neutral", "balanced"];
  const CATEGORY_LABELS = {
    pastel: "Pastel",
    vivid: "Vivid",
    moody: "Moody",
    earthy: "Earthy",
    warm: "Warm",
    cool: "Cool",
    neutral: "Neutral",
    balanced: "Balanced"
  };
  const CATEGORY_WEIGHTS = {
    pastel: .15,
    vivid: .17,
    moody: .15,
    earthy: .15,
    warm: .13,
    cool: .13,
    neutral: .06,
    balanced: .06
  };
  const CATEGORY_SEARCHES = {
    pastel: [
      "pastel still life", "soft pastel interior", "blush flowers", "light airy bedroom",
      "pastel dessert", "spring flowers pastel", "pastel architecture", "soft ceramics"
    ],
    vivid: [
      "colourful market", "bright fruit still life", "vivid flowers", "colourful food",
      "painted houses", "bright fashion", "neon city", "colourful pottery"
    ],
    moody: [
      "moody interior", "dark floral still life", "rainy city night", "misty forest",
      "cinematic shadows", "dark food photography", "stormy coast", "low light still life"
    ],
    earthy: [
      "earth tone interior", "terracotta pottery", "autumn landscape", "wood workshop",
      "desert landscape", "olive green interior", "rustic ceramics", "natural linen still life"
    ],
    warm: [
      "golden hour", "warm kitchen interior", "orange flowers", "sunset coast",
      "cozy cafe", "warm food photography", "amber interior", "autumn market"
    ],
    cool: [
      "blue coast", "winter landscape", "teal interior", "mountain lake",
      "cool toned architecture", "misty blue forest", "ocean morning", "blue ceramic still life"
    ],
    neutral: [
      "minimal neutral interior", "linen bedding", "concrete architecture", "white ceramics",
      "monochrome interior", "beige still life", "stone texture interior", "minimalist kitchen"
    ],
    balanced: [
      "curated still life", "farmers market", "flower bouquet", "coffee shop interior",
      "coastal village", "botanical still life", "ceramic studio", "art studio desk"
    ]
  };

  function sourceHex(original) {
    if (typeof original === "string") return original;
    if (original?.hex && typeof original.hex === "string") return original.hex;
    if (original?.hex?.hex) return original.hex.hex;
    return "#FFFFFF";
  }

  function paletteLabs(palette) {
    return (palette?.originals || [])
      .map(sourceHex)
      .filter(hex => /^#[0-9a-f]{6}$/i.test(hex))
      .map(hexToOklab)
      .sort((a, b) => a.L - b.L);
  }

  function labChroma(lab) {
    return Math.hypot(lab.a, lab.b);
  }

  function hueDegrees(lab) {
    let degrees = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (degrees < 0) degrees += 360;
    return degrees;
  }

  function classifyPalette(palette) {
    const labs = paletteLabs(palette);
    if (labs.length !== 6) return "balanced";

    const avgL = labs.reduce((sum, lab) => sum + lab.L, 0) / labs.length;
    const chromas = labs.map(labChroma);
    const avgC = chromas.reduce((sum, value) => sum + value, 0) / chromas.length;
    const maxC = Math.max(...chromas);
    const darkCount = labs.filter(lab => lab.L < .48).length;
    const warmCount = labs.filter(lab => {
      const hue = hueDegrees(lab);
      return hue <= 105 || hue >= 330;
    }).length;
    const coolCount = labs.filter(lab => {
      const hue = hueDegrees(lab);
      return hue > 105 && hue < 330;
    }).length;
    const earthyCount = labs.filter(lab => {
      const hue = hueDegrees(lab);
      const c = labChroma(lab);
      return hue >= 30 && hue <= 155 && c >= .018 && c <= .095 && lab.L >= .34 && lab.L <= .82;
    }).length;

    if (avgL >= .73 && avgC <= .078 && maxC <= .14) return "pastel";
    if (avgC >= .085 || maxC >= .155) return "vivid";
    if (avgL <= .53 || darkCount >= 3) return "moody";
    if (avgC <= .030) return "neutral";
    if (earthyCount >= 3 && avgC <= .090) return "earthy";
    if (warmCount >= 4) return "warm";
    if (coolCount >= 4) return "cool";
    return "balanced";
  }

  window.classifyPalette = classifyPalette;
  window.PALETTE_CATEGORY_LABELS = CATEGORY_LABELS;

  function buildCategoryTargets(target) {
    const targets = {};
    const fractions = [];
    let assigned = 0;
    CATEGORY_ORDER.forEach(category => {
      const exact = target * CATEGORY_WEIGHTS[category];
      const base = Math.floor(exact);
      targets[category] = base;
      assigned += base;
      fractions.push({ category, fraction: exact - base });
    });
    fractions.sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; assigned < target; i += 1, assigned += 1) {
      targets[fractions[i % fractions.length].category] += 1;
    }
    return targets;
  }

  function emptyCategoryCounts() {
    return Object.fromEntries(CATEGORY_ORDER.map(category => [category, 0]));
  }

  function mostNeededCategory(counts, targets) {
    return CATEGORY_ORDER
      .map(category => ({ category, deficit: (targets[category] || 0) - (counts[category] || 0) }))
      .sort((a, b) => b.deficit - a.deficit || (counts[a.category] || 0) - (counts[b.category] || 0))[0]?.category || "balanced";
  }

  function nextCategorySubject(category) {
    const pool = CATEGORY_SEARCHES[category] || PHOTO_SUBJECTS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function similarPaletteDistance(a, b) {
    const aLabs = paletteLabs(a);
    const bLabs = paletteLabs(b);
    if (aLabs.length !== 6 || bLabs.length !== 6) return Infinity;
    return aLabs.reduce((sum, lab, index) => sum + oklabDistance(lab, bLabs[index]), 0) / 6;
  }

  isDuplicatePalette = function isDuplicateOrTooSimilar(candidate) {
    const codes = new Set(candidate.markers.map(marker => marker.code));
    const category = candidate.category || classifyPalette(candidate);

    return state.palettes.some(existing => {
      const existingCodes = new Set(existing.markers.map(marker => marker.code));
      let overlap = 0;
      codes.forEach(code => { if (existingCodes.has(code)) overlap += 1; });
      if (overlap >= 5) return true;

      const distance = similarPaletteDistance(candidate, existing);
      if (distance < .052) return true;
      const existingCategory = existing.category || classifyPalette(existing);
      if (category === existingCategory && distance < .066) return true;
      return overlap >= 4 && distance < .088;
    });
  };

  function shouldAcceptCategory(category, counts, targets, made, target, attempts, maxAttempts) {
    if ((counts[category] || 0) < (targets[category] || 0)) return true;

    const underfilled = CATEGORY_ORDER.some(item => (counts[item] || 0) < (targets[item] || 0));
    if (!underfilled) return true;

    const hardCap = Math.max((targets[category] || 0) + 2, Math.ceil(target * .22));
    if ((counts[category] || 0) >= hardCap) return false;

    const attemptProgress = attempts / Math.max(1, maxAttempts);
    const batchProgress = made / Math.max(1, target);
    return attemptProgress >= .72 || batchProgress >= .78;
  }

  function updateCategorySummary() {
    const library = document.querySelector(".library");
    const heading = library?.querySelector(".section-heading");
    if (!library || !heading) return;

    let summary = document.getElementById("paletteCategorySummary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "paletteCategorySummary";
      summary.className = "palette-category-summary";
      heading.insertAdjacentElement("afterend", summary);
    }

    const counts = emptyCategoryCounts();
    state.palettes.forEach(palette => {
      const category = palette.category || classifyPalette(palette);
      counts[category] = (counts[category] || 0) + 1;
    });

    summary.innerHTML = CATEGORY_ORDER
      .filter(category => counts[category] > 0)
      .map(category => `<span><strong>${CATEGORY_LABELS[category]}</strong> ${counts[category]}</span>`)
      .join("");
    summary.hidden = state.palettes.length === 0;
  }

  function injectCategoryStyles() {
    if (document.getElementById("paletteCategoryStyles")) return;
    const style = document.createElement("style");
    style.id = "paletteCategoryStyles";
    style.textContent = `
      .palette-category-summary{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 20px}
      .palette-category-summary span{display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font-size:14px}
      .palette-category-summary strong{color:var(--ink);font-weight:750}
    `;
    document.head.appendChild(style);
  }

  function buildPrintImage(rawUrl, fallback) {
    if (!rawUrl) return fallback;
    try {
      const url = new URL(rawUrl);
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("w", "1800");
      url.searchParams.set("q", "90");
      return url.toString();
    } catch {
      return fallback;
    }
  }

  sourcePhotos = async function sourcePhotosForVariety(subject) {
    const accessKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    if (!accessKey) return [];

    const page = 1 + Math.floor(Math.random() * 3);
    const params = new URLSearchParams({
      query: subject,
      page: String(page),
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
        analysisImage: photo.urls.small || photo.urls.regular,
        printImage: buildPrintImage(photo.urls.raw, photo.urls.full || photo.urls.regular),
        sourceUrl: photo.links?.html
          ? `${photo.links.html}${photo.links.html.includes("?") ? "&" : "?"}utm_source=myplexscripts_photo_palette_maker&utm_medium=referral`
          : "https://unsplash.com/",
        source: "Unsplash",
        creator: photo.user?.name || photo.user?.username || "Unsplash photographer",
        licence: "Unsplash license"
      }));
  };

  const originalRestorePalettes = restorePalettes;
  restorePalettes = function restorePalettesWithCategories() {
    originalRestorePalettes();
    let changed = false;
    state.palettes.forEach(palette => {
      if (!palette.category) {
        palette.category = classifyPalette(palette);
        changed = true;
      }
    });
    if (changed) persistPalettes();
  };

  generateBatch = async function generateBalancedBatch() {
    if (state.running || state.markers.length !== 100) return;
    const accessKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    if (!accessKey) {
      showToast("Add your Unsplash access key first.");
      return;
    }

    const target = Number(els.targetCount.value || 24);
    const startingCount = state.palettes.length;
    const targets = buildCategoryTargets(target);
    const batchCounts = emptyCategoryCounts();
    const maxSearchRequests = Math.min(42, Math.max(14, Math.ceil(target * .55)));
    const maxAttempts = maxSearchRequests * 30;
    let searchRequests = 0;

    state.stopRequested = false;
    state.attempts = 0;
    state.rejected = 0;
    els.progressWrap.hidden = false;
    setBusy(true, "Building a varied collection");

    try {
      while (!state.stopRequested
        && state.palettes.length - startingCount < target
        && state.attempts < maxAttempts
        && searchRequests < maxSearchRequests) {
        const preferredCategory = mostNeededCategory(batchCounts, targets);
        const subject = nextCategorySubject(preferredCategory);
        els.progressLabel.textContent = `Finding ${CATEGORY_LABELS[preferredCategory]} palettes`;
        els.progressMeta.textContent = `${state.palettes.length - startingCount}/${target} kept · ${state.rejected} rejected`;

        searchRequests += 1;
        const photos = await sourcePhotos(subject).catch(error => {
          console.warn("Unsplash sourcing failed", error);
          return [];
        });

        if (!photos.length) {
          state.rejected += 1;
          continue;
        }

        shuffle(photos);
        for (const photo of photos) {
          const made = state.palettes.length - startingCount;
          if (state.stopRequested || made >= target || state.attempts >= maxAttempts) break;
          if (state.usedPhotoIds.has(String(photo.id))) continue;

          state.attempts += 1;
          els.progressBar.style.width = `${clamp(made / Math.max(1, target) * 100, 0, 100)}%`;
          els.progressMeta.textContent = `${made}/${target} kept · ${state.rejected} rejected · ${searchRequests}/${maxSearchRequests} searches`;

          try {
            const analysis = await analysePhoto(photo);
            if (!analysis || analysis.markers.length !== 6 || analysis.originals.length !== 6) {
              state.rejected += 1;
              continue;
            }

            const candidate = {
              id: `${photo.source}-${photo.id}`,
              photoId: String(photo.id),
              subject,
              image: photo.image,
              printImage: photo.printImage || photo.image,
              sourceUrl: photo.sourceUrl,
              source: photo.source,
              creator: photo.creator || "Unknown creator",
              licence: photo.licence || "See source",
              score: Math.round(analysis.score),
              markers: analysis.markers.map(marker => ({
                code: marker.code,
                name: marker.name || marker.code,
                hex: marker.hex
              })),
              originals: analysis.originals.map(original => ({ hex: sourceHex(original) })),
              complexity: analysis.complexity || null,
              createdAt: Date.now()
            };
            candidate.category = classifyPalette(candidate);

            if (!shouldAcceptCategory(candidate.category, batchCounts, targets, made, target, state.attempts, maxAttempts)
              || isDuplicatePalette(candidate)) {
              state.rejected += 1;
              continue;
            }

            state.palettes.unshift(candidate);
            state.usedPhotoIds.add(String(photo.id));
            batchCounts[candidate.category] += 1;
            persistPalettes();
            renderPalettes();
            updateCategorySummary();
          } catch (error) {
            console.warn("Photo analysis failed", error);
            state.rejected += 1;
          }
        }
      }

      const made = state.palettes.length - startingCount;
      if (state.stopRequested) showToast(`Stopped after ${made} palette${made === 1 ? "" : "s"}.`);
      else if (made < target) showToast(`Created ${made} varied palettes before the quality/API search limit was reached.`);
      else showToast(`Created ${made} varied photo palettes.`);
    } finally {
      const made = state.palettes.length - startingCount;
      els.progressBar.style.width = `${clamp(made / Math.max(1, target) * 100, 0, 100)}%`;
      els.progressLabel.textContent = "Complete";
      els.progressMeta.textContent = `${made}/${target} kept · ${state.rejected} rejected`;
      setBusy(false, "Ready");
      setTimeout(() => { els.progressWrap.hidden = true; }, 1100);
      updateCategorySummary();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    injectCategoryStyles();
    setTimeout(updateCategorySummary, 0);
  });
})();