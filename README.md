# Birthday Invitation Concepts

This folder includes three static single-page invitation concepts designed for GitHub Pages:

- `index-concept-a.html`  
  Pastel whimsical. Soft blush, lavender, mint, balloons, sparkles, and a cake illustration for the most dreamy and traditional birthday-invitation feel.

- `index-concept-b.html`  
  Modern editorial kids. Cleaner, airier, and more premium with an understated palette, structured cards, and a softer illustrated composition.

- `index-concept-c.html`  
  Playful party. Brighter, cheerier, and more energetic with confetti, rounded shapes, and a stronger sense of celebration.

Shared files:

- `styles.css` contains the shared design system and concept-specific theme styling.
- `script.js` adds subtle scroll-in reveals and the optional copy-address interaction.
- `google-apps-script/guest-feed.js` is a ready-to-deploy Apps Script endpoint that returns only kid first names and counts.

Editing notes:

- Update the main content directly inside each HTML file.
- The RSVP link appears in the hero button near the top of each page.
- The RSVP first-name list in `index.html` can be connected to Google Sheets or Apps Script through `window.partyGuestListConfig`.
- The included Apps Script feed is the safest option if your raw response sheet contains private parent details.
- For GitHub Pages, you can rename your preferred concept file to `index.html`.
