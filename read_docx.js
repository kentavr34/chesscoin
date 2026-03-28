const fs = require('fs');
try {
  const xml = fs.readFileSync('.\\docx_unzipped\\word\\document.xml', 'utf8');
  
  // Extract all <w:t> tags
  let output = '';
  // Split into paragraphs to roughly retain structure
  const paragraphs = xml.split('</w:p>');
  for (const p of paragraphs) {
    const ts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
    if (ts) {
       output += ts.map(t => t.replace(/<[^>]+>/g, '')).join('') + '\n';
    }
  }
  
  fs.writeFileSync('output.txt', output, 'utf8');
  console.log("Extracted to output.txt");
} catch (e) {
  console.error(e);
}
