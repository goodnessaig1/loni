import axios from 'axios';

export class EmailService {
  async sendOtpEmail(toEmail: string, otp: string, context: string = 'Verification') {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { text-align: center; padding: 30px 0 10px; }
            .header img { max-height: 50px; }
            .content { padding: 20px 30px 40px; text-align: center; color: #333333; }
            .otp { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #D62D88; margin: 25px 0; }
            .footer { background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }
            .footer p { margin: 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" />
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Verification Code</h2>
              <p>Your OTP for ${context} is:</p>
              <div class="otp">${otp}</div>
              <p style="color: #666666; font-size: 14px; margin-bottom: 0;">Please do not share this code with anyone. It expires in 15 minutes.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Loni. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: 'Loni App', email: process.env.BREVO_SENDER_EMAIL as string },
          to: [{ email: toEmail }],
          subject: `Your Loni ${context} Code`,
          htmlContent,
        },
        {
          headers: {
            'api-key': process.env.BREVO_API_KEY as string,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`Email sent to ${toEmail}`);
    } catch (error) {
      console.error('Error sending email', error);
      throw new Error('Failed to send email');
    }
  }
}

export const emailService = new EmailService();
