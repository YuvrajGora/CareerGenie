/**
 * Calculates a candidate's job match score based on the 60-20-10-10 formula:
 * Match Score = (Skills * 0.6) + (Experience * 0.2) + (Education * 0.1) + (Keywords * 0.1)
 */
export function calculateMatchScore(
  candidateSkills: string[],
  candidateExperience: number, // in years
  candidateEducation: string,
  candidateResumeText: string,
  jobRequiredSkills: string[],
  jobRequiredExperience: number, // in years
  jobDescription: string
): number {
  // 1. Skills Match (60%)
  let skillsScore = 100;
  if (jobRequiredSkills.length > 0) {
    const matched = jobRequiredSkills.filter(skill => 
      candidateSkills.some(candSkill => candSkill.toLowerCase().trim() === skill.toLowerCase().trim())
    );
    skillsScore = (matched.length / jobRequiredSkills.length) * 100;
  }
  const skillsContribution = skillsScore * 0.6;

  // 2. Experience Match (20%)
  let experienceScore = 100;
  if (jobRequiredExperience > 0) {
    experienceScore = (candidateExperience / jobRequiredExperience) * 100;
    if (experienceScore > 100) experienceScore = 100; // capped at 100
  }
  const experienceContribution = experienceScore * 0.2;

  // 3. Education Match (10%)
  // Heuristic degree matching
  let educationScore = 80; // Default baseline
  const lowerCandEdu = candidateEducation.toLowerCase();
  const lowerJobDesc = jobDescription.toLowerCase();

  const degrees = [
    { key: 'phd', rank: 4 },
    { key: 'doctorate', rank: 4 },
    { key: 'master', rank: 3 },
    { key: 'm.tech', rank: 3 },
    { key: 'mba', rank: 3 },
    { key: 'ms', rank: 3 },
    { key: 'bachelor', rank: 2 },
    { key: 'b.tech', rank: 2 },
    { key: 'bs', rank: 2 },
    { key: 'diploma', rank: 1 }
  ];

  let candidateMaxRank = 1;
  let jobRequiredRank = 0;

  for (const degree of degrees) {
    if (lowerCandEdu.includes(degree.key)) {
      candidateMaxRank = Math.max(candidateMaxRank, degree.rank);
    }
    // Search for required educational keywords in job requirements
    if (lowerJobDesc.includes(degree.key) && (lowerJobDesc.includes('require') || lowerJobDesc.includes('prefer') || lowerJobDesc.includes('degree'))) {
      jobRequiredRank = Math.max(jobRequiredRank, degree.rank);
    }
  }

  if (jobRequiredRank === 0 || candidateMaxRank >= jobRequiredRank) {
    educationScore = 100;
  } else {
    educationScore = (candidateMaxRank / jobRequiredRank) * 100;
  }
  const educationContribution = educationScore * 0.1;

  // 4. Keyword Match (10%)
  // Compare industry keyword overlap
  let keywordScore = 100;
  const industryKeywords = [
    'agile', 'scrum', 'ci/cd', 'docker', 'kubernetes', 'aws', 'gcp', 'azure',
    'rest', 'graphql', 'database', 'sql', 'nosql', 'git', 'testing', 'security',
    'design', 'architecture', 'microservices', 'serverless', 'devops', 'analytics'
  ];

  const candidateText = `${candidateResumeText} ${candidateSkills.join(' ')}`.toLowerCase();
  const jobText = `${jobDescription} ${jobRequiredSkills.join(' ')}`.toLowerCase();

  const jobKeywords = industryKeywords.filter(kw => jobText.includes(kw));
  if (jobKeywords.length > 0) {
    const matchedKeywords = jobKeywords.filter(kw => candidateText.includes(kw));
    keywordScore = (matchedKeywords.length / jobKeywords.length) * 100;
  }
  const keywordContribution = keywordScore * 0.1;

  // Final match score calculation
  const totalScore = skillsContribution + experienceContribution + educationContribution + keywordContribution;
  return Math.min(100, Math.max(0, Math.round(totalScore)));
}
