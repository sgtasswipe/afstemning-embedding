const { generateEmbedding } = require("./embedders/danishBertEmbedder");
const { generateAdaEmbedding } = require("./embedders/ada2002Embedder");
const { createClient } = require("@supabase/supabase-js");
const xlsx = require("xlsx");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Define ports and matching vector_choice values
const MODELS = [
  { name: "Standard BERT", port: 5000, vector_choice: "untrained" },
  { name: "ada-2002", vector_choice: "ada" },
  { name: "Domain Fine-Tuned", port: 5001, vector_choice: "ds" },
  { name: "Fine-Tuned", port: 5002, vector_choice: "v1" },
  { name: "Fine-Tuned 2", port: 5003, vector_choice: "v2" },
];

// Helper function to run search with dynamic parameters
async function runSearch(queryText, model) {
  console.log(`Embedding query with ${model.name} (port ${model.port})`);

  let queryEmbedding;
  if (model.name === "ada-2002") {
    queryEmbedding = await generateAdaEmbedding(queryText);
  } else {
    queryEmbedding = await generateEmbedding(queryText, model.port);
  }

  const functionName =
    model.name === "ada-2002"
      ? "search_results_dynamic_ada"
      : "search_results_dynamic";

  const { data, error } = await supabase.rpc(functionName, {
    query_embedding: queryEmbedding,
    match_threshold: 0.25,
    match_count: 10,
    vector_choice: model.vector_choice,
  });

  if (error) {
    console.error(`Supabase RPC Error for ${model.name}:`, error);
    return null;
  }

  return { name: model.name, data };
}

// Main function to run searches on all models and export combined Excel
async function searchVector(queryText) {
  const results = [];

  for (const model of MODELS) {
    const result = await runSearch(queryText, model);
    if (result) results.push(result);
  }

  exportResultsToExcel(queryText, results);
}

// Export function to handle multiple result sets dynamically
function exportResultsToExcel(query, results) {
  const rows = [];
  const maxLength = Math.max(...results.map((r) => r.data.length));

  for (let i = 0; i < maxLength; i++) {
    const row = { Rank: i + 1 };
    results.forEach(({ name, data }, idx) => {
      const item = data[i];
      row[`${name}_afstemning_id`] = item?.afstemning_id || "";
      row[`${name}_titel`] = item?.titel || "";
      row[`${name}_similarity`] = item?.similarity?.toFixed(4) || "";
    });
    rows.push(row);
  }

  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Comparison");

  const filename = `comparison_results_${query.replace(/\s+/g, "_")}.xlsx`;
  xlsx.writeFile(workbook, filename);

  console.log(`✅ Results exported to ${filename}`);
}

// Run your test search
searchVector("Abort");
