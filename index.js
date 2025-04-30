const { storeAfstemning } = require('./storeToSupabase');
const { generateEmbedding } = require('./embedWithFlask');  // Assuming this file handles the OpenAI embedding
const { fetchAllAfstemninger } = require('./fetchAfstemninger');  // Include the fetch function

async function main() {
  const afstemninger = await fetchAllAfstemninger();

  // Loop through the fetched afstemninger
  for (const afstemning of afstemninger) {
    // Check if afstemning is valid and has the expected structure
    if (!afstemning || !afstemning.Sagstrin || !afstemning.Sagstrin.Sag || !afstemning.Sagstrin.Sag.titel) {
      console.warn('Skipping invalid afstemning entry:', afstemning);
      continue; // Skip invalid entries
    }

    // Logging the afstemning to inspect its structure
    console.log('Processing afstemning:', afstemning);

    const titel = afstemning.Sagstrin.Sag.titel;
    const id = afstemning.id;  // This is the original ID from the afstemning object
    const typeid = afstemning.typeid;
    const titelkort = afstemning.Sagstrin.Sag.titelkort;
    const resume = afstemning.Sagstrin.Sag.resume;
    const sagstrinid = afstemning.Sagstrin.id;  
    const sagid = afstemning.Sagstrin.Sag.id;  
    const dato = afstemning.Sagstrin.Sag.opdateringsdato

    let embedding = [];

    // Set a flag for whether or not to generate embeddings with OpenAI
    const openaiEnabled = true;  // Change this flag to disable OpenAI API call

    // Generate embedding only if OpenAI is enabled
    if (openaiEnabled) {
        const combinedText = `
  Titel: ${titel || ''}
  Titelkort: ${titelkort || ''}
  Resume: ${resume || ''}
`;
      embedding = await generateEmbedding(combinedText); // instead of embedding only titel, embeds a combined text of all relevant info. 
    } else {
      console.log('OpenAI API call is disabled, using empty embedding');
      // Provide a fallback (empty vector) if embedding is not generated
      embedding = new Array(1536).fill(0);  //  1536-dimension embedding
    }

    // Ensure embedding is an array and not null or undefined
    if (!embedding || !Array.isArray(embedding)) {
      console.error('Embedding is not valid:', embedding);
      continue;  // Skip if embedding is invalid
    }

    // Logging before calling storeAfstemning to track the data being passed
    console.log('Storing afstemning:', { id, typeid, titelkort, resume, embedding });

    // Store the afstemning in Supabase
    await storeAfstemning({ id, typeid, titel, titelkort, resume, sagstrinid, sagid, dato }, embedding);
  }
}

main().catch(console.error);
