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
}

export interface JobRecommendationResult {
  jobId: string;
  matchScore: number;
  reasoning: string;
}

/**
 * Parses and analyzes resume text using Google Gemini AI, with a fallback mock mechanism.
 */
export async function analyzeResume(resumeText: string): Promise<ResumeAnalysisResult> {
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error('Resume text content is empty.');
  }

  const client = getAiClient();

  // Fallback check
  if (!client) {
    console.info('Using Gemini Mock Fallback for Resume Analysis.');
    return getMockAnalysis(resumeText);
  }

  try {
    const prompt = `
      You are an expert AI Resume Analyzer and ATS Optimization specialist. 
      Analyze the following extracted text from a candidate's resume and generate a detailed report.
      
      You must respond with a JSON object ONLY, conforming strictly to this TypeScript interface:
      {
        overallScore: number; // 0 to 100, candidate's overall readiness
        atsScore: number; // 0 to 100, ATS scan friendliness score
        strengths: string[]; // List of 3-5 key professional strengths
        weaknesses: string[]; // List of 3-5 areas of improvement or gaps
        missingSkills: string[]; // List of skills/technologies commonly expected for the candidate's profile but missing
        suggestions: string[]; // List of 3-5 actionable suggestions to improve the resume
        extractedSkills: string[]; // Flat list of all technical and soft skills identified in the text
      }

      Do not include any markdown format blocks (like \`\`\`json) or text before/after the JSON. Just return the raw JSON content.

      Resume Text:
      "${resumeText.replace(/"/g, '\\"')}"
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
    const result = JSON.parse(cleanedText) as ResumeAnalysisResult;

    // Validate structure and ranges
    if (typeof result.overallScore !== 'number' || typeof result.atsScore !== 'number') {
      throw new Error('Invalid score types returned from AI response.');
    }

    return {
      overallScore: Math.min(100, Math.max(0, result.overallScore)),
      atsScore: Math.min(100, Math.max(0, result.atsScore)),
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      missingSkills: Array.isArray(result.missingSkills) ? result.missingSkills : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      extractedSkills: Array.isArray(result.extractedSkills) ? result.extractedSkills : [],
    };
  } catch (error: any) {
    console.error('Gemini API resume analysis failed, falling back to mock response:', error);
    return getMockAnalysis(resumeText);
  }
}

/**
 * Generates mock resume analysis data based on the resume text content.
 */
function getMockAnalysis(resumeText: string): ResumeAnalysisResult {
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

  return {
    overallScore: 78,
    atsScore: 82,
    strengths: [
      'Strong technical foundational knowledge matching industry standards',
      'Good formatting and structure with clear section dividers',
      'Relevant project accomplishments listed in detail'
    ],
    weaknesses: [
      'Lack of clear cloud deployment infrastructure mentions (AWS/GCP/Azure)',
      'Minimal evidence of unit testing or integration testing strategies',
      'Soft skills section is underspecified'
    ],
    missingSkills: [
      'Docker',
      'CI/CD Pipelines (GitHub Actions/Jenkins)',
      'Redis Caching',
      'Kubernetes'
    ],
    suggestions: [
      'Quantify achievements (e.g., "Improved load time by 30%" instead of "Worked on website performance").',
      'Add a dedicated "Technical Skills" keyword section for better ATS compliance.',
      'Add certificates or links to public GitHub projects to showcase active contributions.'
    ],
    extractedSkills: baseSkills
  };
}
