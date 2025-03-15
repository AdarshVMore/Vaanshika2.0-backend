// routes/authRoutes.js
import express from 'express';
import { 
  registerUser, 
  loginUser, 
  logoutUser, 
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getCurrentUser,
  googleLogin
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google-login', googleLogin);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Protected routes
router.get('/me', protect, getCurrentUser);

export default router;