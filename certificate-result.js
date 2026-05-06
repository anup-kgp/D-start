import { db } from "./firebase.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderCertificateCanvas } from "./certificate-renderer.js";

const canvasEl = document.getElementById("certificateCanvas");
const message = document.getElementById("certificateMessage");
const downloadButton = document.getElementById("downloadCertificate");
let lastCanvas = null;

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

async function loadCertificate(certId) {
  showMessage("Loading certificate...", false);

  const certRef = doc(db, "certificates", certId);
  const snap = await getDoc(certRef);
  if (!snap.exists()) {
    showMessage("No registration found with those details.", true);
    return;
  }

  const data = snap.data();
  const status = data.certificateStatus || "pending";

  if (status === "pending") {
    showMessage("Your certificate is not available yet. Please check after admin updates.", true);
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
    }

    showMessage("Certificate ready. Click download below.");
  } catch (error) {
    console.error(error);
    showMessage("Template not found or not configured. Add your PNGs in assets/certificates and update certificate-template-config.js.", true);
  }
}

const params = new URLSearchParams(window.location.search);
const certId = String(params.get("cert") || "").trim();

if (certId) {
  loadCertificate(certId).catch((error) => {
    console.error(error);
    showMessage("Unable to load certificate. Please try again.", true);
  });
} else {
  showMessage("Missing details. Please search again.", true);
}

if (downloadButton) {
  downloadButton.addEventListener("click", () => {
    if (!lastCanvas) {
      showMessage("Certificate not ready yet.", true);
      return;
    }

    try {
      const safeName = String((new URLSearchParams(window.location.search)).get("cert") || "certificate")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "certificate";

      const url = lastCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      showMessage("Unable to download. Try a different browser.", true);
    }
  });
}
