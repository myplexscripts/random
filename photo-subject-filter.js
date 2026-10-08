(() => {
  const BLOCKED_PHRASES = [
    "pantone", "color swatch", "colour swatch", "paint swatch", "paint chip", "paint sample",
    "color chart", "colour chart", "color guide", "colour guide", "color palette card",
    "colour palette card", "palette card", "sample card", "sample board", "fan deck",
    "color fan", "colour fan", "fabric swatch", "fabric sample", "material sample",
    "material board", "finish sample", "finish board", "ral chart", "cmyk chart",
    "color system", "colour system"
  ];

  function normalise(value) {
    return String(value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function metadataText(photo) {
    const tags = Array.isArray(photo?.tags)
      ? photo.tags.map(tag => tag?.title || tag?.source?.title || tag?.type || "")
      : [];
    const topics = photo?.topic_submissions && typeof photo.topic_submissions === "object"
      ? Object.keys(photo.topic_submissions)
      : [];
    return normalise([
      photo?.description,
      photo?.alt_description,
      photo?.slug,
      ...tags,
      ...topics
    ].filter(Boolean).join(" "));
  }

  function isBlockedMetadata(photo) {
    const text = metadataText(photo);
    if (!text) return false;
    return BLOCKED_PHRASES.some(phrase => text.includes(phrase));
  }

  // Filter Unsplash search results before the app turns them into its smaller
  // internal photo objects, while description/alt/tag metadata is still available.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function filteredFetch(input, init) {
    const response = await nativeFetch(input, init);
    const url = typeof input === "string" ? input : input?.url || "";
    if (!response.ok || !/api\.unsplash\.com\/search\/photos/i.test(url)) return response;

    try {
      const data = await response.clone().json();
      if (!Array.isArray(data?.results)) return response;
      const kept = data.results.filter(photo => !isBlockedMetadata(photo));
      if (kept.length === data.results.length) return response;
      data.results = kept;
      data.total = Math.max(0, Number(data.total || kept.length) - (data.results.length - kept.length));
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.warn("Photo metadata filter skipped", error);
      return response;
    }
  };

  function rgbDistance(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db) / 441.67;
  }

  function blockStats(data, width, height, x0, y0, x1, y1) {
    let count = 0;
    let r = 0, g = 0, b = 0;
    let rr = 0, gg = 0, bb = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 230) continue;
        const R = data[i], G = data[i + 1], B = data[i + 2];
        count += 1;
        r += R; g += G; b += B;
        rr += R * R; gg += G * G; bb += B * B;
      }
    }
    if (!count) return null;
    r /= count; g /= count; b /= count;
    const variance = Math.max(0,
      (rr / count - r * r) +
      (gg / count - g * g) +
      (bb / count - b * b)
    ) / 3;
    const std = Math.sqrt(variance);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max ? (max - min) / max : 0;
    const luminance = (.2126 * r + .7152 * g + .0722 * b) / 255;
    return { r, g, b, std, saturation, luminance };
  }

  // Conservative visual fallback for images whose metadata is vague. It looks
  // for the combination common to swatch books/charts: lots of very flat,
  // colourful rectangular regions with repeated axis-aligned colour changes.
  async function looksLikeReferenceMaterial(photo) {
    const image = await loadCorsImage(photo.analysisImage || photo.image);
    const canvas = document.createElement("canvas");
    const ratio = image.naturalWidth / image.naturalHeight;
    canvas.width = ratio >= 1 ? 72 : Math.max(48, Math.round(72 * ratio));
    canvas.height = ratio >= 1 ? Math.max(48, Math.round(72 / ratio)) : 72;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const cols = 12;
    const rows = 8;
    const grid = [];
    let flat = 0;
    let colourfulFlat = 0;
    const bins = new Set();

    for (let row = 0; row < rows; row += 1) {
      const line = [];
      for (let col = 0; col < cols; col += 1) {
        const x0 = Math.floor(col * canvas.width / cols);
        const x1 = Math.max(x0 + 1, Math.floor((col + 1) * canvas.width / cols));
        const y0 = Math.floor(row * canvas.height / rows);
        const y1 = Math.max(y0 + 1, Math.floor((row + 1) * canvas.height / rows));
        const stat = blockStats(pixels, canvas.width, canvas.height, x0, y0, x1, y1);
        line.push(stat);
        if (!stat) continue;
        const isFlat = stat.std <= 13;
        if (isFlat) flat += 1;
        if (isFlat && stat.saturation >= .10 && stat.luminance >= .08 && stat.luminance <= .96) {
          colourfulFlat += 1;
          bins.add(`${Math.round(stat.r / 32)}-${Math.round(stat.g / 32)}-${Math.round(stat.b / 32)}`);
        }
      }
      grid.push(line);
    }

    let transitions = 0;
    const verticalSupport = new Array(cols - 1).fill(0);
    const horizontalSupport = new Array(rows - 1).fill(0);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols - 1; col += 1) {
        const a = grid[row][col], b = grid[row][col + 1];
        if (!a || !b || a.std > 13 || b.std > 13) continue;
        if (rgbDistance(a, b) >= .14) {
          transitions += 1;
          verticalSupport[col] += 1;
        }
      }
    }
    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const a = grid[row][col], b = grid[row + 1][col];
        if (!a || !b || a.std > 13 || b.std > 13) continue;
        if (rgbDistance(a, b) >= .14) {
          transitions += 1;
          horizontalSupport[row] += 1;
        }
      }
    }

    const total = rows * cols;
    const flatRatio = flat / total;
    const colourfulFlatRatio = colourfulFlat / total;
    const strongestAlignedEdge = Math.max(0, ...verticalSupport, ...horizontalSupport);

    return flatRatio >= .46
      && colourfulFlatRatio >= .24
      && bins.size >= 7
      && transitions >= 13
      && strongestAlignedEdge >= 3;
  }

  const priorAnalysePhoto = analysePhoto;
  analysePhoto = async function analysePhotoWithoutReferenceMaterials(photo) {
    try {
      if (await looksLikeReferenceMaterial(photo)) return null;
    } catch (error) {
      console.warn("Visual subject filter skipped", error);
    }
    return priorAnalysePhoto(photo);
  };
})();
