import { clientAuthInstance } from "../services/firebaseService.js";
import {
  // Comment out Firebase email/password methods
  // createUserWithEmailAndPassword,
  // signInWithEmailAndPassword,
  // sendPasswordResetEmail,
  // sendEmailVerification,
  signOut,
  fetchSignInMethodsForEmail,
} from "@firebase/auth";
import User from "../models/User.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "../config/emailService.js";

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || "vaanshika-jwt-secret-key";
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// 🚀 Register User with Email Verification
export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Token valid for 24 hours

    // Create new user with verification token
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationTokenExpiry: tokenExpiry
    });

    // Save the user to the database
    await newUser.save();

    // Create verification link - use frontend URL for verification
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/verify-email/${verificationToken}`;
    
    // Send verification email
    let emailPreviewUrl = null;
    try {
      const emailResult = await sendVerificationEmail(newUser, verificationLink);
      console.log('Verification email sent successfully');
      
      // Check if we have a preview URL (from Ethereal)
      if (emailResult && emailResult.previewUrl) {
        emailPreviewUrl = emailResult.previewUrl;
      }
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    // Response object
    const responseData = {
      message: "User registered successfully. Verification email sent.",
      verificationLink, // Remove this in production
    };
    
    // Add preview URL if available (for development/testing)
    if (emailPreviewUrl) {
      responseData.emailPreviewUrl = emailPreviewUrl;
      responseData.note = "Using Ethereal Email for testing. Open the preview URL to view the email.";
    }

    res.status(201).json(responseData);
  } catch (error) {
    console.error("Register Error:", error);
    
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      if (error.keyValue?.email) {
        return res.status(409).json({ message: "Email already in use" });
      }
      
      return res.status(409).json({ 
        message: "Duplicate key error. User with this information already exists."
      });
    }
    
    res.status(500).json({ message: error.message });
  }
};

// 🔑 Login User with Email Verification Check
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: "Email not verified. Please verify your email.",
        userId: user._id // Include userId for resending verification
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Set token in header
    res.setHeader("Authorization", `Bearer ${token}`);

    res.status(200).json({ 
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 🔒 Forgot Password - Send Reset Email
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, still return success even if email doesn't exist
      return res.status(200).json({ message: "Password reset email sent" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token valid for 1 hour

    // Save reset token to user
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Create reset link - use frontend URL for reset
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;
    
    // Send reset email
    let emailPreviewUrl = null;
    try {
      const emailResult = await sendPasswordResetEmail(user, resetLink);
      console.log('Password reset email sent successfully');
      
      // Check if we have a preview URL (from Ethereal)
      if (emailResult && emailResult.previewUrl) {
        emailPreviewUrl = emailResult.previewUrl;
      }
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Continue with reset process even if email fails
    }

    // Response object
    const responseData = {
      message: "Password reset email sent",
      resetLink, // Remove this in production
    };
    
    // Add preview URL if available (for development/testing)
    if (emailPreviewUrl) {
      responseData.emailPreviewUrl = emailPreviewUrl;
      responseData.note = "Using Ethereal Email for testing. Open the preview URL to view the email.";
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Forgot Password Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 🔄 Reset Password
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Find user with valid reset token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset Password Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Verify Email
export const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    // Find user with valid verification token
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    // Mark user as verified and clear verification token
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify Email Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 🔄 Resend Verification Email
export const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Token valid for 24 hours

    // Update user with new verification token
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = tokenExpiry;
    await user.save();

    // Create verification link - use frontend URL for verification
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/verify-email/${verificationToken}`;
    
    // Send verification email
    try {
      await sendVerificationEmail(user, verificationLink);
      console.log('Verification email resent successfully');
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      return res.status(500).json({ message: "Failed to send verification email" });
    }

    res.status(200).json({ 
      message: "Verification email resent",
      verificationLink // Remove this in production
    });
  } catch (error) {
    console.error("Resend Verification Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 🚪 Logout User
export const logoutUser = async (req, res) => {
  try {
    // For JWT, we don't need to do anything on the server
    // The client should remove the token from storage
    res.status(200).json({ message: "User logged out successfully." });
  } catch (error) {
    console.error("Logout Error:", error.message);
    res.status(500).json({ message: "Failed to log out. Please try again." });
  }
};

// 🔍 Get Current User
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error("Get Current User Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 🔑 Google Sign In
export const googleLogin = async (req, res) => {
  try {
    const { idToken, name, email, photoURL } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user if not exists
      user = new User({
        name,
        email,
        isVerified: true, // Google accounts are already verified
        profilePicture: photoURL || '',
        createdAt: new Date()
      });
      
      await user.save();
    } else {
      // Update existing user's profile picture if provided
      if (photoURL && !user.profilePicture) {
        user.profilePicture = photoURL;
        await user.save();
      }
    }
    
    // Generate JWT token
    const token = generateToken(user._id);
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    res.status(200).json({
      message: "Google login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error("Google Login Error:", error.message);
    
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: "Duplicate key error. User with this information already exists."
      });
    }
    
    res.status(500).json({ message: error.message });
  }
};
