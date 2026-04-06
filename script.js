import { db, functions, serverTimestamp } from "./firebase.js";
import {
  collection,
  runTransaction,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const form = document.getElementById("registrationForm");
const formResult = document.getElementById("formResult");
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const eventSelectionGrid = document.getElementById("eventSelectionGrid");
const eventNameInput = document.getElementById("eventName");
const eventDisplay = document.getElementById("eventDisplay");
const selectedEventLabel = document.getElementById("selectedEventLabel");
const successCard = document.getElementById("successCard");
const genderSelect = document.getElementById("genderSelect");
const submitButton = form ? form.querySelector("button[type=\"submit\"]") : null;

const EMAILJS_SERVICE_ID = "service_oelo1t3";
const EMAILJS_TEMPLATE_ID = "template_t3lut81";
const EMAILJS_PUBLIC_KEY = "VsrnVcsptNZyqUHKP";

if (window.emailjs) {
  window.emailjs.init(EMAILJS_PUBLIC_KEY);
}

const CLOUDINARY_FOLDER = "kdsac-registrations";
const getCloudinarySignature = httpsCallable(functions, "getCloudinarySignature");

async function uploadFile(file) {
  if (!file || !file.name) return null;
  const signatureResult = await getCloudinarySignature({ folder: CLOUDINARY_FOLDER });
  const { cloudName, apiKey, timestamp, signature, folder, type } = signatureResult.data;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("type", type);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Cloudinary upload failed");
  }

  const result = await response.json();
  return {
    publicId: result.public_id,
    resourceType: result.resource_type,
  };
}

async function getNextRegistrationNumber() {
  const counterRef = doc(db, "counters", "registration");
  const nextNumber = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const lastNumber = snap.exists() ? Number(snap.data().lastNumber || 0) : 0;
    const newNumber = lastNumber + 1;
    transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });
    return newNumber;
  });
  return String(nextNumber).padStart(4, "0");
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

if (form && formResult) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = formData.get("name");
    const gender = formData.get("gender");
    let eventName = formData.get("eventName");
    const photoFile = formData.get("photo");
    const govtIdFile = formData.get("govtId");

    if (!eventName) {
      eventName = gender === "Female" ? "Women 5 KM" : "Men 10 KM";
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      const regNumber = await getNextRegistrationNumber();
      const registrationRef = doc(collection(db, "registrations"));
      const [photoResult, govtIdResult] = await Promise.all([
        uploadFile(photoFile),
        uploadFile(govtIdFile),
      ]);

      const fee = gender === "Female" ? 250 : 350;
      const payload = {
        name: String(name || "").trim(),
        nameLower: String(name || "").trim().toLowerCase(),
        fatherName: String(formData.get("fatherName") || "").trim(),
        gender: String(gender || "").trim(),
        eventName,
        dob: String(formData.get("dob") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        medicalCondition: String(formData.get("medicalCondition") || "").trim(),
        tshirtSize: String(formData.get("tshirtSize") || "").trim(),
        fee,
        regNumber,
        photoPublicId: photoResult ? photoResult.publicId : "",
        photoResourceType: photoResult ? photoResult.resourceType : "",
        govtIdPublicId: govtIdResult ? govtIdResult.publicId : "",
        govtIdResourceType: govtIdResult ? govtIdResult.resourceType : "",
        status: "pending",
        certificateStatus: "pending",
        rank: "",
        createdAt: serverTimestamp(),
      };

      await setDoc(registrationRef, payload);

      const websiteLink = `${window.location.origin}/index.html`;
      const emailParams = {
        name: payload.name,
        category: payload.eventName,
        amount: payload.fee,
        website_link: websiteLink,
        reg_number: payload.regNumber,
        event_date: "10 May 2026",
        reporting_time: "5:00 AM",
        start_time: "6:00 AM",
        venue: "Kharagpur Sersa Stadium, Paschim Medinipur, West Bengal",
        email: payload.email,
      };

      try {
        if (window.emailjs) {
          await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, emailParams);
        }
      } catch (mailError) {
        console.error("Email send failed", mailError);
      }

      formResult.textContent = `${name}, your registration for ${eventName} has been received successfully. Your registration number is ${regNumber}.`;
      if (successCard) {
        successCard.hidden = false;
      }
      form.reset();
      if (eventNameInput) {
        eventNameInput.value = "";
      }
      if (eventDisplay) {
        eventDisplay.value = "";
      }
      if (selectedEventLabel) {
        selectedEventLabel.textContent = "Choose gender to assign event";
      }
      if (eventSelectionGrid) {
        eventSelectionGrid.querySelectorAll(".event-choice").forEach((choice) => {
          choice.classList.remove("is-selected");
        });
      }
      if (genderSelect) {
        genderSelect.value = "";
      }
    } catch (error) {
      formResult.textContent = "Sorry, we could not save your registration. Please try again.";
      if (successCard) {
        successCard.hidden = false;
      }
      console.error(error);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Registration";
      }
    }
  });
}

function setEventFromGender(gender) {
  let eventName = "";

  if (gender === "Female") {
    eventName = "Women 5 KM";
  } else if (gender === "Male") {
    eventName = "Men 10 KM";
  }

  if (eventNameInput) {
    eventNameInput.value = eventName;
  }
  if (eventDisplay) {
    eventDisplay.value = eventName;
  }
  if (selectedEventLabel) {
    selectedEventLabel.textContent = eventName || "Choose gender to assign event";
  }

  if (eventSelectionGrid) {
    eventSelectionGrid.querySelectorAll(".event-choice").forEach((choice) => {
      const matches = choice.dataset.event === eventName;
      choice.classList.toggle("is-selected", matches);
    });
  }

  if (successCard) {
    successCard.hidden = true;
  }
}

if (genderSelect) {
  genderSelect.addEventListener("change", () => {
    setEventFromGender(genderSelect.value);
  });
}
