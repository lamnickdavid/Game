const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const STATIC_DIR = path.join(__dirname, 'public');
const MAX_ATTEMPTS = 3;

// 读取灯谜题库
const quizzes = JSON.parse(fs.readFileSync(path.join(__dirname, 'quizzes.json'), 'utf-8'));
const sessions = {}; // { userId: { attempts, answered, currentQuestionId } }

// 同义词与模糊映射，便于宽松判定
const synonymMap = {
  '西红柿': '番茄',
  '番茄': '番茄',
  'tomato': '番茄',
  '蕃茄': '番茄',
  '马铃薯': '土豆',
  '洋芋': '土豆',
  'potato': '土豆',
  '土豆': '土豆',
  '蒜头': '大蒜',
  '大蒜': '大蒜',
  'garlic': '大蒜',
  '生姜': '姜',
  '老姜': '姜',
  '姜': '姜',
  'ginger': '姜',
  'turmeric': '姜黄',
  '姜黄': '姜黄',
  '孜然粉': '孜然',
  'cumin': '孜然',
  '孜然': '孜然',
  'lemongrass': '柠檬草',
  '香茅': '柠檬草',
  '香茅草': '柠檬草',
  '柠檬草': '柠檬草',
  '桂皮': '肉桂',
  '肉桂': '肉桂',
  'cinnamon': '肉桂',
  '百里香': '百里香',
  'thyme': '百里香',
  '胡椒': '胡椒',
  '黑胡椒': '胡椒',
  '白胡椒': '胡椒',
  'pepper': '胡椒',
  '辣椒': '辣椒',
  '尖椒': '辣椒',
  '辣子': '辣椒',
  'chili': '辣椒',
  '鸡蛋': '鸡蛋',
  '鸡子': '鸡蛋',
  '鸡卵': '鸡蛋',
  'egg': '鸡蛋',
  '黄瓜': '黄瓜',
  '青瓜': '黄瓜',
  '胡瓜': '黄瓜',
  'cucumber': '黄瓜',
  '菠萝': '菠萝',
  '凤梨': '菠萝',
  'pineapple': '菠萝',
  '猕猴桃': '猕猴桃',
  '奇异果': '猕猴桃',
  'kiwi': '猕猴桃',
  '西瓜': '西瓜',
  'watermelon': '西瓜',
  '苹果': '苹果',
  'apple': '苹果',
  '甘蔗': '甘蔗',
  '蔗': '甘蔗',
  'sugarcane': '甘蔗',
  '虾': '虾',
  '虾仁': '虾',
  'shrimp': '虾',
  '汉堡': '汉堡',
  '汉堡包': '汉堡',
  'burger': '汉堡',
  '油条': '油条',
  '炸油条': '油条',
  '爆米花': '爆米花',
  '爆谷': '爆米花',
  'popcorn': '爆米花',
  '棉花糖': '棉花糖',
  'marshmallow': '棉花糖',
  '洋葱': '洋葱',
  '葱头': '洋葱',
  'onion': '洋葱',
  '桔子': '橘子',
  '橘子': '橘子',
  'mandarin': '橘子',
  '橄榄': '橄榄',
  'olive': '橄榄',
  '菊花': '菊花',
  'chrysanthemum': '菊花',
  '茉莉': '茉莉花',
  '茉莉花': '茉莉花',
  'jasmine': '茉莉花',
  '茶': '茶叶',
  '茶叶': '茶叶',
  'tea': '茶叶',
  '凉拌番茄': '凉拌西红柿',
  '凉拌西红柿': '凉拌西红柿',
  '凉拌蕃茄': '凉拌西红柿',
  '带鱼': '带鱼',
  'vanilla': '香草荚',
  '香草豆荚': '香草荚',
  '香草荚': '香草荚'
};

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·.\-_/—,，。！？!？:：;；'"“”‘’()（）【】[\]]/g, '');
}

function canonical(text) {
  const norm = normalize(text || '');
  return synonymMap[norm] || norm;
}

function parseAcceptableAnswers(raw) {
  if (!raw) return [];
  // 支持用 / | 、 ， 等分隔多答案
  return raw
    .split(/[\\/|,，、；;]+/)
    .map(str => str.trim())
    .filter(Boolean);
}

function isAnswerCorrect(quizAnswer, userAnswer) {
  const candidates = parseAcceptableAnswers(quizAnswer);
  if (candidates.length === 0) return false;
  const userNorm = canonical(userAnswer);
  return candidates.some(ans => canonical(ans) === userNorm);
}

app.use(express.static(STATIC_DIR));
app.use(express.json());

function pickQuestion(session) {
  let available = quizzes.filter(q => !session.answered.includes(q.id));
  if (available.length === 0) available = quizzes;

  const quiz = available[Math.floor(Math.random() * available.length)];
  session.currentQuestionId = quiz.id;
  return quiz;
}

// 获取新题目
app.post('/api/start', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).send('缺少 user_id');

  if (!sessions[user_id]) {
    sessions[user_id] = { attempts: 0, answered: [], currentQuestionId: null };
  }

  const session = sessions[user_id];
  if (session.attempts >= MAX_ATTEMPTS) {
    return res.status(400).json({
      message: "今日答题机会已用完，请明天再来",
      attempts_left: 0
    });
  }

  const quiz = pickQuestion(session);

  res.json({
    question: quiz.question,
    question_id: quiz.id,
    attempts_left: MAX_ATTEMPTS - session.attempts
  });
});

// 提交答案
app.post('/api/submit', (req, res) => {
  const { user_id, question_id, answer } = req.body;
  const session = sessions[user_id] || null;
  const quiz = quizzes.find(q => q.id === question_id) || null;

  if (!quiz || !session || session.currentQuestionId !== question_id) {
    return res.status(400).json({ message: "无效请求" });
  }

  const isCorrect = isAnswerCorrect(quiz.answer, answer);

  if (isCorrect) {
    session.answered.push(question_id);
    session.currentQuestionId = null;
    return res.json({
      result: "correct",
      explanation: quiz.explanation,
      message: "恭喜你获得抽奖机会一次！"
    });
  }

  session.attempts += 1;
  const attemptsLeft = MAX_ATTEMPTS - session.attempts;

  if (attemptsLeft <= 0) {
    session.currentQuestionId = null;
    return res.json({
      result: "failed",
      explanation: quiz.explanation,
      correct_answer: quiz.answer,
      attempts_left: 0,
      message: "很遗憾，您的答题机会已用完，请明天再来。"
    });
  }

  res.json({
    result: "wrong",
    explanation: quiz.explanation,
    correct_answer: quiz.answer,
    attempts_left: attemptsLeft,
    message: `答案不正确，还剩 ${attemptsLeft} 次机会。`
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`服务运行在端口 ${PORT}`));
