require('dotenv').config();
const sdk = require('node-appwrite');
const nodemailer = require('nodemailer');

module.exports = async function (context) {
    try {
        // Log incoming request
        console.log('Function started, checking payload...');
        
        if (!context.req?.payload) {
            console.log('No payload provided');
            return context.res.json({
                success: false,
                message: 'No payload provided'
            });
        }

        // Parse the request data
        let payload;
        try {
            payload = JSON.parse(context.req.payload);
            console.log('Parsed payload:', payload);
        } catch (error) {
            console.error('JSON parse error:', error);
            return context.res.json({
                success: false,
                message: 'Invalid JSON in payload'
            });
        }

        const { emails, testLink, testCode } = payload;

        // Validate required fields
        if (!Array.isArray(emails) || emails.length === 0 || !testLink || !testCode) {
            console.log('Validation failed:', { emails, testLink, testCode });
            return context.res.json({
                success: false,
                message: 'Missing required fields: emails (must be a non-empty array), testLink, or testCode'
            });
        }

        // Log environment variables (without sensitive data)
        console.log('Checking environment variables...');
        console.log('APPWRITE_ENDPOINT exists:', !!process.env.APPWRITE_ENDPOINT);
        console.log('APPWRITE_FUNCTION_PROJECT_ID exists:', !!process.env.APPWRITE_FUNCTION_PROJECT_ID);
        console.log('APPWRITE_API_KEY exists:', !!process.env.APPWRITE_API_KEY);
        console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
        console.log('EMAIL_APP_PASSWORD exists:', !!process.env.EMAIL_APP_PASSWORD);

        // Validate environment variables
        if (!process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_FUNCTION_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
            return context.res.json({
                success: false,
                message: 'Appwrite SDK configuration missing in environment variables'
            });
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
            return context.res.json({
                success: false,
                message: 'Email configuration missing in environment variables'
            });
        }

        // Initialize Appwrite SDK
        const client = new sdk.Client();
        client
            .setEndpoint(process.env.APPWRITE_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);

        console.log('Creating email transporter...');
        
        // Configure email transporter with verbose logging
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            },
            debug: true, // Enable debug logging
            logger: true  // Enable built-in logger
        });

        // Verify transporter configuration
        try {
            console.log('Verifying email transporter...');
            await transporter.verify();
            console.log('Transporter verification successful');
        } catch (error) {
            console.error('Transporter verification failed:', error);
            return context.res.json({
                success: false,
                message: 'Email configuration verification failed: ' + error.message
            });
        }

        console.log('Starting to send emails to:', emails);

        // Send emails with detailed error handling
        const emailResults = await Promise.all(
            emails.map(async (email) => {
                try {
                    console.log(`Attempting to send email to: ${email}`);
                    
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

                    const info = await transporter.sendMail(mailOptions);
                    console.log(`Email sent successfully to ${email}:`, info.messageId);
                    return { email, success: true, messageId: info.messageId };
                } catch (error) {
                    console.error(`Failed to send email to ${email}:`, error);
                    return { email, success: false, error: error.message };
                }
            })
        );

        // Analyze results
        const successfulEmails = emailResults.filter(result => result.success);
        const failedEmails = emailResults.filter(result => !result.success);

        console.log('Email sending completed:', {
            successful: successfulEmails.length,
            failed: failedEmails.length
        });

        // Return detailed response
        return context.res.json({
            success: successfulEmails.length > 0,
            message: `Successfully sent ${successfulEmails.length} out of ${emails.length} invitations`,
            details: {
                successful: successfulEmails,
                failed: failedEmails
            }
        });

    } catch (error) {
        console.error('Unexpected error in email invitation function:', error);
        return context.res.json({
            success: false,
            message: 'Unexpected error: ' + error.message,
            error: error.stack
        });
    }
};
