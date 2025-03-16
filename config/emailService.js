// File: vaanshika-backend/config/emailService.js
// Email service for sending verification and reset emails

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Email configuration
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER || 'your-email@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your-app-password';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Vaanshika <noreply@vaanshika.com>';

// For development/testing - use ethereal.email service when real credentials aren't available
const createTestAccount = async () => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('Created test email account:', testAccount.user);
    return {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    };
  } catch (error) {
    console.error('Failed to create test email account:', error);
    return null;
  }
};

// Create reusable transporter
const createTransporter = async () => {
  // Check if we have valid email credentials
  if (EMAIL_USER !== 'your-email@gmail.com' && EMAIL_PASS !== 'your-app-password') {
    // Use real email service
    console.log('Using real email service with:', EMAIL_USER);
    return nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false // For development only, remove in production
      }
    });
  } else {
    // Use ethereal.email for testing
    console.log('⚠️ USING ETHEREAL EMAIL FOR TESTING (NO REAL EMAILS WILL BE SENT) ⚠️');
    console.log('To use real email service, set EMAIL_USER and EMAIL_PASS environment variables in .env file');
    console.log('For Gmail, you need to use an App Password: https://support.google.com/accounts/answer/185833');
    
    const testConfig = await createTestAccount();
    if (testConfig) {
      return nodemailer.createTransport(testConfig);
    } else {
      // Fallback to a mock transporter that logs but doesn't send
      console.log('Using mock email transporter');
      return {
        sendMail: (options) => {
          console.log('MOCK EMAIL SENT:');
          console.log('To:', options.to);
          console.log('Subject:', options.subject);
          console.log('Content:', options.text || options.html.substring(0, 100) + '...');
          return Promise.resolve({ messageId: 'mock-message-id' });
        }
      };
    }
  }
};

/**
 * Send verification email to user
 * @param {Object} user - User object with email and name
 * @param {string} verificationLink - Verification link
 * @returns {Promise} - Email sending result
 */
export const sendVerificationEmail = async (user, verificationLink) => {
  try {
    const transporter = await createTransporter();
    
    // Email content
    const mailOptions = {
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Verify Your Email - Vaanshika Family Tree',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4F7942;">Vaanshika Family Tree</h1>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h2>Hello ${user.name},</h2>
            <p>Thank you for registering with Vaanshika Family Tree. To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${verificationLink}" style="background-color: #4F7942; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Verify Email Address</a>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; color: #4F7942;">${verificationLink}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} Vaanshika Family Tree. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    
    // If using Ethereal, provide preview URL
    if (info.messageId && info.messageId !== 'mock-message-id' && info.preview) {
      console.log('');
      console.log('📧 ETHEREAL EMAIL PREVIEW URL:');
      console.log('📧 ' + nodemailer.getTestMessageUrl(info));
      console.log('📧 Open this URL in your browser to view the email');
      console.log('');
      
      // Return the preview URL so it can be used in the response
      return {
        ...info,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
    }
    
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send password reset email to user
 * @param {Object} user - User object with email and name
 * @param {string} resetLink - Password reset link
 * @returns {Promise} - Email sending result
 */
export const sendPasswordResetEmail = async (user, resetLink) => {
  try {
    const transporter = await createTransporter();
    
    // Email content
    const mailOptions = {
      from: EMAIL_FROM,
      to: user.email,
      subject: 'Reset Your Password - Vaanshika Family Tree',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4F7942;">Vaanshika Family Tree</h1>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h2>Hello ${user.name},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${resetLink}" style="background-color: #4F7942; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; color: #4F7942;">${resetLink}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p>This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} Vaanshika Family Tree. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    
    // If using Ethereal, provide preview URL
    if (info.messageId && info.messageId !== 'mock-message-id' && info.preview) {
      console.log('');
      console.log('📧 ETHEREAL EMAIL PREVIEW URL:');
      console.log('📧 ' + nodemailer.getTestMessageUrl(info));
      console.log('📧 Open this URL in your browser to view the email');
      console.log('');
      
      // Return the preview URL so it can be used in the response
      return {
        ...info,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
    }
    
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail
}; 