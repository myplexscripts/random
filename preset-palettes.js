(() => {
  const PRESET_PALETTES = [
    {
      id: "berry-cream",
      name: "Berry Cream",
      source: "Color Hunt",
      tags: ["soft", "warm"],
      colours: ["#FFF9F2", "#F3E6D5", "#E9A7B4", "#D45060", "#A52E45", "#800020"],
    },
    {
      id: "midnight-cream",
      name: "Midnight Cream",
      source: "Color Hunt",
      tags: ["cool", "dark"],
      colours: ["#FCF1D0", "#E6D8B5", "#6173A7", "#22396F", "#0D1C42", "#010736"],
    },
    {
      id: "soft-garden",
      name: "Soft Garden",
      source: "Color Hunt",
      tags: ["soft", "nature"],
      colours: ["#FFF9D6", "#E8E7B5", "#BBC78C", "#8EA66B", "#D8A2A2", "#9E7777"],
    },
    {
      id: "peach-sorbet",
      name: "Peach Sorbet",
      source: "Color Hunt",
      tags: ["soft", "warm"],
      colours: ["#FFFAD3", "#FFDBB0", "#FFCCB8", "#FFB1B1", "#F48F9E", "#D66E83"],
    },
    {
      id: "poolside",
      name: "Poolside",
      source: "Color Hunt",
      tags: ["bold", "cool"],
      colours: ["#FFF2A6", "#F4EB6C", "#FFD444", "#8ACFF8", "#3D9ED6", "#006199"],
    },
    {
      id: "candy-sky",
      name: "Candy Sky",
      source: "Color Hunt",
      tags: ["soft", "cool"],
      colours: ["#FFF6DC", "#FFD5DA", "#FF95A5", "#AFCFF0", "#76C0EC", "#425B9A"],
    },
    {
      id: "retro-diner",
      name: "Retro Diner",
      source: "Color Hunt",
      tags: ["bold", "warm"],
      colours: ["#F8E0A4", "#E7B866", "#31AAA9", "#167B7A", "#A82020", "#6C1A1A"],
    },
    {
      id: "ember-glow",
      name: "Ember Glow",
      source: "Color Hunt",
      tags: ["bold", "warm"],
      colours: ["#FFD58A", "#FCAD38", "#EB7F31", "#E45742", "#B93B35", "#972828"],
    },
    {
      id: "olive-orchard",
      name: "Olive Orchard",
      source: "Color Hunt",
      tags: ["nature", "warm"],
      colours: ["#FCECD8", "#D8CDA8", "#91AC67", "#597928", "#6E3511", "#3F2618"],
    },
    {
      id: "forest-gold",
      name: "Forest Gold",
      source: "Color Hunt",
      tags: ["nature", "dark"],
      colours: ["#E8DCC4", "#C49A45", "#7E8B58", "#2A6B5C", "#1E5146", "#123F36"],
    },
    {
      id: "vintage-rose",
      name: "Vintage Rose",
      source: "Color Hunt",
      tags: ["soft", "neutral"],
      colours: ["#F5EFE1", "#E5D3AF", "#AEC4D4", "#A77D7C", "#790D16", "#4D1519"],
    },
    {
      id: "orchid-pop",
      name: "Orchid Pop",
      source: "Color Hunt",
      tags: ["bold", "soft"],
      colours: ["#FFE2EF", "#FFC0DE", "#ED96D7", "#C654C3", "#8E1EA2", "#59136B"],
    },
    {
      id: "blush-clay",
      name: "Blush Clay",
      source: "Coolors",
      tags: ["soft", "warm"],
      colours: ["#FFF2E9", "#FFE5D9", "#FCD0A1", "#FFA8A9", "#B5838D", "#896A67"],
    },
    {
      id: "sea-glass",
      name: "Sea Glass",
      source: "Coolors",
      tags: ["cool", "bold"],
      colours: ["#D9F4F1", "#69D1C5", "#3BA99C", "#21897E", "#7EBCE6", "#8980F5"],
    },
    {
      id: "natural-linen",
      name: "Natural Linen",
      source: "Coolors",
      tags: ["neutral", "nature", "soft"],
      colours: ["#FFF1E6", "#F0EFEB", "#EDDCD2", "#DDBEA9", "#CB997E", "#A5A58D"],
    },
    {
      id: "spring-meadow",
      name: "Spring Meadow",
      source: "Coolors",
      tags: ["nature", "soft"],
      colours: ["#F1F7EE", "#E7F59E", "#E0EDC5", "#B0BEA9", "#92AA83", "#58734F"],
    },
    {
      id: "electric-garden",
      name: "Electric Garden",
      source: "Coolors",
      tags: ["nature", "bold", "dark"],
      colours: ["#C6E955", "#8BBF9F", "#2A6041", "#35524A", "#016FB9", "#7C238C"],
    },
    {
      id: "deep-riviera",
      name: "Deep Riviera",
      source: "Coolors",
      tags: ["cool", "bold", "dark"],
      colours: ["#F3EAE4", "#DDD1C8", "#3AA5A0", "#0B3C65", "#E71E61", "#920942"],
    },
    {
      id: "lavender-smoke",
      name: "Lavender Smoke",
      source: "Coolors",
      tags: ["soft", "neutral", "cool"],
      colours: ["#F3EAF4", "#E5CEDC", "#EADDE1", "#BCA3AC", "#8F9491", "#5D6260"],
    },
    {
      id: "teal-stone",
      name: "Teal Stone",
      source: "Coolors",
      tags: ["cool", "dark", "neutral"],
      colours: ["#FFFFFC", "#DCD7CA", "#BEB7A4", "#087E8B", "#2081C3", "#000000"],
    },
  ];

  const grid = document.getElementById("presetGrid");
  const filters = document.getElementById("presetFilters");
  const count = document.getElementById("presetCount");
  if (!grid || !filters || !count) return;

  let activeFilter = "all";
  const matchedCache = new Map();

  function hexToRgbLocal(hex) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  function rgbToLabLocal(rgb) {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;
    const transform = value => value > 0.04045 ? Math.pow((value + 0.055) / 1.055, 2.4) : value / 12.92;
    r = transform(r);
    g = transform(g);
    b = transform(b);

    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = value => value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + (16 / 116);
    x = f(x);
    y = f(y);
    z = f(z);

    return {
      l: (116 * y) - 16,
      a: 500 * (x - y),
      b: 200 * (y - z),
    };
  }

  function distance(a, b) {
    return Math.sqrt(
      Math.pow(a.l - b.l, 2) +
      Math.pow(a.a - b.a, 2) +
      Math.pow(a.b - b.b, 2)
    );
  }

  function matchPreset(preset) {
    if (matchedCache.has(preset.id)) return matchedCache.get(preset.id);
    if (typeof state === "undefined" || !state.markers || !state.markers.length) return [];

    const markerLabs = state.markers.map(marker => ({
      marker,
      lab: rgbToLabLocal(hexToRgbLocal(marker.hex)),
    }));
    const used = new Set();
    const matches = [];

    preset.colours.forEach(targetHex => {
      const targetLab = rgbToLabLocal(hexToRgbLocal(targetHex));
      const ranked = markerLabs
        .filter(entry => !used.has(entry.marker.code))
        .map(entry => ({ ...entry, score: distance(targetLab, entry.lab) }))
        .sort((a, b) => a.score - b.score);

      if (!ranked.length) return;
      used.add(ranked[0].marker.code);
      matches.push(ranked[0].marker);
    });

    matchedCache.set(preset.id, matches);
    return matches;
  }

  function renderPresets() {
    if (typeof state === "undefined" || !state.markers || !state.markers.length) {
      grid.innerHTML = '<div class="preset-loading">Matching presets to your markers…</div>';
      count.textContent = "";
      return;
    }

    const visible = PRESET_PALETTES.filter(preset => activeFilter === "all" || preset.tags.includes(activeFilter));
    count.textContent = `${visible.length} palette${visible.length === 1 ? "" : "s"}`;

    grid.innerHTML = visible.map(preset => {
      const matches = matchPreset(preset);
      const codes = matches.map(marker => marker.code).join(" · ");
      return `
        <button class="preset-card" type="button" data-preset-id="${preset.id}" aria-label="Use ${preset.name} preset">
          <span class="preset-strip" aria-hidden="true">
            ${matches.map(marker => `<span style="background:${marker.hex}"></span>`).join("")}
          </span>
          <span class="preset-card-copy">
            <span class="preset-title-row">
              <strong>${preset.name}</strong>
              <span class="preset-origin">${preset.source}</span>
            </span>
            <span class="preset-codes">${codes}</span>
          </span>
        </button>
      `;
    }).join("");
  }

  function usePreset(id) {
    const preset = PRESET_PALETTES.find(item => item.id === id);
    if (!preset) return;
    const matches = matchPreset(preset);
    if (!matches.length) return;

    setMode("generate");
    state.mode = "preset";
    state.locks.clear();
    state.palette = matches.map(marker => ({ ...marker }));

    document.getElementById("sizeSelect").value = "6";

    renderPalette(`${preset.name} · 6 colours`, "Curated preset");
    const refresh = document.getElementById("refreshButton");
    if (refresh) refresh.disabled = true;

    document.querySelector(".palette-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof showToast === "function") showToast(`${preset.name} loaded`);
  }

  filters.addEventListener("click", event => {
    const button = event.target.closest("[data-preset-filter]");
    if (!button) return;
    activeFilter = button.dataset.presetFilter;
    filters.querySelectorAll("[data-preset-filter]").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderPresets();
  });

  grid.addEventListener("click", event => {
    const card = event.target.closest("[data-preset-id]");
    if (!card) return;
    usePreset(card.dataset.presetId);
  });

  function waitForMarkers() {
    if (typeof state !== "undefined" && state.markers && state.markers.length) {
      renderPresets();
      return;
    }
    setTimeout(waitForMarkers, 160);
  }

  waitForMarkers();
})();
