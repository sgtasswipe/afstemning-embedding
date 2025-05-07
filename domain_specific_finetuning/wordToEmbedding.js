require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Embed function via API
async function generateEmbedding(text) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await axios.post("http://localhost:5000/embed", {
      texts: [text],
    });
    return response.data.embeddings[0];
  } catch (error) {
    console.error(
      "Error generating embedding:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function updateEmbeddings() {
  const { data, error } = await supabase
    .from("golden_standard")
    .select("id, subject");

  if (error) {
    console.error("Error fetching rows:", error);
    return;
  }

  for (const row of data) {
    const embedding = await generateEmbedding(row.subject);

    if (embedding) {
      const { error: updateError } = await supabase
        .from("golden_standard")
        .update({ subject_vector: embedding })
        .eq("id", row.id);

      if (updateError) {
        console.error(
          `Error updating embedding for id ${row.id}:`,
          updateError
        );
      } else {
        console.log(`✅ Updated embedding for id ${row.id}`);
      }
    } else {
      console.log(`❌ Skipped embedding for id ${row.id}`);
    }
  }
}

updateEmbeddings();
