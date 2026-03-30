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
        <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                {children}
            </div>
        </div>
    );
}
