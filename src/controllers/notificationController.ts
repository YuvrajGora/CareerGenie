import { NextResponse } from 'next/server';
import Notification from '@/models/Notification';

export async function getNotifications(req: any) {
  try {
    const user = req.user;

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 });

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Internal server error retrieving notifications.' }, { status: 500 });
  }
}

export async function markRead(req: any, { params }: { params?: { id?: string } } = {}) {
  try {
    const user = req.user;
    const notificationId = params?.id;

    if (notificationId) {
      const updated = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: user._id },
        { $set: { read: true } },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Notification marked as read.', notification: updated });
    } else {
      // Mark all as read
      await Notification.updateMany(
        { userId: user._id, read: false },
        { $set: { read: true } }
      );
      return NextResponse.json({ message: 'All notifications marked as read.' });
    }
  } catch (error: any) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Internal server error updating notification.' }, { status: 500 });
  }
}
