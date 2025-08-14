import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [messages, setMessages] = useState([]);
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentEmails, setSentEmails] = useState([]);
  const [failedEmails, setFailedEmails] = useState([]);
  const [emailSummary, setEmailSummary] = useState({ sent: 0, failed: 0, total: 0 });

  useEffect(() => {
    checkAuthStatus();
    if (activeTab === 'sent') {
      fetchSentEmails();
    } else if (activeTab === 'failed') {
      fetchFailedEmails();
    } else if (activeTab === 'summary') {
      fetchEmailSummary();
    }
  }, [activeTab]);

  const addMessage = (text, type) => {
    const message = { id: Date.now(), text, type };
    setMessages(prev => [...prev, message]);
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== message.id));
    }, 5000);
  };

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/auth-status`);
      setIsAuthenticated(response.data.authenticated);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const connectGmail = () => {
    window.location.href = `${API_BASE}/connect-gmail`;
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const extractContacts = async () => {
    if (!file) {
      addMessage('Please select a file first', 'error');
      return;
    }

    setIsExtracting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE}/extract-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Validate emails and add status
      const dataWithValidation = response.data.data.map(contact => ({
        ...contact,
        emailStatus: validateEmail(contact.email) ? 'Valid' : 'Invalid Email',
        isValidEmail: validateEmail(contact.email)
      }));
      
      setExtractedData(dataWithValidation);
      const validCount = dataWithValidation.filter(c => c.isValidEmail).length;
      const invalidCount = dataWithValidation.length - validCount;
      addMessage(`Extracted ${dataWithValidation.length} contacts (${validCount} valid, ${invalidCount} invalid)`, 'success');
    } catch (error) {
      console.error('Error extracting contacts:', error);
      addMessage('Failed to extract contacts from file', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const validateEmail = (email) => {
    // Check if email is empty
    if (!email || typeof email !== 'string') return false;
    
    // Must contain exactly one @
    const atCount = (email.match(/@/g) || []).length;
    if (atCount !== 1) return false;
    
    // No spaces allowed
    if (email.includes(' ')) return false;
    
    // No consecutive dots
    if (email.includes('..')) return false;
    
    // Split by @ to check local and domain parts
    const [localPart, domainPart] = email.split('@');
    
    // Local part must not be empty
    if (!localPart) return false;
    
    // Domain part must not be empty
    if (!domainPart) return false;
    
    // Domain must have at least one . after @
    if (!domainPart.includes('.')) return false;
    
    // Domain must not start or end with -
    if (domainPart.startsWith('-') || domainPart.endsWith('-')) return false;
    
    // Final regex validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const updateContact = (index, field, value) => {
    const updated = [...extractedData];
    updated[index][field] = value;
    
    // If updating email field, validate and set status
    if (field === 'email') {
      updated[index].emailStatus = validateEmail(value) ? 'Valid' : 'Invalid Email';
      updated[index].isValidEmail = validateEmail(value);
    }
    
    setExtractedData(updated);
  };

  const removeContact = (index) => {
    const updated = extractedData.filter((_, i) => i !== index);
    setExtractedData(updated);
  };

  const addNewContact = () => {
    const newContact = {
      email: '',
      companyName: '',
      hrName: '',
      emailStatus: 'Invalid Email',
      isValidEmail: false
    };
    setExtractedData([...extractedData, newContact]);
  };

  const sendEmails = async () => {
    if (!isAuthenticated) {
      addMessage('Please connect Gmail first', 'error');
      return;
    }

    if (!emailSubject || !emailMessage) {
      addMessage('Please fill in subject and message', 'error');
      return;
    }

    if (extractedData.length === 0) {
      addMessage('No contacts to send emails to', 'error');
      return;
    }

    // Filter only valid email contacts
    const validContacts = extractedData.filter(contact => contact.isValidEmail);
    const invalidContacts = extractedData.filter(contact => !contact.isValidEmail);
    
    if (validContacts.length === 0) {
      addMessage('No valid email addresses found. Please fix invalid emails first.', 'error');
      return;
    }
    
    if (invalidContacts.length > 0) {
      addMessage(`Skipping ${invalidContacts.length} contacts with invalid emails`, 'info');
    }

    setIsSending(true);
    let successCount = 0;
    let failureCount = 0;

    for (const contact of validContacts) {
      try {
        // Handle missing HR Name with company-specific greeting
        let greeting;
        const hrName = contact.hrName && contact.hrName.trim() && contact.hrName !== 'n/a' ? contact.hrName.trim() : '';
        
        if (!hrName) {
          const companyName = contact.companyName && contact.companyName.trim() && contact.companyName !== 'n/a' ? contact.companyName.trim() : '';
          if (companyName) {
            greeting = `${companyName} Recruitment Team,`;
          } else {
            greeting = ' Recruitment Team,';
          }
        } else {
          greeting = hrName;
        }
        
        const personalizedMessage = emailMessage
          .replace(/\{companyName\}/g, contact.companyName || 'your company')
          .replace(/\{hrName\}/g, greeting);

        await axios.post(`${API_BASE}/send-email`, {
          to: contact.email,
          subject: emailSubject,
          message: personalizedMessage,
          companyName: contact.companyName,
          hrName: contact.hrName
        });

        successCount++;
        addMessage(`Email sent to ${contact.email}`, 'success');
      } catch (error) {
        failureCount++;
        addMessage(`Failed to send email to ${contact.email}`, 'error');
      }

      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsSending(false);
    addMessage(`Completed: ${successCount} sent, ${failureCount} failed`, 'info');
  };

  const fetchSentEmails = async () => {
    try {
      const response = await axios.get(`${API_BASE}/opens`);
      setSentEmails(response.data);
    } catch (error) {
      console.error('Error fetching sent emails:', error);
      addMessage('Failed to fetch sent emails', 'error');
    }
  };

  const fetchFailedEmails = async () => {
    try {
      const response = await axios.get(`${API_BASE}/failed-emails`);
      setFailedEmails(response.data);
    } catch (error) {
      console.error('Error fetching failed emails:', error);
      addMessage('Failed to fetch failed emails', 'error');
    }
  };

  const fetchEmailSummary = async () => {
    try {
      const response = await axios.get(`${API_BASE}/email-summary`);
      setEmailSummary(response.data);
    } catch (error) {
      console.error('Error fetching email summary:', error);
      addMessage('Failed to fetch email summary', 'error');
    }
  };

  const exportFailedEmails = () => {
    window.open(`${API_BASE}/export-failed-emails`, '_blank');
  };

  const renderUploadTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Upload File</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select PDF, Excel, or CSV file
            </label>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            onClick={extractContacts}
            disabled={!file || isExtracting}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isExtracting ? 'Extracting...' : 'Extract Contacts'}
          </button>
        </div>
      </div>

      {extractedData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Extracted Contacts ({extractedData.length})</h3>
            <button
              onClick={addNewContact}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <span>+</span> Add Contact
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                   <th className="px-4 py-2 text-left">Email</th>
                   <th className="px-4 py-2 text-left">Company</th>
                   <th className="px-4 py-2 text-left">HR Name</th>
                   <th className="px-4 py-2 text-left">Email Status</th>
                   <th className="px-4 py-2 text-left">Actions</th>
                 </tr>
              </thead>
              <tbody>
                {extractedData.map((contact, index) => (
                   <tr key={index} className={`border-t ${!contact.isValidEmail ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2">
                       <input
                         type="email"
                         value={contact.email}
                         onChange={(e) => updateContact(index, 'email', e.target.value)}
                         className={`w-full p-1 border rounded ${!contact.isValidEmail ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                       />
                     </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={contact.companyName || ''}
                        onChange={(e) => updateContact(index, 'companyName', e.target.value)}
                        className="w-full p-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={contact.hrName || ''}
                        onChange={(e) => updateContact(index, 'hrName', e.target.value)}
                        className="w-full p-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                       <span className={`px-2 py-1 rounded text-xs font-medium ${
                         contact.isValidEmail 
                           ? 'bg-green-100 text-green-800' 
                           : 'bg-red-100 text-red-800'
                       }`}>
                         {contact.emailStatus}
                       </span>
                     </td>
                     <td className="px-4 py-2">
                       <button
                         onClick={() => removeContact(index)}
                         className="text-red-600 hover:text-red-800"
                       >
                         Remove
                       </button>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderComposeTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Compose Email</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="Enter email subject"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              rows={10}
              className="w-full p-3 border border-gray-300 rounded-lg"
              placeholder="Enter your message. Use {companyName} and {hrName} for personalization."
            />
          </div>
          <div className="text-sm text-gray-600">
            <p>Available placeholders:</p>
            <ul className="list-disc list-inside">
              <li>{'{companyName}'} - Will be replaced with company name</li>
              <li>{'{hrName}'} - Will be replaced with HR person's name</li>
            </ul>
          </div>
          <button
            onClick={sendEmails}
            disabled={!isAuthenticated || isSending || extractedData.length === 0}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isSending ? 'Sending...' : `Send Emails to ${extractedData.filter(c => c.isValidEmail).length} Valid Recipients`}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSentTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Sent Emails ({sentEmails.length})</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">Recipient</th>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Sent At</th>
              <th className="px-4 py-2 text-left">Opened At</th>
            </tr>
          </thead>
          <tbody>
            {sentEmails.map((email, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-2">{email.recipient_email}</td>
                <td className="px-4 py-2">{email.subject}</td>
                <td className="px-4 py-2">{email.company_name}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    email.opened ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {email.opened ? 'Opened' : 'Sent'}
                  </span>
                </td>
                <td className="px-4 py-2">{new Date(email.sent_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  {email.opened_at ? new Date(email.opened_at).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFailedTab = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Failed Emails ({failedEmails.length})</h2>
        {failedEmails.length > 0 && (
          <button
            onClick={exportFailedEmails}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Export CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">Recipient</th>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Company</th>
              <th className="px-4 py-2 text-left">Error</th>
              <th className="px-4 py-2 text-left">Failed At</th>
            </tr>
          </thead>
          <tbody>
            {failedEmails.map((email, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-2">{email.recipient_email}</td>
                <td className="px-4 py-2">{email.subject}</td>
                <td className="px-4 py-2">{email.company_name}</td>
                <td className="px-4 py-2 text-red-600 text-sm">{email.error_message}</td>
                <td className="px-4 py-2">{new Date(email.failed_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSummaryTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-green-600">Sent Successfully</h3>
          <p className="text-3xl font-bold">{emailSummary.sent}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-red-600">Failed</h3>
          <p className="text-3xl font-bold">{emailSummary.failed}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-blue-600">Total</h3>
          <p className="text-3xl font-bold">{emailSummary.total}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Email Tracker Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm ${
                isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isAuthenticated ? 'Gmail Connected' : 'Not Connected'}
              </span>
              {!isAuthenticated && (
                <button
                  onClick={connectGmail}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Connect Gmail
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'upload', label: 'Upload & Extract' },
              { id: 'compose', label: 'Compose & Send' },
              { id: 'sent', label: 'Sent Emails' },
              { id: 'failed', label: 'Failed Emails' },
              { id: 'summary', label: 'Summary' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' && renderUploadTab()}
        {activeTab === 'compose' && renderComposeTab()}
        {activeTab === 'sent' && renderSentTab()}
        {activeTab === 'failed' && renderFailedTab()}
        {activeTab === 'summary' && renderSummaryTab()}
      </div>

      {/* Messages */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white max-w-sm ${
              message.type === 'success' ? 'bg-green-500' :
              message.type === 'error' ? 'bg-red-500' :
              message.type === 'info' ? 'bg-blue-500' : 'bg-gray-500'
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;