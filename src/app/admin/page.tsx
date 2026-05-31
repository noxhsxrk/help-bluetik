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
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Tabs & Navigation
  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'utilities'>('pending');
  
  // All Users Data
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'pending' | 'member' | 'admin'>('all');
  
  // Auth Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editXUsername, setEditXUsername] = useState('');
  const [editXName, setEditXName] = useState('');
  const [editGoogleEmail, setEditGoogleEmail] = useState('');
  const [editRole, setEditRole] = useState<'pending' | 'member' | 'admin'>('member');
  const [editHelpScore, setEditHelpScore] = useState<number>(0);
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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
      if (data.users) {
        setAllUsers(data.users);
      }
    } catch {
      triggerToast('ไม่สามารถโหลดข้อมูลผู้ใช้ได้', 'error');
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

  // Quick action: Approve User
  const handleApproveUser = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`อนุมัติสิทธิ์แก่ผู้ใช้ @${data.user.x_username} สำเร็จ`, 'success');
        
        // Update local state smoothly
        setAllUsers(prev =>
          prev.map(u => (u.id === userId ? { ...u, role: 'member' } : u))
        );
      } else {
        triggerToast(data.error || 'ดำเนินการล้มเหลว', 'error');
      }
    } catch {
      triggerToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  };

  // Quick action: Delete User
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`คุณต้องการลบข้อมูลสมาชิก @${username} ออกจากระบบอย่างถาวรใช่หรือไม่?\n(โพสและคะแนนทั้งหมดของผู้ใช้จะถูกลบไปด้วย)`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`ลบสมาชิก @${username} สำเร็จ`, 'success');
        setAllUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        triggerToast(data.error || 'ลบสมาชิกผิดพลาด', 'error');
      }
    } catch {
      triggerToast('เกิดข้อผิดพลาดในการลบสมาชิก', 'error');
    }
  };

  // Edit Modal triggers
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditXUsername(user.x_username);
    setEditXName(user.x_name);
    setEditGoogleEmail(user.google_email || '');
    setEditRole(user.role);
    setEditHelpScore(user.help_score);
    setEditAvatar(user.avatar);
    setEditBio(user.bio || '');
  };

  const closeEditModal = () => {
    setEditingUser(null);
  };

  // Save edits of user details
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (!editXUsername.trim()) {
      triggerToast('กรุณากรอก @username', 'error');
      return;
    }

    const cleanUsername = editXUsername.replace('@', '').trim();

    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          updates: {
            x_username: cleanUsername,
            x_name: editXName.trim() || cleanUsername,
            google_email: editGoogleEmail.trim(),
            role: editRole,
            help_score: editHelpScore,
            avatar: editAvatar.trim(),
            bio: editBio.trim()
          }
        })
      });
      
      const data = await res.json();
      if (data.success) {
        triggerToast(`อัปเดตข้อมูลของ @${cleanUsername} เรียบร้อยแล้ว`, 'success');
        setAllUsers(prev =>
          prev.map(u => (u.id === editingUser.id ? data.user : u))
        );
        closeEditModal();
      } else {
        triggerToast(data.error || 'ไม่สามารถแก้ไขข้อมูลได้', 'error');
      }
    } catch {
      triggerToast('ข้อผิดพลาดการเชื่อมต่อ API', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Utility resets
  const handleResetCooldowns = async () => {
    if (!confirm('คุณต้องการรีเซ็ตประวัติคูลดาวน์โพสต์ทั้งหมดใช่หรือไม่?\n(ทุกคนจะสามารถโพสต์ทวีตได้ทันทีโดยไม่ต้องรอคูลดาวน์)')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/cooldowns', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        triggerToast('รีเซ็ตประวัติคูลดาวน์โพสต์ทั้งหมดเรียบร้อยแล้ว', 'success');
      } else {
        triggerToast(data.error || 'ล้างประวัติคูลดาวน์ล้มเหลว', 'error');
      }
    } catch {
      triggerToast('เชื่อมต่อ API รีเซ็ตคูลดาวน์ผิดพลาด', 'error');
    }
  };

  const handleResetAllScores = async () => {
    if (!confirm('⚠️ คำเตือนที่เป็นอันตราย!\nคุณต้องการล้างคะแนนน้ำใจของผู้ใช้ทั้งหมดให้เป็น 0 และเคลียร์ประวัติการกดช่วยเหลือทั้งหมดใช่หรือไม่? (การกระทำนี้ไม่สามารถเรียกคืนได้)')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/reset-scores', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        triggerToast('ล้างคะแนนน้ำใจและประวัติการช่วยเหลือทั้งหมดสำเร็จ!', 'success');
        setAllUsers(prev => prev.map(u => ({ ...u, help_score: 0 })));
      } else {
        triggerToast(data.error || 'ล้างคะแนนสะสมล้มเหลว', 'error');
      }
    } catch {
      triggerToast('เชื่อมต่อ API รีเซ็ตคะแนนผิดพลาด', 'error');
    }
  };

  // Statistics calculation
  const pendingUsers = allUsers.filter(u => u.role === 'pending' && u.x_username !== '');
  const activeMembers = allUsers.filter(u => u.role === 'member');
  const admins = allUsers.filter(u => u.role === 'admin');

  // Search & Filter
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = 
      u.x_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.x_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.google_email && u.google_email.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesRole = roleFilter === 'all' ? true : u.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

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
                className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors cursor-pointer" 
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
          <section className="max-w-sm w-full mx-auto my-12 border border-border-dark bg-surface-dark p-6 sm:p-8 rounded-md text-center shadow-2xl">
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
                className="w-full bg-primary text-white font-bold py-3 px-4 rounded-sm transition-colors cursor-pointer text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primary-hover"
                onClick={handleAdminLogin}
                disabled={loginLoading}
              >
                {loginLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบผู้ดูแลระบบ'}
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
            
            {/* STATS OVERVIEW ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-dark border border-border-dark p-4 rounded-md">
                <span className="text-[10px] text-muted-zinc uppercase tracking-wider block">ผู้ใช้ทั้งหมด</span>
                <span className="text-2xl font-bold font-sans text-ink-light mt-1 block">{allUsers.length} คน</span>
              </div>
              <div className="bg-surface-dark border border-border-dark p-4 rounded-md relative overflow-hidden">
                <span className="text-[10px] text-muted-zinc uppercase tracking-wider block">รออนุมัติ</span>
                <span className="text-2xl font-bold font-sans text-orange-400 mt-1 block">{pendingUsers.length} คำขอ</span>
                {pendingUsers.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>}
              </div>
              <div className="bg-surface-dark border border-border-dark p-4 rounded-md">
                <span className="text-[10px] text-muted-zinc uppercase tracking-wider block">สมาชิกปกติ</span>
                <span className="text-2xl font-bold font-sans text-green-400 mt-1 block">{activeMembers.length} คน</span>
              </div>
              <div className="bg-surface-dark border border-border-dark p-4 rounded-md">
                <span className="text-[10px] text-muted-zinc uppercase tracking-wider block">แอดมินทั้งหมด</span>
                <span className="text-2xl font-bold font-sans text-purple-400 mt-1 block">{admins.length} คน</span>
              </div>
            </div>

            {/* TAB SELECTORS */}
            <div className="flex border-b border-border-dark gap-2">
              <button
                className={`py-3 px-4 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
                  activeTab === 'pending'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-zinc hover:text-ink-light'
                }`}
                onClick={() => setActiveTab('pending')}
              >
                อนุมัติสมาชิกใหม่ ({pendingUsers.length})
              </button>
              
              <button
                className={`py-3 px-4 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
                  activeTab === 'users'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-zinc hover:text-ink-light'
                }`}
                onClick={() => setActiveTab('users')}
              >
                จัดการรายชื่อสมาชิก ({allUsers.length})
              </button>

              <button
                className={`py-3 px-4 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
                  activeTab === 'utilities'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-zinc hover:text-ink-light'
                }`}
                onClick={() => setActiveTab('utilities')}
              >
                เครื่องมือผู้ดูแลระบบ
              </button>
            </div>

            {/* MAIN TAB CONTENT CONTAINER */}
            <div className="min-h-[400px]">
              
              {/* ── TAB 1. PENDING APPROVALS ── */}
              {activeTab === 'pending' && (
                <div className="bg-surface-dark border border-border-dark p-6 rounded-md">
                  <h3 className="text-lg font-bold border-b border-border-dark pb-3 mb-4 font-display flex items-center gap-2">
                    <span>คำขออนุมัติแรกเข้า (Pending Approvals)</span>
                    {pendingUsers.length > 0 && <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full font-bold">{pendingUsers.length}</span>}
                  </h3>
                  <p className="text-xs text-muted-zinc mb-6 leading-relaxed">
                    ตรวจสอบโปรไฟล์ผู้ขอลงทะเบียน แอดมินควรยืนยันตัวตนว่ามี X Verify (ติ๊กฟ้า) และกรอกข้อมูลอย่างเหมาะสมก่อนอนุมัติสิทธิ์เข้าสู่ระบบบอร์ดกลาง
                  </p>

                  <div className="flex flex-col gap-4">
                    {pendingUsers.length === 0 ? (
                      <div className="text-center p-12 text-muted-zinc text-sm border border-dashed border-border-dark rounded-sm">
                        ไม่มีคำขออนุมัติสมัครสมาชิกใหม่แรกเข้าในขณะนี้
                      </div>
                    ) : (
                      pendingUsers.map(u => (
                        <div 
                          key={u.id} 
                          className="border border-border-dark p-5 rounded-sm bg-bg-dark/50 hover:border-zinc-700 transition-all flex flex-col md:flex-row md:items-center gap-5"
                        >
                          <img className="w-14 h-14 rounded-full shrink-0 border border-zinc-800" src={u.avatar} alt="" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-base flex items-center gap-1.5 truncate">{u.x_name}</h4>
                            <p className="text-xs text-muted-zinc mb-1 truncate">@{u.x_username}</p>
                            <span className="text-[11px] text-zinc-500 block truncate">{u.google_email || 'ไม่ได้ลงทะเบียนอีเมล'}</span>
                            
                            <a 
                              href={`https://x.com/${u.x_username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold my-2"
                            >
                              ตรวจสอบโปรไฟล์บน X.com ↗
                            </a>
                            <p className="text-xs text-ink-light bg-bg-dark/80 p-2.5 rounded-sm border border-border-dark/60 break-words mt-1">{u.bio || '(ไม่มีรายละเอียดประวัติ)'}</p>
                          </div>
                          <div className="flex md:flex-col gap-2 shrink-0 self-end md:self-center w-full md:w-auto">
                            <button 
                              className="flex-1 bg-green-600 hover:bg-green-500 text-ink-light font-bold text-xs py-2.5 px-4 rounded-sm cursor-pointer transition-colors text-center"
                              onClick={() => handleApproveUser(u.id)}
                            >
                              อนุมัติสิทธิ์ติ๊กฟ้า
                            </button>
                            <button 
                              className="flex-1 bg-zinc-800 hover:bg-red-700 text-ink-light font-bold text-xs py-2.5 px-4 rounded-sm cursor-pointer transition-colors text-center"
                              onClick={() => handleDeleteUser(u.id, u.x_username)}
                            >
                              ลบ/ปฏิเสธคำขอ
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 2. MEMBER MANAGEMENT LIST ── */}
              {activeTab === 'users' && (
                <div className="bg-surface-dark border border-border-dark p-6 rounded-md">
                  
                  {/* Search & Filter Header bar */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
                    <div className="w-full md:w-72 relative">
                      <input
                        type="text"
                        placeholder="ค้นหาชื่อ, @username หรืออีเมล..."
                        className="w-full bg-bg-dark border border-border-dark py-2 px-4 rounded-sm text-sm text-ink-light focus:outline-none focus:border-primary"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                      <select
                        className="bg-bg-dark border border-border-dark px-3 py-2 rounded-sm text-xs text-ink-light focus:outline-none focus:border-primary"
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value as any)}
                      >
                        <option value="all">บทบาท: ทั้งหมด</option>
                        <option value="member">บทบาท: member</option>
                        <option value="admin">บทบาท: admin</option>
                        <option value="pending">บทบาท: pending</option>
                      </select>
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border-dark text-muted-zinc text-xs uppercase tracking-wider">
                          <th className="py-3 px-4">สมาชิก</th>
                          <th className="py-3 px-4">อีเมล (Google)</th>
                          <th className="py-3 px-4">บทบาท</th>
                          <th className="py-3 px-4 text-center">ค่าน้ำใจ (Score)</th>
                          <th className="py-3 px-4 text-right">ดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center p-12 text-muted-zinc">
                              ไม่พบรายชื่อผู้ใช้ที่ตรงกับการค้นหา
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(u => (
                            <tr key={u.id} className="border-b border-border-dark/60 hover:bg-bg-dark/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <img className="w-9 h-9 rounded-full border border-zinc-800" src={u.avatar} alt="" />
                                  <div className="min-w-0">
                                    <div className="font-bold text-ink-light truncate text-sm flex items-center gap-1">
                                      {u.x_name}
                                    </div>
                                    <a
                                      href={`https://x.com/${u.x_username}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline font-semibold block"
                                    >
                                      @{u.x_username} ↗
                                    </a>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs font-mono text-zinc-400">
                                {u.google_email || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-sm tracking-wider ${
                                  u.role === 'admin' 
                                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                    : u.role === 'member'
                                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                                    : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-primary text-base">
                                {u.help_score} pt
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={() => openEditModal(u)}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-ink-light px-3 py-1.5 rounded-sm text-xs font-semibold cursor-pointer transition-colors"
                                  >
                                    แก้ไข
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.x_username)}
                                    className="bg-red-950/40 border border-red-900/30 text-red-400 hover:bg-red-900/60 hover:text-white px-3 py-1.5 rounded-sm text-xs font-semibold cursor-pointer transition-all"
                                  >
                                    ลบ
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── TAB 3. SYSTEM UTILITIES ── */}
              {activeTab === 'utilities' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* reset cooldowns */}
                  <div className="bg-surface-dark border border-border-dark p-6 rounded-md flex flex-col justify-between">
                    <div>
                      <h4 className="text-lg font-bold font-display text-ink-light mb-2">ล้างประวัติคูลดาวน์โพสต์ทั้งหมด (Reset Cooldowns)</h4>
                      <p className="text-xs text-muted-zinc leading-relaxed mb-6">
                        สั่งล้างคูลดาวน์การแชร์โพสต์ทวีตของผู้ใช้ทุกคนทันที ทำให้ผู้ใช้ที่ติดคูลดาวน์ (เช่น โพสต์ล่าสุดเมื่อไม่นานมานี้) สามารถแชร์ลิงก์ทวีตใหม่ได้ทันทีโดยไม่ต้องรอให้ครบ 1 ชั่วโมงครึ่ง
                      </p>
                    </div>
                    <button
                      onClick={handleResetCooldowns}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-ink-light font-bold py-3 px-4 rounded-sm text-sm transition-colors cursor-pointer text-center"
                    >
                      รีเซ็ตคูลดาวน์โพสต์ทั้งหมด
                    </button>
                  </div>

                  {/* reset scores */}
                  <div className="bg-surface-dark border border-red-900/30 p-6 rounded-md flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] uppercase font-bold tracking-widest px-4 py-1 rotate-45 translate-x-4 translate-y-3">
                      Dangerous
                    </div>
                    <div>
                      <h4 className="text-lg font-bold font-display text-red-400 mb-2">ล้างแต้มสะสมและประวัติกิจกรรม (Reset Scores & History)</h4>
                      <p className="text-xs text-muted-zinc leading-relaxed mb-6">
                        ล้างคะแนนค่าน้ำใจ (`help_score`) ของผู้ใช้ทุกคนในฐานข้อมูลให้กลับไปเป็น **0 แต้ม** และลบประวัติความร่วมมือ (`interactions`) ทั้งหมดในระบบ เพื่อเริ่มฤดูกาล/กิจกรรมสะสมน้ำใจใหม่พร้อมกัน
                      </p>
                    </div>
                    <button
                      onClick={handleResetAllScores}
                      className="w-full bg-red-950/40 border border-red-700/50 text-red-400 hover:bg-red-600 hover:text-white font-bold py-3 px-4 rounded-sm text-sm transition-all cursor-pointer text-center"
                    >
                      รีเซ็ตคะแนนสะสมทั้งหมด
                    </button>
                  </div>

                </div>
              )}

            </div>
          </section>
        )}

      </main>

      {/* EDIT USER MODAL LAYER */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div 
            className="bg-surface-dark border border-border-dark rounded-md w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-b border-border-dark px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold font-display">แก้ไขข้อมูลสมาชิก</h3>
              <button 
                onClick={closeEditModal}
                className="text-zinc-500 hover:text-ink-light text-2xl font-bold cursor-pointer transition-colors"
              >
                ×
              </button>
            </div>

            {/* Modal Body (Scrollable if needed) */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              
              <div className="flex items-center gap-4 border border-border-dark/60 bg-bg-dark/40 p-3.5 rounded-sm mb-2">
                <img className="w-12 h-12 rounded-full border border-zinc-800" src={editAvatar} alt="" />
                <div>
                  <span className="text-xs text-muted-zinc uppercase tracking-wider block">กำลังแก้ไขผู้ใช้งาน</span>
                  <span className="font-bold text-sm text-ink-light">@{editingUser.x_username} (ID: {editingUser.id})</span>
                </div>
              </div>

              {/* X Username */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-1.5">
                  X @Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light text-sm focus:outline-none focus:border-primary"
                  value={editXUsername}
                  onChange={e => setEditXUsername(e.target.value)}
                  placeholder="เช่น brandnewnox (ไม่ต้องใส่ @)"
                />
                <span className="text-[10px] text-zinc-500 block mt-1 leading-relaxed">
                  * ไม่ต้องกรอกสัญลักษณ์ @, ระบบจะตัดและทำความสะอาดให้อัตโนมัติเมื่อกดบันทึก
                </span>
              </div>

              {/* X Display Name */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-1.5">
                  ชื่อแสดงบนแพลตฟอร์ม (Display Name)
                </label>
                <input
                  type="text"
                  className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light text-sm focus:outline-none focus:border-primary"
                  value={editXName}
                  onChange={e => setEditXName(e.target.value)}
                  placeholder="ระบุชื่อแสดงความร่วมมือ"
                />
              </div>

              {/* Google Email */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-1.5">
                  อีเมล (Google Email)
                </label>
                <input
                  type="email"
                  className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light text-sm focus:outline-none focus:border-primary"
                  value={editGoogleEmail}
                  onChange={e => setEditGoogleEmail(e.target.value)}
                  placeholder="เช่น user@gmail.com"
                />
              </div>

              {/* Avatar URL & Dicebear preset */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold">
                    ลิงก์รูปอวาตาร์ (Avatar URL)
                  </label>
                  <button
                    onClick={() => setEditAvatar(`https://api.dicebear.com/7.x/identicon/svg?seed=${Math.random().toString(36).substring(2, 7)}`)}
                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                  >
                    สุ่มรูปภาพโปรไฟล์
                  </button>
                </div>
                <input
                  type="text"
                  className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light text-sm focus:outline-none focus:border-primary"
                  value={editAvatar}
                  onChange={e => setEditAvatar(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {/* Bio Description */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-1.5">
                  รายละเอียดประวัติ (Bio)
                </label>
                <textarea
                  className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light text-sm focus:outline-none focus:border-primary h-20 resize-none"
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="เขียนอธิบายตัวตน..."
                />
              </div>

              {/* Role & Help Score Double columns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-1.5">
                    บทบาทระบบ (Role)
                  </label>
                  <select
                    className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light text-sm focus:outline-none focus:border-primary"
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as any)}
                  >
                    <option value="pending">pending (รออนุมัติ)</option>
                    <option value="member">member (สมาชิกหลัก)</option>
                    <option value="admin">admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted-zinc font-semibold mb-1.5">
                    คะแนนสะสม (Help Score)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-bg-dark border border-border-dark p-2.5 rounded-sm text-ink-light text-sm focus:outline-none focus:border-primary"
                    value={editHelpScore}
                    onChange={e => setEditHelpScore(Number(e.target.value))}
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="border-t border-border-dark px-6 py-4 flex justify-end gap-3 bg-bg-dark/20">
              <button
                onClick={closeEditModal}
                className="bg-zinc-800 hover:bg-zinc-700 text-ink-light font-bold text-xs py-2 px-4 rounded-sm cursor-pointer transition-colors"
                disabled={savingEdit}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2 px-5 rounded-sm cursor-pointer transition-colors flex items-center gap-1.5"
                disabled={savingEdit}
              >
                {savingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-border-dark py-6 px-6 text-center text-xs text-muted-zinc bg-bg-dark">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 ระบบการจัดการความร่วมมือครีเอเตอร์ สงวนลิขสิทธิ์</p>
        </div>
      </footer>

    </div>
  );
}
