// shared/auth.js

const SESSION_KEY = "userSessionFIKES";
const CLIENT_ID = "25545982602-uf1e2dgiki7d337l65oe2t559b2oat3b.apps.googleusercontent.com";

// 1. SESSION
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

// 2. CEK LOGIN
function checkAuth() {
  const session = getSession();
  const isSubfolder = window.location.pathname.includes("/kelas/") || window.location.pathname.includes("/meet/");
  const loginPath = isSubfolder ? "../index.html" : "index.html";

  if (!session || !session.user) {
    window.location.href = loginPath;
    return null;
  }
  if (Date.now() - (session.savedAt || 0) > 1000 * 60 * 60 * 24 * 7) {
    clearSession();
    alert("Sesi Anda telah berakhir (7 hari). Silakan login ulang.");
    window.location.href = loginPath;
    return null;
  }
  return session.user;
}

// 3. LOGOUT
function logout() {
  if (!confirm("Yakin ingin logout dari sistem?")) return;
  clearSession();
  if (window.google && google.accounts && google.accounts.id) {
    try { google.accounts.id.disableAutoSelect(); } catch (err) {}
  }
  const isSubfolder = window.location.pathname.includes("/kelas/") || window.location.pathname.includes("/meet/");
  window.location.href = isSubfolder ? "../index.html" : "index.html";
}

// 4. CALLBACK LOGIN GOOGLE
window.handleCredentialResponse = async function(response) {
  const idToken = response.credential;
  const loginError = document.getElementById("loginError");

  if (loginError) {
    loginError.innerText = "Memverifikasi akun Google...";
    loginError.style.color = "#1e3a5f";
    loginError.style.display = "block";
  }

  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const email = payload.email;

    if (!["upnvj.ac.id", "mahasiswa.upnvj.ac.id"].some(d => email.endsWith("@" + d))) {
      if (loginError) {
        loginError.innerText = "Hanya email @upnvj.ac.id atau @mahasiswa.upnvj.ac.id yang diizinkan.";
        loginError.style.color = "#c0392b";
      }
      return;
    }

    const checkRes = await fetch(API_URL + "?action=checkUser&id_token=" + encodeURIComponent(idToken));
    const checkData = await checkRes.json();

    if (checkData.success && !checkData.registered) {
      alert("Email Anda belum terdaftar. Silakan hubungi admin atau daftar melalui aplikasi.");
      return;
    }

    const formData = new URLSearchParams();
    formData.append("action", "login");
    formData.append("id_token", idToken);

    const res = await fetch(API_URL, { method: "POST", body: formData });
    const data = await res.json();

    if (data.allowed) {
      saveSession(data, idToken);
      window.location.href = "beranda.html";
    } else {
      if (loginError) {
        loginError.innerText = data.message;
        loginError.style.color = "#c0392b";
      }
    }
  } catch (err) {
    if (loginError) {
      loginError.innerText = "Gagal terhubung ke server.";
      loginError.style.color = "#c0392b";
    }
  }
};

// 5. AUTO-REDIRECT JIKA SUDAH LOGIN
function redirectIfLoggedIn() {
  const session = getSession();
  if (session && session.user) {
    window.location.href = "beranda.html";
  }
}

// 6. TOAST GLOBAL
function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, duration);
}
