import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // For browser testing
    return res.status(200).json({ message: 'Pearch search is ready!' });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    // Print the full incoming POST body
    console.log('--- Incoming Vapi Tool Call Payload ---');
    console.dir(body, { depth: null });
    console.log('======================================');

    let query, toolCallId;

    // Try to extract from body.message.toolCalls[0]
    if (
      body.message &&
      body.message.toolCalls &&
      Array.isArray(body.message.toolCalls) &&
      body.message.toolCalls.length > 0
    ) {
      const toolCall = body.message.toolCalls[0];
      toolCallId = toolCall.id;
      // arguments may be an object or a stringified JSON
      if (typeof toolCall.function.arguments === 'string') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          query = args.query;
        } catch (e) {
          console.log('Error parsing tool call arguments:', toolCall.function.arguments, e);
        }
      } else if (typeof toolCall.function.arguments === 'object') {
        query = toolCall.function.arguments.query;
      }
      console.log('>>> Parsed Query:', query);
    } else {
      // fallback for direct POSTs or other formats
      query = body.query;
      toolCallId = body.toolCallId;
      console.log('>>> Fallback Query:', query);
    }

    if (!query || !toolCallId) {
      console.log('Missing query or toolCallId:', { query, toolCallId });
      return res.status(400).json({ error: "Missing 'query' or 'toolCallId' in payload" });
    }

    const url = 'https://api.pearch.ai/v1/search';
    const headers = { Authorization: `Bearer ${process.env.NEXT_PUBLIC_PEARCH_API_KEY}` };
    const params = { query, limit: 2, type: 'fast' };

    // Log the outgoing query
    console.log('Sending pearch request -', query);

    try {
      const response = await axios.get(url, { headers, params });
      // Log the raw JSON response
      console.log('Pearch API response:', response.data);
      return res.status(200).json({
        results: [
          {
            toolCallId,
            result: response.data
          }
        ]
      });
    } catch (error) {
      console.log('Pearch API error:', error.response?.data || error.message);
      return res.status(500).json({
        results: [
          {
            toolCallId,
            result: { error: error.response?.data || error.message }
          }
        ]
      });
    }
  }

  // Method not allowed
  res.status(405).json({ error: 'Method not allowed' });
} 