(() => {
  const MIN_MATCH = 85;
  const THRESHOLD_STORAGE = "oahu-match-threshold";

  function threshold() {
    const slider = document.getElementById("matchThreshold");
    const stored = Number(localStorage.getItem(THRESHOLD_STORAGE));
    const raw = slider ? Number(slider.value) : stored;
    const value = Number.isFinite(raw) ? raw : MIN_MATCH;
    return Math.max(MIN_MATCH, Math.min(100, Math.round(value)));
  }

  function chroma(lab) {
    return Math.hypot(lab.a, lab.b);
  }

  function hue(lab) {
    return Math.atan2(lab.b, lab.a);
  }

  function hueDiff(a, b) {
    let diff = Math.abs(hue(a) - hue(b));
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
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
      const v = Math.max(0, Math.min(1, value));
      const encoded = v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055;
      return Math.max(0, Math.min(255, Math.round(encoded * 255)));
    });
    return `#${values.map(value => value.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
  }

  function chooseSixSourceColours(clusters) {
    const pool = clusters.filter(cluster => cluster.weight >= .006).slice(0, 16);
    const selected = [];

    while (selected.length < 6 && pool.length) {
      let bestIndex = -1;
      let bestScore = -Infinity;

      pool.forEach((cluster, index) => {
        const separation = selected.length
          ? Math.min(...selected.map(chosen => oklabDistance(chosen.lab, cluster.lab)))
          : .14;
        const tonal = selected.length
          ? Math.min(...selected.map(chosen => Math.abs(chosen.lab.L - cluster.lab.L)))
          : .14;
        const sourceChroma = chroma(cluster.lab);
        const colourfulAccent = sourceChroma >= .05 && cluster.weight >= .012
          ? Math.min(sourceChroma, .18) * .48
          : 0;
        const score = cluster.weight * 4.5
          + Math.min(separation, .20) * 1.15
          + Math.min(tonal, .20) * .16
          + colourfulAccent;

        if (selected.length && separation < .022) return;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      if (bestIndex < 0) break;
      selected.push(pool.splice(bestIndex, 1)[0]);
    }

    for (const cluster of pool) {
      if (selected.length >= 6) break;
      if (selected.every(chosen => oklabDistance(chosen.lab, cluster.lab) >= .018)) selected.push(cluster);
    }

    return selected.slice(0, 6);
  }

  function imageFitsSixColours(clusters, selected) {
    if (selected.length !== 6) return false;

    const selectedCoverage = selected.reduce((sum, cluster) => sum + cluster.weight, 0);
    let farMass = 0;
    let compressionError = 0;

    clusters.forEach(cluster => {
      const nearest = Math.min(...selected.map(chosen => oklabDistance(cluster.lab, chosen.lab)));
      compressionError += nearest * cluster.weight;
      if (nearest > .12) farMass += cluster.weight;
    });

    if (selectedCoverage < .34 && farMass > .48) return false;
    if (farMass > .56) return false;
    if (compressionError > .145) return false;
    return true;
  }

  function pairGuard(sourceLab, markerLab) {
    const sourceChroma = chroma(sourceLab);
    const markerChroma = chroma(markerLab);
    const chromaGap = Math.abs(sourceChroma - markerChroma);

    // True neutrals should stay neutral. This prevents white/grey source colours
    // from being filled out with visibly cyan, peach, green, or purple markers.
    if (sourceChroma <= .03) {
      const allowedMarkerChroma = sourceLab.L >= .74
        ? Math.max(.033, sourceChroma + .020)
        : Math.max(.040, sourceChroma + .026);
      if (markerChroma > allowedMarkerChroma) return false;
      if (chromaGap > .035) return false;
      return true;
    }

    // Soft tints may use neutral-adjacent markers, but not a clearly different tint.
    if (sourceChroma <= .055) {
      if (markerChroma > .080) return false;
      if (markerChroma > .032 && hueDiff(sourceLab, markerLab) > 1.00) return false;
      if (chromaGap > .060) return false;
      return true;
    }

    // Once the source colour is visibly chromatic, preserve its hue family first.
    // Stronger colours get a tighter hue window.
    if (markerChroma < .025) return false;
    const maxHueDifference = sourceChroma >= .11 ? .66 : .86;
    if (hueDiff(sourceLab, markerLab) > maxHueDifference) return false;
    if (chromaGap > .115) return false;
    return true;
  }

  function markerCost(sourceLab, markerLab) {
    const distance = oklabDistance(sourceLab, markerLab);
    const sourceChroma = chroma(sourceLab);
    const markerChroma = chroma(markerLab);
    const chromaGap = Math.abs(sourceChroma - markerChroma);
    let penalty = 0;

    if (sourceChroma <= .03) {
      // Within the neutral-safe pool, favour the least tinted marker.
      penalty += Math.max(0, markerChroma - sourceChroma) * .45;
    } else if (sourceChroma <= .055) {
      if (markerChroma > .03) penalty += hueDiff(sourceLab, markerLab) * .025;
      penalty += chromaGap * .18;
    } else {
      const hd = hueDiff(sourceLab, markerLab);
      penalty += Math.max(0, hd - .18) * .055;
      penalty += chromaGap * .16;
    }

    return { distance, cost: distance + penalty };
  }

  function candidateMarkersFor(source) {
    return state.markers
      .filter(marker => pairGuard(source.lab, marker.oklab))
      .map(marker => {
        const result = markerCost(source.lab, marker.oklab);
        return {
          marker,
          distance: result.distance,
          cost: result.cost,
          hueDifference: chroma(source.lab) > .03 && chroma(marker.oklab) > .025
            ? hueDiff(source.lab, marker.oklab)
            : 0,
          chromaDifference: Math.abs(chroma(source.lab) - chroma(marker.oklab))
        };
      })
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 20);
  }

  function assignUniqueMarkers(sourceColours) {
    const candidates = sourceColours.map(candidateMarkersFor);
    if (candidates.some(list => list.length === 0)) return null;

    // Solve the most constrained source colours first. That prevents a flexible
    // neutral from taking the only good marker available to a harder colour.
    const order = candidates
      .map((list, index) => ({
        index,
        count: list.length,
        spread: (list[5]?.cost ?? list[list.length - 1]?.cost ?? 0) - (list[0]?.cost ?? 0)
      }))
      .sort((a, b) => a.count - b.count || a.spread - b.spread)
      .map(item => item.index);

    const used = new Set();
    const current = new Array(sourceColours.length);
    let best = null;
    let bestCost = Infinity;

    function visit(depth, cost) {
      if (cost >= bestCost) return;
      if (depth === order.length) {
        bestCost = cost;
        best = current.slice();
        return;
      }

      const sourceIndex = order[depth];
      for (const candidate of candidates[sourceIndex]) {
        if (used.has(candidate.marker.code)) continue;
        used.add(candidate.marker.code);
        current[sourceIndex] = candidate;
        visit(depth + 1, cost + candidate.cost);
        used.delete(candidate.marker.code);
      }
    }

    visit(0, 0);
    return best;
  }

  function perceptualSimilarity(pair) {
    const sourceChroma = chroma(pair.source.lab);
    const markerChroma = chroma(pair.marker.oklab);
    const chromaGap = Math.abs(sourceChroma - markerChroma);

    let similarity = 100 - pair.distance * 100;

    if (sourceChroma <= .03) {
      // Tint shifts in near-neutrals are visually obvious even when OKLab distance is small.
      similarity -= Math.max(0, markerChroma - sourceChroma - .008) * 160;
    } else if (sourceChroma <= .055) {
      similarity -= chromaGap * 32;
      if (markerChroma > .03) similarity -= Math.max(0, pair.hueDifference - .28) * 5;
    } else {
      similarity -= chromaGap * 24;
      similarity -= Math.max(0, pair.hueDifference - .22) * 7;
    }

    return clamp(similarity, 0, 100);
  }

  analysePhoto = async function analysePhotoReliable(photo) {
    if (state.markers.length !== 100) return null;

    const image = await loadCorsImage(photo.analysisImage || photo.image);
    const samples = sampleImage(image, 92);
    if (samples.length < 250) return null;

    const clusters = kMeans(samples, 12, 8);
    if (clusters.length < 6) return null;

    const sourceColours = chooseSixSourceColours(clusters);
    if (sourceColours.length !== 6 || !imageFitsSixColours(clusters, sourceColours)) return null;

    // If six perceptually plausible unique marker matches do not exist, reject
    // the photo rather than inventing a sixth colour from the wrong family.
    const assignment = assignUniqueMarkers(sourceColours);
    if (!assignment) return null;

    const pairs = sourceColours.map((source, index) => ({
      source,
      marker: assignment[index].marker,
      distance: assignment[index].distance,
      cost: assignment[index].cost,
      hueDifference: assignment[index].hueDifference,
      chromaDifference: assignment[index].chromaDifference
    })).sort((a, b) => a.source.lab.L - b.source.lab.L);

    const similarities = pairs.map(perceptualSimilarity);
    const minimumPairScore = Math.max(78, threshold() - 8);

    // Do not hide one visibly bad pair inside a strong average.
    if (similarities.some(value => value < minimumPairScore)) return null;

    const score = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
    if (score < threshold()) return null;

    return {
      score,
      markers: pairs.map(pair => pair.marker),
      originals: pairs.map(pair => ({ hex: labToHex(pair.source.lab) })),
      complexity: {
        selectedCoverage: pairs.reduce((sum, pair) => sum + pair.source.weight, 0),
        minimumPairScore: Math.min(...similarities)
      }
    };
  };
})();
