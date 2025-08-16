const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const xlsx = require('xlsx');
const Papa = require('papaparse');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { insertSentEmail, getAllSentEmails, insertFailedEmail, getAllFailedEmails, getEmailSummary, deleteSentEmail, deleteAllSentEmails } = require('./db');
const { generateTrackingId, convertToHtmlWithTracking, handleTrackingPixelRequest } = require('./tracking');
require('dotenv').config();

// Load Google credentials
const credentialsPath = path.join(__dirname, '..', 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  credentials.web.client_id,
  credentials.web.client_secret,
  'http://localhost:3000/auth/google/callback'
);

// In-memory storage for tokens and user info (in production, use a proper database)
let storedTokens = null;
let userInfo = null;

// Function to get user profile information
async function getUserProfile() {
  if (!storedTokens) {
    throw new Error('No stored tokens available');
  }
  
  try {
    oauth2Client.setCredentials(storedTokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const response = await oauth2.userinfo.get();
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

// Routes

// GET /connect-gmail - Redirect to Google OAuth
app.get('/connect-gmail', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.redirect(authUrl);
});

// GET /auth/google/callback - Handle OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    storedTokens = tokens;
    
    // Fetch and store user profile information
    try {
      userInfo = await getUserProfile();
      console.log('User profile fetched:', userInfo.name, userInfo.email);
    } catch (profileError) {
      console.error('Failed to fetch user profile:', profileError);
      // Continue without profile info
    }
    
    // Store tokens in session
    req.session.tokens = tokens;
    
    res.redirect('http://localhost:5173?auth=success');
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.redirect('http://localhost:5173?auth=error');
  }
});

// Function to categorize email errors
function categorizeEmailError(error) {
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('invalid') && errorMessage.includes('email')) {
    return 'INVALID_EMAIL';
  } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
    return 'QUOTA_EXCEEDED';
  } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
    return 'AUTH_ERROR';
  } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return 'NETWORK_ERROR';
  } else if (errorMessage.includes('dns')) {
    return 'DNS_ERROR';
  } else if (errorMessage.includes('smtp')) {
    return 'SMTP_ERROR';
  } else if (errorMessage.includes('mailbox') && errorMessage.includes('full')) {
    return 'MAILBOX_FULL';
  } else if (errorMessage.includes('blocked') || errorMessage.includes('spam')) {
    return 'BLOCKED_SPAM';
  }
  return 'UNKNOWN_ERROR';
}

// POST /send-email - Send email using Gmail API
app.post('/send-email', upload.single('cvFile'), async (req, res) => {
  const { to, subject, message, companyName, hrName } = req.body;
  const cvFile = req.file; // Multer adds the uploaded file here

  if (!storedTokens) {
    return res.status(401).json({ error: 'Not authenticated with Gmail' });
  }

  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error(`Invalid email format: ${to}`);
    }

    oauth2Client.setCredentials(storedTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Generate tracking ID
    const trackingId = generateTrackingId();
    
    // Convert message to HTML with tracking pixel
    const htmlMessage = convertToHtmlWithTracking(message, trackingId);

    // Create email with HTML content and proper From header
    const fromHeader = userInfo && userInfo.name 
      ? `${userInfo.name} <${userInfo.email}>`
      : userInfo?.email || 'me';
    
    let emailContent;
    
    if (cvFile) {
      // Create multipart email with attachment
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      emailContent = [
        `To: ${to}`,
        `From: ${fromHeader}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        htmlMessage,
        '',
        `--${boundary}`,
        `Content-Type: ${cvFile.mimetype}; name="${cvFile.originalname}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${cvFile.originalname}"`,
        '',
        cvFile.buffer.toString('base64'),
        '',
        `--${boundary}--`
      ].join('\n');
    } else {
      // Create simple HTML email without attachment
      emailContent = [
        `To: ${to}`,
        `From: ${fromHeader}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlMessage
      ].join('\n');
    }

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    // Store email in database
    await insertSentEmail({
      recipientEmail: to,
      subject,
      message,
      companyName: companyName || '',
      hrName: hrName || '',
      trackingId
    });

    console.log(`Email sent successfully to ${to}${cvFile ? ' with CV attachment' : ''}`);
    res.json({ success: true, messageId: result.data.id, trackingId, hasAttachment: !!cvFile });
  } catch (error) {
    console.error('Error sending email to', to, ':', error.message);
    
    // Categorize the error
    const errorType = categorizeEmailError(error);
    
    // Log failed email to database
    try {
      await insertFailedEmail({
        recipientEmail: to,
        subject,
        message,
        companyName: companyName || '',
        hrName: hrName || '',
        errorMessage: error.message,
        errorType
      });
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send email', 
      details: error.message,
      errorType,
      recipient: to
    });
  }
});

// POST /extract-pdf - Extract data from files (PDF, Excel, CSV)
app.post('/extract-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  const supportedTypes = ['.pdf', '.xlsx', '.xls', '.csv'];
  
  if (!supportedTypes.includes(fileExtension)) {
    return res.status(400).json({ error: 'Unsupported file type. Please upload PDF, Excel (.xlsx, .xls), or CSV files.' });
  }

  try {
    let extractedData = [];
    
    if (fileExtension === '.pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      extractedData = extractContactInfo(pdfData.text);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      extractedData = extractFromExcel(req.file.buffer);
    } else if (fileExtension === '.csv') {
      extractedData = extractFromCSV(req.file.buffer.toString('utf8'));
    }
    
    // Deduplicate emails
    const uniqueContacts = deduplicateContacts(extractedData);
    
    res.json({ data: uniqueContacts });
  } catch (error) {
    console.error('Error parsing file:', error);
    res.status(500).json({ error: 'Failed to parse file', details: error.message });
  }
});

// Function to extract contact information from PDF text
function extractContactInfo(text) {
  const contacts = [];
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex) || [];
  
  emails.forEach(email => {
    // Try to find company name and contact person name near the email
    const emailIndex = text.indexOf(email);
    const contextBefore = text.substring(Math.max(0, emailIndex - 200), emailIndex);
    const contextAfter = text.substring(emailIndex, Math.min(text.length, emailIndex + 200));
    const fullContext = contextBefore + contextAfter;
    
    // Extract company name (look for patterns like "Company:", "Organization:", etc.)
    const companyPatterns = [
      /(?:company|organization|corp|corporation|inc|ltd|llc)[:\s]+([^\n\r,;.]+)/i,
      /([A-Z][a-zA-Z\s&]+(?:Inc|Corp|LLC|Ltd|Company|Corporation))/,
      /at\s+([A-Z][a-zA-Z\s&]+)/i
    ];
    
    let companyName = '';
    for (const pattern of companyPatterns) {
      const match = fullContext.match(pattern);
      if (match) {
        companyName = match[1].trim();
        break;
      }
    }
    
    // Extract contact person name (look for names near the email)
    const namePatterns = [
      /(?:contact|person|hr|human resources|recruiter|talent|hiring)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s+[A-Z]\.)?)\ s*[\(<]?[^@]*@/,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/
    ];
    
    let hrName = '';
    for (const pattern of namePatterns) {
      const match = fullContext.match(pattern);
      if (match) {
        hrName = match[1].trim();
        break;
      }
    }
    
    contacts.push({
      email: email,
      companyName: companyName || 'n/a',
      hrName: hrName || 'n/a'
    });
  });
  
  return contacts;
}

// Function to extract contact information from Excel files
function extractFromExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const contacts = [];
  
  // Process all sheets
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (data.length < 2) return; // Need at least header and one data row
    
    // Get headers from first row and trim spaces
    const headers = data[0].map(header => String(header || '').trim());
    
    // Find column indexes for our target fields
    const emailIndex = headers.findIndex(h => h.toLowerCase() === 'email');
    const companyIndex = headers.findIndex(h => h.toLowerCase().includes('company'));
    const nameIndex = headers.findIndex(h => 
      h.toLowerCase().includes('contact person') || 
      h.toLowerCase().includes('contact') ||
      h.toLowerCase().includes('hr name') ||
      h.toLowerCase().includes('hr')  
    );
    
    // Process data rows (skip header row)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const email = emailIndex >= 0 ? String(row[emailIndex] || '').trim() : '';
      const companyName = companyIndex >= 0 ? String(row[companyIndex] || '').trim() : '';
      const hrName = nameIndex >= 0 ? String(row[nameIndex] || '').trim() : '';
      
      // Only add if we have an email
      if (email && email.includes('@')) {
        contacts.push({
          email: email,
          companyName: companyName || 'n/a',
          hrName: hrName || 'n/a'
        });
      }
    }
  });
  
  return contacts;
}

// Function to extract contact information from CSV files
function extractFromCSV(csvText) {
  const contacts = [];
  
  try {
    // Split CSV into lines and handle different line endings
    const lines = csvText.split(/\r?\n/);
    
    if (lines.length < 2) return contacts; // Need at least header and one data row
    
    // Get headers from first row, split by comma and trim spaces
    const headerLine = lines[0].trim();
    const headers = headerLine.split(',').map(header => header.trim().replace(/^"|"$/g, ''));
    
    console.log('CSV Headers found:', headers);
    
    // Process all data rows (skip header row)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Split by comma and handle trailing commas
      let fields = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
      
      // Remove empty trailing fields caused by trailing commas
      while (fields.length > 0 && fields[fields.length - 1] === '') {
        fields.pop();
      }
      
      // Skip if no meaningful data
      if (fields.length === 0 || fields.every(field => !field)) {
        continue;
      }
      
      // Create object with header keys
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = fields[index] || '';
      });
      
      console.log(`Row ${i} data:`, rowData);
      
      // For OutreachX compatibility, map to expected format
      const email = rowData['Email'] || rowData['email'] || '';
      const companyName = rowData['Company'] || rowData['company'] || rowData['Company Name'] || '';
      const hrName = rowData['Contact Person'] || rowData['contact person'] || rowData['HR Name'] || rowData['Name'] || rowData['name'] || '';
      
      // Only add if we have an email
      if (email && email.includes('@')) {
        contacts.push({
          email: email,
          companyName: companyName || 'n/a',
          hrName: hrName || 'n/a',
          // Also include the raw data for debugging
          rawData: rowData
        });
      }
    }
    
    console.log(`CSV parsing completed. Extracted ${contacts.length} contacts from ${lines.length - 1} data rows.`);
    
  } catch (error) {
    console.error('Error parsing CSV:', error);
    
    // Fallback to Papa Parse if manual parsing fails
    console.log('Falling back to Papa Parse...');
    
    let parsed = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      delimiter: ','
    });
    
    // If comma parsing results in single column, try tab delimiter
    if (parsed.data.length > 0 && parsed.data[0].length === 1) {
      parsed = Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        delimiter: '\t'
      });
    }
    
    if (parsed.data.length < 2) return contacts;
    
    const headers = parsed.data[0].map(header => String(header || '').trim());
    
    for (let i = 1; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      
      if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
        continue;
      }
      
      const emailIndex = headers.findIndex(h => h.toLowerCase() === 'email');
      const companyIndex = headers.findIndex(h => h.toLowerCase().includes('company'));
      const nameIndex = headers.findIndex(h => h.toLowerCase().includes('contact person') || h.toLowerCase().includes('contact'));
      
      const email = emailIndex >= 0 ? String(row[emailIndex] || '').trim() : '';
      const companyName = companyIndex >= 0 ? String(row[companyIndex] || '').trim() : '';
      const hrName = nameIndex >= 0 ? String(row[nameIndex] || '').trim() : '';
      
      if (email && email.includes('@')) {
        contacts.push({
          email: email,
          companyName: companyName || 'n/a',
          hrName: hrName || 'n/a'
        });
      }
    }
  }
  
  return contacts;
}

// Function to deduplicate contacts based on email
function deduplicateContacts(contacts) {
  const seen = new Set();
  return contacts.filter(contact => {
    const emailLower = contact.email.toLowerCase();
    if (seen.has(emailLower)) {
      return false;
    }
    seen.add(emailLower);
    return true;
  });
}

// GET /auth-status - Check authentication status
app.get('/auth-status', (req, res) => {
  res.json({ authenticated: !!storedTokens });
});

// GET /track/open - Handle tracking pixel requests
app.get('/track/open', handleTrackingPixelRequest);

// GET /opens - Get all sent emails with open status
app.get('/opens', async (req, res) => {
  try {
    const sentEmails = await getAllSentEmails();
    res.json(sentEmails);
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

// GET /failed-emails - Get all failed emails
app.get('/failed-emails', async (req, res) => {
  try {
    const failedEmails = await getAllFailedEmails();
    res.json(failedEmails);
  } catch (error) {
    console.error('Error fetching failed emails:', error);
    res.status(500).json({ error: 'Failed to fetch failed emails' });
  }
});

// GET /email-summary - Get email sending summary
app.get('/email-summary', async (req, res) => {
  try {
    const summary = await getEmailSummary();
    const failedEmails = await getAllFailedEmails();
    res.json({
      ...summary,
      failedEmails
    });
  } catch (error) {
    console.error('Error fetching email summary:', error);
    res.status(500).json({ error: 'Failed to fetch email summary' });
  }
});

// GET /export-failed-emails - Export failed emails as CSV
app.get('/export-failed-emails', async (req, res) => {
  try {
    const failedEmails = await getAllFailedEmails();
    
    // Create CSV content
    const csvHeaders = 'Recipient Email,Subject,Company Name,HR Name,Error Message,Error Type,Failed At\n';
    const csvRows = failedEmails.map(email => {
      const escapeCsv = (field) => {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      return [
        escapeCsv(email.recipient_email),
        escapeCsv(email.subject),
        escapeCsv(email.company_name),
        escapeCsv(email.hr_name),
        escapeCsv(email.error_message),
        escapeCsv(email.error_type),
        escapeCsv(email.failed_at)
      ].join(',');
    }).join('\n');
    
    const csvContent = csvHeaders + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
     res.setHeader('Content-Disposition', 'attachment; filename="failed_emails_report.csv"');
     res.send(csvContent);
   } catch (error) {
     console.error('Error exporting failed emails:', error);
     res.status(500).json({ error: 'Failed to export failed emails' });
   }
 });

// DELETE /emails/:id - Delete a specific sent email
app.delete('/emails/:id', async (req, res) => {
  try {
    const emailId = parseInt(req.params.id, 10);
    console.log('Backend: Received delete request for email ID:', req.params.id, 'parsed as:', emailId);
    
    // Validate email ID
    if (isNaN(emailId) || emailId <= 0) {
      console.log('Backend: Invalid email ID detected');
      return res.status(400).json({ error: 'Invalid email ID' });
    }
    
    const result = await deleteSentEmail(emailId);
    console.log('Backend: Delete operation result:', result);
    
    if (result.changes === 0) {
      console.log('Backend: No rows affected - email not found');
      return res.status(404).json({ error: 'Email not found' });
    }
    
    console.log('Backend: Email deleted successfully');
    res.json({ 
      success: true, 
      message: 'Email deleted successfully',
      changes: result.changes 
    });
  } catch (error) {
    console.error('Error deleting sent email:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /emails - Delete all sent emails
app.delete('/emails', async (req, res) => {
  try {
    const result = await deleteAllSentEmails();
    
    res.json({ 
      success: true, 
      message: 'All emails deleted successfully',
      changes: result.changes 
    });
  } catch (error) {
    console.error('Error deleting all sent emails:', error);
    res.status(500).json({ error: 'Failed to delete all emails' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});