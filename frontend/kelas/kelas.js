
function parseTimeToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// ✅ Escape HTML: cegah user memasukkan script jahat
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}


function timesOverlap(startA, endA, startB, endB) {
  const sA = parseTimeToMinutes(startA), eA = parseTimeToMinutes(endA);
  const sB = parseTimeToMinutes(startB), eB = parseTimeToMinutes(endB);
  if (sA === null || eA === null || sB === null || eB === null) return false;
  return sA < eB && eA > sB;
}

let currentUser = null;
let liveBookings = [];
let selectedExtraDates = [];
// Untuk navigasi bulan di kalender multi-tanggal
let calendarYear = null;
let calendarMonth = null; // 0 = Januari, 11 = Desember

const ROOMS = [
  { id: "rapat", name: "Ruang Rapat FIKES", capacity: null },
  { id: "209", name: "209 (CBT FIKES)", capacity: null },
  { id: "podcast", name: "Ruang Podcast", capacity: null },
  { id: "102", name: "Ruang 102", capacity: 45 }, { id: "103", name: "Ruang 103", capacity: 46 },
  { id: "104", name: "Ruang 104", capacity: 45 }, { id: "105", name: "Ruang 105", capacity: 45 },
  { id: "106", name: "Ruang 106", capacity: 25 }, { id: "201", name: "Ruang 201", capacity: 30 },
  { id: "202", name: "Ruang 202", capacity: 55 }, { id: "203", name: "Ruang 203", capacity: 54 },
  { id: "204", name: "Ruang 204", capacity: 55 }, { id: "205", name: "Ruang 205", capacity: 55 },
  { id: "206", name: "Ruang 206", capacity: 55 }, { id: "207", name: "Ruang 207", capacity: 55 },
  { id: "208", name: "Ruang 208", capacity: 55 }, { id: "301", name: "Ruang 301", capacity: 20 },
  { id: "302", name: "Ruang 302", capacity: 20 }, { id: "303", name: "Ruang 303", capacity: 20 },
  { id: "304", name: "Ruang 304", capacity: 20 }, { id: "305", name: "Ruang 305", capacity: 20 },
  { id: "408", name: "Ruang 408", capacity: 52 }, { id: "409", name: "Ruang 409", capacity: 50 },
  { id: "410", name: "Ruang 410", capacity: 44 }
];


// ✅ LOGIKA SAAT REFRESH (PASTI TIDAK LOGOUT)
window.addEventListener("DOMContentLoaded", () => {
  // 1. Ambil sesi dari auth.js
  const session = getSession();
  
  // 2. Jika belum login, tendang ke halaman login utama
  if (!session || !session.user) {
    window.location.href = "../index.html";
    return;
  }

  // 3. Set user aktif
  currentUser = session.user;
  
  // 4. Tampilkan nama user di header (jika elemennya ada)
  const userBadge = document.getElementById("userBadge");
  if (userBadge) {
    userBadge.innerText = `${currentUser.name} (${currentUser.role} - ${currentUser.prodi || '-'})`;
  }
  
  // 5. Jalankan aplikasi
  fetchBookings().then(() => initApp());
});



async function fetchBookings() {
  try {
    const res = await fetch(API_URL + "?action=getBookings");
    const result = await res.json();
    if (result.success) {
      liveBookings = result.data.map(b => {
        let s = b.start ? b.start.toString().trim() : ""; if (s.length === 4) s = "0" + s;
        let e = b.end ? b.end.toString().trim() : ""; if (e.length === 4) e = "0" + e;
        return {
          id: b.id, roomId: b.roomId ? b.roomId.toString().trim() : "", date: b.date ? b.date.toString().trim() : "",
          start: s, end: e, email: b.email ? b.email.toString().trim() : "", activity: b.activity ? b.activity.toString().trim() : "",
          status: b.status, courseName: b.courseName || "-", lecturerName: b.lecturerName || "-",
          contactPerson: b.contactPerson || "-", contactPhone: b.contactPhone || "-",
          notes: b.notes || "-", participantCount: b.participantCount || "-"
        };
      });
      renderRooms();
    }
  } catch (err) { console.error("Gagal ambil data:", err); }
}

function initApp() {
  const datePicker = document.getElementById("datePicker");
  const today = new Date();
  datePicker.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  document.querySelectorAll(".btn-quick").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = new Date(); d.setDate(d.getDate() + Number(btn.dataset.offset));
      datePicker.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      document.querySelectorAll(".btn-quick").forEach(b => b.classList.remove("active")); btn.classList.add("active"); renderRooms();
    });
  });
  datePicker.addEventListener("change", renderRooms);
  document.getElementById("startTime").addEventListener("change", renderRooms);
  document.getElementById("endTime").addEventListener("change", renderRooms);
  document.querySelector(".btn-quick[data-offset='0']").click();
  setInterval(async () => {
    // ✅ Jangan refresh kalau tab browser tidak aktif (hemat kuota)
    if (document.visibilityState !== "visible") return;
    if (document.getElementById("mainPage").style.display !== "block") return;
    await fetchBookings();
    if (document.getElementById('tabDaftar').style.display === 'block') renderListBookings();
    if (document.getElementById('tabRekap').style.display === 'block') renderMonthlyView();
  }, 45000); // ✅ 45 detik, lebih hemat dari 15 detik
}

function renderRooms() {
  const date = document.getElementById("datePicker").value;
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;
  const grid = document.getElementById("roomGrid");
  if (!date || !start || !end) return;
  
  const sMin = parseTimeToMinutes(start), eMin = parseTimeToMinutes(end);
  if (sMin === null || eMin === null || sMin >= eMin) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; text-align:center; color:#c0392b; font-weight:600;">⚠️ Jam mulai harus lebih awal dari jam selesai.</div>`; return;
  }

  grid.innerHTML = "";
  ROOMS.forEach(room => {
    const conflict = liveBookings.find(b => b.roomId === room.id.toString() && b.date === date && timesOverlap(start, end, b.start, b.end));
    const card = document.createElement("div");
    let cardClass = "available";
    if (conflict) cardClass = conflict.status === 'unconfirmed' ? "unconfirmed" : "occupied";
    card.className = "room-card " + cardClass; card.setAttribute("role", "button"); card.setAttribute("tabindex", "0");

    const capacityLine = room.capacity ? `<div class="room-capacity">🪑 ${room.capacity} kursi</div>` : `<div class="room-capacity" style="opacity:0;">-</div>`; // Tetap render kosong agar grid sejajar

    if (conflict) {
      card.innerHTML = `<div class="card-top"><div class="room-name">${room.name}</div>${capacityLine}</div><div class="card-bottom"><strong>Dipakai: ${conflict.activity}</strong><br><small>(${conflict.email})</small><br><small>👁️ Klik untuk detail</small></div>`;
      card.addEventListener("click", () => openDetailModal(conflict, room));
    } else {
      card.innerHTML = `<div class="card-top"><div class="room-name">${room.name}</div>${capacityLine}</div><div class="card-bottom"><span>Tersedia — Klik untuk pesan</span></div>`;
      card.addEventListener("click", () => openModal(room));
    }
    grid.appendChild(card);
  });
}

function openModal(room) {
  const date = document.getElementById("datePicker").value;
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;
  const sMin = parseTimeToMinutes(start), eMin = parseTimeToMinutes(end);
  if (sMin === null || eMin === null || sMin >= eMin) { showToast("Jam mulai harus lebih awal dari jam selesai.", "error"); return; }
  if (sMin < 7 * 60 || eMin > 21 * 60) { showToast("Pemesanan hanya diizinkan antara 07:00 - 21:00.", "error"); return; }

  const dateObj = new Date(date + "T00:00:00");
  document.getElementById("modalRoomName").innerText = room.name;
  document.getElementById("modalDateTime").innerText = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + " • " + start + " - " + end;
  document.getElementById("bookingType").value = "single"; document.getElementById("multipleDateContainer").style.display = "none"; selectedExtraDates = [];
  document.getElementById("formRoomId").value = room.id; document.getElementById("formDate").value = date;
  document.getElementById("formStart").value = start; document.getElementById("formEnd").value = end;
  document.getElementById("formContactPerson").value = currentUser ? currentUser.name + " (" + currentUser.role + ")" : "";
  document.getElementById("formActivity").value = ""; document.getElementById("formCourse").value = "";
  document.getElementById("formLecturer").value = ""; document.getElementById("formPhone").value = ""; document.getElementById("formCount").value = ""; document.getElementById("formNotes").value = "";
  document.getElementById("bookingModal").style.display = "flex";
}

function closeModal() { document.getElementById("bookingModal").style.display = "none"; }

async function submitBooking() {
  const btnSubmit = document.querySelector('.btn-submit'); const originalText = btnSubmit.innerText;
  const activity = document.getElementById("formActivity").value.trim(); const phone = document.getElementById("formPhone").value.trim();
  if (!activity || !phone) { showToast("Nama Kegiatan dan No. HP wajib diisi!", "error"); return; }

  const start = document.getElementById("formStart").value; const end = document.getElementById("formEnd").value;
  const sMin = parseTimeToMinutes(start), eMin = parseTimeToMinutes(end);
  if (sMin === null || eMin === null || sMin >= eMin) { showToast("Jam mulai harus lebih awal dari jam selesai.", "error"); return; }
  if (sMin < 7 * 60 || eMin > 21 * 60) { showToast("Pemesanan hanya diizinkan antara 07:00 - 21:00.", "error"); return; }

  const roomId = document.getElementById("formRoomId").value; const roomObj = ROOMS.find(r => r.id === roomId); const countInput = document.getElementById("formCount").value;
  if (roomObj && roomObj.capacity && countInput) {
    const count = parseInt(countInput, 10);
    if (!isNaN(count) && count > roomObj.capacity) { showToast(`Jumlah peserta (${count}) melebihi kapasitas ruangan (${roomObj.capacity} kursi).`, "error", 5000); return; }
  }

  let datesToBook = [];
  if (document.getElementById("bookingType").value === "single") { datesToBook.push(document.getElementById("formDate").value); } 
  else { if (selectedExtraDates.length === 0) { showToast("Pilih minimal 1 tanggal di kalender!", "error"); return; } datesToBook = [...selectedExtraDates]; }

  // ✅ Validasi: tolak tanggal yang sudah lewat
    const nowCheck = new Date();
    const todayCheck = `${nowCheck.getFullYear()}-${String(nowCheck.getMonth() + 1).padStart(2, '0')}-${String(nowCheck.getDate()).padStart(2, '0')}`;
    const pastDates = datesToBook.filter(d => d < todayCheck);
    if (pastDates.length > 0) {
      showToast(`Tanggal berikut sudah lewat: ${pastDates.join(", ")}. Silakan pilih tanggal lain.`, "error", 5000);
      return;
    }

  btnSubmit.innerText = "Memeriksa ketersediaan..."; btnSubmit.disabled = true;
  try {
    await fetchBookings();
    const conflicts = [];
    for (const date of datesToBook) {
      const conflict = liveBookings.find(b => b.roomId === roomId && b.date === date && b.status !== "cancelled" && timesOverlap(start, end, b.start, b.end));
      if (conflict) conflicts.push(date);
    }
    if (conflicts.length > 0) { showToast(`Slot sudah terisi. Silakan pilih waktu lain.`, "error", 6000); return; }

    btnSubmit.innerText = "Memproses...";
    let successCount = 0; const failedDates = [];
    for (const date of datesToBook) {
      const payload = {
        action: "createBooking", id_token: getToken(), roomId: roomId, date: date, start: start, end: end, activity: activity,
        courseName: document.getElementById("formCourse").value, lecturerName: document.getElementById("formLecturer").value,
        contactPerson: currentUser ? currentUser.name : "", contactPhone: phone,
        participantCount: document.getElementById("formCount").value, notes: document.getElementById("formNotes").value,
      };
      const formData = new URLSearchParams(); for (const key in payload) formData.append(key, payload[key]);
      try {
        const res = await fetch(API_URL, { method: "POST", body: formData });
        const result = await res.json();
        if (result.success) successCount++; else failedDates.push(date);
      } catch (err) { failedDates.push(date); }
    }

    if (successCount === datesToBook.length) showToast(`✅ ${successCount} pemesanan berhasil!`, "success");
    else showToast(`⚠️ ${successCount} berhasil. Sisanya gagal.`, "warning", 6000);

    closeModal(); await fetchBookings();
  } catch (err) { showToast("Gagal terhubung ke server.", "error"); } 
  finally { btnSubmit.innerText = originalText; btnSubmit.disabled = false; }
}

function logout() {
  // auth.js sudah punya fungsi logout, kita panggil itu
  window.logout(); 
}

function openDetailModal(booking, room) {
  try {
    const dateObj = new Date(booking.date + "T00:00:00");
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value || "-"; };
    setText("detailRoomName", room.name);
    setText("detailDateTime", dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + " • " + booking.start + " - " + booking.end);
    setText("detailCapacity", room.capacity ? room.capacity + " kursi" : "-"); setText("detailActivity", booking.activity);
    setText("detailCourse", booking.courseName); setText("detailLecturer", booking.lecturerName);
    setText("detailContact", booking.contactPerson + " (" + booking.contactPhone + ")"); setText("detailEmail", booking.email);
    setText("detailNotes", booking.notes); setText("detailCount", booking.participantCount === "-" ? "-" : booking.participantCount + " orang");

    const btnCancel = document.getElementById("btnCancelBooking");
    if (btnCancel && currentUser && booking.email.toLowerCase() === currentUser.email.toLowerCase()) {
      if (booking.status === 'confirmed' || booking.status === 'unconfirmed') { btnCancel.style.display = "block"; btnCancel.dataset.id = booking.id; } else { btnCancel.style.display = "none"; }
    } else if (btnCancel) { btnCancel.style.display = "none"; }
    document.getElementById("detailModal").style.display = "flex";
  } catch (err) { showToast("Gagal menampilkan detail.", "error"); }
}

async function confirmCancelBooking() {
  const btn = document.getElementById("btnCancelBooking"); const bookingId = btn.dataset.id; if (!bookingId) return;
  if (!confirm("Yakin ingin membatalkan pemesanan ini?")) return;
  const originalText = btn.innerText; btn.innerText = "Memproses..."; btn.disabled = true;
  const formData = new URLSearchParams(); formData.append("action", "cancelBooking"); formData.append("id", bookingId); formData.append("id_token", getToken());
  try {
    const res = await fetch(API_URL, { method: "POST", body: formData }); const result = await res.json();
    if (result.success) { showToast("✅ " + result.message, "success"); closeDetailModal(); await fetchBookings(); } 
    else { showToast("❌ Gagal: " + (result.message || "Tidak diketahui"), "error"); }
  } catch (err) { showToast("Gagal terhubung ke server.", "error"); } finally { btn.innerText = originalText; btn.disabled = false; }
}

function closeDetailModal() { document.getElementById("detailModal").style.display = "none"; }

function renderListBookings() {
  const tbody = document.getElementById("listBookingBody"); tbody.innerHTML = "";
  const sortedBookings = [...liveBookings].sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.start.localeCompare(b.start));
  if (sortedBookings.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #666;">Belum ada jadwal pemesanan.</td></tr>`; return; }
  sortedBookings.forEach(b => {
    const roomObj = ROOMS.find(r => r.id === b.roomId); const roomName = roomObj ? roomObj.name : b.roomId;
    const dateObj = new Date(b.date + "T00:00:00"); const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    let statusColor = b.status === 'unconfirmed' ? '#f39c12' : '#2ecc71'; let statusText = b.status === 'unconfirmed' ? '(Belum Konfirmasi)' : '';
    const tr = document.createElement("tr"); tr.style.borderBottom = "1px solid #eee";
    tr.innerHTML = `<td>${esc(dateStr)}</td><td>${esc(b.start)} - ${esc(b.end)}</td><td style="font-weight: bold; color: #1e3a5f;">${esc(roomName)}</td><td>${esc(b.activity)} <br><small style="color:${statusColor};">${esc(statusText)}</small></td><td>${esc(b.contactPerson || b.email)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderMonthlyView() {
  const monthValue = document.getElementById("monthPicker").value; const table = document.getElementById("matrixTable"); table.innerHTML = "";
  if (!monthValue) return;
  const [year, month] = monthValue.split("-"); const daysInMonth = new Date(year, month, 0).getDate(); 

  let thead = "<thead><tr style='background: #f4f6f8;'>";
  thead += "<th style='padding: 10px; text-align: left; min-width: 140px; border: 1px solid #ddd; font-weight: bold; color: var(--hijau-gelap); position: sticky; left: 0; background: #f4f6f8; z-index: 1;'>Ruangan \\ Tanggal</th>";
  for (let d = 1; d <= daysInMonth; d++) {
    const isWeekend = (new Date(year, month - 1, d).getDay() === 0 || new Date(year, month - 1, d).getDay() === 6);
    const bgColor = isWeekend ? "#f8d7da" : "#f4f6f8";
    thead += `<th style="padding: 8px 4px; border: 1px solid #ddd; font-weight: 600; color: var(--hijau-gelap); background: ${bgColor}; min-width: 35px;">${String(d).padStart(2, '0')}</th>`;
  }
  thead += "</tr></thead>"; table.innerHTML += thead;

  let tbody = "<tbody>";
  ROOMS.forEach(room => {
    tbody += "<tr>";
    tbody += `<td style="padding: 10px; text-align: left; font-weight: 600; font-size: 0.85rem; border: 1px solid #ddd; color: var(--hijau-gelap); position: sticky; left: 0; background: #fff; z-index: 1;">${room.name}</td>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${month}-${String(d).padStart(2, '0')}`;
      const bookings = liveBookings.filter(b => b.roomId === room.id && b.date === dateStr && b.status !== 'cancelled');
      let cellContent = ""; let cellBg = "#fff";
      if (bookings.length > 0) {
        cellBg = bookings.some(b => b.status === 'unconfirmed') ? "var(--emas)" : "var(--hijau-tosca)";
                // ✅ Teks turun ke bawah, font lebih kecil, tetap di dalam kotak
        cellContent = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2px;">` + 
          bookings.map(b => 
            `<span style="color: white; font-size: 0.6rem; font-weight: bold; line-height: 1.3; white-space: nowrap;">
               ${b.start}-${b.end}
             </span>`
          ).join("") + 
        `</div>`;
      }
      const bookingsJson = encodeURIComponent(JSON.stringify(bookings));
      tbody += `<td style="padding: 6px 4px; border: 1px solid #ddd; background: ${cellBg}; cursor: ${bookings.length > 0 ? 'pointer' : 'default'}; border-radius: 4px;" ${bookings.length > 0 ? `onclick="openDetailFromMatrix('${bookingsJson}', '${room.name}')"` : ''}>${cellContent}</td>`;
    }
    tbody += "</tr>";
  });
  tbody += "</tbody>"; table.innerHTML += tbody;
}

function openDetailFromMatrix(bookingsJson, roomName) {
  const bookings = JSON.parse(decodeURIComponent(bookingsJson)); if (!bookings || bookings.length === 0) return;
  if (bookings.length === 1) { openDetailModal(bookings[0], ROOMS.find(r => r.name === roomName) || { name: roomName, id: bookings[0].roomId }); return; }
  const safeRoomName = roomName.replace(/'/g, "\\'");
  const list = bookings.map((b) => {
  const encoded = encodeURIComponent(JSON.stringify(b));
  return `<div class="matrix-booking-item" onclick="openDetailFromMatrixSingle('${encoded}', '${safeRoomName}')"><strong>${esc(b.start)} - ${esc(b.end)}</strong> — ${esc(b.activity)}<br><small>${esc(b.contactPerson || b.email)}</small></div>`;
}).join("");
  let modal = document.getElementById("matrixListModal");
  if (!modal) {
    modal = document.createElement("div"); modal.id = "matrixListModal"; modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-content"><h2 class="modal-title" id="matrixListTitle">Pemesanan</h2><p class="modal-subtitle">Pilih salah satu untuk melihat detail</p><div id="matrixListBody" style="display:flex; flex-direction:column; gap:8px; max-height:50vh; overflow-y:auto;"></div><div class="modal-actions"><button onclick="document.getElementById('matrixListModal').style.display='none'" class="btn-cancel">Tutup</button></div></div>`;
    document.body.appendChild(modal);
  }
  document.getElementById("matrixListTitle").innerText = "Pemesanan di " + roomName; document.getElementById("matrixListBody").innerHTML = list; modal.style.display = "flex";
}

function openDetailFromMatrixSingle(encoded, roomName) {
  const booking = JSON.parse(decodeURIComponent(encoded)); document.getElementById("matrixListModal").style.display = "none";
  openDetailModal(booking, ROOMS.find(r => r.name === roomName) || { name: roomName, id: booking.roomId });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).style.display = 'block';
  if (tabId === 'tabPesan') document.getElementById('btnTabPesan').classList.add('active');
  if (tabId === 'tabDaftar') { document.getElementById('btnTabDaftar').classList.add('active'); renderListBookings(); }
  if (tabId === 'tabRekap') { document.getElementById('btnTabRekap').classList.add('active'); const today = new Date(); document.getElementById("monthPicker").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; renderMonthlyView(); }
}

function toggleBookingType() {
  const type = document.getElementById("bookingType").value;
  const multipleContainer = document.getElementById("multipleDateContainer");
  if (type === "multiple") {
    // Reset bulan kalender ke bulan tanggal awal
    const baseDateStr = document.getElementById("formDate").value;
    const baseDate = new Date(baseDateStr + "T00:00:00");
    calendarYear = baseDate.getFullYear();
    calendarMonth = baseDate.getMonth();
    multipleContainer.style.display = "block";
    renderMiniCalendar();
  } else {
    multipleContainer.style.display = "none";
  }
}

function renderMiniCalendar() {
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = "";

  // Jika bulan belum diset, pakai bulan dari tanggal awal
  if (calendarYear === null || calendarMonth === null) {
    const baseDateStr = document.getElementById("formDate").value;
    const baseDate = new Date(baseDateStr + "T00:00:00");
    calendarYear = baseDate.getFullYear();
    calendarMonth = baseDate.getMonth();
  }

  const baseDateStr = document.getElementById("formDate").value;
  const baseDate = new Date(baseDateStr + "T00:00:00");

  // === HEADER: Tombol Bulan + Nama Bulan ===
  const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const navHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; grid-column: 1/-1;">
      <button type="button" onclick="geserKalender(-1)" style="background:var(--hijau-tosca); color:#fff; border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; font-weight:bold;">‹</button>
      <span style="font-weight:700; color:var(--hijau-gelap); font-size:0.85rem;">${bulanNama[calendarMonth]} ${calendarYear}</span>
      <button type="button" onclick="geserKalender(1)" style="background:var(--hijau-tosca); color:#fff; border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; font-weight:bold;">›</button>
    </div>`;
  grid.innerHTML = navHtml;

  // === Header Hari ===
  ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].forEach(day => {
    const isWeekend = (day === 'Sab' || day === 'Min');
    grid.innerHTML += `<div style="font-size:0.7rem; font-weight:bold; color:${isWeekend ? '#e74c3c' : 'var(--hijau-gelap)'}; padding-bottom:4px;">${day}</div>`;
  });

  // Kosongkan sebelum tanggal 1
  let firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < firstDay; i++) { grid.innerHTML += `<div></div>`; }

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const roomId = document.getElementById("formRoomId").value;
  const start = document.getElementById("formStart").value;
  const end = document.getElementById("formEnd").value;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayOfWeek = new Date(calendarYear, calendarMonth, d).getDay(); // 0=Minggu, 6=Sabtu
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isPast = dateStr < todayStr;
    const isOverlap = liveBookings.find(b => b.roomId === roomId && b.date === dateStr && timesOverlap(start, end, b.start, b.end));

    let cellStyle = "padding:6px 0; border-radius:4px; font-size:0.8rem; transition:all 0.2s;";

    if (isWeekend) {
      // Sabtu/Minggu: abu-abu muda, tidak bisa diklik
      cellStyle += "background:#f9f9f9; color:#bbb; cursor:not-allowed; border:1px solid #eee;";
      grid.innerHTML += `<div style="${cellStyle}" title="Hari libur">${d}</div>`;
    } else if (isPast) {
      cellStyle += "background:#f5f5f5; color:#bbb; cursor:not-allowed; text-decoration:line-through;";
      grid.innerHTML += `<div style="${cellStyle}" title="Tanggal sudah lewat">${d}</div>`;
    } else if (isOverlap) {
      cellStyle += "background:#e0e0e0; color:#999; cursor:not-allowed;";
      grid.innerHTML += `<div style="${cellStyle}">${d}</div>`;
    } else {
      cellStyle += "background:#fff; border:1px solid var(--abu-kotak); color:var(--hijau-gelap); font-weight:bold; cursor:pointer;";
      const cellId = `cal-${dateStr}`;
      grid.innerHTML += `<div id="${cellId}" style="${cellStyle}" onclick="toggleDateSelection('${dateStr}','${cellId}')">${d}</div>`;
      // Auto-pilih tanggal awal jika di bulan ini
      if (dateStr === baseDateStr) toggleDateSelection(dateStr, cellId);
    }
  }
}

// Fungsi geser bulan (‹ dan ›)
function geserKalender(arah) {
  calendarMonth += arah;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  if (calendarMonth < 0)  { calendarMonth = 11; calendarYear--; }
  renderMiniCalendar();
}

function toggleDateSelection(dateStr, cellId) {
  const cell = document.getElementById(cellId); const index = selectedExtraDates.indexOf(dateStr);
  if (index > -1) { selectedExtraDates.splice(index, 1); cell.style.background = "#fff"; cell.style.color = "var(--hijau-gelap)"; } 
  else { selectedExtraDates.push(dateStr); cell.style.background = "var(--hijau-tosca)"; cell.style.color = "#fff"; }
}

function resetBookingType() { document.getElementById("bookingType").value = "single"; toggleBookingType(); }

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const detailModal = document.getElementById("detailModal");
  if (detailModal && detailModal.style.display === "flex") { closeDetailModal(); return; }
  const bookingModal = document.getElementById("bookingModal");
  if (bookingModal && bookingModal.style.display === "flex") { closeModal(); return; }
  const matrixModal = document.getElementById("matrixListModal");
  if (matrixModal && matrixModal.style.display === "flex") { matrixModal.style.display = "none"; }
});
