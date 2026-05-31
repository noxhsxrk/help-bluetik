import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';

export async function GET() {
  const cookieStore = await cookies();
  const userIdCookie = cookieStore.get('tb_session_user_id');

  if (!userIdCookie) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const user = await DB.getUserById(userIdCookie.value);
  if (!user) {
    cookieStore.delete('tb_session_user_id');
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({ authenticated: true, user });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('tb_session_user_id');
  return NextResponse.json({ success: true });
}
