import json
import asyncio
import urllib.request
import urllib.error
from datetime import datetime
from app.core.config import settings

def _send_otp_email_sync(to_email: str, otp: str, context: str = 'Verification'):
    html_content = f"""
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
            .header {{ text-align: center; padding: 30px 0 10px; }}
            .header img {{ max-height: 50px; }}
            .content {{ padding: 20px 30px 40px; text-align: center; color: #333333; }}
            .otp {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #D62D88; margin: 25px 0; }}
            .footer {{ background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }}
            .footer p {{ margin: 0; opacity: 0.9; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" />
            </div>
            <div class="content">
              <h2 style="margin-top: 0;">Verification Code</h2>
              <p>Your OTP for {context} is:</p>
              <div class="otp">{otp}</div>
              <p style="color: #666666; font-size: 14px; margin-bottom: 0;">Please do not share this code with anyone. It expires in 15 minutes.</p>
            </div>
            <div class="footer">
              <p>&copy; {datetime.now().year} Loni. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    """

    payload = {
        "sender": {"name": "Loni App", "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"Your Loni {context} Code",
        "htmlContent": html_content
    }

    if not settings.BREVO_API_KEY:
        print("BREVO_API_KEY is not set. Skipping actual email send.")
        return

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        'https://api.brevo.com/v3/smtp/email',
        data=data,
        headers={
            'api-key': settings.BREVO_API_KEY,
            'Content-Type': 'application/json'
        },
        method='POST'
    )

    import ssl
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(cafile=certifi.where())
    except ImportError:
        # Fallback for local development macOS Python SSL issues
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
        print(f"Email sent to {to_email}")
    except urllib.error.URLError as e:
        print(f"Error sending email: {e}")
        # Note: We won't throw a fatal exception here to prevent blocking registration entirely if email fails occasionally
        # but in production you might want to handle this differently.

async def send_otp_email(to_email: str, otp: str, context: str = 'Verification'):
    await asyncio.to_thread(_send_otp_email_sync, to_email, otp, context)
