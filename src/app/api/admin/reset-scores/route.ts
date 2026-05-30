import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';

async function checkAdmin() {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('tb_admin_session');
  if (adminSession?.value !== 'authenticated') return null;
  return { id: 'admin', role: 'admin' };
}

// POST: Reset all users' help scores to 0 and clear interactions
export async function POST() {
  try {
    const adminUser = await checkAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await DB.resetAllScores();
    return NextResponse.json({ success: true, message: 'คะแนนสะสมและประวัติการช่วยเหลือทั้งหมดถูกล้างเป็น 0 เรียบร้อยแล้ว' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
