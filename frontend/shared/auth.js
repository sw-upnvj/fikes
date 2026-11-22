// shared/auth.js

// KUNCI PENYIMPANAN SESI
const SESSION_KEY = "userSessionFIKES";
const CLIENT_ID = "25545982602-uf1e2dgiki7d337l65oe2t559b2oat3b.apps.googleusercontent.com"; // Client ID Kelas

// 1. FUNGSI SESSION
function saveSession(user, token) {
  if (!token) token = getToken();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user: user, token: token, savedAt: Date.now() }));
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getToken() { return getSession()?.token; }

// 2. FUNGSI CEK APAKAH SUDAH LOGIN (Dipakai di setiap halaman)
function checkAuth() {
  const session = getSession();
  if (!session || !session.user) {
    // Kalau belum login, tendang ke halaman login
    window.location.href = "../index.html"; 
    return null;
  }
  // Cek umur session (maksimal 7 hari)
  if (Date.now() - (session.savedAt || 0) > 1000 * 60 * 60 * 24 * 7) {
    clearSession();
    alert("Sesi Anda telah berakhir (7 hari). Silakan login ulang.");
    window.location.href = "../index.html";
    return null;
  }
  return session.user;
}

// 3. FUNGSI LOGOUT
function logout() {
  if (!confirm("Yakin ingin logout dari sistem?")) return;
  clearSession();
  if (window.google && google.accounts && google.accounts.id) { 
    try { google.accounts.id.disableAutoSelect(); } catch (err) {} 
  }
  window.location.href = "index.html";
}

// 4. FUNGSI CALLBACK LOGIN GOOGLE (Dipanggil dari index.html)
window.handleCredentialResponse = async function(response) {
  const idToken = response.credential;
  const loginError = document.getElementById("loginError");
  
  if(loginError) {
    loginError.innerText = "Memverifikasi akun Google..."; 
    loginError.style.color = "#1e3a5f"; 
    loginError.style.display = "block";
  }

  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const email = payload.email;
    
    // Cek domain
    if (!["upnvj.ac.id", "mahasiswa.upnvj.ac.id"].some(d => email.endsWith("@" + d))) {
      if(loginError) {
        loginError.innerText = "Hanya email @upnvj.ac.id atau @mahasiswa.upnvj.ac.id yang diizinkan."; 
        loginError.style.color = "#c0392b"; 
      }
      return;
    }

    // Cek ke Backend Apps Script
    const checkRes = await fetch(API_URL + "?action=checkUser&id_token=" + encodeURIComponent(idToken));
    const checkData = await checkRes.json();
    
    // Jika belum terdaftar
    if (checkData.success && !checkData.registered) { 
      alert("Email Anda belum terdaftar. Silakan hubungi admin atau daftar melalui aplikasi.");
      return; 
    }

    // Proses Login
    const formData = new URLSearchParams(); 
    formData.append("action", "login"); 
    formData.append("id_token", idToken);
    
    const res = await fetch(API_URL, { method: "POST", body: formData });
    const data = await res.json();

    if (data.allowed) {
      // Simpan Sesi
      saveSession(data, idToken); 
      // Pindah ke Beranda
      window.location.href = "beranda.html";
    } else { 
      if(loginError) {
        loginError.innerText = data.message; 
        loginError.style.color = "#c0392b"; 
      }
    }
  } catch (err) { 
    if(loginError) {
      loginError.innerText = "Gagal terhubung ke server."; 
      loginError.style.color = "#c0392b"; 
    }
  }
};

// 5. AUTO-REDIRECT JIKA SUDAH LOGIN (Dipanggil di index.html)
function redirectIfLoggedIn() {
  const session = getSession();
  if (session && session.user) {
    window.location.href = "beranda.html";
  }
}