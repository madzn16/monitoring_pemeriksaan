# Dashboard Monitoring Pemeriksaan — GitHub Pages + Google Sheets

Paket ini adalah versi statis HTML/CSS/JavaScript yang meniru struktur dashboard SIMPEL pada contoh Blade:
- Header IT Command Center
- Filter tahun, inspektorat penanganan, unit kerja diperiksa, dan status
- Delapan KPI
- Grafik tren pemeriksaan dan komposisi pelanggaran
- Ringkasan kategori pelanggaran
- Tabel data dengan pencarian, pilihan jumlah baris, dan pagination
- Data dibaca dari Google Sheets yang dipublikasikan sebagai CSV

## 1. Siapkan Google Sheets

Buat tab khusus, misalnya `DashboardPublik`, dengan header pada baris pertama. Gunakan nama kolom berikut (urutan bebas):

| Kolom | Wajib? | Keterangan |
|---|---|---|
| `id` | Disarankan | ID unik/nomor pemeriksaan |
| `title` | Disarankan | Nomor/identitas yang tampil di tabel; jika kosong memakai ID |
| `inspectorate` | Disarankan | Inspektorat penanganan |
| `unit` | Disarankan | Unit kerja yang diperiksa |
| `start_date` | Disarankan | Tanggal mulai, format `YYYY-MM-DD` |
| `target_date` | Opsional | Target penyelesaian |
| `end_date` | Opsional | Tanggal selesai |
| `status` | Disarankan | Contoh: `DALAM VERIFIKASI`, `DALAM PEMERIKSAAN`, `SELESAI` |
| `year` | Opsional | Tahun pemeriksaan; bila kosong dihitung dari `start_date` |
| `personnel_name` | Disarankan | Nama personel yang diperiksa |
| `personnel_id` | Opsional | ID personel yang boleh ditampilkan publik |
| `examination_type` | Disarankan | Jenis pemeriksaan |
| `stage` | Opsional | Tahap pemeriksaan |
| `violation_level` | Disarankan | Gunakan nilai konsisten: `Ringan`, `Sedang`, atau `Berat` |
| `notes` | Opsional | Keterangan umum |

Header alternatif seperti `nomor_pemeriksaan`, `tahun`, `inspektorat_penanganan`, `unit_kerja`, `tanggal_mulai`, `nama_personel`, `jenis_pemeriksaan`, `tahap_pemeriksaan`, dan `kategori_pelanggaran` juga didukung.

**Privasi:** GitHub Pages dan CSV yang dipublikasikan bersifat publik. Jangan memublikasikan NRP/NIP, nama, atau rincian pemeriksaan yang bersifat rahasia/pribadi kecuali telah mendapat persetujuan dan memang diperbolehkan. Buat tab publik yang hanya memuat data agregat atau data yang sudah disanitasi bila perlu. URL CSV dan semua data yang dikirim ke browser dapat dilihat pengunjung.

## 2. Publikasikan tab sebagai CSV

Di Google Sheets:
1. Pilih **File → Share → Publish to web** (atau **File → Bagikan → Publikasikan ke web**).
2. Pilih tab khusus dashboard, bukan seluruh dokumen jika spreadsheet juga memuat data internal.
3. Pilih format **Comma-separated values (.csv)**.
4. Klik **Publish/Publikasikan**, lalu salin URL CSV yang diberikan.

## 3. Sambungkan dashboard ke spreadsheet

Buka `app.js` dan ubah:

```js
const CONFIG = {
  GOOGLE_SHEETS_CSV_URL: "",
  USE_SAMPLE_DATA_ON_ERROR: true,
  REFRESH_INTERVAL_MINUTES: 0
};
```

Tempel URL CSV di antara tanda kutip:

```js
GOOGLE_SHEETS_CSV_URL: "TEMPEL_URL_CSV_GOOGLE_SHEETS_DI_SINI",
```

Opsional: atur `REFRESH_INTERVAL_MINUTES: 5` agar dashboard mencoba memuat ulang setiap 5 menit saat halaman terbuka. Nilai `0` berarti tidak refresh otomatis.

## 4. Perbarui website GitHub Pages

1. Simpan `index.html`, `style.css`, `app.js`, dan `README.md`.
2. Buka repository GitHub Anda.
3. Pilih **Add file → Upload files**.
4. Unggah file yang sudah diperbarui (bukan ZIP), lalu **Commit changes**.
5. Tunggu beberapa saat dan muat ulang website GitHub Pages.

## Catatan metrik

- Total pemeriksaan = jumlah baris pemeriksaan setelah filter.
- Dalam verifikasi = status mengandung kata `verifikasi`.
- Dalam pemeriksaan = status mengandung `pemeriksaan`, `analisis`, `rekomendasi`, `proses`, atau `berjalan`, kecuali status selesai.
- Selesai = status mengandung `selesai`, `completed`, `closed`, atau `ditutup`.
- Personel Aktif dan Pernah Diperiksa pada template ini sama-sama dihitung sebagai jumlah personel unik di baris yang terfilter. Bila definisi bisnis berbeda, tambahkan kolom terpisah dan sesuaikan rumus di `app.js`.
- Kategori pelanggaran dihitung berdasarkan baris dengan `violation_level` Ringan/Sedang/Berat. Jika satu baris mewakili pemeriksaan, angka tersebut adalah jumlah pemeriksaan pada kategori, bukan otomatis jumlah jenis pelanggaran.
- Filter bekerja pada browser berdasarkan seluruh baris CSV yang sudah dimuat. Tidak ada login/otorisasi karena ini situs statis publik.

## Jika data Google Sheets tidak tampil

- Pastikan tab dipublikasikan sebagai CSV.
- Pastikan URL CSV benar dan dapat dibuka tanpa login.
- Periksa header kolom dan format tanggal.
- Buka Developer Tools → Console untuk melihat kesalahan fetch/CORS.
- Sementara URL belum diatur, dashboard menampilkan data contoh.

## Pembaruan versi: mengatasi CORS Google Sheets

Browser tidak lagi mengambil CSV langsung dari Google Sheets. File `app.js` membaca `./data.csv` dari domain GitHub Pages yang sama, sedangkan GitHub Actions mengambil CSV Google Sheets dan memperbarui `data.csv` secara otomatis.

### Cara memasang

1. Unggah/commit seluruh isi paket ke **root repository** GitHub Pages, termasuk folder tersembunyi `.github/workflows/` dan file `data.csv`.
2. Pastikan URL Google Sheets publik tetap dapat diakses sebagai CSV.
3. Di repository GitHub, buka **Settings → Actions → General → Workflow permissions**. Pastikan workflow diizinkan menulis ke repository. Workflow ini menggunakan `contents: write`.
4. Buka tab **Actions** → **Sinkronisasi data Google Sheets** → **Run workflow** untuk menjalankan sinkronisasi pertama kali.
5. Setelah workflow berhasil, buka website GitHub Pages dan lakukan `Ctrl+F5`.

Workflow berjalan otomatis dua kali per jam. Sinkronisasi pertama perlu dijalankan manual setelah mengunggah file. Jika workflow gagal, periksa tab Actions; file `data.csv` yang sebelumnya ada tidak akan diganti dengan halaman error HTML.

**Catatan:** seluruh isi `data.csv` di situs GitHub Pages publik dapat dilihat siapa saja. Gunakan hanya data dummy atau data yang memang boleh dipublikasikan.


## Grafik perbandingan tiga jenis
Grafik batang membandingkan **Pelanggaran Disiplin**, **Perceraian**, dan **Pengunduran Diri**. Grafik mengikuti filter tahun, inspektorat, unit kerja, dan status. Saat data dummy digunakan, kolom `examination_type` diisi bergantian dengan ketiga kategori agar perbandingan terlihat.
