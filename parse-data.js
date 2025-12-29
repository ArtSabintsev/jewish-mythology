#!/usr/bin/env node
/**
 * Parser for Jewish Mythology text files
 * Extracts myths from Schwartz's "Tree of Souls" and Ginzberg's "Legends of the Jews"
 * Outputs structured JSON for the web application
 */

const fs = require('fs');
const path = require('path');

// Biblical book patterns for reference extraction
const BIBLICAL_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
  'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Songs', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
  'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  // Hebrew names
  'Bereishit', 'Shemot', 'Vayikra', 'Bamidbar', 'Devarim',
  'Tehillim', 'Mishlei', 'Kohelet', 'Shir HaShirim', 'Iyov',
  'Yeshayahu', 'Yirmiyahu', 'Yechezkel', 'Daniyel',
  'Isa\\.', 'Gen\\.', 'Exod\\.', 'Lev\\.', 'Num\\.', 'Deut\\.',
  'Ezek\\.', 'Dan\\.', 'Ps\\.', 'Prov\\.',
  // Talmudic/Midrashic sources
  'B\\.', 'Y\\.', 'Midrash', 'Pirkei', 'Zohar'
];

const BIBLICAL_PATTERN = new RegExp(
  `(${BIBLICAL_BOOKS.join('|')})\\s*(\\d+)?[:\\.]?(\\d+)?(?:[-–](\\d+))?`,
  'gi'
);

// Theme keywords for automatic tagging
const THEME_KEYWORDS = {
  'creation': ['creation', 'created', 'create', 'formed', 'beginning', 'origin', 'genesis', 'first day'],
  'angels': ['angel', 'seraph', 'cherub', 'ophan', 'metatron', 'sandalphon', 'michael', 'gabriel', 'raphael', 'ministering'],
  'demons': ['demon', 'satan', 'lilith', 'shedim', 'samael', 'evil spirit', 'azazel', 'prince of darkness'],
  'heaven': ['heaven', 'paradise', 'throne', 'celestial', 'firmament', 'divine chariot', 'merkavah', 'heavenly'],
  'hell': ['hell', 'gehenna', 'gehinom', 'underworld', 'punishment', 'sheol'],
  'messiah': ['messiah', 'redemption', 'end of days', 'olam haba', 'world to come', 'messianic'],
  'torah': ['torah', 'scripture', 'law', 'commandment', 'covenant', 'revelation', 'sinai', 'tablets'],
  'patriarchs': ['abraham', 'isaac', 'jacob', 'sarah', 'rebecca', 'rachel', 'leah', 'patriarch'],
  'moses': ['moses', 'pharaoh', 'egypt', 'plagues', 'red sea', 'burning bush', 'sinai'],
  'adam-eve': ['adam', 'eve', 'garden of eden', 'eden', 'forbidden fruit', 'tree of knowledge', 'first man', 'first woman'],
  'noah': ['noah', 'flood', 'ark', 'deluge', 'rainbow'],
  'mysticism': ['kabbalah', 'sefirot', 'zohar', 'mystical', 'meditation', 'divine name', 'secret', 'hidden'],
  'creatures': ['leviathan', 'behemoth', 'ziz', 'phoenix', 'golem', 'dragon', 're\'em', 'monster', 'beast'],
  'soul': ['soul', 'neshama', 'ruach', 'nefesh', 'spirit', 'afterlife', 'reincarnation', 'treasury of souls'],
  'prophecy': ['prophet', 'prophecy', 'vision', 'dream', 'revelation', 'seer'],
  'temple': ['temple', 'tabernacle', 'mishkan', 'sanctuary', 'holy of holies', 'ark of the covenant'],
  'exile': ['exile', 'diaspora', 'wandering', 'scattered', 'captivity', 'babylon'],
  'holy-land': ['jerusalem', 'zion', 'israel', 'canaan', 'promised land', 'holy land']
};

function extractThemes(text) {
  const themes = new Set();
  const lowerText = text.toLowerCase();

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        themes.add(theme);
        break;
      }
    }
  }

  return Array.from(themes);
}

function extractBiblicalReferences(text) {
  const references = new Set();
  let match;
  const pattern = new RegExp(BIBLICAL_PATTERN.source, 'gi');

  while ((match = pattern.exec(text)) !== null) {
    let ref = match[1].replace(/\\./g, '');
    if (match[2]) {
      ref += ` ${match[2]}`;
      if (match[3]) {
        ref += `:${match[3]}`;
        if (match[4]) {
          ref += `-${match[4]}`;
        }
      }
    }
    references.add(ref.trim());
  }

  return Array.from(references);
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/- /g, '') // Remove hyphenation
    .trim();
}

function generateId(title, source) {
  return `${source}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.substring(0, 80);
}

function fixOcrErrors(text) {
  return text
    .replace(/COD/g, 'GOD')
    .replace(/6OD/g, 'GOD')
    .replace(/600/g, 'God')
    .replace(/CLORY/g, 'GLORY')
    .replace(/6LORY/g, 'GLORY')
    .replace(/cod/g, 'god')
    .replace(/th e /g, 'the ')
    .replace(/he aven/g, 'heaven')
    .replace(/ jvvhose /g, ' whose ')
    .replace(/ toglorify /g, ' to glorify ');
}

// Parse Schwartz's Tree of Souls
function parseSchwartzFile(content) {
  const myths = [];

  // Split into lines
  const lines = content.split('\n').map(line => line.trim());

  let currentBook = '';
  let currentSection = '';
  let currentMyth = null;
  let contentBuffer = [];
  let mode = 'seeking'; // seeking, content, commentary, sources

  // Find where actual content starts (look for "BOOK ONE" after line 6000)
  let contentStart = 0;
  for (let i = 6000; i < lines.length; i++) {
    if (lines[i].trim() === 'BOOK ONE') {
      contentStart = i;
      break;
    }
  }

  if (contentStart === 0) {
    console.log('  Warning: Could not find content start marker');
    return myths;
  }

  console.log(`  Content starts at line ${contentStart}`);

  for (let i = contentStart; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Skip page numbers and headers
    if (/^\d+$/.test(line)) continue;
    if (/^[ivxlc]+$/i.test(line)) continue;
    if (/^CONTENTS/.test(line)) continue;
    if (/^\d+\s+MYTHS OF/.test(line)) continue;

    line = fixOcrErrors(line);

    // Detect book headers (BOOK ONE, BOOK TWO, etc.)
    if (/^BOOK\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)$/i.test(line)) {
      // Save current myth
      if (currentMyth) {
        currentMyth.content = contentBuffer.filter(l => l.mode === 'content').map(l => l.text).join(' ');
        currentMyth.commentary = contentBuffer.filter(l => l.mode === 'commentary').map(l => l.text).join(' ');
        if (currentMyth.content.length > 50) {
          myths.push(currentMyth);
        }
      }

      currentBook = line;
      // Look for the book subtitle (e.g., "MYTHS OF GOD") in next few lines
      for (let j = 1; j <= 3; j++) {
        const nextLine = lines[i + j]?.trim();
        if (nextLine && /^MYTHS\s+(OF|ABOUT)/i.test(fixOcrErrors(nextLine))) {
          currentBook = `${line}: ${fixOcrErrors(nextLine).split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}`;
          i += j;
          break;
        }
      }
      currentMyth = null;
      contentBuffer = [];
      mode = 'seeking';
      continue;
    }

    // Detect section headers (ALL CAPS, not numbered)
    if (line === line.toUpperCase() &&
        line.length > 5 &&
        line.length < 60 &&
        !line.match(/^\d+\./) &&
        !line.match(/^BOOK\s+/) &&
        !line.match(/^Sources/i) &&
        !line.match(/^Studies/i) &&
        currentBook) {

      // Save current myth
      if (currentMyth) {
        currentMyth.content = contentBuffer.filter(l => l.mode === 'content').map(l => l.text).join(' ');
        currentMyth.commentary = contentBuffer.filter(l => l.mode === 'commentary').map(l => l.text).join(' ');
        if (currentMyth.content.length > 50) {
          myths.push(currentMyth);
        }
      }

      currentSection = line.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      currentMyth = null;
      contentBuffer = [];
      mode = 'seeking';
      continue;
    }

    // Detect myth titles (numbered entries like "1. ISAIAH'S VISION")
    const mythMatch = line.match(/^(\d+)\.\s+([A-Z][A-Z\s'',\-&?]+)$/);
    if (mythMatch) {
      // Save previous myth
      if (currentMyth) {
        currentMyth.content = contentBuffer.filter(l => l.mode === 'content').map(l => l.text).join(' ');
        currentMyth.commentary = contentBuffer.filter(l => l.mode === 'commentary').map(l => l.text).join(' ');
        if (currentMyth.content.length > 50) {
          myths.push(currentMyth);
        }
      }

      const title = mythMatch[2].trim()
        .split(' ')
        .map(w => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');

      currentMyth = {
        id: generateId(title, 'schwartz'),
        number: parseInt(mythMatch[1]),
        title: title,
        content: '',
        commentary: '',
        sources: [],
        book: currentBook,
        section: currentSection,
        sourceWork: 'schwartz',
        biblicalReferences: [],
        themes: []
      };
      contentBuffer = [];
      mode = 'content';
      continue;
    }

    // Detect sources section
    if (/^Sources\s*:?\s*$/i.test(line)) {
      mode = 'sources';
      continue;
    }

    // Detect studies section (skip)
    if (/^Studies\s*:?\s*$/i.test(line)) {
      mode = 'skip';
      continue;
    }

    // Process content based on mode
    if (currentMyth && mode !== 'skip' && mode !== 'seeking') {
      if (mode === 'sources') {
        // Extract source references
        const sourceParts = line.replace(/;/g, ',').split(',').map(s => s.trim()).filter(s => s.length > 2);
        currentMyth.sources.push(...sourceParts);
      } else {
        // Detect transition from content to commentary
        // Commentary typically starts with analytical phrases after substantial content
        // and refers to the myth/text using phrases like "This myth", "This passage", etc.
        if (mode === 'content' && contentBuffer.length > 0) {
          const totalContentLength = contentBuffer.reduce((sum, l) => sum + l.text.length, 0);
          const isCommentaryStart = totalContentLength > 300 &&
              /^(This (biblical|myth|passage|story|legend|vision|account|text|is)|Here (the|God|we)|In this (myth|passage|interpretation)|According to|One way of reading|A close variant|The idea|While|So too|Some say|There are many)/i.test(line) &&
              !line.includes('"') &&
              !line.includes('"') &&
              !line.includes('said') &&
              !line.includes('spoke');
          if (isCommentaryStart) {
            mode = 'commentary';
          }
        }
        contentBuffer.push({ mode, text: line });
      }
    }
  }

  // Save last myth
  if (currentMyth) {
    currentMyth.content = contentBuffer.filter(l => l.mode === 'content').map(l => l.text).join(' ');
    currentMyth.commentary = contentBuffer.filter(l => l.mode === 'commentary').map(l => l.text).join(' ');
    if (currentMyth.content.length > 50) {
      myths.push(currentMyth);
    }
  }

  // Post-process myths
  return myths.map(myth => {
    const fullText = `${myth.title} ${myth.content} ${myth.commentary}`;
    return {
      ...myth,
      content: cleanText(myth.content),
      commentary: cleanText(myth.commentary),
      biblicalReferences: extractBiblicalReferences(fullText),
      themes: extractThemes(fullText),
      sources: myth.sources.filter(s => s.length > 2)
    };
  });
}

// Parse Ginzberg's Legends of the Jews
function parseGinzbergFile(content, volume) {
  const myths = [];

  // Split into lines
  const lines = content.split('\n').map(line => line.trim());

  let currentChapter = '';
  let currentMyth = null;
  let contentBuffer = [];

  // Find content start (after preface)
  let contentStart = 0;
  for (let i = 400; i < lines.length; i++) {
    const line = lines[i].trim();
    // Look for first chapter marker
    if (line === 'I' || line === 'I.') {
      const nextLine = lines[i + 1]?.trim().toUpperCase();
      if (nextLine && (nextLine.includes('CREATION') || nextLine.includes('JOSEPH'))) {
        contentStart = i;
        break;
      }
    }
    if (line === 'THE CREATION OF THE WORLD' || line === 'JOSEPH') {
      contentStart = i - 1;
      break;
    }
  }

  console.log(`  Content starts at line ${contentStart}`);

  // Roman numeral chapter pattern
  const romanPattern = /^(I{1,3}V?|VI{0,3})\.?\s*$/;

  for (let i = contentStart; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) continue;
    if (/^\d+$/.test(line)) continue;

    // Detect chapter headers (Roman numerals)
    if (romanPattern.test(line)) {
      // Save current myth
      if (currentMyth && contentBuffer.length > 0) {
        currentMyth.content = contentBuffer.join(' ');
        if (currentMyth.content.length > 100) {
          myths.push(currentMyth);
        }
      }

      const roman = line.replace('.', '').trim();
      // Look for chapter title
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine && nextLine === nextLine.toUpperCase() && nextLine.length > 3 && !romanPattern.test(nextLine)) {
          currentChapter = `${roman}. ${nextLine.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}`;
          i = j;
          break;
        }
      }
      currentMyth = null;
      contentBuffer = [];
      continue;
    }

    // Detect section headers (ALL CAPS)
    if (line === line.toUpperCase() &&
        line.length > 5 &&
        line.length < 80 &&
        !romanPattern.test(line) &&
        currentChapter &&
        !line.includes('***')) {

      // Save previous myth
      if (currentMyth && contentBuffer.length > 0) {
        currentMyth.content = contentBuffer.join(' ');
        if (currentMyth.content.length > 100) {
          myths.push(currentMyth);
        }
      }

      const title = line.split(' ').map(w =>
        w.charAt(0) + w.slice(1).toLowerCase()
      ).join(' ');

      currentMyth = {
        id: generateId(`v${volume}-${title}`, 'ginzberg'),
        title: title,
        content: '',
        commentary: '',
        sources: [],
        book: currentChapter,
        section: '',
        sourceWork: `ginzberg-v${volume}`,
        biblicalReferences: [],
        themes: []
      };
      contentBuffer = [];
      continue;
    }

    // Accumulate content
    if (currentMyth) {
      // Remove footnote references [1], [2], etc.
      line = line.replace(/\[\d+\]/g, '');
      if (line) {
        contentBuffer.push(line);
      }
    }
  }

  // Save last myth
  if (currentMyth && contentBuffer.length > 0) {
    currentMyth.content = contentBuffer.join(' ');
    if (currentMyth.content.length > 100) {
      myths.push(currentMyth);
    }
  }

  // Post-process myths
  return myths.map(myth => ({
    ...myth,
    content: cleanText(myth.content),
    biblicalReferences: extractBiblicalReferences(myth.content),
    themes: extractThemes(myth.content)
  }));
}

// Main execution
async function main() {
  console.log('Parsing Jewish Mythology texts...\n');

  const basePath = path.dirname(__filename);

  // Parse Schwartz
  console.log('Parsing Schwartz - Tree of Souls...');
  const schwartzPath = path.join(basePath, 'schwartz-tree-of-souls.txt');
  const schwartzContent = fs.readFileSync(schwartzPath, 'utf-8');
  const schwartzMyths = parseSchwartzFile(schwartzContent);
  console.log(`  Found ${schwartzMyths.length} myths`);

  // Parse Ginzberg Volume 1
  console.log('\nParsing Ginzberg - Legends of the Jews, Volume 1...');
  const ginzberg1Path = path.join(basePath, 'ginzburg-legendofthejews-volume1.txt');
  const ginzberg1Content = fs.readFileSync(ginzberg1Path, 'utf-8');
  const ginzberg1Myths = parseGinzbergFile(ginzberg1Content, 1);
  console.log(`  Found ${ginzberg1Myths.length} sections`);

  // Parse Ginzberg Volume 2
  console.log('\nParsing Ginzberg - Legends of the Jews, Volume 2...');
  const ginzberg2Path = path.join(basePath, 'ginzburg-legendofthejews-volume2.txt');
  const ginzberg2Content = fs.readFileSync(ginzberg2Path, 'utf-8');
  const ginzberg2Myths = parseGinzbergFile(ginzberg2Content, 2);
  console.log(`  Found ${ginzberg2Myths.length} sections`);

  // Combine all myths
  const allMyths = [...schwartzMyths, ...ginzberg1Myths, ...ginzberg2Myths];

  // Create summary statistics
  const stats = {
    total: allMyths.length,
    bySources: {
      schwartz: schwartzMyths.length,
      'ginzberg-v1': ginzberg1Myths.length,
      'ginzberg-v2': ginzberg2Myths.length
    },
    themes: {},
    books: {}
  };

  allMyths.forEach(myth => {
    myth.themes.forEach(theme => {
      stats.themes[theme] = (stats.themes[theme] || 0) + 1;
    });
    if (myth.book) {
      stats.books[myth.book] = (stats.books[myth.book] || 0) + 1;
    }
  });

  // Build filter options
  const filterOptions = {
    sources: ['schwartz', 'ginzberg-v1', 'ginzberg-v2'],
    themes: Object.keys(stats.themes).sort((a, b) => stats.themes[b] - stats.themes[a]),
    books: Object.keys(stats.books).sort()
  };

  // Output database
  const database = {
    metadata: {
      generated: new Date().toISOString(),
      version: '1.0.0',
      stats,
      filterOptions
    },
    myths: allMyths
  };

  const outputPath = path.join(basePath, 'data', 'myths.json');

  // Create data directory if it doesn't exist
  const dataDir = path.join(basePath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  fs.writeFileSync(outputPath, JSON.stringify(database, null, 2));

  console.log('\n=== Summary ===');
  console.log(`Total myths/sections: ${stats.total}`);
  console.log(`\nBy source:`);
  Object.entries(stats.bySources).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
  console.log(`\nTop themes:`);
  Object.entries(stats.themes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([theme, count]) => {
      console.log(`  ${theme}: ${count}`);
    });

  console.log(`\nBooks/Chapters found: ${Object.keys(stats.books).length}`);
  console.log(`\nOutput written to: ${outputPath}`);
}

main().catch(console.error);
