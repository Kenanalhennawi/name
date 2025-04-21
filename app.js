// --- Helper Functions ---

// Given names: remove punctuation but keep spaces (for later splitting)
function sanitizeGivenName(name) {
    if (!name) return "";
    // Keep letters (including common accented ones), spaces. Remove others.
    return name.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ ]/g, "").replace(/\s+/g, " ").trim();
}

// Surnames: remove punctuation but keep spaces (like Given Name)
function sanitizeSurname(name) {
    if (!name) return "";
    // Keep letters (including common accented ones), spaces. Remove others.
    return name.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ ]/g, "").replace(/\s+/g, " ").trim();
}

// --- Field Extraction Functions ---

// Extract the given name by scanning for a line containing "given" & "nam" or "prénom".
// Handles colon separation, same-line extraction, or next-line fallback.
function extractGivenName(lines) {
    const keywordsGiven = ["given name", "given names"]; // Check longer first
    const keywordsPrenom = ["prénom", "prénoms"];
    const potentialKeywords = [...keywordsGiven, ...keywordsPrenom, "first name", "first names"]; // Added more variations

    // Keywords that, if they appear as the *first* word of the candidate, should be skipped
    const candidateLabelKeywords = ["prénom", "given", "first"];


    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();
        let keywordFound = false;
        let keywordEndIndex = -1;

        // Check if known keywords are present
        if (potentialKeywords.some(k => lowerLine.includes(k))) {
           keywordFound = true; // Mark that we found a keyword line
        }

        if (keywordFound) {
             // Add a basic check to avoid misidentifying "Father Name" or "Mother Name" if they were picked up by broad keywords
             if (lowerLine.includes("father") || lowerLine.includes("mother") || lowerLine.includes("père") || lowerLine.includes("mère")) {
                 console.log("Skipping line for given name extraction: contains father/mother keyword", line);
                 continue;
             }

            console.log("Potential given name line found:", line);

            let candidate = "";
            let processedOnSameLine = false;

            // 1. Check for Colon first
            const colonIndex = line.indexOf(":");
            if (colonIndex !== -1) {
                candidate = line.substring(colonIndex + 1).trim();
                processedOnSameLine = true;
                console.log("Given name candidate (from colon):", candidate);
            } else {
                // 2. No colon, try getting from the same line after keywords
                // Find the end position of the keyword (simple approach)
                let searchIndex = -1;
                const foundKeyword = potentialKeywords.find(k => lowerLine.includes(k));

                if(foundKeyword) {
                    searchIndex = lowerLine.lastIndexOf(foundKeyword);
                    keywordEndIndex = searchIndex + foundKeyword.length;
                }

                if (keywordEndIndex !== -1 && keywordEndIndex < line.length) {
                     // Take substring after the keyword
                     candidate = line.substring(keywordEndIndex).trim();
                     // Remove leading non-alpha characters that might remain after keyword
                     candidate = candidate.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]*/, '');
                     if (candidate.length > 0) { // Only consider it processed if something was found
                          processedOnSameLine = true;
                          console.log("Given name candidate (from same line, no colon):", candidate);
                     }
                }
            }

            // 3. If candidate from same line is empty/short or wasn't processed, try next line
            if (!processedOnSameLine || candidate.length < 2) {
                 console.log("Attempting next line fallback for given name...");
                 if (i < lines.length - 1) {
                      const nextLineCandidate = lines[i + 1].trim();
                       // Check if next line likely contains a name part (more than 1 char, at least 2 letters)
                       // Also add a check to prevent picking up Father/Mother name from the next line
                       if (nextLineCandidate.length > 1 && nextLineCandidate.match(/[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/) && !nextLineCandidate.toLowerCase().includes("father") && !nextLineCandidate.toLowerCase().includes("mother") && !nextLineCandidate.toLowerCase().includes("père") && !nextLineCandidate.toLowerCase().includes("mère")) {
                           // Only overwrite if same-line candidate was truly empty or noise
                           if (!processedOnSameLine || candidate.length < 2) {
                              candidate = nextLineCandidate;
                              console.log("Given name candidate (using next line):", candidate);
                           } else {
                              console.log("Keeping potentially short candidate from same line:", candidate);
                           }
                       } else {
                          console.log("Skipping next line as potential noise or other name field:", nextLineCandidate);
                           // If same line had *some* candidate, keep it even if short now, unless completely empty
                           if (!processedOnSameLine) candidate = "";
                       }
                 } else if (!processedOnSameLine) {
                      candidate = ""; // No next line available and nothing from same line
                      console.log("No next line available for given name fallback.");
                 }
            }


            // 4. Sanitize and extract the first word token from the best candidate found
            let sanitizedCandidate = sanitizeGivenName(candidate); // Keeps spaces
            let tokens = sanitizedCandidate.split(" ").filter(t => t.length > 0); // Split into words, remove empty strings

            let firstWordToken = "";
            if (tokens.length > 0) {
                 // Check if the first token is a known label keyword
                 if (candidateLabelKeywords.includes(tokens[0].toLowerCase())) {
                     // If it's a label, take the *next* token if it exists
                     if (tokens.length > 1) {
                         firstWordToken = tokens[1]; // Take the second word
                     } else {
                         // If only the label was found as a single token, it's not a name
                         firstWordToken = "";
                     }
                 } else {
                     // If the first token is not a label, take the first token
                      firstWordToken = tokens[0];
                 }
            }


            console.log("Final Candidate for first name:", candidate, "-> Sanitized Token:", firstWordToken);
            if (firstWordToken && firstWordToken.length > 1) {
                return firstWordToken.toUpperCase();
            }
            // If token is invalid here, the loop continues to check subsequent lines
        }
    }
    return ""; // No valid name found after checking all lines
}


// Extract the surname by scanning for relevant keywords, handling colons/slashes.
function extractSurname(lines) {
    const surnameKeywords = ["surname", "surmame", "sumame", "nom", "last name", "last names"]; // Added more variations

    // Definitive exclusion keywords - if these are present, it's likely NOT the primary surname line
    const definitiveExcludeKeywords = ["given", "prénom", "nom du p", "nom de la m", "father", "mother", "père", "mère", "first name", "first names"];


    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        // Check if the line contains *any* potential surname keyword
        const hasSurnameKeyword = surnameKeywords.some(keyword => lowerLine.includes(keyword));

        if (hasSurnameKeyword) {
            // Now, check if it *also* contains keywords that strongly indicate it's NOT the primary surname
            const shouldExclude = definitiveExcludeKeywords.some(exclude => lowerLine.includes(exclude));

            if (shouldExclude) {
                console.log("Skipping line identified as another name field:", line);
                continue; // Skip this line entirely for surname extraction
            }

            // If we reach here, the line has a surname keyword and is not definitively excluded
            console.log("Potential surname line found:", line);

            let candidate = "";
            const colonIndex = line.indexOf(":");

            if (colonIndex !== -1) {
                candidate = line.substring(colonIndex + 1).trim();
                console.log("Surname candidate (from colon):", candidate);
            } else {
                 // Try same line extraction if no colon (less common for surname but possible)
                 let searchIndex = -1;
                 const foundKeyword = surnameKeywords.find(k => lowerLine.includes(k));
                 if (foundKeyword) {
                     searchIndex = lowerLine.lastIndexOf(foundKeyword);
                     const keywordEndIndex = searchIndex + foundKeyword.length;
                     if (keywordEndIndex < line.length) {
                          candidate = line.substring(keywordEndIndex).trim().replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]*/, '');
                          if (candidate.length > 0) {
                            console.log("Surname candidate (from same line, no colon):", candidate);
                          } else {
                              // Fallback to next line maybe? Generally less reliable for surname.
                              candidate = ""; // Reset if same line extraction yielded nothing
                          }
                     }
                 }
                 // Consider next line fallback only if same line efforts failed completely
                 if (candidate.length < 2 && i < lines.length - 1) {
                      const nextLineCandidate = lines[i + 1].trim();
                      // Add exclusion check for the next line as well
                      if (nextLineCandidate.length > 1 && nextLineCandidate.match(/[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/) && !nextLineCandidate.toLowerCase().includes("father") && !nextLineCandidate.toLowerCase().includes("mother") && !nextLineCandidate.toLowerCase().includes("père") && !nextLineCandidate.toLowerCase().includes("mère") && !nextLineCandidate.toLowerCase().includes("given") && !nextLineCandidate.toLowerCase().includes("prénom")) {
                           candidate = nextLineCandidate;
                           console.log("Surname candidate (using next line as fallback):", candidate);
                      }
                 }
            }

            // If a slash exists, take the text after the last slash.
            if (candidate.indexOf("/") !== -1) {
                let tokens = candidate.split("/");
                candidate = tokens[tokens.length - 1].trim();
                console.log("Surname candidate (after slash):", candidate);
            }

            // Sanitize (keeps spaces now)
            let sanitizedCandidate = sanitizeSurname(candidate);

            // Take only the first token/word after splitting by space
            let firstWordToken = sanitizedCandidate.split(" ")[0];

            console.log("Final Candidate for last name:", candidate, "-> Sanitized Token:", firstWordToken);
            if (firstWordToken && firstWordToken.length > 1) {
                return firstWordToken.toUpperCase(); // Found a valid token, return it
            }

             console.log("Sanitized surname candidate was empty or too short:", firstWordToken);
            // If candidate is invalid here, the loop continues to check subsequent lines
        }
        // If no surname keyword, continue to the next line
    }
    return ""; // No valid surname found after checking all lines
}

// --- MRZ Parsing Function (Fallback) ---
// Attempts to find and parse passport MRZ lines for name extraction.
// Returns { surname: '...', givenNames: '...' } or null if not found/parsed.
function parseMRZ(lines) {
    console.log("Attempting MRZ fallback parsing...");
    let mrzLine1 = null;
    let mrzLine2 = null;

    // MRZ lines are usually at the bottom and contain lots of '<'
    // Look for lines with a high density of '<' or specific patterns
    const mrzCandidates = lines.filter(line => line.includes('<') && line.length > 30); // Basic filtering

    // Simple approach: Assume the last two such lines might be the MRZ
    if (mrzCandidates.length >= 2) {
        mrzLine1 = mrzCandidates[mrzCandidates.length - 2];
        mrzLine2 = mrzCandidates[mrzCandidates.length - 1];
        console.log("Potential MRZ lines found:", mrzLine1, mrzLine2);

        // Basic MRZ format parsing (ICAO Type 3)
        // Line 1: P<[Country]SURNAME<<GIVEN<NAMES<<<<<<<<<<<
        // Line 2: [Passport No][Check Digit][Country]...
        try {
            // Extract surname and given names from Line 1
            const parts = mrzLine1.split('<<');
            if (parts.length >= 2) {
                // Part 0: P<[Country]SURNAME
                let surnamePart = parts[0].substring(5); // Skip P<[Country] (5 chars)
                let surname = surnamePart.replace(/</g, ' ').trim(); // Replace < with spaces in surname

                // Part 1: GIVEN<NAMES<<<<<<<<<<<
                let givenNamesPart = parts[1];
                let givenNames = givenNamesPart.replace(/</g, ' ').trim(); // Replace < with spaces in given names

                console.log("MRZ parsed - Surname:", surname, "Given Names:", givenNames);

                // Sanitize the extracted names from MRZ
                const sanitizedSurname = sanitizeSurname(surname);
                const sanitizedGivenNames = sanitizeGivenName(givenNames);

                 console.log("MRZ parsed - Sanitized Surname:", sanitizedSurname, "Sanitized Given Names:", sanitizedGivenNames);

                if (sanitizedSurname || sanitizedGivenNames) {
                     return {
                         surname: sanitizedSurname,
                         givenNames: sanitizedGivenNames
                     };
                }
            }
        } catch (e) {
            console.error("Error parsing MRZ lines:", e);
            return null; // Return null if parsing fails
        }
    } else {
        console.log("Could not identify potential MRZ lines (found less than 2 candidates).");
    }


    return null; // Return null if no MRZ found or parsing failed
}


// --- Image Preprocessing ---
// Convert the uploaded image to grayscale via a hidden canvas.
function preprocessImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const img = new Image();

        reader.onload = function (e) {
            img.src = e.target.result;
        };

        img.onload = function () {
            const canvas = document.createElement("canvas");
            // Optional: Resize for potentially better OCR performance, but keep aspect ratio
            const MAX_WIDTH = 1500; // Max width constraint
            let scale = 1;
            if (img.width > MAX_WIDTH) {
                scale = MAX_WIDTH / img.width;
            }
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext("2d", { alpha: false }); // Optimize for no transparency
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Grayscale conversion
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // Simple average grayscale
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = avg; // red
                data[i + 1] = avg; // green
                data[i + 2] = avg; // blue
                // Alpha (data[i + 3]) is left unchanged
            }
            ctx.putImageData(imageData, 0, 0);
            console.log("Image preprocessed (grayscale, size adjusted if needed)");
            resolve(canvas.toDataURL("image/png")); // Use PNG for potentially better quality than JPEG
        };

        img.onerror = function (err) { reject(new Error("Failed to load image: " + err)); };
        reader.onerror = function (err) { reject(new Error("Failed to read file: " + err)); };
        reader.onabort = function() { reject(new Error("File reading was aborted.")); };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            reject(new Error("No file provided to preprocess."));
        }
    });
}

// --- Main OCR & Extraction Functions ---

async function processImage() {
    const loadingIndicator = document.getElementById("loadingIndicator");
    const fileInput = document.getElementById("passportImage");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a passport image file first.");
        return;
    }

    // Basic check for image type (client-side)
    if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file (e.g., PNG, JPG, GIF).");
        return;
    }


    loadingIndicator.classList.remove("hidden");
    // Disable button during processing
    const uploadButton = document.querySelector('button[onclick="processImage()"]');
    if (uploadButton) uploadButton.disabled = true;


    try {
        console.log("Starting image preprocessing...");
        const preprocessedDataUrl = await preprocessImage(file);

        console.log("Starting OCR...");
        const { data: { text } } = await Tesseract.recognize(
            preprocessedDataUrl,
            'eng', // Use English language model
            {
                logger: m => {
    const ocrStatusDiv = document.getElementById("ocrStatusDisplay");
    const ocrStatusText = document.getElementById("ocrStatusText");
    if (ocrStatusDiv && ocrStatusText) {
        ocrStatusDiv.classList.remove("hidden");
        ocrStatusText.textContent = `${m.status} (${(m.progress * 100).toFixed(1)}%)`;
    }
}

            }
        );

        console.log("OCR finished. Extracted text length:", text.length);
        // console.log("Raw Extracted text:\n", text); // Log raw text if needed for debugging
        extractNames(text);

    } catch (err) {
        console.error("Error during image processing or OCR:", err);
        alert(`An error occurred: ${err.message || 'Unknown error during processing.'} Check console for details.`);
    } finally {
document.getElementById("ocrStatusDisplay").classList.add("hidden");

        loadingIndicator.classList.add("hidden");
        if (uploadButton) uploadButton.disabled = false; // Re-enable button
        fileInput.value = ''; // Clear file input after processing attempt
    }
}


function extractNames(text) {
    // Split the OCR text into an array of trimmed, nonempty lines.
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    console.log("Processing lines:", lines);

    // --- Primary Extraction (Line by Line) ---
    let firstNamePrimary = extractGivenName(lines);
    let lastNamePrimary = extractSurname(lines);

    let finalFirstName = firstNamePrimary;
    let finalLastName = lastNamePrimary;

    // --- MRZ Fallback ---
    // If primary extraction failed to get both names, try MRZ
    if (!finalFirstName || !finalLastName) {
        const mrzNames = parseMRZ(lines);
        if (mrzNames) {
            // Use MRZ names if primary extraction didn't find the field
            finalFirstName = finalFirstName || mrzNames.givenNames;
            finalLastName = finalLastName || mrzNames.surname;
            console.log("MRZ Fallback applied. First Name:", finalFirstName, "Last Name:", finalLastName);
        } else {
             console.log("MRZ Fallback attempted but failed or found no names.");
        }
    } else {
        console.log("Primary extraction successful, skipping MRZ fallback.");
    }


    // --- Final Tokenization (First Word Only) ---
    // Apply the "first word only" rule to the final determined names

    let extractedFirstNameToken = '';
    if (finalFirstName) {
        extractedFirstNameToken = finalFirstName.split(" ")[0] || '';
    }

    let extractedLastNameToken = '';
    if (finalLastName) {
        extractedLastNameToken = finalLastName.split(" ")[0] || '';
    }


    console.log("Final Extracted First Name (First Word):", extractedFirstNameToken.toUpperCase());
    console.log("Final Extracted Last Name (First Word):", extractedLastNameToken.toUpperCase());

    const firstInput = document.getElementById("first1");
    const lastInput = document.getElementById("last1");

    let message = "";
    let foundBoth = false;

    if (extractedFirstNameToken && extractedLastNameToken) {
        firstInput.value = extractedFirstNameToken.toUpperCase();
        lastInput.value = extractedLastNameToken.toUpperCase();
        message = "First and Last names extracted and filled into the form.";
        foundBoth = true;
    } else if (extractedFirstNameToken) {
        firstInput.value = extractedFirstNameToken.toUpperCase();
        // Clear last name field if first name found but last name failed
        lastInput.value = '';
        message = "Only First Name could be extracted. Please check/enter Last Name.";
    } else if (extractedLastNameToken) {
        // Clear first name field if last name found but first name failed
        firstInput.value = '';
        lastInput.value = extractedLastNameToken.toUpperCase();
        message = "Only Last Name could be extracted. Please check/enter First Name.";
    } else {
        // Clear both if extraction completely failed
        firstInput.value = '';
        lastInput.value = '';
        message = "Could not automatically extract names from the image. Please enter manually or try a clearer image.";
        console.log("Extraction failed. Please check the OCR output and extraction logic if needed.");
    }

    alert(message);
}


// --- Levenshtein Distance Implementation ---
function levenshtein(s1, s2) {
    // Case-insensitive comparison
    const str1 = (s1 || "").toUpperCase();
    const str2 = (s2 || "").toUpperCase();

    const len1 = str1.length;
    const len2 = str2.length;

    // Create a 2D array (matrix)
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

    // Initialize the first row and column
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    // Fill the rest of the matrix
    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1; // Cost is 1 if chars differ, 0 if same
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,       // Deletion from s1
                matrix[i][j - 1] + 1,       // Insertion into s1
                matrix[i - 1][j - 1] + cost // Substitution
            );
        }
    }

    // The distance is the value in the bottom-right cell
    return matrix[len1][len2];
}

// --- Simple Difference Highlighter ---
// This is a basic highlighter, not a complex diff algorithm.
// It compares char by char at the same index and highlights mismatches.

function getSmartDiff(str1, str2) {
  const s1 = (str1 || "").toUpperCase();
  const s2 = (str2 || "").toUpperCase();

  let i = 0, j = 0;
  let output1 = '', output2 = '', diffCount = 0;

  while (i < s1.length || j < s2.length) {
    const ch1 = i < s1.length ? s1[i] : '';
    const ch2 = j < s2.length ? s2[j] : '';

    // Match
    if (ch1 === ch2) {
      output1 += ch1 === ' ' ? '&nbsp;' : ch1;
      output2 += ch2 === ' ' ? '&nbsp;' : ch2;
      i++; j++;
    }

    // Transposition (e.g., "AH" vs "HA")
    else if (i + 1 < s1.length && j + 1 < s2.length && s1[i] === s2[j + 1] && s1[i + 1] === s2[j]) {
      output1 += `<span class="diff-letter">${s1[i]}</span><span class="diff-letter">${s1[i + 1]}</span>`;
      output2 += `<span class="diff-letter">${s2[j]}</span><span class="diff-letter">${s2[j + 1]}</span>`;
      i += 2;
      j += 2;
      diffCount += 2;
    }

    // Deletion in s2 (missing char)
    else if (i + 1 < s1.length && s1[i + 1] === ch2) {
      output1 += `<span class="diff-letter">${ch1}</span>`;
      output2 += `<span class="diff-letter">_</span>`;
      i++;
      diffCount++;
    }

    // Insertion in s2 (extra char)
    else if (j + 1 < s2.length && ch1 === s2[j + 1]) {
      output1 += `<span class="diff-letter">_</span>`;
      output2 += `<span class="diff-letter">${ch2}</span>`;
      j++;
      diffCount++;
    }

    // Regular mismatch
    else {
      output1 += `<span class="diff-letter">${ch1 || '_'}</span>`;
      output2 += `<span class="diff-letter">${ch2 || '_'}</span>`;
      i++;
      j++;
      diffCount++;
    }
  }

  return {
    line1: output1,
    line2: output2,
    diffCount
  };
}
 

// --- Name Comparison Logic ---

function compareNames() {
    const firstName1 = document.getElementById("first1").value.trim();
    const lastName1 = document.getElementById("last1").value.trim();
    const firstName2 = document.getElementById("first2").value.trim();
    const lastName2 = document.getElementById("last2").value.trim();

    // Clear previous results
    document.getElementById("line1").innerHTML = '';
    document.getElementById("line2").innerHTML = '';
    document.getElementById("diffCount").textContent = '';
    document.getElementById("swapInfo").textContent = '';

    if (!firstName1 || !firstName2) {
        alert("Please enter at least both First Names to compare.");
        return;
    }

    let swapped = false;

    const directFirst = levenshtein(firstName1, firstName2);
    const directLast = levenshtein(lastName1, lastName2);
    const distanceDirect = directFirst + directLast;

    let swappedFirst = Infinity;
    let swappedLast = Infinity;

    if (firstName1 && lastName1 && firstName2 && lastName2) {
        swappedFirst = levenshtein(firstName1, lastName2);
        swappedLast = levenshtein(lastName1, firstName2);
    }

    const distanceSwapped = swappedFirst + swappedLast;

    if (distanceSwapped < distanceDirect) {
        swapped = true;
    }

    const finalFirst1 = firstName1.toUpperCase();
    const finalFirst2 = (swapped ? lastName2 : firstName2).toUpperCase();
    const finalLast1 = lastName1.toUpperCase();
    const finalLast2 = (swapped ? firstName2 : lastName2).toUpperCase();

    const diffFirst = getSmartDiff(finalFirst1, finalFirst2);
    const diffLast = getSmartDiff(finalLast1, finalLast2);

    document.getElementById("line1").innerHTML =
        diffFirst.line1 + (finalLast1 ? ' ' + diffLast.line1 : '');
    document.getElementById("line2").innerHTML =
        diffFirst.line2 + (finalLast2 ? ' ' + diffLast.line2 : '');

    const totalDiffs = diffFirst.diffCount + diffLast.diffCount;

    document.getElementById("diffCount").textContent = `Differences found: ${totalDiffs}`;
    document.getElementById("swapInfo").textContent = swapped
        ? "(Note: First and Last names were swapped)"
        : '';
}


// --- Clear Fields Function ---
function clearFields() {
    document.getElementById("first1").value = '';
    document.getElementById("last1").value = '';
    document.getElementById("first2").value = '';
    document.getElementById("last2").value = '';
    document.getElementById("passportImage").value = ''; // Clear file input

    // Clear results area
    document.getElementById("line1").innerHTML = '';
    document.getElementById("line2").innerHTML = '';
    document.getElementById("diffCount").textContent = '';
    document.getElementById("swapInfo").textContent = '';
    document.getElementById("loadingIndicator").classList.add("hidden");

    console.log("Fields cleared.");
}
