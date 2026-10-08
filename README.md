# Photo Palette Maker

A photo-first palette generator for the Ohuhu Oahu 100 marker set.

## What it does

- Uses Unsplash as the only photo source
- Prompts for an Unsplash access key and stores it locally in the browser
- Uses the original digital Ohuhu marker colours and names, not the photo-calibrated overrides
- Uses a curated rotating set of visually useful Unsplash searches
- Analyses source images locally in the browser
- Uses a minimum marker-match slider from 85% to 100%
- Treats six-colour complexity as a separate pass/fail check instead of lowering the displayed match percentage
- Rejects images that contain too many important colours to compress cleanly into six swatches
- Extracts six original sampled colours from each accepted photo
- Matches those six sampled colours to six distinct physical markers
- Uses hue/chroma sanity checks to prevent obviously wrong pairings such as neutral brown/grey source colours being assigned vivid green markers
- Shows two edge-to-edge swatch rows on the card front: original samples on top, marker matches below
- Adds a card back with matched marker swatches and marker code/name on the left, plus original sampled swatches on the right
- Uses small gaps between swatches on the back while keeping the layout flush to the card edges
- Rejects near-duplicate six-marker palettes
- Keeps the Unsplash source and photographer attached to every card
- Saves generated cards locally in the browser
- Prints both card faces

The photo is the source of truth for every palette. The displayed match percentage represents how closely the six selected source colours match the six selected markers. Image complexity is checked separately.
