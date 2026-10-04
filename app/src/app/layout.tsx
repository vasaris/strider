import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import './globals.css';
import { SwRegister } from './sw-register';

const THEME = '#0b0d10';

// PT Serif (ParaType, SIL OFL 1.1; fonts/OFL.txt), self-hosted: the reading face of the prose.
const prose = localFont({
  src: [
    { path: './fonts/PT_Serif-Web-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/PT_Serif-Web-Italic.ttf', weight: '400', style: 'italic' },
    { path: './fonts/PT_Serif-Web-Bold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/PT_Serif-Web-BoldItalic.ttf', weight: '700', style: 'italic' },
  ],
  variable: '--font-prose',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const metadata: Metadata = {
  title: 'Бродяжник',
  applicationName: 'Бродяжник',
  description: 'Приватный прототип соло-движка',
};

export const viewport: Viewport = {
  themeColor: THEME,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" className={prose.variable}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
