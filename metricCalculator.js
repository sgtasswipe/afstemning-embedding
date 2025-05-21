const { generateEmbedding } = require("./embedders/danishBertEmbedder");
const { generateAdaEmbedding } = require("./embedders/ada2002Embedder");
const { createClient } = require("@supabase/supabase-js");
const xlsx = require("xlsx");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODELS = [
  { name: "Standard BERT", port: 5000, vector_choice: "untrained" },
  { name: "ada-2002", vector_choice: "ada" },
  { name: "Domain Fine-Tuned", port: 5001, vector_choice: "ds" },
  { name: "Fine-Tuned", port: 5002, vector_choice: "v1" },
  { name: "Fine-Tuned 2", port: 5003, vector_choice: "v2" },
];

const SUBJECTS = [
  "Abort",
  "Antisemitisme",
  "Islamofobi",
  "Grønland",
  "Atomkraft",
  "Sundhed",
  "Skat",
  "Menneskerettigheder",
  "Omskæring",
  "Uddannelse",
  "Asylansøgere",
  "Putin",
  "Udenrigspolitik",
  "Landbrug",
  "Dyrevelfærd",
  "Kønsidentitet",
  "EU",
  "Pandemi",
  "Ytringsfrihed",
];

const MATCH_COUNT = 100;

function computeMRR(rank) {
  if (rank === null || rank === undefined) {
    return 0;
  }
  return 1 / rank;
}

function computeMeanRank(ranks) {
  if (!ranks.length) {
    return null;
  }
  const sum = ranks.reduce((a, b) => a + b, 0);
  return sum / ranks.length;
}

function computeImprovements(data, isLowerBetter = false) {
  const improvements = {};

  const baseModel = MODELS[0].name;
  const baseVals = data
    .map((row) => parseFloat(row[baseModel]))
    .filter((v) => !isNaN(v) && v !== 0);

  if (baseVals.length === 0) {
    MODELS.slice(1).forEach((model) => {
      improvements[model.name] = "N/A";
    });
    return improvements;
  }

  const baseAvg = baseVals.reduce((a, b) => a + b, 0) / baseVals.length;

  for (let i = 1; i < MODELS.length; i++) {
    const currModel = MODELS[i].name;

    const currVals = data
      .map((row) => parseFloat(row[currModel]))
      .filter((v) => !isNaN(v) && v !== 0);

    if (currVals.length === 0) {
      improvements[currModel] = "N/A";
      continue;
    }

    const currAvg = currVals.reduce((a, b) => a + b, 0) / currVals.length;

    let imp;
    if (isLowerBetter) {
      imp = ((baseAvg - currAvg) / baseAvg) * 100;
    } else {
      imp = ((currAvg - baseAvg) / baseAvg) * 100;
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
  const hitsat20Results = [];

  for (const subject of SUBJECTS) {
    const mrrRow = { Subject: subject };
    const meanRankRow = { Subject: subject };
    const hitsAt1Row = { Subject: subject };
    const hitsAt3Row = { Subject: subject };
    const hitsAt5Row = { Subject: subject };
    const hitsAt10Row = { Subject: subject };
    const hitsAt20Row = { Subject: subject };

    for (const model of MODELS) {
      console.log(`🔍 [${model.name}] Evaluating: "${subject}"`);

      let queryEmbedding;
      if (model.name === "ada-2002") {
        queryEmbedding = await generateAdaEmbedding(subject);
      } else {
        queryEmbedding = await generateEmbedding(subject, model.port);
      }

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
        hitsAt20Row[model.name] = "ERR";
        continue;
      }

      const ranks = [];
      data.forEach((row, idx) => {
        if (row.subject?.toLowerCase() === subject.toLowerCase()) {
          ranks.push(idx + 1);
        }
      });

      const firstRank = ranks.length ? ranks[0] : null;
      const mrr = computeMRR(firstRank);
      const meanRank = computeMeanRank(ranks);

      mrrRow[model.name] = mrr.toFixed(4);
      meanRankRow[model.name] = meanRank !== null ? meanRank.toFixed(2) : "N/A";
      hitsAt1Row[model.name] = ranks.filter((r) => r <= 1).length;
      hitsAt3Row[model.name] = ranks.filter((r) => r <= 3).length;
      hitsAt5Row[model.name] = ranks.filter((r) => r <= 5).length;
      hitsAt10Row[model.name] = ranks.filter((r) => r <= 10).length;
      hitsAt20Row[model.name] = ranks.filter((r) => r <= 20).length;
    }

    mrrResults.push(mrrRow);
    meanRankResults.push(meanRankRow);
    hitsAt1Results.push(hitsAt1Row);
    hitsAt3Results.push(hitsAt3Row);
    hitsAt5Results.push(hitsAt5Row);
    hitsAt10Results.push(hitsAt10Row);
    hitsat20Results.push(hitsAt20Row);
  }

  addSummaryRows(
    mrrResults,
    meanRankResults,
    hitsAt1Results,
    hitsAt3Results,
    hitsAt5Results,
    hitsAt10Results,
    hitsat20Results
  );
  addImprovementRows(
    mrrResults,
    meanRankResults,
    hitsAt1Results,
    hitsAt3Results,
    hitsAt5Results,
    hitsAt10Results,
    hitsat20Results
  );
  exportResultsToExcel(
    mrrResults,
    meanRankResults,
    hitsAt1Results,
    hitsAt3Results,
    hitsAt5Results,
    hitsAt10Results,
    hitsat20Results
  );
}

// Adds summary rows (averages / sums)
function addSummaryRows(
  mrrData,
  meanRankData,
  hits1,
  hits3,
  hits5,
  hits10,
  hits20
) {
  const parseNum = (val) => {
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
  const hits20Summary = { Subject: "SUM" };

  for (const model of MODELS) {
    const mrrVals = mrrData
      .map((r) => parseNum(r[model.name]))
      .filter((v) => v !== 0);
    mrrSummary[model.name] = mrrVals.length
      ? (mrrVals.reduce((a, b) => a + b, 0) / mrrVals.length).toFixed(4)
      : "N/A";

    const meanRankVals = meanRankData
      .map((r) => parseNum(r[model.name]))
      .filter((v) => v !== 0);
    meanRankSummary[model.name] = meanRankVals.length
      ? (meanRankVals.reduce((a, b) => a + b, 0) / meanRankVals.length).toFixed(
          2
        )
      : "N/A";

    hits1Summary[model.name] = hits1.reduce(
      (sum, r) => sum + (parseNum(r[model.name]) || 0),
      0
    );
    hits3Summary[model.name] = hits3.reduce(
      (sum, r) => sum + (parseNum(r[model.name]) || 0),
      0
    );
    hits5Summary[model.name] = hits5.reduce(
      (sum, r) => sum + (parseNum(r[model.name]) || 0),
      0
    );
    hits10Summary[model.name] = hits10.reduce(
      (sum, r) => sum + (parseNum(r[model.name]) || 0),
      0
    );
    hits20Summary[model.name] = hits20.reduce(
      (sum, r) => sum + (parseNum(r[model.name]) || 0),
      0
    );
  }

  mrrData.push(mrrSummary);
  meanRankData.push(meanRankSummary);
  hits1.push(hits1Summary);
  hits3.push(hits3Summary);
  hits5.push(hits5Summary);
  hits10.push(hits10Summary);
  hits20.push(hits20Summary);
}

function addImprovementRows(
  mrrData,
  meanRankData,
  hits1,
  hits3,
  hits5,
  hits10,
  hits20
) {
  const mrrImprovements = computeImprovements(mrrData, false);
  const meanRankImprovements = computeImprovements(meanRankData, true);
  const hits1Improvements = computeImprovements(hits1, false);
  const hits3Improvements = computeImprovements(hits3, false);
  const hits5Improvements = computeImprovements(hits5, false);
  const hits10Improvements = computeImprovements(hits10, false);
  const hits20Improvements = computeImprovements(hits20, false);

  const mrrImpRow = { Subject: "IMPROVEMENT %" };
  const meanRankImpRow = { Subject: "IMPROVEMENT %" };
  const hits1ImpRow = { Subject: "IMPROVEMENT %" };
  const hits3ImpRow = { Subject: "IMPROVEMENT %" };
  const hits5ImpRow = { Subject: "IMPROVEMENT %" };
  const hits10ImpRow = { Subject: "IMPROVEMENT %" };
  const hits20ImpRow = { Subject: "IMPROVEMENT %" };

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i].name;
    if (i === 0) {
      mrrImpRow[modelName] = "N/A";
      meanRankImpRow[modelName] = "N/A";
      hits1ImpRow[modelName] = "N/A";
      hits3ImpRow[modelName] = "N/A";
      hits5ImpRow[modelName] = "N/A";
      hits10ImpRow[modelName] = "N/A";
      hits20ImpRow[modelName] = "N/A";
    } else {
      mrrImpRow[modelName] = mrrImprovements[modelName] || "N/A";
      meanRankImpRow[modelName] = meanRankImprovements[modelName] || "N/A";
      hits1ImpRow[modelName] = hits1Improvements[modelName] || "N/A";
      hits3ImpRow[modelName] = hits3Improvements[modelName] || "N/A";
      hits5ImpRow[modelName] = hits5Improvements[modelName] || "N/A";
      hits10ImpRow[modelName] = hits10Improvements[modelName] || "N/A";
      hits20ImpRow[modelName] = hits20Improvements[modelName] || "N/A";
    }
  }

  mrrData.push(mrrImpRow);
  meanRankData.push(meanRankImpRow);
  hits1.push(hits1ImpRow);
  hits3.push(hits3ImpRow);
  hits5.push(hits5ImpRow);
  hits10.push(hits10ImpRow);
  hits20.push(hits20ImpRow);
}

function exportResultsToExcel(
  mrrData,
  meanRankData,
  hits1,
  hits3,
  hits5,
  hits10,
  hits20
) {
  const workbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(mrrData),
    "MRR"
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(meanRankData),
    "Mean Rank"
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(hits1),
    "Hits@1"
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(hits3),
    "Hits@3"
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(hits5),
    "Hits@5"
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(hits10),
    "Hits@10"
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(hits20),
    "Hits@20"
  );

  const filename = "model_ranking_metrics.xlsx";
  xlsx.writeFile(workbook, filename);

  console.log(`✅ Results exported to ${filename}`);
}

runEvaluation();
