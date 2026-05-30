'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  x_username: string;
  x_name: string;
  role: 'pending' | 'member' | 'admin';
  avatar: string;
  bio: string;
  help_score: number;
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
}

interface TrendingHashtag {
  id: string;
  hashtag: string;
  tweet_volume: number;
  is_hot?: boolean;
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

  const [linkInput, setLinkInput] = useState('');

  // Data states
  const [posts, setPosts] = useState<Post[]>([]);
  const [interactedIds, setInteractedIds] = useState<string[]>([]);
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

    // Auto-login and sync session cookies when returning from Supabase Google SSO
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        try {
          const res = await fetch('/api/auth/x-sso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: session.user.email })
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
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load Twitter widgets script once on mount
  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
    }
  }, []);

  // Hydrate Twitter oEmbed blockquotes whenever posts change
  useEffect(() => {
    // @ts-ignore
    if (window.twttr && window.twttr.widgets) {
      // @ts-ignore
      window.twttr.widgets.load();
    }
  }, [posts]);

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
  }, [currentUser]);

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
  }, [currentUser, currentView]);



  // Handle Google SSO login (100% Free SSO via Supabase Google OAuth)
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`
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
          bio: ''
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

  // Trigger social media exchange interaction (like, repost, quote, mention) using free X Web Intents
  const triggerInteraction = async (postId: string, type: 'repost' | 'like' | 'quote' | 'mention') => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.user_id === currentUser?.id) {
      triggerToast('คุณไม่สามารถช่วยเหลือและแลกคะแนนกับโพสของตัวเองได้', 'error');
      return;
    }

    // Determine points for optimistic update: Repost/Quote = 3, Mention = 2, Like = 1
    let points = 1;
    if (type === 'repost' || type === 'quote') points = 3;
    else if (type === 'mention') points = 2;

    // Save previous state for graceful rollback if API request fails
    const oldUserInteractions = { ...userInteractions };
    const oldHelpScore = currentUser?.help_score || 0;

    // 1. Optimistic Update: Instantly disable button and update state
    setUserInteractions(prev => {
      const postInts = prev[postId] || [];
      if (!postInts.includes(type)) {
        return {
          ...prev,
          [postId]: [...postInts, type]
        };
      }
      return prev;
    });

    if (currentUser) {
      setCurrentUser(prev => prev ? { ...prev, help_score: prev.help_score + points } : null);
    }

    // Generate free X Web Intent URL to trigger manual browser action
    let intentUrl = '';
    const encodedUrl = encodeURIComponent(post.x_post_url || `https://x.com/${post.x_username}/status/${post.x_post_id}`);
    if (type === 'repost') {
      intentUrl = `https://x.com/intent/retweet?tweet_id=${post.x_post_id}`;
    } else if (type === 'like') {
      intentUrl = `https://x.com/intent/like?tweet_id=${post.x_post_id}`;
    } else if (type === 'quote') {
      intentUrl = `https://x.com/intent/tweet?url=${encodedUrl}`;
    } else if (type === 'mention') {
      intentUrl = `https://x.com/intent/tweet?in_reply_to=${post.x_post_id}`;
    }

    if (intentUrl) {
      window.open(intentUrl, '_blank');
      triggerToast(`เปิดหน้าต่าง X.com Intent [${type.toUpperCase()}] สำเร็จ กรุณากดทำรายการแล้วยืนยันรับแต้ม`, 'success');
    }

    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, type })
      });
      const data = await res.json();

      if (data.success) {
        triggerToast(`บันทึกแต้มสำเร็จ! ได้รับ +${data.pointsAwarded} แต้มจากการช่วยเหลือเพื่อนสมาชิก`, 'success');

        // Sync with absolute DB score to keep states perfectly aligned
        if (currentUser) {
          setCurrentUser(prev => prev ? { ...prev, help_score: data.totalScore } : null);
        }

        // Apply visual card feedback
        const postCard = document.getElementById(`post-${postId}`);
        if (postCard) {
          postCard.style.transform = 'scale(0.98)';
          postCard.style.opacity = '0.7';
        }

        // Fetch refreshed posts list in background to sync feed order
        const postsRes = await fetch('/api/posts');
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
        setInteractedIds(postsData.interactedIds || []);
        setUserInteractions(postsData.userInteractions || {});

      } else {
        // Rollback optimistic state if API returned error
        setUserInteractions(oldUserInteractions);
        if (currentUser) {
          setCurrentUser(prev => prev ? { ...prev, help_score: oldHelpScore } : null);
        }
        triggerToast(data.error || 'การช่วยเหลือน้ำใจทวีตล้มเหลว', 'error');
      }
    } catch {
      // Rollback optimistic state if request failed
      setUserInteractions(oldUserInteractions);
      if (currentUser) {
        setCurrentUser(prev => prev ? { ...prev, help_score: oldHelpScore } : null);
      }
      triggerToast('เชื่อมต่อ API ขัดข้อง', 'error');
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
              <div className="flex items-center gap-2 border border-border-dark px-3 py-1 bg-surface-dark rounded-sm text-sm">
                <img className="w-5 h-5 rounded-full" src={currentUser.avatar} alt="Avatar" />
                <span className="font-semibold text-xs">@{currentUser.x_username}</span>
                <span className="text-primary text-xs">✓</span>
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
                <span className="text-primary text-xs">✓</span>
              </div>
              <button className="text-sm text-left text-muted-zinc hover:text-ink-light transition-colors" onClick={() => { window.location.hash = '#dashboard'; setCurrentView('dashboard'); setMobileMenuOpen(false); }}>Dashboard</button>
              <button className="text-sm text-left text-muted-zinc hover:text-ink-light transition-colors" onClick={() => { window.location.hash = '#leaderboard'; setCurrentView('leaderboard'); setMobileMenuOpen(false); }}>Leaderboard</button>
              <button className="text-sm text-left text-red-500 hover:text-red-400 transition-colors" onClick={handleSignOut}>Sign Out</button>
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
            <h2 className="text-2xl font-bold mb-2">ผูกบัญชี 𝕏 (Twitter)</h2>
            <p className="text-sm text-muted-zinc mb-6 leading-relaxed">
              กรุณากรอกข้อมูลโปรไฟล์ X.com ของคุณเพื่อขอสมัครเข้าร่วมกลุ่มแลกเปลี่ยนแต้ม ข้อมูลนี้จะส่งไปให้แอดมินอนุมัติผ่านแผงควบคุมหลังบ้าน
            </p>

            <div className="text-left mb-4">
              <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">
                ป้อน X Handle / Username <span className="text-red-500 font-bold">*</span> (ไม่ต้องใส่ @)
              </label>
              <input
                type="text"
                className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light focus:outline-none focus:border-primary text-sm"
                placeholder="เช่น NongVerify"
                required
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
                className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light focus:outline-none focus:border-primary text-sm"
                placeholder="เช่น น้องติ๊กฟ้าน่ารัก"
                required
                value={onboardXName}
                onChange={e => setOnboardXName(e.target.value)}
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
              💡 <span className="font-semibold text-primary">คำแนะนำสำหรับการทดสอบ:</span> สมาชิกสามารถกดที่เมนู **"เปิดระบบแอดมินหลังบ้าน"** ด้านล่างสุดของหน้าจอ (Footer) เพื่อจำลองสิทธิ์เป็น Admin และเข้าไปกด Approve โปรไฟล์ของตัวท่านเองได้ในหน้าระบบควบคุมผู้ดูแล!
            </div>

            <button
              className="w-full border border-border-dark hover:bg-surface-dark py-3 rounded-sm font-semibold transition-colors cursor-pointer text-sm"
              onClick={checkSession}
            >
              🔄 รีเฟรชเช็คสถานะการเข้าใช้งาน
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
                  🔗 แชร์ทวีตของคุณเข้าสู่บอร์ดแลกเปลี่ยน
                </h3>
                <p className="text-xs text-muted-zinc mb-5 leading-relaxed">
                  นำลิงก์ทวีตจริงที่คุณได้ทำการโพสต์บน X.com ของคุณมาวางลงในกล่องด้านล่าง เพื่อนำขึ้นบอร์ดแลกเปลี่ยนคะแนน Impression กับสมาชิกติ๊กฟ้าคนอื่นๆ ในกลุ่ม
                </p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">ลิงก์โพสทวีตจาก X.com (Twitter)</label>
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
                  💡 <strong>ขั้นตอนการทำคอนเทนต์:</strong> 1. เขียนข้อความและโพสต์ทวีตจริงด้วยตัวเองโดยตรงบนเว็บไซต์ X.com &mdash; 2. คัดลอกลิงก์สถานะทวีตของคุณ &mdash; 3. นำมาวางลงทะเบียนในกล่องด้านบนเพื่อเปิดฟีดแลกคะแนน.
                </div>
              </div>

              {/* Active Posts Feed */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
                  บอร์ดแลกเปลี่ยนยอดสมาชิกที่ใช้งานอยู่
                  <span className="text-xs text-muted-zinc font-normal">แชร์ได้ชั่วโมงละครั้ง โพสหมดอายุใน 12h</span>
                </h2>

                <div className="flex flex-col gap-4">
                  {posts.length === 0 ? (
                    <div className="text-center p-12 border border-dashed border-border-dark rounded-md text-muted-zinc">
                      <h3 className="font-display text-lg text-ink-light mb-1">ยังไม่มีผู้ลงโพสทวีตในระบบขณะนี้</h3>
                      <p className="text-xs">แชร์ลิงก์โพสทวีตแรกของคุณเพื่อรับคะแนน Impression จากเพื่อนๆ ในกลุ่มได้ทันทีก่อนใคร!</p>
                    </div>
                  ) : (
                    posts.map(post => {
                      const isDone = interactedIds.includes(post.id);
                      return (
                        <div
                          key={post.id}
                          id={`post-${post.id}`}
                          className={`bg-surface-dark border p-5 rounded-md flex flex-col gap-4 transition-all duration-300 relative ${isDone ? 'opacity-60 border-border-dark' : 'border-border-dark hover:border-zinc-700'
                            }`}
                        >
                          {isDone && (
                            <span className="absolute top-4 right-4 text-[10px] uppercase font-bold border border-primary text-primary px-2 py-0.5 rounded-sm">
                              ✓ ช่วยเหลือแล้ว
                            </span>
                          )}

                          <div className="flex items-center gap-4">
                            <img className="w-10 h-10 rounded-full" src={post.avatar} alt="Avatar" />
                            <div>
                              <h4 className="font-bold text-sm flex items-center gap-1">
                                {post.x_name}
                                <span className="text-primary text-xs">✓</span>
                              </h4>
                              <p className="text-xs text-muted-zinc">@{post.x_username}</p>
                            </div>
                          </div>

                          {post.oembed_html ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: post.oembed_html }}
                              className="w-full my-1 border border-border-dark bg-bg-dark/30 rounded-sm overflow-hidden p-1 min-h-[100px] flex justify-center text-sm"
                            />
                          ) : (
                            <p className="text-sm leading-relaxed text-ink-light whitespace-pre-wrap">{post.content}</p>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-border-dark pt-3">
                            <button
                              className={`border text-xs font-semibold py-2 px-1 rounded-sm transition-all flex justify-center items-center gap-1.5 ${
                                userInteractions[post.id]?.includes('repost')
                                  ? 'border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed opacity-50'
                                  : 'border-border-dark hover:border-primary hover:bg-primary/5 text-muted-zinc hover:text-primary cursor-pointer'
                              }`}
                              onClick={() => triggerInteraction(post.id, 'repost')}
                              disabled={userInteractions[post.id]?.includes('repost')}
                            >
                              {userInteractions[post.id]?.includes('repost') ? '✓ Reposted' : '🔄 Repost'}
                            </button>
                            <button
                              className={`border text-xs font-semibold py-2 px-1 rounded-sm transition-all flex justify-center items-center gap-1.5 ${
                                userInteractions[post.id]?.includes('like')
                                  ? 'border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed opacity-50'
                                  : 'border-border-dark hover:border-primary hover:bg-primary/5 text-muted-zinc hover:text-primary cursor-pointer'
                              }`}
                              onClick={() => triggerInteraction(post.id, 'like')}
                              disabled={userInteractions[post.id]?.includes('like')}
                            >
                              {userInteractions[post.id]?.includes('like') ? '✓ Liked' : '❤️ Like'}
                            </button>
                            <button
                              className={`border text-xs font-semibold py-2 px-1 rounded-sm transition-all flex justify-center items-center gap-1.5 ${
                                userInteractions[post.id]?.includes('quote')
                                  ? 'border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed opacity-50'
                                  : 'border-border-dark hover:border-primary hover:bg-primary/5 text-muted-zinc hover:text-primary cursor-pointer'
                              }`}
                              onClick={() => triggerInteraction(post.id, 'quote')}
                              disabled={userInteractions[post.id]?.includes('quote')}
                            >
                              {userInteractions[post.id]?.includes('quote') ? '✓ Quoted' : '💬 Quote'}
                            </button>
                            <button
                              className={`border text-xs font-semibold py-2 px-1 rounded-sm transition-all flex justify-center items-center gap-1.5 ${
                                userInteractions[post.id]?.includes('mention')
                                  ? 'border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed opacity-50'
                                  : 'border-border-dark hover:border-primary hover:bg-primary/5 text-muted-zinc hover:text-primary cursor-pointer'
                              }`}
                              onClick={() => triggerInteraction(post.id, 'mention')}
                              disabled={userInteractions[post.id]?.includes('mention')}
                            >
                              {userInteractions[post.id]?.includes('mention') ? '✓ Mentioned' : '✉️ Mention'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT SIDEBAR: HASHTAG TREND MONITOR & LEADERBOARD STATS */}
            <div className="flex flex-col gap-6">

              {/* Trends Card */}
              <div className="bg-surface-dark border border-border-dark p-5 rounded-md">
                <div className="flex justify-between items-center border-b border-border-dark pb-3 mb-4">
                  <h3 className="text-lg font-bold">กระแสเรียลไทม์ (ประเทศไทย)</h3>
                  <button className="text-[10px] uppercase font-bold text-primary hover:text-primary-hover cursor-pointer" onClick={refreshTrends}>🔄 ดึงข้อมูลใหม่</button>
                </div>
                <p className="text-xs text-muted-zinc leading-relaxed mb-4">
                  ระบบวิเคราะห์แท็กยอดนิยมในไทย แนะนำหยิบแท็กเหล่านี้ไปเพิ่มลงโพสเพื่อเปิด Impression หรือเพิ่มค่าการมองเห็นทวีต
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
                      {t.is_hot && <span className="bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-bold py-0.5 px-2 rounded-sm">🔥 มาแรง</span>}
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
                ครีเอเตอร์ที่มีค่าน้ำใจช่วยเหลือเพื่อนทวีตในการกด Like, Repost, Quote, Mention สูงสุด โพสของคุณจะปรากฏโดดเด่นบนระบบฟีดเพื่อให้สมาชิกในกลุ่มรีบกลับไปเพิ่ม Engagement เสมอ
              </p>
            </div>

            <div className="flex gap-4 bg-surface-dark border border-border-dark p-4 rounded-md">
              <span className="text-2xl">🏆</span>
              <div className="text-xs text-muted-zinc leading-relaxed">
                <strong>เกณฑ์วัดแต้มน้ำใจและการเก็บสถิติ:</strong><br />
                • Repost / Quote ทวีตเพื่อนร่วมกลุ่ม = <span className="font-bold text-primary">+3 แต้ม</span><br />
                • Mention ตอบกลับทวีตเพื่อน = <span className="font-bold text-primary">+2 แต้ม</span><br />
                • Like ทวีตเพื่อน = <span className="font-bold text-primary">+1 แต้ม</span>
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
          <p>© 2026 ติ๊กฟ้าช่วยติ๊กฟ้า. All Rights Reserved. แพลตฟอร์มปิดจำลองค่าน้ำใจและความร่วมมือ</p>
        </div>
      </footer>

    </div>
  );
}
