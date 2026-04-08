import { db, auth, serverTimestamp } from "../firebase.js";
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
const menPrizeInputs = [
  document.getElementById("menPrize1"),
  document.getElementById("menPrize2"),
  document.getElementById("menPrize3"),
  document.getElementById("menPrize4"),
  document.getElementById("menPrize5"),
];
const womenPrizeInputs = [
  document.getElementById("womenPrize1"),
  document.getElementById("womenPrize2"),
  document.getElementById("womenPrize3"),
  document.getElementById("womenPrize4"),
  document.getElementById("womenPrize5"),
];
const savePrizeConfigButton = document.getElementById("savePrizeConfig");
const prizeSaveMessage = document.getElementById("prizeSaveMessage");

let registrations = [];
let selectedIds = new Set();
let currentUser = null;
let isAdminUser = false;
let prizeConfig = null;

const EMAILJS_SERVICE_ID = "service_oelo1t3";
const EMAILJS_RANKED_TEMPLATE_ID = "template_hkgh7an";
const EMAILJS_PUBLIC_KEY = "VsrnVcsptNZyqUHKP";

if (window.emailjs) {
  window.emailjs.init(EMAILJS_PUBLIC_KEY);
}

function getPrizeAmount(eventName, rankValue) {
  const rank = Number(rankValue);
  if (!rank || rank < 1 || rank > 5) return "";
  const defaultMen = ["10000", "7000", "5000", "2000", "1000"];
  const defaultWomen = ["5000", "4000", "3000", "2000", "1000"];
  if (eventName === "Men 10 KM") {
    return (prizeConfig?.men?.[rank - 1] || defaultMen[rank - 1] || "").toString();
  }
  if (eventName === "Women 5 KM") {
    return (prizeConfig?.women?.[rank - 1] || defaultWomen[rank - 1] || "").toString();
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

function showLoginMessage(text, isError = false) {
  if (!loginMessage) return;
  loginMessage.textContent = text;
  loginMessage.classList.toggle("is-error", isError);
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

    if (reg.photoUrl) {
      const photoWrap = document.createElement("div");
      photoWrap.className = "file-item";
      const photoButton = document.createElement("button");
      photoButton.type = "button";
      photoButton.className = "thumb-button";
      photoButton.textContent = "View Photo";
      photoButton.addEventListener("click", () => openImageModal(reg.photoUrl));
      const photoLink = document.createElement("button");
      photoLink.type = "button";
      photoLink.className = "link-button";
      photoLink.textContent = "Download";
      photoLink.addEventListener("click", () => openSignedUrl(reg.photoUrl));
      photoWrap.appendChild(photoButton);
      photoWrap.appendChild(photoLink);
      fileList.appendChild(photoWrap);
    }

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

function setPrizeInputs(values, inputs) {
  if (!inputs.length) return;
  inputs.forEach((input, index) => {
    if (!input) return;
    const value = values && values[index] ? values[index] : "";
    input.value = value;
  });
}

async function loadPrizeConfig() {
  try {
    const configRef = doc(db, "settings", "prizes");
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      prizeConfig = snap.data();
    } else {
      prizeConfig = null;
    }
    setPrizeInputs(prizeConfig?.men, menPrizeInputs);
    setPrizeInputs(prizeConfig?.women, womenPrizeInputs);
  } catch (error) {
    console.error("Failed to load prize config", error);
  }
}

async function savePrizeConfig() {
  if (!savePrizeConfigButton) return;
  savePrizeConfigButton.disabled = true;
  savePrizeConfigButton.textContent = "Saving...";
  if (prizeSaveMessage) prizeSaveMessage.textContent = "";
  try {
    const men = menPrizeInputs.map((input) => (input && input.value ? String(input.value) : ""));
    const women = womenPrizeInputs.map((input) => (input && input.value ? String(input.value) : ""));
    await setDoc(doc(db, "settings", "prizes"), {
      men,
      women,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    prizeConfig = { men, women };
    if (prizeSaveMessage) prizeSaveMessage.textContent = "Prize settings saved.";
  } catch (error) {
    console.error("Prize save failed", error);
    if (prizeSaveMessage) prizeSaveMessage.textContent = "Could not save prizes.";
  } finally {
    savePrizeConfigButton.disabled = false;
    savePrizeConfigButton.textContent = "Save Prize Settings";
  }
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

if (savePrizeConfigButton) {
  savePrizeConfigButton.addEventListener("click", savePrizeConfig);
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
      showLoginMessage("Signed in. Waiting for admin approval.", false);
    } catch (error) {
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
    if (adminLogin) {
      adminLogin.hidden = true;
      adminLogin.style.display = "none";
    }
    if (adminContent) {
      adminContent.hidden = false;
      adminContent.style.display = "block";
    }
    showLoginMessage("", false);
    loadPrizeConfig();
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
