# Dashboard Monitoring Pemeriksaan — GitHub Pages

Dashboard statis HTML/CSS/JavaScript dengan ApexCharts. Google Sheets digunakan sebagai sumber data melalui CSV yang dipublikasikan.

## File
- `index.html`: struktur halaman.
- `style.css`: tampilan responsif bertema teknologi.
- `app.js`: pemuatan CSV, filter, KPI, grafik, dan tabel.
- Saat URL Sheets belum diatur, aplikasi memakai data contoh anonim.

## 1. Siapkan Google Sheets

Buat spreadsheet khusus yang hanya berisi data yang memang boleh dipublikasikan. Jangan memakai spreadsheet pemeriksaan internal mentah jika berisi nama, data personel, uraian dugaan pelanggaran, dokumen, atau informasi rahasia.

Buat satu tab bernama misalnya `DataPublik`, dengan header kolom seperti berikut (nama kolom tidak harus persis sama karena beberapa variasi didukung):

| id | title | inspectorate | unit | start_date | target_date | end_date | status | year |
|---|---|---|---|---|---|---|---|---|
| PM-2026-001 | Pemeriksaan administrasi | Inspektorat I | Unit A | 2026-01-12 | 2026-02-20 | 2026-02-18 | SELESAI | 2026 |

Tanggal sebaiknya berformat ISO `YYYY-MM-DD` untuk menghindari salah interpretasi.

Nama header alternatif yang didukung:
- `id`: `nomor`, `nomor_pemeriksaan`, `no_pemeriksaan`
- `title`: `judul`, `nama_pemeriksaan`, `perihal`
- `inspectorate`: `inspektorat`, `inspektorat_penanganan`
- `unit`: `unit_kerja`, `unit_yang_diperiksa`, `unit_kerja_yang_diperiksa`
- `start_date`: `tanggal_mulai`, `tanggal_pemeriksaan`
- `target_date`: `target_selesai`, `tanggal_target`, `tanggal_rencana_selesai`, `planned_end_date`
- `end_date`: `tanggal_selesai`, `realisasi_selesai`, `actual_end_date`
- `status`: `status_pemeriksaan`, `tahap_pemeriksaan`
- `year`: `tahun`

Status selesai yang dikenali: `SELESAI`, `DITUTUP`, `COMPLETED`, `CLOSED`. Status lain dihitung sebagai belum selesai. Pemeriksaan lewat target ditentukan dari tanggal target yang sudah lewat dan status yang belum selesai, atau status eksplisit `TERLAMBAT`.

## 2. Publikasikan sebagai CSV

Di Google Sheets:
1. Pilih **File → Share → Publish to web**.
2. Pilih tab `DataPublik`, bukan seluruh workbook bila tidak diperlukan.
3. Pilih format **Comma-separated values (.csv)**.
4. Klik **Publish**, lalu salin URL publikasi CSV.
5. Uji URL di jendela browser privat. URL harus menampilkan teks CSV, bukan meminta login.

**Peringatan:** publikasi membuat isi tab yang dipilih dapat diakses publik. Pastikan izin publikasi sudah disetujui dan data sudah disanitasi. Jangan gunakan cara ini untuk data rahasia atau data pribadi. Jangan menaruh API key atau kredensial di JavaScript publik.

## 3. Hubungkan Google Sheets

Buka `app.js`, cari:

```js
GOOGLE_SHEETS_CSV_URL: "",
```

Ganti dengan URL CSV hasil publikasi, misalnya:

```js
GOOGLE_SHEETS_CSV_URL: "TEMPEL_URL_CSV_GOOGLE_SHEETS_DI_SINI",
```

Simpan file. Jika URL tidak tersedia atau gagal dibaca, dashboard memakai data contoh (fallback) dan menampilkan statusnya di sidebar.

## 4. Uji lokal

Cara sederhana:
1. Ekstrak ZIP.
2. Buka `index.html` di browser untuk melihat dashboard contoh.
3. Untuk pengujian fetch/CORS lebih baik gunakan server lokal sederhana, misalnya ekstensi Live Server di VS Code.

Library ApexCharts dan font Google pada contoh ini memakai CDN, jadi memerlukan koneksi internet. Jika ingin offline, unduh aset dan simpan lokal (perhatikan lisensi library).

## 5. Unggah ke GitHub Pages

1. Login ke https://github.com.
2. Buat repository baru, misalnya `dashboard-publik`.
3. Pilih **Public** (untuk GitHub Pages gratis pada repository publik).
4. Upload `index.html`, `style.css`, `app.js`, dan `README.md` ke root repository.
5. Buka **Settings → Pages**.
6. Di **Build and deployment**, pilih **Deploy from a branch**.
7. Pilih branch `main` dan folder `/(root)`, lalu klik **Save**.
8. Tunggu proses deploy. URL umumnya `https://USERNAME.github.io/dashboard-publik/`.

Setelah mengubah file, commit/push perubahan dan tunggu deploy selesai.

## 6. Catatan dan batasan

- GitHub Pages hanya menyajikan file statis; tidak ada backend atau database privat.
- Pengunjung bisa memeriksa JavaScript dan URL CSV. Jangan anggap URL tersembunyi sebagai keamanan.
- Data diperbarui saat browser memuat ulang dan sumber CSV sudah menerbitkan perubahan; frekuensi pembaruan publikasi Google Sheets dapat memiliki jeda.
- KPI dan grafik dihitung di browser berdasarkan data yang diterima.
- Durasi rata-rata hanya menghitung baris yang memiliki tanggal mulai dan tanggal selesai valid.
- Status “Lewat Target” ditentukan dari tanggal target terhadap tanggal hari ini, untuk pemeriksaan yang belum selesai.
- Data contoh semata-mata untuk demo dan bukan data nyata.
