import { db } from "./firebase.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderCertificateCanvas } from "./certificate-renderer.js";

const message = document.getElementById("verifyMessage");
const idleMessage = document.getElementById("verifyMessageIdle");
const result = document.getElementById("verifyResult");
const canvasEl = document.getElementById("verifyCanvas");
let lastCanvas = null;

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function resetResult() {
  if (result) result.hidden = true;
  lastCanvas = null;
}

async function fetchByCert(certId) {
  const certRef = doc(db, "certificates", certId);
  const snap = await getDoc(certRef);
  return snap.exists() ? snap.data() : null;
}

function downloadCanvasPng(canvas, filenameBase = "certificate") {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function handleVerify(certId) {
  resetResult();
  showMessage("Verifying...", false);

  const data = await fetchByCert(certId);
  if (!data) {
    showMessage("No certificate found.", true);
    return;
  }

  const status = data.certificateStatus || "pending";
  if (status === "pending") {
    showMessage("Certificate is not issued yet (Pending).", true);
    return;
  }

  try {
    const rendered = await renderCertificateCanvas(
      {
        name: data.name || "",
        eventName: data.eventName || "",
        certificateStatus: status,
        rank: data.rank || "",
        regNumber: data.regNumber || "",
      },
      { certId }
    );

    lastCanvas = rendered;
    if (canvasEl) {
      canvasEl.width = rendered.width;
      canvasEl.height = rendered.height;
      const ctx = canvasEl.getContext("2d");
      ctx?.drawImage(rendered, 0, 0);

      const safeBase = String(data.regNumber || certId || "certificate")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "certificate";

      canvasEl.onclick = () => {
        if (!lastCanvas) return;
        try {
          downloadCanvasPng(lastCanvas, safeBase);
        } catch (error) {
          console.error(error);
          showMessage("Unable to download. Try a different browser.", true);
        }
      };
    }

    if (result) result.hidden = false;
    if (idleMessage) idleMessage.hidden = true;
    showMessage("Certificate verified. Preview loaded.");
  } catch (error) {
    console.error(error);
    showMessage("Verified, but preview could not be generated (template/config missing).", true);
  }
}

const params = new URLSearchParams(window.location.search);
const certParam = params.get("cert");
if (certParam) {
  handleVerify(certParam).catch((error) => {
    console.error(error);
  });
} else {
  if (idleMessage) idleMessage.hidden = false;
  showMessage("", false);
}
