const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function storeAfstemning(afstemning, embedding) {
  console.log("Storing afstemning:", afstemning);
  // Check if id exists before proceeding
  if (!afstemning.id) {
    throw new Error("Missing id in afstemning");
  }
  const {
    id,
    typeid,
    titel,
    titelkort,
    resume,
    sagstrinid,
    sagid,
    opdateringsdato,
  } = afstemning;

  // Ensure embedding is not null and is an array
  if (!embedding || !Array.isArray(embedding)) {
    console.error("Invalid embedding:", embedding);
    return;
  }

  // Insert into Supabase
  const { data, error } = await supabase
    .from("afstemninger_bert") //change according to the relevant table
    .insert({
      titel,
      embedding, // Assuming the embedding is properly handled here
      id,
      type_id: typeid,
      titelkort,
      resume,
      sagstrin_id: sagstrinid,
      sag_id: sagid,
      dato: opdateringsdato,
    })
    .single(); // Use .single() to ensure we're inserting one row

  if (error) {
    console.error("Error inserting:", error);
  } else {
    const insertedId = data ? data.id : "unknown";
    console.log(
      `Successfully inserted afstemning with auto-generated ID ${insertedId} and original afstemning ID ${afstemning.id}`
    );
  }
}

module.exports = { storeAfstemning };
