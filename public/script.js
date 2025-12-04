let currentQuestionId = null;
let userId = 'u_' + Date.now() + Math.random().toString(36).substr(2, 5);

window.onload = () => loadNewQuestion();

function loadNewQuestion() {
  fetch('/api/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  })
  .then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "加载失败，请重试");
    return data;
  })
  .then(data => {
    document.getElementById("question").textContent = data.question;
    currentQuestionId = data.question_id;
    document.getElementById("answer-input").value = "";
    document.getElementById("quiz-area").style.display = "block";
    hideFeedback();
  })
  .catch(err => alert(err.message || "加载失败，请重试"));
}

function submitAnswer() {
  const answer = document.getElementById("answer-input").value.trim();
  if (!currentQuestionId) return alert("请先获取题目");
  if (!answer) return alert("请输入答案");

  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      question_id: currentQuestionId,
      answer: answer
    })
  })
  .then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "提交失败，请重试");
    return data;
  })
  .then(data => {
    showFeedback(data);
  })
  .catch(err => alert(err.message || "提交失败，请重试"));
}

function showFeedback(data) {
  const feedback = document.getElementById("feedback");
  const exp = document.getElementById("explanation");
  const msg = document.getElementById("result-message");
  const nextBtn = document.getElementById("next-btn");

  const explanation = data.explanation || "无解析";
  const correct = data.correct_answer ? `<div><strong>正确答案：</strong>${data.correct_answer}</div>` : "";
  exp.innerHTML = correct
    ? `${correct}<div><strong>解析：</strong>${explanation}</div>`
    : `<div><strong>解析：</strong>${explanation}</div>`;
  msg.innerHTML = `<strong>${data.message}</strong>`;
  feedback.style.display = "block";

  if (data.result === "correct" || data.result === "failed") {
    currentQuestionId = null;
  }

  nextBtn.style.display = "none";
  if (data.result === "wrong" && data.attempts_left > 0) {
    nextBtn.style.display = "inline";
    nextBtn.textContent = "再试一次";
  }
}

function hideFeedback() {
  document.getElementById("feedback").style.display = "none";
}
