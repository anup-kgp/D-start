import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const message = document.getElementById("cardVerifyMessage");
const result = document.getElementById("cardVerifyResult");
const titleField = document.getElementById("cardVerifyTitle");
const nameField = document.getElementById("cardVerifyName");
const metaField = document.getElementById("cardVerifyMeta");
const regField = document.getElementById("cardVerifyReg");
const statusField = document.getElementById("cardVerifyStatus");
const detailsModal = document.getElementById("cardDetailsModal");
const detailsBackdrop = document.getElementById("cardDetailsBackdrop");
const detailsClose = document.getElementById("cardDetailsClose");
const detailsPhoto = document.getElementById("cardDetailsPhoto");
const detailsTitle = document.getElementById("cardDetailsTitle");
const detailsList = document.getElementById("cardDetailsList");

let currentCardData = null;

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function formatDateTime(value) {
  if (!value) return "-";
  // Firestore Timestamp: { seconds, nanoseconds }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return date.toLocaleString();
  }
  return String(value);
}

function computeAge(dob) {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age > 0 ? String(age) : "";
}

function renderDetailsItem(label, value) {
  if (!detailsList) return;
  const item = document.createElement("div");
  item.className = "card-details-item";
  const k = document.createElement("span");
  k.textContent = label;
  const v = document.createElement("strong");
  v.textContent = value ? String(value) : "-";
  item.appendChild(k);
  item.appendChild(v);
  detailsList.appendChild(item);
}

function openDetailsModal(data) {
  currentCardData = data || null;
  if (!detailsModal || !detailsList) return;
  detailsList.innerHTML = "";

  if (detailsTitle) detailsTitle.textContent = "Participant Details";
  if (detailsPhoto) {
    if (data?.photoUrl) {
      detailsPhoto.src = data.photoUrl;
      detailsPhoto.hidden = false;
    } else {
      detailsPhoto.removeAttribute("src");
      detailsPhoto.hidden = true;
    }
  }

  const age = computeAge(data?.dob);
  renderDetailsItem("Name", data?.name);
  renderDetailsItem("Registration No", data?.regNumber);
  renderDetailsItem("Event", data?.eventName);
  renderDetailsItem("Gender", data?.gender);
  renderDetailsItem("Date of Birth", data?.dob);
  renderDetailsItem("Age", age);
  renderDetailsItem("Phone", data?.phone);
  renderDetailsItem("Email", data?.email);
  renderDetailsItem("Father Name", data?.fatherName);
  renderDetailsItem("T-Shirt Size", data?.tshirtSize);
  renderDetailsItem("Medical Fitness", data?.medicalCondition);
  renderDetailsItem("Fee", data?.fee ? `₹${data.fee}` : "");
  renderDetailsItem("Payment Status", data?.paymentStatus);
  renderDetailsItem("Payment Method", data?.paymentMethod);
  renderDetailsItem("Payment Id", data?.paymentId);
  renderDetailsItem("Order Id", data?.paymentOrderId);
  renderDetailsItem("Submitted At", formatDateTime(data?.createdAt));
  renderDetailsItem("Verified At", formatDateTime(data?.paymentVerifiedAt));

  detailsModal.hidden = false;
}

function closeDetailsModal() {
  if (!detailsModal) return;
  detailsModal.hidden = true;
  if (detailsPhoto) detailsPhoto.removeAttribute("src");
  if (detailsList) detailsList.innerHTML = "";
  currentCardData = null;
}

if (detailsClose) detailsClose.addEventListener("click", closeDetailsModal);
if (detailsBackdrop) detailsBackdrop.addEventListener("click", closeDetailsModal);

function showResult(data) {
  if (titleField) titleField.textContent = "Participant Card";
  if (nameField) nameField.textContent = data?.name || "-";
  if (metaField) metaField.textContent = data?.eventName || "-";
  if (regField) {
    const regNo = data?.regNumber || "-";
    regField.textContent = `Registration No: ${regNo}`;
    regField.disabled = !data;
    regField.onclick = () => openDetailsModal(data);
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

