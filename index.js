const { storeAfstemning } = require('./storeToSupabase');
//const { generateEmbedding } = require('./embed');  // Assuming this file handles the OpenAI embedding
const { fetchAfstemninger } = require('./fetchAfstemninger');  // Include the fetch function
const { generateEmbedding } = require('./embedWithFlask');  // Uses your Flask server

async function main() {
  const afstemninger = await fetchAfstemninger();

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
    const titelkort = afstemning.Sagstrin.Sag.titelkort;
    const resume = afstemning.Sagstrin.Sag.resume;

    // Log if id is missing
    if (!id) {
      console.error('Missing id for afstemning:', afstemning);
      continue;  // Skip this entry if the id is missing
    }

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
    console.log('Storing afstemning:', { id, titel, titelkort, resume, embedding });

    // Store the afstemning in Supabase
    await storeAfstemning({ id, titel, titelkort, resume }, embedding);
  }
}

main().catch(console.error);
