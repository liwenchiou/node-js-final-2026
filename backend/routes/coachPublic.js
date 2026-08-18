const express = require('express');
const router = express.Router();
const { AppDataSource } = require('../utils/dataSource');
const Coach = require('../entities/Coach');
const Course = require('../entities/Course');
const { sendSuccess, sendFailed } = require('../utils/responseFormat');
const { isValidUUID } = require('../utils/validations');

// GET /api/coaches
router.get('/', async (req, res, next) => {
  try {
    const { per, page } = req.query;
    
    // per 與 page 必填驗證
    if (!per || !page) {
      return sendFailed(res, 400, '缺少必填參數');
    }
    
    const perNum = parseInt(per, 10);
    const pageNum = parseInt(page, 10);
    
    if (isNaN(perNum) || isNaN(pageNum)) {
      return sendFailed(res, 400, '參數格式錯誤');
    }
    
    const take = perNum;
    const skip = (pageNum - 1) * perNum;
    
    const coachRepo = AppDataSource.getRepository(Coach);
    const coaches = await coachRepo.find({
      relations: { user: true },
      take,
      skip,
    });
    
    const data = coaches.map(coach => ({
      id: coach.id,
      user_id: coach.user ? coach.user.id : null,
      name: coach.user ? coach.user.name : null,
    }));
    
    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

// GET /api/coaches/:coachId
router.get('/:coachId', async (req, res, next) => {
  try {
    const { coachId } = req.params;
    
    // 驗證 uuid
    if (!isValidUUID(coachId)) {
      return sendFailed(res, 400, '欄位未填寫正確');
    }
    
    const coachRepo = AppDataSource.getRepository(Coach);
    const coach = await coachRepo.findOne({
      where: { id: coachId },
      relations: { user: true, skills: true },
    });
    
    if (!coach) {
      return sendFailed(res, 400, '找不到該教練');
    }
    
    return sendSuccess(res, 200, {
      user: {
        name: coach.user ? coach.user.name : null,
        role: coach.user ? coach.user.role : 'COACH',
      },
      coach: {
        id: coach.id,
        user_id: coach.user ? coach.user.id : null,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        created_at: coach.created_at,
        updated_at: coach.updated_at,
        skills: coach.skills ? coach.skills.map(skill => skill.name) : [],
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/coaches/:coachId/courses
router.get('/:coachId/courses', async (req, res, next) => {
  try {
    const { coachId } = req.params;
    
    // 驗證 uuid
    if (!isValidUUID(coachId)) {
      return sendFailed(res, 400, '欄位未填寫正確');
    }
    
    const coachRepo = AppDataSource.getRepository(Coach);
    const coach = await coachRepo.findOne({
      where: { id: coachId },
      relations: { user: true },
    });
    
    if (!coach) {
      return sendFailed(res, 400, '找不到該教練');
    }
    
    const courseRepo = AppDataSource.getRepository(Course);
    const { MoreThan } = require('typeorm');
    
    const now = new Date();
    const courses = await courseRepo.find({
      where: {
        user: { id: coach.user.id },
        end_at: MoreThan(now),
      },
      relations: { skill: true, user: true },
      order: { start_at: 'ASC' },
    });
    
    const data = courses.map(course => ({
      id: course.id,
      name: course.name,
      description: course.description,
      start_at: course.start_at,
      end_at: course.end_at,
      max_participants: course.max_participants,
      coach_name: course.user ? course.user.name : null,
      skill_name: course.skill ? course.skill.name : null,
    }));
    
    return sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
