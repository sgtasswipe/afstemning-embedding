const { generateEmbedding } = require('./danishBertEmbedder');  //change according to embedding model used
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use anon if you're testing
);

async function searchVector(queryText) {
  console.log(`Embedding query: "${queryText}"`);

  const queryEmbedding = await generateEmbedding(queryText);

  const { data, error } = await supabase.rpc('match_afstemninger_bert', { //remove _bert if referencing the original table
    query_embedding: queryEmbedding,
    match_threshold: 0.25,
    match_count: 5
  });

  if (error) {
    console.error('Supabase RPC Error:', error);
    return;
  }

  console.log('\nTop Matches:');
  data.forEach((row, i) => {
    console.log(`\n#${i + 1}`);
    console.log('ID:', row.id);
    console.log('Type_ID', row.type_id)
    console.log('Titel:', row.titel);
    console.log('Titelkort:', row.titelkort);
    console.log('Score:', row.similarity.toFixed(4));
    console.log('Resume:', row.resume?.slice(0, 200), '...');
  });
}

// test search
searchVector('atomkraft');
