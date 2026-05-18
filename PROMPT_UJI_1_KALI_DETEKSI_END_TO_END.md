# Prompt Uji 1 Kali Deteksi (Dari 0 Sampai Selesai)

Saya ingin Anda menulis subbab "Skenario Uji 1 Kali Percobaan Deteksi End-to-End" untuk skripsi saya dalam bahasa Indonesia akademik formal, dengan sudut pandang implementasi nyata sistem.

Gunakan data aktual berikut sebagai sumber utama dan jangan ubah angkanya:

- Total proyek: 17
- Proyek dengan repositori valid: 17
- Total pasangan dibandingkan: 136
- Pasangan teoritis nC2: 136
- Threshold CodeBERT (SCB): 0.99
- Threshold Winnowing (SW): 0.13
- Bobot hybrid: alpha = 0.5
- Rumus hybrid: SG = 0.5 x SCB + 0.5 x SW
- Lolos SCB >= 0.99: 46 pasangan
- Lolos SW >= 0.13: 46 pasangan
- Lolos keduanya: 16 pasangan
- Lolos minimal satu ambang: 76 pasangan
- Kategori Plagiarisme Kuat: 16 (11.76%)
- Kategori Mirip Semantik: 30 (22.06%)
- Kategori Mirip Tekstual: 30 (22.06%)
- Kategori Normal: 60 (44.12%)

Susun pembahasan sebagai simulasi 1 kali run deteksi dari awal sampai selesai, dengan struktur wajib berikut:

1. Kondisi awal pengujian
- Jelaskan bahwa sistem memulai dari kondisi tanpa hasil uji baru pada sesi tersebut, lalu menjalankan 1 proses batch penuh.
- Jelaskan tujuan: memastikan seluruh pasangan proyek terbentuk dan dinilai secara konsisten.

2. Tahap eksekusi 1 kali percobaan
- Tahap 1: Inisialisasi layanan aplikasi dan layanan similarity.
- Tahap 2: Pengambilan source code dari repositori GitHub tiap proyek.
- Tahap 3: Pembentukan seluruh pasangan unik antar proyek dengan rumus kombinasi nC2.
- Tahap 4: Perhitungan skor SCB (semantik) dan SW (tekstual) per pasangan.
- Tahap 5: Perhitungan skor gabungan SG dan klasifikasi kategori.
- Tahap 6: Penyimpanan hasil ke basis data dan penyajian ke antarmuka pengguna.

3. Hasil akhir 1 kali percobaan
- Tulis bahwa dari 17 proyek terbentuk 136 pasangan dan nilainya sama dengan nC2, sehingga konsisten.
- Sajikan distribusi hasil berdasarkan ambang dan kategori sesuai angka aktual di atas.
- Jelaskan bahwa 16 pasangan menjadi prioritas audit karena lolos kedua ambang.

4. Interpretasi teknis
- Jelaskan makna 76 pasangan yang lolos minimal satu ambang sebagai sinyal awal, bukan vonis final.
- Jelaskan bahwa kategori warning (semantik/tekstual) tetap memerlukan verifikasi manual dosen.
- Jelaskan bahwa snippet berfungsi sebagai evidence pendukung, sedangkan keputusan kategori ditentukan oleh skor ambang.

5. Kesimpulan subbab
- Tegaskan bahwa 1 kali percobaan dari awal sampai selesai berhasil mengeksekusi pipeline deteksi secara utuh.
- Tegaskan bahwa konsistensi pasangan tercapai (136 aktual dari 136 teoritis).
- Tegaskan bahwa sistem siap dipakai untuk monitoring kemiripan proyek secara operasional.

Tambahan format keluaran yang wajib:

- Gunakan subjudul bernomor (4.1, 4.2, dst. atau menyesuaikan bab aktif).
- Sertakan minimal 2 tabel:
  - Tabel Ringkasan Eksekusi 1 Kali Percobaan
  - Tabel Distribusi Hasil Deteksi
- Setelah tiap tabel, berikan analisis singkat 1 paragraf.
- Tulis gaya bahasa objektif, ringkas, dan tidak berulang.
- Jangan menambahkan data baru di luar angka yang diberikan.
