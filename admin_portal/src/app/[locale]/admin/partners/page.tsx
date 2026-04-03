'use client';

import { redirect } from 'next/navigation';

export default function PartnersPage() {
 redirect('/admin/dashboard?filter=admins');
}
