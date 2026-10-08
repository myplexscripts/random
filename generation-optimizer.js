(() => {
  const CATEGORIES = ["pastel", "vivid", "moody", "earthy", "warm", "cool", "neutral", "jewel", "muted", "monochrome", "balanced"];
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
  const RECOVERY_SEARCHES = [
    "colourful still life", "interior colour palette", "coastal landscape", "flower market", "farmers market",
    "ceramic still life", "botanical garden", "art studio", "food still life", "vintage interior", "travel photography colour"
  ];
  const KEY_STORAGE = "oahu-unsplash-access-key";

  const sourceHex = original => {
    if (typeof original === "string") return original;
    if (typeof original?.hex === "string") return original.hex;
    return original?.hex?.hex || "#FFFFFF";
  };

  function categoryFor(palette) {
    return typeof window.classifyPalette === "function"
      ? window.classifyPalette(palette)
      : (palette?.category || "balanced");
  }

  function labelsFor(category) {
    return window.PALETTE_CATEGORY_LABELS?.[category] || category.replace(/^./, char => char.toUpperCase());
  }

  function blankCounts() {
    return Object.fromEntries(CATEGORIES.map(category => [category, 0]));
  }

  function countsFor(palettes = state.palettes) {
    const counts = blankCounts();
    palettes.forEach(palette => {
      const category = categoryFor(palette);
      if (category in counts) counts[category] += 1;
    });
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

    fractions.sort((a, b) =>
      b.fraction - a.fraction
      || a.current - b.current
      || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)
    );

    for (let index = 0; assigned < total; index += 1, assigned += 1) {
      targets[fractions[index % fractions.length].category] += 1;
    }
    return targets;
  }

  function weightedNeededCategory(counts, targets, recovery) {
    const weighted = CATEGORIES.map(category => {
      const deficit = Math.max(0, (targets[category] || 0) - (counts[category] || 0));
      const underShare = 1 / (1 + (counts[category] || 0));
      const weight = recovery
        ? .7 + deficit * 1.4 + underShare
        : .25 + deficit * 3.2 + underShare * 1.5;
      return { category, weight };
    });

    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * total;
    for (const item of weighted) {
      cursor -= item.weight;
      if (cursor <= 0) return item.category;
    }
    return weighted[0].category;
  }

  function chooseSubject(counts, targets, recovery) {
    if (recovery && Math.random() < .45) {
      return RECOVERY_SEARCHES[Math.floor(Math.random() * RECOVERY_SEARCHES.length)];
    }
    const category = weightedNeededCategory(counts, targets, recovery);
    const pool = SEARCHES[category] || RECOVERY_SEARCHES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function markerOverlap(a, b) {
    const existingCodes = new Set((b?.markers || []).map(marker => marker.code));
    return (a?.markers || []).reduce((count, marker) => count + (existingCodes.has(marker.code) ? 1 : 0), 0);
  }

  function paletteDistance(a, b) {
    if (typeof window.paletteSimilarityDistance === "function") {
      return window.paletteSimilarityDistance(a, b);
    }
    return Infinity;
  }

  // Duplicate blocking is deliberately narrow. Similar mood is not enough to reject a card;
  // the actual six-colour set also has to be very close.
  isDuplicatePalette = candidate => state.palettes.some(existing => {
    const overlap = markerOverlap(candidate, existing);
    const distance = paletteDistance(candidate, existing);
    const sameCategory = categoryFor(candidate) === categoryFor(existing);

    if (overlap === 6) return true;
    if (distance < .043) return true;
    if (overlap >= 5 && distance < .074) return true;
    if (sameCategory && overlap >= 4 && distance < .060) return true;
    return sameCategory && distance < .050;
  });

  function nearestCollectionDistance(candidate) {
    if (!state.palettes.length) return .16;
    let nearest = Infinity;
    state.palettes.forEach(existing => {
      nearest = Math.min(nearest, paletteDistance(candidate, existing));
    });
    return Number.isFinite(nearest) ? nearest : .16;
  }

  function candidatePriority(candidate, counts, targets, recovery) {
    const category = candidate.category;
    const deficit = (targets[category] || 0) - (counts[category] || 0);
    const diversity = Math.max(0, Math.min(.16, nearestCollectionDistance(candidate)));
    const quality = Number(candidate.score || 0);
    const needBonus = recovery ? Math.max(-1, deficit) * 1.4 : Math.max(-2, deficit) * 3.5;
    const oversupplyPenalty = Math.max(0, -deficit - 1) * (recovery ? 1.2 : 4.0);
    return quality + diversity * 105 + needBonus - oversupplyPenalty;
  }

  function isRecoveryMode(made, target, attempts, searches, maxSearches) {
    if (attempts < 120) return false;
    const keepRate = made / Math.max(1, attempts);
    const completion = made / Math.max(1, target);
    const searchBudget = searches / Math.max(1, maxSearches);

    return keepRate < .05
      || (searchBudget >= .45 && completion < .35)
      || (searchBudget >= .70 && completion < .70);
  }

  function currentThreshold() {
    return Math.max(85, Math.min(100, Number(document.getElementById("matchThreshold")?.value || 85)));
  }

  function makeCandidate(photo, subject, analysis) {
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
    candidate.category = categoryFor(candidate);
    return candidate;
  }

  function updateAdaptiveProgress(made, target, searches, maxSearches, recovery) {
    els.progressBar.style.width = `${clamp(made / Math.max(1, target) * 100, 0, 100)}%`;
    els.progressLabel.textContent = recovery ? "Finding the strongest remaining palettes" : "Building a balanced collection";
    els.progressMeta.textContent = `${made}/${target} kept · ${state.rejected} rejected · ${searches}/${maxSearches} searches`;
  }

  generateBatch = async function generateAdaptivePaletteBatch() {
    if (state.running || state.markers.length !== 100) return;
    if (!(localStorage.getItem(KEY_STORAGE) || "").trim()) {
      showToast("Add your Unsplash access key first.");
      return;
    }

    const target = Number(els.targetCount.value || 24);
    const starting = state.palettes.length;
    const counts = countsFor();
    const targets = profileTargets(starting + target, counts);
    const maxSearches = Math.min(42, Math.max(18, Math.ceil(target * .44)));
    const maxAttempts = maxSearches * 30;
    const minimumMatch = currentThreshold();
    let searches = 0;

    state.stopRequested = false;
    state.attempts = 0;
    state.rejected = 0;
    els.progressWrap.hidden = false;
    setBusy(true, "Building a balanced collection");

    try {
      while (
        !state.stopRequested
        && state.palettes.length - starting < target
        && state.attempts < maxAttempts
        && searches < maxSearches
      ) {
        const made = state.palettes.length - starting;
        const recovery = isRecoveryMode(made, target, state.attempts, searches, maxSearches);
        const subject = chooseSubject(counts, targets, recovery);
        searches += 1;
        updateAdaptiveProgress(made, target, searches, maxSearches, recovery);

        const photos = await sourcePhotos(subject).catch(error => {
          console.warn("Unsplash sourcing failed", error);
          return [];
        });
        if (!photos.length) continue;

        shuffle(photos);
        const candidates = [];

        for (const photo of photos) {
          const currentMade = state.palettes.length - starting;
          if (state.stopRequested || currentMade >= target || state.attempts >= maxAttempts) break;
          if (state.usedPhotoIds.has(String(photo.id))) continue;

          state.attempts += 1;
          updateAdaptiveProgress(currentMade, target, searches, maxSearches, recovery);

          try {
            const analysis = await analysePhoto(photo);

            // Hard reject 1: the image cannot produce an honest six-colour palette.
            // Hard reject 2: its marker match does not meet the user's slider.
            if (
              !analysis
              || !Array.isArray(analysis.markers)
              || analysis.markers.length !== 6
              || !Array.isArray(analysis.originals)
              || analysis.originals.length !== 6
              || Number(analysis.score) < minimumMatch
            ) {
              state.rejected += 1;
              continue;
            }

            const candidate = makeCandidate(photo, subject, analysis);
            if (isDuplicatePalette(candidate)) {
              state.rejected += 1;
              continue;
            }

            candidates.push(candidate);
          } catch (error) {
            console.warn("Photo analysis failed", error);
            state.rejected += 1;
          }
        }

        candidates.sort((a, b) =>
          candidatePriority(b, counts, targets, recovery)
          - candidatePriority(a, counts, targets, recovery)
        );

        for (const candidate of candidates) {
          const currentMade = state.palettes.length - starting;
          if (state.stopRequested || currentMade >= target) break;

          // Recheck after earlier candidates from this same search have been accepted.
          if (isDuplicatePalette(candidate)) {
            state.rejected += 1;
            continue;
          }

          state.palettes.unshift(candidate);
          state.usedPhotoIds.add(String(candidate.photoId));
          counts[candidate.category] = (counts[candidate.category] || 0) + 1;
          persistPalettes();
          renderPalettes();
          if (typeof window.updatePaletteCategorySummary === "function") {
            window.updatePaletteCategorySummary();
          }
        }
      }

      const made = state.palettes.length - starting;
      if (state.stopRequested) {
        showToast(`Stopped after ${made} palette${made === 1 ? "" : "s"}.`);
      } else if (made < target) {
        showToast(`Created ${made} palettes before the quality/API limit was reached.`);
      } else {
        showToast(`Created ${made} balanced photo palettes.`);
      }
    } finally {
      const made = state.palettes.length - starting;
      els.progressBar.style.width = `${clamp(made / Math.max(1, target) * 100, 0, 100)}%`;
      els.progressLabel.textContent = "Complete";
      els.progressMeta.textContent = `${made}/${target} kept · ${state.rejected} rejected`;
      setBusy(false, "Ready");
      setTimeout(() => { els.progressWrap.hidden = true; }, 1100);
      if (typeof window.updatePaletteCategorySummary === "function") {
        window.updatePaletteCategorySummary();
      }
    }
  };
})();
