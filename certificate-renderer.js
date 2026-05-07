import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { pickTemplate } from "./certificate-template-config.js";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getPublicBaseUrl() {
  const host = window.location.hostname;
  return host && host !== "localhost" && host !== "127.0.0.1"
    ? window.location.origin
    : "https://kdsac.in";
}

function fitTextToWidth(ctx, text, maxWidth, startSizePx, minSizePx) {
  let size = startSizePx;
  while (size > minSizePx) {
    const font = ctx.font.replace(/\d+(\.\d+)?px/, `${size}px`);
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return minSizePx;
}

function drawText(ctx, { text, x, y, maxWidth, fontSize, weight, color, family, align }) {
  ctx.save();
  ctx.textAlign = align === "left" ? "left" : "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color || "#0b2a4f";
  ctx.font = `${weight || 800} ${fontSize}px ${family || "Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial"}`;
  const finalSize = fitTextToWidth(ctx, text, maxWidth, fontSize, Math.max(14, Math.round(fontSize * 0.55)));
  ctx.font = `${weight || 800} ${finalSize}px ${family || "Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial"}`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export async function renderCertificateCanvas(certData, { certId } = {}) {
  const template = pickTemplate({
    eventName: certData.eventName || "",
    certificateStatus: certData.certificateStatus || "pending",
    rank: certData.rank || "",
  });

  if (!template?.file) {
    throw new Error("Certificate template not configured for this category/status.");
  }

  const baseImg = await loadImage(template.file);
  const width = baseImg.naturalWidth || baseImg.width;
  const height = baseImg.naturalHeight || baseImg.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Draw template
  ctx.drawImage(baseImg, 0, 0, width, height);

  // Name
  const nameText = String(certData.name || "").trim();
  if (nameText && template.name) {
    const fontSize = Math.round((template.name.sizePct / 100) * width);
    const x = (template.name.xPct / 100) * width;
    const y = (template.name.yPct / 100) * height;
    const maxWidth = (template.name.maxWidthPct / 100) * width;
    drawText(ctx, {
      text: nameText,
      x,
      y,
      maxWidth,
      fontSize,
      weight: template.name.weight,
      color: template.name.color,
      family: template.name.family,
      align: template.name.align,
    });
  }

  // Registration No (optional)
  const regText = certData.regNumber ? `Reg No: ${certData.regNumber}` : "";
  if (regText && template.reg) {
    const fontSize = Math.round((template.reg.sizePct / 100) * width);
    const x = (template.reg.xPct / 100) * width;
    const y = (template.reg.yPct / 100) * height;
    const maxWidth = (template.reg.maxWidthPct / 100) * width;
    drawText(ctx, {
      text: regText,
      x,
      y,
      maxWidth,
      fontSize,
      weight: template.reg.weight,
      color: template.reg.color,
      family: template.reg.family,
      align: template.reg.align,
    });
  }

  // QR → opens verify.html?cert={id} (unique per participant certificate doc)
  if (template.qr && certId) {
    const verifyUrl = `${getPublicBaseUrl()}/verify.html?cert=${encodeURIComponent(certId)}`;
    const qrSize = Math.round((template.qr.sizePct / 100) * width);
    const x = (template.qr.xPct / 100) * width;
    const y = (template.qr.yPct / 100) * height;

    const dataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: clamp(qrSize, 120, 520),
      errorCorrectionLevel: "M",
      color: { dark: "#0b1220", light: "#ffffff" },
    });
    const qrImg = await loadImage(dataUrl);

    const pad = Math.max(8, Math.round(qrSize * 0.06));
    const boxW = qrSize + pad * 2;
    const boxH = qrSize + pad * 2;
    const boxX = x - boxW / 2;
    const boxY = y - boxH / 2;
    const r = Math.min(18, Math.round(pad * 0.9));
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(11, 42, 79, 0.12)";
    ctx.lineWidth = Math.max(1, Math.round(width / 900));
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(boxX, boxY, boxW, boxH, r);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.drawImage(qrImg, x - qrSize / 2, y - qrSize / 2, qrSize, qrSize);
  }

  return canvas;
}

