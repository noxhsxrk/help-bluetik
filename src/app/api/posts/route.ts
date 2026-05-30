import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';
import { POST_COOLDOWN_MS, POST_COOLDOWN_LABEL, getPostHelpPoints } from '@/lib/constants';

// GET: Retrieve all active posts (Interaction Deprioritization & Bounty Sorting applied)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('tb_session_user_id');
    const userId = userIdCookie?.value;

    const activePosts = await DB.getActivePosts();
    const interactions = await DB.getInteractions();

    // Dynamically repair old posts' content on the fly from their oembed_html
    activePosts.forEach(post => {
      if (post.oembed_html && (post.content.startsWith('ทวีตโดย @') || post.content.startsWith('โพสทวีตรหัส'))) {
        const extracted = extractTweetText(post.oembed_html);
        if (extracted) {
          post.content = extracted;
        }
      }
    });

    if (!userId) {
      return NextResponse.json({ posts: activePosts });
    }

    // Sort: Uninteracted posts first, Interacted posts at the bottom (Interaction Deprioritization)
    const userInteractedPostIds = new Set(
      interactions
        .filter(i => i.helper_user_id === userId)
        .map(i => i.post_id)
    );

    const userInteractions: Record<string, string[]> = {};
    interactions
      .filter(i => i.helper_user_id === userId)
      .forEach(i => {
        if (!userInteractions[i.post_id]) {
          userInteractions[i.post_id] = [];
        }
        userInteractions[i.post_id].push(i.type);
      });

    activePosts.sort((a, b) => {
      const aDone = userInteractedPostIds.has(a.id);
      const bDone = userInteractedPostIds.has(b.id);

      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      if (aDone && bDone) {
        return b.created_at - a.created_at; // Both done: sort by newer first
      }

      // Both not done: Sort by dynamic bounty points descending (High Bounty / Urgent first!)
      const aPoints = getPostHelpPoints(a.created_at);
      const bPoints = getPostHelpPoints(b.created_at);

      if (aPoints !== bPoints) {
        return bPoints - aPoints; // High bounty first
      }

      return b.created_at - a.created_at; // Same bounty: sort by newer first
    });

    return NextResponse.json({
      posts: activePosts,
      interactedIds: Array.from(userInteractedPostIds),
      userInteractions
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function
  extractTweetText(html: string): string {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match) return '';
  // Decode HTML entities and strip nested HTML tags like <a>
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*>/g, '');
}

// POST: Add new post (handles rate limiting, duplicate checks, parses tweet URLs, and calls free X oEmbed)
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

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'กรุณาระบุลิงก์ทวีต X.com' }, { status: 400 });
    }

    // 1. Rate Limiting Check: 1 post per POST_COOLDOWN_LABEL per user
    const lastPostTime = await DB.getUserLastPostTime(userId);

    if (lastPostTime && (Date.now() - lastPostTime < POST_COOLDOWN_MS)) {
      const timeLeft = POST_COOLDOWN_MS - (Date.now() - lastPostTime);
      const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
      return NextResponse.json(
        { error: `จำกัดสิทธิ์ลงโพสทุก ${POST_COOLDOWN_LABEL}! กรุณารออีก ${minutesLeft} นาที` },
        { status: 429 }
      );
    }

    // 2. Parse and Validate X / Twitter URL format
    const xRegex = /https?:\/\/(x|twitter)\.com\/\w+\/status\/(\d+)/i;
    const match = url.match(xRegex);
    if (!match) {
      return NextResponse.json({ error: 'ลิงก์โพสจาก X.com ไม่ถูกต้อง (รูปแบบ: https://x.com/username/status/1234567890)' }, { status: 400 });
    }
    const finalPostId = match[2];

    // 3. Prevent duplicate posts (Check by post URL)
    const isDuplicate = await DB.checkDuplicatePost(userId, url, true);
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'ทวีตลิงก์นี้เคยถูกแชร์เข้าสู่ระบบแล้ว ไม่สามารถแชร์ซ้ำได้' },
        { status: 400 }
      );
    }

    let finalContent = `โพสทวีตรหัส ${finalPostId}`;
    let oembedHtml = '';

    // 4. Call X's official, keyless oEmbed API to fetch dark themed HTML embed block
    try {
      const oembedRes = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&theme=dark`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        oembedHtml = oembedData.html || '';

        // Extract real text from the blockquote HTML
        const extracted = extractTweetText(oembedHtml);
        if (extracted) {
          finalContent = extracted;
        } else {
          finalContent = oembedData.title || `ทวีตโดย @${oembedData.author_name || user.x_username}`;
        }
      } else {
        oembedHtml = `<blockquote class="twitter-tweet" data-theme="dark"><p lang="th" dir="ltr">เปิดทวีตบน X.com เพื่อร่วมกดไลค์หรือรีโพสได้ทันที</p>&mdash; @${user.x_username} <a href="${url}">คลิกที่นี่เพื่อเปิดทวีต</a></blockquote>`;
      }
    } catch (err) {
      oembedHtml = `<blockquote class="twitter-tweet" data-theme="dark"><p lang="th" dir="ltr">เปิดทวีตบน X.com เพื่อร่วมกดไลค์หรือรีโพสได้ทันที</p>&mdash; @${user.x_username} <a href="${url}">คลิกที่นี่เพื่อเปิดทวีต</a></blockquote>`;
    }

    // Create and save post
    const newPost = await DB.createPost({
      user_id: user.id,
      x_username: user.x_username,
      x_name: user.x_name,
      avatar: user.avatar,
      content: finalContent,
      x_post_id: finalPostId,
      x_post_url: url,
      posted_via: 'link',
      oembed_html: oembedHtml
    });

    // Update hourly cooldown
    await DB.updateUserLastPostTime(userId);

    return NextResponse.json({ success: true, post: newPost });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
