(() => {
  // Best-effort display calibration from the user's Oahu 100 swatches on 200 gsm marker paper.
  // These values intentionally override the generic digital reference colours so the UI,
  // image matching, presets, and print previews better resemble the physical markers.
  const REAL_WORLD_HEX_OVERRIDES = {
    Y08: "#E7CB4A",
    Y111: "#D9A323",
    Y26: "#EBC74C",
    Y27: "#E5C348",
    Y28: "#DCA62E",
    Y29: "#D59B2C",
    Y210: "#C7852D",
    Y211: "#C08B38",
    Y213: "#B87D34",
    Y216: "#A97A42",
    Y315: "#8B783B",
    Y415: "#A98758",
    Y611: "#B99361",
    YR02: "#E9D6C5",
    YR04: "#EDDDC7",
    YR07: "#F1B172",
    YR112: "#F97A27",
    YR114: "#EF5A34",
    YR33: "#EFC1A0",
    YR34: "#E8B18B",

    YR39: "#C9844D",
    YR316: "#654636",
    YR515: "#A15A34",
    E312: "#8A7349",
    E511: "#715041",
    E513: "#4E4640",
    E613: "#7E4F42",
    E615: "#5D463D",
    R014: "#CD4250",
    R015: "#C6474C",
    R16: "#F2B29D",
    R111: "#E8656F",
    R28: "#E9969D",
    R210: "#C87881",
    R213: "#C45465",
    R214: "#AE4F61",
    R215: "#7F4D55",
    R38: "#E26E97",
    R412: "#CB415E",
    R413: "#B83C55",

    R510: "#6A2339",
    RV08: "#EE5FB4",
    RV17: "#F08DAD",
    RV19: "#F05A97",
    RV111: "#D8377B",
    RV212: "#C52A80",
    RV311: "#B0348B",
    RV313: "#8D346F",
    RV314: "#7A3D67",
    RV316: "#7A608F",
    V010: "#9E78B6",
    V18: "#D19AE3",
    V214: "#7951A8",
    V38: "#A4A7E0",
    BV26: "#B2B3E8",
    BV38: "#92B4F0",
    BV310: "#4A6BC4",
    BV314: "#354E95",
    BV315: "#2F4577",
    BV514: "#22365B",

    B08: "#73C6ED",
    B010: "#39AFDF",
    B111: "#1590DE",
    B114: "#295C9F",
    B115: "#274F90",
    B315: "#355471",
    B411: "#59708B",
    B415: "#333B44",
    BG05: "#73D6E3",
    BG010: "#3BAAB7",
    BG212: "#43A690",
    BG311: "#49B3A5",
    BG312: "#44A69D",
    BG314: "#2D6F74",
    BG315: "#235C5A",
    G213: "#296347",
    G215: "#1E4E37",
    G310: "#2F8E4C",
    G312: "#2C7F4F",
    G315: "#1E5A4A",

    G316: "#113A3A",
    G49: "#72BD4F",
    G410: "#56A03B",
    YG012: "#9FBC3D",
    YG015: "#596521",
    YG414: "#41663B",
    BGY05: "#66717E",
    BGY08: "#4B5869",
    YGY11: "#C7B69C",
    WG10: "#EFEFF2",
    WG27: "#9C9395",
    WG28: "#7A7377",
    WG36: "#4F4C50",
    GG05: "#728082",
    GG10: "#C3C3CB",
    FY00: "#D9EA3B",
    FY01: "#FF8836",
    FY02: "#F95E60",
    FY03: "#E64AA6",
    120: "#171619",
  };

  // Expose a read-only reference so the image-first workflow can guarantee
  // it always matches against the calibrated swatch colours.
  window.OAHU_REAL_WORLD_HEX = Object.freeze({ ...REAL_WORLD_HEX_OVERRIDES });

  let applied = false;

  function applyCalibration() {
    if (applied || typeof state === "undefined" || !Array.isArray(state.markers) || state.markers.length < 100) {
      return false;
    }

    state.markers.forEach(marker => {
      const calibrated = REAL_WORLD_HEX_OVERRIDES[marker.code];
      if (calibrated) marker.hex = calibrated;
    });

    state.palette.forEach(marker => {
      const calibrated = REAL_WORLD_HEX_OVERRIDES[marker.code];
      if (calibrated) marker.hex = calibrated;
    });

    applied = true;

    if (typeof renderMarkerBrowser === "function") {
      const search = document.getElementById("markerSearch");
      renderMarkerBrowser(search ? search.value : "");
    }

    if (state.palette.length && typeof renderPalette === "function") {
      const title = document.getElementById("paletteTitle")?.textContent || "Current palette";
      const kicker = document.getElementById("paletteKicker")?.textContent || "Current palette";
      renderPalette(title, kicker);
    }

    document.dispatchEvent(new CustomEvent("oahu-colours-calibrated"));
    return true;
  }

  if (!applyCalibration()) {
    const timer = setInterval(() => {
      if (applyCalibration()) clearInterval(timer);
    }, 10);

    setTimeout(() => clearInterval(timer), 15000);
  }

  // Load the image-first workflow without requiring another index.html dependency.
  if (!document.querySelector('script[data-oahu-image-workflow]')) {
    const workflowScript = document.createElement("script");
    workflowScript.src = "image-workflow.js";
    workflowScript.dataset.oahuImageWorkflow = "true";
    document.body.appendChild(workflowScript);
  }
})();
