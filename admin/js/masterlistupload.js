// Masterlist Bulk Upload JavaScript
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateFormatInstructions('tab'); // Default format
});

// Setup event listeners
function setupEventListeners() {
    // Format selection
    document.querySelectorAll('input[name="format"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateFormatInstructions(e.target.value);
        });
    });
    
    // Form submission
    document.getElementById('bulk-upload-form').addEventListener('submit', handleUpload);
    
    // Validate button
    document.getElementById('validate-btn').addEventListener('click', handleValidate);
    
    // Clear button
    document.getElementById('clear-btn').addEventListener('click', clearForm);
}

// Update format instructions based on selection
function updateFormatInstructions(format) {
    // Hide all instructions
    document.querySelectorAll('#tab-instructions, #csv-instructions, #json-instructions').forEach(div => {
        div.style.display = 'none';
    });
    
    // Show selected format instructions
    document.getElementById(`${format}-instructions`).style.display = 'block';
    
    // Update input hint
    const inputHint = document.getElementById('input-hint');
    const textarea = document.getElementById('player-data');
    
    switch (format) {
        case 'tab':
            inputHint.textContent = 'Use Tab character to separate fields. Each player on a new line.';
            textarea.placeholder = 'Paste tab-separated data here...\nFormat: PlayerName\tDota2ID\tMMR\tNotes(optional)';
            break;
        case 'csv':
            inputHint.textContent = 'Use comma to separate fields. Each player on a new line.';
            textarea.placeholder = 'Paste CSV data here...\nFormat: PlayerName,Dota2ID,MMR,Notes(optional)';
            break;
        case 'json':
            inputHint.textContent = 'Paste valid JSON array of player objects.';
            textarea.placeholder = 'Paste JSON data here...\nFormat: [{"name": "...", "dota2id": "...", "mmr": 0, "notes": "..."}]';
            break;
    }
}

// Handle validation
function handleValidate() {
    const format = document.querySelector('input[name="format"]:checked').value;
    const data = document.getElementById('player-data').value.trim();
    
    if (!data) {
        showAlert('Please enter data to validate.', 'warning');
        return;
    }
    
    const { players, errors } = parseData(data, format);
    
    if (errors.length > 0) {
        let errorMsg = `Validation found ${errors.length} error(s):<br><ul>`;
        errors.slice(0, 5).forEach(error => {
            errorMsg += `<li>${error}</li>`;
        });
        if (errors.length > 5) {
            errorMsg += `<li>... and ${errors.length - 5} more errors</li>`;
        }
        errorMsg += '</ul>';
        showAlert(errorMsg, 'danger');
    } else {
        showAlert(`Validation successful! Found ${players.length} valid player(s).`, 'success');
    }
}

// Handle upload
async function handleUpload(event) {
    event.preventDefault();
    
    const format = document.querySelector('input[name="format"]:checked').value;
    const data = document.getElementById('player-data').value.trim();
    const skipDuplicates = document.getElementById('skip-duplicates').checked;
    const updateExisting = document.getElementById('update-existing').checked;
    
    if (!data) {
        showAlert('Please enter data to upload.', 'warning');
        return;
    }
    
    const { players, errors } = parseData(data, format);
    
    if (players.length === 0) {
        showAlert('No valid players found to upload.', 'warning');
        return;
    }
    
    if (errors.length > 0) {
        showAlert(`Found ${errors.length} validation errors. Please fix them before uploading.`, 'danger');
        return;
    }
    
    // Show progress
    showProgress();
    updateProgress(25, 'Preparing data...');
    
    // Disable buttons
    const uploadBtn = document.getElementById('upload-btn');
    const validateBtn = document.getElementById('validate-btn');
    const originalUploadText = uploadBtn.innerHTML;
    const originalValidateText = validateBtn.innerHTML;
    
    uploadBtn.disabled = true;
    validateBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Uploading...';
    
    try {
        updateProgress(50, 'Sending to server...');
        
        // Prepare players for upload
        const playersToUpload = players.map(player => ({
            name: player.name.trim(),
            dota2id: player.dota2id.trim(),
            mmr: parseInt(player.mmr),
            notes: player.notes ? player.notes.trim() : ""
        }));
        
        const response = await fetch('/api/masterlist/bulk-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': localStorage.getItem('adminSessionId')
            },
            body: JSON.stringify({
                players: playersToUpload,
                skipDuplicates: skipDuplicates,
                updateExisting: updateExisting
            })
        });
        
        updateProgress(75, 'Processing...');
        
        const result = await response.json();
        
        updateProgress(100, 'Complete!');
        
        if (response.ok && result.success) {
            showResults(result);
            showAlert(`Upload successful! ${result.added || 0} added, ${result.updated || 0} updated, ${result.skipped || 0} skipped.`, 'success');
        } else {
            throw new Error(result.message || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showAlert(`Upload failed: ${error.message}`, 'danger');
    } finally {
        // Re-enable buttons
        uploadBtn.disabled = false;
        validateBtn.disabled = false;
        uploadBtn.innerHTML = originalUploadText;
        validateBtn.innerHTML = originalValidateText;
        
        // Hide progress after delay
        setTimeout(() => {
            document.getElementById('upload-progress').style.display = 'none';
        }, 2000);
    }
}

// Parse data based on format
function parseData(data, format) {
    const players = [];
    const errors = [];
    
    try {
        switch (format) {
            case 'tab':
                return parseTabData(data);
            case 'csv':
                return parseCSVData(data);
            case 'json':
                return parseJSONData(data);
            default:
                errors.push('Invalid format selected.');
                return { players, errors };
        }
    } catch (error) {
        errors.push(`Parsing error: ${error.message}`);
        return { players, errors };
    }
}

// Parse tab-separated data
function parseTabData(data) {
    const players = [];
    const errors = [];
    const lines = data.trim().split('\n');
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        if (!trimmedLine) return; // Skip empty lines
        
        const parts = trimmedLine.split('\t');
        
        if (parts.length < 3) {
            errors.push(`Line ${lineNumber}: Invalid format. Expected at least 3 fields (PlayerName, Dota2ID, MMR).`);
            return;
        }
        
        const [name, dota2id, mmr, notes] = parts.map(part => part.trim());
        
        // Validate and add player
        const validationResult = validatePlayer(name, dota2id, mmr, notes, lineNumber);
        if (validationResult.isValid) {
            players.push(validationResult.player);
        } else {
            errors.push(validationResult.error);
        }
    });
    
    return { players, errors };
}

// Parse CSV data
function parseCSVData(data) {
    const players = [];
    const errors = [];
    const lines = data.trim().split('\n');
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        if (!trimmedLine) return; // Skip empty lines
        
        // Simple CSV parsing (handles quoted fields)
        const parts = parseCSVLine(trimmedLine);
        
        if (parts.length < 3) {
            errors.push(`Line ${lineNumber}: Invalid format. Expected at least 3 fields (PlayerName, Dota2ID, MMR).`);
            return;
        }
        
        const [name, dota2id, mmr, notes] = parts.map(part => part.trim());
        
        // Validate and add player
        const validationResult = validatePlayer(name, dota2id, mmr, notes, lineNumber);
        if (validationResult.isValid) {
            players.push(validationResult.player);
        } else {
            errors.push(validationResult.error);
        }
    });
    
    return { players, errors };
}

// Simple CSV line parser
function parseCSVLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    parts.push(current);
    return parts;
}

// Parse JSON data
function parseJSONData(data) {
    const players = [];
    const errors = [];
    
    try {
        const jsonData = JSON.parse(data);
        
        if (!Array.isArray(jsonData)) {
            errors.push('JSON data must be an array of player objects.');
            return { players, errors };
        }
        
        jsonData.forEach((player, index) => {
            const lineNumber = index + 1;
            
            if (!player || typeof player !== 'object') {
                errors.push(`Line ${lineNumber}: Invalid player object.`);
                return;
            }
            
            const { name, dota2id, mmr, notes } = player;
            
            // Validate and add player
            const validationResult = validatePlayer(name, dota2id, mmr, notes, lineNumber);
            if (validationResult.isValid) {
                players.push(validationResult.player);
            } else {
                errors.push(validationResult.error);
            }
        });
        
    } catch (error) {
        errors.push(`JSON parsing error: ${error.message}`);
    }
    
    return { players, errors };
}

// Validate player data
function validatePlayer(name, dota2id, mmr, notes, lineNumber) {
    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Invalid name (must be at least 2 characters) - got: "${name}"`
        };
    }
    
    if (name.trim().length > 50) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Name too long (max 50 characters) - got: "${name}"`
        };
    }
    
    // Dota2 ID validation
    if (!dota2id || typeof dota2id !== 'string' || !/^\d{6,20}$/.test(dota2id.trim())) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Invalid Dota2 ID (must be 6-20 digits) - got: "${dota2id}"`
        };
    }
    
    // MMR validation
    const mmrNum = parseInt(mmr);
    if (isNaN(mmrNum) || mmrNum < 0 || mmrNum > 20000) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Invalid MMR (must be 0-20000) - got: ${mmr}`
        };
    }
    
    // Notes validation (optional)
    if (notes && notes.length > 500) {
        return {
            isValid: false,
            error: `Line ${lineNumber}: Notes too long (max 500 characters)`
        };
    }
    
    return {
        isValid: true,
        player: {
            name: name.trim(),
            dota2id: dota2id.trim(),
            mmr: mmrNum,
            notes: notes ? notes.trim() : ''
        }
    };
}

// Show alert message
function showAlert(message, type = 'info') {
    const alertElement = document.getElementById('upload-alert');
    alertElement.className = `alert alert-${type}`;
    alertElement.innerHTML = message;
    alertElement.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            alertElement.style.display = 'none';
        }, 5000);
    }
}

// Show progress
function showProgress() {
    document.getElementById('upload-progress').style.display = 'block';
    document.getElementById('upload-results').style.display = 'none';
}

// Update progress
function updateProgress(percentage, text) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = text;
    progressPercentage.textContent = `${percentage}%`;
}

// Show results
function showResults(result) {
    document.getElementById('results-added').textContent = result.added || 0;
    document.getElementById('results-updated').textContent = result.updated || 0;
    document.getElementById('results-skipped').textContent = result.skipped || 0;
    document.getElementById('results-errors').textContent = result.validationErrors ? result.validationErrors.length : 0;
    
    document.getElementById('upload-results').style.display = 'block';
}

// Clear form
function clearForm() {
    document.getElementById('player-data').value = '';
    document.getElementById('upload-alert').style.display = 'none';
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('upload-results').style.display = 'none';
    document.getElementById('skip-duplicates').checked = true;
    document.getElementById('update-existing').checked = false;
} 