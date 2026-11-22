// Sync the Site's copy of the shared GST core.
//
// Why this file exists: GitHub Pages deploys ONLY the site/ folder, so the
// Site cannot load ../core/gst.js on the live site (it 404s there and the
// whole page stops working — tabs, language, everything). The Site therefore
// loads site/gst-core.js, which must stay byte-identical to core/gst.js.
// Run this before every push that touches core/gst.js:
//   node tools/sync-site-core.js
// views.test.js also fails the build if the two files ever drift apart.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'core', 'gst.js');
const dst = path.join(root, 'site', 'gst-core.js');
fs.copyFileSync(src, dst);
console.log('synced core/gst.js -> site/gst-core.js (' + fs.statSync(dst).size + ' bytes)');
