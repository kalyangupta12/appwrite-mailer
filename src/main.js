require('dotenv').config();
const sdk = require('node-appwrite');
const nodemailer = require('nodemailer');

module.exports = async function (req, res) {
    // Initialize response object if not provided
    if (!res) {
        res = {
            json: () => null,
            send: () => null,
            empty: () => null
        };
    }

    try {
        // Verify payload
        if (!req || !req.payload) {
            throw new Error('No payload provided');
        }

        // Parse the request data
        let payload;
        try {
            payload = JSON.parse(req.payload);
        } catch (error) {
            throw new Error('Invalid JSON in payload');
        }

        const { emails, testLink, testCode } = payload;

        // Validate required fields
        if (!Array.isArray(emails) || emails.length === 0 || !testLink || !testCode) {
            throw new Error('Missing required fields: emails (must be a non-empty array), testLink, or testCode');
        }

        // Initialize Appwrite SDK
        const client = new sdk.Client();
        
        if (!process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_FUNCTION_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
            throw new Error('Appwrite SDK configuration missing in environment variables');
        }

        client
            .setEndpoint(process.env.APPWRITE_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);

        // Validate email configuration
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            throw new Error('Email configuration missing in environment variables');
        }

        // Configure email transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });

        console.log('Sending to emails:', emails);

        // Send emails
        const emailPromises = emails.map(email => {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Invitation to Participate in a Test',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>You've Been Invited to Participate in a Test</h2>
                        <p>You can access the test using the following details:</p>
                        <p><strong>Test Link:</strong> <a href="${testLink}">${testLink}</a></p>
                        <p><strong>Test Code:</strong> ${testCode}</p>
                        <p>Please click the link above to begin the test.</p>
                        <p>If you have any questions, please contact the test administrator.</p>
                    </div>
                `
            };

            return transporter.sendMail(mailOptions);
        });

        const results = await Promise.all(emailPromises);

        // Return success response
        return res.json({
            success: true,
            message: 'Invitations sent successfully',
            results: results.map(r => r.messageId)
        });

    } catch (error) {
        console.error('Error in email invitation function:', error);

        // Return error response
        return res.json({
            success: false,
            message: error.message || 'Failed to send invitations'
        });
    }
};
