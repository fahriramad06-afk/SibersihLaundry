// ============================================================
// 1. FIREBASE CONFIGURATION (DARI CONSOLE LO)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDI7mUGXl7AjfOTU-T9GSCAdVHMAtuK10E",
    authDomain: "laundry-lo.firebaseapp.com",
    databaseURL: "https://laundry-lo-default-rtdb.firebaseio.com",
    projectId: "laundry-lo",
    storageBucket: "laundry-lo.firebasestorage.app",
    messagingSenderId: "207379110093",
    appId: "1:207379110093:web:cab19dcf7e60a5e775b184",
    measurementId: "G-LZYZX2Z4Z5"
};

// Nyalain Mesin Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================================
// 2. VARIABEL GLOBAL & LOGAL STORAGE
// ============================================================
const HARGA_PER_KG = 7000;
let dataLaundry = JSON.parse(localStorage.getItem('laundryData')) || [];
let dataOnline = JSON.parse(localStorage.getItem('onlineOrders')) || [];

let tempTelp = "";
let tempAlamat = "";
let tempOngkir = 0;
let tempJarak = 0;

// ============================================================
// 3. REAL-TIME LISTENER (DARI CLOUD KE DASHBOARD)
// ============================================================

// Pantau Pesanan Online yang Masuk
db.ref('onlineOrders').on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
        dataOnline = Object.keys(val).map(key => ({
            ...val[key],
            firebaseId: key 
        }));
        localStorage.setItem('onlineOrders', JSON.stringify(dataOnline));
        renderAll();
    }
});

// Pantau Antrian Utama
db.ref('laundryData').on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
        dataLaundry = Object.keys(val).map(key => ({...val[key], firebaseId: key}));
        localStorage.setItem('laundryData', JSON.stringify(dataLaundry));
        renderAll();
    }
});

// ============================================================
// 4. FUNGSI LOGIKA (GABUNGAN SEMUA FITUR)
// ============================================================

function cekLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');

    if (user === "admin" && pass === "fahriram403339") {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        errorMsg.style.display = 'none';
        renderAll(); 
    } else {
        errorMsg.style.display = 'block';
        errorMsg.innerText = "Username atau Sandi Error";
    }
}

// Fitur Tekan Enter untuk Login
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        if(document.getElementById('login-screen').style.display !== 'none') {
            cekLogin();
        }
    }
});

function showPage(pageId, btnElement) {
    document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
        document.getElementById('page-title').innerText = btnElement.innerText;
    }
    renderAll();
}

function toggleInputMode() {
    const t = document.getElementById('tipe-cuci').value;
    document.getElementById('group-kiloan').style.display = (t === 'kiloan') ? 'block' : 'none';
    document.getElementById('group-satuan').style.display = (t === 'satuan') ? 'block' : 'none';
    hitungHarga();
}

function hitungOngkirLogic(jarak) {
    let ongkir = 0;
    if (jarak > 0) {
        ongkir = Math.ceil(jarak / 2) * 2000;
        if (ongkir > 10000) ongkir = 10000;
    }
    return ongkir;
}

function hitungHarga() {
    const t = document.getElementById('tipe-cuci').value;
    const manualJarak = parseFloat(document.getElementById('manual-jarak').value) || 0;
    
    let jarakFix = tempJarak > 0 ? tempJarak : manualJarak;
    let ongkirFix = hitungOngkirLogic(jarakFix);

    let baseTotal = 0;
    if (t === 'kiloan') {
        const berat = document.getElementById('berat').value || 0;
        baseTotal = berat * HARGA_PER_KG;
    } else {
        baseTotal = parseInt(document.getElementById('jenis-bahan').value) || 0;
    }

    let totalAkhir = baseTotal + ongkirFix;
    document.getElementById('label-ongkir').innerText = "Ongkir: Rp " + ongkirFix.toLocaleString();
    document.getElementById('displayHarga').innerText = "Rp " + totalAkhir.toLocaleString();
    return { total: totalAkhir, ongkir: ongkirFix, jarak: jarakFix };
}

function prosesOnline(id) {
    const order = dataOnline.find(o => o.id === id);
    if (!order) return;

    document.getElementById('nama').value = order.nama;
    document.getElementById('manual-telp').value = order.telp; 
    document.getElementById('manual-alamat').value = order.alamat;
    document.getElementById('manual-jarak').value = order.jarak;
    
    tempTelp = order.telp;
    tempAlamat = order.alamat;
    tempOngkir = order.ongkir;
    tempJarak = order.jarak;
    
    if (order.tipeAsli === 'kiloan') {
        document.getElementById('tipe-cuci').value = 'kiloan';
        document.getElementById('berat').value = order.beratAsli;
    } else {
        document.getElementById('tipe-cuci').value = 'satuan';
        const selBahan = document.getElementById('jenis-bahan');
        for (let i = 0; i < selBahan.options.length; i++) {
            if (selBahan.options[i].text === order.tipeAsli) {
                selBahan.selectedIndex = i; break;
            }
        }
    }

    toggleInputMode();
    
    // Hapus dari Firebase (pindah ke antrian lokal/cloud utama)
    if(order.firebaseId) {
        db.ref('onlineOrders/' + order.firebaseId).remove();
    }

    dataOnline = dataOnline.filter(o => o.id !== id);
    localStorage.setItem('onlineOrders', JSON.stringify(dataOnline));
    showPage('input-page', document.querySelectorAll('.nav-btn')[0]);
}

function tambahPesanan() {
    const n = document.getElementById('nama').value;
    const tlpManual = document.getElementById('manual-telp').value; 
    if(!n) return alert("Nama pelanggan wajib diisi!");

    const res = hitungHarga();
    const t = document.getElementById('tipe-cuci').value;
    const almtManual = document.getElementById('manual-alamat').value;

    let detail = "";
    if(t === 'kiloan') {
        detail = (document.getElementById('berat').value || 0) + " Kg";
    } else {
        const sel = document.getElementById('jenis-bahan');
        detail = sel.options[sel.selectedIndex].text;
    }

    const newOrder = { 
        id: Date.now(), 
        nama: n, 
        telp: tlpManual || tempTelp || "-", 
        alamat: almtManual || tempAlamat || "-", 
        ongkir: res.ongkir,
        jarak: res.jarak,
        detail, 
        total: res.total, 
        status: 'Proses',
        waktuSelesai: null 
    };

    // KIRIM KE FIREBASE
    db.ref('laundryData/' + newOrder.id).set(newOrder);
    
    // Reset Form
    tempTelp = ""; tempAlamat = ""; tempOngkir = 0; tempJarak = 0;
    document.getElementById('nama').value = "";
    document.getElementById('manual-telp').value = ""; 
    document.getElementById('manual-alamat').value = "";
    document.getElementById('manual-jarak').value = "";
    if(document.getElementById('berat')) document.getElementById('berat').value = "";
    
    alert("Berhasil disimpan ke Cloud!");
}

function selesaikan(id) {
    db.ref('laundryData/' + id).update({
        status: 'Selesai',
        waktuSelesai: Date.now()
    });
}

function hapusRiwayat(id) {
    if(confirm("Hapus data ini dari Cloud?")) {
        db.ref('laundryData/' + id).remove();
    }
}

function hapusSemuaRiwayat() {
    if(confirm("Hapus semua riwayat yang sudah SELESAI?")) {
        dataLaundry.forEach(item => {
            if(item.status === 'Selesai') {
                db.ref('laundryData/' + item.id).remove();
            }
        });
    }
}

function renderAll() {
    const tbO = document.getElementById('daftarOnline');
    const tbA = document.getElementById('daftarPesanan');
    const tbH = document.getElementById('daftarSelesai');

    if(tbO) {
        tbO.innerHTML = "";
        dataOnline.forEach(item => {
            tbO.innerHTML += `<tr>
                <td data-label="PELANGGAN"><strong>${item.nama}</strong></td>
                <td data-label="INFO">Jarak: ${item.jarak} km<br>Ongkir: Rp ${item.ongkir.toLocaleString()}</td>
                <td><button onclick="prosesOnline(${item.id})" style="background:var(--sky); border:none; padding:5px 10px; border-radius:8px; cursor:pointer;">Proses</button></td>
            </tr>`;
        });
    }

    if(tbA && tbH) {
        tbA.innerHTML = ""; tbH.innerHTML = "";
        
        dataLaundry.filter(i => i.status === 'Proses').forEach(item => {
            tbA.innerHTML += `<tr>
                <td data-label="PELANGGAN">${item.nama}</td>
                <td data-label="LAYANAN">${item.detail}</td>
                <td data-label="TOTAL">Rp ${item.total.toLocaleString()}</td>
                <td data-label="STATUS"><span style="color:orange;">● Proses</span></td>
                <td><button onclick="selesaikan(${item.id})" style="color:green; border:none; background:none; cursor:pointer; font-weight:bold;">Selesai</button></td>
            </tr>`;
        });

        dataLaundry.filter(i => i.status === 'Selesai').sort((a,b) => b.waktuSelesai - a.waktuSelesai).forEach(item => {
            tbH.innerHTML += `<tr>
                <td data-label="PELANGGAN">${item.nama}</td>
                <td data-label="TOTAL">Rp ${item.total.toLocaleString()}</td>
                <td style="display:flex; gap:5px;">
                    <button onclick="lihatDetail(${item.id})" style="background:var(--deep-blue); color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Detail</button>
                    <button onclick="hapusRiwayat(${item.id})" style="background:#ff5252; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Hapus</button>
                </td>
            </tr>`;
        });
    }
}

function lihatDetail(id) {
    const item = dataLaundry.find(i => i.id === id);
    if(!item) return;

    const detailBox = document.getElementById('isi-detail');
    const modal = document.getElementById('modal-detail');

    if (detailBox && modal) {
        detailBox.innerHTML = `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; border-left: 5px solid var(--deep-blue);">
                <p><strong>🆔 Order ID:</strong> ${item.id}</p>
                <p><strong>👤 Nama:</strong> ${item.nama}</p>
                <p><strong>📞 No. Telp:</strong> ${item.telp || "-"}</p>
                <p><strong>📍 Alamat:</strong> ${item.alamat || "-"}</p>
                <hr style="margin: 10px 0; opacity: 0.2;">
                <p><strong>🧺 Layanan:</strong> ${item.detail}</p>
                <p><strong>📏 Jarak:</strong> ${item.jarak} km</p>
                <p><strong>🚚 Ongkir:</strong> Rp ${item.ongkir.toLocaleString()}</p>
                <h3 style="margin-top:10px; color: var(--deep-blue);">Total Bayar: Rp ${item.total.toLocaleString()}</h3>
                <p style="font-size: 11px; margin-top: 10px; opacity: 0.6;">Selesai pada: ${item.waktuSelesai ? new Date(item.waktuSelesai).toLocaleString('id-ID') : '-'}</p>
            </div>`;
        modal.style.display = 'flex';
    }
}

function tutupModal() { document.getElementById('modal-detail').style.display = 'none'; }
function saveData() { renderAll(); } // Hanya render karena sudah auto-sync cloud

renderAll();