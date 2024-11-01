require('dotenv').config();
const sdk = require('node-appwrite');

module.exports = async function (context) {
    try {
        // Log incoming request
        context.log('Function started, checking payload...');

        if (!context.req?.payload) {
            context.log('No payload provided');
            return context.res.json({
                success: false,
                message: 'No payload provided'
            });
        }

        // Parse the request data
        let payload;
        try {
            payload = JSON.parse(context.req.payload);
            context.log('Parsed payload:', payload);
        } catch (error) {
            context.error('JSON parse error:', error);
            return context.res.json({
                success: false,
                message: 'Invalid JSON in payload'
            });
        }

        const { emails, testLink, testCode } = payload;

        // Validate required fields
        if (!Array.isArray(emails) || emails.length === 0 || !testLink || !testCode) {
            context.log('Validation failed:', { emails, testLink, testCode });
            return context.res.json({
                success: false,
                message: 'Missing required fields: emails (must be a non-empty array), testLink, or testCode'
            });
        }

        // Log environment variables (without sensitive data)
        context.log('Checking environment variables...');
        context.log('APPWRITE_ENDPOINT exists:', !!process.env.APPWRITE_ENDPOINT);
        context.log('APPWRITE_FUNCTION_PROJECT_ID exists:', !!process.env.APPWRITE_FUNCTION_PROJECT_ID);
        context.log('APPWRITE_API_KEY exists:', !!process.env.APPWRITE_API_KEY);

        // Validate environment variables
        if (!process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_FUNCTION_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
            return context.res.json({
                success: false,
                message: 'Appwrite SDK configuration missing in environment variables'
            });
        }

        // Initialize Appwrite SDK
        const client = new sdk.Client();
        const emailService = new sdk.Email(client);

        client
            .setEndpoint(process.env.APPWRITE_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);

        context.log('Starting to send emails to:', emails);

        // Send emails with Appwrite messaging
        const emailResults = await Promise.all(
            emails.map(async (email) => {
                try {
                    context.log(`Attempting to send email to: ${email}`);

                    const message = {
                        from: process.env.EMAIL_USER, // Set the sender email
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

                    await emailService.send(message);
                    context.log(`Email sent successfully to ${email}`);
                    return { email, success: true };
                } catch (error) {
                    context.error(`Failed to send email to ${email}:`, error);
                    return { email, success: false, error: error.message };
                }
            })
        );

        // Analyze results
        const successfulEmails = emailResults.filter(result => result.success);
        const failedEmails = emailResults.filter(result => !result.success);

        context.log('Email sending completed:', {
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
        context.error('Unexpected error in email invitation function:', error);
        return context.res.json({
            success: false,
            message: 'Unexpected error occurred ',
            error: error.message || 'No error message available'
        });
    }
};
