const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { AppDataSource } = require('../utils/dataSource');
const User = require('../entities/User');
const { sendSuccess, sendFailed } = require('../utils/responseFormat');
const { generateToken, verifyToken } = require('../utils/auth');
const { isValidString, isValidEmail, isValidPassword } = require('../utils/validations');

const saltRounds = 10;

// 會員註冊的 API
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!isValidString(name, 50) || !isValidEmail(email)) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    if (!isValidPassword(password)) {
      // 如果密碼不夠強，就直接退件回 400
      return sendFailed(res, 400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字');
    }

    const userRepo = AppDataSource.getRepository(User);

    const existingUser = await userRepo.findOne({ where: { email } });
    if (existingUser) {
      return sendFailed(res, 409, 'Email 已被註冊');
    }

    const hashPassword = await bcrypt.hash(password, saltRounds);
    const newUser = userRepo.create({
      name,
      email,
      password: hashPassword,
      role: 'USER',
    });
    await userRepo.save(newUser);

    return sendSuccess(res, 201, {
      user: {
        id: newUser.id,
        name: newUser.name,
      }
    });
  } catch (error) {
    next(error);
  }
});

// 處理會員登入
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!isValidEmail(email) || typeof password !== 'string' || password.trim().length === 0) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { email } });
    if (!user) {
      return sendFailed(res, 400, '使用者不存在或密碼輸入錯誤');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendFailed(res, 400, '使用者不存在或密碼輸入錯誤');
    }

    const token = generateToken({
      id: user.id,
      role: user.role,
    });

    return sendSuccess(res, 200, {
      token,
      user: {
        name: user.name,
      }
    });
  } catch (error) {
    next(error);
  }
});

// 抓取會員自己的個人資料 (要帶 token)
router.get('/profile', verifyToken, async (req, res, next) => {
  try {
    // 因為前面有掛 verifyToken middleware，所以這裡可以直接從 req.user 拿到登入者的資訊
    return sendSuccess(res, 200, {
      user: {
        name: req.user.name,
        email: req.user.email,
      }
    });
  } catch (error) {
    next(error);
  }
});

// 更新個人資料
router.put('/profile', verifyToken, async (req, res, next) => {
  try {
    const { name } = req.body;
    
    // 如果連名字都沒填，或者格式不對，就當作欄位驗證失敗退回去
    if (name !== undefined && !isValidString(name, 50)) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    if (!name) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }

    const userRepo = AppDataSource.getRepository(User);
    
    // 把新資料蓋過去
    req.user.name = name;
    await userRepo.save(req.user);

    return sendSuccess(res, 200);
  } catch (error) {
    next(error);
  }
});

// 讓會員改密碼
router.put('/password', verifyToken, async (req, res, next) => {
  try {
    const { password, new_password, confirm_new_password } = req.body;
    
    if (!password || !new_password || !confirm_new_password) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }

    if (!isValidPassword(new_password)) {
      return sendFailed(res, 400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字');
    }
    
    if (new_password !== confirm_new_password) {
      return sendFailed(res, 400, '確認密碼與新密碼不符');
    }
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { id: req.user.id } });
    if (!user) {
      return sendFailed(res, 404, '使用者不存在');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendFailed(res, 400, '密碼錯誤');
    }

    const hashPassword = await bcrypt.hash(new_password, saltRounds);
    user.password = hashPassword;
    await userRepo.save(user);

    return sendSuccess(res, 200, {
      message: '密碼修改成功'
    });
  } catch (error) {
    next(error);
  }
});

const CreditPurchase = require('../entities/CreditPurchase');

// 查一下這隻帳號買了哪些方案
router.get('/credit-package', verifyToken, async (req, res, next) => {
  try {
    const purchaseRepo = AppDataSource.getRepository(CreditPurchase);
    
    const purchases = await purchaseRepo.find({
      where: { user: { id: req.user.id } },
      relations: { creditPackage: true },
      order: { created_at: 'DESC' },
    });
    
    const data = purchases.map(p => ({
      name: p.creditPackage ? p.creditPackage.name : '已刪除方案',
      purchased_credits: p.purchased_credits,
      price_paid: p.price_paid,
      created_at: p.created_at,
    }));
    
    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

const CourseBooking = require('../entities/CourseBooking');

// 秀出本人的課表 (順便算一下還剩幾堂課可以上)
router.get('/courses', verifyToken, async (req, res, next) => {
  try {
    const purchaseRepo = AppDataSource.getRepository(CreditPurchase);
    const bookingRepo = AppDataSource.getRepository(CourseBooking);
    
    // 第一步：先把所有買過的方案堂數加總起來
    const purchases = await purchaseRepo.find({ where: { user: { id: req.user.id } } });
    const totalCredits = purchases.reduce((sum, p) => sum + p.purchased_credits, 0);
    
    // 第二步：把報名紀錄全部撈出來 (包括後來取消的也算)
    const { IsNull } = require('typeorm');
    const bookings = await bookingRepo.find({
      where: { user: { id: req.user.id } },
      relations: { course: { user: true } }, // 這裡的 course.user 其實就是開課的教練
      order: { created_at: 'DESC' },
    });
    
    // 第三步：算一下到底還有幾堂課可以用 (總買的 - 還沒取消的報名數)
    const activeBookingCount = bookings.filter(b => !b.cancelled_at).length;
    const credit_remain = totalCredits - activeBookingCount;
    
    const course_booking = bookings.map(b => ({
      course_id: b.course ? b.course.id : null,
      name: b.course ? b.course.name : null,
      coach_name: b.course && b.course.user ? b.course.user.name : null,
      cancelled_at: b.cancelled_at,
    }));
    
    return sendSuccess(res, 200, {
      credit_remain,
      course_booking,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
