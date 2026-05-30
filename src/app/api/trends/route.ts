import { NextResponse } from 'next/server';
import { DB } from '@/lib/db';

export async function GET() {
  try {
    const trends = await DB.getTrends();
    return NextResponse.json({ trends });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const trends = await DB.getTrends();
    const keywords = ['#เลือกตั้ง', '#พยากรณ์อากาศ', '#โควิดวันนี้', '#แบนขยะ', '#คอนเสิร์ตใหญ่', '#ดราม่าติ๊กฟ้า', '#บิตคอยน์แสนเหรียญ', '#เกาะเทรนด์ด่วน'];

    // Generate random mock trend updates (Phase 3 WOEID: 23424960 Thailand trends monitoring simulator)
    const updatedTrends = trends.map(t => {
      const updatedVol = t.tweet_volume + Math.floor((Math.random() - 0.3) * 5000);
      const isHot = Math.random() > 0.6;
      return {
        ...t,
        tweet_volume: Math.max(2000, updatedVol),
        is_hot: isHot,
        detected_at: Date.now()
      };
    });

    if (Math.random() > 0.5) {
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      if (!updatedTrends.some(t => t.hashtag === randomKeyword)) {
        updatedTrends[Math.floor(Math.random() * updatedTrends.length)] = {
          id: 't_d_' + Date.now(),
          hashtag: randomKeyword,
          tweet_volume: Math.floor(10000 + Math.random() * 25000),
          trend_score: 1.2,
          country: 'TH',
          detected_at: Date.now(),
          expires_at: Date.now() + 3600 * 1000,
          is_hot: true
        };
      }
    }

    await DB.updateTrends(updatedTrends);
    return NextResponse.json({ success: true, trends: updatedTrends });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
