(() => {
  const PRESET_PALETTES = [
    { id: "berry-cream", name: "Berry Cream", source: "Color Hunt", tags: ["soft", "warm"], colours: ["#FFF9F2", "#F3E6D5", "#E9A7B4", "#D45060", "#A52E45", "#800020"] },
    { id: "midnight-cream", name: "Midnight Cream", source: "Color Hunt", tags: ["cool", "dark"], colours: ["#FCF1D0", "#E6D8B5", "#6173A7", "#22396F", "#0D1C42", "#010736"] },
    { id: "soft-garden", name: "Soft Garden", source: "Color Hunt", tags: ["soft", "nature"], colours: ["#FFF9D6", "#E8E7B5", "#BBC78C", "#8EA66B", "#D8A2A2", "#9E7777"] },
    { id: "peach-sorbet", name: "Peach Sorbet", source: "Color Hunt", tags: ["soft", "warm"], colours: ["#FFFAD3", "#FFDBB0", "#FFCCB8", "#FFB1B1", "#F48F9E", "#D66E83"] },
    { id: "poolside", name: "Poolside", source: "Color Hunt", tags: ["bold", "cool"], colours: ["#FFF2A6", "#F4EB6C", "#FFD444", "#8ACFF8", "#3D9ED6", "#006199"] },
    { id: "candy-sky", name: "Candy Sky", source: "Color Hunt", tags: ["soft", "cool"], colours: ["#FFF6DC", "#FFD5DA", "#FF95A5", "#AFCFF0", "#76C0EC", "#425B9A"] },
    { id: "retro-diner", name: "Retro Diner", source: "Color Hunt", tags: ["bold", "warm"], colours: ["#F8E0A4", "#E7B866", "#31AAA9", "#167B7A", "#A82020", "#6C1A1A"] },
    { id: "ember-glow", name: "Ember Glow", source: "Color Hunt", tags: ["bold", "warm"], colours: ["#FFD58A", "#FCAD38", "#EB7F31", "#E45742", "#B93B35", "#972828"] },
    { id: "olive-orchard", name: "Olive Orchard", source: "Color Hunt", tags: ["nature", "warm"], colours: ["#FCECD8", "#D8CDA8", "#91AC67", "#597928", "#6E3511", "#3F2618"] },
    { id: "forest-gold", name: "Forest Gold", source: "Color Hunt", tags: ["nature", "dark"], colours: ["#E8DCC4", "#C49A45", "#7E8B58", "#2A6B5C", "#1E5146", "#123F36"] },
    { id: "vintage-rose", name: "Vintage Rose", source: "Color Hunt", tags: ["soft", "neutral"], colours: ["#F5EFE1", "#E5D3AF", "#AEC4D4", "#A77D7C", "#790D16", "#4D1519"] },
    { id: "orchid-pop", name: "Orchid Pop", source: "Color Hunt", tags: ["bold", "soft"], colours: ["#FFE2EF", "#FFC0DE", "#ED96D7", "#C654C3", "#8E1EA2", "#59136B"] },
    { id: "blush-clay", name: "Blush Clay", source: "Coolors", tags: ["soft", "warm"], colours: ["#FFF2E9", "#FFE5D9", "#FCD0A1", "#FFA8A9", "#B5838D", "#896A67"] },
    { id: "sea-glass", name: "Sea Glass", source: "Coolors", tags: ["cool", "bold"], colours: ["#D9F4F1", "#69D1C5", "#3BA99C", "#21897E", "#7EBCE6", "#8980F5"] },
    { id: "natural-linen", name: "Natural Linen", source: "Coolors", tags: ["neutral", "nature", "soft"], colours: ["#FFF1E6", "#F0EFEB", "#EDDCD2", "#DDBEA9", "#CB997E", "#A5A58D"] },
    { id: "spring-meadow", name: "Spring Meadow", source: "Coolors", tags: ["nature", "soft"], colours: ["#F1F7EE", "#E7F59E", "#E0EDC5", "#B0BEA9", "#92AA83", "#58734F"] },
    { id: "electric-garden", name: "Electric Garden", source: "Coolors", tags: ["nature", "bold", "dark"], colours: ["#C6E955", "#8BBF9F", "#2A6041", "#35524A", "#016FB9", "#7C238C"] },
    { id: "deep-riviera", name: "Deep Riviera", source: "Coolors", tags: ["cool", "bold", "dark"], colours: ["#F3EAE4", "#DDD1C8", "#3AA5A0", "#0B3C65", "#E71E61", "#920942"] },
    { id: "lavender-smoke", name: "Lavender Smoke", source: "Coolors", tags: ["soft", "neutral", "cool"], colours: ["#F3EAF4", "#E5CEDC", "#EADDE1", "#BCA3AC", "#8F9491", "#5D6260"] },
    { id: "teal-stone", name: "Teal Stone", source: "Coolors", tags: ["cool", "dark", "neutral"], colours: ["#FFFFFC", "#DCD7CA", "#BEB7A4", "#087E8B", "#2081C3", "#000000"] },
    { id: "lc-cozy-bedroom", name: "Cozy Bedroom", source: "Book p. 6", tags: ["little-corner", "soft"], colours: ["#F3E7D2", "#E9B7B8", "#C9848C", "#B8A7CF", "#9CAE8B", "#8B6B5C"] },
    { id: "lc-pet-shop", name: "Pet Shop", source: "Book p. 7", tags: ["little-corner", "bold"], colours: ["#F1E4C7", "#8FCFD1", "#E69A8D", "#E0B64E", "#8A5C45", "#4F6B56"] },
    { id: "lc-holiday-boutique", name: "Holiday Boutique", source: "Book p. 10", tags: ["little-corner", "dark"], colours: ["#F5E6C9", "#D4B05A", "#A9C4D6", "#355B4A", "#A23D4A", "#76534A"] },
    { id: "lc-coffee-shop", name: "Coffee Shop", source: "Book p. 11", tags: ["little-corner", "warm", "neutral"], colours: ["#EAD9BF", "#B9875C", "#B56A56", "#73866B", "#6D4C3D", "#3B302B"] },
    { id: "lc-yard-sale", name: "Yard Sale", source: "Book p. 12", tags: ["little-corner", "bold"], colours: ["#EFE0C5", "#D5B454", "#D98974", "#5E9B96", "#6C83A2", "#7B5A46"] },
    { id: "lc-spa-bath", name: "Spa Bath", source: "Book p. 13", tags: ["little-corner", "soft", "cool"], colours: ["#EDE2CF", "#98B8AA", "#8FA9B8", "#7F9579", "#C78974", "#81766F"] },
    { id: "lc-ice-cream-truck", name: "Ice Cream Truck", source: "Book p. 14", tags: ["little-corner", "soft", "bold"], colours: ["#F2E0B7", "#D3A766", "#D96A86", "#9FC5B0", "#7286B1", "#7A5146"] },
    { id: "lc-farmers-market", name: "Farmers Market", source: "Book p. 15", tags: ["little-corner", "nature", "warm"], colours: ["#D9B84D", "#E39A46", "#C65A46", "#91A965", "#5E7D4F", "#8C6849"] },
    { id: "lc-sewing-room", name: "Sewing Room", source: "Book p. 16", tags: ["little-corner", "soft"], colours: ["#E8DDC8", "#C9A251", "#8194AA", "#6F9C9A", "#A9849A", "#705065"] },
    { id: "lc-juice-bar", name: "Juice Bar", source: "Book p. 17", tags: ["little-corner", "bold", "warm"], colours: ["#F1E2BF", "#E89B45", "#D97C3F", "#D96372", "#9AB85E", "#5E7B4E"] },
    { id: "lc-flower-stall", name: "Flower Stall", source: "Book p. 18", tags: ["little-corner", "nature", "soft"], colours: ["#EEE0C4", "#D8B74F", "#D98FA0", "#A58BB7", "#91AFC2", "#79936E"] },
    { id: "lc-home-office", name: "Home Office", source: "Book p. 19", tags: ["little-corner", "neutral"], colours: ["#E8DDCA", "#B66F59", "#82917B", "#758A9B", "#8A8179", "#51443D"] },
    { id: "lc-nursery", name: "Nursery", source: "Book p. 20", tags: ["little-corner", "soft"], colours: ["#EFE4CF", "#E4C86A", "#E1AEB7", "#A8C7D6", "#B6A3C6", "#A9C7AE"] },
    { id: "lc-bakery", name: "Bakery", source: "Book p. 22", tags: ["little-corner", "warm"], colours: ["#EFE2C3", "#D9B654", "#C99761", "#B55659", "#8B9B77", "#6B4A3F"] },
    { id: "lc-cat-shop", name: "Cat Fish Shop", source: "Book p. 23", tags: ["little-corner", "cool"], colours: ["#E7DCC7", "#C4A254", "#CE796A", "#6F9EB0", "#5D7660", "#4B4B49"] },
    { id: "lc-art-desk", name: "Art Desk", source: "Book p. 24", tags: ["little-corner", "bold"], colours: ["#E9DDC7", "#D7A25C", "#D2796F", "#7E9C75", "#6F8EA4", "#66506D"] },
    { id: "lc-beauty-vanity", name: "Beauty Vanity", source: "Book p. 25", tags: ["little-corner", "soft", "warm"], colours: ["#E8D8C9", "#DCA483", "#D79AAF", "#A57F92", "#8A5977", "#6D554F"] },
    { id: "lc-gym", name: "Gym", source: "Book p. 26", tags: ["little-corner", "bold", "cool"], colours: ["#E6DDC8", "#C2A24E", "#6F9EA0", "#4F6480", "#B44D57", "#8A8986"] },
    { id: "lc-home-kitchen", name: "Home Kitchen", source: "Book p. 27", tags: ["little-corner", "warm", "neutral"], colours: ["#E8D9C3", "#D3B56B", "#B97758", "#849173", "#728698", "#5A4B42"] },
    { id: "lc-workshop", name: "Workshop", source: "Book p. 29", tags: ["little-corner", "neutral"], colours: ["#DCCEB4", "#A47A57", "#C47B4D", "#6F7E63", "#61788E", "#4D4842"] },
    { id: "lc-laundry-room", name: "Laundry Room", source: "Book p. 30", tags: ["little-corner", "cool"], colours: ["#E2D8C4", "#C9776E", "#7DA8A7", "#9A8FA8", "#78856E", "#556577"] },
    { id: "lc-thank-you-desk", name: "Thank You Desk", source: "Book p. 31", tags: ["little-corner", "soft"], colours: ["#E8DDCA", "#D7A49B", "#B990A7", "#8EA4A0", "#8492A7", "#62546A"] },
    { id: "lc-ramen-night", name: "Ramen Night", source: "Book p. 32", tags: ["little-corner", "warm", "dark"], colours: ["#E4D5B4", "#D3A84F", "#A96F4D", "#B44D48", "#4D6651", "#443B35"] },
    { id: "lc-autumn-magic", name: "Autumn Magic", source: "Book p. 33", tags: ["little-corner", "warm", "dark"], colours: ["#E2D1AE", "#C9A64D", "#C5793F", "#77804B", "#76516D", "#5B463B"] },
    { id: "lc-pizza-kitchen", name: "Pizza Kitchen", source: "Book p. 34", tags: ["little-corner", "warm"], colours: ["#EADCC3", "#D9B75B", "#C86A4E", "#A95747", "#74815F", "#5A463C"] },
    { id: "lc-lovely-bakery", name: "Lovely Bakery", source: "Book p. 35", tags: ["little-corner", "soft", "warm"], colours: ["#EFE1C6", "#DDBB74", "#C98C66", "#C8757C", "#9B8C75", "#684E43"] },
    { id: "lc-sleepy-bedroom", name: "Sleepy Bedroom", source: "Book p. 36", tags: ["little-corner", "soft", "cool"], colours: ["#EDE1CF", "#D5A8B2", "#B7A5C3", "#8EA1AE", "#8E987D", "#665A62"] },
    { id: "lc-farm-garden", name: "Farm Garden", source: "Book p. 37", tags: ["little-corner", "nature"], colours: ["#E5D9B8", "#D3B64E", "#D17B42", "#97A657", "#5F7C4F", "#7A5A43"] },
    { id: "lc-sushi-bar", name: "Sushi Bar", source: "Book p. 38", tags: ["little-corner", "cool", "warm"], colours: ["#E6DCC5", "#D5A47E", "#D88572", "#A64E5B", "#435C4B", "#5B4439"] },
    { id: "lc-bubble-tea", name: "Bubble Tea", source: "Book p. 40", tags: ["little-corner", "bold", "soft"], colours: ["#E8D7BD", "#D8AB4E", "#D8838D", "#9A7FA5", "#7E9A63", "#5B463E"] },
    { id: "lc-toy-shop", name: "Halloween Toy Shop", source: "Book p. 41", tags: ["little-corner", "bold", "dark"], colours: ["#E7D7B6", "#D27D39", "#8E9F53", "#7C5B8D", "#B54C4A", "#4A4548"] },
    { id: "lc-closet", name: "Cozy Closet", source: "Book p. 42", tags: ["little-corner", "soft", "neutral"], colours: ["#E8DDC8", "#D7A2AA", "#B28A60", "#71859C", "#7E8C74", "#765768"] },
    { id: "lc-christmas-fireplace", name: "Christmas Fireplace", source: "Book p. 43", tags: ["little-corner", "warm", "dark"], colours: ["#E7D8BE", "#C4A04E", "#A5454F", "#3F654B", "#7A5744", "#4D5364"] },
  ];

  const grid = document.getElementById("presetGrid");
  const filters = document.getElementById("presetFilters");
  const count = document.getElementById("presetCount");
  if (!grid || !filters || !count) return;

  if (!filters.querySelector('[data-preset-filter="little-corner"]')) {
    const button = document.createElement("button");
    button.className = "preset-filter";
    button.type = "button";
    button.dataset.presetFilter = "little-corner";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Little Corner";
    filters.querySelector('[data-preset-filter="soft"]')?.before(button);
  }

  const note = document.querySelector(".preset-note");
  if (note) {
    note.innerHTML = 'General presets are inspired by popular combinations from <a href="https://colorhunt.co/palettes/popular" target="_blank" rel="noreferrer">Color Hunt</a> and <a href="https://coolors.co/" target="_blank" rel="noreferrer">Coolors</a>. The Little Corner collection contains distinct six-colour combinations designed for scenes in the book. Near-duplicate combinations have been removed. Every preset is matched to the closest unique markers in your Oahu 100 set.';
  }

  let activeFilter = "all";
  const matchedCache = new Map();

  function hexToRgbLocal(hex) {
    const clean = hex.replace("#", "");
    return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
  }

  function rgbToLabLocal(rgb) {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;
    const transform = value => value > 0.04045 ? Math.pow((value + 0.055) / 1.055, 2.4) : value / 12.92;
    r = transform(r); g = transform(g); b = transform(b);
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = value => value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + (16 / 116);
    x = f(x); y = f(y); z = f(z);
    return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
  }

  function distance(a, b) {
    return Math.sqrt(Math.pow(a.l - b.l, 2) + Math.pow(a.a - b.a, 2) + Math.pow(a.b - b.b, 2));
  }

  function matchPreset(preset) {
    if (matchedCache.has(preset.id)) return matchedCache.get(preset.id);
    if (typeof state === "undefined" || !state.markers || !state.markers.length) return [];

    const markerLabs = state.markers.map(marker => ({ marker, lab: rgbToLabLocal(hexToRgbLocal(marker.hex)) }));
    const used = new Set();
    const matches = [];

    preset.colours.slice(0, 6).forEach(targetHex => {
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
          <span class="preset-strip" aria-hidden="true">${matches.map(marker => `<span style="background:${marker.hex}"></span>`).join("")}</span>
          <span class="preset-card-copy">
            <span class="preset-title-row"><strong>${preset.name}</strong><span class="preset-origin">${preset.source}</span></span>
            <span class="preset-codes">${codes}</span>
          </span>
        </button>`;
    }).join("");
  }

  function usePreset(id) {
    const preset = PRESET_PALETTES.find(item => item.id === id);
    if (!preset) return;
    const matches = matchPreset(preset);
    if (matches.length !== 6) return;

    setMode("generate");
    state.mode = "preset";
    state.locks.clear();
    state.palette = matches.map(marker => ({ ...marker }));
    document.getElementById("sizeSelect").value = "6";
    renderPalette(`${preset.name} · 6 colours`, preset.tags.includes("little-corner") ? preset.source : "Curated preset");
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