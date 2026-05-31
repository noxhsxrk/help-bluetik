import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

async function checkAdmin() {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('tb_admin_session');
  if (adminSession?.value !== 'authenticated') return null;
  return { id: 'admin', role: 'admin' };
}

// GET: List all users in the system (allows Admin Backoffice to show complete list)
export async function GET() {
  try {
    const adminUser = await checkAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allUsers = await DB.getUsers();
    return NextResponse.json({ users: allUsers });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Approve user (change role to 'member')
export async function POST(request: Request) {
  try {
    const adminUser = await checkAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const approvedUser = await DB.updateUserRole(userId, 'member', 'admin');
    if (!approvedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: approvedUser });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH: Full edit of any user properties (admin mode)
export async function PATCH(request: Request) {
  try {
    const adminUser = await checkAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, updates } = await request.json();
    if (!userId || !updates) {
      return NextResponse.json({ error: 'User ID and updates are required' }, { status: 400 });
    }

    const updatedUser = await DB.updateUserAdmin(userId, updates);
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Delete user (remove from system)
export async function DELETE(request: Request) {
  try {
    const adminUser = await checkAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. ดึงโปรไฟล์เพื่อหา supabase_auth_id ก่อนที่จะลบจาก DB
    const userProfile = await DB.getUserById(userId);

    // 2. ลบออกจากตาราง users หลักของระบบ
    const success = await DB.deleteUser(userId);
    if (!success) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้หรือการลบโปรไฟล์ล้มเหลว' }, { status: 404 });
    }

    let authDeleted = false;
    let authWarning = '';

    // 3. หากมี supabase_auth_id และได้ระบุ SUPABASE_SERVICE_ROLE_KEY ไว้หลังบ้าน ให้ลบสิทธิ์ SSO ออกจาก Supabase Auth
    if (userProfile && userProfile.supabase_auth_id) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          });
          const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userProfile.supabase_auth_id);
          if (authErr) {
            authWarning = `ระบบลบประวัติ SSO ขัดข้อง: ${authErr.message}`;
          } else {
            authDeleted = true;
          }
        } catch (err: any) {
          authWarning = `เกิดข้อผิดพลาดในการเชื่อมโยง Admin Client: ${err.message || err}`;
        }
      } else {
        authWarning = 'กรุณาตั้งค่า SUPABASE_SERVICE_ROLE_KEY ในไฟล์ env เพื่อเปิดระบบล้างประวัติ SSO อัตโนมัติ';
      }
    }

    return NextResponse.json({ 
      success: true, 
      authDeleted, 
      warning: authWarning || undefined 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
