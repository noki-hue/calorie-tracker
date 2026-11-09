// A simple in-memory counter for the current server instance
let requestCount = 0;
let lastResetDate = new Date().toISOString().split('T')[0];

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

    // Check if it's a new day (UTC based, close enough for tracking)
    const today = new Date().toISOString().split('T')[0];
    if (today !== lastResetDate) {
        requestCount = 0;
        lastResetDate = today;
    }

    const { image, text } = req.body;
    if (!image && !text) {
        return res.status(400).json({ error: 'No image or text provided' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    // Prepare the prompt and content parts
    let prompt = "";
    let parts = [];

    if (image) {
        prompt = `Analyze this food image. Return ONLY a JSON object, no other text, in this format:
{"food": "name of food", "calories": estimated_calories_number}
If there are multiple foods, sum up the calories and list the main food name.
If you cannot identify food, return {"food": "unknown", "calories": 0}.`;
        
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        parts = [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
        ];
    } else {
        prompt = `Estimate the calories for this food description: "${text}". Return ONLY a JSON object, no other text, in this format:
{"food": "name of food", "calories": estimated_calories_number}
If you cannot estimate, return {"food": "unknown", "calories": 0}.`;
        
        parts = [{ text: prompt }];
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: parts }]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            // Still count it as an attempt, but return the error
            requestCount++;
            return res.status(500).json({ error: 'Gemini API error', details: data, usedToday: requestCount });
        }

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { food: 'unknown', calories: 0 };

        // Increment count on successful call
        requestCount++;

        // Send back the result AND the usage count
        res.status(200).json({ 
            ...result, 
            usedToday: requestCount 
        });
        
    } catch (error) {
        requestCount++;
        res.status(500).json({ error: 'Something went wrong', details: error.message, usedToday: requestCount });
    }
}
