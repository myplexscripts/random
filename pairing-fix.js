(() => {
  const KEY_STORAGE = "oahu-unsplash-access-key";
  const THRESHOLD_STORAGE = "oahu-match-threshold";
  const MIGRATION_STORAGE = "oahu-source-first-pairing-v2";
  const MIN_MATCH = 85;
  const MAX_PAIR_DISTANCE = 0.11;
  const MIN_PAIR_SIMILARITY = 74;

  const EFFICIENT_SEARCHES = [
    "muted still life", "pastel still life", "earth tone still life", "minimalist still life",
    "modern neutral kitchen", "warm kitchen interior", "linen bedroom", "spa interior", "coffee still life",
    "bakery interior", "pastry still life", "fruit still life", "vegetable market", "flower bouquet",
    "botanical still life", "greenhouse plants", "ceramic still life", "pottery studio", "art studio",
    "sewing room", "bookstore interior", "cafe interior", "tea still life", "ice cream shop",
    "coastal landscape", "seaside village", "beach umbrellas", "ocean sunset", "mountain lake",
    "misty forest", "autumn leaves", "wildflower meadow", "country garden", "apple orchard",
    "farmhouse kitchen", "farmers market", "Mediterranean food", "sushi plate", "ramen bowl",
    "pizza restaurant", "pastel architecture", "pastel houses", "vintage interior", "antique shop",
    "record store", "plant shop", "clothing boutique", "market stall", "sunlit room",
    "bathroom interior", "home office", "wood workshop", "Christmas interior", "pumpkin still life",
    "berry dessert", "macarons", "cocktail still life", "books and coffee", "painted pottery",
    "desert landscape", "snowy cabin", "spring flowers", "tropical beach", "sage green interior",
    "terracotta interior", "blue coastal interior", "pink flowers", "green botanical interior"
  ];

  if (Array.isArray(PHOTO_SUBJECTS)) {
    PHOTO_SUBJECTS.splice(0, PHOTO_SUBJECTS.length, ...EFFICIENT_SEARCHES);
  }

  function getThreshold() {
    const slider = document.getElementById("matchThreshold");
    const stored = Number(localStorage.getItem(THRESHOLD_STORAGE));
    const raw = slider ? Number(slider.value) : stored;
    const value = Number.isFinite(raw) ? raw : MIN_MATCH;
    return Math.max(MIN_MATCH, Math.min(100, Math.round(value)));
  }

  function labToHex(lab) {
    const l_ = lab.L + .3963377774 * lab.a + .2158037573 * lab.b;
    const m_ = lab.L - .1055613458 * lab.a - .0638541728 * lab.b;
    const s_ = lab.L - .0894841775 * lab.a - 1.291485548 * lab.b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    const linear = [
      4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
      -.0041960863 * l - .7034186147 * m + 1.707614701 * s
    ];
    const values = linear.map(value => {
      const clamped = Math.max(0, Math.min(1, value));
      const encoded = clamped <= .0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - .055;
      return Math.max(0, Math.min(255, Math.round(encoded * 255)));
    });
    return `#${values.map(value => value.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
  }

  function chroma(lab) {
    return Math.hypot(lab.a, lab.b);
  }

  function hueRadians(lab) {
    return Math.atan2(lab.b, lab.a);
  }

  function hueDifference(a, b) {
    let diff = Math.abs(hueRadians(a) - hueRadians(b));
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
  }

  function meaningfulColourCount(clusters) {
    const reps = [];
    clusters.filter(cluster => cluster.weight >= .018).forEach(cluster => {
      if (reps.every(existing => oklabDistance(existing.lab, cluster.lab) > .052)) reps.push(cluster);
    });
    return reps.length;
  }

  function sixColourComplexity(clusters) {
    const anchors = clusters.slice(0, 6);
    if (anchors.length < 6) {
      return { reject: true, dominantCoverage: 0, outlierMass: 1, compressionError: 1, distinctCount: 0 };
    }

    const dominantCoverage = anchors.reduce((sum, cluster) => sum + cluster.weight, 0);
    let outlierMass = 0;
    let compressionError = 0;

    clusters.forEach(cluster => {
      const nearest = Math.min(...anchors.map(anchor => oklabDistance(cluster.lab, anchor.lab)));
      compressionError += nearest * cluster.weight;
      if (nearest > .078) outlierMass += cluster.weight;
    });

    const distinctCount = meaningfulColourCount(clusters);
    const reject = dominantCoverage < .50
      || outlierMass > .36
      || compressionError > .105
      || (distinctCount > 12 && outlierMass > .22);

    return { reject, dominantCoverage, outlierMass, compressionError, distinctCount };
  }

  function selectSourceColours(clusters, count) {
    const pool = clusters.filter(cluster => cluster.weight >= .006).slice(0, 18);
    const selected = [];

    while (selected.length < count && pool.length) {
      let bestIndex = -1;
      let bestScore = -Infinity;

      pool.forEach((cluster, index) => {
        const clusterChroma = chroma(cluster.lab);
        const separation = selected.length
          ? Math.min(...selected.map(chosen => oklabDistance(chosen.lab, cluster.lab)))
          : .13;
        const tonalSeparation = selected.length
          ? Math.min(...selected.map(chosen => Math.abs(chosen.lab.L - cluster.lab.L)))
          : .13;
        const accentBoost = cluster.weight >= .012 ? Math.min(clusterChroma, .19) * 1.15 : 0;
        const score = cluster.weight * 3.0
          + Math.min(separation, .22) * 1.7
          + Math.min(tonalSeparation, .22) * .25
          + accentBoost;

        if (selected.length && separation < .025) return;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      if (bestIndex < 0) break;
      selected.push(pool.splice(bestIndex, 1)[0]);
    }

    if (selected.length < count) {
      for (const cluster of pool) {
        if (selected.length >= count) break;
        if (selected.every(chosen => oklabDistance(chosen.lab, cluster.lab) >= .021)) selected.push(cluster);
      }
    }

    return selected.slice(0, count);
  }

  function markerLooksPlausible(sourceLab, markerLab, distance) {
    if (distance > MAX_PAIR_DISTANCE) return false;

    const sourceChroma = chroma(sourceLab);
    const markerChroma = chroma(markerLab);

    if (sourceChroma < .035 && markerChroma > .07 && distance > .035) return false;
    if (sourceChroma > .08 && markerChroma < .025 && distance > .045) return false;

    if (sourceChroma >= .04 && markerChroma >= .025) {
      const hueDiff = hueDifference(sourceLab, markerLab);
      if (hueDiff > .95 && distance > .05) return false;
    }

    return true;
  }

  function assignUniqueMarkers(sourceColours) {
    const options = sourceColours.map(source => state.markers
      .map(marker => ({ marker, distance: oklabDistance(source.lab, marker.oklab) }))
      .filter(option => markerLooksPlausible(source.lab, option.marker.oklab, option.distance))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12));

    if (options.some(list => !list.length)) return null;

    const order = options.map((list, index) => ({ index, count: list.length }))
      .sort((a, b) => a.count - b.count)
      .map(item => item.index);

    let best = null;
    let bestCost = Infinity;
    const used = new Set();
    const assignment = new Array(sourceColours.length);

    function visit(depth, cost) {
      if (cost >= bestCost) return;
      if (depth === order.length) {
        bestCost = cost;
        best = assignment.slice();
        return;
      }

      const sourceIndex = order[depth];
      const source = sourceColours[sourceIndex];
      for (const option of options[sourceIndex]) {
        if (used.has(option.marker.code)) continue;
        used.add(option.marker.code);
        assignment[sourceIndex] = option;
        visit(depth + 1, cost + option.distance * Math.max(source.weight, .015));
        used.delete(option.marker.code);
      }
    }

    visit(0, 0);
    return best;
  }

  function pairSimilarity(distance) {
    return clamp(100 * (1 - distance / .40), 0, 100);
  }

  sourcePhotos = async function sourcePhotosEfficiently(subject) {
    const accessKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    if (!accessKey) return [];

    const page = 1 + Math.floor(Math.random() * 2);
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
        sourceUrl: photo.links?.html
          ? `${photo.links.html}${photo.links.html.includes("?") ? "&" : "?"}utm_source=myplexscripts_photo_palette_maker&utm_medium=referral`
          : "https://unsplash.com/",
        source: "Unsplash",
        creator: photo.user?.name || photo.user?.username || "Unsplash photographer",
        licence: "Unsplash license"
      }));
  };

  analysePhoto = async function analysePhotoSourceFirst(photo) {
    if (state.markers.length !== 100) return null;

    const image = await loadCorsImage(photo.analysisImage || photo.image);
    const samples = sampleImage(image, 96);
    if (samples.length < 300) return null;

    const clusters = kMeans(samples, 14, 10);
    if (clusters.length < 6) return null;

    const complexity = sixColourComplexity(clusters);
    if (complexity.reject) return null;

    const sourceColours = selectSourceColours(clusters, 6);
    if (sourceColours.length !== 6) return null;

    const assignments = assignUniqueMarkers(sourceColours);
    if (!assignments) return null;

    const pairs = sourceColours.map((source, index) => ({
      source,
      marker: assignments[index].marker,
      distance: assignments[index].distance,
      similarity: pairSimilarity(assignments[index].distance)
    })).sort((a, b) => a.source.lab.L - b.source.lab.L);

    if (pairs.some(pair => pair.similarity < MIN_PAIR_SIMILARITY)) return null;

    const weightTotal = pairs.reduce((sum, pair) => sum + Math.max(pair.source.weight, .015), 0) || 1;
    const score = pairs.reduce(
      (sum, pair) => sum + pair.similarity * Math.max(pair.source.weight, .015),
      0
    ) / weightTotal;

    if (score < getThreshold()) return null;

    return {
      score,
      markers: pairs.map(pair => pair.marker),
      originals: pairs.map(pair => ({ hex: labToHex(pair.source.lab) })),
      complexity
    };
  };

  generateBatch = async function generateBatchSourceFirst() {
    if (state.running || state.markers.length !== 100) return;
    const accessKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    if (!accessKey) {
      showToast("Add your Unsplash access key first.");
      return;
    }

    const target = Number(els.targetCount.value || 24);
    const startingCount = state.palettes.length;
    const goalCount = startingCount + target;
    const maxAttempts = Math.max(target * 24, 160);
    state.stopRequested = false;
    state.attempts = 0;
    state.rejected = 0;
    els.progressWrap.hidden = false;
    setBusy(true, "Generating");

    try {
      while (!state.stopRequested && state.palettes.length < goalCount && state.attempts < maxAttempts) {
        const subject = nextSubject();
        updateProgress(startingCount, goalCount, subject);
        const photos = await sourcePhotos(subject).catch(error => {
          console.warn("Unsplash sourcing failed", error);
          return [];
        });

        if (!photos.length) {
          state.attempts += 1;
          state.rejected += 1;
          continue;
        }

        shuffle(photos);
        for (const photo of photos.slice(0, 18)) {
          if (state.stopRequested || state.palettes.length >= goalCount || state.attempts >= maxAttempts) break;
          if (state.usedPhotoIds.has(String(photo.id))) continue;
          state.attempts += 1;
          updateProgress(startingCount, goalCount, subject);

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
              originals: analysis.originals,
              complexity: analysis.complexity,
              createdAt: Date.now()
            };

            if (isDuplicatePalette(candidate)) {
              state.rejected += 1;
              continue;
            }

            state.palettes.unshift(candidate);
            state.usedPhotoIds.add(String(photo.id));
            persistPalettes();
            renderPalettes();
          } catch (error) {
            console.warn("Photo analysis failed", error);
            state.rejected += 1;
          }
        }
      }

      const made = state.palettes.length - startingCount;
      if (state.stopRequested) showToast(`Stopped after ${made} palette${made === 1 ? "" : "s"}.`);
      else if (made < target) showToast(`Created ${made} palettes before the search limit was reached.`);
      else showToast(`Created ${made} photo palettes.`);
    } finally {
      updateProgress(startingCount, goalCount, "Complete");
      setBusy(false, "Ready");
      setTimeout(() => { els.progressWrap.hidden = true; }, 900);
    }
  };

  async function resetOldPairingsOnce() {
    if (localStorage.getItem(MIGRATION_STORAGE) === "1") return;
    localStorage.setItem(MIGRATION_STORAGE, "1");
    if (!Array.isArray(state.palettes) || !state.palettes.length) return;

    state.palettes = [];
    state.usedPhotoIds.clear();
    persistPalettes();
    renderPalettes();
    showToast("Old cards cleared so the corrected matching can be regenerated.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (state.markers.length === 100) {
        clearInterval(timer);
        resetOldPairingsOnce();
      } else if (attempts > 80) {
        clearInterval(timer);
      }
    }, 100);
  });
})();
