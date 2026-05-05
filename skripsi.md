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
| 3 | Virginia (2026) | Hybrid | Akurasi tinggi |

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
| 3 | Virginia (2026) | Hybrid | Akurasi tinggi |

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
scb = (A · B) / (||A|| ||B||)


---

### Jaccard Similarity
sw = |A ∩ B| / |A ∪ B|


---

## D. Threshold & Skor

- CodeBERT: 0.80  
- Winnowing: 0.75  

### Skor Gabungan
sg = α * Scb + (1-α) * Sw


---

## E. Klasifikasi

| Kategori | Kondisi |
|----------|--------|
| Plagiarisme Kuat | tinggi semua |
| Mirip Tekstual | Winnowing tinggi |
| Mirip Semantik | CodeBERT tinggi |
| Normal | rendah |

---

## F. Pengujian Sistem

### Black Box Testing

| No | Skenario | Hasil |
|----|---------|------|
| 1 | Kode identik | Plagiarisme |
| 2 | Rename variabel | Semantik |
| 3 | Copy-paste | Tekstual |
| 4 | Berbeda | Normal |

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