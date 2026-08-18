const express = require('express');
const router = express.Router();
const { AppDataSource } = require('../utils/dataSource');
const User = require('../entities/User');
const Coach = require('../entities/Coach');
const Skill = require('../entities/Skill');
const Course = require('../entities/Course');
const { sendSuccess, sendFailed } = require('../utils/responseFormat');
const { verifyToken } = require('../utils/auth');

// 自己寫一個檢查權限的 Middleware，專門用來擋掉不是教練的人
const isCoach = async (req, res, next) => {
  const coachRepo = AppDataSource.getRepository(Coach);
  const coach = await coachRepo.findOne({
    where: { user: { id: req.user.id } },
    relations: { skills: true },
  });
  
  if (!coach) {
    return sendFailed(res, 401, '使用者尚未成為教練');
  }
  
  req.coach = coach; // 把查到的教練資料掛在 req 上，後面的 API 就可以直接拿來用了
  next();
};

const { isValidUUID } = require('../utils/validations');

// 教練查自己的資料
router.get('/coaches', verifyToken, isCoach, async (req, res, next) => {
  try {
    return sendSuccess(res, 200, {
      id: req.coach.id,
      experience_years: req.coach.experience_years,
      description: req.coach.description,
      profile_image_url: req.coach.profile_image_url,
      skill_ids: req.coach.skills ? req.coach.skills.map(s => s.id) : [],
    });
  } catch (error) {
    next(error);
  }
});

// 教練改自己的資料 (像是改個自我介紹之類的)
router.put('/coaches', verifyToken, isCoach, async (req, res, next) => {
  try {
    const { experience_years, description, profile_image_url, skill_ids } = req.body;

    if (
      experience_years === undefined || typeof experience_years !== 'number' || experience_years < 0 || !Number.isInteger(experience_years) ||
      !description || typeof description !== 'string' || description.trim() === '' ||
      !profile_image_url || typeof profile_image_url !== 'string' || !profile_image_url.startsWith('https://') ||
      !Array.isArray(skill_ids) || skill_ids.length === 0 || !skill_ids.every(id => typeof id === 'string' && isValidUUID(id))
    ) {
      return sendFailed(res, 400, '欄位未填寫正確');
    }
    
    const coachRepo = AppDataSource.getRepository(Coach);
    const skillRepo = AppDataSource.getRepository(Skill);
    
    req.coach.experience_years = experience_years;
    req.coach.description = description;
    req.coach.profile_image_url = profile_image_url;
    
    const { In } = require('typeorm');
    const skills = await skillRepo.find({ where: { id: In(skill_ids) } });
    req.coach.skills = skills;
    
    await coachRepo.save(req.coach);
    
    return sendSuccess(res, 200, {
      id: req.coach.id,
      experience_years: req.coach.experience_years,
      description: req.coach.description,
      profile_image_url: req.coach.profile_image_url,
      skill_ids: req.coach.skills ? req.coach.skills.map(s => s.id) : [],
    });
  } catch (error) {
    next(error);
  }
});



// 教練新開一堂課
router.post('/coaches/courses', verifyToken, isCoach, async (req, res, next) => {
  try {
    const { skill_id, name, description, start_at, end_at, max_participants, meeting_url } = req.body;
    
    // 手動判斷所有必填與格式
    if (!skill_id || !isValidUUID(skill_id)) return sendFailed(res, 400, '欄位驗證失敗');
    if (!name || typeof name !== 'string' || name.trim() === '') return sendFailed(res, 400, '欄位驗證失敗');
    if (description !== undefined && typeof description !== 'string') return sendFailed(res, 400, '欄位驗證失敗');
    if (!start_at || typeof start_at !== 'string') return sendFailed(res, 400, '欄位驗證失敗');
    if (!end_at || typeof end_at !== 'string') return sendFailed(res, 400, '欄位驗證失敗');
    if (typeof max_participants !== 'number' || max_participants < 1 || !Number.isInteger(max_participants)) return sendFailed(res, 400, '欄位驗證失敗');
    if (!meeting_url || typeof meeting_url !== 'string' || !meeting_url.startsWith('https://')) return sendFailed(res, 400, '欄位驗證失敗');
    const courseRepo = AppDataSource.getRepository(Course);
    const skillRepo = AppDataSource.getRepository(Skill);
    
    const skill = await skillRepo.findOne({ where: { id: skill_id } });
    if (!skill) {
      return sendFailed(res, 400, '指定的技能不存在');
    }
    
    const newCourse = courseRepo.create({
      name,
      description,
      start_at,
      end_at,
      max_participants,
      meeting_url,
      user: req.user,
      skill,
    });
    
    await courseRepo.save(newCourse);
    
    return sendSuccess(res, 201, {
      course: {
        id: newCourse.id,
      }
    });
  } catch (error) {
    next(error);
  }
});

// 教練看自己開了哪些課
router.get('/coaches/courses', verifyToken, isCoach, async (req, res, next) => {
  try {
    const courseRepo = AppDataSource.getRepository(Course);
    const bookingRepo = AppDataSource.getRepository(CourseBooking);
    const { IsNull } = require('typeorm');
    
    // 先找出這個教練開的所有課 (利用目前登入的 user_id 去對應)
    const courses = await courseRepo.find({
      where: { user: { id: req.user.id } },
      order: { created_at: 'DESC' },
    });
    
    const now = new Date();
    
    const data = await Promise.all(courses.map(async (course) => {
      const startDate = new Date(course.start_at);
      const endDate = new Date(course.end_at);
      let status = '尚未開始';
      if (now > endDate) {
        status = '已結束';
      } else if (now >= startDate && now <= endDate) {
        status = '進行中';
      }
      
      const participants = await bookingRepo.count({
        where: {
          course: { id: course.id },
          cancelled_at: IsNull(),
        },
      });
      
      return {
        id: course.id,
        name: course.name,
        status,
        start_at: course.start_at,
        end_at: course.end_at,
        max_participants: course.max_participants,
        meeting_url: course.meeting_url,
        participants,
      };
    }));
    
    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

// 偷看某一堂特定的課 (只能看自己開的)
router.get('/coaches/courses/:courseId', verifyToken, isCoach, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const courseRepo = AppDataSource.getRepository(Course);
    
    const course = await courseRepo.findOne({
      where: { id: courseId, user: { id: req.user.id } },
      relations: { skill: true },
    });
    
    if (!course) {
      return sendFailed(res, 404, '課程不存在或無權限查看');
    }
    
    return sendSuccess(res, 200, {
      id: course.id,
      name: course.name,
      skill_id: course.skill ? course.skill.id : null,
      meeting_url: course.meeting_url,
      start_at: course.start_at,
      end_at: course.end_at,
      max_participants: course.max_participants,
      description: course.description,
    });
  } catch (error) {
    next(error);
  }
});

// 編輯某一堂課程的內容
router.put('/coaches/courses/:courseId', verifyToken, isCoach, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { skill_id, name, description, start_at, end_at, max_participants, meeting_url } = req.body;

    if (!skill_id || !isValidUUID(skill_id)) return sendFailed(res, 400, '欄位驗證失敗');
    if (!name || typeof name !== 'string' || name.trim() === '') return sendFailed(res, 400, '欄位驗證失敗');
    if (description !== undefined && typeof description !== 'string') return sendFailed(res, 400, '欄位驗證失敗');
    if (!start_at || typeof start_at !== 'string') return sendFailed(res, 400, '欄位驗證失敗');
    if (!end_at || typeof end_at !== 'string') return sendFailed(res, 400, '欄位驗證失敗');
    if (typeof max_participants !== 'number' || max_participants < 1 || !Number.isInteger(max_participants)) return sendFailed(res, 400, '欄位驗證失敗');
    if (!meeting_url || typeof meeting_url !== 'string' || !meeting_url.startsWith('https://')) return sendFailed(res, 400, '欄位驗證失敗');
    
    const courseRepo = AppDataSource.getRepository(Course);
    const skillRepo = AppDataSource.getRepository(Skill);
    
    const course = await courseRepo.findOne({
      where: { id: courseId, user: { id: req.user.id } },
    });
    
    if (!course) {
      return sendFailed(res, 404, '課程不存在或無權限修改');
    }
    
    const skill = await skillRepo.findOne({ where: { id: skill_id } });
    if (!skill) {
      return sendFailed(res, 400, '指定的技能不存在');
    }
    
    course.name = name;
    course.description = description;
    course.start_at = start_at;
    course.end_at = end_at;
    course.max_participants = max_participants;
    course.meeting_url = meeting_url;
    course.skill = skill;
    
    await courseRepo.save(course);
    
    return sendSuccess(res, 200, {
      course: {
        id: course.id,
      }
    });
  } catch (error) {
    next(error);
  }
});


// 幫會員升級成教練 (這個寫在最後面，免得跟上面的 /coaches/courses 打架，被誤認成是 userId)
router.post('/coaches/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // 驗證是否為 uuid
    if (!isValidUUID(userId)) {
      return sendFailed(res, 400, '無效的 userId');
    }

    const { experience_years, description, profile_image_url } = req.body;
    
    if (experience_years !== undefined && (typeof experience_years !== 'number' || experience_years < 0 || !Number.isInteger(experience_years))) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    if (description !== undefined && typeof description !== 'string') {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    if (profile_image_url !== undefined && (typeof profile_image_url !== 'string' || !profile_image_url.startsWith('https://'))) {
      return sendFailed(res, 400, '欄位驗證失敗');
    }
    
    const userRepo = AppDataSource.getRepository(User);
    const coachRepo = AppDataSource.getRepository(Coach);
    
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return sendFailed(res, 400, '使用者不存在');
    }
    
    const existingCoach = await coachRepo.findOne({ where: { user: { id: userId } } });
    if (existingCoach) {
      return sendFailed(res, 409, '使用者已經是教練');
    }
    
    // 建立一張新的教練名片
    const newCoach = coachRepo.create({
      experience_years,
      description,
      profile_image_url,
      user, // 把教練名片跟這個會員綁定起來 (建立關聯)
    });
    
    await coachRepo.save(newCoach);
    
    // 順便把這隻帳號的權限 (role) 改成 COACH，這樣他下次登入就是教練了
    user.role = 'COACH';
    await userRepo.save(user);
    
    return sendSuccess(res, 201, {
      user: {
        name: user.name,
        role: user.role,
      }
    });
  } catch (error) {
    next(error);
  }
});

const CreditPurchase = require('../entities/CreditPurchase');
const CreditPackage = require('../entities/CreditPackage');
const CourseBooking = require('../entities/CourseBooking');

// 算一下教練這個月賺了多少錢 (M6 作業的重頭戲)
router.get('/coaches/revenue', verifyToken, isCoach, async (req, res, next) => {
  try {
    const { month } = req.query; // 前端會傳 'january' 這種英文月份過來
    if (!month) {
      return sendFailed(res, 400, '缺少 month 參數');
    }
    
    // 老師說要先把英文月份轉成 0 到 11，才好丟給 Date 用
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIndex = monthNames.indexOf(month.toLowerCase());
    
    if (monthIndex === -1) {
      return sendFailed(res, 400, '無效的月份');
    }
    
    const currentYear = new Date().getFullYear();
    // 抓出這個月的第一天，還有這個月最後一天的最後一秒
    const startDate = new Date(currentYear, monthIndex, 1);
    const endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
    
    // 第1步：算出「單堂均價」 (全部方案加總的錢 ÷ 全部加總的堂數)
    const packageRepo = AppDataSource.getRepository(CreditPackage);
    const allPackages = await packageRepo.find();
    
    let totalPrice = 0;
    let totalCredits = 0;
    for (const pkg of allPackages) {
      totalPrice += Number(pkg.price);
      totalCredits += Number(pkg.credit_amount);
    }
    
    // 防呆一下，萬一根本沒人買過方案，除以 0 會爆掉
    const perCreditPrice = totalCredits > 0 ? (totalPrice / totalCredits) : 0;
    
    // 第2步：找出這個教練在這個月裡，有幾筆成功 (沒被取消) 的報名紀錄
    const bookingRepo = AppDataSource.getRepository(CourseBooking);
    const { Between, IsNull } = require('typeorm');
    
    const bookings = await bookingRepo.find({
      where: {
        course: { user: { id: req.user.id } }, // 確認這堂課真的是這個教練開的
        created_at: Between(startDate, endDate),
        cancelled_at: IsNull(),
      },
      relations: { course: { user: true } },
    });
    
    const activeBookingCount = bookings.length;
    
    // 第3步：算薪水 (報名人數 × 單堂均價，記得要無條件捨去，不能算小數點)
    const revenue = Math.floor(activeBookingCount * perCreditPrice);
    
    return sendSuccess(res, 200, {
      total: {
        revenue,
        participants: activeBookingCount,
        course_count: activeBookingCount,
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
