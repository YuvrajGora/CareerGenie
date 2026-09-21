import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

// Initialize the Google Gen AI client dynamically if API key is present
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      aiClient = new GoogleGenAI({ apiKey });
      console.log('Gemini AI Service initialized dynamically with API Key.');
      return aiClient;
    } catch (error) {
      console.error('Failed to initialize Gemini AI Service client:', error);
    }
  } else {
    console.warn('GEMINI_API_KEY environment variable is not defined. Resume Analysis will run in Mock Fallback mode.');
  }
  return null;
}

export interface ResumeAnalysisResult {
  overallScore: number;
  atsScore: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  suggestions: string[];
  extractedSkills: string[];
  yearsOfExperience: number;
  careerLevel: 'Intern' | 'Junior' | 'Mid-Level' | 'Senior';
}

export interface JobRecommendationResult {
  jobId: string;
  matchScore: number;
  reasoning: string;
}

/**
 * Parses and analyzes resume text using Google Gemini AI, with a fallback mock mechanism.
 */
export async function analyzeResume(
  resumeText: string,
  targetRole?: string,
  documentData?: { base64Data: string; mimeType: string }
): Promise<ResumeAnalysisResult> {
  if ((!resumeText || resumeText.trim().length === 0) && !documentData) {
    throw new Error('Resume text content or document data is required.');
  }

  const client = getAiClient();

  // Fallback check
  if (!client) {
    console.info('Using Gemini Mock Fallback for Resume Analysis.');
    return getMockAnalysis(resumeText || 'Candidate Resume Profile', targetRole);
  }

  try {
    const rolePrompt = targetRole ? `Evaluate the candidate's resume specifically targeting the role: "${targetRole}". Make sure missingSkills, strengths, weaknesses, and suggestions are tailored to this target role.` : '';
    const prompt = `
      You are an expert AI Resume Analyzer and ATS Optimization specialist. 
      Analyze the candidate's resume and generate a detailed report.
      
      ${rolePrompt}
      
      You must respond with a JSON object ONLY, conforming strictly to this TypeScript interface:
      {
        overallScore: number; // 0 to 100, candidate's overall readiness
        atsScore: number; // 0 to 100, ATS scan friendliness score
        strengths: string[]; // List of 3-5 key professional strengths
        weaknesses: string[]; // List of 3-5 areas of improvement or gaps
        missingSkills: string[]; // List of skills/technologies commonly expected for the candidate's profile but missing
        suggestions: string[]; // List of 3-5 actionable suggestions to improve the resume
        extractedSkills: string[]; // Flat list of all technical and soft skills identified in the text
        yearsOfExperience: number; // Total years of professional experience (use 0 for interns/entry level)
        careerLevel: string; // The career level matching the experience: 'Intern', 'Junior', 'Mid-Level', 'Senior'
      }

      Do not include any markdown format blocks (like \`\`\`json) or text before/after the JSON. Just return the raw JSON content.
      ${resumeText ? `\nResume Text:\n"${resumeText.replace(/"/g, '\\"')}"` : ''}
    `;

    const contents: any[] = [prompt];
    if (documentData && documentData.base64Data) {
      contents.push({
        inlineData: {
          data: documentData.base64Data,
          mimeType: documentData.mimeType || 'application/pdf',
        },
      });
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response received from Gemini API.');
    }

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as ResumeAnalysisResult;

    // Validate structure and ranges
    if (typeof result.overallScore !== 'number' || typeof result.atsScore !== 'number') {
      throw new Error('Invalid score types returned from AI response.');
    }

    // Standardize career level
    let parsedCareerLevel: 'Intern' | 'Junior' | 'Mid-Level' | 'Senior' = 'Junior';
    const rawLevel = String(result.careerLevel).toLowerCase();
    if (rawLevel.includes('intern')) {
      parsedCareerLevel = 'Intern';
    } else if (rawLevel.includes('junior')) {
      parsedCareerLevel = 'Junior';
    } else if (rawLevel.includes('mid') || rawLevel.includes('middle')) {
      parsedCareerLevel = 'Mid-Level';
    } else if (rawLevel.includes('senior') || rawLevel.includes('lead') || rawLevel.includes('principal')) {
      parsedCareerLevel = 'Senior';
    } else {
      // Fallback based on years of experience if string is weird
      const years = Number(result.yearsOfExperience) || 0;
      if (years < 1) parsedCareerLevel = 'Intern';
      else if (years < 3) parsedCareerLevel = 'Junior';
      else if (years < 6) parsedCareerLevel = 'Mid-Level';
      else parsedCareerLevel = 'Senior';
    }

    return {
      overallScore: Math.min(100, Math.max(0, result.overallScore)),
      atsScore: Math.min(100, Math.max(0, result.atsScore)),
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      missingSkills: Array.isArray(result.missingSkills) ? result.missingSkills : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      extractedSkills: Array.isArray(result.extractedSkills) ? result.extractedSkills : [],
      yearsOfExperience: typeof result.yearsOfExperience === 'number' ? result.yearsOfExperience : 0,
      careerLevel: parsedCareerLevel,
    };
  } catch (error: any) {
    console.error('Gemini API resume analysis failed, falling back to mock response:', error);
    return getMockAnalysis(resumeText);
  }
}

/**
 * Generates mock resume analysis data based on the resume text content.
 */
function getMockAnalysis(resumeText: string, targetRole?: string): ResumeAnalysisResult {
  // Simple heuristic parsing to customize mock data slightly
  const lowerText = resumeText.toLowerCase();
  const hasReact = lowerText.includes('react');
  const hasPython = lowerText.includes('python');
  
  const baseSkills = ['Git', 'REST APIs', 'HTML5', 'CSS3', 'Agile'];
  if (hasReact) {
    baseSkills.push('JavaScript', 'TypeScript', 'React', 'Next.js', 'Tailwind CSS');
  }
  if (hasPython) {
    baseSkills.push('Python', 'Django', 'Flask', 'SQL', 'Data Analysis');
  }
  if (!hasReact && !hasPython) {
    baseSkills.push('Java', 'Spring Boot', 'SQL', 'Hibernate', 'Docker');
  }

  // Heuristic years of experience estimation for mock fallback
  let yearsOfExp = 2;
  const expMatch = resumeText.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/i);
  if (expMatch) {
    yearsOfExp = parseInt(expMatch[1], 10);
  } else if (lowerText.includes('intern') || lowerText.includes('student')) {
    yearsOfExp = 0;
  }

  let mockCareerLevel: 'Intern' | 'Junior' | 'Mid-Level' | 'Senior' = 'Junior';
  if (yearsOfExp === 0) mockCareerLevel = 'Intern';
  else if (yearsOfExp < 3) mockCareerLevel = 'Junior';
  else if (yearsOfExp < 6) mockCareerLevel = 'Mid-Level';
  else mockCareerLevel = 'Senior';

  const strengths = [
    'Strong technical foundational knowledge matching industry standards',
    'Good formatting and structure with clear section dividers',
    'Relevant project accomplishments listed in detail'
  ];

  const weaknesses = [
    'Lack of clear cloud deployment infrastructure mentions (AWS/GCP/Azure)',
    'Minimal evidence of unit testing or integration testing strategies',
    'Soft skills section is underspecified'
  ];

  const missingSkills = [
    'Docker',
    'CI/CD Pipelines (GitHub Actions/Jenkins)',
    'Redis Caching',
    'Kubernetes'
  ];

  const suggestions = [
    'Quantify achievements (e.g., "Improved load time by 30%" instead of "Worked on website performance").',
    'Add a dedicated "Technical Skills" keyword section for better ATS compliance.',
    'Add certificates or links to public GitHub projects to showcase active contributions.'
  ];

  if (targetRole) {
    strengths.unshift(`Strong alignment with target role: ${targetRole}`);
    missingSkills.unshift('Cloud Architecture', 'Advanced microservices');
    suggestions.push(`Review core competencies specific to ${targetRole} to improve ATS scan match rate.`);
  }

  return {
    overallScore: targetRole ? 85 : 78,
    atsScore: targetRole ? 88 : 82,
    strengths,
    weaknesses,
    missingSkills,
    suggestions,
    extractedSkills: baseSkills,
    yearsOfExperience: yearsOfExp,
    careerLevel: mockCareerLevel
  };
}

export interface DashboardRecommendationsResult {
  title: string;
  text: string;
  skills: string[];
}

/**
 * Generates dynamic, personalized career recommendations using Gemini AI, with a robust fallback.
 */
export async function generateDashboardRecommendations(
  userSkills: string[],
  missingSkills: string[],
  jobMatches: any[]
): Promise<DashboardRecommendationsResult> {
  const client = getAiClient();

  if (!client) {
    console.info('Using Gemini Mock Fallback for Dashboard Recommendations.');
    return getMockDashboardRecommendations(userSkills, missingSkills, jobMatches);
  }

  try {
    const prompt = `
      You are an expert AI career advisor. Generate a dynamic, highly personalized recommendation for a student's dashboard.
      
      Inputs:
      - Student's current skills: ${JSON.stringify(userSkills)}
      - Missing skills identified from resume: ${JSON.stringify(missingSkills)}
      - Target jobs and compatibility: ${JSON.stringify(jobMatches.map(j => ({ title: j.title, company: j.company, matchScore: j.matchScore, requiredSkills: j.requiredSkills })))}
      
      Provide a highly encouraging recommendation emphasizing concrete, actionable next steps. Identify 1 or 2 high-impact skills that the student should acquire or emphasize to dramatically improve their match chances for the target jobs.
      
      You must respond with a JSON object ONLY, conforming strictly to this TypeScript interface:
      {
        title: string; // Catchy header, e.g., "Boost your employability", "Unlock Mid-Level Roles", "Strengthen Cloud expertise"
        text: string; // A 1-2 sentence compelling message explaining why adding these skills will improve their compatibility (e.g., "Adding React and Docker to your skills section will increase your matching score by approximately 15% for the roles you're targeting.")
        skills: string[]; // List of 1-3 highly relevant skills to focus on
      }
      Do not include any markdown format blocks (like \`\`\`json) or text before/after the JSON. Just return the raw JSON content.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response received from Gemini API.');
    }

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as DashboardRecommendationsResult;

    return {
      title: result.title || 'Boost your employability',
      text: result.text || 'Add high-demand skills to your profile to stand out to employers.',
      skills: Array.isArray(result.skills) ? result.skills : [],
    };
  } catch (error: any) {
    console.error('Gemini dashboard recommendations generation failed, using mock fallback:', error);
    return getMockDashboardRecommendations(userSkills, missingSkills, jobMatches);
  }
}

function getMockDashboardRecommendations(
  userSkills: string[],
  missingSkills: string[],
  jobMatches: any[]
): DashboardRecommendationsResult {
  const targetSkills = new Set<string>();
  
  if (Array.isArray(jobMatches)) {
    jobMatches.forEach(j => {
      if (Array.isArray(j.requiredSkills)) {
        j.requiredSkills.forEach((s: string) => {
          if (!userSkills.includes(s)) targetSkills.add(s);
        });
      }
    });
  }
  
  if (Array.isArray(missingSkills)) {
    missingSkills.forEach(s => {
      if (!userSkills.includes(s)) targetSkills.add(s);
    });
  }

  const recommended = Array.from(targetSkills).slice(0, 2);
  if (recommended.length === 0) {
    recommended.push('TypeScript', 'Docker');
  }

  const skillListStr = recommended.join(' and ');
  return {
    title: 'Boost your employability',
    text: `Adding ${skillListStr} to your skills section will increase your matching score by approximately 15% for the roles you're targeting.`,
    skills: recommended
  };
}

export interface InterviewQuestion {
  question: string;
  suggestedAnswer: string;
  recruiterIntent: string;
  type: 'technical' | 'behavioral';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface InterviewWeakness {
  skill: string;
  reason: string;
  recommendation: string;
}

export interface InterviewPrepResult {
  questions: InterviewQuestion[];
  weaknesses: InterviewWeakness[];
}

/**
 * Generates technical & behavioral interview preparation details using Gemini AI, with a robust fallback.
 */
export async function generateInterviewPrep(
  resumeText: string,
  atsAnalysis: any,
  jobDescription: string,
  candidateSkills: string[],
  experienceLevel: string,
  yearsOfExperience: number,
  targetRole?: string
): Promise<InterviewPrepResult> {
  const client = getAiClient();

  if (!client) {
    console.info('Using Gemini Mock Fallback for Interview Prep.');
    return getMockInterviewPrep(candidateSkills, experienceLevel, yearsOfExperience, targetRole);
  }

  try {
    const prompt = `
      You are an expert AI Technical Interviewer and Career Coach. 
      Generate 15 to 20 realistic interview questions, suggested answers, recruiter intents, and structured weaknesses for a candidate based on their profile and a target job.

      Inputs:
      - Candidate Resume Text: "${resumeText.replace(/"/g, '\\"')}"
      - Resume ATS Analysis: ${JSON.stringify(atsAnalysis)}
      - Job Description: "${jobDescription.replace(/"/g, '\\"')}"
      - Candidate Skills: ${JSON.stringify(candidateSkills)}
      - Candidate Experience Level: "${experienceLevel}" (Years of experience: ${yearsOfExperience})

      Requirements:
      1. Generate a total of 15 to 20 questions.
      2. Categorize each question as either 'technical' or 'behavioral'.
      3. For each question, provide:
         - question: The interview question.
         - suggestedAnswer: A detailed, professional suggested answer that highlights how the candidate can leverage their specific strengths while aligning with the job description.
         - recruiterIntent: Explain why the recruiter/interviewer asks this question (e.g. "Tests understanding of state management and modern React development patterns").
         - type: 'technical' or 'behavioral'.
         - difficulty: 'beginner', 'intermediate', or 'advanced'.
      4. Adjust question difficulties based on the candidate's experience level (${experienceLevel}, ${yearsOfExperience} years of experience) and target job requirements:
         - If Intern or Junior: Focus more on beginner and intermediate questions (testing fundamentals, syntax, simple problem solving, and basic behavioral scenarios).
         - If Mid-Level: Mix intermediate and advanced questions (architectural decisions, performance, error handling, team collaboration).
         - If Senior: Focus heavily on advanced questions (system design, scalability, leadership, conflict resolution, mentoring, and trade-offs).
      5. Identify 3-5 weak areas or missing skills/concepts where the candidate might need improvement to succeed in this interview. For each weakness, provide:
         - skill: The skill, concept, or tool name (e.g., "Docker", "System Design").
         - reason: Why this appears to be a gap (e.g., "Appears frequently in matching jobs but is missing from your resume").
         - recommendation: Actionable next step to improve (e.g., "Build and deploy a containerized application").

      You must respond with a JSON object ONLY, conforming strictly to this TypeScript interface:
      {
        questions: Array<{
          question: string;
          suggestedAnswer: string;
          recruiterIntent: string;
          type: 'technical' | 'behavioral';
          difficulty: 'beginner' | 'intermediate' | 'advanced';
        }>;
        weaknesses: Array<{
          skill: string;
          reason: string;
          recommendation: string;
        }>;
      }

      Do not include any markdown format blocks (like \`\`\`json) or text before/after the JSON. Just return the raw JSON content.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response received from Gemini API.');
    }

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as InterviewPrepResult;

    if (!Array.isArray(result.questions) || result.questions.length === 0) {
      throw new Error('No interview questions returned in JSON.');
    }

    return {
      questions: result.questions.map(q => ({
        question: q.question || '',
        suggestedAnswer: q.suggestedAnswer || '',
        recruiterIntent: q.recruiterIntent || '',
        type: q.type === 'behavioral' ? 'behavioral' : 'technical',
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(q.difficulty) ? q.difficulty : 'intermediate'
      })),
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.map(w => ({
        skill: w.skill || '',
        reason: w.reason || '',
        recommendation: w.recommendation || ''
      })) : []
    };

  } catch (error: any) {
    console.error('Gemini interview prep generation failed, using mock fallback:', error);
    return getMockInterviewPrep(candidateSkills, experienceLevel, yearsOfExperience);
  }
}

/**
 * Generates mock interview prep details tailored to candidate's skills and experience.
 */
function getMockInterviewPrep(
  skills: string[],
  level: string,
  yearsOfExperience: number,
  targetRole?: string
): InterviewPrepResult {
  const techPool = [
    {
      question: `How do you handle asynchronous state management in applications built with React and TypeScript?`,
      suggestedAnswer: `Explain using hooks like useEffect, React Query, or Redux Toolkit. Mention how type safety helps catch bugs early by defining strict interfaces for API payloads and component state.`,
      recruiterIntent: `Tests understanding of modern React state patterns, asynchronous processing, and typescript safety.`,
      type: 'technical' as const,
      difficulty: 'intermediate' as const
    },
    {
      question: `Explain the difference between SQL and NoSQL databases, and when you would choose MongoDB over PostgreSQL.`,
      suggestedAnswer: `NoSQL (MongoDB) provides horizontal scalability and document flexibility (storing JSON-like payloads), ideal for unstructured data. SQL (PostgreSQL) is ideal for complex transactional systems requiring rigid schemas, relational integrity, and strict ACID guarantees.`,
      recruiterIntent: `Assesses data modeling proficiency and database system selection tradeoffs.`,
      type: 'technical' as const,
      difficulty: 'intermediate' as const
    },
    {
      question: `What are your strategies for optimizing performance in Next.js applications?`,
      suggestedAnswer: `Mention Server-Side Rendering (SSR), Incremental Static Regeneration (ISR), lazy loading, dynamic imports, image optimization via next/image, and minimizing bundle size by auditing third-party libraries.`,
      recruiterIntent: `Evaluates production-readiness, optimization intuition, and core Next.js performance concepts.`,
      type: 'technical' as const,
      difficulty: 'advanced' as const
    },
    {
      question: `How do you implement secure authentication in a Node.js REST API?`,
      suggestedAnswer: `Use JWT tokens stored in HTTP-only, secure, SameSite cookies. Hash passwords using bcrypt before saving to the database. Use proper CORS/security headers via Helmet, and implement rate limiting to protect against brute-force attacks.`,
      recruiterIntent: `Probes core web security concepts, backend encryption best practices, and API security.`,
      type: 'technical' as const,
      difficulty: 'intermediate' as const
    },
    {
      question: `What is containerization, and how do you use Docker in your development and deployment workflows?`,
      suggestedAnswer: `Docker packages code, runtime, system tools, and libraries into portable, isolated containers. This guarantees uniformity across dev, staging, and production environments, preventing the 'works on my machine' issue.`,
      recruiterIntent: `Verifies knowledge of modern devops containerization and cloud deployment concepts.`,
      type: 'technical' as const,
      difficulty: 'advanced' as const
    },
    {
      question: `Can you explain RESTful API design principles and how you structure endpoints?`,
      suggestedAnswer: `Use plural nouns for resource paths, correct HTTP verbs (GET, POST, PUT, DELETE), standard HTTP status codes (200, 201, 400, 401, 404, 500), and query parameters for filtering, sorting, or pagination.`,
      recruiterIntent: `Evaluates API design consistency and knowledge of RESTful standards.`,
      type: 'technical' as const,
      difficulty: 'beginner' as const
    },
    {
      question: `Explain how the Event Loop works in JavaScript/Node.js.`,
      suggestedAnswer: `JavaScript is single-threaded. The event loop handles asynchronous operations by offloading I/O to system threads, then scheduling callbacks on the call stack. Microtasks (promises) are executed before macrotasks (setTimeout, setImmediate) inside the loop phase.`,
      recruiterIntent: `Tests fundamental deep understanding of JavaScript runtime behavior and asynchronous execution.`,
      type: 'technical' as const,
      difficulty: 'advanced' as const
    },
    {
      question: `How do you approach unit and integration testing in React components?`,
      suggestedAnswer: `Use Jest as a test runner and React Testing Library to test components from the user's perspective (searching by role/text). Use MSW (Mock Service Worker) to mock API requests, ensuring isolated testing of component state changes.`,
      recruiterIntent: `Checks experience with testing practices, automated verification, and code quality tools.`,
      type: 'technical' as const,
      difficulty: 'beginner' as const
    }
  ];

  const behavioralPool = [
    {
      question: `Tell me about a time you faced a difficult technical challenge and how you resolved it.`,
      suggestedAnswer: `Use the STAR method. Describe the Situation (a bug/performance leak), Task (needed to fix before release), Action (analyzed CPU profiles, traced memory leaks, rewrote sub-optimal database queries), and Result (saved 40% memory, successfully shipped).`,
      recruiterIntent: `Tests problem-solving frameworks, analytical thinking, and transparency under failure.`,
      type: 'behavioral' as const,
      difficulty: 'intermediate' as const
    },
    {
      question: `How do you handle disagreements on technical architecture or code reviews within a team?`,
      suggestedAnswer: `Focus on objective facts, benchmarks, and standard style guidelines. Discuss tradeoffs in a shared channel, seek common ground, compromise when possible, and defer to team consensus or tech lead if needed.`,
      recruiterIntent: `Assesses teamwork, compromise, emotional maturity, and communication during conflict.`,
      type: 'behavioral' as const,
      difficulty: 'intermediate' as const
    },
    {
      question: `Describe a situation where you had to work with tight deadlines. How did you manage?`,
      suggestedAnswer: `Break the task into minimal viable components. Align with product manager on priority features (must-haves vs nice-to-haves), document risks, avoid distractions, and maintain transparent, regular status updates.`,
      recruiterIntent: `Probes time management, prioritization, stakeholder communication, and performance under pressure.`,
      type: 'behavioral' as const,
      difficulty: 'beginner' as const
    },
    {
      question: `How do you stay up-to-date with emerging technologies and industry best practices?`,
      suggestedAnswer: `Follow official blogs, subscribe to newsletters (e.g. TLDR, JavaScript Weekly), build exploratory side projects using new libraries, and participate in local developer meetups or online communities (GitHub, Discord).`,
      recruiterIntent: `Determines self-motivation, passion for engineering, and lifelong learning attitude.`,
      type: 'behavioral' as const,
      difficulty: 'beginner' as const
    },
    {
      question: `Tell me about a time when you made a mistake on a project. What did you learn?`,
      suggestedAnswer: `Take immediate accountability, notify the team to prevent customer impact, trace the root cause, write a post-mortem, and write integration tests/CI checks to ensure the mistake never happens again.`,
      recruiterIntent: `Measures accountability, humbleness, and ability to grow from failures.`,
      type: 'behavioral' as const,
      difficulty: 'intermediate' as const
    },
    {
      question: `What qualities make a successful collaborator in an engineering team?`,
      suggestedAnswer: `Clear and empathetic communication, active listening, thorough documentation of code/assumptions, offering constructive reviews, and showing readiness to pair-program to unblock colleagues.`,
      recruiterIntent: `Evaluates team-fit, soft skills, and cultural alignment.`,
      type: 'behavioral' as const,
      difficulty: 'beginner' as const
    },
    {
      question: `How do you organize your work when you have to balance multiple concurrent projects?`,
      suggestedAnswer: `Create a structured checklist on kanban boards, allocate dedicated deep-focus blocks, set expectations with project managers on delivery timelines, and report progress transparently in daily standups.`,
      recruiterIntent: `Assesses project management skills, autonomy, and organizational efficiency.`,
      type: 'behavioral' as const,
      difficulty: 'intermediate' as const
    }
  ];

  // Adjust difficulty distributions based on level
  let finalQuestions = [...techPool, ...behavioralPool];
  if (level === 'Intern' || yearsOfExperience <= 1) {
    // Beginner & intermediate questions
    finalQuestions = finalQuestions.map(q => {
      if (q.difficulty === 'advanced') {
        return { ...q, difficulty: 'intermediate' as const };
      }
      return q;
    });
  } else if (level === 'Senior' || yearsOfExperience >= 6) {
    // Mix intermediate and advanced questions
    finalQuestions = finalQuestions.map(q => {
      if (q.difficulty === 'beginner') {
        return { ...q, difficulty: 'intermediate' as const };
      }
      return q;
    });
  }

  // Create structured weaknesses based on skills
  const weaknesses: InterviewWeakness[] = [];
  if (!skills.includes('Docker')) {
    weaknesses.push({
      skill: 'Docker',
      reason: 'Containerization is a required skill in modern deployment stacks but is not listed on your profile.',
      recommendation: 'Dockerize a Next.js/Express full-stack project, write a multi-stage Dockerfile, and run it locally with docker-compose.'
    });
  }
  if (!skills.includes('Jest') && !skills.includes('Testing')) {
    weaknesses.push({
      skill: 'Automated Testing',
      reason: 'Quality assurance and testing coverage are critical for collaborative software engineering.',
      recommendation: 'Write unit tests for core utilities and mock tests for route handlers using Jest/Supertest.'
    });
  }
  if (weaknesses.length < 3) {
    weaknesses.push({
      skill: 'System Design',
      reason: 'Scaling and architecture discussions are expected at your career level.',
      recommendation: 'Review horizontal scalability patterns, load balancers, caching layers (Redis), and message brokers (RabbitMQ/Kafka).'
    });
  }

  return {
    questions: finalQuestions.slice(0, 15),
    weaknesses
  };
}

/**
 * Generates a cover letter using Gemini AI, falling back to mock content if client is offline.
 */
export async function generateCoverLetter(
  resumeText: string,
  atsAnalysis: any,
  jobDescription: string,
  companyName: string,
  jobTitle: string,
  tone: 'professional' | 'enthusiastic' | 'concise',
  targetRole?: string
): Promise<string> {
  const client = getAiClient();

  if (!client) {
    console.info('Using Gemini Mock Fallback for Cover Letter Generation.');
    return getMockCoverLetter(companyName, jobTitle, tone, targetRole);
  }

  try {
    const prompt = `
      You are an expert career coach and professional copywriter.
      Write a compelling, customized cover letter for a candidate applying to a job.
      
      Job Title: ${jobTitle}
      Company Name: ${companyName}
      Job Description:
      ${jobDescription}
      
      Candidate Resume Content:
      ${resumeText}
      
      Candidate ATS Analysis / Key Skills:
      ${JSON.stringify(atsAnalysis)}
      
      Tone of the Cover Letter: ${tone}
      - 'professional': formal, authoritative, and standard business correspondence layout.
      - 'enthusiastic': highly energetic, showing strong passion for the role and the company, dynamic and warm.
      - 'concise': short, crisp, highly readable (around 2-3 brief paragraphs, highlighting key value proposition immediately).

      Instructions:
      1. Tailor the cover letter to match the candidate's skills and experience with the requirements of the job.
      2. Keep it structured with a salutation, introductory paragraph, body paragraphs highlighting fit, and a strong closing statement.
      3. Maintain the requested tone (${tone}) throughout the letter.
      4. DO NOT include placeholders like [Your Name], [Your Address], [Phone Number], [Email], or [Date] at the top of the cover letter. Start the letter directly with a professional salutation like "Dear Hiring Manager," or "Dear the [Company Name] Team,".
      5. End the cover letter with a professional sign-off like "Sincerely," or "Best regards,", but do not include name placeholders like [Your Name] at the very end. Just sign off as the candidate.
      6. Return ONLY the final text of the cover letter. Do not include markdown code block wrappers (like \`\`\`) or any introductory/concluding remarks.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response received from Gemini API.');
    }

    return text.replace(/```markdown/g, '').replace(/```/g, '').trim();
  } catch (error) {
    console.error('Gemini API cover letter generation failed, falling back to mock response:', error);
    return getMockCoverLetter(companyName, jobTitle, tone);
  }
}

/**
 * Generates mock cover letter content matching the requested tone.
 */
function getMockCoverLetter(
  companyName: string,
  jobTitle: string,
  tone: 'professional' | 'enthusiastic' | 'concise',
  targetRole?: string
): string {
  const salutation = `Dear Hiring Team at ${companyName},`;
  
  let body = '';
  let signoff = 'Best regards,\n[Your Name]';

  const roleText = targetRole ? ` as a specialized ${targetRole}` : '';

  if (tone === 'professional') {
    body = `I am writing to express my strong interest in the ${jobTitle} position at ${companyName}${roleText}. With a solid foundation in software engineering and a proven track record of designing, building, and maintaining scalable web applications, I am confident in my ability to contribute effectively to your engineering team.

My background includes hands-on experience in full-stack development, modern frameworks, and cloud architectures. Throughout my career, I have prioritized writing clean, maintainable code, optimizing database performances, and collaborating across cross-functional teams to deliver robust solutions on schedule. I am particularly drawn to ${companyName} because of your commitment to technical innovation and developer excellence.

Thank you for your time and consideration. I look forward to the possibility of discussing how my experience and skills align with the needs of your team.`;
    signoff = 'Sincerely,\n\n[Your Name]';
  } else if (tone === 'enthusiastic') {
    body = `I was absolutely thrilled to see the opening for the ${jobTitle} role at ${companyName}${roleText}! I have been following your company's growth and incredible work in the industry, and the opportunity to join your team is exactly the kind of challenge I've been looking for.

I love building products that solve real-world problems and delight users. My experience aligns perfectly with the stack and values at ${companyName}. I am eager to bring my high energy, collaborative spirit, and passion for continuous learning to your projects. I thrive in fast-paced environments and love solving complex technical problems with creative, efficient solutions.

I would jump at the chance to speak with you about how I can bring this enthusiasm and my technical skills to the team at ${companyName}! Thank you so much for your time and consideration.`;
    signoff = 'With excitement and best regards,\n\n[Your Name]';
  } else {
    // concise
    body = `I am writing to apply for the ${jobTitle} position at ${companyName}${roleText}. Having reviewed the requirements, I believe my background in full-stack development and software engineering makes me a strong fit for your team.

I bring hands-on experience building and deploying scalable web services, collaborating in agile environments, and leveraging technologies to solve complex user problems. I admire the work ${companyName} is doing and am eager to contribute directly to your mission.

Thank you for your time. I hope to discuss my qualifications further in an interview.`;
    signoff = 'Best regards,\n\n[Your Name]';
  }

  return `${salutation}\n\n${body}\n\n${signoff}`;
}

/**
 * Improves a single bullet point for impact, technical detail, and action verbs.
 */
export async function improveBulletPoint(
  bulletPoint: string,
  jobTitle?: string,
  targetRole?: string
): Promise<string> {
  const client = getAiClient();
  if (!client) {
    return `Spearheaded execution of technical deliverables, utilizing modern development practices to optimize efficiency, resulting in a 15% increase in team productivity. (AI Mock Optimization)`;
  }

  try {
    const roleStr = targetRole || jobTitle || "Software Engineer";
    const prompt = `
      You are an expert resume writer. Improve the following resume bullet point to make it more professional, impactful, and tailored for a "${roleStr}" role.
      Use the STAR method or focus on strong action verbs, quantifying results/impact if possible.
      Keep it to a single bullet point string. Return ONLY the improved bullet point text.
      
      Original bullet point:
      "${bulletPoint}"
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    return text ? text.trim() : bulletPoint;
  } catch (error) {
    console.error('Failed to improve bullet point using Gemini:', error);
    return `${bulletPoint} (optimized with strong technical metrics)`;
  }
}

/**
 * Rewrites a professional summary based on tone and target role.
 */
export async function rewriteSummary(
  summary: string,
  jobTitle?: string,
  tone?: string,
  targetRole?: string
): Promise<string> {
  const client = getAiClient();
  if (!client) {
    return `Results-driven software professional specializing in modern full-stack methodologies. Proven track record of designing scalable cloud systems, optimizing web application performance, and collaborating in agile squads to deliver exceptional business outcomes. (AI Mock Rewrite)`;
  }

  try {
    const roleStr = targetRole || jobTitle || "Software Engineer";
    const toneStr = tone || "professional";
    const prompt = `
      You are an expert resume writer. Rewrite the following professional resume summary.
      Target Role: "${roleStr}"
      Requested Tone: "${toneStr}" (e.g. professional, enthusiastic, concise)
      
      Keep it under 3-4 sentences. Highlight technical expertise, problem-solving skills, and career focus.
      Return ONLY the rewritten summary text. No introductory text or quotes.
      
      Original summary:
      "${summary}"
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text;
    return text ? text.trim() : summary;
  } catch (error) {
    console.error('Failed to rewrite summary using Gemini:', error);
    return summary;
  }
}

/**
 * Recommends alternative strong action verbs to replace passive or generic verbs.
 */
export async function suggestActionVerbs(bulletPoint: string): Promise<string[]> {
  const client = getAiClient();
  if (!client) {
    return ['Spearheaded', 'Engineered', 'Orchestrated', 'Optimized', 'Automated'];
  }

  try {
    const prompt = `
      Analyze the following resume bullet point and suggest 5 strong, professional alternative action verbs that can replace passive or weak verbs.
      Return ONLY a JSON array of 5 string action verbs. Do not include markdown code block formatting or any text outside of the JSON.
      
      Bullet point:
      "${bulletPoint}"
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) return ['Spearheaded', 'Engineered', 'Orchestrated', 'Optimized', 'Automated'];
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText) as string[];
  } catch (error) {
    console.error('Failed to suggest action verbs:', error);
    return ['Spearheaded', 'Engineered', 'Orchestrated', 'Optimized', 'Automated'];
  }
}

export interface RiskExplanationPayload {
  whatHappened: string;
  whyItMatters: string;
  aiExplanation: string;
  recommendedActions: Array<{
    actionId: string;
    title: string;
    rationale: string;
    urgency: 'immediate' | 'short_term' | 'strategic';
    status: 'pending';
  }>;
}

/**
 * Generates an explainable HR synthesis and recommended actions for a deterministically detected risk.
 * Never decides the score; explains the empirical evidence provided.
 */
export async function generateWorkforceRiskExplanation(
  employee: { name: string; roleTitle: string; department: string; level?: string },
  riskType: string,
  severity: string,
  score: number,
  evidence: Array<{ signalType: string; metric: string; observedValue: string; benchmark: string; significance: string }>
): Promise<RiskExplanationPayload> {
  const client = getAiClient();

  // Helper for deterministic fallback when Gemini is unavailable
  const getFallback = (): RiskExplanationPayload => {
    const formattedRisk = riskType.replace(/_/g, ' ').toUpperCase();
    const metricsList = evidence.map((e) => `${e.metric} (${e.observedValue} vs. benchmark ${e.benchmark})`).join('; ');

    const fallbackActions: RiskExplanationPayload['recommendedActions'] = [];

    if (riskType === 'burnout') {
      fallbackActions.push(
        {
          actionId: 'ACT-BO-01',
          title: 'Immediate On-Call & Overtime Load Rebalancing',
          rationale: 'Reassign secondary on-call responsibilities to bring weekly overtime under department baseline.',
          urgency: 'immediate',
          status: 'pending'
        },
        {
          actionId: 'ACT-BO-02',
          title: 'Mandatory Wellness PTO Scheduling',
          rationale: 'Schedule designated recharge days to prevent acute fatigue and retain critical technical capability.',
          urgency: 'short_term',
          status: 'pending'
        },
        {
          actionId: 'ACT-BO-03',
          title: 'Sprint Capacity & Resource Reallocation',
          rationale: 'Adjust quarterly milestone commitments and assess pairing or contractor support.',
          urgency: 'strategic',
          status: 'pending'
        }
      );
    } else if (riskType === 'attrition') {
      fallbackActions.push(
        {
          actionId: 'ACT-AT-01',
          title: 'Conduct Structured Retention 1-on-1',
          rationale: 'Direct manager and People Ops should discuss recent satisfaction signals, blockers, and aspirations.',
          urgency: 'immediate',
          status: 'pending'
        },
        {
          actionId: 'ACT-AT-02',
          title: 'Out-of-Band Compensation & Level Benchmark Review',
          rationale: 'Review current compensation against market 75th percentile and verify level progression eligibility.',
          urgency: 'short_term',
          status: 'pending'
        },
        {
          actionId: 'ACT-AT-03',
          title: 'High-Impact Project Ownership Realignment',
          rationale: 'Assign key ownership on upcoming strategic initiatives to reinforce long-term organizational commitment.',
          urgency: 'strategic',
          status: 'pending'
        }
      );
    } else if (riskType === 'skill_stagnation') {
      fallbackActions.push(
        {
          actionId: 'ACT-SK-01',
          title: 'Skill Gap Diagnostic & Career Mapping',
          rationale: 'Identify target competencies needed for next level and agree on specific growth objectives.',
          urgency: 'immediate',
          status: 'pending'
        },
        {
          actionId: 'ACT-SK-02',
          title: 'Learning Stipend & Training Plan Allocation',
          rationale: 'Sponsor structured certifications or specialized workshops in missing core domains.',
          urgency: 'short_term',
          status: 'pending'
        },
        {
          actionId: 'ACT-SK-03',
          title: 'Cross-Department Mentorship Pairing',
          rationale: 'Pair with senior technical lead for weekly architecture shadowing.',
          urgency: 'strategic',
          status: 'pending'
        }
      );
    } else {
      // Disengagement fallback
      fallbackActions.push(
        {
          actionId: 'ACT-DE-01',
          title: 'Pulse Feedback Discovery Session',
          rationale: 'Hold an informal check-in to uncover root causes of recent engagement drops.',
          urgency: 'immediate',
          status: 'pending'
        },
        {
          actionId: 'ACT-DE-02',
          title: 'Meeting Cadence & Collaboration Audit',
          rationale: 'Audit weekly schedule to remove redundant meetings and restore focus time.',
          urgency: 'short_term',
          status: 'pending'
        },
        {
          actionId: 'ACT-DE-03',
          title: 'Quarterly OKR Realignment',
          rationale: 'Re-anchor personal quarterly goals to high-visibility product milestones.',
          urgency: 'strategic',
          status: 'pending'
        }
      );
    }

    return {
      whatHappened: `${severity.toUpperCase()} ${formattedRisk} detected for ${employee.name} (${employee.roleTitle}, ${employee.department}).`,
      whyItMatters: `Observed telemetry indicates severe deviation from departmental norms that poses immediate risk to team delivery and retention.`,
      aiExplanation: `Multi-signal analysis detected significant anomalies across: ${metricsList}. With a deterministic risk index of ${score}/100, prompt managerial intervention is recommended.`,
      recommendedActions: fallbackActions
    };
  };

  if (!client) {
    return getFallback();
  }

  try {
    const evidenceSummary = evidence.map((e) => `- ${e.signalType.toUpperCase()} | ${e.metric}: ${e.observedValue} (Benchmark: ${e.benchmark}, Significance: ${e.significance})`).join('\n');

    const prompt = `
      You are an expert HR Intelligence & Workforce Analytics Specialist.
      Analyze the following DETERMINISTICALLY DETECTED workforce risk and its concrete empirical evidence.

      Employee: ${employee.name}
      Role: ${employee.roleTitle} (Department: ${employee.department}, Level: ${employee.level})
      Risk Category: ${riskType}
      Calculated Severity: ${severity} (Score: ${score}/100)

      Empirical Evidence:
      ${evidenceSummary}

      Produce a professional, human-readable diagnosis conforming strictly to this JSON structure:
      {
        "whatHappened": "1-2 sentences summarizing what was observed in the data",
        "whyItMatters": "1-2 sentences explaining organizational, team, or retention impact",
        "aiExplanation": "A cohesive 2-3 sentence diagnostic synthesis connecting the evidence to operational risk",
        "recommendedActions": [
          {
            "actionId": "unique string like ACT-01",
            "title": "Clear action title",
            "rationale": "Why this specific action helps",
            "urgency": "immediate" or "short_term" or "strategic",
            "status": "pending"
          }
        ]
      }

      Provide 2 to 3 actionable, pragmatic recommendations.
      Do not invent numbers or metrics outside of the provided empirical evidence.
      Return ONLY raw JSON, with no markdown code blocks.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) return getFallback();

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as RiskExplanationPayload;

    if (!result.whatHappened || !result.whyItMatters || !Array.isArray(result.recommendedActions)) {
      return getFallback();
    }

    return result;
  } catch (error) {
    console.error('Failed to generate Gemini risk explanation, using deterministic fallback:', error);
    return getFallback();
  }
}

// ============================================================================
// POLICY-GROUNDED REASONING & COMPLIANCE QA
// ============================================================================

export interface PolicySourceItem {
  policyCode: string;
  title: string;
  section: string;
  supportingText: string;
}

export interface PolicyAnswerPayload {
  answer: string;
  interpretation: string;
  confidence: 'high' | 'medium' | 'low';
  grounded: boolean;
  sources: PolicySourceItem[];
  recommendedNextSteps: string[];
}

/**
 * Generates an authoritative, policy-grounded QA answer strictly from retrieved PolicyDocument sources.
 * Never invents policies. Falls back to deterministic extraction when Gemini is unavailable.
 */
export async function generatePolicyAnswer(
  userQuestion: string,
  retrievedSources: Array<{
    policyCode: string;
    title: string;
    relevantSection: string;
    sectionId: string;
    sourceText: string;
    relevanceScore: number;
    matchReasons?: string[];
  }>
): Promise<PolicyAnswerPayload> {
  const client = getAiClient();

  // Helper for deterministic fallback when Gemini is unavailable or fails
  const getFallback = (): PolicyAnswerPayload => {
    if (!retrievedSources || retrievedSources.length === 0) {
      return {
        answer: 'Policy coverage not found. The currently active company policies do not contain rules, limits, or guidelines addressing this specific inquiry.',
        interpretation: 'No authoritative corporate policy document was identified matching this topic in the policy library.',
        confidence: 'low',
        grounded: false,
        sources: [],
        recommendedNextSteps: [
          'Consult with People Operations (HR) directly for clarification on this matter.',
          'Submit an inquiry to the People & Culture Committee for policy documentation.'
        ]
      };
    }

    const topSource = retrievedSources[0];
    const sourcesList: PolicySourceItem[] = retrievedSources.slice(0, 3).map((s) => ({
      policyCode: s.policyCode,
      title: s.title,
      section: s.relevantSection,
      supportingText: s.sourceText
    }));

    let directAnswer = '';
    if (retrievedSources.length === 1) {
      directAnswer = `According to ${topSource.title} (${topSource.policyCode}), Section ${topSource.relevantSection}: "${topSource.sourceText}"`;
    } else {
      const summarySnippets = retrievedSources.slice(0, 2).map((s) => `Under ${s.policyCode} (${s.relevantSection}): "${s.sourceText}"`).join(' Furthermore, ');
      directAnswer = `According to official company guidelines: ${summarySnippets}`;
    }

    const interpretation = `This policy applies organization-wide across declared regional home timezones and departments. Relevant provisions are governed under ${retrievedSources.map((s) => s.policyCode).join(' and ')}.`;

    const nextSteps: string[] = [
      `Review full document details for ${topSource.policyCode} in the HR Policy Library.`,
      'Confirm any individual eligibility or pre-approval requirements with your People Ops business partner.'
    ];

    if (topSource.policyCode === 'POL-REM-2026') {
      nextSteps.unshift('Submit relevant reimbursement receipts or cross-border travel requests via the HR operations portal.');
    } else if (topSource.policyCode === 'POL-PTO-2026') {
      nextSteps.unshift('Log planned leave in the HRIS time-off calendar at least two weeks prior to requested dates.');
    } else if (topSource.policyCode === 'POL-PRO-2026') {
      nextSteps.unshift('Discuss career track milestones with your engineering manager during the upcoming review cycle.');
    }

    return {
      answer: directAnswer,
      interpretation,
      confidence: 'high',
      grounded: true,
      sources: sourcesList,
      recommendedNextSteps: nextSteps
    };
  };

  if (!client) {
    return getFallback();
  }

  // If no sources were retrieved, return ungrounded without calling Gemini
  if (!retrievedSources || retrievedSources.length === 0) {
    return getFallback();
  }

  try {
    const sourcesSummary = retrievedSources.map((s, idx) => `[Source ${idx + 1}]
Policy: ${s.title} (${s.policyCode})
Section: ${s.relevantSection}
Official Text: "${s.sourceText}"`).join('\n\n');

    const prompt = `
      You are an authoritative HR Compliance & Policy Intelligence Specialist.
      Answer the user's question STRICTLY and ONLY using the provided authoritative company policy documents.

      User Question: "${userQuestion}"

      Authoritative Policy Sources:
      ${sourcesSummary}

      CRITICAL GROUNDING RULES:
      1. Answer ONLY from supplied policy sources.
      2. NEVER invent company policy, numbers, rules, stipends, limits, or dates.
      3. If the sources do not directly answer the question, you MUST set "grounded": false, "confidence": "low", and state clearly in "answer": "Policy coverage not found. The currently active company policies do not contain rules addressing this inquiry."
      4. Clearly distinguish explicit policy language ("The policy explicitly states...") from interpretation ("This implies...").
      5. Cite the exact policy source(s) used in the "sources" array.
      6. Do NOT fabricate policy codes, section IDs, or dates.
      7. If multiple policies apply, explain how they interact.
      8. If there is ambiguity, explicitly identify it in "interpretation".

      Return a JSON object conforming STRICTLY to this JSON structure:
      {
        "answer": "What the policy explicitly states regarding the question",
        "interpretation": "Why this applies, operational context, and any nuances",
        "confidence": "high" or "medium" or "low",
        "grounded": true or false,
        "sources": [
          {
            "policyCode": "exact policyCode from source",
            "title": "exact title from source",
            "section": "exact relevantSection from source",
            "supportingText": "exact text from source"
          }
        ],
        "recommendedNextSteps": [
          "Practical step 1",
          "Practical step 2"
        ]
      }

      Return ONLY raw JSON without markdown code blocks.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) return getFallback();

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as PolicyAnswerPayload;

    if (!result.answer || typeof result.grounded !== 'boolean' || !Array.isArray(result.sources)) {
      return getFallback();
    }

    return result;
  } catch (error) {
    console.error('Failed to generate Gemini policy answer, using deterministic fallback:', error);
    return getFallback();
  }
}




