import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';
import EmployeeSignal from '@/models/EmployeeSignal';
import PolicyDocument from '@/models/PolicyDocument';
import OnboardingPlan from '@/models/OnboardingPlan';
import InterviewEvaluation from '@/models/InterviewEvaluation';
import User from '@/models/User';
import Job from '@/models/Job';
import Application from '@/models/Application';
import JobMatch from '@/models/JobMatch';
import Resume from '@/models/Resume';
import ResumeAnalysis from '@/models/ResumeAnalysis';
import DepartmentSkillRequirement from '@/models/DepartmentSkillRequirement';
import { calculateDetailedMatchScore } from '@/services/matching';
import { BASELINE_DEPARTMENT_REQUIREMENTS } from '@/services/workforceSkillIntelligenceService';

export interface SeedResult {
  employeesCount: number;
  signalsCount: number;
  policiesCount: number;
  onboardingPlansCount: number;
  jobsCount: number;
  candidatesCount: number;
  applicationsCount: number;
  interviewEvaluationsCount: number;
  skillRequirementsCount?: number;
}

export async function seedHrData(): Promise<SeedResult> {
  await dbConnect();

  // =========================================================================
  // 1. SEED RECRUITER & ADMIN ACCOUNTS (Prerequisites for Jobs)
  // =========================================================================
  const recruiter = await User.findOneAndUpdate(
    { email: 'recruiter.talent@careergenie.internal' },
    {
      name: 'Victoria Stone',
      email: 'recruiter.talent@careergenie.internal',
      password: 'RecruiterPassword123!',
      role: 'recruiter',
      skills: ['Talent Acquisition', 'Executive Sourcing', 'Competency Interviewing'],
      careerLevel: 'Senior',
      yearsOfExperience: 8,
      education: "Master's in Human Resource Management"
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await User.findOneAndUpdate(
    { email: 'admin.workforce@careergenie.internal' },
    {
      name: 'Alexander Cross',
      email: 'admin.workforce@careergenie.internal',
      password: 'AdminPassword123!',
      role: 'admin',
      skills: ['Workforce Analytics', 'HR Strategy', 'Organizational Governance'],
      careerLevel: 'Lead',
      yearsOfExperience: 12,
      education: 'MBA in Organizational Strategy'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // =========================================================================
  // 2. SEED 26 EMPLOYEES ACROSS 3 DEPARTMENTS
  // =========================================================================
  const employeeDataRaw = [
    // --- Department: Engineering (14) ---
    {
      employeeCode: 'EMP-1001',
      name: 'Alex Chen',
      email: 'alex.chen@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Staff Infrastructure Engineer',
      level: 'Staff',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2023-03-15'),
      salary: 195000,
      status: 'active',
      performanceRating: 3.4,
      flightRiskLevel: 'critical',
      skills: [
        { name: 'Distributed Systems', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Golang', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Kubernetes', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Kafka', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1002',
      name: 'Sarah Lin',
      email: 'sarah.lin@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Mid-Level Frontend Engineer',
      level: 'Mid-Level',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2024-09-01'),
      salary: 135000,
      status: 'active',
      performanceRating: 4.9,
      flightRiskLevel: 'low',
      skills: [
        { name: 'React', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'TypeScript', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Next.js', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Tailwind CSS', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1003',
      name: 'David Kumar',
      email: 'david.kumar@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Senior Backend Engineer',
      level: 'Senior',
      location: 'New York, NY',
      employmentType: 'full_time',
      joiningDate: new Date('2024-05-10'),
      salary: 165000,
      status: 'active',
      performanceRating: 4.2,
      flightRiskLevel: 'medium',
      skills: [
        { name: 'Python', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Django', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'PostgreSQL', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Redis', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1004',
      name: 'Priya Patel',
      email: 'priya.patel@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Lead DevOps Engineer',
      level: 'Lead',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2022-08-01'),
      salary: 185000,
      status: 'active',
      performanceRating: 4.6,
      flightRiskLevel: 'low',
      skills: [
        { name: 'AWS', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Terraform', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'CI/CD Pipelines', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Docker', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1005',
      name: 'James Wilson',
      email: 'james.wilson@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Senior Full-Stack Engineer',
      level: 'Senior',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2023-11-12'),
      salary: 160000,
      status: 'active',
      performanceRating: 4.1,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Node.js', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'React', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'TypeScript', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1006',
      name: 'Mei Zhang',
      email: 'mei.zhang@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Mid-Level Backend Engineer',
      level: 'Mid-Level',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2025-02-15'),
      salary: 130000,
      status: 'active',
      performanceRating: 3.9,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Go', proficiency: 'intermediate', category: 'technical', verified: true },
        { name: 'REST APIs', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1007',
      name: 'Carlos Rodriguez',
      email: 'carlos.rodriguez@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Junior Frontend Engineer',
      level: 'Junior',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2025-06-20'),
      salary: 95000,
      status: 'active',
      performanceRating: 3.8,
      flightRiskLevel: 'low',
      skills: [
        { name: 'JavaScript', proficiency: 'intermediate', category: 'technical', verified: true },
        { name: 'React', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1008',
      name: 'Aisha Al-Mansoor',
      email: 'aisha.almansoor@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Senior Security Engineer',
      level: 'Senior',
      location: 'New York, NY',
      employmentType: 'full_time',
      joiningDate: new Date('2023-07-01'),
      salary: 175000,
      status: 'active',
      performanceRating: 4.7,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Application Security', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'SOC2 & Compliance', proficiency: 'expert', category: 'domain', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1009',
      name: "Liam O'Connor",
      email: 'liam.oconnor@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Junior Backend Engineer',
      level: 'Junior',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2025-08-15'),
      salary: 92000,
      status: 'active',
      performanceRating: 3.5,
      flightRiskLevel: 'medium',
      skills: [
        { name: 'Python', proficiency: 'intermediate', category: 'technical', verified: true },
        { name: 'SQL', proficiency: 'intermediate', category: 'technical', verified: true },
        { name: 'Kubernetes', proficiency: 'beginner', category: 'technical', verified: false }
      ]
    },
    {
      employeeCode: 'EMP-1010',
      name: 'Ananya Sharma',
      email: 'ananya.sharma@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Mid-Level QA Automation Engineer',
      level: 'Mid-Level',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2024-10-01'),
      salary: 115000,
      status: 'active',
      performanceRating: 4.0,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Cypress', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Playwright', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1011',
      name: 'Tariq Hassan',
      email: 'tariq.hassan@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Staff Data Engineer',
      level: 'Staff',
      location: 'New York, NY',
      employmentType: 'full_time',
      joiningDate: new Date('2022-11-01'),
      salary: 190000,
      status: 'active',
      performanceRating: 4.5,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Apache Spark', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Snowflake', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1012',
      name: 'Chloe Dubois',
      email: 'chloe.dubois@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Mid-Level Cloud Engineer',
      level: 'Mid-Level',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2025-01-10'),
      salary: 128000,
      status: 'active',
      performanceRating: 4.1,
      flightRiskLevel: 'low',
      skills: [
        { name: 'AWS CloudFormation', proficiency: 'intermediate', category: 'technical', verified: true },
        { name: 'Kubernetes', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1013',
      name: 'Kenji Sato',
      email: 'kenji.sato@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Senior Mobile Engineer',
      level: 'Senior',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2023-09-01'),
      salary: 155000,
      status: 'active',
      performanceRating: 4.3,
      flightRiskLevel: 'low',
      skills: [
        { name: 'React Native', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Swift', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-1014',
      name: 'Maya Lin',
      email: 'maya.lin@careergenie.internal',
      department: 'Engineering',
      roleTitle: 'Junior Full-Stack Engineer',
      level: 'Junior',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2026-08-10'),
      salary: 90000,
      status: 'onboarding',
      performanceRating: 3.5,
      flightRiskLevel: 'low',
      skills: [
        { name: 'TypeScript', proficiency: 'intermediate', category: 'technical', verified: true },
        { name: 'React', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },

    // --- Department: Product & Design (6) ---
    {
      employeeCode: 'EMP-2001',
      name: 'Elena Rostova',
      email: 'elena.rostova@careergenie.internal',
      department: 'Product & Design',
      roleTitle: 'Lead Product Designer',
      level: 'Lead',
      location: 'New York, NY',
      employmentType: 'full_time',
      joiningDate: new Date('2026-09-01'),
      salary: 165000,
      status: 'onboarding',
      performanceRating: 4.0,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Figma', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Design Systems', proficiency: 'expert', category: 'domain', verified: true },
        { name: 'User Research', proficiency: 'expert', category: 'domain', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-2002',
      name: 'Jordan Taylor',
      email: 'jordan.taylor@careergenie.internal',
      department: 'Product & Design',
      roleTitle: 'Senior Product Manager',
      level: 'Senior',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2024-03-01'),
      salary: 160000,
      status: 'active',
      performanceRating: 4.4,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Roadmapping', proficiency: 'expert', category: 'leadership', verified: true },
        { name: 'Product Analytics', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-2003',
      name: 'Sophie Martin',
      email: 'sophie.martin@careergenie.internal',
      department: 'Product & Design',
      roleTitle: 'Mid-Level UX Researcher',
      level: 'Mid-Level',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2025-04-15'),
      salary: 120000,
      status: 'active',
      performanceRating: 4.2,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Usability Testing', proficiency: 'expert', category: 'domain', verified: true },
        { name: 'Quantitative Surveying', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-2004',
      name: 'Arjun Reddy',
      email: 'arjun.reddy@careergenie.internal',
      department: 'Product & Design',
      roleTitle: 'Product Manager, Core Platform',
      level: 'Mid-Level',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2025-05-01'),
      salary: 135000,
      status: 'active',
      performanceRating: 4.1,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Agile/Scrum', proficiency: 'expert', category: 'leadership', verified: true },
        { name: 'API Specifications', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-2005',
      name: 'Zoe Kim',
      email: 'zoe.kim@careergenie.internal',
      department: 'Product & Design',
      roleTitle: 'Senior UI/Visual Designer',
      level: 'Senior',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2023-10-15'),
      salary: 145000,
      status: 'active',
      performanceRating: 4.6,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Design Systems', proficiency: 'expert', category: 'domain', verified: true },
        { name: 'Motion Design', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-2006',
      name: 'Noah Brown',
      email: 'noah.brown@careergenie.internal',
      department: 'Product & Design',
      roleTitle: 'Associate Product Manager',
      level: 'Junior',
      location: 'New York, NY',
      employmentType: 'full_time',
      joiningDate: new Date('2025-11-01'),
      salary: 100000,
      status: 'active',
      performanceRating: 3.7,
      flightRiskLevel: 'low',
      skills: [
        { name: 'User Stories', proficiency: 'intermediate', category: 'domain', verified: true },
        { name: 'SQL Analytics', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },

    // --- Department: Sales & Marketing (6) ---
    {
      employeeCode: 'EMP-3001',
      name: 'Marcus Vance',
      email: 'marcus.vance@careergenie.internal',
      department: 'Sales & Marketing',
      roleTitle: 'Senior Enterprise Account Executive',
      level: 'Senior',
      location: 'New York, NY',
      employmentType: 'full_time',
      joiningDate: new Date('2023-12-01'),
      salary: 150000,
      status: 'active',
      performanceRating: 4.8,
      flightRiskLevel: 'high',
      skills: [
        { name: 'Enterprise Sales', proficiency: 'expert', category: 'domain', verified: true },
        { name: 'Contract Negotiation', proficiency: 'expert', category: 'domain', verified: true },
        { name: 'CRM Pipeline Management', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-3002',
      name: 'Jessica Wu',
      email: 'jessica.wu@careergenie.internal',
      department: 'Sales & Marketing',
      roleTitle: 'Director of Product Marketing',
      level: 'Director',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2022-06-01'),
      salary: 185000,
      status: 'active',
      performanceRating: 4.7,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Go-To-Market Strategy', proficiency: 'expert', category: 'leadership', verified: true },
        { name: 'Competitive Intelligence', proficiency: 'expert', category: 'domain', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-3003',
      name: 'Lucas Silva',
      email: 'lucas.silva@careergenie.internal',
      department: 'Sales & Marketing',
      roleTitle: 'Mid-Level Content & Brand Strategist',
      level: 'Mid-Level',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2025-03-01'),
      salary: 105000,
      status: 'active',
      performanceRating: 3.9,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Technical Writing', proficiency: 'expert', category: 'domain', verified: true },
        { name: 'SEO Strategy', proficiency: 'intermediate', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-3004',
      name: 'Fatima Zahra',
      email: 'fatima.zahra@careergenie.internal',
      department: 'Sales & Marketing',
      roleTitle: 'Senior Growth Marketing Manager',
      level: 'Senior',
      location: 'Remote',
      employmentType: 'full_time',
      joiningDate: new Date('2024-07-15'),
      salary: 140000,
      status: 'active',
      performanceRating: 4.4,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Paid Acquisition', proficiency: 'expert', category: 'technical', verified: true },
        { name: 'Conversion Rate Optimization', proficiency: 'expert', category: 'technical', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-3005',
      name: 'Tyler Evans',
      email: 'tyler.evans@careergenie.internal',
      department: 'Sales & Marketing',
      roleTitle: 'Account Executive, Mid-Market',
      level: 'Mid-Level',
      location: 'New York, NY',
      employmentType: 'full_time',
      joiningDate: new Date('2025-07-01'),
      salary: 110000,
      status: 'active',
      performanceRating: 3.6,
      flightRiskLevel: 'medium',
      skills: [
        { name: 'B2B Outbound', proficiency: 'intermediate', category: 'domain', verified: true }
      ]
    },
    {
      employeeCode: 'EMP-3006',
      name: 'Olivia Clark',
      email: 'olivia.clark@careergenie.internal',
      department: 'Sales & Marketing',
      roleTitle: 'Customer Success Lead',
      level: 'Lead',
      location: 'San Francisco, CA',
      employmentType: 'full_time',
      joiningDate: new Date('2023-04-10'),
      salary: 135000,
      status: 'active',
      performanceRating: 4.5,
      flightRiskLevel: 'low',
      skills: [
        { name: 'Customer Retention', proficiency: 'expert', category: 'leadership', verified: true },
        { name: 'Executive Business Reviews', proficiency: 'expert', category: 'domain', verified: true }
      ]
    }
  ];

  const employeeMap = new Map<string, any>();
  for (const emp of employeeDataRaw) {
    const saved = await Employee.findOneAndUpdate(
      { employeeCode: emp.employeeCode },
      emp,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    employeeMap.set(saved.employeeCode, saved);
  }

  // =========================================================================
  // 3. SEED TIME-SERIES EMPLOYEE SIGNALS
  // =========================================================================
  const alex = employeeMap.get('EMP-1001');
  const sarah = employeeMap.get('EMP-1002');
  const david = employeeMap.get('EMP-1003');
  const marcus = employeeMap.get('EMP-3001');

  const signalsToSeed: any[] = [];

  // --- Alex Chen (Burnout & Critical Flight Risk Scenario) ---
  if (alex) {
    signalsToSeed.push(
      { employeeId: alex._id, type: 'performance', metric: 'okr_achievement_pct', value: 94, period: '2025-Q3', benchmark: 85, deviationPct: 10.5 },
      { employeeId: alex._id, type: 'performance', metric: 'okr_achievement_pct', value: 81, period: '2025-Q4', benchmark: 85, deviationPct: -4.7 },
      { employeeId: alex._id, type: 'performance', metric: 'okr_achievement_pct', value: 68, period: '2026-Q1', benchmark: 85, deviationPct: -20.0, notes: 'Missed cluster migration target due to on-call paging load' },
      { employeeId: alex._id, type: 'workload', metric: 'weekly_overtime_hours', value: 18.5, period: '2026-W10', benchmark: 3.5, deviationPct: 428.5 },
      { employeeId: alex._id, type: 'workload', metric: 'weekly_overtime_hours', value: 16.0, period: '2026-W11', benchmark: 3.5, deviationPct: 357.1 },
      { employeeId: alex._id, type: 'engagement', metric: 'pulse_survey_score', value: 8.5, period: '2025-Q3', benchmark: 7.5, deviationPct: 13.3 },
      { employeeId: alex._id, type: 'engagement', metric: 'pulse_survey_score', value: 5.8, period: '2025-Q4', benchmark: 7.5, deviationPct: -22.6 },
      { employeeId: alex._id, type: 'engagement', metric: 'pulse_survey_score', value: 3.8, period: '2026-Q1', benchmark: 7.5, deviationPct: -49.3, notes: 'Frustrated by lack of architectural support on payments service' },
      { employeeId: alex._id, type: 'attendance', metric: 'pto_days_taken_ytd', value: 0, period: '2026-YTD', benchmark: 10, deviationPct: -100 }
    );
  }

  // --- Sarah Lin (High Potential Scenario) ---
  if (sarah) {
    signalsToSeed.push(
      { employeeId: sarah._id, type: 'performance', metric: 'okr_achievement_pct', value: 98, period: '2026-Q1', benchmark: 85, deviationPct: 15.2 },
      { employeeId: sarah._id, type: 'engagement', metric: 'pulse_survey_score', value: 9.4, period: '2026-Q1', benchmark: 7.5, deviationPct: 25.3 },
      { employeeId: sarah._id, type: 'workload', metric: 'weekly_overtime_hours', value: 2.0, period: '2026-W11', benchmark: 3.5, deviationPct: -42.8 },
      { employeeId: sarah._id, type: 'attendance', metric: 'pto_days_taken_ytd', value: 6, period: '2026-YTD', benchmark: 6, deviationPct: 0 }
    );
  }

  // --- David Kumar (Targeted Skill Gap Scenario) ---
  if (david) {
    signalsToSeed.push(
      { employeeId: david._id, type: 'performance', metric: 'okr_achievement_pct', value: 88, period: '2026-Q1', benchmark: 85, deviationPct: 3.5 },
      { employeeId: david._id, type: 'engagement', metric: 'pulse_survey_score', value: 7.8, period: '2026-Q1', benchmark: 7.5, deviationPct: 4.0 },
      { employeeId: david._id, type: 'workload', metric: 'weekly_overtime_hours', value: 4.5, period: '2026-W11', benchmark: 3.5, deviationPct: 28.5 },
      { employeeId: david._id, type: 'attendance', metric: 'pto_days_taken_ytd', value: 4, period: '2026-YTD', benchmark: 6, deviationPct: -33.3 }
    );
  }

  // --- Marcus Vance (High Performer Disengagement Scenario) ---
  if (marcus) {
    signalsToSeed.push(
      { employeeId: marcus._id, type: 'performance', metric: 'quota_attainment_pct', value: 118, period: '2026-Q1', benchmark: 100, deviationPct: 18.0 },
      { employeeId: marcus._id, type: 'engagement', metric: 'pulse_survey_score', value: 4.9, period: '2026-Q1', benchmark: 7.5, deviationPct: -34.6 },
      { employeeId: marcus._id, type: 'workload', metric: 'weekly_overtime_hours', value: 14.0, period: '2026-W11', benchmark: 5.0, deviationPct: 180.0 },
      { employeeId: marcus._id, type: 'attendance', metric: 'pto_days_taken_ytd', value: 0, period: '2026-YTD', benchmark: 8, deviationPct: -100, notes: 'Zero days taken in 14 months' }
    );
  }

  // Baseline telemetry for remaining 22 employees
  for (const [code, emp] of employeeMap.entries()) {
    if (['EMP-1001', 'EMP-1002', 'EMP-1003', 'EMP-3001'].includes(code)) continue;
    signalsToSeed.push(
      { employeeId: emp._id, type: 'performance', metric: 'okr_achievement_pct', value: 85, period: '2026-Q1', benchmark: 85 },
      { employeeId: emp._id, type: 'engagement', metric: 'pulse_survey_score', value: 7.6, period: '2026-Q1', benchmark: 7.5 },
      { employeeId: emp._id, type: 'workload', metric: 'weekly_overtime_hours', value: 2.5, period: '2026-W11', benchmark: 3.5 },
      { employeeId: emp._id, type: 'attendance', metric: 'pto_days_taken_ytd', value: 5, period: '2026-YTD', benchmark: 6 }
    );
  }

  let signalsCount = 0;
  for (const sig of signalsToSeed) {
    await EmployeeSignal.findOneAndUpdate(
      { employeeId: sig.employeeId, type: sig.type, metric: sig.metric, period: sig.period },
      sig,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    signalsCount++;
  }

  // =========================================================================
  // 4. SEED 4 SYNTHETIC HR CORPORATE POLICY DOCUMENTS
  // =========================================================================
  const policiesData = [
    {
      policyCode: 'POL-REM-2026',
      title: 'Remote & Hybrid Workplace Policy 2026',
      category: 'remote_work' as const,
      version: '2.1',
      summary: 'Comprehensive policy governing remote, hybrid, and flexible working arrangements across global offices.',
      effectiveDate: new Date('2026-01-01'),
      status: 'active' as const,
      approvedBy: 'People & Culture Committee',
      content: 'CareerGenie operates as a remote-first organization. All employees in eligible positions may perform their duties remotely while adhering to team core collaboration hours.',
      sections: [
        {
          sectionId: 'SEC-1.1',
          title: 'Core Collaboration Hours',
          content: 'All team members, regardless of timezone, are expected to be available for synchronous collaboration between 10:00 AM and 3:00 PM in their declared regional home timezone.',
          keywords: ['core hours', 'availability', 'timezone', 'synchronous']
        },
        {
          sectionId: 'SEC-1.2',
          title: 'Home Office Equipment & Ergonomic Stipend',
          content: 'Full-time employees receive a one-time reimbursement of up to $1,000 upon hire for ergonomic office equipment, plus a recurring monthly stipend of $75 for high-speed internet connectivity.',
          keywords: ['stipend', 'reimbursement', 'internet', 'equipment', 'ergonomic', 'allowance']
        },
        {
          sectionId: 'SEC-1.3',
          title: 'Work From Anywhere (Cross-Border Remote Work)',
          content: 'Employees may work from outside their primary country of employment for up to 30 business days per calendar year, subject to manager pre-approval and compliance with international tax residency rules.',
          keywords: ['cross-border', 'international', 'travel', '30 days', 'tax residency']
        }
      ]
    },
    {
      policyCode: 'POL-PTO-2026',
      title: 'Paid Time Off, Wellness & Sabbatical Guidelines',
      category: 'leave_pto' as const,
      version: '3.0',
      summary: 'Standards for vacation accrual, emergency mental health wellness days, parental leave, and four-year tenure sabbaticals.',
      effectiveDate: new Date('2026-01-01'),
      status: 'active' as const,
      approvedBy: 'VP of People Operations',
      content: 'CareerGenie values sustainable work life balance and mandatory rest. We require managers to monitor overtime and ensure team members take their accrued time off.',
      sections: [
        {
          sectionId: 'SEC-2.1',
          title: 'Annual Paid Vacation & Rollover Rules',
          content: 'Full-time employees accrue 20 days of paid vacation per year. A maximum of 5 unused days may roll over into the subsequent calendar year, expiring on March 31.',
          keywords: ['vacation', 'accrual', 'rollover', '20 days', 'carryover']
        },
        {
          sectionId: 'SEC-2.2',
          title: 'Quarterly Mental Health Wellness Days',
          content: 'All employees receive 1 designated, fully paid Wellness Day per quarter (4 per year) that can be taken without advance notice for personal health, decompression, or rest.',
          keywords: ['wellness day', 'mental health', 'burnout', 'decompression', 'no notice']
        },
        {
          sectionId: 'SEC-2.3',
          title: 'Four-Year Continuous Tenure Sabbatical',
          content: 'Employees who complete 4 continuous years of full-time service are eligible for a 4-week fully paid sabbatical leave in addition to their standard vacation allowance.',
          keywords: ['sabbatical', '4 years', 'tenure', 'recharge', 'extended leave']
        }
      ]
    },
    {
      policyCode: 'POL-PRO-2026',
      title: 'Engineering & Workforce Promotion & Compensation Framework',
      category: 'compensation_promotion' as const,
      version: '1.4',
      summary: 'Dual career track guidelines, promotion rubrics, market compensation benchmarks, and bi-annual review cycles.',
      effectiveDate: new Date('2026-01-01'),
      status: 'active' as const,
      approvedBy: 'Executive Leadership Team',
      content: 'CareerGenie provides parallel career progression paths for Individual Contributors (IC) and People Managers to ensure technical leadership is recognized without requiring a management switch.',
      sections: [
        {
          sectionId: 'SEC-3.1',
          title: 'Dual Career Ladder & Level Definitions',
          content: 'The engineering ladder progresses from Junior (L1) -> Mid-Level (L2) -> Senior (L3) -> Lead (L4) -> Staff (L5) -> Principal (L6). Senior ICs have equal compensation bands to Engineering Managers.',
          keywords: ['ladder', 'levels', 'staff engineer', 'ic track', 'management track']
        },
        {
          sectionId: 'SEC-3.2',
          title: 'Promotion Eligibility & Demonstration Window',
          content: 'Candidates for promotion must demonstrate consistent performance at the target level for a minimum of 6 continuous months and have completed an approved competency evaluation.',
          keywords: ['promotion', 'review cycle', 'eligibility', '6 months', 'competency']
        },
        {
          sectionId: 'SEC-3.3',
          title: 'Bi-Annual Performance & Compensation Review',
          content: 'Formal compensation reviews occur twice per year in June and December. Out-of-band market equity adjustments may be triggered by People Ops when retention risk exceeds critical thresholds.',
          keywords: ['review', 'june', 'december', 'compensation', 'salary adjustment', 'market rate']
        }
      ]
    },
    {
      policyCode: 'POL-CON-2026',
      title: 'Corporate Code of Conduct & Anti-Harassment Standards',
      category: 'code_of_conduct' as const,
      version: '2.0',
      summary: 'Expectations for psychological safety, anti-harassment, conflict resolution, and non-retaliation reporting protocols.',
      effectiveDate: new Date('2026-01-01'),
      status: 'active' as const,
      approvedBy: 'Chief Legal Officer',
      content: 'CareerGenie maintains zero tolerance for discrimination, harassment, or retaliation. Every worker is entitled to an inclusive, respectful environment.',
      sections: [
        {
          sectionId: 'SEC-4.1',
          title: 'Mutual Respect, Inclusivity & Psychological Safety',
          content: 'All communication across Slack, email, video calls, and code reviews must remain constructive and respectful. Disparaging comments regarding background or identity are strictly prohibited.',
          keywords: ['respect', 'conduct', 'code review', 'inclusivity', 'harassment']
        },
        {
          sectionId: 'SEC-4.2',
          title: 'Confidential Reporting & Non-Retaliation Protocol',
          content: 'Reports of misconduct may be submitted to People Ops or via the anonymous whistleblower portal. CareerGenie strictly prohibits any form of retaliation against individuals who raise concerns in good faith.',
          keywords: ['reporting', 'whistleblower', 'anonymous', 'non-retaliation', 'investigation']
        }
      ]
    }
  ];

  let policiesCount = 0;
  for (const pol of policiesData) {
    await PolicyDocument.findOneAndUpdate(
      { policyCode: pol.policyCode },
      pol,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    policiesCount++;
  }

  // =========================================================================
  // 5. SEED ADAPTIVE ONBOARDING PLANS
  // =========================================================================
  let onboardingPlansCount = 0;
  const elena = employeeMap.get('EMP-2001');
  if (elena) {
    await OnboardingPlan.findOneAndUpdate(
      { employeeId: elena._id },
      {
        employeeId: elena._id,
        roleTitle: elena.roleTitle,
        department: elena.department,
        mentorName: 'Zoe Kim (Senior UI Designer)',
        startDate: new Date('2026-09-01'),
        targetCompletionDate: new Date('2026-11-30'),
        overallProgress: 57,
        status: 'delayed',
        aiGuidanceNotes: 'Technical access completed on schedule. Design system sync and team buddy session are overdue by 4 days.',
        milestones: [
          {
            milestoneId: 'M-01',
            title: 'IT Hardware Setup & Enterprise SSO Provisioning',
            description: 'Receive laptop, configure 1Password, VPN, and GitHub/Figma SSO.',
            category: 'technical_setup',
            dueDay: 1,
            completed: true,
            completedAt: new Date('2026-09-01')
          },
          {
            milestoneId: 'M-02',
            title: 'People Ops Orientation & Policy Compliance Acknowledgment',
            description: 'Review Remote Work and Code of Conduct policies.',
            category: 'compliance',
            dueDay: 3,
            completed: true,
            completedAt: new Date('2026-09-03')
          },
          {
            milestoneId: 'M-03',
            title: 'Design System & Component Library Access',
            description: 'Clone design system Figma files and review typography tokens.',
            category: 'technical_setup',
            dueDay: 7,
            completed: true,
            completedAt: new Date('2026-09-07')
          },
          {
            milestoneId: 'M-04',
            title: 'Product Management Counterpart Introduction',
            description: 'Introductory alignment with Jordan Taylor on Q4 product roadmap.',
            category: 'team_integration',
            dueDay: 14,
            completed: true,
            completedAt: new Date('2026-09-14')
          },
          {
            milestoneId: 'M-05',
            title: 'Cross-Functional Engineering Buddy 1-on-1',
            description: 'Meet Sarah Lin (Frontend) to review frontend handoff workflows.',
            category: 'team_integration',
            dueDay: 14,
            completed: false,
            notes: 'Rescheduled twice due to sprint freeze'
          },
          {
            milestoneId: 'M-06',
            title: 'First Feature Spec Critique & Design Review',
            description: 'Present user journey map for upcoming workforce intelligence module.',
            category: 'role_training',
            dueDay: 45,
            completed: false
          },
          {
            milestoneId: 'M-07',
            title: '90-Day Full Autonomy Design Presentation',
            description: 'Present 6-month visual vision to leadership team.',
            category: 'role_training',
            dueDay: 90,
            completed: false
          }
        ]
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    onboardingPlansCount++;
  }

  const mayaEmp = employeeMap.get('EMP-1014');
  if (mayaEmp) {
    await OnboardingPlan.findOneAndUpdate(
      { employeeId: mayaEmp._id },
      {
        employeeId: mayaEmp._id,
        roleTitle: mayaEmp.roleTitle,
        department: mayaEmp.department,
        mentorName: 'James Wilson (Senior Full-Stack)',
        startDate: new Date('2026-08-10'),
        targetCompletionDate: new Date('2026-11-10'),
        overallProgress: 75,
        status: 'on_track',
        milestones: [
          { milestoneId: 'M-01', title: 'Workstation Setup', description: 'Dev setup', category: 'technical_setup', dueDay: 1, completed: true, completedAt: new Date('2026-08-10') },
          { milestoneId: 'M-02', title: 'Local Dev Environment Setup', description: 'Run test suite locally', category: 'technical_setup', dueDay: 3, completed: true, completedAt: new Date('2026-08-12') },
          { milestoneId: 'M-03', title: 'First Good-First-Issue PR Merged', description: 'Fix bug on job cards', category: 'role_training', dueDay: 14, completed: true, completedAt: new Date('2026-08-20') },
          { milestoneId: 'M-04', title: 'Pair Programming on Auth Flow', description: 'Shadow James on security fix', category: 'role_training', dueDay: 30, completed: true, completedAt: new Date('2026-09-05') },
          { milestoneId: 'M-05', title: '60-Day Independence Check-In', description: 'Review code quality metrics', category: 'team_integration', dueDay: 60, completed: false }
        ]
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    onboardingPlansCount++;
  }

  // =========================================================================
  // 6. SEED 2 ACTIVE JOBS + 8 SYNTHETIC CANDIDATES (RedRankAI Pipeline)
  // =========================================================================
  const job1 = await Job.findOneAndUpdate(
    { title: 'Staff Distributed Systems Engineer', company: 'CareerGenie' },
    {
      title: 'Staff Distributed Systems Engineer',
      company: 'CareerGenie',
      description: 'Looking for a Staff Engineer to architect low-latency distributed telemetry and multi-region data pipelines. Must be proficient in Go, Kafka, and Kubernetes.',
      requiredSkills: ['Go', 'Distributed Systems', 'Kubernetes', 'Kafka', 'PostgreSQL'],
      experience: 6,
      salaryMin: 180000,
      salaryMax: 220000,
      location: 'Remote',
      recruiterId: recruiter._id,
      status: 'active'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const job2 = await Job.findOneAndUpdate(
    { title: 'Lead Frontend Architect', company: 'CareerGenie' },
    {
      title: 'Lead Frontend Architect',
      company: 'CareerGenie',
      description: 'Lead our next-generation enterprise frontend architecture. Deep expertise in React 19, Next.js App Router, Web Performance Optimization, and Design Systems required.',
      requiredSkills: ['React', 'TypeScript', 'Next.js', 'Web Performance', 'GraphQL'],
      experience: 5,
      salaryMin: 170000,
      salaryMax: 210000,
      location: 'San Francisco, CA',
      recruiterId: recruiter._id,
      status: 'active'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const candidatesData = [
    // Job 1: Distributed Systems
    {
      name: 'Nathan Drake',
      email: 'nathan.drake@candidate.internal',
      skills: ['Go', 'Distributed Systems', 'Kubernetes', 'Kafka', 'PostgreSQL', 'Docker', 'gRPC'],
      yearsOfExperience: 7,
      education: "Master's in Computer Science",
      careerLevel: 'Senior',
      jobId: job1._id,
      resumeText: 'Experienced Distributed Systems Engineer with 7 years architecting high-throughput event processing pipelines in Go and Kafka. Strong Kubernetes operator experience.',
      interviewStage: 'technical',
      overallScore: 92,
      recommendation: 'strong_hire'
    },
    {
      name: 'Hana Takahashi',
      email: 'hana.takahashi@candidate.internal',
      skills: ['Go', 'Kubernetes', 'Docker', 'PostgreSQL', 'AWS'],
      yearsOfExperience: 5,
      education: "Bachelor's in Software Engineering",
      careerLevel: 'Mid-Level',
      jobId: job1._id,
      resumeText: 'Backend engineer specializing in microservices using Go and Docker. Strong PostgreSQL experience, familiar with Kubernetes deployments.',
      interviewStage: 'screen',
      overallScore: 82,
      recommendation: 'hire'
    },
    {
      name: 'Samuel Green',
      email: 'samuel.green@candidate.internal',
      skills: ['Python', 'Go', 'PostgreSQL', 'REST APIs'],
      yearsOfExperience: 4,
      education: "Bachelor's in Computer Science",
      careerLevel: 'Mid-Level',
      jobId: job1._id,
      resumeText: '4 years backend engineering with Python and Go. Looking to transition into core distributed infrastructure and event-driven architecture.',
      interviewStage: 'screen',
      overallScore: 68,
      recommendation: 'borderline'
    },
    {
      name: 'Kavita Reddy',
      email: 'kavita.reddy@candidate.internal',
      skills: ['C++', 'Linux', 'Networking', 'SQL'],
      yearsOfExperience: 3,
      education: "Bachelor's in Electrical Engineering",
      careerLevel: 'Junior',
      jobId: job1._id,
      resumeText: 'Systems programmer with C++ and Linux kernel network driver experience. Strong CS fundamentals, learning Go and Kubernetes.',
      interviewStage: 'screen',
      overallScore: 51,
      recommendation: 'do_not_hire'
    },

    // Job 2: Frontend Architect
    {
      name: 'Maya Patel',
      email: 'maya.patel@candidate.internal',
      skills: ['React', 'TypeScript', 'Next.js', 'Web Performance', 'GraphQL', 'Tailwind CSS', 'Micro-frontends'],
      yearsOfExperience: 6,
      education: "Master's in Human-Computer Interaction",
      careerLevel: 'Lead',
      jobId: job2._id,
      resumeText: '6 years scaling frontend architecture. Led Next.js App Router migration, reduced Core Web Vitals LCP by 45%. Deep expertise in TypeScript and GraphQL.',
      interviewStage: 'system_design',
      overallScore: 94,
      recommendation: 'strong_hire'
    },
    {
      name: 'Leo Vance',
      email: 'leo.vance@candidate.internal',
      skills: ['React', 'TypeScript', 'Next.js', 'CSS Architecture', 'Webpack'],
      yearsOfExperience: 5,
      education: "Bachelor's in Computer Science",
      careerLevel: 'Senior',
      jobId: job2._id,
      resumeText: 'Senior Frontend Developer with 5 years building scalable React and Next.js applications. Strong TypeScript and component architecture background.',
      interviewStage: 'technical',
      overallScore: 81,
      recommendation: 'hire'
    },
    {
      name: 'Amira Idris',
      email: 'amira.idris@candidate.internal',
      skills: ['React', 'JavaScript', 'HTML5', 'CSS3', 'REST APIs'],
      yearsOfExperience: 3,
      education: "Bachelor's in Information Technology",
      careerLevel: 'Junior',
      jobId: job2._id,
      resumeText: 'Frontend engineer with 3 years building responsive web apps with React. Passionate about design systems and UI accessibility.',
      interviewStage: 'screen',
      overallScore: 69,
      recommendation: 'borderline'
    },
    {
      name: 'Chris Miller',
      email: 'chris.miller@candidate.internal',
      skills: ['JavaScript', 'HTML5', 'CSS3', 'jQuery', 'AngularJS'],
      yearsOfExperience: 4,
      education: 'Associate Degree in Web Development',
      careerLevel: 'Junior',
      jobId: job2._id,
      resumeText: 'Web developer with experience supporting legacy JavaScript and Angular applications. Exploring modern React ecosystem.',
      interviewStage: 'screen',
      overallScore: 54,
      recommendation: 'do_not_hire'
    }
  ];

  let candidatesCount = 0;
  let applicationsCount = 0;
  let interviewEvaluationsCount = 0;

  for (const cand of candidatesData) {
    const candUser = await User.findOneAndUpdate(
      { email: cand.email },
      {
        name: cand.name,
        email: cand.email,
        password: 'CandidatePassword123!',
        role: 'student',
        skills: cand.skills,
        yearsOfExperience: cand.yearsOfExperience,
        education: cand.education,
        careerLevel: cand.careerLevel
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    candidatesCount++;

    const resume = await Resume.findOneAndUpdate(
      { userId: candUser._id },
      {
        userId: candUser._id,
        fileUrl: `https://res.cloudinary.com/demo/image/upload/sample_resume_${candUser._id}.pdf`,
        extractedText: cand.resumeText,
        version: 1
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await ResumeAnalysis.findOneAndUpdate(
      { resumeId: resume._id },
      {
        resumeId: resume._id,
        overallScore: Math.round(75 + Math.random() * 20),
        atsScore: Math.round(80 + Math.random() * 18),
        strengths: ['Relevant technical skill match', 'Structured experience summary', 'Clear role alignment'],
        weaknesses: ['Could elaborate on quantifiable business metrics'],
        missingSkills: [],
        suggestions: ['Include direct links to open-source repository contributions'],
        yearsOfExperience: cand.yearsOfExperience,
        careerLevel: cand.careerLevel
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const targetJob = cand.jobId.toString() === job1._id.toString() ? job1 : job2;
    const matchBreakdown = calculateDetailedMatchScore(
      cand.skills,
      cand.yearsOfExperience,
      cand.education,
      cand.resumeText,
      targetJob.requiredSkills,
      targetJob.experience,
      targetJob.description
    );

    await JobMatch.findOneAndUpdate(
      { studentId: candUser._id, jobId: targetJob._id },
      {
        studentId: candUser._id,
        jobId: targetJob._id,
        matchScore: matchBreakdown.matchScore,
        skillsMatch: matchBreakdown.skillsMatch,
        experienceMatch: matchBreakdown.experienceMatch,
        educationMatch: matchBreakdown.educationMatch
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Application.findOneAndUpdate(
      { studentId: candUser._id, jobId: targetJob._id },
      {
        studentId: candUser._id,
        jobId: targetJob._id,
        matchScore: matchBreakdown.matchScore,
        status: cand.interviewStage === 'screen' ? 'applied' : 'interviewing'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    applicationsCount++;

    await InterviewEvaluation.findOneAndUpdate(
      { jobId: targetJob._id, candidateId: candUser._id, interviewStage: cand.interviewStage as any },
      {
        jobId: targetJob._id,
        candidateId: candUser._id,
        candidateName: cand.name,
        roleTitle: targetJob.title,
        interviewerName: 'Victoria Stone (Lead Technical Recruiter)',
        interviewStage: cand.interviewStage,
        overallScore: cand.overallScore,
        recommendation: cand.recommendation,
        competencies: [
          {
            competency: 'Core Technical Competence',
            score: Math.min(5, Math.max(1, Math.round(cand.overallScore / 20))),
            weight: 0.4,
            feedback: `Demonstrated solid domain familiarity in ${cand.skills.slice(0, 3).join(', ')}.`,
            keySignals: cand.skills.slice(0, 3)
          },
          {
            competency: 'Problem Solving & Architecture',
            score: Math.min(5, Math.max(1, Math.round((cand.overallScore - 5) / 20))),
            weight: 0.35,
            feedback: 'Structured approach to resolving technical trade-offs.',
            keySignals: ['Requirement scoping', 'Clarity of explanation']
          },
          {
            competency: 'Collaboration & Communication',
            score: 4,
            weight: 0.25,
            feedback: 'Clear, concise communication style aligned with team values.',
            keySignals: ['Active listening', 'Clear articulation']
          }
        ],
        strengthsSummary: [
          `Strong background in ${cand.skills[0] || 'core engineering'}`,
          'Structured verbal communication'
        ],
        concernsSummary: cand.recommendation === 'do_not_hire' 
          ? ['Noticeable gap in required production experience for target level']
          : [],
        aiSynthesis: `Candidate ${cand.name} demonstrated ${cand.recommendation === 'strong_hire' ? 'exceptional' : 'adequate'} capability for the ${targetJob.title} position.`
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    interviewEvaluationsCount++;
  }

  // =========================================================================
  // 7. SEED DEPARTMENT SKILL REQUIREMENTS (Workforce Skill Intelligence)
  // =========================================================================
  let skillRequirementsCount = 0;
  for (const req of BASELINE_DEPARTMENT_REQUIREMENTS) {
    await DepartmentSkillRequirement.findOneAndUpdate(
      { department: req.department, skillName: req.skillName },
      req,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    skillRequirementsCount++;
  }

  return {
    employeesCount: employeeMap.size,
    signalsCount,
    policiesCount,
    onboardingPlansCount,
    jobsCount: 2,
    candidatesCount,
    applicationsCount,
    interviewEvaluationsCount,
    skillRequirementsCount
  };
}
