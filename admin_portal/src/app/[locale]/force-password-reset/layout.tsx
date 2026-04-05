import React from 'react';

export const metadata = {
 title: 'Yeni Şifre Belirleme - LOKMA',
};

export default function ForcePasswordResetLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
  <div className="min-h-[100dvh] bg-neutral-900 flex flex-col items-center pt-20 md:justify-center md:pt-0 p-4">
  <div className="w-full max-w-md mt-10 md:mt-0">
 {children}
 </div>
 </div>
 );
}
