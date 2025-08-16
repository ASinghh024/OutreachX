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
  const [cvFile, setCvFile] = useState(null);
  const [cvError, setCvError] = useState('');
  
  // Placeholder autocomplete state for message
  const [showPlaceholderDropdown, setShowPlaceholderDropdown] = useState(false);
  const [placeholderFilter, setPlaceholderFilter] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedPlaceholderIndex, setSelectedPlaceholderIndex] = useState(0);
  const [textareaRef, setTextareaRef] = useState(null);
  const [availablePlaceholders, setAvailablePlaceholders] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  // Placeholder autocomplete state for subject
  const [showSubjectPlaceholderDropdown, setShowSubjectPlaceholderDropdown] = useState(false);
  const [subjectPlaceholderFilter, setSubjectPlaceholderFilter] = useState('');
  const [subjectCursorPosition, setSubjectCursorPosition] = useState(0);
  const [selectedSubjectPlaceholderIndex, setSelectedSubjectPlaceholderIndex] = useState(0);
  const [subjectInputRef, setSubjectInputRef] = useState(null);
  const [subjectDropdownPosition, setSubjectDropdownPosition] = useState({ top: 0, left: 0 });

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

  // Update available placeholders when extracted data changes
  useEffect(() => {
    if (extractedData.length > 0) {
      const firstContact = extractedData[0];
      const placeholders = Object.keys(firstContact)
        .filter(key => key !== 'isValidEmail' && key !== 'emailStatus')
        .map(key => `{${key}}`);
      setAvailablePlaceholders(placeholders);
    } else {
      // Default placeholders when no data is extracted
      setAvailablePlaceholders(['{companyName}', '{hrName}', '{email}']);
    }
  }, [extractedData]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPlaceholderDropdown && textareaRef && !textareaRef.contains(event.target)) {
        const dropdown = document.querySelector('.placeholder-dropdown');
        if (dropdown && !dropdown.contains(event.target)) {
          setShowPlaceholderDropdown(false);
          setPlaceholderFilter('');
        }
      }
      if (showSubjectPlaceholderDropdown && subjectInputRef && !subjectInputRef.contains(event.target)) {
        const dropdown = document.querySelector('.subject-placeholder-dropdown');
        if (dropdown && !dropdown.contains(event.target)) {
          setShowSubjectPlaceholderDropdown(false);
          setSubjectPlaceholderFilter('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlaceholderDropdown, showSubjectPlaceholderDropdown, textareaRef, subjectInputRef]);

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
            greeting = `${companyName} Recruitment Team`;
          } else {
            greeting = 'Recruitment Team';
          }
        } else {
          greeting = hrName;
        }
        
        const personalizedMessage = emailMessage
          .replace(/\{companyName\}/g, contact.companyName || 'your company')
          .replace(/\{hrName\}/g, greeting);
        
        const personalizedSubject = emailSubject
          .replace(/\{companyName\}/g, contact.companyName || 'your company')
          .replace(/\{hrName\}/g, greeting);

        if (cvFile) {
          // Send with CV attachment using FormData
          const formData = new FormData();
          formData.append('to', contact.email);
          formData.append('subject', personalizedSubject);
          formData.append('message', personalizedMessage);
          formData.append('companyName', contact.companyName || '');
          formData.append('hrName', contact.hrName || '');
          formData.append('cvFile', cvFile);
          
          await axios.post(`${API_BASE}/send-email`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        } else {
          // Send without attachment using JSON
          await axios.post(`${API_BASE}/send-email`, {
            to: contact.email,
            subject: personalizedSubject,
            message: personalizedMessage,
            companyName: contact.companyName,
            hrName: contact.hrName
          });
        }

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

  const deleteSentEmail = async (emailId) => {
    if (!window.confirm('Are you sure you want to delete this email record?')) {
      return;
    }

    // Cast to number and add debugging
    const numericId = Number(emailId);
    console.log('Frontend: Deleting email with ID:', emailId, 'converted to:', numericId);

    try {
      const response = await axios.delete(`${API_BASE}/emails/${numericId}`);
      if (response.data.success) {
        addMessage('Email deleted successfully', 'success');
        // Refresh the sent emails list and summary
        await fetchSentEmails();
        await fetchEmailSummary();
      }
    } catch (error) {
      console.error('Error deleting email:', error);
      if (error.response?.status === 404) {
        addMessage('Email not found', 'error');
      } else {
        addMessage('Failed to delete email', 'error');
      }
    }
  };

  const deleteAllEmails = async () => {
    if (!window.confirm('Are you sure you want to delete ALL email history? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE}/emails`);
      if (response.data.success) {
        addMessage(`All emails deleted successfully (${response.data.changes} records)`, 'success');
        // Refresh the sent emails list and summary
        await fetchSentEmails();
        await fetchEmailSummary();
      }
    } catch (error) {
      console.error('Error deleting all emails:', error);
      addMessage('Failed to delete all emails', 'error');
    }
  };

  const handleCvFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setCvError('Please select only .pdf, .doc, or .docx files.');
      setCvFile(null);
      event.target.value = '';
      return;
    }

    setCvError('');
    setCvFile(file);
  };

  const removeCvFile = () => {
    setCvFile(null);
    setCvError('');
    // Reset the file input
    const fileInput = document.getElementById('cv-file-input');
    if (fileInput) fileInput.value = '';
  };

  // Placeholder autocomplete handlers
  const handleTextareaChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setEmailMessage(value);
    setCursorPosition(cursorPos);
    
    // Check if user typed '{' and show dropdown
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
    const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
    
    if (lastOpenBrace > lastCloseBrace && lastOpenBrace !== -1) {
      const filterText = textBeforeCursor.substring(lastOpenBrace + 1);
      setPlaceholderFilter(filterText);
      setShowPlaceholderDropdown(true);
      setSelectedPlaceholderIndex(0);
    } else {
      setShowPlaceholderDropdown(false);
      setPlaceholderFilter('');
    }
  };

  const handleTextareaKeyDown = (e) => {
    if (!showPlaceholderDropdown) return;
    
    const filteredPlaceholders = getFilteredPlaceholders();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedPlaceholderIndex(prev => 
        prev < filteredPlaceholders.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedPlaceholderIndex(prev => 
        prev > 0 ? prev - 1 : filteredPlaceholders.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertPlaceholder(filteredPlaceholders[selectedPlaceholderIndex]);
    } else if (e.key === 'Escape') {
      setShowPlaceholderDropdown(false);
    }
  };

  const getFilteredPlaceholders = () => {
    return availablePlaceholders.filter(placeholder => 
      placeholder.toLowerCase().includes(placeholderFilter.toLowerCase())
    );
  };

  const insertPlaceholder = (placeholder) => {
    const textBeforeCursor = emailMessage.substring(0, cursorPosition);
    const textAfterCursor = emailMessage.substring(cursorPosition);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
    
    const newText = 
      textBeforeCursor.substring(0, lastOpenBrace) + 
      placeholder + 
      textAfterCursor;
    
    setEmailMessage(newText);
    setShowPlaceholderDropdown(false);
    setPlaceholderFilter('');
    
    // Set cursor position after the inserted placeholder
    setTimeout(() => {
      if (textareaRef) {
        const newCursorPos = lastOpenBrace + placeholder.length;
        textareaRef.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.focus();
      }
    }, 0);
  };

  const getTextMetrics = (text, element) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const computedStyle = window.getComputedStyle(element);
    context.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    
    const lines = text.split('\n');
    const lineHeight = parseInt(computedStyle.lineHeight) || parseInt(computedStyle.fontSize) * 1.2;
    
    // Calculate position based on the last line and character position
    const lastLine = lines[lines.length - 1] || '';
    const lastLineWidth = context.measureText(lastLine).width;
    
    return {
      width: lastLineWidth,
      height: lines.length * lineHeight
    };
  };

  // Better positioning function for textarea
  const getCaretPosition = (textarea, caretPos) => {
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);
    
    // Copy textarea styles to div
    ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'padding', 'border', 'boxSizing'].forEach(prop => {
      div.style[prop] = style[prop];
    });
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = textarea.clientWidth + 'px';
    div.style.height = 'auto';
    
    document.body.appendChild(div);
    
    const textBeforeCaret = textarea.value.substring(0, caretPos);
    div.textContent = textBeforeCaret;
    
    const span = document.createElement('span');
    span.textContent = '|';
    div.appendChild(span);
    
    const rect = span.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();
    
    document.body.removeChild(div);
    
    return {
      top: rect.top - textareaRect.top,
      left: rect.left - textareaRect.left
    };
  };

  // Subject field placeholder autocomplete handlers
  const handleSubjectChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setEmailSubject(value);
    setSubjectCursorPosition(cursorPos);
    
    // Check if user typed '{' and show dropdown
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
    const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
    
    if (lastOpenBrace > lastCloseBrace && lastOpenBrace !== -1) {
      const filterText = textBeforeCursor.substring(lastOpenBrace + 1);
      setSubjectPlaceholderFilter(filterText);
      setShowSubjectPlaceholderDropdown(true);
      setSelectedSubjectPlaceholderIndex(0);
      
      // Calculate dropdown position
      if (subjectInputRef) {
        const rect = subjectInputRef.getBoundingClientRect();
        const caretPos = getCaretPosition(subjectInputRef, cursorPos);
        setSubjectDropdownPosition({
          top: rect.bottom + 5,
          left: rect.left + caretPos.left
        });
      }
    } else {
      setShowSubjectPlaceholderDropdown(false);
      setSubjectPlaceholderFilter('');
    }
  };

  const handleSubjectKeyDown = (e) => {
    if (!showSubjectPlaceholderDropdown) return;
    
    const filteredPlaceholders = getFilteredSubjectPlaceholders();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSubjectPlaceholderIndex(prev => 
        prev < filteredPlaceholders.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSubjectPlaceholderIndex(prev => 
        prev > 0 ? prev - 1 : filteredPlaceholders.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertSubjectPlaceholder(filteredPlaceholders[selectedSubjectPlaceholderIndex]);
    } else if (e.key === 'Escape') {
      setShowSubjectPlaceholderDropdown(false);
    }
  };

  const getFilteredSubjectPlaceholders = () => {
    return availablePlaceholders.filter(placeholder => 
      placeholder.toLowerCase().includes(subjectPlaceholderFilter.toLowerCase())
    );
  };

  const insertSubjectPlaceholder = (placeholder) => {
    const textBeforeCursor = emailSubject.substring(0, subjectCursorPosition);
    const textAfterCursor = emailSubject.substring(subjectCursorPosition);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
    
    const newText = 
      textBeforeCursor.substring(0, lastOpenBrace) + 
      placeholder + 
      textAfterCursor;
    
    setEmailSubject(newText);
    setShowSubjectPlaceholderDropdown(false);
    setSubjectPlaceholderFilter('');
    
    // Set cursor position after the inserted placeholder
    setTimeout(() => {
      if (subjectInputRef) {
        const newCursorPos = lastOpenBrace + placeholder.length;
        subjectInputRef.setSelectionRange(newCursorPos, newCursorPos);
        subjectInputRef.focus();
      }
    }, 0);
  };

  const getSubjectTextMetrics = (text, element) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const computedStyle = window.getComputedStyle(element);
    context.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    
    return {
      width: context.measureText(text).width,
      height: parseInt(computedStyle.fontSize) || 16
    };
  };

  const renderUploadTab = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 className="text-2xl font-medium tracking-tight">Upload File</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select PDF, Excel, or CSV file
            </label>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={extractContacts}
            disabled={!file || isExtracting}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExtracting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Extracting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Extract Contacts
              </>
            )}
          </button>
        </div>
      </div>

      {extractedData.length > 0 && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium tracking-tight">Extracted Contacts ({extractedData.length})</h3>
            </div>
            <button
              onClick={addNewContact}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Contact
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
    <div className="max-w-2xl mx-auto">
      <div className="card p-6">
        <h2 className="text-2xl font-medium mb-6 tracking-tight">Compose Email</h2>
        <div className="space-y-6">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Subject
            </label>
            <input
              type="text"
              ref={(ref) => setSubjectInputRef(ref)}
              value={emailSubject}
              onChange={handleSubjectChange}
              onKeyDown={handleSubjectKeyDown}
              className="input-field"
              placeholder="Enter email subject. Type '{' to see available placeholders."
            />
            
            {/* Subject Placeholder Dropdown */}
            {showSubjectPlaceholderDropdown && (
              <div 
                className="subject-placeholder-dropdown absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-48"
                style={{
                  top: `${subjectDropdownPosition.top}px`,
                  left: `${subjectDropdownPosition.left}px`,
                  position: 'fixed'
                }}
              >
                {getFilteredSubjectPlaceholders().map((placeholder, index) => (
                  <div
                    key={placeholder}
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      index === selectedSubjectPlaceholderIndex
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => insertSubjectPlaceholder(placeholder)}
                  >
                    <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                      {placeholder}
                    </code>
                  </div>
                ))}
                {getFilteredSubjectPlaceholders().length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No matching placeholders
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Message
            </label>
            <textarea
              ref={(ref) => setTextareaRef(ref)}
              value={emailMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              rows={10}
              className="input-field resize-none"
              placeholder="Enter your message. Type '{' to see available placeholders."
            />
            
            {/* Placeholder Dropdown */}
            {showPlaceholderDropdown && (
              <div 
                className="placeholder-dropdown absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-48"
                style={{
                  top: '100%',
                  left: '0',
                  marginTop: '4px'
                }}
              >
                {getFilteredPlaceholders().map((placeholder, index) => (
                  <div
                    key={placeholder}
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      index === selectedPlaceholderIndex
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => insertPlaceholder(placeholder)}
                  >
                    <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                      {placeholder}
                    </code>
                  </div>
                ))}
                {getFilteredPlaceholders().length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No matching placeholders
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="bg-blue-50 p-4 rounded-xl">
            <p className="text-sm font-medium text-blue-900 mb-2">Available placeholders:</p>
            <ul className="text-sm text-blue-700 space-y-1">
              {availablePlaceholders.map((placeholder) => (
                <li key={placeholder} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">{placeholder}</code>
                  <span className="text-xs text-blue-600">- Type opening brace to autocomplete</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* CV Attachment Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-4 mb-3">
              <label className="block text-sm font-medium text-gray-700">
                CV Attachment (Optional)
              </label>
              <input
                id="cv-file-input"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleCvFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => document.getElementById('cv-file-input').click()}
                className="btn-secondary text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attach CV
              </button>
            </div>
            
            {/* Display selected file */}
            {cvFile && (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-900">{cvFile.name}</p>
                    <p className="text-xs text-green-600">CV attached successfully</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeCvFile}
                  className="text-green-600 hover:text-green-800 p-1 rounded-lg hover:bg-green-100 transition-colors"
                  title="Remove CV"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* Error message */}
            {cvError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-red-700">{cvError}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-4">
            <button
              onClick={sendEmails}
              disabled={!isAuthenticated || isSending || extractedData.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending Emails...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Emails to {extractedData.filter(c => c.isValidEmail).length} Valid Recipients
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSentTab = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-medium tracking-tight">Sent Emails ({sentEmails.length})</h2>
          {sentEmails.length > 0 && (
            <button
              onClick={deleteAllEmails}
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete All History
            </button>
          )}
        </div>
        
        {sentEmails.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No emails sent yet</h3>
            <p className="text-gray-500">Your sent emails will appear here once you start sending.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sentEmails.map((email, index) => (
              <div key={email.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{email.recipient_email}</h3>
                      <span className={`status-badge ${
                        email.opened ? 'status-opened' : 'status-pending'
                      }`}>
                        {email.opened ? 'Opened' : 'Delivered'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1 truncate">{email.subject}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{email.company_name}</span>
                      <span>•</span>
                      <span>Sent {new Date(email.sent_at).toLocaleDateString()}</span>
                      {email.opened_at && (
                        <>
                          <span>•</span>
                          <span>Opened {new Date(email.opened_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSentEmail(Number(email.id))}
                    className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Email"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderFailedTab = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-medium tracking-tight">Failed Emails ({failedEmails.length})</h2>
          </div>
          {failedEmails.length > 0 && (
            <button
              onClick={exportFailedEmails}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
        
        {failedEmails.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No failed emails</h3>
            <p className="text-gray-500">All your emails were sent successfully.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {failedEmails.map((email, index) => (
              <div key={index} className="bg-red-50 rounded-xl p-4 border-l-4 border-red-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{email.recipient_email}</h3>
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        Failed
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1 truncate">{email.subject}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span>{email.company_name}</span>
                      <span>•</span>
                      <span>Failed {new Date(email.failed_at).toLocaleDateString()}</span>
                    </div>
                    <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700 font-medium mb-1">Error:</p>
                      <p className="text-sm text-red-600">{email.error_message}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSummaryTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-green-600 tracking-tight">Sent Successfully</h3>
          </div>
          <p className="text-3xl font-semibold text-gray-900">{emailSummary.sent}</p>
          <p className="text-sm text-gray-500 mt-1">Emails delivered</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-600 tracking-tight">Failed</h3>
          </div>
          <p className="text-3xl font-semibold text-gray-900">{emailSummary.failed}</p>
          <p className="text-sm text-gray-500 mt-1">Delivery failed</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-blue-600 tracking-tight">Total</h3>
          </div>
          <p className="text-3xl font-semibold text-gray-900">{emailSummary.total}</p>
          <p className="text-sm text-gray-500 mt-1">Total attempts</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-medium text-gray-900 tracking-tight">OutreachX</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`status-badge ${
                isAuthenticated ? 'status-delivered' : 'bg-red-100 text-red-800'
              }`}>
                {isAuthenticated ? 'Gmail Connected' : 'Not Connected'}
              </span>
              {!isAuthenticated && (
                <button
                  onClick={connectGmail}
                  className="btn-primary"
                >
                  Connect Gmail
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'upload', label: 'Upload & Extract', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
              { id: 'compose', label: 'Compose & Send', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
              { id: 'sent', label: 'Sent Emails', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
              { id: 'failed', label: 'Failed Emails', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'summary', label: 'Summary', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
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