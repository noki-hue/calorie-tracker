export default async function handler(req, res) {
    // 1. Add CORS headers so your browser allows the request
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. Handle the browser's preflight check
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST allowed' });
    }

    const { image } = req.body;
    if (!image) {
        return res.status(400).json({ error: 'No image provided' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this food image. Return ONLY a JSON object, no other text, in this format:
{"food": "name of food", "calories": estimated_calories_number}
If there are multiple foods, sum up the calories and list the main food name.
If you cannot identify food, return {"food": "unknown", "calories": 0}.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: base64Data
                                }
                            }
                        ]
                    }]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(500).json({ error: 'Gemini API error', details: data });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { food: 'unknown', calories: 0 };

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: 'Something went wrong', details: error.message });
    }
}
