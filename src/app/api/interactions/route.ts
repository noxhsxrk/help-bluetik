import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('tb_session_user_id');

    if (!userIdCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = userIdCookie.value;
    const user = await DB.getUserById(userId);

    if (!user || user.role === 'pending') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { postId, type } = await request.json();

    if (!postId || !type) {
      return NextResponse.json({ error: 'Post ID and Action Type are required' }, { status: 400 });
    }

    // Verify post exists
    const posts = await DB.getActivePosts();
    // Also check all historical posts to be sure
    const allPosts = await DB.getActivePosts(); // For simplicity, search active list
    const post = allPosts.find(p => p.id === postId);
    
    if (!post) {
      return NextResponse.json({ error: 'Post not found or has expired (12h limit)' }, { status: 404 });
    }

    if (post.user_id === userId) {
      return NextResponse.json({ error: 'คุณไม่สามารถช่วยเหลือทวีตของตัวเองได้' }, { status: 400 });
    }

    const interactions = await DB.getInteractions();
    
    // Prevent double reward for the exact same interaction type on the same post
    const alreadyInteracted = interactions.some(
      i => i.post_id === postId && i.helper_user_id === userId && i.type === type
    );

    if (alreadyInteracted) {
      return NextResponse.json({ error: 'คุณเคยได้รับแต้มการช่วยเหลือกิจกรรมนี้กับโพสดังกล่าวไปแล้ว' }, { status: 400 });
    }

    // Record interaction
    const newInteraction = await DB.recordInteraction({
      post_id: postId,
      helper_user_id: userId,
      type
    });

    // Score weight system: Repost/Quote = 3, Mention = 2, Like = 1
    let points = 1;
    if (type === 'repost' || type === 'quote') points = 3;
    else if (type === 'mention') points = 2;

    // Increment user score in DB
    const updatedUser = await DB.incrementUserScore(userId, points);

    return NextResponse.json({
      success: true,
      pointsAwarded: points,
      totalScore: updatedUser?.help_score || user.help_score,
      interaction: newInteraction
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
