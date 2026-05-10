# 📋 PANDUAN LENGKAP: MEMBUAT PROJECT BARU DARI UI SAMPAI TERKALKULASI

---

## 🎯 OVERVIEW ALUR KESELURUHAN

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND: UI Form Create Project (Mahasiswa)                 │
│    └─ /mahasiswa/projects/new/page.tsx                          │
├─────────────────────────────────────────────────────────────────┤
│ 2. API: POST /api/projects (Create Project + Initial Setup)     │
│    └─ /app/api/projects/route.ts                                │
├─────────────────────────────────────────────────────────────────┤
│ 3. DATABASE: Store Project + Relations (Prisma)                 │
│    └─ Project, ProjectRequirements, Document, etc               │
├─────────────────────────────────────────────────────────────────┤
│ 4. BACKGROUND: Auto-calculations (Similarity, Completion %)     │
│    └─ Python Service (CodeBERT, Winnowing)                      │
├─────────────────────────────────────────────────────────────────┤
│ 5. FRONTEND: Display Project dengan Kalkulasi di UI             │
│    └─ /mahasiswa/projects/[id]/page.tsx                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ STEP 1: FRONTEND - FORM INPUT DI UI (Mahasiswa)

### File Utama
- **Lokasi:** [src/app/(mahasiswa)/mahasiswa/projects/new/page.tsx](src/app/(mahasiswa)/mahasiswa/projects/new/page.tsx)
- **Tipe:** Server Component dengan Client Form

### Form Fields yang Harus Diisi

#### 🔹 Section 1: Informasi Dasar
```typescript
{
  title: string           // Min 5 karakter - Judul Project
  description: string     // Min 20 karakter - Deskripsi singkat
  semester: "Ganjil" | "Genap"  // Pilihan semester
  tahunAkademik: string   // Default "2024/2025"
  category: string        // Kategori project (dari enum)
  objectives: string      // Tujuan project
  methodology: string     // Metodologi yang digunakan
  expectedOutcome: string // Luaran yang diharapkan
}
```

#### 🔹 Section 2: Repository GitHub
```typescript
// OPTION A: Pilih dari repository milik user
{
  selectedRepoId: string
  // Sistem akan extract URL & name otomatis
}

// OPTION B: Input manual
{
  githubRepoUrl: string   // Contoh: https://github.com/user/repo
  githubRepoName: string  // Extract dari URL
}
```

#### 🔹 Section 3: Technologies
```typescript
{
  technologies: string[]  // Multi-select dari daftar
  // Contoh: ["TypeScript", "React", "Node.js"]
}
```

#### 🔹 Section 4: Team Members
```typescript
{
  pendingTeamMembers: Array<{
    id: string  // User ID dari invited members
  }>
  // Sistem akan send invitations ke member
}
```

#### 🔹 Section 5: Production & Testing
```typescript
{
  productionUrl: string        // URL aplikasi live
  testingUsername?: string     // (Optional) Username untuk test
  testingPassword?: string     // (Optional) Password untuk test
  testingNotes?: string        // (Optional) Catatan testing
}
```

#### 🔹 Section 6: Consent Document
```typescript
{
  consentDocument?: {
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
  }
}
```

### UI Workflow
```
Dashboard Mahasiswa
  ↓
[Button] "Buat Project Baru"
  ↓
Form Page: /mahasiswa/projects/new
  ├─ Step 1: Basic Info
  ├─ Step 2: GitHub Repository
  ├─ Step 3: Technologies
  ├─ Step 4: Team & Invitations
  ├─ Step 5: Production & Testing
  ├─ Step 6: Documents
  ├─ Step 7: Review & Preview
  └─ [Button] "Buat Project"
      ↓
    (Submit to API)
```

---

## ✅ STEP 2: API - PROCESS DATA & CREATE PROJECT

### Endpoint Details
- **URL:** `POST /api/projects`
- **File:** [src/app/api/projects/route.ts](src/app/api/projects/route.ts)
- **Authentication:** Requires user session (next-auth)

### Request Validation Flow

```typescript
// 1. Validasi Schema dengan Zod
const projectSchema = z.object({
  title: z.string().min(5, "Minimal 5 karakter"),
  description: z.string().min(20, "Minimal 20 karakter"),
  semester: z.enum(["Ganjil", "Genap"]),
  githubRepoUrl: z.string().url().optional(),
  // ... validasi field lainnya
})

// 2. Extract GitHub Info
const githubRepoName = extractRepoName(githubRepoUrl)
// Contoh: "https://github.com/user/my-repo" → "my-repo"

// 3. Validate Production URL Accessibility
const isUrlValid = await validateUrl(productionUrl)
if (!isUrlValid) {
  return Error("Production URL tidak accessible")
}

// 4. Validate Consent Document
if (consentDocument) {
  validateFileFormat(consentDocument.mimeType) // pdf/docx/xlsx
  validateFileSize(consentDocument.fileSize)   // Max 10MB
}
```

### Database Transaction (Atomic Create)

```typescript
// src/app/api/projects/route.ts - POST handler

const result = await prisma.$transaction(async (tx) => {
  // 🔹 Step 2a: Create Project Record
  const project = await tx.project.create({
    data: {
      title,
      description,
      semester,
      tahunAkademik,
      githubRepoUrl,
      githubRepoName,
      productionUrl,
      status: "DRAFT",  // Initial status
      mahasiswaId: userId,
    },
  })

  // 🔹 Step 2b: Add Project Owner as Member (Role: LEADER)
  await tx.projectMember.create({
    data: {
      projectId: project.id,
      userId: userId,
      role: "LEADER",
      joinedAt: new Date(),
    },
  })

  // 🔹 Step 2c: Create Team Invitations untuk pending members
  const invitations = await Promise.all(
    pendingTeamMembers.map((member) =>
      tx.teamInvitation.create({
        data: {
          projectId: project.id,
          invitedUserId: member.id,
          invitedByUserId: userId,
          status: "PENDING",
          createdAt: new Date(),
        },
      })
    )
  )

  // 🔹 Step 2d: Create Notifications untuk invited members
  await Promise.all(
    pendingTeamMembers.map((member) =>
      tx.notification.create({
        data: {
          userId: member.id,
          type: "PROJECT_INVITATION",
          relatedProjectId: project.id,
          message: `${userName} mengundang Anda ke project "${title}"`,
          read: false,
        },
      })
    )
  )

  // 🔹 Step 2e: Create Project Requirements (template default)
  await tx.projectRequirements.create({
    data: {
      projectId: project.id,
      productionUrl,
      testingUsername,
      testingPassword,
      testingNotes,
      completionPercent: calculateInitialCompletion(data),
      deploymentBonusPoints: 0, // Will be set later
    },
  })

  // 🔹 Step 2f: Store Consent Agreement Document
  if (consentDocument) {
    await tx.document.create({
      data: {
        projectId: project.id,
        type: "CONSENT",
        fileName: consentDocument.fileName,
        fileUrl: consentDocument.fileUrl,
        fileSize: consentDocument.fileSize,
        mimeType: consentDocument.mimeType,
        uploadedAt: new Date(),
      },
    })
  }

  // 🔹 Step 2g: Fetch complete project dengan all relations
  return await tx.project.findUnique({
    where: { id: project.id },
    include: {
      mahasiswa: true,
      members: { include: { user: true } },
      invitations: { include: { invitedUser: true } },
      requirements: true,
      documents: true,
    },
  })
})

// Return response
return Response.json({
  message: "Project berhasil dibuat",
  project: result,
}, { status: 201 })
```

### Apa yang Terjadi di Database

| Tabel | Aksi | Data |
|-------|------|------|
| `Project` | INSERT | title, description, status=DRAFT, mahasiswaId |
| `ProjectMember` | INSERT | projectId, userId (owner), role=LEADER |
| `TeamInvitation` | INSERT | projectId, invitedUserId, status=PENDING |
| `Notification` | INSERT | userId (invited), type=PROJECT_INVITATION |
| `ProjectRequirements` | INSERT | projectId, productionUrl, testingUsername |
| `Document` | INSERT | projectId, type=CONSENT, fileUrl |

---

## ✅ STEP 3: DATABASE SCHEMA & RELATIONS

### Model Project (Utama)
```prisma
model Project {
  id              String    @id @default(cuid())
  title           String    // Judul project
  description     String?   @db.Text
  status          ProjectStatus @default(DRAFT)
  githubRepoUrl   String?
  githubRepoName  String?
  productionUrl   String?
  orgRepoUrl      String?   // Setelah fork ke org
  
  semester        String    @default("Ganjil")
  tahunAkademik   String    @default("2024/2025")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  submittedAt     DateTime?
  similarityCheckedAt DateTime?
  
  // Relations
  mahasiswaId     String
  mahasiswa       User      @relation("ProjectOwner", fields: [mahasiswaId], references: [id])
  documents       Document[]
  requirements    ProjectRequirements?
  members         ProjectMember[]
  invitations     TeamInvitation[]
  // ... relations lainnya
}
```

### Model ProjectRequirements (Untuk Kalkulasi)
```prisma
model ProjectRequirements {
  id                  String   @id @default(cuid())
  projectId           String   @unique
  project             Project  @relation(fields: [projectId], references: [id])
  
  // Production & Testing
  productionUrl       String?
  productionUrlStatus String?  // "VERIFIED" atau "FAILED"
  testingUsername     String?
  testingPassword     String?
  testingNotes        String?
  
  // Completion Tracking
  completionPercent   Int      @default(0) // 0-100%
  
  // Bonus Points
  deploymentPlatform  String?  // "vps_nginx", "aws", "docker", etc
  deploymentDescription String? @db.Text
  deploymentBonusPoints Int    @default(0) // Auto-calculated
  
  // Status tracking
  verifiedAt          DateTime?
  updatedAt           DateTime @updatedAt
}
```

### Model ProjectMember
```prisma
model ProjectMember {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  role        String   @default("MEMBER") // "LEADER" atau "MEMBER"
  joinedAt    DateTime @default(now())
}
```

---

## ✅ STEP 4: AUTO-CALCULATIONS (Background Processing)

### A. Requirements Completion Percentage

**Trigger:** Setiap kali ProjectRequirements diupdate

**File:** [src/app/api/project-requirements/route.ts](src/app/api/project-requirements/route.ts)

```typescript
function calculateCompletionPercent(requirements: ProjectRequirements): number {
  const REQUIRED_FIELDS = [
    'integrasiMatakuliah',
    'metodologi',
    'ruangLingkup',
    'sumberDayaBatasan',
    'fiturUtama',
    'analisisTemuan',
    'presentasiUjian',
    'stakeholder',
    'kepatuhanEtika',
  ]
  
  let filledCount = 0
  REQUIRED_FIELDS.forEach((field) => {
    if (requirements[field] && requirements[field].trim().length > 0) {
      filledCount++
    }
  })
  
  return Math.round((filledCount / REQUIRED_FIELDS.length) * 100)
}

// Update completion percent
const completionPercent = calculateCompletionPercent(requirements)
await prisma.projectRequirements.update({
  where: { projectId },
  data: { completionPercent },
})
```

**Display:** Progress bar di project detail page

```
Kelengkapan Persyaratan: 45%
████████░░░░░░░░░░░░░░░░░░
Anda telah melengkapi 5 dari 11 item
```

---

### B. Deployment Bonus Points (Auto-Calculated)

**Trigger:** Ketika `deploymentPlatform` diupdate

**File:** [src/lib/utils.ts](src/lib/utils.ts) - `getDeploymentBonusPoints()`

```typescript
function getDeploymentBonusPoints(platform: string): number {
  const bonusMap: Record<string, number> = {
    "vps_nginx":      15,  // VPS + Nginx/Apache
    "vps_apache":     15,
    "shared_cpanel":  12,  // cPanel Hosting
    "aws":            12,  // AWS EC2, RDS, S3
    "gcp":            12,  // Google Cloud
    "azure":          12,  // Microsoft Azure
    "docker_vps":     10,  // Docker di VPS
    "railway":         8,  // Railway.app
    "fly_io":          8,  // Fly.io
    "render":          8,  // Render.com
    "vercel":          5,  // Vercel
    "netlify":         5,  // Netlify
    "github_pages":    3,  // GitHub Pages
  }
  
  return bonusMap[platform] || 0
}

// API call untuk save deployment info
POST /api/project-requirements
{
  projectId: "proj_123",
  deploymentPlatform: "vps_nginx",
  deploymentDescription: "..."
}

// Response akan include:
{
  deploymentBonusPoints: 15,  // AUTO-CALCULATED
  completionPercent: 45
}
```

**Display:** Badge di project detail

```
🚀 Deployment Bonus: +15 poin (VPS + Nginx)
```

---

### C. Similarity Detection (Python Service)

**Trigger:** Batch processing atau on-demand check

**Files:**
- [similarity-service/api.py](similarity-service/api.py) - FastAPI service (endpoint /analyze/*)
- [similarity-service/hybrid.py](similarity-service/hybrid.py) - Algoritma hybrid

**Algoritma Hybrid Scoring:**

```python
# Hybrid formula:
SG = α * SCB + (1 - α) * SW
- SG = Similarity Grade (Final Score)
- SCB = CodeBERT Score (Semantic similarity, 0-1)
- SW = Winnowing Score (Textual similarity, 0-1)
- α = 0.5 (balanced weight)

# Calibrated Thresholds:
- CodeBERT threshold: ≥ 0.99
- Winnowing threshold: ≥ 0.13

# Classification:
1. Plagiarisme KUAT: SCB ≥ 0.99 AND SW ≥ 0.13 → DANGER 🔴
2. Mirip Tekstual: SW ≥ 0.13 saja → WARNING 🟡
3. Mirip Semantik: SCB ≥ 0.99 saja → WARNING 🟡
4. Normal: Keduanya < threshold → SUCCESS 🟢
```

**API Trigger - Batch Similarity Check:**

```typescript
// File: src/app/api/similarity/batch/route.ts
POST /api/similarity/batch

// Request
{
  projectAId: "proj_123",
  projectBId: "proj_456"
}

// Processing:
// 1. Fetch source code dari kedua project (GitHub repo)
// 2. Send ke Python service untuk CodeBERT & Winnowing
// 3. Calculate hybrid score
// 4. Classify hasil
// 5. Store di SimilarityResult table

// Response
{
  similarityId: "sim_789",
  scoreCodeBert: 0.95,      // Semantic similarity
  scoreWinnowing: 0.12,     // Textual similarity
  scoreHybrid: 0.535,       // Final score: 0.5*0.95 + 0.5*0.12
  classification: "WARNING", // atau DANGER, SUCCESS
  isPlagiarized: false,
  detectedAt: "2026-05-10T10:30:00Z"
}
```

**Display:** Similarity chart di Dosen Dashboard

```
Project A vs Project B Similarity Analysis
┌────────────────────────────────────┐
│ CodeBERT Score:   95% (Semantic)   │
│ Winnowing Score:  12% (Textual)    │
│ Final Score:      53.5%            │
│ Status:           ⚠️  WARNING       │
│ Plagiarism Risk:  MEDIUM           │
└────────────────────────────────────┘
```

---

## ✅ STEP 5: FRONTEND - DISPLAY PROJECT DENGAN KALKULASI

### Lokasi UI Components

#### 1️⃣ Project List (Mahasiswa Dashboard)
- **File:** [src/app/(mahasiswa)/mahasiswa/projects/page.tsx](src/app/(mahasiswa)/mahasiswa/projects/page.tsx)
- **Menampilkan:** List semua projects dengan status & progress

**Cards menampilkan:**
- Project title & description
- Status badge: "DRAFT", "SUBMITTED", "APPROVED"
- Progress bar: Kelengkapan requirements (%)
- Deployment bonus: `+15 poin` badge
- Last updated date

---

#### 2️⃣ Project Detail Page
- **File:** [src/app/(mahasiswa)/mahasiswa/projects/[id]/page.tsx](src/app/(mahasiswa)/mahasiswa/projects/[id]/page.tsx)
- **Component:** [src/components/mahasiswa/project-detail-content.tsx](src/components/mahasiswa/project-detail-content.tsx)

**Section 1: Project Overview**
```
Project Title
├─ Status: DRAFT
├─ Created: 10 Mei 2026
├─ Last Updated: 10 Mei 2026
└─ Team Members: 3 orang
```

**Section 2: Kelengkapan Persyaratan**
```
Progress: 45%
████████░░░░░░░░░░░░░░░░░░

Completed Items:
✅ Basic Information
✅ GitHub Repository
✅ Team Members
❌ Deployment Platform
❌ Testing Credentials
❌ Consent Document
... (dst)
```

**Section 3: Kalkulasi & Bonus**
```
🚀 Deployment Information
   Platform: VPS + Nginx
   Bonus Points: +15
   Status: VERIFIED ✅

📊 Similarity Detection
   Status: Not checked yet
   [Button] Run Similarity Check

📋 Review & Scoring
   Average Score: 85
   Reviews: 2/3 completed
```

**Section 4: Documents & Evidence**
```
Dokumen Terlampir:
- Consent Agreement.pdf (2.1 MB)
- Deployment Evidence.docx (1.5 MB)
- Architecture Diagram.png (3.2 MB)
```

**Section 5: Team Members**
```
Leader:
👤 Fauzan Azhari (Verified)

Members:
👤 Budi Santoso (Active)
👤 Siti Nurhaliza (Pending)
```

---

### Fetching Data untuk Display

```typescript
// src/app/(mahasiswa)/mahasiswa/projects/[id]/page.tsx

async function ProjectDetailPage({ params }: { params: { id: string } }) {
  // Fetch project dengan semua relations
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      mahasiswa: true,
      members: { include: { user: true } },
      invitations: { include: { invitedUser: true } },
      requirements: true,         // Untuk completion % & deployment bonus
      documents: true,             // Consent & evidence files
      reviews: {                   // Untuk scoring
        include: { rubrikScores: true }
      },
      similarityAsA: true,         // Similarity results sebagai Project A
      similarityAsB: true,         // Similarity results sebagai Project B
      discussions: {               // Discussions/comments
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  // Calculate various metrics
  const completionPercent = project.requirements?.completionPercent ?? 0
  const deploymentBonus = project.requirements?.deploymentBonusPoints ?? 0
  const averageScore = calculateAverageScore(project.reviews)
  const similarityStatus = project.requirements?.similarityCheckedAt ? "Checked" : "Not checked"

  return (
    <ProjectDetailContent
      project={project}
      completionPercent={completionPercent}
      deploymentBonus={deploymentBonus}
      averageScore={averageScore}
      similarityStatus={similarityStatus}
    />
  )
}
```

---

### Real-time Updates

**Menggunakan WebSocket/Polling untuk:**
- Status project berubah
- Similarity check selesai
- New review submitted
- Team member accepted invitation

```typescript
// src/hooks/use-project-updates.ts

export function useProjectUpdates(projectId: string) {
  const [project, setProject] = useState(null)

  useEffect(() => {
    // Poll setiap 10 detik untuk updates
    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      const data = await res.json()
      setProject(data)
    }, 10000)

    return () => clearInterval(interval)
  }, [projectId])

  return project
}
```

---

## 📊 DIAGRAM ALUR DATA

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAHASISWA UI                                 │
│              (src/app/(mahasiswa)/mahasiswa/...)                    │
│                                                                      │
│  ┌──────────────────────────┐                                       │
│  │ Dashboard                │                                       │
│  │ [Button: Buat Project]   │                                       │
│  └──────────────┬───────────┘                                       │
│                 │                                                    │
│                 ▼                                                    │
│  ┌──────────────────────────┐                                       │
│  │ Form: /projects/new      │                                       │
│  │ - Basic Info             │                                       │
│  │ - GitHub Repo            │                                       │
│  │ - Technologies           │                                       │
│  │ - Team Members           │                                       │
│  │ - Deployment Info        │                                       │
│  │ - Consent Doc            │                                       │
│  └──────────────┬───────────┘                                       │
│                 │                                                    │
│                 │ Submit (POST /api/projects)                       │
│                 │                                                    │
└─────────────────┼────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API LAYER                                     │
│              (src/app/api/projects/route.ts)                         │
│                                                                      │
│  1. Validate Input                                                  │
│  2. Extract GitHub Info                                             │
│  3. Validate URLs                                                   │
│  4. Prisma Transaction:                                             │
│     ├─ Create Project                                               │
│     ├─ Add Project Member (LEADER)                                  │
│     ├─ Create Team Invitations                                      │
│     ├─ Send Notifications                                           │
│     ├─ Create ProjectRequirements                                   │
│     └─ Store Consent Document                                       │
│  5. Return Created Project                                          │
│                                                                      │
└─────────────────┬────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE (Prisma)                              │
│                                                                      │
│  ┌─ Project                                                         │
│  │  ├─ id, title, description, status                              │
│  │  ├─ githubRepoUrl, productionUrl                                │
│  │  └─ mahasiswaId (FK to User)                                    │
│  │                                                                  │
│  ├─ ProjectMember                                                  │
│  │  └─ userId, role="LEADER"                                       │
│  │                                                                  │
│  ├─ TeamInvitation                                                 │
│  │  ├─ invitedUserId, status="PENDING"                             │
│  │  └─ Notification ke user                                        │
│  │                                                                  │
│  ├─ ProjectRequirements                                            │
│  │  ├─ productionUrl, testingUsername                              │
│  │  ├─ deploymentPlatform, deploymentBonusPoints (15)              │
│  │  └─ completionPercent (0%)                                      │
│  │                                                                  │
│  └─ Document (Consent)                                             │
│     └─ fileUrl, fileName, mimeType                                 │
│                                                                      │
└─────────────────┬────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  BACKGROUND PROCESSING                              │
│                                                                      │
│  ⏰ Auto-triggers (event-driven atau scheduled):                    │
│                                                                      │
│  1. Similarity Detection                                            │
│     ├─ Fetch source code dari GitHub repo                          │
│     ├─ Python Service: CodeBERT + Winnowing                        │
│     ├─ Calculate Hybrid Score                                      │
│     └─ Store in SimilarityResult table                              │
│                                                                      │
│  2. URL Verification                                               │
│     ├─ Ping production URL                                         │
│     ├─ Check HTTP status                                           │
│     └─ Update productionUrlStatus                                  │
│                                                                      │
│  3. Completion Percentage                                          │
│     ├─ Count filled fields                                         │
│     └─ Update completionPercent                                    │
│                                                                      │
│  4. Deployment Bonus Points                                        │
│     ├─ Parse deploymentPlatform                                    │
│     └─ Auto-calculate bonus (15, 12, 10, 8, 5, 3 poin)            │
│                                                                      │
└─────────────────┬────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND DISPLAY                               │
│           (src/app/(mahasiswa)/mahasiswa/projects/[id])             │
│                                                                      │
│  ┌──────────────────────────┐                                       │
│  │ Project Detail Page      │                                       │
│  │                          │                                       │
│  │ ✅ Basic Info            │                                       │
│  │ ✅ Team Members          │                                       │
│  │ ✅ Deployment Info       │                                       │
│  │    └─ Bonus: +15 poin    │◄─── dari ProjectRequirements        │
│  │ ✅ Progress: 45%         │◄─── dari completionPercent          │
│  │ ✅ Similarity: PENDING   │◄─── dari SimilarityResult           │
│  │ ✅ Documents             │                                       │
│  │ ✅ Reviews & Scores      │                                       │
│  │                          │                                       │
│  └──────────────────────────┘                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 TECHNICAL CHECKLIST

### Ketika User Submit Form Create Project

- [ ] **Input Validation**
  - [ ] Title >= 5 chars
  - [ ] Description >= 20 chars
  - [ ] GitHub URL valid format
  - [ ] Production URL accessible
  - [ ] File size <= 10MB (jika ada)

- [ ] **Extract & Transform**
  - [ ] Extract repo name dari GitHub URL
  - [ ] Normalize semester ("Ganjil"/"Genap")
  - [ ] Parse technologies array
  - [ ] Validate invited user IDs exist

- [ ] **Database Insert (Transaction)**
  - [ ] Project created with status="DRAFT"
  - [ ] ProjectMember created for owner (role="LEADER")
  - [ ] TeamInvitations created untuk members
  - [ ] Notifications created untuk invited users
  - [ ] ProjectRequirements created (initial state)
  - [ ] Document created untuk consent

- [ ] **Response Sent**
  - [ ] Status: 201 Created
  - [ ] Return full project object with relations

### Auto-Calculations (Background)

- [ ] **Deployment Bonus** (ketika deploymentPlatform diupdate)
  - [ ] Match platform dengan bonus poin
  - [ ] Update deploymentBonusPoints
  - [ ] Display badge di UI

- [ ] **Requirements Completion** (ketika field diupdate)
  - [ ] Count filled vs total fields
  - [ ] Calculate percentage
  - [ ] Update completionPercent
  - [ ] Update progress bar di UI

- [ ] **Similarity Detection** (scheduled atau on-demand)
  - [ ] Fetch source code
  - [ ] Call Python service
  - [ ] Store result in SimilarityResult
  - [ ] Mark isPlagiarized
  - [ ] Display warning jika DANGER

### Frontend Display

- [ ] **Project List** menampilkan:
  - [ ] Title, description, status
  - [ ] Progress bar (completionPercent)
  - [ ] Deployment bonus badge
  - [ ] Team members count
  - [ ] Last updated time

- [ ] **Project Detail** menampilkan:
  - [ ] All basic info
  - [ ] Kelengkapan requirements dengan progress
  - [ ] Deployment info dengan bonus points
  - [ ] Team members status
  - [ ] Documents list
  - [ ] Similarity detection status
  - [ ] Reviews & average score
  - [ ] Discussion comments

---

## 🐛 DEBUGGING TIPS

### Project tidak muncul di list?
1. Check browser console untuk API errors
2. Verify user session: `await getSession()`
3. Check Prisma logs: `DEBUG=prisma:* npm run dev`
4. Verify user ID match dalam database

### Kalkulasi bonus tidak update?
1. Check jika `deploymentPlatform` valid dalam bonusMap
2. Verify ProjectRequirements record exist
3. Check jika endpoint `/api/project-requirements` accessible
4. Test function: `getDeploymentBonusPoints("vps_nginx")`

### Similarity detection tidak jalan?
1. Verify Python service running: `curl http://localhost:8000/health`
2. Check GitHub token valid
3. Verify source code accessible
4. Check logs: `docker logs similarity-service`

### Progress percentage tidak update?
1. Check jika ProjectRequirements created
2. Verify fields yang dihitung sudah diupdate
3. Test calculation function dengan sample data
4. Check jika completionPercent returned dari API

---

## 📚 FILE REFERENCE SUMMARY

| Aspek | File | Fungsi |
|-------|------|--------|
| **UI Form** | `src/app/(mahasiswa)/mahasiswa/projects/new/page.tsx` | Create project form |
| **API Create** | `src/app/api/projects/route.ts` | POST endpoint |
| **Prisma Schema** | `prisma/schema.prisma` | Database models |
| **Utilities** | `src/lib/utils.ts` | Helper functions (bonus calc, etc) |
| **Display** | `src/components/mahasiswa/project-detail-content.tsx` | Project detail UI |
| **Similarity** | `similarity-service/hybrid.py` | Similarity algorithm |
| **Requirements** | `src/app/api/project-requirements/route.ts` | Completion % calculation |

---

## 🎯 KESIMPULAN

**Alur Pembuatan Project Baru (End-to-End):**

1. **User Input** di Form → Validate & Submit
2. **API Process** → Create Project + Relations + Initial Calculations
3. **Database Store** → Project + Requirements + Members + Docs
4. **Background Tasks** → Auto-calculate Bonus, Completion%, Similarity
5. **Frontend Display** → Show Project dengan semua Kalkulasi

**Data Flow:**
```
Form Input → API POST → Database INSERT → Background Processing → Database UPDATE → Frontend FETCH → Display with Calculations
```

Setiap step sudah terintegrasi dan otomatis, user hanya perlu fill form dan system handle sisanya!
