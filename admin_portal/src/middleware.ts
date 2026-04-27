import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  // Attempt to determine country from Vercel headers
  const country = request.headers.get('x-vercel-ip-country');
  
  // Set country cookie for client-side to avoid external API calls
  if (country && !request.cookies.has('lokma_country')) {
    response.cookies.set('lokma_country', country, { path: '/', maxAge: 60 * 60 * 24 * 30 });
  }

  return response;
}

export const config = {
 // Match only internationalized pathnames
 matcher: [
 '/',
 '/(tr|en|de|it|fr|es|nl)/:path*',
 // Enable redirects that add missing locales (e.g. `/login` -> `/tr/login`)
 '/((?!api|_next|_vercel|.*\\..*).*)'
 ]
};
