import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';
import { getPostHelpPoints } from '@/lib/constants';

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

    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    // Verify post exists
    const allPosts = await DB.getActivePosts();
    const post = allPosts.find(p => p.id === postId);

    if (!post) {
      return NextResponse.json({ error: 'Post not found or has expired' }, { status: 404 });
    }

    if (post.user_id === userId) {
      return NextResponse.json({ error: 'คุณไม่สามารถช่วยเหลือทวีตของตัวเองได้' }, { status: 400 });
    }

    const interactions = await DB.getInteractions();

    // 1 help per post per user
    const alreadyHelped = interactions.some(
      i => i.post_id === postId && i.helper_user_id === userId
    );

    if (alreadyHelped) {
      return NextResponse.json({ error: 'คุณเคยช่วยเหลือโพสนี้ไปแล้ว' }, { status: 400 });
    }

    // Calculate dynamic points (Bounty)
    const bountyPoints = getPostHelpPoints(post.created_at);

    // Record the interaction
    const newInteraction = await DB.recordInteraction({
      post_id: postId,
      helper_user_id: userId,
      type: 'like'
    });

    const updatedUser = await DB.incrementUserScore(userId, bountyPoints);
    const updatedScore = updatedUser?.help_score ?? user.help_score;

    return NextResponse.json({
      success: true,
      pointsAwarded: bountyPoints,
      totalScore: updatedScore,
      interaction: newInteraction
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
