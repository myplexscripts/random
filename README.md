# Photo Palette Maker

A photo-first palette generator for the calibrated Ohuhu Oahu 100 marker set.

## What it does

- Uses Unsplash as the only photo source
- Prompts for an Unsplash access key and stores it locally in the browser
- Analyses source images locally in the browser
- Converts photo samples and marker colours to OKLab for perceptual matching
- Rejects every result below 85% marker compatibility
- Selects six distinct physical marker colours for every accepted photo
- Rejects near-duplicate six-marker palettes
- Keeps the Unsplash source and photographer attached to every card
- Saves generated cards locally in the browser
- Prints photo plus six-swatch cards four per US Letter page
- Uses the calibrated marker hex values as the displayed swatches

The photo is the source of truth for every palette.
