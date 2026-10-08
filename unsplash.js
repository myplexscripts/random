(() => {
  const KEY_STORAGE = "oahu-unsplash-access-key";
  const THRESHOLD_STORAGE = "oahu-match-threshold";
  const MIN_MATCH_SCORE = 85;
  const MAX_MATCH_SCORE = 100;
  const originalAnalysePhoto = analysePhoto;
  const originalRenderPalettes = renderPalettes;
  const originalSetBusy = setBusy;

  const ORIGINAL_PALETTE_SEARCHES = [
    "Berry Cream", "Midnight Cream", "Soft Garden", "Peach Sorbet", "Poolside", "Candy Sky",
    "Retro Diner", "Ember Glow", "Olive Orchard", "Forest Gold", "Vintage Rose", "Orchid Pop",
    "Blush Clay", "Sea Glass", "Natural Linen", "Spring Meadow", "Electric Garden", "Deep Riviera",
    "Lavender Smoke", "Teal Stone", "Cozy Bedroom", "Pet Shop", "Holiday Boutique", "Coffee Shop",
    "Yard Sale", "Spa Bath", "Ice Cream Truck", "Farmers Market", "Sewing Room", "Juice Bar",
    "Flower Stall", "Home Office", "Nursery", "Bakery", "Cat Fish Shop", "Art Desk", "Beauty Vanity",
    "Gym", "Home Kitchen", "Workshop", "Laundry Room", "Thank You Desk", "Ramen Night", "Autumn Magic",
    "Pizza Kitchen", "Lovely Bakery", "Sleepy Bedroom", "Farm Garden", "Sushi Bar", "Bubble Tea",
    "Halloween Toy Shop", "Cozy Closet", "Christmas Fireplace"
  ];

  if (Array.isArray(PHOTO_SUBJECTS)) {
    const existing = new Set(PHOTO_SUBJECTS.map(item => item.toLowerCase()));
    ORIGINAL_PALETTE_SEARCHES.forEach(name => {
      if (!existing.has(name.toLowerCase())) PHOTO_SUBJECTS.push(name);
    });
  }

  function getMatchThreshold() {
    const slider = document.getElementById("matchThreshold");
    const stored = Number(localStorage.getItem(THRESHOLD_STORAGE));
    const raw = slider ? Number(slider.value) : stored;
    const value = Number.isFinite(raw) ? raw : MIN_MATCH_SCORE;
    return Math.max(MIN_MATCH_SCORE, Math.min(MAX_MATCH_SCORE, Math.round(value)));
  }

  function updateThresholdUi() {
    const slider = document.getElementById("matchThreshold");
    const output = document.getElementById("matchThresholdValue");
    const threshold = getMatchThreshold();
    if (slider && Number(slider.value) !== threshold) slider.value = String(threshold);
    if (output) output.textContent = `${threshold}%`;
  }

  async function fetchUnsplashPhotos(subject, accessKey) {
    const params = new URLSearchParams({
      query: subject,
      page: "1",
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
        sourceUrl: photo.links?.html
          ? `${photo.links.html}${photo.links.html.includes("?") ? "&" : "?"}utm_source=myplexscripts_photo_palette_maker&utm_medium=referral`
          : "https://unsplash.com/",
        source: "Unsplash",
        creator: photo.user?.name || photo.user?.username || "Unsplash photographer",
        licence: "Unsplash license"
      }));
  }

  sourcePhotos = async function sourcePhotosFromUnsplash(subject) {
    const accessKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    if (!accessKey) return [];
    return fetchUnsplashPhotos(subject, accessKey);
  };

  analysePhoto = async function analysePhotoWithThreshold(photo) {
    const analysis = await originalAnalysePhoto(photo);
    if (!analysis || analysis.score < getMatchThreshold()) return null;
    return analysis;
  };

  renderPalettes = function renderPalettesAtThreshold() {
    if (!Array.isArray(state.palettes)) return originalRenderPalettes();
    const allPalettes = state.palettes;
    const threshold = getMatchThreshold();
    state.palettes = allPalettes.filter(palette =>
      palette?.source === "Unsplash" && Number(palette.score) >= threshold
    );
    try {
      originalRenderPalettes();
    } finally {
      state.palettes = allPalettes;
    }
  };

  setBusy = function setBusyWithThresholdLock(busy, text = "Ready") {
    originalSetBusy(busy, text);
    const slider = document.getElementById("matchThreshold");
    if (slider) slider.disabled = busy;
  };

  async function validateKey(key) {
    const response = await fetch("https://api.unsplash.com/photos?per_page=1", {
      headers: {
        "Accept-Version": "v1",
        "Authorization": `Client-ID ${key}`
      }
    });
    return response.ok;
  }

  function pruneLegacyLibrary() {
    if (!Array.isArray(state.palettes)) return;

    const filtered = state.palettes.filter(palette =>
      palette?.source === "Unsplash" && Number(palette.score) >= MIN_MATCH_SCORE
    );

    const changed = filtered.length !== state.palettes.length;
    state.palettes = filtered;
    state.usedPhotoIds.clear();
    state.palettes.forEach(palette => state.usedPhotoIds.add(String(palette.photoId || palette.id)));

    if (changed && typeof persistPalettes === "function") persistPalettes();
  }

  function updateUi() {
    const input = document.getElementById("unsplashKey");
    const status = document.getElementById("unsplashStatus");
    const generate = document.getElementById("generateButton");
    const savedKey = (localStorage.getItem(KEY_STORAGE) || "").trim();
    const threshold = getMatchThreshold();

    if (input && document.activeElement !== input) input.value = savedKey;
    if (status) {
      status.textContent = savedKey
        ? `Unsplash connected. Only results scoring ${threshold}% or higher will be shown and kept in new batches.`
        : "No Unsplash key saved. Add one before generating palettes.";
    }
    if (generate && !state.running) generate.disabled = !savedKey;
    updateThresholdUi();
  }

  async function saveKey() {
    const input = document.getElementById("unsplashKey");
    const button = document.getElementById("saveUnsplashKey");
    const status = document.getElementById("unsplashStatus");
    const key = (input?.value || "").trim();

    if (!key) {
      localStorage.removeItem(KEY_STORAGE);
      updateUi();
      if (typeof showToast === "function") showToast("Enter your Unsplash access key first.");
      return;
    }

    if (button) button.disabled = true;
    if (status) status.textContent = "Checking Unsplash access key...";

    try {
      const valid = await validateKey(key);
      if (!valid) throw new Error("Invalid key");
      localStorage.setItem(KEY_STORAGE, key);
      updateUi();
      if (typeof showToast === "function") showToast("Unsplash connected.");
    } catch (error) {
      localStorage.removeItem(KEY_STORAGE);
      if (status) status.textContent = "That Unsplash access key could not be verified.";
      if (typeof showToast === "function") showToast("Unsplash key could not be verified.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function clearKey() {
    localStorage.removeItem(KEY_STORAGE);
    const input = document.getElementById("unsplashKey");
    if (input) input.value = "";
    updateUi();
    if (typeof showToast === "function") showToast("Unsplash key cleared.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("unsplashKey");
    const save = document.getElementById("saveUnsplashKey");
    const clear = document.getElementById("clearUnsplashKey");
    const slider = document.getElementById("matchThreshold");

    const savedKey = localStorage.getItem(KEY_STORAGE) || "";
    const savedThreshold = Number(localStorage.getItem(THRESHOLD_STORAGE));
    if (input) input.value = savedKey;
    if (slider && Number.isFinite(savedThreshold) && savedThreshold >= MIN_MATCH_SCORE && savedThreshold <= MAX_MATCH_SCORE) {
      slider.value = String(Math.round(savedThreshold));
    }

    save?.addEventListener("click", saveKey);
    clear?.addEventListener("click", clearKey);
    input?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveKey();
      }
    });
    slider?.addEventListener("input", () => {
      updateThresholdUi();
      updateUi();
      renderPalettes();
    });
    slider?.addEventListener("change", () => {
      localStorage.setItem(THRESHOLD_STORAGE, String(getMatchThreshold()));
      updateUi();
      renderPalettes();
    });

    pruneLegacyLibrary();
    updateUi();
    renderPalettes();
    if (window.lucide) window.lucide.createIcons();
  });
})();
