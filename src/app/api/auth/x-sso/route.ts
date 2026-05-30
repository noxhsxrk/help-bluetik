import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { username, email, xUsername, xName, bio } = await request.json();

    // Mode 1: Free Google SSO Simulator
    if (email) {
      const cleanEmail = email.trim();
      let user = await DB.getUserByEmail(cleanEmail);

      if (!user) {
        // Register a new free SSO user (X username is empty, role starts as pending for onboarding)
        user = await DB.createUser({
          x_username: '',
          x_name: '',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail.split('@')[0]}`,
          bio: '',
          role: 'pending',
          google_email: cleanEmail
        });
      }

      const cookieStore = await cookies();
      cookieStore.set('tb_session_user_id', user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 days session
      });

      return NextResponse.json({ success: true, user });
    }

    // Mode 2: Link X Username during Onboarding Form submit
    if (xUsername) {
      const cookieStore = await cookies();
      const userIdCookie = cookieStore.get('tb_session_user_id');
      if (!userIdCookie) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const updatedUser = await DB.updateXUsername(userIdCookie.value, xUsername, xName, bio);
      if (!updatedUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, user: updatedUser });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
