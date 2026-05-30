import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';

// GET: Return list of members for leaderboard (requires valid user session)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('tb_session_user_id');
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allUsers = await DB.getUsers();
    // Only expose members and admins for leaderboard — not pending users
    const users = allUsers
      .filter(u => u.role === 'member' || u.role === 'admin')
      .map(u => ({
        id: u.id,
        x_username: u.x_username,
        x_name: u.x_name,
        role: u.role,
        avatar: u.avatar,
        bio: u.bio,
        help_score: u.help_score
      }));

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
