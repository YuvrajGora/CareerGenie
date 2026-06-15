# CareerGenie 🚀

CareerGenie is an enterprise-grade, AI-powered recruitment and resume-tailoring platform that connects students with optimized job matching and provides recruiters with prioritized talent acquisition tools. Powered by **Next.js 16 (App Router)** and the **Google Gemini Pro AI SDK**, CareerGenie automates the job discovery, ATS validation, cover letter generation, and interview preparation workflows.

---

## 📖 Table of Contents
1. [Core Features](#-core-features)
2. [Matching Engine Algorithm](#-matching-engine-algorithm)
3. [Architecture Overview](#-architecture-overview)
4. [Tech Stack](#-tech-stack)
5. [Environment Variables](#-environment-variables)
6. [Verification & Testing Scripts](#-verification--testing-scripts)
7. [Local Setup Guide](#-local-setup-guide)
8. [Production Deployment](#-production-deployment)
9. [Author Information](#-author-information)

---

## ✨ Core Features

### 🎓 For Students
- **Interactive Resume Builder & Canvas**: 
  - Manage multiple **Resume Versions** tailored for different target roles (e.g., Frontend Developer, Full-Stack Developer).
  - Select between modern, professional, or minimal design layouts.
- **Live ATS Score Heuristic Preview**: Dynamically estimates resume score and lists matched and missing skills in real-time as fields are modified.
- **ATS Analysis History**: Track resume performance over time with a complete score progression graph/history log.
- **AI-Assisted Writing & Optimization**:
  - **Bullet Point Optimizer**: Rewrites experience items using strong action verbs and quantified impact metrics.
  - **Summary Rewriting**: Reformulates headers/summaries across Professional, Enthusiastic, or Concise tones.
  - **Action Verb Suggestions**: Automatically recommends stronger professional verbs.
- **PDF & TXT Export**: Responsive print layouts that enable direct download or clean printing to PDF.
- **AI Cover Letter Generator**: Generates custom, tone-selected (Professional, Enthusiastic, Concise) cover letters personalized to the company and role, persisting and caching them in MongoDB.
- **AI Interview Preparation**: Generates structured mock interview questions, recruiter intents, suggested model answers, and lists technical/behavioral weaknesses tailored to a specific job listing.
- **Dashboard Intelligence**: Bento-style student portal displaying real-time ATS scores, job matching metrics, visual progression tracks, activity feeds, and market insights.
- **Saved Jobs & Tracking**: Explore matching jobs, save roles, and track applications.

### 💼 For Recruiters
- **Applicant Tracking System (ATS)**: Monitor all open positions and receive prioritized lists of applicants sorted by their AI-calculated match score.
- **Match Score Visibility**: Deep drill-down to review candidates' credentials, extracted skills, and semantic alignments.
- **Safety Intercept Modal**: Prevention confirmation dialogs for critical actions (e.g., rejecting applicants) to avoid accidental state mutations.
- **Job Posting Panel**: Post detailed job requirements specifying required skills, experience levels, description, and salary.
- **Email Notifications**: Dynamic HTML email dispatch notifying applicants and recruiters on status transitions (e.g., Application Accepted/Rejected).

### 🛡️ Production & Security Features
- **Authentication & Authorization**: High-security JWT-in-cookie flow with built-in Role-Based Access Control (RBAC) supporting `student`, `recruiter`, and `admin` roles.
- **MongoDB Atlas Storage**: Fully scalable database configuration utilizing Mongoose schemas with robust validation.
- **Google Gemini Integration**: Native integration with the official `@google/genai` SDK using `gemini-2.5-flash` for high-speed, cost-effective processing.
- **Cloudinary Integration**: Cloud hosting for uploaded candidate resumes.
- **MongoDB-Backed Rate Limiting**: Request-based rate limit throttling (with TTL indexes) on AI routes to protect endpoints against API abuse and manage Gemini token costs.
- **Recalculation Cooldowns**: Enforces a strict 30-second cooldown per user/version to restrict rapid AI scoring requests.
- **Dashboard Recommendation Caching**: Persistent 24-hour cache for dashboard AI advice to avoid redundant Gemini API token consumption.
- **Zod Validation Hardening**: Request validation using schema definitions to guarantee structural integrity and prevent database injection/CastErrors.
- **Vercel Deployment Ready**: Pre-configured for deployment with optimized Next.js static and dynamic routing.

---

## 📐 Matching Engine Algorithm

The dynamic job match score (from 0% to 100%) is calculated utilizing a weighted, multi-factored compatibility algorithm:
1. **Core Skills Match (60%)**: Measures the direct intersection of the candidate's parsed skills against the job's required keywords.
2. **Experience Alignment (20%)**: Linearly rates candidate's years of professional experience against target job requirements.
3. **Education Alignment (10%)**: Checks for key academic levels and specific major fields (e.g., Computer Science, Engineering).
4. **Semantic Description Match (10%)**: Performs text similarity analysis across the candidate's summary and the job's detailed description.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [MongoDB](https://www.mongodb.com/) & [Mongoose ODM](https://mongoosejs.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Artificial Intelligence**: [Google Gemini Pro AI SDK](https://github.com/google/generative-ai-js)
- **Object Storage**: [Cloudinary API](https://cloudinary.com/)
- **Mailing Service**: [Nodemailer](https://nodemailer.com/) (with dynamic local development Ethereal SMTP fallback)
- **Form & Payload Validation**: [Zod](https://zod.dev/)

---

## 📋 Environment Variables

Create a `.env.local` file in the project root with the following configuration:

| Variable Name | Description | Example / Fallback Value |
| :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB Connection URI | `mongodb+srv://<user>:<password>@cluster.mongodb.net/careergenie` |
| `JWT_SECRET` | Secret key used for JWT signature | `your-secure-development-jwt-secret-key-32chars` |
| `JWT_EXPIRES_IN` | Duration of JWT session validity | `7d` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSyD...` (Or omit for mock fallback mode) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name | `your-cloudinary-name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your-cloudinary-api-key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `your-cloudinary-api-secret` |
| `EMAIL_HOST` | SMTP server host address | `smtp.mailtrap.io` |
| `EMAIL_PORT` | SMTP server port number | `2525` (or `587` / `465`) |
| `EMAIL_USER` | SMTP server username credential | `your-smtp-username` |
| `EMAIL_PASS` | SMTP server password credential | `your-smtp-password` |
| `EMAIL_FROM` | Outbound sender envelope header | `"CareerGenie Support" <noreply@careergenie.com>` |

---

## 🧪 Verification & Testing Scripts

A suite of verification scripts are provided to perform automated E2E integration testing. Execute these commands to confirm backend correctness and API integrity:

- **E2E Resume Builder Suite**: Tests CRUD, duplication, AI score recalculation, 30s cooldowns, primary sync, and AI assistants.
  ```bash
  npx tsx scripts/verify-resume-builder.ts
  ```
- **Rate Limiting Suite**: Validates TTL rate-limit records, 429 response codes, and HTTP headers (`Retry-After`, `X-RateLimit-Remaining`).
  ```bash
  npx tsx scripts/verify-rate-limiting.ts
  ```
- **Dashboard Cache Suite**: Tests recommendation caching, 24h expiration, and manual refreshing.
  ```bash
  npx tsx scripts/verify-dashboard.ts
  ```
- **Cover Letter Engine**: Tests Mongo storage, tone variance generation, and caching.
  ```bash
  npx tsx scripts/verify-cover-letter.ts
  ```
- **Interview Preparation**: Assures recursive mock interview generation and caching.
  ```bash
  npx tsx scripts/verify-interview-prep.ts
  ```
- **Database & Match Algorithm**: Tests DB collections and match score weighing logic.
  ```bash
  npx tsx scripts/test-backend.ts
  ```
- **Nodemailer Dispatcher**: Verifies HTML template rendering and SMTP connections.
  ```bash
  npx tsx scripts/test-email.ts
  ```

---

## 💻 Local Setup Guide

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- MongoDB local daemon or MongoDB Atlas URL.

### Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/YuvrajGora/CareerGenie.git
   cd CareerGenie
   ```
2. **Install all dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Modify `.env.local` with your database and API credentials.
4. **Boot up development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🌐 Production Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel.
2. In Project Settings, add all items listed in the [Environment Variables](#-environment-variables) section.
3. Vercel automatically builds and deploys the Next.js production bundle.

### Production Database Setup
1. Deploy a cluster on MongoDB Atlas.
2. Under Network Access, allow connection access from Vercel's outgoing IP addresses (or whitelist `0.0.0.0/0` for dynamic serverless functions).
3. Update the `MONGODB_URI` env variable in Vercel to point to your production cluster.

---

## 👥 Author Information

Developed with ❤️ by **Yuvraj Gora**.
- **Email**: [yuvrajgora10mar@gmail.com](mailto:yuvrajgora10mar@gmail.com)
- **GitHub**: [@YuvrajGora](https://github.com/YuvrajGora)
- **LinkedIn**: [Yuvraj Gora](https://www.linkedin.com/in/yuvraj-gora-b4735a367)
