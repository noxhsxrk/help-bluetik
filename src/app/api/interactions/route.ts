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
    const allPosts = await DB.getActivePosts();
    const post = allPosts.find(p => p.id === postId);

    if (!post) {
      return NextResponse.json({ error: 'Post not found or has expired (12h limit)' }, { status: 404 });
    }

    if (post.user_id === userId) {
      return NextResponse.json({ error: 'คุณไม่สามารถช่วยเหลือทวีตของตัวเองได้' }, { status: 400 });
    }

    const interactions = await DB.getInteractions();

    // Prevent recording the exact same action twice
    const alreadyDidThisAction = interactions.some(
      i => i.post_id === postId && i.helper_user_id === userId && i.type === type
    );

    if (alreadyDidThisAction) {
      return NextResponse.json({ error: 'คุณเคยทำรายการนี้กับโพสนี้ไปแล้ว' }, { status: 400 });
    }

    // Record the interaction
    const newInteraction = await DB.recordInteraction({ post_id: postId, helper_user_id: userId, type });

    // 1 point per post per user — only award on the FIRST action on this post, not per action type
    const hasInteractedBefore = interactions.some(
      i => i.post_id === postId && i.helper_user_id === userId
    );

    const points = hasInteractedBefore ? 0 : 1;

    let updatedScore = user.help_score;
    if (points > 0) {
      const updatedUser = await DB.incrementUserScore(userId, points);
      updatedScore = updatedUser?.help_score ?? user.help_score;
    }

    return NextResponse.json({
      success: true,
      pointsAwarded: points,
      totalScore: updatedScore,
      interaction: newInteraction
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
