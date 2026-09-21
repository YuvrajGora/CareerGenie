import { NextResponse } from 'next/server';
import User from '@/models/User';
import Resume from '@/models/Resume';
import ResumeVersion from '@/models/ResumeVersion';
import Application from '@/models/Application';
import SavedJob from '@/models/SavedJob';
import Notification from '@/models/Notification';
import JobMatch from '@/models/JobMatch';
import CoverLetter from '@/models/CoverLetter';
import InterviewPrep from '@/models/InterviewPrep';
import DashboardRecommendation from '@/models/DashboardRecommendation';
import UserActivity from '@/models/UserActivity';
import Job from '@/models/Job';
import { updateProfileSchema, changePasswordSchema } from '@/validations/validation';
import { recordActivity } from '@/services/activity';

export async function updateProfile(req: any) {
  try {
    const user = req.user; // populated by auth middleware
    const body = await req.json();

    // Validate request body
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { name, skills, education, profileImage } = validation.data;

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (skills !== undefined) updateData.skills = skills;
    if (education !== undefined) updateData.education = education;
    if (profileImage !== undefined) updateData.profileImage = profileImage;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true }
    );

    await recordActivity(user._id, 'Profile Updated', 'Updated profile information.');

    return NextResponse.json({
      message: 'Profile updated successfully.',
      user: updatedUser
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error while updating profile.' }, { status: 500 });
  }
}

export async function changePassword(req: any) {
  try {
    const user = req.user;
    const body = await req.json();

    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const { currentPassword, newPassword } = validation.data;

    // Query user with password selected
    const dbUser = await User.findById(user._id).select('+password');
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isMatch = await dbUser.comparePassword(currentPassword);
    if (!isMatch) {
      return NextResponse.json({ error: 'Incorrect current password.' }, { status: 400 });
    }

    // Assign new password; User pre('save') hook handles bcrypt hashing
    dbUser.password = newPassword;
    await dbUser.save();

    await recordActivity(user._id, 'Password Changed', 'User changed their password.');

    return NextResponse.json({
      message: 'Password changed successfully.',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error while changing password.' }, { status: 500 });
  }
}

export async function deleteOwnAccount(req: any) {
  try {
    const userId = req.user._id;

    // Cascade delete associated candidate and activity data
    await Promise.allSettled([
      Resume.deleteMany({ userId }),
      ResumeVersion.deleteMany({ userId }),
      Application.deleteMany({ studentId: userId }),
      SavedJob.deleteMany({ studentId: userId }),
      Notification.deleteMany({ userId }),
      JobMatch.deleteMany({ studentId: userId }),
      CoverLetter.deleteMany({ userId }),
      InterviewPrep.deleteMany({ userId }),
      DashboardRecommendation.deleteMany({ userId }),
      UserActivity.deleteMany({ userId }),
      Job.deleteMany({ recruiterId: userId }),
    ]);

    await User.findByIdAndDelete(userId);

    return NextResponse.json({
      message: 'Account and associated records deleted successfully.',
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Internal server error while deleting account.' }, { status: 500 });
  }
}
