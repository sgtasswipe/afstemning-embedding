const axios = require('axios');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateEmbedding(text, port) {
  try {
    await delay(1000);
    const response = await axios.post(`http://localhost:${port}/embed`, {
      texts: [text],
    });

    return response.data.embeddings[0];
  } catch (error) {
    console.error('Error fetching embedding from Danish BERT:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { generateEmbedding };
