'use client';

import { useState, useEffect } from 'react';

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

interface Toast {
  id: string;
  msg: string;
  type: 'default' | 'success' | 'error';
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [adminStats, setAdminStats] = useState({
    pending: 0,
    members: 0
  });

  const triggerToast = (msg: string, type: 'default' | 'success' | 'error' = 'default') => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Fetch admin authentication session
  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/admin-login');
      const data = await res.json();
      if (data.authenticated) {
        // Authenticated as admin — load a placeholder admin user object
        setCurrentUser({
          id: 'admin',
          x_username: 'admin',
          x_name: 'ผู้ดูแลระบบ',
          role: 'admin',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
          bio: '',
          help_score: 0
        });
        loadAdminData();
      } else {
        setCurrentUser(null);
      }
    } catch {
      triggerToast('ไม่สามารถเชื่อมต่อระบบเซสชันได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setPendingUsers(data.pending || []);
      setAdminStats({
        pending: data.pending?.length || 0,
        members: data.members || 0
      });
    } catch {
      triggerToast('ไม่สามารถโหลดข้อมูลได้', 'error');
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Handle fixed username/password admin login
  const handleAdminLogin = async () => {
    if (!loginUsername || !loginPassword) {
      triggerToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'error');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser({
          id: 'admin',
          x_username: 'admin',
          x_name: 'ผู้ดูแลระบบ',
          role: 'admin',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
          bio: '',
          help_score: 0
        });
        triggerToast('ลงชื่อเข้าใช้งานในฐานะผู้ดูแลระบบสำเร็จ', 'success');
        loadAdminData();
      } else {
        triggerToast(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      }
    } catch {
      triggerToast('ไม่สามารถเชื่อมต่อระบบได้', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // Sign out admin
  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/admin-login', { method: 'DELETE' });
      setCurrentUser(null);
      setLoginUsername('');
      setLoginPassword('');
      triggerToast('ออกจากระบบผู้ดูแลเรียบร้อย', 'success');
    } catch {
      triggerToast('ออกจากระบบล้มเหลว', 'error');
    }
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
        triggerToast(`อนุมัติสิทธิ์ติ๊กฟ้าแก่ผู้ใช้ @${data.user.x_username} สำเร็จ`, 'success');
        
        const card = document.getElementById(`pending-card-${userId}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(-10px)';
        }
        
        setTimeout(() => {
          setPendingUsers(prev => prev.filter(u => u.id !== userId));
          setAdminStats(prev => ({
            ...prev,
            pending: Math.max(0, prev.pending - 1),
            members: prev.members + 1
          }));
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
        triggerToast('ปฏิเสธการขอสมัครและลบโปรไฟล์ออกเรียบร้อย', 'success');
        
        const card = document.getElementById(`pending-card-${userId}`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(-10px)';
        }

        setTimeout(() => {
          setPendingUsers(prev => prev.filter(u => u.id !== userId));
          setAdminStats(prev => ({
            ...prev,
            pending: Math.max(0, prev.pending - 1)
          }));
        }, 300);
      }
    } catch {
      triggerToast('ปฏิเสธบัญชีผิดพลาด', 'error');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark text-ink-light">
        <div className="text-center font-display text-2xl animate-pulse">กำลังโหลดระบบแอดมินหลังบ้าน...</div>
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
            className={`flex items-center justify-between bg-surface-dark border border-border-dark p-4 rounded-sm shadow-2xl transition-all duration-300 border-l-4 ${
              t.type === 'error' ? 'border-l-red-500' : t.type === 'success' ? 'border-l-green-500' : 'border-l-primary'
            }`}
          >
            <span className="text-sm font-medium pr-4">{t.msg}</span>
            <button className="text-muted-zinc hover:text-ink-light font-bold" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>

      {/* HEADER SECTION */}
      {currentUser && (
        <header className="border-b border-border-dark py-4 px-4 sm:px-6 sticky top-0 bg-bg-dark/95 backdrop-blur-sm z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
            <div className="brand">
              <h1 className="text-xl sm:text-2xl font-bold font-display">ติ๊กฟ้าช่วยติ๊กฟ้า<span className="text-primary">.</span></h1>
            </div>
            
            <nav className="flex flex-wrap items-center gap-3 sm:gap-6">
              <span className="text-xs sm:text-sm font-semibold text-primary hidden sm:block">แผงควบคุมระบบ (Admin Only)</span>
              
              <div className="flex items-center gap-2 border border-border-dark px-2 sm:px-3 py-1 bg-surface-dark rounded-sm text-sm">
                <img className="w-5 h-5 rounded-full" src={currentUser.avatar} alt="Avatar" />
                <span className="font-semibold text-xs">@{currentUser.x_username || 'Admin'}</span>
                <span className="text-primary text-xs">✓</span>
              </div>
              
              <button 
                className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors" 
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 justify-center">
        
        {/* ==================== VIEW 1. ADMIN LOGIN SCREEN ==================== */}
        {!currentUser && (
          <section className="max-w-sm w-full mx-auto my-12 border border-border-dark bg-surface-dark p-6 sm:p-8 rounded-md text-center">
            <h2 className="text-3xl font-bold mb-2 font-display">ผู้ดูแลระบบหลังบ้าน</h2>
            <p className="text-sm text-muted-zinc mb-6 leading-relaxed">
              ติ๊กฟ้าช่วยติ๊กฟ้า &bull; Admin Console Panel
            </p>

            <div className="flex flex-col gap-4 text-left">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">ชื่อผู้ใช้</label>
                <input
                  type="text"
                  className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light focus:outline-none focus:border-primary text-sm"
                  placeholder="username"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-2">รหัสผ่าน</label>
                <input
                  type="password"
                  className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light focus:outline-none focus:border-primary text-sm"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  autoComplete="current-password"
                />
              </div>
              <button
                className="w-full bg-primary text-white font-bold py-3 px-4 rounded-sm transition-colors cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={handleAdminLogin}
                disabled={loginLoading}
              >
                {loginLoading ? 'กำลังตรวจสอบ...' : '🔒 เข้าสู่ระบบผู้ดูแล'}
              </button>
            </div>
            
            <div className="text-left mt-6 text-[10px] text-muted-zinc leading-relaxed border-t border-border-dark/50 pt-4">
              * เฉพาะบัญชีที่ได้รับบทบาทเป็น 'admin' ในระบบฐานข้อมูลเท่านั้นที่จะได้รับสิทธิ์ในการเข้าชมและใช้งานส่วนหน้านี้
            </div>
          </section>
        )}

        {/* ==================== VIEW 2. ADMIN BACKOFFICE PANEL ==================== */}
        {currentUser && (
          <section className="flex flex-col gap-6 my-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-border-dark pb-4">
              <h2 className="text-xl sm:text-2xl font-bold font-display">ระบบอนุมัติและควบคุมผู้ดูแล (Admin Backoffice)</h2>
              <span className="bg-surface-dark border border-border-dark px-3 py-1 text-xs text-muted-zinc font-semibold rounded-sm self-start sm:self-auto">ผู้ดูแลสูงสุด</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Approvals */}
              <div className="lg:col-span-2 bg-surface-dark border border-border-dark p-6 rounded-md">
                <h3 className="text-lg font-bold border-b border-border-dark pb-3 mb-4 font-display">อนุมัติสมาชิกผู้ขอเข้ากลุ่มใหม่ (Pending Approvals)</h3>
                <p className="text-xs text-muted-zinc mb-6 leading-relaxed">
                  ตรวจสอบโปรไฟล์ผู้ทวีตขอแรกเข้า แอดมินต้องทำการตรวจสอบว่าโปรไฟล์มี X Verify (ติ๊กฟ้า) ของจริงและมีความเหมาะสม จึงกดอนุมัติสิทธิ์ (Approve) บัญชีสมาชิก
                </p>

                <div className="flex flex-col gap-4">
                  {pendingUsers.length === 0 ? (
                    <div className="text-center p-8 text-muted-zinc text-sm border border-dashed border-border-dark rounded-sm">
                      ไม่มีคำขออนุมัติสมัครสมาชิกใหม่แรกเข้าขณะนี้
                    </div>
                  ) : (
                    pendingUsers.map(u => (
                      <div 
                        key={u.id} 
                        id={`pending-card-${u.id}`}
                        className="border border-border-dark p-4 rounded-sm bg-bg-dark flex flex-col md:flex-row md:items-center gap-4 transition-all duration-300"
                      >
                        <img className="w-12 h-12 rounded-full shrink-0" src={u.avatar} alt="Avatar" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm flex items-center gap-1.5 truncate">{u.x_name} <span className="text-primary text-xs">✓</span></h4>
                          <p className="text-xs text-muted-zinc mb-1 truncate">@{u.x_username}</p>
                          <a 
                            href={`https://x.com/${u.x_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline font-semibold block my-1.5 truncate"
                          >
                            🔍 ตรวจสอบโปรไฟล์จริง: x.com/{u.x_username}
                          </a>
                          <p className="text-xs text-ink-light break-words">{u.bio}</p>
                        </div>
                        <div className="flex gap-2 shrink-0 self-end md:self-center">
                          <button 
                            className="bg-green-600 hover:bg-green-500 text-ink-light font-bold text-xs py-2 px-4 rounded-sm cursor-pointer"
                            onClick={() => handleApproveUser(u.id)}
                          >
                            อนุมัติเข้ากลุ่ม
                          </button>
                          <button 
                            className="bg-red-600 hover:bg-red-500 text-ink-light font-bold text-xs py-2 px-4 rounded-sm cursor-pointer"
                            onClick={() => handleRejectUser(u.id)}
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                
                {/* Stats */}
                <div className="bg-surface-dark border border-border-dark p-5 rounded-md">
                  <h3 className="text-sm font-bold border-b border-border-dark pb-3 mb-4 uppercase tracking-wider text-muted-zinc">สถิติ</h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="border border-border-dark p-3 rounded-sm bg-bg-dark">
                      <div className="text-[10px] text-muted-zinc uppercase">รออนุมัติ</div>
                      <div className="text-xl font-bold">{adminStats.pending}</div>
                    </div>
                    <div className="border border-border-dark p-3 rounded-sm bg-bg-dark">
                      <div className="text-[10px] text-muted-zinc uppercase">สมาชิก</div>
                      <div className="text-xl font-bold">{adminStats.members}</div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </section>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-border-dark py-6 px-6 text-center text-xs text-muted-zinc bg-bg-dark">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 ติ๊กฟ้าช่วยติ๊กฟ้า. All Rights Reserved. แพลตฟอร์มปิดจำลองค่าน้ำใจและความร่วมมือ</p>
        </div>
      </footer>

    </div>
  );
}
