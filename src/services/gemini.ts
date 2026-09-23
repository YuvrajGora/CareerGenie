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

// ============================================================================
// ADAPTIVE ONBOARDING ORCHESTRATOR
// ============================================================================

export interface AdaptivePlanMilestoneSuggestion {
  milestoneId: string;
  title: string;
  description: string;
  category: 'compliance' | 'technical_setup' | 'team_integration' | 'role_training';
  dueDay: number;
  resourceLink?: string;
}

export interface AdaptivePlanPayload {
  roleTitle: string;
  department: string;
  level: string;
  aiGuidanceNotes: string;
  targetCompletionDays: number;
  milestones: AdaptivePlanMilestoneSuggestion[];
}

export interface AdaptiveDiagnosisPayload {
  diagnosis: string;
  whyItMatters: string;
  suggestedAdjustments: Array<{
    title: string;
    rationale: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Generates an individualized adaptive onboarding plan synthesizing employee attributes,
 * verified competencies, and relevant corporate policies.
 * Falls back to deterministic templates if Gemini is unavailable or fails.
 */
export async function generateAdaptiveOnboardingPlan(
  employee: {
    name: string;
    roleTitle: string;
    department: string;
    level: string;
    skills?: Array<{ name: string; proficiency?: string; verified?: boolean }>;
    managerName?: string;
    location?: string;
  },
  policies: Array<{ policyCode: string; title: string; category: string }>,
  deterministicFallbackMilestones: AdaptivePlanMilestoneSuggestion[]
): Promise<AdaptivePlanPayload> {
  const getFallback = (): AdaptivePlanPayload => ({
    roleTitle: employee.roleTitle,
    department: employee.department,
    level: employee.level,
    aiGuidanceNotes: `Standard deterministic onboarding curriculum for ${employee.department} (${employee.level} level). Focus on team alignment, core tooling, and departmental milestone velocity.`,
    targetCompletionDays: 90,
    milestones: deterministicFallbackMilestones
  });

  const client = getAiClient();
  if (!client) {
    return getFallback();
  }

  try {
    const verifiedSkillsStr = employee.skills && employee.skills.length > 0
      ? employee.skills.map((s) => `${s.name} (${s.proficiency || 'intermediate'})`).join(', ')
      : 'None recorded';

    const policySummary = policies.length > 0
      ? policies.map((p) => `- ${p.policyCode}: ${p.title} (${p.category})`).join('\n')
      : 'Standard company policies';

    const prompt = `
      You are an expert HR Talent Onboarding & People Operations Architect.
      Create an individualized, high-impact 30-60-90 day Adaptive Onboarding Roadmap for a new hire.

      EMPLOYEE PROFILE:
      - Name: ${employee.name}
      - Role Title: ${employee.roleTitle}
      - Department: ${employee.department}
      - Level: ${employee.level}
      - Verified Skills: ${verifiedSkillsStr}
      - Location: ${employee.location || 'Remote'}
      - Direct Manager: ${employee.managerName || 'Department Lead'}

      RELEVANT COMPANY POLICIES:
      ${policySummary}

      MANDATORY RULES:
      1. Ground your roadmap STRICTLY in the employee's role, department, seniority level, and existing skills.
      2. If the employee already has verified skills, do not prescribe beginner training for those exact skills; instead, design milestones that apply them to company architecture or advance to higher tier topics.
      3. Categorize every milestone into exactly one of: 'compliance', 'technical_setup', 'team_integration', 'role_training'.
      4. Due days must be realistic integers:
         - compliance: day 1 to 3
         - technical_setup: day 1 to 7
         - team_integration: day 7 to 30
         - role_training: day 14 to 90
      5. Include between 5 and 8 cohesive, sequential milestones covering Days 1 through 90.
      6. Do NOT hallucinate external compensation, unverified personal facts, or non-existent company systems.
      7. Return ONLY a raw JSON object conforming strictly to this format:
      {
        "roleTitle": "${employee.roleTitle}",
        "department": "${employee.department}",
        "level": "${employee.level}",
        "aiGuidanceNotes": "2-3 sentences of strategic onboarding guidance summarizing ramp focus, expected first milestone, and key stakeholder checkpoints.",
        "targetCompletionDays": 90,
        "milestones": [
          {
            "milestoneId": "M-01",
            "title": "Clear concise title",
            "description": "Concrete action description and success criteria",
            "category": "compliance" | "technical_setup" | "team_integration" | "role_training",
            "dueDay": 1,
            "resourceLink": "optional reference code like POL-REM-2026 or doc name"
          }
        ]
      }
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
    const result = JSON.parse(cleanedText) as AdaptivePlanPayload;

    if (!Array.isArray(result.milestones) || result.milestones.length === 0 || !result.aiGuidanceNotes) {
      return getFallback();
    }

    const validCategories = new Set(['compliance', 'technical_setup', 'team_integration', 'role_training']);
    const sanitizedMilestones = result.milestones.map((m, idx) => ({
      milestoneId: m.milestoneId || `M-0${idx + 1}`,
      title: m.title || `Milestone ${idx + 1}`,
      description: m.description || 'Complete assigned departmental onboarding task.',
      category: validCategories.has(m.category) ? (m.category as any) : 'role_training',
      dueDay: typeof m.dueDay === 'number' && m.dueDay > 0 ? m.dueDay : (idx + 1) * 10,
      resourceLink: m.resourceLink || undefined
    }));

    return {
      roleTitle: result.roleTitle || employee.roleTitle,
      department: result.department || employee.department,
      level: result.level || employee.level,
      aiGuidanceNotes: result.aiGuidanceNotes,
      targetCompletionDays: result.targetCompletionDays || 90,
      milestones: sanitizedMilestones
    };
  } catch (error) {
    console.error('Failed to generate Gemini adaptive onboarding plan, using fallback:', error);
    return getFallback();
  }
}

/**
 * Analyzes current onboarding velocity, overdue milestones, and pace anomalies.
 * Generates an explainable diagnosis and tailored adjustments.
 * Falls back to deterministic diagnosis if Gemini is unavailable or fails.
 */
export async function analyzeOnboardingVelocityAndAdapt(
  employee: {
    name: string;
    roleTitle: string;
    department: string;
    level: string;
  },
  currentPlan: {
    overallProgress: number;
    velocityScore: number;
    status: string;
    daysSinceStart: number;
    overdueMilestones: Array<{
      milestoneId: string;
      title: string;
      category: string;
      dueDay: number;
      daysOverdue: number;
      notes?: string;
    }>;
    completedMilestonesCount: number;
    totalMilestonesCount: number;
  },
  deterministicFallback: AdaptiveDiagnosisPayload
): Promise<AdaptiveDiagnosisPayload> {
  const client = getAiClient();
  if (!client) {
    return deterministicFallback;
  }

  try {
    const overdueSummary = currentPlan.overdueMilestones.length > 0
      ? currentPlan.overdueMilestones.map((m) => `- [${m.milestoneId}] "${m.title}" (${m.category}) - ${m.daysOverdue} days overdue. Notes: ${m.notes || 'None'}`).join('\n')
      : 'None. All milestones due to date are completed.';

    const prompt = `
      You are an expert HR Onboarding Intervention & Ramp Specialist.
      Analyze the empirical onboarding progress and velocity for this employee, and recommend targeted operational adaptations.

      EMPLOYEE:
      - Name: ${employee.name}
      - Role: ${employee.roleTitle} (${employee.department}, ${employee.level})

      CURRENT ONBOARDING TELEMETRY:
      - Days Since Start Date: ${currentPlan.daysSinceStart}
      - Overall Completion: ${currentPlan.overallProgress}% (${currentPlan.completedMilestonesCount}/${currentPlan.totalMilestonesCount} milestones completed)
      - Deterministic Velocity Index: ${currentPlan.velocityScore}/100
      - Current Status: ${currentPlan.status.toUpperCase()}
      
      OVERDUE / DELAYED MILESTONES:
      ${overdueSummary}

      INSTRUCTIONS:
      1. Synthesize an objective, professional diagnosis explaining why the employee is on-track or delayed.
      2. Explain why this matters for early retention, team velocity, and 90-day ramp.
      3. Recommend 2 to 3 pragmatic, actionable adjustments (e.g. mentor pairing, scope adjustment, unblocking IT access, schedule re-alignment).
      4. Do NOT hallucinate negative performance reviews or invent unstated blockers.
      5. Return ONLY a raw JSON object conforming strictly to this format:
      {
        "diagnosis": "2-3 sentences explaining the observed progress, velocity score, and specific delay causes if any.",
        "whyItMatters": "1-2 sentences on operational and retention impact.",
        "suggestedAdjustments": [
          {
            "title": "Clear action title",
            "rationale": "Why this specific intervention resolves the delay or reinforces velocity",
            "priority": "low" | "medium" | "high"
          }
        ]
      }
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) return deterministicFallback;

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as AdaptiveDiagnosisPayload;

    if (!result.diagnosis || !result.whyItMatters || !Array.isArray(result.suggestedAdjustments)) {
      return deterministicFallback;
    }

    return result;
  } catch (error) {
    console.error('Failed to generate Gemini velocity diagnosis, using deterministic fallback:', error);
    return deterministicFallback;
  }
}

// ============================================================================
// PHASE 2.5: INTELLIGENT INTERVIEW AGENT GEMINI EXTENSIONS
// ============================================================================

export interface InterviewQuestionItem {
  question: string;
  competency: string;
  lookFors: string[];
  redFlags: string[];
}

export interface InterviewQuestionRubricResult {
  questions: InterviewQuestionItem[];
}

export interface InterviewQuestionContext {
  jobTitle: string;
  jobDescription: string;
  requiredSkills: string[];
  candidateName: string;
  candidateSkills: string[];
  careerLevel?: string;
  yearsOfExperience?: number;
  interviewStage: 'screen' | 'technical' | 'system_design' | 'culture_fit' | 'final';
  matchBreakdown?: {
    matchScore?: number;
    skillsMatch?: number;
    experienceMatch?: number;
    educationMatch?: number;
  };
}

export interface InterviewSynthesisContext {
  candidateName: string;
  roleTitle: string;
  jobTitle: string;
  interviewStage: string;
  overallScore: number;
  recommendation: 'strong_hire' | 'hire' | 'borderline' | 'do_not_hire';
  competencies: Array<{
    competency: string;
    score: number;
    weight: number;
    feedback: string;
    keySignals: string[];
  }>;
  rawInterviewNotes?: string;
}

export interface InterviewSynthesisResult {
  summary: string;
  strengths: string[];
  concerns: string[];
  evidence: string[];
  recommendationRationale: string;
}

/**
 * Deterministic fallback question generator for interview stages.
 * Zero-hallucination, strictly tailored to the verified skills, stage, and role.
 */
function getDeterministicInterviewQuestions(context: InterviewQuestionContext): InterviewQuestionRubricResult {
  const { jobTitle, requiredSkills, candidateSkills, interviewStage } = context;
  const primarySkill = requiredSkills[0] || candidateSkills[0] || 'software engineering';
  const secondarySkill = requiredSkills[1] || candidateSkills[1] || 'system architecture';

  switch (interviewStage) {
    case 'screen':
      return {
        questions: [
          {
            question: `Can you walk me through your recent hands-on experience utilizing ${primarySkill}, and describe how you contributed to production-grade deliverables?`,
            competency: 'Core Technical Competence',
            lookFors: [
              'Concrete architectural or operational examples from recent projects',
              'Familiarity with modern tooling, idioms, and industry standards',
              'Clear articulation of individual contribution versus team output'
            ],
            redFlags: [
              'Vague or purely theoretical explanations without implementation details',
              'Inability to explain foundational concepts of claimed skills',
              'Significant discrepancy between stated resume skills and live explanation'
            ]
          },
          {
            question: `Tell me about a challenging project requirement or technical obstacle you encountered recently. How did you decompose the problem and deliver a stable solution?`,
            competency: 'Problem Solving & Execution',
            lookFors: [
              'Structured decomposition of complex or ambiguous requirements',
              'Proactive cross-functional communication and risk mitigation',
              'Clear focus on end-user impact and business reliability'
            ],
            redFlags: [
              'Blaming teammates, tools, or dependencies without constructive accountability',
              'Giving up or waiting for explicit instructions when blocked',
              'Lack of a repeatable problem-solving framework'
            ]
          },
          {
            question: `What specific aspects of the ${jobTitle} role and our engineering domain motivated your application, and how does this align with your career trajectory?`,
            competency: 'Role Alignment & Motivation',
            lookFors: [
              'Demonstrated research into the role domain and operational challenges',
              'Realistic expectations of day-to-day responsibilities and ramp-up pace',
              'Clear alignment with long-term professional development goals'
            ],
            redFlags: [
              'Zero familiarity with the role requirements or company domain',
              'Purely transactional motivations without role engagement',
              'Misaligned expectations regarding work scope or collaboration model'
            ]
          }
        ]
      };

    case 'technical':
      return {
        questions: [
          {
            question: `How would you architect and implement a high-throughput, low-latency service utilizing ${primarySkill} and ${secondarySkill} while ensuring resilient error recovery and data integrity?`,
            competency: 'Domain & Framework Expertise',
            lookFors: [
              'Deep understanding of language idioms, memory/concurrency models, and runtime performance',
              'Robust error propagation, circuit-breaking, and boundary validation',
              'Thoughtful data structure selection and algorithmic complexity awareness'
            ],
            redFlags: [
              'Neglecting concurrency hazards, memory leaks, or unhandled exceptions',
              'Over-engineering trivial flows while ignoring core scaling bottlenecks',
              'Inability to write clean, idiomatic, testable code under standard constraints'
            ]
          },
          {
            question: `Walk me through your methodology for automated testing across unit, integration, and end-to-end boundaries. How do you maintain high test confidence without fragile test suites?`,
            competency: 'Code Quality & Testing',
            lookFors: [
              'Clear testing pyramid philosophy separating unit speed from integration confidence',
              'Rigorous boundary, error-path, and edge-case verification',
              'Experience with deterministic test data generation and CI/CD test gates'
            ],
            redFlags: [
              'Treating automated testing as an afterthought or optional practice',
              'Testing only the happy path with zero regression guards',
              'Heavy reliance on manual QA testing for basic regression detection'
            ]
          },
          {
            question: `Describe a severe production incident or subtle performance degradation you diagnosed. How did you isolate the root cause, mitigate immediate impact, and prevent recurrence?`,
            competency: 'Debugging & Performance Tuning',
            lookFors: [
              'Hypothesis-driven debugging utilizing distributed traces, logs, and metrics',
              'Decisive triage balancing immediate customer mitigation against deep diagnosis',
              'Formal blameless post-mortem actions and automated regression tests'
            ],
            redFlags: [
              'Guess-and-check modification without telemetry or scientific isolation',
              'Fixing symptoms without understanding underlying root causes',
              'Dismissing production incidents as one-off anomalies without remediation'
            ]
          }
        ]
      };

    case 'system_design':
      return {
        questions: [
          {
            question: `How would you design a distributed, multi-region backend system for ${jobTitle} that handles bursty write traffic while maintaining predictable p99 read latency?`,
            competency: 'Scalable Architecture & Trade-offs',
            lookFors: [
              'Clear functional decomposition and API boundary definitions',
              'Principled database selection based on consistency, partition tolerance, and query patterns',
              'Tiered caching strategies with explicit invalidation and cache-stampede mitigation'
            ],
            redFlags: [
              'Monolithic assumptions with single points of catastrophic failure',
              'Blindly claiming 100% ACID consistency across multi-region asynchronous topologies',
              'Ignoring backpressure, queue buildup, and network latency constraints'
            ]
          },
          {
            question: `When designing inter-service communication between synchronous protocols (REST/gRPC) and asynchronous messaging (Kafka/RabbitMQ), what factors guide your architectural selection?`,
            competency: 'Data Flow & Integration Patterns',
            lookFors: [
              'Nuanced evaluation of coupling, latency budgets, and consumer scaling characteristics',
              'Idempotent message consumption, dead-letter queuing, and outbox patterns',
              'Schema evolution, contract versioning, and backward compatibility management'
            ],
            redFlags: [
              'Rigid dogmatism favoring one communication pattern regardless of workload context',
              'Ignoring distributed transaction failures and eventual consistency implications',
              'Lacking idempotency handling for distributed message redelivery'
            ]
          },
          {
            question: `How do you incorporate zero-trust security, distributed tracing, and actionable SLI/SLO monitoring into a critical microservice lifecycle from day zero?`,
            competency: 'Reliability & Observability',
            lookFors: [
              'Structured observability with contextual baggage propagation (OpenTelemetry)',
              'Actionable, burn-rate based alerting aligned with user-facing SLOs rather than noisy thresholds',
              'Graceful degradation, rate-limiting, and bulkhead isolation during downstream degradation'
            ],
            redFlags: [
              'Treating security and observability as deferred post-launch items',
              'Relying on unstructured console logging for mission-critical audit trails',
              'Lack of rate-limiting, timeouts, or connection pool bounds'
            ]
          }
        ]
      };

    case 'culture_fit':
      return {
        questions: [
          {
            question: `Describe a situation where you had a fundamental technical disagreement with a peer or senior engineer on design direction. How did you navigate the debate and reach an effective outcome?`,
            competency: 'Constructive Collaboration & Communication',
            lookFors: [
              'Objective, data-driven framing of trade-offs rather than subjective debate',
              'Active listening, genuine curiosity toward counter-proposals, and psychological safety',
              'Full commitment to the final team consensus once decided ("disagree and commit")'
            ],
            redFlags: [
              'Passive-aggressive communication, undermining decisions, or personal antagonism',
              'Rigid stubbornness refusing to compromise despite countervailing evidence',
              'Escalating interpersonal tension rather than clarifying technical trade-offs'
            ]
          },
          {
            question: `Tell me about a time when you received critical feedback on code quality, project scoping, or interpersonal communication. What was your immediate response and subsequent follow-through?`,
            competency: 'Growth Mindset & Receptivity',
            lookFors: [
              'Intellectual humility and mature self-awareness regarding blind spots',
              'Specific behavioral or technical adjustments enacted following the critique',
              'Proactive follow-up to verify whether the improvement met expectations'
            ],
            redFlags: [
              'Defensiveness, making excuses, or shifting blame onto colleagues',
              'Dismissing the legitimacy of constructive input from peers or managers',
              'Zero observable behavioral evolution following explicit feedback'
            ]
          },
          {
            question: `How do you handle ambiguous requirements and shifting sprint priorities when customer demands or deadlines change rapidly?`,
            competency: 'Ownership & Prioritization',
            lookFors: [
              'Proactive stakeholder engagement to clarify core acceptance criteria and trade-offs',
              'Ruthless prioritization based on business value and critical path delivery',
              'Transparent status communication with team leads before deadlines are breached'
            ],
            redFlags: [
              'Paralysis when encountering incomplete specifications',
              'Making unilateral architectural assumptions without stakeholder alignment',
              'Silently dropping critical commitments when under delivery pressure'
            ]
          }
        ]
      };

    case 'final':
    default:
      return {
        questions: [
          {
            question: `Given the technical challenges of the ${jobTitle} position, what strategic initiatives or engineering improvements would you champion during your first 90 to 180 days?`,
            competency: 'Strategic Vision & Technical Leadership',
            lookFors: [
              'Pragmatic balancing of rapid onboarding wins with long-term foundational health',
              'Deep appreciation for organizational context before proposing major changes',
              'Clear alignment with customer-centric business value and platform scalability'
            ],
            redFlags: [
              'Dogmatic desire to rewrite functioning systems without business justification',
              'Dismissiveness toward existing team achievements or historical trade-offs',
              'Lack of awareness regarding cross-functional and organizational dependencies'
            ]
          },
          {
            question: `How do you invest in elevating the capabilities of peers, conducting high-signal code reviews, and fostering an inclusive engineering environment?`,
            competency: 'Mentorship & Culture Multiplier',
            lookFors: [
              'Empathetic, educational code review style emphasizing principles over personal taste',
              'Demonstrated history of mentoring junior/mid-level team members into higher autonomy',
              'Active contribution to internal documentation, tech talks, and engineering standards'
            ],
            redFlags: [
              'Treating mentorship or team documentation as uncompensated distractions',
              'Gatekeeping domain knowledge or critical system access',
              'Authoritarian or hyper-critical code review interactions'
            ]
          },
          {
            question: `How do you determine when it is appropriate to take on technical debt to capture a market opportunity versus when technical debt must be proactively resolved?`,
            competency: 'Engineering Pragmatism & Business Acumen',
            lookFors: [
              'Treating tech debt as a deliberate financial instrument with real interest costs',
              'Collaborative partnership with product management to budget ongoing tech-debt payoff',
              'Principled definition of non-negotiable boundaries (security, data integrity, auditability)'
            ],
            redFlags: [
              'Perfectionism that blocks viable product releases for theoretical elegance',
              'Careless accumulation of debt with zero intention or plan for remediation',
              'Inability to translate technical risks into business-relevant terminology'
            ]
          }
        ]
      };
  }
}

/**
 * Generates targeted, evidence-grounded interview questions with competency look-fors and red flags.
 * Uses Gemini AI if available with verified database facts only, falling back deterministically.
 */
export async function generateInterviewQuestionRubric(
  context: InterviewQuestionContext
): Promise<InterviewQuestionRubricResult> {
  const deterministicFallback = getDeterministicInterviewQuestions(context);
  const client = getAiClient();

  if (!client) {
    return deterministicFallback;
  }

  try {
    const prompt = `
      You are CareerGenie's Intelligent Interview Agent.
      Generate targeted, evidence-grounded interview questions and competency assessment rubrics tailored specifically to the candidate and role.

      CRITICAL CONSTRAINTS:
      1. You receive ONLY verified database facts below. Do NOT hallucinate candidate experience, skills, employers, or credentials not listed.
      2. Tailor questions to the requested interview stage: "${context.interviewStage}".
      3. For each question, provide:
         - The question text
         - The specific competency being evaluated
         - A list of 3 concrete "lookFors" (positive signals of competency)
         - A list of 3 concrete "redFlags" (warning signals or poor answers)
      4. Ground all questions in the verified job requirements and candidate profile.

      VERIFIED CONTEXT:
      - Job Title: ${context.jobTitle}
      - Job Description: ${context.jobDescription}
      - Required Skills: ${context.requiredSkills.join(', ')}
      - Candidate Name: ${context.candidateName}
      - Verified Candidate Skills: ${context.candidateSkills.join(', ')}
      - Candidate Career Level: ${context.careerLevel || 'Not specified'}
      - Years of Experience: ${context.yearsOfExperience ?? 'Not specified'}
      - Interview Stage: ${context.interviewStage}
      ${context.matchBreakdown ? `- Job Match Breakdown: Score ${context.matchBreakdown.matchScore}%, Skills ${context.matchBreakdown.skillsMatch}%, Experience ${context.matchBreakdown.experienceMatch}%` : ''}

      OUTPUT FORMAT:
      Return ONLY a raw JSON object with NO markdown formatting:
      {
        "questions": [
          {
            "question": "string",
            "competency": "string",
            "lookFors": ["signal 1", "signal 2", "signal 3"],
            "redFlags": ["flag 1", "flag 2", "flag 3"]
          }
        ]
      }
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return deterministicFallback;

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as InterviewQuestionRubricResult;

    if (!Array.isArray(result.questions) || result.questions.length === 0) {
      return deterministicFallback;
    }

    // Validate that each question has necessary fields
    const validQuestions = result.questions.filter(
      (q) => q.question && q.competency && Array.isArray(q.lookFors) && Array.isArray(q.redFlags)
    );

    if (validQuestions.length === 0) {
      return deterministicFallback;
    }

    return { questions: validQuestions };
  } catch (error) {
    console.error('Failed to generate interview questions via Gemini, using deterministic fallback:', error);
    return deterministicFallback;
  }
}

/**
 * Deterministic fallback synthesis generator for completed interview evaluations.
 * Grounds summary strictly on the recruiter's scored competencies, weights, and raw notes.
 */
function getDeterministicInterviewSynthesis(context: InterviewSynthesisContext): InterviewSynthesisResult {
  const {
    candidateName,
    roleTitle,
    interviewStage,
    overallScore,
    recommendation,
    competencies,
    rawInterviewNotes
  } = context;

  const highScores = competencies.filter((c) => c.score >= 4);
  const lowScores = competencies.filter((c) => c.score <= 2);
  const midScores = competencies.filter((c) => c.score === 3);

  const strengths: string[] = highScores.length > 0
    ? highScores.map((c) => `${c.competency} (Score: ${c.score}/5): ${c.feedback || 'Exceeded target expectations.'}`)
    : ['Demonstrated consistent foundational competency across evaluated dimensions.'];

  const concerns: string[] = lowScores.length > 0
    ? lowScores.map((c) => `${c.competency} (Score: ${c.score}/5): ${c.feedback || 'Below threshold for target level.'}`)
    : (midScores.length > 0
        ? [`Developing proficiency in ${midScores.map((c) => c.competency).join(', ')}.`]
        : ['No critical competency deficiencies observed during this session.']);

  const evidence: string[] = [
    ...competencies.flatMap((c) =>
      c.keySignals && c.keySignals.length > 0
        ? c.keySignals.map((signal) => `Demonstrated signal in ${c.competency}: "${signal}"`)
        : [`Evaluated ${c.competency} with score ${c.score}/5 (weight: ${Math.round(c.weight * 100)}%)`]
    )
  ];

  if (rawInterviewNotes && rawInterviewNotes.trim().length > 0) {
    evidence.push(`Interviewer Field Notes: "${rawInterviewNotes.trim().slice(0, 200)}${rawInterviewNotes.length > 200 ? '...' : ''}"`);
  }

  const recFormatted = recommendation.replace(/_/g, ' ').toUpperCase();
  const summary = `Candidate ${candidateName} completed the ${interviewStage} interview stage for the ${roleTitle} position with a deterministic weighted score of ${overallScore}/100, resulting in a ${recFormatted} recommendation across ${competencies.length} evaluated competency dimensions.`;

  let recommendationRationale = '';
  switch (recommendation) {
    case 'strong_hire':
      recommendationRationale = `Candidate achieved a top-tier score of ${overallScore}/100, meeting or exceeding high-performance benchmarks across all primary weighted competencies. Recommended for rapid progression in the hiring pipeline.`;
      break;
    case 'hire':
      recommendationRationale = `Candidate demonstrated solid core competency with an overall score of ${overallScore}/100. Meets established role requirements with manageable development areas.`;
      break;
    case 'borderline':
      recommendationRationale = `Candidate achieved an overall score of ${overallScore}/100, indicating mixed signals. Strengths in specific competencies are offset by noticeable development gaps that warrant committee deliberation or targeted follow-up.`;
      break;
    case 'do_not_hire':
    default:
      recommendationRationale = `Candidate achieved an overall score of ${overallScore}/100, falling below minimum competency thresholds for the ${roleTitle} role. Deficiencies in core weighted dimensions preclude recommendation.`;
      break;
  }

  return {
    summary,
    strengths,
    concerns,
    evidence,
    recommendationRationale
  };
}

/**
 * Synthesizes an evidence-grounded interview evaluation using Gemini AI, with deterministic fallback.
 * Strictly grounds synthesis in the recruiter's scored competencies, notes, and deterministic score.
 * NEVER allows Gemini to calculate or override the numeric overallScore or recommendation.
 */
export async function synthesizeInterviewEvaluation(
  context: InterviewSynthesisContext
): Promise<InterviewSynthesisResult> {
  const deterministicFallback = getDeterministicInterviewSynthesis(context);
  const client = getAiClient();

  if (!client) {
    return deterministicFallback;
  }

  try {
    const prompt = `
      You are CareerGenie's Intelligent Interview Agent Synthesis Engine.
      Synthesize an objective, evidence-grounded interview evaluation summary based strictly on the recruiter's observed competency evaluations, deterministic score, and notes.

      CRITICAL CONSTRAINTS:
      1. You receive ONLY verified evidence below. Do NOT invent candidate achievements, employers, qualifications, or unstated interview responses.
      2. The deterministic overall score is ${context.overallScore}/100 and the recommendation is "${context.recommendation}". DO NOT recalculate or modify these deterministic outputs.
      3. Your task is purely to synthesize the recruiter's qualitative notes, competency scores, and key signals into an executive evaluation report.
      4. Ground every strength, concern, and evidence item in the recruiter's explicit competency scores and notes.

      VERIFIED EVALUATION EVIDENCE:
      - Candidate Name: ${context.candidateName}
      - Target Role: ${context.roleTitle}
      - Interview Stage: ${context.interviewStage}
      - Deterministic Overall Score: ${context.overallScore}/100
      - Deterministic Recommendation: ${context.recommendation}
      - Evaluated Competencies:
      ${context.competencies.map((c) => `  * ${c.competency}: Score ${c.score}/5 (Weight: ${c.weight}) - Feedback: "${c.feedback}" - Key Signals: [${c.keySignals.join(', ')}]`).join('\n')}
      - Raw Interview Notes: ${context.rawInterviewNotes ? `"${context.rawInterviewNotes}"` : 'None recorded'}

      OUTPUT FORMAT:
      Return ONLY a raw JSON object with NO markdown formatting:
      {
        "summary": "2-3 sentences synthesizing the candidate's performance across competencies for this stage.",
        "strengths": ["Evidence-grounded strength 1", "Evidence-grounded strength 2"],
        "concerns": ["Evidence-grounded concern 1", "Evidence-grounded concern 2"],
        "evidence": ["Specific observed signal or note 1", "Specific observed signal or note 2"],
        "recommendationRationale": "Clear rationale explaining why the deterministic score and competency outcomes warrant the ${context.recommendation} outcome."
      }
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return deterministicFallback;

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as InterviewSynthesisResult;

    if (
      !result.summary ||
      !Array.isArray(result.strengths) ||
      !Array.isArray(result.concerns) ||
      !Array.isArray(result.evidence) ||
      !result.recommendationRationale
    ) {
      return deterministicFallback;
    }

    return result;
  } catch (error) {
    console.error('Failed to synthesize interview evaluation via Gemini, using deterministic fallback:', error);
    return deterministicFallback;
  }
}

export interface RecruitmentMatchExplanationResult {
  verdict: 'strong_match' | 'qualified_match' | 'borderline' | 'not_recommended';
  executiveSummary: string;
  keyStrengths: string[];
  identifiedGaps: string[];
  experienceAssessment: string;
  recommendedInterviewFocus: string[];
}

/**
 * Explains a candidate's deterministic match score against a job using Google Gemini.
 * CRITICAL AI SAFETY:
 * - Gemini must NOT calculate or alter match scores; the deterministic scores provided are authoritative.
 * - Explains strictly based on supplied evidence (resume excerpt, verified skills, and requirements).
 * - Falls back deterministically if Gemini is offline, unconfigured, or errors.
 */
export async function generateRecruitmentMatchExplanation(
  jobData: {
    title: string;
    company: string;
    description: string;
    requiredSkills: string[];
    experience: number;
    location?: string;
  },
  candidateData: {
    name: string;
    careerLevel: string;
    yearsOfExperience: number;
    education: string;
    skills: string[];
    resumeText?: string;
  },
  matchScores: {
    matchScore: number;
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
  }
): Promise<RecruitmentMatchExplanationResult> {
  const candSkills = candidateData.skills || [];
  const reqSkills = jobData.requiredSkills || [];

  const matchedSkills = reqSkills.filter(req =>
    candSkills.some(cs => cs.toLowerCase().trim() === req.toLowerCase().trim())
  );
  const missingSkills = reqSkills.filter(req =>
    !candSkills.some(cs => cs.toLowerCase().trim() === req.toLowerCase().trim())
  );

  // Deterministic verdict mapping based on authoritative mathematical score
  let fallbackVerdict: 'strong_match' | 'qualified_match' | 'borderline' | 'not_recommended' = 'borderline';
  if (matchScores.matchScore >= 85) {
    fallbackVerdict = 'strong_match';
  } else if (matchScores.matchScore >= 70) {
    fallbackVerdict = 'qualified_match';
  } else if (matchScores.matchScore >= 55) {
    fallbackVerdict = 'borderline';
  } else {
    fallbackVerdict = 'not_recommended';
  }

  // Deterministic strengths
  const fallbackStrengths: string[] = [];
  if (matchedSkills.length > 0) {
    fallbackStrengths.push(`Matches ${matchedSkills.length} of ${reqSkills.length} required skills: ${matchedSkills.join(', ')}.`);
  }
  if (candidateData.yearsOfExperience >= jobData.experience) {
    fallbackStrengths.push(
      `Exceeds minimum experience threshold (${candidateData.yearsOfExperience} years vs ${jobData.experience} required).`
    );
  } else if (candidateData.yearsOfExperience > 0) {
    fallbackStrengths.push(`Has ${candidateData.yearsOfExperience} years of applicable professional experience.`);
  }
  if (candidateData.education) {
    fallbackStrengths.push(`Relevant academic background: ${candidateData.education}.`);
  }
  if (fallbackStrengths.length === 0) {
    fallbackStrengths.push('Candidate demonstrates foundational technical proficiency.');
  }

  // Deterministic gaps
  const fallbackGaps: string[] = [];
  if (missingSkills.length > 0) {
    fallbackGaps.push(`Missing core job requirements: ${missingSkills.join(', ')}.`);
  }
  if (candidateData.yearsOfExperience < jobData.experience) {
    const diff = jobData.experience - candidateData.yearsOfExperience;
    fallbackGaps.push(
      `Experience shortfall of ${diff} year${diff > 1 ? 's' : ''} compared to the role specification (${candidateData.yearsOfExperience} yrs vs ${jobData.experience} yrs required).`
    );
  }
  if (fallbackGaps.length === 0) {
    fallbackGaps.push('No critical technical gaps identified relative to baseline requirements.');
  }

  // Deterministic experience assessment
  const fallbackExpAssessment = candidateData.yearsOfExperience >= jobData.experience
    ? `The candidate possesses ${candidateData.yearsOfExperience} years of experience at the ${candidateData.careerLevel} tier, comfortably meeting the ${jobData.experience}-year requirement for ${jobData.title}.`
    : `The candidate possesses ${candidateData.yearsOfExperience} years of experience, which is below the target ${jobData.experience} years specified for this ${jobData.title} opening.`;

  // Deterministic interview focus
  const fallbackInterviewFocus: string[] = [];
  if (missingSkills.length > 0) {
    fallbackInterviewFocus.push(`Evaluate familiarity and adjacent capability in ${missingSkills.slice(0, 2).join(' and ')}.`);
  }
  if (matchedSkills.length > 0) {
    fallbackInterviewFocus.push(`Deep-dive technical assessment into real-world production projects using ${matchedSkills.slice(0, 2).join(' and ')}.`);
  }
  fallbackInterviewFocus.push(`Assess problem-solving methodology and technical communication for ${jobData.title} responsibilities.`);

  const deterministicFallback: RecruitmentMatchExplanationResult = {
    verdict: fallbackVerdict,
    executiveSummary: `${candidateData.name} achieved a deterministic match score of ${matchScores.matchScore}% for "${jobData.title}" at ${jobData.company}. Skills match is ${matchScores.skillsMatch}% (${matchedSkills.length}/${reqSkills.length} core competencies), experience match is ${matchScores.experienceMatch}%, and education match is ${matchScores.educationMatch}%.`,
    keyStrengths: fallbackStrengths,
    identifiedGaps: fallbackGaps,
    experienceAssessment: fallbackExpAssessment,
    recommendedInterviewFocus: fallbackInterviewFocus
  };

  const client = getAiClient();
  if (!client) {
    return deterministicFallback;
  }

  try {
    const prompt = `
You are a senior recruitment intelligence analyst for CareerGenie.
Your task is to explain and substantiate the deterministic match score calculated for a candidate against a job specification.

CRITICAL INSTRUCTIONS:
1. DO NOT CALCULATE OR MODIFY THE MATCH SCORES. The scores provided below are mathematically authoritative and final.
2. DO NOT invent skills, certifications, work history, achievements, or requirements not present in the provided candidate or job data.
3. Your role is strictly to explain the evidence connecting the candidate's profile to the job requirements.
4. Output MUST strictly adhere to the requested JSON format.

JOB SPECIFICATION:
- Title: ${jobData.title}
- Company: ${jobData.company}
- Location: ${jobData.location || 'Remote'}
- Required Experience: ${jobData.experience} years
- Required Skills: ${reqSkills.join(', ')}
- Description: ${jobData.description}

CANDIDATE PROFILE:
- Name: ${candidateData.name}
- Career Level: ${candidateData.careerLevel}
- Experience: ${candidateData.yearsOfExperience} years
- Education: ${candidateData.education}
- Verified Skills: ${candSkills.join(', ')}
- Resume Excerpt: "${(candidateData.resumeText || '').slice(0, 1000)}"

DETERMINISTIC AUTHORITATIVE SCORES (DO NOT CHANGE):
- Overall Match Score: ${matchScores.matchScore}%
- Skills Match: ${matchScores.skillsMatch}% (Matched: ${matchedSkills.join(', ') || 'None'} | Missing: ${missingSkills.join(', ') || 'None'})
- Experience Match: ${matchScores.experienceMatch}% (${candidateData.yearsOfExperience} yrs vs ${jobData.experience} yrs required)
- Education Match: ${matchScores.educationMatch}%

Respond ONLY with a valid JSON object matching this schema:
{
  "verdict": "strong_match" | "qualified_match" | "borderline" | "not_recommended",
  "executiveSummary": "Concise 2-3 sentence overview explaining how well the candidate aligns with the role based strictly on the factual scores and skills.",
  "keyStrengths": ["List of 2-4 verified candidate strengths relative to the job requirements"],
  "identifiedGaps": ["List of 1-3 factual gaps or missing requirements"],
  "experienceAssessment": "1-2 sentences evaluating candidate experience depth relative to job needs.",
  "recommendedInterviewFocus": ["2-3 specific technical areas or competency probes to evaluate in the interview"]
}

Guidelines for verdict:
- overallScore >= 85: "strong_match"
- overallScore >= 70: "qualified_match"
- overallScore >= 55: "borderline"
- overallScore < 55: "not_recommended"
`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return deterministicFallback;

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as RecruitmentMatchExplanationResult;

    if (
      !result.verdict ||
      !result.executiveSummary ||
      !Array.isArray(result.keyStrengths) ||
      !Array.isArray(result.identifiedGaps) ||
      !result.experienceAssessment ||
      !Array.isArray(result.recommendedInterviewFocus)
    ) {
      return deterministicFallback;
    }

    return result;
  } catch (error) {
    console.error('Failed to generate recruitment match explanation via Gemini, using deterministic fallback:', error);
    return deterministicFallback;
  }
}

export interface SkillGapExplanationResult {
  executiveSummary: string;
  summary?: string;
  businessImpact: string;
  whyItMatters?: string;
  coverageAnalysis?: string;
  recommendedStrategy: 'internal_upskill' | 'external_hire' | 'hybrid' | 'risk_mitigation';
  upskillingPlan: string[];
  upskillingPaths?: string[];
  recruitmentAction: string;
  recruitmentOptions?: string[];
  riskMitigationNotes?: string;
  riskContext?: string;
  recommendations?: string[];
  groundedMetrics?: {
    targetHeadcount: number;
    verifiedHeadcount: number;
    severity: string;
  };
}

/**
 * Generates an evidence-grounded strategic explanation for a documented workforce skill gap.
 * CRITICAL AI SAFETY:
 * - Gemini must NOT calculate authoritative gap scores, invent skills, or alter employee records.
 * - The authoritative metrics (coverage, gap count, severity, compound risk) are supplied and final.
 * - Falls back deterministically if Gemini is offline, unconfigured, or errors.
 */
export async function generateSkillGapExplanation(context: {
  skillName?: string;
  skill?: string;
  department?: string;
  gapMetrics?: {
    targetCoverage: number;
    verifiedCount: number;
    availableCount: number;
    severity: 'critical' | 'moderate' | 'healthy';
    criticality: 'critical' | 'high' | 'medium';
    hasCompoundRisk: boolean;
  };
  coveredEmployees?: Array<{
    name: string;
    roleTitle: string;
    proficiency: string;
    verified: boolean;
    hasActiveRisk?: boolean;
    riskType?: string;
  }>;
  employeesCovering?: any[];
  verifiedEmployees?: any[];
  upskillingCandidates?: Array<{
    name: string;
    roleTitle: string;
    adjacentSkills: string[];
    readinessScore: number;
  }>;
  recruitmentOpportunity?: {
    jobTitle?: string;
    title?: string;
    candidateCount?: number;
    matchingCandidatesCount?: number;
    topCandidates?: Array<{ name: string; matchScore: number }>;
  };
  recruitmentOpportunities?: any[];
  [key: string]: any;
}): Promise<SkillGapExplanationResult> {
  const skillName = context.skillName || context.skill || 'Specified Skill';
  const department = context.department || 'Organization';
  const gapMetrics = context.gapMetrics || {
    targetCoverage: context.targetCoverage || context.targetHeadcount || 1,
    verifiedCount: context.verifiedCount || context.verifiedHeadcount || 0,
    availableCount: context.availableCount || context.availableHeadcount || 0,
    severity: context.severity || 'moderate',
    criticality: context.criticality || 'high',
    hasCompoundRisk: Boolean(context.hasCompoundRisk)
  };
  const coveredEmployees = context.coveredEmployees || context.employeesCovering || context.verifiedEmployees || [];
  const upskillingCandidates = context.upskillingCandidates || [];
  const recOpp = context.recruitmentOpportunity ||
    (context.recruitmentOpportunities && context.recruitmentOpportunities[0]) ||
    undefined;

  const recruitmentOpportunity = recOpp
    ? {
        jobTitle: recOpp.jobTitle || recOpp.title || 'Requisition',
        candidateCount: recOpp.candidateCount ?? recOpp.matchingCandidatesCount ?? (recOpp.topCandidates ? recOpp.topCandidates.length : 0),
        topCandidates: recOpp.topCandidates || []
      }
    : undefined;

  // Determine strategic posture deterministically
  let recommendedStrategy: 'internal_upskill' | 'external_hire' | 'hybrid' | 'risk_mitigation' = 'internal_upskill';
  if (gapMetrics.hasCompoundRisk) {
    recommendedStrategy = 'risk_mitigation';
  } else if (gapMetrics.severity === 'critical' && recruitmentOpportunity && recruitmentOpportunity.candidateCount > 0) {
    recommendedStrategy = upskillingCandidates.length > 0 ? 'hybrid' : 'external_hire';
  } else if (gapMetrics.severity === 'critical') {
    recommendedStrategy = 'external_hire';
  } else if (upskillingCandidates.length > 0) {
    recommendedStrategy = 'internal_upskill';
  } else {
    recommendedStrategy = 'hybrid';
  }

  // Deterministic upskilling action plan
  const deterministicUpskillingPlan: string[] = [];
  if (upskillingCandidates.length > 0) {
    upskillingCandidates.slice(0, 3).forEach((cand: any) => {
      deterministicUpskillingPlan.push(
        `Enroll ${cand.name} (${cand.roleTitle}) in ${skillName} enablement, bridging from verified adjacent skills: ${(cand.adjacentSkills || []).join(', ')} (Readiness: ${cand.readinessScore}%).`
      );
    });
  } else {
    deterministicUpskillingPlan.push(
      `No internal employees with adjacent prerequisite skills identified in ${department}. External acquisition or fundamental foundational training required.`
    );
  }

  // Deterministic recruitment action
  let deterministicRecruitmentAction = 'No active recruitment pipeline required; internal coverage is manageable.';
  if (recruitmentOpportunity && recruitmentOpportunity.candidateCount > 0) {
    const topNames = (recruitmentOpportunity.topCandidates || []).map((c: any) => `${c.name} (${c.matchScore}%)`).join(', ');
    deterministicRecruitmentAction = `Leverage active job posting "${recruitmentOpportunity.jobTitle}": ${recruitmentOpportunity.candidateCount} candidates matched in pipeline, top candidate${(recruitmentOpportunity.topCandidates || []).length > 1 ? 's' : ''}: ${topNames}.`;
  } else if (gapMetrics.severity === 'critical') {
    deterministicRecruitmentAction = `Open a new requisition for a Senior ${skillName} practitioner to eliminate the single-point-of-failure in ${department}.`;
  }

  // Deterministic risk notes
  const riskNotes = gapMetrics.hasCompoundRisk
    ? `CRITICAL RISK WARNING: One or more key employees currently holding verified ${skillName} capability are flagged with high/critical burnout or flight risk. Loss of this personnel would immediately collapse verified coverage to zero.`
    : undefined;

  const deterministicFallback: SkillGapExplanationResult = {
    executiveSummary: `Workforce intelligence analysis for ${department} reveals a ${gapMetrics.severity.toUpperCase()} skill gap in ${skillName}. Current verified coverage is ${gapMetrics.verifiedCount} of target ${gapMetrics.targetCoverage} (${Math.round((gapMetrics.verifiedCount / Math.max(1, gapMetrics.targetCoverage)) * 100)}%).`,
    summary: `Workforce intelligence analysis for ${department} reveals a ${gapMetrics.severity.toUpperCase()} skill gap in ${skillName}. Current verified coverage is ${gapMetrics.verifiedCount} of target ${gapMetrics.targetCoverage} (${Math.round((gapMetrics.verifiedCount / Math.max(1, gapMetrics.targetCoverage)) * 100)}%).`,
    businessImpact: `${skillName} is a ${gapMetrics.criticality.toUpperCase()}-criticality competency for ${department}. Insufficient coverage increases operational bottleneck risk, delays roadmap commitments, and restricts deployment velocity.`,
    whyItMatters: `${skillName} is a ${gapMetrics.criticality.toUpperCase()}-criticality competency for ${department}. Insufficient coverage increases operational bottleneck risk, delays roadmap commitments, and restricts deployment velocity.`,
    coverageAnalysis: `Current verified coverage is ${Math.round((gapMetrics.verifiedCount / Math.max(1, gapMetrics.targetCoverage)) * 100)}% (${gapMetrics.verifiedCount}/${gapMetrics.targetCoverage}). There are ${gapMetrics.availableCount - gapMetrics.verifiedCount} unverified self-reported employees.`,
    recommendedStrategy,
    upskillingPlan: deterministicUpskillingPlan,
    upskillingPaths: deterministicUpskillingPlan,
    recruitmentAction: deterministicRecruitmentAction,
    recruitmentOptions: [deterministicRecruitmentAction],
    riskMitigationNotes: riskNotes,
    riskContext: riskNotes,
    recommendations: [
      riskNotes ? 'Address flight/burnout risks for key verified staff immediately.' : 'Maintain quarterly skills verification rubric.',
      recommendedStrategy === 'external_hire' ? 'Expedite candidate interview rounds for active pipeline.' : 'Initiate sprint-paired upskilling for adjacent talent.',
      'Calibrate technical assessment standards with engineering leads.'
    ],
    groundedMetrics: {
      targetHeadcount: gapMetrics.targetCoverage,
      verifiedHeadcount: gapMetrics.verifiedCount,
      severity: gapMetrics.severity
    }
  };

  const client = getAiClient();
  if (!client) {
    return deterministicFallback;
  }

  try {
    const prompt = `
You are a senior workforce intelligence and talent strategy consultant for CareerGenie.
Explain the strategic implications and recommended action plan for a documented workforce skill gap.

CRITICAL INSTRUCTIONS:
1. DO NOT CALCULATE OR MODIFY THE GAP NUMBERS. The coverage metrics and severity below are mathematically authoritative.
2. DO NOT invent employee qualifications, skills, or job postings not supplied in the input.
3. Treat adjacent skills strictly as potential upskilling opportunities, NOT verified competencies.
4. Output MUST strictly adhere to the requested JSON format.

GAP DATA:
- Department: ${department}
- Skill: ${skillName}
- Criticality: ${gapMetrics.criticality}
- Severity: ${gapMetrics.severity}
- Target Coverage: ${gapMetrics.targetCoverage} verified employees
- Current Verified Coverage: ${gapMetrics.verifiedCount} employees
- Available Unverified/Partial: ${gapMetrics.availableCount} employees
- Compound Risk Flag: ${gapMetrics.hasCompoundRisk ? 'YES (Key verified employee is at critical burnout/flight risk)' : 'NO'}

COVERED EMPLOYEES:
${coveredEmployees.length === 0 ? '- None' : coveredEmployees.map((e: any) => `- ${e.name} (${e.roleTitle}, ${e.proficiency} proficiency, verified: ${e.verified}${e.hasActiveRisk ? `, ACTIVE RISK: ${e.riskType}` : ''})`).join('\n')}

ADJACENT UPSKILLING TALENT (Do NOT say they know ${skillName}; they know adjacent skills):
${upskillingCandidates.length === 0 ? '- None' : upskillingCandidates.map((u: any) => `- ${u.name} (${u.roleTitle}, possesses adjacent: ${(u.adjacentSkills || []).join(', ')}, readiness: ${u.readinessScore}%)`).join('\n')}

RECRUITMENT PIPELINE:
${recruitmentOpportunity ? `- Active Job: "${recruitmentOpportunity.jobTitle}", ${recruitmentOpportunity.candidateCount} matched candidates in pipeline (Top: ${(recruitmentOpportunity.topCandidates || []).map((c: any) => `${c.name} - ${c.matchScore}%`).join(', ')})` : '- No active recruitment pipeline linked'}

Respond ONLY with a valid JSON object matching this schema:
{
  "executiveSummary": "2-3 concise sentences summarizing the current coverage vs target and severity.",
  "businessImpact": "1-2 sentences on how this gap affects ${department} execution and SLA reliability.",
  "recommendedStrategy": "internal_upskill" | "external_hire" | "hybrid" | "risk_mitigation",
  "upskillingPlan": ["2-3 specific action steps for upskilling the named adjacent talent"],
  "recruitmentAction": "Specific recruitment action leveraging existing pipeline or opening new roles",
  "riskMitigationNotes": "Optional 1-2 sentences on single-point-of-failure or burnout retention risks if compound risk exists"
}
`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return deterministicFallback;

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText) as SkillGapExplanationResult;

    if (
      !result.executiveSummary ||
      !result.businessImpact ||
      !result.recommendedStrategy ||
      !Array.isArray(result.upskillingPlan) ||
      !result.recruitmentAction
    ) {
      return deterministicFallback;
    }

    return result;
  } catch (error) {
    console.error('Failed to generate skill gap explanation via Gemini, using deterministic fallback:', error);
    return deterministicFallback;
  }
}



