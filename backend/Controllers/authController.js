
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import transporter from '../utils/nodeMailerConfig.js';  
import { createLog } from "./logsController.js";
import jwt from 'jsonwebtoken';
import { userWelcome } from "../utils/emailTemplates.js";
import { getEmailEnabled } from "../utils/systemSettings.js";
import { OAuth2Client } from "google-auth-library";

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 24 * 60 * 60; // 15 days
const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

const isStayLoggedInEnabled = (value) => {
   if (typeof value === "boolean") return value;
   if (typeof value === "number") return value === 1;
   if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "1" || normalized === "true" || normalized === "yes";
   }
   return false;
};

const buildAuthCookieOptions = (stayLoggedIn) => {
   const options = {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
   };
   if (stayLoggedIn) {
      options.maxAge = ACCESS_TOKEN_TTL_MS;
   }
   return options;
};

const getSessionVersion = (user) => {
   const raw = Number(user?.session_version ?? 0);
   return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
};

const safeCreateLog = async (logData) => {
   try {
      await createLog(logData);
   } catch (err) {
      console.error("LOGGING_ERROR:", err?.message || err);
   }
};

const isSuperAdminRole = (role) => {
   const key = String(role || "").trim().toLowerCase();
   return key === "super admin" || key === "superadmin" || key === "admin";
};

const escapeRegex = (value) =>
   String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

export const register = async (req, res) => {
   try {
      const username = String(req.body.username || "").trim();
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const position = String(req.body.position || "").trim();
      const designation = String(req.body.designation || "").trim();
      const project = String(req.body.project || "").trim();

      if (!username || !email || !password) {
         return res.status(400).json({
            success: false,
            message: "Username, email, and password are required.",
         });
      }

      if (!PASSWORD_POLICY.test(password)) {
         return res.status(400).json({
            success: false,
            message:
               "Password must be at least 8 characters and include an uppercase letter, a number, and a special character.",
         });
      }

      const existingUser = await User.findOne({
         email: new RegExp(`^${escapeRegex(email)}$`, "i"),
      })
         .select("email username")
         .lean();

      if (existingUser) {
         return res.status(409).json({
            success: false,
            message: "Email already exists.",
         });
      }

      // Hashing the password
      const hash = await bcrypt.hash(password, 10);

      const requestedRole = String(req.body.role || "").trim();
      const role = isSuperAdminRole(req?.user?.role) && requestedRole ? requestedRole : null;
   
      // Creating a new user
      const newUser = new User({
         username,
         email,
         password: hash,
         position,
         designation,
         project,
         ...(role ? { role } : {}),
      });
   
      // Save the new user to the database
      await newUser.save();
   
      // Create a log for successful registration
      await safeCreateLog({
         userId: newUser.email,
         action: 'User Registration',
         status: 'success',
         time: new Date().toISOString(),
      });
   
      // Sending the welcome email after registration
      const rawPortalUrl = process.env.PORTAL_URL || "https://inventory.dictr2.cloud";
      const portalBaseUrl = /^https?:\/\//i.test(rawPortalUrl)
         ? rawPortalUrl
         : `https://${rawPortalUrl}`;
      const loginUrl = new URL("/login", portalBaseUrl).toString();
      const logoUrl =
         process.env.EMAIL_LOGO_URL || new URL("/logo192.png", portalBaseUrl).toString();
      const emailEnabled = await getEmailEnabled();
      let emailSent = false;
      if (emailEnabled) {
         const mailOptions = {
            from: process.env.EMAIL_USER,  // Sender email address from .env
            to: newUser.email,  // Recipient email address (user's email)
            subject: 'Your DICT Inventory account is ready',  // Subject of the email
            html: userWelcome({
               logoUrl,
               recipientName: newUser.username,
               recipientEmail: newUser.email,
               initialPassword: password,
               portalUrl: loginUrl,
            }),
         };
      
         // Send the email
         try {
            await transporter.sendMail(mailOptions);
            emailSent = true;
         } catch (err) {
            console.error("REGISTER_EMAIL_ERROR:", err?.message || err);
         }
      }
   
      // Respond to the client with success message
      return res.status(201).json({
         success: true,
         message: "Successfully created!",
         emailSent,
      });
   } catch (error) {
      // In case of an error, log it
      console.error('REGISTER_ERROR:', error?.message || error);
   
      // Create a log for failed registration
      await safeCreateLog({
         userId: 'NA',  // No user ID in case of failure
         action: 'User Registration',
         status: 'error',
         time: new Date().toISOString(),
      });

      if (error?.code === 11000 && error?.keyPattern?.email) {
         return res.status(409).json({
            success: false,
            message: "Email already exists.",
         });
      }
      // Respond to the client with error message
      return res.status(500).json({ success: false, message: "Failed to create! Try again." });
   }
};   


// user login
export const login = async (req, res) => {
   try {
      const email = req.body.email;
      const stayLoggedIn = isStayLoggedInEnabled(req.body?.stayLoggedIn);
      const user = await User.findOne({ email });

      // If user doesn't exist
      if (!user) {
         // Create a log for unsuccessful login
         await createLog({
            userId: 'NA',
            action: 'User Login',
            status: 'error',
            time: new Date().toISOString(),
         });

         return res.status(404).json({ success: false, message: 'User not found!' });
      }

      if (user.active === false) {
         await createLog({
            userId: 'NA',
            action: 'User Login',
            status: 'error',
            time: new Date().toISOString(),
         });
         return res.status(403).json({ success: false, message: "Account is inactive. Please contact the administrator." });
      }

      // If the user exists, then check the password or compare the password
      const checkCorrectPassword = await bcrypt.compare(req.body.password, user.password);

      // If password is incorrect
      if (!checkCorrectPassword) {
         // Create a log for unsuccessful login
         await createLog({
            userId: 'NA',
            action: 'User Login',
            status: 'error',
            time: new Date().toISOString(),
         });

         return res.status(401).json({ success: false, message: "Incorrect email or password!" });
      }

      const { password, ...rest } = user._doc;

      // Create jwt token
      const sessionVersion = getSessionVersion(user);
      const token = jwt.sign(
         { id: user._id, role: user.role, sessionVersion },
         process.env.JWT_SECRET_KEY,
         { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
      );

      // Set token in the browser cookies and send the response to the client
      res
         .cookie("accessToken", token, buildAuthCookieOptions(stayLoggedIn))
         .status(200)
         .json({ token, data: { ...rest } });
    

      // Create a log for successful login
      await createLog({
         userId: 'NA',
         action: 'User Login',
         status: 'success',
         time: new Date().toISOString(),
      });
   } catch (error) {
      // Create a log for unsuccessful login
      await createLog({
         userId: 'NA',
         action: 'User Login',
         status: 'error',
         time: new Date().toISOString(),
      });

      res.status(500).json({ success: false, message: "Failed to login" });
   }
}

// admin login
export const loginadmin = async (req, res) => {
   try {
      const email = req.body.email;
      const stayLoggedIn = isStayLoggedInEnabled(req.body?.stayLoggedIn);
      const user = await User.findOne({ email });

      // If user doesn't exist
      if (!user) {
         // Create a log for unsuccessful login
         await createLog({
            userId: 'NA',
            action: 'User Login',
            status: 'error',
            time: new Date().toISOString(),
         });

         return res.status(404).json({ success: false, message: 'User not found!' });
      }

      if (user.active === false) {
         await createLog({
            userId: 'NA',
            action: 'User Login',
            status: 'error',
            time: new Date().toISOString(),
         });
         return res.status(403).json({ success: false, message: "Account is inactive. Please contact the administrator." });
      }

      // If the user exists, then check the password or compare the password
      const checkCorrectPassword = await bcrypt.compare(req.body.password, user.password);

      // If password is incorrect
      if (!checkCorrectPassword) {
         // Create a log for unsuccessful login
         await createLog({
            userId: 'NA',
            action: 'User Login',
            status: 'error',
            time: new Date().toISOString(),
         });

         return res.status(401).json({ success: false, message: "Incorrect email or password!" });
      }

      // Check user role
      if (user.role !== 'admin') {
         // Create a log for unsuccessful login
         await createLog({
            userId: 'NA',
            action: 'User Login',
            status: 'error',
            time: new Date().toISOString(),
         });

         return res.status(403).json({ success: false, message: "Access forbidden. Only admin can log in." });
      }

      const { password, role, ...rest } = user._doc;

      // Create jwt token
      const sessionVersion = getSessionVersion(user);
      const token = jwt.sign(
         { id: user._id, role: user.role, sessionVersion },
         process.env.JWT_SECRET_KEY,
         { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
      );

      // Set token in the browser cookies and send the response to the client
      res
         .cookie("accessToken", token, buildAuthCookieOptions(stayLoggedIn))
         .status(200)
         .json({ token, data: { ...rest }, role });

      // Create a log for successful login
      await createLog({
         userId: 'NA',
         action: 'User Login',
         status: 'success',
         time: new Date().toISOString(),
      });
   } catch (error) {
      // Create a log for unsuccessful login
      await createLog({
         userId: 'NA',
         action: 'User Login',
         status: 'error',
         time: new Date().toISOString(),
      });

      res.status(500).json({ success: false, message: "Failed to login" });
   }
}

// Google login (only allow existing users)
export const googleLogin = async (req, res) => {
   const credential = req.body?.credential;
   const stayLoggedIn = isStayLoggedInEnabled(req.body?.stayLoggedIn);

   if (!credential) {
      return res.status(400).json({ success: false, message: "Missing Google credential." });
   }

   if (!googleClientId || !googleClient) {
      return res.status(500).json({ success: false, message: "Google login is not configured." });
   }

   try {
      const ticket = await googleClient.verifyIdToken({
         idToken: credential,
         audience: googleClientId,
      });

      const payload = ticket?.getPayload?.() || {};
      const email = payload?.email;
      const emailVerified = payload?.email_verified;

      if (!email) {
         return res.status(400).json({ success: false, message: "Unable to read Google profile email." });
      }
      if (emailVerified === false) {
         return res.status(403).json({ success: false, message: "Google email is not verified." });
      }

      const user = await User.findOne({ email });
      if (!user) {
         await createLog({
            userId: email,
            action: "User Login (Google)",
            status: "error",
            time: new Date().toISOString(),
         });
         return res.status(404).json({ success: false, message: "User not found." });
      }

      if (user.active === false) {
         await createLog({
            userId: email,
            action: "User Login (Google)",
            status: "error",
            time: new Date().toISOString(),
         });
         return res.status(403).json({ success: false, message: "Account is inactive. Please contact the administrator." });
      }

      const { password, ...rest } = user._doc;
      const sessionVersion = getSessionVersion(user);
      const token = jwt.sign(
         { id: user._id, role: user.role, sessionVersion },
         process.env.JWT_SECRET_KEY,
         { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
      );

      res
         .cookie("accessToken", token, buildAuthCookieOptions(stayLoggedIn))
         .status(200)
         .json({ token, data: { ...rest } });

      await createLog({
         userId: email,
         action: "User Login (Google)",
         status: "success",
         time: new Date().toISOString(),
      });
   } catch (error) {
      await createLog({
         userId: "NA",
         action: "User Login (Google)",
         status: "error",
         time: new Date().toISOString(),
      });

      res.status(401).json({ success: false, message: "Google authentication failed." });
   }
};
