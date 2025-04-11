const axios = require('axios');

const BASE_URL = 'https://oda.ft.dk/api/Afstemning';

async function fetchAfstemninger(page = 0, pageSize = 100) {
  const url = `${BASE_URL}?$orderby=opdateringsdato desc&$skip=${page * pageSize}&$top=${pageSize}&$expand=Sagstrin,Sagstrin/Sag`;

  const res = await axios.get(url);
  return res.data.value;
}

module.exports = { fetchAfstemninger };
