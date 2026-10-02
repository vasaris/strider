import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { SwRegister } from './sw-register';

const THEME = '#0b0d10';

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
    <html lang="ru">
      <body className="min-h-screen bg-[#0b0d10] text-[#d8d2c4]">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
