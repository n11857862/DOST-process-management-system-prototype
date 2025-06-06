
const sendNotification = async (notificationPayload) => {
    console.log('[NotificationService] Received request to send notification:', JSON.stringify(notificationPayload, null, 2));

    const { userId, title, message, type, payload, channel = 'inApp' } = notificationPayload;

    if (!userId && channel === 'inApp') { // For in-app, userId is crucial
        console.warn('[NotificationService] In-app notification requested without a userId. Cannot proceed.');
        return { success: false, message: 'User ID is required for in-app notifications.', details: notificationPayload };
    }



    try {

        if (channel === 'inApp') {
            console.log(`[NotificationService] Successfully processed (simulated send) IN-APP notification for user ${userId}: "${title}"`);
        } else if (channel === 'webhook') {
            console.log(`[NotificationService] Successfully processed (simulated send) WEBHOOK notification: ${JSON.stringify(payload)}`);
            // For webhooks, payload would likely be the entire body to send.
        } else {
            console.log(`[NotificationService] Successfully processed (simulated send) notification of type '${type}' via channel '${channel}'.`);
        }

        return { success: true, message: `Notification processed (simulated) via ${channel}.`, deliveryDetails: { channel, sentAt: new Date() } };

    } catch (error) {
        console.error(`[NotificationService] Error simulating notification send for channel ${channel}:`, error);
        return { success: false, message: `Error processing notification: ${error.message}`, error, details: notificationPayload };
    }
};

module.exports = {
    sendNotification,
};
