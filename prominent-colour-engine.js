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

  function clusterSamples(samples, k = 18, iterations = 9) {
    if (samples.length < k) return [];

    // Farthest-point seeding in OKLab captures small but visually distinct accents
    // much better than seeding only by lightness.
    const sorted = [...samples].sort((a, b) => a.L - b.L);
    const centers = [{ ...sorted[Math.floor(sorted.length / 2)] }];
    while (centers.length < k) {
      let bestSample = null;
      let bestDistance = -1;
      for (let i = 0; i < samples.length; i += 3) {
        const sample = samples[i];
        const nearest = Math.min(...centers.map(center => oklabDistance(sample, center)));
        if (nearest > bestDistance) {
          bestDistance = nearest;
          bestSample = sample;
        }
      }
      if (!bestSample) break;
      centers.push({ ...bestSample });
    }
    if (centers.length < k) return [];

    let assignments = new Array(samples.length).fill(0);
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const sums = Array.from({ length: k }, () => ({ L: 0, a: 0, b: 0, count: 0 }));
      samples.forEach((sample, index) => {
        let best = 0;
        let bestDistance = Infinity;
        centers.forEach((center, c) => {
          const distance = oklabDistance(sample, center);
          if (distance < bestDistance) { bestDistance = distance; best = c; }
        });
        assignments[index] = best;
        sums[best].L += sample.L;
        sums[best].a += sample.a;
        sums[best].b += sample.b;
        sums[best].count += 1;
      });
      sums.forEach((sum, i) => {
        if (sum.count) centers[i] = { L: sum.L / sum.count, a: sum.a / sum.count, b: sum.b / sum.count };
      });
    }

    const counts = new Array(k).fill(0);
    assignments.forEach(index => counts[index] += 1);
    return centers
      .map((lab, i) => ({ lab, weight: counts[i] / assignments.length }))
      .filter(cluster => cluster.weight >= .004)
      .sort((a, b) => b.weight - a.weight);
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

  function prominence(cluster, clusters) {
    const clusterChroma = chroma(cluster.lab);
    const highestWeight = clusters[0]?.weight || cluster.weight || 1;
    const maxChroma = Math.max(.001, ...clusters.map(item => chroma(item.lab)));
    const coverage = Math.min(cluster.weight / highestWeight, 1);
    const saturation = Math.min(clusterChroma / maxChroma, 1);
    const contrast = Math.min(Math.max(...clusters.map(item => oklabDistance(item.lab, cluster.lab))), .28) / .28;
    const accentBoost = cluster.weight >= .004 && clusterChroma >= .048 ? .18 : 0;
    return coverage * .56 + saturation * .22 + contrast * .22 + accentBoost;
  }

  function sortByProminence(clusters) {
    return clusters
      .filter(cluster => cluster.weight >= .004)
      .map(cluster => ({ ...cluster, prominence: prominence(cluster, clusters) }))
      .sort((a, b) => b.prominence - a.prominence || b.weight - a.weight);
  }

  function chooseSixSourceColours(clusters) {
    const pool = sortByProminence(clusters).slice(0, 18);
    if (pool.length < 6) return [];

    const selected = [];
    const usedAccentSlots = { count: 0 };

    while (selected.length < 6 && pool.length) {
      let bestIndex = -1;
      let bestScore = -Infinity;

      pool.forEach((cluster, index) => {
        const clusterChroma = chroma(cluster.lab);
        const separation = selected.length
          ? Math.min(...selected.map(chosen => oklabDistance(chosen.lab, cluster.lab)))
          : .22;
        const tonal = selected.length
          ? Math.min(...selected.map(chosen => Math.abs(chosen.lab.L - cluster.lab.L)))
          : .18;
        const nearDuplicate = separation < .040;
        const verySimilarFamily = separation < .060;
        const alreadyHaveStrongAccent = usedAccentSlots.count >= 2 && clusterChroma >= .070 && cluster.weight < .03;
        if (nearDuplicate || alreadyHaveStrongAccent) return;

        const distinctness = Math.min(separation, .24) * 1.65;
        const tonalBonus = Math.min(tonal, .18) * .35;
        const accentBonus = clusterChroma >= .055 && cluster.weight >= .004
          ? Math.min(clusterChroma, .18) * (cluster.weight < .022 ? 2.35 : 1.05)
          : 0;
        const duplicatePenalty = verySimilarFamily ? .30 : 0;
        const score = cluster.prominence * 3.1 + distinctness + tonalBonus + accentBonus - duplicatePenalty;

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      if (bestIndex < 0) break;
      const chosen = pool.splice(bestIndex, 1)[0];
      if (chroma(chosen.lab) >= .07 && chosen.weight < .03) usedAccentSlots.count += 1;
      selected.push(chosen);
    }

    for (const cluster of pool) {
      if (selected.length >= 6) break;
      const separation = Math.min(...selected.map(chosen => oklabDistance(chosen.lab, cluster.lab)));
      if (separation >= .055) selected.push(cluster);
    }

    if (selected.length !== 6) return [];

    const tooSimilarPairs = [];
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const distance = oklabDistance(selected[i].lab, selected[j].lab);
        if (distance < .045) tooSimilarPairs.push(distance);
      }
    }
    if (tooSimilarPairs.length > 1) return [];

    return selected.slice(0, 6);
  }

  function imageFitsSixColours(clusters, selected) {
    if (selected.length !== 6) return false;

    const selectedCoverage = selected.reduce((sum, cluster) => sum + cluster.weight, 0);
    const vividAccentCount = selected.filter(cluster => chroma(cluster.lab) >= .055).length;
    let farMass = 0;
    let compressionError = 0;

    clusters.forEach(cluster => {
      const nearest = Math.min(...selected.map(chosen => oklabDistance(cluster.lab, chosen.lab)));
      compressionError += nearest * cluster.weight;
      if (nearest > .12) farMass += cluster.weight;
    });

    if (selectedCoverage < .33 && farMass > .46) return false;
    if (farMass > .54) return false;
    if (compressionError > .142) return false;

    const imageHasAccent = clusters.some(cluster => chroma(cluster.lab) >= .065 && cluster.weight >= .006);
    if (imageHasAccent && vividAccentCount === 0) return false;

    return true;
  }

  function pairGuard(sourceLab, markerLab) {
    const sourceChroma = chroma(sourceLab);
    const markerChroma = chroma(markerLab);
    const chromaGap = Math.abs(sourceChroma - markerChroma);

    if (sourceChroma <= .03) {
      const allowedMarkerChroma = sourceLab.L >= .74
        ? Math.max(.033, sourceChroma + .020)
        : Math.max(.040, sourceChroma + .026);
      if (markerChroma > allowedMarkerChroma) return false;
      if (chromaGap > .035) return false;
      return true;
    }

    if (sourceChroma <= .055) {
      if (markerChroma > .080) return false;
      if (markerChroma > .032 && hueDiff(sourceLab, markerLab) > 1.00) return false;
      if (chromaGap > .060) return false;
      return true;
    }

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

  analysePhoto = async function analysePhotoProminentColours(photo) {
    if (state.markers.length !== 100) return null;

    const image = await loadCorsImage(photo.analysisImage || photo.image);
    const samples = sampleImage(image, 96);
    if (samples.length < 250) return null;

    const clusters = clusterSamples(samples, 18, 9);
    if (clusters.length < 6) return null;

    const sourceColours = chooseSixSourceColours(clusters);
    if (sourceColours.length !== 6 || !imageFitsSixColours(clusters, sourceColours)) return null;

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