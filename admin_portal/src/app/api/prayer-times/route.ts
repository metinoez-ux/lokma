import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Default to 297 (Hückelhoven) if not provided
  const districtId = searchParams.get('districtId') || '297'; 

  try {
    const response = await fetch(`https://flat-firefly-20f3.proxyvikz.workers.dev/proxy/api/cms/daily?districtId=${districtId}`, {
      // Fazilet verileri gunluk oldugu icin uzun sure önbelleklenebilir (1 saat cache)
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Prayer Times API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
