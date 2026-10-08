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
        const colourfulAccent = Math.min(chroma(cluster.lab), .18) * (cluster.weight >= .012 ? .55 : .15);
        const score = cluster.weight * 4.3
          + Math.min(separation, .20) * 1.25
          + Math.min(tonal, .20) * .18
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

    // Only reject genuinely chaotic images. The six swatches do not need to
    // literally account for every pixel, just the visual colour story.
    if (selectedCoverage < .34 && farMass > .48) return false;
    if (farMass > .56) return false;
    if (compressionError > .145) return false;
    return true;
  }

  function markerCost(sourceLab, markerLab) {
    const distance = oklabDistance(sourceLab, markerLab);
    const sourceChroma = chroma(sourceLab);
    const markerChroma = chroma(markerLab);
    let penalty = 0;

    // Strongly discourage hue-family jumps such as green source -> brown marker.
    if (sourceChroma >= .045 && markerChroma >= .03) {
      const hd = hueDiff(sourceLab, markerLab);
      if (hd > 1.55) penalty += .16;
      else if (hd > 1.10) penalty += .075;
      else if (hd > .82) penalty += .025;
    }

    // Keep neutrals neutral and colourful colours reasonably colourful.
    if (sourceChroma < .03 && markerChroma > .085) penalty += .08;
    if (sourceChroma > .075 && markerChroma < .02) penalty += .07;

    return { distance, cost: distance + penalty };
  }

  function assignUniqueMarkers(sourceColours) {
    const candidates = sourceColours.map(source => state.markers
      .map(marker => {
        const result = markerCost(source.lab, marker.oklab);
        return { marker, distance: result.distance, cost: result.cost };
      })
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 18));

    const order = candidates
      .map((list, index) => ({ index, spread: list[5]?.cost - list[0]?.cost || 0 }))
      .sort((a, b) => a.spread - b.spread)
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

  function similarityFromDistance(distance) {
    // This is intentionally a practical confidence score rather than a raw
    // Delta-E percentage. 0.10 OKLab distance still reads as a strong match.
    return clamp(100 - distance * 100, 0, 100);
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

    const assignment = assignUniqueMarkers(sourceColours);
    if (!assignment) return null;

    const pairs = sourceColours.map((source, index) => ({
      source,
      marker: assignment[index].marker,
      distance: assignment[index].distance,
      cost: assignment[index].cost
    })).sort((a, b) => a.source.lab.L - b.source.lab.L);

    // A single terrible pairing is still not acceptable, even if the average is good.
    if (pairs.some(pair => pair.distance > .19 || pair.cost > .24)) return null;

    const similarities = pairs.map(pair => similarityFromDistance(pair.distance));
    const score = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
    if (score < threshold()) return null;

    return {
      score,
      markers: pairs.map(pair => pair.marker),
      originals: pairs.map(pair => ({ hex: labToHex(pair.source.lab) })),
      complexity: {
        selectedCoverage: pairs.reduce((sum, pair) => sum + pair.source.weight, 0)
      }
    };
  };
})();
