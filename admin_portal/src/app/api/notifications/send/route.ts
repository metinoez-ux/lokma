// API Route for sending push notifications
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseMessaging, NOTIFICATION_TOPICS, NotificationTopic } from '@/lib/firebase-admin';

interface SendNotificationRequest {
    title: string;
    body: string;
    topic?: NotificationTopic;
    sendToAll?: boolean;
    data?: Record<string, string>;
}

export async function POST(request: NextRequest) {
    try {
        const body: SendNotificationRequest = await request.json();

        // Validate required fields
        if (!body.title || !body.body) {
            return NextResponse.json(
                { error: 'Title and body are required' },
                { status: 400 }
            );
        }

        const messaging = getFirebaseMessaging();

        // Build the message
        const message = {
            notification: {
                title: body.title,
                body: body.body,
            },
            data: body.data || {},
            topic: body.sendToAll ? NOTIFICATION_TOPICS.ALL_USERS : (body.topic || NOTIFICATION_TOPICS.ALL_USERS),
        };

        // Send the notification
        const response = await messaging.send(message);

        console.log('Successfully sent notification:', response);

        return NextResponse.json({
            success: true,
            messageId: response,
            topic: message.topic,
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        return NextResponse.json(
            { error: 'Failed to send notification', details: String(error) },
            { status: 500 }
        );
    }
}

// GET endpoint to list available topics
export async function GET() {
    return NextResponse.json({
        topics: Object.entries(NOTIFICATION_TOPICS).map(([key, value]) => ({
            id: value,
            name: getTopicDisplayName(value),
        })),
    });
}

function getTopicDisplayName(topic: string): string {
    const names: Record<string, string> = {
        'all_users': 'Tüm Kullanıcılar',
        'prayer_reminders': 'Namaz Hatırlatıcıları',
        'kandil_notifications': 'Kandil Bildirimleri',
        'news': 'Haberler',
        'promotions': 'Kampanyalar',
    };
    return names[topic] || topic;
}
