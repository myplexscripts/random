(() => {
  const KEY_STORAGE = "oahu-unsplash-access-key";
  const MIN_MATCH_SCORE = 85;
  const originalAnalysePhoto = analysePhoto;

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

  analysePhoto = async function analysePhotoWithMinimumScore(photo) {
    const analysis = await originalAnalysePhoto(photo);
    if (!analysis || analysis.score < MIN_MATCH_SCORE) return null;
    return analysis;
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

  function pruneLibrary() {
    if (!Array.isArray(state.palettes)) return;

    const filtered = state.palettes.filter(palette =>
      palette?.source === "Unsplash" && Number(palette.score) >= MIN_MATCH_SCORE
    );

    const changed = filtered.length !== state.palettes.length;
    state.palettes = filtered;
    state.usedPhotoIds.clear();
    state.palettes.forEach(palette => state.usedPhotoIds.add(String(palette.photoId || palette.id)));

    if (changed) {
      if (typeof persistPalettes === "function") persistPalettes();
      if (typeof renderPalettes === "function") renderPalettes();
    }
  }

  function updateUi() {
    const input = document.getElementById("unsplashKey");
    const status = document.getElementById("unsplashStatus");
    const generate = document.getElementById("generateButton");
    const savedKey = (localStorage.getItem(KEY_STORAGE) || "").trim();

    if (input && document.activeElement !== input) input.value = savedKey;
    if (status) {
      status.textContent = savedKey
        ? `Unsplash connected. Only results scoring ${MIN_MATCH_SCORE}% or higher will be kept.`
        : "No Unsplash key saved. Add one before generating palettes.";
    }
    if (generate && !state.running) generate.disabled = !savedKey;
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

    const savedKey = localStorage.getItem(KEY_STORAGE) || "";
    if (input) input.value = savedKey;
    save?.addEventListener("click", saveKey);
    clear?.addEventListener("click", clearKey);
    input?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveKey();
      }
    });

    pruneLibrary();
    updateUi();
    if (window.lucide) window.lucide.createIcons();
  });
})();
