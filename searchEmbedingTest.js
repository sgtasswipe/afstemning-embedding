const fs = require("fs");
const { generateEmbedding } = require("./embedders/danishBertEmbedder");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchVector(queryText) {
  const filename = `search_log_${queryText}.txt`; // using queryText directly

  function writeLog(content) {
    fs.appendFileSync(filename, content + "\n");
  }

  writeLog(`\n---\nEmbedding query: "${queryText}"`);

  const queryEmbedding = await generateEmbedding(queryText, 5003);
  writeLog(`Embedding dimensions: ${queryEmbedding.length}`);

  const { data, error } = await supabase.rpc("search_results_dynamic", {
    query_embedding: queryEmbedding,
    match_threshold: 0.25,
    match_count: 100,
    vector_choice: "after_4",
  });

  if (error) {
    writeLog(`Supabase RPC Error: ${error.message}`);
    return;
  }

  writeLog("Raw results:\n" + JSON.stringify(data, null, 2));

  writeLog("\nTop Matches:");
  data.forEach((row, i) => {
    writeLog(`\n#${i + 1}`);
    writeLog(`ID: ${row.id}`);
    writeLog(`Type_ID: ${row.type_id}`);
    writeLog(`Titel: ${row.titel || "[Missing]"}`);
    writeLog(`Titelkort: ${row.titelkort || "[Missing]"}`);
    writeLog(`Resume: ${(row.resume?.slice(0, 200) || "[Missing]") + "..."}`);
    writeLog(`Score: ${row.similarity.toFixed(4)}`);
  });
}

// test search
searchVector("abort");
