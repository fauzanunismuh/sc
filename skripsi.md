# ANALISIS KEMIRIPAN SOURCE CODE PROJECT  
## MENGGUNAKAN METODE CODEBERT DAN WINNOWING ALGORITHM  

### PROPOSAL SKRIPSI  

Diajukan Sebagai Salah Satu Syarat Untuk Menyusun  
Skripsi Program Studi Informatika  

**FAUZAN AZHARI RAHMAN**  
105841109622  

PROGRAM STUDI INFORMATIKA  
FAKULTAS TEKNIK  
UNIVERSITAS MUHAMMADIYAH MAKASSAR  
2026  

---

# KATA PENGANTAR

بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ  

Alhamdulillah, puji syukur Penulis panjatkan kehadirat Allah Subhanahu Wa ta'ala yang telah melimpahkan rahmat dan karunia-Nya, sehingga Penulis dapat menyelesaikan Proposal Penelitian Skripsi ini tepat pada waktunya.  

Proposal ini berjudul:  
**"Analisis Kemiripan Source Code Project Menggunakan Metode CodeBERT dan Winnowing Algorithm"**  

Shalawat serta salam semoga senantiasa tercurah kepada Nabi Muhammad Shallallahu Alaihi Wasallam.  

Penulis mengucapkan terima kasih kepada:  
- Rektor Universitas Muhammadiyah Makassar  
- Dekan Fakultas Teknik  
- Ketua Program Studi Informatika  
- Dosen pembimbing  
- Seluruh dosen dan pihak terkait  
- Orang tua dan teman-teman  

Penulis menyadari proposal ini masih jauh dari sempurna. Kritik dan saran sangat diharapkan.  

Makassar, 01 April 2026  

**Penulis**  
Fauzan Azhari Rahman  

---

# DAFTAR ISI

- KATA PENGANTAR  
- BAB I PENDAHULUAN  
- BAB II TINJAUAN PUSTAKA  
- BAB III METODE PENELITIAN  
- DAFTAR PUSTAKA  

---

# BAB I PENDAHULUAN

## A. Latar Belakang

Perkembangan platform seperti GitHub dan GitLab mempermudah akses terhadap kode sumber. Namun, hal ini juga meningkatkan risiko plagiarisme kode.  

Plagiarisme tidak hanya berupa copy-paste, tetapi juga:
- Refactoring  
- Rename variabel  
- Obfuscation  

Metode deteksi:
- **Winnowing** → tekstual  
- **CodeBERT** → semantik  

Keduanya memiliki kelebihan dan kekurangan, sehingga diperlukan kombinasi metode.

---

## B. Rumusan Masalah

1. Bagaimana penerapan CodeBERT dan Winnowing dalam mendeteksi kemiripan kode?  
2. Bagaimana integrasi metode tersebut ke dalam sistem Capstone Project?  

---

## C. Tujuan Penelitian

- Mengimplementasikan kombinasi CodeBERT dan Winnowing  
- Mengintegrasikan ke sistem Capstone Project  

---

## D. Manfaat Penelitian

- Membantu dosen mendeteksi plagiarisme  
- Meningkatkan orisinalitas mahasiswa  
- Referensi penelitian selanjutnya  

---

## E. Ruang Lingkup

## F. Batasan Analisis

- File yang dianalisis hanya file kode sumber dengan ekstensi yang umum dipakai pada proyek perangkat lunak, seperti `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.cpp`, `.c`, `.go`, `.php`, `.rb`, dan `.cs`.
- File konfigurasi, dokumentasi, file hasil generate, file dependency, dan aset non-kode seperti `README.md`, `package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `node_modules/`, dan file CSS tidak dianalisis.
- Setiap project dibatasi pada sejumlah file kode terpilih agar proses tetap efisien.
- Satu pasangan project dapat menghasilkan lebih dari satu potongan kode yang mirip, bahkan jika potongan tersebut berasal dari file yang berbeda.
- Analisis CodeBERT dibatasi oleh panjang input, sehingga bagian kode yang sangat panjang dapat terpotong pada batas token model.
- Akurasi dapat dipengaruhi oleh bahasa pemrograman, struktur kode, dan gaya penulisan; hasil biasanya lebih baik pada bahasa yang umum dan representatif dalam data latih CodeBERT.

## G. Sistematika Penulisan

## F. Sistematika Penulisan

- BAB I Pendahuluan  
- BAB II Tinjauan Pustaka  
- BAB III Metode Penelitian  

---

# BAB II TINJAUAN PUSTAKA

## A. Landasan Teori

### 1. Capstone Project
Proyek akhir mahasiswa berbasis implementasi sistem nyata.

### 2. Plagiarisme Kode
Tindakan menyalin kode tanpa atribusi.

Jenis kemiripan:
- Tekstual  
- Semantik  

---

### 3. Transformer & BERT

Model berbasis self-attention untuk memahami konteks data.

---

### 4. CodeBERT

Model pretrained untuk kode + bahasa natural.

Digunakan untuk:
- Embedding kode  
- Cosine similarity  

---

### 5. Winnowing Algorithm

Metode fingerprinting berbasis:
- k-gram  
- rolling hash  
- window  

Parameter:
- k = 5  
- w = 4  

---

### 6. Penggabungan Metode

Menggunakan **score-level fusion**:

- CodeBERT → semantik  
- Winnowing → tekstual  

---

## B. Penelitian Terkait

| No | Penelitian | Metode | Hasil |
|----|-----------|--------|------|
| 1 | Ramli (2021) | Winnowing | ~75% |
| 2 | Akbar (2025) | CodeBERT | 96.4% |
| 3 | Virginia (2026) | Gabungan | Akurasi tinggi |

---

## C. Kerangka Berpikir

Alur:
1. Identifikasi masalah  
2. Studi literatur  
3. Perancangan metode  
4. Implementasi  
5. Evaluasi  

---

# BAB III METODE PENELITIAN

## A. Tempat dan Waktu

- Laboratorium Komputer Informatika  
- Universitas Muhammadiyah Makassar  

---

## B. Alat dan Bahan

### Hardware
- Laptop RAM minimal 16GB  

### Software
- VS Code  
- Node.js  
- Next.js  
- Python  

---

## C. Perancangan Sistem

### Alur:

1. Ambil data  
2. Analisis paralel:
   - CodeBERT  
   - Winnowing  
3. Hitung skor  
4. Klasifikasi  
5. Tampilkan hasil  

---

### Cosine Similarity
# ANALISIS KEMIRIPAN SOURCE CODE PROJECT  
## MENGGUNAKAN METODE CODEBERT DAN WINNOWING ALGORITHM  

### PROPOSAL SKRIPSI  

Diajukan Sebagai Salah Satu Syarat Untuk Menyusun  
Skripsi Program Studi Informatika  

**FAUZAN AZHARI RAHMAN**  
105841109622  

PROGRAM STUDI INFORMATIKA  
FAKULTAS TEKNIK  
UNIVERSITAS MUHAMMADIYAH MAKASSAR  
2026  

---

# KATA PENGANTAR

بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ  

Alhamdulillah, puji syukur Penulis panjatkan kehadirat Allah Subhanahu Wa ta'ala yang telah melimpahkan rahmat dan karunia-Nya, sehingga Penulis dapat menyelesaikan Proposal Penelitian Skripsi ini tepat pada waktunya.  

Proposal ini berjudul:  
**"Analisis Kemiripan Source Code Project Menggunakan Metode CodeBERT dan Winnowing Algorithm"**  

Shalawat serta salam semoga senantiasa tercurah kepada Nabi Muhammad Shallallahu Alaihi Wasallam.  

Penulis mengucapkan terima kasih kepada:  
- Rektor Universitas Muhammadiyah Makassar  
- Dekan Fakultas Teknik  
- Ketua Program Studi Informatika  
- Dosen pembimbing  
- Seluruh dosen dan pihak terkait  
- Orang tua dan teman-teman  

Penulis menyadari proposal ini masih jauh dari sempurna. Kritik dan saran sangat diharapkan.  

Makassar, 01 April 2026  

**Penulis**  
Fauzan Azhari Rahman  

---

# DAFTAR ISI

- KATA PENGANTAR  
- BAB I PENDAHULUAN  
- BAB II TINJAUAN PUSTAKA  
- BAB III METODE PENELITIAN  
- DAFTAR PUSTAKA  

---

# BAB I PENDAHULUAN

## A. Latar Belakang

Perkembangan platform seperti GitHub dan GitLab mempermudah akses terhadap kode sumber. Namun, hal ini juga meningkatkan risiko plagiarisme kode.  

Plagiarisme tidak hanya berupa copy-paste, tetapi juga:
- Refactoring  
- Rename variabel  
- Obfuscation  

Metode deteksi:
- **Winnowing** → tekstual  
- **CodeBERT** → semantik  

Keduanya memiliki kelebihan dan kekurangan, sehingga diperlukan kombinasi metode.

---

## B. Rumusan Masalah

1. Bagaimana penerapan CodeBERT dan Winnowing dalam mendeteksi kemiripan kode?  
2. Bagaimana integrasi metode tersebut ke dalam sistem Capstone Project?  

---

## C. Tujuan Penelitian

- Mengimplementasikan kombinasi CodeBERT dan Winnowing  
- Mengintegrasikan ke sistem Capstone Project  

---

## D. Manfaat Penelitian

- Membantu dosen mendeteksi plagiarisme  
- Meningkatkan orisinalitas mahasiswa  
- Referensi penelitian selanjutnya  

---

## E. Ruang Lingkup

- Data: Source code Capstone Project  
- Metode: CodeBERT + Winnowing  
- Fokus: analisis dan integrasi sistem  

## F. Batasan Analisis

- File yang dianalisis hanya file kode sumber dengan ekstensi yang umum dipakai pada proyek perangkat lunak, seperti `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.cpp`, `.c`, `.go`, `.php`, `.rb`, dan `.cs`.
- File konfigurasi, dokumentasi, file hasil generate, file dependency, dan aset non-kode seperti `README.md`, `package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `node_modules/`, dan file CSS tidak dianalisis.
- Setiap project dibatasi pada sejumlah file kode terpilih agar proses tetap efisien.
- Satu pasangan project dapat menghasilkan lebih dari satu potongan kode yang mirip, bahkan jika potongan tersebut berasal dari file yang berbeda.
- Analisis CodeBERT dibatasi oleh panjang input, sehingga bagian kode yang sangat panjang dapat terpotong pada batas token model.
- Akurasi dapat dipengaruhi oleh bahasa pemrograman, struktur kode, dan gaya penulisan; hasil biasanya lebih baik pada bahasa yang umum dan representatif dalam data latih CodeBERT.

---

## G. Sistematika Penulisan

- BAB I Pendahuluan  
- BAB II Tinjauan Pustaka  
- BAB III Metode Penelitian  

---

# BAB II TINJAUAN PUSTAKA

## A. Landasan Teori

### 1. Capstone Project
Proyek akhir mahasiswa berbasis implementasi sistem nyata.

### 2. Plagiarisme Kode
Tindakan menyalin kode tanpa atribusi.

Jenis kemiripan:
- Tekstual  
- Semantik  

---

### 3. Transformer & BERT

Model berbasis self-attention untuk memahami konteks data.

---

### 4. CodeBERT

Model pretrained untuk kode + bahasa natural.

Digunakan untuk:
- Embedding kode  
- Cosine similarity  

---

### 5. Winnowing Algorithm

Metode fingerprinting berbasis:
- k-gram  
- rolling hash  
- window  

Parameter:
- k = 5  
- w = 4  

---

### 6. Penggabungan Metode

Menggunakan **score-level fusion**:

- CodeBERT → semantik  
- Winnowing → tekstual  

---

## B. Penelitian Terkait

| No | Penelitian | Metode | Hasil |
|----|-----------|--------|------|
| 1 | Ramli (2021) | Winnowing | ~75% |
| 2 | Akbar (2025) | CodeBERT | 96.4% |
| 3 | Virginia (2026) | Gabungan | Akurasi tinggi |

---

## C. Kerangka Berpikir

Alur:
1. Identifikasi masalah  
2. Studi literatur  
3. Perancangan metode  
4. Implementasi  
5. Evaluasi  

---

# BAB III METODE PENELITIAN

## A. Tempat dan Waktu

- Laboratorium Komputer Informatika  
- Universitas Muhammadiyah Makassar  

---

## B. Alat dan Bahan

### Hardware
- Laptop RAM minimal 16GB  

### Software
- VS Code  
- Node.js  
- Next.js  
- Python  

---

## C. Perancangan Sistem

Analisis kemiripan source code pada penelitian ini dilakukan melalui serangkaian tahapan yang saling berurutan dan saling melengkapi. Proses dimulai dari pengambilan data source code proyek mahasiswa dari basis data sistem dan repositori GitHub yang telah terintegrasi. Selanjutnya, kode yang diperoleh dinormalisasi untuk mengurangi pengaruh karakter tidak signifikan, kemudian dianalisis secara paralel melalui dua jalur, yaitu analisis semantik menggunakan CodeBERT dan analisis tekstual menggunakan Winnowing.

### 1. Pengambilan Data
Data yang dianalisis berupa pasangan source code dua proyek yang diambil dari sistem Capstone Project. Pada tahap ini, sistem mengambil metadata proyek, tautan repositori, serta potongan kode yang tersedia untuk diproses pada tahap berikutnya.

### 2. Pra-pemrosesan Kode
Kode sumber dinormalisasi terlebih dahulu agar proses analisis menjadi lebih konsisten. Tahap ini meliputi penghapusan komentar, karakter tidak signifikan, spasi berlebih, dan penyamaan format teks. Pada jalur Winnowing, token kode juga disederhanakan agar pola kemiripan dapat dibandingkan secara lebih stabil.

### 3. Analisis Semantik Menggunakan CodeBERT
Pada jalur semantik, dua source code yang telah diproses dikirim ke Similarity Service untuk diekstraksi menjadi embedding menggunakan model CodeBERT. Vektor embedding dari masing-masing kode kemudian dibandingkan menggunakan cosine similarity sehingga diperoleh skor kemiripan semantik.

Secara matematis, skor kemiripan semantik dinyatakan sebagai:

$$
S_{CB} = \frac{A \cdot B}{\|A\|\,\|B\|}
$$

dengan keterangan:

- $S_{CB}$ : skor kemiripan semantik dari CodeBERT
- $A$ : vektor embedding kode proyek pertama
- $B$ : vektor embedding kode proyek kedua
- $A \cdot B$ : hasil perkalian dot product antara vektor $A$ dan $B$
- $\|A\|$ dan $\|B\|$ : norma vektor embedding masing-masing kode

### 4. Analisis Tekstual Menggunakan Winnowing
Pada jalur tekstual, kode sumber diproses menggunakan algoritma Winnowing melalui tahapan penyaringan kata, pembentukan k-gram, konversi ke nilai hash, pembentukan window, dan pemilihan fingerprint. Dalam penelitian ini digunakan parameter k-gram sebesar 5 karakter dan ukuran window sebesar 4. Nilai tersebut dipilih agar proses fingerprinting tetap efisien namun masih mampu menangkap pola kemiripan teks yang relevan.

Skor kemiripan tekstual dihitung menggunakan indeks Jaccard atas himpunan fingerprint yang dihasilkan. Secara matematis, skor tersebut dirumuskan sebagai:

$$
S_W = \frac{|A \cap B|}{|A \cup B|}
$$

dengan keterangan:

- $S_W$ : skor kemiripan tekstual dari Winnowing
- $A$ : himpunan fingerprint dari proyek pertama
- $B$ : himpunan fingerprint dari proyek kedua
- $|A \cap B|$ : jumlah fingerprint yang sama pada kedua proyek
- $|A \cup B|$ : gabungan seluruh fingerprint dari kedua proyek

### 5. Perhitungan Skor Gabungan
Setelah skor semantik dan skor tekstual diperoleh, kedua nilai digabungkan menggunakan weighted average. Pada penelitian ini, bobot CodeBERT ditetapkan sebesar 0.6 dan bobot Winnowing sebesar 0.4, sehingga skor gabungan dirumuskan sebagai:

$$
S_G = \alpha S_{CB} + (1-\alpha) S_W
$$

dengan $\alpha = 0.6$.

### 6. Klasifikasi Kategori Kemiripan
Berdasarkan nilai skor semantik, skor tekstual, dan skor gabungan, sistem mengklasifikasikan pasangan proyek ke dalam empat kategori, yaitu Plagiarisme Kuat, Mirip Tekstual, Mirip Semantik, dan Normal. Klasifikasi ditentukan menggunakan ambang batas yang telah dikalibrasi pada sistem, yaitu 0.80 untuk CodeBERT dan 0.75 untuk Winnowing.

### 7. Penyimpanan dan Penyajian Hasil
Hasil analisis disimpan ke dalam basis data sistem dan ditampilkan kembali melalui dashboard sesuai peran pengguna. Dosen penguji dapat melihat skor semantik, skor tekstual, skor gabungan, kategori kemiripan, serta potongan kode yang terdeteksi mirip sebagai bukti pendukung. Mahasiswa dapat melihat ringkasan hasil analisis pada proyek miliknya berupa skor gabungan, kategori indikasi kemiripan, dan potongan kode yang terdeteksi mirip.

## D. Threshold & Skor

- CodeBERT: 0.80  
- Winnowing: 0.75  

### Skor Gabungan

$$
S_G = \alpha S_{CB} + (1-\alpha) S_W
$$

## E. Klasifikasi

| Kategori | Kondisi |
|----------|--------|
| Plagiarisme Kuat | $S_{CB} \ge 0.80$ dan $S_W \ge 0.75$ |
| Mirip Tekstual | $S_W \ge 0.75$ |
| Mirip Semantik | $S_{CB} \ge 0.80$ |
| Normal | keduanya di bawah ambang batas |

## F. Pengujian Sistem

### Black Box Testing

Pengujian sistem dilakukan menggunakan metode black box testing untuk memastikan seluruh fungsi utama berjalan sesuai rancangan. Skenario pengujian mencakup kode identik, perubahan nama variabel, copy-paste, dan pasangan kode yang berbeda. Hasil pengujian diharapkan menunjukkan kategori yang sesuai dengan karakteristik kemiripan pada masing-masing skenario.

| No | Skenario | Hasil yang Diharapkan |
|----|---------|-----------------------|
| 1 | Kode identik | Plagiarisme Kuat |
| 2 | Rename variabel | Mirip Semantik |
| 3 | Copy-paste | Mirip Tekstual |
| 4 | Kode berbeda | Normal |

---

# DAFTAR PUSTAKA

- Akbar (2025)  
- Ramli (2021)  
- Feng (2020)  
- Vaswani (2017)  
- Schleimer (2003)  
- Zakeri (2023)  
- dll  

---