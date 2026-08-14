import nodemailer from 'nodemailer';

/**
 * Create Nodemailer SMTP Transporter using environment variables
 */
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('⚠️ [EmailService] EMAIL_USER or EMAIL_PASS not configured in .env. Emails will be logged to console in dev mode.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
};

/**
 * Send Therapist Approval Magic Link Invitation Email
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.practitionerName
 * @param {string} options.inviteUrl
 */
export const sendTherapistInviteEmail = async ({ toEmail, practitionerName, inviteUrl }) => {
  const fromEmail = process.env.EMAIL_FROM || `"MentalCare Clinical Network" <${process.env.EMAIL_USER || 'no-reply@mentalcare.com'}>`;
  const subject = `Welcome to MentalCare - Activate Your Therapist Account`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MentalCare Therapist Activation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f8faf9;
          margin: 0;
          padding: 0;
          color: #1e293b;
        }
        .email-container {
          max-width: 600px;
          margin: 30px auto;
          background-color: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(14, 47, 41, 0.08);
          border: 1px solid #e2e8f0;
        }
        .header {
          background: linear-gradient(135deg, #0E2F29 0%, #0A4D34 100%);
          padding: 36px 30px;
          text-align: center;
          color: #ffffff;
        }
        .header-title {
          font-size: 24px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .header-subtitle {
          font-size: 13px;
          color: #a7f3d0;
          margin-top: 6px;
          font-weight: 500;
        }
        .body-content {
          padding: 36px 32px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 16px;
        }
        .paragraph {
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
          margin-bottom: 24px;
        }
        .cta-container {
          text-align: center;
          margin: 32px 0;
        }
        .btn-primary {
          display: inline-block;
          background-color: #0A4D34;
          color: #ffffff !important;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          padding: 16px 36px;
          border-radius: 14px;
          box-shadow: 0 4px 14px rgba(10, 77, 52, 0.25);
          transition: background-color 0.2s ease;
        }
        .link-box {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px 16px;
          font-family: monospace;
          font-size: 12px;
          color: #334155;
          word-break: break-all;
          margin-top: 16px;
        }
        .expiry-note {
          font-size: 12px;
          color: #d97706;
          background-color: #fef3c7;
          border: 1px solid #fde68a;
          padding: 10px 14px;
          border-radius: 10px;
          margin-top: 24px;
        }
        .footer {
          background-color: #f8fafc;
          padding: 24px 30px;
          text-align: center;
          border-top: 1px solid #f1f5f9;
          font-size: 12px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1 class="header-title">MentalCare</h1>
          <p class="header-subtitle">Practitioner Clinical Portal</p>
        </div>

        <div class="body-content">
          <div class="greeting">Hello ${practitionerName},</div>
          <p class="paragraph">
            Congratulations! Your therapist application has been approved by the MentalCare Clinical Administration Team. You have been granted access to our practitioner network.
          </p>
          <p class="paragraph">
            Please click the button below to set your private password and activate your practitioner account:
          </p>

          <div class="cta-container">
            <a href="${inviteUrl}" target="_blank" class="btn-primary">
              Set Your Password & Activate Account
            </a>
          </div>

          <div class="expiry-note">
            ⏰ <strong>Security Notice:</strong> This invitation magic link is valid for <strong>7 days</strong>. If it expires, please contact your network administrator to re-issue an invite.
          </div>
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} MentalCare Inc. All rights reserved.<br>
          Confidential Mental Health Care Network
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Hello ${practitionerName},

Your therapist application for the MentalCare Clinical Network has been approved!

Please set your private password and activate your practitioner account by visiting this link:
${inviteUrl}

This link is valid for 7 days.

Best regards,
MentalCare Clinical Administration
  `;

  try {
    const transporter = createTransporter();
    
    // If SMTP credentials configured, send email via nodemailer
    if (process.env.EMAIL_USER && (process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD)) {
      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`✉️ [EmailService] Therapist activation email sent to ${toEmail}. MessageId: ${info.messageId}`);
      return { success: true, sent: true, messageId: info.messageId };
    } else {
      console.log(`✉️ [EmailService Mock Mode] (Configure EMAIL_USER & EMAIL_PASS in .env to send live emails)`);
      console.log(`To: ${toEmail}\nSubject: ${subject}\nInvite URL: ${inviteUrl}`);
      return { success: true, sent: false, mock: true, inviteUrl };
    }
  } catch (error) {
    console.error(`❌ [EmailService Error] Failed to send email to ${toEmail}:`, error);
    // Don't crash approval workflow if email fails, return error info
    return { success: false, error: error.message, inviteUrl };
  }
};
