import nodemailer from 'nodemailer';

export interface ApplicationConfirmationPayload {
  to: string;
  studentName: string;
  jobTitle: string;
  companyName: string;
  date: Date;
}

let cachedTransporter: nodemailer.Transporter | null = null;
let isEthereal = false;

export function _resetTransporterCache(): void {
  cachedTransporter = null;
  isEthereal = false;
}

/**
 * Returns a cached or newly initialized Nodemailer Transporter.
 * Falls back to an Ethereal test account if credentials are not configured.
 */
async function getTransporter(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (host && user && pass) {
    console.log('✉️ Initializing SMTP transporter with configured environment variables.');
    cachedTransporter = nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: port === '465',
      auth: { user, pass }
    });
    isEthereal = host.includes('ethereal.email');
    return cachedTransporter;
  }

  // Fallback to Ethereal Email for development
  console.log('✉️ No email credentials found. Creating dynamic Ethereal SMTP test account...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    isEthereal = true;
    console.log(`✉️ Ethereal SMTP account created successfully! User: ${testAccount.user}`);
    return cachedTransporter;
  } catch (error) {
    console.error('❌ Failed to create Ethereal SMTP test account:', error);
    throw error;
  }
}

/**
 * Sends a premium-designed HTML application confirmation email.
 * This is wrapped internally to prevent unhandled rejections from bubble-up,
 * but still returns info for testing/scripts.
 */
export async function sendApplicationConfirmationEmail(payload: ApplicationConfirmationPayload): Promise<any> {
  try {
    const transporter = await getTransporter();
    const formattedDate = payload.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const fromAddress = process.env.EMAIL_FROM || '"CareerGenie Support" <noreply@careergenie.com>';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Confirmed</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f8fafc;
            padding: 40px 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid #e2e8f0;
          }
          .header {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            padding: 32px 24px;
            text-align: center;
            color: #ffffff;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 40px 32px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            margin-top: 0;
            margin-bottom: 16px;
            color: #0f172a;
          }
          .body-text {
            font-size: 15px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 28px;
          }
          .details-card {
            background-color: #f1f5f9;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 28px;
            border: 1px solid #e2e8f0;
          }
          .details-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 16px;
          }
          .detail-row {
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
          }
          .detail-row:last-child {
            margin-bottom: 0;
          }
          .detail-label {
            font-weight: 500;
            color: #64748b;
            font-size: 14px;
            width: 30%;
          }
          .detail-value {
            font-weight: 600;
            color: #0f172a;
            font-size: 14px;
            width: 70%;
            text-align: right;
          }
          .footer {
            background-color: #f8fafc;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #94a3b8;
          }
          .footer p {
            margin: 4px 0;
          }
          .cta-button {
            display: inline-block;
            background-color: #4f46e5;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            margin-top: 12px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>Application Confirmed!</h1>
            </div>
            <div class="content">
              <p class="greeting">Hi ${payload.studentName},</p>
              <p class="body-text">
                Your application has been successfully submitted! The recruiter will review your profile, resume, and matches shortly.
              </p>
              
              <div class="details-card">
                <div class="details-title">Application Summary</div>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 500;">Job Title</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${payload.jobTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 500;">Company</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${payload.companyName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 500;">Applied On</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${formattedDate}</td>
                  </tr>
                </table>
              </div>

              <p class="body-text" style="margin-bottom: 0;">
                You can track your application status anytime from your CareerGenie Student Dashboard.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} CareerGenie. All rights reserved.</p>
              <p>This is an automated confirmation email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hi ${payload.studentName},

Your application has been successfully submitted!

Application Summary:
- Job Title: ${payload.jobTitle}
- Company: ${payload.companyName}
- Applied On: ${formattedDate}

You can track your application status anytime from your CareerGenie Student Dashboard.

Best regards,
CareerGenie Team
    `;

    const mailOptions = {
      from: fromAddress,
      to: payload.to,
      subject: `Application Confirmation: ${payload.jobTitle} at ${payload.companyName}`,
      text: textContent,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email successfully dispatched to ${payload.to} (Message ID: ${info.messageId})`);

    if (isEthereal) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✉️ Ethereal Preview URL: ${previewUrl}`);
    }

    return info;
  } catch (error) {
    console.error('❌ Error in sendApplicationConfirmationEmail service:', error);
    throw error;
  }
}
