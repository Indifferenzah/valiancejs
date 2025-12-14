const { HfInference } = require('@huggingface/inference');

const hf = new HfInference(process.env.HF_API_KEY);

async function analyzeText(text, model) {
    const result = await hf.textClassification({
        model,
        inputs: text
    });

    return result;
}

module.exports = { analyzeText };
