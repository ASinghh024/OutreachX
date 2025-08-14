# Gmail Bulk Email Sender - Complete Setup Guide

## 🚀 Quick Start

Your Gmail Bulk Email Sender application is now ready! Follow these steps to complete the setup:

### 1. Google OAuth 2.0 Setup (REQUIRED)

**Important**: You must configure Google OAuth before the application can send emails.

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `Gmail Bulk Sender`
4. Click "Create"

#### Step 2: Enable Gmail API
1. In your project, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on "Gmail API" and click "Enable"

#### Step 3: Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" (unless you have a Google Workspace account)
3. Fill in required fields:
   - App name: `Gmail Bulk Sender`
   - User support email: Your email
   - Developer contact: Your email
4. Click "Save and Continue"
5. Add scopes: Click "Add or Remove Scopes"
   - Search and add: `https://www.googleapis.com/auth/gmail.send`
   - Search and add: `https://www.googleapis.com/auth/userinfo.email`
6. Add test users (your Gmail address) in "Test users" section

#### Step 4: Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Name: `Gmail Bulk Sender Client`
5. Add Authorized redirect URIs:
   ```
   http://localhost:3000/auth/google/callback
   ```
6. Click "Create"
7. **Copy the Client ID and Client Secret**

#### Step 5: Update Environment Variables
1. Open `/server/.env` file
2. Replace the placeholder values:
   ```env
   GOOGLE_CLIENT_ID=your_actual_client_id_here
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
   PORT=3000
   NODE_ENV=development
   ```

### 2. Application URLs

- **Frontend**: http://localhost:5174/
- **Backend**: http://localhost:3000/

### 3. How to Use

#### Step 1: Connect Gmail
1. Open http://localhost:5174/
2. Click "Connect Gmail" button
3. Sign in with your Google account
4. Grant permissions for Gmail access
5. You'll be redirected back with a success message

#### Step 2: Upload PDF (Optional)
1. Prepare a PDF file with contact information
2. Click "Choose File" and select your PDF
3. Click "Extract Contacts"
4. Review and edit the extracted data in the table

#### Step 3: Send Emails
1. Fill in the email subject
2. Write your message (use `{companyName}` and `{hrName}` for personalization)
3. Click "Send Emails to X Recipients"
4. Monitor the success/failure messages

### 4. Testing Without PDF

You can test the email functionality without uploading a PDF:

1. Connect Gmail first
2. Manually add test data by creating a simple contact list
3. Or modify the frontend to allow manual contact entry

### 5. Sample Email Template

```
Subject: Application for Software Developer Position

Message:
Dear {hrName},

I hope this email finds you well. I am writing to express my interest in software development opportunities at {companyName}.

I am a passionate developer with experience in full-stack development, and I believe I would be a valuable addition to your team.

I have attached my resume for your review and would welcome the opportunity to discuss how my skills align with your current needs.

Thank you for your time and consideration.

Best regards,
[Your Name]
[Your Contact Information]
```

### 6. Troubleshooting

#### Common Issues:

**"Not authenticated with Gmail" error:**
- Make sure you've completed the Google OAuth setup
- Check that your Client ID and Secret are correct in `.env`
- Try disconnecting and reconnecting Gmail

**CORS errors:**
- Ensure both servers are running (backend on 3000, frontend on 5174)
- Check that CORS is configured for the correct ports

**PDF extraction not working:**
- Ensure the PDF contains readable text (not scanned images)
- Try with a simple PDF containing clear email addresses

**Email sending fails:**
- Verify Gmail API is enabled in Google Cloud Console
- Check that you've granted the correct permissions
- Ensure your Google account has 2-factor authentication enabled

### 7. Security Notes

- Never commit your `.env` file to version control
- Keep your Google OAuth credentials secure
- The application stores tokens in memory (for production, use a proper database)
- Only grant access to trusted users during testing phase

### 8. Production Deployment

For production deployment:

1. Set up a proper database for token storage
2. Use environment variables for all sensitive data
3. Configure HTTPS and update OAuth redirect URIs
4. Implement proper error handling and logging
5. Add rate limiting for API endpoints
6. Publish your OAuth app (remove test mode)

---

## 🎉 You're All Set!

Your Gmail Bulk Email Sender is now ready to use. Remember to:

1. ✅ Complete Google OAuth setup
2. ✅ Update `.env` with your credentials
3. ✅ Test with a small batch first
4. ✅ Always respect email sending limits and best practices

Happy emailing! 📧