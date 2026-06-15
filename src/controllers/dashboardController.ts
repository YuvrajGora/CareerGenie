import { NextResponse } from 'next/server';
import Resume from '@/models/Resume';
import ResumeAnalysis from '@/models/ResumeAnalysis';
import UserActivity from '@/models/UserActivity';
import Application from '@/models/Application';
import Job from '@/models/Job';
import JobMatch from '@/models/JobMatch';
import { generateDashboardRecommendations } from '@/services/gemini';
import DashboardRecommendation from '@/models/DashboardRecommendation';


function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function getDashboardData(req: any) {
  try {
    const user = req.user;
    const userId = user._id;

    // 1. Retrieve resume and analysis details
    const resume = await Resume.findOne({ userId });
    const latestAnalysis = resume ? await ResumeAnalysis.findOne({ resumeId: resume._id }) : null;
    const resumeScore = latestAnalysis ? latestAnalysis.overallScore : null;
    const atsScore = latestAnalysis ? latestAnalysis.atsScore : null;

    // 2. Fetch UserActivity logs for Resume Analyzed
    const resumeActivities = await UserActivity.find({
      userId,
      activityType: 'Resume Analyzed'
    }).sort({ createdAt: -1 });

    // Calculate Resume ATS Score Improvement trend
    let resumeTrend = '+0%';
    if (resumeActivities.length > 1) {
      const currentATS = resumeActivities[0]?.metadata?.atsScore || atsScore || 0;
      const previousATS = resumeActivities[1]?.metadata?.atsScore || 0;
      const diff = currentATS - previousATS;
      resumeTrend = diff >= 0 ? `+${diff}%` : `${diff}%`;
    }

    // 3. Fetch Job Matches and calculate average match score + job match trend
    const jobMatches = await JobMatch.find({ studentId: userId }).populate('jobId');
    const currentAvgMatchScore = jobMatches.length > 0
      ? Math.round(jobMatches.reduce((acc, m) => acc + m.matchScore, 0) / jobMatches.length)
      : 0;

    let jobMatchTrend = '+0%';
    if (resumeActivities.length > 1) {
      const previousAvgMatchScore = resumeActivities[1]?.metadata?.avgMatchScore || 0;
      const diff = currentAvgMatchScore - previousAvgMatchScore;
      jobMatchTrend = diff >= 0 ? `+${diff}%` : `${diff}%`;
    }

    // 4. Fetch Job Applications count & growth
    const applications = await Application.find({ studentId: userId });
    const totalAppsCount = applications.length;
    const pendingApps = applications.filter(a => ['applied', 'interviewing'].includes(a.status)).length;
    const acceptedApps = applications.filter(a => a.status === 'accepted').length;
    const rejectedApps = applications.filter(a => a.status === 'rejected').length;

    // Application growth trend over last 7 days vs previous 7 days
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekCount = await Application.countDocuments({
      studentId: userId,
      createdAt: { $gte: oneWeekAgo }
    });

    const lastWeekCount = await Application.countDocuments({
      studentId: userId,
      createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo }
    });

    const appGrowth = thisWeekCount - lastWeekCount;
    const appGrowthTrend = appGrowth >= 0 ? `+${appGrowth} this week` : `${appGrowth} this week`;

    // 5. Calculate Weighted Interview Chances
    let interviewChances = 'Low';
    let interviewSubtext = 'Upload a resume to analyze interview chances';

    if (resume) {
      const effectiveAtsScore = atsScore !== null ? atsScore : 50;
      const effectiveAvgMatch = jobMatches.length > 0 ? currentAvgMatchScore : 50;
      
      // Calculate application success rate (20% weight)
      let successRate = 50;
      const totalDecided = acceptedApps + rejectedApps;
      if (totalDecided > 0) {
        successRate = (acceptedApps / totalDecided) * 100;
      }
      
      const weightedScore = (effectiveAtsScore * 0.4) + (effectiveAvgMatch * 0.4) + (successRate * 0.2);
      
      if (weightedScore >= 75) {
        interviewChances = 'High';
        interviewSubtext = 'Top 10% of candidates';
      } else if (weightedScore >= 50) {
        interviewChances = 'Medium';
        interviewSubtext = 'Strong compatibility metrics';
      } else {
        interviewChances = 'Low';
        interviewSubtext = 'Optimize resume or apply to matching roles';
      }
    }

    // 6. Fetch AI recommendations (cache-first: 24h cache lifetime)
    let recommendations = null;
    const cachedRecommendation = await DashboardRecommendation.findOne({ userId });
    const cacheExpiryLimit = 24 * 60 * 60 * 1000; // 24 hours
    
    if (cachedRecommendation && (now.getTime() - cachedRecommendation.generatedAt.getTime() < cacheExpiryLimit)) {
      recommendations = {
        title: cachedRecommendation.title,
        text: cachedRecommendation.text,
        skills: cachedRecommendation.skills
      };
    } else {
      recommendations = await generateDashboardRecommendations(
        user.skills || [],
        latestAnalysis?.missingSkills || [],
        jobMatches
      );
      
      await DashboardRecommendation.findOneAndUpdate(
        { userId },
        {
          title: recommendations.title,
          text: recommendations.text,
          skills: recommendations.skills,
          generatedAt: new Date()
        },
        { new: true, upsert: true }
      );
    }


    // 7. Recent activity list
    const rawActivities = await UserActivity.find({ userId }).sort({ createdAt: -1 }).limit(10);
    const activitiesList = rawActivities.map(act => ({
      _id: act._id,
      type: act.activityType,
      description: act.details || '',
      timestampLabel: getRelativeTime(act.createdAt)
    }));

    // 8. Dynamic Market Insights
    const recentJobs = await Job.find({}).sort({ createdAt: -1 }).limit(20);
    const skillCounts: Record<string, number> = {};
    recentJobs.forEach(job => {
      if (Array.isArray(job.requiredSkills)) {
        job.requiredSkills.forEach(skill => {
          const s = skill.trim();
          if (s) {
            skillCounts[s] = (skillCounts[s] || 0) + 1;
          }
        });
      }
    });

    let topSkill = 'TypeScript';
    let topSkillCount = 0;
    Object.entries(skillCounts).forEach(([skill, count]) => {
      if (count > topSkillCount) {
        topSkill = skill;
        topSkillCount = count;
      }
    });

    const titleCounts: Record<string, number> = {};
    recentJobs.forEach(job => {
      if (job.title) {
        const t = job.title.toLowerCase();
        if (t.includes('devops') || t.includes('cloud') || t.includes('infrastructure')) {
          titleCounts['DevOps'] = (titleCounts['DevOps'] || 0) + 1;
        } else if (t.includes('frontend') || t.includes('react')) {
          titleCounts['Frontend'] = (titleCounts['Frontend'] || 0) + 1;
        } else if (t.includes('backend') || t.includes('node')) {
          titleCounts['Backend'] = (titleCounts['Backend'] || 0) + 1;
        }
      }
    });

    let trendingRole = 'DevOps';
    let trendingRoleText = 'DevOps roles have seen a 25% spike in student hires this month.';
    if (titleCounts['Frontend'] && titleCounts['Frontend'] > (titleCounts['DevOps'] || 0)) {
      trendingRoleText = 'Frontend Developer roles have seen a 30% spike in employer interest this month.';
    } else if (titleCounts['Backend'] && titleCounts['Backend'] > (titleCounts['DevOps'] || 0)) {
      trendingRoleText = 'Backend Engineer roles have seen a 20% growth in listings this month.';
    }

    const marketInsights = [
      {
        title: 'Trending Roles',
        badge: 'Hot',
        text: trendingRoleText
      },
      {
        title: 'In-Demand Skills',
        text: `${topSkill} is highly requested in ${topSkillCount} recent postings.`
      }
    ];

    // 9. Prepare job recommendations for UI
    const recommendedJobs = jobMatches.map(m => {
      const job = m.jobId as any;
      if (!job) return null;
      return {
        _id: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        requiredSkills: job.requiredSkills || [],
        logoUrl: job.logoUrl,
        matchScore: m.matchScore
      };
    }).filter(Boolean);

    return NextResponse.json({
      metrics: {
        resumeScore: resumeScore !== null ? resumeScore : 'N/A',
        resumeTrend,
        jobsMatched: jobMatches.length,
        jobMatchTrend,
        applicationsCount: totalAppsCount,
        pendingApps,
        rejectedApps,
        appGrowthTrend,
        interviewChances,
        interviewSubtext
      },
      activities: activitiesList,
      recommendations,
      marketInsights,
      jobs: recommendedJobs
    });

  } catch (error: any) {
    console.error('Error fetching dashboard aggregation data:', error);
    return NextResponse.json({ error: 'Internal server error while fetching dashboard data.' }, { status: 500 });
  }
}
