import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import JSZip from 'npm:jszip@3.10.1';

const ICON_URL = 'https://media.base44.com/images/public/6a46a8e315996af6f0443792/b706bd2fd_generated_image.png';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // === Authentication: validate user token server-side ===
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // === Premium verification: checked server-side ===
    const plan = user.subscription_plan || 'starter';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required' }, { status: 403 });
    }

    // Parse file contents from request body
    const body = await req.json();
    const files = body.files;

    if (!files || typeof files !== 'object') {
      return Response.json({ error: 'No files provided' }, { status: 400 });
    }

    const zip = new JSZip();

    // Add each extension file to the ZIP
    const allowedFiles = ['manifest.json', 'background.js', 'content.js', 'protection.js', 'popup.html', 'popup.js', 'styles.css', 'README.txt'];
    for (const filename of allowedFiles) {
      if (files[filename] && typeof files[filename] === 'string') {
        zip.file(filename, files[filename]);
      }
    }

    // Fetch and add icons (all sizes use the same source image — Chrome scales them)
    try {
      const iconResponse = await fetch(ICON_URL);
      if (iconResponse.ok) {
        const iconBuffer = await iconResponse.arrayBuffer();
        const iconFolder = zip.folder('icons');
        iconFolder.file('icon16.png', iconBuffer);
        iconFolder.file('icon32.png', iconBuffer);
        iconFolder.file('icon48.png', iconBuffer);
        iconFolder.file('icon128.png', iconBuffer);
      }
    } catch (_iconErr) {
      // Continue without icons — Chrome uses a default puzzle icon
    }

    // Generate ZIP as arraybuffer
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    // Convert to base64 (chunked to avoid call stack overflow)
    const bytes = new Uint8Array(zipBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    return Response.json({ zip: base64, filename: 'vardin-extension.zip' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});