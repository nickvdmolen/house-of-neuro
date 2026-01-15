#!/usr/bin/env node

// Migration script: Local JSON data → Supabase
// Run: node migrate-to-supabase.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_DIR = path.join(__dirname, 'server', 'data');

async function migrateTable(tableName) {
  const filePath = path.join(DATA_DIR, `${tableName}.json`);

  try {
    console.log(`📖 Reading ${tableName} from ${filePath}...`);
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`⚠️  No data to migrate for ${tableName}`);
      return;
    }

    console.log(`📤 Migrating ${data.length} ${tableName} records to Supabase...`);

    // Clear existing data first
    const { error: deleteError } = await supabase.from(tableName).delete().neq('id', 'dummy');
    if (deleteError) {
      console.error(`❌ Error clearing ${tableName}:`, deleteError);
      return;
    }

    // Insert new data
    const { error: insertError } = await supabase.from(tableName).insert(data);
    if (insertError) {
      console.error(`❌ Error inserting ${tableName}:`, insertError);
      return;
    }

    console.log(`✅ Successfully migrated ${data.length} ${tableName} records`);

  } catch (err) {
    console.error(`❌ Error migrating ${tableName}:`, err.message);
  }
}

async function main() {
  console.log('🚀 Starting migration from local JSON to Supabase...\n');

  const tables = ['students', 'groups', 'awards', 'badge_defs', 'teachers'];

  for (const table of tables) {
    await migrateTable(table);
  }

  console.log('\n🎉 Migration completed!');
  console.log('💡 Remember to:');
  console.log('   1. Update src/supabase.js to use real Supabase');
  console.log('   2. Set REACT_APP_SUPABASE_ANON_KEY in .env');
  console.log('   3. Deploy to hosting service');
}

main().catch(console.error);