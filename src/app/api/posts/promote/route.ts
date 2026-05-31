import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';
import { POINTS_TO_PROMOTE } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('tb_session_user_id');

    if (!userIdCookie) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต (กรุณาลงชื่อเข้าใช้งาน)' }, { status: 401 });
    }

    const userId = userIdCookie.value;
    const user = await DB.getUserById(userId);

    if (!user || user.role === 'pending') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง (บัญชีอยู่ระหว่างการตรวจสอบ)' }, { status: 403 });
    }

    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสโพสต์' }, { status: 400 });
    }

    // ดึงโพสต์ทั้งหมดที่ยังคงทำงานอยู่เพื่อตรวจสอบความถูกต้องและรองรับ mock fallback
    const activePosts = await DB.getActivePosts();
    const post = activePosts.find(p => p.id === postId);

    if (!post) {
      return NextResponse.json({ error: 'ไม่พบโพสต์ที่ต้องการโปรโมต หรือโพสต์หมดอายุการใช้งานแล้ว' }, { status: 404 });
    }

    // ตรวจสอบความเป็นเจ้าของโพสต์
    if (post.user_id !== userId) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลโพสต์ของสมาชิกท่านอื่น' }, { status: 403 });
    }

    // ตรวจสอบว่าได้รับการโปรโมตไปแล้วหรือไม่
    if (post.is_promoted) {
      return NextResponse.json({ error: 'โพสต์นี้ได้รับการโปรโมตแล้ว' }, { status: 400 });
    }

    // ตรวจสอบคะแนนช่วยเหลือ
    if (user.help_score < POINTS_TO_PROMOTE) {
      return NextResponse.json({
        error: `คะแนนช่วยเหลือไม่เพียงพอ (ต้องการ ${POINTS_TO_PROMOTE} คะแนน คะแนนปัจจุบันของคุณคือ ${user.help_score} คะแนน)`
      }, { status: 400 });
    }

    // หักคะแนนผู้ใช้
    const updatedUser = await DB.incrementUserScore(userId, -POINTS_TO_PROMOTE);
    if (!updatedUser) {
      return NextResponse.json({ error: 'ไม่สามารถปรับปรุงคะแนนผู้ใช้งานได้' }, { status: 500 });
    }

    // อัปเดตสถานะการโปรโมตโพสต์
    const updatedPost = await DB.updatePostPromoted(postId, true);
    if (!updatedPost) {
      // คืนแต้มถ้าอัปเดตสถานะไม่สำเร็จ
      await DB.incrementUserScore(userId, POINTS_TO_PROMOTE);
      return NextResponse.json({ error: 'ไม่สามารถปรับปรุงสถานะการโปรโมตโพสต์ได้' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newScore: updatedUser.help_score,
      post: updatedPost
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}
