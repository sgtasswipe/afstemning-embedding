const axios = require('axios');

/**
 * Generate an embedding using your Flask-based DanishBERT API
 * @param {string} text - The input text to embed
 * @returns {Promise<number[]>} - The resulting embedding vector
 */
async function generateEmbedding(text) {
  try {
    const response = await axios.post('http://localhost:5000/embed', {
      texts: [text]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const embeddings = response.data.embeddings;
    if (!embeddings || embeddings.length === 0) {
      throw new Error('No embeddings returned');
    }

    return embeddings[0]; // Return the first embedding (since we sent one text)
  } catch (error) {
    console.error('Error generating embedding with Flask API:', error.message);
    return null;
  }
}

module.exports = { generateEmbedding };
