'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import KofiButton from '@/components/KofiButton';
import { POST_COOLDOWN_LABEL, POST_EXPIRY_LABEL, getPostHelpPoints, POINTS_TO_PROMOTE } from '@/lib/constants';

// Isolated Twitter embed component — bypasses React's VDOM to prevent overwriting Twitter's iframe
function TweetEmbed({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Set HTML once and never touch again (React won't reconcile this node)
    ref.current.innerHTML = html;

    // Hydrate the blockquote into an iframe
    const hydrate = () => {
      // @ts-ignore
      if (window.twttr && window.twttr.widgets) {
        // @ts-ignore
        window.twttr.widgets.load(ref.current!);
      }
    };

    // @ts-ignore
    if (window.twttr) {
      // @ts-ignore
      window.twttr.ready(() => hydrate());
    } else {
      const interval = setInterval(() => {
        // @ts-ignore
        if (window.twttr && window.twttr.widgets) {
          hydrate();
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Empty deps: only run once on mount. html won't change for a given post.

  return (
    <div
      ref={ref}
      className="w-full my-1 rounded-md overflow-hidden flex justify-center text-sm"
    />
  );
}

interface User {
  id: string;
  x_username: string;
  x_name: string;
  role: 'pending' | 'member' | 'admin';
  avatar: string;
  bio: string;
  help_score: number;
  spendable_points?: number;
  supabase_auth_id?: string;
  google_email?: string;
}

interface Post {
  id: string;
  user_id: string;
  x_username: string;
  x_name: string;
  avatar: string;
  content: string;
  x_post_id: string;
  x_post_url?: string;
  posted_via: 'link' | 'compose';
  created_at: number;
  oembed_html?: string;
  is_promoted?: boolean;
}

interface TrendingHashtag {
  id: string;
  hashtag: string;
  tweet_volume: number;
  is_hot?: boolean;
}

function getRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'เมื่อครู่นี้';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return new Date(timestamp).toLocaleDateString('th-TH');
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'leaderboard' | 'admin'>('dashboard');

  // Input states
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Onboarding states
  const [onboardXUsername, setOnboardXUsername] = useState('');
  const [onboardXName, setOnboardXName] = useState('');
  const [onboardReferralCode, setOnboardReferralCode] = useState('');

  const [linkInput, setLinkInput] = useState('');

  // Data states
  const [posts, setPosts] = useState<Post[]>([]);
  const [interactedIds, setInteractedIds] = useState<string[]>([]);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [feedSort, setFeedSort] = useState<'priority' | 'newest' | 'oldest'>('priority');
  const [feedFilter, setFeedFilter] = useState<'all' | 'unhelped' | 'helped'>('all');
  const [userInteractions, setUserInteractions] = useState<Record<string, string[]>>({});
  const [trends, setTrends] = useState<TrendingHashtag[]>([]);
  const [leaderboardUsers, setLeaderboardUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);

  // Cooldown timers
  const [cooldownString, setCooldownString] = useState('✓ พร้อมลงโพสถัดไปแล้ว');

  // Stats for Admin
  const [adminStats, setAdminStats] = useState({
    pending: 0,
    members: 0,
    posts: 0,
    helps: 0
  });

  // Toasts
  interface Toast {
    id: string;
    msg: string;
    type: 'default' | 'success' | 'error';
  }
  const [toasts, setToasts] = useState<Toast[]>([]);

  const triggerToast = (msg: string, type: 'default' | 'success' | 'error' = 'default') => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Fetch authentication session
  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        if (data.user.role === 'admin') {
          const hash = window.location.hash.replace('#', '');
          if (hash === 'admin') setCurrentView('admin');
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      triggerToast('ไม่สามารถเชื่อมต่อระบบเซสชันได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initial loads
  useEffect(() => {
    checkSession();

    // Auto-login and sync session cookies ONLY when user just signed in via Google SSO
    // (not on TOKEN_REFRESHED which fires on every tab focus)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'SIGNED_IN') return;
      if (!session?.user?.email) return;

      try {
        const res = await fetch('/api/auth/x-sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: session.user.email,
            authUserId: session.user.id
          })
        });
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          if (!data.user.x_username) {
            triggerToast('ลงชื่อเข้าใช้งานสำเร็จ กรุณาผูกบัญชี X เพื่อยื่นขอสิทธิ์แรกเข้า', 'success');
          } else if (data.user.role === 'pending') {
            triggerToast('ล็อกอินสำเร็จ โปรไฟล์ของคุณอยู่ระหว่างรออนุมัติสิทธิ์แรกเข้า', 'success');
          } else {
            triggerToast(`ยินดีต้อนรับเข้าใช้งาน @${data.user.x_username}`, 'success');
            window.location.hash = '#dashboard';
          }
        }
      } catch { }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load Twitter widgets script once on mount, hydrate after load
  useEffect(() => {
    const twitterScriptUrl = 'https://platform.twitter.com/widgets.js';
    const existingScript = document.querySelector(`script[src="${twitterScriptUrl}"]`);
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = twitterScriptUrl;
      script.async = true;
      script.charset = 'utf-8';
      script.onload = () => {
        // @ts-ignore
        if (window.twttr && window.twttr.widgets) {
          // @ts-ignore
          window.twttr.widgets.load();
        }
      };
      document.body.appendChild(script);
    }
  }, []);


  // Handle Hash updates
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'admin' && currentUser?.role === 'admin') {
        setCurrentView('admin');
      } else if (hash === 'leaderboard') {
        setCurrentView('leaderboard');
      } else {
        setCurrentView('dashboard');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [currentUser?.role]);

  // Load feed, trends, stats when user switches views or submits content
  useEffect(() => {
    if (!currentUser || currentUser.role === 'pending') return;

    const loadData = async () => {
      try {
        // Fetch posts
        const postsRes = await fetch('/api/posts');
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
        setInteractedIds(postsData.interactedIds || []);
        setUserInteractions(postsData.userInteractions || {});

        // Fetch trends
        const trendsRes = await fetch('/api/trends');
        const trendsData = await trendsRes.json();
        setTrends(trendsData.trends || []);

        // Fetch users for leaderboard from real DB
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        const members: User[] = usersData.users || [];
        setLeaderboardUsers(members.sort((a, b) => b.help_score - a.help_score));

        // Fetch pending count
        const adminRes = await fetch('/api/admin/users');
        const adminData = await adminRes.json();
        setPendingUsers(adminData.pending || []);
        setAdminStats({
          pending: adminData.pending?.length || 0,
          members: adminData.members || 0,
          posts: postsData.posts?.length || 0,
          helps: 0
        });

      } catch {
        // network error — fail silently
      }
    };

    loadData();
  }, [currentUser?.id, currentUser?.role, currentView]);



  // Handle Google SSO login (100% Free SSO via Supabase Google OAuth)
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      if (error) {
        triggerToast(error.message, 'error');
      }
    } catch {
      triggerToast('เกิดข้อผิดพลาดในการนำทางไปยังระบบเข้าสู่ระบบของ Google', 'error');
    }
  };

  // Handle Onboarding form submit (Links custom X handle and triggers admin request)
  const handleOnboardSubmit = async () => {
    if (!onboardXUsername.trim()) {
      triggerToast('กรุณาระบุชื่อผู้ใช้งาน X.com (Username) ของคุณ', 'error');
      return;
    }
    if (!onboardXName.trim()) {
      triggerToast('กรุณาระบุชื่อโปรไฟล์ X.com (Profile Name) ของคุณ', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/x-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xUsername: onboardXUsername.trim(),
          xName: onboardXName.trim(),
          bio: '',
          referralCode: onboardReferralCode.trim()
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        triggerToast('บันทึกข้อมูลและส่งคำขอตรวจสอบสิทธิ์แรกเข้าแก่แอดมินเรียบร้อย!', 'success');
      } else {
        triggerToast(data.error || 'การผูกบัญชีขัดข้อง', 'error');
      }
    } catch {
      triggerToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อผูกบัญชีได้', 'error');
    }
  };



  // Sign out
  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      setCurrentUser(null);
      setOnboardXUsername('');
      setOnboardXName('');
      triggerToast('ลงชื่อออกจากระบบเรียบร้อย', 'success');
      window.location.hash = '#login';
    } catch {
      triggerToast('ลงชื่อออกขัดข้อง', 'error');
    }
  };

  // Submit new post (requires pasting a tweet URL, fetches oEmbed dynamically)
  const handleSubmitPost = async (urlToSubmit: string) => {
    if (!urlToSubmit) {
      triggerToast('กรุณาระบุลิงก์ทวีต X.com เพื่อใช้งาน', 'error');
      return;
    }

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToSubmit })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('ลงทะเบียนแชร์ทวีตขึ้นบอร์ดแลกเปลี่ยนยอดสำเร็จ!', 'success');
        setLinkInput('');

        // Refresh posts list
        const postsRes = await fetch('/api/posts');
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      } else {
        triggerToast(data.error || 'เกิดข้อผิดพลาดในการลงทะเบียน', 'error');
      }
    } catch {
      triggerToast('ไม่สามารถส่งคำขอลงทะเบียนได้', 'error');
    }
  };

  // Trigger help interaction — open tweet on X.com and award 1 point
  const triggerInteraction = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.user_id === currentUser?.id) {
      triggerToast('คุณไม่สามารถช่วยเหลือและแลกคะแนนกับโพสของตัวเองได้', 'error');
      return;
    }

    if (interactedIds.includes(postId)) {
      triggerToast('ช่วยเหลือโพสนี้ไปแล้ว', 'default');
      return;
    }

    const bountyPoints = getPostHelpPoints(post.created_at);
    const oldHelpScore = currentUser?.help_score || 0;
    const oldSpendable = currentUser?.spendable_points || 0;

    // Optimistic update
    setInteractedIds(prev => [...prev, postId]);
    if (currentUser) {
      setCurrentUser(prev => prev ? { 
        ...prev, 
        help_score: prev.help_score + bountyPoints, 
        spendable_points: (prev.spendable_points ?? 0) + bountyPoints 
      } : null);
    }

    // Open tweet on X.com
    const tweetUrl = post.x_post_url || `https://x.com/${post.x_username}/status/${post.x_post_id}`;
    window.open(tweetUrl, '_blank');

    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });
      const data = await res.json();

      if (data.success) {
        triggerToast(`+${data.pointsAwarded} แต้ม! ช่วยเหลือ @${post.x_username} สำเร็จ`, 'success');
        if (currentUser) {
          setCurrentUser(prev => prev ? { 
            ...prev, 
            help_score: data.totalScore, 
            spendable_points: data.spendablePoints 
          } : null);
        }
      } else {
        // Rollback
        setInteractedIds(prev => prev.filter(id => id !== postId));
        if (currentUser) {
          setCurrentUser(prev => prev ? { ...prev, help_score: oldHelpScore, spendable_points: oldSpendable } : null);
        }
        triggerToast(data.error || 'การช่วยเหลือล้มเหลว', 'error');
      }
    } catch {
      setInteractedIds(prev => prev.filter(id => id !== postId));
      if (currentUser) {
        setCurrentUser(prev => prev ? { ...prev, help_score: oldHelpScore, spendable_points: oldSpendable } : null);
      }
      triggerToast('เชื่อมต่อ API ขัดข้อง', 'error');
    }
  };

  // Promote a post using points
  const handlePromotePost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.user_id !== currentUser?.id) {
      triggerToast('คุณไม่มีสิทธิ์โปรโมตโพสต์ของผู้อื่น', 'error');
      return;
    }

    if (post.is_promoted) {
      triggerToast('โพสต์นี้ได้รับการโปรโมตแล้ว', 'default');
      return;
    }

    if ((currentUser?.spendable_points || 0) < POINTS_TO_PROMOTE) {
      triggerToast(`แต้มสะสมไม่เพียงพอ ต้องการอย่างน้อย ${POINTS_TO_PROMOTE} แต้ม`, 'error');
      return;
    }

    // Confirmation dialog before promoting
    const confirmPromote = window.confirm(`คุณต้องการใช้ ${POINTS_TO_PROMOTE} แต้มสะสมในการโปรโมตโพสต์นี้หรือไม่? โพสต์จะถูกดันขึ้นบนสุดและมีอายุเพิ่มเป็น 18 ชั่วโมง (ค่าน้ำใจบน Leaderboard จะไม่ลดลง)`);
    if (!confirmPromote) return;

    const oldSpendable = currentUser?.spendable_points || 0;

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_promoted: true } : p));
    if (currentUser) {
      setCurrentUser(prev => prev ? { ...prev, spendable_points: Math.max(0, (prev.spendable_points ?? 0) - POINTS_TO_PROMOTE) } : null);
    }

    try {
      const res = await fetch('/api/posts/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });
      const data = await res.json();

      if (data.success) {
        triggerToast('โปรโมตโพสต์สำเร็จ! ดันโพสต์ขึ้นสู่ตำแหน่งบนสุดเรียบร้อยแล้ว', 'success');
        if (currentUser && data.newScore !== undefined) {
          setCurrentUser(prev => prev ? { ...prev, spendable_points: data.newScore } : null);
        }
        // Force refresh all posts to get updated list and correct order
        const postsRes = await fetch('/api/posts');
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      } else {
        // Rollback
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_promoted: false } : p));
        if (currentUser) {
          setCurrentUser(prev => prev ? { ...prev, spendable_points: oldSpendable } : null);
        }
        triggerToast(data.error || 'ไม่สามารถทำการโปรโมตโพสต์ได้', 'error');
      }
    } catch {
      // Rollback
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_promoted: false } : p));
      if (currentUser) {
        setCurrentUser(prev => prev ? { ...prev, spendable_points: oldSpendable } : null);
      }
      triggerToast('เชื่อมต่อ API ขัดข้อง', 'error');
    }
  };

  // Creator deletes their own post
  const handleDeleteOwnPost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.user_id !== currentUser?.id) {
      triggerToast('คุณไม่มีสิทธิ์ลบโพสต์ของผู้อื่น', 'error');
      return;
    }

    // แจ้งเตือนเงื่อนไขการลบโพสต์สำคัญ
    const confirmDelete = window.confirm(
      "คำเตือนสำคัญ:\n" +
      "- หากลบโพสต์นี้แล้ว ระยะเวลาคูลดาวน์สำหรับการลงโพสต์ถัดไปจะยังคงอยู่และทำงานต่อตามปกติ (ไม่มีการคืนคูลดาวน์ให้)\n" +
      "- โพสต์ที่ถูกลบไปแล้วจะไม่สามารถกู้คืนกลับมาได้อีกครั้ง\n\n" +
      "คุณต้องการยืนยันการลบโพสต์นี้ออกระบบฟีดใช่หรือไม่?"
    );
    if (!confirmDelete) return;

    // ลบแบบ Optimistic Update ล่วงหน้าบนหน้าจอ
    setPosts(prev => prev.filter(p => p.id !== postId));

    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });
      const data = await res.json();

      if (data.success) {
        triggerToast('ลบโพสต์ของคุณออกจากกระดานแลกเปลี่ยนเรียบร้อยแล้ว', 'success');
        const postsRes = await fetch('/api/posts');
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      } else {
        triggerToast(data.error || 'ไม่สามารถลบโพสต์ได้', 'error');
        const postsRes = await fetch('/api/posts');
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      }
    } catch {
      triggerToast('เชื่อมต่อ API ลบโพสต์ขัดข้อง', 'error');
      const postsRes = await fetch('/api/posts');
      const postsData = await postsRes.json();
      setPosts(postsData.posts || []);
    }
  };

  // Thailand trends monitoring refresh simulator
  const refreshTrends = async () => {
    try {
      const res = await fetch('/api/trends', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTrends(data.trends || []);
        triggerToast('ดึงข้อมูลสถิติเทรนด์แท็กประเทศไทยล่าสุดสำเร็จ (WOEID: TH)', 'success');
      }
    } catch {
      triggerToast('ดึงข้อมูลเทรนด์ขัดข้อง', 'error');
    }
  };

  // Helper click to copy tags
  const copyHashtag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    triggerToast(`คัดลอกแฮชแท็ก ${tag} ลงในคลิปบอร์ดแล้ว นำไปวางใน X.com ได้เลย`, 'success');
  };

  // Admin approvals handlers
  const handleApproveUser = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`อนุมัติสิทธิ์ติ๊กฟ้าแก่ผู้ใช้ @${data.user.x_username} สำเร็จ!`, 'success');

        const card = document.getElementById(`pending-card-${userId}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(-10px)';
        }

        setTimeout(() => {
          setPendingUsers(prev => prev.filter(u => u.id !== userId));
        }, 300);
      }
    } catch {
      triggerToast('ดำเนินการอนุมัติสิทธิ์ขัดข้อง', 'error');
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('ปฏิเสธการขอสมัครและลบโปรไฟล์ดังกล่าวออกเรียบร้อย', 'success');

        const card = document.getElementById(`pending-card-${userId}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(-10px)';
        }

        setTimeout(() => {
          setPendingUsers(prev => prev.filter(u => u.id !== userId));
        }, 300);
      }
    } catch {
      triggerToast('ปฏิเสธบัญชีผิดพลาด', 'error');
    }
  };

  // Simulation: Reset all cooldown locks
  const clearCooldowns = async () => {
    try {
      const res = await fetch('/api/admin/cooldowns', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        triggerToast('ล้างบันทึกเวลาล็อกคูลดาวน์ของทุกบัญชีในฐานข้อมูลสำเร็จ!', 'success');
      }
    } catch {
      triggerToast('ล้างคูลดาวน์ผิดพลาด', 'error');
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark text-ink-light">
        <div className="text-center font-display text-2xl animate-pulse">ติ๊กฟ้าช่วยติ๊กฟ้า...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-dark text-ink-light">

      {/* TOAST NOTIFIER SYSTEM */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[1000] max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center justify-between bg-surface-dark border border-border-dark p-4 rounded-sm shadow-2xl transition-all duration-300 border-l-4 ${t.type === 'error' ? 'border-l-red-500' : t.type === 'success' ? 'border-l-green-500' : 'border-l-primary'
              }`}
          >
            <span className="text-sm font-medium pr-4">{t.msg}</span>
            <button className="text-muted-zinc hover:text-ink-light font-bold" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>

      {/* HEADER SECTION */}
      {currentUser && currentUser.x_username && (
        <header className="border-b border-border-dark py-4 px-4 sm:px-6 sticky top-0 bg-bg-dark/95 backdrop-blur-sm z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="brand" onClick={() => { window.location.hash = '#dashboard'; setCurrentView('dashboard'); setMobileMenuOpen(false); }}>
              <h1 className="text-xl sm:text-2xl font-bold cursor-pointer hover:opacity-90">ติ๊กฟ้าช่วยติ๊กฟ้า<span className="text-primary">.</span></h1>
            </div>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-6">
              <span
                className={`text-sm font-medium cursor-pointer transition-colors ${currentView === 'dashboard' ? 'text-ink-light' : 'text-muted-zinc hover:text-ink-light'}`}
                onClick={() => { window.location.hash = '#dashboard'; setCurrentView('dashboard'); }}
              >
                Dashboard
              </span>
              <span
                className={`text-sm font-medium cursor-pointer transition-colors ${currentView === 'leaderboard' ? 'text-ink-light' : 'text-muted-zinc hover:text-ink-light'}`}
                onClick={() => { window.location.hash = '#leaderboard'; setCurrentView('leaderboard'); }}
              >
                Leaderboard
              </span>
              <a
                href="https://ko-fi.com/brandnewnox"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 bg-[#FF5E5B] hover:bg-[#ff4a47] text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#FF5E5B]/30"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                  <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298" />
                </svg>
                เลี้ยงกาแฟ
              </a>
              <div className="flex items-center gap-2 border border-border-dark px-3 py-1 bg-surface-dark rounded-sm text-sm">
                <img className="w-5 h-5 rounded-full" src={currentUser.avatar} alt="Avatar" />
                <span className="font-semibold text-xs">@{currentUser.x_username}</span>
                <span className="text-zinc-500 font-medium text-xs">|</span>
                <span className="text-zinc-300 text-xs font-bold">{currentUser.spendable_points ?? 0} แต้ม</span>
              </div>
              <button className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors" onClick={handleSignOut}>
                Sign Out
              </button>
            </nav>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden flex flex-col gap-1.5 p-2 -mr-2"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label="เปิด/ปิด เมนู"
            >
              <span className={`block w-5 h-0.5 bg-ink-light transition-transform duration-200 origin-center ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-ink-light transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-ink-light transition-transform duration-200 origin-center ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-3 pt-4 border-t border-border-dark flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <img className="w-7 h-7 rounded-full" src={currentUser.avatar} alt="Avatar" />
                <span className="font-semibold text-sm">@{currentUser.x_username}</span>
                <span className="text-zinc-500 font-medium text-sm">|</span>
                <span className="text-zinc-300 text-sm font-bold">{currentUser.spendable_points ?? 0} แต้ม</span>
              </div>
              <button className="text-sm text-left text-muted-zinc hover:text-ink-light transition-colors" onClick={() => { window.location.hash = '#dashboard'; setCurrentView('dashboard'); setMobileMenuOpen(false); }}>Dashboard</button>
              <button className="text-sm text-left text-muted-zinc hover:text-ink-light transition-colors" onClick={() => { window.location.hash = '#leaderboard'; setCurrentView('leaderboard'); setMobileMenuOpen(false); }}>Leaderboard</button>
              <a
                href="https://ko-fi.com/brandnewnox"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#FF5E5B] hover:bg-[#ff4a47] text-white text-sm font-bold px-4 py-2 rounded-full transition-colors w-fit"
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298" />
                </svg>
                เลี้ยงกาแฟ
              </a>
              <button
                className="text-sm text-left text-red-500 hover:text-red-400 font-medium transition-colors border-t border-border-dark pt-3 mt-1 cursor-pointer"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
              >
                ออกจากระบบ (Sign Out)
              </button>
            </div>
          )}
        </header>
      )}


      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* ==================== VIEW 1. LOGIN SCREEN ==================== */}
        {!currentUser && (
          <section className="max-w-md w-full mx-auto my-12 border border-border-dark bg-surface-dark p-8 rounded-md text-center">
            <h2 className="text-3xl font-bold mb-2 font-display">ติ๊กฟ้าช่วยติ๊กฟ้า</h2>
            <p className="text-sm text-muted-zinc mb-6 leading-relaxed">
              แพลตฟอร์มประสานงานค่าน้ำใจแลกยอด Impressions สำหรับครีเอเตอร์ระดับพรีเมียม X Verify ประเทศไทย
            </p>

            <div className="flex flex-col gap-4">
              <button
                className="w-full bg-white text-black hover:bg-neutral-200 font-bold py-3 px-4 rounded-sm transition-colors cursor-pointer text-sm flex items-center justify-center gap-2"
                onClick={handleGoogleLogin}
              >
                ลงชื่อใช้งานด้วย Google
              </button>
            </div>

            <div className="text-left mt-6 text-[10px] text-muted-zinc leading-relaxed border-t border-border-dark/50 pt-4">
              * ระบบเข้าใช้งานตรง: คลิกด้านบนเพื่อดำเนินการล็อกอินด้วยบัญชีจริงผ่านระบบความปลอดภัย OAuth ของ Google
            </div>
          </section>
        )}

        {/* ==================== VIEW 1.5. ONBOARDING BIND X ACCOUNT ==================== */}
        {currentUser && !currentUser.x_username && (
          <section className="max-w-md w-full mx-auto my-16 border border-border-dark bg-surface-dark p-8 rounded-md text-center">
            <h2 className="text-2xl font-bold mb-2">ผูกบัญชี X (Twitter)</h2>
            <p className="text-sm text-muted-zinc mb-6 leading-relaxed">
              กรุณากรอกข้อมูลโปรไฟล์ X.com ของคุณเพื่อขอสมัครเข้าร่วมกลุ่มแลกเปลี่ยนแต้ม ข้อมูลนี้จะส่งไปให้แอดมินอนุมัติผ่านแผงควบคุมหลังบ้าน
            </p>

            <div className="text-left mb-4">
              <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">
                ป้อน X Handle / Username <span className="text-red-500 font-bold">*</span> (ไม่ต้องใส่ @)
              </label>
              <input
                type="text"
                required
                className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light focus:outline-none focus:border-primary text-sm"
                placeholder="เช่น NongVerify (จำเป็นต้องระบุ)"
                value={onboardXUsername}
                onChange={e => setOnboardXUsername(e.target.value)}
              />
            </div>

            <div className="text-left mb-4">
              <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">
                ชื่อสำหรับแสดงบนโปรไฟล์ X <span className="text-red-500 font-bold">*</span> (Profile Name)
              </label>
              <input
                type="text"
                required
                className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light focus:outline-none focus:border-primary text-sm"
                placeholder="เช่น น้องติ๊กฟ้าน่ารัก (จำเป็นต้องระบุ)"
                value={onboardXName}
                onChange={e => setOnboardXName(e.target.value)}
              />
            </div>

            <div className="text-left mb-6">
              <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">
                รหัสแนะนำ (Referral Code) <span className="text-zinc-500 font-normal">(ถ้ามี)</span>
              </label>
              <input
                type="text"
                className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light focus:outline-none focus:border-primary text-sm"
                placeholder="ป้อนรหัสผู้แนะนำ (ไม่บังคับ)"
                value={onboardReferralCode}
                onChange={e => setOnboardReferralCode(e.target.value)}
              />
            </div>

            <button
              className="w-full bg-white text-black hover:bg-neutral-200 font-bold py-3 px-4 rounded-sm transition-colors cursor-pointer text-sm"
              onClick={handleOnboardSubmit}
            >
              ผูกบัญชีและยื่นขอตรวจสอบแรกเข้า
            </button>

            <button
              className="w-full mt-4 border border-border-dark hover:bg-bg-dark text-red-500 font-semibold py-2 px-4 rounded-sm transition-colors cursor-pointer text-xs"
              onClick={handleSignOut}
            >
              ยกเลิกและออกจากระบบ
            </button>
          </section>
        )}

        {/* ==================== VIEW 2. PENDING APPROVAL VIEW ==================== */}
        {currentUser && currentUser.x_username && currentUser.role === 'pending' && (
          <section className="max-w-lg w-full mx-auto my-20 border border-border-dark bg-surface-dark p-8 rounded-md text-center">
            <h2 className="text-2xl font-bold mb-2">กำลังรอการตรวจสอบความถูกต้องแรกเข้า</h2>
            <p className="text-sm text-muted-zinc mb-6">ผู้ดูแลระบบกำลังตรวจสอบประวัติและสิทธิ์ติ๊กฟ้าของคุณบนบัญชี X.com ของจริง เพื่อรักษาระบบที่ยุติธรรมและปลอดบอท</p>

            <div className="border border-border-dark p-5 rounded-sm bg-bg-dark text-left flex gap-4 items-center mb-6">
              <img className="w-12 h-12 rounded-full" src={currentUser.avatar} alt="Avatar" />
              <div className="flex-1">
                <h4 className="font-bold flex items-center gap-1.5">{currentUser.x_name} <span className="text-primary text-sm">✓</span></h4>
                <p className="text-xs text-muted-zinc">@{currentUser.x_username}</p>
                <span className="inline-block mt-2 px-2.5 py-0.5 bg-surface-dark border border-border-dark text-[10px] text-muted-zinc font-semibold uppercase rounded-sm">สถานะ: รอการอนุมัติสิทธิ์</span>
              </div>
            </div>

            <div className="text-left bg-primary/5 border border-primary/20 p-4 rounded-sm text-sm mb-6 leading-relaxed">
              <span className="font-semibold text-primary">คำแนะนำสำหรับการทดสอบ:</span> สมาชิกสามารถกดที่เมนู **"เปิดระบบแอดมินหลังบ้าน"** ด้านล่างสุดของหน้าจอ (Footer) เพื่อจำลองสิทธิ์เป็น Admin และเข้าไปกด Approve โปรไฟล์ของตัวท่านเองได้ในหน้าระบบควบคุมผู้ดูแล!
            </div>

            <button
              className="w-full border border-border-dark hover:bg-surface-dark py-3 rounded-sm font-semibold transition-colors cursor-pointer text-sm"
              onClick={checkSession}
            >
              ตรวจสอบสถานะการเข้าใช้งาน
            </button>
          </section>
        )}

        {/* ==================== VIEW 3. DASHBOARD MAIN VIEW ==================== */}
        {currentUser && currentUser.x_username && currentUser.role !== 'pending' && currentView === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

            {/* LEFT FEED & COMPOSER — full width on mobile, 2/3 on desktop */}
            <div className="md:col-span-2 flex flex-col gap-6">

              {/* Composer - Link Only */}
              <div className="bg-surface-dark border border-border-dark p-6 rounded-md">
                <h3 className="text-lg font-bold border-b border-border-dark pb-3 mb-4 flex items-center gap-2">
                  แชร์ลิงก์โพสต์
                </h3>
                <p className="text-xs text-muted-zinc mb-5 leading-relaxed">
                  นำลิงก์ทวีตจริงที่คุณได้ทำการโพสต์บน X.com ของคุณมาวางลงในกล่องด้านล่าง
                </p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">ลิงก์โพสทวีตจาก X.com</label>
                    <input
                      type="text"
                      className="w-full bg-bg-dark border border-border-dark p-3 rounded-sm text-sm text-ink-light focus:outline-none focus:border-primary"
                      placeholder="https://x.com/username/status/1234567890..."
                      value={linkInput}
                      onChange={e => setLinkInput(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <span className="text-xs text-muted-zinc" id="post-cooldown-timer">
                      {cooldownString}
                    </span>
                    <button
                      className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-ink-light font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-sm transition-colors cursor-pointer"
                      onClick={() => handleSubmitPost(linkInput)}
                    >
                      ลงโพส
                    </button>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border-dark/50 text-[10px] text-muted-zinc leading-relaxed">
                  <strong>ขั้นตอนการดำเนินงาน:</strong> 1. เขียนข้อความและโพสต์ทวีตจริงด้วยตัวเองโดยตรงบนเว็บไซต์ X.com &mdash; 2. คัดลอกลิงก์สถานะทวีตของคุณ &mdash; 3. นำมาวางลงทะเบียนในกล่องด้านบนเพื่อเปิดฟีดแลกคะแนน.
                </div>
              </div>

              {/* Active Posts Feed */}
              <div>
                <h2 className="text-xl font-bold mb-3 flex justify-between items-center">
                  บอร์ดแลกเปลี่ยนยอด
                  <span className="text-xs text-muted-zinc font-normal">แชร์ได้ทุก {POST_COOLDOWN_LABEL} โพสหมดอายุใน {POST_EXPIRY_LABEL}</span>
                </h2>

                {/* Sort & Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-surface-dark/40 border border-border-dark p-3.5 rounded-md mb-4">
                  {/* Filters Tab buttons */}
                  <div className="flex gap-1.5 w-full sm:w-auto">
                    {(['all', 'unhelped', 'helped'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFeedFilter(f)}
                        className={`px-3 py-1.5 rounded-sm text-xs font-semibold cursor-pointer transition-all ${
                          feedFilter === f
                            ? 'bg-primary text-white font-bold'
                            : 'bg-zinc-900 border border-border-dark text-muted-zinc hover:text-ink-light'
                        }`}
                      >
                        {f === 'all' && 'ทั้งหมด'}
                        {f === 'unhelped' && 'ยังไม่ได้ช่วย'}
                        {f === 'helped' && 'ช่วยเหลือแล้ว'}
                      </button>
                    ))}
                  </div>

                  {/* Sort Selector Dropdown */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="text-xs text-muted-zinc shrink-0">เรียงตาม:</span>
                    <select
                      value={feedSort}
                      onChange={e => setFeedSort(e.target.value as any)}
                      className="bg-bg-dark border border-border-dark text-xs text-ink-light px-2.5 py-1.5 rounded-sm focus:outline-none focus:border-primary w-full sm:w-44"
                    >
                      <option value="priority">จัดตามลำดับความสำคัญ</option>
                      <option value="newest">โพสต์ใหม่ล่าสุด</option>
                      <option value="oldest">โพสต์เก่าที่สุด</option>
                    </select>
                  </div>
                </div>

                {(() => {
                  // Compute client-side filtered & sorted posts feed
                  const filteredFeedPosts = posts.filter(post => {
                    const isDone = interactedIds.includes(post.id);
                    if (feedFilter === 'unhelped') return !isDone;
                    if (feedFilter === 'helped') return isDone;
                    return true;
                  });

                  const sortedFeedPosts = [...filteredFeedPosts].sort((a, b) => {
                    const aDone = interactedIds.includes(a.id);
                    const bDone = interactedIds.includes(b.id);

                    // Always deprioritize helped posts to the very bottom
                    if (aDone && !bDone) return 1;
                    if (!aDone && bDone) return -1;

                    if (feedSort === 'newest') {
                      return b.created_at - a.created_at;
                    }
                    if (feedSort === 'oldest') {
                      return a.created_at - b.created_at;
                    }

                    // Default: 'priority' (Urgent / High Bounty first)
                    if (aDone && bDone) {
                      return b.created_at - a.created_at;
                    }

                    // Prioritize uninteracted promoted posts to the absolute top
                    const aPromoted = !!a.is_promoted;
                    const bPromoted = !!b.is_promoted;

                    if (aPromoted && !bPromoted) return -1;
                    if (!aPromoted && bPromoted) return 1;

                    const aPoints = getPostHelpPoints(a.created_at);
                    const bPoints = getPostHelpPoints(b.created_at);

                    if (aPoints !== bPoints) {
                      return bPoints - aPoints;
                    }
                    return b.created_at - a.created_at;
                  });

                  return (
                    <div className="flex flex-col gap-4">
                      {sortedFeedPosts.length === 0 ? (
                        <div className="text-center p-12 border border-dashed border-border-dark rounded-md text-muted-zinc">
                          <h3 className="font-display text-lg text-ink-light mb-1">ไม่พบโพสทวีตในหมวดนี้ขณะนี้</h3>
                          <p className="text-xs">
                            {feedFilter === 'unhelped' 
                              ? 'ยินดีด้วย! คุณช่วยเหลือเพื่อนๆ ในกลุ่มครบหมดแล้ว รอแชร์ใหม่รอบถัดไปได้เลย'
                              : 'ยังไม่มีประวัติการแชร์ในเงื่อนไขการคัดกรองนี้'}
                          </p>
                        </div>
                      ) : (
                        sortedFeedPosts.map(post => {
                          const isDone = interactedIds.includes(post.id);
                          const isExpanded = expandedPostIds.has(post.id);

                      // ── COLLAPSED VIEW (post ที่ช่วยเหลือแล้ว) ──────────────
                      if (isDone && !isExpanded) {
                        return (
                          <div
                            key={post.id}
                            id={`post-${post.id}`}
                            className="bg-surface-dark border border-border-dark rounded-md transition-all duration-200 hover:border-zinc-700 cursor-pointer"
                            onClick={() => setExpandedPostIds(prev => { const next = new Set(prev); next.add(post.id); return next; })}
                          >
                            <div className="flex items-center gap-3 px-4 py-3">
                              <img className="w-7 h-7 rounded-full object-cover flex-shrink-0 opacity-60" src={post.avatar} alt="" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-zinc-500 font-medium">@{post.x_username}</span>
                                  <span className="text-[10px] text-zinc-600">· {getRelativeTime(post.created_at)}</span>
                                </div>
                                <p className="text-xs text-zinc-600 truncate">{post.content?.slice(0, 60)}{post.content?.length > 60 ? '…' : ''}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[9px] uppercase font-extrabold tracking-wider text-[#1d9bf0]">✓ ช่วยเหลือแล้ว</span>
                                <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // ── FULL VIEW ─────────────────────────────────────────────
                      return (
                        <div
                          key={post.id}
                          id={`post-${post.id}`}
                          className="bg-surface-dark border border-border-dark rounded-md flex flex-col gap-4 transition-all duration-300 relative hover:border-zinc-700"
                        >
                          {/* Collapse button (ถ้ากางออกมาจาก collapsed) */}
                          {isDone && (
                            <button
                              className="absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase font-extrabold tracking-wider border border-[#1d9bf0] text-[#1d9bf0] bg-[#1d9bf0]/5 px-2 py-0.5 rounded-sm z-10 hover:bg-[#1d9bf0]/10 transition-colors"
              onClick={() => setExpandedPostIds(prev => { const next = new Set(prev); next.delete(post.id); return next; })}
                            >
                              ✓ ช่วยเหลือแล้ว
                              <svg className="w-3 h-3 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          )}

                          <div className="p-5 flex flex-col gap-4">
                            {/* Platform Sharing Header Indicator */}
                            <div className="flex items-center justify-between border-b border-border-dark/60 pb-3 text-[11px] text-zinc-500 font-medium">
                              <div className="flex items-center gap-2">
                                <img className="w-5 h-5 rounded-full object-cover" src={post.avatar} alt="" />
                                <span>แชร์โดย <strong className="text-zinc-300">@{post.x_username}</strong></span>
                                {post.is_promoted && (
                                  <span className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold px-2 py-0.5 rounded-sm">
                                    ได้รับการโปรโมต
                                  </span>
                                )}
                              </div>
                              <span>ลงเมื่อ {getRelativeTime(post.created_at)}</span>
                            </div>

                            {/* Render the official Twitter oEmbed HTML block */}
                            {post.oembed_html ? (
                              <TweetEmbed html={post.oembed_html} />
                            ) : (
                              /* High-Fidelity Custom Native X Card Fallback */
                              <div className="flex flex-col gap-3 text-left">
                                <div className="flex justify-between items-start w-full">
                                  <div className="flex items-center gap-3">
                                    <img className="w-10 h-10 rounded-full object-cover border border-zinc-900" src={post.avatar} alt="Avatar" />
                                    <div className="flex flex-col">
                                      <h4 className="font-bold text-sm text-white flex items-center gap-1.5 hover:underline cursor-pointer">
                                        {post.x_name}
                                        <svg className="w-4 h-4 text-[#1d9bf0] fill-current" viewBox="0 0 24 24">
                                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                        </svg>
                                      </h4>
                                      <p className="text-xs text-zinc-500">@{post.x_username}</p>
                                    </div>
                                  </div>
                                  <svg className="w-4 h-4 text-white fill-current opacity-60" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                  </svg>
                                </div>

                                <div className="text-white text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                  {post.content.split(/(\s+)/).map((word, idx) => {
                                    if (word.startsWith('#')) return <span key={idx} className="text-[#1d9bf0] hover:underline cursor-pointer font-medium">{word}</span>;
                                    if (word.startsWith('@')) return <span key={idx} className="text-[#1d9bf0] hover:underline cursor-pointer font-medium">{word}</span>;
                                    if (word.startsWith('http://') || word.startsWith('https://')) return <span key={idx} className="text-[#1d9bf0] hover:underline cursor-pointer break-all font-medium">{word}</span>;
                                    return word;
                                  })}
                                </div>

                                <div className="text-zinc-500 text-[10px] pb-1 border-t border-border-dark pt-2.5 mt-1">
                                  {new Date(post.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · {new Date(post.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} · <span className="text-[#1d9bf0] font-semibold">X Verify Collab</span>
                                </div>
                              </div>
                            )}

                            {(() => {
                              const bountyPoints = getPostHelpPoints(post.created_at);

                              if (post.user_id === currentUser?.id) {
                                if (post.is_promoted) {
                                  return (
                                    <div className="border-t border-border-dark pt-3 flex flex-col gap-2">
                                      <button
                                        disabled
                                        className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-500 text-sm font-bold py-2.5 px-4 rounded-sm cursor-not-allowed flex justify-center items-center gap-2"
                                      >
                                        <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                        ได้รับการโปรโมตแล้ว
                                      </button>
                                      <button
                                        className="w-full border border-red-900/40 hover:border-red-600 hover:bg-red-950/20 text-red-400 text-xs font-bold py-2 px-4 rounded-sm transition-all flex justify-center items-center gap-2 cursor-pointer"
                                        onClick={() => handleDeleteOwnPost(post.id)}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        ลบโพสต์ออกจากบอร์ด
                                      </button>
                                    </div>
                                  );
                                }

                                const isEligible = (currentUser?.spendable_points || 0) >= POINTS_TO_PROMOTE;
                                return (
                                  <div className="border-t border-border-dark pt-3 flex flex-col gap-2">
                                    <button
                                      className={`w-full text-sm font-bold py-2.5 px-4 rounded-sm transition-all flex justify-center items-center gap-2 cursor-pointer ${
                                        isEligible
                                          ? 'border border-zinc-500 hover:border-white hover:bg-white/5 text-zinc-200'
                                          : 'border border-zinc-850 bg-zinc-900/30 text-zinc-500 cursor-not-allowed'
                                      }`}
                                      onClick={() => isEligible && handlePromotePost(post.id)}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                      โปรโมตโพสต์นี้ (ใช้ {POINTS_TO_PROMOTE} แต้ม)
                                    </button>
                                    <button
                                      className="w-full border border-red-900/40 hover:border-red-600 hover:bg-red-950/20 text-red-400 text-xs font-bold py-2 px-4 rounded-sm transition-all flex justify-center items-center gap-2 cursor-pointer"
                                      onClick={() => handleDeleteOwnPost(post.id)}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      ลบโพสต์ออกจากบอร์ด
                                    </button>
                                    {!isEligible && (
                                      <p className="text-[10px] text-center text-zinc-500">
                                        แต้มสะสมของคุณไม่เพียงพอ (มี {currentUser?.spendable_points || 0} แต้ม, ต้องการ {POINTS_TO_PROMOTE} แต้ม)
                                      </p>
                                    )}
                                  </div>
                                );
                              }

                              let btnClass = "border border-primary/40 hover:border-primary hover:bg-primary/10 text-primary";
                              let label = "ช่วยเหลือ (+1 คะแนน)";
                              
                              if (bountyPoints === 5) {
                                btnClass = "border border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-400 animate-pulse font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.15)]";
                                label = "ช่วยเหลือ (+5 คะแนน)";
                              } else if (bountyPoints === 2) {
                                btnClass = "border border-orange-500/40 hover:border-orange-500 hover:bg-orange-500/10 text-orange-400";
                                label = "ช่วยเหลือ (+2 คะแนน)";
                              } else if (bountyPoints === 3) {
                                btnClass = "border border-red-500/40 hover:border-red-500 hover:bg-red-500/10 text-red-400 animate-pulse";
                                label = "ช่วยเหลือ (+3 คะแนน)";
                              }

                              return (
                                <div className="border-t border-border-dark pt-3">
                                  <button
                                    className={`w-full ${btnClass} text-sm font-bold py-2.5 px-4 rounded-sm transition-all flex justify-center items-center gap-2 cursor-pointer`}
                                    onClick={() => triggerInteraction(post.id)}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    {label}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>
                );
              })()}
            </div>
          </div>

            {/* RIGHT SIDEBAR: HASHTAG TREND MONITOR & LEADERBOARD STATS */}
            <div className="flex flex-col gap-6">

              {/* Trends Card */}
              <div className="bg-surface-dark border border-border-dark p-5 rounded-md">
                <div className="flex justify-between items-center border-b border-border-dark pb-3 mb-4">
                  <h3 className="text-lg font-bold">กระแสเรียลไทม์ (ประเทศไทย)</h3>
                  <button className="text-[10px] uppercase font-bold text-primary hover:text-primary-hover cursor-pointer" onClick={refreshTrends}>ดึงข้อมูลใหม่</button>
                </div>
                <p className="text-xs text-muted-zinc leading-relaxed mb-4">
                  วิเคราะห์แฮชแท็กยอดนิยมในประเทศไทย เพื่อประกอบการจัดทำเนื้อหาในการเผยแพร่โพสต์
                </p>
                <div className="flex flex-col gap-3">
                  {trends.map(t => (
                    <div
                      key={t.id}
                      className="flex justify-between items-center border-b border-border-dark/30 pb-2.5 cursor-pointer hover:opacity-85"
                      onClick={() => copyHashtag(t.hashtag)}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-ink-light">{t.hashtag}</span>
                        <span className="text-[10px] text-muted-zinc">{t.tweet_volume.toLocaleString()} ทวีต</span>
                      </div>
                      {t.is_hot && <span className="bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-bold py-0.5 px-2 rounded-sm">ยอดนิยม</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard sidebar summary */}
              <div className="bg-surface-dark border border-border-dark p-5 rounded-md">
                <h3 className="text-lg font-bold border-b border-border-dark pb-3 mb-4">อันดับค่าน้ำใจช่วยเหลือ (Top Helpers)</h3>
                <div className="flex flex-col gap-3">
                  {leaderboardUsers.slice(0, 3).map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <span className={`font-display font-bold text-lg w-6 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-400' : 'text-amber-600'}`}>{i + 1}</span>
                      <img className="w-8 h-8 rounded-full" src={u.avatar} alt="Avatar" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold">@{u.x_username}</div>
                        <div className="text-[10px] text-muted-zinc">ครีเอเตอร์ X Verify</div>
                      </div>
                      <span className="text-xs font-bold text-primary">{u.help_score} pt</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================== VIEW 4. LEADERBOARD DETAILED VIEW ==================== */}
        {currentUser && currentUser.x_username && currentUser.role !== 'pending' && currentView === 'leaderboard' && (
          <section className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            <div>
              <h2 className="text-3xl font-bold mb-2">ทำเนียบยอดช่วยเหลือแลกเปลี่ยนแต้ม</h2>
              <p className="text-sm text-muted-zinc">
                ครีเอเตอร์ที่มีค่าน้ำใจช่วยเหลือเพื่อนทวีตในการมีส่วนร่วมสูงสุด โพสต์ของคุณจะปรากฏโดดเด่นบนระบบฟีดเพื่อให้สมาชิกในกลุ่มรีบกลับไปเพิ่ม Engagement เสมอ
              </p>
            </div>

            <div className="flex gap-4 bg-surface-dark border border-border-dark p-4 rounded-md">
              <span className="text-2xl"></span>
              <div className="text-xs text-muted-zinc leading-relaxed">
                <strong>เกณฑ์วัดแต้มน้ำใจและการเก็บสถิติ (ระบบแต้มทวีคูณ Dynamic Bounty):</strong><br />
                • โพสต์แชร์ไม่เกิน 10 นาที (โพสต์ภายใน 10 นาทีแรก) = <span className="font-bold text-emerald-400">+5 แต้ม</span><br />
                • โพสต์แชร์ 10 นาที - 2 ชั่วโมง (ช่วยเหลือปกติ) = <span className="font-bold text-primary">+1 แต้ม</span><br />
                • โพสต์แชร์ 2 - 4 ชั่วโมง (โพสต์ที่ไม่มีการเคลื่อนไหวเกิน 2 ชั่วโมง) = <span className="font-bold text-orange-400">+2 แต้ม</span><br />
                • โพสต์แชร์ 4 - 6 ชั่วโมง (โพสต์ที่ใกล้หมดอายุการแสดงผล) = <span className="font-bold text-red-400">+3 แต้ม</span><br />
                <span className="text-zinc-500">• คะแนนจะได้รับเมื่อช่วยเหลือแชร์ลิงก์ 1 ครั้งต่อโพสต์เท่านั้น (ระบบจะจัดลำดับความเร่งด่วนของโพสต์ขึ้นแสดงผลก่อนอัตโนมัติ)</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {leaderboardUsers.map((u, i) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border rounded-md bg-surface-dark ${isSelf ? 'border-primary' : 'border-border-dark'}`}
                  >
                    <span className="font-display font-bold text-xl sm:text-2xl w-7 sm:w-8 text-muted-zinc shrink-0">{i + 1}</span>
                    <img className="w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0" src={u.avatar} alt="Avatar" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm flex flex-wrap items-center gap-1.5 truncate">
                        @{u.x_username}
                        {isSelf && <span className="text-[9px] uppercase border border-primary text-primary px-1.5 py-0.5 rounded-sm shrink-0">บัญชีของท่าน</span>}
                      </h4>
                      <p className="text-xs text-muted-zinc truncate">{u.bio}</p>
                    </div>
                    <span className="text-base sm:text-lg font-bold text-primary shrink-0">{u.help_score} pt</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}



      </main>

      {/* FOOTER */}
      <footer className="border-t border-border-dark py-6 px-6 text-center text-xs text-muted-zinc mt-12 bg-bg-dark">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 ระบบการจัดการความร่วมมือครีเอเตอร์ สงวนลิขสิทธิ์</p>
        </div>
      </footer>

      {/* Ko-fi Floating Donate Button */}
      <KofiButton />

    </div>
  );
}
