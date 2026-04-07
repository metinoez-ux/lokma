import { Metadata } from 'next';
import GroupRedirectClient from './GroupRedirectClient';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'LOKMA | Grup Siparisi',
    description: 'Grup siparisine katil - LOKMA ile birlikte siparis ver.',
    openGraph: {
      title: 'LOKMA | Grup Siparisine Davet',
      description: 'Bir grup siparisine davet edildiniz. LOKMA uygulamasini acarak katilabilirsiniz.',
      url: `https://lokma.shop/group/${id}`,
      siteName: 'LOKMA',
      images: [
        {
          url: 'https://lokma.shop/lokma_logo_wide.png',
          width: 1200,
          height: 630,
          alt: 'LOKMA Grup Siparis',
        },
      ],
      type: 'website',
    },
  };
}

export default async function GroupPage({ params }: PageProps) {
  const { id } = await params;
  return <GroupRedirectClient groupId={id} />;
}
