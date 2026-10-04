# Rapor Tahfidz

Website rapor tahfidz untuk guru dan kepala tahfidz. Input per semester, tampilan HP, hasil bisa diunduh sebagai PDF A4 untuk dicetak.

**Peran**
- **Guru**: hanya melihat kelas miliknya, menambah siswa, mengisi rapor, mengunduh PDF.
- **Kepala tahfidz**: dashboard progres semua kelas dan guru, mengelola akun dan kelas, pengaturan lembaga dan semester, mengunduh PDF semua kelas.

**Teknologi**: HTML/JS biasa (tanpa build), Supabase (login + database), Netlify (hosting + 1 fungsi untuk kelola akun).

---

## Cara memasang (sekitar 15 menit)

### 1. Siapkan Supabase
1. Buat proyek baru di <https://supabase.com>.
2. Buka **SQL Editor**, tempel seluruh isi `supabase/schema.sql`, lalu **Run**.
3. Buka **Authentication → Providers → Email**:
   - matikan **Allow new users to sign up** (supaya orang luar tidak bisa mendaftar sendiri),
   - matikan **Confirm email** (opsional; akun dibuat kepala sudah otomatis terkonfirmasi).
4. Buat akun kepala pertama: **Authentication → Users → Add user** (isi email dan password, centang auto confirm). Salin **User UID**-nya.
5. Kembali ke **SQL Editor**, jalankan:
   ```sql
   insert into public.profiles (id, nama, email, role)
   values ('UID-DARI-LANGKAH-4', 'Kepala Tahfidz', 'email-kepala@contoh.com', 'kepala');
   ```
6. Buka **Project Settings → API**, catat:
   - **Project URL**
   - **anon public key**
   - **service_role key** (rahasia, hanya untuk Netlify)

### 2. Isi konfigurasi
Buka `public/config.js`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (anon key, bukan service_role).

### 3. Deploy ke Netlify
Fungsi kelola akun butuh Netlify Functions, jadi jangan deploy dengan drag-and-drop folder `public` saja. Pilih salah satu:
- **Lewat GitHub** (disarankan): unggah folder ini ke repository GitHub, lalu di Netlify pilih **Add new site → Import from Git**. Pengaturan build sudah ada di `netlify.toml`.
- **Lewat Netlify CLI**: `npm i -g netlify-cli`, lalu `netlify deploy --prod` dari folder ini.

Setelah site dibuat, buka **Site configuration → Environment variables** dan tambahkan:

| Nama | Isi |
|---|---|
| `SUPABASE_URL` | Project URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

Lalu **deploy ulang** supaya variabel terbaca.

### 4. Mulai memakai
1. Login sebagai kepala.
2. Menu **Atur**: isi nama lembaga, alamat, nama kepala, tempat, logo (opsional), lalu tambahkan **semester** dan jadikan aktif.
3. Menu **Akun**: tambah akun guru, lalu buat kelas dan pilih guru pengampunya.
4. Guru login, buka kelasnya, tambah siswa (bisa banyak sekaligus), lalu isi rapor.

---

## Cara kerja singkat
- **Status rapor**: Belum diisi → Draft → Selesai. Dashboard kepala menghitung progres dari status ini.
- **Predikat akhir** dihitung otomatis dari rata-rata kelancaran, tajwid, dan makhraj (Mumtaz = 4, Jayyid Jiddan = 3, Jayyid = 2, Maqbul = 1, dibulatkan). Adab ditampilkan terpisah.
- **Ayat kosong** pada setoran berarti satu surah penuh.
- **PDF** dibuat langsung di browser (tanpa server). Tombol *Unduh PDF kelas* menggabungkan semua rapor yang sudah ada di satu file.
- **Keamanan**: aturan akses (Row Level Security) ada di database, jadi guru tidak bisa membuka data kelas lain meskipun mencoba lewat alat lain.

## Catatan
- Nama surah di PDF memakai huruf Latin (font bawaan PDF belum mendukung huruf Arab).
- Menonaktifkan akun guru membuat guru tidak bisa login, tapi data rapornya tetap tersimpan.
- Menghapus siswa juga menghapus semua rapornya.
- Untuk uji lokal: `netlify dev` dari folder ini (butuh Netlify CLI dan file `.env` berisi dua variabel di atas).

## Struktur
```
public/            index.html, style.css, app.js, config.js
netlify/functions/ admin-users.js   (buat akun, reset password, aktif/nonaktif)
supabase/          schema.sql       (tabel + aturan akses)
netlify.toml
```
