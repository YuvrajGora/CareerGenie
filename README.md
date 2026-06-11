# CareerGenie

CareerGenie is an intelligent, AI-powered recruitment and job matching platform that bridges the gap between students looking for careers and recruiters searching for the perfect talent. It leverages the latest **Google Gemini AI SDK** to analyze resumes, extract key technical and soft skills, and automatically calculate a compatibility score for open positions.

---

## 🚀 Problem Statement

Traditional job search websites rely heavily on literal keyword matching, which often overlooks qualified candidates whose resumes use different synonyms or formats. On the other hand, recruiters struggle with manual resume screening, wasting hours filtering through hundreds of applications.

**CareerGenie** solves this by:
1. Providing students with real-time AI-powered resume analysis, offering actionable suggestions to improve ATS friendliness and highlight gaps.
2. Providing recruiters with a prioritized applicant list sorted by a comprehensive matching score that accounts for skills, experience, education, and semantic description matching.
3. Incorporating double-check validation flows for critical recruiter actions (such as rejections) to avoid accidental state changes.

---

## ✨ Features

### 🎓 For Students
- **Interactive Resume Analysis**: Upload resumes (extracted text) and receive instant, structured feedback using Gemini AI, detailing strengths, weaknesses, missing skills, and suggestions.
- **Smart Matching Engine**: Automatically match with job openings based on a comprehensive 60/20/10/10 weighted matching algorithm.
- **Personalized Job Discovery**: Explore curated jobs and save favorites for future review.
- **Interactive Dashboards**: View overall profile stats, education, parsed skills, and track application status in real-time.
- **Email Notifications**: Receive beautifully designed HTML confirmation emails upon submitting applications.

### 💼 For Recruiters
- **Recruiter Dashboard**: Monitor overall recruitment stats (total job postings, average applicant matching scores, pending reviews).
- **Prioritized Applicant View**: Review applications sorted by their compatibility score, making it easy to identify top candidates instantly.
- **Safety Intercept Modal**: Intercept candidate rejection actions with a modern confirmation dialog to ensure no accidental rejections occur.
- **Job Posting Management**: Create and post job listings specifying required skills, description, experience level, and salary.

---

## 🛠️ Tech Stack

- **Core Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Runtime & Compilation**: Turbopack & TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) via [Mongoose ODM](https://mongoosejs.com/)
- **Artificial Intelligence**: [Google Gemini AI SDK](https://github.com/google/generative-ai-js) (`gemini-2.5-flash` model)
- **Email Dispatch**: [Nodemailer](https://nodemailer.com/) (with built-in dynamic Ethereal fallback for local development)
- **Validation**: [Zod](https://zod.dev/) Zod Schema Validation
- **Authentication**: JWT Cookies & RBAC (Role-Based Access Control)

---

## 📐 Architecture

```mermaid
graph TD
    subgraph Client [Client Portal - Next.js App]
        SD[Student Dashboard]
        RD[Recruiter Dashboard]
        AP[Auth Portal]
    end

    subgraph API [API Route Handlers]
        AuthH[Auth Middleware / JWT]
        JobH[Jobs API]
        AppH[Applications API]
        ResH[Resume Analysis API]
    end

    subgraph Core [Business Logic & Services]
        ME[Matching Engine]
        GAI[Gemini AI Service]
        EM[Nodemailer Email Service]
    end

    subgraph Storage [Database & Storage]
        DB[(MongoDB Atlas)]
        CL[Cloudinary API]
    end

    SD --> AuthH
    RD --> AuthH
    AP --> AuthH

    AuthH --> JobH
    AuthH --> AppH
    AuthH --> ResH

    ResH --> GAI
    AppH --> ME
    AppH --> EM
    ME --> GAI

    JobH --> DB
    AppH --> DB
    ResH --> DB
    GAI --> CL
```

### 🧠 The Matching Algorithm
The compatibility match percentage is calculated dynamically based on four key components:
1. **Core Skills Match (60%)**: Calculates intersection between candidate's extracted skills and the job's required skills.
2. **Experience Alignment (20%)**: Linearly compares candidate's experience against required years of experience.
3. **Education Alignment (10%)**: Checks for degree keywords (e.g., "Computer Science", "Engineering").
4. **Semantic Description Match (10%)**: Analyzes keyword overlaps in descriptions.

---

## 📋 Environment Variables

Create a `.env.local` file in the root directory and configure the following variables:

| Environment Variable | Description | Example Value |
| :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB Connection String | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Secret key for JWT cookie signature | `your-secure-jwt-secret-key-here` |
| `JWT_EXPIRES_IN` | JWT Expiry duration | `7d` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSyD...` (or omit for Mock Fallback mode) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary name | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your-cloudinary-api-key` |
| `CLOUDINARY_API_SECRET`| Cloudinary API Secret | `your-cloudinary-secret` |
| `EMAIL_HOST` | SMTP Server Host | `smtp.mailtrap.io` |
| `EMAIL_PORT` | SMTP Server Port | `2525` |
| `EMAIL_USER` | SMTP Server Username | `your-smtp-user` |
| `EMAIL_PASS` | SMTP Server Password | `your-smtp-pass` |
| `EMAIL_FROM` | Outgoing Email Header | `"CareerGenie" <noreply@careergenie.com>` |

*Note: If `GEMINI_API_KEY` is omitted, the app will run with a deterministic mock fallback for resume analysis. If SMTP credentials are omitted, the app automatically provisions a test Ethereal SMTP account and displays preview URLs in the console.*

---

## 💻 Local Development Setup

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [MongoDB local or Atlas instance](https://www.mongodb.com/)

### Steps
1. **Clone the Repository**
   ```bash
   git clone https://github.com/YuvrajGora/CareerGenie.git
   cd CareerGenie
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy `.env.example` to `.env.local` and add your credentials.
   ```bash
   cp .env.example .env.local
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Run Verification Scripts**
   Test backend API and algorithms:
   ```bash
   npx tsx scripts/test-backend.ts
   npx tsx scripts/test-email.ts
   ```

---

## 🌐 Deployment Instructions

### Deploy to Vercel
1. Install Vercel CLI or link your repository to the [Vercel Dashboard](https://vercel.com).
2. Configure environment variables listed in the Environment Variables table in the Vercel project settings.
3. Trigger the build: Next.js App Router will compile Turbopack bundles and optimize static rendering.

### Production Database Setup
1. Setup a MongoDB Atlas Shared Cluster.
2. In network settings, whitelist the Vercel deployment IP range (or allow access from anywhere `0.0.0.0/0` for serverless environments).
3. Set the production `MONGODB_URI` environment variable.

---

## ✨ Future Enhancements

- **Real-time Chat**: Direct messaging channel between students and recruiters.
- **AI-Powered Mock Interview**: Conversational interview agent based on job descriptions and matching skills.
- **Calendar Scheduler**: Integrated interview scheduler using Google Calendar API.

---

## 👥 Author Information

Developed with ❤️ by **Yuvraj Gora**. 
For inquiries, contributions, or feedback, please contact:
- **Email**: [yuvrajgora.dev@gmail.com](mailto:yuvrajgora.dev@gmail.com)
- **GitHub**: [@YuvrajGora](https://github.com/YuvrajGora)
