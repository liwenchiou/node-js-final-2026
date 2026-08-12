const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { AppDataSource } = require('./utils/dataSource');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const skillRouter = require('./routes/skill');
const creditPackageRouter = require('./routes/creditPackage');
const userRouter = require('./routes/user');
const adminRouter = require('./routes/admin');
const coachPublicRouter = require('./routes/coachPublic');
const coursePublicRouter = require('./routes/coursePublic');

// 啟動資料庫連線 (設定 synchronize: true 就會自動建表，滿方便的)
AppDataSource.initialize()
  .then(() => {
    console.log('TypeORM Data Source has been initialized!');
  })
  .catch((err) => {
    console.error('Error during Data Source initialization:', err);
  });

// 把各個功能的路由掛載上來
app.use('/api/coaches/skill', skillRouter); // 踩坑紀錄：具體路徑要放前面，不然會被 /api/coaches 攔截掉
app.use('/api/coaches', coachPublicRouter);
app.use('/api/credit-package', creditPackageRouter);
app.use('/api/users', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/courses', coursePublicRouter);

// M0: 寫個 healthcheck 讓測試腳本知道伺服器活著沒
app.get('/healthcheck', (req, res, next) => {
  try {
    if (AppDataSource.isInitialized) {
      res.status(200).send('OK');
    } else {
      res.status(503).send('Database connection failed');
    }
  } catch (error) {
    next(error);
  }
});

const { sendError } = require('./utils/responseFormat');

// 捕捉漏網之魚的錯誤，統一回報 500 免得伺服器整個掛掉
app.use((err, req, res, next) => {
  sendError(res, err);
});

module.exports = app;
