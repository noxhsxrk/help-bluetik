// --- PLATFORM DATABASE LAYER (ติ๊กฟ้าช่วยติ๊กฟ้า) ---
// This module provides a unified database interface.
// It integrates directly with Supabase PostgreSQL in production.

import { supabase } from './supabase';
import { POST_EXPIRY_MS, POST_PROMOTED_EXPIRY_MS } from './constants';

export interface User {
  id: string;
  x_username: string;
  x_name: string;
  role: 'pending' | 'member' | 'admin';
  avatar: string;
  bio: string;
  help_score: number;
  spendable_points?: number;
  referral_code?: string;
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
  is_promoted?: boolean;
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

// --- FALLBACK ARRAYS (used only if Supabase is unreachable) ---
let _users: User[] = [];
let _posts: Post[] = [];

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

  async updateXUsername(id: string, xUsername: string, xName: string, bio: string, referralCode?: string): Promise<User | null> {
    const cleanUsername = xUsername.replace('@', '').trim();
    const finalName = xName || cleanUsername;
    const cleanReferral = referralCode?.trim() || '';
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          x_username: cleanUsername,
          x_name: finalName,
          bio: bio,
          referral_code: cleanReferral || null,
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
          user.referral_code = cleanReferral;
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
        user.referral_code = cleanReferral;
        user.role = 'pending';
        return user;
      }
      return null;
    }
  },

  async createUser(user: Omit<User, 'id' | 'help_score' | 'spendable_points' | 'role'> & { role?: User['role'] }): Promise<User> {
    const newId = 'u_' + Math.random().toString(36).substring(2, 11);
    const newUser: User = {
      id: newId,
      help_score: 0,
      spendable_points: 0,
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
      const newSpendable = (currentUser.spendable_points ?? 0) + increment;
      const { data, error } = await supabase
        .from('users')
        .update({ help_score: newScore, spendable_points: newSpendable })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        const user = _users.find(u => u.id === id);
        if (user) {
          user.help_score += increment;
          user.spendable_points = (user.spendable_points ?? 0) + increment;
          return user;
        }
        return null;
      }
      return data;
    } catch {
      const user = _users.find(u => u.id === id);
      if (user) {
        user.help_score += increment;
        user.spendable_points = (user.spendable_points ?? 0) + increment;
        return user;
      }
      return null;
    }
  },

  async deductUserPoints(id: string, amount: number): Promise<User | null> {
    try {
      const currentUser = await this.getUserById(id);
      if (!currentUser) return null;
      
      const newSpendable = Math.max(0, (currentUser.spendable_points ?? 0) - amount);
      const { data, error } = await supabase
        .from('users')
        .update({ spendable_points: newSpendable })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        const user = _users.find(u => u.id === id);
        if (user) {
          user.spendable_points = Math.max(0, (user.spendable_points ?? 0) - amount);
          return user;
        }
        return null;
      }
      return data;
    } catch {
      const user = _users.find(u => u.id === id);
      if (user) {
        user.spendable_points = Math.max(0, (user.spendable_points ?? 0) - amount);
        return user;
      }
      return null;
    }
  },

  async updateUserAdmin(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        const user = _users.find(u => u.id === id);
        if (user) {
          Object.assign(user, updates);
          return user;
        }
        return null;
      }
      return data;
    } catch {
      const user = _users.find(u => u.id === id);
      if (user) {
        Object.assign(user, updates);
        return user;
      }
      return null;
    }
  },

  // --- POST METHODS ---
  async getActivePosts(): Promise<Post[]> {
    const cutoff = Date.now() - POST_EXPIRY_MS;
    const promotedCutoff = Date.now() - POST_PROMOTED_EXPIRY_MS;

    // ── On-the-fly Database Cleanup ───────────────────────────
    // สั่งลบโพสและ interactions ที่หมดอายุ ทันที
    // ทำแบบ background promise เพื่อไม่ให้หน่วงการตอบสนองผู้ใช้ (non-blocking)
    try {
      // ลบโพสปกติที่เก่ากว่า 6 ชั่วโมง
      supabase
        .from('posts')
        .delete()
        .not('is_promoted', 'eq', true)
        .lt('created_at', cutoff)
        .then(() => {
          // ลบโพสโปรโมตที่เก่ากว่า 18 ชั่วโมง
          supabase
            .from('posts')
            .delete()
            .eq('is_promoted', true)
            .lt('created_at', promotedCutoff)
            .then(() => {
              // ลบ interactions ที่เก่ากว่า 18 ชั่วโมงไปด้วย
              supabase
                .from('interactions')
                .delete()
                .lt('created_at', promotedCutoff)
                .then(() => {});
            });
        });
    } catch {}

    // ทำความสะอาด fallback arrays ในหน่วยความจำ (กรณี Offline/Local Fallback)
    _posts = _posts.filter(p => p.is_promoted ? p.created_at > promotedCutoff : p.created_at > cutoff);
    _interactions = _interactions.filter(i => i.created_at > promotedCutoff);

    try {
      // ดึงข้อมูลโพสทั้งหมดที่เกิดขึ้นภายใน 18 ชั่วโมงย้อนหลัง เพื่อนำมากรองต่อในหน่วยความจำ
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('is_active', true)
        .gt('created_at', promotedCutoff)
        .order('created_at', { ascending: false });
      if (error || !data || data.length === 0) {
        return _posts.filter(p => p.is_promoted ? p.created_at > promotedCutoff : p.created_at > cutoff);
      }
      // กรองข้อมูล: โพสโปรโมตอายุไม่เกิน 18 ชม. และโพสปกติอายุไม่เกิน 6 ชม.
      return data.filter(post => post.is_promoted ? post.created_at > promotedCutoff : post.created_at > cutoff);
    } catch {
      return _posts.filter(p => p.is_promoted ? p.created_at > promotedCutoff : p.created_at > cutoff);
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

  async updatePostPromoted(id: string, isPromoted: boolean): Promise<Post | null> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .update({ is_promoted: isPromoted })
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        const post = _posts.find(p => p.id === id);
        if (post) {
          post.is_promoted = isPromoted;
          return post;
        }
        return null;
      }
      return data;
    } catch {
      const post = _posts.find(p => p.id === id);
      if (post) {
        post.is_promoted = isPromoted;
        return post;
      }
      return null;
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

  async resetAllScores(): Promise<void> {
    _users.forEach(u => {
      u.help_score = 0;
      u.spendable_points = 0;
    });
    _interactions = [];
    try {
      await supabase.from('users').update({ help_score: 0, spendable_points: 0 }).neq('id', '');
      await supabase.from('interactions').delete().neq('id', '');
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
