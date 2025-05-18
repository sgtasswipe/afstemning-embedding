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

const MATCH_COUNT = 10;

function computeMetrics(ranks) {
  if (ranks.length === 0) {
    return {
      MRR: 0,
      meanRank: null,
      hitsAt1: 0,
      hitsAt3: 0,
      hitsAt5: 0,
      hitsAt10: 0,
      count: 0,
    };
  }

  const mrr = ranks.reduce((sum, rank) => sum + 1 / rank, 0) / ranks.length;
  const meanRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
  return {
    MRR: mrr,
    meanRank,
    hitsAt1: ranks.filter(r => r <= 1).length,
    hitsAt3: ranks.filter(r => r <= 3).length,
    hitsAt5: ranks.filter(r => r <= 5).length,
    hitsAt10: ranks.filter(r => r <= 10).length,
    count: ranks.length,
  };
}

// Compute % improvement compared to previous model (for metrics where higher = better)
// For Mean Rank, lower is better so invert the formula
function computeImprovements(data, isLowerBetter = false) {
  // data is array of objects { Subject, model1: value, model2: value, ... }
  // returns an object with model names as keys and improvement value strings (percentage)
  const improvements = {};
  for (let i = 1; i < MODELS.length; i++) {
    const prevModel = MODELS[i - 1].name;
    const currModel = MODELS[i].name;

    // Extract values for current and previous models, ignoring N/A or ERR
    const prevVals = data
      .map(row => parseFloat(row[prevModel]))
      .filter(v => !isNaN(v) && v !== 0);
    const currVals = data
      .map(row => parseFloat(row[currModel]))
      .filter(v => !isNaN(v) && v !== 0);

    if (prevVals.length === 0 || currVals.length === 0) {
      improvements[currModel] = "N/A";
      continue;
    }

    const prevAvg = prevVals.reduce((a, b) => a + b, 0) / prevVals.length;
    const currAvg = currVals.reduce((a, b) => a + b, 0) / currVals.length;

    // For MRR/Hits (higher better): (curr - prev)/prev * 100
    // For Mean Rank (lower better): (prev - curr)/prev * 100
    let imp;
    if (isLowerBetter) {
      imp = ((prevAvg - currAvg) / prevAvg) * 100;
    } else {
      imp = ((currAvg - prevAvg) / prevAvg) * 100;
    }

    improvements[currModel] = imp.toFixed(2) + "%";
  }
  return improvements;
}

async function runEvaluation() {
  const mrrResults = [];
  const meanRankResults = [];
  const hitsAt1Results = [];
  const hitsAt3Results = [];
  const hitsAt5Results = [];
  const hitsAt10Results = [];

  for (const subject of SUBJECTS) {
    const mrrRow = { Subject: subject };
    const meanRankRow = { Subject: subject };
    const hitsAt1Row = { Subject: subject };
    const hitsAt3Row = { Subject: subject };
    const hitsAt5Row = { Subject: subject };
    const hitsAt10Row = { Subject: subject };

    for (const model of MODELS) {
      console.log(`🔍 [${model.name}] Evaluating: "${subject}"`);

      const queryEmbedding = await generateEmbedding(subject, model.port);

      const { data, error } = await supabase.rpc("search_results_dynamic", {
        query_embedding: queryEmbedding,
        match_threshold: 0.25,
        match_count: MATCH_COUNT,
        vector_choice: model.vector_choice,
      });

      if (error) {
        console.error(`❌ Error for "${subject}" in ${model.name}:`, error);
        mrrRow[model.name] = "ERR";
        meanRankRow[model.name] = "ERR";
        hitsAt1Row[model.name] = "ERR";
        hitsAt3Row[model.name] = "ERR";
        hitsAt5Row[model.name] = "ERR";
        hitsAt10Row[model.name] = "ERR";
        continue;
      }

      const ranks = [];
      data.forEach((row, idx) => {
        if (row.subject?.toLowerCase() === subject.toLowerCase()) {
          ranks.push(idx + 1);
        }
      });

      const metrics = computeMetrics(ranks);

      mrrRow[model.name] = metrics.MRR.toFixed(4);
      meanRankRow[model.name] = metrics.meanRank !== null ? metrics.meanRank.toFixed(2) : "N/A";
      hitsAt1Row[model.name] = metrics.hitsAt1;
      hitsAt3Row[model.name] = metrics.hitsAt3;
      hitsAt5Row[model.name] = metrics.hitsAt5;
      hitsAt10Row[model.name] = metrics.hitsAt10;
    }

    mrrResults.push(mrrRow);
    meanRankResults.push(meanRankRow);
    hitsAt1Results.push(hitsAt1Row);
    hitsAt3Results.push(hitsAt3Row);
    hitsAt5Results.push(hitsAt5Row);
    hitsAt10Results.push(hitsAt10Row);
  }

  addSummaryRows(mrrResults, meanRankResults, hitsAt1Results, hitsAt3Results, hitsAt5Results, hitsAt10Results);
  addImprovementRows(mrrResults, meanRankResults, hitsAt1Results, hitsAt3Results, hitsAt5Results, hitsAt10Results);
  exportResultsToExcel(mrrResults, meanRankResults, hitsAt1Results, hitsAt3Results, hitsAt5Results, hitsAt10Results);
}

// Adds summary rows (averages or sums)
function addSummaryRows(mrrData, meanRankData, hits1, hits3, hits5, hits10) {
  const parseNum = val => {
    if (typeof val === "string") {
      const f = parseFloat(val);
      return isNaN(f) ? 0 : f;
    }
    if (typeof val === "number") return val;
    return 0;
  };

  const mrrSummary = { Subject: "AVERAGE" };
  const meanRankSummary = { Subject: "AVERAGE" };
  const hits1Summary = { Subject: "SUM" };
  const hits3Summary = { Subject: "SUM" };
  const hits5Summary = { Subject: "SUM" };
  const hits10Summary = { Subject: "SUM" };

  for (const model of MODELS) {
    // MRR average
    const mrrVals = mrrData.map(r => parseNum(r[model.name])).filter(v => v !== 0);
    mrrSummary[model.name] = mrrVals.length ? (mrrVals.reduce((a, b) => a + b, 0) / mrrVals.length).toFixed(4) : "N/A";

    // Mean Rank average
    const meanRankVals = meanRankData.map(r => parseNum(r[model.name])).filter(v => v !== 0);
    meanRankSummary[model.name] = meanRankVals.length ? (meanRankVals.reduce((a, b) => a + b, 0) / meanRankVals.length).toFixed(2) : "N/A";

    // Hits sums
    hits1Summary[model.name] = hits1.reduce((sum, r) => sum + (parseNum(r[model.name]) || 0), 0);
    hits3Summary[model.name] = hits3.reduce((sum, r) => sum + (parseNum(r[model.name]) || 0), 0);
    hits5Summary[model.name] = hits5.reduce((sum, r) => sum + (parseNum(r[model.name]) || 0), 0);
    hits10Summary[model.name] = hits10.reduce((sum, r) => sum + (parseNum(r[model.name]) || 0), 0);
}

mrrData.push(mrrSummary);
meanRankData.push(meanRankSummary);
hits1.push(hits1Summary);
hits3.push(hits3Summary);
hits5.push(hits5Summary);
hits10.push(hits10Summary);
}

// Adds improvement % rows comparing each model to previous model
function addImprovementRows(mrrData, meanRankData, hits1, hits3, hits5, hits10) {
// Compute improvements for each metric
const mrrImprovements = computeImprovements(mrrData, false);
const meanRankImprovements = computeImprovements(meanRankData, true);
const hits1Improvements = computeImprovements(hits1, false);
const hits3Improvements = computeImprovements(hits3, false);
const hits5Improvements = computeImprovements(hits5, false);
const hits10Improvements = computeImprovements(hits10, false);

// Prepare improvement rows
const mrrImpRow = { Subject: "IMPROVEMENT %" };
const meanRankImpRow = { Subject: "IMPROVEMENT %" };
const hits1ImpRow = { Subject: "IMPROVEMENT %" };
const hits3ImpRow = { Subject: "IMPROVEMENT %" };
const hits5ImpRow = { Subject: "IMPROVEMENT %" };
const hits10ImpRow = { Subject: "IMPROVEMENT %" };

// Fill improvements, first model has no previous to compare => blank or N/A
for (let i = 0; i < MODELS.length; i++) {
const modelName = MODELS[i].name;
if (i === 0) {
mrrImpRow[modelName] = "N/A";
meanRankImpRow[modelName] = "N/A";
hits1ImpRow[modelName] = "N/A";
hits3ImpRow[modelName] = "N/A";
hits5ImpRow[modelName] = "N/A";
hits10ImpRow[modelName] = "N/A";
} else {
mrrImpRow[modelName] = mrrImprovements[modelName] || "N/A";
meanRankImpRow[modelName] = meanRankImprovements[modelName] || "N/A";
hits1ImpRow[modelName] = hits1Improvements[modelName] || "N/A";
hits3ImpRow[modelName] = hits3Improvements[modelName] || "N/A";
hits5ImpRow[modelName] = hits5Improvements[modelName] || "N/A";
hits10ImpRow[modelName] = hits10Improvements[modelName] || "N/A";
}
}

mrrData.push(mrrImpRow);
meanRankData.push(meanRankImpRow);
hits1.push(hits1ImpRow);
hits3.push(hits3ImpRow);
hits5.push(hits5ImpRow);
hits10.push(hits10ImpRow);
}

function exportResultsToExcel(mrrData, meanRankData, hits1, hits3, hits5, hits10) {
const workbook = xlsx.utils.book_new();

const mrrSheet = xlsx.utils.json_to_sheet(mrrData);
xlsx.utils.book_append_sheet(workbook, mrrSheet, "MRR");

const meanRankSheet = xlsx.utils.json_to_sheet(meanRankData);
xlsx.utils.book_append_sheet(workbook, meanRankSheet, "Mean Rank");

const hitsAt1Sheet = xlsx.utils.json_to_sheet(hits1);
xlsx.utils.book_append_sheet(workbook, hitsAt1Sheet, "Hits@1");

const hitsAt3Sheet = xlsx.utils.json_to_sheet(hits3);
xlsx.utils.book_append_sheet(workbook, hitsAt3Sheet, "Hits@3");

const hitsAt5Sheet = xlsx.utils.json_to_sheet(hits5);
xlsx.utils.book_append_sheet(workbook, hitsAt5Sheet, "Hits@5");

const hitsAt10Sheet = xlsx.utils.json_to_sheet(hits10);
xlsx.utils.book_append_sheet(workbook, hitsAt10Sheet, "Hits@10");

const filename = "model_ranking_metrics.xlsx";
xlsx.writeFile(workbook, filename);

console.log(`✅ Results exported to ${filename}`);
}

runEvaluation();
