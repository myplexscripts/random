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

  function prominence(cluster, clusters) {
    const clusterChroma = chroma(cluster.lab);
    const highestWeight = Math.max(...clusters.map(item => item.weight), cluster.weight, .001);
    const maxChroma = Math.max(.001, ...clusters.map(item => chroma(item.lab)));
    const coverage = Math.min(cluster.weight / highestWeight, 1);
    const saturation = Math.min(clusterChroma / maxChroma, 1);
    const contrast = Math.min(Math.max(...clusters.map(item => oklabDistance(item.lab, cluster.lab))), .28) / .28;
    const accentBoost = cluster.weight >= .004 && clusterChroma >= .048 ? .18 : 0;
    return coverage * .56 + saturation * .22 + contrast * .22 + accentBoost;
  }

  function sortByProminence(clusters) {
    return clusters
      .filter(cluster => cluster.weight >= .003)
      .map(cluster => ({ ...cluster, prominence: prominence(cluster, clusters) }))
      .sort((a, b) => b.prominence - a.prominence || b.weight - a.weight);
  }

  function chooseSixSourceColours(clusters) {
    const pool = sortByProminence(clusters).slice(0, 20);
    if (pool.length < 6) return [];

    const selected = [];
    const remaining = [...pool];

    function separationFromSelected(cluster) {
      return selected.length
        ? Math.min(...selected.map(chosen => oklabDistance(chosen.lab, cluster.lab)))
        : .24;
    }

    function takeBest(scoreFor, minimumSeparation, limit) {
      let taken = 0;
      while (taken < limit && selected.length < 6) {
        let bestIndex = -1;
        let bestScore = -Infinity;

        remaining.forEach((cluster, index) => {
          const separation = separationFromSelected(cluster);
          if (separation < minimumSeparation) return;
          const score = scoreFor(cluster, separation);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });

        if (bestIndex < 0) break;
        selected.push(remaining.splice(bestIndex, 1)[0]);
        taken += 1;
      }
    }

    // Build the backbone from colours that carry a meaningful share of the image.
    takeBest((cluster, separation) => {
      const tonal = selected.length
        ? Math.min(...selected.map(chosen => Math.abs(chosen.lab.L - cluster.lab.L)))
        : .18;
      return cluster.prominence * 3.0
        + Math.min(separation, .24) * 1.3
        + Math.min(tonal, .18) * .25;
    }, .043, 4);

    // Reserve up to two slots for small, conspicuous accents. This is what lets a
    // small red tag, blue label, flower, etc. survive against a large neutral field.
    const accents = remaining
      .filter(cluster => cluster.weight >= .003 && chroma(cluster.lab) >= .052)
      .map(cluster => {
        const separation = separationFromSelected(cluster);
        const localContrast = Math.min(
          Math.max(...clusters.map(other => oklabDistance(cluster.lab, other.lab))),
          .28
        ) / .28;
        const accentScore = Math.min(chroma(cluster.lab) / .18, 1) * .46
          + localContrast * .34
          + Math.min(cluster.weight / .03, 1) * .20
          + Math.min(separation, .22) * .65;
        return { cluster, separation, accentScore };
      })
      .filter(item => item.separation >= .052)
      .sort((a, b) => b.accentScore - a.accentScore);

    for (const item of accents) {
      if (selected.length >= 6) break;
      const index = remaining.indexOf(item.cluster);
      if (index < 0) continue;
      if (separationFromSelected(item.cluster) < .052) continue;
      selected.push(item.cluster);
      remaining.splice(index, 1);
    }

    // Fill any unclaimed slots with the strongest distinct colours left.
    takeBest((cluster, separation) =>
      cluster.prominence * 2.8 + Math.min(separation, .24) * 1.6,
    .048, 6);

    if (selected.length !== 6) return [];

    // If we ended up with too many near-duplicates, fail and let the photo be skipped.
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

    // Prevent six nearly identical neutrals from passing when a more colourful
    // image clearly contains meaningful accent colours.
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

  analysePhoto = async function analysePhotoReliable(photo) {
    if (state.markers.length !== 100) return null;

    const image = await loadCorsImage(photo.analysisImage || photo.image);
    const samples = sampleImage(image, 92);
    if (samples.length < 250) return null;

    const clusters = kMeans(samples, 18, 10);
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

    // Six unique codes are not enough if two marker swatches still look effectively
    // identical. Reject collapsed palettes so every slot carries useful information.
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const markerDistance = oklabDistance(pairs[i].marker.oklab, pairs[j].marker.oklab);
        const sourceDistance = oklabDistance(pairs[i].source.lab, pairs[j].source.lab);
        if (markerDistance < .032 && sourceDistance >= .052) return null;
      }
    }

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
