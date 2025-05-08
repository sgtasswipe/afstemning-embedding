
const { generateNewEmbedding } = require("./fineTunedBertEmbedder");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

fetchAfstemninger()
async function fetchAfstemninger() {
    const { data, error } = await supabase
  .from("golden_standard")
  .select(`
    afstemning_id,
    subject,
    afstemninger_bert (
      titel,
      titelkort,
      resume
    )
  `);

if (error) {
  console.error("Error fetching data:", error);
  return;
  
}
for (const row of data) {
    const afstemning = row.afstemninger_bert;
    const subject = row.subject;
  
    if (afstemning) {
      const afstemningEmbedding = await generateNewAfstemningEmbedding(afstemning);
      console.log("Afstemning embedding:", afstemningEmbedding);
    }
  
    if (subject) {
      const subjectEmbedding = await generateNewSubjectEmbedding(subject);
      console.log("Subject embedding:", subjectEmbedding);
    }
    saveToSupbase(subjectEmbedding,afstemningEmbedding)
  }
  

}
 async function saveToSupbase(subjectEmbedding,afstemningEmbedding){
   const {data,error}=await supabase.from("golden_standard").insert({subject_vector_after: subjectEmbedding ,afstemning_vector_after:afstemningEmbedding})

}

async function generateNewSubjectEmbedding(subject) {
    return await generateNewEmbedding(subject);
}
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