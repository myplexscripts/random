# Photo Palette Maker

A photo-first palette generator for the Ohuhu Oahu 100 marker set.

## What it does

- Uses Unsplash as the only photo source
- Prompts for an Unsplash access key and stores it locally in the browser
- Uses the original digital Ohuhu marker colours and names, not the photo-calibrated overrides
- Uses a curated rotating set of visually useful Unsplash searches
- Analyses source images locally in the browser
- Uses a minimum marker-match slider from 85% to 100%
- Rejects images that contain too many important colours to compress cleanly into six swatches
- Extracts six original sampled colours from each accepted photo
- Matches those six sampled colours to six distinct physical markers
- Uses hue/chroma sanity checks to prevent obviously wrong pairings
- Shows the sampled palette above the image and matched marker palette below it on the card front
- Shows the same palette strips on the back, reversed so the physical colour columns align when the card is flipped left-to-right
- Shows matched marker code/name details with the corresponding sampled colour on the back
- Rejects near-duplicate six-marker palettes
- Keeps the Unsplash source and photographer attached to every card
- Saves generated cards locally in the browser

## Printing

Cards have a fixed physical size of 3.5 × 5 inches.

The user can choose Letter, A4, Legal, Tabloid, or A3 paper. The app calculates how many cards fit, chooses portrait or landscape automatically when that increases capacity, and generates paired front/back pages for duplex printing.

Back-page card positions are mirrored horizontally so each back lands behind its matching front. In portrait, print double-sided with **flip on long edge**. If the app selects landscape, use **flip on short edge**. Print at **100% / actual size** for correct alignment.

The photo is the source of truth for every palette. The displayed match percentage represents how closely the six selected source colours match the six selected markers.
