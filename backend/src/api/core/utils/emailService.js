const nodemailer = require('nodemailer');


let transporter;

const initializeEmailService = async () => {
    console.log('[EMAIL_SERVICE] DEBUG - Environment variables:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? '[HIDDEN]' : 'undefined');
    
    if (process.env.NODE_ENV === 'development_ethereal') {
        let testAccount = await nodemailer.createTestAccount();
        console.log('Ethereal test account created:', testAccount.user, testAccount.pass);
        console.log('Preview Ethereal emails at:', nodemailer.getTestMessageUrl({ user: testAccount.user, pass: testAccount.pass, from: '"Workflow System" <noreply@example.com>', to: 'test@example.com', subject: 'Test', text: 'Hello' }));


        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    } else {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    try {
        await transporter.verify();
        console.log('[EMAIL_SERVICE] Email service is ready to send messages.');
    } catch (error) {
        console.error('[EMAIL_SERVICE] Error verifying email transport configuration:', error);
    }
};



const sendEmail = async (mailOptions) => {
    if (!transporter) {
        await initializeEmailService(); 
        if (!transporter) {
             console.error('[EMAIL_SERVICE] Email transporter is not initialized. Cannot send email.');
             throw new Error('Email service not available.');
        }
    }

    const defaultFrom = process.env.EMAIL_FROM_DEFAULT || '"Workflow Notification" <noreply@example.com>';

    const optionsToSend = {
        from: mailOptions.from || defaultFrom,
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
    };

    try {
        console.log(`[EMAIL_SERVICE] Attempting to send email to: ${optionsToSend.to} with subject: ${optionsToSend.subject}`);
        let info = await transporter.sendMail(optionsToSend);
        console.log('[EMAIL_SERVICE] Message sent: %s', info.messageId);
        if (process.env.NODE_ENV === 'development_ethereal' && nodemailer.getTestMessageUrl(info)) {
            console.log('[EMAIL_SERVICE] Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }
        return info;
    } catch (error) {
        console.error('[EMAIL_SERVICE] Error sending email:', error);
        throw error;
    }
};


module.exports = {
    sendEmail,
    initializeEmailService
};