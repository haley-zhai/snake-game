// Netlify Function - 云端排行榜 API
const { Redis } = require('@upstash/redis');

let redis = null;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

exports.handler = async (event, context) => {
  // CORS 头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '{}' };
  }

  const path = event.path.replace('/.netlify/functions/api', '').replace('/api', '');

  try {
    // 获取排行榜
    if (event.httpMethod === 'GET' && path === '/leaderboard') {
      const scores = await getRedis().zrange('snake_leaderboard', 0, 49, { 
        withScores: true,
        rev: true 
      });
      
      // 转换为对象数组
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

    // 提交分数
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

      // 使用 Redis Sorted Set，按分数排序
      await getRedis().zadd('snake_leaderboard', { 
        score: score, 
        member: JSON.stringify(data) 
      });

      // 只保留前100名
      await getRedis().zremrangebyrank('snake_leaderboard', 0, -101);

      // 获取排名
      const rank = await getRedis().zrevrank('snake_leaderboard', JSON.stringify(data));

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