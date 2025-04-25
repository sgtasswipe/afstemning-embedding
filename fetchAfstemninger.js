const axios = require('axios');

const BASE_URL = 'https://oda.ft.dk/api/Afstemning?$filter=typeid eq 1 or typeid eq 3';

async function fetchAfstemninger(page = 0, pageSize = 100) {
  const url = `${BASE_URL}&$orderby=opdateringsdato desc&$skip=${page * pageSize}&$top=${pageSize}&$expand=Sagstrin,Sagstrin/Sag`;

  const res = await axios.get(url);
  return res.data.value;
}

async function fetchAllAfstemninger(skipLimit = 7000, pageSize = 100) {
  const all = [];

  for (let skip = 0; skip <= skipLimit; skip += pageSize) {
    const url = `${BASE_URL}&$orderby=opdateringsdato desc&$skip=${skip}&$top=${pageSize}&$expand=Sagstrin,Sagstrin/Sag`;
    console.log(`Fetching batch with skip=${skip}`);

    try {
      const res = await axios.get(url);
      const batch = res.data.value || [];
      if (batch.length === 0) {
        console.log('No more data. Ending early.');
        break;
      }

      all.push(...batch);

      // Optional: delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      console.error(`Failed at skip=${skip}:`, error.message);
      break;
    }
  }

  console.log(`Fetched ${all.length} afstemninger in total.`);
  return all;
}

module.exports = { fetchAllAfstemninger };
