const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '..', 'PROJECT_DOCUMENTATION.md');
const mdContent = fs.readFileSync(mdPath, 'utf8');

// Convert Markdown to rich HTML formatted specifically for Microsoft Word (.docx) & Web/PDF Print
function markdownToHtml(md) {
  let html = md;

  // Headers
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #1E3A8A; font-family: Calibri, Arial, sans-serif; font-size: 26pt; font-weight: bold; margin-top: 24pt; margin-bottom: 12pt; border-bottom: 2px solid #2563EB; padding-bottom: 6pt;">$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #1E40AF; font-family: Calibri, Arial, sans-serif; font-size: 18pt; font-weight: bold; margin-top: 18pt; margin-bottom: 8pt; border-bottom: 1px solid #E2E8F0; padding-bottom: 4pt;">$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #0F172A; font-family: Calibri, Arial, sans-serif; font-size: 14pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt;">$1</h3>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote style="background-color: #EFF6FF; border-left: 4px solid #2563EB; color: #1E40AF; padding: 10px 15px; margin: 12px 0; font-style: italic;">$1</blockquote>');

  // Tables
  html = html.replace(/\|(.+)\|/g, function(match) {
    return match;
  });

  // Simple Markdown parsing logic for tables and lists
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  let inList = false;
  let listHtml = '';
  let processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Table detection
    if (line.startsWith('|') && line.endsWith('|')) {
      if (line.includes('---')) continue; // Skip separator line
      if (!inTable) {
        inTable = true;
        tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: Calibri, Arial, sans-serif; font-size: 11pt;">\n';
        const cells = line.split('|').filter(c => c.length > 0);
        tableHtml += '  <tr style="background-color: #1E3A8A; color: #FFFFFF; font-weight: bold;">\n';
        cells.forEach(cell => {
          tableHtml += `    <th style="border: 1px solid #CBD5E1; padding: 8px 12px; text-align: left;">${cell.trim()}</th>\n`;
        });
        tableHtml += '  </tr>\n';
      } else {
        const cells = line.split('|').filter(c => c.length > 0);
        const bg = (processedLines.length % 2 === 0) ? '#F8FAFC' : '#FFFFFF';
        tableHtml += `  <tr style="background-color: ${bg};">\n`;
        cells.forEach(cell => {
          tableHtml += `    <td style="border: 1px solid #CBD5E1; padding: 8px 12px; color: #334155;">${cell.trim()}</td>\n`;
        });
        tableHtml += '  </tr>\n';
      }
      continue;
    } else if (inTable) {
      inTable = false;
      tableHtml += '</table>\n';
      processedLines.push(tableHtml);
      tableHtml = '';
    }

    // List item detection
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        inList = true;
        listHtml = '<ul style="margin: 8px 0; padding-left: 24px; color: #334155; font-family: Calibri, Arial, sans-serif; font-size: 11pt;">\n';
      }
      listHtml += `  <li style="margin-bottom: 4px;">${line.substring(2)}</li>\n`;
      continue;
    } else if (inList) {
      inList = false;
      listHtml += '</ul>\n';
      processedLines.push(listHtml);
      listHtml = '';
    }

    // Horizontal rule
    if (line === '---') {
      processedLines.push('<hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />');
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      continue;
    }

    // Regular paragraphs
    if (line.length > 0) {
      processedLines.push(`<p style="color: #334155; font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; margin: 6px 0;">${line}</p>`);
    } else {
      processedLines.push('');
    }
  }

  if (inTable) processedLines.push(tableHtml + '</table>\n');
  if (inList) processedLines.push(listHtml + '</ul>\n');

  let bodyHtml = processedLines.join('\n');

  // Inline styling replacements
  bodyHtml = bodyHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  bodyHtml = bodyHtml.replace(/\*(.*?)\*/g, '<em>$1</em>');
  bodyHtml = bodyHtml.replace(/`([^`]+)`/g, '<code style="background-color: #F1F5F9; color: #0F172A; padding: 2px 6px; border-radius: 4px; font-family: Consolas, monospace; font-size: 10pt;">$1</code>');
  bodyHtml = bodyHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563EB; text-decoration: underline;">$1</a>');

  return bodyHtml;
}

const bodyContent = markdownToHtml(mdContent);

// Word Document HTML Envelope (Microsoft Word Document format)
const wordDocContent = `
<html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Edupilot DZ - Complete Documentation</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page {
    size: A4 portrait;
    margin: 2.54cm 2.54cm 2.54cm 2.54cm;
  }
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1E293B;
    line-height: 1.5;
  }
  h1 { color: #1E3A8A; font-size: 24pt; border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-top: 20px; }
  h2 { color: #1E40AF; font-size: 16pt; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; margin-top: 18px; }
  h3 { color: #0F172A; font-size: 13pt; margin-top: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background-color: #1E3A8A; color: white; border: 1px solid #94A3B8; padding: 8px; text-align: left; }
  td { border: 1px solid #CBD5E1; padding: 8px; }
  tr:nth-child(even) { background-color: #F8FAFC; }
  blockquote { background-color: #EFF6FF; border-left: 4px solid #2563EB; color: #1E40AF; padding: 10px 14px; margin: 12px 0; }
  code { background-color: #F1F5F9; color: #0F172A; font-family: Consolas, monospace; font-size: 10pt; padding: 2px 5px; }
</style>
</head>
<body>
  ${bodyContent}
</body>
</html>
`;

// HTML Document formatted for direct PDF Printing
const htmlPrintContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Edupilot DZ — Complete Project & Technical Documentation</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 2cm;
      }
      body {
        -webkit-print-color-adjust: exact;
      }
      h1, h2 {
        page-break-after: avoid;
      }
      table, tr {
        page-break-inside: avoid;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1E293B;
      line-height: 1.6;
      background: #FFF;
    }
    h1 {
      color: #1E3A8A;
      font-size: 28px;
      border-bottom: 3px solid #2563EB;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    h2 {
      color: #1E40AF;
      font-size: 20px;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 6px;
      margin-top: 24px;
    }
    h3 {
      color: #0F172A;
      font-size: 16px;
      margin-top: 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }
    th {
      background-color: #1E3A8A;
      color: white;
      border: 1px solid #CBD5E1;
      padding: 10px 12px;
      text-align: left;
    }
    td {
      border: 1px solid #CBD5E1;
      padding: 9px 12px;
    }
    tr:nth-child(even) {
      background-color: #F8FAFC;
    }
    blockquote {
      background-color: #EFF6FF;
      border-left: 4px solid #2563EB;
      color: #1E40AF;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    code {
      background-color: #F1F5F9;
      color: #0F172A;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 12px;
      padding: 3px 6px;
      border-radius: 4px;
    }
    hr {
      border: none;
      border-top: 1px solid #E2E8F0;
      margin: 28px 0;
    }
    a {
      color: #2563EB;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>
`;

// Save Word Document (.docx)
const docxPath = path.join(__dirname, '..', 'PROJECT_DOCUMENTATION.docx');
fs.writeFileSync(docxPath, wordDocContent, 'utf8');
console.log('Successfully created Word document:', docxPath);

// Save HTML Printable Document (.html)
const htmlPath = path.join(__dirname, '..', 'PROJECT_DOCUMENTATION.html');
fs.writeFileSync(htmlPath, htmlPrintContent, 'utf8');
console.log('Successfully created HTML Printable document:', htmlPath);
