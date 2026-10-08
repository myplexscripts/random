(() => {
  const sourceHex = original => {
    if (typeof original === "string") return original;
    if (typeof original?.hex === "string") return original.hex;
    return original?.hex?.hex || "#FFFFFF";
  };

  function labsFor(palette) {
    return (palette?.originals || [])
      .map(sourceHex)
      .filter(hex => /^#[0-9a-f]{6}$/i.test(hex))
      .map(hexToOklab);
  }

  function exactSetDistance(a, b) {
    const A = labsFor(a);
    const B = labsFor(b);
    if (A.length !== 6 || B.length !== 6) return Infinity;

    const costs = A.map(from => B.map(to => oklabDistance(from, to)));
    let best = Infinity;

    function search(row, usedMask, total) {
      if (total >= best) return;
      if (row === 6) {
        best = total;
        return;
      }
      for (let col = 0; col < 6; col += 1) {
        const bit = 1 << col;
        if (usedMask & bit) continue;
        search(row + 1, usedMask | bit, total + costs[row][col]);
      }
    }

    search(0, 0, 0);
    return best / 6;
  }

  function markerOverlap(a, b) {
    const bCodes = new Set((b?.markers || []).map(marker => marker.code));
    return (a?.markers || []).reduce((count, marker) => count + (bCodes.has(marker.code) ? 1 : 0), 0);
  }

  function sameCategory(a, b) {
    if (typeof window.classifyPalette !== "function") return a?.category === b?.category;
    return window.classifyPalette(a) === window.classifyPalette(b);
  }

  window.paletteSimilarityDistance = exactSetDistance;

  isDuplicatePalette = candidate => state.palettes.some(existing => {
    const overlap = markerOverlap(candidate, existing);
    if (overlap >= 5) return true;

    const distance = exactSetDistance(candidate, existing);
    if (distance < .058) return true;
    if (sameCategory(candidate, existing) && distance < .070) return true;
    if (overlap >= 4 && distance < .090) return true;
    return overlap >= 3 && distance < .066;
  });
})();
