import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET() {
  const { db } = getFirebaseAdmin();
  try {
    const kermesSnap = await db.collection('kermes_events').get();
    const kermesEvents = new Map();
    kermesSnap.forEach(doc => {
      const data = doc.data();
      kermesEvents.set(doc.id, {
        staff: data.assignedStaff || [],
        drivers: data.assignedDrivers || [],
        waiters: data.assignedWaiters || [],
        admins: data.kermesAdmins || []
      });
    });

    const adminsRef = db.collection('admins');
    const adminsSnap = await adminsRef.get();
    let fixedAdminsCount = 0;

    const updates: Promise<any>[] = [];

    adminsSnap.forEach(doc => {
      const data = doc.data();
      let kAssignments = data.kermesAssignments || [];
      let changed = false;

      // Filter out kermes assignments that don't exist in the actual kermes_event document
      const newKAssignments = kAssignments.filter((ka: any) => {
        const kId = ka.kermesId || ka;
        if (!kermesEvents.has(kId)) return false; // Kermes doesn't even exist
        const kData = kermesEvents.get(kId);
        // If this user is NOT in any of the assigned arrays in the kermes document
        const inKermes = kData.staff.includes(doc.id) || 
                         kData.drivers.includes(doc.id) || 
                         kData.waiters.includes(doc.id) || 
                         kData.admins.includes(doc.id);
        if (!inKermes) {
            changed = true;
            return false;
        }
        return true;
      });

      if (changed) {
        updates.push(adminsRef.doc(doc.id).update({ kermesAssignments: newKAssignments }));
        fixedAdminsCount++;
      }
    });

    const usersRef = db.collection('users');
    const usersSnap = await usersRef.get();
    let fixedUsersCount = 0;

    usersSnap.forEach(doc => {
      const data = doc.data();
      let kAssignments = data.kermesAssignments || [];
      let changed = false;

      const newKAssignments = kAssignments.filter((ka: any) => {
        const kId = ka.kermesId || ka;
        if (!kermesEvents.has(kId)) return false;
        const kData = kermesEvents.get(kId);
        const inKermes = kData.staff.includes(doc.id) || 
                         kData.drivers.includes(doc.id) || 
                         kData.waiters.includes(doc.id) || 
                         kData.admins.includes(doc.id);
        if (!inKermes) {
            changed = true;
            return false;
        }
        return true;
      });

      if (changed) {
        updates.push(usersRef.doc(doc.id).update({ kermesAssignments: newKAssignments }));
        fixedUsersCount++;
      }
    });

    await Promise.all(updates);

    return NextResponse.json({ 
        success: true, 
        message: 'Kermes assignments cleaned up', 
        fixedAdmins: fixedAdminsCount,
        fixedUsers: fixedUsersCount
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
