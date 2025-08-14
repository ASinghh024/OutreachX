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

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Update the `.env` file with your Google OAuth credentials:
   ```env
   GOOGLE_CLIENT_ID=your_actual_google_client_id
   GOOGLE_CLIENT_SECRET=your_actual_google_client_secret
   PORT=3000
   NODE_ENV=development
   # For email tracking to work with external email clients, change this to your public URL
   # Example: BASE_URL=https://your-domain.com or use ngrok for testing
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