# Prompt Langsung Orang Pertama untuk BAB IV dan BAB V

## Prompt 1 - Tulis BAB IV (langsung pakai)

Saya ingin Anda menulis BAB IV (Hasil dan Pembahasan) skripsi saya dengan gaya akademik formal bahasa Indonesia berdasarkan data aktual berikut, tanpa mengubah angka:

- Total proyek: 17
- Proyek dengan repositori valid: 17
- Total pasangan dibandingkan: 136
- Pasangan teoritis nC2: 136
- Selisih data pasangan: 0
- Duplikasi pasangan tidak berurutan: 0
- Extra row akibat duplikasi: 0
- Threshold CodeBERT: 0.99
- Threshold Winnowing: 0.13
- Bobot gabungan: alpha = 0.5
- Rumus: SG = 0.5 x SCB + 0.5 x SW
- Lolos SCB >= 0.99: 46 pasangan
- Lolos SW >= 0.13: 46 pasangan
- Lolos keduanya: 16 pasangan
- Lolos minimal satu ambang: 76 pasangan
- Tidak lolos keduanya: 60 pasangan
- Plagiarisme Kuat: 16 (11.76%)
- Mirip Semantik: 30 (22.06%)
- Mirip Tekstual: 30 (22.06%)
- Normal: 60 (44.12%)

Susun subbab BAB IV saya sebagai berikut:
1. Gambaran umum dataset pengujian
2. Hasil perhitungan kemiripan antar proyek
3. Pembahasan threshold 0.99 dan 0.13
4. Analisis distribusi kategori deteksi
5. Implikasi hasil terhadap evaluasi akademik

Tuliskan pembahasan kritis, bukan deskriptif saja, dan tegaskan bahwa data pasangan sudah konsisten karena 136 dari 136 pasangan teoritis berhasil terbentuk.

## Prompt 2 - Tambahkan tabel Blackbox Testing (langsung pakai)

Saya ingin Anda menambahkan subbab Hasil Blackbox Testing pada BAB IV saya dengan format tabel akademik rapi, menggunakan data aktual berikut, lalu beri narasi analitis setelah setiap tabel.

### Tabel A. Ringkasan Kelulusan Skenario Blackbox

| No | Area Uji | Jumlah Skenario | Lulus | Tidak Lulus | Persentase Lulus |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Layanan analisis kemiripan | 4 | 4 | 0 | 100% |
| 2 | Analisis kemiripan langsung | 4 | 4 | 0 | 100% |
| 3 | Analisis batch dan konsistensi data | 5 | 5 | 0 | 100% |
| 4 | Integrasi antarmuka | 4 | 4 | 0 | 100% |
|   | Total | 17 | 17 | 0 | 100% |

### Tabel B. Uji Ketersediaan Layanan

| No | Skenario | Input Uji | Output Aktual | Status |
| --- | --- | --- | --- | --- |
| 1 | Cek status layanan | Permintaan status service | Service merespons normal | Lulus |
| 2 | Uji endpoint semantik | Dua potongan kode sederhana | Skor semantik (SCB) terkembalikan | Lulus |
| 3 | Uji endpoint tekstual | Dua potongan kode sederhana | Skor tekstual (SW) terkembalikan | Lulus |
| 4 | Uji endpoint gabungan | Dua potongan kode | Skor gabungan dan kategori tampil | Lulus |

### Tabel C. Uji Analisis Kemiripan

| No | Skenario | Ekspektasi | Hasil Aktual | Status |
| --- | --- | --- | --- | --- |
| 1 | Dua kode identik | Risiko tinggi terdeteksi | Kategori risiko tinggi muncul | Lulus |
| 2 | Variabel diubah, logika sama | Kemiripan semantik terdeteksi | SCB tetap tinggi | Lulus |
| 3 | Struktur teks mirip | Kemiripan tekstual terdeteksi | SW melewati ambang | Lulus |
| 4 | Kode tidak berkaitan | Kategori normal | Tidak melewati ambang | Lulus |

### Tabel D. Uji Batch dan Konsistensi Pair

| No | Indikator | Nilai Aktual | Target | Status |
| --- | --- | ---: | ---: | --- |
| 1 | Jumlah proyek valid | 17 | >= 2 | Lulus |
| 2 | Pasangan teoritis nC2 | 136 | Konsisten | Lulus |
| 3 | Pasangan tersimpan | 136 | Sama dengan nC2 | Lulus |
| 4 | Duplikasi pasangan unordered | 0 | 0 | Lulus |
| 5 | Pasangan diri sendiri | 0 | 0 | Lulus |

### Tabel E. Uji Ambang dan Kategori

| No | Metrik | Nilai Aktual | Interpretasi |
| --- | --- | ---: | --- |
| 1 | Total pasangan dianalisis | 136 | Seluruh pasangan terbentuk |
| 2 | SCB >= 0.99 | 46 | Indikasi semantik terdeteksi |
| 3 | SW >= 0.13 | 46 | Indikasi tekstual terdeteksi |
| 4 | SCB >= 0.99 dan SW >= 0.13 | 16 | Prioritas audit tertinggi |
| 5 | Lolos minimal satu ambang | 76 | 55.88% pasangan terindikasi |
| 6 | Kategori Plagiarisme Kuat | 16 (11.76%) | Risiko tinggi |
| 7 | Kategori Mirip Semantik | 30 (22.06%) | Perlu verifikasi konteks |
| 8 | Kategori Mirip Tekstual | 30 (22.06%) | Perlu verifikasi indikasi salin |
| 9 | Kategori Normal | 60 (44.12%) | Tidak melewati ambang |

### Tabel F. Uji Integrasi Antarmuka

| No | Skenario UI | Ekspektasi | Hasil Aktual | Status |
| --- | --- | --- | --- | --- |
| 1 | Halaman dosen | Menampilkan daftar pasangan dan skor | Data skor/kategori tampil | Lulus |
| 2 | Halaman mahasiswa | Menampilkan hasil proyek terkait | Data hasil tampil | Lulus |
| 3 | Detail snippet | Potongan mirip dapat diakses | Snippet tampil saat diminta | Lulus |
| 4 | Sinkronisasi hasil | UI mengikuti data terbaru | Konsisten dengan data analisis | Lulus |

## Prompt 3 - Pecahan rumusan masalah (terjawab atau tidak)

Saya ingin Anda menambahkan subbab khusus berjudul Status Keterjawaban Rumusan Masalah. Buat dalam bentuk tabel berikut, lalu berikan kesimpulan akhir yang tegas.

### Tabel G. Status Keterjawaban Rumusan Masalah

| No | Rumusan Masalah | Indikator Jawaban | Bukti Aktual | Status |
| --- | --- | --- | --- | --- |
| 1 | Penerapan CodeBERT dan Winnowing untuk deteksi semantik dan tekstual | Sistem menghasilkan SCB, SW, SG, dan kategori | 136 pasangan dianalisis, distribusi kategori tersedia | Terjawab |
| 2 | Integrasi fitur analisis kemiripan ke sistem capstone | Hasil analisis tampil pada alur pengguna | Uji antarmuka dosen dan mahasiswa lulus | Terjawab |

### Tabel H. Pecahan Indikator Keterjawaban

| No | Indikator Detail | Kondisi Aktual | Status |
| --- | --- | --- | --- |
| 1 | Skor semantik berhasil dihitung | Berhasil | Terjawab |
| 2 | Skor tekstual berhasil dihitung | Berhasil | Terjawab |
| 3 | Klasifikasi kategori berjalan | 4 kategori terbentuk | Terjawab |
| 4 | Pairwise batch konsisten | 136/136 sesuai nC2 | Terjawab |
| 5 | Tidak ada duplikasi pasangan | 0 duplikasi unordered | Terjawab |
| 6 | Hasil tampil di antarmuka dosen | Berhasil | Terjawab |
| 7 | Hasil tampil di antarmuka mahasiswa | Berhasil | Terjawab |

Kesimpulan wajib yang harus Anda tulis pada akhir subbab:
Seluruh rumusan masalah penelitian dinyatakan terjawab berdasarkan hasil blackbox testing dengan tingkat kelulusan skenario 100% pada data aktual yang diuji.

## Prompt 4 - Tulis BAB V (langsung pakai)

Saya ingin Anda menulis BAB V (Kesimpulan dan Saran) berdasarkan hasil aktual berikut:

- 17 proyek menghasilkan 136 pasangan (sesuai nC2)
- 76 pasangan (55.88%) terdeteksi melewati minimal satu ambang
- 16 pasangan (11.76%) masuk kategori Plagiarisme Kuat
- 60 pasangan (44.12%) masuk kategori Normal
- Distribusi warning seimbang: Mirip Semantik 30 dan Mirip Tekstual 30
- Tidak ditemukan duplikasi pasangan tidak berurutan
- Seluruh rumusan masalah berstatus terjawab

Susun BAB V saya dengan urutan:
1. Kesimpulan utama penelitian
2. Jawaban terhadap tujuan penelitian
3. Keterbatasan penelitian
4. Saran pengembangan

Saran pengembangan harus memuat:
- normalisasi pasangan agar tetap unik pada semua jalur input
- monitoring proses batch yang lebih real-time
- perluasan dataset lintas domain untuk uji generalisasi threshold
- penguatan SOP verifikasi manual untuk kategori warning

Gunakan bahasa akademik yang singkat, padat, dan tegas.
