const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'emails.db');

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Create tables if they don't exist
function initializeDatabase() {
  const createSentEmailsTable = `
    CREATE TABLE IF NOT EXISTS sent_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      company_name TEXT,
      hr_name TEXT,
      tracking_id TEXT UNIQUE NOT NULL,
      opened BOOLEAN DEFAULT 0,
      opened_at DATETIME,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  const createFailedEmailsTable = `
    CREATE TABLE IF NOT EXISTS failed_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      company_name TEXT,
      hr_name TEXT,
      error_message TEXT NOT NULL,
      error_type TEXT,
      failed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.run(createSentEmailsTable, (err) => {
    if (err) {
      console.error('Error creating sent_emails table:', err.message);
    } else {
      console.log('Sent emails table initialized successfully.');
    }
  });
  
  db.run(createFailedEmailsTable, (err) => {
    if (err) {
      console.error('Error creating failed_emails table:', err.message);
    } else {
      console.log('Failed emails table initialized successfully.');
    }
  });

  const createTemplatesTable = `
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createTemplatesTable, (err) => {
    if (err) {
      console.error('Error creating templates table:', err.message);
    } else {
      console.log('Templates table initialized successfully.');
    }
  });
}

// Insert a new sent email record
function insertSentEmail(emailData) {
  return new Promise((resolve, reject) => {
    const { recipientEmail, subject, message, companyName, hrName, trackingId } = emailData;
    
    const query = `
      INSERT INTO sent_emails (recipient_email, subject, message, company_name, hr_name, tracking_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [recipientEmail, subject, message, companyName, hrName, trackingId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, trackingId });
      }
    });
  });
}

// Mark email as opened
function markEmailAsOpened(trackingId) {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE sent_emails 
      SET opened = 1, opened_at = CURRENT_TIMESTAMP 
      WHERE tracking_id = ? AND opened = 0
    `;
    
    console.log('Executing database query for tracking ID:', trackingId);
    db.run(query, [trackingId], function(err) {
      if (err) {
        console.error('Database error when marking email as opened:', err);
        reject(err);
      } else {
        console.log('Database update completed. Rows changed:', this.changes);
        resolve({ changes: this.changes });
      }
    });
  });
}

// Get all sent emails with open status
function getAllSentEmails() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        id,
        recipient_email,
        subject,
        company_name,
        hr_name,
        opened,
        opened_at,
        sent_at
      FROM sent_emails 
      ORDER BY sent_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Close database connection
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
}

// Insert a failed email record
function insertFailedEmail(emailData) {
  return new Promise((resolve, reject) => {
    const { recipientEmail, subject, message, companyName, hrName, errorMessage, errorType } = emailData;
    
    const query = `
      INSERT INTO failed_emails (recipient_email, subject, message, company_name, hr_name, error_message, error_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    console.log('Logging failed email for:', recipientEmail, 'Error:', errorMessage);
    db.run(query, [recipientEmail, subject, message, companyName || '', hrName || '', errorMessage, errorType || 'UNKNOWN'], function(err) {
      if (err) {
        console.error('Database error when logging failed email:', err);
        reject(err);
      } else {
        console.log('Failed email logged successfully. ID:', this.lastID);
        resolve({ id: this.lastID });
      }
    });
  });
}

// Get all failed emails
function getAllFailedEmails() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        recipient_email,
        subject,
        message,
        company_name,
        hr_name,
        error_message,
        error_type,
        failed_at
      FROM failed_emails 
      ORDER BY failed_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Database error when fetching failed emails:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get email sending summary
function getEmailSummary() {
  return new Promise((resolve, reject) => {
    const sentQuery = 'SELECT COUNT(*) as sent_count FROM sent_emails';
    const failedQuery = 'SELECT COUNT(*) as failed_count FROM failed_emails';
    
    db.get(sentQuery, [], (err, sentResult) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.get(failedQuery, [], (err, failedResult) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({
          sent: sentResult.sent_count,
          failed: failedResult.failed_count,
          total: sentResult.sent_count + failedResult.failed_count
        });
      });
    });
  });
}

// Delete a sent email by ID
function deleteSentEmail(emailId) {
  return new Promise((resolve, reject) => {
    const query = 'DELETE FROM sent_emails WHERE id = ?';
    
    db.run(query, [emailId], function(err) {
      if (err) {
        console.error('Error deleting sent email:', err);
        reject(err);
      } else {
        console.log(`Sent email deleted successfully. Rows affected: ${this.changes}`);
        resolve({ changes: this.changes });
      }
    });
  });
}

// Delete all sent emails
function deleteAllSentEmails() {
  return new Promise((resolve, reject) => {
    const query = 'DELETE FROM sent_emails';
    
    db.run(query, [], function(err) {
      if (err) {
        console.error('Error deleting all sent emails:', err);
        reject(err);
      } else {
        console.log(`All sent emails deleted successfully. Rows affected: ${this.changes}`);
        resolve({ changes: this.changes });
      }
    });
  });
}

// Template CRUD operations
function insertTemplate(templateData) {
  return new Promise((resolve, reject) => {
    const { name, body, tags } = templateData;
    
    const query = `
      INSERT INTO templates (name, body, tags)
      VALUES (?, ?, ?)
    `;
    
    db.run(query, [name, body, tags], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID });
      }
    });
  });
}

function getAllTemplates() {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM templates ORDER BY updated_at DESC';
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function updateTemplate(id, templateData) {
  return new Promise((resolve, reject) => {
    const { name, body, tags } = templateData;
    
    const query = `
      UPDATE templates 
      SET name = ?, body = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [name, body, tags, id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

function deleteTemplate(id) {
  return new Promise((resolve, reject) => {
    const query = 'DELETE FROM templates WHERE id = ?';
    
    db.run(query, [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes });
      }
    });
  });
}

function getTemplateById(id) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM templates WHERE id = ?';
    
    db.get(query, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

module.exports = {
  insertSentEmail,
  markEmailAsOpened,
  getAllSentEmails,
  insertFailedEmail,
  getAllFailedEmails,
  getEmailSummary,
  deleteSentEmail,
  deleteAllSentEmails,
  insertTemplate,
  getAllTemplates,
  updateTemplate,
  deleteTemplate,
  getTemplateById,
  closeDatabase
};