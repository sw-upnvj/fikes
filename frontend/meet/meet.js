let akunTerpilih = null;
let userAktif = null; 
let meetingIdAkanDihapus = null;
let meetingCodeAkanDihapus = null;
let akunDetailSaatIni = null;

window.addEventListener('DOMContentLoaded', () => {
    const session = getSession();
    if (!session || !session.user) {
        window.location.href = "../index.html";
        return;
    }

    userAktif = {
        nama: session.user.name,
        email: session.user.email,
        role: session.user.role
    };
    
    document.getElementById('label-nama-user').innerText = userAktif.nama + " (" + userAktif.role + ")";
    document.getElementById('input-pic').value = userAktif.nama;
    
    setTanggal(0); 
    generateKotakAkun();
});

function generateKotakAkun() {
    const grid = document.getElementById('grid-akun');
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
            <div class="spinner" style="border-top-color: #C19246; margin-bottom: 15px;"></div>
            <p style="color: #666; font-weight: 500;">🔄 Mengecek 11 Akun Google Calendar...</p>
            <p style="font-size: 12px; color: #999;">Mohon tunggu sebentar, ini memakan waktu ±5 detik.</p>
        </div>
    `; 

    const tanggal = document.getElementById('input-tanggal').value;
    const jamMulai = document.getElementById('input-jam-mulai').value;
    const jamSelesai = document.getElementById('input-jam-selesai').value;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    fetch('http://127.0.0.1:5000/api/cek-jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tanggal: tanggal, jam_mulai: jamMulai, jam_selesai: jamSelesai,
            email: userAktif.email, nama: userAktif.nama
        }),
        signal: controller.signal
    })
    .then(res => res.json())
    .then(resData => {
        clearTimeout(timeoutId);
        grid.innerHTML = ''; 
        
        if (!resData.success) throw new Error("Gagal dari server");
        const dataJadwal = resData.data;

        for (let i = 1; i <= 11; i++) {
            const namaAkun = `GMeet ${i}`;
            const info = dataJadwal[namaAkun];
            const card = document.createElement('div');
            
            if (info.status === 'kosong') {
                card.className = 'akun-card tersedia';
                card.innerHTML = `<h4>${namaAkun}</h4><p>✅ Tersedia — Klik untuk pilih</p>`;
                card.onclick = function() { pilihAkun(this, namaAkun); };
            } 
            else if (info.status === 'terisi') {
                if (info.is_milik_sendiri) {
                    card.className = 'akun-card emas';
                    card.innerHTML = `<h4>${namaAkun}</h4><p>${info.topik}<br><small>PIC: ${info.pic}</small></p>`;
                    card.onclick = function() { bukaDetailRapat(namaAkun, info.topik, info.pic, info.waktu, info.event_id, true, info.meeting_code); };
                } else {
                    card.className = 'akun-card penuh';
                    card.innerHTML = `<h4>${namaAkun}</h4><p>${info.topik}<br><small>PIC: ${info.pic}</small></p>`;
                    card.onclick = function() { bukaDetailRapat(namaAkun, info.topik, info.pic, info.waktu, info.event_id, false, info.meeting_code); };
                }
            }
            grid.appendChild(card);
        }
    })
    .catch(err => {
        clearTimeout(timeoutId);
        grid.innerHTML = ''; 
        for (let i = 1; i <= 11; i++) {
            const card = document.createElement('div');
            card.className = 'akun-card tersedia';
            card.innerHTML = `<h4>GMeet ${i}</h4><p>⚠️ Gagal cek status — Asumsikan Tersedia</p>`;
            card.onclick = function() { pilihAkun(this, `GMeet ${i}`); };
            grid.appendChild(card);
        }
    });
}

function setTanggal(offsetDays) {
    document.querySelectorAll('.btn-quick').forEach(btn => btn.classList.remove('active'));
    if(offsetDays === 0) document.querySelectorAll('.btn-quick')[0].classList.add('active');
    if(offsetDays === 1) document.querySelectorAll('.btn-quick')[1].classList.add('active');
    if(offsetDays === 2) document.querySelectorAll('.btn-quick')[2].classList.add('active');

    let date = new Date();
    date.setDate(date.getDate() + offsetDays);
    let formattedDate = date.toISOString().split('T')[0];
    document.getElementById('input-tanggal').value = formattedDate;
    
    if(userAktif) generateKotakAkun();
}

function pilihAkun(element, namaAkun) {
    document.querySelectorAll('.akun-card').forEach(card => card.classList.remove('terpilih'));
    element.classList.add('terpilih');
    akunTerpilih = namaAkun;
    document.getElementById('btn-buat').disabled = false; 
}

function bukaDetailRapat(akun, topik, pic, waktu, id, isMilikSendiri, code) {
    akunDetailSaatIni = akun;
    document.getElementById('modal-akun').innerText = akun;
    document.getElementById('modal-topik').innerText = topik;
    document.getElementById('modal-pic').innerText = pic;
    document.getElementById('modal-waktu').innerText = waktu;

    const btnHapus = document.getElementById('btn-hapus-meeting');
    const btnEdit = document.getElementById('btn-edit-meeting');

    if (isMilikSendiri) {
        btnHapus.style.display = 'block'; 
        btnEdit.style.display = 'block';
        meetingIdAkanDihapus = id;
        meetingCodeAkanDihapus = code;
    } else {
        btnHapus.style.display = 'none'; 
        btnEdit.style.display = 'none';
        meetingIdAkanDihapus = null;
        meetingCodeAkanDihapus = null;
    }
    document.getElementById('modal-detail').style.display = 'flex';
}

function tutupModal() { document.getElementById('modal-detail').style.display = 'none'; }
function klikLuarModal(event) { if (event.target.id === 'modal-detail') tutupModal(); }
function editMeeting() { alert("Fitur Edit Meeting akan segera hadir!"); }

function hapusMeeting() {
    if (!meetingIdAkanDihapus) return;
    if (confirm("Apakah Anda yakin ingin menghapus meeting ini?")) {
        fetch('http://127.0.0.1:5000/api/hapus-meeting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ akun: akunDetailSaatIni, event_id: meetingIdAkanDihapus, meeting_code: meetingCodeAkanDihapus })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("✅ Meeting berhasil dihapus dari Google Calendar!");
                tutupModal();
                generateKotakAkun();
            } else {
                alert("Gagal menghapus: " + data.error);
            }
        });
    }
}

function buatMeeting() {
    const tanggal = document.getElementById('input-tanggal').value;
    const jamMulai = document.getElementById('input-jam-mulai').value;
    const jamSelesai = document.getElementById('input-jam-selesai').value;
    const topik = document.getElementById('input-topik').value;

    if (!tanggal || !jamMulai || !jamSelesai || topik.trim() === "") { alert("Mohon lengkapi Tanggal, Jam, dan Topik!"); return; }
    if (jamMulai >= jamSelesai) { alert("Jam Selesai harus lebih lambat dari Jam Mulai!"); return; }
    if (!akunTerpilih) { alert("Silakan pilih akun Google Meet!"); return; }

    document.querySelectorAll('#tab-buat .control-card')[0].style.display = 'none';
    document.getElementById('panel-loading').style.display = 'block';

    fetch('http://127.0.0.1:5000/api/buat-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            akun: akunTerpilih, tanggal: tanggal, jam_mulai: jamMulai, jam_selesai: jamSelesai,
            topik: topik, pic: userAktif.nama, email_pembuat: userAktif.email
        })
    })
    .then(response => { if (!response.ok) throw new Error('HTTP status ' + response.status); return response.json(); })
    .then(data => {
        document.getElementById('panel-loading').style.display = 'none';
        document.getElementById('panel-hasil').style.display = 'block';

        if (data.success) {
            document.getElementById('out-akun').innerText = `${akunTerpilih} (${data.email_akun || 'email@upnvj.ac.id'})`;
            document.getElementById('out-topik').innerText = topik;
            document.getElementById('out-durasi').innerText = hitungDurasi(jamMulai, jamSelesai);
            document.getElementById('out-waktu').innerText = formatTanggalIndo(tanggal) + " " + jamMulai + " - " + jamSelesai + " (Jakarta)";
            document.getElementById('out-link').innerText = data.link;
            document.getElementById('out-link').href = data.link;
            document.getElementById('out-code').innerText = data.code;

            const elLinkAbsen = document.getElementById('out-link-absen');
            const barisLinkAbsen = document.getElementById('baris-link-absen');
            if (elLinkAbsen && data.link_absen) {
                elLinkAbsen.innerText = data.link_absen;
                elLinkAbsen.href = data.link_absen;
                barisLinkAbsen.style.display = 'block';
            } else if (barisLinkAbsen) {
                barisLinkAbsen.style.display = 'none';
            }
        } else {
            alert("Gagal dari server: " + (data.error || data.message));
            resetForm();
        }
    })
    .catch(error => {
        document.getElementById('panel-loading').style.display = 'none';
        alert("Error Sistem: " + error.message);
        resetForm();
    });
}

function resetForm() {
    document.querySelectorAll('#tab-buat .control-card')[0].style.display = 'block';
    document.getElementById('panel-loading').style.display = 'none';
    document.getElementById('panel-hasil').style.display = 'none';
    document.getElementById('input-topik').value = '';
    akunTerpilih = null;
    document.getElementById('btn-buat').disabled = true;
    generateKotakAkun();
}

function bukaTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    btnElement.classList.add('active');
}

function logout() { window.logout(); }

function hitungDurasi(mulai, selesai) {
    let m = mulai.split(':'), s = selesai.split(':');
    let selisih = (parseInt(s[0]) * 60 + parseInt(s[1])) - (parseInt(m[0]) * 60 + parseInt(m[1]));
    let jam = Math.floor(selisih / 60), menit = selisih % 60;
    return jam > 0 ? `${jam} jam ${menit > 0 ? menit + ' menit' : ''}` : `${menit} menit`;
}

function formatTanggalIndo(tglString) {
    return new Date(tglString).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function copyHasilMeeting() {
    const teks = document.getElementById('teks-hasil-meeting').innerText;
    navigator.clipboard.writeText(teks).then(() => alert("✅ Teks berhasil di-copy!")).catch(() => alert("Gagal men-copy teks."));
}

let semuaDataMeeting = []; 

function muatSemuaRiwayat() {
    const container = document.getElementById('list-meeting-rekaman');
    const btn = document.getElementById('btn-load-rekaman');
    container.innerHTML = '<p style="text-align:center; color:#666;">🔄 Memuat daftar meeting...</p>';
    btn.disabled = true; btn.innerText = 'Memuat...';

    fetch('http://127.0.0.1:5000/api/riwayat-meeting', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userAktif.email, nama: userAktif.nama })
    })
    .then(res => res.json())
    .then(data => {
        btn.disabled = false; btn.innerText = '🔄 Cek Seluruh Rekaman';
        semuaDataMeeting = data.data || [];
        renderDaftarMeeting(semuaDataMeeting);
    })
    .catch(err => {
        btn.disabled = false; btn.innerText = '🔄 Cek Seluruh Rekaman';
        container.innerHTML = '<p style="color:red; text-align:center;">Gagal memuat riwayat.</p>';
    });
}

function renderDaftarMeeting(data) {
    const container = document.getElementById('list-meeting-rekaman');
    container.innerHTML = '';
    if (data.length === 0) { container.innerHTML = '<p style="text-align:center; color:#666;">Tidak ada meeting ditemukan.</p>'; return; }

    data.forEach(mt => {
        const btn = document.createElement('button');
        btn.className = 'btn-cancel';
        btn.style.textAlign = 'left'; btn.style.padding = '15px'; btn.style.marginBottom = '5px';
        btn.innerHTML = `<strong>${mt.topik}</strong><br><small>Akun: ${mt.akun} | Tanggal: ${mt.tanggal} | Kode: ${mt.meeting_code}</small>`;
        btn.onclick = () => cariRekamanVideo(mt.meeting_code, mt.topik);
        container.appendChild(btn);
    });
}

function filterDaftarRekaman() {
    const keyword = document.getElementById('input-search-rekaman').value.toLowerCase();
    const filtered = semuaDataMeeting.filter(mt => 
        mt.topik.toLowerCase().includes(keyword) || mt.meeting_code.toLowerCase().includes(keyword) || mt.akun.toLowerCase().includes(keyword)
    );
    renderDaftarMeeting(filtered);
}

function cariRekamanVideo(meetingCode, topik) {
    const panel = document.getElementById('panel-rekaman');
    const box = document.getElementById('hasil-rekaman-box');
    panel.style.display = 'block';
    box.innerHTML = '<p>🔄 Mencari file video di Google Drive...</p>';

    fetch('http://127.0.0.1:5000/api/cari-rekaman', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_code: meetingCode })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.found) {
            let html = `<p style="margin-bottom: 15px;"><strong>Topik:</strong> ${topik}</p>`;
            data.videos.forEach(v => {
                html += `
                    <div style="background: #F8F9FA; padding: 15px; border-radius: 8px; border-left: 4px solid var(--hijau-tosca); display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div><p style="margin: 0;"><strong>${v.file_name}</strong></p><p style="margin: 0; font-size: 0.85rem; color: #666;">Ukuran: ${v.size_mb} MB</p></div>
                        <a href="${v.link}" target="_blank" class="btn-primary" style="padding: 8px 15px; font-size: 0.9rem; text-decoration: none;">▶️ Buka</a>
                    </div>`;
            });
            box.innerHTML = html;
        } else {
            box.innerHTML = `<p><strong>Topik:</strong> ${topik}</p><p style="color:#DC2626; padding: 10px; background: #FEE2E2; border-radius: 5px;">❌ ${data.message || 'Rekaman video belum tersedia.'}</p>`;
        }
    })
    .catch(err => { box.innerHTML = '<p style="color:red;">Terjadi kesalahan jaringan.</p>'; });
}

function tutupPanelRekaman() { document.getElementById('panel-rekaman').style.display = 'none'; }