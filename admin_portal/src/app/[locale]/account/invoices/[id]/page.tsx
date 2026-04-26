'use client';
import { use } from 'react';
import InvoiceDetailView from '@/components/invoices/InvoiceDetailView';
import Link from 'next/link';

export default function AccountInvoiceDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const resolvedParams = use(params);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/account`} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2">
            ← Geri Dön
          </Link>
        </div>
        <InvoiceDetailView invoiceId={resolvedParams.id} basePath={`/account`} />
      </div>
    </div>
  );
}
