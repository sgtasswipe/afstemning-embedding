const { generateEmbedding } = require('./embed');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

async function searchVector(queryText) {
  console.log(`Embedding query: "${queryText}"`);

  const queryEmbedding = await generateEmbedding(queryText);

  const { data, error } = await supabase.rpc('match_afstemninger', {
    query_embedding: queryEmbedding,
    match_threshold: 0.80,
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
    console.log('Titel:', row.titel);
    console.log('Titelkort:', row.titelkort);
    console.log('Score:', row.similarity.toFixed(4));
    console.log('Resume:', row.resume?.slice(0, 200), '...');
  });
}

// test search
searchVector('abort');
