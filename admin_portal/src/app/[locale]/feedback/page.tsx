'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import PublicHeader from '@/components/ui/PublicHeader';
import PublicFooter from '@/components/ui/PublicFooter';

const texts: Record<string, Record<string, string>> = {
    de: {
        title: 'Feedback & Kontakt', subtitle: 'Kontaktieren Sie das Entwicklungsteam',
        desc: 'Ihre Ideen, Vorschläge oder Beschwerden sind uns wichtig. Wir lesen jede Nachricht!',
        type: 'Nachrichtentyp', suggestion: 'Vorschlag', complaint: 'Beschwerde', question: 'Frage',
        email: 'E-Mail (optional)', emailPh: 'Damit wir Ihnen antworten können',
        subject: 'Betreff', subjectPh: 'Kurz beschrieben',
        message: 'Ihre Nachricht *',
        phSuggestion: 'Was ist Ihre Idee für eine neue Funktion oder Verbesserung?',
        phComplaint: 'Beschreiben Sie das Problem ausführlich...',
        phQuestion: 'Schreiben Sie Ihre Frage hier...',
        send: 'Senden', sending: 'Wird gesendet...', error: 'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
        thanks: 'Vielen Dank!', thanksSub: 'Ihre Nachricht wurde erfolgreich gesendet. Wir werden sie schnellstmöglich prüfen.',
        home: 'Zur Startseite', newMsg: 'Neue Nachricht senden',
        note: 'Nachrichten werden direkt an unser Entwicklerteam weitergeleitet.',
        back: '← Support',
    },
    tr: {
        title: 'Geri Bildirim', subtitle: 'Geliştirici ile İletişim',
        desc: 'Fikirleriniz, önerileriniz veya şikayetleriniz için bize ulaşın. Her mesajı okuyoruz!',
        type: 'Mesaj Türü', suggestion: 'Öneri', complaint: 'Şikayet', question: 'Soru',
        email: 'E-posta (opsiyonel)', emailPh: 'Size geri dönmemiz için',
        subject: 'Konu', subjectPh: 'Kısaca ne hakkında?',
        message: 'Mesajınız *',
        phSuggestion: 'Yeni bir özellik veya iyileştirme öneriniz nedir?',
        phComplaint: 'Karşılaştığınız sorunu detaylı anlatın...',
        phQuestion: 'Sorunuzu buraya yazın...',
        send: 'Gönder', sending: 'Gönderiliyor...', error: 'Gönderilirken bir hata oluştu. Lütfen tekrar deneyin.',
        thanks: 'Teşekkürler!', thanksSub: 'Mesajınız başarıyla gönderildi. En kısa sürede inceleyeceğiz.',
        home: 'Ana Sayfaya Dön', newMsg: 'Yeni Mesaj Gönder',
        note: 'Mesajlar doğrudan geliştirici ekibimize iletilir.',
        back: '← Destek',
    },
    en: {
        title: 'Feedback', subtitle: 'Contact the Development Team',
        desc: 'Your ideas, suggestions, or complaints matter to us. We read every message!',
        type: 'Message Type', suggestion: 'Suggestion', complaint: 'Complaint', question: 'Question',
        email: 'Email (optional)', emailPh: 'So we can get back to you',
        subject: 'Subject', subjectPh: 'Brief description',
        message: 'Your Message *',
        phSuggestion: 'What\'s your idea for a new feature or improvement?',
        phComplaint: 'Describe the issue in detail...',
        phQuestion: 'Write your question here...',
        send: 'Send', sending: 'Sending...', error: 'An error occurred while sending. Please try again.',
        thanks: 'Thank You!', thanksSub: 'Your message has been sent successfully. We\'ll review it as soon as possible.',
        home: 'Go to Homepage', newMsg: 'Send New Message',
        note: 'Messages are forwarded directly to our development team.',
        back: '← Support',
    },
    fr: {
        title: 'Commentaires', subtitle: 'Contactez l\'équipe de développement',
        desc: 'Vos idées, suggestions ou plaintes nous importent. Nous lisons chaque message !',
        type: 'Type de message', suggestion: 'Suggestion', complaint: 'Plainte', question: 'Question',
        email: 'E-mail (optionnel)', emailPh: 'Pour que nous puissions vous répondre',
        subject: 'Sujet', subjectPh: 'Brève description',
        message: 'Votre message *',
        phSuggestion: 'Quelle est votre idée ?', phComplaint: 'Décrivez le problème...', phQuestion: 'Écrivez votre question...',
        send: 'Envoyer', sending: 'Envoi en cours...', error: 'Erreur lors de l\'envoi. Veuillez réessayer.',
        thanks: 'Merci !', thanksSub: 'Votre message a été envoyé. Nous l\'examinerons dès que possible.',
        home: 'Accueil', newMsg: 'Nouveau message', note: 'Les messages sont transmis directement à notre équipe.',
        back: '← Support',
    },
    it: {
        title: 'Feedback', subtitle: 'Contatta il team di sviluppo',
        desc: 'Le vostre idee, suggerimenti o reclami sono importanti per noi!',
        type: 'Tipo di messaggio', suggestion: 'Suggerimento', complaint: 'Reclamo', question: 'Domanda',
        email: 'Email (opzionale)', emailPh: 'Per rispondervi',
        subject: 'Oggetto', subjectPh: 'Breve descrizione',
        message: 'Il vostro messaggio *',
        phSuggestion: 'Qual è la vostra idea?', phComplaint: 'Descrivete il problema...', phQuestion: 'Scrivete la vostra domanda...',
        send: 'Invia', sending: 'Invio in corso...', error: 'Errore durante l\'invio. Riprovare.',
        thanks: 'Grazie!', thanksSub: 'Messaggio inviato con successo.',
        home: 'Homepage', newMsg: 'Nuovo messaggio', note: 'I messaggi vengono inoltrati direttamente al nostro team.',
        back: '← Supporto',
    },
    es: {
        title: 'Comentarios', subtitle: 'Contacta al equipo de desarrollo',
        desc: '¡Tus ideas, sugerencias o quejas son importantes para nosotros!',
        type: 'Tipo de mensaje', suggestion: 'Sugerencia', complaint: 'Queja', question: 'Pregunta',
        email: 'Email (opcional)', emailPh: 'Para responderle',
        subject: 'Asunto', subjectPh: 'Breve descripción',
        message: 'Su mensaje *',
        phSuggestion: '¿Cuál es tu idea?', phComplaint: 'Describe el problema...', phQuestion: 'Escribe tu pregunta...',
        send: 'Enviar', sending: 'Enviando...', error: 'Error al enviar. Intente de nuevo.',
        thanks: '¡Gracias!', thanksSub: 'Tu mensaje ha sido enviado exitosamente.',
        home: 'Inicio', newMsg: 'Nuevo mensaje', note: 'Los mensajes se envían directamente a nuestro equipo.',
        back: '← Soporte',
    },
    nl: {
        title: 'Feedback', subtitle: 'Neem contact op met het ontwikkelteam',
        desc: 'Uw ideeen, suggesties of klachten zijn belangrijk voor ons. We lezen elk bericht!',
        type: 'Berichttype', suggestion: 'Suggestie', complaint: 'Klacht', question: 'Vraag',
        email: 'E-mail (optioneel)', emailPh: 'Zodat we u kunnen antwoorden',
        subject: 'Onderwerp', subjectPh: 'Korte beschrijving',
        message: 'Uw bericht *',
        phSuggestion: 'Wat is uw idee?', phComplaint: 'Beschrijf het probleem...', phQuestion: 'Schrijf uw vraag hier...',
        send: 'Verzenden', sending: 'Wordt verzonden...', error: 'Fout bij het verzenden. Probeer het opnieuw.',
        thanks: 'Bedankt!', thanksSub: 'Uw bericht is succesvol verzonden.',
        home: 'Startpagina', newMsg: 'Nieuw bericht', note: 'Berichten worden direct doorgestuurd naar ons team.',
        back: '← Ondersteuning',
    },
};

function FeedbackContent() {
    const searchParams = useSearchParams();
    const initialType = searchParams.get('type') || 'suggestion';
    const locale = useLocale();
    const tx = texts[locale] || texts['en'];
    const t = (k: string) => tx[k] || k;

    const [feedbackType, setFeedbackType] = useState<'suggestion' | 'complaint' | 'question'>(
        initialType === 'complaint' ? 'complaint' : 'suggestion'
    );
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (auth.currentUser?.email) setEmail(auth.currentUser.email);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        setSending(true);
        try {
            await addDoc(collection(db, 'feedback'), {
                type: feedbackType, subject, message, email,
                userId: auth.currentUser?.uid || null, status: 'new', createdAt: Timestamp.now(),
            });
            setSent(true);
        } catch {
            alert(t('error'));
        }
        setSending(false);
    };

    if (sent) {
        return (
            <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
                <PublicHeader themeAware={true} />
                <div className="flex-1 flex items-center justify-center p-4 pt-32">
                    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h1 className="text-2xl font-bold mb-2">{t('thanks')}</h1>
                        <p className="text-gray-500 dark:text-white/60 mb-6">{t('thanksSub')}</p>
                        <div className="space-y-3">
                            <Link href="/" className="block w-full bg-[#fb335b] text-white py-3 rounded-xl font-semibold hover:bg-red-600">{t('home')}</Link>
                            <button onClick={() => { setSent(false); setMessage(''); setSubject(''); }} className="block w-full bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-white/20">
                                {t('newMsg')}
                            </button>
                        </div>
                    </div>
                </div>
                <PublicFooter themeAware={true} />
            </div>
        );
    }

    const getPlaceholder = () => {
        if (feedbackType === 'suggestion') return t('phSuggestion');
        if (feedbackType === 'complaint') return t('phComplaint');
        return t('phQuestion');
    };

    const typeButtons: { key: 'suggestion' | 'complaint' | 'question'; emoji: string }[] = [
        { key: 'suggestion', emoji: '💡' },
        { key: 'complaint', emoji: '📝' },
        { key: 'question', emoji: '❓' },
    ];

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-white font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
            <PublicHeader themeAware={true} />

            <main className="pt-32 pb-20 px-4 md:px-20 lg:px-40 flex-1">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-6">
                        <h1 className="text-2xl font-bold mb-2">{t('subtitle')}</h1>
                        <p className="text-gray-500 dark:text-white/60 mb-6">{t('desc')}</p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 dark:text-white/80 mb-2">{t('type')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {typeButtons.map(b => (
                                        <button key={b.key} type="button" onClick={() => setFeedbackType(b.key)}
                                            className={`py-3 px-4 rounded-xl border text-center transition ${feedbackType === b.key ? 'border-[#fb335b] bg-[#fb335b]/20 text-[#fb335b] dark:text-white' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/30'}`}>
                                            <span className="text-xl">{b.emoji}</span>
                                            <p className="text-sm font-medium mt-1">{t(b.key)}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-600 dark:text-white/80 mb-1">{t('email')}</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('emailPh')}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:ring-2 focus:ring-[#fb335b] focus:border-transparent" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-1">{t('subject')}</label>
                                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder={t('subjectPh')}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:ring-2 focus:ring-[#fb335b] focus:border-transparent" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-1">{t('message')}</label>
                                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder={getPlaceholder()}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:ring-2 focus:ring-[#fb335b] focus:border-transparent resize-none" required />
                            </div>

                            <button type="submit" disabled={sending || !message.trim()}
                                className="w-full bg-[#fb335b] text-white py-4 rounded-xl font-semibold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                                {sending ? t('sending') : t('send')}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-gray-400 dark:text-white/40 text-sm mt-6">{t('note')}</p>
                </div>
            </main>

            <PublicFooter themeAware={true} />
        </div>
    );
}

export default function FeedbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white dark:bg-[#0a0a0f] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#fb335b]" />
            </div>
        }>
            <FeedbackContent />
        </Suspense>
    );
}
