// routes/email.js
import express from 'express';
import transporter from '../utils/nodeMailerConfig.js';
import dotenv from 'dotenv';
import { requireAnyAccess } from "../utils/rbac.js";
import { validateBody, schemas } from "../utils/validators.js";
import { createWriteLimiter, isAdminRole } from "../utils/rateLimit.js";
import { getEmailEnabled } from "../utils/systemSettings.js";

const writeLimiter = createWriteLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  skip: (req) => isAdminRole(req?.user?.role),
});

dotenv.config();  

const router = express.Router();

router.post(
  '/',
  requireAnyAccess([
    "details.checkform",
    "details.office_equipment",
    "details.office_furniture",
    "details.office_ict",
    "details.office_supplies",
  ]),
  writeLimiter,
  validateBody(schemas.emailSend),
  async (req, res) => {
  const { to, cc, subject, html } = req.body;

  // Validate input
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, or html' });
  }

  try {
    const emailEnabled = await getEmailEnabled();
    if (!emailEnabled) {
      return res.status(200).json({ message: "Email notifications are disabled.", skipped: true });
    }
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,  
      to,
      cc: cc && (Array.isArray(cc) ? cc : [cc]),
      subject,
      html,
    });

    console.log('Email sent: ', info);
    res.status(200).json({ message: 'Email sent successfully.' });
  } catch (error) {
    console.error('Error sending email: ', error);
    res.status(500).json({ error: 'Error sending email.' });
  }
});

export default router;
