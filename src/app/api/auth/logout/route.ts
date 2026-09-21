import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { logout } from '@/controllers/authController';

export async function POST(req: NextRequest) {
  await dbConnect();
  return logout(req);
}
