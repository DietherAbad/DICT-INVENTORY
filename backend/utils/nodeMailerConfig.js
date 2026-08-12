// nodemailerConfig.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  
    pass: process.env.EMAIL_PASS,  
  },
});

// Test sending an email
const mailOptions = {
  from: process.env.EMAIL_USER,
  to: 'diethera.abad@gmail.com',  // Replace with a valid email address
  subject: 'Test Email',
  text: 'This is a test email!',
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
     console.error('Error sending email:', error);
  } else {
     console.log('Email sent: ', info.response);
  }
});

export default transporter;
