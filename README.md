# Gmail Bulk Email Sender

A web application for sending bulk emails through Gmail with OAuth 2.0 integration and PDF-based recipient extraction.

## Features

- **Gmail OAuth 2.0 Integration**: Secure authentication with Gmail API
- **PDF Contact Extraction**: Upload PDF files and extract email contacts automatically
- **Bulk Email Sending**: Send personalized emails to multiple recipients
- **Email Open Tracking**: Track when recipients open your emails with pixel tracking
- **Sent Emails Dashboard**: View all sent emails with open status and timestamps
- **Editable Contact Data**: Review and edit extracted contact information
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS

## Tech Stack

- **Backend**: Node.js, Express, Gmail API, PDF parsing
- **Frontend**: React, Vite, Tailwind CSS
- **Authentication**: Google OAuth 2.0
- **File Processing**: PDF parsing with email extraction

## 🔒 Security Notes

**IMPORTANT**: This repository includes a `.gitignore` file that protects sensitive information:

- `credentials.json` - Contains Google OAuth client secrets
- `server/.env` - Contains environment variables and API keys
- `server/emails.db` - Contains email tracking data
- Sample contact files with real data

**Before pushing to GitHub**:
1. Ensure `.gitignore` is in place
2. Use template files (`*.template`) for setup instructions
3. Never commit real credentials or personal data
4. Review all files before committing

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
   - Save the Client ID and Client Secret

### 2. Environment Configuration

⚠️ **SECURITY WARNING**: Never commit sensitive credentials to version control!

1. Copy the template files and add your credentials:
   ```bash
   # Copy credentials template
   cp credentials.json.template credentials.json
   
   # Copy environment template
   cp server/.env.template server/.env
   ```

2. Update `credentials.json` with your Google OAuth credentials from step 1:
   ```json
   {
     "web": {
       "client_id": "your_actual_google_client_id",
       "client_secret": "your_actual_google_client_secret",
       "project_id": "your_project_id",
       "auth_uri": "https://accounts.google.com/o/oauth2/auth",
       "token_uri": "https://oauth2.googleapis.com/token",
       "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
       "redirect_uris": ["http://localhost:3000/auth/google/callback"]
     }
   }
   ```

3. Update `server/.env` with your configuration:
   ```env
   GOOGLE_CLIENT_ID=your_actual_google_client_id
   GOOGLE_CLIENT_SECRET=your_actual_google_client_secret
   PORT=3000
   NODE_ENV=development
   BASE_URL=http://localhost:3000
   ```

### 3. Email Tracking Setup

**Important**: Email tracking uses pixel tracking which requires a publicly accessible URL. The default `localhost:3000` will only work for local testing.

**For Production:**
- Deploy your application to a cloud service (Heroku, Vercel, etc.)
- Update `BASE_URL` in `.env` to your production URL

**For Testing with External Email Clients:**
1. Install ngrok: `npm install -g ngrok`
2. Start your server: `npm run dev`
3. In another terminal: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Update `BASE_URL` in `.env` to the ngrok URL
6. Restart your server

### 4. Installation

1. Install root dependencies:
   ```bash
   npm install
   ```

2. Install all dependencies (server + client):
   ```bash
   npm run install-all
   ```

### 5. Running the Application

1. Start both server and client:
   ```bash
   npm run dev
   ```

   Or run them separately:
   
   **Server** (Terminal 1):
   ```bash
   cd server
   npm run dev
   ```
   
   **Client** (Terminal 2):
   ```bash
   cd client
   npm run dev
   ```

2. Open your browser and navigate to:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3000`

## Usage

### 1. Connect Gmail
- Click the "Connect Gmail" button
- Sign in to your Google account
- Grant permissions for Gmail access

### 2. Upload PDF
- Select a PDF file containing contact information
- Click "Extract Contacts" to parse the PDF
- Review and edit the extracted data in the table

### 3. Send Emails
- Fill in the email subject and message
- Use `{companyName}` and `{hrName}` for personalization
- Click "Send Emails" to send to all recipients

## API Endpoints

### Backend Routes

- `GET /connect-gmail` - Redirects to Google OAuth login
- `GET /auth/google/callback` - Handles OAuth callback and stores tokens
- `POST /send-email` - Sends email via Gmail API
- `POST /extract-pdf` - Extracts contact data from uploaded PDF
- `GET /auth-status` - Check authentication status

### Request/Response Examples

**Send Email:**
```json
POST /send-email
{
  "to": "recipient@example.com",
  "subject": "Job Application",
  "message": "Hello, I am interested in opportunities at your company."
}
```

**Extract PDF:**
```json
POST /extract-pdf
// Form data with PDF file

Response:
{
  "data": [
    {
      "email": "hr@company.com",
      "companyName": "Tech Corp Inc",
      "hrName": "John Smith"
    }
  ]
}
```

## Security Features

- OAuth 2.0 authentication with Google
- Secure token storage
- CORS protection
- No sensitive data in frontend
- Session-based authentication

## Development

### Project Structure
```
email-tracker/
├── server/
│   ├── index.js          # Main server file
│   ├── package.json      # Server dependencies
│   └── .env             # Environment variables
├── client/
│   ├── src/
│   │   ├── App.jsx      # Main React component
│   │   ├── main.jsx     # React entry point
│   │   └── index.css    # Tailwind CSS
│   ├── index.html       # HTML template
│   ├── package.json     # Client dependencies
│   └── vite.config.js   # Vite configuration
└── package.json         # Root package.json
```

### Adding Features

1. **Enhanced PDF Parsing**: Improve the contact extraction algorithm in `server/index.js`
2. **Email Templates**: Add predefined email templates
3. **Contact Management**: Add database storage for contacts
4. **Email Scheduling**: Add delayed sending capabilities
5. **Analytics**: Track email open rates and responses

## Troubleshooting

### Common Issues

1. **OAuth Error**: Ensure redirect URI matches exactly in Google Cloud Console
2. **PDF Parsing Issues**: Check PDF format and text extraction quality
3. **Email Sending Fails**: Verify Gmail API permissions and token validity
4. **CORS Errors**: Ensure server is running on port 3000 and client on 5173

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions, please create an issue in the repository or contact the development team.