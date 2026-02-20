import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
    // Match only internationalized pathnames
    matcher: [
        '/',
        '/(tr|en|de|it|fr|es)/:path*',
        // Enable redirects that add missing locales (e.g. `/login` -> `/tr/login`)
        '/((?!api|_next|_vercel|.*\\..*).*)'
    ]
};
