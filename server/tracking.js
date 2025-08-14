const { v4: uuidv4 } = require('uuid');
const { markEmailAsOpened } = require('./db');

// Generate a unique tracking ID
function generateTrackingId() {
  return uuidv4();
}

// Add tracking pixel to email HTML content
function addTrackingPixel(htmlContent, trackingId) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const trackingPixel = `<img src="${baseUrl}/track/open?tid=${trackingId}" width="1" height="1" style="display:none;" />`;
  
  // If the content already has HTML structure, add before closing body tag
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${trackingPixel}</body>`);
  }
  
  // If it's plain text or simple HTML, add at the end
  return htmlContent + trackingPixel;
}

// Convert plain text to HTML with tracking pixel
function convertToHtmlWithTracking(textContent, trackingId) {
  // Convert line breaks to HTML breaks
  const htmlContent = textContent.replace(/\n/g, '<br>');
  
  // Create full HTML structure
  const fullHtml = `
    <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body>
        ${htmlContent}
        <img src="http://localhost:3000/track/open?tid=${trackingId}" width="1" height="1" style="display:none;" />
      </body>
    </html>
  `;
  
  return fullHtml;
}

// Handle tracking pixel request
async function handleTrackingPixelRequest(req, res) {
  try {
    const { tid } = req.query;
    console.log('Tracking pixel request received for ID:', tid);
    
    if (!tid) {
      console.log('Missing tracking ID in request');
      return res.status(400).send('Missing tracking ID');
    }
    
    // Mark email as opened in database
    console.log('Attempting to mark email as opened for tracking ID:', tid);
    const result = await markEmailAsOpened(tid);
    console.log('Database update result:', result);
    
    // Return 1x1 transparent GIF
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
    
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': transparentGif.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.send(transparentGif);
  } catch (error) {
    console.error('Error handling tracking pixel request:', error);
    
    // Still return the transparent GIF even if database update fails
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': transparentGif.length
    });
    res.send(transparentGif);
  }
}

module.exports = {
  generateTrackingId,
  addTrackingPixel,
  convertToHtmlWithTracking,
  handleTrackingPixelRequest
};