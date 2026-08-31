# DEPLOYMENT.md

## What to upload

`Jain-Ludo-Hostinger.zip` contains the complete static production build.
Its ROOT contains `index.html` directly - no nested folder.

```
Jain-Ludo-Hostinger/
    index.html
    assets/
```

This is a 100% static site: **no Node.js, no npm, no database, and no
server-side configuration are required.** Any static file host works.

## Hostinger upload steps

1. Log in to Hostinger and open **File Manager** (hPanel -> Files -> File
   Manager).
2. Navigate to `public_html`.
3. Create a new folder named `jain-ludo`.
4. Upload `Jain-Ludo-Hostinger.zip` into that `jain-ludo` folder.
5. Right-click the uploaded zip -> **Extract**. Extract it into the same
   `jain-ludo` folder (not into a further subfolder).
6. Confirm the result is:
   ```
   public_html/jain-ludo/index.html
   public_html/jain-ludo/assets/
   ```
   `index.html` must sit directly inside `jain-ludo/`, not one level deeper.
7. Delete the uploaded `Jain-Ludo-Hostinger.zip` file from `public_html/jain-ludo/` (optional cleanup).
8. Visit `https://YOUR-DOMAIN/jain-ludo/` in a browser.

The game should load directly - no build step, no server restart, no
environment variables.

## Why this works with zero server configuration

- All paths in the built `index.html` are relative (`vite.config.ts` sets
  `base: './'`), so the game works whether it's served from a domain root or
  a subfolder like `/jain-ludo/`.
- There is no backend, API, or database - the entire game (rules engine,
  rendering, audio, persistence) runs in the browser. Settings/statistics
  are stored in the browser's `localStorage`, not on the server.
- Every asset is either inside the JS bundle or generated at runtime (see
  `ASSET_SPECIFICATION.md`) - there are no additional files to go missing or
  need special MIME-type configuration.

## Local verification before upload (optional, for maintainers)

```
npm install
npm run build        # produces dist/
npm run preview      # serves dist/ at http://localhost:4173
```
Open the preview URL and confirm the game loads and plays.

## Updating a deployed copy

Re-run `npm run build`, re-zip the contents of `dist/` (see the source
project's `package-hostinger.sh` or equivalent), and repeat the upload/
extract steps above, overwriting the existing `jain-ludo` folder contents.
