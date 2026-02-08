'use client';

import { useState } from 'react';

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    /** Optional highlighted item name displayed in a badge */
    itemName?: string;
    /** 'danger' = red trash icon, 'warning' = amber warning icon */
    variant?: 'danger' | 'warning';
    confirmText?: string;
    cancelText?: string;
    loadingText?: string;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    itemName,
    variant = 'danger',
    confirmText = 'Evet, Sil',
    cancelText = 'İptal',
    loadingText = 'İşleniyor...',
}: ConfirmModalProps) {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    };

    const isDanger = variant === 'danger';
    const accentColor = isDanger ? 'red' : 'amber';

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
            onClick={() => !loading && onClose()}
        >
            <div
                className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-700/80 shadow-2xl transform transition-all duration-200 scale-100 animate-in fade-in"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'modalIn 0.2s ease-out' }}
            >
                {/* Top accent bar */}
                <div className={`h-1 rounded-t-2xl ${isDanger ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-500' : 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500'}`} />

                <div className="p-7 text-center">
                    {/* Icon */}
                    <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-500/10 border-2 border-red-500/30' : 'bg-amber-500/10 border-2 border-amber-500/30'}`}>
                        {isDanger ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-white mb-1.5">{title}</h3>

                    {/* Message */}
                    <p className="text-gray-400 text-sm leading-relaxed mb-1">{message}</p>

                    {/* Optional item name badge */}
                    {itemName && (
                        <div className="mt-3 mb-5">
                            <span className="text-white font-semibold text-sm bg-gray-800 rounded-lg py-1.5 px-4 inline-block border border-gray-700/50">
                                {itemName}
                            </span>
                        </div>
                    )}

                    {!itemName && <div className="mb-5" />}

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 text-sm font-medium transition-all border border-gray-700/50 disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${isDanger
                                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20'
                                : 'bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-500/20'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    {loadingText}
                                </>
                            ) : confirmText}
                        </button>
                    </div>
                </div>
            </div>

            {/* Keyframe animation */}
            <style jsx>{`
                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
