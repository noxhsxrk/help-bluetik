import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DB } from '@/lib/db';

async function checkAdmin() {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('tb_admin_session');
  if (adminSession?.value !== 'authenticated') return null;
  return { id: 'admin', role: 'admin' };
}

// GET: List pending users & system statistics (Phase 1 Backoffice logic)
export async function GET() {
  try {
    const adminUser = await checkAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allUsers = await DB.getUsers();
    const pending = allUsers.filter(u => u.role === 'pending' && u.x_username !== '');
    
    return NextResponse.json({ pending });
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

    const approvedUser = await DB.updateUserRole(userId, 'member', adminUser.x_username);
    if (!approvedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: approvedUser });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: Reject user (remove from system)
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

    const success = await DB.deleteUser(userId);
    if (!success) {
      return NextResponse.json({ error: 'User not found or deletion failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
