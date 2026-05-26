/**
 * RecursiveCharacterTextSplitter - port dari LangChain Python.
 * Persis sama behavior-nya dengan yang dipakai di Python backend.
 */

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/**
 * Split text recursively using a list of separators.
 * Mirrors langchain_text_splitters.RecursiveCharacterTextSplitter
 */
export function splitTextRecursive(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200,
  separators: string[] = DEFAULT_SEPARATORS
): string[] {
  const finalChunks: string[] = [];

  // Find appropriate separator
  let separator = separators[separators.length - 1]; // default: ""
  let newSeparators: string[] = [];

  for (let i = 0; i < separators.length; i++) {
    const sep = separators[i];
    if (sep === "") {
      separator = sep;
      break;
    }
    if (text.includes(sep)) {
      separator = sep;
      newSeparators = separators.slice(i + 1);
      break;
    }
  }

  // Split by the chosen separator
  const splits = separator ? text.split(separator) : [...text];

  // Merge splits into chunks respecting chunkSize
  let goodSplits: string[] = [];
  const separatorLen = separator.length;

  for (const s of splits) {
    if (s.length < chunkSize) {
      goodSplits.push(s);
    } else {
      // Current accumulated good splits should be merged first
      if (goodSplits.length > 0) {
        const merged = mergeSplits(goodSplits, separator, chunkSize, chunkOverlap);
        finalChunks.push(...merged);
        goodSplits = [];
      }

      // This split is too large, recursively split it
      if (newSeparators.length === 0) {
        // No more separators, just add as-is (or force split)
        finalChunks.push(s);
      } else {
        const subChunks = splitTextRecursive(s, chunkSize, chunkOverlap, newSeparators);
        finalChunks.push(...subChunks);
      }
    }
  }

  // Merge remaining good splits
  if (goodSplits.length > 0) {
    const merged = mergeSplits(goodSplits, separator, chunkSize, chunkOverlap);
    finalChunks.push(...merged);
  }

  return finalChunks;
}

/**
 * Merge small text splits into chunks with overlap.
 * This is the core of LangChain's _merge_splits method.
 */
function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const docs: string[] = [];
  const currentDoc: string[] = [];
  let total = 0;

  for (const s of splits) {
    const len = s.length;
    const separatorLen = separator.length;

    // Check if adding this split would exceed chunk size
    const additionalLen = currentDoc.length > 0 ? len + separatorLen : len;

    if (total + additionalLen > chunkSize && currentDoc.length > 0) {
      // Current chunk is full, save it
      const doc = joinStrings(currentDoc, separator);
      if (doc.trim()) {
        docs.push(doc);
      }

      // Keep overlap: remove from front until we're within overlap size
      while (total > chunkOverlap || (total + additionalLen > chunkSize && total > 0)) {
        if (currentDoc.length === 0) break;
        const removed = currentDoc.shift()!;
        total -= removed.length + (currentDoc.length > 0 ? separatorLen : 0);
      }
    }

    currentDoc.push(s);
    total += additionalLen;
  }

  // Add remaining
  const doc = joinStrings(currentDoc, separator);
  if (doc.trim()) {
    docs.push(doc);
  }

  return docs;
}

function joinStrings(strings: string[], separator: string): string {
  return strings.join(separator);
}
