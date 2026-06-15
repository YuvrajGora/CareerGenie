import { NextResponse } from 'next/server';
import User from '@/models/User';
import { updateProfileSchema } from '@/validations/validation';
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
