Arrow Survival — Landing Page
================================

This small starter includes a landing page using the provided image with two functional buttons:
- **Play**: shows a toast ("starting game…"). Replace the handler in `main.js` to route to your game when ready.
- **Settings**: opens a modal with a sound toggle and difficulty selector; values are saved to `localStorage`.

Files
-----
- `index.html` — markup
- `styles.css` — styles and hotspot coordinates
- `main.js` — button handlers and modal logic
- `assets/landing.png` — provided landing artwork

Hotspots
--------
The clickable areas are absolutely positioned using percentages so they align to the PLAY and SETTINGS areas drawn in the image.
If you change artwork or aspect ratio materially, tweak the `.hotspot.play` and `.hotspot.settings` rules in `styles.css`.

How to run
----------
Open `index.html` in any browser. No build step required.
