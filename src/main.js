const sdk = require('node-appwrite');
const nodemailer = require('nodemailer');

module.exports = async function (req, res) {
    try {
        if (!req || !res) {
            console.error("Request or response object is undefined.");
            return;
        }

        // Verify payload
        if (!req.payload) {
            return res.status(400).json({
                success: false,
                message: 'No payload provided'
            });
        }

        // Parse the request data
        let payload;
        try {
            payload = JSON.parse(req.payload);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON in payload'
            });
        }

        const { emails, testLink, testCode } = payload;

        // Validate required fields
        if (!Array.isArray(emails) || emails.length === 0 || !testLink || !testCode) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: emails (must be a non-empty array), testLink, or testCode'
            });
        }

        // Initialize Appwrite SDK
        const client = new sdk.Client();
        client
            .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
            .setKey(process.env.APPWRITE_API_KEY || '');

        if (!process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_FUNCTION_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Appwrite SDK configuration missing in environment variables'
            });
        }

        // Configure email transporter (using Gmail as an example)
        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            return res.status(500).json({
                success: false,
                message: 'Email configuration missing in environment variables'
            });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });

        console.log('Sending to emails:', emails);

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

            return transporter.sendMail(mailOptions)
                .catch(error => {
                    console.error(`Failed to send email to ${email}:`, error);
                    return null;
                });
        });

        await Promise.all(emailPromises);

        return res.status(200).json({
            success: true,
            message: 'Invitations sent successfully'
        });
    } catch (error) {
        console.error('Error sending invitations:', error);

        if (res && res.status) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send invitations',
                error: error.message
            });
        } else {
            console.error("Response object or status is unavailable.");
        }
    }
};
