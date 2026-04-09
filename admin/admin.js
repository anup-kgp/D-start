import { db, auth, serverTimestamp } from "../firebase.js";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const adminTable = document.getElementById("adminTable");
const tableBody = adminTable ? adminTable.querySelector("tbody") : null;
const adminSearch = document.getElementById("adminSearch");
const statusFilter = document.getElementById("statusFilter");
const genderFilter = document.getElementById("genderFilter");
const eventFilter = document.getElementById("eventFilter");
const refreshButton = document.getElementById("refreshButton");
const selectAllRows = document.getElementById("selectAllRows");
const bulkStatus = document.getElementById("bulkStatus");
const applyBulk = document.getElementById("applyBulk");
const adminLogin = document.getElementById("adminLogin");
const adminContent = document.getElementById("adminContent");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const loginMessage = document.getElementById("loginMessage");
const adminEmail = document.getElementById("adminEmail");
const statTotal = document.getElementById("statTotal");
const statPending = document.getElementById("statPending");
const statParticipant = document.getElementById("statParticipant");
const statRanked = document.getElementById("statRanked");
const statRevenue = document.getElementById("statRevenue");
const statMenRevenue = document.getElementById("statMenRevenue");
const statWomenRevenue = document.getElementById("statWomenRevenue");
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");
const imageModalBackdrop = document.getElementById("imageModalBackdrop");
const imageModalDownload = document.getElementById("imageModalDownload");
const cardModal = document.getElementById("cardModal");
const cardModalImg = document.getElementById("cardModalImg");
const cardModalClose = document.getElementById("cardModalClose");
const cardModalBackdrop = document.getElementById("cardModalBackdrop");
const cardDownloadPng = document.getElementById("cardDownloadPng");
const cardDownloadJpg = document.getElementById("cardDownloadJpg");
const cardModalMessage = document.getElementById("cardModalMessage");
const directAccessToggle = document.getElementById("directAccessToggle");
const generateDirectKey = document.getElementById("generateDirectKey");
const copyDirectLink = document.getElementById("copyDirectLink");
const directAccessMessage = document.getElementById("directAccessMessage");

let registrations = [];
let selectedIds = new Set();
let currentUser = null;
let isAdminUser = false;
let directAccessKey = "";
let lastCardCanvas = null;

const EMAILJS_SERVICE_ID = "service_oelo1t3";
const EMAILJS_RANKED_TEMPLATE_ID = "template_hkgh7an";
const EMAILJS_PUBLIC_KEY = "VsrnVcsptNZyqUHKP";

if (window.emailjs) {
  window.emailjs.init(EMAILJS_PUBLIC_KEY);
}

const CLOUDINARY_CLOUD_NAME = "dpyslavgz";
const CLOUDINARY_UPLOAD_PRESET = "x2uxplk3";
const CLOUDINARY_FOLDER = "kdsac-registrations";

function getPrizeAmount(eventName, rankValue) {
  const rank = Number(rankValue);
  if (!rank || rank < 1 || rank > 5) return "";
  if (eventName === "Men 10 KM") {
    return ["10000", "7000", "5000", "2000", "1000"][rank - 1];
  }
  if (eventName === "Women 5 KM") {
    return ["5000", "4000", "3000", "2000", "1000"][rank - 1];
  }
  return "";
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

function normalizeValue(value) {
  return String(value || "").toLowerCase();
}

function getPublicBaseUrl() {
  const host = window.location.hostname;
  return host && host !== "localhost" && host !== "127.0.0.1"
    ? window.location.origin
    : "https://kdsac.in";
}

function setCardMessage(text) {
  if (cardModalMessage) {
    cardModalMessage.textContent = text || "";
  }
}

function sanitizeFilename(value) {
  return String(value || "participant-card")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "participant-card";
}

function loadImage(url, { crossOrigin } = {}) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("Missing image url"));
      return;
    }
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function uploadFileToCloudinary(file) {
  if (!file || !file.name) return null;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const result = await response.json();
  return result.secure_url || result.url || null;
}

function pickFile({ accept } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept || "*/*";
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
}

async function buildParticipantCardCanvas(reg, { verifyUrl } = {}) {
  // 1080x675 shareable landscape ID card
  const width = 1080;
  const height = 675;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const EVENT_NAME = "Kharagpur Mini Marathon 2026";
  const CLUB_NAME = "Kharagpur D Star Athletic Club (KDSAC)";
  const WEBSITE = "kdsac.in";
  const VENUE = "Kharagpur Sersa Stadium";
  const EVENT_DATE = "10 May 2026";
  const VERIFY_TEXT = "Verify at kdsac.in/verify.html";

  // Background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#070b16");
  bg.addColorStop(0.5, "#0b1630");
  bg.addColorStop(1, "#0d1a33");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Accent glow
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ff6a00";
  ctx.beginPath();
  ctx.ellipse(200, 60, 260, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffb100";
  ctx.beginPath();
  ctx.ellipse(920, 620, 320, 180, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Card shell
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRectPath(ctx, 36, 40, width - 72, height - 80, 34);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, 36, 40, width - 72, height - 80, 34);
  ctx.stroke();

  // Top accent ribbon
  const accent = ctx.createLinearGradient(0, 0, width, 0);
  accent.addColorStop(0, "#ff6a00");
  accent.addColorStop(1, "#ffb100");
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.98;
  roundRectPath(ctx, 60, 64, width - 120, 14, 8);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Header: event + club
  try {
    const logo = await loadImage("../assets/logo.png");
    const logoSize = 74;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, 74, 98, logoSize, logoSize);
    ctx.restore();
  } catch {
    // ignore logo if it can't load
  }

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 36px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(EVENT_NAME, 160, 130);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "700 18px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(CLUB_NAME, 160, 160);

  ctx.fillStyle = "rgba(255,255,255,0.56)";
  ctx.font = "600 16px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`Official website: ${WEBSITE}`, 160, 186);

  // Official entry badge
  ctx.fillStyle = "rgba(255,106,0,0.18)";
  roundRectPath(ctx, width - 320, 108, 240, 44, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,106,0,0.36)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, width - 320, 108, 240, 44, 22);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "900 16px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("OFFICIAL ENTRY", width - 290, 136);

  // Body layout
  const photoX = 80;
  const photoY = 230;
  const photoW = 310;
  const photoH = 380;
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  roundRectPath(ctx, photoX, photoY, photoW, photoH, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, photoX, photoY, photoW, photoH, 24);
  ctx.stroke();

  if (reg?.photoUrl) {
    const img = await loadImage(reg.photoUrl, { crossOrigin: "anonymous" });
    // cover crop
    const scale = Math.max(photoW / img.width, photoH / img.height);
    const sw = photoW / scale;
    const sh = photoH / scale;
    const sx = Math.max(0, (img.width - sw) / 2);
    const sy = Math.max(0, (img.height - sh) / 2);

    ctx.save();
    roundRectPath(ctx, photoX, photoY, photoW, photoH, 24);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "700 18px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("PHOTO NOT AVAILABLE", photoX + 44, photoY + 205);
  }

  // Right: info
  const infoX = 430;
  const infoY = 250;
  const rowGap = 62;

  function labelValueRow(label, value, index) {
    const y = infoY + index * rowGap;
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "700 14px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(label.toUpperCase(), infoX, y);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 26px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const text = String(value || "-");
    ctx.fillText(text, infoX, y + 32);
  }

  labelValueRow("Participant name", reg?.name || "-", 0);
  labelValueRow("Registration no", reg?.regNumber || "-", 1);
  labelValueRow("Category", reg?.eventName || "-", 2);
  labelValueRow("Venue", VENUE, 3);

  // QR (verify link)
  const qrSize = 176;
  const qrX = width - 260;
  const qrY = height - 250;
  const qrBgX = qrX - 18;
  const qrBgY = qrY - 18;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRectPath(ctx, qrBgX, qrBgY, qrSize + 36, qrSize + 56, 22);
  ctx.fill();

  if (verifyUrl) {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: qrSize,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0b1220",
        light: "#ffffff",
      },
    });
    const qrImg = await loadImage(qrDataUrl);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  ctx.fillStyle = "rgba(11,18,32,0.9)";
  ctx.font = "800 14px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Scan to open verify page", qrBgX + 20, qrBgY + qrSize + 32);

  ctx.fillStyle = "rgba(11,18,32,0.72)";
  ctx.font = "700 12px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(VERIFY_TEXT, qrBgX + 20, qrBgY + qrSize + 50);

  // Footer line
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.font = "700 16px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`Event date: ${EVENT_DATE}  •  Venue: ${VENUE}`, 74, height - 62);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "600 14px Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${WEBSITE}  •  ${EVENT_NAME}`, 74, height - 38);

  return canvas;
}

function openCardModalWithCanvas(canvas, reg) {
  if (!cardModal || !cardModalImg || !cardDownloadPng || !cardDownloadJpg) return;
  lastCardCanvas = canvas;
  const safeName = sanitizeFilename(reg?.name || "participant");
  const regNo = sanitizeFilename(reg?.regNumber || "reg");
  const base = `${safeName}-${regNo}-card`;

  try {
    const pngUrl = canvas.toDataURL("image/png");
    cardModalImg.src = pngUrl;
    cardDownloadPng.href = pngUrl;
    cardDownloadPng.download = `${base}.png`;
  } catch (error) {
    console.error(error);
    setCardMessage("Unable to generate PNG preview. Check image permissions/CORS.");
  }

  // JPG generated lazily on open (keeps both ready)
  try {
    const jpgUrl = canvas.toDataURL("image/jpeg", 0.92);
    cardDownloadJpg.href = jpgUrl;
    cardDownloadJpg.download = `${base}.jpg`;
  } catch (error) {
    console.error(error);
  }

  setCardMessage("");
  cardModal.hidden = false;
}

function closeCardModal() {
  if (!cardModal || !cardModalImg) return;
  cardModal.hidden = true;
  cardModalImg.removeAttribute("src");
  setCardMessage("");
  lastCardCanvas = null;
}

function showLoginMessage(text, isError = false) {
  if (!loginMessage) return;
  loginMessage.textContent = text;
  loginMessage.classList.toggle("is-error", isError);
}

function getAuthErrorCode(error) {
  return typeof error?.code === "string" ? error.code : "";
}

async function completeRedirectIfNeeded() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await ensureAdminRequest(result.user);
      showLoginMessage("Signed in. Checking admin access...", false);
    }
  } catch (error) {
    console.error(error);
    showLoginMessage("Sign-in failed. Please try again.", true);
  }
}

completeRedirectIfNeeded();

async function hashDirectKey(value) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function setDirectMessage(text) {
  if (directAccessMessage) {
    directAccessMessage.textContent = text;
  }
}

async function loadDirectAccess() {
  try {
    const snap = await getDoc(doc(db, "settings", "directAccess"));
    if (snap.exists()) {
      const data = snap.data();
      if (directAccessToggle) directAccessToggle.checked = data.enabled === true;
    }
  } catch (error) {
    console.error("Direct access load failed", error);
  }
}

async function saveDirectAccessConfig({ enabled, key }) {
  const payload = { enabled: !!enabled, updatedAt: serverTimestamp() };
  if (key) {
    payload.keyHash = await hashDirectKey(key);
  }
  await setDoc(doc(db, "settings", "directAccess"), payload, { merge: true });
}

function buildDirectLink() {
  if (!directAccessKey) return "";
  const host = window.location.hostname;
  const base = host && host !== "localhost" && host !== "127.0.0.1"
    ? window.location.origin
    : "https://kdsac.in";
  return `${base}/register.html?direct=1&key=${encodeURIComponent(directAccessKey)}`;
}

if (directAccessToggle) {
  directAccessToggle.addEventListener("change", async () => {
    try {
      await saveDirectAccessConfig({ enabled: directAccessToggle.checked });
      setDirectMessage(directAccessToggle.checked ? "Direct link enabled." : "Direct link disabled.");
    } catch (error) {
      console.error(error);
      setDirectMessage("Unable to update direct link.");
    }
  });
}

if (generateDirectKey) {
  generateDirectKey.addEventListener("click", async () => {
    directAccessKey = `KDSAC-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    try {
      await saveDirectAccessConfig({ enabled: directAccessToggle ? directAccessToggle.checked : true, key: directAccessKey });
      setDirectMessage("New key generated.");
    } catch (error) {
      console.error(error);
      setDirectMessage("Could not generate key.");
    }
  });
}

if (copyDirectLink) {
  copyDirectLink.addEventListener("click", async () => {
    const link = buildDirectLink();
    if (!link) {
      setDirectMessage("Generate a key first.");
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const temp = document.createElement("textarea");
        temp.value = link;
        temp.style.position = "fixed";
        temp.style.left = "-9999px";
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      setDirectMessage("Direct link copied.");
    } catch (error) {
      console.error(error);
      setDirectMessage(link);
    }
  });
}
async function hashCertificateId(nameLower, dob) {
  const input = `${nameLower}|${dob}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function categoryLabel(eventName, gender) {
  if (eventName === "Men 10 KM") return "10 KM – Men Category";
  if (eventName === "Women 5 KM") return "5 KM – Women Category";
  return `${eventName || ""} ${gender ? `– ${gender}` : ""}`.trim();
}

function renderTable(list) {
  if (!tableBody) return;
  tableBody.innerHTML = "";

  if (!list.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 13;
    cell.textContent = "No registrations found.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  list.forEach((reg) => {
    const row = document.createElement("tr");

    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.id = reg.id;
    checkbox.checked = selectedIds.has(reg.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedIds.add(reg.id);
      } else {
        selectedIds.delete(reg.id);
      }
      if (selectAllRows) {
        selectAllRows.checked = selectedIds.size === list.length;
      }
    });
    selectCell.appendChild(checkbox);

    const regCell = document.createElement("td");
    regCell.textContent = reg.regNumber || "-";

    const nameCell = document.createElement("td");
    nameCell.textContent = reg.name || "-";

    const dobCell = document.createElement("td");
    dobCell.textContent = reg.dob || "-";

    const genderCell = document.createElement("td");
    genderCell.textContent = reg.gender || "-";

    const eventCell = document.createElement("td");
    eventCell.textContent = reg.eventName || "-";

    const phoneCell = document.createElement("td");
    phoneCell.textContent = reg.phone || "-";

    const emailCell = document.createElement("td");
    emailCell.textContent = reg.email || "-";

    const feeCell = document.createElement("td");
    feeCell.textContent = reg.fee ? `₹${reg.fee}` : "-";

    const fileCell = document.createElement("td");
    const fileList = document.createElement("div");
    fileList.className = "file-links";

    // Files & Card actions (simple, admin-friendly)
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "file-item";

    const viewPhoto = document.createElement("button");
    viewPhoto.type = "button";
    viewPhoto.className = "thumb-button";
    viewPhoto.textContent = "View Photo";
    viewPhoto.disabled = !reg.photoUrl;
    viewPhoto.addEventListener("click", () => {
      if (reg.photoUrl) openImageModal(reg.photoUrl);
    });
    actionsWrap.appendChild(viewPhoto);

    const cardButton = document.createElement("button");
    cardButton.type = "button";
    cardButton.className = "link-button";
    cardButton.textContent = "View Card";
    cardButton.addEventListener("click", async () => {
      cardButton.disabled = true;
      const oldText = cardButton.textContent;
      cardButton.textContent = "Generating...";
      try {
        const base = getPublicBaseUrl();
        // Do not embed participant-specific data in QR/link.
        const verifyUrl = `${base}/verify.html`;
        const canvas = await buildParticipantCardCanvas(reg, { verifyUrl });
        openCardModalWithCanvas(canvas, reg);
      } catch (error) {
        console.error(error);
        setCardMessage("Could not generate card. Please try again.");
        if (cardModal) cardModal.hidden = false;
      } finally {
        cardButton.disabled = false;
        cardButton.textContent = oldText;
      }
    });
    actionsWrap.appendChild(cardButton);

    const viewGovtId = document.createElement("button");
    viewGovtId.type = "button";
    viewGovtId.className = "thumb-button";
    viewGovtId.textContent = "View Govt ID";
    viewGovtId.disabled = !reg.govtIdUrl;
    viewGovtId.addEventListener("click", () => {
      if (!reg.govtIdUrl) return;
      const isPdf = (reg.govtIdUrl || "").toLowerCase().includes(".pdf");
      if (isPdf) {
        openSignedUrl(reg.govtIdUrl);
      } else {
        openImageModal(reg.govtIdUrl);
      }
    });
    actionsWrap.appendChild(viewGovtId);

    fileList.appendChild(actionsWrap);

    if (reg.govtIdUrl) {
      const idWrap = document.createElement("div");
      idWrap.className = "file-item";
      const isPdf = (reg.govtIdUrl || "").toLowerCase().includes(".pdf");
      if (!isPdf) {
        const idButton = document.createElement("button");
        idButton.type = "button";
        idButton.className = "thumb-button";
        idButton.textContent = "View ID";
        idButton.addEventListener("click", () => openImageModal(reg.govtIdUrl));
        idWrap.appendChild(idButton);
      }
      const idLink = document.createElement("button");
      idLink.type = "button";
      idLink.className = "link-button";
      idLink.textContent = isPdf ? "Govt ID (PDF)" : "Govt ID";
      idLink.addEventListener("click", () => openSignedUrl(reg.govtIdUrl));
      idWrap.appendChild(idLink);
      fileList.appendChild(idWrap);
    }

    if (!reg.photoUrl && !reg.govtIdUrl) {
      fileList.textContent = "-";
    }

    fileCell.appendChild(fileList);

    const statusCell = document.createElement("td");
    statusCell.classList.add("status-cell");
    const statusSelect = document.createElement("select");
    statusSelect.className = "input-field";
    ["pending", "participant", "ranked"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      if ((reg.certificateStatus || "pending") === status) {
        option.selected = true;
      }
      statusSelect.appendChild(option);
    });
    statusCell.appendChild(statusSelect);

    const rankCell = document.createElement("td");
    rankCell.classList.add("rank-cell");
    const rankInput = document.createElement("input");
    rankInput.type = "number";
    rankInput.min = "1";
    rankInput.max = "5";
    rankInput.placeholder = "Rank";
    rankInput.className = "input-field";
    rankInput.value = reg.rank || "";
    rankCell.appendChild(rankInput);

    const actionCell = document.createElement("td");
    actionCell.classList.add("action-cell");
    const saveButton = document.createElement("button");
    saveButton.className = "button button-primary button-small";
    saveButton.type = "button";
    saveButton.textContent = "Save";

    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
      try {
        const newStatus = statusSelect.value;
        const rankValue = newStatus === "ranked" ? String(rankInput.value || "").trim() : "";
        await updateDoc(doc(db, "registrations", reg.id), {
          certificateStatus: newStatus,
          rank: rankValue,
        });

        const certId = await hashCertificateId(reg.nameLower || normalizeValue(reg.name), reg.dob || "");
        await setDoc(doc(db, "certificates", certId), {
          name: reg.name || "",
          nameLower: reg.nameLower || normalizeValue(reg.name),
          eventName: reg.eventName || "",
          category: categoryLabel(reg.eventName, reg.gender),
          regNumber: reg.regNumber || "",
          certificateStatus: newStatus,
          rank: rankValue,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        if (newStatus === "ranked" && reg.email && rankValue && reg.certificateStatus !== "ranked") {
          const certificateLink = `${window.location.origin}/certificate.html`;
          const prizeValue = getPrizeAmount(reg.eventName, rankValue);
          try {
            if (window.emailjs) {
              await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_RANKED_TEMPLATE_ID, {
                name: reg.name || "",
                rank: rankValue || "Ranked",
                category: reg.eventName || "",
                prize: prizeValue,
                certificate_link: certificateLink,
                email: reg.email,
              });
            }
          } catch (mailError) {
            console.error("Ranked email failed", mailError);
          }
        }

        reg.certificateStatus = newStatus;
        reg.rank = rankValue;
        saveButton.textContent = "Saved";
      } catch (error) {
        console.error(error);
        saveButton.textContent = "Error";
      } finally {
        setTimeout(() => {
          saveButton.disabled = false;
          saveButton.textContent = "Save";
        }, 1000);
      }
    });

    actionCell.appendChild(saveButton);

    selectCell.dataset.label = "Select";
    regCell.dataset.label = "Reg No";
    nameCell.dataset.label = "Name";
    dobCell.dataset.label = "DOB";
    genderCell.dataset.label = "Gender";
    eventCell.dataset.label = "Event";
    phoneCell.dataset.label = "Phone";
    emailCell.dataset.label = "Email";
    feeCell.dataset.label = "Fee";
    fileCell.dataset.label = "Files";
    statusCell.dataset.label = "Certificate";
    rankCell.dataset.label = "Rank";
    actionCell.dataset.label = "Action";

    row.appendChild(selectCell);
    row.appendChild(regCell);
    row.appendChild(nameCell);
    row.appendChild(dobCell);
    row.appendChild(genderCell);
    row.appendChild(eventCell);
    row.appendChild(phoneCell);
    row.appendChild(emailCell);
    row.appendChild(feeCell);
    row.appendChild(fileCell);
    row.appendChild(statusCell);
    row.appendChild(rankCell);
    row.appendChild(actionCell);

    tableBody.appendChild(row);
  });
}

function openImageModal(url) {
  if (!imageModal || !imageModalImg || !imageModalDownload) return;
  if (!url) return;
  imageModalImg.src = url;
  imageModalDownload.href = url;
  imageModal.hidden = false;
}

function openSignedUrl(url) {
  if (url) {
    window.open(url, "_blank", "noopener");
  }
}

function closeImageModal() {
  if (!imageModal || !imageModalImg) return;
  imageModal.hidden = true;
  imageModalImg.removeAttribute("src");
}

if (imageModalClose) {
  imageModalClose.addEventListener("click", closeImageModal);
}

if (imageModalBackdrop) {
  imageModalBackdrop.addEventListener("click", closeImageModal);
}

if (cardModalClose) {
  cardModalClose.addEventListener("click", closeCardModal);
}

if (cardModalBackdrop) {
  cardModalBackdrop.addEventListener("click", closeCardModal);
}

function applyFilters() {
  const searchValue = normalizeValue(adminSearch ? adminSearch.value : "");
  const statusValue = statusFilter ? statusFilter.value : "all";
  const genderValue = genderFilter ? genderFilter.value : "all";
  const eventValue = eventFilter ? eventFilter.value : "all";

  const filtered = registrations.filter((reg) => {
    const matchesSearch = !searchValue
      || normalizeValue(reg.name).includes(searchValue)
      || normalizeValue(reg.phone).includes(searchValue)
      || normalizeValue(reg.email).includes(searchValue);
    const currentStatus = reg.certificateStatus || "pending";
    const matchesStatus = statusValue === "all" || currentStatus === statusValue;
    const matchesGender = genderValue === "all" || reg.gender === genderValue;
    const matchesEvent = eventValue === "all" || reg.eventName === eventValue;
    return matchesSearch && matchesStatus && matchesGender && matchesEvent;
  });

  renderTable(filtered);
}

function updateStats() {
  if (!statTotal) return;
  const total = registrations.length;
  const pending = registrations.filter((reg) => (reg.certificateStatus || "pending") === "pending").length;
  const participant = registrations.filter((reg) => reg.certificateStatus === "participant").length;
  const ranked = registrations.filter((reg) => reg.certificateStatus === "ranked").length;
  const totalRevenue = registrations.reduce((sum, reg) => sum + (Number(reg.fee) || 0), 0);
  const menRevenue = registrations
    .filter((reg) => reg.gender === "Male")
    .reduce((sum, reg) => sum + (Number(reg.fee) || 0), 0);
  const womenRevenue = registrations
    .filter((reg) => reg.gender === "Female")
    .reduce((sum, reg) => sum + (Number(reg.fee) || 0), 0);
  statTotal.textContent = total;
  if (statPending) statPending.textContent = pending;
  if (statParticipant) statParticipant.textContent = participant;
  if (statRanked) statRanked.textContent = ranked;
  if (statRevenue) statRevenue.textContent = `₹${totalRevenue}`;
  if (statMenRevenue) statMenRevenue.textContent = `₹${menRevenue}`;
  if (statWomenRevenue) statWomenRevenue.textContent = `₹${womenRevenue}`;
}

async function loadRegistrations() {
  if (!tableBody) return;
  tableBody.innerHTML = "<tr><td colspan=\"13\">Loading registrations...</td></tr>";
  try {
    const registrationsRef = collection(db, "registrations");
    const registrationsQuery = query(registrationsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(registrationsQuery);
    registrations = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    selectedIds = new Set();
    if (selectAllRows) selectAllRows.checked = false;
    updateStats();
    applyFilters();
  } catch (error) {
    console.error(error);
    tableBody.innerHTML = "<tr><td colspan=\"13\">Failed to load registrations.</td></tr>";
  }
}

if (adminSearch) {
  adminSearch.addEventListener("input", applyFilters);
}

if (statusFilter) {
  statusFilter.addEventListener("change", applyFilters);
}

if (genderFilter) {
  genderFilter.addEventListener("change", applyFilters);
}

if (eventFilter) {
  eventFilter.addEventListener("change", applyFilters);
}

if (refreshButton) {
  refreshButton.addEventListener("click", loadRegistrations);
}

if (selectAllRows) {
  selectAllRows.addEventListener("change", () => {
    const visibleChecks = tableBody ? tableBody.querySelectorAll("input[type=\"checkbox\"][data-id]") : [];
    selectedIds.clear();
    visibleChecks.forEach((checkbox) => {
      checkbox.checked = selectAllRows.checked;
      if (selectAllRows.checked) {
        selectedIds.add(checkbox.dataset.id);
      }
    });
  });
}

if (applyBulk) {
  applyBulk.addEventListener("click", async () => {
    const newStatus = bulkStatus ? bulkStatus.value : "";
    if (!newStatus) return;
    if (!selectedIds.size) return;
    applyBulk.disabled = true;
    applyBulk.textContent = "Applying...";
    try {
      const updates = Array.from(selectedIds).map(async (id) => {
        const reg = registrations.find((item) => item.id === id);
        if (!reg) return;
        const rankValue = newStatus === "ranked" ? "" : "";
        await updateDoc(doc(db, "registrations", id), {
          certificateStatus: newStatus,
          rank: rankValue,
        });
        const certId = await hashCertificateId(reg.nameLower || normalizeValue(reg.name), reg.dob || "");
        await setDoc(doc(db, "certificates", certId), {
          name: reg.name || "",
          nameLower: reg.nameLower || normalizeValue(reg.name),
          eventName: reg.eventName || "",
          category: categoryLabel(reg.eventName, reg.gender),
          regNumber: reg.regNumber || "",
          certificateStatus: newStatus,
          rank: rankValue,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        if (newStatus === "ranked" && reg.email && rankValue) {
          const certificateLink = `${window.location.origin}/certificate.html`;
          try {
            const prizeValue = getPrizeAmount(reg.eventName, rankValue);
            if (window.emailjs) {
              await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_RANKED_TEMPLATE_ID, {
                name: reg.name || "",
                rank: rankValue || "Ranked",
                category: reg.eventName || "",
                prize: prizeValue,
                certificate_link: certificateLink,
                email: reg.email,
              });
            }
          } catch (mailError) {
            console.error("Ranked email failed", mailError);
          }
        }
      });
      await Promise.all(updates);
      await loadRegistrations();
    } catch (error) {
      console.error(error);
    } finally {
      applyBulk.disabled = false;
      applyBulk.textContent = "Apply";
    }
  });
}

async function ensureAdminRequest(user) {
  if (!user) return;
  const requestRef = doc(db, "admin_requests", user.uid);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) {
    await setDoc(requestRef, {
      uid: user.uid,
      email: user.email || "",
      name: user.displayName || "",
      createdAt: serverTimestamp(),
    });
  }
}

async function checkAdmin(user) {
  if (!user) return false;
  const adminRef = doc(db, "admins", user.uid);
  const snap = await getDoc(adminRef);
  return snap.exists() && snap.data().isAdmin === true;
}

if (loginButton) {
  loginButton.addEventListener("click", async () => {
    showLoginMessage("Signing in...", false);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await ensureAdminRequest(result.user);
      showLoginMessage("Signed in. Checking admin access...", false);
    } catch (error) {
      const code = getAuthErrorCode(error);
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        try {
          showLoginMessage("Opening Google sign-in...", false);
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (redirectError) {
          console.error(redirectError);
        }
      }
      console.error(error);
      showLoginMessage("Unable to sign in. Please try again.", true);
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    isAdminUser = false;
    if (adminContent) {
      adminContent.hidden = true;
      adminContent.style.display = "none";
    }
    if (adminLogin) {
      adminLogin.hidden = false;
      adminLogin.style.display = "grid";
    }
    showLoginMessage("Sign in to continue.", false);
    return;
  }

  if (adminEmail) adminEmail.textContent = user.email || "Signed in";
  await ensureAdminRequest(user);
  isAdminUser = await checkAdmin(user);

  if (isAdminUser) {
    loadDirectAccess();
    if (adminLogin) {
      adminLogin.hidden = true;
      adminLogin.style.display = "none";
    }
    if (adminContent) {
      adminContent.hidden = false;
      adminContent.style.display = "block";
    }
    showLoginMessage("", false);
    loadRegistrations();
  } else {
    if (adminContent) {
      adminContent.hidden = true;
      adminContent.style.display = "none";
    }
    if (adminLogin) {
      adminLogin.hidden = false;
      adminLogin.style.display = "grid";
    }
    showLoginMessage("Your account is not approved yet. Ask the admin to enable access.", true);
  }
});
