const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const STATIC_DIR = path.join(__dirname, 'public');
const MAX_ATTEMPTS = 3;

// 读取灯谜题库
const quizzes = JSON.parse(fs.readFileSync(path.join(__dirname, 'quizzes.json'), 'utf-8'));
const sessions = {}; // { userId: { attempts, answered, currentQuestionId } }

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

  const isCorrect = quiz.answer.trim().toLowerCase() === answer.trim().toLowerCase();

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
