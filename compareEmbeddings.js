const { generateEmbedding } = require("./embedders/danishBertEmbedder");
const { generateNewEmbedding } = require("./embedders/fineTunedBertEmbedder");
const { createClient } = require("@supabase/supabase-js");
const cosineSimilarity = require("compute-cosine-similarity");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const afstemningId = 5165;
const queryText = "abort";

// Fetch afstemning embedding by ID
async function fetchEmbeddingById(id) {
  const { data, error } = await supabase
    .from("afstemninger_bert")
    .select("id, embedding, titel, titelkort, resume")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching embedding:", error);
    return null;
  }

  let embeddingArray;
  try {
    embeddingArray = JSON.parse(data.embedding);
  } catch (parseError) {
    console.error("Error parsing embedding data:", parseError);
    return null;
  }

  return { ...data, embedding: embeddingArray };
}

// Generate new afstemning embedding using fine-tuned model
async function generateNewAfstemningEmbedding(afstemning) {
  const { titel, titelkort, resume } = afstemning;
  const combinedText = `
    Titel: ${titel || ""}
    Titelkort: ${titelkort || ""}
    Resume: ${resume || ""}
  `;
  const newEmbedding = await generateNewEmbedding(combinedText);
  return newEmbedding;
}

// Compare query embedding to both old and new afstemning embeddings
async function searchVector(queryText, afstemningId) {
  console.log(`Embedding query: "${queryText}"`);

  // Embed query with both models
  const queryEmbedding = await generateEmbedding(queryText);
  const newQueryEmbedding = await generateNewEmbedding(queryText);

  // Fetch afstemning from DB
  const afstemning = await fetchEmbeddingById(afstemningId);
  if (!afstemning) {
    console.error("Afstemning not found.");
    return;
  }

  // Generate new embedding for afstemning
  const newAfstemningEmbedding = await generateNewAfstemningEmbedding(
    afstemning
  );

  // Compare embeddings
  const beforeSimilarity = cosineSimilarity(
    queryEmbedding,
    afstemning.embedding
  );
  const afterSimilarity = cosineSimilarity(
    newQueryEmbedding,
    newAfstemningEmbedding
  );

  // Output results
  console.log(`\nAfstemning ID: ${afstemning.id}`);
  console.log(
    "Cosine similarity before (old model):",
    beforeSimilarity.toFixed(4)
  );
  console.log(
    "Cosine similarity after (fine-tuned model):",
    afterSimilarity.toFixed(4)
  );
}

// Run test search
searchVector(queryText, afstemningId);
