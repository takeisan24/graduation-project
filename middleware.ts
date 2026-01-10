// middleware.ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware({
  ...routing,
  // Tắt locale detection tự động, luôn dùng defaultLocale khi không có locale trong URL
  localeDetection: false
});

export const config = {
  // Match only internationalized pathnames
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};