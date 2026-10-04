(() => {
"use strict";

/* =========================================================
   Rapor Tahfidz — aplikasi web (Supabase + jsPDF)
   ========================================================= */

const cfg = window.APP_CONFIG || {};
const appEl = document.getElementById("app");
if (!cfg.SUPABASE_URL || /^ISI_/.test(cfg.SUPABASE_URL) || !cfg.SUPABASE_ANON_KEY || /^ISI_/.test(cfg.SUPABASE_ANON_KEY)) {
  appEl.innerHTML = '<div class="card" style="margin:16px"><h2>Konfigurasi belum diisi</h2><p>Buka file <b>public/config.js</b> lalu isi <b>SUPABASE_URL</b> dan <b>SUPABASE_ANON_KEY</b>.</p></div>';
  return;
}
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

/* ---------- Konstanta ---------- */
const PREDIKAT = ["Mumtaz", "Jayyid Jiddan", "Jayyid", "Maqbul"];
const SKOR = { "Mumtaz": 4, "Jayyid Jiddan": 3, "Jayyid": 2, "Maqbul": 1 };
const KETERANGAN = "Mumtaz = Istimewa | Jayyid Jiddan = Sangat Baik | Jayyid = Baik | Maqbul = Cukup";

const SURAH = [
["Al-Fatihah",7],["Al-Baqarah",286],["Ali Imran",200],["An-Nisa",176],["Al-Ma'idah",120],["Al-An'am",165],
["Al-A'raf",206],["Al-Anfal",75],["At-Taubah",129],["Yunus",109],["Hud",123],["Yusuf",111],["Ar-Ra'd",43],
["Ibrahim",52],["Al-Hijr",99],["An-Nahl",128],["Al-Isra",111],["Al-Kahfi",110],["Maryam",98],["Taha",135],
["Al-Anbiya",112],["Al-Hajj",78],["Al-Mu'minun",118],["An-Nur",64],["Al-Furqan",77],["Asy-Syu'ara",227],
["An-Naml",93],["Al-Qasas",88],["Al-Ankabut",69],["Ar-Rum",60],["Luqman",34],["As-Sajdah",30],["Al-Ahzab",73],
["Saba",54],["Fatir",45],["Yasin",83],["As-Saffat",182],["Sad",88],["Az-Zumar",75],["Gafir",85],["Fussilat",54],
["Asy-Syura",53],["Az-Zukhruf",89],["Ad-Dukhan",59],["Al-Jasiyah",37],["Al-Ahqaf",35],["Muhammad",38],
["Al-Fath",29],["Al-Hujurat",18],["Qaf",45],["Az-Zariyat",60],["At-Tur",49],["An-Najm",62],["Al-Qamar",55],
["Ar-Rahman",78],["Al-Waqi'ah",96],["Al-Hadid",29],["Al-Mujadalah",22],["Al-Hasyr",24],["Al-Mumtahanah",13],
["As-Saff",14],["Al-Jumu'ah",11],["Al-Munafiqun",11],["At-Tagabun",18],["At-Talaq",12],["At-Tahrim",12],
["Al-Mulk",30],["Al-Qalam",52],["Al-Haqqah",52],["Al-Ma'arij",44],["Nuh",28],["Al-Jinn",28],["Al-Muzzammil",20],
["Al-Muddassir",56],["Al-Qiyamah",40],["Al-Insan",31],["Al-Mursalat",50],["An-Naba",40],["An-Nazi'at",46],
["Abasa",42],["At-Takwir",29],["Al-Infitar",19],["Al-Mutaffifin",36],["Al-Insyiqaq",25],["Al-Buruj",22],
["At-Tariq",17],["Al-A'la",19],["Al-Gasyiyah",26],["Al-Fajr",30],["Al-Balad",20],["Asy-Syams",15],["Al-Lail",21],
["Ad-Duha",11],["Asy-Syarh",8],["At-Tin",8],["Al-Alaq",19],["Al-Qadr",5],["Al-Bayyinah",8],["Az-Zalzalah",8],
["Al-Adiyat",11],["Al-Qari'ah",11],["At-Takasur",8],["Al-Asr",3],["Al-Humazah",9],["Al-Fil",5],["Quraisy",4],
["Al-Ma'un",7],["Al-Kausar",3],["Al-Kafirun",6],["An-Nasr",3],["Al-Lahab",5],["Al-Ikhlas",4],["Al-Falaq",5],["An-Nas",6]
];
const SURAH_MAX = Object.fromEntries(SURAH);

/* ---------- State & helper ---------- */
const S = { profile: null, settings: {}, periode: [], periodeId: null, guru: null };
let loginMsg = "";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isKepala = () => S.profile && S.profile.role === "kepala";
const periodeNama = () => (S.periode.find((p) => p.id === S.periodeId) || {}).nama || "";
const fmtDate = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

let toastTimer;
function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ""), 3200);
}

function ago(d) {
  if (!d) return "belum ada aktivitas";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return m + " menit lalu";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " jam lalu";
  const dd = Math.floor(h / 24);
  if (dd < 30) return dd + " hari lalu";
  return fmtDate(d);
}

function loading() { appEl.innerHTML = '<div class="loading">Memuat…</div>'; }

function go(h) {
  if (location.hash === h) route();
  else location.hash = h;
}

function modal(title, body, okText, onOk) {
  const el = document.createElement("div");
  el.className = "modal";
  el.innerHTML = `<div class="sheet"><h3>${title}</h3>${body}<div class="row"><button class="ghost" data-x>Batal</button><button class="primary" data-ok>${okText}</button></div></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  $("[data-x]", el).onclick = close;
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  $("[data-ok]", el).onclick = async () => {
    const btn = $("[data-ok]", el);
    btn.disabled = true;
    try {
      const keep = await onOk(el);
      if (keep !== false) close();
    } catch (e) {
      toast(e.message || "Terjadi kesalahan", true);
    }
    btn.disabled = false;
  };
  return el;
}

async function callAdmin(action, payload) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Sesi habis, silakan login lagi.");
  const r = await fetch("/.netlify/functions/admin-users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
    body: JSON.stringify({ action, ...payload }),
  });
  let j = {};
  try { j = await r.json(); } catch (e) { /* abaikan */ }
  if (!r.ok) throw new Error(j.error || "Permintaan gagal.");
  return j;
}

/* ---------- Konteks login ---------- */
async function loadMeta() {
  const [st, per] = await Promise.all([
    sb.from("pengaturan").select("*").eq("id", 1).maybeSingle(),
    sb.from("periode").select("*").order("created_at", { ascending: false }),
  ]);
  S.settings = st.data || {};
  S.periode = per.data || [];
  const saved = localStorage.getItem("periodeId");
  const pick = S.periode.find((x) => x.id === S.periodeId) || S.periode.find((x) => x.id === saved) || S.periode.find((x) => x.aktif) || S.periode[0];
  S.periodeId = pick ? pick.id : null;
}

async function loadContext() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return false;
  const { data: p, error } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (error || !p || !p.aktif) {
    loginMsg = !p ? "Akun ini belum terdaftar. Hubungi kepala tahfidz." : !p.aktif ? "Akun dinonaktifkan. Hubungi kepala tahfidz." : "Gagal memuat akun.";
    await sb.auth.signOut();
    return false;
  }
  S.profile = p;
  S.guru = null;
  await loadMeta();
  return true;
}

async function guruMap() {
  if (S.guru) return S.guru;
  if (isKepala()) {
    const { data } = await sb.from("profiles").select("id,nama,email,role,aktif").order("nama");
    S.guru = Object.fromEntries((data || []).map((g) => [g.id, g]));
  } else {
    S.guru = { [S.profile.id]: S.profile };
  }
  return S.guru;
}

/* ---------- Kerangka halaman ---------- */
function shell(html, active) {
  const kep = isKepala();
  const tabs = kep
    ? [["#/", "Dashboard", "▦"], ["#/kelas", "Rapor", "▤"], ["#/akun", "Akun", "☺"], ["#/pengaturan", "Atur", "⚙"]]
    : [["#/kelas", "Kelas", "▤"]];
  const opts = S.periode.map((p) => `<option value="${p.id}" ${p.id === S.periodeId ? "selected" : ""}>${esc(p.nama)}${p.aktif ? " (aktif)" : ""}</option>`).join("");
  appEl.innerHTML = `
    <header class="top"><div><b>Rapor Tahfidz</b><small>${esc(S.settings.nama_lembaga || "")}${S.settings.nama_lembaga ? " · " : ""}${esc(S.profile.nama)}</small></div><button class="ghost" id="logout">Keluar</button></header>
    <div class="periode"><label for="periodeSel">Semester</label><select id="periodeSel">${opts || "<option>(belum ada semester)</option>"}</select></div>
    <nav class="nav">${tabs.map((t) => `<a href="${t[0]}" class="${active === t[0] ? "on" : ""}"><span>${t[2]}</span>${t[1]}</a>`).join("")}</nav>
    <main>${html}</main>`;
  $("#logout").onclick = async () => { await sb.auth.signOut(); S.profile = null; S.guru = null; loginMsg = ""; go("#/login"); };
  $("#periodeSel").onchange = (e) => { S.periodeId = e.target.value; localStorage.setItem("periodeId", S.periodeId); route(); };
}

function noPeriode() {
  return `<div class="card"><h3>Belum ada semester</h3><p class="muted">${isKepala() ? 'Tambahkan semester di menu <a href="#/pengaturan">Atur</a> terlebih dahulu.' : "Minta kepala tahfidz menambahkan semester."}</p></div>`;
}

/* ---------- Login ---------- */
function viewLogin(msg) {
  appEl.innerHTML = `
    <div class="login"><h1>Rapor Tahfidz</h1><p class="muted">Masuk dengan akun guru atau kepala tahfidz.</p>
    <form id="f"><label for="em">Email</label><input type="email" id="em" autocomplete="username" required>
    <label for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" required>
    <button class="primary" id="btn">Masuk</button><p class="err" id="err">${esc(msg || "")}</p></form></div>`;
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#btn");
    btn.disabled = true;
    loginMsg = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    if (error) { $("#err").textContent = "Email atau password salah."; btn.disabled = false; return; }
    S.profile = null;
    location.hash === "#/" ? route() : (location.hash = "#/");
  };
}

/* =========================================================
   Daftar kelas & siswa
   ========================================================= */
function badgeFor(r) {
  if (!r) return '<em class="badge belum">Belum diisi</em>';
  if (r.status === "selesai") return `<em class="badge selesai">${esc(r.predikat || "Selesai")}</em>`;
  return '<em class="badge draft">Draft</em>';
}

async function viewKelas(onlyId) {
  loading();
  if (!S.periodeId) return shell(noPeriode(), "#/kelas");
  const [k, s, r, gm] = await Promise.all([
    sb.from("kelas").select("id,nama,guru_id").order("nama"),
    sb.from("siswa").select("id,nama,nis,kelas_id").eq("aktif", true).order("nama"),
    sb.from("rapor").select("siswa_id,status,predikat,updated_at").eq("periode_id", S.periodeId),
    guruMap(),
  ]);
  if (k.error || s.error || r.error) return shell('<div class="card">Gagal memuat data. Coba muat ulang.</div>', "#/kelas");
  const raporBy = Object.fromEntries((r.data || []).map((x) => [x.siswa_id, x]));
  let kelas = k.data || [];
  if (onlyId) kelas = kelas.filter((x) => x.id === onlyId);

  let html = "";
  if (onlyId) html += '<a class="back" href="#/kelas">← Semua kelas</a>';
  if (!kelas.length) {
    html += `<div class="card"><h3>Belum ada kelas</h3><p class="muted">${isKepala() ? 'Buat kelas di menu <a href="#/akun">Akun</a>.' : "Belum ada kelas yang diberikan kepadamu. Hubungi kepala tahfidz."}</p></div>`;
  }
  kelas.forEach((c) => {
    const sis = (s.data || []).filter((x) => x.kelas_id === c.id);
    const done = sis.filter((x) => raporBy[x.id] && raporBy[x.id].status === "selesai").length;
    const pct = sis.length ? Math.round((done / sis.length) * 100) : 0;
    const g = gm[c.guru_id];
    html += `<section class="card">
      <div class="kh"><div><h3>${esc(c.nama)}</h3><small>Guru: ${esc(g ? g.nama : "belum ditentukan")}</small></div><div class="pct">${done}/${sis.length} selesai</div></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <ul class="list">${sis.map((x) => `<li><a href="#/rapor/${x.id}"><span>${esc(x.nama)}</span>${badgeFor(raporBy[x.id])}</a></li>`).join("") || '<li class="muted" style="padding:12px 2px">Belum ada siswa.</li>'}</ul>
      <div class="row"><button class="ghost" data-add="${c.id}">+ Tambah siswa</button><button class="ghost" data-pdf="${c.id}">Unduh PDF kelas</button></div>
    </section>`;
  });
  shell(html, "#/kelas");

  $$("[data-add]").forEach((b) => (b.onclick = () => tambahSiswa(b.dataset.add)));
  $$("[data-pdf]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { await pdfKelas(kelas.find((c) => c.id === b.dataset.pdf)); } catch (e) { toast(e.message, true); }
    b.disabled = false;
  }));
}

function tambahSiswa(kelasId) {
  modal("Tambah siswa",
    `<label>Satu siswa per baris. Boleh ditulis <b>Nama, NIS</b></label><textarea id="nm" placeholder="Ahmad Fauzi, 1023&#10;Siti Aisyah, 1024"></textarea>`,
    "Simpan",
    async (el) => {
      const lines = $("#nm", el).value.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) throw new Error("Isi minimal satu nama.");
      const rows = lines.map((l) => {
        const [nama, ...rest] = l.split(",");
        return { nama: nama.trim(), nis: rest.join(",").trim() || null, kelas_id: kelasId };
      });
      const { error } = await sb.from("siswa").insert(rows);
      if (error) throw new Error("Gagal menyimpan: " + error.message);
      toast(rows.length + " siswa ditambahkan ✓");
      route();
    });
}

async function pdfKelas(kelas) {
  const { data: sis } = await sb.from("siswa").select("id,nama,nis,kelas_id").eq("kelas_id", kelas.id).eq("aktif", true).order("nama");
  if (!sis || !sis.length) throw new Error("Belum ada siswa di kelas ini.");
  const { data: rap } = await sb.from("rapor").select("*").eq("periode_id", S.periodeId).in("siswa_id", sis.map((x) => x.id));
  const rb = Object.fromEntries((rap || []).map((x) => [x.siswa_id, x]));
  const gm = await guruMap();
  const items = sis.filter((x) => rb[x.id]).map((x) => ({ siswa: x, kelas, guru: (gm[kelas.guru_id] || {}).nama || "", rapor: rb[x.id] }));
  if (!items.length) throw new Error("Belum ada rapor yang diisi di kelas ini.");
  buildPdf(items).save(`Rapor-${kelas.nama}-${periodeNama()}.pdf`.replace(/[\\/:*?"<>|]+/g, "-"));
  const skip = sis.length - items.length;
  toast(skip ? `PDF dibuat (${skip} siswa belum ada rapor dilewati)` : "PDF dibuat ✓");
}

/* =========================================================
   Form rapor
   ========================================================= */
const predOpts = (val) => '<option value="">— pilih —</option>' + PREDIKAT.map((p) => `<option ${p === val ? "selected" : ""}>${p}</option>`).join("");
const surahOpts = (val) => '<option value="">— pilih surah —</option>' + SURAH.map(([n], i) => `<option value="${esc(n)}" ${n === val ? "selected" : ""}>${i + 1}. ${esc(n)}</option>`).join("");
const numOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

function hitungPredikat(a) {
  const v = [a.kelancaran, a.tajwid, a.makhraj].filter(Boolean).map((x) => SKOR[x]);
  if (v.length < 3) return "";
  const n = Math.round(v.reduce((x, y) => x + y, 0) / 3);
  return PREDIKAT.find((p) => SKOR[p] === n) || "";
}

async function viewRapor(siswaId) {
  loading();
  if (!S.periodeId) return shell(noPeriode(), "#/kelas");
  const { data: s } = await sb.from("siswa").select("id,nama,nis,kelas_id,kelas(id,nama,guru_id)").eq("id", siswaId).maybeSingle();
  if (!s) return shell('<div class="card">Siswa tidak ditemukan atau bukan kelasmu.</div>', "#/kelas");
  const { data: r } = await sb.from("rapor").select("*").eq("siswa_id", siswaId).eq("periode_id", S.periodeId).maybeSingle();
  const gm = await guruMap();
  const guruNama = (gm[s.kelas.guru_id] || {}).nama || "";
  const R = r || { status: "belum", setoran: [], hadir: 0, izin: 0, sakit: 0, alpa: 0 };
  const list = {
    baru: (R.setoran || []).filter((x) => x.jenis === "baru").map((x) => ({ surah: x.surah, dari: x.dari, sampai: x.sampai })),
    murojaah: (R.setoran || []).filter((x) => x.jenis === "murojaah").map((x) => ({ surah: x.surah, dari: x.dari, sampai: x.sampai })),
  };
  let siswa = { ...s };

  const rowHtml = (x) => `<div class="srow"><select class="sr-surah" aria-label="Surah">${surahOpts(x.surah)}</select>
    <div class="ay"><input type="number" inputmode="numeric" min="1" class="sr-dari" placeholder="Ayat dari" value="${x.dari ?? ""}"><span>–</span><input type="number" inputmode="numeric" min="1" class="sr-sampai" placeholder="Sampai" value="${x.sampai ?? ""}"></div>
    <button type="button" class="x" aria-label="Hapus baris">✕</button></div>`;

  const html = `
    <a class="back" href="#/kelas/${s.kelas_id}">← ${esc(s.kelas.nama)}</a>
    <section class="card">
      <div class="kh"><div><h2 id="hNama">${esc(siswa.nama)}</h2><small id="hNis">${siswa.nis ? "NIS " + esc(siswa.nis) + " · " : ""}${esc(s.kelas.nama)}</small></div><div id="hBadge">${badgeFor(r)}</div></div>
      <div class="row"><button class="ghost" id="editSiswa">Ubah data siswa</button><button class="ghost danger" id="hapusSiswa">Hapus siswa</button></div>
    </section>

    <section class="card"><h3>1. Setoran hafalan baru</h3><small>Kosongkan ayat jika satu surah penuh.</small>
      <div id="set-baru" style="margin-top:8px"></div><button type="button" class="ghost" id="add-baru" style="width:100%">+ Tambah setoran</button>
      <p class="muted" id="totAyat" style="margin:8px 0 0"></p></section>

    <section class="card"><h3>2. Murojaah</h3>
      <div id="set-murojaah" style="margin-top:8px"></div><button type="button" class="ghost" id="add-murojaah" style="width:100%">+ Tambah murojaah</button></section>

    <section class="card"><h3>3. Total & target</h3>
      <label for="total">Total hafalan saat ini</label><input id="total" placeholder="Contoh: Juz 30 dan 5 halaman Juz 29" value="${esc(R.total_hafalan || "")}">
      <label for="target">Target semester</label><input id="target" placeholder="Contoh: Juz 29" value="${esc(R.target || "")}"></section>

    <section class="card"><h3>4. Penilaian</h3>
      <label for="kelancaran">Kelancaran</label><select id="kelancaran">${predOpts(R.kelancaran)}</select>
      <label for="tajwid">Tajwid</label><select id="tajwid">${predOpts(R.tajwid)}</select>
      <label for="makhraj">Makhraj / Fashohah</label><select id="makhraj">${predOpts(R.makhraj)}</select>
      <label for="adab">Adab di halaqah (opsional)</label><select id="adab">${predOpts(R.adab)}</select>
      <p style="margin:12px 0 0">Predikat akhir: <span class="pred" id="predAkhir">—</span></p></section>

    <section class="card"><h3>5. Kehadiran</h3>
      <div class="grid4"><div><label for="hadir">Hadir</label><input id="hadir" type="number" inputmode="numeric" min="0" value="${R.hadir ?? 0}"></div>
      <div><label for="izin">Izin</label><input id="izin" type="number" inputmode="numeric" min="0" value="${R.izin ?? 0}"></div>
      <div><label for="sakit">Sakit</label><input id="sakit" type="number" inputmode="numeric" min="0" value="${R.sakit ?? 0}"></div>
      <div><label for="alpa">Alpa</label><input id="alpa" type="number" inputmode="numeric" min="0" value="${R.alpa ?? 0}"></div></div></section>

    <section class="card"><h3>6. Catatan ustadz/ustadzah</h3><textarea id="catatan" placeholder="Catatan perkembangan dan saran untuk orang tua">${esc(R.catatan || "")}</textarea></section>

    <div class="actions"><button class="ghost" id="bPdf">Unduh PDF</button><button class="ghost" id="bDraft">Simpan draft</button><button class="primary" id="bDone">Simpan & selesai</button></div>`;
  shell(html, "#/kelas");

  /* --- baris setoran --- */
  const renderSet = (j) => {
    const box = $("#set-" + j);
    box.innerHTML = list[j].map(rowHtml).join("") || '<p class="muted" style="margin:0 0 8px">Belum ada.</p>';
  };
  const readSet = (j) => {
    list[j] = $$(".srow", $("#set-" + j)).map((el) => ({
      surah: $(".sr-surah", el).value,
      dari: numOrNull($(".sr-dari", el).value),
      sampai: numOrNull($(".sr-sampai", el).value),
    }));
  };
  const hitungAyat = () => {
    readSet("baru");
    let n = 0;
    list.baru.forEach((x) => {
      if (!x.surah) return;
      const max = SURAH_MAX[x.surah];
      const d = x.dari ?? 1, e = x.sampai ?? max;
      if (e >= d) n += e - d + 1;
    });
    $("#totAyat").textContent = n ? `Total setoran baru semester ini: ${n} ayat` : "";
  };
  ["baru", "murojaah"].forEach((j) => {
    renderSet(j);
    $("#add-" + j).onclick = () => { readSet(j); list[j].push({ surah: "", dari: null, sampai: null }); renderSet(j); hitungAyat(); };
    $("#set-" + j).addEventListener("click", (e) => {
      const btn = e.target.closest(".x");
      if (!btn) return;
      readSet(j);
      const idx = $$(".srow", $("#set-" + j)).indexOf(btn.closest(".srow"));
      list[j].splice(idx, 1);
      renderSet(j);
      hitungAyat();
    });
    $("#set-" + j).addEventListener("input", hitungAyat);
    $("#set-" + j).addEventListener("change", hitungAyat);
  });
  hitungAyat();

  const updPred = () => {
    const p = hitungPredikat({ kelancaran: $("#kelancaran").value, tajwid: $("#tajwid").value, makhraj: $("#makhraj").value });
    $("#predAkhir").textContent = p || "—";
  };
  ["kelancaran", "tajwid", "makhraj"].forEach((id) => ($("#" + id).onchange = updPred));
  updPred();

  /* --- kumpulkan & validasi --- */
  const collect = () => {
    readSet("baru"); readSet("murojaah");
    const g = (id) => $("#" + id).value;
    const n = (id) => Math.max(0, parseInt(g(id), 10) || 0);
    const o = {
      kelancaran: g("kelancaran") || null, tajwid: g("tajwid") || null, makhraj: g("makhraj") || null, adab: g("adab") || null,
      total_hafalan: g("total").trim() || null, target: g("target").trim() || null,
      hadir: n("hadir"), izin: n("izin"), sakit: n("sakit"), alpa: n("alpa"),
      catatan: g("catatan").trim() || null,
      setoran: [
        ...list.baru.map((x) => ({ jenis: "baru", ...x })),
        ...list.murojaah.map((x) => ({ jenis: "murojaah", ...x })),
      ].filter((x) => x.surah),
    };
    o.predikat = hitungPredikat(o) || null;
    return o;
  };
  const validate = (o) => {
    for (const x of o.setoran) {
      const max = SURAH_MAX[x.surah];
      if (x.dari == null && x.sampai == null) { x.dari = 1; x.sampai = max; continue; }
      if (x.dari == null || x.sampai == null) return `Lengkapi ayat dari dan sampai untuk surah ${x.surah}.`;
      if (x.dari < 1 || x.sampai > max || x.dari > x.sampai) return `Ayat surah ${x.surah} tidak valid (1–${max}).`;
    }
    return "";
  };

  const save = async (status) => {
    const o = collect();
    const bad = validate(o);
    if (bad) return toast(bad, true);
    if (status === "selesai" && !o.predikat) return toast("Lengkapi kelancaran, tajwid, dan makhraj dulu.", true);
    const row = { ...o, siswa_id: siswa.id, periode_id: S.periodeId, status, updated_by: S.profile.id, updated_at: new Date().toISOString() };
    const { error } = await sb.from("rapor").upsert(row, { onConflict: "siswa_id,periode_id" });
    if (error) return toast("Gagal menyimpan: " + error.message, true);
    $("#hBadge").innerHTML = badgeFor(row);
    toast(status === "selesai" ? "Rapor selesai ✓" : "Draft tersimpan ✓");
  };
  const lock = (b, fn) => async () => { b.disabled = true; try { await fn(); } finally { b.disabled = false; } };
  $("#bDraft").onclick = lock($("#bDraft"), () => save("draft"));
  $("#bDone").onclick = lock($("#bDone"), () => save("selesai"));
  $("#bPdf").onclick = () => {
    const o = collect();
    const bad = validate(o);
    if (bad) return toast(bad, true);
    try {
      buildPdf([{ siswa, kelas: s.kelas, guru: guruNama, rapor: { ...o, status: R.status } }]).save(`Rapor-${siswa.nama}-${periodeNama()}.pdf`.replace(/[\\/:*?"<>|]+/g, "-"));
    } catch (e) { toast("Gagal membuat PDF: " + e.message, true); }
  };

  /* --- ubah / hapus siswa --- */
  $("#editSiswa").onclick = () => modal("Ubah data siswa",
    `<label>Nama</label><input id="enm" value="${esc(siswa.nama)}"><label>NIS</label><input id="enis" value="${esc(siswa.nis || "")}">`,
    "Simpan", async (el) => {
      const nama = $("#enm", el).value.trim();
      if (!nama) throw new Error("Nama tidak boleh kosong.");
      const nis = $("#enis", el).value.trim() || null;
      const { error } = await sb.from("siswa").update({ nama, nis }).eq("id", siswa.id);
      if (error) throw new Error(error.message);
      siswa = { ...siswa, nama, nis };
      $("#hNama").textContent = nama;
      $("#hNis").textContent = (nis ? "NIS " + nis + " · " : "") + s.kelas.nama;
      toast("Data siswa diperbarui ✓");
    });
  $("#hapusSiswa").onclick = async () => {
    if (!confirm(`Hapus ${siswa.nama}? Semua rapornya di semua semester ikut terhapus dan tidak bisa dikembalikan.`)) return;
    const { error } = await sb.from("siswa").delete().eq("id", siswa.id);
    if (error) return toast("Gagal menghapus: " + error.message, true);
    toast("Siswa dihapus");
    go("#/kelas/" + s.kelas_id);
  };
}

/* =========================================================
   Dashboard kepala
   ========================================================= */
async function viewDashboard() {
  loading();
  if (!S.periodeId) return shell(noPeriode(), "#/");
  const [k, s, r, gm] = await Promise.all([
    sb.from("kelas").select("id,nama,guru_id").order("nama"),
    sb.from("siswa").select("id,kelas_id").eq("aktif", true),
    sb.from("rapor").select("siswa_id,status,updated_at").eq("periode_id", S.periodeId),
    guruMap(),
  ]);
  if (k.error || s.error || r.error) return shell('<div class="card">Gagal memuat data.</div>', "#/");
  const raporBy = Object.fromEntries((r.data || []).map((x) => [x.siswa_id, x]));

  const agg = (siswaList) => {
    let selesai = 0, draft = 0, last = null;
    siswaList.forEach((x) => {
      const rp = raporBy[x.id];
      if (!rp) return;
      if (rp.status === "selesai") selesai++; else draft++;
      if (!last || rp.updated_at > last) last = rp.updated_at;
    });
    return { total: siswaList.length, selesai, draft, belum: siswaList.length - selesai - draft, last };
  };
  const kelasRows = (k.data || []).map((c) => ({ c, a: agg((s.data || []).filter((x) => x.kelas_id === c.id)) }));
  const all = agg(s.data || []);
  const pctOf = (a) => (a.total ? Math.round((a.selesai / a.total) * 100) : 0);
  const statusBadge = (a) => a.total && a.selesai === a.total ? '<em class="badge ok">Selesai</em>' : a.selesai + a.draft === 0 ? '<em class="badge bad">Belum mulai</em>' : '<em class="badge draft">Berjalan</em>';

  const guruList = Object.values(gm).filter((g) => g.role === "guru");
  const guruRows = guruList.map((g) => {
    const ks = kelasRows.filter((x) => x.c.guru_id === g.id);
    const a = agg((s.data || []).filter((x) => ks.some((kk) => kk.c.id === x.kelas_id)));
    return { g, ks, a };
  });

  let html = `<section class="card"><div class="kh"><div><h2>Progres rapor</h2><small>${esc(periodeNama())}</small></div><div class="big">${pctOf(all)}%</div></div>
    <div class="bar"><i style="width:${pctOf(all)}%"></i></div>
    <div class="stats"><div><b>${all.selesai}</b><small>Selesai</small></div><div><b>${all.draft}</b><small>Draft</small></div><div><b>${all.belum}</b><small>Belum diisi</small></div></div></section>`;

  html += "<h3 style='margin:16px 2px 8px'>Per kelas</h3>";
  html += kelasRows.map(({ c, a }) => `<a class="card" href="#/kelas/${c.id}" style="display:block;color:inherit">
    <div class="kh"><div><h3>${esc(c.nama)}</h3><small>Guru: ${esc((gm[c.guru_id] || {}).nama || "belum ditentukan")}</small></div>${statusBadge(a)}</div>
    <div class="bar"><i style="width:${pctOf(a)}%"></i></div><small>${a.selesai} selesai · ${a.draft} draft · ${a.belum} belum (dari ${a.total} siswa)</small></a>`).join("") || '<div class="card muted">Belum ada kelas.</div>';

  html += "<h3 style='margin:16px 2px 8px'>Progres per guru</h3>";
  html += guruRows.map(({ g, ks, a }) => `<div class="card"><div class="kh"><div><h3>${esc(g.nama)}${g.aktif ? "" : " (nonaktif)"}</h3>
    <small>${ks.length ? ks.map((x) => esc(x.c.nama)).join(", ") : "Belum memegang kelas"}</small></div>${ks.length ? statusBadge(a) : ""}</div>
    <div class="bar"><i style="width:${pctOf(a)}%"></i></div>
    <small>${a.selesai}/${a.total} selesai · aktivitas terakhir: ${ago(a.last)}</small></div>`).join("") || '<div class="card muted">Belum ada akun guru. Tambahkan di menu Akun.</div>';

  shell(html, "#/");
}

/* =========================================================
   Kelola akun & kelas (kepala)
   ========================================================= */
async function viewAkun() {
  loading();
  S.guru = null;
  const gm = await guruMap();
  const { data: kelas } = await sb.from("kelas").select("id,nama,guru_id").order("nama");
  const people = Object.values(gm).sort((a, b) => a.nama.localeCompare(b.nama));
  const gurus = people.filter((p) => p.aktif);
  const guruOpts = (sel) => '<option value="">(belum ada guru)</option>' + gurus.map((g) => `<option value="${g.id}" ${g.id === sel ? "selected" : ""}>${esc(g.nama)}</option>`).join("");

  const html = `
    <section class="card"><h2>Tambah akun</h2>
      <label>Nama lengkap</label><input id="anama" placeholder="Ust. Ahmad">
      <label>Email (untuk login)</label><input id="aemail" type="email" autocomplete="off">
      <label>Password awal (min. 6 karakter)</label><input id="apass" type="text" autocomplete="off">
      <label>Peran</label><select id="arole"><option value="guru">Guru</option><option value="kepala">Kepala tahfidz</option></select>
      <div class="row"><button class="primary" id="aadd">Buat akun</button></div></section>

    <h3 style="margin:16px 2px 8px">Daftar akun</h3>
    ${people.map((p) => `<div class="card"><div class="acc"><div><h3>${esc(p.nama)}</h3><small>${esc(p.email || "")}</small></div>
      <div><em class="badge ${p.role === "kepala" ? "draft" : "belum"}">${p.role === "kepala" ? "Kepala" : "Guru"}</em> <em class="badge ${p.aktif ? "ok" : "bad"}">${p.aktif ? "Aktif" : "Nonaktif"}</em></div></div>
      <div class="row"><button class="ghost" data-reset="${p.id}">Reset password</button>
      ${p.id === S.profile.id ? "" : `<button class="ghost ${p.aktif ? "danger" : ""}" data-aktif="${p.id}" data-val="${p.aktif ? 0 : 1}">${p.aktif ? "Nonaktifkan" : "Aktifkan"}</button>`}</div></div>`).join("")}

    <section class="card" style="margin-top:16px"><h2>Kelas / halaqah</h2>
      <label>Nama kelas baru</label><input id="knama" placeholder="Contoh: Halaqah Umar">
      <label>Guru pengampu</label><select id="kguru">${guruOpts("")}</select>
      <div class="row"><button class="primary" id="kadd">Tambah kelas</button></div></section>
    ${(kelas || []).map((c) => `<div class="card"><h3>${esc(c.nama)}</h3><label>Guru pengampu</label><select data-kguru="${c.id}">${guruOpts(c.guru_id)}</select></div>`).join("")}`;
  shell(html, "#/akun");

  $("#aadd").onclick = async (e) => {
    const b = e.target; b.disabled = true;
    try {
      await callAdmin("create", { nama: $("#anama").value, email: $("#aemail").value, password: $("#apass").value, role: $("#arole").value });
      toast("Akun dibuat ✓");
      route();
    } catch (err) { toast(err.message, true); b.disabled = false; }
  };
  $$("[data-reset]").forEach((b) => (b.onclick = () => modal("Reset password",
    '<label>Password baru (min. 6 karakter)</label><input id="npw" type="text" autocomplete="off">', "Simpan",
    async (el) => { await callAdmin("reset_password", { id: b.dataset.reset, password: $("#npw", el).value }); toast("Password diganti ✓"); })));
  $$("[data-aktif]").forEach((b) => (b.onclick = async () => {
    const on = b.dataset.val === "1";
    if (!on && !confirm("Nonaktifkan akun ini? Guru tidak bisa login lagi, datanya tetap aman.")) return;
    b.disabled = true;
    try { await callAdmin("set_aktif", { id: b.dataset.aktif, aktif: on }); toast(on ? "Akun diaktifkan ✓" : "Akun dinonaktifkan ✓"); route(); }
    catch (err) { toast(err.message, true); b.disabled = false; }
  }));
  $("#kadd").onclick = async () => {
    const nama = $("#knama").value.trim();
    if (!nama) return toast("Isi nama kelas.", true);
    const { error } = await sb.from("kelas").insert({ nama, guru_id: $("#kguru").value || null });
    if (error) return toast("Gagal: " + error.message, true);
    toast("Kelas ditambahkan ✓"); route();
  };
  $$("[data-kguru]").forEach((sel) => (sel.onchange = async () => {
    const { error } = await sb.from("kelas").update({ guru_id: sel.value || null }).eq("id", sel.dataset.kguru);
    toast(error ? "Gagal: " + error.message : "Guru kelas diperbarui ✓", !!error);
  }));
}

/* =========================================================
   Pengaturan (kepala)
   ========================================================= */
function fileToLogo(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 240, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function viewPengaturan() {
  loading();
  await loadMeta();
  const st = S.settings;
  let logo = st.logo || null;
  const html = `
    <section class="card"><h2>Data lembaga (tampil di kop rapor)</h2>
      <label>Nama lembaga</label><input id="snama" value="${esc(st.nama_lembaga || "")}" placeholder="TPQ / Sekolah ...">
      <label>Alamat</label><textarea id="salamat" style="min-height:70px">${esc(st.alamat || "")}</textarea>
      <label>Nama kepala tahfidz (untuk tanda tangan)</label><input id="skepala" value="${esc(st.nama_kepala || "")}">
      <label>Tempat (untuk tanggal rapor)</label><input id="stempat" value="${esc(st.tempat || "")}" placeholder="Contoh: Bandung">
      <label>Logo (opsional)</label><div id="logoBox"></div><input type="file" id="slogo" accept="image/*">
      <div class="row"><button class="ghost" id="logoDel">Hapus logo</button><button class="primary" id="ssave">Simpan</button></div></section>

    <section class="card"><h2>Semester</h2>
      ${S.periode.map((p) => `<div class="acc" style="padding:8px 0;border-top:1px solid var(--line)"><div><b>${esc(p.nama)}</b></div>
        ${p.aktif ? '<em class="badge ok">Aktif</em>' : `<button class="ghost" data-act="${p.id}" style="min-height:38px;padding:4px 12px">Jadikan aktif</button>`}</div>`).join("") || '<p class="muted">Belum ada semester.</p>'}
      <label>Tambah semester</label><input id="pnama" placeholder="Contoh: Ganjil 2026/2027">
      <div class="row"><button class="primary" id="padd">Tambah</button></div></section>`;
  shell(html, "#/pengaturan");

  const drawLogo = () => { $("#logoBox").innerHTML = logo ? `<img class="logo-prev" src="${logo}" alt="Logo">` : '<small class="muted">Belum ada logo.</small>'; };
  drawLogo();
  $("#slogo").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { logo = await fileToLogo(f); drawLogo(); } catch (err) { toast("Gambar tidak bisa dibaca.", true); }
  };
  $("#logoDel").onclick = () => { logo = null; drawLogo(); };
  $("#ssave").onclick = async () => {
    const row = { id: 1, nama_lembaga: $("#snama").value.trim(), alamat: $("#salamat").value.trim(), nama_kepala: $("#skepala").value.trim(), tempat: $("#stempat").value.trim(), logo };
    const { error } = await sb.from("pengaturan").upsert(row);
    if (error) return toast("Gagal: " + error.message, true);
    S.settings = row; toast("Pengaturan tersimpan ✓");
  };
  $$("[data-act]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.act;
    const a = await sb.from("periode").update({ aktif: false }).neq("id", id);
    const c = await sb.from("periode").update({ aktif: true }).eq("id", id);
    if (a.error || c.error) return toast("Gagal mengubah semester aktif.", true);
    S.periodeId = id; localStorage.setItem("periodeId", id);
    toast("Semester aktif diperbarui ✓"); route();
  }));
  $("#padd").onclick = async () => {
    const nama = $("#pnama").value.trim();
    if (!nama) return toast("Isi nama semester.", true);
    const { error } = await sb.from("periode").insert({ nama, aktif: S.periode.length === 0 });
    if (error) return toast("Gagal: " + error.message, true);
    toast("Semester ditambahkan ✓"); route();
  };
}

/* =========================================================
   PDF rapor (A4)
   ========================================================= */
function buildPdf(items) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  items.forEach((it, i) => {
    if (i > 0) doc.addPage();
    drawRapor(doc, it);
  });
  return doc;
}

function drawRapor(doc, { siswa, kelas, guru, rapor }) {
  const W = 210, M = 15, st = S.settings || {};
  let y = 14;

  // Kop
  if (st.logo) {
    try {
      const p = doc.getImageProperties(st.logo);
      const h = 20, w = (h * p.width) / p.height;
      doc.addImage(st.logo, "PNG", M, y - 2, w, h);
    } catch (e) { /* logo gagal dimuat, lanjutkan tanpa logo */ }
  }
  doc.setFont("helvetica", "bold").setFontSize(14).text((st.nama_lembaga || "LEMBAGA TAHFIDZ").toUpperCase(), W / 2, y + 4, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  if (st.alamat) doc.text(doc.splitTextToSize(st.alamat, 140), W / 2, y + 10, { align: "center" });
  y = 38;
  doc.setLineWidth(0.6).line(M, y, W - M, y);
  doc.setLineWidth(0.2).line(M, y + 1.2, W - M, y + 1.2);

  y += 9;
  doc.setFont("helvetica", "bold").setFontSize(13).text("RAPOR TAHFIDZ AL-QUR'AN", W / 2, y, { align: "center" });
  y += 5.5;
  doc.setFont("helvetica", "normal").setFontSize(10).text("Semester: " + periodeNama(), W / 2, y, { align: "center" });

  // Identitas
  y += 9;
  [["Nama", siswa.nama], ["NIS", siswa.nis], ["Kelas / Halaqah", kelas.nama], ["Pembimbing", guru]].forEach(([a, b]) => {
    doc.setFont("helvetica", "normal").setFontSize(10).text(a, M, y);
    doc.text(": " + (b || "-"), M + 38, y);
    y += 5.5;
  });
  y += 2;

  const tbl = (head, body, extra) => {
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.8, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      head: [head], body, ...extra,
    });
    y = doc.lastAutoTable.finalY + 6;
  };
  const heading = (t) => {
    if (y > 262) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold").setFontSize(10.5).text(t, M, y);
    y += 2.5;
  };
  const line = (label, val) => {
    doc.setFont("helvetica", "normal").setFontSize(10).text(label, M, y);
    doc.text(": " + (val || "-"), M + 42, y);
    y += 5.5;
  };

  const sets = rapor.setoran || [];
  const baru = sets.filter((x) => x.jenis === "baru");
  const muro = sets.filter((x) => x.jenis === "murojaah");

  heading("A. Setoran Hafalan Baru");
  tbl(["No", "Surah", "Ayat", "Jumlah"],
    baru.length ? baru.map((x, i) => [i + 1, x.surah, `${x.dari} - ${x.sampai}`, x.sampai - x.dari + 1]) : [["-", "Belum ada setoran", "-", "-"]],
    { columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 32, halign: "center" }, 3: { cellWidth: 24, halign: "center" } } });

  heading("B. Murojaah");
  tbl(["No", "Surah", "Ayat"],
    muro.length ? muro.map((x, i) => [i + 1, x.surah, `${x.dari} - ${x.sampai}`]) : [["-", "Belum ada murojaah", "-"]],
    { columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 32, halign: "center" } } });

  const jml = baru.reduce((a, x) => a + (x.sampai - x.dari + 1), 0);
  line("Setoran baru semester ini", jml ? jml + " ayat" : "-");
  line("Total hafalan saat ini", rapor.total_hafalan);
  line("Target semester", rapor.target);
  y += 2;

  heading("C. Penilaian");
  const nilai = [["Kelancaran", rapor.kelancaran || "-"], ["Tajwid", rapor.tajwid || "-"], ["Makhraj / Fashohah", rapor.makhraj || "-"]];
  if (rapor.adab) nilai.push(["Adab di halaqah", rapor.adab]);
  nilai.push([{ content: "PREDIKAT AKHIR", styles: { fontStyle: "bold" } }, { content: rapor.predikat || "-", styles: { fontStyle: "bold" } }]);
  tbl(["Aspek", "Predikat"], nilai, { columnStyles: { 1: { cellWidth: 55, halign: "center" } } });

  heading("D. Kehadiran");
  tbl(["Hadir", "Izin", "Sakit", "Alpa"], [[rapor.hadir ?? 0, rapor.izin ?? 0, rapor.sakit ?? 0, rapor.alpa ?? 0]],
    { styles: { fontSize: 9, cellPadding: 1.8, halign: "center", lineColor: [200, 200, 200] } });

  // Catatan
  const note = doc.splitTextToSize(rapor.catatan || "-", W - 2 * M - 6);
  const boxH = Math.max(14, note.length * 4.6 + 6);
  if (y + boxH + 50 > 285) { doc.addPage(); y = 20; }
  heading("E. Catatan");
  doc.setLineWidth(0.2).rect(M, y, W - 2 * M, boxH);
  doc.setFont("helvetica", "normal").setFontSize(10).text(note, M + 3, y + 5.5);
  y += boxH + 8;

  // Tanda tangan
  if (y + 42 > 285) { doc.addPage(); y = 20; }
  const tgl = (st.tempat ? st.tempat + ", " : "") + fmtDate(new Date());
  doc.setFont("helvetica", "normal").setFontSize(10).text(tgl, W - M, y, { align: "right" });
  y += 6;
  const cols = [[35, "Orang Tua / Wali", ""], [W / 2, "Guru Tahfidz", guru || ""], [W - 35, "Kepala Tahfidz", st.nama_kepala || ""]];
  cols.forEach(([cx, label, name]) => {
    doc.text(label, cx, y, { align: "center" });
    const ny = y + 26;
    doc.setFont("helvetica", "bold").text(name || "(................................)", cx, ny, { align: "center" });
    if (name) doc.setLineWidth(0.2).line(cx - 25, ny + 0.8, cx + 25, ny + 0.8);
    doc.setFont("helvetica", "normal");
  });

  doc.setFontSize(7.5).setTextColor(120).text("Keterangan: " + KETERANGAN, W / 2, 290, { align: "center" });
  doc.setTextColor(0);
}

/* =========================================================
   Router
   ========================================================= */
async function route() {
  if (!S.profile) {
    loading();
    if (!(await loadContext())) return viewLogin(loginMsg);
  }
  const h = location.hash || "#/";
  let m;
  if (h === "#/login") return go("#/");
  if ((m = h.match(/^#\/rapor\/([\w-]+)$/))) return viewRapor(m[1]);
  if ((m = h.match(/^#\/kelas(?:\/([\w-]+))?$/))) return viewKelas(m[1]);
  if (isKepala() && h === "#/akun") return viewAkun();
  if (isKepala() && h === "#/pengaturan") return viewPengaturan();
  if (h === "#/") return isKepala() ? viewDashboard() : viewKelas();
  go("#/");
}

window.addEventListener("hashchange", route);
sb.auth.onAuthStateChange((ev) => {
  if (ev === "SIGNED_OUT") { S.profile = null; }
});
route();

})();
