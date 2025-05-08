const { generateEmbedding } = require("./danishBertEmbedder");
const { createClient } = require("@supabase/supabase-js");
const cosineSimilarity = require("compute-cosine-similarity"); // ✅ new import
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const afstemningId = 10181;

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
    embeddingArray = JSON.parse(data.embedding); // Parse stringified JSON array
  } catch (parseError) {
    console.error("Error parsing embedding data:", parseError);
    return null;
  }

  console.log("Fetched afstemning embedding:", embeddingArray);
  console.log("Type of embedding:", Array.isArray(embeddingArray)); // Should print true
  return { id: data.id, embedding: embeddingArray }; // ✅ return as object with id
}

// Compare search query embedding to afstemning embedding
async function searchVector(queryText, afstemningId) {
  console.log(`Embedding query: "${queryText}"`);

  // 1️⃣ Embed the search query
  const queryEmbedding = await generateEmbedding(queryText);
  console.log("Embedding dimensions:", queryEmbedding.length);

  const newQueryEmbedding = await generateNewAfstemningEmbedding(afstemningId);
  console.log("Embedding dimensions:", queryEmbedding.length);

  // 2️⃣ Fetch afstemning embedding
  const afstemning = await fetchEmbeddingById(afstemningId);
  if (!afstemning) {
    console.error("Afstemning not found.");
    return;
  }

  // Generate embedding with new model
  async function generateNewAfstemningEmbedding(afstemningId) {
    const afstemning = await fetchAfstemningById(afstemningId);
    if (!afstemning) return null;

    const { titel, titelkort, resume } = afstemning;
    const combinedText = `
      Titel: ${titel || ""}
      Titelkort: ${titelkort || ""}
      Resume: ${resume || ""}
    `;

    const newEmbedding = await generateEmbedding(combinedText);
    return { embedding: newEmbedding };
  }

  // 3️⃣ Compare embeddings
  const beforeSimilarity = cosineSimilarity(
    queryEmbedding,
    afstemning.embedding
  );
  const afterSimilarity = cosineSimilarity(newQueryEmbedding, newEmbedding);

  // 4️⃣ Output result

  console.log("Cosine similarity before:", beforeSimilarity.toFixed(4));
  console.log("Cosine similarity after:", afterSimilarity.toFixed(4));
}

// 🔍 Test search
searchVector("abort", afstemningId);
