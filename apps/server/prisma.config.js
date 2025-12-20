// Load .env file explicitly
const fs = require('fs');
const path = require('path');

// Try multiple possible .env file locations
const possiblePaths = [
  path.join(__dirname, '.env'),           // Same directory as prisma.config.js
  path.join(__dirname, '..', '.env'),     // Parent directory
  path.join(process.cwd(), '.env'),      // Current working directory
];

let envPath = null;
for (const possiblePath of possiblePaths) {
  if (fs.existsSync(possiblePath)) {
    envPath = possiblePath;
    break;
  }
}

if (envPath) {
  console.log(`Loading .env from: ${envPath}`);
  const envFile = fs.readFileSync(envPath, 'utf8');
  
  // Handle multi-line values and proper parsing
  let currentKey = null;
  let currentValue = [];
  
  envFile.split(/\r?\n/).forEach(line => {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }
    
    // Check if this line starts a new key=value pair
    const match = trimmedLine.match(/^([^#=]+)=(.*)$/);
    if (match && match[1] && match[2] !== undefined) {
      // Save previous key-value if exists
      if (currentKey) {
        let value = currentValue.join('').trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[currentKey]) {
          process.env[currentKey] = value;
        }
      }
      
      // Start new key-value pair
      currentKey = match[1].trim();
      currentValue = [match[2]];
    } else if (currentKey && trimmedLine) {
      // Continuation of previous value (multi-line)
      currentValue.push(' ' + trimmedLine);
    }
  });
  
  // Save last key-value pair
  if (currentKey) {
    let value = currentValue.join('').trim();
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[currentKey]) {
      process.env[currentKey] = value;
    }
  }
  
  // Debug: Show if DATABASE_URL was loaded
  if (process.env.DATABASE_URL) {
    console.log('✓ DATABASE_URL loaded successfully');
  }
} else {
  console.warn('Warning: .env file not found in any of these locations:');
  possiblePaths.forEach(p => console.warn(`  - ${p}`));
  console.warn('Using system environment variables only.');
}

const url = process.env.DATABASE_URL || "";

if (!url) {
  console.error('\nERROR: DATABASE_URL is not set!');
  console.error('Please check that .env file exists in apps/server/ and contains:');
  console.error('DATABASE_URL="postgresql://username:password@host:port/database"\n');
  console.error('Or set DATABASE_URL as a system environment variable.');
}

module.exports = {
  datasource: {
    url: url,
  },
};

