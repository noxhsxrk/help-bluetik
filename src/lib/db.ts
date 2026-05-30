// --- PLATFORM DATABASE LAYER (ติ๊กฟ้าช่วยติ๊กฟ้า) ---
// This module provides a unified database interface.
// It integrates directly with Supabase PostgreSQL in production.

import { supabase } from './supabase';

export interface User {
  id: string;
  x_username: string;
  x_name: string;
  role: 'pending' | 'member' | 'admin';
  avatar: string;
  bio: string;
  help_score: number;
  approved_at?: number;
  approved_by?: string;
  google_email?: string;
}

export interface Post {
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
  is_active: boolean;
  oembed_html?: string;
}

export interface Interaction {
  id: string;
  post_id: string;
  helper_user_id: string;
  type: 'repost' | 'like' | 'quote' | 'mention';
  created_at: number;
}

export interface TrendingHashtag {
  id: string;
  hashtag: string;
  tweet_volume: number;
  trend_score: number;
  country: string;
  detected_at: number;
  expires_at: number;
  is_hot?: boolean;
}

// --- FALLBACK ARRAYS (used only if Supabase is unreachable or empty) ---
let _users: User[] = [
  {
    id: 'u_mock1',
    x_username: 'ton_creator',
    x_name: 'ต้น คอนเทนต์ครีเอเตอร์',
    role: 'member',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ton',
    bio: 'แชร์เทคนิคทำคอนเทนต์สร้างรายได้บน X.com',
    help_score: 45
  },
  {
    id: 'u_mock2',
    x_username: 'pook_tech',
    x_name: 'ปุ๊ก พีอาร์สายเทคโนโลยี',
    role: 'member',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=pook',
    bio: 'อัปเดตเทรนด์ AI และนวัตกรรมใหม่ๆ',
    help_score: 32
  },
  {
    id: 'u_mock3',
    x_username: 'ice_travel',
    x_name: 'ไอซ์ พาเที่ยวรอบโลก',
    role: 'member',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ice',
    bio: 'รีวิวทริปท่องเที่ยว ถ่ายภาพสวยๆ',
    help_score: 28
  }
];

let _posts: Post[] = [
  {
    id: 'p_mock1',
    user_id: 'u_mock1',
    x_username: 'ton_creator',
    x_name: 'ต้น คอนเทนต์ครีเอเตอร์',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ton',
    content: 'แบ่งปันเทคนิคการสร้างฐานผู้ติดตามใน X เริ่มต้นจากศูนย์จนถึงแสนคนในปี 2026 ใครสนใจกดไลค์รีทวีตไว้เลยครับ เดี๋ยวมาต่อเธรด',
    x_post_id: '1789123456789',
    x_post_url: 'https://x.com/ton_creator/status/1789123456789',
    posted_via: 'link',
    created_at: Date.now() - 30 * 60 * 1000,
    is_active: true,
    oembed_html: `<blockquote class="twitter-tweet" data-theme="dark"><p lang="th" dir="ltr">แบ่งปันเทคนิคการสร้างฐานผู้ติดตามใน X เริ่มต้นจากศูนย์จนถึงแสนคนในปี 2026 ใครสนใจกดไลค์รีทวีตไว้เลยครับ เดี๋ยวมาต่อเธรด</p>&mdash; ต้น คอนเทนต์ครีเอเตอร์ (@ton_creator) <a href="https://x.com/ton_creator/status/1789123456789">May 30, 2026</a></blockquote>`
  },
  {
    id: 'p_mock2',
    user_id: 'u_mock2',
    x_username: 'pook_tech',
    x_name: 'ปุ๊ก พีอาร์สายเทคโนโลยี',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=pook',
    content: 'วันนี้มาสรุปฟีเจอร์ใหม่ของวงการ AI ที่น่าจับตามองในเดือนนี้ สรุปเข้าใจง่ายใน 5 ข้ออ่านจบใน 1 นาทีครับ!',
    x_post_id: '1789123456790',
    x_post_url: 'https://x.com/pook_tech/status/1789123456790',
    posted_via: 'link',
    created_at: Date.now() - 2 * 3600 * 1000,
    is_active: true,
    oembed_html: `<blockquote class="twitter-tweet" data-theme="dark"><p lang="th" dir="ltr">วันนี้มาสรุปฟีเจอร์ใหม่ของวงการ AI ที่น่าจับตามองในเดือนนี้ สรุปเข้าใจง่ายใน 5 ข้ออ่านจบใน 1 นาทีครับ!</p>&mdash; ปุ๊ก พีอาร์สายเทคโนโลยี (@pook_tech) <a href="https://x.com/pook_tech/status/1789123456790">May 30, 2026</a></blockquote>`
  },
  {
    id: 'p_mock3',
    user_id: 'u_mock3',
    x_username: 'ice_travel',
    x_name: 'ไอซ์ พาเที่ยวรอบโลก',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ice',
    content: 'แจกแพลนเที่ยวสวิตเซอร์แลนด์ 8 วัน 7 คืน งบประหยัดแต่ได้รูปสวยปังทุกมุม เซฟเก็บไว้ตามรอยกันได้เลยน้า',
    x_post_id: '1789123456791',
    x_post_url: 'https://x.com/ice_travel/status/1789123456791',
    posted_via: 'link',
    created_at: Date.now() - 5 * 3600 * 1000,
    is_active: true,
    oembed_html: `<blockquote class="twitter-tweet" data-theme="dark"><p lang="th" dir="ltr">แจกแพลนเที่ยวสวิตเซอร์แลนด์ 8 วัน 7 คืน งบประหยัดแต่ได้รูปสวยปังทุกมุม เซฟเก็บไว้ตามรอยกันได้เลยน้า</p>&mdash; ไอซ์ พาเที่ยวรอบโลก (@ice_travel) <a href="https://x.com/ice_travel/status/1789123456791">May 30, 2026</a></blockquote>`
  }
];

let _interactions: Interaction[] = [];
let _cooldowns: Record<string, number> = {};
let _trends: TrendingHashtag[] = [];

export const DB = {
  // --- USER METHODS ---
  async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) return _users; // only fallback on error, not empty
      return data || [];
    } catch {
      return _users;
    }
  },

  async getUserById(id: string): Promise<User | null> {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      if (error || !data) {
        return _users.find(u => u.id === id) || null;
      }
      return data;
    } catch {
      return _users.find(u => u.id === id) || null;
    }
  },

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('x_username', username).single();
      if (error || !data) {
        return _users.find(u => u.x_username.toLowerCase() === username.toLowerCase()) || null;
      }
      return data;
    } catch {
      return _users.find(u => u.x_username.toLowerCase() === username.toLowerCase()) || null;
    }
  },

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('google_email', email).single();
      if (error) {
        // PGRST116 = no rows found, that's OK — don't fall back to mock
        if (error.code === 'PGRST116') return null;
        return _users.find(u => u.google_email?.toLowerCase() === email.toLowerCase()) || null;
      }
      return data || null;
    } catch {
      return _users.find(u => u.google_email?.toLowerCase() === email.toLowerCase()) || null;
    }
  },

  async updateXUsername(id: string, xUsername: string, xName: string, bio: string): Promise<User | null> {
    const cleanUsername = xUsername.replace('@', '').trim();
    const finalName = xName || cleanUsername;
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          x_username: cleanUsername,
          x_name: finalName,
          bio: bio,
          role: 'pending'
        })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        // Fallback to local
        const user = _users.find(u => u.id === id);
        if (user) {
          user.x_username = cleanUsername;
          user.x_name = finalName;
          user.bio = bio;
          user.role = 'pending';
          return user;
        }
        return null;
      }
      return data;
    } catch {
      const user = _users.find(u => u.id === id);
      if (user) {
        user.x_username = cleanUsername;
        user.x_name = finalName;
        user.bio = bio;
        user.role = 'pending';
        return user;
      }
      return null;
    }
  },

  async createUser(user: Omit<User, 'id' | 'help_score' | 'role'> & { role?: User['role'] }): Promise<User> {
    const newId = 'u_' + Math.random().toString(36).substring(2, 11);
    const newUser: User = {
      id: newId,
      help_score: 0,
      role: user.role || 'pending',
      ...user
    };
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();
      if (error) {
        _users.push(newUser);
        return newUser;
      }
      return data;
    } catch {
      _users.push(newUser);
      return newUser;
    }
  },

  async updateUserRole(id: string, role: User['role'], approvedBy?: string): Promise<User | null> {
    const now = Date.now();
    const approver = approvedBy || 'system';
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          role: role,
          approved_at: (role === 'member' || role === 'admin') ? now : null,
          approved_by: (role === 'member' || role === 'admin') ? approver : null
        })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        const user = _users.find(u => u.id === id);
        if (user) {
          user.role = role;
          if (role === 'member' || role === 'admin') {
            user.approved_at = now;
            user.approved_by = approver;
          }
          return user;
        }
        return null;
      }
      return data;
    } catch {
      const user = _users.find(u => u.id === id);
      if (user) {
        user.role = role;
        if (role === 'member' || role === 'admin') {
          user.approved_at = now;
          user.approved_by = approver;
        }
        return user;
      }
      return null;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        const initialLen = _users.length;
        _users = _users.filter(u => u.id !== id);
        return _users.length < initialLen;
      }
      return true;
    } catch {
      const initialLen = _users.length;
      _users = _users.filter(u => u.id !== id);
      return _users.length < initialLen;
    }
  },

  async incrementUserScore(id: string, increment: number): Promise<User | null> {
    try {
      // Fetch user first
      const currentUser = await this.getUserById(id);
      if (!currentUser) return null;
      
      const newScore = currentUser.help_score + increment;
      const { data, error } = await supabase
        .from('users')
        .update({ help_score: newScore })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        const user = _users.find(u => u.id === id);
        if (user) {
          user.help_score += increment;
          return user;
        }
        return null;
      }
      return data;
    } catch {
      const user = _users.find(u => u.id === id);
      if (user) {
        user.help_score += increment;
        return user;
      }
      return null;
    }
  },

  // --- POST METHODS ---
  async getActivePosts(): Promise<Post[]> {
    const twelveHours = 12 * 60 * 60 * 1000;
    const cutoff = Date.now() - twelveHours;

    // Dynamically shift mock posts' created_at so they stay fresh within 12 hours
    if (_posts && _posts.length >= 3) {
      _posts[0].created_at = Date.now() - 30 * 60 * 1000; // 30 mins ago
      _posts[1].created_at = Date.now() - 2 * 3600 * 1000; // 2 hours ago
      _posts[2].created_at = Date.now() - 5 * 3600 * 1000; // 5 hours ago
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('is_active', true)
        .gt('created_at', cutoff)
        .order('created_at', { ascending: false });
      if (error || !data || data.length === 0) {
        return _posts;
      }
      return data;
    } catch {
      return _posts;
    }
  },

  async createPost(post: Omit<Post, 'id' | 'created_at' | 'is_active'>): Promise<Post> {
    const newId = 'p_' + Math.random().toString(36).substring(2, 11);
    const newPost: Post = {
      id: newId,
      created_at: Date.now(),
      is_active: true,
      ...post
    };
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([newPost])
        .select()
        .single();
      if (error) {
        _posts.unshift(newPost);
        return newPost;
      }
      return data;
    } catch {
      _posts.unshift(newPost);
      return newPost;
    }
  },

  async checkDuplicatePost(userId: string, contentOrUrl: string, isUrl: boolean): Promise<boolean> {
    try {
      if (isUrl) {
        const { data, error } = await supabase.from('posts').select('id').eq('x_post_url', contentOrUrl).limit(1);
        if (error || !data || data.length === 0) {
          return _posts.some(p => p.x_post_url === contentOrUrl);
        }
        return data.length > 0;
      } else {
        const { data, error } = await supabase.from('posts').select('id').eq('user_id', userId).eq('content', contentOrUrl).limit(1);
        if (error || !data || data.length === 0) {
          return _posts.some(p => p.user_id === userId && p.content === contentOrUrl);
        }
        return data.length > 0;
      }
    } catch {
      if (isUrl) {
        return _posts.some(p => p.x_post_url === contentOrUrl);
      }
      return _posts.some(p => p.user_id === userId && p.content === contentOrUrl);
    }
  },

  async deletePost(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) {
        const initialLen = _posts.length;
        _posts = _posts.filter(p => p.id !== id);
        return _posts.length < initialLen;
      }
      return true;
    } catch {
      const initialLen = _posts.length;
      _posts = _posts.filter(p => p.id !== id);
      return _posts.length < initialLen;
    }
  },

  // --- COOLDOWN CONTROL ---
  async getUserLastPostTime(userId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase.from('post_cooldowns').select('last_post_time').eq('user_id', userId).single();
      if (error || !data) {
        return _cooldowns[userId] || null;
      }
      return data.last_post_time;
    } catch {
      return _cooldowns[userId] || null;
    }
  },

  async updateUserLastPostTime(userId: string): Promise<void> {
    const now = Date.now();
    _cooldowns[userId] = now;
    try {
      await supabase
        .from('post_cooldowns')
        .upsert({ user_id: userId, last_post_time: now });
    } catch {}
  },

  async resetCooldowns(): Promise<void> {
    _cooldowns = {};
    try {
      await supabase.from('post_cooldowns').delete().neq('user_id', '');
    } catch {}
  },

  // --- INTERACTION METHODS ---
  async getInteractions(): Promise<Interaction[]> {
    try {
      const { data, error } = await supabase.from('interactions').select('*');
      if (error || !data || data.length === 0) return _interactions;
      return data;
    } catch {
      return _interactions;
    }
  },

  async recordInteraction(interaction: Omit<Interaction, 'id' | 'created_at'>): Promise<Interaction> {
    const newId = 'i_' + Math.random().toString(36).substring(2, 11);
    const newInteraction: Interaction = {
      id: newId,
      created_at: Date.now(),
      ...interaction
    };
    try {
      const { data, error } = await supabase
        .from('interactions')
        .insert([newInteraction])
        .select()
        .single();
      if (error) {
        _interactions.push(newInteraction);
        return newInteraction;
      }
      return data;
    } catch {
      _interactions.push(newInteraction);
      return newInteraction;
    }
  },

  // --- TRENDING METHODS ---
  async getTrends(): Promise<TrendingHashtag[]> {
    try {
      const { data, error } = await supabase.from('trending_hashtags').select('*');
      if (error || !data || data.length === 0) return _trends;
      return data;
    } catch {
      return _trends;
    }
  },

  async updateTrends(newTrends: TrendingHashtag[]): Promise<void> {
    _trends = newTrends;
    try {
      await supabase.from('trending_hashtags').delete().neq('id', '');
      await supabase.from('trending_hashtags').insert(newTrends);
    } catch {}
  }
};
