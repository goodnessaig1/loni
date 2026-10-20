import json
import asyncio
import urllib.request
import urllib.error
import urllib.parse
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

def _send_partner_invite_email_sync(to_email: str, inviter_name: str, message: str):
    html_content = f"""
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; }}
            .header {{ text-align: center; padding: 40px 0 20px; }}
            .header img {{ max-height: 80px; }}
            .content {{ padding: 20px 40px 40px; text-align: center; color: #333333; }}
            .title {{ font-size: 24px; font-weight: bold; color: #000000; margin-bottom: 20px; }}
            .message {{ font-size: 16px; line-height: 1.6; color: #4B5563; margin-bottom: 30px; padding: 20px; background-color: #f9fafb; border-radius: 12px; font-style: italic; }}
            .footer {{ background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }}
            .footer p {{ margin: 0; opacity: 0.9; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div style="text-align: center; padding-top: 30px;">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" style="height: 40px;" />
            </div>
            <div class="header" style="padding-top: 20px;">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/support-emjoi.svg" alt="Support" />
            </div>
            <div class="content">
              <div class="title">Always Stay Connected!</div>
              <p style="font-size: 16px; margin-bottom: 20px;">
                You've been invited by <strong>{inviter_name}</strong> to join their support circle on Loni.
              </p>
              <div class="message">
                "{message}"
              </div>
              <p style="color: #666666; font-size: 14px; margin-top: 20px;">
                Download the Loni app to stay connected, receive emergency updates, and support their journey.
              </p>
              <div style="margin-top: 30px; margin-bottom: 20px;">
                <a href="{settings.FRONTEND_URL}/verify?email={urllib.parse.quote(to_email)}" style="background-color: #D62D88; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; {datetime.now().year} Loni. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    """

    payload = {
        "sender": {"name": f"{inviter_name} via Loni", "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"You're invited to join {inviter_name}'s support circle on Loni 💜",
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
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
        print(f"Partner invite email sent to {to_email}")
    except urllib.error.URLError as e:
        print(f"Error sending partner invite email: {e}")

async def send_partner_invite_email(to_email: str, inviter_name: str, message: str):
    await asyncio.to_thread(_send_partner_invite_email_sync, to_email, inviter_name, message)

def _send_inviter_connection_success_email_sync(to_email: str, partner_name: str):
    html_content = f"""
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; }}
            .header {{ text-align: center; padding: 40px 0 20px; }}
            .content {{ padding: 20px 40px 40px; text-align: center; color: #333333; }}
            .title {{ font-size: 24px; font-weight: bold; color: #000000; margin-bottom: 20px; }}
            .footer {{ background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }}
            .footer p {{ margin: 0; opacity: 0.9; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" style="height: 40px;" />
            </div>
            <div class="content">
              <div class="title">Partner Connected! 🎉</div>
              <p style="font-size: 16px; margin-bottom: 20px;">
                Great news! <strong>{partner_name}</strong> has successfully set up their account and joined your support circle.
              </p>
              <p style="color: #666666; font-size: 14px; margin-top: 20px;">
                They will now receive your emergency updates and support notifications.
              </p>
            </div>
            <div class="footer">
              <p>&copy; {datetime.now().year} Loni. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    """

    payload = {
        "sender": {"name": "Loni Team", "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"{partner_name} has joined your support circle! 🎉",
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
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
        print(f"Inviter success email sent to {to_email}")
    except urllib.error.URLError as e:
        print(f"Error sending email: {e}")

async def send_inviter_connection_success_email(to_email: str, partner_name: str):
    await asyncio.to_thread(_send_inviter_connection_success_email_sync, to_email, partner_name)


def _send_partner_connection_success_email_sync(to_email: str, inviter_name: str):
    html_content = f"""
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; }}
            .header {{ text-align: center; padding: 40px 0 20px; }}
            .content {{ padding: 20px 40px 40px; text-align: center; color: #333333; }}
            .title {{ font-size: 24px; font-weight: bold; color: #000000; margin-bottom: 20px; }}
            .footer {{ background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }}
            .footer p {{ margin: 0; opacity: 0.9; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" style="height: 40px;" />
            </div>
            <div class="content">
              <div class="title">You are now connected! 💜</div>
              <p style="font-size: 16px; margin-bottom: 20px;">
                Your account is fully set up. You are now officially connected to <strong>{inviter_name}</strong>'s support circle.
              </p>
              <p style="color: #666666; font-size: 14px; margin-top: 20px;">
                You can log into the Loni app anytime to view their updates.
              </p>
            </div>
            <div class="footer">
              <p>&copy; {datetime.now().year} Loni. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    """

    payload = {
        "sender": {"name": "Loni Team", "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"You are now connected to {inviter_name}! 💜",
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
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
        print(f"Partner success email sent to {to_email}")
    except urllib.error.URLError as e:
        print(f"Error sending email: {e}")

async def send_partner_connection_success_email(to_email: str, inviter_name: str):
    await asyncio.to_thread(_send_partner_connection_success_email_sync, to_email, inviter_name)

def _send_partner_removal_user_email_sync(to_email: str, partner_name: str):
    html_content = f"""
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; }}
            .header {{ text-align: center; padding: 40px 0 20px; }}
            .content {{ padding: 20px 40px 40px; text-align: center; color: #333333; }}
            .title {{ font-size: 24px; font-weight: bold; color: #000000; margin-bottom: 20px; }}
            .footer {{ background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }}
            .footer p {{ margin: 0; opacity: 0.9; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" style="height: 40px;" />
            </div>
            <div class="content">
              <div class="title">Contact Removed Successfully</div>
              <p style="font-size: 16px; margin-bottom: 20px;">
                You have successfully removed <strong>{partner_name}</strong> from your emergency contacts.
              </p>
              <p style="color: #666666; font-size: 14px; margin-top: 20px; line-height: 1.5;">
                They will no longer receive any emergency alerts, health updates, or have access to your profile data through the Loni app.
              </p>
            </div>
            <div class="footer">
              <p>&copy; {datetime.now().year} Loni. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    """

    payload = {
        "sender": {"name": "Loni Team", "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"Contact Removed: {partner_name}",
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
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
        print(f"Partner removal (user) email sent to {to_email}")
    except urllib.error.URLError as e:
        print(f"Error sending email: {e}")

async def send_partner_removal_user_email(to_email: str, partner_name: str):
    await asyncio.to_thread(_send_partner_removal_user_email_sync, to_email, partner_name)


def _send_partner_removal_partner_email_sync(to_email: str, inviter_name: str):
    html_content = f"""
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; }}
            .header {{ text-align: center; padding: 40px 0 20px; }}
            .content {{ padding: 20px 40px 40px; text-align: center; color: #333333; }}
            .title {{ font-size: 24px; font-weight: bold; color: #000000; margin-bottom: 20px; }}
            .footer {{ background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }}
            .footer p {{ margin: 0; opacity: 0.9; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" style="height: 40px;" />
            </div>
            <div class="content">
              <div class="title">Access Revoked</div>
              <p style="font-size: 16px; margin-bottom: 20px; line-height: 1.5;">
                <strong>{inviter_name}</strong> has removed you from their emergency contacts circle.
              </p>
              <p style="color: #666666; font-size: 14px; margin-top: 20px; line-height: 1.5;">
                As a result, your partner account has been deactivated. You will no longer receive emergency alerts or updates, and you can no longer log into the Loni app. We thank you for supporting them during their journey.
              </p>
            </div>
            <div class="footer">
              <p>&copy; {datetime.now().year} Loni. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    """

    payload = {
        "sender": {"name": "Loni Team", "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": f"Loni Access Revoked for {inviter_name}'s Circle",
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
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
        print(f"Partner removal (partner) email sent to {to_email}")
    except urllib.error.URLError as e:
        print(f"Error sending email: {e}")

async def send_partner_removal_partner_email(to_email: str, inviter_name: str):
    await asyncio.to_thread(_send_partner_removal_partner_email_sync, to_email, inviter_name)

def _send_account_approved_email_sync(to_email: str, name: str, user_type: str):
    html_content = f"""
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
            .header {{ text-align: center; padding: 30px 0 10px; }}
            .header img {{ max-height: 50px; }}
            .content {{ padding: 20px 30px 40px; text-align: center; color: #333333; line-height: 1.6; }}
            .footer {{ background-color: #D62D88; padding: 25px; text-align: center; color: #ffffff; font-size: 14px; }}
            .footer p {{ margin: 0; opacity: 0.9; }}
            .title {{ font-size: 24px; color: #111827; margin-bottom: 20px; }}
            .highlight {{ color: #D62D88; font-weight: bold; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" />
            </div>
            <div class="content">
              <div class="title">Congratulations, {name}! 🎉</div>
              <p>Your account has been officially <span class="highlight">approved</span>.</p>
              <p>We are thrilled to welcome you to Loni as a registered {user_type}. Your skills and dedication will play a vital role in our mission to support mothers through every urgent moment.</p>
              <p>You can now log into your account and start receiving requests. Thank you for joining our community!</p>
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
        "subject": "Congratulations! Your Loni Account is Approved 🎉",
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
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
        print(f"Approval email sent to {to_email}")
    except urllib.error.URLError as e:
        print(f"Error sending email: {e}")

async def send_account_approved_email(to_email: str, name: str, user_type: str):
    await asyncio.to_thread(_send_account_approved_email_sync, to_email, name, user_type)



def _send_plain_email_sync(to_email: str, subject: str, html_content: str, reply_to: str | None = None):
    """A simple branded-less email (used to forward in-app support messages to the support inbox)."""
    if not settings.BREVO_API_KEY:
        print(f"BREVO_API_KEY is not set. Skipping email to {to_email}: {subject}")
        return
    payload = {
        "sender": {"name": "Loni App", "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content,
    }
    if reply_to:
        payload["replyTo"] = {"email": reply_to}
    req = urllib.request.Request(
        'https://api.brevo.com/v3/smtp/email',
        data=json.dumps(payload).encode('utf-8'),
        headers={'api-key': settings.BREVO_API_KEY, 'Content-Type': 'application/json'},
        method='POST',
    )
    import ssl
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(cafile=certifi.where())
    except ImportError:
        pass
    with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
        response.read()


async def send_plain_email(to_email: str, subject: str, html_content: str, reply_to: str | None = None):
    await asyncio.to_thread(_send_plain_email_sync, to_email, subject, html_content, reply_to)
