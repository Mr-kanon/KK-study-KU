const fs = require('fs');
const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// === データ保存・ロード用設定 ===
const THREADS_FILE = 'threads.json';
let threads = [];

// 起動時にthreadsをロード
if (fs.existsSync(THREADS_FILE)) {
  const data = fs.readFileSync(THREADS_FILE, 'utf8');
  threads = JSON.parse(data);
  console.log('スレッドデータを読み込みました！');
} else {
  console.log('スレッドデータファイルが存在しません。新しく作成します。');
}

// 保存用関数
function saveThreadsToFile() {
  fs.writeFileSync(THREADS_FILE, JSON.stringify(threads, null, 2));
}

// === ワンタイムパスワード用設定 ===
let otpStore = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'huayinxiaoshan56@gmail.com',
    pass: 'aiyr qwpo hehf trjr'
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/send-otp', (req, res) => {
  const { email } = req.body;

  if (!(email.endsWith('@kochi-u.ac.jp') || email.endsWith('@s.kochi-u.ac.jp'))) {
    return res.status(400).send('大学メールアドレスのみ利用可能です');
  }

  const otp = generateOTP();
  otpStore[email] = otp;

  const mailOptions = {
    from: 'あなたのGmailアドレス@gmail.com',
    to: email,
    subject: '【高知大学】乗合掲示板 登録用認証コード',
    text: `以下の認証コードを入力してください： ${otp}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      return res.status(500).send('メール送信失敗');
    } else {
      console.log('Email sent: ' + info.response);
      res.send('認証コードを送信しました');
    }
  });
});

app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email];
    res.send('認証成功');
  } else {
    res.status(400).send('認証失敗');
  }
});

// === 掲示板用API ===

// スレッド投稿
app.post('/post-thread', (req, res) => {
  let { title, content, handleName } = req.body;

  if (!handleName || handleName.trim() === "") {
    handleName = "名無しさん";
  }

  if (title && content) {
    const userId = Math.random().toString(36).substring(2, 10);
    const createdAt = new Date();
    const id = Math.random().toString(36).substring(2, 10);

    threads.push({ id, title, content, handleName, userId, createdAt });
    saveThreadsToFile(); // 投稿成功したら保存！

    res.send('スレッド投稿成功');
  } else {
    res.status(400).send('タイトルと本文を入力してください');
  }
});

// スレッド一覧取得
app.get('/get-threads', (req, res) => {
  res.json(threads);
});

// 個別スレッド取得
app.get('/get-thread/:id', (req, res) => {
  const thread = threads.find(t => t.id === req.params.id);
  if (thread) {
    res.json(thread);
  } else {
    res.status(404).send('スレッドが見つかりません');
  }
});

// 返信投稿
app.post('/post-reply', (req, res) => {
  const { threadId, replyContent, replyHandleName } = req.body;

  const thread = threads.find(t => t.id === threadId);
  if (thread) {
    if (!thread.replies) {
      thread.replies = [];
    }
    if (!thread.replyUserIds) {
      thread.replyUserIds = {};
    }

    let replyUserId = thread.replyUserIds[replyHandleName];
    if (!replyUserId) {
      replyUserId = Math.random().toString(36).substring(2, 10);
      thread.replyUserIds[replyHandleName] = replyUserId;
    }

    thread.replies.push({
      replyContent,
      replyHandleName: replyHandleName || "名無しさん",
      replyUserId,
      replyCreatedAt: new Date()
    });

    saveThreadsToFile(); // 返信成功したら保存！

    res.send('返信投稿成功');
  } else {
    res.status(404).send('スレッドが見つかりません');
  }
});

// ----------------------------
// 古いスレッドを自動削除する機能
// ----------------------------

// 例えば30日（約1か月）以内だけ残したいならここ！
const daysLimit = 30; // ← ここだけ変えれば自由に日数設定できる

function cleanOldThreads() {
  const now = new Date();
  const limitHours = daysLimit * 24; // 30日 × 24時間 = 720時間

  threads = threads.filter(thread => {
    const createdAt = new Date(thread.createdAt);
    const diffHours = (now - createdAt) / (1000 * 60 * 60);
    return diffHours <= limitHours;
  });

  saveThreadsToFile(); // 削除後に保存！
  console.log(`古いスレッドを自動削除しました！（${daysLimit}日超え分）`);
}


// cleanOldThreadsをサーバー起動前に呼ぶ！！
cleanOldThreads(); 

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
