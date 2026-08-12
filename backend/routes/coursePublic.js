const express = require('express');
const router = express.Router();
const { AppDataSource } = require('../utils/dataSource');
const Course = require('../entities/Course');
const { sendSuccess, sendFailed } = require('../utils/responseFormat');
const { LessThanOrEqual, MoreThan } = require('typeorm');

// 抓出所有正在進行中的課程 (免登入也能看)
router.get('/', async (req, res, next) => {
  try {
    const courseRepo = AppDataSource.getRepository(Course);
    const now = new Date();
    
    // 判斷邏輯：現在時間要介於開始跟結束之間 (大於等於 start_at 且小於 end_at)
    const courses = await courseRepo.find({
      where: {
        start_at: LessThanOrEqual(now),
        end_at: MoreThan(now),
      },
      relations: { user: true, skill: true },
      order: { start_at: 'ASC' },
    });
    
    const data = courses.map(course => ({
      id: course.id,
      name: course.name,
      coach_name: course.user ? course.user.name : null,
      skill_name: course.skill ? course.skill.name : null,
      max_participants: course.max_participants,
      start_at: course.start_at,
      end_at: course.end_at,
    }));
    
    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

const { verifyToken } = require('../utils/auth');
const CourseBooking = require('../entities/CourseBooking');
const CreditPurchase = require('../entities/CreditPurchase');
const { isValidUUID } = require('../utils/validations');

// 讓會員報名課程 (記得掛上 verifyToken)
router.post('/:courseId', verifyToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    
    // 先檢查一下帶來的 courseId 格式對不對
    if (!isValidUUID(courseId)) {
      return sendFailed(res, 400, '參數格式錯誤');
    }
    
    const courseRepo = AppDataSource.getRepository(Course);
    const bookingRepo = AppDataSource.getRepository(CourseBooking);
    const purchaseRepo = AppDataSource.getRepository(CreditPurchase);
    
    // 第一關：檢查這堂課到底存不存在
    const course = await courseRepo.findOne({ where: { id: courseId } });
    if (!course) {
      return sendFailed(res, 400, '查無此課程');
    }
    
    // 第二關：檢查這個人是不是已經報名過同一堂課了 (連以前取消過的也算報名過，不能再報)
    const existingBooking = await bookingRepo.findOne({
      where: {
        user: { id: req.user.id },
        course: { id: courseId },
      },
    });
    
    if (existingBooking) {
      return sendFailed(res, 400, '已經報名過此課程');
    }
    
    // 第三關：算一下他還有沒有堂數可以扣
    const purchases = await purchaseRepo.find({ where: { user: { id: req.user.id } } });
    const totalCredits = purchases.reduce((sum, p) => sum + p.purchased_credits, 0);
    
    const { IsNull } = require('typeorm');
    const allActiveBookings = await bookingRepo.find({
      where: {
        user: { id: req.user.id },
        cancelled_at: IsNull(),
      },
    });
    const creditRemain = totalCredits - allActiveBookings.length;
    
    if (creditRemain <= 0) {
      return sendFailed(res, 400, '已無可使用堂數');
    }
    
    // 第四關：檢查這堂課還有沒有位子 (只算還沒取消的有效報名)
    const courseActiveBookings = await bookingRepo.find({
      where: {
        course: { id: courseId },
        cancelled_at: IsNull(),
      },
    });
    
    if (courseActiveBookings.length >= course.max_participants) {
      return sendFailed(res, 400, '已達最大參加人數，無法參加');
    }
    
    // 四關都過了！幫他建立報名紀錄
    const newBooking = bookingRepo.create({
      user: req.user,
      course,
    });
    await bookingRepo.save(newBooking);
    
    return sendSuccess(res, 201, null);
  } catch (error) {
    next(error);
  }
});

// 取消報名 (軟刪除，只要押上取消時間就好，不用真的從資料庫砍掉)
router.delete('/:courseId', verifyToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    
    if (!isValidUUID(courseId)) {
      return sendFailed(res, 400, '參數格式錯誤');
    }
    
    const bookingRepo = AppDataSource.getRepository(CourseBooking);
    const { IsNull } = require('typeorm');
    
    const booking = await bookingRepo.findOne({
      where: {
        user: { id: req.user.id },
        course: { id: courseId },
        cancelled_at: IsNull(),
      },
    });
    
    if (!booking) {
      return sendFailed(res, 400, '查無此報名紀錄或已取消');
    }
    
    booking.cancelled_at = new Date();
    await bookingRepo.save(booking);
    
    return sendSuccess(res, 200, null);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
