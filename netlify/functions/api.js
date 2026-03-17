// Netlify Function - 云端排行榜 API
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: 'https://brief-goblin-75250.upstash.io',
  token: 'gQAAAAAAASXyAAIncDEzZGQ1MTUyNzA4NjM0YzlmOWUwMjdiMzA1YTgxZDFjN3AxNzUyNTA'
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '{}' };
  }

  const path = event.path.replace('/.netlify/functions/api', '').replace('/api', '');

  try {
    if (event.httpMethod === 'GET' && path === '/leaderboard') {
      const scores = await redis.zrange('snake_leaderboard', 0, 49, { 
        withScores: true,
        rev: true 
      });
      
      const formatted = [];
      for (let i = 0; i < scores.length; i += 2) {
        const data = JSON.parse(scores[i]);
        formatted.push({
          name: data.name,
          score: parseInt(scores[i + 1]),
          time: data.time,
          date: data.date
        });
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: formatted })
      };
    }

    if (event.httpMethod === 'POST' && path === '/submit') {
      const { name, score } = JSON.parse(event.body);
      
      if (!name || !score || name.length > 10) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid data' })
        };
      }

      const data = {
        name: name,
        time: Date.now(),
        date: new Date().toLocaleString('zh-CN')
      };

      await redis.zadd('snake_leaderboard', { 
        score: score, 
        member: JSON.stringify(data) 
      });

      await redis.zremrangebyrank('snake_leaderboard', 0, -101);

      const rank = await redis.zrevrank('snake_leaderboard', JSON.stringify(data));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          rank: rank !== null ? rank + 1 : null 
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'Not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
