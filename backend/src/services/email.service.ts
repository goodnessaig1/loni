import axios from 'axios';

export class EmailService {
  async sendOtpEmail(toEmail: string, otp: string, context: string = 'Verification') {
    const htmlContent = `
      <html>
        <body>
          <h2>Loni App</h2>
          <p>Your OTP for ${context} is: <strong>${otp}</strong></p>
          <p>Please do not share this code with anyone. It expires in 15 minutes.</p>
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
