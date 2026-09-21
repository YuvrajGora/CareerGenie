import zlib from 'zlib';

/**
 * Extracts readable text from a PDF Buffer by locating and decompressing stream objects.
 */
export function extractTextFromPdf(buffer: Buffer): string {
  const textChunks: string[] = [];
  const content = buffer.toString('latin1');

  // Match all PDF stream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = match[1];
    const streamStartPos = match.index;
    // Check preceding dictionary for /FlateDecode filter
    const headerSlice = content.slice(Math.max(0, streamStartPos - 400), streamStartPos);

    let decompressed: string | null = null;
    if (headerSlice.includes('/FlateDecode')) {
      try {
        const streamBuffer = Buffer.from(rawStream, 'latin1');
        decompressed = zlib.inflateSync(streamBuffer).toString('latin1');
      } catch {
        try {
          decompressed = zlib.inflateRawSync(Buffer.from(rawStream, 'latin1')).toString('latin1');
        } catch {
          // Stream could not be decompressed or uses another filter
        }
      }
    } else {
      decompressed = rawStream;
    }

    if (decompressed) {
      // 1. Text shown via (...) Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
        textChunks.push(tjMatch[1]);
      }

      // 2. Text shown via [(...) ... (...)] TJ
      const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
      let arrMatch: RegExpExecArray | null;
      while ((arrMatch = arrayTjRegex.exec(decompressed)) !== null) {
        const innerStrings = arrMatch[1].match(/\(([^)]*)\)/g);
        if (innerStrings) {
          textChunks.push(innerStrings.map((s) => s.slice(1, -1)).join(' '));
        }
      }
    }
  }

  // Clean unescaped chars and normalize whitespace
  return textChunks
    .join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts readable text from a DOCX Buffer by unzipping word/document.xml.
 */
export function extractTextFromDocx(buffer: Buffer): string {
  let pos = 0;
  while (pos < buffer.length - 30) {
    if (buffer.readUInt32LE(pos) === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(pos + 8);
      const compSize = buffer.readUInt32LE(pos + 18);
      const nameLen = buffer.readUInt16LE(pos + 26);
      const extraLen = buffer.readUInt16LE(pos + 28);
      const name = buffer.subarray(pos + 30, pos + 30 + nameLen).toString('utf8');
      const dataStart = pos + 30 + nameLen + extraLen;

      if (name === 'word/document.xml' && dataStart + compSize <= buffer.length) {
        const compData = buffer.subarray(dataStart, dataStart + compSize);
        let xmlStr = '';
        try {
          if (compMethod === 8) {
            xmlStr = zlib.inflateRawSync(compData).toString('utf8');
          } else if (compMethod === 0) {
            xmlStr = compData.toString('utf8');
          }
        } catch (e) {
          console.error('Failed to decompress word/document.xml:', e);
        }

        if (xmlStr) {
          const textParts: string[] = [];
          const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
          let m: RegExpExecArray | null;
          while ((m = wtRegex.exec(xmlStr)) !== null) {
            textParts.push(m[1]);
          }
          return textParts.join(' ').replace(/\s+/g, ' ').trim();
        }
      }
      pos = dataStart + compSize;
    } else {
      pos++;
    }
  }
  return '';
}

/**
 * Universal server-side document text extractor.
 * Supports PDF, DOCX, and plain-text formats without external binaries.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType?: string,
  fileName?: string
): Promise<string> {
  if (!buffer || buffer.length === 0) {
    return '';
  }

  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  // 1. Plain text / Markdown
  if (
    lowerMime.includes('text/plain') ||
    lowerMime.includes('text/markdown') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md')
  ) {
    return buffer.toString('utf8').trim();
  }

  // 2. PDF Document
  if (
    lowerMime.includes('application/pdf') ||
    lowerName.endsWith('.pdf') ||
    (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-')
  ) {
    const pdfText = extractTextFromPdf(buffer);
    if (pdfText.length > 0) {
      return pdfText;
    }
  }

  // 3. Word DOCX Document
  if (
    lowerMime.includes('wordprocessingml') ||
    lowerMime.includes('application/msword') ||
    lowerName.endsWith('.docx') ||
    (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50)
  ) {
    const docxText = extractTextFromDocx(buffer);
    if (docxText.length > 0) {
      return docxText;
    }
  }

  // 4. Fallback attempt: if buffer has high ASCII text content
  const asciiSample = buffer.subarray(0, Math.min(buffer.length, 10000)).toString('utf8');
  const printableChars = asciiSample.replace(/[^ -~\n\r\t]/g, '');
  if (asciiSample.length > 0 && printableChars.length / asciiSample.length > 0.85 && printableChars.trim().length > 50) {
    return printableChars.trim();
  }

  return '';
}
