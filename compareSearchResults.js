const {
  generateEmbedding: generateEmbeddingBefore,
} = require("./embedders/danishBertEmbedder");
const {
  generateEmbedding: generateEmbeddingAfter,
} = require("./embedders/fineTunedBertEmbedder");
const { createClient } = require("@supabase/supabase-js");
const xlsx = require("xlsx");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchVector(queryText) {
  console.log(`Embedding query: "${queryText}"`);

  const queryEmbeddingBefore = await generateEmbeddingBefore(queryText);
  const queryEmbeddingAfter = await generateEmbeddingAfter(queryText);

  const { data: dataBefore, error: errorBefore } = await supabase.rpc(
    "search_results_before",
    {
      query_embedding: queryEmbeddingBefore,
      match_threshold: 0.25,
      match_count: 10,
    }
  );

  if (errorBefore) {
    console.error(
      "Supabase RPC Error for 'search_results_before':",
      errorBefore
    );
    return;
  }

  const { data: dataAfter, error: errorAfter } = await supabase.rpc(
    "search_results_after",
    {
      query_embedding: queryEmbeddingAfter,
      match_threshold: 0.25,
      match_count: 10,
    }
  );

  if (errorAfter) {
    console.error("Supabase RPC Error for 'search_results_after':", errorAfter);
    return;
  }

  // Combine and format results for Excel
  exportResultsToExcel(queryText, dataBefore, dataAfter);
}

// 📄 Function to export to Excel
function exportResultsToExcel(query, dataBefore, dataAfter) {
  const rows = [];

  for (let i = 0; i < Math.max(dataBefore.length, dataAfter.length); i++) {
    const before = dataBefore[i];
    const after = dataAfter[i];

    rows.push({
      Rank: i + 1,
      Before_afstemning_id: before?.afstemning_id || "",
      Before_titel: before?.titel || "",
      Before_similarity: before?.similarity?.toFixed(4) || "",
      After_afstemning_id: after?.afstemning_id || "",
      After_titel: after?.titel || "",
      After_similarity: after?.similarity?.toFixed(4) || "",
    });
  }

  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Comparison");

  const filename = `comparison_results_${query.replace(/\s+/g, "_")}.xlsx`;
  xlsx.writeFile(workbook, filename);

  console.log(`✅ Results exported to ${filename}`);
}

// Test search
searchVector("rumvæsener");
