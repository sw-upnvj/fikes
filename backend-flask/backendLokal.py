import os
import re
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
import requests
import json

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) 

# ========== KONFIGURASI ==========
CREDENTIALS_FILE = 'credentials/google_credentials.json'

# ✅ DAFTAR URL (SAAT INI 1 DULU)
APPS_SCRIPT_URLS = {
    "GMeet 1": "https://script.google.com/macros/s/AKfycbz-Szf7PXSSJPSEAddGSfGksyjU49d_U0ASyepGZszXDtV9pQPmbb5-2yHh3197X-DmgA/exec" # GANTI DENGAN URL /exec GMEET 1
}

AKUN_MAP = {
    "GMeet 1":  "zoomfikes@upnvj.ac.id",
    "GMeet 2":  "zoomfikes2@upnvj.ac.id",
    "GMeet 3":  "zoomfikes3@upnvj.ac.id",
    "GMeet 4":  "zoomfikes4@upnvj.ac.id",
    "GMeet 5":  "zoomfikes5@upnvj.ac.id",
    "GMeet 6":  "zoomfikes6@upnvj.ac.id",
    "GMeet 7":  "zoomfikes7@upnvj.ac.id",
    "GMeet 8":  "zoomfikes8@upnvj.ac.id",
    "GMeet 9":  "zoomfikes9@upnvj.ac.id",
    "GMeet 10": "zoomfikes10@upnvj.ac.id",
    "GMeet 11": "zoomfikes11@upnvj.ac.id",
}

# Kredensial Calendar
try:
    scopes = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
    creds = service_account.Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
except Exception as e:
    print(f"❌ Gagal memuat credentials Calendar: {e}")

# ========== 1. FUNGSI DATABASE (LOGIN) ==========
def cek_login_sheets(email_input):
    try:
        # Kita pakai URL GMeet 1 untuk login
        url_login = APPS_SCRIPT_URLS["GMeet 1"]
        resp = requests.get(f"{url_login}?action=checkUser&email={email_input}", timeout=10)
        data = resp.json()
        
        if data.get("registered"):
            return {
                "success": True,
                "user": {
                    "email": data["user"]["email"],
                    "nama": data["user"]["name"],
                    "role": data["user"]["role"]
                }
            }
        else:
            return {"success": False, "error": "BELUM_TERDAFTAR", "message": "Email belum terdaftar."}
    except Exception as e:
        return {"success": False, "message": f"Error Database: {str(e)}"}

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    if not email: return jsonify({"success": False, "message": "Email kosong"}), 400
        
    hasil = cek_login_sheets(email)
    if hasil["success"]:
        return jsonify(hasil), 200
    else:
        if hasil.get("error") == "BELUM_TERDAFTAR":
            return jsonify(hasil), 404
        return jsonify(hasil), 500

# ========== 2. FUNGSI CEK JADWAL ==========
@app.route('/api/cek-jadwal', methods=['POST'])
def cek_jadwal():
    data = request.json
    tanggal = data.get('tanggal')
    jam_mulai = data.get('jam_mulai')
    jam_selesai = data.get('jam_selesai')
    user_email = data.get('email')
    user_nama = data.get('nama')

    hasil_jadwal = {}
    time_min = f"{tanggal}T{jam_mulai}:00+07:00"
    time_max = f"{tanggal}T{jam_selesai}:00+07:00"

    for akun, email in AKUN_MAP.items():
        try:
            delegated_creds = creds.with_subject(email)
            service = build('calendar', 'v3', credentials=delegated_creds)

            events_result = service.events().list(
                calendarId='primary', timeMin=time_min, timeMax=time_max,
                singleEvents=True, orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            if events:
                ev = events[0]
                topik = ev.get('summary', 'Tanpa Judul')
                desc = ev.get('description', '')
                is_milik_sendiri = (user_email in desc) or (user_nama in topik)

                pic_name = "Tidak diketahui"
                if "oleh " in desc:
                    pic_name = desc.split("oleh ")[1].split(".")[0]

                meet_link = ev.get('hangoutLink', '')
                mc = ''
                if meet_link:
                    m = re.search(r'meet\.google\.com/([a-z\-]+)', meet_link)
                    if m: mc = m.group(1)

                hasil_jadwal[akun] = {
                    "status": "terisi", "topik": topik, "pic": pic_name,
                    "waktu": f"{jam_mulai} - {jam_selesai}", "is_milik_sendiri": is_milik_sendiri,
                    "event_id": ev.get('id'), "meeting_code": mc
                }
            else:
                hasil_jadwal[akun] = {"status": "kosong"}
        except Exception as e:
            print(f"Error cek {akun}: {e}")
            hasil_jadwal[akun] = {"status": "error"}

    return jsonify({"success": True, "data": hasil_jadwal})

# ========== 3. FUNGSI BUAT MEETING ==========
@app.route('/api/buat-meeting', methods=['POST'])
def buat_meeting():
    data = request.json
    nama_akun = data.get('akun')
    tanggal = data.get('tanggal')
    jam_mulai = data.get('jam_mulai')
    jam_selesai = data.get('jam_selesai')
    topik = data.get('topik')
    pic = data.get('pic')
    email_pembuat = data.get('email_pembuat')

    email = AKUN_MAP.get(nama_akun)
    if not email: return jsonify({"success": False, "error": "Akun tidak valid"}), 400

    try:
        delegated_creds = creds.with_subject(email)
        service = build('calendar', 'v3', credentials=delegated_creds)

        event_body = {
            'summary': f"{topik} - ({pic})",
            'description': f'Dibuat via Web App FIKES oleh {pic} ({email_pembuat}).', 
            'start': {'dateTime': f"{tanggal}T{jam_mulai}:00", 'timeZone': 'Asia/Jakarta'},
            'end': {'dateTime': f"{tanggal}T{jam_selesai}:00", 'timeZone': 'Asia/Jakarta'},
            'conferenceData': {'createRequest': {'requestId': f"meet-{int(time.time())}-{email.split('@')[0]}", 'conferenceSolutionKey': {'type': 'hangoutsMeet'}}}
        }

        event = service.events().insert(calendarId='primary', body=event_body, conferenceDataVersion=1).execute()
        meet_link = event.get('hangoutLink', '')
        meeting_code = ''
        if meet_link:
            m = re.search(r'meet\.google\.com/([a-z\-]+)', meet_link)
            if m: meeting_code = m.group(1)

        link_absen = ""
        try:
            data_logbook = {
                "event_id": event.get('id'), "meeting_code": meeting_code, "email_pembuat": email_pembuat,
                "akun": nama_akun, "topik": topik, "tanggal": tanggal, "jam_mulai": jam_mulai,
                "jam_selesai": jam_selesai, "link": meet_link
            }
            
            payload_string = json.dumps(data_logbook)
            
            resp = requests.post(
                f"{APPS_SCRIPT_URLS['GMeet 1']}?action=gmeet_create", 
                data=payload_string,
                headers={"Content-Type": "application/json"}, 
                allow_redirects=True
            )
            
            print("=== BALASAN DARI APPS SCRIPT ===")
            print(resp.text)
            print("================================")

            try:
                resp_data = resp.json()
                # Jika Apps Script bilang gagal, kita print pesan errornya
                if not resp_data.get("success"):
                    print(f"❌ GAGAL DARI APPS SCRIPT: {resp_data.get('message')}")
                link_absen = resp_data.get("link_absen", "")
            except Exception as json_err:
                print(f"Gagal membaca format JSON: {json_err}")
                
        except Exception as e:
            print(f"⚠️ Gagal mencatat logbook: {e}")

        return jsonify({"success": True, "link": meet_link, "code": meeting_code, "email_akun": email, "link_absen": link_absen})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ========== 4. FUNGSI HAPUS MEETING ==========
@app.route('/api/hapus-meeting', methods=['POST'])
def hapus_meeting():
    data = request.json
    akun = data.get('akun')
    event_id = data.get('event_id')
    meeting_code = data.get('meeting_code', '')
    
    email = AKUN_MAP.get(akun)
    if not email or not event_id: return jsonify({"success": False, "error": "Data tidak valid"}), 400

    try:
        delegated_creds = creds.with_subject(email)
        service = build('calendar', 'v3', credentials=delegated_creds)
        service.events().delete(calendarId='primary', eventId=event_id).execute()

        try:
            # Pakai URL GMeet 1 untuk hapus logbook
            resp_hapus = requests.post(f"{APPS_SCRIPT_URLS['GMeet 1']}?action=gmeet_delete", json={"event_id": event_id, "meeting_code": meeting_code}, headers={"Content-Type": "application/json"}, allow_redirects=True)
            print("=== BALASAN HAPUS DARI APPS SCRIPT ===")
            print(resp_hapus.text)
            print("=====================================")
            print("✅ Status di Logbook diperbarui menjadi 'Dihapus'!")
        except Exception as e:
            print(f"⚠️ Gagal update Logbook: {e}")

        return jsonify({"success": True, "message": "Meeting dihapus"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ========== 5. FUNGSI RIWAYAT MEETING ==========
@app.route('/api/riwayat-meeting', methods=['POST'])
def riwayat_meeting():
    hasil = []
    time_min = (datetime.now() - timedelta(days=30)).isoformat() + 'Z'
    time_max = datetime.now().isoformat() + 'Z'

    for akun, email in AKUN_MAP.items():
        try:
            delegated_creds = creds.with_subject(email)
            service = build('calendar', 'v3', credentials=delegated_creds)
            events_result = service.events().list(calendarId='primary', timeMin=time_min, timeMax=time_max, singleEvents=True, orderBy='startTime').execute()
            
            for ev in events_result.get('items', []):
                topik = ev.get('summary', 'Tanpa Judul')
                meet_link = ev.get('hangoutLink', '')
                mc = ''
                if meet_link:
                    m = re.search(r'meet\.google\.com/([a-z\-]+)', meet_link)
                    if m: mc = m.group(1)
                
                if mc: 
                    start = ev.get('start', {}).get('dateTime', '')
                    tgl_formatted = start[:10] if start else ''
                    hasil.append({"akun": akun, "topik": topik, "tanggal": tgl_formatted, "meeting_code": mc, "event_id": ev.get('id')})
        except Exception as e:
            print(f"Error riwayat {akun}: {e}")

    hasil.sort(key=lambda x: x['tanggal'], reverse=True)
    return jsonify({"success": True, "data": hasil})

# ========== 6. FUNGSI CARI REKAMAN (BANYAK URL) ==========
@app.route('/api/cari-rekaman', methods=['POST'])
def cari_rekaman():
    data = request.json
    meeting_code = data.get('meeting_code', '').strip()
    tanggal = data.get('tanggal', '')
    
    if not meeting_code: return jsonify({"success": False, "message": "Meeting Code kosong"}), 400

    for akun_name, url in APPS_SCRIPT_URLS.items():
        try:
            print(f"🔄 Mencari rekaman di {akun_name}...")
            params = {"action": "cariRekaman", "meeting_code": meeting_code}
            if tanggal: params["tanggal"] = tanggal
            
            resp = requests.get(url, params=params, timeout=15)
            resp_data = resp.json()
            
            if resp_data.get("success") and resp_data.get("found"):
                print(f"✅ Rekaman ditemukan di {akun_name}!")
                return jsonify(resp_data)
                
        except Exception as e:
            print(f"⚠️ Gagal cek {akun_name}: {e}")

    return jsonify({"success": True, "found": False, "message": "Rekaman video tidak ditemukan di akun manapun."})

if __name__ == '__main__':
    print("🚀 Server Backend berjalan di http://127.0.0.1:5000")
    app.run(debug=True, port=5000)