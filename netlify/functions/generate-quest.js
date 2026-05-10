// netlify/functions/generate-quest.js
// Genera quest giornaliere via Gemini API - server-side

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured' }) }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { level = 1, language = 'en', count = 3, mode = 'jolly' } = body

  // Prompt diverso per quest giornaliere vs jolly singola
  const prompt = mode === 'daily'
    ? `You are the System from an RPG game. Generate exactly ${count} daily quests for a level ${level} player. Language for quest names: ${language}.

Return ONLY a valid JSON array, no extra text, no markdown:
[
  {"name":"Quest name max 20 chars","attribute":"str|agi|vit|int|end","amount":10,"unit":"reps|min|km|pages|h|count","type":"fitness|mental"},
  ...
]

Rules:
- Mix of fitness quests (running, push-ups, plank, yoga, stairs, squats, stretching) and mental quests (meditation, reading, study, journaling, no-screen time)
- Attribute must match: str=strength exercises, agi=cardio/speed, vit=wellness/yoga/meditation, int=reading/study, end=endurance/plank
- Vary difficulty based on level ${level}: higher level = higher amounts
- Be creative with quest names — avoid always using the same ones
- No dangerous activities, no screens for fitness quests
- Quest names in ${language}`
    : `You are the System from an RPG game. Generate 1 unique creative jolly quest for a level ${level} player. Language: ${language}.

Return ONLY valid JSON, no extra text:
{"name":"Quest name max 18 chars","attribute":"str|agi|vit|int|end","amount":10,"unit":"reps|min|km|pages|h|count"}

Be creative and unusual but achievable. No screens. No dangerous activities.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.1, maxOutputTokens: 500 },
        }),
      }
    )

    if (!response.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Gemini API error' }) }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Empty response' }) }

    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return { statusCode: 200, headers, body: JSON.stringify(mode === 'daily' ? { quests: parsed } : parsed) }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to generate quest' }) }
  }
}
