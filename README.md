# Photo Palette Maker

A photo-first palette generator for the calibrated Ohuhu Oahu 100 marker set.

## What it does

- Automatically sources candidate photos from Openverse and Wikimedia Commons
- Analyses source images locally in the browser
- Converts photo samples and marker colours to OKLab for perceptual matching
- Rejects photos that do not map strongly enough to the available marker gamut
- Selects six distinct physical marker colours for every accepted photo
- Rejects near-duplicate six-marker palettes
- Keeps photo source, creator, and licence metadata attached to every card
- Saves generated cards locally in the browser
- Prints photo plus six-swatch cards four per US Letter page
- Uses the calibrated marker hex values as the displayed swatches

The previous manual generator and preset palette collection have been removed. The photo is now the source of truth for every palette.
