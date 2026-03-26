// ============================================================
// EMAIL SERVICE — Sends transactional emails via Nodemailer
// Uses Ethereal (free test SMTP) for demo — shows preview URL
// Switch to Gmail/SendGrid/etc for production
// ============================================================

const nodemailer = require('nodemailer');

let transporter = null;
let testAccount = null;

// ============================================================
// Initialize — Creates an Ethereal test account on startup
// Ethereal captures emails so you can preview them via URL
// ============================================================
async function initMailer() {
  try {
    // Create a test account at Ethereal (fake SMTP service)
    testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    console.log('📧 Email service initialized (Ethereal Test SMTP)');
    console.log(`   Preview inbox: https://ethereal.email/login`);
    console.log(`   Email: ${testAccount.user}`);
    console.log(`   Pass:  ${testAccount.pass}`);
    return true;
  } catch (err) {
    console.log('⚠️  Email service unavailable (non-critical):', err.message);
    return false;
  }
}

// ============================================================
// Send Welcome Email — When a new user is created by admin
// ============================================================
async function sendWelcomeEmail(user, plainPassword) {
  if (!transporter) return null;

  try {
    const info = await transporter.sendMail({
      from: '"Ignatiuz CRM" <noreply@ignatiuz.com>',
      to: user.email,
      subject: '🎉 Welcome to Ignatiuz CRM — Your Account is Ready',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚡ Ignatiuz CRM</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Your account has been created</p>
          </div>
          
          <!-- Body -->
          <div style="padding: 32px;">
            <h2 style="color: #111; margin: 0 0 16px;">Welcome, ${user.name}! 👋</h2>
            <p style="color: #6b7280; line-height: 1.6;">Your Ignatiuz CRM account has been set up by the administrator. Here are your login details:</p>
            
            <!-- Credentials Box -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Email</td>
                  <td style="padding: 8px 0; color: #111; font-weight: 500;">${user.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Password</td>
                  <td style="padding: 8px 0; color: #111; font-weight: 500;">${plainPassword}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Role</td>
                  <td style="padding: 8px 0;"><span style="background: ${user.role === 'admin' ? '#fef2f2' : '#eff6ff'}; color: ${user.role === 'admin' ? '#dc2626' : '#1d4ed8'}; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: capitalize;">${user.role}</span></td>
                </tr>
              </table>
            </div>
            
            <p style="color: #6b7280; font-size: 13px;">🔒 Please change your password after your first login for security.</p>
          </div>
          
          <!-- Footer -->
          <div style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This is an automated message from Ignatiuz CRM • ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      `
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`📧 Welcome email sent to ${user.email}`);
    console.log(`   Preview: ${previewUrl}`);
    return previewUrl;
  } catch (err) {
    console.log(`⚠️  Failed to send welcome email: ${err.message}`);
    return null;
  }
}

// ============================================================
// Send Login Notification — When user successfully logs in
// ============================================================
async function sendLoginNotification(user) {
  if (!transporter) return null;

  const loginTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  try {
    const info = await transporter.sendMail({
      from: '"Ignatiuz CRM" <noreply@ignatiuz.com>',
      to: user.email,
      subject: '🔐 New Login Detected — Ignatiuz CRM',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <div style="background: #111111; padding: 24px 32px; display: flex; align-items: center;">
            <h1 style="color: white; margin: 0; font-size: 18px;">⚡ Ignatiuz CRM — Login Alert</h1>
          </div>
          
          <!-- Body -->
          <div style="padding: 32px;">
            <h2 style="color: #111; margin: 0 0 12px;">Hi ${user.name},</h2>
            <p style="color: #6b7280; line-height: 1.6;">A new login was detected on your Ignatiuz CRM account.</p>
            
            <!-- Login Details -->
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #166534; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Account</td>
                  <td style="padding: 6px 0; color: #111; font-weight: 500;">${user.email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #166534; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Time</td>
                  <td style="padding: 6px 0; color: #111; font-weight: 500;">${loginTime} IST</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #166534; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Role</td>
                  <td style="padding: 6px 0; color: #111; font-weight: 500; text-transform: capitalize;">${user.role}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #9ca3af; font-size: 13px;">If this wasn't you, please contact your administrator immediately.</p>
          </div>
          
          <!-- Footer -->
          <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Ignatiuz CRM Security Notification • ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      `
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`📧 Login notification sent to ${user.email}`);
    console.log(`   Preview: ${previewUrl}`);
    return previewUrl;
  } catch (err) {
    console.log(`⚠️  Failed to send login notification: ${err.message}`);
    return null;
  }
}

module.exports = { initMailer, sendWelcomeEmail, sendLoginNotification };
