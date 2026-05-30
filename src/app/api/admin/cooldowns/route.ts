import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('tb_session_user_id');

    if (!userIdCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await DB.getUserById(userIdCookie.value);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await DB.resetCooldowns();
    return NextResponse.json({ success: true, message: 'Cooldowns successfully cleared' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
