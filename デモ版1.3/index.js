const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// ワンタイムパスワード保存用（簡易版）
let otpStore = {};

// Outlookメール送信用設定
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false, // 必ずfalse（STARTTLS）
    auth: {
        user: 'kanon-kenkyu01@outlook.jp', // ←あなたのOutlookアカウント
        pass: 'lovqjmwieuzvvzgr'      // ←アプリパスワード推奨
    }
});

// ワンタイムパスワード生成関数
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6桁の数字
}

// 認証コード送信用API
app.post('/send-otp', (req, res) => {
    const { email } = req.body;

    // 大学メールアドレスのチェック
    if (!(email.endsWith('@kochi-u.ac.jp') || email.endsWith('@s.kochi-u.ac.jp'))) {
        return res.status(400).send('大学メールアドレスのみ利用可能です');
    }

    const otp = generateOTP();
    otpStore[email] = otp;

    const mailOptions = {
        from: 'あなたのOutlookアドレス@example.com',
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

// 認証コード確認用API
app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (otpStore[email] && otpStore[email] === otp) {
        delete otpStore[email]; // 認証成功したら削除
        res.send('認証成功');
    } else {
        res.status(400).send('認証失敗');
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
