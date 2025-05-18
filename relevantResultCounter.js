const { generateEmbedding } = require("./embedders/danishBertEmbedder");
const { createClient } = require("@supabase/supabase-js");
const xlsx = require("xlsx");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODELS = [
  { name: "Standard BERT", port: 5000, vector_choice: "after" },
  { name: "Domain Fine-Tuned", port: 5001, vector_choice: "after_2" },
  { name: "Fine-Tuned", port: 5002, vector_choice: "after_3" },
  { name: "Fine-Tuned 2", port: 5003, vector_choice: "after_4" },
];

const SUBJECTS = [
  "Abort", "Antisemitisme", "Islamofobi", "Grønland", "Atomkraft",
  "Sundhed", "Skat", "Menneskerettigheder", "Omskæring", "Uddannelse",
  "Asylansøgere", "Putin", "Udenrigspolitik", "Landbrug", "Dyrevelfærd",
  "Kønsidentitet", "EU", "Pandemi", "Ytringsfrihed"
];

async function runEvaluation() {
  const results = [];

  for (const subject of SUBJECTS) {
    const resultRow = { Subject: subject };

    for (const model of MODELS) {
      console.log(`🔍 [${model.name}] Evaluating: "${subject}"`);

      const queryEmbedding = await generateEmbedding(subject, model.port);

      const { data, error } = await supabase.rpc("search_results_dynamic", {
        query_embedding: queryEmbedding,
        match_threshold: 0.25,
        match_count: 10,
        vector_choice: model.vector_choice,
      });

      if (error) {
        console.error(`❌ Error for "${subject}" in ${model.name}:`, error);
        resultRow[model.name] = "ERR";
        continue;
      }

      const matchCount = data.filter(
        (row) => row.subject?.toLowerCase() === subject.toLowerCase()
      ).length;

      resultRow[model.name] = matchCount; // flattened as a number
    }

    results.push(resultRow);
  }

  // Add totals row
  const totalsRow = { Subject: "TOTAL" };
  for (const model of MODELS) {
    const sum = results.reduce((acc, row) => {
      const val = row[model.name];
      return acc + (typeof val === "number" ? val : 0);
    }, 0);
    totalsRow[model.name] = sum;
  }
  results.push(totalsRow);

  exportResultsToExcel(results);
}

function exportResultsToExcel(data) {
  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Evaluation");

  const filename = `subject_evaluation_results.xlsx`;
  xlsx.writeFile(workbook, filename);

  console.log(`✅ Results exported to ${filename}`);
}

runEvaluation();
