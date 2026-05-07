// PNG-template certificate generator config.
//
// Put your template PNGs in:
//   /assets/certificates/
//
// Then update the filenames below to match.
//
// Coordinates are in percentages of the template image size, so it works with any resolution.

// Name goes on the blank line (user marked in red) across templates.
// If you want it a bit higher/lower for all certificates, tweak only `yPct`.
const NAME_SLOT = { xPct: 50, yPct: 45.0, maxWidthPct: 74, sizePct: 3.6, weight: 900, color: "#0b2a4f" };
// Reg no goes to lower-left box area (user marked in red).
// `xPct` is the left edge because we render this as left-aligned text.
const REG_SLOT = { xPct: 15.0, yPct: 77.8, maxWidthPct: 34, sizePct: 1.8, weight: 800, color: "#0b2a4f", align: "left" };

// Verification QR (to the right of “FINISHER” / headline area). Scans → verify.html?cert=<id>.
// Tweaks: `xPct`/`yPct` move the center; `sizePct` is width as % of canvas width.
const QR_SLOT = { xPct: 85.9, yPct: 30.5, sizePct: 7.5 };

const WOMEN_NAME_SLOT = { ...NAME_SLOT, sizePct: 3.3 };

export const CERT_TEMPLATES = {
  men10: {
    finisher: {
      file: "./assets/certificates/men-10km-finisher.png",
      // Men finisher template has the name line slightly lower.
      name: { ...NAME_SLOT, yPct: 52.4 },
      reg: REG_SLOT,
      qr: QR_SLOT,
    },
    ranked: {
      "1": {
        file: "./assets/certificates/men-10km-rank-1.png",
        name: NAME_SLOT,
        reg: REG_SLOT,
        qr: QR_SLOT,
      },
      "2": { file: "./assets/certificates/men-10km-rank-2.png", name: NAME_SLOT, reg: REG_SLOT, qr: QR_SLOT },
      "3": { file: "./assets/certificates/men-10km-rank-3.png", name: NAME_SLOT, reg: REG_SLOT, qr: QR_SLOT },
      "4": { file: "./assets/certificates/men-10km-rank-4.png", name: NAME_SLOT, reg: REG_SLOT, qr: QR_SLOT },
      "5": { file: "./assets/certificates/men-10km-rank-5.png", name: NAME_SLOT, reg: REG_SLOT, qr: QR_SLOT },
    },
  },
  women5: {
    finisher: {
      file: "./assets/certificates/women-5km-finisher.png",
      // Women finisher: name a bit smaller + slightly lower.
      name: { ...WOMEN_NAME_SLOT, yPct: 45.7 },
      reg: REG_SLOT,
      qr: QR_SLOT,
    },
    ranked: {
      "1": { file: "./assets/certificates/women-5km-rank-1.png", name: WOMEN_NAME_SLOT, reg: REG_SLOT, qr: QR_SLOT },
      // Rank 2/4/5: name a little up.
      "2": { file: "./assets/certificates/women-5km-rank-2.png", name: { ...WOMEN_NAME_SLOT, yPct: 44.5 }, reg: REG_SLOT, qr: QR_SLOT },
      "3": { file: "./assets/certificates/women-5km-rank-3.png", name: WOMEN_NAME_SLOT, reg: REG_SLOT, qr: QR_SLOT },
      "4": { file: "./assets/certificates/women-5km-rank-4.png", name: { ...WOMEN_NAME_SLOT, yPct: 44.5 }, reg: REG_SLOT, qr: QR_SLOT },
      "5": { file: "./assets/certificates/women-5km-rank-5.png", name: { ...WOMEN_NAME_SLOT, yPct: 44.5 }, reg: REG_SLOT, qr: QR_SLOT },
    },
  },
};

export function pickTemplate({ eventName, certificateStatus, rank }) {
  const key =
    eventName === "Men 10 KM" ? "men10" :
    eventName === "Women 5 KM" ? "women5" :
    "";
  if (!key) return null;

  const group = CERT_TEMPLATES[key];
  if (!group) return null;

  if (certificateStatus === "ranked") {
    const r = String(rank || "").trim();
    return (group.ranked && group.ranked[r]) || null;
  }
  return group.finisher || null;
}

