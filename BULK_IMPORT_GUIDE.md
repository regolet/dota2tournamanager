# Bulk Import Guide for Masterlist

## Overview
The bulk import feature allows you to quickly add multiple players to the masterlist at once using a simple tab-separated format.

## How to Use

### 1. Access the Bulk Import Feature
- Go to the Admin Panel
- Navigate to the "Player Masterlist" section
- Click the "Bulk Import" button (green button with upload icon)

### 2. Data Format
Each line should contain three fields separated by **Tab** characters:
```
PlayerName	Dota2ID	MMR
```

**Example:**
```
HyO	182065786	7100
Player2	123456789	6500
Player3	987654321	5800
```

### 3. Field Requirements
- **Player Name**: Must be at least 2 characters long
- **Dota2 ID**: Must be numeric only (no letters or special characters)
- **MMR**: Must be a number between 0 and 20000

### 4. Import Options
- **Skip duplicate Dota2 IDs**: When checked, existing players won't be overwritten
- **Update existing players**: When checked, existing players will be updated with new data

### 5. Preview Before Import
- Click "Preview" to validate your data and see what will be imported
- The preview shows which players are new vs. updates
- Fix any validation errors before proceeding

### 6. Execute Import
- Click "Import Players" to add the players to the masterlist
- You'll see a summary of added, updated, and skipped players

## Tips
- Use copy-paste from Excel or Google Sheets (they use tab separation by default)
- Each player should be on a separate line
- Empty lines are automatically skipped
- The system validates all data before importing

## Error Handling
If there are validation errors:
- Check that all fields are present and properly formatted
- Ensure Dota2 IDs are numeric only
- Verify MMR values are within the valid range (0-20000)
- Make sure player names are at least 2 characters long

## Benefits
- Quickly import large lists of verified players
- Maintain data integrity with validation
- Preview changes before applying them
- Handle duplicates intelligently
- Track import results with detailed feedback 