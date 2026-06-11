import { NextResponse } from 'next/server';
import User from '@/models/User';
import Job from '@/models/Job';
import Application from '@/models/Application';

export async function getSystemMetrics(req: any) {
  try {
    // Count users by role
    const studentCount = await User.countDocuments({ role: 'student' });
    const recruiterCount = await User.countDocuments({ role: 'recruiter' });
    const adminCount = await User.countDocuments({ role: 'admin' });

    // Count jobs by status
    const activeJobs = await Job.countDocuments({ status: 'active' });
    const closedJobs = await Job.countDocuments({ status: 'closed' });

    // Application counts
    const totalApplications = await Application.countDocuments();

    // Calculate average match score via aggregation
    const avgScoreAggregation = await Application.aggregate([
      {
        $group: {
          _id: null,
          avgMatchScore: { $avg: '$matchScore' }
        }
      }
    ]);

    const averageMatchScore = avgScoreAggregation.length > 0 
      ? Math.round(avgScoreAggregation[0].avgMatchScore) 
      : 0;

    return NextResponse.json({
      metrics: {
        users: {
          student: studentCount,
          recruiter: recruiterCount,
          admin: adminCount,
          total: studentCount + recruiterCount + adminCount
        },
        jobs: {
          active: activeJobs,
          closed: closedJobs,
          total: activeJobs + closedJobs
        },
        applications: {
          total: totalApplications,
          averageMatchScore
        }
      }
    });
  } catch (error: any) {
    console.error('Get system metrics error:', error);
    return NextResponse.json({ error: 'Internal server error calculating metrics.' }, { status: 500 });
  }
}

export async function getUsers(req: any) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || '';

    const filter: any = {};
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter).sort({ createdAt: -1 });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Admin get users error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving users.' }, { status: 500 });
  }
}

export async function deleteUser(req: any, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Prevent administrative self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden. You cannot delete your own admin account.' }, { status: 400 });
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({
      message: 'User account deleted successfully.'
    });
  } catch (error: any) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ error: 'Internal server error while deleting user.' }, { status: 500 });
  }
}
