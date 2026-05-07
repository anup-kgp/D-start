Put your certificate template PNGs in this folder.

Expected filenames (you can rename, just update `certificate-template-config.js`):

- men-10km-finisher.png
- men-10km-rank-1.png
- men-10km-rank-2.png
- men-10km-rank-3.png
- men-10km-rank-4.png
- men-10km-rank-5.png

- women-5km-finisher.png
- women-5km-rank-1.png
- women-5km-rank-2.png
- women-5km-rank-3.png
- women-5km-rank-4.png
- women-5km-rank-5.png

Then adjust text positions (xPct/yPct) once in `certificate-template-config.js`.

A verification QR code is drawn on every certificate (see `QR_SLOT` in that file).
It links to: `https://YOUR-DOMAIN/verify.html?cert=<certificateId>`.
Adjust `QR_SLOT` if the QR should sit in a different corner on your artwork.

