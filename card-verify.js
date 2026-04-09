import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const message = document.getElementById("cardVerifyMessage");
const result = document.getElementById("cardVerifyResult");
const titleField = document.getElementById("cardVerifyTitle");
const nameField = document.getElementById("cardVerifyName");
const metaField = document.getElementById("cardVerifyMeta");
const regField = document.getElementById("cardVerifyReg");
const statusField = document.getElementById("cardVerifyStatus");

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function showResult(data) {
  if (titleField) titleField.textContent = "Participant Card";
  if (nameField) nameField.textContent = data?.name || "-";
  if (metaField) metaField.textContent = data?.eventName || "-";
  if (regField) {
    const regNo = data?.regNumber || "-";
    regField.textContent = `Registration No: ${regNo}`;
  }
  if (statusField) statusField.textContent = "Valid";
  if (result) result.hidden = false;
}

async function verifyCardToken(token) {
  if (result) result.hidden = true;
  showMessage("Verifying…", false);

  const snap = await getDoc(doc(db, "participant_cards", token));
  if (!snap.exists()) {
    showMessage("Invalid or expired participant card.", true);
    return;
  }

  const data = snap.data() || {};
  showResult(data);
  showMessage("Participant card verified.");
}

const params = new URLSearchParams(window.location.search);
const token = params.get("card");
if (!token) {
  showMessage("Scan a participant card QR code to verify.", false);
} else {
  verifyCardToken(String(token).trim()).catch((error) => {
    console.error(error);
    showMessage("Unable to verify right now. Please try again.", true);
  });
}

