async function generateZip() {
    const zip = new JSZip();
    const container = document.getElementById("hidden-container");
  
    for (let i = 6; i <= 176; i++) {
      let num = String(i).padStart(4, '0');
  
      let ticket = document.createElement("div");
      ticket.className = "ticket";
  
      ticket.innerHTML = `
        <div class="top">KHARAGPUR MINI MARATHON 2026</div>
  
        <div class="bib-row">
          <img class="bib-logo" src="image.png" alt="Event logo">
          <div class="number">${num}</div>
        </div>
  
        <div class="bottom">
          D Star Athletic Club Kharagpur<br>
          Date: 10-05-2026 | kdsac.in
        </div>
      `;
  
      container.appendChild(ticket);
  
      const canvas = await html2canvas(ticket, { scale: 2 }); // better quality
      const imgData = canvas.toDataURL("image/png").split(',')[1];
  
      zip.file(`bib_${num}.png`, imgData, { base64: true });
  
      container.removeChild(ticket);
    }
  
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "KDSAC_Bibs.zip");
  }