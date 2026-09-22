import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import OnboardingPlan, {
  IOnboardingPlan,
  IOnboardingMilestone,
  MilestoneCategory,
  MilestoneStatus,
  OnboardingPlanStatus,
  IAdaptationRecord,
  IOnboardingCheckpoint
} from '@/models/OnboardingPlan';
import Employee, { IEmployee } from '@/models/Employee';
import EmployeeSignal from '@/models/EmployeeSignal';
import PolicyDocument from '@/models/PolicyDocument';
import Notification from '@/models/Notification';
import { recordActivity } from '@/services/activity';
import {
  generateAdaptiveOnboardingPlan,
  analyzeOnboardingVelocityAndAdapt,
  AdaptivePlanMilestoneSuggestion,
  AdaptiveDiagnosisPayload
} from '@/services/gemini';

// ============================================================================
// 1. DETERMINISTIC ONBOARDING TEMPLATES BY DEPARTMENT & LEVEL
// ============================================================================

export interface TemplateMilestoneDefinition {
  milestoneId: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  dueDay: number;
  resourceLink?: string;
}

export const BASE_COMPLIANCE_MILESTONES: TemplateMilestoneDefinition[] = [
  {
    milestoneId: 'M-01',
    title: 'Enterprise SSO, Workstation & Security Access Provisioning',
    description: 'Configure password manager, enterprise MFA, VPN, and workstation disk encryption according to security policies.',
    category: 'compliance',
    dueDay: 1,
    resourceLink: 'POL-SEC-2026'
  },
  {
    milestoneId: 'M-02',
    title: 'People Operations Orientation & Handbook Compliance Sign-off',
    description: 'Review corporate Code of Conduct, Remote Work, and Paid Time Off policies; submit digital acknowledgment.',
    category: 'compliance',
    dueDay: 3,
    resourceLink: 'POL-REM-2026'
  }
];

export const DEPARTMENT_LEVEL_TEMPLATES: Record<string, Record<string, TemplateMilestoneDefinition[]>> = {
  Engineering: {
    Junior: [
      {
        milestoneId: 'M-03',
        title: 'Local Development Environment & Repository Setup',
        description: 'Clone primary service repositories, configure local Docker containers, and successfully execute full test suite.',
        category: 'technical_setup',
        dueDay: 5
      },
      {
        milestoneId: 'M-04',
        title: 'Engineering Team & Architecture Onboarding Sync',
        description: 'Complete architecture walk-through with team lead and meet designated engineering peer buddy.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'First Good-First-Issue PR Merged to Staging',
        description: 'Submit, review, and merge first scoped bug fix or component enhancement with test coverage.',
        category: 'role_training',
        dueDay: 20
      },
      {
        milestoneId: 'M-06',
        title: 'On-Call Shadowing & CI/CD Pipeline Deployment Walkthrough',
        description: 'Shadow secondary on-call rotation engineer and review automated canary release workflows.',
        category: 'role_training',
        dueDay: 45
      },
      {
        milestoneId: 'M-07',
        title: 'Independent Feature Delivery & 90-Day Ramp Presentation',
        description: 'Own end-to-end delivery of a medium-complexity user story and conduct 90-day progress review.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Mid: [
      {
        milestoneId: 'M-03',
        title: 'Development Environment & Core Service Architecture Setup',
        description: 'Provision cloud dev workspace, configure microservice dependencies, and verify end-to-end integration tests.',
        category: 'technical_setup',
        dueDay: 5
      },
      {
        milestoneId: 'M-04',
        title: 'Cross-Functional Team & Sprint Cadence Integration',
        description: 'Meet product manager, design counterpart, and participate in first sprint planning & backlog refinement.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Core Module Feature Contribution & PR Review',
        description: 'Deliver initial core feature implementation adhering strictly to departmental TypeScript & API standards.',
        category: 'role_training',
        dueDay: 21
      },
      {
        milestoneId: 'M-06',
        title: 'Service Reliability & Production Deployment Certification',
        description: 'Complete runbook training, telemetry dashboard setup, and participate in scheduled production release.',
        category: 'role_training',
        dueDay: 45
      },
      {
        milestoneId: 'M-07',
        title: 'Full Autonomy Milestone: Subsystem Ownership',
        description: 'Assume technical ownership of a service domain and review 90-day engineering objectives with manager.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Senior: [
      {
        milestoneId: 'M-03',
        title: 'Infrastructure & High-Throughput Service Environment Setup',
        description: 'Access cloud staging clusters, telemetry monitors, and review distributed architecture specifications.',
        category: 'technical_setup',
        dueDay: 4
      },
      {
        milestoneId: 'M-04',
        title: 'Staff Engineering & Systems Architecture Briefing',
        description: 'Meet principal engineering peers to align on technical debt mitigation and Q4 scalability priorities.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'First Architecture RFC & Critical Path PR Submission',
        description: 'Author technical RFC for upcoming high-scale service component and deliver supporting code implementation.',
        category: 'role_training',
        dueDay: 25
      },
      {
        milestoneId: 'M-06',
        title: 'Code Review Mentorship & On-Call Rotation Readiness',
        description: 'Conduct code reviews for team members and onboard to primary production incident response roster.',
        category: 'role_training',
        dueDay: 50
      },
      {
        milestoneId: 'M-07',
        title: 'Quarterly Technical Roadmap Delivery & 90-Day Alignment',
        description: 'Deliver major architectural milestone and establish ongoing cross-team technical leadership initiatives.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Lead: [
      {
        milestoneId: 'M-03',
        title: 'Enterprise Architecture & Team Tooling Alignment',
        description: 'Audit team technical stacks, repository permissions, and engineering standards documentation.',
        category: 'technical_setup',
        dueDay: 4
      },
      {
        milestoneId: 'M-04',
        title: 'Engineering Leadership & Cross-Department Stakeholder Sync',
        description: 'Conduct 1-on-1s with all direct reports, VP of Engineering, and Head of Product to establish team vision.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Sprint Velocity & Engineering Process Optimization',
        description: 'Review delivery cycle metrics, identify process bottlenecks, and institute improved code hygiene standards.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Technical Strategy Document & Hiring Plan Alignment',
        description: 'Publish half-yearly technical roadmap and align with talent acquisition on quarterly team headcount.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day Engineering Organization Milestone Review',
        description: 'Review team performance ratings, system SLO metrics, and strategic cross-functional initiatives.',
        category: 'role_training',
        dueDay: 90
      }
    ]
  },
  'Product & Design': {
    Junior: [
      {
        milestoneId: 'M-03',
        title: 'Design Tooling & Component System Access',
        description: 'Clone Figma design system libraries, verify typography tokens, and install analytics plugins.',
        category: 'technical_setup',
        dueDay: 4
      },
      {
        milestoneId: 'M-04',
        title: 'Design Buddy Pairing & Product Sync',
        description: 'Shadow senior designer on user interview and meet primary engineering implementation counterparts.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'First Feature User Flow & Wireframe Delivery',
        description: 'Deliver wireframes and interaction specs for an assigned product backlog enhancement.',
        category: 'role_training',
        dueDay: 25
      },
      {
        milestoneId: 'M-06',
        title: 'Design Critique & Usability Testing Observation',
        description: 'Present work at bi-weekly design critique and synthesize insights from customer feedback session.',
        category: 'role_training',
        dueDay: 45
      },
      {
        milestoneId: 'M-07',
        title: 'Production Feature Launch & 90-Day Portfolio Review',
        description: 'Shepherd design implementation to production release and present 90-day progress to design leadership.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Mid: [
      {
        milestoneId: 'M-03',
        title: 'Figma Library & User Analytics Suite Provisioning',
        description: 'Integrate into design repositories, Amplitude dashboards, and customer feedback repository.',
        category: 'technical_setup',
        dueDay: 4
      },
      {
        milestoneId: 'M-04',
        title: 'Product Trio Alignment & Roadmap Sync',
        description: 'Establish weekly sync with product manager and engineering tech lead for assigned product squad.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Feature Discovery & High-Fidelity Prototype Delivery',
        description: 'Lead user discovery sprint and publish validated high-fidelity interactive component prototypes.',
        category: 'role_training',
        dueDay: 25
      },
      {
        milestoneId: 'M-06',
        title: 'Handoff Specification & Quality Assurance Review',
        description: 'Conduct design QA on staging build to ensure pixel-perfect fidelity and accessibility compliance.',
        category: 'role_training',
        dueDay: 50
      },
      {
        milestoneId: 'M-07',
        title: 'Full Product Domain Ownership & 90-Day Ramp Sign-off',
        description: 'Present product impact metrics from launched feature and review quarterly growth goals.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Senior: [
      {
        milestoneId: 'M-03',
        title: 'Design System Governance & Analytics Setup',
        description: 'Audit existing component repository, token conventions, and establish design system review permissions.',
        category: 'technical_setup',
        dueDay: 4
      },
      {
        milestoneId: 'M-04',
        title: 'Design Leadership & Product Strategy Alignment',
        description: 'Meet executive product leadership to review 12-month vision, core personas, and market differentiators.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'End-to-End Strategic Feature Design Presentation',
        description: 'Spearhead holistic user experience architecture for a major product initiative.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Cross-Squad Design Critique Facilitation',
        description: 'Facilitate weekly design critiques and mentor junior designers on accessibility and design systems.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day Product UX Vision & Metrics Review',
        description: 'Deliver strategic user experience vision doc and present key adoption metrics to stakeholders.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Lead: [
      {
        milestoneId: 'M-03',
        title: 'Design Organization & Systems Tooling Audit',
        description: 'Review licensing, design ops workflows, and user research vendor contracts.',
        category: 'technical_setup',
        dueDay: 4
      },
      {
        milestoneId: 'M-04',
        title: 'Design Team 1-on-1s & Cross-Functional Alignment',
        description: 'Complete 1-on-1s with all designers, VP Product, and Head of Engineering.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Design Quality Framework & Sprint Rituals Implementation',
        description: 'Standardize design review gates and integrate discovery workflows with engineering sprints.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Quarterly Design Operations & Talent Strategy',
        description: 'Align with talent acquisition on design hiring pipeline and present quarterly design goals.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day Design Strategy & Executive Review',
        description: 'Deliver comprehensive design maturity assessment and 6-month product roadmap recommendations.',
        category: 'role_training',
        dueDay: 90
      }
    ]
  },
  'Sales & Marketing': {
    Junior: [
      {
        milestoneId: 'M-03',
        title: 'CRM Access & Sales Automation Tooling Setup',
        description: 'Configure HubSpot/Salesforce, email sequencing tools, and calendar scheduling software.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Sales Team Shadowing & Product Pitch Certification',
        description: 'Shadow 5 live customer discovery calls and deliver successful internal demo pitch certification.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'First Customer Outreach Campaign & Lead Generation',
        description: 'Launch targeted outreach sequence generating at least 5 qualified discovery conversations.',
        category: 'role_training',
        dueDay: 25
      },
      {
        milestoneId: 'M-06',
        title: 'Pipeline Management & Opportunity Review',
        description: 'Conduct pipeline review with sales manager and refine objection handling strategies.',
        category: 'role_training',
        dueDay: 50
      },
      {
        milestoneId: 'M-07',
        title: 'First Deal Closing / Quota Attainment & 90-Day Review',
        description: 'Close first commercial deal or hit quarterly lead quota; complete 90-day performance review.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Mid: [
      {
        milestoneId: 'M-03',
        title: 'CRM Pipeline & Lead Routing Configuration',
        description: 'Set up CRM accounts, outbound intelligence tools, and territory account mapping.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Revenue Operations & Product Marketing Alignment',
        description: 'Review pricing tiers, collateral, and meet sales engineering and marketing partners.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Active Deal Pipeline Generation & Customer Demos',
        description: 'Conduct 10+ prospective customer demos and advance opportunities to proposal stage.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Mid-Quarter Sales Forecast & Contract Negotiation',
        description: 'Negotiate MSA terms with customer procurement and present accurate quarterly forecast.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: 'Full Ramp Quota Delivery & Territory Expansion Plan',
        description: 'Achieve 100% ramp quota and submit 6-month territory expansion roadmap.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Senior: [
      {
        milestoneId: 'M-03',
        title: 'Enterprise Account Mapping & Tooling Provisioning',
        description: 'Configure enterprise CRM views, intent data feeds, and sales enablement libraries.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Executive Sales & Solutions Consulting Sync',
        description: 'Establish partnership with solutions architect and meet VP of Sales to review strategic targets.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Tier-1 Enterprise Account Engagement & RFP Response',
        description: 'Initiate executive engagement with top-tier enterprise accounts and submit comprehensive RFP.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Strategic Partner Co-Selling & Contract Closure',
        description: 'Execute high-value commercial agreement and establish reference customer relationship.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: 'Annual Enterprise Territory Strategy & 90-Day Ramp Review',
        description: 'Deliver strategic enterprise territory revenue plan and review first quarter metrics.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Lead: [
      {
        milestoneId: 'M-03',
        title: 'Sales Operations & Commercial Tooling Audit',
        description: 'Audit CRM data integrity, commission structures, and sales tech stack efficiency.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Sales Team 1-on-1s & Cross-Functional Alignment',
        description: 'Meet all account executives, product leads, and finance partners to align on annual targets.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Sales Playbook Realignment & Deal Coaching Framework',
        description: 'Revise corporate sales playbook and institute structured weekly deal coaching sessions.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Quarterly Revenue Forecasting & Pipeline Acceleration',
        description: 'Deliver executive revenue forecast model and launch team pipeline acceleration spiff.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day Commercial Organization & Talent Review',
        description: 'Evaluate team quota attainment, talent retention, and present next quarter growth strategy.',
        category: 'role_training',
        dueDay: 90
      }
    ]
  },
  'Operations & HR': {
    Junior: [
      {
        milestoneId: 'M-03',
        title: 'HRIS & Operations Portal Configuration',
        description: 'Configure administrative access to HRIS, payroll, and benefits software.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'People Team Shadowing & Employee Inquiries Desk',
        description: 'Shadow People Ops lead on new hire orientations and triage employee benefit tickets.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Independent Onboarding Coordination & Audit',
        description: 'Coordinate complete onboarding lifecycle for an incoming cohort and audit document compliance.',
        category: 'role_training',
        dueDay: 25
      },
      {
        milestoneId: 'M-06',
        title: 'Benefits Administration & Policy FAQ Maintenance',
        description: 'Update company intranet knowledge base and resolve open leave of absence requests.',
        category: 'role_training',
        dueDay: 50
      },
      {
        milestoneId: 'M-07',
        title: 'Quarterly HR Operations Report & 90-Day Review',
        description: 'Compile SLA metrics on employee inquiries and review 90-day progress with HR Director.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Mid: [
      {
        milestoneId: 'M-03',
        title: 'HRIS System Administration & Automation Tooling Setup',
        description: 'Audit employee records, configure reporting workflows, and verify automated compliance triggers.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Department Head & People Partner Introductions',
        description: 'Establish bi-weekly alignment with engineering and product department heads.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Employee Lifecycle Workflow Optimization',
        description: 'Streamline offboarding and role transition workflows to reduce manual paperwork.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Engagement Survey Administration & Sentiment Analysis',
        description: 'Deploy quarterly employee pulse survey and produce cross-departmental sentiment findings.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day People Operations Strategy & Retrospective',
        description: 'Present HR operations health scorecard and set semi-annual retention initiatives.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Senior: [
      {
        milestoneId: 'M-03',
        title: 'People Analytics & Compliance Tooling Audit',
        description: 'Review international compliance, equity platform administration, and workforce analytics.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Executive Leadership Alignment & Talent Planning',
        description: 'Meet executive leadership to review talent succession planning and organizational chart updates.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Global Mobility & Total Rewards Policy Revision',
        description: 'Audit compensation benchmarking data and draft proposed updates to remote work stipends.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Performance Review Cycle Facilitation & Manager Coaching',
        description: 'Lead manager calibration sessions and resolve complex employee relations inquiries.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day Workforce Strategy & HR Program Roadmap',
        description: 'Publish 12-month people operations roadmap and present key workforce health indicators.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Lead: [
      {
        milestoneId: 'M-03',
        title: 'Operations Infrastructure & Compliance System Audit',
        description: 'Review corporate insurance, vendor contracts, and international legal entity compliance.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'People Team 1-on-1s & C-Suite Strategic Sync',
        description: 'Conduct 1-on-1s with all HR specialists and align with CEO on company culture priorities.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Comprehensive Talent Strategy & DE&I Framework',
        description: 'Institute revised inclusive hiring guidelines and roll out executive coaching program.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Compensation Band & Leveling Architecture Modernization',
        description: 'Publish modern salary bands benchmarked to 75th percentile market compensation.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day People Leadership Review & Annual OKRs',
        description: 'Present organizational health metrics, retention forecast, and annual People team budget.',
        category: 'role_training',
        dueDay: 90
      }
    ]
  },
  Finance: {
    Junior: [
      {
        milestoneId: 'M-03',
        title: 'Accounting Software & Expense Management Access',
        description: 'Configure NetSuite/QuickBooks, corporate card portal, and expense review software.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Finance Team Shadowing & Accounts Payable Walkthrough',
        description: 'Shadow senior accountant on invoice approvals and vendor onboarding workflows.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Monthly Ledger Reconciliation & Expense Audit',
        description: 'Complete bank reconciliation and audit corporate travel expenses for policy compliance.',
        category: 'role_training',
        dueDay: 25
      },
      {
        milestoneId: 'M-06',
        title: 'Month-End Close Participation & Reporting Assistance',
        description: 'Assist in preparing balance sheet schedules and accrual journal entries for monthly close.',
        category: 'role_training',
        dueDay: 50
      },
      {
        milestoneId: 'M-07',
        title: 'Independent Account Reconciliation & 90-Day Review',
        description: 'Reconcile key accounts independently and complete 90-day progress review with Controller.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Mid: [
      {
        milestoneId: 'M-03',
        title: 'ERP & Financial Modeling Workspace Setup',
        description: 'Access ERP, financial planning models, and banking treasury management systems.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Department Budget Owner Introductions',
        description: 'Meet department heads in Engineering and Marketing to review monthly budget pacing.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Departmental Budget Variance Analysis & Forecasting',
        description: 'Produce monthly variance report comparing actual expenditures against quarterly budget forecast.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Month-End Close Leadership & Audit Schedule Preparation',
        description: 'Lead close process for operating expenses and prepare schedules for external financial auditors.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: 'Financial Model Optimization & 90-Day Ramp Review',
        description: 'Automate department forecasting model and review 90-day performance with Head of Finance.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Senior: [
      {
        milestoneId: 'M-03',
        title: 'Corporate Treasury & Financial Systems Provisioning',
        description: 'Verify banking authorizations, cap table management access, and audit compliance controls.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Executive Finance & Legal Stakeholder Alignment',
        description: 'Meet CFO, General Counsel, and commercial leads to align on capital allocation priorities.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Corporate Financial Model & Multi-Year Projections',
        description: 'Refine long-term SaaS unit economics, runway projections, and gross margin optimization.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Quarterly Board Package Preparation & Tax Strategy',
        description: 'Draft financial slides for board meeting and review corporate R&D tax credit filings.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: 'Strategic Finance 90-Day Milestone & Capital Plan',
        description: 'Present cash management and capital expenditure strategy to senior executive team.',
        category: 'role_training',
        dueDay: 90
      }
    ],
    Lead: [
      {
        milestoneId: 'M-03',
        title: 'Financial Governance & Banking Systems Review',
        description: 'Review corporate credit facilities, insurance policies, and internal audit controls.',
        category: 'technical_setup',
        dueDay: 3
      },
      {
        milestoneId: 'M-04',
        title: 'Finance Team 1-on-1s & Executive Leadership Sync',
        description: 'Conduct 1-on-1s with finance team and align with CEO/COO on annual fiscal budget.',
        category: 'team_integration',
        dueDay: 10
      },
      {
        milestoneId: 'M-05',
        title: 'Annual Budget Architecture & Department Allocations',
        description: 'Finalize enterprise budget framework with clear revenue and operational efficiency targets.',
        category: 'role_training',
        dueDay: 30
      },
      {
        milestoneId: 'M-06',
        title: 'Audit Committee & Regulatory Compliance Review',
        description: 'Present clean interim audit report and lead review with corporate audit committee.',
        category: 'role_training',
        dueDay: 60
      },
      {
        milestoneId: 'M-07',
        title: '90-Day Fiscal Strategy & Long-Term Capital Structure',
        description: 'Deliver comprehensive fiscal outlook and debt/equity capital strategy to board.',
        category: 'role_training',
        dueDay: 90
      }
    ]
  }
};

/**
 * Normalizes level string to one of our 4 template keys: Junior, Mid, Senior, Lead.
 */
export function normalizeLevelKey(level: string): 'Junior' | 'Mid' | 'Senior' | 'Lead' {
  if (!level) return 'Junior';
  const lower = level.toLowerCase();
  if (lower.includes('junior') || lower.includes('intern') || lower.includes('entry') || lower.includes('associate')) {
    return 'Junior';
  }
  if (lower.includes('lead') || lower.includes('staff') || lower.includes('director') || lower.includes('principal') || lower.includes('vp')) {
    return 'Lead';
  }
  if (lower.includes('senior')) {
    return 'Senior';
  }
  return 'Mid';
}

/**
 * Generates deterministic fallback template milestones for any department and level.
 */
export function getDeterministicTemplateMilestones(
  department: string,
  level: string
): TemplateMilestoneDefinition[] {
  const normLevel = normalizeLevelKey(level);
  const deptTemplates = DEPARTMENT_LEVEL_TEMPLATES[department] || DEPARTMENT_LEVEL_TEMPLATES['Engineering'];
  const specificMilestones = deptTemplates[normLevel] || deptTemplates['Mid'];

  return [...BASE_COMPLIANCE_MILESTONES, ...specificMilestones];
}

// ============================================================================
// 2. DETERMINISTIC PROGRESS, VELOCITY & STATUS CALCULATIONS
// ============================================================================

export interface CalculatedPlanMetrics {
  overallProgress: number;
  velocityScore: number;
  status: OnboardingPlanStatus;
  overdueCount: number;
  completedCount: number;
  totalCount: number;
  daysSinceStart: number;
  overdueMilestones: Array<{
    milestoneId: string;
    title: string;
    category: MilestoneCategory;
    dueDay: number;
    daysOverdue: number;
    notes?: string;
  }>;
}

/**
 * Computes deterministic progress, velocity, and status for an onboarding plan.
 * Pure math with zero external side-effects.
 */
export function calculatePlanMetrics(
  plan: {
    startDate: Date;
    targetCompletionDate: Date;
    milestones: IOnboardingMilestone[];
  },
  referenceDate: Date = new Date()
): CalculatedPlanMetrics {
  const milestones = plan.milestones || [];
  const totalCount = milestones.length;

  if (totalCount === 0) {
    return {
      overallProgress: 0,
      velocityScore: 100,
      status: 'on_track',
      overdueCount: 0,
      completedCount: 0,
      totalCount: 0,
      daysSinceStart: 0,
      overdueMilestones: []
    };
  }

  const startMs = new Date(plan.startDate).getTime();
  const refMs = referenceDate.getTime();
  const elapsedDays = Math.max(0, Math.floor((refMs - startMs) / (1000 * 60 * 60 * 24)));

  let completedCount = 0;
  let milestonesDueByToday = 0;
  let completedDueByToday = 0;
  const overdueMilestones: CalculatedPlanMetrics['overdueMilestones'] = [];

  for (const m of milestones) {
    const isDueByToday = elapsedDays >= m.dueDay;
    if (isDueByToday) {
      milestonesDueByToday++;
    }

    if (m.completed) {
      completedCount++;
      if (isDueByToday) {
        completedDueByToday++;
      }
    } else {
      // Incomplete milestone
      if (isDueByToday) {
        const daysOverdue = Math.max(1, elapsedDays - m.dueDay);
        overdueMilestones.push({
          milestoneId: m.milestoneId,
          title: m.title,
          category: m.category,
          dueDay: m.dueDay,
          daysOverdue,
          notes: m.notes
        });
      }
    }
  }

  // 1. Overall Progress (0 - 100%)
  const overallProgress = Math.round((completedCount / totalCount) * 100);

  // 2. Velocity Score (0 - 100)
  // Transparent deterministic formula:
  // - If all milestones completed: 100
  // - If no milestones were due yet (e.g. Day 0, or future start): 100
  // - Otherwise: completedDueByToday / milestonesDueByToday * 100
  let velocityScore = 100;
  if (completedCount === totalCount) {
    velocityScore = 100;
  } else if (milestonesDueByToday > 0) {
    velocityScore = Math.min(100, Math.max(0, Math.round((completedDueByToday / milestonesDueByToday) * 100)));
  }

  // 3. Status determination:
  // - 'completed': all milestones complete
  // - 'delayed': any overdue milestone exists OR velocityScore < 70 when at least 1 milestone was due
  // - 'on_track': otherwise
  let status: OnboardingPlanStatus = 'on_track';
  if (completedCount === totalCount && totalCount > 0) {
    status = 'completed';
  } else if (overdueMilestones.length > 0 || (milestonesDueByToday > 0 && velocityScore < 70)) {
    status = 'delayed';
  } else {
    status = 'on_track';
  }

  return {
    overallProgress,
    velocityScore,
    status,
    overdueCount: overdueMilestones.length,
    completedCount,
    totalCount,
    daysSinceStart: elapsedDays,
    overdueMilestones
  };
}

// ============================================================================
// 3. DETERMINISTIC ADAPTIVE DIAGNOSIS (Offline / Fallback)
// ============================================================================

export interface AdaptiveInterventionDiagnosis {
  status: OnboardingPlanStatus;
  velocityScore: number;
  overallProgress: number;
  overdueCount: number;
  urgency: 'immediate' | 'short_term' | 'strategic';
  diagnosis: string;
  whyItMatters: string;
  suggestedAdjustments: Array<{
    title: string;
    rationale: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Produces structured diagnostic recommendations without requiring Gemini.
 */
export function calculateDeterministicDiagnosis(
  employee: {
    name: string;
    roleTitle: string;
    department: string;
    level: string;
  },
  metrics: CalculatedPlanMetrics
): AdaptiveInterventionDiagnosis {
  const adjustments: AdaptiveInterventionDiagnosis['suggestedAdjustments'] = [];

  let urgency: AdaptiveInterventionDiagnosis['urgency'] = 'strategic';
  let diagnosis = '';
  let whyItMatters = '';

  if (metrics.status === 'completed') {
    urgency = 'strategic';
    diagnosis = `${employee.name} has completed 100% of onboarding milestones across all categories. Onboarding velocity was sustained at ${metrics.velocityScore}/100.`;
    whyItMatters = `Full onboarding completion confirms baseline technical access, organizational compliance, and independent task delivery are established.`;
    adjustments.push({
      title: 'Formal Transition to Active Performance Review Cadence',
      rationale: 'Verify role transition in HRIS and establish quarterly OKRs with department manager.',
      priority: 'low'
    });
  } else if (metrics.status === 'delayed') {
    const overdueList = metrics.overdueMilestones.map((m) => `${m.title} (${m.daysOverdue}d overdue)`).join(', ');
    urgency = metrics.velocityScore < 50 || metrics.overdueCount >= 2 ? 'immediate' : 'short_term';
    diagnosis = `Pace delay detected for ${employee.name}: ${metrics.overdueCount} milestone(s) overdue [${overdueList}]. Current onboarding velocity is ${metrics.velocityScore}/100.`;
    whyItMatters = `Delays in early onboarding milestones correlate strongly with team frustration and first-90-day retention attrition if blockers are not resolved promptly.`;

    // Categorized adjustments based on what is delayed
    const hasTechnicalOverdue = metrics.overdueMilestones.some((m) => m.category === 'technical_setup' || m.category === 'compliance');
    const hasRoleOverdue = metrics.overdueMilestones.some((m) => m.category === 'role_training' || m.category === 'team_integration');

    if (hasTechnicalOverdue) {
      adjustments.push({
        title: 'Expedite IT Hardware & Tool Access Permissions',
        rationale: 'Review SSO provisioning, repository access, and local dev container blockers with IT operations.',
        priority: 'high'
      });
    }

    if (hasRoleOverdue) {
      adjustments.push({
        title: 'Structured Peer Mentorship & Pairing Reassignment',
        rationale: 'Schedule 2x weekly technical pairing sessions with designated buddy to unblock practical deliverables.',
        priority: 'high'
      });
    }

    adjustments.push({
      title: 'Milestone Due Date Recalibration',
      rationale: `Shift downstream role training target dates by ${metrics.overdueMilestones[0]?.daysOverdue || 5} business days to maintain realistic expectations without sacrificing quality.`,
      priority: 'medium'
    });
  } else {
    // on_track
    urgency = 'strategic';
    diagnosis = `${employee.name} is progressing smoothly on schedule at ${metrics.overallProgress}% completion. Velocity score is ${metrics.velocityScore}/100 with zero overdue milestones.`;
    whyItMatters = `Healthy onboarding cadence establishes early engagement, technical confidence, and cross-functional team alignment.`;
    adjustments.push({
      title: 'Schedule 30/60-Day Informal Pulse Check-in',
      rationale: 'Hold a 15-minute informal coffee chat to gather feedback on onboarding curriculum clarity.',
      priority: 'low'
    });
    adjustments.push({
      title: 'Preview Upcoming Role Training Deliverables',
      rationale: 'Align with direct manager on first substantial independent project scope.',
      priority: 'low'
    });
  }

  return {
    status: metrics.status,
    velocityScore: metrics.velocityScore,
    overallProgress: metrics.overallProgress,
    overdueCount: metrics.overdueCount,
    urgency,
    diagnosis,
    whyItMatters,
    suggestedAdjustments: adjustments
  };
}

// ============================================================================
// 4. ORCHESTRATION WORKFLOWS (CRUD, GENERATE, MILESTONE UPDATE, ADAPT)
// ============================================================================

/**
 * Retrieves all onboarding plans with optional filtering by department, status, or search query.
 */
export async function getOnboardingPlans(filter: {
  department?: string;
  status?: string;
  search?: string;
  limit?: number;
}) {
  await connectDB();

  const query: Record<string, any> = {};

  if (filter.status && filter.status !== 'all') {
    query.status = filter.status;
  }
  if (filter.department && filter.department !== 'all') {
    query.department = filter.department;
  }

  let plans = await OnboardingPlan.find(query)
    .populate({
      path: 'employeeId',
      select: 'name email employeeCode department roleTitle level status joiningDate location skills managerName'
    })
    .sort({ updatedAt: -1 })
    .limit(filter.limit || 100);

  // If search query is supplied, filter populated employees
  if (filter.search && filter.search.trim()) {
    const term = filter.search.trim().toLowerCase();
    plans = plans.filter((p: any) => {
      const emp = p.employeeId;
      if (!emp) return false;
      return (
        (emp.name && emp.name.toLowerCase().includes(term)) ||
        (emp.employeeCode && emp.employeeCode.toLowerCase().includes(term)) ||
        (emp.roleTitle && emp.roleTitle.toLowerCase().includes(term)) ||
        (p.mentorName && p.mentorName.toLowerCase().includes(term))
      );
    });
  }

  // Calculate summary metrics across all existing plans
  const allPlans = await OnboardingPlan.find({});
  let totalActive = 0;
  let onTrackCount = 0;
  let delayedCount = 0;
  let completedCount = 0;
  let totalProgressSum = 0;
  let totalVelocitySum = 0;

  for (const p of allPlans) {
    if (p.status === 'completed') {
      completedCount++;
    } else {
      totalActive++;
      if (p.status === 'on_track') onTrackCount++;
      if (p.status === 'delayed') delayedCount++;
    }
    totalProgressSum += p.overallProgress || 0;
    totalVelocitySum += typeof p.velocityScore === 'number' ? p.velocityScore : 100;
  }

  const totalAll = allPlans.length;
  const onTrackPct = totalActive > 0 ? Math.round((onTrackCount / totalActive) * 100) : 100;
  const avgCompletionPct = totalAll > 0 ? Math.round(totalProgressSum / totalAll) : 0;
  const avgVelocityScore = totalAll > 0 ? Math.round(totalVelocitySum / totalAll) : 100;

  return {
    plans,
    summary: {
      totalPlans: totalAll,
      totalActiveOnboarding: totalActive,
      onTrackCount,
      onTrackPct,
      delayedCount,
      completedCount,
      avgCompletionPct,
      avgVelocityScore
    }
  };
}

/**
 * Retrieves a single onboarding plan by plan ID or employee ID.
 */
export async function getOnboardingPlanById(id: string) {
  await connectDB();

  let plan = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    plan = await OnboardingPlan.findById(id).populate({
      path: 'employeeId',
      select: 'name email employeeCode department roleTitle level status joiningDate location skills managerName performanceRating flightRiskLevel'
    });

    if (!plan) {
      // Check if ID is employeeId
      plan = await OnboardingPlan.findOne({ employeeId: id }).populate({
        path: 'employeeId',
        select: 'name email employeeCode department roleTitle level status joiningDate location skills managerName performanceRating flightRiskLevel'
      });
    }
  }

  return plan;
}

/**
 * Generates and persists an adaptive onboarding plan for an employee.
 * Enforces: employee exists, no duplicate plan, verified policy references.
 */
export async function generateAndSaveOnboardingPlan(
  employeeId: string,
  options: {
    mentorName?: string;
    startDate?: Date;
    useAi?: boolean;
    currentUserId?: string;
  } = {}
): Promise<IOnboardingPlan> {
  await connectDB();

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new Error(`Employee with ID '${employeeId}' not found.`);
  }

  // Prevent duplicate plan
  const existingPlan = await OnboardingPlan.findOne({ employeeId: employee._id });
  if (existingPlan) {
    throw new Error(`An onboarding plan already exists for employee ${employee.name} (${employee.employeeCode}).`);
  }

  const startDate = options.startDate ? new Date(options.startDate) : new Date(employee.joiningDate || Date.now());
  const targetCompletionDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Retrieve corporate policies for compliance grounding
  const activePolicies = await PolicyDocument.find({ status: 'active' }).select('policyCode title category');
  const policyList = activePolicies.map((p) => ({
    policyCode: p.policyCode,
    title: p.title,
    category: p.category
  }));

  // Generate deterministic baseline templates
  const fallbackMilestones = getDeterministicTemplateMilestones(employee.department, employee.level);

  let planMilestones: IOnboardingMilestone[] = [];
  let aiGuidanceNotes = `Standard onboarding plan tailored for ${employee.department} (${employee.level} level).`;

  if (options.useAi !== false) {
    try {
      const aiPlan = await generateAdaptiveOnboardingPlan(
        {
          name: employee.name,
          roleTitle: employee.roleTitle,
          department: employee.department,
          level: employee.level,
          skills: employee.skills,
          managerName: employee.managerName,
          location: employee.location
        },
        policyList,
        fallbackMilestones
      );

      aiGuidanceNotes = aiPlan.aiGuidanceNotes;
      planMilestones = aiPlan.milestones.map((m) => {
        const targetDate = new Date(startDate.getTime() + m.dueDay * 24 * 60 * 60 * 1000);
        return {
          milestoneId: m.milestoneId,
          title: m.title,
          description: m.description,
          category: m.category,
          dueDay: m.dueDay,
          completed: false,
          targetDate,
          resourceLink: m.resourceLink,
          status: 'pending' as MilestoneStatus
        };
      });
    } catch (err) {
      console.warn('AI adaptive plan generation failed, falling back to deterministic template:', err);
    }
  }

  // If AI generation was skipped or returned empty, use deterministic templates
  if (planMilestones.length === 0) {
    planMilestones = fallbackMilestones.map((m) => {
      const targetDate = new Date(startDate.getTime() + m.dueDay * 24 * 60 * 60 * 1000);
      return {
        milestoneId: m.milestoneId,
        title: m.title,
        description: m.description,
        category: m.category,
        dueDay: m.dueDay,
        completed: false,
        targetDate,
        resourceLink: m.resourceLink,
        status: 'pending' as MilestoneStatus
      };
    });
  }

  // Create standard 30/60/90 checkpoints
  const checkpoints: IOnboardingCheckpoint[] = [
    { day: 30, completed: false, notes: '30-day initial ramp and integration check' },
    { day: 60, completed: false, notes: '60-day independent milestone review' },
    { day: 90, completed: false, notes: '90-day full autonomy ramp presentation' }
  ];

  // Calculate initial metrics
  const initialMetrics = calculatePlanMetrics({
    startDate,
    targetCompletionDate,
    milestones: planMilestones
  });

  const createdPlan = await OnboardingPlan.create({
    employeeId: employee._id,
    roleTitle: employee.roleTitle,
    department: employee.department,
    mentorName: options.mentorName || employee.managerName || 'Assigned Department Buddy',
    startDate,
    targetCompletionDate,
    overallProgress: initialMetrics.overallProgress,
    status: initialMetrics.status,
    velocityScore: initialMetrics.velocityScore,
    milestones: planMilestones,
    aiGuidanceNotes,
    adaptationHistory: [
      {
        adaptedAt: new Date(),
        trigger: 'manual',
        reason: 'Initial plan initialization and departmental milestone roadmap synthesis.',
        suggestedAdjustments: ['Review schedule with employee on Day 1 orientation.'],
        appliedBy: options.currentUserId || 'HR System'
      }
    ],
    checkpoints
  });

  // Ensure employee status reflects 'onboarding'
  if (employee.status !== 'onboarding' && employee.status !== 'probation') {
    employee.status = 'onboarding';
    await employee.save();
  }

  // Log user activity
  await recordActivity(
    employee.userId || employee._id,
    'Profile Updated',
    `Adaptive onboarding plan created with ${planMilestones.length} milestones.`,
    { planId: createdPlan._id, employeeId: employee._id }
  );

  return createdPlan;
}

/**
 * Toggles milestone completion state, recalculates deterministic metrics,
 * writes telemetry signals to EmployeeSignal, and transitions Employee.status if complete.
 */
export async function updateMilestoneState(
  planId: string,
  milestoneId: string,
  updates: {
    completed: boolean;
    notes?: string;
    verifiedBy?: string;
    currentUserId?: string;
  }
): Promise<{ plan: IOnboardingPlan; metrics: CalculatedPlanMetrics }> {
  await connectDB();

  const plan = await OnboardingPlan.findById(planId);
  if (!plan) {
    throw new Error(`Onboarding plan with ID '${planId}' not found.`);
  }

  const milestone = plan.milestones.find((m) => m.milestoneId === milestoneId);
  if (!milestone) {
    throw new Error(`Milestone '${milestoneId}' not found in onboarding plan.`);
  }

  // Update milestone fields
  milestone.completed = Boolean(updates.completed);
  if (milestone.completed) {
    milestone.completedAt = new Date();
    milestone.status = 'completed';
    if (updates.verifiedBy) milestone.verifiedBy = updates.verifiedBy;
  } else {
    milestone.completedAt = undefined;
    milestone.verifiedBy = undefined;
  }

  if (typeof updates.notes === 'string') {
    milestone.notes = updates.notes;
  }

  // Recalculate deterministic metrics
  const now = new Date();
  const metrics = calculatePlanMetrics(plan, now);

  // Update milestone individual statuses for incomplete items
  for (const m of plan.milestones) {
    if (m.completed) {
      m.status = 'completed';
    } else {
      const elapsedDays = Math.max(0, Math.floor((now.getTime() - new Date(plan.startDate).getTime()) / (1000 * 60 * 60 * 24)));
      if (elapsedDays > m.dueDay) {
        m.status = 'overdue';
      } else if (elapsedDays >= Math.max(0, m.dueDay - 7)) {
        m.status = 'in_progress';
      } else {
        m.status = 'pending';
      }
    }
  }

  // Check 30/60/90 checkpoint auto-completion
  if (plan.checkpoints && plan.checkpoints.length > 0) {
    for (const cp of plan.checkpoints) {
      const elapsedDays = metrics.daysSinceStart;
      if (elapsedDays >= cp.day && !cp.completed) {
        // Mark checkpoint reached
        if (metrics.velocityScore >= 75) {
          cp.completed = true;
          cp.completedAt = new Date();
        }
      }
    }
  }

  const previousStatus = plan.status;

  // Persist updated metrics to plan
  plan.overallProgress = metrics.overallProgress;
  plan.velocityScore = metrics.velocityScore;
  plan.status = metrics.status;
  await plan.save();

  // 1. Emit EmployeeSignal telemetry
  const currentPeriod = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  await Promise.all([
    EmployeeSignal.create({
      employeeId: plan.employeeId,
      type: 'engagement',
      metric: 'onboarding_milestone_completion_rate',
      value: metrics.overallProgress,
      unit: '%',
      period: currentPeriod,
      benchmark: 70,
      deviationPct: metrics.overallProgress - 70,
      recordedAt: now,
      notes: `Updated on milestone ${milestoneId} (${updates.completed ? 'completed' : 'reopened'}).`
    }),
    EmployeeSignal.create({
      employeeId: plan.employeeId,
      type: 'performance',
      metric: 'onboarding_velocity_pct',
      value: metrics.velocityScore,
      unit: '%',
      period: currentPeriod,
      benchmark: 100,
      deviationPct: metrics.velocityScore - 100,
      recordedAt: now,
      notes: `Deterministic velocity index: ${metrics.velocityScore}/100.`
    }),
    EmployeeSignal.create({
      employeeId: plan.employeeId,
      type: 'performance',
      metric: 'onboarding_delay_days',
      value: metrics.overdueMilestones.reduce((acc, curr) => acc + curr.daysOverdue, 0),
      unit: 'days',
      period: currentPeriod,
      benchmark: 0,
      deviationPct: metrics.overdueCount > 0 ? metrics.overdueCount * 10 : 0,
      recordedAt: now,
      notes: `${metrics.overdueCount} overdue milestones.`
    })
  ]);

  // 2. Employee status transition (onboarding -> active upon 100% completion)
  const employee = await Employee.findById(plan.employeeId);
  if (employee) {
    if (metrics.overallProgress === 100 && employee.status === 'onboarding') {
      employee.status = 'active';
      await employee.save();

      // Log transition activity
      await recordActivity(
        employee.userId || employee._id,
        'Profile Updated',
        `Employee onboarding completed 100%. Status transitioned to active.`,
        { employeeId: employee._id, planId: plan._id }
      );
    }
  }

  // 3. Dispatch meaningful notifications (avoiding duplicate spam)
  if (employee && employee.userId) {
    if (metrics.status === 'delayed' && previousStatus !== 'delayed') {
      // Check recent notification to prevent duplicate spam within last 24h
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingNotif = await Notification.findOne({
        userId: employee.userId,
        title: 'Onboarding Schedule Delayed',
        createdAt: { $gte: dayAgo }
      });

      if (!existingNotif) {
        await Notification.create({
          userId: employee.userId,
          title: 'Onboarding Schedule Delayed',
          message: `Your onboarding plan has ${metrics.overdueCount} overdue milestone(s). Please review progress with your mentor ${plan.mentorName || 'lead'}.`,
          read: false
        });
      }
    } else if (metrics.overallProgress === 100 && previousStatus !== 'completed') {
      await Notification.create({
        userId: employee.userId,
        title: 'Onboarding Completed!',
        message: `Congratulations! All onboarding milestones for ${plan.roleTitle} have been successfully verified.`,
        read: false
      });
    }
  }

  // Log activity
  await recordActivity(
    updates.currentUserId || plan.employeeId,
    'Profile Updated',
    `Milestone ${milestoneId} marked as ${updates.completed ? 'completed' : 'incomplete'}.`,
    { planId: plan._id, milestoneId, completed: updates.completed }
  );

  return { plan, metrics };
}

/**
 * Triggers an adaptive onboarding diagnosis.
 * Combines deterministic analysis with Gemini velocity synthesis,
 * appends to adaptation history, and updates aiGuidanceNotes.
 */
export async function runAdaptiveOnboardingCheck(
  planId: string,
  options: {
    appliedBy?: string;
    useAi?: boolean;
  } = {}
): Promise<{
  plan: IOnboardingPlan;
  diagnosis: AdaptiveInterventionDiagnosis;
  usedGemini: boolean;
}> {
  await connectDB();

  const plan = await OnboardingPlan.findById(planId).populate({
    path: 'employeeId',
    select: 'name email employeeCode department roleTitle level location skills managerName'
  });

  if (!plan) {
    throw new Error(`Onboarding plan with ID '${planId}' not found.`);
  }

  const employee = plan.employeeId as any;
  if (!employee) {
    throw new Error('Associated employee record not found.');
  }

  // 1. Deterministic baseline analysis
  const metrics = calculatePlanMetrics(plan, new Date());
  const deterministicDiagnosis = calculateDeterministicDiagnosis(
    {
      name: employee.name,
      roleTitle: employee.roleTitle,
      department: employee.department,
      level: employee.level
    },
    metrics
  );

  let finalDiagnosis = deterministicDiagnosis;
  let usedGemini = false;

  // 2. Call Gemini for contextual synthesis if enabled
  if (options.useAi !== false) {
    try {
      const geminiResult = await analyzeOnboardingVelocityAndAdapt(
        {
          name: employee.name,
          roleTitle: employee.roleTitle,
          department: employee.department,
          level: employee.level
        },
        {
          overallProgress: metrics.overallProgress,
          velocityScore: metrics.velocityScore,
          status: metrics.status,
          daysSinceStart: metrics.daysSinceStart,
          overdueMilestones: metrics.overdueMilestones,
          completedMilestonesCount: metrics.completedCount,
          totalMilestonesCount: metrics.totalCount
        },
        {
          diagnosis: deterministicDiagnosis.diagnosis,
          whyItMatters: deterministicDiagnosis.whyItMatters,
          suggestedAdjustments: deterministicDiagnosis.suggestedAdjustments
        }
      );

      finalDiagnosis = {
        status: metrics.status,
        velocityScore: metrics.velocityScore,
        overallProgress: metrics.overallProgress,
        overdueCount: metrics.overdueCount,
        urgency: deterministicDiagnosis.urgency,
        diagnosis: geminiResult.diagnosis || deterministicDiagnosis.diagnosis,
        whyItMatters: geminiResult.whyItMatters || deterministicDiagnosis.whyItMatters,
        suggestedAdjustments: geminiResult.suggestedAdjustments || deterministicDiagnosis.suggestedAdjustments
      };

      usedGemini = Boolean(process.env.GEMINI_API_KEY);
    } catch (err) {
      console.warn('Gemini adaptive analysis failed, using deterministic diagnosis:', err);
    }
  }

  // 3. Record adaptation history
  const adaptationRecord: IAdaptationRecord = {
    adaptedAt: new Date(),
    trigger: metrics.status === 'delayed' ? 'delay_escalation' : 'ai_velocity_check',
    reason: finalDiagnosis.diagnosis,
    suggestedAdjustments: finalDiagnosis.suggestedAdjustments.map((a) => `${a.title}: ${a.rationale}`),
    appliedBy: options.appliedBy || 'HR AI Specialist'
  };

  if (!plan.adaptationHistory) plan.adaptationHistory = [];
  plan.adaptationHistory.unshift(adaptationRecord);

  // Keep max 15 adaptation history records
  if (plan.adaptationHistory.length > 15) {
    plan.adaptationHistory = plan.adaptationHistory.slice(0, 15);
  }

  // Update AI guidance notes
  plan.aiGuidanceNotes = `${finalDiagnosis.diagnosis} ${finalDiagnosis.whyItMatters}`;
  plan.velocityScore = metrics.velocityScore;
  plan.status = metrics.status;
  await plan.save();

  // Log activity
  await recordActivity(
    employee.userId || employee._id,
    'Profile Updated',
    `Adaptive onboarding diagnosis completed (${finalDiagnosis.status.toUpperCase()}).`,
    { planId: plan._id, velocityScore: metrics.velocityScore }
  );

  return {
    plan,
    diagnosis: finalDiagnosis,
    usedGemini
  };
}
