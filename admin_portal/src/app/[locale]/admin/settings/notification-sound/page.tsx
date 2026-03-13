'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAdmin } from '@/components/providers/AdminProvider';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SOUND_OPTIONS = [
    { id: 'lokma_order_bell', name: 'Order Up Bell', desc: 'Bestellglocke — Küchenklingel', icon: '🍳', freq: 1174.66, harmonics: [0.4, 0.2], decay: 2.0, type: 'single', category: 'restaurant' },
    { id: 'lokma_classic_ding', name: 'Classic Hotel Ding', desc: 'Klassische Hotelrezeptionsglocke', icon: '🛎️', freq: 880, harmonics: [0.6, 0.3, 0.15], decay: 3.5, type: 'single', category: 'hotel' },
    { id: 'lokma_bright_bell', name: 'Bright Reception Bell', desc: 'Helle Kristallglocke', icon: '✨', freq: 1046.5, harmonics: [0.5, 0.25, 0.12], decay: 3.0, type: 'single', category: 'hotel' },
    { id: 'lokma_warm_dong', name: 'Warm Dong', desc: 'Warmer, tiefer Gong — Luxuslobby', icon: '🔔', freq: 523.25, harmonics: [0.7, 0.4, 0.2, 0.1], decay: 4.5, type: 'single', category: 'hotel' },
    { id: 'lokma_double_ding', name: 'Double Ding', desc: 'Zwei kurze Schläge — aufmerksamkeitserregend', icon: '🛎️🛎️', freq: 880, harmonics: [0.5, 0.25], decay: 2.5, type: 'double', category: 'hotel' },
    { id: 'lokma_soft_gong', name: 'Soft Gong', desc: 'Sanfter Gong — Zen-Gefühl', icon: '🥢', freq: 392, harmonics: [0.8, 0.5, 0.3, 0.15], decay: 5.0, type: 'single', category: 'restaurant' },
    { id: 'lokma_triangle_ting', name: 'Triangle Ting', desc: 'Metallischer Dreiecksschlag', icon: '🔺', freq: 1760, harmonics: [0.35, 0.15, 0.08], decay: 2.8, type: 'single', category: 'restaurant' },
    { id: 'lokma_cafe_chime', name: 'Café Door Chime', desc: 'Café-Türglocke', icon: '☕', freq: 659.25, harmonics: [0.5, 0.3, 0.15], decay: 3.2, type: 'double', category: 'restaurant' },
    { id: 'lokma_crystal_chime', name: 'Crystal Chime', desc: 'Kristallglas-Klang — Premium', icon: '💎', freq: 1318.51, harmonics: [0.3, 0.15, 0.08], decay: 4.0, type: 'single', category: 'chime' },
    { id: 'lokma_wind_chime', name: 'Wind Chime', desc: 'Windspiel — drei Töne', icon: '🎐', freq: 784, harmonics: [0.4, 0.2], decay: 3.0, type: 'triple', category: 'chime' },
    { id: 'lokma_zen_bowl', name: 'Zen Singing Bowl', desc: 'Tibetische Klangschale — meditativ', icon: '🪷', freq: 261.63, harmonics: [0.9, 0.6, 0.4, 0.25, 0.15], decay: 6.0, type: 'single', category: 'chime' },
    { id: 'lokma_xylophone', name: 'Xylophone Note', desc: 'Xylophon — kurz & süß', icon: '🎶', freq: 987.77, harmonics: [0.2, 0.1], decay: 1.8, type: 'single', category: 'chime' },
];

function playBellSound(sound: typeof SOUND_OPTIONS[0]) {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.setValueAtTime(0.5, now);

    function createTone(freq: number, amplitude: number, startTime: number, decayTime: number) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.998, startTime + decayTime);
        gain.gain.setValueAtTime(amplitude * 0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + decayTime);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + decayTime);
    }

    function playHit(startTime: number) {
        createTone(sound.freq, 1.0, startTime, sound.decay);
        sound.harmonics.forEach((amp, i) => {
            createTone(sound.freq * (i + 2), amp, startTime, sound.decay * 0.7);
        });
        const noise = audioCtx.createOscillator();
        const noiseGain = audioCtx.createGain();
        noise.type = 'square';
        noise.frequency.setValueAtTime(sound.freq * 4, startTime);
        noise.frequency.exponentialRampToValueAtTime(sound.freq * 2, startTime + 0.02);
        noiseGain.gain.setValueAtTime(0.08, startTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);
        noise.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start(startTime);
        noise.stop(startTime + 0.05);
    }

    if (sound.type === 'double') {
        playHit(now);
        playHit(now + 0.25);
    } else if (sound.type === 'triple') {
        playHit(now);
        setTimeout(() => playHit(audioCtx.currentTime), 200);
        setTimeout(() => playHit(audioCtx.currentTime), 400);
    } else {
        playHit(now);
    }
}

export default function NotificationSoundPage() {
    const t = useTranslations('AdminSettings');
    const { admin } = useAdmin();
    const [activeSound, setActiveSound] = useState('lokma_order_bell');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);

    // Load current setting from Firestore
    useEffect(() => {
        async function loadSetting() {
            try {
                const docRef = doc(db, 'platform_config', 'notification_sound');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setActiveSound(docSnap.data().activeSound || 'lokma_order_bell');
                }
            } catch (e) {
                console.error('Error loading notification sound setting:', e);
            } finally {
                setLoading(false);
            }
        }
        loadSetting();
    }, []);

    const handlePlay = (sound: typeof SOUND_OPTIONS[0]) => {
        setPlayingId(sound.id);
        playBellSound(sound);
        setTimeout(() => setPlayingId(null), 1000);
    };

    const handleSave = async (soundId: string) => {
        setSaving(true);
        try {
            const soundOption = SOUND_OPTIONS.find(s => s.id === soundId);
            await setDoc(doc(db, 'platform_config', 'notification_sound'), {
                activeSound: soundId + '.caf',
                activeSoundId: soundId,
                activeSoundDisplayName: soundOption?.name || soundId,
                updatedAt: serverTimestamp(),
                updatedBy: admin?.id || 'unknown',
            });
            setActiveSound(soundId);
        } catch (e) {
            console.error('Error saving notification sound:', e);
        } finally {
            setSaving(false);
        }
    };

    const categories = [
        { key: 'hotel', label: '🏨 Hotel Reception Bell', badge: null },
        { key: 'restaurant', label: '🍽️ Restaurant / Cafe', badge: 'AKTIV' },
        { key: 'chime', label: '✨ Premium Chime', badge: null },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6 md:p-12 font-sans text-white">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <a href="/admin/settings" className="text-gray-400 hover:text-white transition">← Zurück zu Einstellungen</a>
                </div>
                <h1 className="text-3xl font-bold mb-2">🔔 Benachrichtigungston</h1>
                <p className="text-gray-400 mb-8">Wählen Sie den Ton für Push-Benachrichtigungen. Alle Töne sind in die iOS-App eingebettet — bei Änderung ist kein neuer Build erforderlich.</p>

                {/* Current Selection */}
                {activeSound && (
                    <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 mb-8 flex items-center gap-3">
                        <span className="text-2xl">🔔</span>
                        <div>
                            <p className="text-sm text-rose-300">Aktiver Ton</p>
                            <p className="font-bold text-white">
                                {SOUND_OPTIONS.find(s => s.id === activeSound)?.name || activeSound}
                            </p>
                        </div>
                    </div>
                )}

                {/* Sound Categories */}
                {categories.map(cat => {
                    const sounds = SOUND_OPTIONS.filter(s => s.category === cat.key);
                    return (
                        <div key={cat.key} className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <h2 className="text-lg font-bold text-gray-300">{cat.label}</h2>
                                {cat.key === 'restaurant' && activeSound.startsWith('lokma_order') && (
                                    <span className="bg-rose-500/20 text-rose-400 text-xs px-2 py-0.5 rounded-full font-semibold">AKTIV</span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {sounds.map(sound => {
                                    const isActive = activeSound === sound.id;
                                    const isPlaying = playingId === sound.id;
                                    return (
                                        <div
                                            key={sound.id}
                                            className={`relative bg-gray-800 border rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.01] ${
                                                isActive
                                                    ? 'border-rose-500 bg-rose-950/20 shadow-lg shadow-rose-500/10'
                                                    : 'border-gray-700 hover:border-gray-500'
                                            } ${isPlaying ? 'ring-2 ring-rose-400/50' : ''}`}
                                            onClick={() => handlePlay(sound)}
                                        >
                                            <span className="absolute top-3 right-3 text-xs text-gray-600 font-mono">{sound.freq} Hz</span>
                                            <div className="text-2xl mb-2">{sound.icon}</div>
                                            <h3 className="font-bold text-white">{sound.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1">{sound.desc}</p>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-2 mt-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handlePlay(sound); }}
                                                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition"
                                                >
                                                    ▶ Anhören
                                                </button>
                                                {!isActive && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleSave(sound.id); }}
                                                        disabled={saving}
                                                        className="text-xs bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                                    >
                                                        {saving ? '...' : '✓ Auswählen'}
                                                    </button>
                                                )}
                                                {isActive && (
                                                    <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg">✓ Aktiv</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Info Box */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mt-4">
                    <h3 className="font-bold text-yellow-400 mb-2">⚡ Wie funktioniert es?</h3>
                    <ul className="text-sm text-gray-400 space-y-1.5">
                        <li>• Alle 12 Töne sind im <strong className="text-gray-300">.caf-Format</strong> in die iOS-App eingebettet</li>
                        <li>• Der hier gewählte Ton wird in Firestore gespeichert</li>
                        <li>• Cloud Functions liest bei jeder Benachrichtigung den aktiven Ton und fügt ihn dem Push-Payload hinzu</li>
                        <li>• Der Ton ändert sich bei allen Nutzern ohne neuen Build</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
